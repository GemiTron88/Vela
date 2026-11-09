#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { validateAgentLayer } from '../lib/agent-model.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from '../lib/derived-state.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const errors = [];
const issue = (code, message) => errors.push({ code, message });
function projectRelative(value, label = 'configured project path') {
  try { resolveProjectPathSafe(root, value, label); return true; } catch { return false; }
}
function derivedRelative(value, label = 'configured derived path') {
  const normalized = typeof value === 'string' ? value.replaceAll('\\', '/').replace(/^\.\//, '') : '';
  if (!normalized.startsWith('.executionkit/')) return false;
  try { resolveDerivedPath(root, normalized, label); return true; } catch { return false; }
}
function validateRuntimePolicy(config) {
  const runtime = config.runtime ?? {};
  if (runtime.mode === 'SEQUENTIAL') {
    if (runtime.oneLifecycleActionAtATime !== true) issue('RUNTIME_POLICY', 'SEQUENTIAL runtime requires oneLifecycleActionAtATime=true');
    return;
  }
  if (runtime.mode !== 'DEPENDENCY_SAFE_PARALLEL') {
    issue('RUNTIME_POLICY', `runtime.mode must be SEQUENTIAL or DEPENDENCY_SAFE_PARALLEL, found ${runtime.mode ?? 'MISSING'}`);
    return;
  }
  if (runtime.oneLifecycleActionAtATime !== false) issue('RUNTIME_PARALLEL_POLICY', 'DEPENDENCY_SAFE_PARALLEL requires oneLifecycleActionAtATime=false');
  const parallel = runtime.parallel ?? {};
  if (parallel.enabled !== true) issue('RUNTIME_PARALLEL_POLICY', 'parallel.enabled must be true for DEPENDENCY_SAFE_PARALLEL');
  if (parallel.requireExplicitParallelSafe !== true) issue('RUNTIME_PARALLEL_POLICY', 'parallel canonical fan-out must require explicit safety proof');
  if (parallel.requireOwnership !== true) issue('RUNTIME_PARALLEL_POLICY', 'parallel canonical fan-out must require explicit ownership');
  if (parallel.isolatedWorktrees !== true) issue('RUNTIME_PARALLEL_POLICY', 'parallel canonical fan-out must require isolated worktrees or equivalent bounded isolation');
  if (parallel.integrationOwner !== 'orchestrator') issue('RUNTIME_PARALLEL_POLICY', 'parallel integration owner must be orchestrator');
  if (parallel.sequentialFallback !== true) issue('RUNTIME_PARALLEL_POLICY', 'parallel runtime must preserve sequential fallback');
  if (!Number.isInteger(parallel.maxConcurrentTasks) || parallel.maxConcurrentTasks < 1) issue('RUNTIME_PARALLEL_POLICY', 'parallel.maxConcurrentTasks must be a positive integer');
  if (!Number.isInteger(parallel.maxAgentsPerTask) || parallel.maxAgentsPerTask < 1) issue('RUNTIME_PARALLEL_POLICY', 'parallel.maxAgentsPerTask must be a positive integer');
  const boost = runtime.boost ?? {};
  if (boost.enabled !== true) issue('RUNTIME_BOOST_POLICY', 'DEPENDENCY_SAFE_PARALLEL requires /boost capability to remain enabled');
  if (boost.enabled === true) {
    if (boost.command !== '/boost') issue('RUNTIME_BOOST_POLICY', 'boost.command must be /boost');
    if (boost.qualityGatesPreserved !== true) issue('RUNTIME_BOOST_POLICY', '/boost must preserve all quality gates');
    if (!Number.isInteger(boost.maxConcurrentTasks) || boost.maxConcurrentTasks < parallel.maxConcurrentTasks) issue('RUNTIME_BOOST_POLICY', 'boost.maxConcurrentTasks must be an integer >= normal parallel cap');
    if (!Number.isInteger(boost.maxAgentsPerTask) || boost.maxAgentsPerTask < parallel.maxAgentsPerTask) issue('RUNTIME_BOOST_POLICY', 'boost.maxAgentsPerTask must be an integer >= normal specialist cap');
  }
}

try {
  const { config, source } = loadConfig(root);
  if (!source) issue('CONFIG_MISSING', 'Explicit execution config required');
  if (/^(?:2\.(?:[2-9]|\d{2,})|[345]\.\d+)\./.test(String(config.standardVersion ?? ''))) {
    validateRuntimePolicy(config);
    if (config.runtime && Object.hasOwn(config.runtime, 'maxConcurrentAgents')) issue('LEGACY_PARALLEL_POLICY_FORBIDDEN', 'legacy runtime.maxConcurrentAgents is forbidden; use runtime.parallel/boost with explicit ownership and safety gates');
    if (config.runtime?.checkpointPath !== '.executionkit/runtime/checkpoint.json') issue('V22_RUNTIME_CHECKPOINT_PATH', 'runtime.checkpointPath is canonical and must be .executionkit/runtime/checkpoint.json');

    const discovery = config.discovery ?? {};
    if (!projectRelative(discovery.scopePath, 'discovery.scopePath')) issue('V22_DISCOVERY_SCOPE_PATH', 'discovery.scopePath must be a safe project-relative path');
    for (const key of ['inventoryPath', 'reconciliationPath']) if (!derivedRelative(discovery[key], `discovery.${key}`)) issue('V22_DISCOVERY_DERIVED_PATH', `discovery.${key} must stay safely under .executionkit/`);
    for (const key of ['enabled', 'requiredForRelease', 'allowEmptyScopeForRelease']) if (discovery[key] !== undefined && typeof discovery[key] !== 'boolean') issue('V22_DISCOVERY_POLICY_TYPE', `discovery.${key} must be boolean`);
    if (discovery.failOnDeclaredMissing !== true) issue('V22_DISCOVERY_FAIL_CLOSED', 'discovery.failOnDeclaredMissing must be true; declared required surfaces can never be silently downgraded');
    if (discovery.requiredForRelease === true && discovery.enabled !== true) issue('V22_DISCOVERY_RELEASE_DISABLED', 'discovery.requiredForRelease=true requires discovery.enabled=true');

    const evidence = config.evidence ?? {};
    if (evidence.candidateRequired !== undefined || evidence.requiredForRelease !== undefined) issue('V22_LEGACY_EVIDENCE_POLICY', 'Use evidence.candidateRequiredForRelease; legacy candidateRequired/requiredForRelease keys are forbidden');
    if (evidence.candidateRequiredForRelease !== undefined && typeof evidence.candidateRequiredForRelease !== 'boolean') issue('V22_CANDIDATE_POLICY_TYPE', 'evidence.candidateRequiredForRelease must be boolean');
    if (!projectRelative(evidence.adapterConfigPath, 'evidence.adapterConfigPath')) issue('V22_ADAPTER_CONFIG_PATH', 'evidence.adapterConfigPath must be a safe project-relative path');
    if (evidence.maxAgeMinutes !== undefined && (!Number.isInteger(evidence.maxAgeMinutes) || evidence.maxAgeMinutes < 1)) issue('V22_EVIDENCE_FRESHNESS', 'evidence.maxAgeMinutes must be a positive integer');
    if (evidence.requiredProducers !== undefined && (!Array.isArray(evidence.requiredProducers) || evidence.requiredProducers.some((value) => typeof value !== 'string' || !value.trim()))) issue('V22_EVIDENCE_PRODUCERS', 'evidence.requiredProducers must be an array of non-empty strings');
    if (evidence.requireTestAdequacy !== undefined && typeof evidence.requireTestAdequacy !== 'boolean') issue('V22_TEST_ADEQUACY_TYPE', 'evidence.requireTestAdequacy must be boolean');
    if (config.projectState !== 'BOOTSTRAP' && evidence.requireTestAdequacy === true && !String(evidence.testReportPath ?? '').trim()) issue('V22_TEST_REPORT_REQUIRED', 'requireTestAdequacy=true requires evidence.testReportPath');
    if (evidence.testReportPath && !projectRelative(evidence.testReportPath, 'evidence.testReportPath')) issue('V22_TEST_REPORT_PATH', 'evidence.testReportPath must stay safely inside the project');
    if (evidence.testFormat && !['tap', 'junit', 'playwright-json'].includes(evidence.testFormat)) issue('V22_TEST_FORMAT', 'Unsupported evidence.testFormat');
    if (evidence.minimumTests !== undefined && (!Number.isInteger(evidence.minimumTests) || evidence.minimumTests < 0)) issue('V22_MINIMUM_TESTS', 'evidence.minimumTests must be a non-negative integer');

    const agent = validateAgentLayer(root, config);
    errors.push(...agent.errors);
  }
} catch (error) {
  issue('V22_POLICY_PARSE', error.message);
}

if (errors.length) {
  console.error('ExecutionKit v2.2/current-3.x policy integrity: FAIL');
  for (const error of errors) console.error(`  ERROR [${error.code}] ${error.message}`);
  process.exit(1);
}
console.log('ExecutionKit v2.2/current-3.x policy integrity: PASS');
