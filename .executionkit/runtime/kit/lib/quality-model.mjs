import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadTasks } from './execution-model.mjs';

export const QUALITY_DIMENSIONS = ['functional', 'security', 'data', 'integration', 'visual', 'interaction', 'accessibility', 'responsive', 'content', 'performance', 'seo', 'offline', 'compatibility', 'operations', 'components', 'design-system', 'native-behavior'];
const kinds = ['web', 'flutter', 'api', 'content', 'journey', 'component', 'desktop'];
const uiKinds = new Set(['web', 'flutter', 'component', 'desktop']);
const states = new Set(['loading', 'skeleton', 'empty', 'error', 'success', 'disabled', 'permission', 'degraded', 'offline', 'retry', 'conflict']);
const formFactors = new Set(['narrow', 'mobile', 'tablet', 'wide', 'desktop']);
const directions = new Set(['rtl', 'ltr']);
const inputModes = new Set(['touch', 'mouse', 'keyboard', 'screen-reader']);
const text = (value) => typeof value === 'string' && value.trim().length > 0 && !/^(PENDING|TODO|TBD|PLACEHOLDER|N\/A)$/i.test(value.trim());
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text) && new Set(value).size === value.length;
const uniqueTextList = (value, { allowEmpty = false } = {}) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(text) && new Set(value).size === value.length;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fields = {
  contract: ['schemaVersion', 'profile', 'sourcePaths', 'subjects', 'requirements', 'evidencePath', 'premiumPolicy'],
  premiumPolicy: ['designAuthorityPaths', 'referencePaths', 'componentContractPath', 'designContractPath', 'singleTokenAuthority', 'extendBeforeCreate', 'rawPrimitiveBypass', 'legacyDebtPolicy', 'renderedReviewRequired', 'productionShapedDataRequired', 'antiGenericReviewRequired', 'requiredStates', 'requiredFormFactors', 'requiredDirections', 'requiredInputModes', 'supportedThemes', 'platformNotes'],
  subject: ['id', 'kind', 'scope', 'surface', 'role', 'indexable', 'offline', 'requiredDimensions'],
  requirement: ['id', 'subjectId', 'dimension', 'criterion', 'verification', 'method', 'taskIds'],
  report: ['schemaVersion', 'results'],
  result: ['requirementId', 'outcome', 'observedAt', 'producer', 'reviewer', 'environment', 'verification', 'exitCode', 'sourceHashes', 'artifacts'],
  artifact: ['path', 'sha256'],
};
function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i);
  if (!parts) return NaN;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(value);
}
export function projectFile(root, relative) {
  if (!text(relative) || path.isAbsolute(relative) || relative.includes('\\')) throw new Error(`Expected a portable project-relative path: ${relative}`);
  const full = path.resolve(root, relative), rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path outside project: ${relative}`);
  let current = full;
  while (current !== path.resolve(root)) {
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Symlink path is not a managed project file: ${relative}`);
    current = path.dirname(current);
  }
  return full;
}
export const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function minimumDimensions(subject, profile, schemaVersion = '1.0.0') {
  const result = ['functional'];
  if (subject.kind === 'api') result.push('security', 'data', 'integration');
  if (subject.kind === 'content') result.push('content');
  if (profile === 'premium' && uiKinds.has(subject.kind)) {
    result.push('visual', 'interaction', 'accessibility', 'responsive', 'content', 'performance');
    if (schemaVersion === '1.1.0') result.push('components', 'design-system');
    if (schemaVersion === '1.1.0' && ['flutter', 'desktop'].includes(subject.kind)) result.push('native-behavior');
  }
  if (subject.indexable === true) result.push('seo');
  if (subject.offline === true) result.push('offline');
  return [...new Set(result)];
}

function validatePremiumPolicy(contract, fail) {
  const policy = contract.premiumPolicy;
  if (!object(policy)) {
    fail('QUALITY_PREMIUM_POLICY_MISSING', 'premium schemaVersion 1.1.0 requires premiumPolicy');
    return [];
  }
  for (const key of Object.keys(policy)) if (!fields.premiumPolicy.includes(key)) fail('QUALITY_UNKNOWN_FIELD', `premiumPolicy: unsupported field ${key}`);
  const required = ['designAuthorityPaths', 'referencePaths', 'componentContractPath', 'designContractPath', 'singleTokenAuthority', 'extendBeforeCreate', 'rawPrimitiveBypass', 'legacyDebtPolicy', 'renderedReviewRequired', 'productionShapedDataRequired', 'antiGenericReviewRequired', 'requiredStates', 'requiredFormFactors', 'requiredDirections', 'requiredInputModes'];
  for (const key of required) if (!Object.hasOwn(policy, key)) fail('QUALITY_PREMIUM_POLICY_INCOMPLETE', `premiumPolicy requires ${key}`);
  if (!uniqueTextList(policy.designAuthorityPaths)) fail('QUALITY_DESIGN_AUTHORITY_MISSING', 'premiumPolicy.designAuthorityPaths must name at least one canonical token/theme/design authority');
  if (!uniqueTextList(policy.referencePaths, { allowEmpty: true })) fail('QUALITY_REFERENCE_PATHS_INVALID', 'premiumPolicy.referencePaths must be a unique text array');
  if (!text(policy.componentContractPath)) fail('QUALITY_COMPONENT_CONTRACT_MISSING', 'premiumPolicy.componentContractPath must identify the canonical reusable-component registry/contract');
  if (!text(policy.designContractPath)) fail('QUALITY_DESIGN_CONTRACT_MISSING', 'premiumPolicy.designContractPath must identify the canonical design-system governance contract');
  if (policy.singleTokenAuthority !== true) fail('QUALITY_TOKEN_AUTHORITY_WEAK', 'premium UI requires a single canonical token authority with delegated aliases only');
  if (policy.extendBeforeCreate !== true) fail('QUALITY_COMPONENT_REUSE_WEAK', 'premium UI requires extend-before-create component governance');
  if (policy.rawPrimitiveBypass !== 'forbid-when-covered') fail('QUALITY_COMPONENT_BYPASS_ALLOWED', 'premium UI must forbid raw primitive bypass when a canonical component covers the capability');
  if (!['shrink-only', 'none'].includes(policy.legacyDebtPolicy)) fail('QUALITY_LEGACY_DEBT_POLICY', 'legacyDebtPolicy must be shrink-only or none');
  if (policy.renderedReviewRequired !== true) fail('QUALITY_RENDERED_REVIEW_REQUIRED', 'premium UI requires rendered independent review, not source inspection alone');
  if (policy.productionShapedDataRequired !== true) fail('QUALITY_PRODUCTION_DATA_REQUIRED', 'premium UI acceptance requires production-shaped data and edge cases');
  if (policy.antiGenericReviewRequired !== true) fail('QUALITY_ANTI_GENERIC_REVIEW_REQUIRED', 'premium UI requires explicit anti-generic/basic/poor experience review');
  if (!Array.isArray(policy.requiredStates) || policy.requiredStates.length < 5 || new Set(policy.requiredStates).size !== policy.requiredStates.length || policy.requiredStates.some((v) => !states.has(v))) fail('QUALITY_STATE_MATRIX_INVALID', 'premiumPolicy.requiredStates requires at least five recognized unique product states');
  for (const core of ['loading', 'empty', 'error', 'success', 'disabled']) if (!Array.isArray(policy.requiredStates) || !policy.requiredStates.includes(core)) fail('QUALITY_STATE_MATRIX_GAP', `premiumPolicy.requiredStates must include core state ${core}`);
  if (!Array.isArray(policy.requiredFormFactors) || policy.requiredFormFactors.length < 2 || new Set(policy.requiredFormFactors).size !== policy.requiredFormFactors.length || policy.requiredFormFactors.some((v) => !formFactors.has(v))) fail('QUALITY_FORM_FACTORS_INVALID', 'premiumPolicy.requiredFormFactors requires at least two recognized unique form factors');
  if (!Array.isArray(policy.requiredDirections) || !policy.requiredDirections.length || new Set(policy.requiredDirections).size !== policy.requiredDirections.length || policy.requiredDirections.some((v) => !directions.has(v))) fail('QUALITY_DIRECTIONS_INVALID', 'premiumPolicy.requiredDirections requires rtl and/or ltr truthfully as applicable');
  if (!Array.isArray(policy.requiredInputModes) || policy.requiredInputModes.length < 2 || new Set(policy.requiredInputModes).size !== policy.requiredInputModes.length || policy.requiredInputModes.some((v) => !inputModes.has(v))) fail('QUALITY_INPUT_MODES_INVALID', 'premiumPolicy.requiredInputModes requires at least two recognized input modes');
  if (Object.hasOwn(policy, 'supportedThemes') && (!Array.isArray(policy.supportedThemes) || new Set(policy.supportedThemes).size !== policy.supportedThemes.length || policy.supportedThemes.some((v) => !['light', 'dark', 'system'].includes(v)))) fail('QUALITY_THEMES_INVALID', 'premiumPolicy.supportedThemes contains unsupported or duplicate values');
  if (Object.hasOwn(policy, 'platformNotes') && typeof policy.platformNotes !== 'string') fail('QUALITY_PLATFORM_NOTES_INVALID', 'premiumPolicy.platformNotes must be text');
  return [
    ...(Array.isArray(policy.designAuthorityPaths) ? policy.designAuthorityPaths : []),
    ...(Array.isArray(policy.referencePaths) ? policy.referencePaths : []),
    ...(text(policy.componentContractPath) ? [policy.componentContractPath] : []),
    ...(text(policy.designContractPath) ? [policy.designContractPath] : []),
  ];
}

// This validates declared scope and evidence integrity. It never runs commands or
// infers visual quality, factual truth, test adequacy or undiscovered scope.
export function validateQuality(root, config, { release = false, now = Date.now() } = {}) {
  const errors = [], warnings = [];
  const fail = (code, message) => errors.push({ code, message });
  const checkFields = (value, kind, label) => {
    for (const key of Object.keys(value)) if (!fields[kind].includes(key)) fail('QUALITY_UNKNOWN_FIELD', `${label}: unsupported field ${key}`);
  };
  if (!Object.hasOwn(config, 'quality')) return { enabled: false, errors, warnings, requirementCount: 0 };
  if (!object(config.quality) || !text(config.quality.contractPath) || Object.keys(config.quality).some((key) => key !== 'contractPath')) {
    fail('QUALITY_CONFIG_INVALID', 'quality must be an object containing only a non-empty contractPath');
    return { enabled: true, errors, warnings };
  }
  let contract, contractPath;
  try {
    contractPath = config.quality.contractPath;
    contract = JSON.parse(fs.readFileSync(projectFile(root, contractPath), 'utf8'));
  } catch (error) { fail('QUALITY_CONTRACT_INVALID', error.message); return { enabled: true, errors, warnings }; }
  if (!object(contract)) { fail('QUALITY_CONTRACT_INVALID', 'Quality contract must be a JSON object'); return { enabled: true, errors, warnings }; }
  checkFields(contract, 'contract', 'contract');
  if (!['1.0.0', '1.1.0'].includes(contract.schemaVersion)) fail('QUALITY_SCHEMA_VERSION', 'Quality schemaVersion must be 1.0.0 or 1.1.0');
  if (!['standard', 'premium'].includes(contract.profile)) fail('QUALITY_PROFILE_INVALID', 'Quality profile must be standard or premium');
  for (const forbidden of ['tasks', 'queue', 'taskStatuses', 'backlog']) if (Object.hasOwn(contract, forbidden)) fail('QUALITY_SHADOW_STATE', `Quality contract cannot contain ${forbidden}`);

  let premiumSources = [];
  if (contract.schemaVersion === '1.1.0' && contract.profile === 'premium') premiumSources = validatePremiumPolicy(contract, fail);
  else if (Object.hasOwn(contract, 'premiumPolicy') && !object(contract.premiumPolicy)) fail('QUALITY_PREMIUM_POLICY_INVALID', 'premiumPolicy must be an object when declared');

  if (!uniqueTextList(contract.sourcePaths, { allowEmpty: contract.schemaVersion === '1.1.0' && contract.profile === 'premium' })) fail('QUALITY_SOURCES_MISSING', 'sourcePaths must be a unique project-relative file list; v1.0 contracts require at least one source');
  const sources = [...new Set([contractPath, ...(Array.isArray(contract.sourcePaths) ? contract.sourcePaths : []), ...premiumSources])];
  if (sources.length <= 1) fail('QUALITY_SOURCES_MISSING', 'Quality acceptance must bind implementation/spec/design/component source files, not only the contract itself');
  for (const rel of sources) {
    try { if (!fs.statSync(projectFile(root, rel)).isFile()) throw new Error(`Not a file: ${rel}`); }
    catch (error) { fail('QUALITY_SOURCE_MISSING', error.message); }
  }

  const loaded = loadTasks(root, config);
  errors.push(...loaded.errors);
  const taskIds = new Set(loaded.tasks.map((task) => task.id));
  const subjects = new Map();
  if (!Array.isArray(contract.subjects) || !contract.subjects.length) fail('QUALITY_SUBJECTS_MISSING', 'No product scope inventoried');
  for (const subject of Array.isArray(contract.subjects) ? contract.subjects : []) {
    if (!object(subject)) { fail('QUALITY_SUBJECT_INVALID', 'Subject must be an object'); continue; }
    checkFields(subject, 'subject', `subject ${subject.id}`);
    for (const flag of ['indexable', 'offline']) if (Object.hasOwn(subject, flag) && typeof subject[flag] !== 'boolean') fail('QUALITY_SUBJECT_FLAG', `${subject.id}: ${flag} must be boolean`);
    for (const key of ['surface', 'role']) if (Object.hasOwn(subject, key) && !text(subject[key])) fail('QUALITY_SUBJECT_CONTEXT', `${subject.id}: ${key} must be meaningful text`);
    if (!text(subject.id) || subjects.has(subject.id)) fail('QUALITY_SUBJECT_ID', `Invalid/duplicate subject ${subject.id}`);
    if (!kinds.includes(subject.kind)) fail('QUALITY_SUBJECT_KIND', `Unknown kind for ${subject.id}`);
    if (!text(subject.scope)) fail('QUALITY_SUBJECT_SCOPE', `${subject.id} needs concrete route, component, journey or content scope`);
    if (!list(subject.requiredDimensions) || subject.requiredDimensions.some((d) => !QUALITY_DIMENSIONS.includes(d))) fail('QUALITY_DIMENSIONS_INVALID', `${subject.id} needs recognized requiredDimensions`);
    for (const dim of minimumDimensions(subject, contract.profile, contract.schemaVersion)) if (!Array.isArray(subject.requiredDimensions) || !subject.requiredDimensions.includes(dim)) fail('QUALITY_DIMENSION_OMITTED', `${subject.id} requires ${dim}`);
    if (contract.schemaVersion === '1.1.0' && contract.profile === 'premium' && uiKinds.has(subject.kind)) {
      if (!text(subject.surface)) fail('QUALITY_SURFACE_CONTEXT_MISSING', `${subject.id}: premium UI subjects must declare the product surface/shell they belong to`);
      if (!text(subject.role)) fail('QUALITY_ROLE_CONTEXT_MISSING', `${subject.id}: premium UI subjects must declare the intended user role/audience`);
      const policy = contract.premiumPolicy;
      if (object(policy)) {
        if (subject.kind === 'web') {
          for (const mode of ['touch', 'keyboard', 'screen-reader']) if (!policy.requiredInputModes?.includes(mode)) fail('QUALITY_WEB_INPUT_GAP', `${subject.id}: premium web must cover ${mode}`);
          for (const factor of ['mobile', 'desktop']) if (!policy.requiredFormFactors?.includes(factor)) fail('QUALITY_WEB_FORM_FACTOR_GAP', `${subject.id}: premium web must cover ${factor}`);
        }
        if (subject.kind === 'flutter') for (const mode of ['touch', 'screen-reader']) if (!policy.requiredInputModes?.includes(mode)) fail('QUALITY_FLUTTER_INPUT_GAP', `${subject.id}: premium Flutter must cover ${mode}`);
        if (subject.kind === 'desktop') for (const mode of ['mouse', 'keyboard', 'screen-reader']) if (!policy.requiredInputModes?.includes(mode)) fail('QUALITY_DESKTOP_INPUT_GAP', `${subject.id}: premium desktop must cover ${mode}`);
        if (subject.offline === true) for (const state of ['offline', 'retry']) if (!policy.requiredStates?.includes(state)) fail('QUALITY_OFFLINE_STATE_GAP', `${subject.id}: offline scope requires rendered ${state} state coverage`);
      }
    }
    subjects.set(subject.id, subject);
  }

  const requirements = new Map(), coverage = new Set();
  if (!Array.isArray(contract.requirements) || !contract.requirements.length) fail('QUALITY_REQUIREMENTS_MISSING', 'No verifiable requirements declared');
  for (const requirement of Array.isArray(contract.requirements) ? contract.requirements : []) {
    if (!object(requirement)) { fail('QUALITY_REQUIREMENT_INVALID', 'Requirement must be an object'); continue; }
    const r = requirement;
    checkFields(r, 'requirement', `requirement ${r.id}`);
    if (!text(r.id) || requirements.has(r.id)) fail('QUALITY_REQUIREMENT_ID', `Invalid/duplicate requirement ${r.id}`);
    if (!subjects.has(r.subjectId)) fail('QUALITY_SUBJECT_UNKNOWN', `${r.id}: unknown subject ${r.subjectId}`);
    if (!QUALITY_DIMENSIONS.includes(r.dimension)) fail('QUALITY_DIMENSION_UNKNOWN', `${r.id}: ${r.dimension}`);
    if (!text(r.criterion) || !text(r.verification)) fail('QUALITY_CRITERION_MISSING', `${r.id} needs a measurable criterion and reproducible verification command/procedure`);
    if (!['automated', 'review'].includes(r.method)) fail('QUALITY_METHOD_INVALID', `${r.id}: method must be automated or review`);
    if (r.dimension === 'visual' && r.method !== 'review') fail('QUALITY_VISUAL_REVIEW_REQUIRED', `${r.id}: visual acceptance needs an independent review of rendered output`);
    if (!list(r.taskIds)) fail('QUALITY_TASK_LINK_MISSING', `${r.id} must map to canonical task IDs`);
    else for (const id of r.taskIds) if (!taskIds.has(id)) fail('QUALITY_TASK_UNKNOWN', `${r.id}: unknown canonical task ${id}`);
    for (const key of ['status', 'state', 'done', 'progress']) if (Object.hasOwn(r, key)) fail('QUALITY_SHADOW_STATE', `${r.id}: task state belongs in TODO, not ${key}`);
    requirements.set(r.id, r); coverage.add(`${r.subjectId}:${r.dimension}`);
  }
  for (const subject of subjects.values()) for (const dim of Array.isArray(subject.requiredDimensions) ? subject.requiredDimensions : []) if (!coverage.has(`${subject.id}:${dim}`)) fail('QUALITY_COVERAGE_GAP', `${subject.id} has no ${dim} requirement`);
  if (config.capabilities?.content === 'NONE' && [...subjects.values()].some((s) => s.kind === 'content')) fail('QUALITY_CONTENT_DISABLED', 'Managed content subjects require an enabled Content capability');

  let evidenceFile;
  try { evidenceFile = projectFile(root, contract.evidencePath); }
  catch (error) { fail('QUALITY_EVIDENCE_PATH', error.message); }
  if (sources.includes(contract.evidencePath)) fail('QUALITY_EVIDENCE_SELF_HASH', 'Evidence must not be one of its own input sources');
  if (release && errors.length === 0) {
    let report, reportLoaded = false;
    try { report = JSON.parse(fs.readFileSync(evidenceFile, 'utf8')); reportLoaded = true; }
    catch (error) { fail('QUALITY_EVIDENCE_MISSING', error.message); }
    if (reportLoaded && !object(report)) fail('QUALITY_EVIDENCE_FORMAT', 'Evidence must be a JSON object, never null, a primitive or an array');
    if (object(report)) {
      checkFields(report, 'report', 'report');
      if (report.schemaVersion !== '1.0.0' || !Array.isArray(report.results)) fail('QUALITY_EVIDENCE_FORMAT', 'Evidence requires schemaVersion 1.0.0 and results array');
      const byId = new Map();
      for (const result of Array.isArray(report.results) ? report.results : []) {
        if (!object(result)) { fail('QUALITY_RESULT_INVALID', 'Result must be an object'); continue; }
        checkFields(result, 'result', `result ${result.requirementId}`);
        if (Object.hasOwn(result, 'reviewer') && !text(result.reviewer)) fail('QUALITY_REVIEWER_INVALID', `${result.requirementId}: reviewer must be non-empty text`);
        if (Object.hasOwn(result, 'exitCode') && !Number.isInteger(result.exitCode)) fail('QUALITY_EXIT_CODE_INVALID', `${result.requirementId}: exitCode must be an integer`);
        if (!object(result.sourceHashes) || !Object.values(result.sourceHashes).every(hash)) fail('QUALITY_HASHES_INVALID', `${result.requirementId}: sourceHashes must map paths to SHA-256 strings`);
        if (!requirements.has(result.requirementId) || byId.has(result.requirementId)) fail('QUALITY_RESULT_ID', `Unknown/duplicate evidence for ${result.requirementId}`);
        byId.set(result.requirementId, result);
      }
      for (const r of requirements.values()) {
        const result = byId.get(r.id);
        if (!result || result.outcome !== 'PASS') { fail('QUALITY_GATE_NOT_PASSED', `${r.id}: ${result?.outcome ?? 'NOT_RUN'}`); continue; }
        const observed = timestamp(result.observedAt);
        if (!Number.isFinite(observed) || observed > now + 60000) fail('QUALITY_EVIDENCE_TIME', `${r.id}: invalid/future observedAt`);
        if (!text(result.producer) || !text(result.environment) || result.verification !== r.verification) fail('QUALITY_EVIDENCE_CONTEXT', `${r.id}: producer, environment and exact verification are required`);
        if (r.method === 'review' && (!text(result.reviewer) || result.reviewer.trim().toLowerCase() === String(result.producer).trim().toLowerCase())) fail('QUALITY_REVIEW_NOT_INDEPENDENT', `${r.id}: reviewer must differ from implementation producer`);
        if (r.method === 'automated' && result.exitCode !== 0) fail('QUALITY_COMMAND_NOT_PASSED', `${r.id}: successful process exitCode required`);
        for (const rel of sources) if (result.sourceHashes?.[rel] !== sha256(projectFile(root, rel))) fail('QUALITY_STALE_EVIDENCE', `${r.id}: evidence does not match current source ${rel}`);
        if (!Array.isArray(result.artifacts) || !result.artifacts.length) fail('QUALITY_ARTIFACT_MISSING', `${r.id}: output artifacts required`);
        else for (const artifact of result.artifacts) {
          if (!object(artifact)) { fail('QUALITY_ARTIFACT_INVALID', `${r.id}: artifact must be an object`); continue; }
          checkFields(artifact, 'artifact', `artifact ${artifact.path}`);
          try { if (!hash(artifact.sha256) || artifact.sha256 !== sha256(projectFile(root, artifact.path))) throw new Error(`Missing/modified artifact ${artifact.path}`); }
          catch (error) { fail('QUALITY_ARTIFACT_INVALID', `${r.id}: ${error.message}`); }
        }
      }
    }
  }
  return { enabled: true, profile: contract.profile, contractPath, evidencePath: contract.evidencePath, evidenceRequired: release, errors, warnings, requirementCount: requirements.size, subjectCount: subjects.size, sources, requirements: [...requirements.values()] };
}
