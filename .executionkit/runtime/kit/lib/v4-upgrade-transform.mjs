import {V5_STANDARD_TARGET,V5_DECISION_DEFAULTS} from './v5-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { resolveV4IntegrationTaskIds, V4_STANDARD_TARGET } from './v4-config.mjs';
import { projectCliCommand } from './v4-cli-entry.mjs';

export const V4_RUNTIME_PATH='.executionkit/runtime/kit';
export { V4_STANDARD_TARGET };
export const BOOT_CONTRACT_START='<!-- EXECUTIONKIT_BOOT_CONTRACT -->';
export const BOOT_CONTRACT_END='<!-- /EXECUTIONKIT_BOOT_CONTRACT -->';
const START='<!-- EXECUTIONKIT_V4_BOOT_CONTRACT -->';
const END='<!-- /EXECUTIONKIT_V4_BOOT_CONTRACT -->';

export function findBootBlockBounds(text,errorLabel='existing v4 AGENTS boot block'){
  for(const [openTag,closeTag] of [[START,END],[BOOT_CONTRACT_START,BOOT_CONTRACT_END]]){
    const start=text.indexOf(openTag),end=text.indexOf(closeTag);
    if((start>=0)!==(end>=0))throw new Error('Malformed '+errorLabel);
    if(start>=0){
      if(end<start)throw new Error('Malformed '+errorLabel+' order');
      return {start,end,after:end+closeTag.length,openTag,closeTag};
    }
  }
  return null;
}

export function hasBootContractMarker(text=''){
  const raw=String(text??'');
  return raw.includes(START)||raw.includes(BOOT_CONTRACT_START);
}

function deepMerge(base,override){
  if(!base||typeof base!=='object'||Array.isArray(base))return override;
  if(!override||typeof override!=='object'||Array.isArray(override))return override===undefined?base:override;
  const out={...base};
  for(const [k,v] of Object.entries(override))out[k]=k in base?deepMerge(base[k],v):v;
  return out;
}

function validRunnerLabel(value){
  return /^project-[a-z0-9][a-z0-9._-]*$/i.test(String(value??'').trim())&&!String(value??'').includes('[');
}

export function buildV4ProjectConfig(template,existing={},runtimePath=V4_RUNTIME_PATH,baseTemplate={},options={}){

  const merged=deepMerge(deepMerge(baseTemplate,template),existing);
  merged.$schema='./'+runtimePath.replace(/^\.\//,'')+'/schemas/execution-config-v4.schema.json';
  merged.standardVersion=V4_STANDARD_TARGET;
  const alreadyV4=/^[45]\./.test(String(existing.standardVersion??''));
  merged.projectState=alreadyV4?(existing.projectState??'BOOTSTRAP'):'BOOTSTRAP';
  merged.profile=existing.profile??template.profile??'STANDARD';
  merged.v4=deepMerge(template.v4??{},existing.v4??{});
  merged.v4.cliFirst=true;
  merged.v4.mcp=false;
  merged.v4.host={...(merged.v4.host??{}),primary:'antigravity',entryAuthority:'AGENTS.md'};
  delete merged.v4.host.requireLiveHookObservation;
  const capabilityFloor=(name)=>existing.capabilities?.[name]==='FULL'?'FULL':'STANDARD';
  merged.capabilities={
    execution:capabilityFloor('execution'),
    agent:capabilityFloor('agent'),
    content:capabilityFloor('content'),
    seo:capabilityFloor('seo'),
    audit:capabilityFloor('audit'),
    test:capabilityFloor('test'),
    launch:capabilityFloor('launch'),
  };
  const integrationIds=resolveV4IntegrationTaskIds(existing.adoption??{});
  merged.adoption={
    ...(baseTemplate.adoption??{}),...(template.adoption??{}),...(existing.adoption??{}),
    deepIntegrationRequired:true,
    integrationPhase:'EK4',
    integrationGateTaskId:integrationIds.gateId,
    integrationActivationTaskId:integrationIds.activationId,
    productExecutionBlockedUntilGateAccepted:true,
    bootstrapAuthority:'runtime-receipt',
  };
  merged.integration={
    ...(baseTemplate.integration??{}),...(template.integration??{}),...(existing.integration??{}),
    requirePhaseConvergenceForClosure:true,
    requireSystemReleaseGate:false,
    releaseGateAuthority:'runtime-exact-candidate',
  };
    merged.documentation={...(template.documentation??{}),...(existing.documentation??{}),enabled:true,requiredForRelease:true};
  merged.repositoryIntelligence={...(baseTemplate.repositoryIntelligence??{}),...(template.repositoryIntelligence??{}),...(existing.repositoryIntelligence??{}),enabled:true,providers:{required:[],optional:[]},autoConsumption:{enabled:true,preferred:[],fallback:'native'}};
  merged.operator={...(baseTemplate.operator??{}),...(template.operator??{}),...(existing.operator??{}),entrypoint:'todo-first',fullCiCadence:'wave-or-phase-boundary',targetedTaskVerification:false,hostPersistenceAuthority:'none'};
  merged.controlPlane={
    ...(template.controlPlane??{}),
    ...(existing.controlPlane??{}),
    mode:'github-native',
    executionAgent:'disabled',
    repositoryAuthority:'github-origin',
    taskAuthority:'todo-shards',
    statusAuthority:'github-checks-workflows',
    fleetAuthority:'github-self-hosted-runners',
    dispatchAuthority:'github-workflow-dispatch',
    workflowDispatch:'repository-defined-manual',
    remoteCommand:'disabled',
    requiredForLocalExecution:false,
  };
  const requestedRunnerLabel=String(options.projectRunnerLabel??'').trim();
  const existingRunnerLabel=String(existing.ci?.projectRunnerLabel??'').trim();
  const projectRunnerLabel=validRunnerLabel(existingRunnerLabel)
    ? existingRunnerLabel
    : requestedRunnerLabel;
  if(!validRunnerLabel(projectRunnerLabel))throw new Error('ExecutionKit v4 requires a concrete project-specific self-hosted runner label (project-<ascii-slug>)');
  merged.ci={
    ...(baseTemplate.ci??{}),...(template.ci??{}),...(existing.ci??{}),
    provider:'github-actions',
    executionMode:'self-hosted-manual',
    githubHostedAllowed:false,
    automaticPushRuns:false,
    allowedAutomaticWorkflowPaths:[],
    projectRunnerLabel,
    maxProjectRunnersPerDevice:1,
    allowedRunnerOS:['linux','windows','macos'],
  };
  const legacyPerDeviceAgent=String(existing.fleet?.agentMode??'').toLowerCase()==='per-device'
    || String(existing.fleet?.telemetry?.transport??'').toLowerCase()==='local-agent';
  const requiredProducers=[...(existing.evidence?.requiredProducers??template.evidence?.requiredProducers??baseTemplate.evidence?.requiredProducers??[])]
    .filter((producer)=>{
      const value=String(producer??'').trim();
      if(!value)return false;
      if(/mcp/i.test(value))return false;
      if(legacyPerDeviceAgent&&(/executionkit[-_ ]?agent/i.test(value)||/agent[-_ ]?(?:layer|telemetry)/i.test(value)||/(?:layer|telemetry)[-_ ]?agent/i.test(value)))return false;
      return true;
    });
  merged.evidence={
    ...(baseTemplate.evidence??{}),...(template.evidence??{}),...(existing.evidence??{}),
    candidateRequiredForRelease:true,
    requireTestAdequacy:true,
    requireDurableTaskEvidence:true,
    taskProofRoot:'docs/execution/evidence/tasks',
    requiredProducers:[...new Set(requiredProducers)],
  };
  delete merged.fleet;
  merged.productClosure={
    ...(template.productClosure??{}),
    ...(existing.productClosure??{}),
    enabled:true,
    treatProjectAsSingleProduct:true,
    autoCreateGapTasks:true,
    blockingGapSeverity:'HIGH',
    autoCreateSystemFindingTasks:true,
    systemFindingSeverity:'HIGH',
    runBeforeSelection:true,
    runAfterIntegration:true,
    closureRequiredBeforeNoActionableWork:true,
    autoCommitGapTasks:true,
    defaultGapPhase:existing.productClosure?.defaultGapPhase??template.productClosure?.defaultGapPhase??'GAP',
  };
  merged.v4={...(merged.v4??{}),systems:{...(merged.v4?.systems??{})}};
  merged.v4.systems.audit={...(template.v4?.systems?.audit??{}),...(merged.v4.systems.audit??{}),enabled:true,level:merged.v4.systems.audit?.level??'STANDARD',trigger:'wave-phase-release'};
  merged.v4.systems.test={
    ...(template.v4?.systems?.test??{}),
    ...(merged.v4.systems.test??{}),
    enabled:true,
    level:merged.v4.systems.test?.level??'STANDARD',
    trigger:'wave-phase-release',
    runTaskVerification:false,
    runImpactedTests:false,
    requireExecutableTaskCheck:false,
    phaseFullSuite:true,
    waveFullSuite:true,
    commands:{
      task:[],
      wave:[...(merged.v4.systems.test?.commands?.wave??[])],
      phase:[...(merged.v4.systems.test?.commands?.phase??[])],
    },
  };
  merged.runtime={...(baseTemplate.runtime??{}),...(template.runtime??{}),...(existing.runtime??{}),mode:'DEPENDENCY_SAFE_PARALLEL',oneLifecycleActionAtATime:false,allowBoundedHostDelegation:true,parallel:{...(baseTemplate.runtime?.parallel??{}),...(template.runtime?.parallel??{}),...(existing.runtime?.parallel??{}),enabled:true,requireExplicitParallelSafe:true,requireOwnership:true,isolatedWorktrees:true,integrationOwner:'orchestrator',sequentialFallback:true},boost:{...(baseTemplate.runtime?.boost??{}),...(template.runtime?.boost??{}),...(existing.runtime?.boost??{}),enabled:true,command:'/boost',qualityGatesPreserved:true}};
  merged.todoAuthority={
    ...(baseTemplate.todoAuthority??{}),
    ...(template.todoAuthority??{}),
    ...(existing.todoAuthority??{}),
    mode:'sharded',
    shardRoot:existing.todoAuthority?.shardRoot??template.todoAuthority?.shardRoot??'todo',
    archiveRoot:existing.todoAuthority?.archiveRoot??template.todoAuthority?.archiveRoot??'todo/archive',
    maintenanceRequired:true,
  };
  merged.taskModel={
    ...(baseTemplate.taskModel??{}),
    ...(template.taskModel??{}),
    ...(existing.taskModel??{}),
    adapter:'canonical-blocks',
    projectionPath:'',
    projectionCommand:'',
  };
  if(existing.projectAdapter&&typeof existing.projectAdapter==='object'){
    merged.projectAdapter={...existing.projectAdapter};
    for(const [key,value] of Object.entries(merged.projectAdapter)){
      if(typeof value==='string')merged.projectAdapter[key]=value
        .replace(/\b(?:seven|eight)[- ]systems?\b/gi,'ten-system')
        .replace(/\b(?:7|8)[- ]systems?\b/gi,'10-system');
    }
    if(typeof merged.projectAdapter.name==='string'){
      merged.projectAdapter.name=merged.projectAdapter.name.replace(/v3/gi,'v4');
      if(!/v4/i.test(merged.projectAdapter.name))merged.projectAdapter.name+=' v4';
    }
  }
  merged.taskArchivePaths=Array.isArray(existing.taskArchivePaths)?existing.taskArchivePaths:[];
  if(existing.quality)merged.quality={...existing.quality};else delete merged.quality;
  if(template.updatePolicy||existing.updatePolicy){
    merged.updatePolicy={...(template.updatePolicy??{}),...(existing.updatePolicy??{})};
  }
  merged.installation={...(existing.installation??{}),runtimePath,runtimePolicy:'IMMUTABLE'};
  return merged;
}


const IGNORE_START='# EXECUTIONKIT_V4_PROVIDER_DERIVED:START';
const IGNORE_END='# EXECUTIONKIT_V4_PROVIDER_DERIVED:END';
const IGNORE_BLOCK=[IGNORE_START,'.codegraph/','.terrain/','.litho-agent/',IGNORE_END].join('\n');

export function reconcileRootGitignoreV4(existing=''){
  let text=String(existing??'');
  // v3-era exact root ignores make the intentionally tracked v4 runtime/receipt
  // impossible to re-include from .executionkit/.gitignore. Remove only these
  // known standalone legacy lines; broader/custom patterns remain for doctor
  // to flag rather than being rewritten silently.
  text=text.split(/\r?\n/).filter((line)=>{
    const trimmed=line.trim();
    return trimmed!=='.executionkit/'&&trimmed!=='/.executionkit/';
  }).join('\n');
  const start=text.indexOf(IGNORE_START),end=text.indexOf(IGNORE_END);
  if((start>=0)!==(end>=0)||end>=0&&end<start)throw new Error('Malformed ExecutionKit v4 provider-derived .gitignore block');
  if(start>=0){
    const after=end+IGNORE_END.length;
    return text.slice(0,start)+IGNORE_BLOCK+text.slice(after);
  }
  const prefix=text.trimEnd();
  return (prefix?prefix+'\n\n':'')+IGNORE_BLOCK+'\n';
}

function bootBlock(runtimePath,{portable=false,v5=false}={}){
  return [
    BOOT_CONTRACT_START,
    '## ExecutionKit runtime boot contract',
    ...(v5?['','Eleven systems include mandatory local Decision OS. Compiled DENY blocks; ALLOW grants no authority. No models, daemon or task-entry network. KB refresh is bounded to wave/phase/release boundaries.']:[]),
    '',
    'At session start or a canonical task transition run:',
    '',
    '~~~bash',
    projectCliCommand()+' start . --host antigravity',
    '~~~',
    '',
    'Reuse the compact JSON envelope after edits. Use --deep only for nextCommand, boundaries or debugging. Replace executionkit in returned commands with the entry above; never use a long Node/runtime path. Run reconcile task . before integration; applicable guards are mandatory.',
    '',
    'Context economy is mandatory: do not preload README, PLAYBOOK, STANDARD*, full TODO/shards, Agent manifest or generated knowledge. Read runtime.task.sourcePath:startLine and load routed resources lazily. Prefer targeted DB/route/knowledge lookups. Heavy work belongs at wave/phase/release boundaries. Parallel workers must use their claim file/taskRef; no MCP or editor restart.',
    ...(v5?['','Execution Signals (TronNotif), Task Push & Safe-Boundary Collaboration: derive verified host identity (`vps01`, `vps02`, `win`, `mac`) strictly from enrolled runtime/host configuration (`EXECUTIONKIT_VERIFIED_HOST_ID`, `config.executionSignals.hostId`), never fabricated. After completing each task, commit and push to `main` (`git commit` & `git push origin main`); once all tasks are 100% done, deploy to production (`executionkit launch release .` & `executionkit launch deploy . --authorize`) if requested by the owner. Notify the **TronNotif** notification center (`https://notif.gemitron.net` via `GemiXC` `https://exec.gemitron.net`) by emitting lifecycle states (`STARTING`, `ACTIVE`, `WAITING_REVIEW`, `WAITING_EXTERNAL`, `BLOCKED`, `FAILED`, `COMPLETED`, `DISCONNECTED`, `UNKNOWN`) and receipt-verified completion signals (`execution.task.completed`, `execution.phase.completed`, `execution.release.verified`, `execution.deploy.completed`, `execution.rollback.completed`) only at real boundaries; never report project `COMPLETED` from a single task, and keep routine heartbeats silent (`notify_owner: false`). For every completion response, first write a clear, simple explanation in normal markdown (not inside a codeblock), followed by a separate structured summary report inside a copyable fenced codeblock (use 4+ backticks ````markdown ... ```` if nested). Optional 7-day ephemeral collaboration is `UNTRUSTED_ADVISORY_ONLY`, checked only at safe boundaries (never via polling loops), and is a local no-op when disabled/offline (`GemiIsland` is not a dependency).']:[]),
    BOOT_CONTRACT_END
  ].join('\n');
}
export function reconcileAgentsBootV4(existing='',runtimePath=V4_RUNTIME_PATH,options={}){
  const block=bootBlock(runtimePath,options);
  const bounds=findBootBlockBounds(existing,'existing v4 AGENTS boot block');
  if(bounds){
    return existing.slice(0,bounds.start)+block+existing.slice(bounds.after);
  }
  return block+'\n\n'+existing;
}

function agentsManagedComparable(content=''){
  const text=String(content??'').replaceAll('\r\n','\n');
  const bounds=findBootBlockBounds(text,'v4 AGENTS managed template');
  if(!bounds)return text;
  return text.slice(0,bounds.start)+START+'\n<EXECUTIONKIT_MANAGED_BOOT>\n'+END+text.slice(bounds.after);
}

export function reconcileManagedAgentsDocumentV4(existing='',previousManagedTemplate='',nextManagedTemplate='',runtimePath=V4_RUNTIME_PATH,options={}){
  const current=String(existing??'').replaceAll('\r\n','\n');
  const nextTemplate=String(nextManagedTemplate??'').replaceAll('\r\n','\n');
  if(!current)return reconcileAgentsBootV4(nextTemplate,runtimePath,options);
  if(!nextTemplate)return reconcileAgentsBootV4(current,runtimePath,options);

  const previous=String(previousManagedTemplate??'').replaceAll('\r\n','\n');
  if(previous){
    const priorView=agentsManagedComparable(previous).trimEnd();
    const currentView=agentsManagedComparable(current);
    if(currentView.trimEnd()===priorView){
      return reconcileAgentsBootV4(nextTemplate,runtimePath,options).trimEnd()+'\n';
    }
    if(currentView.startsWith(priorView+'\n')){
      const nativeSuffix=currentView.slice(priorView.length).replace(/^\n+/, '\n\n');
      return reconcileAgentsBootV4(nextTemplate,runtimePath,options).trimEnd()+nativeSuffix.replace(/<EXECUTIONKIT_MANAGED_BOOT>/g,'') ;
    }
  }

  // Native/customized AGENTS files remain authoritative outside the managed
  // boot block. Never erase project-specific instructions merely to save tokens.
  return reconcileAgentsBootV4(current,runtimePath,options);
}

export function reconcileHooksV4(existingHooks={},runtimePath=V4_RUNTIME_PATH){
  const hooks=structuredClone(existingHooks??{});
  const legacy=hooks['executionkit-context'];
  if(legacy){
    const text=JSON.stringify(legacy);
    if(!/antigravity-hook\.mjs/.test(text))throw new Error('Cannot remove unknown executionkit-context hook during v4 upgrade');
    delete hooks['executionkit-context'];
  }
  const v4Hook=hooks['executionkit-v4-kernel'];
  if(v4Hook){
    const text=JSON.stringify(v4Hook);
    if(!/antigravity-v4-hook\.mjs/.test(text))throw new Error('Cannot remove unknown executionkit-v4-kernel hook during v4 upgrade');
    delete hooks['executionkit-v4-kernel'];
  }
  return hooks;
}

import { RETIRED_SKILL_REDIRECTS, RETIRED_MANAGED_WORKFLOW_IDS } from './agent-model.mjs';

function safeLegacyAdapterPath(rel){
  const norm=String(rel??'').replaceAll('\\','/');
  return /^\.agents\/agents\/ek-[^/]+\.md$/.test(norm)||
    /^\.agents\/skills\/ek-[^/]+\/SKILL\.md$/.test(norm)||
    norm==='.agents/rules/executionkit-entry.md';
}
function isRetiredManagedWorkflow(item){
  const norm=String(item?.path??'').replaceAll('\\','/');
  return RETIRED_MANAGED_WORKFLOW_IDS.has(item?.id)||
    /^\.agents\/workflows\/(?:audit-boundary|execute-parallel-batch|execute-task|rehydrate-state|release-readiness|resolve-blocker|review-candidate|seo-audit)\.md$/.test(norm);
}
function isRetiredConsolidatedSkill(item){
  return Boolean(item?.id&&Object.hasOwn(RETIRED_SKILL_REDIRECTS,item.id));
}
function v4ForbiddenMcpResource(item){
  return item?.id==='skill.dart-mcp' || item?.path==='.agents/skills/dart-mcp/SKILL.md'
    || item?.id==='skill.laravel-boost' || item?.path==='.agents/skills/laravel-boost/SKILL.md';
}
function legacyManagedExecutionKitResourcePath(value){
  return /^\.executionkit\/runtime\/(?:AI-ExecutionKit|kit)\/templates\/\.agents\//.test(String(value??''));
}
function stripResourceId(list,id){return Array.isArray(list)?list.filter((value)=>value!==id):list;}
function remapSkillIds(list){
  if(!Array.isArray(list))return list;
  return [...new Set(list.map((id)=>RETIRED_SKILL_REDIRECTS[id]??id))];
}
function stripV4McpReferences(manifest){
  const next=manifest;
  for(const skill of next.resources?.skills??[]){
    if(Array.isArray(skill.requires)){
      skill.requires=remapSkillIds(skill.requires).filter((dep)=>dep!==skill.id);
    }
    if(Array.isArray(skill.conflictsWith)){
      skill.conflictsWith=remapSkillIds(skill.conflictsWith).filter((dep)=>dep!==skill.id);
    }
  }
  const scrubUse=(use)=>{
    if(!use||typeof use!=='object')return;
    use.skills=stripResourceId(use.skills,'skill.dart-mcp');
    use.skills=stripResourceId(use.skills,'skill.laravel-boost');
    use.skills=remapSkillIds(use.skills);
    if(Array.isArray(use.workflows)){
      use.workflows=use.workflows.filter((id)=>!RETIRED_MANAGED_WORKFLOW_IDS.has(id));
    }
  };
  for(const route of next.routing?.routes??[])scrubUse(route.use);
  for(const supplement of next.routing?.supplements??[])scrubUse(supplement.use);
  scrubUse(next.routing?.fallback);
  return next;
}

export function isLegacyExecutionKitEntryRule(content){
  const text=String(content??'').replaceAll('\r\n','\n');
  return text.includes('# ExecutionKit entry rule') &&
    (text.includes('ExecutionKit MCP/plugin') ||
     text.includes('eight current systems') ||
     text.includes('ExecutionKit 3.x resolves one lifecycle action') ||
     text.includes('HOST_VERIFIED') ||
     text.includes('host MCP acceptance') ||
     text.includes('restart/reopen'));
}

export function isLegacyExecutionKitHostAdapter(content){
  const text=String(content??'').replaceAll('\r\n','\n');
  return (text.includes('Loads canonical ExecutionKit') || text.includes('Loads canonical role') || text.includes('Loads canonical skill')) &&
    text.includes('This entrypoint adapts host discovery only') &&
    text.includes('Handle one current lifecycle action; do not create parallel sessions.');
}

export function discoverLegacyAgentAdapters(root){
  const deletes=[];
  const agentsDir=path.join(root,'.agents');
  if(!fs.existsSync(agentsDir))return deletes;

  const entryRule=path.join(agentsDir,'rules','executionkit-entry.md');
  if(fs.existsSync(entryRule)){
    try{
      if(isLegacyExecutionKitEntryRule(fs.readFileSync(entryRule,'utf8'))){
        deletes.push('.agents/rules/executionkit-entry.md');
      }
    }catch{}
  }

  const agentsSubDir=path.join(agentsDir,'agents');
  if(fs.existsSync(agentsSubDir)){
    try{
      for(const entry of fs.readdirSync(agentsSubDir,{withFileTypes:true})){
        if(entry.isFile()&&/^ek-[^/]+\.md$/.test(entry.name)){
          const full=path.join(agentsSubDir,entry.name);
          if(isLegacyExecutionKitHostAdapter(fs.readFileSync(full,'utf8'))){
            deletes.push(`.agents/agents/${entry.name}`);
          }
        }
      }
    }catch{}
  }

  const skillsSubDir=path.join(agentsDir,'skills');
  if(fs.existsSync(skillsSubDir)){
    try{
      for(const entry of fs.readdirSync(skillsSubDir,{withFileTypes:true})){
        if(entry.isDirectory()&&entry.name.startsWith('ek-')){
          const skillFile=path.join(skillsSubDir,entry.name,'SKILL.md');
          if(fs.existsSync(skillFile)){
            if(isLegacyExecutionKitHostAdapter(fs.readFileSync(skillFile,'utf8'))){
              const skillDir=path.join(skillsSubDir,entry.name);
              for(const sub of fs.readdirSync(skillDir,{withFileTypes:true})){
                if(sub.isFile()){
                  deletes.push(`.agents/skills/${entry.name}/${sub.name}`);
                }
              }
            }
          }
        }
      }
    }catch{}
  }

  return [...new Set(deletes)].sort();
}

export function normalizeRouteEntry(item,index=0,existingList=[]){
  if(!item||typeof item!=='object')return null;
  const out=structuredClone(item);
  if(typeof out.priority!=='number'||!Number.isInteger(out.priority)){
    if(out.id==='supplement.phase-ek4'){
      const ek00=existingList.find((x)=>x?.id==='supplement.phase-ek00');
      out.priority=(typeof ek00?.priority==='number'&&Number.isInteger(ek00.priority))?ek00.priority:91;
    }else{
      const prev=existingList[index-1];
      if(typeof prev?.priority==='number'&&Number.isInteger(prev.priority)){
        out.priority=prev.priority+1;
      }else{
        out.priority=100+index;
      }
    }
  }
  if(!out.when||typeof out.when!=='object'||Array.isArray(out.when)){
    out.when={};
  }
  if(!out.use||typeof out.use!=='object'||Array.isArray(out.use)){
    out.use={};
  }
  return out;
}

function finalizeV4Manifest(manifest){
  const next=stripV4McpReferences(manifest);
  next.schemaVersion='2.2.0';
  next.standardVersion=V4_STANDARD_TARGET;
  if(typeof next.$schema==='string'&&next.$schema.includes('.executionkit/runtime/')){
    next.$schema='../schemas/agent-manifest.schema.json';
  }
  next.taskAuthority={
    ...(next.taskAuthority??{}),
    path:next.taskAuthority?.path??'TODO.md',
    mutableStateOwner:'declared-shards',
    shadowBacklogsForbidden:true,
    mode:'sharded',
    shardRoot:'todo',
    archiveRoot:'todo/archive',
  };
  next.delegation={
    ...(next.delegation??{}),
    mode:'DEPENDENCY_SAFE_PARALLEL',
    oneLifecycleActionAtATime:false,
    allowBoundedHostDelegation:true,
    isolatedWorktrees:true,
    integrationOwner:'role.orchestrator',
    sequentialFallback:true,
  };
  if(next.routing){
    if(Array.isArray(next.routing.routes)){
      next.routing.routes=next.routing.routes.map((r,i,list)=>normalizeRouteEntry(r,i,list)).filter(Boolean);
    }
    if(Array.isArray(next.routing.supplements)){
      next.routing.supplements=next.routing.supplements.map((s,i,list)=>normalizeRouteEntry(s,i,list)).filter(Boolean);
    }
  }
  return next;
}


export function bindV4TaskAuthority(manifest,config){
  const next=structuredClone(manifest);
  const sharded=config.todoAuthority?.mode==='sharded';
  next.taskAuthority={
    ...(next.taskAuthority??{}),
    path:config.todoPath??'TODO.md',
    mutableStateOwner:sharded?'declared-shards':(config.todoPath??'TODO.md'),
    shadowBacklogsForbidden:true,
    mode:sharded?'sharded':'single-file',
    shardRoot:config.todoAuthority?.shardRoot??'todo',
    archiveRoot:config.todoAuthority?.archiveRoot??'todo/archive',
  };
  return next;
}

export function reconcileAgentManifestV4(manifest){
  const next=structuredClone(manifest);
  const deletePaths=new Set();
  if(!next?.resources||typeof next.resources!=='object')throw new Error('Agent manifest resources are required for v4 migration');
  for(const [kind,items] of Object.entries(next.resources)){
    if(!Array.isArray(items))continue;
    next.resources[kind]=items.filter((item)=>{
      if(v4ForbiddenMcpResource(item)){
        if(item.path)deletePaths.add(item.path);
        return false;
      }
      if(kind==='workflows'&&isRetiredManagedWorkflow(item)){
        if(item.path)deletePaths.add(String(item.path).replaceAll('\\','/'));
        return false;
      }
      if(kind==='skills'&&isRetiredConsolidatedSkill(item)){
        if(item.path)deletePaths.add(String(item.path).replaceAll('\\','/'));
        return false;
      }
      const normPath=item?.path?String(item.path).replaceAll('\\','/'):'';
      if(item?.adapterHost==='antigravity'||String(item?.id??'').startsWith('adapter.antigravity.')||safeLegacyAdapterPath(normPath)||item?.id==='rule.antigravity-entry'){
        if(normPath){
          if(!safeLegacyAdapterPath(normPath))throw new Error('Refusing to delete nonstandard Antigravity adapter path: '+item.path);
          deletePaths.add(normPath);
        }
        return false;
      }
      if(legacyManagedExecutionKitResourcePath(item.path)){
        item.path=item.path.replace(/^\.executionkit\/runtime\/(?:AI-ExecutionKit|kit)\/templates\//, '');
      }
      return true;
    });
  }
  return {manifest:finalizeV4Manifest(next),deletePaths:[...deletePaths].sort()};
}

export function prepareAgentManifestV4(manifest){
  return reconcileAgentManifestV4(manifest);
}


function pruneAgentManifestPaths(manifest,removePaths=[]){
  const remove=new Set((removePaths??[]).map((value)=>String(value??'')));
  if(!remove.size)return manifest;
  const removedIds=new Set();
  for(const [kind,items] of Object.entries(manifest.resources??{})){
    if(!Array.isArray(items))continue;
    manifest.resources[kind]=items.filter((item)=>{
      if(remove.has(String(item?.path??''))){
        if(item?.id)removedIds.add(item.id);
        return false;
      }
      return true;
    });
  }
  const remainingIds=new Set(Object.values(manifest.resources??{}).flatMap((items)=>Array.isArray(items)?items.map((item)=>item?.id).filter(Boolean):[]));
  const retiredIds=[...removedIds].filter((id)=>!remainingIds.has(id));
  if(!retiredIds.length)return manifest;
  const retired=new Set(retiredIds);
  const scrubUse=(use)=>{
    if(!use||typeof use!=='object')return;
    for(const key of ['roles','skills','rules','workflows','contracts','templates']){
      if(Array.isArray(use[key]))use[key]=use[key].filter((id)=>!retired.has(id));
    }
  };
  for(const route of manifest.routing?.routes??[])scrubUse(route.use);
  for(const supplement of manifest.routing?.supplements??[])scrubUse(supplement.use);
  scrubUse(manifest.routing?.fallback);
  return manifest;
}

export function mergeAgentManifestV4(existing,template,{removePaths=[],previousTemplate=null}={}){
  const migrated=reconcileAgentManifestV4(existing);
  const next=migrated.manifest;
  for(const [kind,templateItems] of Object.entries(template?.resources??{})){
    if(!Array.isArray(templateItems))continue;
    if(!Array.isArray(next.resources[kind]))next.resources[kind]=[];
    for(const resource of templateItems){
      if(resource?.adapterHost==='antigravity'||v4ForbiddenMcpResource(resource))continue;
      const byId=next.resources[kind].find((item)=>item.id===resource.id);
      if(byId){
        if(byId.path!==resource.path){
          if(legacyManagedExecutionKitResourcePath(byId.path)&&String(resource.path??'').startsWith('.agents/')){
            const index=next.resources[kind].indexOf(byId);
            next.resources[kind][index]=structuredClone(resource);
            continue;
          }
          throw new Error('Agent resource id collision during v4 migration: '+resource.id);
        }
        continue;
      }
      const byPath=next.resources[kind].find((item)=>item.path===resource.path);
      if(byPath&&byPath.id!==resource.id)throw new Error('Agent resource path collision during v4 migration: '+resource.path);
      next.resources[kind].push(structuredClone(resource));
    }
  }
  if(template?.routing){
    const current=next.routing??{};
    const target=structuredClone(template.routing);
    const mergeById=(existingItems=[],templateItems=[],label='routing')=>{
      const out=structuredClone(existingItems);
      const mergeLists=(existingValues=[],templateValues=[])=>[...new Set([...(existingValues??[]),...(templateValues??[])])];
      const mergeMap=(existingMap={},templateMap={})=>{
        const merged={...structuredClone(templateMap??{}),...structuredClone(existingMap??{})};
        for(const key of new Set([...Object.keys(templateMap??{}),...Object.keys(existingMap??{})])){
          if(Array.isArray(existingMap?.[key])||Array.isArray(templateMap?.[key]))merged[key]=mergeLists(existingMap?.[key],templateMap?.[key]);
        }
        return merged;
      };
      for(const item of templateItems){
        const found=out.find((x)=>x.id===item.id);
        if(found){
          const index=out.indexOf(found);
          out[index]={
            ...structuredClone(item),
            ...structuredClone(found),
            when:mergeMap(found.when,item.when),
            use:mergeMap(found.use,item.use),
          };
          continue;
        }
        out.push(structuredClone(item));
      }
      return out;
    };
    const union=(a=[],b=[])=>[...new Set([...(a??[]),...(b??[])])];
    const fallback={...(target.fallback??{}),...(current.fallback??{})};
    for(const key of ['roles','skills','rules','workflows','contracts','templates']){
      if(current.fallback?.[key]!==undefined||target.fallback?.[key]!==undefined){
        fallback[key]=union(current.fallback?.[key],target.fallback?.[key]);
      }
    }
    next.routing={
      ...target,
      ...current,
      strategy:current.strategy??target.strategy,
      routes:mergeById(current.routes,target.routes,'route'),
      supplements:mergeById((current.supplements??[]).filter((item)=>{
        // Retire only unmodified Kit-owned supplements removed by the new template.
        // Project-customized routes are never silently discarded.
        if(target.supplements?.some((candidate)=>candidate.id===item.id))return true;
        const previous=previousTemplate?.routing?.supplements?.find((candidate)=>candidate.id===item.id);
        return !previous||JSON.stringify(item)!==JSON.stringify(previous);
      }),target.supplements,'supplement'),
      fallback,
    };
  }
  if(template?.resolution){
    next.resolution={...structuredClone(template.resolution),...(next.resolution??{})};
  }
  if(template?.delegation){
    next.delegation={
      ...structuredClone(template.delegation),
      ...(next.delegation??{}),
      mode:'DEPENDENCY_SAFE_PARALLEL',
      oneLifecycleActionAtATime:false,
      allowBoundedHostDelegation:true,
      isolatedWorktrees:true,
      integrationOwner:'role.orchestrator',
      sequentialFallback:true,
    };
  }
  pruneAgentManifestPaths(next,removePaths);
  return {manifest:finalizeV4Manifest(next),deletePaths:[...new Set([...migrated.deletePaths,'.agents/skills/dart-mcp/SKILL.md'])].sort()};
}

export function legacyPluginDisablePlan(root){
  const deletes=[];
  const pluginRoot=path.join(root,'.agents/plugins/executionkit');
  const manifest=path.join(pluginRoot,'plugin.json');
  if(fs.existsSync(manifest)){
    const parsed=JSON.parse(fs.readFileSync(manifest,'utf8'));
    if(parsed.name!=='executionkit')throw new Error('Refusing to disable unknown Antigravity plugin');
    deletes.push('.agents/plugins/executionkit/plugin.json');
  }
  const mcp=path.join(pluginRoot,'mcp_config.json');
  if(fs.existsSync(mcp)){
    const parsed=JSON.parse(fs.readFileSync(mcp,'utf8'));
    const keys=Object.keys(parsed.mcpServers??{});
    if(keys.some((k)=>!['executionkit','executionkit-host'].includes(k)))throw new Error('Legacy ExecutionKit MCP config contains non-ExecutionKit servers; reconcile manually');
    deletes.push('.agents/plugins/executionkit/mcp_config.json');
  }
  return deletes;
}

export function buildV5ProjectConfig(template,existing={},runtimePath=V4_RUNTIME_PATH,baseTemplate={},options={}){
  const config=buildV4ProjectConfig(template,existing,runtimePath,baseTemplate,options);
  config.standardVersion=options.targetVersion??V5_STANDARD_TARGET;config.$schema='./'+runtimePath+'/schemas/execution-config-v5.schema.json';
  config.v4.systems.decision={...V5_DECISION_DEFAULTS};
  config.decisionOS={...V5_DECISION_DEFAULTS,knowledgeRepository:'GemiTron88/KB',refreshCadence:'boundary-ttl',cacheTtlHours:6};
  return config;
}
