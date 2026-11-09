#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });
const full = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(full(rel)) && fs.statSync(full(rel)).isFile();
const read = (rel) => fs.readFileSync(full(rel), 'utf8');
const parse = (rel) => JSON.parse(read(rel));

const requiredFiles = [
  'README.md',
  'PLAYBOOK.md',
  'STANDARD_V3.md',
  'docs/quality/premium-experience.md',
  'docs/quality/product-quality.md',
  'schemas/execution-config.schema.json',
  'schemas/quality-contract.schema.json',
  'lib/quality-model.mjs',
  'lib/adoption-model.mjs',
  'lib/antigravity.mjs',
  'bin/configure-quality.mjs',
  'bin/validate-quality.mjs',
  'bin/validate-deep-integration.mjs',
  'bin/migrate-current.mjs',
  'bin/migrate-premium-experience.mjs',
  'templates/execution.config.json',
  'templates/quality.contract.json',
  '.agents/manifest.json',
  'templates/.agents/manifest.json',
  '.agents/skills/premium-experience/SKILL.md',
  'templates/.agents/skills/premium-experience/SKILL.md',
  '.agents/skills/component-system/SKILL.md',
  '.agents/skills/design-system/SKILL.md',
  '.agents/skills/design-refinement/SKILL.md',
  'templates/.agents/skills/design-refinement/SKILL.md',
  '.agents/skills/design-refinement/references/unslop-refinement-matrix.md',
  'templates/.agents/skills/design-refinement/references/unslop-refinement-matrix.md',
  '.agents/skills/implementation/SKILL.md',
  'templates/.agents/skills/implementation/SKILL.md',
  'plugins/antigravity-executionkit/rules/executionkit.md',
  'templates/AUDIT_OS.md',
  'templates/TEST_OS.md',
  'templates/LAUNCH_OS.md',
  'tests/adoption.test.mjs',
  'tests/quality.test.mjs',
  'tests/agent-model.test.mjs',
  'tests/premium-experience.test.mjs',
];
for (const rel of requiredFiles) if (!exists(rel)) fail('PREMIUM_DISTRIBUTION_COMPONENT_MISSING', rel);

function requirePattern(rel, pattern, description, code = 'PREMIUM_DISTRIBUTION_WIRING_MISSING') {
  if (!exists(rel)) { fail('PREMIUM_DISTRIBUTION_COMPONENT_MISSING', rel); return; }
  if (!pattern.test(read(rel))) fail(code, `${rel}: ${description}`);
}
function forbidPattern(rel, pattern, description, code = 'PREMIUM_DISTRIBUTION_FORBIDDEN') {
  if (!exists(rel)) { fail('PREMIUM_DISTRIBUTION_COMPONENT_MISSING', rel); return; }
  if (pattern.test(read(rel))) fail(code, `${rel}: ${description}`);
}

let schema, executionSchema, starter, templateConfig, rootManifest, templateManifest;
for (const [rel, assign] of [
  ['schemas/quality-contract.schema.json', (v) => { schema = v; }],
  ['schemas/execution-config.schema.json', (v) => { executionSchema = v; }],
  ['templates/quality.contract.json', (v) => { starter = v; }],
  ['templates/execution.config.json', (v) => { templateConfig = v; }],
  ['.agents/manifest.json', (v) => { rootManifest = v; }],
  ['templates/.agents/manifest.json', (v) => { templateManifest = v; }],
]) {
  try { assign(parse(rel)); } catch (error) { fail('PREMIUM_DISTRIBUTION_JSON_INVALID', `${rel}: ${error.message}`); }
}

function schemaAllows(values, wanted) {
  const actual = Array.isArray(values) ? values : [];
  return wanted.every((value) => actual.includes(value));
}
if (schema) {
  const versions = schema.properties?.schemaVersion?.enum ?? [];
  if (!schemaAllows(versions, ['1.0.0', '1.1.0'])) fail('PREMIUM_SCHEMA_VERSION_MISSING', 'quality schema must preserve 1.0.0 compatibility and expose 1.1.0');
  const kindEnum = schema.properties?.subjects?.items?.properties?.kind?.enum ?? [];
  if (!schemaAllows(kindEnum, ['web', 'flutter', 'component', 'desktop'])) fail('PREMIUM_SCHEMA_UI_KINDS_MISSING', 'quality schema must cover web/flutter/component/desktop subjects');
  const dimensionEnum = schema.properties?.requirements?.items?.properties?.dimension?.enum ?? [];
  if (!schemaAllows(dimensionEnum, ['visual', 'interaction', 'accessibility', 'responsive', 'components', 'design-system', 'native-behavior'])) fail('PREMIUM_SCHEMA_DIMENSIONS_MISSING', 'quality schema must expose premium construction dimensions');
  const policy = schema.properties?.premiumPolicy?.properties ?? {};
  for (const field of ['designAuthorityPaths','referencePaths','componentContractPath','designContractPath','singleTokenAuthority','extendBeforeCreate','rawPrimitiveBypass','legacyDebtPolicy','renderedReviewRequired','productionShapedDataRequired','antiGenericReviewRequired','requiredStates','requiredFormFactors','requiredDirections','requiredInputModes']) {
    if (!Object.hasOwn(policy, field)) fail('PREMIUM_SCHEMA_POLICY_FIELD_MISSING', field);
  }
}

if (executionSchema) {
  const premium = executionSchema.properties?.premiumExperience;
  if (!premium || premium.type !== 'object') fail('PREMIUM_EXECUTION_SCHEMA_MISSING', 'execution config schema must expose premiumExperience as a first-class object');
  const props = premium?.properties ?? {};
  for (const field of ['applicability','qualityProfile','notApplicableReason']) if (!Object.hasOwn(props, field)) fail('PREMIUM_EXECUTION_SCHEMA_FIELD_MISSING', field);
  if (!schemaAllows(props.applicability?.enum, ['UNRESOLVED','REQUIRED','NOT_APPLICABLE'])) fail('PREMIUM_EXECUTION_APPLICABILITY_ENUM', 'premiumExperience applicability must be fail-closed and explicit');
  if (!schemaAllows(props.qualityProfile?.enum, ['UNRESOLVED','premium','standard'])) fail('PREMIUM_EXECUTION_PROFILE_ENUM', 'premiumExperience qualityProfile must expose unresolved/premium/standard states');
}

if (templateConfig) {
  const premium = templateConfig.premiumExperience ?? {};
  if (premium.applicability !== 'UNRESOLVED' || premium.qualityProfile !== 'UNRESOLVED' || premium.notApplicableReason !== '') {
    fail('PREMIUM_BOOTSTRAP_MUST_START_UNRESOLVED', 'greenfield config must not invent UI applicability before project discovery');
  }
}

if (starter) {
  if (starter.schemaVersion !== '1.1.0' || starter.profile !== 'premium') fail('PREMIUM_STARTER_VERSION_INVALID', 'template quality contract must default to premium schema 1.1.0');
  const p = starter.premiumPolicy ?? {};
  for (const [field, expected] of [
    ['singleTokenAuthority', true], ['extendBeforeCreate', true], ['rawPrimitiveBypass', 'forbid-when-covered'],
    ['legacyDebtPolicy', 'shrink-only'], ['renderedReviewRequired', true], ['productionShapedDataRequired', true], ['antiGenericReviewRequired', true],
  ]) if (p[field] !== expected) fail('PREMIUM_STARTER_FAIL_CLOSED_POLICY', `${field} must be ${JSON.stringify(expected)}`);
  for (const state of ['loading','empty','error','success','disabled']) if (!p.requiredStates?.includes(state)) fail('PREMIUM_STARTER_STATE_GAP', state);
  for (const factor of ['mobile','desktop']) if (!p.requiredFormFactors?.includes(factor)) fail('PREMIUM_STARTER_FORM_FACTOR_GAP', factor);
  for (const mode of ['touch','keyboard','screen-reader']) if (!p.requiredInputModes?.includes(mode)) fail('PREMIUM_STARTER_INPUT_GAP', mode);
  if ((p.designAuthorityPaths ?? []).length !== 0) fail('PREMIUM_STARTER_PRETENDS_AUTHORITY', 'starter must remain unreconciled/fail-closed instead of inventing a project design authority');
}

requirePattern('bin/configure-quality.mjs', /--standard is reserved for products with no user-facing UI/i, 'standard quality must not be an escape hatch for UI-bearing products');
requirePattern('bin/configure-quality.mjs', /--non-ui-reason/, 'non-UI standard quality requires an explicit rationale');
requirePattern('bin/configure-quality.mjs', /applicability:\s*standard\s*\?\s*['"]NOT_APPLICABLE['"]\s*:\s*['"]REQUIRED['"]/, 'configuration must write explicit Premium applicability');
requirePattern('bin/configure-quality.mjs', /Premium 1\.1 is mandatory for UI-bearing scope/i, 'configuration must state the fail-closed UI rule');
requirePattern('bin/configure-quality.mjs', /selfContainedStarter/, 'generated projects must be able to configure Premium without a distribution-only template dependency');

requirePattern('bin/migrate-current.mjs', /migrate-seo-os\.mjs[\s\S]*migrate-premium-experience\.mjs/, 'current 3.x migration must run the Premium overlay after the SEO overlay');
requirePattern('bin/migrate-current.mjs', /premiumExperienceIsOperatingSystem:\s*false/, 'current migration must preserve the non-OS boundary');
for (const pattern of [/preservesExistingQualityContract/, /preservesNativeAgentResources/, /applicability:'UNRESOLVED'/, /mergeManagedById/, /existing\?\.native\s*===\s*true/, /todoMutation:false/, /deepIntegrationValidation:'NEXT_CANONICAL_BOUNDARY'/]) {
  requirePattern('bin/migrate-premium-experience.mjs', pattern, `Premium migration preservation/applicability guard missing: ${pattern}`);
}
for (const id of ['skill.premium-experience','skill.component-system','skill.design-system','skill.design-refinement']) requirePattern('bin/migrate-premium-experience.mjs', new RegExp(id.replaceAll('.', '\\.')), `Premium migration must reconcile ${id}`);
forbidPattern('bin/migrate-premium-experience.mjs', /config\.quality\s*=/, 'mechanical Premium migration may not silently replace the project quality contract');
requirePattern('package.json', /"project:migrate:premium"\s*:\s*"node bin\/migrate-premium-experience\.mjs"/, 'package scripts must expose the explicit Premium migration overlay');

for (const code of ['DEEP_INTEGRATION_PREMIUM_APPLICABILITY_UNRESOLVED','DEEP_INTEGRATION_PREMIUM_PROFILE_BYPASS','DEEP_INTEGRATION_PREMIUM_NA_INVALID']) {
  requirePattern('lib/adoption-model.mjs', new RegExp(code), `deep integration model must enforce ${code}`);
}
requirePattern('bin/validate-deep-integration.mjs', /schemaVersion\s*!==\s*['"]1\.1\.0['"]\s*\|\|\s*contract\.profile\s*!==\s*['"]premium['"]/, 'deep integration executable validator must inspect the actual configured contract');
requirePattern('bin/validate-deep-integration.mjs', /validateQuality\(/, 'deep integration acceptance must run structural quality validation');
requirePattern('bin/validate-deep-integration.mjs', /NOT_APPLICABLE requires a concrete evidence-backed non-UI reason/i, 'non-UI exception must be evidence-backed');

requirePattern('lib/quality-model.mjs', /components['"],\s*['"]design-system['"],\s*['"]native-behavior/, 'quality model must expose component/design/native dimensions');
requirePattern('lib/quality-model.mjs', /schemaVersion\s*===\s*['"]1\.1\.0['"][\s\S]*result\.push\(['"]components['"],\s*['"]design-system['"]\)/, 'premium 1.1 UI must require component and design-system acceptance');
requirePattern('lib/quality-model.mjs', /\[['"]flutter['"],\s*['"]desktop['"]\][\s\S]*native-behavior/, 'Flutter/desktop premium must require native-behavior');
for (const code of ['QUALITY_TOKEN_AUTHORITY_WEAK','QUALITY_COMPONENT_REUSE_WEAK','QUALITY_COMPONENT_BYPASS_ALLOWED','QUALITY_RENDERED_REVIEW_REQUIRED','QUALITY_PRODUCTION_DATA_REQUIRED','QUALITY_ANTI_GENERIC_REVIEW_REQUIRED','QUALITY_STATE_MATRIX_GAP','QUALITY_SURFACE_CONTEXT_MISSING','QUALITY_ROLE_CONTEXT_MISSING','QUALITY_OFFLINE_STATE_GAP']) {
  requirePattern('lib/quality-model.mjs', new RegExp(code), `quality model must enforce ${code}`);
}
requirePattern('lib/quality-model.mjs', /designAuthorityPaths[\s\S]*referencePaths[\s\S]*componentContractPath[\s\S]*designContractPath[\s\S]*premiumSources = validatePremiumPolicy/, 'premium authority/reference/governance sources must participate in evidence hashing');

function skillIds(manifest) { return new Set((manifest?.resources?.skills ?? []).map((entry) => entry.id)); }
function supplement(manifest, id) { return (manifest?.routing?.supplements ?? []).find((entry) => entry.id === id); }
function checkManifest(label, manifest) {
  if (!manifest) return;
  const skills = skillIds(manifest);
  for (const id of ['skill.premium-experience','skill.component-system','skill.design-system','skill.design-refinement']) if (!skills.has(id)) fail('PREMIUM_AGENT_RESOURCE_MISSING', `${label}: ${id}`);
  const component = (manifest.resources?.skills ?? []).find((entry) => entry.id === 'skill.component-system');
  const design = (manifest.resources?.skills ?? []).find((entry) => entry.id === 'skill.design-system');
  const refinement = (manifest.resources?.skills ?? []).find((entry) => entry.id === 'skill.design-refinement');
  if (!component?.requires?.includes('skill.premium-experience')) fail('PREMIUM_AGENT_DEPENDENCY_MISSING', `${label}: component-system must depend on premium-experience`);
  if (!design?.requires?.includes('skill.component-system')) fail('PREMIUM_AGENT_DEPENDENCY_MISSING', `${label}: design-system must depend on component-system`);
  if (!refinement?.requires?.includes('skill.design-system')) fail('PREMIUM_AGENT_DEPENDENCY_MISSING', `${label}: design-refinement must depend on design-system`);
  const cases = [
    ['supplement.web-ui', ['livewire','blade','tailwind','alpine'], 'skill.design-system'],
    ['supplement.flutter', ['flutter','mobile','dart'], 'skill.design-system'],
    ['supplement.web-components', ['web-components','custom-elements'], 'skill.design-system'],
  ];
  for (const [id, tags, requiredSkill] of cases) {
    const item = supplement(manifest, id);
    if (!item) { fail('PREMIUM_AGENT_SUPPLEMENT_MISSING', `${label}: ${id}`); continue; }
    for (const tag of tags) if (!item.when?.tagsAny?.includes(tag)) fail('PREMIUM_AGENT_UI_TAG_MISSING', `${label}: ${id} missing ${tag}`);
    if (!item.use?.skills?.includes(requiredSkill)) fail('PREMIUM_AGENT_AUTO_ROUTE_MISSING', `${label}: ${id} must route ${requiredSkill}`);
  }
  const premium = supplement(manifest, 'supplement.premium');
  for (const tag of ['ui','ux','design','premium','components','frontend','page','screen','responsive','accessibility','redesign','refinement','unslop','polish','visual-remediation']) if (!premium?.when?.tagsAny?.includes(tag)) fail('PREMIUM_AGENT_GENERIC_UI_TAG_MISSING', `${label}: ${tag}`);
  for (const id of ['skill.premium-experience','skill.component-system','skill.design-system','skill.design-refinement']) if (!premium?.use?.skills?.includes(id)) fail('PREMIUM_AGENT_PREMIUM_ROUTE_MISSING', `${label}: ${id}`);
}
checkManifest('root manifest', rootManifest);
checkManifest('template manifest', templateManifest);

for (const rel of ['.agents/skills/premium-experience/SKILL.md','templates/.agents/skills/premium-experience/SKILL.md']) {
  for (const [pattern, description] of [
    [/not a ninth OS/i, 'must preserve the cross-cutting/non-OS boundary'],
    [/Extend before create/i, 'must enforce component governance'],
    [/production-shaped/i, 'must require production-shaped acceptance data'],
    [/anti-generic/i, 'must require anti-generic review'],
    [/Render.*inspect.*correct.*re-render/is, 'must require rendered correction loop'],
    [/reviewer must differ/i, 'must require independent visual review'],
    [/safe areas/i, 'must cover Flutter/native behavior'],
  ]) requirePattern(rel, pattern, description);
}
for (const rel of ['.agents/skills/design-refinement/SKILL.md','templates/.agents/skills/design-refinement/SKILL.md']) {
  for (const [pattern, description] of [
    [/Five-Part Design Direction/i, 'must define the 5-part Design Direction'],
    [/No Change.*Light Polish.*Full Refinement/is, 'must define the 3 intervention levels'],
    [/Nine Conceptual Refinement Passes/i, 'must define the 9 conceptual refinement passes'],
    [/Unslop/i, 'must preserve CC BY 4.0 attribution to Unslop'],
  ]) requirePattern(rel, pattern, description);
}
for (const rel of ['.agents/skills/implementation/SKILL.md','templates/.agents/skills/implementation/SKILL.md']) {
  for (const [pattern, description] of [
    [/(?:eight current|ten executable|eleven executable) systems/i, 'skill must use the current system model'],
    [/design-system.*component-system.*premium-experience/i, 'skill must mechanically require the UI skill chain'],
    [/production-shaped/i, 'skill must require production-shaped data'],
    [/render the affected product surface/i, 'skill must require rendered UI verification'],
    [/reviewer distinct/i, 'skill must preserve independent premium review'],
  ]) requirePattern(rel, pattern, description);
}

for (const [rel, patterns] of [
  ['docs/quality/premium-experience.md', [/construction invariant/i, /single design authority/i, /extend before create/i, /state completeness/i, /RTL\/LTR/i, /native-behavior/i, /anti-generic/i, /schema `1\.1\.0`/i]],
  ['docs/quality/product-quality.md', [/premium-experience\.md/, /schema `1\.1\.0`/i, /components.*design-system/is, /native-behavior/i, /UI-bearing/i]],
  ['README.md', [/Premium Experience Layer/i, /mandatory.*UI-bearing/is, /not a ninth OS/i, /configure-quality\.mjs/i]],
  ['PLAYBOOK.md', [/Premium Experience Layer/i, /UI-bearing/i, /Render.*inspect.*correct.*re-render/is, /non-UI/i]],
  ['STANDARD_V3.md', [/Premium Experience/i, /construction invariant/i, /not.*ninth OS/is, /UI-bearing/i]],
  ['plugins/antigravity-executionkit/rules/executionkit.md', [/Premium Experience/i, /not a ninth OS/i, /design-system.*component-system.*premium-experience/i, /production-shaped/i, /rendered review/i, /anti-generic/i]],
  ['lib/antigravity.mjs', [/Premium Experience is a mandatory cross-cutting product-quality contract/i, /design-system.*component-system.*premium-experience/i, /ANTIGRAVITY_PREMIUM_ENTRY_MISSING/]],
  ['templates/AUDIT_OS.md', [/Premium UI\/UX acceptance/i, /component-system conformance/i, /rendered output/i, /AI-generic/i]],
  ['templates/TEST_OS.md', [/Product quality contract/i, /rendered output/i, /phase boundary/i]],
  ['templates/LAUNCH_OS.md', [/Product evidence gate/i, /Missing\/failed\/not-run or stale required results prevent release/i]],
]) for (const pattern of patterns) requirePattern(rel, pattern, `required Premium Experience integration missing: ${pattern}`);

requirePattern('tests/adoption.test.mjs', /greenfield premium quality configuration is self-contained/i, 'adoption regressions must prove Premium bootstrap is self-contained');
requirePattern('tests/adoption.test.mjs', /cannot bypass an explicit quality contract/i, 'adoption regressions must reject quality bypass');
requirePattern('tests/quality.test.mjs', /premium v1\.1 rejects cosmetic policy declarations/i, 'quality regressions must prove the policy cannot be cosmetic');
requirePattern('tests/quality.test.mjs', /premium Flutter requires design-system and native-behavior/i, 'quality regressions must cover Flutter native behavior');
requirePattern('tests/quality.test.mjs', /mutation === ['\"]authority['\"]/i, 'release regressions must invalidate stale design authority evidence');
requirePattern('tests/agent-model.test.mjs', /without a premium tag/i, 'Agent regressions must prove automatic UI-stack Premium routing');
requirePattern('tests/premium-experience.test.mjs', /migrate-premium-experience\.mjs/, 'Premium distribution regression must guard current migration routing');

forbidPattern('docs/quality/premium-experience.md', /ninth OS\s*$/im, 'Premium Experience may not be declared as a ninth OS');

if (errors.length) {
  console.error(`Premium Experience distribution: FAIL (${errors.length} finding${errors.length === 1 ? '' : 's'})`);
  for (const error of errors) console.error(`[${error.code}] ${error.message}`);
  process.exit(1);
}
console.log('Premium Experience distribution: PASS (static/distribution coherence only; no rendered UI, browser/device suite, independent visual acceptance or release certification was executed).');
