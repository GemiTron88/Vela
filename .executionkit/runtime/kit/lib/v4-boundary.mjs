import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { spawnBoundedSync } from './bounded-process.mjs';
import { fileURLToPath } from 'node:url';
import {runBoundedReconciliation as reconcileV4Lifecycle} from './reconcile-runner.mjs';
import { canonicalState, declaredAuditBoundary, declaredExecutionAction, loadConfig, loadTasks, unresolvedDependencies } from './execution-model.mjs';
import { writeStateCheckpoint } from './state-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { taskV4SystemFindings } from './v4-product-closure.mjs';
import { captureV4WorktreeIdentity } from './v4-gate-identity.mjs';
import { sealTaskEvidence } from './task-proof.mjs';
import { emitBoundaryExecutionSignalSync } from './execution-signals.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEFAULT_BOUNDARY_TIMEOUT_MS=Object.freeze({wave:30*60*1000,phase:45*60*1000});
const MAX_BOUNDARY_TIMEOUT_MS=60*60*1000;
function progress(boundary,stage,status,startedAt=null,extra={}){
  const mode=process.env.EXECUTIONKIT_CLI_PROGRESS_MODE;
  if(!mode||mode==='heartbeat')return;
  const event={schemaVersion:'executionkit-v4-boundary-progress/v1',boundary,stage,status,at:new Date().toISOString(),...extra};
  if(startedAt!==null)event.durationMs=Date.now()-startedAt;
  process.stderr.write(JSON.stringify(event)+'\n');
}
function boundaryBudget(root,boundary,explicitTimeoutMs=null){
  const {config}=loadConfig(root);
  const configured=Number(config.v4?.boundary?.[boundary+'TimeoutMs']??0);
  const requested=Number(explicitTimeoutMs??0);
  const fallback=DEFAULT_BOUNDARY_TIMEOUT_MS[boundary];
  const timeoutMs=requested>0?requested:configured>0?configured:fallback;
  if(!Number.isFinite(timeoutMs)||timeoutMs<60000)throw new Error('v4 '+boundary+' boundary timeout must be at least 60000ms');
  if(timeoutMs>MAX_BOUNDARY_TIMEOUT_MS)throw new Error('v4 '+boundary+' boundary timeout cannot exceed '+MAX_BOUNDARY_TIMEOUT_MS+'ms');
  return timeoutMs;
}
function remainingMs(deadlineAt){return deadlineAt-Date.now();}
function requireBoundaryBudget(deadlineAt,stage){
  const remaining=remainingMs(deadlineAt);
  if(remaining<=1000)throw Object.assign(new Error('V4_BOUNDARY_DEADLINE_EXCEEDED at '+stage),{code:'V4_BOUNDARY_DEADLINE_EXCEEDED',stage});
  return remaining;
}
function realAudit(root,boundary,deadlineAt){
  const remaining=requireBoundaryBudget(deadlineAt,'audit');
  const r=spawnBoundedSync(process.execPath,[path.join(kitRoot,'bin/audit-project.mjs'),root,'--boundary='+boundary],{cwd:root,encoding:'utf8',timeoutMs:remaining,maxBuffer:32*1024*1024,windowsHide:true});
  let parsed=null;try{parsed=JSON.parse(String(r.stdout??'').trim());}catch{}
  if(r.error)return {status:'FAIL',error:r.error.message,timeout:r.timedOut===true,exitCode:r.status??null,gatePath:null};
  if(!parsed)return {status:'FAIL',error:String(r.stderr||r.stdout||'Audit OS returned non-JSON output').trim().slice(0,4000),exitCode:r.status,gatePath:null};
  if(r.status!==0&&parsed.status!=='FAIL')return {...parsed,status:'FAIL',error:String(r.stderr||'Audit OS failed').trim().slice(0,4000),exitCode:r.status};
  return {...parsed,exitCode:r.status};
}
function git(root,args,allowFail=false){
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});
  if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());
  return {status:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'').trim(),error:r.error?.message??null};
}
function finalizeCanonicalBoundaryTask(root,boundary,{evidenceRefs=[]}={}){
  const {config}=loadConfig(root),loaded=loadTasks(root,config);
  if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const allowedStates=new Set(['READY','IN_PROGRESS','IMPLEMENTED','REVIEW_REQUIRED','CORRECTION_REQUIRED','BLOCKED']);
  const candidates=loaded.tasks.filter((task)=>!task.isArchive&&declaredExecutionAction(task)==='audit'&&declaredAuditBoundary(task)===boundary&&allowedStates.has(canonicalState(task,config))&&unresolvedDependencies(task,loaded.tasks,config).length===0);
  if(!candidates.length)return {status:'NOT_APPLICABLE',taskId:null,commit:null,path:null};
  candidates.sort((a,b)=>(a.order??0)-(b.order??0)||a.id.localeCompare(b.id));
  if(candidates.length>1)throw new Error('Multiple dependency-ready canonical '+boundary+' audit gates exist; close one deterministic phase/wave at a time: '+candidates.map((x)=>x.id).join(', '));
  const task=candidates[0],full=path.resolve(root,task.sourcePath),delta=path.relative(root,full);
  if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(full))throw new Error('Boundary gate task source is unsafe: '+task.sourcePath);
  const statusBefore=git(root,['status','--porcelain=v1','--untracked-files=all']).stdout.split(/\r?\n/).filter(Boolean);
  const porcelainPath=(line)=>{
    const raw=String(line??'').trim().replace(/^[A-Za-z?!]{1,2}\s+/,'');
    const target=raw.includes(' -> ')?raw.split(' -> ').at(-1):raw;
    return target.replace(/^"|"$/g,'').replace(/\\/g,'/');
  };
  const unrelated=statusBefore.map(porcelainPath).filter((rel)=>rel!==task.sourcePath);
  if(unrelated.length)throw new Error('Cannot atomically accept '+boundary+' gate with unrelated dirty worktree paths: '+unrelated.join(', '));
  if(!evidenceRefs.length)throw new Error('Cannot accept '+boundary+' gate without concrete reconciliation/audit evidence artifacts');
  const originalBefore=fs.readFileSync(full,'utf8');
  let sealed=null;
  try{
    const escaped=String(task.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const before=fs.readFileSync(full,'utf8'),re=new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
    const match=before.match(re);if(!match)throw new Error('Boundary task block not found: '+task.id);
    const block=match[1].replace(/^- Status:\s*.*$/m,'- Status: ACCEPTED');
    const after=before.replace(match[1],()=>block);
    fs.writeFileSync(full,after);
    sealed=sealTaskEvidence(root,{taskId:task.id,apply:true,sourceRefs:evidenceRefs,extra:{kind:'boundary',boundary}});
    git(root,['add','--',task.sourcePath,sealed.proofRoot]);
    git(root,['-c','user.name=ExecutionKit','-c','user.email=executionkit@local.invalid','commit','-m','executionkit: accept '+boundary+' gate '+task.id,'--',task.sourcePath,sealed.proofRoot]);
    return {status:'ACCEPTED',taskId:task.id,commit:git(root,['rev-parse','HEAD']).stdout,path:task.sourcePath,evidence:sealed.receiptPath};
  }catch(error){
    try{fs.writeFileSync(full,originalBefore);}catch{}
    try{if(sealed?.status==='SEALED'&&sealed.proofRoot)fs.rmSync(path.resolve(root,sealed.proofRoot),{recursive:true,force:true});}catch{}
    try{git(root,['reset','--',task.sourcePath,...(sealed?.proofRoot?[sealed.proofRoot]:[])],true);}catch{}
    throw error;
  }
}

function gateFile(root,boundary){return resolveDerivedPath(root,'.executionkit/gates/boundary-'+boundary+'.json','v4 '+boundary+' boundary gate',{createParents:true});}
function writeGate(root,boundary,payload){const file=gateFile(root,boundary);fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');return path.relative(root,file).split(path.sep).join('/');}

export function v4BoundaryStatus(root,{boundary='phase'}={}){
  root=path.resolve(root);
  if(!['wave','phase'].includes(boundary))throw new Error('v4 boundary status supports wave or phase');
  const file=gateFile(root,boundary);
  if(!fs.existsSync(file))return {status:'MISSING',current:false,gate:null,path:path.relative(root,file).split(path.sep).join('/')};
  let gate;try{gate=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){return {status:'INVALID',current:false,gate:null,error:error.message};}
  let identity=null;try{identity=captureV4WorktreeIdentity(root);}catch(error){return {status:'INVALID',current:false,gate,error:error.message};}
  const contractCurrent=gate.schemaVersion==='executionkit-v4-boundary/v1'&&gate.boundary===boundary;
  const current=Boolean(contractCurrent&&gate.head===identity.head&&gate.worktreeFingerprint===identity.worktreeFingerprint);
  return {status:gate.status??'UNKNOWN',current,head:identity.head,gateHead:gate.head??null,worktreeFingerprint:identity.worktreeFingerprint,gateFingerprint:gate.worktreeFingerprint??null,gate};
}

export function runV4Boundary(root,{boundary,base='HEAD~1',auditRunner=realAudit,timeoutMs=null}={}){
  root=path.resolve(root);
  if(!['wave','phase'].includes(boundary))throw new Error('v4 Boundary Orchestrator supports wave or phase');
  const totalTimeoutMs=boundaryBudget(root,boundary,timeoutMs),startedAt=Date.now(),deadlineAt=startedAt+totalTimeoutMs;
  progress(boundary,'boundary','STARTED',null,{timeoutMs:totalTimeoutMs,deadlineAt:new Date(deadlineAt).toISOString()});
  requireBoundaryBudget(deadlineAt,'reconciliation');
  const reconcileStarted=Date.now();progress(boundary,'reconciliation','STARTED');
  const reconciliation=reconcileV4Lifecycle(root,{boundary,base,commitGeneratedDocs:true,deadlineAt});
  progress(boundary,'reconciliation','COMPLETED',reconcileStarted,{result:reconciliation.status});
  let audit={status:'SKIPPED',reason:'reconciliation-not-pass',gatePath:null};
  if(reconciliation.status==='PASS'){
    requireBoundaryBudget(deadlineAt,'audit');
    const auditStarted=Date.now();progress(boundary,'audit','STARTED');
    audit=auditRunner(root,boundary,deadlineAt);
    progress(boundary,'audit','COMPLETED',auditStarted,{result:audit.status});
  }
  let auditGapTasking={schemaVersion:'executionkit-v4-system-gap-tasking/v1',status:'NOT_APPLICABLE',system:'audit',boundary,blockingFindings:[],createdTasks:[],reopenedTasks:[],trackedTasks:[],commit:{status:'NOT_APPLICABLE',commit:null}};
  if(reconciliation.status==='PASS'&&Array.isArray(audit.findings)){
    auditGapTasking=taskV4SystemFindings(root,{
      system:'audit',
      boundary,
      findings:audit.findings,
      gatePath:audit.gatePath??('.executionkit/gates/audit-'+boundary+'.json'),
      autoCommit:true
    });
  }
  const auditHasBlockingGaps=(auditGapTasking.blockingFindings?.length??0)>0;
  let status=reconciliation.status!=='PASS'?reconciliation.status:auditHasBlockingGaps?'FAIL':(audit.status==='PASS'?'PASS':audit.status==='REVIEW_REQUIRED'?'REVIEW_REQUIRED':'FAIL');
  let canonicalGate={status:'NOT_APPLICABLE',taskId:null,commit:null,path:null};
  if(status==='PASS'){
    try{canonicalGate=finalizeCanonicalBoundaryTask(root,boundary,{evidenceRefs:[reconciliation.gatePath,audit.gatePath].filter(Boolean)});}
    catch(error){status='FAIL';canonicalGate={status:'FAIL',taskId:null,commit:null,path:null,error:error.message};}
  }
  const checkpoint=remainingMs(deadlineAt)>1000
    ? writeStateCheckpoint(root,{
        reason:boundary+'-boundary',
        nextSafeAction:status==='PASS'?'executionkit next .':'Resolve '+boundary+' boundary findings and rerun executionkit boundary '+boundary+' .',
        evidenceRefs:[reconciliation.gatePath,audit.gatePath].filter(Boolean),
        contextHealth:status==='PASS'?'HEALTHY':'ATTENTION'
      })
    : {status:'SKIPPED_DEADLINE',snapshot:null};
  const id=captureV4WorktreeIdentity(root);
  if(canonicalGate.status==='ACCEPTED'){
    for(const rel of [reconciliation.gatePath,audit.gatePath,'.executionkit/gates/test-'+boundary+'.json','.executionkit/gates/agentic-'+boundary+'.json','.executionkit/gates/decision.json','.executionkit/gates/visual-os.json','.executionkit/gates/visual-production.json'].filter(Boolean)){
      try{
        const gFile=resolveDerivedPath(root,rel,'boundary gate refresh');
        if(fs.existsSync(gFile)){
          const gJson=JSON.parse(fs.readFileSync(gFile,'utf8'));
          gJson.head=id.head;
          gJson.worktreeFingerprint=id.worktreeFingerprint;
          gJson.finalizedBoundaryCommit=canonicalGate.commit;
          fs.writeFileSync(gFile,JSON.stringify(gJson,null,2)+'\n');
        }
      }catch{}
    }
    reconciliation.head=id.head;
    reconciliation.worktreeFingerprint=id.worktreeFingerprint;
    if(audit&&typeof audit==='object'){
      audit.head=id.head;
      audit.worktreeFingerprint=id.worktreeFingerprint;
    }
  }
  const gate={
    schemaVersion:'executionkit-v4-boundary/v1',boundary,status,...id,
    completedAt:new Date().toISOString(),
    reconciliation:{status:reconciliation.status,gatePath:reconciliation.gatePath,blockingSystems:reconciliation.blockingSystems??[],reviewSystems:reconciliation.reviewSystems??[]},
    audit:{status:audit.status,gatePath:audit.gatePath??null,exitCode:audit.exitCode??null},
    auditGapTasking,
    canonicalGate,
    state:{status:checkpoint.status,checkpointAt:checkpoint.snapshot?.capturedAt??null},
  };
  const gatePath=writeGate(root,boundary,gate);
  let signals={status:'DISABLED',ioPerformed:false};
  try{
    const {config:boundaryCfg}=loadConfig(root);
    const headSha=/^[a-f0-9]{40}$/i.test(String(id.head??''))?id.head:'0'.repeat(40);
    const signalType=status==='PASS'&&boundary==='phase'?'execution.phase.completed':status==='REVIEW_REQUIRED'?'execution.visual.review_required':status==='PASS'?'execution.task.completed':'execution.task.blocked';
    let projectCompleted=false;
    if(status==='PASS'&&boundary==='phase'){
      try{
        const postTasks=loadTasks(root,boundaryCfg);
        const activeTasks=postTasks.tasks.filter((t)=>!t.isArchive);
        const terminalAccepted=new Set(['ACCEPTED','RELEASED','CANCELLED']);
        projectCompleted=postTasks.errors.length===0&&activeTasks.length>0&&activeTasks.every((t)=>terminalAccepted.has(canonicalState(t,boundaryCfg)));
      }catch{
        projectCompleted=false;
      }
    }
    signals=emitBoundaryExecutionSignalSync(root,{
      config:boundaryCfg,
      type:signalType,
      ...(canonicalGate.taskId||boundary?{taskId:canonicalGate.taskId||boundary}:{}),
      phase:boundary,
      boundary,
      boundaryKey:'boundary:'+boundary+':'+headSha.slice(0,12),
      commitSha:headSha,
      evidenceRef:gatePath,
      receipt:{status:status==='PASS'?'PASS':'BLOCKED',commitSha:headSha},
      lifecycleStatus:status==='PASS'?(projectCompleted?'COMPLETED':'ACTIVE'):status==='REVIEW_REQUIRED'?'WAITING_REVIEW':'BLOCKED',
      projectCompleted,
      summary:boundary+' boundary '+status
    });
  }catch(error){
    signals={status:'SKIPPED',ioPerformed:false,error:error.message};
  }
  const durationMs=Date.now()-startedAt;progress(boundary,'boundary','COMPLETED',startedAt,{result:status});
  return {schemaVersion:'executionkit-v4-boundary-run/v1',status,boundary,timeoutMs:totalTimeoutMs,durationMs,gatePath,reconciliation,audit,auditGapTasking,canonicalGate,state:checkpoint,signals,collaboration:signals?.collaboration??{status:'DISABLED',authority:'UNTRUSTED_ADVISORY_ONLY',messages:[]}};
}
