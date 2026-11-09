import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assembleCanonicalTodoMarkdown, canonicalState, declaredAuditBoundary, declaredExecutionAction, extractDependencies, loadConfig, loadTasks, stateIsTerminal } from './execution-model.mjs';
import { discoverProduct, reconcileCoverage, writeDiscovery, writeReconciliation } from './discovery-model.mjs';
import { renderTodoShardManifest, todoShardPathSafe, todoShardSources } from './todo-shards.mjs';
import { resolveDerivedPath } from './derived-state.mjs';

function stable(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,12).toUpperCase();}
function safePhase(value,fallback='GAP'){const text=String(value??'').trim();return /^[A-Za-z0-9._-]+$/.test(text)?text:fallback;}
function esc(value){return String(value??'NONE').replace(/\r?\n/g,' ').trim()||'NONE';}
function git(root,args,allowFail=false){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true});if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());return {status:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'').trim()};}
function findingContract(config){return (config.installation?.runtimePath??'.executionkit/runtime/kit')+'/contracts/finding-contract.md';}
function gapIdentity(finding){if(finding.code==='DECLARED_NOT_IMPLEMENTED')return {code:finding.code,required:finding.required};return {code:finding.code,item:finding.item??null};}
function gapTitle(finding){const x=finding.required??finding.item??{};return 'Close product gap: '+[x.kind,x.name??x.path??x.id].filter(Boolean).join(' ');}
function gapOwnership(finding){const x=finding.required??finding.item??{};return x.path??x.code??('product-closure/'+(x.kind??'gap'));}
function gapRef(finding,config){const x=finding.required??finding.item??{};return (config.discovery?.scopePath??'executionkit.scope.json')+'#'+(x.id??x.name??x.path??stable(x));}
function taskBlock({id,title,phase,depends,finding,config,recurrenceOf=null}){
  const x=finding.required??finding.item??{},kind=x.kind??'unknown',ownership=gapOwnership(finding),link=x.link??x.url??'NONE',code=x.code??x.path??'DISCOVERY_REQUIRED';
  return [
    '<!-- TASK:'+id+' -->',
    '### '+id+' — '+title,
    '- Status: CORRECTION_REQUIRED',
    '- Phase: '+phase,
    '- Priority: P0',
    '- Depends: '+(depends.length?depends.join(', '):'NONE'),
    '- Parallel Safe: NO',
    '- Ownership: '+esc(ownership),
    '- Ref: '+esc(gapRef(finding,config)),
    '- Link: '+esc(link),
    '- Code: '+esc(code),
    '- Skills: skill.scope-reconciliation, skill.implementation',
    '- Rules: rule.todo-authority, rule.closure, rule.evidence',
    '- Contract: '+findingContract(config),
    '- Verification: executionkit product status .',
    '- Evidence: PENDING',
    '- Tags: product-closure, auto-gap, discovery, '+esc(kind),
    '- Gap Source: '+finding.code,
    ...(recurrenceOf?['- Recurrence Of: '+recurrenceOf]:[]),
    '',
    'Objective: close the discovered whole-product gap without narrowing scope to the currently executing task. Reconcile implementation, UX/API/data/integration seams as applicable, then prove the gap is absent from the next Product Closure scan.',
    '<!-- /TASK -->',
    ''
  ].join('\n');
}
function activationDependencies(config,phase){
  if(config.adoption?.bootstrapAuthority==='runtime-receipt')return [];
  const policy=config.adoption??{};
  if(policy.deepIntegrationRequired!==true)return [];
  const integrationPhase=String(policy.integrationPhase??'EK4').trim();
  if(String(phase??'').trim()===integrationPhase)return [];
  const activation=String(policy.integrationActivationTaskId??'EK4-ACTIVATE').trim();
  return activation?[activation]:[];
}
function choosePhase(config,tasks,{currentTaskId=null,finding=null}={}){
  const requiredPhase=safePhase(finding?.phase??finding?.required?.phase??'', '');if(requiredPhase)return requiredPhase;
  const current=currentTaskId?tasks.find((t)=>!t.isArchive&&t.id===currentTaskId):null;if(current?.meta?.Phase)return safePhase(current.meta.Phase,config.productClosure?.defaultGapPhase??'GAP');
  const first=tasks.find((t)=>!t.isArchive&&!stateIsTerminal(t,config));if(first?.meta?.Phase)return safePhase(first.meta.Phase,config.productClosure?.defaultGapPhase??'GAP');
  const latest=[...tasks].filter((t)=>!t.isArchive).sort((a,b)=>(a.order??0)-(b.order??0)).at(-1);if(latest?.meta?.Phase)return safePhase(latest.meta.Phase,config.productClosure?.defaultGapPhase??'GAP');
  return safePhase(config.productClosure?.defaultGapPhase??'GAP','GAP');
}
function taskIds(root,config){const loaded=loadTasks(root,config);if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));return {tasks:loaded.tasks,ids:new Set(loaded.tasks.map((t)=>t.id))};}
function recurrenceState(tasks,baseId){
  const matches=tasks.filter((task)=>task.id===baseId||task.id.startsWith(baseId+'-R')).map((task)=>{
    const m=task.id.match(/-R(\d+)$/);return {task,n:m?Number(m[1]):1};
  }).sort((a,b)=>b.n-a.n);
  return {latest:matches[0]?.task??null,next:Math.max(1,...matches.map((x)=>x.n))+1};
}
function shardForPhase(root,config,phase){
  const plan=todoShardSources(root,config);if(plan.errors.length)throw new Error(plan.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const existing=plan.active.filter((x)=>x.phase===phase);if(existing.length)return {plan,entry:existing.at(-1),created:false};
  const shardRoot=config.todoAuthority?.shardRoot??'todo';let rel=shardRoot+'/'+phase+'.md',n=1;
  while(fs.existsSync(todoShardPathSafe(root,rel))){rel=shardRoot+'/'+phase+'/'+String(n++).padStart(3,'0')+'.md';}
  return {plan,entry:{phase,path:rel,order:plan.active.length},created:true};
}
function writeAtomic(full,content){fs.mkdirSync(path.dirname(full),{recursive:true});const tmp=full+'.executionkit-'+process.pid+'-'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,content,{flag:'wx'});fs.renameSync(tmp,full);}
function insertBlock(root,config,phase,block){
  if(config.todoAuthority?.mode==='single-file'){
    const rel=config.todoPath??'TODO.md',full=todoShardPathSafe(root,rel);
    if(!full||!fs.existsSync(full))throw new Error('Canonical product TODO is unavailable');
    const before=fs.readFileSync(full,'utf8');
    try{
      writeAtomic(full,before.trimEnd()+'\n\n'+block);
      const loaded=loadTasks(root,config);
      if(loaded.errors.length)throw new Error('Product Closure task insertion invalidated canonical graph: '+loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
      return {path:rel,createdShard:false};
    }catch(error){fs.writeFileSync(full,before);throw error;}
  }
  const chosen=shardForPhase(root,config,phase),manifestFull=todoShardPathSafe(root,chosen.plan.manifestPath),shardFull=todoShardPathSafe(root,chosen.entry.path);
  if(!manifestFull||!shardFull)throw new Error('Product Closure target path escapes project');
  const beforeManifest=fs.readFileSync(manifestFull),beforeShard=fs.existsSync(shardFull)?fs.readFileSync(shardFull):null;
  try{
    const existing=beforeShard?beforeShard.toString('utf8'):('# Phase '+phase+' — active canonical tasks\n\n');
    const headerMatch=existing.match(/^(#.*?(?:\r?\n){2})/);const header=headerMatch?.[1]??('# Phase '+phase+' — active canonical tasks\n\n');const rest=headerMatch?existing.slice(header.length):existing;
    writeAtomic(shardFull,header+block+'\n'+rest.replace(/^\s+/,'').trimEnd()+'\n');
    if(chosen.created){const entries=[...chosen.plan.active,chosen.entry].map((x)=>({phase:x.phase,path:x.path}));writeAtomic(manifestFull,renderTodoShardManifest(entries));}
    const loaded=loadTasks(root,config);if(loaded.errors.length)throw new Error('Product Closure task insertion invalidated canonical graph: '+loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
    return {path:chosen.entry.path,createdShard:chosen.created};
  }catch(error){
    fs.writeFileSync(manifestFull,beforeManifest);if(beforeShard===null)fs.rmSync(shardFull,{force:true});else fs.writeFileSync(shardFull,beforeShard);throw error;
  }
}
function updateCanonicalTaskBlock(root,task,mutator){
  const full=todoShardPathSafe(root,task.sourcePath);
  if(!full||!fs.existsSync(full))throw new Error('Canonical task source is unavailable: '+task.id);
  const escaped=String(task.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const before=fs.readFileSync(full,'utf8'),re=new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  const match=before.match(re);if(!match)throw new Error('Canonical task block not found: '+task.id);
  const afterBlock=mutator(match[1]);
  if(afterBlock===match[1])return {changed:false,path:task.sourcePath};
  writeAtomic(full,before.replace(match[1],()=>afterBlock));
  return {changed:true,path:task.sourcePath};
}
function ensureActivationDependency(root,config,task){
  const phase=String(task?.meta?.Phase??'').trim(),required=activationDependencies(config,phase);
  if(!required.length)return [];
  const deps=extractDependencies(task),missing=required.filter((id)=>!deps.includes(id));
  if(!missing.length)return [];
  const next=[...deps,...missing];
  const result=updateCanonicalTaskBlock(root,task,(block)=>{
    let out=block.replace(/^- Depends:\s*.*$/m,'- Depends: '+next.join(', '));
    if(!/^- Depends:/m.test(out))out=out.replace(/^- Priority:.*$/m,(line)=>line+'\n- Depends: '+next.join(', '));
    return out;
  });
  return result.changed?[{id:task.id,path:result.path,kind:'activation-dependency',dependsAdded:missing}]:[];
}
function wireTaskIntoConvergenceGates(root,config,{taskId,phase}){
  const loaded=loadTasks(root,config);if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const releaseGateId=String(config.integration?.systemReleaseGateTaskId??'').trim();
  const gates=loaded.tasks.filter((task)=>{
    if(task.isArchive||task.id===taskId)return false;
    const phaseGate=String(task.meta?.Phase??'').trim()===phase&&declaredExecutionAction(task)==='audit'&&declaredAuditBoundary(task)==='phase';
    const releaseGate=releaseGateId&&task.id===releaseGateId&&declaredExecutionAction(task)==='audit'&&declaredAuditBoundary(task)==='release';
    return phaseGate||releaseGate;
  });
  const updated=[];
  for(const gate of gates){
    const deps=extractDependencies(gate);if(deps.includes(taskId))continue;
    const nextDeps=[...deps,taskId];
    const reopen=stateIsTerminal(gate,config);
    const result=updateCanonicalTaskBlock(root,gate,(block)=>{
      let out=block.replace(/^- Depends:\s*.*$/m,'- Depends: '+nextDeps.join(', '));
      if(!/^- Depends:/m.test(out))out=out.replace(/^- Priority:.*$/m,(line)=>line+'\n- Depends: '+nextDeps.join(', '));
      if(reopen){
        out=out.replace(/^- Status:\s*.*$/m,'- Status: CORRECTION_REQUIRED');
        out=out.replace(/^- Evidence:\s*.*$/m,'- Evidence: PENDING');
        if(!/^- Reopened By:/m.test(out))out=out.replace(/^- Evidence: PENDING$/m,(line)=>line+'\n- Reopened By: auto-gap convergence');
      }
      return out;
    });
    if(result.changed)updated.push({id:gate.id,path:result.path,reopened:reopen,boundary:declaredAuditBoundary(gate)});
  }
  return updated;
}

function maybeCommit(root,files,message,enabled){
  if(!enabled)return {status:'NOT_REQUESTED',commit:null};const inside=git(root,['rev-parse','--is-inside-work-tree'],true);if(inside.status!==0)return {status:'NOT_GIT',commit:null};
  const before=git(root,['status','--porcelain=v1','--untracked-files=all']);const allowed=new Set(files.map((x)=>x.replace(/\\/g,'/')));
  const porcelainPath=(line)=>{const raw=String(line??'').trim().replace(/^[A-Za-z?!]{1,2}\s+/,'');const target=raw.includes(' -> ')?raw.split(' -> ').at(-1):raw;return target.replace(/^"|"$/g,'').replace(/\\/g,'/');};
  const unrelated=before.stdout.split(/\r?\n/).filter(Boolean).map(porcelainPath).filter((rel)=>!allowed.has(rel));
  if(unrelated.length)return {status:'SKIPPED_DIRTY_WORKTREE',commit:null,unrelated};
  git(root,['add','--',...files]);const staged=git(root,['diff','--cached','--name-only']);if(!staged.stdout)return {status:'NO_CHANGE',commit:null};
  const result=git(root,['-c','user.name=ExecutionKit','-c','user.email=executionkit@local.invalid','commit','-m',message]);return {status:'COMMITTED',commit:git(root,['rev-parse','HEAD']).stdout,output:result.stdout};
}
function reopenGapTask(root,task,reopenedBy='Product Closure',{upgradeRevalidation=false}={}){
  const full=todoShardPathSafe(root,task.sourcePath);
  if(!full||!fs.existsSync(full))throw new Error('Cannot reopen Product Closure task outside canonical authority: '+task.id);
  const before=fs.readFileSync(full,'utf8');
  const escaped=String(task.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  const match=before.match(re);if(!match)throw new Error('Canonical Product Closure task block not found: '+task.id);
  let block=match[1];
  block=block.replace(/^- Status:\s*.*$/m,'- Status: CORRECTION_REQUIRED');
  block=block.replace(/^- Evidence:\s*.*$/m,'- Evidence: PENDING');
  if(!/^- Reopened By:/m.test(block))block=block.replace(/^- Gap Source:.*$/m,(line)=>line+'\n- Reopened By: '+reopenedBy);
  if(upgradeRevalidation&&!/^- Upgrade Revalidation:/m.test(block))block=block.replace(/^- Tags:\s*(.*)$/m,(line,tags)=>line+(tags.includes('upgrade-revalidation')?'':', upgrade-revalidation')+'\n- Upgrade Revalidation: true');
  const after=before.replace(match[1],()=>block);
  if(after!==before)writeAtomic(full,after);
  return {id:task.id,path:task.sourcePath};
}

const SYSTEM_GAP_SKILLS=Object.freeze({
  test:['skill.test-adequacy','skill.quality-evidence'],
  content:['skill.content-depth'],
  seo:['skill.seo-audit','skill.seo-gate'],
  docs:['skill.documentation-fabric','skill.repository-knowledge'],
  visual:['skill.premium-experience','skill.component-system','skill.design-system'],
  audit:['skill.audit-boundary','skill.review-acceptance'],
  launch:['skill.production-deployment','skill.release-health'],
  database:['skill.data-migration','skill.task-context'],
  route:['skill.task-context','skill.test-adequacy'],
  surface:['skill.component-system','skill.test-adequacy','skill.task-context'],
  'surface-perf':['skill.premium-experience','skill.test-adequacy'],
  'surface-ux':['skill.premium-experience','skill.component-system','skill.design-system'],
  'surface-flutter':['skill.flutter','skill.test-adequacy'],
  'surface-visuals':['skill.premium-experience','skill.design-system'],
  'surface-antifake':['skill.quality-evidence','skill.test-adequacy'],
  evidence:['skill.review-acceptance','skill.quality-evidence'],
  integration:['skill.scope-reconciliation','skill.test-adequacy'],
  execution:['skill.parallel-orchestration','skill.task-context'],
  agent:['skill.parallel-orchestration','skill.task-context'],
  state:['skill.state-rehydration','skill.task-context'],
  host:['skill.parallel-orchestration','skill.task-context'],
  platform:['skill.parallel-orchestration','skill.task-context'],
  'control-plane':['skill.release-health','skill.task-context'],
  installer:['skill.parallel-orchestration','skill.task-context'],
  'repository-intelligence':['skill.repository-knowledge','skill.task-context'],
});
function resolveFindingSkills(system,finding){
  const code=String(finding?.code??finding?.id??'');
  if(system==='surface'){
    if(code.startsWith('PERF_'))return SYSTEM_GAP_SKILLS['surface-perf'];
    if(code.startsWith('UX_'))return SYSTEM_GAP_SKILLS['surface-ux'];
    if(code.startsWith('FLUTTER_'))return SYSTEM_GAP_SKILLS['surface-flutter'];
    if(code.startsWith('VISUAL_PROD_')||code.startsWith('VISUALS_')||code.startsWith('VISUAL_PRODUCTION_')||code.startsWith('MEDIA_'))return SYSTEM_GAP_SKILLS['surface-visuals'];
    if(code.startsWith('ANTIFAKE_'))return SYSTEM_GAP_SKILLS['surface-antifake'];
  }
  return SYSTEM_GAP_SKILLS[system]??['skill.task-context','skill.implementation'];
}
function systemFindingIdentity(system,finding){
  return {
    system,
    code:finding?.code??finding?.id??'SYSTEM_FINDING',
    path:finding?.path??finding?.file??null,
    domain:finding?.domain??null,
    subjectId:finding?.subjectId??null,
    requirementId:finding?.requirementId??null,
    producer:finding?.producer??null,
    checkId:finding?.checkId??null,
    fallback:!(finding?.path||finding?.file||finding?.domain||finding?.subjectId||finding?.requirementId||finding?.producer||finding?.checkId)?String(finding?.message??'').slice(0,240):null,
  };
}
function systemGapTaskBlock({id,title,phase,depends=[],system,boundary,finding,config,recurrenceOf=null,gatePath=null}){
  const skills=resolveFindingSkills(system,finding);
  const severity=String(finding?.severity??'HIGH').toUpperCase();
  const ownership=finding?.path??finding?.file??finding?.domain??('system/'+system);
  const ref=(gatePath??('.executionkit/gates/reconcile-'+boundary+'.json'))+'#'+esc(finding?.code??finding?.id??id);
  const verification=boundary==='upgrade'?'executionkit upgrade-revalidation run .':system==='test'?'executionkit test '+boundary+' .':system==='audit'?'executionkit audit '+boundary+' .':'executionkit boundary '+boundary+' .';
  return [
    '<!-- TASK:'+id+' -->',
    '### '+id+' — '+title,
    '- Status: CORRECTION_REQUIRED',
    '- Phase: '+phase,
    '- Priority: '+(severity==='CRITICAL'?'P0':'P1'),
    '- Depends: '+(depends.length?depends.join(', '):'NONE'),
    '- Parallel Safe: NO',
    '- Ownership: '+esc(ownership),
    '- Ref: '+esc(ref),
    '- Link: NONE',
    '- Code: '+esc(finding?.code??finding?.id??'SYSTEM_FINDING'),
    '- Skills: '+skills.join(', '),
    '- Rules: rule.todo-authority, rule.closure, rule.evidence',
    '- Contract: '+findingContract(config),
    '- Verification: '+verification,
    '- Evidence: PENDING',
    '- Tags: auto-gap, system-finding, '+system+', '+boundary+(boundary==='upgrade'?', upgrade-revalidation':''),
    ...(boundary==='upgrade'?['- Upgrade Revalidation: true']:[]),
    '- Gap Source: '+system+':'+esc(finding?.code??finding?.id??'SYSTEM_FINDING'),
    '- Finding Severity: '+severity,
    '- Finding Boundary: '+boundary,
    ...(recurrenceOf?['- Recurrence Of: '+recurrenceOf]:[]),
    '',
    'Objective: '+esc(finding?.message??('Resolve the blocking '+system+' finding '+(finding?.code??finding?.id??id)))+'. Correct the underlying product implementation/configuration/evidence, not only the report, then rerun the owning boundary gate.',
    '<!-- /TASK -->',
    ''
  ].join('\n');
}

export function taskV4SystemFindings(root,{system,boundary='wave',findings=[],currentTaskId=null,gatePath=null,autoCommit=true}={}){
  root=path.resolve(root);
  const {config}=loadConfig(root),policy=config.productClosure??{};
  if(policy.enabled===false||policy.autoCreateSystemFindingTasks===false)return {schemaVersion:'executionkit-v4-system-gap-tasking/v1',status:'DISABLED',createdTasks:[],reopenedTasks:[],trackedTasks:[]};
  const normalizedSystem=String(system??'system').toLowerCase().replace(/[^a-z0-9-]+/g,'-');
  const threshold=String(policy.systemFindingSeverity??'HIGH').toUpperCase(),rank={INFO:1,REVIEW:2,MEDIUM:2,HIGH:3,CRITICAL:4,BLOCKER:4},min=rank[threshold]??3;
  const blocking=(Array.isArray(findings)?findings:[]).filter((item)=>(rank[String(item?.severity??'HIGH').toUpperCase()]??3)>=min||/^(?:ANTIFAKE_|UX_|FLUTTER_|VISUAL_PROD_|VISUALS_|VISUAL_PRODUCTION_|PERF_|MEDIA_)/.test(String(item?.code??'')));
  const loaded=taskIds(root,config),tasks=loaded.tasks,taskById=new Map(tasks.map((t)=>[t.id,t])),created=[],reopened=[],tracked=[],convergenceUpdates=[],files=new Set();
  for(const finding of blocking){
    const baseId='GAP-'+normalizedSystem.toUpperCase().replace(/-/g,'_')+'-'+stable(systemFindingIdentity(normalizedSystem,finding));
    const recurrence=recurrenceState(tasks,baseId);
    let existing=recurrence.latest,id=baseId,recurrenceOf=null;
    if(existing?.isArchive){id=baseId+'-R'+recurrence.next;recurrenceOf=baseId;existing=null;}
    if(existing){
      if(stateIsTerminal(existing,config)){
        const reopenedTask=reopenGapTask(root,existing,'System Gap Tasking: '+normalizedSystem,{upgradeRevalidation:boundary==='upgrade'});
        reopened.push({...reopenedTask,findingCode:finding?.code??null,system:normalizedSystem});files.add(existing.sourcePath);
      }else tracked.push({id:existing.id,path:existing.sourcePath,state:canonicalState(existing,config),findingCode:finding?.code??null,system:normalizedSystem});
      const activation=ensureActivationDependency(root,config,existing);convergenceUpdates.push(...activation);for(const item of activation)files.add(item.path);
      const wired=wireTaskIntoConvergenceGates(root,config,{taskId:existing.id,phase:String(existing.meta?.Phase??'').trim()});convergenceUpdates.push(...wired);for(const item of wired)files.add(item.path);
      continue;
    }
    const phase=choosePhase(config,tasks,{currentTaskId,finding}),depends=activationDependencies(config,phase),title='Resolve '+normalizedSystem+' gap: '+(finding?.code??finding?.id??'blocking finding');
    const block=systemGapTaskBlock({id,title,phase,depends,system:normalizedSystem,boundary,finding,config,recurrenceOf,gatePath});
    const inserted=insertBlock(root,config,phase,block);
    created.push({id,phase,path:inserted.path,title,findingCode:finding?.code??null,system:normalizedSystem,recurrenceOf});
    files.add(inserted.path);files.add(config.todoPath??'TODO.md');
    const refreshed=loadTasks(root,config).tasks.find((t)=>t.id===id);if(refreshed){tasks.push(refreshed);taskById.set(id,refreshed);}
    const wired=wireTaskIntoConvergenceGates(root,config,{taskId:id,phase});convergenceUpdates.push(...wired);for(const item of wired)files.add(item.path);
  }
  let commit={status:'NOT_APPLICABLE',commit:null};
  if(created.length||reopened.length||convergenceUpdates.length)commit=maybeCommit(root,[...files],'executionkit: task '+normalizedSystem+' boundary findings',autoCommit);
  const final=loadTasks(root,config);if(final.errors.length)throw new Error(final.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  return {schemaVersion:'executionkit-v4-system-gap-tasking/v1',status:(created.length||reopened.length||convergenceUpdates.length)?'GAPS_TASKED':tracked.length?'GAPS_TRACKED':blocking.length?'GAPS_EXIST':'PASS',system:normalizedSystem,boundary,blockingFindings:blocking,createdTasks:created,reopenedTasks:reopened,trackedTasks:tracked,convergenceUpdates,commit};
}


export function taskV4SystemFindingGroups(root,{boundary='wave',groups={},currentTaskId=null,gatePath=null,autoCommit=true}={}){
  root=path.resolve(root);
  const results={},files=new Set();let createdOrReopened=0,convergenceUpdated=0,tracked=0,blocking=0;
  for(const [system,findings] of Object.entries(groups??{})){
    const result=taskV4SystemFindings(root,{system,boundary,findings,currentTaskId,gatePath,autoCommit:false});
    results[system]=result;
    createdOrReopened+=result.createdTasks?.length??0;createdOrReopened+=result.reopenedTasks?.length??0;convergenceUpdated+=result.convergenceUpdates?.length??0;tracked+=result.trackedTasks?.length??0;blocking+=result.blockingFindings?.length??0;
    for(const item of [...(result.createdTasks??[]),...(result.reopenedTasks??[]),...(result.convergenceUpdates??[])])if(item.path)files.add(item.path);
  }
  const {config}=loadConfig(root);if(createdOrReopened||convergenceUpdated)files.add(config.todoPath??'TODO.md');
  const commit=(createdOrReopened||convergenceUpdated)?maybeCommit(root,[...files],'executionkit: task '+boundary+' system findings',autoCommit):{status:'NOT_APPLICABLE',commit:null};
  return {
    schemaVersion:'executionkit-v4-system-gap-groups/v1',
    status:(createdOrReopened||convergenceUpdated)?'GAPS_TASKED':tracked?'GAPS_TRACKED':blocking?'GAPS_EXIST':'PASS',
    boundary,results,createdOrReopened,convergenceUpdated,tracked,blockingFindings:blocking,commit
  };
}

function evidencePath(root){return resolveDerivedPath(root,'.executionkit/discovery/product-closure.json','v4 Product Closure evidence',{createParents:true});}

export function inspectV4ProductClosure(root,{currentTaskId=null,autoCreate=null,autoCommit=null,persist=true}={}){
  root=path.resolve(root);const {config}=loadConfig(root),policy=config.productClosure??{};
  if(policy.enabled===false)return {schemaVersion:'executionkit-v4-product-closure/v1',status:'DISABLED',blockingGaps:[],createdTasks:[]};
  const {tasks,ids}=taskIds(root,config),taskById=new Map(tasks.map((t)=>[t.id,t])),assembled=assembleCanonicalTodoMarkdown(root,config,{includeArchives:true});if(assembled.errors.length)throw new Error(assembled.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const inventory=discoverProduct(root),report=reconcileCoverage(root,inventory,{todoText:assembled.markdown,scopePath:config.discovery?.scopePath??'executionkit.scope.json'});
  if(persist!==false){writeDiscovery(root,inventory,config.discovery?.inventoryPath);writeReconciliation(root,report,config.discovery?.reconciliationPath);}
  const threshold=String(policy.blockingGapSeverity??'HIGH').toUpperCase(),rank={INFO:1,REVIEW:2,MEDIUM:2,HIGH:3,CRITICAL:4},min=rank[threshold]??3;
  const blocking=report.findings.filter((f)=>(rank[String(f.severity??'INFO').toUpperCase()]??1)>=min);
  const shouldCreate=autoCreate??policy.autoCreateGapTasks===true,created=[],reopened=[],tracked=[],convergenceUpdates=[];const files=new Set();
  for(const finding of blocking){
    const baseId='GAP-'+stable(gapIdentity(finding)),recurrence=recurrenceState(tasks,baseId);
    let existing=recurrence.latest,id=baseId,recurrenceOf=null;
    if(existing?.isArchive){
      if(!shouldCreate){tracked.push({id:existing.id,path:existing.sourcePath,state:canonicalState(existing,config),archived:true,findingCode:finding.code});continue;}
      id=baseId+'-R'+recurrence.next;recurrenceOf=baseId;existing=null;
    }
    if(existing){
      if(shouldCreate&&stateIsTerminal(existing,config)){
        const reopenedTask=reopenGapTask(root,existing);reopened.push({...reopenedTask,findingCode:finding.code});files.add(existing.sourcePath);
      }else tracked.push({id:existing.id,path:existing.sourcePath,state:canonicalState(existing,config),findingCode:finding.code});
      if(shouldCreate){const activation=ensureActivationDependency(root,config,existing);convergenceUpdates.push(...activation);for(const item of activation)files.add(item.path);const wired=wireTaskIntoConvergenceGates(root,config,{taskId:existing.id,phase:String(existing.meta?.Phase??'').trim()});convergenceUpdates.push(...wired);for(const item of wired)files.add(item.path);}
      continue;
    }
    if(!shouldCreate)continue;
    const phase=choosePhase(config,tasks,{currentTaskId,finding}),depends=activationDependencies(config,phase);const title=gapTitle(finding),block=taskBlock({id,title,phase,depends,finding,config,recurrenceOf});
    const inserted=insertBlock(root,config,phase,block);ids.add(id);created.push({id,phase,path:inserted.path,title,findingCode:finding.code,recurrenceOf});files.add(inserted.path);files.add(config.todoPath??'TODO.md');
    tasks.push(loadTasks(root,config).tasks.find((t)=>t.id===id));taskById.set(id,tasks.at(-1));
    const wired=wireTaskIntoConvergenceGates(root,config,{taskId:id,phase});convergenceUpdates.push(...wired);for(const item of wired)files.add(item.path);
  }
  let commit={status:'NOT_APPLICABLE',commit:null};if(created.length||reopened.length||convergenceUpdates.length)commit=maybeCommit(root,[...files],'executionkit: reconcile product closure gap tasks',autoCommit??policy.autoCommitGapTasks===true);
  const finalTasks=loadTasks(root,config);if(finalTasks.errors.length)throw new Error(finalTasks.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const status=!blocking.length?'PASS':(created.length||reopened.length||convergenceUpdates.length)?'GAPS_TASKED':tracked.length?'GAPS_TRACKED':'GAPS_EXIST';
  let repositoryHead=null;try{repositoryHead=git(root,['rev-parse','HEAD'],true).stdout||null;}catch{}
  const result={schemaVersion:'executionkit-v4-product-closure/v1',status,singleProduct:true,repositoryHead,inventoryCounts:inventory.counts,findings:report.findings,blockingGaps:blocking,createdTasks:created,reopenedTasks:reopened,trackedGapTasks:tracked,convergenceUpdates,commit,taskCount:finalTasks.tasks.filter((t)=>!t.isArchive).length,observedAt:new Date().toISOString()};
  const file=evidencePath(root);
  if(persist!==false)fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
  result.evidencePath=path.relative(root,file).split(path.sep).join('/');return result;
}
