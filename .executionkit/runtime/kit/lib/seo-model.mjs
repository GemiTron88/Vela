import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';

export const SEO_PROFILES = Object.freeze(['NONE', 'LITE', 'STANDARD', 'FULL']);
export const SEO_APPLICABILITY = Object.freeze(['AUTO', 'ENABLED', 'DISABLED']);
export const SEO_MODES = Object.freeze(['technical', 'content', 'local', 'ecommerce', 'marketplace', 'directory', 'editorial', 'international', 'media', 'programmatic']);
export const SEO_GATES = Object.freeze(['task', 'wave', 'phase', 'release', 'production', 'operations']);

function add(errors, code, message, field = null) { errors.push({ code, message, ...(field ? { field } : {}) }); }
function unique(values) { return Array.isArray(values) && new Set(values).size === values.length; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

export function validateSeoContractObject(contract) {
  const errors = [];
  if (!isObject(contract)) return { ok: false, errors: [{ code: 'SEO_CONTRACT_INVALID', message: 'SEO contract must be a JSON object' }] };
  if (contract.schemaVersion !== '1.0.0') add(errors, 'SEO_SCHEMA_VERSION_INVALID', 'schemaVersion must be 1.0.0', 'schemaVersion');
  if (!SEO_APPLICABILITY.includes(contract.applicability)) add(errors, 'SEO_APPLICABILITY_INVALID', `applicability must be one of ${SEO_APPLICABILITY.join(', ')}`, 'applicability');
  if (!SEO_PROFILES.includes(contract.profile)) add(errors, 'SEO_PROFILE_INVALID', `profile must be one of ${SEO_PROFILES.join(', ')}`, 'profile');
  if (!Array.isArray(contract.modes) || !unique(contract.modes) || contract.modes.some((mode) => !SEO_MODES.includes(mode))) add(errors, 'SEO_MODES_INVALID', 'modes must be a unique array of supported SEO modes', 'modes');
  if (contract.applicability === 'DISABLED' && (!contract.applicabilityRationale || !String(contract.applicabilityRationale).trim())) add(errors, 'SEO_DISABLED_RATIONALE_REQUIRED', 'DISABLED applicability requires applicabilityRationale', 'applicabilityRationale');
  if (contract.applicability === 'DISABLED' && contract.profile !== 'NONE') add(errors, 'SEO_DISABLED_PROFILE_MISMATCH', 'DISABLED applicability requires profile NONE', 'profile');

  const families = contract.surfaceFamilies;
  if (!Array.isArray(families)) add(errors, 'SEO_SURFACES_INVALID', 'surfaceFamilies must be an array', 'surfaceFamilies');
  else {
    const ids = new Set();
    for (let i = 0; i < families.length; i += 1) {
      const family = families[i], prefix = `surfaceFamilies[${i}]`;
      if (!isObject(family)) { add(errors, 'SEO_SURFACE_INVALID', 'surface family must be an object', prefix); continue; }
      if (!/^SEO-SURFACE-[A-Z0-9][A-Z0-9_-]*$/.test(family.id ?? '')) add(errors, 'SEO_SURFACE_ID_INVALID', 'surface family id must match SEO-SURFACE-*', `${prefix}.id`);
      else if (ids.has(family.id)) add(errors, 'SEO_SURFACE_ID_DUPLICATE', `duplicate surface family id ${family.id}`, `${prefix}.id`);
      else ids.add(family.id);
      for (const key of ['routePattern', 'surfaceType', 'primaryIntent']) if (!String(family[key] ?? '').trim()) add(errors, 'SEO_SURFACE_FIELD_REQUIRED', `${key} is required`, `${prefix}.${key}`);
      if (!['INDEX', 'NOINDEX', 'CONDITIONAL'].includes(family.indexPolicy)) add(errors, 'SEO_INDEX_POLICY_INVALID', 'invalid indexPolicy', `${prefix}.indexPolicy`);
      if (!['SELF', 'PARENT', 'PRIMARY_VARIANT', 'CUSTOM'].includes(family.canonicalPolicy)) add(errors, 'SEO_CANONICAL_POLICY_INVALID', 'invalid canonicalPolicy', `${prefix}.canonicalPolicy`);
      if (!Array.isArray(family.requiredValue) || !family.requiredValue.length || !unique(family.requiredValue) || family.requiredValue.some((value) => !String(value).trim())) add(errors, 'SEO_REQUIRED_VALUE_INVALID', 'requiredValue must contain unique non-empty value requirements', `${prefix}.requiredValue`);
      if (!Array.isArray(family.verificationSamples) || !family.verificationSamples.length || !unique(family.verificationSamples) || family.verificationSamples.some((value) => !String(value).trim())) add(errors, 'SEO_VERIFICATION_SAMPLES_INVALID', 'verificationSamples must contain unique non-empty samples', `${prefix}.verificationSamples`);
      if (family.programmatic === true && family.indexPolicy !== 'NOINDEX' && !(Number.isInteger(family.coverageThreshold) && family.coverageThreshold >= 0)) add(errors, 'SEO_PROGRAMMATIC_THRESHOLD_REQUIRED', 'indexable/conditional programmatic surfaces require a non-negative coverageThreshold', `${prefix}.coverageThreshold`);
    }
  }
  if (contract.profile === 'NONE' && Array.isArray(families) && families.length) add(errors, 'SEO_NONE_HAS_SURFACES', 'profile NONE cannot declare SEO surface families', 'surfaceFamilies');

  if (!isObject(contract.gates)) add(errors, 'SEO_GATES_INVALID', 'gates must be an object', 'gates');
  else for (const gate of SEO_GATES) {
    const value = contract.gates[gate];
    if (!isObject(value) || typeof value.required !== 'boolean') add(errors, 'SEO_GATE_INVALID', `${gate} gate must declare required boolean`, `gates.${gate}`);
    else if (value.checks !== undefined && (!Array.isArray(value.checks) || !unique(value.checks) || value.checks.some((check) => !String(check).trim()))) add(errors, 'SEO_GATE_CHECKS_INVALID', `${gate} checks must be unique non-empty strings`, `gates.${gate}.checks`);
  }

  const programmatic = contract.programmaticPolicy;
  if (contract.modes?.includes('programmatic')) {
    if (!isObject(programmatic)) add(errors, 'SEO_PROGRAMMATIC_POLICY_REQUIRED', 'programmatic mode requires programmaticPolicy', 'programmaticPolicy');
    else {
      if (programmatic.defaultIndexEligibility !== 'PROVEN_ONLY') add(errors, 'SEO_PROGRAMMATIC_FAIL_CLOSED', 'programmatic mode must default index eligibility to PROVEN_ONLY', 'programmaticPolicy.defaultIndexEligibility');
      if (programmatic.requireDistinctIntent !== true || programmatic.requireDistinctVisibleValue !== true) add(errors, 'SEO_PROGRAMMATIC_VALUE_GUARD_REQUIRED', 'programmatic mode requires distinct intent and visible value guards', 'programmaticPolicy');
      if (programmatic.emptyPagesIndexable !== false) add(errors, 'SEO_PROGRAMMATIC_EMPTY_INDEX_FORBIDDEN', 'programmatic empty pages must not be indexable by default', 'programmaticPolicy.emptyPagesIndexable');
    }
  }
  if (contract.structuredDataRegistry !== undefined && !isObject(contract.structuredDataRegistry)) {
    add(errors, 'SEO_STRUCTURED_DATA_REGISTRY_INVALID', 'structuredDataRegistry must be an object', 'structuredDataRegistry');
  }
  if (contract.localeStrategy !== undefined && !isObject(contract.localeStrategy)) {
    add(errors, 'SEO_LOCALE_STRATEGY_INVALID', 'localeStrategy must be an object', 'localeStrategy');
  }

  return { ok: errors.length === 0, errors };
}


export function inferSeoApplicabilityFromRepository(root){
  const signals=[];
  const add=(rel)=>{const full=path.join(root,...rel.split('/'));if(fs.existsSync(full))signals.push(rel);};
  for(const rel of [
    'resources/views',
    'public/index.html',
    'src/pages',
    'src/app',
    'pages',
    'astro.config.mjs',
    'astro.config.ts',
    'next.config.js',
    'next.config.mjs',
    'nuxt.config.js',
    'nuxt.config.ts',
    'svelte.config.js',
    'vite.config.js',
    'vite.config.ts'
  ])add(rel);
  const packageFile=path.join(root,'package.json');
  if(fs.existsSync(packageFile)){
    try{
      const pkg=JSON.parse(fs.readFileSync(packageFile,'utf8'));
      const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})};
      for(const name of ['next','nuxt','astro','@sveltejs/kit','vite'])if(deps[name])signals.push('package:'+name);
    }catch{}
  }
  const publicWebSignals=[...new Set(signals)];
  return {
    applicable:publicWebSignals.length>0,
    resolution:publicWebSignals.length?'PUBLIC_WEB_SIGNAL_DETECTED':'NOT_APPLICABLE',
    rationale:publicWebSignals.length?'Repository contains public-web-capable surfaces; SEO applicability must be resolved by contract.':'No public-web-capable surface was detected; native/backend-only repository is SEO-not-applicable until that changes.',
    signals:publicWebSignals
  };
}

export function resolveSeoContractPath(root, config = {}) {
  const rel = config.seo?.contractPath ?? 'executionkit.seo.json';
  return resolveProjectPathSafe(root, rel, 'SEO contract', { file: true });
}

export function loadSeoContract(root, config = {}, { required = false } = {}) {
  const file = resolveSeoContractPath(root, config);
  if (!fs.existsSync(file)) {
    return { status: required ? 'FAIL' : 'NOT_CONFIGURED', path: path.relative(root, file).replaceAll('\\', '/'), contract: null, errors: required ? [{ code: 'SEO_CONTRACT_MISSING', message: 'SEO contract is required but missing' }] : [] };
  }
  let contract;
  try { contract = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return { status: 'FAIL', path: path.relative(root, file).replaceAll('\\', '/'), contract: null, errors: [{ code: 'SEO_CONTRACT_JSON_INVALID', message: error.message }] }; }
  const validation = validateSeoContractObject(contract);
  const bytes = fs.readFileSync(file);
  return {
    status: validation.ok ? 'PASS' : 'FAIL',
    path: path.relative(root, file).replaceAll('\\', '/'),
    contract,
    contractHash: crypto.createHash('sha256').update(bytes).digest('hex'),
    errors: validation.errors,
  };
}

export function evaluateSeoApplicability(contract) {
  if (!contract) return { applicable: false, resolution: 'NOT_CONFIGURED', rationale: 'No SEO contract is configured' };
  if (contract.applicability === 'DISABLED' || contract.profile === 'NONE') return { applicable: false, resolution: 'NOT_APPLICABLE', rationale: contract.applicabilityRationale ?? 'SEO profile is NONE' };
  if (contract.applicability === 'ENABLED') return { applicable: true, resolution: 'APPLICABLE', rationale: 'SEO explicitly enabled by project contract' };
  const surfaces = Array.isArray(contract.surfaceFamilies) ? contract.surfaceFamilies.length : 0;
  const baseUrls = Array.isArray(contract.publicWeb?.baseUrls) ? contract.publicWeb.baseUrls.length : 0;
  const applicable = surfaces > 0 || baseUrls > 0;
  return { applicable, resolution: applicable ? 'APPLICABLE' : 'NOT_APPLICABLE', rationale: applicable ? 'AUTO found declared public search surfaces/base URLs' : 'AUTO found no declared public search surface yet' };
}

export function seoContractSummary(contract) {
  const applicability = evaluateSeoApplicability(contract);
  return {
    schemaVersion: contract?.schemaVersion ?? null,
    profile: contract?.profile ?? null,
    modes: contract?.modes ?? [],
    surfaceFamilyCount: contract?.surfaceFamilies?.length ?? 0,
    indexableFamilyCount: contract?.surfaceFamilies?.filter((family) => family.indexPolicy !== 'NOINDEX').length ?? 0,
    applicability,
  };
}
