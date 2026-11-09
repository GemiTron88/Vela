import path from 'node:path';
import { declaredAuditBoundary, loadConfig } from './execution-model.mjs';
import { resolveRuntimePlan } from './runtime-orchestrator.mjs';
import { rehydrateState, rehydrateStateFast } from './state-model.mjs';
import { repositoryKnowledgeStatus } from './repository-intelligence-api.mjs';
import { inspectRepositoryProviders } from './repository-providers.mjs';
import { documentationFabricStatus } from './documentation-fabric.mjs';
import { inspectVisualOS } from './visual-os.mjs';
import { readV4HostObservation } from './v4-host.mjs';
import { V4_STANDARD_TARGET, V4_SYSTEM_NAMES, resolveV4Policy, validateV4Policy } from './v4-config.mjs';
import { v4AgentRuntimeStatus } from './v4-agent-runtime.mjs';
import { reconciliationStatus } from './v4-reconcile.mjs';
import { readV4ProviderUsage, useV4Knowledge } from './v4-knowledge-runtime.mjs';
import { todoMaintenanceStatus } from './todo-maintenance.mjs';
import { inspectDatabaseIntegrity } from './database-integrity.mjs';
import { isUpgradeRevalidationTask, upgradeRevalidationStatus } from './v4-upgrade-revalidation-status.mjs';
import { getFastUpdateStatus } from './v4-update-discovery.mjs';

function safe(fn,fallback){try{return fn();}catch(error){return {...fallback,error:error.message};}}

function providerSummary(config,report){
  const known=new Set((report?.providers??[]).map((p)=>p.id));
  const required=(config.repositoryIntelligence?.providers?.required??[]).filter((id)=>known.has(id));
  const requiredSet=new Set(required);
  const providers=(report?.providers??[]).map((p)=>({id:p.id,status:p.status,required:requiredSet.has(p.id),version:p.version??null,reason:p.health?.reason??null}));
  return {providers,blocking:providers.filter((p)=>p.required&&p.status!=='READY'),required};
}

function visualTask(runtime){
  const encoded=JSON.stringify(runtime?.resources??{});
  return /premium|design-system|component|web|flutter|ui|frontend|accessibility|responsive/i.test(encoded);
}
function databaseTask(runtime){
  const encoded=JSON.stringify({task:runtime?.task??null,resources:runtime?.resources??null,action:runtime?.action??null});
  return /database|\bdb\b|migration|eloquent|\bsql\b|query[-_ ]?builder|foreign[-_ ]?key|pivot|postgres|mysql|sqlite|app[\\/]models/i.test(encoded);
}

export function buildV4ExecutionEnvelope(root,{host='antigravity',boost=false,boundary='task',forceRefresh=false,fast=false}={}){
  root=path.resolve(root);
  const {config,source,policyIssues=[]}=loadConfig(root);
  const v4Validation=validateV4Policy(config);
  const v4Policy=resolveV4Policy(config);
  const fastTaskPath=fast===true&&boundary==='task';

  const todoMaintenance=fastTaskPath
    ? {status:'DEFERRED_FAST_PATH',needed:false,reasons:[]}
    : safe(()=>todoMaintenanceStatus(root,config),{status:'BLOCKED',needed:true,reasons:[{code:'TODO_MAINTENANCE_STATUS_FAILED',message:'TODO maintenance status could not be evaluated'}]});

  const runtime=todoMaintenance.needed?{status:'TODO_MAINTENANCE_REQUIRED'}:safe(()=>resolveRuntimePlan(root,{boost,includeRepositoryContext:!fastTaskPath,archiveMode:fastTaskPath?'index':'full',includeConvergence:!fastTaskPath,config}),{status:'INVALID'});
  const action=runtime.action??null;
  const actionable=runtime.status==='READY';
  const updateStatus=safe(()=>getFastUpdateStatus(root,{config}),{status:'OFFLINE_OR_UNKNOWN',error:'update discovery status failed'});
  const upgradeRevalidation=safe(()=>upgradeRevalidationStatus(root),{status:'INVALID',required:true,blocking:true,reason:'UPGRADE_REVALIDATION_STATUS_FAILED'});
  const upgradeCorrectionTask=actionable&&isUpgradeRevalidationTask(runtime.task);
  const heavyBoundary=['wave','phase','release'].includes(boundary);
  const databaseRelevant=databaseTask(runtime);

  const state=safe(()=>fastTaskPath?rehydrateStateFast(root,{runtimePlan:runtime,config}):rehydrateState(root),{status:'INVALID'});
  const providerReport=fastTaskPath
    ? {schemaVersion:'executionkit-v4-native-providers/v1',mode:'NATIVE_ONLY',providers:[
        {id:'native-source-pack',status:'READY',version:'1.0.0',health:{reason:null}},
        {id:'native-macro-context',status:'READY',version:'1.0.0',health:{reason:null}},
      ]}
    : safe(()=>inspectRepositoryProviders(root,{force:forceRefresh}),{providers:[]});
  const providers=providerSummary(config,providerReport);

  const knowledge=fastTaskPath
    ? {status:'DEFERRED_FAST_PATH',trustState:null}
    : safe(()=>repositoryKnowledgeStatus(root),{status:'UNAVAILABLE'});

  const docs=config.documentation?.enabled===true
    ? (fastTaskPath
        ? {status:'DEFERRED_TO_WAVE_OR_PHASE',enabled:true}
        : safe(()=>documentationFabricStatus(root),{status:'STALE_OR_MISSING',enabled:true}))
    : {status:'DISABLED',enabled:false};

  const effectiveConfig={...config,v4:{...(config.v4??{}),systems:v4Policy.systems}};
  const visual=fastTaskPath
    ? (visualTask(runtime)
        ? {status:'REVIEW_REQUIRED',discovery:{stacks:[]},requiredTestEvidence:[],deferred:true}
        : {status:'NOT_APPLICABLE',discovery:{stacks:[]},requiredTestEvidence:[],deferred:true})
    : inspectVisualOS(root,{boundary,config:effectiveConfig});

  const database=(databaseRelevant||heavyBoundary||!fastTaskPath)
    ? safe(()=>inspectDatabaseIntegrity(root,{fast:true}),{status:'INVALID',applicable:true,cacheHit:false,error:'Database Integrity Fabric status failed'})
    : {status:'DEFERRED_FAST_NON_DB_TASK',applicable:null,cacheHit:true,contentReads:0};
  const hostObservation=host==='antigravity'?readV4HostObservation(root):{status:'NOT_REQUIRED',fresh:true,observation:null};
  const agentRuntime=safe(()=>v4AgentRuntimeStatus(root),{activeCount:0,active:[],error:null});
  const needsReconciliationStatus=['review','revalidate'].includes(action)||!fastTaskPath;
  const reconciliation=needsReconciliationStatus
    ? safe(()=>reconciliationStatus(root,{boundary:'task'}),{status:'INVALID',current:false,gate:null,error:'reconciliation status failed'})
    : {status:'DEFERRED_FAST_PATH',current:null,gate:null};

  const auditBoundary=action==='audit'&&runtime.task?declaredAuditBoundary(runtime.task):null;
  const cliOwnedBoundary=['wave','phase'].includes(auditBoundary)?auditBoundary:null;
  const parallelDelegationRequired=actionable&&!cliOwnedBoundary&&action!=='deploy'&&(runtime.batch?.length??0)>1&&agentRuntime.activeCount===0;

  const automaticKnowledge=fastTaskPath
    ? {status:'DEFERRED_FAST_PATH',decision:{outcome:'NATIVE_ON_DEMAND'}}
    : actionable
      ? safe(()=>useV4Knowledge(root,{
          purpose:'agent-context',
          maxBytes:config.repositoryIntelligence?.context?.maxBytes??16384,
          providerReport,
          task:runtime.task,
          forceRefresh,
        }),{status:'FAILED',error:'automatic native knowledge consumption failed'})
      : {status:'IDLE',usage:readV4ProviderUsage(root)};

  const systems={
    execution:{required:true,status:runtime.status,reason:'Canonical lifecycle/scheduling authority'},
    agent:{required:true,status:runtime.routeId?'ROUTED':actionable?'UNROUTED':'IDLE',routeId:runtime.routeId??null,reason:'Every actionable task must resolve deterministic Agent OS context'},
    state:{required:true,status:state.status,reason:'Rehydrate before mutation; checkpoint after lifecycle transitions'},
    content:{required:v4Policy.systems.content.enabled,status:v4Policy.systems.content.enabled?(fastTaskPath?'DEFERRED_TO_WAVE_OR_PHASE':'IMPACT_RECONCILIATION_REQUIRED'):'DISABLED'},
    seo:{required:v4Policy.systems.seo.enabled,status:v4Policy.systems.seo.enabled?(fastTaskPath?'DEFERRED_TO_WAVE_OR_PHASE':'APPLICABILITY_AND_IMPACT_REQUIRED'):'DISABLED'},
    docs:{required:v4Policy.systems.docs.enabled,status:docs.status,reason:'Material source/schema/config changes are validated at wave/phase/release boundaries'},
    audit:{required:action==='audit'||heavyBoundary,status:v4Policy.systems.audit.enabled?'AVAILABLE':'DISABLED'},
    test:{required:heavyBoundary,status:v4Policy.systems.test.enabled?(heavyBoundary?'REQUIRED':'DEFERRED_TO_WAVE_OR_PHASE'):'DISABLED'},
    launch:{required:action==='deploy'||boundary==='release',status:v4Policy.systems.launch.enabled?'AVAILABLE':'DISABLED'},
    visual:{required:visual.status!=='NOT_APPLICABLE'&&(visualTask(runtime)||boundary==='phase'||boundary==='release'),status:visual.status,reason:fastTaskPath?'Visual validation deferred to boundary; UI task still marked for review':'All UI-bearing work is governed by Premium Visual OS'},
  };

  const blockers=[];
  if(updateStatus.status==='UPDATE_AVAILABLE')blockers.push({code:'V4_UPDATE_AVAILABLE',message:'A newer canonical ExecutionKit version ('+(updateStatus.remoteCommit?.slice(0,8)??'remote')+') is available; project mutation is paused until self-update is applied.',system:'execution',update:updateStatus});
  if(upgradeRevalidation.blocking&&!upgradeCorrectionTask)blockers.push({code:'V4_UPGRADE_REVALIDATION_REQUIRED',message:'ExecutionKit enforcement invariants changed; complete the scoped upgrade revalidation baseline before normal canonical execution.',system:'execution',revalidation:upgradeRevalidation});
  if(!fastTaskPath&&todoMaintenance.needed)blockers.push({code:'V4_TODO_MAINTENANCE_REQUIRED',message:'Canonical TODO authority requires migration/archive/split maintenance before new lifecycle work.',system:'execution',maintenance:todoMaintenance});
  if(host==='antigravity'&&!hostObservation.fresh)blockers.push({code:'V4_ANTIGRAVITY_HOOK_UNOBSERVED',message:'No fresh Antigravity PreInvocation observation exists; AGENTS/CLI integration has not been proven live for this session.',system:'host'});
  if(policyIssues.length)blockers.push(...policyIssues.map((x)=>({code:x.code,message:x.message,system:'execution'})));
  if(v4Validation.errors.length)blockers.push(...v4Validation.errors.map((x)=>({code:x.code,message:x.message,system:x.system??'kernel'})));
  if(actionable&&state.safeToResume!==true)blockers.push({code:'V4_STATE_REHYDRATION_REQUIRED',message:'State OS is not fresh/safe-to-resume; inspect live repository truth and write a current checkpoint before mutation.',system:'state',status:state.status});
  if(actionable&&databaseRelevant&&['MISSING','STALE','INVALID'].includes(database.status))blockers.push({code:'V4_DATABASE_CONTEXT_REQUIRED',message:'Database-impacting work requires current Database Integrity Fabric truth before mutation. Never guess tables, columns, relations or schema state.',system:'database-fabric',status:database.status});
  if(actionable&&!runtime.routeId)blockers.push({code:'V4_AGENT_ROUTE_REQUIRED',message:'Actionable work has no Agent OS route.',system:'agent'});
  if(actionable&&cliOwnedBoundary)blockers.push({code:'V4_BOUNDARY_COMMAND_REQUIRED',message:'Canonical '+cliOwnedBoundary+' audit work is owned by the atomic Boundary Orchestrator; do not execute it as a normal agent task.',system:'audit',boundary:cliOwnedBoundary});
  if(actionable&&action==='deploy')blockers.push({code:'V4_LAUNCH_COMMAND_REQUIRED',message:'Canonical deploy work is owned by Launch OS; do not execute deployment as a normal agent task.',system:'launch'});
  if(parallelDelegationRequired)blockers.push({code:'V4_AGENT_DELEGATION_REQUIRED',message:'A dependency-safe parallel batch is available; Agent OS delegation must be prepared instead of silently executing only the first task.',system:'agent',taskIds:(runtime.batch??[]).map((x)=>x.task?.id??x.taskId).filter(Boolean)});
  if(agentRuntime.activeCount>0)blockers.push({code:'V4_AGENT_BATCH_ACTIVE',message:'A multi-agent batch is active; collect/integrate/reconcile/cancel it before opening new canonical work.',system:'agent',claims:agentRuntime.active});
  if(['review','revalidate'].includes(action)){
    const sameTask=reconciliation.gate?.taskId===runtime.task?.id;
    const acceptable=['PASS','REVIEW_REQUIRED'].includes(reconciliation.gate?.status);
    if(!reconciliation.current||!sameTask||!acceptable)blockers.push({code:'V4_TASK_RECONCILIATION_REQUIRED',message:'Review/revalidation requires a current task reconciliation gate for the exact HEAD and task.',system:'execution',reconciliation:{status:reconciliation.status,current:reconciliation.current,gateTaskId:reconciliation.gate?.taskId??null,gateStatus:reconciliation.gate?.status??null}});
  }
  if(!fastTaskPath&&actionable&&automaticKnowledge.status!=='OK')blockers.push({code:'V4_KNOWLEDGE_AUTO_CONSUMPTION_FAILED',message:automaticKnowledge.error??'Automatic Knowledge Fabric consumption failed.',system:'knowledge'});
  for(const p of providers.blocking)blockers.push({code:'V4_REQUIRED_PROVIDER_UNAVAILABLE',message:`Required Repository Intelligence provider ${p.id} is ${p.status}`,system:'knowledge'});
  if(!fastTaskPath&&systems.visual.required&&visual.status==='FAIL')blockers.push({code:'V4_VISUAL_GATE_FAILED',message:'Applicable UI work failed Visual OS mechanical premium prerequisites.',system:'visual'});
  if(boundary==='release'&&config.documentation?.requiredForRelease===true&&docs.status!=='CURRENT')blockers.push({code:'V4_DOCS_RELEASE_STALE',message:'Docs OS knowledge base is not current for release.',system:'docs'});

  const preconditions=[
    'State OS rehydration must be fresh before mutation.',
    'Use the returned Agent OS route/resources; do not invent host-only routing.',
    fastTaskPath?'Use native source/context on demand; do not pre-scan the repository.':'Use native Repository Intelligence when task scope is unclear or cross-cutting.',
  ];
  if(systems.visual.required)preconditions.push('Load Visual OS premium/component/design requirements before UI mutation.');
  if(databaseRelevant)preconditions.push('Database Integrity Fabric is authoritative for schema references. Never invent a table/column/relation; use executionkit db table|column|model for targeted truth.');
  const postconditions=[
    'Do not run automatic Test/Audit gates per task; defer them to the next wave/phase boundary unless explicit debugging is requested.',
    'Run Product Closure, Content, SEO, Docs and Visual deep reconciliation at wave/phase/release boundaries.',
    'Checkpoint State OS with current evidence refs and next safe action.',
    'Only the orchestrator mutates canonical TODO claims/status and integrates parallel workers.',
  ];

  return {
    schemaVersion:'executionkit-v4-envelope/v1',
    standardTarget:V4_STANDARD_TARGET,
    migrationRequired:v4Policy.migrationRequired,
    v4PolicyStatus:v4Validation.status,
    runtimeMode:fastTaskPath?'FAST_TASK':'DEEP',
    cliFirst:true,
    mcp:'DISABLED',
    host,
    hostIntegration:{status:hostObservation.status,fresh:hostObservation.fresh,observedAt:hostObservation.observation?.observedAt??null,invocationNum:hostObservation.observation?.invocationNum??null},
    root,
    configSource:source?path.relative(root,source).split(path.sep).join('/'):null,
    generatedAt:new Date().toISOString(),
    blocked:blockers.length>0,
    blockers,
    runtime,
    todoMaintenance,
    agentRuntime,
    hostAction:(agentRuntime.hostAction&&agentRuntime.hostAction!=='NONE')?agentRuntime.hostAction:(parallelDelegationRequired?'PREPARE_NATIVE_SUBAGENTS':'NONE'),
    hostDelegations:agentRuntime.hostDelegations??[],
    reconciliation,
    state:{status:state.status,safeToResume:state.safeToResume??null,drift:state.drift??[]},
    knowledge:{status:knowledge.status??knowledge.trustState??'UNKNOWN',trustState:knowledge.trustState??null,providers,automaticUse:automaticKnowledge.status==='OK'?{status:'OK',decision:automaticKnowledge.decision,evidence:automaticKnowledge.evidence}:automaticKnowledge},
    systems:Object.fromEntries(V4_SYSTEM_NAMES.map((name)=>[name,systems[name]])),
    visualSummary:{status:visual.status,stacks:visual.discovery?.stacks??[],requiredTestEvidence:visual.requiredTestEvidence??[]},
    fabrics:{database:{required:databaseRelevant,status:database.status,applicable:database.applicable??null,cacheHit:database.cacheHit??null,contentReads:database.contentReads??null,fingerprint:database.fingerprint??null,durationMs:database.durationMs??null},upgradeRevalidation,update:updateStatus},
    docs:{status:docs.status,enabled:docs.enabled??config.documentation?.enabled===true},
    preconditions,
    postconditions,
    nextCommand: blockers.some((x)=>x.code==='V4_UPDATE_AVAILABLE')?'executionkit self-update apply .':blockers.some((x)=>x.code==='V4_UPGRADE_REVALIDATION_REQUIRED')?'executionkit upgrade-revalidation run .':agentRuntime.active?.some((x)=>['RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED'].includes(x.status))?'executionkit agents reconcile . --claim '+(agentRuntime.active.find((x)=>['RECONCILIATION_FAILED','RECONCILIATION_REVIEW_REQUIRED'].includes(x.status))?.claimId??''):agentRuntime.activeCount>0?(agentRuntime.hostAction==='SPAWN_NATIVE_SUBAGENTS'?'executionkit agents status .':'executionkit agents collect .'):blockers.some((x)=>x.code==='V4_STATE_REHYDRATION_REQUIRED')?'executionkit state checkpoint . --reason pre-mutation --context-health HEALTHY':blockers.some((x)=>x.code==='V4_DATABASE_CONTEXT_REQUIRED')?'executionkit db refresh .':blockers.some((x)=>x.code==='V4_BOUNDARY_COMMAND_REQUIRED')?'executionkit boundary '+cliOwnedBoundary+' .':blockers.some((x)=>x.code==='V4_LAUNCH_COMMAND_REQUIRED')?'executionkit launch status .':blockers.some((x)=>x.code==='V4_AGENT_DELEGATION_REQUIRED')?'executionkit agents run .'+(boost?' --boost':''):blockers.some((x)=>x.code==='V4_TASK_RECONCILIATION_REQUIRED')?'executionkit reconcile task . --task '+(runtime.task?.id??''):blockers.length?'executionkit status .':['wave','phase'].includes(boundary)?'executionkit boundary '+boundary+' .':'executionkit next .',
  };
}

export function validateV4Envelope(envelope){
  const errors=[];
  if(envelope?.mcp!=='DISABLED')errors.push({code:'V4_MCP_FORBIDDEN',message:'v4 execution envelope must be CLI-first and MCP-free'});
  const names=Object.keys(envelope?.systems??{});
  for(const name of V4_SYSTEM_NAMES){
    const system=envelope?.systems?.[name];
    if(!system){errors.push({code:'V4_SYSTEM_MISSING',system:name,message:`Missing system in execution envelope: ${name}`});continue;}
    if(typeof system.required!=='boolean')errors.push({code:'V4_SYSTEM_APPLICABILITY_MISSING',system:name,message:`System applicability is not explicit: ${name}`});
    if(typeof system.status!=='string'||!system.status.trim())errors.push({code:'V4_SYSTEM_STATUS_MISSING',system:name,message:`System status is not explicit: ${name}`});
    if(system.required===true&&system.status==='DISABLED')errors.push({code:'V4_REQUIRED_SYSTEM_DISABLED',system:name,message:`Required v4 system is disabled: ${name}`});
  }
  for(const name of names)if(!V4_SYSTEM_NAMES.includes(name))errors.push({code:'V4_SYSTEM_UNKNOWN',system:name,message:`Unknown system in v4 execution envelope: ${name}`});
  if(envelope?.systems?.visual?.required&&!['PASS','REVIEW_REQUIRED','FAIL'].includes(envelope.systems.visual.status))errors.push({code:'V4_VISUAL_STATUS_INVALID',message:'Applicable Visual OS must produce an explicit gate status'});
  return {status:errors.length?'FAIL':'PASS',errors};
}

export { V4_SYSTEM_NAMES as TEN_SYSTEMS };
