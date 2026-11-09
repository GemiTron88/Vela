import {isV5,V5_STANDARD_TARGET,validateV5DecisionPolicy} from './v5-config.mjs';
export const V4_STANDARD_TARGET='4.1.0';
export const V4_MATURITY_PROFILES=['M0_PLANNING_ONLY','M1_EARLY_IMPLEMENTATION','M2_ACTIVE_DEVELOPMENT','M3_NEAR_COMPLETE','M4_PRODUCTION'];
export const V4_SYSTEM_NAMES=['execution','agent','state','content','seo','docs','audit','test','launch','visual'];

function integrationPrefix(id,suffix){
  const value=String(id??'').trim();
  for(const token of ['EK4-','EK5-','EK-']){
    const tail=token+suffix;
    if(value===tail)return '';
    if(value.endsWith(tail)){
      const prefix=value.slice(0,-tail.length);
      if(/^(?:[A-Za-z0-9._-]+-)$/.test(prefix))return prefix;
    }
  }
  return null;
}

export function resolveV4IntegrationTaskIds(adoption={}){
  const currentGate=String(adoption.integrationGateTaskId??'').trim();
  const currentActivation=String(adoption.integrationActivationTaskId??'').trim();
  const gatePrefix=integrationPrefix(currentGate,'AUDIT');
  const activationPrefix=integrationPrefix(currentActivation,'ACTIVATE');
  if(gatePrefix!==null&&activationPrefix!==null&&gatePrefix===activationPrefix){
    return {prefix:gatePrefix,gateId:currentGate,activationId:currentActivation};
  }
  const legacy=[currentGate,currentActivation].map((value)=>String(value??'').trim()).filter(Boolean);
  for(const value of legacy){
    const match=value.match(/^(.*)EK(?:00|4|5)?-(?:AUDIT|ACTIVATE)$/i);
    if(match&&/^(?:[A-Za-z0-9._-]+-)?$/.test(match[1]??'')){
      const prefix=match[1]??'';
      return {prefix,gateId:prefix+'EK4-AUDIT',activationId:prefix+'EK4-ACTIVATE'};
    }
  }
  return {prefix:'',gateId:'EK4-AUDIT',activationId:'EK4-ACTIVATE'};
}

export function validV4IntegrationTaskIds(adoption={}){
  const gate=String(adoption.integrationGateTaskId??'').trim();
  const activation=String(adoption.integrationActivationTaskId??'').trim();
  const gatePrefix=integrationPrefix(gate,'AUDIT');
  const activationPrefix=integrationPrefix(activation,'ACTIVATE');
  return gatePrefix!==null&&activationPrefix!==null&&gatePrefix===activationPrefix;
}

export const V4_SYSTEM_DEFAULTS=Object.freeze({
  execution:Object.freeze({enabled:true,level:'STANDARD',always:true}),
  agent:Object.freeze({enabled:true,level:'STANDARD',always:true,parallelMode:'DEPENDENCY_SAFE_PARALLEL'}),
  state:Object.freeze({enabled:true,level:'STANDARD',always:true,rehydrateBeforeMutation:true,checkpointAfterLifecycle:true}),
  content:Object.freeze({enabled:true,level:'STANDARD',trigger:'impact'}),
  seo:Object.freeze({enabled:true,level:'STANDARD',trigger:'applicability-and-impact'}),
  docs:Object.freeze({enabled:true,level:'STANDARD',trigger:'material-source-impact',requiredForRelease:true}),
  audit:Object.freeze({enabled:true,level:'STANDARD',trigger:'wave-phase-release'}),
  test:Object.freeze({enabled:true,level:'STANDARD',trigger:'wave-phase-release',runTaskVerification:false,runImpactedTests:false,requireExecutableTaskCheck:false,phaseFullSuite:true,waveFullSuite:true,surfaceScope:Object.freeze({includeRoots:Object.freeze([]),excludeRoots:Object.freeze([])})}),
  launch:Object.freeze({enabled:true,level:'STANDARD',trigger:'release'}),
  visual:Object.freeze({enabled:true,level:'FULL',profile:'PREMIUM',trigger:'ui-surface-impact',requireResponsive:true,requireComponentSystem:true,requireDesignAuthority:true,requireRenderedReview:true,requireProductionShapedData:true,requireAccessibility:true,requireIndependentReview:true,surfaceScope:Object.freeze({includeRoots:Object.freeze([]),excludeRoots:Object.freeze([])})}),
});

function mergedSystem(name,config){
  const current=config?.systems?.[name]??config?.v4?.systems?.[name]??{};
  return {...V4_SYSTEM_DEFAULTS[name],...current};
}

export function resolveV4Policy(config={}){
  const systems=Object.fromEntries(V4_SYSTEM_NAMES.map((name)=>[name,mergedSystem(name,config)]));
  return {
    standardTarget:isV5(config)?V5_STANDARD_TARGET:V4_STANDARD_TARGET,
    migrationRequired:! /^[45]\./.test(String(config.standardVersion??'')),
    cliFirst:config?.v4?.cliFirst??true,
    mcp:config?.v4?.mcp??false,
    host:{primary:'antigravity',entryAuthority:'AGENTS.md',...(config?.v4?.host??{})},
    kernel:{failClosed:true,requireSystemEvidence:true,requireNegativeRegressions:true,automaticImpactRouting:true,...(config?.v4?.kernel??{})},
    systems,
  };
}

export function validateV4Policy(config={}){
  const policy=resolveV4Policy(config),errors=[...validateV5DecisionPolicy(config)];
  if(policy.cliFirst!==true)errors.push({code:'V4_CLI_FIRST_REQUIRED',message:'v4 requires CLI-first host integration'});
  if(policy.mcp!==false)errors.push({code:'V4_MCP_FORBIDDEN',message:'v4 execution path must not enable MCP'});
  if(policy.host.primary!=='antigravity'||policy.host.entryAuthority!=='AGENTS.md'||'requireLiveHookObservation' in policy.host)errors.push({code:'V4_HOST_CONTRACT_INVALID',message:'v4 Antigravity host contract must enter through AGENTS.md without a blocking hook observation requirement'});
  for(const name of V4_SYSTEM_NAMES){
    const s=policy.systems[name];
    if(!s||s.enabled!==true)errors.push({code:'V4_SYSTEM_DISABLED',system:name,message:'v4 system must be enabled: '+name});
    if(!['LITE','STANDARD','FULL'].includes(s?.level))errors.push({code:'V4_SYSTEM_LEVEL_INVALID',system:name,message:'v4 system has invalid level: '+name});
  }
  for(const name of ['execution','agent','content','seo','audit','test','launch']){
    if(!['STANDARD','FULL'].includes(config?.capabilities?.[name]))errors.push({code:'V4_LEGACY_CAPABILITY_DISABLED',system:name,message:'v4 requires legacy capability shim '+name+' to be STANDARD or FULL'});
  }
  const evidence=config?.evidence??{};
  if(evidence.requireDurableTaskEvidence!==true||String(evidence.taskProofRoot??'')!=='docs/execution/evidence/tasks'){
    errors.push({code:'V4_DURABLE_TASK_EVIDENCE_REQUIRED',system:'execution',message:'v4 requires durable Git-tracked task acceptance proof under docs/execution/evidence/tasks; volatile .executionkit evidence may not close ACCEPTED/RELEASED tasks'});
  }
  const adoption=config?.adoption??{},integration=config?.integration??{};
  if(adoption.bootstrapAuthority!=='runtime-receipt'||adoption.deepIntegrationRequired!==true||!['EK4','EK5','EK_CORE'].includes(adoption.integrationPhase)||!validV4IntegrationTaskIds(adoption)||adoption.productExecutionBlockedUntilGateAccepted!==true){
    errors.push({code:'V4_ADOPTION_POLICY_INVALID',system:'execution',message:'v4 requires deterministic runtime-receipt bootstrap authority; legacy EK4 task gates are compatibility metadata only and must not block product execution'});
  }
  if(!V4_MATURITY_PROFILES.includes(adoption.maturityProfile)||!Array.isArray(adoption.maturityRationale)||adoption.maturityRationale.length===0){
    errors.push({code:'V4_MATURITY_CLASSIFICATION_INVALID',system:'execution',message:'v4 requires one evidence-grounded M0-M4 maturity profile and rationale'});
  }
  if(integration.requireSystemReleaseGate!==false||integration.releaseGateAuthority!=='runtime-exact-candidate'||integration.requirePhaseConvergenceForClosure!==true){
    errors.push({code:'V4_RELEASE_AUTHORITY_INVALID',system:'launch',message:'v4 release authority must be runtime exact-candidate gates; legacy mutable system release-gate tasks are not release truth'});
  }
    const controlPlane=config?.controlPlane??{},ci=config?.ci??{};
  if(controlPlane.mode!=='github-native'||controlPlane.executionAgent!=='disabled'||controlPlane.repositoryAuthority!=='github-origin'||controlPlane.taskAuthority!=='todo-shards'||controlPlane.statusAuthority!=='github-checks-workflows'||controlPlane.fleetAuthority!=='github-self-hosted-runners'||controlPlane.dispatchAuthority!=='github-workflow-dispatch'||controlPlane.workflowDispatch!=='repository-defined-manual'||controlPlane.remoteCommand!=='disabled'||controlPlane.requiredForLocalExecution!==false){
    errors.push({code:'V4_CONTROL_PLANE_POLICY_INVALID',system:'execution',message:'v4 requires GitHub-native observation plus repository-defined manual workflow dispatch, with the legacy ExecutionKit Agent and generic remote commands disabled'});
  }
  const todoAuthority=config?.todoAuthority??{};
  if(!['sharded','single-file'].includes(todoAuthority.mode)||todoAuthority.maintenanceRequired!==true){
    errors.push({code:'V4_TODO_AUTHORITY_POLICY_INVALID',system:'execution',message:'v4 canonical task authority must be the declared product TODO or its maintained phase shards; shadow backlogs are forbidden'});
  }
  if(config?.taskModel?.adapter!=='canonical-blocks'||String(config?.taskModel?.projectionCommand??'').trim()){
    errors.push({code:'V4_TASK_PROJECTION_FORBIDDEN',system:'execution',message:'v4 task execution must read canonical TODO shards directly; projection adapters/commands are forbidden'});
  }
  const runnerOs=(ci.allowedRunnerOS??[]).map((x)=>String(x).toLowerCase());
  if(ci.provider!=='github-actions'||ci.executionMode!=='self-hosted-manual'||ci.githubHostedAllowed!==false||ci.automaticPushRuns!==false||ci.maxProjectRunnersPerDevice!==1||!['linux','windows','macos'].every((os)=>runnerOs.includes(os))){
    errors.push({code:'V4_CI_PLATFORM_POLICY_INVALID',system:'test',message:'v4 requires manual self-hosted GitHub Actions on Linux, Windows and macOS with no GitHub-hosted minutes'});
  }
  if(config?.fleet?.agentMode||config?.fleet?.telemetry?.transport==='local-agent')errors.push({code:'V4_LEGACY_EXECUTION_AGENT_COUPLING',system:'execution',message:'v4 must not depend on the legacy per-device ExecutionKit Agent fleet'});
    const auto=config?.repositoryIntelligence?.autoConsumption;
  if(config?.repositoryIntelligence?.enabled!==true||auto?.enabled!==true||auto?.fallback!=='native'||!Array.isArray(auto?.preferred))errors.push({code:'V4_KNOWLEDGE_AUTO_CONSUMPTION_REQUIRED',system:'knowledge',message:'v4 requires enabled native Repository Intelligence'});
  const externalProviderIds=new Set(['repomix','codegraph','rtk','terrain']);
  const configuredProviders=[
    ...(config?.repositoryIntelligence?.providers?.required??[]),
    ...(config?.repositoryIntelligence?.providers?.optional??[]),
    ...(auto?.preferred??[]),
  ].filter((id)=>externalProviderIds.has(String(id).toLowerCase()));
  if(configuredProviders.length)errors.push({code:'V4_EXTERNAL_REPOSITORY_TOOLS_FORBIDDEN',system:'knowledge',message:'v4 runtime is native-only; remove external repository tools: '+[...new Set(configuredProviders)].join(', ')});
  const test=policy.systems.test,audit=policy.systems.audit;
  if(test?.trigger!=='wave-phase-release'||test?.runTaskVerification!==false||test?.runImpactedTests!==false||test?.requireExecutableTaskCheck!==false||test?.phaseFullSuite!==true||test?.waveFullSuite!==true){
    errors.push({code:'V4_TEST_CADENCE_INVALID',system:'test',message:'v4 automatic Test OS cadence must be wave/phase/release with per-task automatic verification disabled'});
  }
  const scope=test?.surfaceScope??{};
  const validScopeList=(value)=>Array.isArray(value)&&value.every((item)=>{
    const text=String(item??'').trim().replaceAll('\\\\','/');
    return Boolean(text)&&!/^\//.test(text)&&!text.split('/').includes('..');
  });
  if(!validScopeList(scope.includeRoots??[])||!validScopeList(scope.excludeRoots??[])){
    errors.push({code:'V4_TEST_SURFACE_SCOPE_INVALID',system:'test',message:'v4 Test OS surfaceScope includeRoots/excludeRoots must be safe project-relative path arrays'});
  }
  if(audit?.trigger!=='wave-phase-release')errors.push({code:'V4_AUDIT_CADENCE_INVALID',system:'audit',message:'v4 automatic Audit OS cadence must be wave/phase/release'});
  if(config?.documentation?.enabled!==true||config?.documentation?.requiredForRelease!==true){
    errors.push({code:'V4_DOCS_OS_REQUIRED',system:'docs',message:'v4 requires Documentation Fabric enabled and release-blocking; Docs OS may not be disabled through legacy documentation flags'});
  }
  if(config?.state?.enabled===false){
    errors.push({code:'V4_STATE_OS_REQUIRED',system:'state',message:'v4 State OS may not be disabled; live rehydration and lifecycle checkpoints are mandatory'});
  }
  const closure=config?.productClosure;
  if(closure?.enabled!==true||closure?.treatProjectAsSingleProduct!==true||closure?.autoCreateGapTasks!==true||closure?.autoCreateSystemFindingTasks!==true||!['HIGH','CRITICAL'].includes(String(closure?.systemFindingSeverity??'').toUpperCase())||closure?.runBeforeSelection!==true||closure?.runAfterIntegration!==true||closure?.closureRequiredBeforeNoActionableWork!==true){
    errors.push({code:'V4_PRODUCT_CLOSURE_POLICY_INVALID',system:'execution',message:'v4 requires whole-product closure plus automatic canonical tasking for blocking discovery and system findings'});
  }
  if(config?.operator?.targetedTaskVerification!==false||config?.operator?.fullCiCadence!=='wave-or-phase-boundary'){
    errors.push({code:'V4_OPERATOR_CADENCE_INVALID',message:'v4 operator cadence must defer automatic Test/Audit to wave/phase boundaries'});
  }
    const visual=policy.systems.visual;
  for(const key of ['requireResponsive','requireComponentSystem','requireDesignAuthority','requireRenderedReview','requireProductionShapedData','requireAccessibility','requireIndependentReview']){
    if(visual?.[key]!==true)errors.push({code:'V4_VISUAL_POLICY_WEAK',system:'visual',message:'Visual OS requires '+key});
  }
  if(visual?.profile!=='PREMIUM')errors.push({code:'V4_VISUAL_PROFILE_INVALID',system:'visual',message:'Visual OS profile must be PREMIUM'});
  const visualScope=visual?.surfaceScope??{};
  const validVisualScopeList=(value)=>Array.isArray(value)&&value.every((item)=>{
    const text=String(item??'').trim().replaceAll('\\\\','/');
    return Boolean(text)&&!/^\//.test(text)&&!text.split('/').includes('..');
  });
  if(!validVisualScopeList(visualScope.includeRoots??[])||!validVisualScopeList(visualScope.excludeRoots??[])){
    errors.push({code:'V4_VISUAL_SURFACE_SCOPE_INVALID',system:'visual',message:'v4 Visual OS surfaceScope includeRoots/excludeRoots must be safe project-relative path arrays'});
  }
  return {status:errors.length?'FAIL':policy.migrationRequired?'MIGRATION_REQUIRED':'PASS',policy,errors};
}
