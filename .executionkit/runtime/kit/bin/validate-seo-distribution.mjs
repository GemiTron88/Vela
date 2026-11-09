#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });
const full = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(full(rel)) && fs.statSync(full(rel)).isFile();
const read = (rel) => fs.readFileSync(full(rel), 'utf8');
const parse = (rel) => JSON.parse(read(rel));

const required = [
  'docs/capabilities/seo-os.md',
  'docs/seo/SEO_OS.md',
  'executionkit.seo.json',
  'templates/SEO_OS.md',
  'templates/executionkit.seo.json',
  'schemas/seo-contract.schema.json',
  'lib/seo-model.mjs',
  'bin/validate-seo.mjs',
  'bin/migrate-seo-os.mjs',
  'tests/seo-os.test.mjs',
  'tests/seo-execution-integration.test.mjs',
  'tests/antigravity-seo.test.mjs',
  '.agents/rules/seo-authority.md',
  '.agents/contracts/seo-surface-contract.md',
  '.agents/skills/seo-gate/SKILL.md',
  '.agents/skills/seo-audit/SKILL.md',
  'templates/.agents/rules/seo-authority.md',
  'templates/.agents/contracts/seo-surface-contract.md',
  'templates/.agents/skills/seo-gate/SKILL.md',
  'templates/.agents/skills/seo-audit/SKILL.md',
  'plugins/antigravity-executionkit/skills/ek-seo/SKILL.md',
  'plugins/antigravity-executionkit/rules/executionkit.md',
  '.github/workflows/execution-integrity.yml',
  'docs/architecture/authority-model.md',
  'docs/architecture/project-profiles.md',
  'docs/architecture/reconciliation.md',
  'docs/architecture/ci-runner-policy.md',
  'docs/operations/v3-publication-status.md',
  'docs/operations/v3-release-validation.md',
];
for (const rel of required) if (!exists(rel)) fail('SEO_DISTRIBUTION_COMPONENT_MISSING', rel);

let rootConfig = null, templateConfig = null, rootManifest = null, templateManifest = null, baseline = null, schema = null;
for (const [rel, assign] of [
  ['execution.config.json', (value) => { rootConfig = value; }],
  ['templates/execution.config.json', (value) => { templateConfig = value; }],
  ['.agents/manifest.json', (value) => { rootManifest = value; }],
  ['templates/.agents/manifest.json', (value) => { templateManifest = value; }],
  ['tests/test-baseline.json', (value) => { baseline = value; }],
  ['schemas/execution-config.schema.json', (value) => { schema = value; }],
]) {
  try { assign(parse(rel)); } catch (error) { fail('SEO_DISTRIBUTION_JSON_INVALID', `${rel}: ${error.message}`); }
}

function checkConfig(label, config) {
  if (!config) return;
  const level = config.capabilities?.seo;
  if (!['NONE','LITE','STANDARD','FULL'].includes(level)) fail('SEO_CAPABILITY_LEVEL_MISSING', `${label}: capabilities.seo`);
  if (!config.seo || typeof config.seo !== 'object') fail('SEO_CONFIG_MISSING', `${label}: seo`);
  else {
    if (!String(config.seo.contractPath ?? '').trim()) fail('SEO_CONTRACT_PATH_MISSING', `${label}: seo.contractPath`);
    if (typeof config.seo.requiredForRelease !== 'boolean') fail('SEO_RELEASE_POLICY_MISSING', `${label}: seo.requiredForRelease`);
    if (level !== 'NONE' && config.seo.requiredForRelease !== true) fail('SEO_RELEASE_POLICY_BYPASS', `${label}: enabled SEO must require release validation`);
  }
}
checkConfig('root', rootConfig);
checkConfig('template', templateConfig);

const capabilityRequired = schema?.properties?.capabilities?.required ?? [];
if (!capabilityRequired.includes('seo')) fail('SEO_SCHEMA_CAPABILITY_NOT_REQUIRED', 'schemas/execution-config.schema.json must require capabilities.seo');
const enabledSeoLevels = ['LITE','STANDARD','FULL'];
const releaseGuard = (schema?.allOf ?? []).some((rule) => {
  const levels = rule?.if?.properties?.capabilities?.properties?.seo?.enum;
  const releaseConst = rule?.then?.properties?.seo?.properties?.requiredForRelease?.const;
  return Array.isArray(levels) && enabledSeoLevels.every((level) => levels.includes(level)) && releaseConst === true;
});
if (!releaseGuard) fail('SEO_SCHEMA_RELEASE_GUARD_MISSING', 'execution config schema must structurally require requiredForRelease=true for every enabled SEO level');

const requiredSeoSkills = [
  'skill.seo-gate','skill.seo-audit'
];
function routedResources(routing) {
  const out = new Set();
  const resourceKeys = new Set(['roles','skills','rules','workflows','contracts','templates']);
  function visit(value, key = '') {
    if (Array.isArray(value)) {
      if (resourceKeys.has(key)) for (const item of value) if (typeof item === 'string') out.add(item);
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey);
  }
  visit(routing ?? {});
  return out;
}
function checkManifest(label, manifest) {
  if (!manifest) return;
  const skills = new Set((manifest.resources?.skills ?? []).map((item) => item.id));
  for (const id of requiredSeoSkills) if (!skills.has(id)) fail('SEO_AGENT_RESOURCE_MISSING', `${label}: ${id}`);
  const rules = new Set((manifest.resources?.rules ?? []).map((item) => item.id));
  const contracts = new Set((manifest.resources?.contracts ?? []).map((item) => item.id));
  if (!rules.has('rule.seo-authority')) fail('SEO_AGENT_RESOURCE_MISSING', `${label}: rule.seo-authority`);
  if (!contracts.has('contract.seo-surface')) fail('SEO_AGENT_RESOURCE_MISSING', `${label}: contract.seo-surface`);
  const routed = routedResources(manifest.routing);
  for (const id of [...requiredSeoSkills, 'rule.seo-authority', 'contract.seo-surface']) {
    if (!routed.has(id)) fail('SEO_AGENT_RESOURCE_UNROUTABLE', `${label}: ${id}`);
  }
}
checkManifest('root manifest', rootManifest);
checkManifest('template manifest', templateManifest);

function requirePattern(rel, pattern, description, code = 'SEO_DISTRIBUTION_WIRING_MISSING') {
  if (!exists(rel)) { fail('SEO_DISTRIBUTION_COMPONENT_MISSING', rel); return; }
  if (!pattern.test(read(rel))) fail(code, `${rel}: ${description}`);
}
function forbidPattern(rel, pattern, description, code) {
  if (!exists(rel)) { fail('SEO_DISTRIBUTION_COMPONENT_MISSING', rel); return; }
  if (pattern.test(read(rel))) fail(code, `${rel}: ${description}`);
}

// Executable wiring is checked against code structure rather than loose token presence.
requirePattern('bin/init-project.mjs', /capabilityNames\s*=\s*\[[^\]]*['"]seo['"][^\]]*\]/s, 'SEO must be a bootstrap capability');
for (const [profile, level] of [['LITE','LITE'],['STANDARD','STANDARD'],['FULL','FULL']]) {
  requirePattern('bin/init-project.mjs', new RegExp(`${profile}:\\s*\\{[^}]*seo:\\s*['\"]${level}['\"]`, 's'), `${profile} bootstrap must bind SEO ${level}`);
}
requirePattern('bin/init-project.mjs', /config\.seo\s*=\s*\{[\s\S]*?requiredForRelease:\s*capabilities\.seo\s*!==\s*['"]NONE['"][\s\S]*?\}/, 'bootstrap must disable the release gate only for SEO NONE');
requirePattern('bin/init-project.mjs', /if\s*\(capabilities\.seo\s*!==\s*['"]NONE['"]\)\s*\{[\s\S]*?templates\/executionkit\.seo\.json[\s\S]*?\}/, 'bootstrap must create the SEO contract only when SEO is enabled');

requirePattern('bin/migrate-current.mjs', /runMigration\(\s*['"]migrate-seo-os\.mjs['"]\s*,\s*args\s*\)/, 'current migration must execute the SEO overlay');
requirePattern('bin/migrate-current.mjs', /values\[i\]\s*===\s*['"]--replace-seo-authority['"]/, 'SEO-only authority replacement flag must not leak into the base migration');
requirePattern('bin/migrate-seo-os.mjs', /requiredForRelease:\s*requested\s*!==\s*['"]NONE['"]/, 'migration must fail closed for enabled SEO release gating');
requirePattern('bin/migrate-seo-os.mjs', /replaceSeoAuthority\s*=\s*args\.includes\(\s*['"]--replace-seo-authority['"]\s*\)/, 'native SEO authority replacement must require an explicit flag');
requirePattern('bin/migrate-seo-os.mjs', /requested\s*!==\s*['"]NONE['"]\s*&&\s*\(!seoAuthorityExisted\s*\|\|\s*replaceSeoAuthority\)/, 'migration must preserve an existing native SEO authority by default');
forbidPattern('bin/migrate-seo-os.mjs', /\[\s*['"]templates\/SEO_OS\.md['"]\s*,\s*['"]docs\/seo\/SEO_OS\.md['"]\s*\]/, 'native project SEO authority must not be part of unconditional managed overwrite', 'SEO_MIGRATION_NATIVE_AUTHORITY_OVERWRITE');
requirePattern('bin/migrate-seo-os.mjs', /fileHash\(todoPath\)\s*!==\s*todoHash/, 'migration must verify canonical TODO byte preservation');

requirePattern('bin/mcp-server.mjs', /registerTool\(['"]executionkit_seo_status['"]/s, 'SEO status MCP tool must be declared');
requirePattern('bin/mcp-server.mjs', /registerTool\(['"]executionkit_seo_validate['"]/s, 'SEO validation MCP tool must be declared');
requirePattern('bin/release-readiness.mjs', /runKitScript\(\s*['"]bin\/validate-seo\.mjs['"]\s*,\s*\[\s*['"]--release['"]\s*\]\s*\)/, 'release readiness must invoke candidate-bound SEO release validation');
requirePattern('bin/validate-execution.mjs', /for\s*\(const name of \[[^\]]*['"]seo['"][^\]]*\]\)/s, 'core Execution validator must include SEO in the capability loop');
requirePattern('bin/validate-execution.mjs', /seo:\s*['"]docs\/seo\/SEO_OS\.md['"]/, 'core Execution validator must require the SEO authority when enabled');
requirePattern('bin/validate-execution.mjs', /SEO_RELEASE_POLICY_BYPASS/, 'core Execution validator must reject an enabled SEO release-gate bypass');
requirePattern('lib/evidence-model.mjs', /const optional\s*=\s*\[[^\]]*config\.seo\?\.contractPath[^\]]*\]/s, 'candidate identity must include the configured SEO contract when present');

requirePattern('lib/antigravity.mjs', /ANTIGRAVITY_SEO_SKILL_MISSING/, 'Antigravity validation must fail closed when its SEO host skill is missing');
requirePattern('lib/antigravity.mjs', /eight current systems/, 'generated Antigravity entry rule must declare the eight-system model');
requirePattern('plugins/antigravity-executionkit/rules/executionkit.md', /all \*\*eight systems\*\*/i, 'Antigravity host rule must invoke all eight systems');
requirePattern('plugins/antigravity-executionkit/rules/executionkit.md', /executionkit_seo_status/, 'Antigravity host rule must expose SEO applicability/status routing');
requirePattern('plugins/antigravity-executionkit/skills/ek-seo/SKILL.md', /executionkit_seo_validate/, 'Antigravity SEO skill must expose SEO validation');
requirePattern('plugins/antigravity-executionkit/skills/ek-seo/SKILL.md', /--release/, 'Antigravity SEO skill must support the S3 release gate');

requirePattern('templates/execution-integrity.yml', /Validate SEO OS applicability and contract[\s\S]*validate-seo\.mjs/, 'generated integrity workflow must execute SEO validation');
requirePattern('.github/workflows/execution-integrity.yml', /workflow_dispatch:/, 'distribution exact-candidate workflow must remain manually dispatched');
requirePattern('.github/workflows/execution-integrity.yml', /runs-on:[\s\S]*self-hosted[\s\S]*project-ai-excutionkit/, 'distribution exact-candidate workflow must remain self-hosted and project-isolated');
requirePattern('.github/workflows/execution-integrity.yml', /run:\s*npm run v4:check/, 'distribution exact-candidate workflow must run the complete v4 source and compatibility validation gate');
requirePattern('.github/workflows/execution-integrity.yml', /run:\s*npm run audit:full/, 'distribution exact-candidate workflow must run the independent release-boundary audit');
forbidPattern('.github/workflows/execution-integrity.yml', /run:\s*npm run release:check/, 'exact-candidate audit workflow must not pull strict canonical-closure release readiness ahead of the promotion task', 'SEO_EXACT_AUDIT_RELEASE_CIRCULARITY');

requirePattern('templates/TODO.md', /<!-- TASK:EK00-005S -->[\s\S]*validate-seo\.mjs[\s\S]*<!-- \/TASK -->/, 'deep-integration TODO must contain the canonical SEO reconciliation task and verification');
requirePattern('docs/adoption/deep-integration.md', /EK00-005S[\s\S]*SEO OS|SEO OS[\s\S]*EK00-005S/, 'deep-integration authority must bind EK00-005S to SEO OS');
requirePattern('STANDARD_V3.md', /exactly \*\*eight systems\*\*/i, 'current standard must declare exactly eight systems');
requirePattern('STANDARD_V3.md', /first seven are capability authorities/i, 'current standard must distinguish the seven capability authorities from State OS');

// Current adoption/operator documents must not drift back to the pre-SEO capability model.
const currentAdoptionChecks = [
  ['docs/adoption/new-project-bootstrap.md', [/current 3\.x/i, /seven capability authorities/i, /State OS as system #8/i, /--seo NONE/i, /requiredForRelease/i, /eight-system host bundle/i]],
  ['docs/adoption/pre-execution-reconciliation.md', [/seven capability-authority levels/i, /State OS.*system #8/is, /SEO OS/i, /SEQUENTIAL/i, /\bS3\b/i, /\bS4\b/i, /\bS5\b/i]],
  ['docs/adoption/migration-policy.md', [/--replace-seo-contract/i, /--replace-seo-authority/i, /docs\/seo\/SEO_OS\.md/i, /preserve/i]],
];
for (const [rel, patterns] of currentAdoptionChecks) {
  for (const pattern of patterns) requirePattern(rel, pattern, `current adoption semantics missing ${pattern}`, 'SEO_CURRENT_ADOPTION_DOC_DRIFT');
}
forbidPattern('docs/adoption/new-project-bootstrap.md', /New Project Bootstrap\s+—\s+v2\.x/i, 'greenfield bootstrap must describe the current 3.x model', 'SEO_CURRENT_ADOPTION_LEGACY_MODEL');
forbidPattern('docs/adoption/new-project-bootstrap.md', /all six capabilities/i, 'current bootstrap may not declare only six capability authorities', 'SEO_CURRENT_ADOPTION_LEGACY_MODEL');
forbidPattern('docs/adoption/pre-execution-reconciliation.md', /all six capability levels/i, 'current reconciliation may not declare only six capability authorities', 'SEO_CURRENT_ADOPTION_LEGACY_MODEL');
forbidPattern('docs/adoption/pre-execution-reconciliation.md', /fresh-v2/i, 'current reconciliation must not use fresh-v2 closure semantics', 'SEO_CURRENT_ADOPTION_LEGACY_MODEL');

// Documentation/template boundary checks remain semantic assertions, not executable substitutes.
const documentationChecks = [
  ['docs/capabilities/execution-os.md', [/SEO OS/i, /canonical task/i]],
  ['docs/capabilities/agent-os.md', [/SEO OS/i, /routing/i]],
  ['docs/capabilities/content-os.md', [/SEO OS/i, /search/i]],
  ['docs/capabilities/audit-os.md', [/SEO OS separately owns/i, /S0 SEO/i, /candidate-bound S3/i]],
  ['docs/capabilities/test-os.md', [/SEO OS separately owns/i, /S3 remains owned by SEO OS/i, /S4\/S5/i]],
  ['docs/capabilities/launch-os.md', [/SEO OS owns/i, /S3 \/ release/i, /S4 \/ production/i, /S5 \/ operations/i]],
  ['docs/architecture/authority-model.md', [/seven capability authorities/i, /State OS as system #8/i, /SEO OS owns/i, /deterministically routable/i, /SEQUENTIAL/i]],
  ['docs/architecture/project-profiles.md', [/current 3\.x/i, /\| SEO \| LITE \| STANDARD \| FULL \|/i, /State OS.*system #8/is, /SEO NONE/i, /SEQUENTIAL/i]],
  ['docs/architecture/reconciliation.md', [/all seven capability authorities/i, /State OS.*system #8/is, /deterministically routable/i, /requiredForRelease=true/i, /\bS3\b/i, /SEQUENTIAL/i]],
  ['docs/architecture/ci-runner-policy.md', [/execution strategy, adequacy, reproducibility and freshness/i, /SEO OS owns search architecture\/indexability criteria and S0–S5 SEO gates/i, /candidate-bound SEO S3/i, /NOT_RUN/i]],
  ['docs/operations/v3-publication-status.md', [/current 3\.x control plane has exactly eight systems/i, /first seven are capability authorities/i, /State OS is cross-cutting system #8/i, /Code presence on `main` is not equivalent/i, /SEO exact-candidate accepted/i]],
  ['docs/operations/v3-release-validation.md', [/independent SEO exact-candidate audit/i, /npm run check && npm run audit:full/i, /release:check.*strict Launch\/release-readiness gate/is, /\bS3\b/i, /\bS4\b/i, /\bS5\b/i, /NOT_RUN/i]],
  ['templates/EXECUTION_OS.md', [/SEO OS/i, /State OS/i]],
  ['templates/AGENT_OS.md', [/SEO OS/i, /State OS/i]],
  ['templates/AUDIT_OS.md', [/SEO OS owns/i, /S0 SEO/i, /S3/i]],
  ['templates/TEST_OS.md', [/SEO OS owns/i, /S3/i, /S4\/S5/i]],
  ['templates/LAUNCH_OS.md', [/REL-SEO/i, /S3/i, /S4/i, /S5/i]],
  ['templates/SEO_OS.md', [/TODO\.md/i, /S0/i, /S5/i]],
];
for (const [rel, patterns] of documentationChecks) {
  for (const pattern of patterns) requirePattern(rel, pattern, `missing semantic boundary ${pattern}`);
}
forbidPattern('docs/architecture/project-profiles.md', /Project Profiles\s+—\s+v2\.x/i, 'current profiles must not expose the pre-SEO model', 'SEO_CURRENT_ARCHITECTURE_LEGACY_MODEL');
forbidPattern('docs/architecture/project-profiles.md', /autonomous\/parallel AI execution/i, 'current profiles must not imply parallel canonical execution', 'SEO_CURRENT_ARCHITECTURE_LEGACY_MODEL');
forbidPattern('docs/architecture/ci-runner-policy.md', /Test OS owns \*\*what must be verified, at which gate, and what evidence is required\*\*/i, 'Test OS must not absorb SEO/Launch gate ownership', 'SEO_TEST_AUTHORITY_OVERREACH');
forbidPattern('docs/operations/v3-publication-status.md', /State OS as cross-cutting system #7/i, 'current publication status must not describe State OS as current system seven', 'SEO_CURRENT_PUBLICATION_LEGACY_MODEL');
forbidPattern('docs/operations/v3-release-validation.md', /npm run check && npm run audit:full && npm run release:check/i, 'independent SEO audit must not require strict release readiness while promotion work remains non-terminal', 'SEO_EXACT_AUDIT_RELEASE_CIRCULARITY');

for (const size of ['small','medium','large']) {
  try {
    const cfg = parse(`examples/${size}/execution.config.json`);
    if (!Object.hasOwn(cfg.capabilities ?? {}, 'seo')) fail('SEO_EXAMPLE_DECISION_MISSING', `${size}: capabilities.seo`);
    if (!cfg.seo || typeof cfg.seo.requiredForRelease !== 'boolean') fail('SEO_EXAMPLE_POLICY_MISSING', `${size}: seo.requiredForRelease`);
  } catch (error) { fail('SEO_EXAMPLE_CONFIG_INVALID', `${size}: ${error.message}`); }
}

for (const rel of ['tests/seo-os.test.mjs','tests/seo-execution-integration.test.mjs','tests/antigravity-seo.test.mjs']) {
  if (!baseline?.requiredFiles?.includes(rel)) fail('SEO_TEST_BASELINE_FILE_MISSING', rel);
}
const baselineFloor = Number(baseline?.minimumRuntimeTests ?? 0);
const baselineFiles = Array.isArray(baseline?.requiredFiles) ? baseline.requiredFiles.length : 0;
if (!Number.isInteger(baselineFloor) || baselineFloor < 1) fail('SEO_TEST_BASELINE_INVALID', String(baseline?.minimumRuntimeTests ?? 'MISSING'));
if (exists('AGENTS.md')) {
  const declared = read('AGENTS.md').match(/current branch regression floor is \*\*(\d+) runtime tests across (\d+) required test files\*\*/i);
  // The machine baseline is canonical. Current instructions may link it instead
  // of duplicating counts that drift when required regression files are added.
  const linked = /\[tests\/test-baseline\.json\]\(tests\/test-baseline\.json\)/.test(read('AGENTS.md'));
  if (!declared && !linked) fail('SEO_TEST_BASELINE_DOC_MISSING', 'AGENTS.md must link the canonical tests/test-baseline.json or declare accurate counts');
  if (declared) {
    if (Number(declared[1]) !== baselineFloor) fail('SEO_TEST_BASELINE_DOC_DRIFT', `AGENTS.md=${declared[1]} baseline=${baselineFloor}`);
    if (Number(declared[2]) !== baselineFiles) fail('SEO_TEST_FILECOUNT_DOC_DRIFT', `AGENTS.md=${declared[2]} baseline=${baselineFiles}`);
  }
}
if (exists('TODO.md')) {
  const task = read('TODO.md').match(/<!-- TASK:EK3-015 -->([\s\S]*?)<!-- \/TASK -->/);
  const declared = task?.[1]?.match(/declared \*\*(\d+)-runtime-test\*\* floor/i);
  if (!declared) fail('SEO_TEST_BASELINE_TODO_MISSING', 'EK3-015 evidence must declare the current SEO regression floor');
  else if (Number(declared[1]) > baselineFloor) fail('SEO_TEST_BASELINE_TODO_DRIFT', `EK3-015=${declared[1]} baseline=${baselineFloor}`);
}

if (exists('bin/validate-seo.mjs')) {
  const result = spawnSync(process.execPath, [full('bin/validate-seo.mjs'), root], { cwd:root, encoding:'utf8', timeout:120000, maxBuffer:16*1024*1024, windowsHide:true });
  if (result.error || result.status !== 0) fail('SEO_ROOT_VALIDATION_FAILED', (result.stderr || result.stdout || result.error?.message || '').trim());
}

const output = {
  schemaVersion:'executionkit-seo-distribution/v1',
  status:errors.length ? 'FAIL' : 'PASS',
  capabilityAuthorities:7,
  stateSystem:8,
  minimumRuntimeTests:baselineFloor,
  requiredTestFiles:baselineFiles,
  errors,
};
console.log(JSON.stringify(output, null, 2));
process.exit(errors.length ? 1 : 0);
