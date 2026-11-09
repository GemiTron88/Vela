#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const errors = [];
const fail = (code, message) => errors.push({ code, message });
let config = null;
try { config = JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8')); } catch {}
const runtimePath = config?.installation?.runtimePath;
const isolated = ['.executionkit/runtime/kit', '.executionkit/runtime/AI-ExecutionKit'].includes(runtimePath);
if (runtimePath && !isolated) fail('V30_RUNTIME_PATH_INVALID','Unsupported installed runtime path');
const file = (rel) => path.join(root, isolated && /^(bin|lib|schemas|docs\/capabilities)\//.test(rel) ? `${runtimePath}/${rel}` : rel);
const exists = (rel) => fs.existsSync(file(rel)) && fs.statSync(file(rel)).isFile();
const read = (rel) => fs.readFileSync(file(rel), 'utf8');
const required = [
  'execution.config.json',
  'executionkit.scope.json',
  'executionkit.integration.json',
  'executionkit.adapters.json',
  'lib/parallel-execution.mjs',
  'bin/boost.mjs',
  'docs/executionkit/concurrency.md',
  'lib/agent-pulse.mjs',
  'lib/agent-inspection.mjs',
  'lib/telemetry-events.mjs',
  'lib/seo-model.mjs',
  'bin/mcp-server.mjs',
  'bin/doctor.mjs',
  'bin/antigravity-hook.mjs',
  'bin/validate-seo.mjs',
  'schemas/seo-contract.schema.json',
  'schemas/agent-telemetry.schema.json',
  'schemas/agent-telemetry-ack.schema.json',
  'lib/repository-intelligence.mjs',
  'lib/repository-source.mjs',
  'lib/repository-freshness.mjs',
  'lib/repository-context.mjs',
  'lib/repository-engineering-knowledge.mjs',
  'lib/repository-engineering-refresh.mjs',
  'schemas/repository-engineering-knowledge.schema.json',
  'lib/repository-external-knowledge.mjs',
  'schemas/repository-external-knowledge.schema.json',
  'lib/repository-benchmark-scenarios.mjs',
  'bin/benchmark-repository-intelligence-scenarios.mjs',
  'bin/benchmark-repository-intelligence.mjs',
  'bin/reconcile-agent-contract.mjs',
  'bin/repository-providers.mjs',
  'lib/agent-contract-compiler.mjs',
  'lib/repository-evaluation.mjs',
  'schemas/repository-intelligence-config.schema.json',
  'schemas/repository-provider.schema.json',
  'lib/repository-provider-deployment.mjs',
  'bin/setup-repository-provider-tooling.mjs',
  'lib/documentation-fabric.mjs',
  'bin/documentation-fabric.mjs',
  'contracts/documentation-fabric-contract.md',
  'lib/production-deployment.mjs',
  'lib/release-lifecycle.mjs',
  'bin/production-deployment.mjs',
  'bin/test-project.mjs',
  'bin/release-project.mjs',
  'contracts/production-deployment-contract.md',
  'lib/repository-providers.mjs',
  'lib/repository-provider-adapters.mjs',
  'lib/repository-knowledge-store.mjs',
  'lib/repository-intelligence-api.mjs',
  'bin/repository-intelligence.mjs',
  'bin/validate-repository-intelligence.mjs',
  'schemas/repository-knowledge-artifact.schema.json',
  'schemas/repository-source-pack.schema.json',
  'schemas/repository-freshness.schema.json',
  'schemas/repository-provider-status.schema.json',
  'docs/capabilities/seo-os.md',
  'docs/executionkit/executionkit-agent.md',
  'docs/executionkit/v3.0-scope.md',
  'docs/executionkit/v3-fleet-protocol.md',
  'docs/executionkit/v3-bootstrap-mode.md',
];
for (const rel of required) if (!exists(rel)) fail('V30_PROJECT_SURFACE_MISSING', rel);

try { config = JSON.parse(read('execution.config.json')); }
catch (error) { fail('V30_PROJECT_CONFIG_INVALID', error.message); }
if (config) {
  const runtime = config.runtime ?? {};
  const parallel = runtime.parallel ?? {};
  const boost = runtime.boost ?? {};
  if (runtime.mode !== 'DEPENDENCY_SAFE_PARALLEL') fail('V30_RUNTIME_MODE_INVALID', 'current v3 projects must use DEPENDENCY_SAFE_PARALLEL with deterministic sequential fallback');
  if (runtime.oneLifecycleActionAtATime !== false) fail('V30_RUNTIME_ACTION_POLICY_INVALID', 'dependency-safe parallel runtime requires oneLifecycleActionAtATime=false');
  if (parallel.enabled !== true || parallel.requireExplicitParallelSafe !== true || parallel.requireOwnership !== true || parallel.isolatedWorktrees !== true || parallel.sequentialFallback !== true || parallel.integrationOwner !== 'orchestrator') fail('V30_RUNTIME_PARALLEL_GUARDS_INVALID', 'parallel runtime must require explicit safety, ownership, isolation, orchestrator integration and sequential fallback');
  if (!Number.isInteger(parallel.maxConcurrentTasks) || parallel.maxConcurrentTasks < 1 || !Number.isInteger(parallel.maxAgentsPerTask) || parallel.maxAgentsPerTask < 1) fail('V30_RUNTIME_PARALLEL_CAP_INVALID', 'parallel runtime caps must be positive integers');
  if (boost.enabled !== true || boost.command !== '/boost' || boost.qualityGatesPreserved !== true || !Number.isInteger(boost.maxConcurrentTasks) || boost.maxConcurrentTasks < parallel.maxConcurrentTasks || !Number.isInteger(boost.maxAgentsPerTask) || boost.maxAgentsPerTask < parallel.maxAgentsPerTask) fail('V30_RUNTIME_BOOST_INVALID', '/boost must increase only safe concurrency while preserving quality gates');

  const manifestRel = config.agent?.manifestPath ?? '.agents/manifest.json';
  const manifestFull = path.resolve(root, manifestRel);
  if (!manifestFull.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(manifestFull) || !fs.statSync(manifestFull).isFile()) fail('V30_AGENT_MANIFEST_MISSING', `configured Agent manifest is unavailable: ${manifestRel}`);
  else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFull, 'utf8'));
      const delegation = manifest.delegation ?? {};
      if (delegation.mode !== 'DEPENDENCY_SAFE_PARALLEL' || delegation.oneLifecycleActionAtATime !== false) fail('V30_AGENT_DELEGATION_INVALID', 'Agent OS delegation must match dependency-safe parallel runtime');
      if (delegation.requireExplicitParallelSafe !== true || delegation.requireOwnership !== true || delegation.isolatedWorktrees !== true || delegation.sequentialFallback !== true || delegation.integrationOwner !== 'role.orchestrator' || delegation.boostCommand !== '/boost' || delegation.qualityGatesPreserved !== true) fail('V30_AGENT_PARALLEL_GUARDS_INVALID', 'Agent OS parallel delegation safeguards are incomplete');
      if (!(manifest.resources?.skills ?? []).some((item) => item?.id === 'skill.parallel-orchestration')) fail('V30_AGENT_PARALLEL_SKILL_MISSING', 'skill.parallel-orchestration must be registered');
    } catch (error) { fail('V30_AGENT_MANIFEST_INVALID', error.message); }
  }

  const operator = config.operator;
  if (!operator || typeof operator !== 'object') fail('V30_OPERATOR_POLICY_MISSING', 'operator policy is required for TODO-first project conformance');
  else {
    if (operator.entrypoint !== 'todo-first') fail('V30_OPERATOR_ENTRYPOINT_INVALID', 'operator.entrypoint must be todo-first');
    if (operator.additionalBootstrapPromptRequired !== false) fail('V30_OPERATOR_BOOTSTRAP_PROMPT_INVALID', 'the owner must not be required to provide an additional ExecutionKit bootstrap prompt');
    if (operator.hostChecklistMode !== 'derived-mirror') fail('V30_HOST_CHECKLIST_AUTHORITY_INVALID', 'host checklist must be a derived mirror, never task authority');
    if (operator.syncHostChecklistAfterTask !== true) fail('V30_HOST_CHECKLIST_SYNC_INVALID', 'supported host checklist must synchronize after canonical task changes/completion');
    if (operator.fullCiCadence !== 'phase-boundary') fail('V30_FULL_CI_CADENCE_INVALID', 'full self-hosted CI cadence must default to phase-boundary');
    if (operator.targetedTaskVerification !== true) fail('V30_TARGETED_TASK_VERIFICATION_INVALID', 'task-targeted verification must remain enabled');
    if (operator.hostPersistenceAuthority !== 'none') fail('V30_HOST_PERSISTENCE_AUTHORITY_INVALID', 'host persistence such as /goal must not become task authority');
  }

  const discovery = config.discovery;
  if (!discovery || typeof discovery !== 'object') fail('V30_DISCOVERY_POLICY_MISSING', 'current v3 projects must explicitly configure product discovery/scope reconciliation');
  else {
    if (discovery.enabled !== true) fail('V30_DISCOVERY_DISABLED', 'current v3 projects require discovery.enabled=true');
    if (discovery.failOnDeclaredMissing !== true) fail('V30_DISCOVERY_NOT_FAIL_CLOSED', 'declared product scope must fail closed when implementation is missing');
    if (!String(discovery.scopePath ?? '').trim()) fail('V30_DISCOVERY_SCOPE_MISSING', 'discovery.scopePath is required');
  }

  const evidence = config.evidence;
  if (!evidence || typeof evidence !== 'object') fail('V30_EVIDENCE_POLICY_MISSING', 'current v3 projects must explicitly configure strict candidate-bound evidence');
  else {
    if (evidence.releaseTruthMode !== 'STRICT') fail('V30_EVIDENCE_TRUTH_MODE_INVALID', 'evidence.releaseTruthMode must be STRICT');
    if (evidence.candidateRequiredForRelease !== true) fail('V30_CANDIDATE_RELEASE_PROOF_DISABLED', 'exact candidate identity is required for release');
    if (evidence.requireTestAdequacy !== true) fail('V30_TEST_ADEQUACY_DISABLED', 'test adequacy must be required for release');
    if (!String(evidence.adapterConfigPath ?? '').trim()) fail('V30_EVIDENCE_ADAPTER_PATH_MISSING', 'evidence.adapterConfigPath is required');
    if (!Array.isArray(evidence.requiredProducers)) fail('V30_EVIDENCE_PRODUCERS_INVALID', 'evidence.requiredProducers must be an array');
  }

  const integration = config.integration;
  if (!integration || typeof integration !== 'object') fail('V30_REALITY_POLICY_MISSING', 'current v3 projects must explicitly configure phase/journey/system convergence');
  else {
    if (integration.requirePhaseConvergenceForClosure !== true) fail('V30_PHASE_CONVERGENCE_DISABLED', 'phase convergence must be required');
    if (integration.requireCriticalJourneysForRelease !== true) fail('V30_CRITICAL_JOURNEYS_DISABLED', 'critical journeys must be required for release');
    if (integration.requireJourneyDenominator !== true) fail('V30_JOURNEY_DENOMINATOR_DISABLED', 'critical journey denominator must be required');
    if (integration.requireSystemReleaseGate !== true) fail('V30_SYSTEM_RELEASE_GATE_DISABLED', 'whole-system release convergence must be required');
    if (!String(integration.systemReleaseGateTaskId ?? '').trim()) fail('V30_SYSTEM_RELEASE_GATE_ID_MISSING', 'integration.systemReleaseGateTaskId is required');
    if (!String(integration.journeyContractPath ?? '').trim()) fail('V30_JOURNEY_CONTRACT_PATH_MISSING', 'integration.journeyContractPath is required');
  }

  const launchEnabled = config.capabilities?.launch && config.capabilities.launch !== 'NONE';
  if (config.projectState === 'ACTIVE' && launchEnabled) {
    if (!Array.isArray(evidence?.requiredProducers) || evidence.requiredProducers.length === 0) fail('V30_ACTIVE_RELEASE_PRODUCERS_MISSING', 'ACTIVE launch-capable projects require at least one trusted release evidence producer');
    if (!String(evidence?.testReportPath ?? '').trim()) fail('V30_ACTIVE_TEST_REPORT_MISSING', 'ACTIVE launch-capable projects require a concrete testReportPath');
    try {
      const contractRel=String(integration?.journeyContractPath ?? 'executionkit.integration.json').trim();
      const contract=JSON.parse(fs.readFileSync(path.join(root,contractRel),'utf8'));
      if (contract.applicability === 'UNRESOLVED') fail('V30_ACTIVE_JOURNEY_APPLICABILITY_UNRESOLVED', 'ACTIVE launch-capable projects must resolve critical-journey applicability');
      if (contract.applicability === 'NOT_APPLICABLE' && integration?.allowNotApplicableForRelease !== true) fail('V30_ACTIVE_JOURNEY_NA_UNAUTHORIZED', 'NOT_APPLICABLE critical journeys require an explicit authorized exception');
      if (contract.applicability === 'REQUIRED' && (!Array.isArray(contract.journeys) || contract.journeys.length === 0)) fail('V30_ACTIVE_JOURNEYS_MISSING', 'REQUIRED integration contract must declare critical journeys');
    } catch (error) {
      if (error instanceof SyntaxError || error?.code === 'ENOENT') fail('V30_JOURNEY_CONTRACT_INVALID', error.message);
      else if (!String(error?.message ?? '').startsWith('current v3')) fail('V30_JOURNEY_CONTRACT_INVALID', error.message);
    }
    try {
      const adapterRel=String(evidence?.adapterConfigPath ?? 'executionkit.adapters.json').trim();
      const adapterConfig=JSON.parse(fs.readFileSync(path.join(root,adapterRel),'utf8'));
      const configured=adapterConfig?.adapters ?? {};
      for (const producer of evidence?.requiredProducers ?? []) if (!configured[producer] || configured[producer].kind !== 'evidence') fail('V30_REQUIRED_PRODUCER_UNCONFIGURED', `required producer ${producer} is not a configured evidence adapter`);
      if(config.capabilities?.audit==='FULL'){
        // Premium rendered-quality execution is a release-bound Audit OS concern.
        // ACTIVE validates the control-plane contracts; release Audit requires and executes
        // the candidate-bound evidenceType=quality producer when Premium is applicable.
        const domainAudits=Object.entries(configured).filter(([,adapter])=>adapter?.kind==='audit');
        if(domainAudits.length===0) fail('V30_FULL_AUDIT_DOMAIN_ADAPTERS_UNCONFIGURED','Audit OS FULL requires at least one kind=audit project-domain adapter');
        for(const [id,adapter] of domainAudits){
          if(typeof adapter.command!=='string'||!adapter.command.trim()) fail('V30_FULL_AUDIT_DOMAIN_COMMAND_MISSING',`Audit adapter ${id} requires command`);
          if(!Array.isArray(adapter.domains)||adapter.domains.length===0) fail('V30_FULL_AUDIT_DOMAIN_SCOPE_MISSING',`Audit adapter ${id} requires domains[]`);
        }
        if(!Array.isArray(configured.security?.commands)||configured.security.commands.length===0) fail('V30_FULL_AUDIT_SECURITY_UNCONFIGURED','Audit OS FULL requires adapters.security.commands');
        if(config.distributionRepository!==true && (!Array.isArray(configured['runtime-health']?.checks)||configured['runtime-health'].checks.length===0)) fail('V30_FULL_AUDIT_RUNTIME_UNCONFIGURED','Audit OS FULL requires adapters.runtime-health.checks');
      }
    } catch (error) {
      if (error instanceof SyntaxError || error?.code === 'ENOENT') fail('V30_EVIDENCE_ADAPTER_CONFIG_INVALID', error.message);
    }
  }

  const seoLevel = config.capabilities?.seo;
  if (!['NONE','LITE','STANDARD','FULL'].includes(seoLevel)) fail('V30_SEO_CAPABILITY_MISSING', 'current v3 projects must explicitly declare capabilities.seo as NONE|LITE|STANDARD|FULL');
  if (!config.seo || typeof config.seo !== 'object') fail('V30_SEO_CONFIG_MISSING', 'current v3 projects must explicitly declare seo configuration');
  else {
    if (!String(config.seo.contractPath ?? '').trim()) fail('V30_SEO_CONTRACT_PATH_MISSING', 'seo.contractPath must be explicit');
    if (typeof config.seo.requiredForRelease !== 'boolean') fail('V30_SEO_RELEASE_POLICY_MISSING', 'seo.requiredForRelease must be explicit');
    if (seoLevel && seoLevel !== 'NONE' && config.seo.requiredForRelease !== true) fail('V30_SEO_RELEASE_BYPASS', 'enabled SEO capability requires seo.requiredForRelease=true');
    const contractRel = String(config.seo.contractPath ?? '').trim();
    if (seoLevel && seoLevel !== 'NONE' && contractRel && !exists(contractRel)) fail('V30_SEO_CONTRACT_MISSING', `enabled SEO capability requires ${contractRel}`);
  }

  const documentation=config.documentation;
  if(!documentation||typeof documentation!=='object') fail('V30_DOCUMENTATION_CONFIG_MISSING','current v3 projects must declare executable documentation configuration');
  else {
    if(documentation.enabled!==true) fail('V30_DOCUMENTATION_DISABLED','Documentation Fabric must be enabled for managed v3 projects');
    if(!String(documentation.outputRoot??'').startsWith('docs/')) fail('V30_DOCUMENTATION_OUTPUT_INVALID','documentation.outputRoot must be a project docs path');
    if(!String(documentation.registryPath??'').startsWith('.executionkit/')) fail('V30_DOCUMENTATION_REGISTRY_INVALID','documentation.registryPath must stay under .executionkit/');
    if(!Number.isInteger(documentation.minimumCoveragePercent)||documentation.minimumCoveragePercent<1||documentation.minimumCoveragePercent>100) fail('V30_DOCUMENTATION_COVERAGE_INVALID','documentation.minimumCoveragePercent must be 1..100');
  }

  const deployment=config.deployment;
  if(!deployment||typeof deployment!=='object') fail('V30_DEPLOYMENT_CONFIG_MISSING','current v3 projects must declare Production Deployment Fabric configuration');
  else {
    if(deployment.enabled!==true) fail('V30_DEPLOYMENT_DISABLED','Production Deployment Fabric must be enabled for managed v3 projects');
    if(!String(deployment.artifactRoot??'').startsWith('.executionkit/')) fail('V30_DEPLOYMENT_ARTIFACT_ROOT_INVALID','deployment.artifactRoot must stay under .executionkit/');
    if(deployment.requireCleanGit!==true) fail('V30_DEPLOYMENT_CLEAN_GIT_REQUIRED','deployment.requireCleanGit must be true');
    if(!deployment.target||!['UNCONFIGURED','local-release-root'].includes(deployment.target.type)) fail('V30_DEPLOYMENT_TARGET_INVALID','deployment target type is invalid');
    if(config.projectState==='ACTIVE' && launchEnabled && config.distributionRepository!==true){
      if(deployment.requiredForRelease!==true) fail('V30_DEPLOYMENT_RELEASE_BYPASS','ACTIVE launch-capable projects must require Production Deployment Fabric for release');
      // Production target, smoke commands and health URL are intentionally validated by
      // release/readiness, not project activation. This keeps local/control-plane activation
      // independent from production access while remaining fail-closed at release time.
    }
  }

  const ri = config.repositoryIntelligence;
  if (!ri || typeof ri !== 'object') fail('V30_REPOSITORY_INTELLIGENCE_CONFIG_MISSING','current v3 projects must declare repositoryIntelligence configuration');
  else {
    if (ri.enabled !== true) fail('V30_REPOSITORY_INTELLIGENCE_DISABLED','current managed v3 projects must enable Repository Intelligence');
    if (ri.privacy?.allowSourceEgress !== false) fail('V30_REPOSITORY_SOURCE_EGRESS_UNSAFE','repositoryIntelligence.privacy.allowSourceEgress must default false');
    if (ri.privacy?.includeSecretSensitivePaths !== false) fail('V30_REPOSITORY_SECRET_PATHS_UNSAFE','repositoryIntelligence.privacy.includeSecretSensitivePaths must be false');
    if (!String(ri.storage?.portableRoot ?? '').startsWith('.executionkit/')) fail('V30_REPOSITORY_PORTABLE_STORAGE_INVALID','Repository Intelligence portable storage must remain under .executionkit/');
    if (!String(ri.storage?.localRoot ?? '').startsWith('.executionkit/')) fail('V30_REPOSITORY_LOCAL_STORAGE_INVALID','Repository Intelligence local storage must remain under .executionkit/');
    if (!Array.isArray(ri.providers?.required) || !Array.isArray(ri.providers?.optional)) fail('V30_REPOSITORY_PROVIDER_POLICY_MISSING','Repository Intelligence required/optional provider policy must be explicit');
    if (!Array.isArray(ri.ingestion?.paths) || !Number.isInteger(ri.ingestion?.maxFileBytes) || !Number.isInteger(ri.ingestion?.maxTotalBytes)) fail('V30_REPOSITORY_INGESTION_POLICY_MISSING','Repository Intelligence bounded ingestion policy must be explicit');
    for (const key of ['contextPath','engineeringPath','externalKnowledgePath']) if (!String(ri.storage?.[key] ?? '').startsWith('.executionkit/knowledge/')) fail('V30_REPOSITORY_KNOWLEDGE_PATH_INVALID',`repositoryIntelligence.storage.${key} must remain under .executionkit/knowledge/`);
  }

  const fleet = config.fleet;
  if (fleet?.enabled !== true) fail('V30_FLEET_DISABLED', 'fleet.enabled must be true for current v3 managed projects');
  if (fleet?.agentMode !== 'per-device') fail('V30_AGENT_SCOPE_INVALID', 'fleet.agentMode must be per-device');
  if (fleet?.hostActivity !== 'local-pulse') fail('V30_HOST_ACTIVITY_INVALID', 'fleet.hostActivity must be local-pulse');
  if (fleet?.remoteControl !== 'disabled') fail('V30_REMOTE_CONTROL_NOT_READ_ONLY', 'ExecutionKit 3.0 protocol v1 requires fleet.remoteControl=disabled; typed commands are a later separately versioned capability');
  const telemetry = fleet?.telemetry;
  if (telemetry?.transport !== 'local-agent') fail('V30_TRANSPORT_INVALID', 'fleet.telemetry.transport must be local-agent');
  if (telemetry?.authority !== 'observational') fail('V30_AUTHORITY_INVALID', 'fleet telemetry must remain observational');
  if (telemetry?.uploadTodoContent !== false) fail('V30_TODO_UPLOAD_FORBIDDEN', 'routine TODO content upload must be false');
  if (telemetry?.uploadSourceContent !== false) fail('V30_SOURCE_UPLOAD_FORBIDDEN', 'routine source upload must be false');
  if (typeof telemetry?.shareLocalPaths !== 'boolean') fail('V30_PATH_PRIVACY_MISSING', 'shareLocalPaths must be explicit');
}

if (exists('lib/agent-inspection.mjs') && read('lib/agent-inspection.mjs').includes("from './executionkit-agent.mjs'")) {
  fail('V30_PROJECT_DAEMON_DEPENDENCY', 'project-side inspection must not depend on the per-device daemon core');
}
if (exists('lib/agent-pulse.mjs')) {
  const pulse = read('lib/agent-pulse.mjs');
  if (!pulse.includes("DEFAULT_AGENT_PULSE_HOST = '127.0.0.1'")) fail('V30_PULSE_NOT_LOCALHOST', 'Agent pulse sender must be pinned to 127.0.0.1');
  if (pulse.includes('EXECUTIONKIT_AGENT_HOST')) fail('V30_PULSE_HOST_OVERRIDE_FORBIDDEN', 'Agent pulse host must not be environment-configurable');
}
if (exists('bin/antigravity-hook.mjs') && !read('bin/antigravity-hook.mjs').includes('emitAgentPulse')) {
  fail('V30_ANTIGRAVITY_PULSE_MISSING', 'Antigravity hook is not wired to the localhost Agent pulse');
}
if (exists('bin/mcp-server.mjs')) {
  const mcp = read('bin/mcp-server.mjs');
  for (const marker of ['executionkit_agent_status','executionkit_fleet_status','executionkit_seo_status','executionkit_seo_validate','executionkit_knowledge_status','executionkit_knowledge_context','executionkit_knowledge_freshness','executionkit_knowledge_search','executionkit_source_read','executionkit_symbol_query','executionkit_change_impact','executionkit_knowledge_refresh','executionkit_relationship_index','executionkit_relationship_query','executionkit_provider_pack','executionkit_terrain_read','executionkit_engineering_knowledge','executionkit_engineering_knowledge_refresh','executionkit_engineering_knowledge_stored','executionkit_external_knowledge_ingest','executionkit_external_knowledge_stored','executionkit_external_knowledge_search','executionkit_repository_providers']) {
    if (!mcp.includes(marker)) fail('V30_MCP_SURFACE_MISSING', marker);
  }
}
if (exists('lib/telemetry-events.mjs')) {
  const telemetry = read('lib/telemetry-events.mjs');
  for (const marker of ['sanitizeTelemetryValue','emitSystemEvent']) {
    if (!telemetry.includes(marker)) fail('V30_EVENT_SINK_INVALID', marker);
  }
}
for (const rel of ['schemas/seo-contract.schema.json','schemas/agent-telemetry.schema.json','schemas/agent-telemetry-ack.schema.json']) {
  if (!exists(rel)) continue;
  try { JSON.parse(read(rel)); } catch (error) { fail('V30_SCHEMA_INVALID', `${rel}: ${error.message}`); }
}
if (exists('docs/executionkit/v3-bootstrap-mode.md')) {
  const bootstrap = read('docs/executionkit/v3-bootstrap-mode.md');
  for (const marker of ['External fleet observability is never a prerequisite','NOT_CONFIGURED','Elmasna3 dogfood bootstrap']) {
    if (!bootstrap.includes(marker)) fail('V30_BOOTSTRAP_CONTRACT_INVALID', marker);
  }
}

const result = {
  schemaVersion:'executionkit-v30-project-policy/v2',
  status:errors.length ? 'FAIL' : 'PASS',
  ok:errors.length === 0,
  authority:config?.todoPath ?? 'TODO.md',
  operatorEntry:config?.operator?.entrypoint ?? 'MISSING',
  hostChecklistAuthority:config?.operator?.hostChecklistMode ?? 'MISSING',
  fullCiCadence:config?.operator?.fullCiCadence ?? 'MISSING',
  seoCapability:config?.capabilities?.seo ?? 'MISSING',
  seoReleaseGate:config?.seo?.requiredForRelease ?? 'MISSING',
  fleetAuthority:'OBSERVATIONAL_ONLY',
  daemonScope:'PER_DEVICE_NOT_PROJECT',
  remoteControl:'DISABLED_PROTOCOL_V1',
  runtimeProof:'NOT_EVALUATED',
  errors,
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
