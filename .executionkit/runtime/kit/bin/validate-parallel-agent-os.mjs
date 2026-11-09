#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(here, '..'));
const errors = [];
const requireFile = (rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) errors.push(`[FILE_MISSING] ${rel}`);
  return file;
};
const read = (rel) => fs.existsSync(requireFile(rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '';
const parse = (rel) => { try { return JSON.parse(read(rel)); } catch (error) { errors.push(`[JSON_INVALID] ${rel}: ${error.message}`); return {}; } };
const marker = (rel, values) => { const text = read(rel); for (const value of values) if (!text.includes(value)) errors.push(`[MARKER_MISSING] ${rel}: ${value}`); };

for (const rel of [
  'lib/parallel-execution.mjs',
  'bin/boost.mjs',
  'docs/architecture/concurrency.md',
  '.agents/skills/parallel-orchestration/SKILL.md',
  'templates/.agents/skills/parallel-orchestration/SKILL.md',
  'plugins/antigravity-executionkit/skills/boost/SKILL.md',
  'tests/parallel-agent-os.test.mjs',
]) requireFile(rel);

for (const rel of ['execution.config.json','templates/execution.config.json']) {
  const config = parse(rel), runtime = config.runtime ?? {}, parallel = runtime.parallel ?? {}, boost = runtime.boost ?? {};
  if (runtime.mode !== 'DEPENDENCY_SAFE_PARALLEL') errors.push(`[RUNTIME_MODE] ${rel} must default to DEPENDENCY_SAFE_PARALLEL`);
  if (runtime.oneLifecycleActionAtATime !== false) errors.push(`[RUNTIME_ACTION_POLICY] ${rel} parallel default requires oneLifecycleActionAtATime=false`);
  if (parallel.enabled !== true || parallel.requireExplicitParallelSafe !== true || parallel.requireOwnership !== true || parallel.isolatedWorktrees !== true || parallel.integrationOwner !== 'orchestrator' || parallel.sequentialFallback !== true) errors.push(`[RUNTIME_PARALLEL_GUARDS] ${rel} is missing fail-closed parallel guards`);
  if (!Number.isInteger(parallel.maxConcurrentTasks) || parallel.maxConcurrentTasks < 1) errors.push(`[RUNTIME_PARALLEL_CAP] ${rel} invalid maxConcurrentTasks`);
  if (!Number.isInteger(parallel.maxAgentsPerTask) || parallel.maxAgentsPerTask < 1) errors.push(`[RUNTIME_AGENT_CAP] ${rel} invalid maxAgentsPerTask`);
  if (boost.enabled !== true || boost.command !== '/boost' || boost.qualityGatesPreserved !== true) errors.push(`[BOOST_POLICY] ${rel} must expose /boost with preserved quality gates`);
  if ((boost.maxConcurrentTasks ?? 0) < parallel.maxConcurrentTasks) errors.push(`[BOOST_TASK_CAP] ${rel} boost task cap cannot be below normal cap`);
  if ((boost.maxAgentsPerTask ?? 0) < parallel.maxAgentsPerTask) errors.push(`[BOOST_AGENT_CAP] ${rel} boost agent cap cannot be below normal cap`);
}

const manifest = parse('.agents/manifest.json');
if (manifest.delegation?.mode !== 'DEPENDENCY_SAFE_PARALLEL') errors.push('[AGENT_DELEGATION] root manifest is not dependency-safe parallel');
for (const [key, expected] of [['requireExplicitParallelSafe',true],['requireOwnership',true],['isolatedWorktrees',true],['integrationOwner','role.orchestrator'],['sequentialFallback',true],['qualityGatesPreserved',true],['boostCommand','/boost']]) if (manifest.delegation?.[key] !== expected) errors.push(`[AGENT_DELEGATION_GUARD] ${key}`);
const parallelSkill = (manifest.resources?.skills ?? []).find((item) => item.id === 'skill.parallel-orchestration');
if (!parallelSkill) errors.push('[AGENT_PARALLEL_SKILL] skill.parallel-orchestration is not registered');
const routed = [manifest.routing?.fallback, ...(manifest.routing?.routes ?? []).map((x)=>x.use), ...(manifest.routing?.supplements ?? []).map((x)=>x.use)].some((use) => (use?.skills ?? []).includes('skill.parallel-orchestration'));
if (!routed) errors.push('[AGENT_PARALLEL_ROUTE] skill.parallel-orchestration is registered but unroutable');

marker('lib/parallel-execution.mjs', ['resolveExecutionBatch','taskParallelSafe','taskOwnership','DEPENDENCY_SAFE_PARALLEL_BATCH','CLOSURE_ACTION_SERIALIZED','sequentialFallback']);
marker('lib/runtime-orchestrator.mjs', ['resolveExecutionBatch','DEPENDENCY_SAFE_PARALLEL','claimRequirements','Multi-task concurrency is a host/Agent-OS orchestration concern']);
marker('lib/agent-model.mjs', ['DEPENDENCY_SAFE_PARALLEL','AGENT_PARALLEL_POLICY_INVALID','LEGACY_PARALLELISM_KEY_FORBIDDEN','qualityGatesPreserved']);
marker('bin/boost.mjs', ["command: '/boost'",'EXECUTION_INTEGRITY_FAILED','Orchestrator alone mutates canonical TODO']);
marker('bin/coordinate-agents.mjs', ['--boost','batchSize','plan-only']);
marker('.agents/rules/delegation.md', ['Dependency-safe parallel delegation rule','orchestrator alone claims/releases canonical tasks','/boost']);
marker('docs/architecture/concurrency.md', ['sole mutable execution/backlog/status authority','Intra-task specialist parallelism','Inter-task canonical parallelism','maximum **currently safe** concurrency','real-host acceptance claim']);
marker('plugins/antigravity-executionkit/rules/executionkit.md', ['DEPENDENCY_SAFE_PARALLEL_AGENT_OS','`/boost`','quality']);
marker('plugins/antigravity-executionkit/skills/boost/SKILL.md', ['Maximum Safe Concurrency','never reduces acceptance quality']);
marker('bin/validate-v22-policy.mjs', ['DEPENDENCY_SAFE_PARALLEL','RUNTIME_PARALLEL_POLICY','RUNTIME_BOOST_POLICY']);

const baseline = parse('tests/test-baseline.json');
if (!baseline.requiredFiles?.includes('tests/parallel-agent-os.test.mjs')) errors.push('[TEST_BASELINE] parallel-agent-os regression file is not required');
if ((baseline.minimumRuntimeTests ?? 0) < 374) errors.push('[TEST_FLOOR] runtime regression floor has not been raised for parallel Agent OS coverage');

const plugin = parse('plugins/antigravity-executionkit/plugin.json');
if (!String(plugin.description ?? '').includes('/boost')) errors.push('[ANTIGRAVITY_PLUGIN] plugin description does not expose /boost current capability');

const out = { schemaVersion:'executionkit-parallel-agent-os/v1', status:errors.length ? 'FAIL' : 'PASS', errors };
console.log(JSON.stringify(out, null, 2));
process.exit(errors.length ? 1 : 0);
