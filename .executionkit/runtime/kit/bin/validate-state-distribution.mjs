#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });
const full = (rel) => path.join(root, rel);
const read = (rel) => fs.readFileSync(full(rel), 'utf8');
const exists = (rel) => fs.existsSync(full(rel));

const required = [
  'PLAYBOOK.md','docs/architecture/state-os.md','templates/STATE_OS.md','lib/state-model.mjs',
  'bin/validate-state.mjs','bin/state-status.mjs','bin/state-checkpoint.mjs','bin/state-rehydrate.mjs','bin/state-amnesia-test.mjs','bin/state-memory-envelope.mjs',
  'bin/migrate-current.mjs','bin/migrate-v2.mjs','bin/migrate-state-os.mjs','bin/validate-state-distribution.mjs',
  'plugins/antigravity-executionkit/skills/ek-state/SKILL.md','templates/.agents/skills/state-rehydration/SKILL.md','tests/state-os.test.mjs'
];
for (const rel of required) if (!exists(rel)) fail('STATE_DISTRIBUTION_FILE_MISSING', rel);

let version = '', pkg = {}, template = {}, rootConfig = {}, manifest = {}, baseline = {}, schema = {};
try { version = read('VERSION').trim(); } catch (error) { fail('STATE_VERSION_MISSING', error.message); }
for (const [name, rel] of [['package','package.json'],['template','templates/execution.config.json'],['root','execution.config.json'],['manifest','templates/.agents/manifest.json'],['baseline','tests/test-baseline.json'],['schema','schemas/execution-config.schema.json']]) {
  try {
    const value = JSON.parse(read(rel));
    if (name === 'package') pkg = value;
    else if (name === 'template') template = value;
    else if (name === 'root') rootConfig = value;
    else if (name === 'manifest') manifest = value;
    else if (name === 'baseline') baseline = value;
    else schema = value;
  } catch (error) { fail('STATE_JSON_INVALID', `${rel}: ${error.message}`); }
}

const isV5=/^5\.\d+\.\d+(?:-dev)?$/.test(version);
const isV4 = isV5 || /^4\.\d+\.\d+$/.test(version);
const expectedCompatVersion = isV4 ? '3.0.0' : version;
if (!isV5 && !/^(?:2\.2\.4|3\.\d+\.\d+|4\.\d+\.\d+)$/.test(version)) fail('STATE_RELEASE_VERSION', `State OS distribution requires its preserved 2.2.4 base or a current stable 3.x/4.x/5.x version, got ${version}`);
if (pkg.version !== version) fail('STATE_PACKAGE_VERSION', `${pkg.version} != ${version}`);
if (template.standardVersion !== expectedCompatVersion || rootConfig.standardVersion !== expectedCompatVersion || manifest.standardVersion !== expectedCompatVersion || baseline.releaseVersion !== version) fail('STATE_VERSION_SURFACE_MISMATCH', 'template/root/manifest/baseline must match expected standard version');

const validState = (cfg) => cfg?.state?.enabled === true &&
  typeof cfg.state.snapshotPath === 'string' && cfg.state.snapshotPath.startsWith('.executionkit/') &&
  typeof cfg.state.journalPath === 'string' && cfg.state.journalPath.startsWith('.executionkit/') &&
  cfg.state.requireRehydrateOnDrift === true &&
  Number.isInteger(cfg.state.heartbeatMinutes) && cfg.state.heartbeatMinutes >= 5 && cfg.state.heartbeatMinutes <= 240 &&
  cfg.state.memory?.authority === 'advisory' && cfg.state.memory.requireLiveRevalidation === true && cfg.state.memory.allowTaskState === false;
for (const [label, cfg] of [['root',rootConfig],['template',template]]) if (!validState(cfg)) fail('STATE_POLICY_MISSING', label);

for (const size of ['small','medium','large']) {
  try {
    const cfg = JSON.parse(read(`examples/${size}/execution.config.json`));
    if (cfg.standardVersion !== expectedCompatVersion || !validState(cfg)) fail('STATE_EXAMPLE_CONFIG', size);
    const exampleManifest = JSON.parse(read(`examples/${size}/.agents/manifest.json`));
    const stateSkill = (exampleManifest.resources?.skills ?? []).find((item) => item.id === 'skill.state-rehydration');
    const taskContext = (exampleManifest.resources?.skills ?? []).find((item) => item.id === 'skill.task-context');
    if (exampleManifest.standardVersion !== expectedCompatVersion || !stateSkill || !taskContext?.requires?.includes('skill.state-rehydration')) fail('STATE_EXAMPLE_AGENT', size);
  } catch (error) { fail('STATE_EXAMPLE_PARSE', `${size}: ${error.message}`); }
}

if (!(schema.required ?? []).includes('state')) fail('STATE_SCHEMA_REQUIRED', 'execution config schema must require state');
const stateSchema = schema.properties?.state;
if (stateSchema?.properties?.enabled?.const !== true || stateSchema?.properties?.requireRehydrateOnDrift?.const !== true) fail('STATE_SCHEMA_FAIL_OPEN', 'state.enabled and requireRehydrateOnDrift must be required true');
if (stateSchema?.properties?.memory?.properties?.authority?.const !== 'advisory' || stateSchema?.properties?.memory?.properties?.requireLiveRevalidation?.const !== true || stateSchema?.properties?.memory?.properties?.allowTaskState?.const !== false) fail('STATE_MEMORY_SCHEMA_UNSAFE', 'Memory schema must enforce advisory/live-revalidated/non-task-state semantics');

const stateSkill = (manifest.resources?.skills ?? []).find((item) => item.id === 'skill.state-rehydration');
const taskSkill = (manifest.resources?.skills ?? []).find((item) => item.id === 'skill.task-context');
if (!stateSkill) fail('STATE_SKILL_UNREGISTERED', 'skill.state-rehydration');
if (!taskSkill?.requires?.includes('skill.state-rehydration')) fail('STATE_SKILL_UNROUTABLE', 'task-context must require state-rehydration so routed lifecycle context expands it');

const todo = exists('templates/TODO.md') ? read('templates/TODO.md') : '';
if (!todo.includes('TASK:EK00-004S') || !todo.includes('- Depends: EK00-004S')) fail('STATE_DEEP_INTEGRATION_TASK', 'EK00-004S must gate downstream integration');

const mcp = exists('bin/mcp-server.mjs') ? read('bin/mcp-server.mjs') : '';
for (const token of ['executionkit_state_status','executionkit_state_rehydrate','executionkit_state_checkpoint','executionkit_state_amnesia_test','executionkit_state_memory_envelope']) if (!mcp.includes(token)) fail('STATE_MCP_TOOL_MISSING', token);

const runtime = exists('lib/runtime-orchestrator.mjs') ? read('lib/runtime-orchestrator.mjs') : '';
for (const token of ['rehydrateState','writeStateCheckpoint','STATE_REHYDRATION_REQUIRED','EXECUTIONKIT_STATE_JSON']) if (!runtime.includes(token)) fail('STATE_RUNTIME_INTEGRATION_MISSING', token);

const hook = exists('bin/antigravity-hook.mjs') ? read('bin/antigravity-hook.mjs') : '';
if (!hook.includes('rehydrateState')) fail('STATE_ANTIGRAVITY_INJECTION_MISSING', 'bin/antigravity-hook.mjs');

const init = exists('bin/init-project.mjs') ? read('bin/init-project.mjs') : '';
for (const token of ['templates/STATE_OS.md','lib/state-model.mjs','validate-state.mjs','state-amnesia-test.mjs','docs/architecture/state-os.md']) if (!init.includes(token)) fail('STATE_BOOTSTRAP_INVENTORY_MISSING', token);

const migration = exists('bin/migrate-v2.mjs') ? read('bin/migrate-v2.mjs') : '';
for (const token of ['lib/state-model.mjs','validate-state.mjs','state-amnesia-test.mjs','templates/STATE_OS.md','docs/architecture/state-os.md','skill.state-rehydration','stateMemoryAuthority','TODO changed during v2.2 migration']) if (!migration.includes(token)) fail('STATE_ATOMIC_MIGRATION_MISSING', token);
const current = exists('bin/migrate-current.mjs') ? read('bin/migrate-current.mjs') : '';
for (const token of ['migrate-v2.mjs','stateOSIncluded','todoMutation']) if (!current.includes(token)) fail('STATE_CURRENT_MIGRATION_ROUTER_MISSING', token);
const repair = exists('bin/migrate-state-os.mjs') ? read('bin/migrate-state-os.mjs') : '';
for (const token of ['SHARED_STATE_INTEGRATION_STALE','migrate-current.mjs','skill.state-rehydration','TODO changed during State OS repair']) if (!repair.includes(token)) fail('STATE_REPAIR_GUARD_MISSING', token);

for (const name of ['validate:state','state:status','state:checkpoint','state:rehydrate','state:amnesia','state:memory']) if (!pkg.scripts?.[name]) fail('STATE_PACKAGE_SCRIPT_MISSING', name);
if (pkg.scripts?.['project:migrate'] !== 'node bin/migrate-current.mjs') fail('STATE_MIGRATION_ROUTER', 'project:migrate must use migrate-current');
if (!pkg.scripts?.['validate:distribution']?.includes('validate-state-distribution.mjs')) fail('STATE_DISTRIBUTION_NOT_GATED', 'validate:distribution must execute State distribution validator');

if (baseline.minimumRuntimeTests < 246 || !(baseline.requiredFiles ?? []).includes('tests/state-os.test.mjs') || (baseline.requiredFiles ?? []).length < 28) fail('STATE_TEST_BASELINE', 'State regressions must be included in the 246/28 release floor');

for (const [rel, tokenSets] of [
  ['templates/STATE_OS.md',[['Context is disposable'],['Amnesia Test'],['Memory MCP']]],
  ['docs/architecture/state-os.md',[['cross-cutting eighth system','ten executable systems'],['ADVISORY_ONLY']]],
  ['PLAYBOOK.md',[['BOOT → REHYDRATE → VERIFY → RESUME'],['state-amnesia-test.mjs']]],
  ['STANDARD.md',[['State OS as cross-cutting system #7'],['ADVISORY_ONLY'],['246 runtime tests across 28 required test files']]],
  ['README.md',[['Eight systems, one control plane','Ten systems','eleven executable systems'],['EK00-004S'],['State OS as system #8','State OS']]],
  ['AGENTS.md',[['State OS as cross-cutting system #8','State OS'],['Amnesia Test']]],
]) {
  for (const tokenAlts of tokenSets) {
    const content = exists(rel) ? read(rel) : '';
    if (!tokenAlts.some(token => content.includes(token))) fail('STATE_DOC_CONTRACT', `${rel}: ${tokenAlts[0]}`);
  }
}

const ciTemplate = exists('templates/execution-integrity.yml') ? read('templates/execution-integrity.yml') : '';
if (!ciTemplate.includes('validate-state.mjs')) fail('STATE_GENERATED_CI_MISSING', 'templates/execution-integrity.yml');
if (ciTemplate.includes('state-amnesia-test.mjs')) fail('STATE_CLEAN_CHECKOUT_AMNESIA_INVALID', 'generated clean-checkout CI must not pretend to have a local State snapshot');

if (errors.length) {
  console.error('State OS distribution integrity: FAIL');
  for (const error of errors) console.error(`  ERROR [${error.code}] ${error.message}`);
  process.exit(1);
}
console.log(`State OS distribution integrity: PASS (${version}; State runtime/MCP/Agent/bootstrap/migration/repair/tests/docs coherent).`);
