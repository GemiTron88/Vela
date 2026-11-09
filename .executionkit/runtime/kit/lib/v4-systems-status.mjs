import {isV5,V5_SYSTEM_NAMES} from './v5-config.mjs';
import {decisionOSStatus} from './decision-os.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './execution-model.mjs';
import { todoMaintenanceStatus } from './todo-maintenance.mjs';
import { inspectV4ProductClosure } from './v4-product-closure.mjs';
import { v4AgentRuntimeStatus } from './v4-agent-runtime.mjs';
import { rehydrateState } from './state-model.mjs';
import { inspectV4ContentOS } from './v4-content-os.mjs';
import { inspectSeoImplementation } from './v4-seo-os.mjs';
import { documentationFabricStatus } from './documentation-fabric.mjs';
import { productionDeploymentStatus } from './production-deployment.mjs';
import { inspectVisualOS } from './visual-os.mjs';
import { resolveV4Policy, validateV4Policy, V4_SYSTEM_NAMES } from './v4-config.mjs';
import { inspectV4Activation } from './v4-activation.mjs';
import { classifyV4Maturity } from './v4-maturity.mjs';
import { repositoryKnowledgeStatus } from './repository-intelligence-api.mjs';
import { inspectRepositoryProviders } from './repository-providers.mjs';
import { readV4ProviderUsage } from './v4-knowledge-runtime.mjs';
import { validateAntigravityV4 } from './antigravity-v4.mjs';
import { inspectV4ControlPlane } from './v4-control-plane.mjs';
import { inspectV4Platform } from './v4-platform.mjs';
import { inspectDatabaseIntegrity } from './database-integrity.mjs';
import { inspectRouteIntegrity } from './route-integrity.mjs';
import { upgradeRevalidationStatus } from './v4-upgrade-revalidation-status.mjs';
import { validateV4InvariantRegistry } from './v4-invariant-registry.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const V4_SYSTEM_RUNTIME_CONTRACT=Object.freeze({
  execution:Object.freeze({trigger:'always',command:'executionkit start .',kernelSlot:'execution',files:['bin/executionkit-cli.mjs','lib/v4-kernel.mjs','lib/v4-product-closure.mjs','lib/v4-boundary.mjs','lib/v4-activation.mjs','lib/v4-maturity.mjs','lib/v4-gate-identity.mjs','lib/todo-maintenance.mjs','lib/v4-invariant-registry.mjs','lib/v4-upgrade-revalidation.mjs','lib/v4-upgrade-revalidation-status.mjs','lib/v4-update-discovery.mjs'],evidence:['.executionkit/discovery/product-closure.json','.executionkit/gates/activation.json','.executionkit/runtime/checkpoint.json'],negativeRegressions:['tests/v4-kernel-enforcement.test.mjs','tests/v4-product-closure.test.mjs','tests/v4-upgrade-revalidation.test.mjs','tests/v4-update-discovery.test.mjs']}),
  agent:Object.freeze({trigger:'always',command:'executionkit agents status .',kernelSlot:'agent',files:['lib/v4-agent-runtime.mjs','lib/agent-model.mjs','lib/parallel-execution.mjs'],evidence:['.executionkit/agents/claims'],negativeRegressions:['tests/v4-agent-runtime.test.mjs','tests/v4-kernel-enforcement.test.mjs']}),
  state:Object.freeze({trigger:'always',command:'executionkit state status .',kernelSlot:'state',files:['lib/state-model.mjs','bin/state-status.mjs','bin/state-rehydrate.mjs','bin/state-checkpoint.mjs'],evidence:['.executionkit/state/latest.json','.executionkit/state/journal.ndjson'],negativeRegressions:['tests/state-os.test.mjs']}),
  content:Object.freeze({trigger:'impact',command:'executionkit content status .',kernelSlot:'content',files:['lib/v4-content-os.mjs','lib/content-model.mjs'],evidence:['.executionkit/evidence/raw/content-wave.json','.executionkit/evidence/raw/content-phase.json'],negativeRegressions:['tests/v4-content-seo.test.mjs']}),
  seo:Object.freeze({trigger:'applicability-and-impact',command:'executionkit seo status .',kernelSlot:'seo',files:['bin/seo-os.mjs','lib/v4-seo-os.mjs','lib/seo-model.mjs'],evidence:['.executionkit/evidence/raw/seo-implementation-wave.json','.executionkit/evidence/raw/seo-release.json'],negativeRegressions:['tests/v4-content-seo.test.mjs','tests/seo-os.test.mjs']}),
  docs:Object.freeze({trigger:'material-source-impact',command:'executionkit docs status .',kernelSlot:'docs',files:['bin/documentation-fabric.mjs','lib/documentation-fabric.mjs'],evidence:['.executionkit/knowledge/documentation-registry.json','docs/knowledge-base/generated'],negativeRegressions:['tests/documentation-fabric.test.mjs']}),
  audit:Object.freeze({trigger:'wave-phase-release',command:'executionkit audit wave .',kernelSlot:'audit',files:['bin/audit-project.mjs','lib/v4-audit-evidence.mjs'],evidence:['.executionkit/gates/audit-wave.json','.executionkit/gates/audit-phase.json','.executionkit/gates/audit-release.json'],negativeRegressions:['tests/v4-audit-evidence.test.mjs','tests/audit-os.test.mjs']}),
  test:Object.freeze({trigger:'wave-phase-release',command:'executionkit test wave .',kernelSlot:'test',files:['lib/v4-test-os.mjs','lib/agentic-e2e.mjs','lib/agentic-postconditions.mjs','bin/init-agentic-e2e.mjs','bin/test-project.mjs'],evidence:['.executionkit/gates/test-wave.json','.executionkit/gates/test-phase.json','.executionkit/gates/test-release.json'],negativeRegressions:['tests/v4-test-os.test.mjs','tests/agentic-e2e.test.mjs']}),
  launch:Object.freeze({trigger:'release',command:'executionkit launch status .',kernelSlot:'launch',files:['bin/production-deployment.mjs','lib/production-deployment.mjs','lib/vhost-guard.mjs','lib/v4-release-gates.mjs'],evidence:['.executionkit/deployment/production-state.json','.executionkit/gates/reconcile-release.json'],negativeRegressions:['tests/v4-release-gates.test.mjs','tests/production-deployment.test.mjs']}),
  visual:Object.freeze({trigger:'ui-surface-impact',command:'executionkit visual status . --boundary wave',kernelSlot:'visual',files:['lib/visual-os.mjs','lib/visual-capture.mjs','lib/visual-critic.mjs','lib/visual-audit.mjs','lib/visual-journeys.mjs','lib/component-model.mjs','lib/quality-model.mjs'],evidence:['.executionkit/gates/reconcile-wave.json','.executionkit/gates/reconcile-phase.json'],negativeRegressions:['tests/v4-visual-evidence.test.mjs','tests/visual-os-v2.test.mjs']}),
});

export const V5_DECISION_RUNTIME_CONTRACT=Object.freeze({trigger:'preflight-postflight-wave-phase-release',command:'executionkit decision status .',kernelSlot:'decision',files:['lib/decision-os.mjs','lib/decision/index.mjs','lib/decision/contract.mjs','lib/decision/policy.mjs','lib/decision/knowledge.mjs','lib/decision/kb-sync.mjs','lib/decision/plan-alignment.mjs','lib/decision/knowledge/catalog.json','lib/decision/knowledge/manifest.json','bin/decision-kb-refresh.mjs'],evidence:['.executionkit/gates/decision.json','.executionkit/gates/reconcile-release.json'],negativeRegressions:['tests/v5-decision-os.test.mjs']});
export const V5_SYSTEM_RUNTIME_CONTRACT=Object.freeze({...V4_SYSTEM_RUNTIME_CONTRACT,decision:V5_DECISION_RUNTIME_CONTRACT});
function safe(fn,fallback){try{return fn();}catch(error){return {...fallback,error:error.message};}}
function derivedEvidence(root,items){return items.map((rel)=>({path:rel,exists:fs.existsSync(path.resolve(root,rel))}));}
function latestGate(root,prefix){
  const observed=[];
  for(const boundary of ['wave','phase','release']){
    const rel='.executionkit/gates/'+prefix+'-'+boundary+'.json',full=path.resolve(root,rel);
    if(!fs.existsSync(full))continue;
    try{
      const gate=JSON.parse(fs.readFileSync(full,'utf8')),observedAt=gate.completedAt??gate.reconciledAt??null;
      const time=Number.isFinite(Date.parse(observedAt??''))?Date.parse(observedAt):fs.statSync(full).mtimeMs;
      observed.push({boundary,path:rel,status:gate.status??'UNKNOWN',observedAt,time});
    }catch(error){
      observed.push({boundary,path:rel,status:'INVALID',observedAt:null,time:fs.statSync(full).mtimeMs,error:error.message});
    }
  }
  if(!observed.length)return {status:'UNOBSERVED',boundary:null,path:null};
  observed.sort((a,b)=>b.time-a.time);
  const {time,...latest}=observed[0];
  return latest;
}
export function validateV4SystemRuntimeSurfaces(runtimeRoot=kitRoot,{v5=false}={}){
  const systemNames=v5?V5_SYSTEM_NAMES:V4_SYSTEM_NAMES,contracts=v5?V5_SYSTEM_RUNTIME_CONTRACT:V4_SYSTEM_RUNTIME_CONTRACT;
  const errors=[],systems={},testsAvailable=fs.existsSync(path.join(runtimeRoot,'tests'));
  const kernelFile=path.join(runtimeRoot,'lib/v4-kernel.mjs');
  const kernelText=fs.existsSync(kernelFile)?fs.readFileSync(kernelFile,'utf8'):'';
  const systemsStart=kernelText.indexOf('const systems={'),systemsEnd=kernelText.indexOf('const blockers',systemsStart);
  const kernelSystems=systemsStart>=0&&systemsEnd>systemsStart?kernelText.slice(systemsStart,systemsEnd):'';
  for(const name of systemNames){
    const contract=contracts[name],systemErrors=[];
    if(!contract||typeof contract.command!=='string'||!contract.command.trim())systemErrors.push({code:'V4_SYSTEM_CLI_CONTRACT_MISSING',system:name,message:'v4 system has no CLI contract: '+name});
    if(!contract||typeof contract.trigger!=='string'||!contract.trigger.trim())systemErrors.push({code:'V4_SYSTEM_TRIGGER_MISSING',system:name,message:'v4 system has no machine-observable trigger contract: '+name});
    if(!contract||!Array.isArray(contract.evidence)||contract.evidence.length===0)systemErrors.push({code:'V4_SYSTEM_EVIDENCE_CONTRACT_MISSING',system:name,message:'v4 system has no evidence contract: '+name});
    if(!contract||!Array.isArray(contract.negativeRegressions)||contract.negativeRegressions.length===0)systemErrors.push({code:'V4_SYSTEM_NEGATIVE_REGRESSION_CONTRACT_MISSING',system:name,message:'v4 system has no negative-regression contract: '+name});
    const files=contract?.files??[],missing=files.filter((rel)=>!fs.existsSync(path.join(runtimeRoot,rel)));
    for(const rel of missing)systemErrors.push({code:'V4_SYSTEM_RUNTIME_SURFACE_MISSING',system:name,path:rel,message:'Executable v4 system runtime surface is missing: '+name+' / '+rel});
    const kernelIntegrated=Boolean(contract?.kernelSlot&&new RegExp('\\b'+contract.kernelSlot+'\\s*:\\s*\\{').test(kernelSystems));
    if(!kernelIntegrated)systemErrors.push({code:'V4_SYSTEM_KERNEL_INTEGRATION_MISSING',system:name,message:'v4 system is not visibly integrated into the lifecycle kernel envelope: '+name});
    const missingNegativeRegressions=testsAvailable?(contract?.negativeRegressions??[]).filter((rel)=>!fs.existsSync(path.join(runtimeRoot,rel))):[];
    for(const rel of missingNegativeRegressions)systemErrors.push({code:'V4_SYSTEM_NEGATIVE_REGRESSION_MISSING',system:name,path:rel,message:'Declared negative regression is missing: '+name+' / '+rel});
    errors.push(...systemErrors);
    systems[name]={
      trigger:contract?.trigger??null,command:contract?.command??null,kernelSlot:contract?.kernelSlot??null,kernelIntegrated,
      files,missing,evidence:contract?.evidence??[],negativeRegressions:contract?.negativeRegressions??[],
      negativeRegressionSourceStatus:testsAvailable?'VERIFIED_SOURCE_FILES':'DECLARED_SOURCE_REGRESSIONS',
      missingNegativeRegressions,status:systemErrors.length?'INCOMPLETE':'EXECUTABLE'
    };
  }
  return {schemaVersion:'executionkit-v4-system-runtime-surfaces/v1',status:errors.length?'FAIL':'PASS',systems,errors};
}

export function inspectV4Systems(root){
  root=path.resolve(root);
  const {config}=loadConfig(root),policy=resolveV4Policy(config),policyValidation=validateV4Policy(config);
  const configuredRuntime=String(config.installation?.runtimePath??'').trim();
  const runtimeRoot=configuredRuntime?path.resolve(root,configuredRuntime):kitRoot;
  const systemNames=isV5(config)?V5_SYSTEM_NAMES:V4_SYSTEM_NAMES,contracts=isV5(config)?V5_SYSTEM_RUNTIME_CONTRACT:V4_SYSTEM_RUNTIME_CONTRACT;
  const runtime=validateV4SystemRuntimeSurfaces(runtimeRoot,{v5:isV5(config)});
  const project={
    decision:decisionOSStatus(root,config),
    execution:safe(()=>{const closure=inspectV4ProductClosure(root,{autoCreate:false,autoCommit:false,persist:false});const todo=todoMaintenanceStatus(root,config),activation=inspectV4Activation(root),maturity=classifyV4Maturity(root);return {status:todo.needed?'MAINTENANCE_REQUIRED':closure.status,productClosure:closure.status,todoMaintenance:todo.status,activation,maturity};},{status:'BLOCKED'}),
    agent:safe(()=>v4AgentRuntimeStatus(root),{status:'BLOCKED'}),
    state:safe(()=>rehydrateState(root),{status:'BLOCKED'}),
    content:safe(()=>inspectV4ContentOS(root,{boundary:'wave',writeEvidence:false}),{status:'BLOCKED'}),
    seo:safe(()=>inspectSeoImplementation(root,{boundary:'wave',writeEvidence:false}),{status:'BLOCKED'}),
    docs:safe(()=>documentationFabricStatus(root),{status:'BLOCKED'}),
    audit:latestGate(root,'audit'),
    test:latestGate(root,'test'),
    launch:safe(()=>productionDeploymentStatus(root),{status:'BLOCKED'}),
    visual:safe(()=>inspectVisualOS(root,{boundary:'wave',config}),{status:'BLOCKED'}),
  };
  const systems={};
  for(const name of systemNames){
    const contract=contracts[name],surface=runtime.systems[name],live=project[name];
    const trigger=(name==='decision'?config.v4?.systems?.decision?.trigger:policy.systems[name].trigger)??(policy.systems[name]?.always?'always':'lifecycle');
    systems[name]={enabled:(name==='decision'?config.v4?.systems?.decision?.enabled:policy.systems[name].enabled)===true,level:(name==='decision'?config.v4?.systems?.decision:policy.systems[name])?.level,trigger,contractTrigger:contract.trigger,command:contract.command,kernelIntegrated:surface.kernelIntegrated,runtimeStatus:surface.status,missingRuntimeFiles:surface.missing,negativeRegressions:surface.negativeRegressions,negativeRegressionSourceStatus:surface.negativeRegressionSourceStatus,liveStatus:live?.status??'UNKNOWN',live,evidence:derivedEvidence(root,contract.evidence)};
  }

  const providerReport=safe(()=>inspectRepositoryProviders(root),{providers:[],toolingError:'provider inspection failed'});
  const requiredProviders=new Set(config.repositoryIntelligence?.providers?.required??[]);
  const providerBlocking=(providerReport.providers??[]).filter((item)=>requiredProviders.has(item.id)&&item.status!=='READY');
  const knowledge=safe(()=>repositoryKnowledgeStatus(root),{status:'UNAVAILABLE'});
  const providerUsage=safe(()=>readV4ProviderUsage(root),{status:'INVALID',usage:null});
  const antigravity=safe(()=>validateAntigravityV4(root,config),{enabled:true,errors:[{code:'V4_ANTIGRAVITY_VALIDATION_FAILED',message:'Antigravity v4 validation failed'}]});
  const controlPlane=safe(()=>inspectV4ControlPlane(root),{status:'FAIL',errors:[{code:'V4_CONTROL_PLANE_INSPECTION_FAILED',message:'Control-plane inspection failed'}]});
  const platform=safe(()=>inspectV4Platform(root),{status:'FAIL',errors:[{code:'V4_PLATFORM_INSPECTION_FAILED',message:'Platform inspection failed'}]});
  const databaseIntegrity=safe(()=>inspectDatabaseIntegrity(root,{fast:true}),{status:'INVALID',applicable:null,cacheHit:false,contentReads:0,error:'database integrity inspection failed'});
  const upgradeRevalidation=safe(()=>upgradeRevalidationStatus(root),{status:'INVALID',required:true,blocking:true});
  const invariantRegistry=validateV4InvariantRegistry();
  const fabrics={
    routeIntegrity:safe(()=>inspectRouteIntegrity(root,{fast:true}),{status:'INVALID',applicable:null,error:'Route Integrity Fabric inspection failed'}),
    upgradeRevalidation:{...upgradeRevalidation,registryStatus:invariantRegistry.status,invariantCount:invariantRegistry.invariantCount},
    databaseIntegrity:{
      status:databaseIntegrity.status,
      applicable:databaseIntegrity.applicable??null,
      cacheHit:databaseIntegrity.cacheHit??null,
      contentReads:databaseIntegrity.contentReads??null,
      fingerprint:databaseIntegrity.fingerprint??null,
      tableCount:databaseIntegrity.tableCount??null,
      modelCount:databaseIntegrity.modelCount??null,
      nextCommand:databaseIntegrity.nextCommand??null,
      performanceMs:databaseIntegrity.durationMs??null
    },
    repositoryIntelligence:{
      status:providerBlocking.length?'FAIL':'PASS',
      autoConsumptionEnabled:config.repositoryIntelligence?.autoConsumption?.enabled===true,
      knowledgeStatus:knowledge.status??knowledge.trustState??'UNKNOWN',
      providers:(providerReport.providers??[]).map((item)=>({id:item.id,status:item.status,required:requiredProviders.has(item.id),version:item.version??null,reason:item.health?.reason??null})),
      usage:providerUsage,
      blocking:providerBlocking.map((item)=>({id:item.id,status:item.status,reason:item.health?.reason??null}))
    },
    antigravity:{
      status:(antigravity.errors??[]).length?'FAIL':'PASS',
      cliFirst:antigravity.cliFirst===true,
      mcp:antigravity.mcp===true,
      dependencySafeParallel:antigravity.dependencySafeParallel===true,
      errors:antigravity.errors??[]
    },
    controlPlane,
    platform
  };

  const errors=[...runtime.errors,...(policyValidation.errors??[]).map((issue)=>({...issue,source:'v4-policy'})),...(invariantRegistry.errors??[]).map((issue)=>({...issue,fabric:'upgrade-revalidation'}))];
  if(upgradeRevalidation.blocking)errors.push({code:'V4_UPGRADE_REVALIDATION_REQUIRED',fabric:'upgrade-revalidation',message:'Current ExecutionKit invariant baseline is not certified after upgrade',details:upgradeRevalidation});
  for(const name of systemNames){
    if((name==='decision'?config.v4?.systems?.decision?.enabled:policy.systems[name].enabled)!==true)errors.push({code:'V4_SYSTEM_DISABLED',system:name,message:'v4 system is disabled: '+name});
    const trigger=(name==='decision'?config.v4?.systems?.decision?.trigger:policy.systems[name].trigger)??(policy.systems[name]?.always?'always':'lifecycle');
    if(trigger!==contracts[name].trigger)errors.push({code:'V4_SYSTEM_TRIGGER_DRIFT',system:name,message:'v4 system trigger differs from executable contract: '+name+' ('+trigger+' != '+contracts[name].trigger+')'});
    const liveStatus=String(systems[name]?.liveStatus??'UNKNOWN').toUpperCase();
    if(['BLOCKED','FAIL','INVALID','ERROR'].includes(liveStatus)){
      errors.push({code:'V4_SYSTEM_LIVE_STATUS_FAILED',system:name,status:liveStatus,message:'v4 system live status is not healthy: '+name+' ('+liveStatus+')'});
    }
  }
  for(const item of providerBlocking)errors.push({code:'V4_REQUIRED_PROVIDER_UNAVAILABLE',fabric:'repository-intelligence',provider:item.id,message:'Required Repository Intelligence provider is not READY: '+item.id+' ('+item.status+')'});
  for(const issue of antigravity.errors??[])errors.push({...issue,fabric:'antigravity'});
  if(controlPlane.status==='FAIL')for(const issue of controlPlane.errors??[])errors.push({...issue,fabric:'control-plane'});
  if(platform.status==='FAIL')for(const issue of platform.errors??[])errors.push({...issue,fabric:'platform'});
  return {schemaVersion:isV5(config)?'executionkit-v5-systems-status/v1':'executionkit-v4-systems-status/v1',status:errors.length?'FAIL':'PASS',systemCount:systemNames.length,runtimeRoot,systems,fabrics,errors,observedAt:new Date().toISOString()};
}
