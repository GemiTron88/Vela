#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [], warnings = [];
const fail = (code, message) => errors.push({ code, message });
const full = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(full(rel));
const read = (rel) => fs.readFileSync(full(rel), 'utf8');
const parse = (rel) => JSON.parse(read(rel));
function walk(dir, prefix = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name, abs = path.join(dir, entry.name);
    out.push({ rel, abs, entry });
    if (entry.isDirectory()) out.push(...walk(abs, rel));
  }
  return out;
}
function runNode(rel, args = []) {
  return spawnSync(process.execPath, [full(rel), ...args], { cwd:root, encoding:'utf8', timeout:120000, maxBuffer:32 * 1024 * 1024, windowsHide:true });
}
function requireTokens(rel, tokens, code) {
  const text = exists(rel) ? read(rel) : '';
  for (const token of tokens) if (!text.includes(token)) fail(code, `${rel}: ${token}`);
}

let version = '';
try { version = read('VERSION').trim(); } catch (error) { fail('VERSION_MISSING', error.message); }
const isV5=/^5\.\d+\.\d+(?:-dev)?$/.test(version);
if (version && !isV5 && !/^\d+\.\d+\.\d+$/.test(version)) fail('VERSION_INVALID', version);
if (version && !isV5 && !/^(?:2\.2\.\d+|3\.0\.\d+|4\.\d+\.\d+)$/.test(version)) fail('SUPPORTED_STANDARD_VERSION_REQUIRED', `Expected stable 2.2.x, 3.0.x, 4.x or 5.x, got ${version}`);
const isV4 = isV5 || /^4\.\d+\.\d+$/.test(version);
const v3Published = isV5 || /^(?:3\.0\.\d+|4\.\d+\.\d+)$/.test(version);
const expectedCompatVersion = isV4 ? '3.0.0' : version;

const maturityProfilePaths = [
  'docs/adoption/deep-integration-profiles/README.md','docs/adoption/deep-integration-profiles/M0_PLANNING_ONLY.md','docs/adoption/deep-integration-profiles/M1_EARLY_IMPLEMENTATION.md',
  'docs/adoption/deep-integration-profiles/M2_ACTIVE_DEVELOPMENT.md','docs/adoption/deep-integration-profiles/M3_NEAR_COMPLETE.md','docs/adoption/deep-integration-profiles/M4_PRODUCTION.md','docs/adoption/deep-integration-profiles/ADOPTION_DECISION_TEMPLATE.md',
];
const v3Required = [
  'STANDARD_V3.md','lib/executionkit-agent.mjs','lib/executionkit-agent-v3.mjs','lib/repository-identity.mjs','lib/agent-pulse.mjs','lib/agent-inspection.mjs','lib/telemetry-events.mjs',
  'bin/executionkit-agent.mjs','bin/agent-doctor.mjs','bin/validate-v30-policy.mjs','bin/validate-v30-project.mjs','bin/validate-v30-docs.mjs','bin/migrate-v3.mjs',
  'schemas/agent-telemetry.schema.json','schemas/agent-telemetry-ack.schema.json',
  'docs/architecture/executionkit-agent.md','docs/architecture/v3.0-scope.md','docs/architecture/v3-fleet-protocol.md','docs/architecture/v3-bootstrap-mode.md','docs/operations/v3-release-validation.md',
  'tests/v30-agent.test.mjs','tests/v30-bootstrap-mode.test.mjs','tests/v30-protocol.test.mjs',
];
const coreRequired = [
  'bin/executionkit.mjs','lib/installer.mjs','tests/installer.test.mjs','docs/adoption/installer.md',
  '.gitignore','VERSION','package.json','STANDARD.md','README.md','CHANGELOG.md','AGENTS.md','PLAYBOOK.md','execution.config.json','executionkit.scope.json','executionkit.integration.json','executionkit.adapters.json',
  '.github/workflows/execution-integrity.yml','templates/execution-integrity.yml',
  'templates/AGENTS.md','templates/TODO.md','templates/TODO_ARCHIVE.md','templates/PHASE.md','templates/EXECUTION_OS.md','templates/AGENT_OS.md','templates/CONTENT_OS.md','templates/AUDIT_OS.md','templates/TEST_OS.md','templates/LAUNCH_OS.md','templates/STATE_OS.md','templates/execution.config.json','templates/executionkit.adapters.json','templates/executionkit.scope.json','templates/executionkit.integration.json','templates/executionkit.components.json','templates/executionkit.design.json','templates/executionkit.gitignore','templates/quality.contract.json','templates/.agents/manifest.json','templates/.agents/rules/delegation.md','templates/.agents/skills/state-rehydration/SKILL.md',
  'schemas/execution-config.schema.json','schemas/agent-manifest.schema.json','schemas/task-projection.schema.json','schemas/quality-contract.schema.json','schemas/quality-evidence.schema.json','schemas/adapter-config.schema.json','schemas/product-scope.schema.json','schemas/integration-contract.schema.json','schemas/component-contract.schema.json','schemas/design-contract.schema.json','schemas/candidate-envelope.schema.json','schemas/evidence-report.schema.json','schemas/discovery-inventory.schema.json',
  'lib/execution-model.mjs','lib/todo-shards.mjs','lib/integration-model.mjs','lib/revalidation-model.mjs','lib/adoption-model.mjs','lib/readiness-model.mjs','lib/agent-model.mjs','lib/state-model.mjs','lib/quality-model.mjs','lib/antigravity.mjs','lib/adapter-registry.mjs','lib/runtime-orchestrator.mjs','lib/discovery-model.mjs','lib/evidence-model.mjs','lib/test-evidence.mjs','lib/external-adapters.mjs','lib/component-model.mjs','lib/content-model.mjs','lib/impact-model.mjs','lib/tooling-loader.mjs','lib/derived-state.mjs','lib/fleet-model.mjs',
  'bin/init-project.mjs','bin/run-installer-blackbox-evidence.mjs','bin/run-parallel-blackbox-evidence.mjs','bin/run-live-bootstrap-blackbox-evidence.mjs','bin/run-reality-blackbox-evidence.mjs','bin/adopt-project.mjs','bin/migrate-v2.mjs','bin/migrate-v2-base.mjs','bin/migrate-current.mjs','bin/migrate-state-os.mjs','bin/validate-execution.mjs','bin/validate-integration.mjs','bin/analyze-revalidation.mjs','bin/validate-deep-integration.mjs','bin/next-readiness.mjs','bin/validate-agents.mjs','bin/validate-state.mjs','bin/state-status.mjs','bin/state-checkpoint.mjs','bin/state-rehydrate.mjs','bin/state-amnesia-test.mjs','bin/state-memory-envelope.mjs','bin/validate-ci-policy.mjs','bin/validate-v22-policy.mjs','bin/validate-canonical-docs.mjs','bin/validate-state-distribution.mjs','bin/run-tests.mjs','bin/write-validation-evidence.mjs','bin/validate-distribution.mjs','bin/release-readiness.mjs','bin/doctor.mjs','bin/setup-tooling.mjs',
  'tests/test-baseline.json','tests/integration-reality.test.mjs','tests/revalidation.test.mjs','tests/state-os.test.mjs','tests/deep-integration.test.mjs','docs/architecture/reality-closure.md','tests/distribution-hardening.test.mjs','docs/architecture/state-os.md','docs/adoption/deep-integration.md','docs/adoption/universal-adoption.md',...maturityProfilePaths,'docs/architecture/v2.2-scope.md','docs/architecture/concurrency.md','docs/integrations/antigravity.md','plugins/antigravity-executionkit/skills/ek-state/SKILL.md',
  ...v3Required,
];
for (const rel of coreRequired) if (!exists(rel)) fail('DISTRIBUTION_COMPONENT_MISSING', rel);

// Historical v2.2.0 scope remains exactly 34 additions. V3 extends it; it does not rewrite history.
const additions = [
 ['01 Dependency-safe Parallel Agent Runtime Orchestrator',['lib/runtime-orchestrator.mjs','lib/parallel-execution.mjs','bin/coordinate-agents.mjs','bin/boost.mjs']],['02 Runtime checkpoints/handoff/recovery',['bin/runtime-status.mjs','bin/runtime-recover.mjs','bin/runtime-cancel.mjs']],['03 Product Discovery Engine',['lib/discovery-model.mjs','bin/discover-product.mjs']],['04 Coverage Reconciliation Engine',['bin/reconcile-product.mjs']],['05 Adapter Registry',['lib/adapter-registry.mjs','templates/executionkit.adapters.json']],['06 Trusted Evidence Engine',['lib/evidence-model.mjs','bin/collect-evidence.mjs']],['07 Candidate Identity',['bin/build-candidate.mjs','bin/validate-candidate.mjs','schemas/candidate-envelope.schema.json']],['08 Evidence Graph',['bin/build-evidence-graph.mjs']],['09 Coverage Graph',['bin/build-coverage-graph.mjs']],['10 Test Adequacy Engine',['lib/test-evidence.mjs','bin/validate-test-evidence.mjs']],['11 Browser Quality Adapter',['bin/validate-browser-quality.mjs']],['12 SEO Performance Adapter',['bin/validate-seo-performance.mjs']],['13 Flutter Quality Adapter',['bin/validate-flutter-quality.mjs']],['14 ExecutionKit MCP Server',['bin/mcp-server.mjs','lib/tooling-loader.mjs']],['15 Deep Antigravity Plugin',['plugins/antigravity-executionkit/plugin.json','plugins/antigravity-executionkit/mcp_config.json','plugins/antigravity-executionkit/hooks.json','bin/integrate-antigravity.mjs']],['16 Workflow-to-Skills Export',['bin/export-workflows-as-skills.mjs']],['17 Premium Component Contract Engine',['lib/component-model.mjs','bin/discover-components.mjs','bin/validate-component-system.mjs','schemas/component-contract.schema.json']],['18 Design Drift Detector',['bin/validate-design-tokens.mjs','bin/validate-design-drift.mjs','schemas/design-contract.schema.json']],['19 Content Discovery/Depth',['lib/content-model.mjs','bin/discover-content.mjs','bin/validate-content-depth.mjs']],['20 Change Impact Analyzer',['lib/impact-model.mjs','bin/analyze-impact.mjs']],['21 Smart Test Selector',['bin/select-tests.mjs']],['22 Flake Intelligence',['bin/analyze-flakes.mjs']],['23 Laravel Boost Adapter',['bin/adapter-laravel-boost.mjs','.skill:skill.laravel']],['24 Dart Flutter MCP Adapter',['bin/adapter-dart-mcp.mjs']],['25 Security Adapter Pack',['bin/validate-security.mjs','.skill:skill.security-review']],['26 Data Migration Safety Adapter',['bin/validate-data-safety.mjs','.skill:skill.data-migration']],['27 Offline Sync Skill Pack',['.skill:skill.flutter']],['28 Money Integrity Skill Pack',['.skill:skill.data-migration']],['29 Authorization Boundaries Skill Pack',['.skill:skill.security-review']],['30 Observability/Production Health',['bin/validate-runtime-health.mjs','.skill:skill.release-health']],['31 Fleet Manager',['lib/fleet-model.mjs','bin/fleet-audit.mjs','bin/fleet-plan-upgrade.mjs','bin/fleet-report.mjs']],['32 Doctor 2',['bin/doctor.mjs']],['33 Expanded Specialist Skills Registry',['templates/.agents/manifest.json']],['34 Autonomous Closure Loop',['bin/execute-loop.mjs']]
];
if (additions.length !== 34) fail('V22_SCOPE_COUNT_DRIFT', String(additions.length));

let manifest=null, rootConfig=null, templateConfig=null, pkg=null, baseline=null, schema=null;
try { manifest=parse('templates/.agents/manifest.json'); } catch(error){ fail('TEMPLATE_MANIFEST_PARSE',error.message); }
try { rootConfig=parse('execution.config.json'); } catch(error){ fail('ROOT_CONFIG_PARSE',error.message); }
try { templateConfig=parse('templates/execution.config.json'); } catch(error){ fail('TEMPLATE_CONFIG_PARSE',error.message); }
try { pkg=parse('package.json'); } catch(error){ fail('PACKAGE_PARSE',error.message); }
try { baseline=parse('tests/test-baseline.json'); } catch(error){ fail('TEST_BASELINE_PARSE',error.message); }
try { schema=parse('schemas/execution-config.schema.json'); } catch(error){ fail('EXECUTION_SCHEMA_PARSE',error.message); }
const skillIds=new Set((manifest?.resources?.skills??[]).map((item)=>item.id));
for (const [name,surfaces] of additions) for (const surface of surfaces) {
  if (surface.startsWith('.skill:')) { const id=surface.slice(7); if(!skillIds.has(id)) fail('V22_ADDITION_SKILL_MISSING',`${name}: ${id}`); }
  else if(!exists(surface)) fail('V22_ADDITION_SURFACE_MISSING',`${name}: ${surface}`);
}
const validState=(cfg)=>cfg?.state?.enabled===true&&typeof cfg.state.snapshotPath==='string'&&cfg.state.snapshotPath.startsWith('.executionkit/')&&typeof cfg.state.journalPath==='string'&&cfg.state.journalPath.startsWith('.executionkit/')&&cfg.state.requireRehydrateOnDrift===true&&Number.isInteger(cfg.state.heartbeatMinutes)&&cfg.state.heartbeatMinutes>=5&&cfg.state.heartbeatMinutes<=240&&cfg.state.memory?.authority==='advisory'&&cfg.state.memory?.requireLiveRevalidation===true&&cfg.state.memory?.allowTaskState===false;
const validFleet=(cfg)=>cfg?.fleet?.enabled===true&&cfg.fleet.agentMode==='per-device'&&cfg.fleet.hostActivity==='local-pulse'&&cfg.fleet.remoteControl==='disabled'&&cfg.fleet.telemetry?.transport==='local-agent'&&cfg.fleet.telemetry?.authority==='observational'&&cfg.fleet.telemetry?.uploadTodoContent===false&&cfg.fleet.telemetry?.uploadSourceContent===false&&typeof cfg.fleet.telemetry?.shareLocalPaths==='boolean';
const validReality=(cfg)=>cfg?.integration?.requirePhaseConvergenceForClosure===true&&Number.isInteger(cfg.integration.minTasksForPhaseGate)&&cfg.integration.minTasksForPhaseGate>=1&&typeof cfg.integration.journeyContractPath==='string'&&cfg.integration.journeyContractPath.length>0&&cfg.integration.requireCriticalJourneysForRelease===true&&cfg.integration.requireJourneyDenominator===true&&cfg.integration.requireSystemReleaseGate===true&&typeof cfg.integration.systemReleaseGateTaskId==='string'&&cfg.integration.systemReleaseGateTaskId.length>0&&cfg.integration.allowNotApplicableForRelease===false&&cfg?.evidence?.releaseTruthMode==='STRICT'&&cfg.evidence.candidateRequiredForRelease===true&&cfg.evidence.requireTestAdequacy===true;
if(rootConfig?.distributionRepository!==true) fail('DISTRIBUTION_REPOSITORY_MARKER_MISSING','execution.config.json');
for(const [label,cfg] of [['root',rootConfig],['template',templateConfig]]){
  if(cfg?.standardVersion!==expectedCompatVersion) fail('VERSION_SURFACE_MISMATCH',`${label} config ${cfg?.standardVersion??'MISSING'} != ${expectedCompatVersion}`);
  const runtime=cfg?.runtime??{}, parallel=runtime.parallel??{}, boost=runtime.boost??{};
  if(runtime.mode!=='DEPENDENCY_SAFE_PARALLEL'||runtime.oneLifecycleActionAtATime!==false) fail('RUNTIME_NOT_DEPENDENCY_SAFE_PARALLEL',label);
  if(parallel.enabled!==true||parallel.requireExplicitParallelSafe!==true||parallel.requireOwnership!==true||parallel.isolatedWorktrees!==true||parallel.sequentialFallback!==true||parallel.integrationOwner!=='orchestrator') fail('RUNTIME_PARALLEL_GUARDS_INVALID',label);
  if(!Number.isInteger(parallel.maxConcurrentTasks)||parallel.maxConcurrentTasks<1||!Number.isInteger(parallel.maxAgentsPerTask)||parallel.maxAgentsPerTask<1) fail('RUNTIME_PARALLEL_CAPS_INVALID',label);
  if(boost.enabled!==true||boost.command!=='/boost'||boost.qualityGatesPreserved!==true||!Number.isInteger(boost.maxConcurrentTasks)||boost.maxConcurrentTasks<parallel.maxConcurrentTasks||!Number.isInteger(boost.maxAgentsPerTask)||boost.maxAgentsPerTask<parallel.maxAgentsPerTask) fail('RUNTIME_BOOST_POLICY_INVALID',label);
  if(!validState(cfg)) fail('STATE_POLICY_INVALID',label);
  if(!validFleet(cfg)) fail('V30_FLEET_POLICY_INVALID',label);
  if(cfg?.discovery?.failOnDeclaredMissing!==true) fail('DISCOVERY_NOT_FAIL_CLOSED',label);
  if(!validReality(cfg)) fail('REALITY_CLOSURE_POLICY_INVALID',label);
}
const adoption=templateConfig?.adoption??{};
if(adoption.deepIntegrationRequired!==true) fail('TEMPLATE_DEEP_INTEGRATION_DISABLED','templates/execution.config.json');
if(adoption.integrationPhase!=='EK00'||adoption.integrationGateTaskId!=='EK00-AUDIT'||adoption.productExecutionBlockedUntilGateAccepted!==true) fail('TEMPLATE_DEEP_INTEGRATION_GUARD','EK00 gate contract invalid');
if(pkg?.version!==version) fail('PACKAGE_VERSION_MISMATCH',`${pkg?.version} != ${version}`);
const runtimeVersion=exists('lib/execution-model.mjs')?read('lib/execution-model.mjs').match(/standardVersion:\s*['"]([^'"]+)['"]/i)?.[1]:null;
if(runtimeVersion!==expectedCompatVersion) fail('RUNTIME_DEFAULT_VERSION_MISMATCH',`${runtimeVersion??'MISSING'} != ${expectedCompatVersion}`);
const executionModelText=read('lib/execution-model.mjs');
for(const token of ["mode: 'DEPENDENCY_SAFE_PARALLEL'","isolatedWorktrees: true","integrationOwner: 'orchestrator'","command: '/boost'"]) if(!executionModelText.includes(token)) fail('DEFAULT_RUNTIME_PARALLEL_DRIFT',token);
if(!(schema?.required??[]).includes('state')) fail('STATE_SCHEMA_NOT_REQUIRED','schemas/execution-config.schema.json');

if (isV4) {
  try {
    const v4Config = parse('templates/execution.config.v4.json');
    if (v4Config.standardVersion !== (isV5?'4.1.0':version)) fail('V4_TEMPLATE_VERSION_MISMATCH', `${v4Config.standardVersion} != ${version}`);
  } catch (error) { fail('V4_TEMPLATE_PARSE', error.message); }
}

for(const size of ['small','medium','large']){
  try {
    const cfg=parse(`examples/${size}/execution.config.json`);
    if(cfg.standardVersion!==expectedCompatVersion) fail('VERSION_SURFACE_MISMATCH',`examples/${size}/execution.config.json`);
    if(cfg.projectState!=='BOOTSTRAP') fail('EXAMPLE_FALSE_ACTIVE_STATE',`${size} examples have unresolved project-specific evidence and must remain BOOTSTRAP`);
    if((cfg.evidence?.requiredProducers??[]).length!==0||cfg.evidence?.testReportPath!=='') fail('EXAMPLE_FAKE_RELEASE_EVIDENCE',`${size} must not claim a project-specific producer before one exists`);
    if(!validState(cfg)) fail('EXAMPLE_STATE_POLICY_INVALID',size);
    if(!validFleet(cfg)) fail('EXAMPLE_FLEET_POLICY_INVALID',size);
    if(!validReality(cfg)) fail('EXAMPLE_REALITY_POLICY_INVALID',size);
    const runtime=cfg.runtime??{}, parallel=runtime.parallel??{}, boost=runtime.boost??{};
    if(runtime.mode!=='DEPENDENCY_SAFE_PARALLEL'||runtime.oneLifecycleActionAtATime!==false||parallel.enabled!==true||parallel.requireExplicitParallelSafe!==true||parallel.requireOwnership!==true||parallel.isolatedWorktrees!==true||parallel.integrationOwner!=='orchestrator'||parallel.sequentialFallback!==true||boost.enabled!==true||boost.command!=='/boost'||boost.qualityGatesPreserved!==true) fail('EXAMPLE_RUNTIME_POLICY_INVALID',size);
    for(const rel of ['executionkit.scope.json','executionkit.integration.json','executionkit.adapters.json']) if(!exists(`examples/${size}/${rel}`)) fail('EXAMPLE_REALITY_SURFACE_MISSING',`${size}: ${rel}`);
  } catch(error){ fail('VERSION_SURFACE_PARSE',`examples/${size}/execution.config.json: ${error.message}`); }
  try {
    const value=parse(`examples/${size}/.agents/manifest.json`);
    if(value.standardVersion!==expectedCompatVersion) fail('VERSION_SURFACE_MISMATCH',`examples/${size}/.agents/manifest.json`);
    const stateSkill=(value.resources?.skills??[]).find((i)=>i.id==='skill.state-rehydration'), taskContext=(value.resources?.skills??[]).find((i)=>i.id==='skill.task-context'), parallelSkill=(value.resources?.skills??[]).find((i)=>i.id==='skill.parallel-orchestration');
    if(!stateSkill||!taskContext?.requires?.includes('skill.state-rehydration')) fail('EXAMPLE_STATE_AGENT_UNROUTABLE',size);
    if(!parallelSkill) fail('EXAMPLE_PARALLEL_SKILL_MISSING',size);
    const d=value.delegation??{};
    if(d.mode!=='DEPENDENCY_SAFE_PARALLEL'||d.oneLifecycleActionAtATime!==false||d.requireExplicitParallelSafe!==true||d.requireOwnership!==true||d.isolatedWorktrees!==true||d.integrationOwner!=='role.orchestrator'||d.sequentialFallback!==true||d.boostCommand!=='/boost'||d.qualityGatesPreserved!==true) fail('EXAMPLE_AGENT_PARALLEL_POLICY_INVALID',size);
  } catch(error){ fail('VERSION_SURFACE_PARSE',`examples/${size}/.agents/manifest.json: ${error.message}`); }
}
if(manifest){
  if(manifest.standardVersion!==expectedCompatVersion) fail('AGENT_STANDARD_VERSION_MISMATCH',manifest.standardVersion??'MISSING');
  if(Object.hasOwn(manifest,'parallelism')) fail('LEGACY_PARALLELISM_FORBIDDEN','template manifest');
  const delegation=manifest.delegation??{};
  if(delegation.mode!=='DEPENDENCY_SAFE_PARALLEL'||delegation.oneLifecycleActionAtATime!==false) fail('DELEGATION_NOT_DEPENDENCY_SAFE_PARALLEL','template manifest');
  if(delegation.requireExplicitParallelSafe!==true||delegation.requireOwnership!==true||delegation.isolatedWorktrees!==true||delegation.sequentialFallback!==true||delegation.integrationOwner!=='role.orchestrator'||delegation.boostCommand!=='/boost'||delegation.qualityGatesPreserved!==true) fail('DELEGATION_PARALLEL_GUARDS_INVALID','template manifest');
  if(skillIds.size<25) fail('SPECIALIST_SKILL_REGISTRY_TOO_SMALL',String(skillIds.size));
  const stateSkill=(manifest.resources?.skills??[]).find((i)=>i.id==='skill.state-rehydration'), taskContext=(manifest.resources?.skills??[]).find((i)=>i.id==='skill.task-context');
  if(!stateSkill||!taskContext?.requires?.includes('skill.state-rehydration')) fail('STATE_AGENT_SKILL_UNROUTABLE','task-context must require state-rehydration');
  const ids=new Set();
  for(const [kind,resources] of Object.entries(manifest.resources??{})) for(const resource of resources??[]){ if(!resource?.id||ids.has(resource.id)) fail('TEMPLATE_RESOURCE_ID_INVALID',resource?.id??kind); ids.add(resource.id); const rel=resource.path?.replace(/^\.agents\//,'templates/.agents/'); if(!rel||!exists(rel)) fail('TEMPLATE_RESOURCE_MISSING',`${resource.id}: ${resource.path}`); }
}

const expectedScripts=['test','validate:self','validate:parallel-agent-os','validate:small','validate:medium','validate:large','validate:examples','validate:ci-policy','validate:canonical-docs','validate:distribution','validate:state','validate:v30','validate:v30-docs','integration:validate','integration:release','revalidation:status','revalidation:require-clear','project:init','project:activate','project:adopt','project:migrate','project:migrate:v3','runtime:plan','runtime:boost','runtime:next','runtime:readiness','runtime:context','runtime:status','runtime:recover','runtime:cancel','runtime:loop','state:status','state:checkpoint','state:rehydrate','state:amnesia','state:memory','agent:run','agent:once','agent:status','agent:list','agent:register','agent:unregister','agent:config','agent:stop','agent:doctor','agent:install','agent:uninstall','todo:archive','execution:report','discover','reconcile','candidate:build','candidate:validate','evidence:collect','evidence:graph','coverage:graph','test:adequacy','browser:validate','seo:validate','flutter:validate','laravel:boost','dart:mcp','components:discover','components:validate','design:validate','content:discover','content:validate','impact','tests:select','flakes','security','data:safety','health','quality:configure','quality:validate','audit:scan','audit:wave','audit:phase','audit:full','test:project','release:check','release:run','release:deploy','release:status','deploy:apply','deploy:rollback','tooling:plan','tooling:setup','workflows:export','antigravity:integrate','fleet:audit','fleet:plan','fleet:report','doctor','mcp','validation:evidence','check'];
for(const name of expectedScripts) if(!pkg?.scripts?.[name]) fail('PACKAGE_SCRIPT_MISSING',name);
if(pkg?.scripts?.['project:migrate']!=='node bin/migrate-current.mjs') fail('CURRENT_MIGRATION_ROUTER_DRIFT',pkg?.scripts?.['project:migrate']??'MISSING');
if(!pkg?.scripts?.['validate:distribution']?.includes('validate-state-distribution.mjs')) fail('STATE_DISTRIBUTION_GATE_MISSING',pkg?.scripts?.['validate:distribution']??'MISSING');
for(const token of ['validate:self','validate:parallel-agent-os','npm test','validate:v30','validate:v30-docs','validate:examples','validate:ci-policy','validate:canonical-docs','validate:distribution']) if(!String(pkg?.scripts?.check||'').includes(token)) fail('PACKAGE_CHECK_INCOMPLETE',token);

if(baseline){
  if(baseline.schemaVersion!=='1.0.0') fail('TEST_BASELINE_SCHEMA',baseline.schemaVersion??'MISSING');
  if(baseline.releaseVersion!==version) fail('TEST_BASELINE_VERSION',`${baseline.releaseVersion??'MISSING'} != ${version}`);
  if(!Number.isInteger(baseline.minimumRuntimeTests)||baseline.minimumRuntimeTests<246) fail('TEST_BASELINE_REGRESSED',String(baseline.minimumRuntimeTests));
  if(!(baseline.requiredFiles??[]).includes('tests/state-os.test.mjs')) fail('STATE_TEST_NOT_BASELINED','tests/state-os.test.mjs');
  if(!(baseline.requiredFiles??[]).includes('tests/v30-agent.test.mjs')) fail('V30_TEST_NOT_BASELINED','tests/v30-agent.test.mjs');
  if(!(baseline.requiredFiles??[]).includes('tests/v30-bootstrap-mode.test.mjs')) fail('V30_TEST_NOT_BASELINED','tests/v30-bootstrap-mode.test.mjs');
  if(!(baseline.requiredFiles??[]).includes('tests/v30-protocol.test.mjs')) fail('V30_TEST_NOT_BASELINED','tests/v30-protocol.test.mjs');
  const actualTests=walk(full('tests'),'tests').filter((i)=>i.entry.isFile()&&i.rel.endsWith('.test.mjs')).map((i)=>i.rel).sort();
  const declared=[...(baseline.requiredFiles??[])].sort();
  for(const rel of actualTests.filter((i)=>!declared.includes(i))) fail('TEST_FILE_NOT_BASELINED',rel);
  for(const rel of declared.filter((i)=>!actualTests.includes(i))) fail('BASELINED_TEST_FILE_MISSING',rel);
  if(new Set(declared).size!==declared.length) fail('TEST_BASELINE_DUPLICATE','requiredFiles contains duplicates');
}

const standard=exists('STANDARD.md')?read('STANDARD.md'):'', standardV3=exists('STANDARD_V3.md')?read('STANDARD_V3.md'):'', readme=exists('README.md')?read('README.md'):'', changelog=exists('CHANGELOG.md')?read('CHANGELOG.md'):'', agents=exists('AGENTS.md')?read('AGENTS.md'):'', playbook=exists('PLAYBOOK.md')?read('PLAYBOOK.md'):'';
// STANDARD.md remains the preserved v2.2.4 semantic base in the 3.0 architecture; STANDARD_V3.md is the normative major overlay.
if(!standard.includes('# AI ExecutionKit Standard v2.2.4')) fail('STANDARD_BASE_VERSION_STALE','STANDARD.md must remain the preserved v2.2.4 semantic base');
if(!standardV3.includes('# AI ExecutionKit Standard v3.0')) fail('STANDARD_V3_OVERLAY_STALE','STANDARD_V3.md');
if(v3Published){
  const candidate=(isV5||version.startsWith('4.'))&&changelog.includes(`## ${version} — Unreleased candidate`);
  const versionTruth=candidate
    ? readme.includes(`Current development candidate: **${version}**`)&&readme.includes(isV5?'Current tagged stable version: **4.1.0**':'Current tagged stable version: **4.0.1**')
    : readme.includes(`Current tagged stable version: **${version}**`)||readme.includes(`Current published version: **${version}**`);
  if(!versionTruth) fail('README_VERSION_STALE',version);
  if(readme.includes('not released until the canonical release gate passes')) fail('README_CANDIDATE_WORDING_STALE',version);
  if(changelog.match(/^##\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/m)?.[1]!==version) fail('CHANGELOG_RELEASE_STALE',version);
  for(const [rel,text] of [['STANDARD_V3.md',standardV3],['README.md',readme],['CHANGELOG.md',changelog]]) if(!text.includes('ExecutionKit Agent')||!text.includes('State OS')) fail('V30_RELEASE_TEXT_STALE',rel);
  if(!agents.includes('State OS')) fail('V30_RELEASE_TEXT_STALE','AGENTS.md');
} else {
  if(version!=='2.2.4') fail('V30_CANDIDATE_BASE_VERSION_INVALID',`Unreleased 3.0 candidate must remain on published base 2.2.4, got ${version}`);
  if(!readme.includes('Current published version: **2.2.4**') || !readme.includes('Current major candidate: **3.0.0')) fail('README_CANDIDATE_VERSION_STALE','README.md');
  if(changelog.match(/^##\s+(\d+\.\d+\.\d+)\b/m)?.[1]!=='2.2.4') fail('CHANGELOG_RELEASE_STALE','candidate must retain 2.2.4 as latest published release');
  for(const [rel,text] of [['STANDARD.md',standard],['README.md',readme],['CHANGELOG.md',changelog],['AGENTS.md',agents]]) if(!/246\s+runtime tests/i.test(text)||!/28\s+required test files/i.test(text)) fail('V224_RELEASE_FLOOR_TEXT_STALE',rel);
}
if(!/BOOT\s*(?:→|->)\s*REHYDRATE\s*(?:→|->)\s*VERIFY\s*(?:→|->)\s*RESUME/i.test(playbook)) fail('PLAYBOOK_STATE_PROTOCOL_MISSING','PLAYBOOK.md');

requireTokens('README.md',['docs/architecture/state-os.md','PLAYBOOK.md','EK00-004S','state-amnesia-test.mjs','migrate-current.mjs','ExecutionKit Agent — 3.0 fleet observability'],'README_STATE_INTEGRATION_INCOMPLETE');
requireTokens('STANDARD.md',['Managed file presence is not deep integration','State OS','ADVISORY_ONLY','Amnesia Test','M0_PLANNING_ONLY','M4_PRODUCTION','.executionkit/runtime/'],'STANDARD_INCOMPLETE');
requireTokens('STANDARD_V3.md',['CANONICAL MAJOR-VERSION OVERLAY','first seven are capability authorities','Elmasna3 MUST NOT become a required dependency','Remote control remains disabled in protocol v1'],'STANDARD_V3_INCOMPLETE');
requireTokens('AGENTS.md',['docs/architecture/state-os.md','Amnesia Test','ADVISORY_ONLY'],'AGENT_STATE_ROUTING_INCOMPLETE');
requireTokens('docs/adoption/universal-adoption.md',['State OS','EK00-004S','ADVISORY_ONLY','M0_PLANNING_ONLY','M4_PRODUCTION','Managed runtime topology and product-denominator safety','Production safety boundary'],'UNIVERSAL_ADOPTION_INCOMPLETE');
requireTokens('docs/adoption/deep-integration.md',['State OS — cross-cutting system #8','EK00-004S','state-amnesia-test.mjs','Maturity classification is mandatory','M0_PLANNING_ONLY','M4_PRODUCTION','.executionkit/runtime/AI-ExecutionKit'],'DEEP_INTEGRATION_INCOMPLETE');
requireTokens('templates/TODO.md',['TASK:EK00-001','TASK:EK00-003I','executionkit.integration.json','TASK:EK00-004S','TASK:EK00-011','TASK:EK00-AUDIT','TASK:EK00-ACTIVATE','TASK:REL-AUDIT','Audit Boundary: release','Depends: EK00-ACTIVATE','Journey Gate:','Verification Mode: `black-box, integration, runtime`'],'TEMPLATE_DEEP_INTEGRATION_TASKS_INCOMPLETE');
requireTokens('schemas/execution-config.schema.json',['"state"','"fleet"','"authority"','"advisory"','"integration"','requirePhaseConvergenceForClosure','requireCriticalJourneysForRelease','requireJourneyDenominator','requireSystemReleaseGate','systemReleaseGateTaskId','releaseTruthMode','deepIntegrationRequired','integrationPhase','integrationGateTaskId','productExecutionBlockedUntilGateAccepted'],'EXECUTION_SCHEMA_INCOMPLETE');
requireTokens('templates/EXECUTION_OS.md',['Definition of Ready continuation','next-readiness.mjs','Never implement a PLANNED task directly'],'READINESS_PROTOCOL_INCOMPLETE');
requireTokens('docs/architecture/reality-closure.md',['Task truth','system truth','Phase convergence','Critical-journey graph','Change-impact revalidation','not a ninth OS'],'REALITY_CLOSURE_DOC_INCOMPLETE');
requireTokens('lib/evidence-model.mjs',['validateScenarioManifest','scenarioReportPath','scenarioArtifact','Scenario evidence artifact hash differs'],'CURRENT_SCENARIO_EVIDENCE_ENGINE_INCOMPLETE');
requireTokens('schemas/integration-contract.schema.json',['releaseGateTask','requiredScenarios','black-box','runtime'],'INTEGRATION_CONTRACT_SCHEMA_INCOMPLETE');
requireTokens('schemas/adapter-config.schema.json',['observationBoundary','journeyCoverage','scenarioReportPath','integration-fixture'],'JOURNEY_ADAPTER_SCHEMA_INCOMPLETE');
requireTokens('executionkit.integration.json',['J-V3-INSTALLER','J-V33-PARALLEL-AGENT-OS','J-V34-GITHUB-LIVE-BOOTSTRAP','J-V35-REALITY-CLOSURE','EK3-041','installer-blackbox','parallel-blackbox','live-bootstrap-blackbox','reality-blackbox','false-closure-rejection','stale-evidence-revalidation'],'ROOT_INTEGRATION_CONTRACT_INCOMPLETE');
requireTokens('executionkit.adapters.json',['installer-blackbox','parallel-blackbox','live-bootstrap-blackbox','reality-blackbox','integration-fixture','scenarioReportPath','J-V3-INSTALLER','J-V33-PARALLEL-AGENT-OS','J-V34-GITHUB-LIVE-BOOTSTRAP','J-V35-REALITY-CLOSURE','journeyCoverage'],'ROOT_REALITY_PRODUCER_INCOMPLETE');
requireTokens('bin/run-installer-blackbox-evidence.mjs',['installer.test.mjs','bootstrap.test.mjs','adopt-project.test.mjs','migration.test.mjs','deep-integration.test.mjs','existing code and canonical history retain their bytes','activation requires accepted integration gate','receipt-bound isolated runtimes'],'ROOT_INSTALLER_PRODUCER_SCRIPT_INCOMPLETE');
requireTokens('bin/run-parallel-blackbox-evidence.mjs',['parallel-agent-os.test.mjs','v22-policy.test.mjs','v22-runtime.test.mjs','v22-operational-truth.test.mjs','migration.test.mjs','independent dependency-ready tasks form a bounded canonical batch','overlapping ownership and coordination hotspots force sequential fallback','boost raises only the safe batch cap','fleet upgrade plan routes v3 repair'],'ROOT_PARALLEL_PRODUCER_SCRIPT_INCOMPLETE');
requireTokens('bin/run-live-bootstrap-blackbox-evidence.mjs',['live-bootstrap-export.test.mjs','local-bootstrap-docs.test.mjs','operator-entry-contract.test.mjs','official GitHub main at runtime without a static source pin','rejects repository, ref, commit and source customization flags','live-verification local bootstrap documentation coherent'],'ROOT_LIVE_BOOTSTRAP_PRODUCER_SCRIPT_INCOMPLETE');
requireTokens('bin/run-reality-blackbox-evidence.mjs',['integration-reality.test.mjs','revalidation.test.mjs','release-readiness.test.mjs','system release gate must converge the complete active denominator','critical journey gate rejects a member task outside its dependency closure','changed accepted contract requires revalidation','strict production release rejects closure'],'ROOT_REALITY_PRODUCER_SCRIPT_INCOMPLETE');
requireTokens('package.json',['"revalidation:status"','"revalidation:require-clear"'],'REVALIDATION_DISTRIBUTION_INCOMPLETE');

const init=read('bin/init-project.mjs'), migration=read('bin/migrate-v2.mjs'), migrationV3=read('bin/migrate-v3.mjs'), currentMigration=read('bin/migrate-current.mjs'), stateRepair=read('bin/migrate-state-os.mjs'), release=read('bin/release-readiness.mjs'), nextExecution=read('bin/next-execution.mjs'), adoptionModel=read('lib/adoption-model.mjs'), deepValidator=read('bin/validate-deep-integration.mjs'), activate=read('bin/activate-project.mjs');
for(const token of ['validate-deep-integration.mjs','validate-integration.mjs','executionkit.integration.json','schemas/integration-contract.schema.json','next-readiness.mjs','lib/adoption-model.mjs','lib/readiness-model.mjs','docs/adoption/deep-integration.md','templates/STATE_OS.md','lib/state-model.mjs','validate-state.mjs','state-amnesia-test.mjs','templates/executionkit.gitignore','plugins/antigravity-executionkit','validate-v30-project.mjs','lib/agent-pulse.mjs','schemas/agent-telemetry.schema.json','Bootstrap transaction failed and target managed surfaces were rolled back']) if(!init.includes(token)) fail('BOOTSTRAP_HARDENING_MISSING',token);
for(const token of ['lib/adoption-model.mjs','lib/readiness-model.mjs','lib/state-model.mjs','validate-state.mjs','state-amnesia-test.mjs','docs/architecture/state-os.md','templates/STATE_OS.md','deepIntegrationRequired:false','TODO changed during v2.2 migration','stateMemoryAuthority']) if(!migration.includes(token)) fail('MIGRATION_HARDENING_MISSING',token);
for(const token of ['validate-v30-project.mjs','schemas/agent-telemetry.schema.json','v3-fleet-protocol.md','v3 project validation failed','v3 migration changed canonical TODO bytes']) if(!migrationV3.includes(token)) fail('V30_MIGRATION_HARDENING_MISSING',token);
for(const token of ['migrate-v2.mjs','migrate-v3.mjs','State OS','todoMutation']) if(!currentMigration.includes(token)) fail('CURRENT_MIGRATION_ROUTER_INCOMPLETE',token);
for(const token of ['SHARED_STATE_INTEGRATION_STALE','migrate-current.mjs','TODO changed during State OS repair','skill.state-rehydration']) if(!stateRepair.includes(token)) fail('STATE_REPAIR_GUARD_INCOMPLETE',token);
for(const token of ['validate-deep-integration.mjs','validate-integration.mjs','analyzeRevalidation','--require-gate-accepted','candidate validation failed','persisted discovery inventory is stale','strict release truth','requiredProducers','requireTestAdequacy','candidate changes require revalidation before release']) if(!release.includes(token)) fail('RELEASE_HARDENING_MISSING',token);
for(const token of ['DEFAULT_DEEP_INTEGRATION','PRODUCT_FRONTIER_BYPASSES_DEEP_INTEGRATION','ACTIVE_BEFORE_DEEP_INTEGRATION_ACCEPTED','DEEP_INTEGRATION_GATE_NOT_ACCEPTED']) if(!adoptionModel.includes(token)) fail('DEEP_INTEGRATION_MODEL_INCOMPLETE',token);
for(const token of ['validateDeepIntegration','--require-gate-accepted','loadTasks']) if(!deepValidator.includes(token)) fail('DEEP_INTEGRATION_VALIDATOR_INCOMPLETE',token);
for(const token of ['validate-deep-integration.mjs','--require-gate-accepted']) if(!activate.includes(token)) fail('ACTIVATION_DEEP_INTEGRATION_GUARD_MISSING',token);
for(const token of ['validateDeepIntegration','deep integration guard failed','readinessCandidates','resolveReadinessCandidates']) if(!nextExecution.includes(token)) fail('NEXT_EXECUTION_GUARD_OR_READINESS_MISSING',token);
requireTokens('templates/execution-integrity.yml',['workflow_dispatch','self-hosted','validate-state.mjs','validate-v30-project.mjs','validate-deep-integration.mjs','next-execution.mjs'],'GENERATED_CI_INCOMPLETE');

const mcp=read('bin/mcp-server.mjs');
for(const token of ['executionkit_state_status','executionkit_state_rehydrate','executionkit_state_checkpoint','executionkit_state_amnesia_test','executionkit_state_memory_envelope','executionkit_agent_status','executionkit_fleet_status']) if(!mcp.includes(token)) fail('MCP_TOOL_MISSING',token);
const runtime=read('lib/runtime-orchestrator.mjs');
for(const token of ['rehydrateState','writeStateCheckpoint','STATE_REHYDRATION_REQUIRED','EXECUTIONKIT_STATE_JSON']) if(!runtime.includes(token)) fail('STATE_RUNTIME_INTEGRATION_MISSING',token);
const v3Runtime=read('lib/executionkit-agent-v3.mjs');
for(const token of ['acknowledgeSpoolBatch','canonicalRepositoryIdentity','shareHostname','verified-batch-ack','staggered-project-scans','INVALID_CONTROL_PLANE_ACK']) if(!v3Runtime.includes(token)) fail('V30_AGENT_HARDENING_MISSING',token);

if(exists('templates/.agents/rules/concurrency.md')) fail('LEGACY_CONCURRENCY_RULE_PRESENT','templates/.agents/rules/concurrency.md');
if(exists('plugins/antigravity-executionkit/agents')) fail('ANTIGRAVITY_PARALLEL_AGENT_BUNDLE_FORBIDDEN','plugins/antigravity-executionkit/agents');
for(const base of ['bin','lib','schemas','templates/.agents','plugins/antigravity-executionkit']) for(const item of walk(full(base),base)) if(item.entry.isSymbolicLink()) fail('DISTRIBUTION_SYMLINK_FORBIDDEN',item.rel);
const workflow=read('.github/workflows/execution-integrity.yml');
if(!/^\s*workflow_dispatch\s*:/m.test(workflow)) fail('CI_MANUAL_TRIGGER_MISSING','workflow_dispatch');
for(const trigger of ['push','pull_request','schedule']) if(new RegExp(`^\\s*${trigger}\\s*:`, 'm').test(workflow)) fail('CI_AUTOMATIC_TRIGGER_FORBIDDEN',trigger);
if(!/self-hosted/.test(workflow)||!/project-ai-excutionkit/.test(workflow)) fail('CI_SELF_HOSTED_LABEL_MISSING','distribution workflow');
if(/(?:ubuntu|windows|macos)-latest/i.test(workflow)) fail('CI_HOSTED_FALLBACK_FORBIDDEN','distribution workflow');
const semantic=runNode('bin/validate-canonical-docs.mjs',[root]);
if(semantic.status!==0) fail('CANONICAL_SEMANTIC_SCAN_FAILED',(semantic.stderr||semantic.stdout||semantic.error?.message||'').trim());
const v30=runNode('bin/validate-v30-policy.mjs',[root]);
if(v30.status!==0) fail('V30_POLICY_FAILED',(v30.stderr||v30.stdout||v30.error?.message||'').trim());
const v30Docs=runNode('bin/validate-v30-docs.mjs',[root]);
if(v30Docs.status!==0) fail('V30_DOCS_FAILED',(v30Docs.stderr||v30Docs.stdout||v30Docs.error?.message||'').trim());

if(errors.length){
  console.error('ExecutionKit distribution integrity: FAIL');
  for(const error of errors) console.error(`  ERROR [${error.code}] ${error.message}`);
  for(const warning of warnings) console.error(`  WARN [${warning.code}] ${warning.message}`);
  process.exit(1);
}
console.log(`ExecutionKit distribution integrity: PASS (${version}; 34/34 historical v2.2 additions preserved; State OS + V3 fleet + deep-integration coherent; regression floor >= ${baseline?.minimumRuntimeTests??'UNKNOWN'} across ${baseline?.requiredFiles?.length??0} test files)`);
for(const warning of warnings) console.log(`  WARN [${warning.code}] ${warning.message}`);
