import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalState, extractTags, loadConfig, loadTasks } from './execution-model.mjs';
import { resolveExecutionBatch, taskOwnership } from './parallel-execution.mjs';
import { resolveAgentContextFast } from './agent-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import {runBoundedReconciliation as reconcileV4Lifecycle} from './reconcile-runner.mjs';
import { todoShardSources } from './todo-shards.mjs';
import { rehydrateStateFast } from './state-model.mjs';
import { compactTaskPayload } from './v4-context-economy.mjs';
import { inspectDecisionPlan } from './decision/plan-alignment.mjs';
import { isV5 } from './v5-config.mjs';

const CLAIM_ROOT='.executionkit/agents/claims';
const CLAIM_HISTORY_ROOT='.executionkit/agents/history';
const RESULT_REL='.executionkit/agent-result.json';
const CLAIM_REL='.executionkit/agent-claim.json';
const FALLBACK_REL='.executionkit/agents/native-fallback.json';
const ACTIVE=new Set(['PREPARED','DELEGATED','READY_FOR_INTEGRATION','INTEGRATING','RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED']);

function run(root,args,cwd=root,timeout=15000){return spawnSync('git',args,{cwd,encoding:'utf8',timeout,maxBuffer:32*1024*1024,windowsHide:true});}
function git(root,args,cwd=root,timeout=15000){const r=run(root,args,cwd,timeout);if(r.status!==0)throw new Error(String(r.stderr||r.stdout||r.error?.message||'git command failed').trim());return String(r.stdout??'').trim();}
function gitInfo(root,{skipDirty=false}={}){
  const refs=run(root,['rev-parse','--is-inside-work-tree','HEAD']);
  if(refs.status!==0)return {isGit:false};
  const lines=String(refs.stdout??'').trim().split(/\r?\n/);
  if(lines[0]!=='true')return {isGit:false};
  const head=lines[1]??git(root,['rev-parse','HEAD']);
  const branch=git(root,['rev-parse','--abbrev-ref','HEAD']);
  if(skipDirty)return {isGit:true,head,branch,dirty:null};
  const status=run(root,['status','--porcelain=v1','--untracked-files=normal']);
  const dirtyLines=String(status.stdout??'').split(/\r?\n/).filter((line)=>line.trim()&&!/^\?\?\s+\.executionkit(?:\/|$)/.test(line));
  return {
    isGit:true,
    head,
    branch,
    dirty:status.status!==0||dirtyLines.length>0
  };
}
function safeId(value){return String(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'task';}
function claimId(head,taskId){return safeId(taskId)+'-'+crypto.createHash('sha256').update(head+'\0'+taskId).digest('hex').slice(0,10);}
function claimFile(root,id,{create=false}={}){return resolveDerivedPath(root,CLAIM_ROOT+'/'+id+'.json','v4 agent claim',{createParents:create});}
function historyClaimFile(root,id,{create=false}={}){return resolveDerivedPath(root,CLAIM_HISTORY_ROOT+'/'+id+'.json','v4 agent claim history',{createParents:create});}
function claimRecord(root,id){
  const active=claimFile(root,id);
  if(fs.existsSync(active))return {file:active,claim:JSON.parse(fs.readFileSync(active,'utf8')),archived:false};
  const history=historyClaimFile(root,id);
  if(fs.existsSync(history))return {file:history,claim:JSON.parse(fs.readFileSync(history,'utf8')),archived:true};
  return null;
}
function archiveClaimRecord(root,claim){
  atomicJson(historyClaimFile(root,claim.claimId,{create:true}),claim);
  fs.rmSync(claimFile(root,claim.claimId),{force:true});
  return claim;
}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
function worktreeBase(root){return path.join(path.dirname(root),'.executionkit-worktrees',path.basename(root));}
function taskContext(task,action,config){return {taskId:task.id,action,state:canonicalState(task,config),phase:task.meta?.Phase??null,tags:extractTags(task),risk:task.meta?.Risk??null};}
function canonicalTaskAuthorityPaths(root){
  const {config}=loadConfig(root),plan=todoShardSources(root,config);
  if(plan.errors.length)throw new Error(plan.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  return new Set((plan.mode==='sharded'
    ? [plan.manifestPath,...plan.active.map((x)=>x.path),...plan.archives]
    : [config.todoPath,...(config.taskArchivePaths??[])]
  ).map((x)=>String(x).split(path.sep).join('/')));
}

export function listV4AgentClaims(root){
  const dir=resolveDerivedPath(root,CLAIM_ROOT,'v4 agent claims');
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter((x)=>x.endsWith('.json')).sort().map((name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));
}

function nativeFallback(root){
  const file=resolveDerivedPath(root,FALLBACK_REL,'native agent fallback');
  if(!fs.existsSync(file))return null;
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  // Never apply a previous HEAD's host decision to a new candidate.
  const head=gitInfo(root,{skipDirty:true});
  return head.isGit&&head.head===value.sourceHead?value:null;
}

function buildWorkerPrompt(claim){
  const owned=Array.isArray(claim.ownership)&&claim.ownership.length?claim.ownership.join(', '):'task-scoped files only';
  const ref=claim.taskRef?.sourcePath?(claim.taskRef.sourcePath+(claim.taskRef.startLine?':'+claim.taskRef.startLine:'')):'TODO.md';
  const completeCmd='executionkit agents result '+claim.worktree+' --status COMPLETED --verification "<cmd>" --evidence "<refs>"';
  const blockedCmd='executionkit agents result '+claim.worktree+' --status BLOCKED --message "<reason>"';
  return [
    'Execute canonical task '+claim.taskId+(claim.title?' ('+claim.title+')':'')+' in isolated Git worktree '+claim.worktree+' (branch '+claim.branch+').',
    '1. Open '+CLAIM_REL+' in '+claim.worktree+' and read the exact canonical task block at '+ref+'.',
    '2. Modify ONLY owned paths ('+owned+'). Never mutate TODO.md, todo/*.md, .executionkit/ or .agents/.',
    '3. Run targeted verification for your changes, commit all work cleanly on branch '+claim.branch+', and record completion:',
    '   '+completeCmd,
    '   (or if blocked: '+blockedCmd+')'
  ].join('\n');
}

function hostDelegation(claim){
  const workerPrompt=claim.workerPrompt??buildWorkerPrompt(claim);
  const completeCommand='executionkit agents result '+claim.worktree+' --status COMPLETED --verification "<cmd>" --evidence "<refs>"';
  const blockedCommand='executionkit agents result '+claim.worktree+' --status BLOCKED --message "<reason>"';
  const subagentSpec=claim.subagentSpec??{
    typeName:'executionkit-implementer',
    role:'Task Worker '+claim.taskId,
    claimId:claim.claimId,
    taskId:claim.taskId,
    taskRef:claim.taskRef??null,
    worktree:claim.worktree,
    branch:claim.branch,
    ownedPaths:claim.ownership??[],
    completeCommand,
    blockedCommand,
    prompt:workerPrompt,
  };
  return {
    claimId:claim.claimId,taskId:claim.taskId,worktree:claim.worktree,branch:claim.branch,routeId:claim.routeId,
    taskRef:claim.taskRef??null,claimPath:CLAIM_REL,resources:claim.resources,resultPath:claim.resultPath,
    ownedPaths:claim.ownership??[],
    workerPrompt,
    subagentSpec,
    spawnProofRequired:true,
    acknowledgeCommand:'executionkit agents delegated . --claim '+claim.claimId+' --spawn-tool <actual-tool> --worker-id <returned-worker-id>',
    instruction:'The orchestrator must call a real host-native spawn tool FIRST. A prepared worktree is not a worker. Immediately record the returned tool name and worker ID using the acknowledgeCommand. If this host has no spawn tool, execute executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE and continue the task sequentially, without claiming parallel execution. The worker opens '+CLAIM_REL+', reads the exact canonical task at taskRef and only routed resources, commits owned files and writes '+RESULT_REL+'. Never invent a spawn receipt.'
  };
}
export function v4AgentRuntimeStatus(root){
  const claims=listV4AgentClaims(root);
  const active=claims.filter((c)=>ACTIVE.has(c.status)),pending=active.filter((c)=>c.status==='PREPARED');
  const fallback=active.length===0?nativeFallback(root):null;
  return {
    schemaVersion:'executionkit-v4-agent-runtime/v1',claimCount:claims.length,activeCount:active.length,
    active:active.map((c)=>({claimId:c.claimId,taskId:c.taskId,status:c.status,worktree:c.worktree,branch:c.branch})),
    hostAction:pending.length?'SPAWN_NATIVE_SUBAGENTS':active.length?'COLLECT_AGENT_RESULTS':'NONE',
    hostCapability:pending.length?'UNVERIFIED_SPAWN_RECEIPT_REQUIRED':active.some(c=>c.spawnReceipt)?'RECEIPT_RECORDED':fallback?'DECLINED_FOR_SOURCE_HEAD':'NO_ACTIVE_HOST_PROOF',
    fallback,
    nextAction:pending.length?'SPAWN_OR_DECLINE_NOW':active.length?'COLLECT_NONBLOCKING':'RESOLVE_CANONICAL_NEXT_TASK',
    fallbackCommand:pending.length&&pending.length===active.length?'executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE':null,
    hostDelegations:pending.map(hostDelegation)
  };
}

export function prepareV4AgentExecution(root,{boost=false,apply=true,retrySpawn=false}={}){
  root=path.resolve(root);
  const info=gitInfo(root,{skipDirty:!apply});
  if(!info.isGit)throw new Error('v4 multi-agent execution requires a Git worktree');
  if(apply&&info.dirty)throw new Error('v4 multi-agent worktree creation requires a clean orchestrator worktree');
  const existing=v4AgentRuntimeStatus(root);
  if(existing.activeCount) return {...existing,status:'ACTIVE_BATCH_EXISTS',hostDelegations:[],message:'Collect/integrate/cancel the active batch before creating another.'};
  const {config}=loadConfig(root);
  const loaded=loadTasks(root,config,{archiveMode:'index'});
  if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const plan=resolveExecutionBatch(loaded.tasks,config,{mode:'closure',boost,includeConvergence:false});
  if(!plan.batch.length)return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'NO_ACTIONABLE_WORK',plan,claims:[],hostDelegations:[]};
  const fallback=nativeFallback(root);
  if(!retrySpawn&&fallback?.taskId===plan.primary?.task?.id){
    return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'SEQUENTIAL_FALLBACK_REQUIRED',hostAction:'NONE',fallback,claims:[],hostDelegations:[],nextAction:'CONTINUE_PRIMARY_INLINE',message:'Native spawn was declined on this HEAD/task. Continue inline; use agents run --retry-spawn only after confirming host spawn support.'};
  }
  const routed=plan.batch.map((entry)=>({entry,agent:resolveAgentContextFast(root,config,taskContext(entry.task,entry.action,config))}));
  const unrouted=routed.filter((item)=>!item.agent.routeId);
  if(unrouted.length)return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'AGENT_ROUTE_REQUIRED',plan,taskIds:unrouted.map((item)=>item.entry.task.id),claims:[],hostDelegations:[],message:'Every v4 delegated task requires a deterministic Agent OS route; fallback-only routing is not executable.'};
  if(apply){
    const primary=routed[0];
    const runtimePlan={
      status:'READY',
      task:compactTaskPayload({id:primary.entry.task.id,state:primary.entry.task.meta?.Status??null,semanticState:canonicalState(primary.entry.task,config),title:primary.entry.task.title??null,phase:primary.entry.task.meta?.Phase??null,sourcePath:primary.entry.task.sourcePath??null,startLine:primary.entry.task.startLine??null,meta:primary.entry.task.meta}),
      action:primary.entry.action,
      routeId:primary.agent.routeId,
      resources:Object.fromEntries(Object.entries(primary.agent.resources).map(([kind,values])=>[kind,values.map((x)=>({id:x.id,path:x.path}))])),
      closure:null,
    };
    const state=rehydrateStateFast(root,{runtimePlan,config});
    if(state.safeToResume!==true)return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'STATE_REHYDRATION_REQUIRED',state,claims:[],hostDelegations:[],message:'Agent OS cannot create a new v4 delegation batch until lightweight State OS identity is fresh.'};
    if(isV5(config)){
      for(const {entry} of [...routed].reverse()){
        const decisionPlan=inspectDecisionPlan(root,{task:entry.task,capture:Boolean(apply)});
        if(decisionPlan.blocking)return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'DECISION_PLAN_BLOCKED',taskId:entry.task.id,plan:decisionPlan,claims:[],hostDelegations:[],message:'Decision OS plan alignment blocked delegation for '+entry.task.id};
      }
    }
  }
  const knowledge={decision:{outcome:'NATIVE_ON_DEMAND',used:[],externalUsed:[]},evidence:null,data:null};
  const created=[];
  try{
    for(const {entry,agent} of routed){
      const id=claimId(info.head,entry.task.id);
      const branch='executionkit/v4/'+safeId(entry.task.id).toLowerCase()+'-'+id.slice(-10);
      const worktree=path.join(worktreeBase(root),id);
      const ownership=taskOwnership(entry.task);
      const taskRef={sourcePath:entry.task.sourcePath??null,startLine:entry.task.startLine??null};
      const baseClaim={claimId:id,taskId:entry.task.id,title:entry.task.title??null,worktree,branch,ownership,taskRef};
      const workerPrompt=buildWorkerPrompt(baseClaim);
      const completeCommand='executionkit agents result '+worktree+' --status COMPLETED --verification "<cmd>" --evidence "<refs>"';
      const blockedCommand='executionkit agents result '+worktree+' --status BLOCKED --message "<reason>"';
      const claim={
        schemaVersion:'executionkit-v4-agent-claim/v1',claimId:id,taskId:entry.task.id,title:entry.task.title??null,action:entry.action,status:apply?'PREPARED':'PLANNED',
        taskRef,
        baseHead:info.head,baseBranch:info.branch,branch,worktree,ownership,createdAt:new Date().toISOString(),
        routeId:agent.routeId,supplementIds:agent.supplementIds,resources:Object.fromEntries(Object.entries(agent.resources).map(([kind,values])=>[kind,values.map((x)=>({id:x.id,path:x.path}))])),
        knowledge:{decision:knowledge.decision,evidence:null,context:null,provenance:null},
        constraints:{canonicalTaskAuthorityMutation:false,controlPlaneMutation:false,finalIntegration:false,oneExecutor:true,isolatedWorktree:true},
        resultPath:RESULT_REL,
        workerPrompt,
        subagentSpec:{
          typeName:'executionkit-implementer',
          role:'Task Worker '+entry.task.id,
          claimId:id,
          taskId:entry.task.id,
          taskRef,
          worktree,
          branch,
          ownedPaths:ownership,
          completeCommand,
          blockedCommand,
          prompt:workerPrompt,
        }
      };
      if(apply){
        fs.mkdirSync(path.dirname(worktree),{recursive:true});
        if(fs.existsSync(worktree))throw new Error('Agent worktree path already exists: '+worktree);
        const add=run(root,['worktree','add','-b',branch,worktree,info.head],root,60000);
        if(add.status!==0)throw new Error(String(add.stderr||add.stdout||'git worktree add failed').trim());
        atomicJson(claimFile(root,id,{create:true}),claim);
        const localClaim=path.join(worktree,CLAIM_REL);fs.mkdirSync(path.dirname(localClaim),{recursive:true});atomicJson(localClaim,claim);
      }
      created.push(claim);
    }
  }catch(error){
    if(apply){
      for(const partial of created){
        try{if(fs.existsSync(partial.worktree))run(root,['worktree','remove',partial.worktree,'--force'],root,60000);}catch{}
        try{run(root,['branch','-D',partial.branch],root,15000);}catch{}
        try{fs.rmSync(claimFile(root,partial.claimId),{force:true});}catch{}
      }
    }
    throw error;
  }
  return {
    schemaVersion:'executionkit-v4-agent-runtime/v1',status:apply?'DELEGATION_REQUIRED':'PLANNED',boost,planReason:plan.reason,policy:plan.policy,claims:created,
    hostAction:'SPAWN_NATIVE_SUBAGENTS',
    knowledgeDecision:knowledge.decision,
    hostDelegations:created.map(hostDelegation)
  };
}


const SPAWN_RECEIPT_ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/;
function validSpawnReceipt(value){return typeof value==='string'&&SPAWN_RECEIPT_ID.test(value)&&!/^(unknown|none|mock|fake|placeholder|unavailable|n\/a)$/i.test(value);}
export function markV4AgentClaimDelegated(root,claimIdValue,{spawnTool=null,workerId=null}={}){
  root=path.resolve(root);
  const file=claimFile(root,claimIdValue);
  if(!fs.existsSync(file))throw new Error('Unknown v4 agent claim: '+claimIdValue);
  const claim=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!validSpawnReceipt(spawnTool)||!validSpawnReceipt(workerId))throw new Error('Real host-native spawn receipt required: --spawn-tool and --worker-id from actual spawn tool output');
  if(claim.status==='DELEGATED'){
    if(claim.spawnReceipt?.tool!==spawnTool||claim.spawnReceipt?.workerId!==workerId)throw new Error('Delegated claim spawn receipt mismatch');
    return {schemaVersion:'executionkit-v4-agent-delegation/v1',status:'DELEGATED',claimId:claim.claimId,taskId:claim.taskId,idempotent:true,spawnReceipt:claim.spawnReceipt};
  }
  if(claim.status!=='PREPARED')throw new Error('Claim cannot be marked delegated from state: '+claim.status);
  if(listV4AgentClaims(root).some(other=>other.claimId!==claim.claimId&&other.spawnReceipt?.workerId===workerId))throw new Error('Host worker ID already belongs to another claim');
  const worktree=gitInfo(claim.worktree,{skipDirty:true});
  if(!worktree.isGit||worktree.branch!==claim.branch)throw new Error('Claim worktree/branch changed before acknowledgement');
  claim.status='DELEGATED';claim.delegatedAt=new Date().toISOString();
  claim.spawnReceipt={tool:spawnTool,workerId,recordedAt:claim.delegatedAt};
  atomicJson(file,claim);
  const local=path.join(claim.worktree,CLAIM_REL);if(fs.existsSync(local))atomicJson(local,claim);
  return {schemaVersion:'executionkit-v4-agent-delegation/v1',status:'DELEGATED',claimId:claim.claimId,taskId:claim.taskId,worktree:claim.worktree,branch:claim.branch,delegatedAt:claim.delegatedAt,spawnReceipt:claim.spawnReceipt};
}

export function declineV4AgentExecution(root,{reason='HOST_SPAWN_UNAVAILABLE'}={}){
  root=path.resolve(root);
  const active=listV4AgentClaims(root).filter(claim=>ACTIVE.has(claim.status));
  if(active.some(claim=>claim.status!=='PREPARED'))throw new Error('Cannot decline after a worker was delegated or integrated');
  for(const claim of active){
    const worker=gitInfo(claim.worktree);
    if(!worker.isGit||worker.branch!==claim.branch||worker.head!==claim.baseHead||worker.dirty||fs.existsSync(path.join(claim.worktree,RESULT_REL)))throw new Error('Cannot decline a claim with worker activity: '+claim.claimId);
    const branchTip=run(root,['rev-parse','--verify','refs/heads/'+claim.branch]);
    if(!claim.branch.startsWith('executionkit/v4/')||branchTip.status!==0||String(branchTip.stdout).trim()!==claim.baseHead)throw new Error('Cannot decline a claim with non-pristine branch: '+claim.claimId);
  }
  if(!active.length)throw new Error('No PREPARED native agent claims to decline');
  const sourceHead=active[0].baseHead,taskId=active[0].taskId;
  if(active.some(claim=>claim.baseHead!==sourceHead))throw new Error('Cannot decline mixed-source claims');
  for(const claim of active){
    cleanupV4AgentClaim(root,claim.claimId,{force:true});
    const branchExists=run(root,['rev-parse','--verify','refs/heads/'+claim.branch]);
    if(branchExists.status===0){
      const remove=run(root,['branch','-D',claim.branch]);
      if(remove.status!==0)throw new Error('Failed to remove declined claim branch '+claim.branch+': '+String(remove.stderr||remove.stdout).trim());
    }
  }
  const fallback={schemaVersion:'executionkit-native-agent-fallback/v1',sourceHead,taskId,reason:String(reason).slice(0,120),recordedAt:new Date().toISOString()};
  atomicJson(resolveDerivedPath(root,FALLBACK_REL,'native agent fallback',{createParents:true}),fallback);
  return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:'SEQUENTIAL_FALLBACK_REQUIRED',reason:fallback.reason,declined:active.map(claim=>claim.claimId),parallelExecuted:false,fallback,nextAction:'Continue canonical primary task inline, without re-preparing this batch or claiming parallel execution.'};
}


export function writeV4AgentResult(worktree,{status='COMPLETED',message=null,verification=[],evidenceRefs=[]}={}){
  worktree=path.resolve(worktree);
  const claimPath=path.join(worktree,CLAIM_REL);
  if(!fs.existsSync(claimPath))throw new Error('Worker claim envelope missing: '+CLAIM_REL);
  const claim=JSON.parse(fs.readFileSync(claimPath,'utf8'));
  if(claim.schemaVersion!=='executionkit-v4-agent-claim/v1')throw new Error('Invalid worker claim envelope');
  if(!['COMPLETED','BLOCKED'].includes(status))throw new Error('Worker result status must be COMPLETED or BLOCKED');
  const info=gitInfo(worktree);
  if(!info.isGit)throw new Error('Worker result requires a Git worktree');
  const result={
    schemaVersion:'executionkit-v4-agent-result/v1',
    claimId:claim.claimId,
    taskId:claim.taskId,
    status,
    message,
    head:info.head,
    clean:!info.dirty,
    verification:Array.isArray(verification)?verification:[],
    evidenceRefs:Array.isArray(evidenceRefs)?evidenceRefs:[],
    completedAt:new Date().toISOString()
  };
  atomicJson(path.join(worktree,RESULT_REL),result);
  return result;
}

function readResult(claim){
  const file=path.join(claim.worktree,RESULT_REL);
  if(!fs.existsSync(file))return null;
  const result=JSON.parse(fs.readFileSync(file,'utf8'));
  if(result.schemaVersion!=='executionkit-v4-agent-result/v1'||result.claimId!==claim.claimId||result.taskId!==claim.taskId)throw new Error('Invalid agent result envelope for '+claim.claimId);
  return result;
}

export function collectV4AgentExecution(root){
  root=path.resolve(root);
  const claims=listV4AgentClaims(root),observed=[];
  const taskAuthorityPaths=canonicalTaskAuthorityPaths(root);
  for(const claim of claims){
    if(!ACTIVE.has(claim.status))continue;
    if(['RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED'].includes(claim.status)){observed.push(claim);continue;}
    let result=null;
    try{result=readResult(claim);}catch(error){
      const next={...claim,status:'BLOCKED',error:error.message,observedAt:new Date().toISOString()};
      archiveClaimRecord(root,next);observed.push(next);continue;
    }
    if(claim.status==='PREPARED'){observed.push({...claim,resultStatus:result?'UNACKNOWLEDGED_WORKER':'SPAWN_NOT_CONFIRMED'});continue;}
    if(!claim.spawnReceipt){observed.push({...claim,resultStatus:'SPAWN_RECEIPT_MISSING'});continue;}
    if(!result){observed.push({...claim,resultStatus:'PENDING'});continue;}
    const worker=gitInfo(claim.worktree);
    if(!worker.isGit){
      const next={...claim,status:'BLOCKED',result,error:'Claim worktree is no longer a Git worktree: '+claim.claimId,observedAt:new Date().toISOString()};
      archiveClaimRecord(root,next);observed.push(next);continue;
    }
    const diffChanged=git(claim.worktree,['diff','--name-only',claim.baseHead+'..'+worker.head],claim.worktree).split(/\r?\n/).filter(Boolean);
    const logChanged=git(claim.worktree,['log','--name-only','--pretty=format:',claim.baseHead+'..'+worker.head],claim.worktree).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const changed=[...new Set([...diffChanged,...logChanged])];
    const forbidden=changed.filter((p)=>taskAuthorityPaths.has(String(p).split(path.sep).join('/'))||p.startsWith('.executionkit/')||p.startsWith('.agents/'));
    const scopes=(claim.ownership??[]).map(s=>String(s).trim().replace(/^`+|`+$/g,'').trim().replace(/^\.\//,'').replace(/\/\*\*$/,'').replace(/\/$/,'')).filter(Boolean);
    const outOfScope=scopes.length?changed.filter((p)=>{const norm=String(p).split(path.sep).join('/');return !scopes.some(scope=>scope==='.'||norm===scope||norm.startsWith(scope+'/'));}):changed;
    let status='READY_FOR_INTEGRATION';
    let error=null;
    if(result.status!=='COMPLETED'){status='BLOCKED';error=result.message??'worker did not complete';}
    else if(worker.dirty){status='BLOCKED';error='worker worktree is dirty; result must be committed';}
    else if(worker.head===claim.baseHead){status='BLOCKED';error='worker produced no commit';}
    else if(forbidden.length){status='BLOCKED';error='worker modified orchestrator-owned control surfaces: '+forbidden.join(', ');}
    else if(!scopes.length){status='BLOCKED';error='claim has no valid ownership scopes';}
    else if(outOfScope.length){status='BLOCKED';error='worker modified files outside declared ownership ('+claim.ownership.join(', ')+'): '+outOfScope.join(', ');}
    const next={...claim,status,result,workerHead:worker.head,changedFiles:changed,observedAt:new Date().toISOString(),error};
    if(ACTIVE.has(status))atomicJson(claimFile(root,claim.claimId,{create:true}),next);
    else archiveClaimRecord(root,next);
    observed.push(next);
  }
  const active=observed.filter((c)=>ACTIVE.has(c.status));
  const reconciliation=active.filter((c)=>['RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED'].includes(c.status));
  return {schemaVersion:'executionkit-v4-agent-runtime/v1',status:reconciliation.length?'RECONCILIATION_REQUIRED':active.some((c)=>c.status==='READY_FOR_INTEGRATION')?'READY_FOR_INTEGRATION':active.length?'WAITING_FOR_WORKERS':'NO_ACTIVE_CLAIMS',reconciliationClaims:reconciliation.map((c)=>({claimId:c.claimId,taskId:c.taskId,status:c.status})),claims:observed};
}

export function integrateV4AgentClaim(root,claimIdValue,{apply=false}={}){
  root=path.resolve(root);
  const file=claimFile(root,claimIdValue);
  if(!fs.existsSync(file))throw new Error('Unknown v4 agent claim: '+claimIdValue);
  const claim=JSON.parse(fs.readFileSync(file,'utf8'));
  if(claim.status!=='READY_FOR_INTEGRATION')throw new Error('Claim is not ready for integration: '+claim.status);
  const info=gitInfo(root);
  if(!info.isGit)throw new Error('orchestrator root is not Git');
  if(apply&&info.dirty)throw new Error('orchestrator worktree must be clean before integrating an agent claim');
  const ancestor=run(root,['merge-base','--is-ancestor',claim.baseHead,info.head],root);
  if(ancestor.status!==0)throw new Error('orchestrator history no longer contains the claim base; refresh/rebase the claim before integration');
  const commits=git(claim.worktree,['rev-list','--reverse',claim.baseHead+'..'+claim.workerHead],claim.worktree).split(/\r?\n/).filter(Boolean);
  if(!commits.length)throw new Error('No worker commits available for integration');
  if(!apply)return {schemaVersion:'executionkit-v4-agent-integration/v1',status:'PLANNED',claimId:claim.claimId,taskId:claim.taskId,commits,changedFiles:claim.changedFiles,verification:claim.result?.verification??null};
  const integrationBaseHead=info.head;
  const applied=[];
  try{
    for(const commit of commits){const r=run(root,['cherry-pick',commit],root,60000);if(r.status!==0)throw new Error(String(r.stderr||r.stdout||'cherry-pick failed').trim());applied.push(commit);}
  }catch(error){
    run(root,['cherry-pick','--abort'],root);
    if(applied.length>0)run(root,['reset','--hard',integrationBaseHead],root);
    throw error;
  }
  const codeHead=git(root,['rev-parse','HEAD']);
  let reconciliation;
  try{
    reconciliation=reconcileV4Lifecycle(root,{boundary:'task',base:integrationBaseHead,taskId:claim.taskId,commitGeneratedDocs:true});
  }catch(error){
    reconciliation={status:'FAIL',error:error.message};
  }
  const finalHead=git(root,['rev-parse','HEAD']);
  const status=reconciliation.status==='PASS'
    ? 'INTEGRATED'
    : reconciliation.status==='REVIEW_REQUIRED'
      ? 'RECONCILIATION_REVIEW_REQUIRED'
      : 'RECONCILIATION_FAILED';
  const next={...claim,status,integratedAt:new Date().toISOString(),integrationBaseHead,codeHead,integratedHead:finalHead,integratedCommits:applied,reconciliation};
  if(status==='INTEGRATED')archiveClaimRecord(root,next);
  else atomicJson(file,next);
  return {
    schemaVersion:'executionkit-v4-agent-integration/v1',
    status,
    claimId:claim.claimId,
    taskId:claim.taskId,
    codeHead,
    integratedHead:finalHead,
    commits:applied,
    reconciliation,
    postIntegrationVerificationRequired:status!=='INTEGRATED',
    verification:claim.result?.verification??null
  };
}


export function reconcileV4AgentClaim(root,claimIdValue){
  root=path.resolve(root);
  const file=claimFile(root,claimIdValue);
  if(!fs.existsSync(file))throw new Error('Unknown v4 agent claim: '+claimIdValue);
  const claim=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!['RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED'].includes(claim.status))throw new Error('Claim does not require reconciliation: '+claim.status);
  const info=gitInfo(root);
  if(!info.isGit)throw new Error('orchestrator root is not Git');
  if(info.dirty)throw new Error('orchestrator worktree must be clean before claim reconciliation');
  const result=reconcileV4Lifecycle(root,{boundary:'task',base:claim.integrationBaseHead??claim.baseHead,taskId:claim.taskId,commitGeneratedDocs:true});
  const status=result.status==='PASS'?'INTEGRATED':result.status==='REVIEW_REQUIRED'?'RECONCILIATION_REVIEW_REQUIRED':'RECONCILIATION_FAILED';
  const next={...claim,status,reconciliation:result,reconciledAt:new Date().toISOString(),integratedHead:git(root,['rev-parse','HEAD'])};
  if(status==='INTEGRATED')archiveClaimRecord(root,next);
  else atomicJson(file,next);
  return {schemaVersion:'executionkit-v4-agent-reconciliation/v1',status,claimId:claim.claimId,taskId:claim.taskId,reconciliation:result,integratedHead:next.integratedHead};
}

export function cleanupV4AgentClaim(root,claimIdValue,{force=false}={}){
  root=path.resolve(root);
  const record=claimRecord(root,claimIdValue);
  if(!record)throw new Error('Unknown v4 agent claim: '+claimIdValue);
  const claim=record.claim;
  if(!force&&!['INTEGRATED','BLOCKED','CANCELLED','INTEGRATED_CLEANED'].includes(claim.status))throw new Error('Refusing cleanup for active claim: '+claim.status);
  const nextStatus=claim.status.startsWith('INTEGRATED')?'INTEGRATED_CLEANED':'CANCELLED';
  if(fs.existsSync(claim.worktree)){
    const r=run(root,['worktree','remove',claim.worktree,'--force'],root,60000);
    if(r.status!==0)throw new Error(String(r.stderr||r.stdout||'worktree remove failed').trim());
  }else{
    run(root,['worktree','prune'],root,15000);
  }
  if((['BLOCKED','CANCELLED','PREPARED'].includes(claim.status)||nextStatus==='CANCELLED'||nextStatus==='INTEGRATED_CLEANED')&&claim.branch?.startsWith('executionkit/v4/')){
    run(root,['branch','-D',claim.branch],root,15000);
  }
  const next={...claim,status:nextStatus,cleanedAt:new Date().toISOString()};
  atomicJson(historyClaimFile(root,claimIdValue,{create:true}),next);
  fs.rmSync(claimFile(root,claimIdValue),{force:true});
  return next;
}
