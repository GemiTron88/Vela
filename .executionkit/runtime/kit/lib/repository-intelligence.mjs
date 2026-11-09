const ARTIFACT_CLASSES = new Set(['HUMAN_MAINTAINED','GENERATED_PORTABLE','LOCAL_DERIVED']);
const TRUST_STATES = new Set(['TRUSTED','VERIFY','DEGRADED','SOURCE_ONLY','UNAVAILABLE']);
const PROVIDER_STATES = new Set(['NOT_CONFIGURED','NOT_AVAILABLE','INCOMPATIBLE','READY','STALE','FAILED']);
const REFRESH_MODES = new Set(['SKIP','INCREMENTAL','FULL','BLOCKED']);
const EVIDENCE_KINDS = new Set([
  'LIVE_SOURCE',
  'SOURCE_INDEX',
  'RELATIONSHIP_GRAPH',
  'GENERATED_CONTEXT',
  'GENERATED_HUMAN_DOC',
  'HUMAN_DOMAIN_KNOWLEDGE',
  'EXTERNAL_ADVISORY',
]);

export const repositoryIntelligenceEnums = Object.freeze({
  artifactClasses: Object.freeze([...ARTIFACT_CLASSES]),
  trustStates: Object.freeze([...TRUST_STATES]),
  providerStates: Object.freeze([...PROVIDER_STATES]),
  refreshModes: Object.freeze([...REFRESH_MODES]),
  evidenceKinds: Object.freeze([...EVIDENCE_KINDS]),
});

const implementationEvidenceWeights = Object.freeze({
  LIVE_SOURCE: 100,
  SOURCE_INDEX: 90,
  RELATIONSHIP_GRAPH: 80,
  GENERATED_CONTEXT: 60,
  GENERATED_HUMAN_DOC: 50,
  HUMAN_DOMAIN_KNOWLEDGE: 40,
  EXTERNAL_ADVISORY: 20,
});

function result(errors) {
  return { status: errors.length ? 'FAIL' : 'PASS', ok: errors.length === 0, errors };
}
function error(code, message, path = '') { return { code, message, path }; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function validTimestamp(value) { return nonEmptyString(value) && Number.isFinite(Date.parse(value)); }
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{7,64}$/i.test(value); }

export function normalizeKnowledgePath(value) {
  if (!nonEmptyString(value)) throw new Error('Knowledge path must be a non-empty string');
  const input = value.trim();
  if (input.includes('\\')) throw new Error(`Knowledge path must use POSIX separators: ${value}`);
  if (input.startsWith('/') || /^[A-Za-z]:\//.test(input)) throw new Error(`Knowledge path must be repository-relative: ${value}`);
  const parts = input.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe knowledge path: ${value}`);
  return parts.join('/');
}

export function implementationEvidenceRank(kind) {
  if (!EVIDENCE_KINDS.has(kind)) throw new Error(`Unknown repository evidence kind: ${kind}`);
  return implementationEvidenceWeights[kind];
}

export function compareImplementationEvidence(left, right) {
  return Math.sign(implementationEvidenceRank(left) - implementationEvidenceRank(right));
}

export function requiresSourceVerification(trustState) {
  if (!TRUST_STATES.has(trustState)) throw new Error(`Unknown repository trust state: ${trustState}`);
  return trustState !== 'TRUSTED';
}

export function validateArtifactMetadata(value) {
  const errors = [];
  if (!object(value)) return result([error('RI_ARTIFACT_INVALID','Artifact metadata must be an object')]);

  if (value.schemaVersion !== '1.0.0') errors.push(error('RI_ARTIFACT_SCHEMA_VERSION','schemaVersion must be 1.0.0','schemaVersion'));
  if (!nonEmptyString(value.artifactId)) errors.push(error('RI_ARTIFACT_ID_REQUIRED','artifactId is required','artifactId'));
  if (!nonEmptyString(value.artifactType)) errors.push(error('RI_ARTIFACT_TYPE_REQUIRED','artifactType is required','artifactType'));
  if (!ARTIFACT_CLASSES.has(value.ownershipClass)) errors.push(error('RI_ARTIFACT_CLASS_INVALID','ownershipClass is invalid','ownershipClass'));
  if (!EVIDENCE_KINDS.has(value.evidenceKind)) errors.push(error('RI_EVIDENCE_KIND_INVALID','evidenceKind is invalid','evidenceKind'));

  const repository = value.repository;
  if (!object(repository)) errors.push(error('RI_REPOSITORY_REQUIRED','repository metadata is required','repository'));
  else {
    if (!nonEmptyString(repository.key)) errors.push(error('RI_REPOSITORY_KEY_REQUIRED','repository.key is required','repository.key'));
    if (typeof repository.isGit !== 'boolean') errors.push(error('RI_REPOSITORY_GIT_FLAG_REQUIRED','repository.isGit must be boolean','repository.isGit'));
    if (typeof repository.dirty !== 'boolean') errors.push(error('RI_REPOSITORY_DIRTY_REQUIRED','repository.dirty must be boolean','repository.dirty'));
    if (repository.isGit === true && !validSha(repository.baselineSha)) errors.push(error('RI_BASELINE_REQUIRED','Git-derived artifacts require a reachable-looking baseline SHA','repository.baselineSha'));
    if (repository.isGit === false && repository.baselineSha != null) errors.push(error('RI_BASELINE_NON_GIT','Non-Git artifacts must not fabricate baselineSha','repository.baselineSha'));
  }

  const provider = value.provider;
  if (!object(provider) || !nonEmptyString(provider.id)) errors.push(error('RI_PROVIDER_REQUIRED','provider.id is required','provider.id'));

  if (!validTimestamp(value.generatedAt)) errors.push(error('RI_GENERATED_AT_INVALID','generatedAt must be an RFC3339-compatible timestamp','generatedAt'));

  if (!Array.isArray(value.sourceScopes) || value.sourceScopes.length === 0) {
    errors.push(error('RI_SOURCE_SCOPE_REQUIRED','sourceScopes must contain at least one repository-relative scope','sourceScopes'));
  } else {
    for (let i=0;i<value.sourceScopes.length;i++) {
      try { normalizeKnowledgePath(value.sourceScopes[i]); }
      catch (cause) { errors.push(error('RI_SOURCE_SCOPE_INVALID',cause.message,`sourceScopes[${i}]`)); }
    }
  }

  const trust = value.trust;
  if (!object(trust)) errors.push(error('RI_TRUST_REQUIRED','trust metadata is required','trust'));
  else {
    if (!TRUST_STATES.has(trust.state)) errors.push(error('RI_TRUST_STATE_INVALID','trust.state is invalid','trust.state'));
    if (!validTimestamp(trust.measuredAt)) errors.push(error('RI_TRUST_MEASURED_AT_INVALID','trust.measuredAt must be a timestamp','trust.measuredAt'));
    if (trust.score != null && (!Number.isInteger(trust.score) || trust.score < 0 || trust.score > 100)) errors.push(error('RI_TRUST_SCORE_INVALID','trust.score must be an integer from 0 to 100','trust.score'));
    if (!Array.isArray(trust.reasons)) errors.push(error('RI_TRUST_REASONS_INVALID','trust.reasons must be an array','trust.reasons'));
  }

  if (value.ownershipClass === 'LOCAL_DERIVED' && value.portable === true) errors.push(error('RI_LOCAL_DERIVED_PORTABLE','LOCAL_DERIVED artifacts cannot claim portable=true','portable'));

  return result(errors);
}

export function validateProviderDescriptor(value) {
  const errors = [];
  if (!object(value)) return result([error('RI_PROVIDER_INVALID','Provider descriptor must be an object')]);
  if (value.schemaVersion !== '1.0.0') errors.push(error('RI_PROVIDER_SCHEMA_VERSION','schemaVersion must be 1.0.0','schemaVersion'));
  if (!nonEmptyString(value.id) || !/^[a-z0-9][a-z0-9._-]*$/.test(value.id)) errors.push(error('RI_PROVIDER_ID_INVALID','Provider id must be a stable lowercase identifier','id'));
  if (!['native','external'].includes(value.kind)) errors.push(error('RI_PROVIDER_KIND_INVALID','Provider kind must be native or external','kind'));
  if (typeof value.optional !== 'boolean') errors.push(error('RI_PROVIDER_OPTIONAL_REQUIRED','Provider optional flag must be boolean','optional'));
  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0 || value.capabilities.some((item)=>!nonEmptyString(item))) errors.push(error('RI_PROVIDER_CAPABILITIES_REQUIRED','Provider capabilities must be a non-empty string array','capabilities'));
  if (!PROVIDER_STATES.has(value.status)) errors.push(error('RI_PROVIDER_STATUS_INVALID','Provider status is invalid','status'));
  if (value.version != null && !nonEmptyString(value.version)) errors.push(error('RI_PROVIDER_VERSION_INVALID','Provider version must be null or non-empty string','version'));
  if (value.status === 'READY' && value.health?.reachable !== true) errors.push(error('RI_PROVIDER_READY_UNREACHABLE','READY provider must have health.reachable=true','health.reachable'));
  if (value.status === 'STALE' && !nonEmptyString(value.health?.baselineSha)) errors.push(error('RI_PROVIDER_STALE_BASELINE_REQUIRED','STALE provider must identify its observed baseline when known','health.baselineSha'));
  return result(errors);
}

export function validateRepositoryIntelligenceConfig(value) {
  const errors = [];
  if (!object(value)) return result([error('RI_CONFIG_INVALID','repositoryIntelligence config must be an object')]);
  if (typeof value.enabled !== 'boolean') errors.push(error('RI_CONFIG_ENABLED_REQUIRED','enabled must be boolean','enabled'));

  const storage = value.storage;
  if (!object(storage)) errors.push(error('RI_CONFIG_STORAGE_REQUIRED','storage configuration is required','storage'));
  else {
    for (const field of ['portableRoot','localRoot','contextPath','engineeringPath','externalKnowledgePath']) {
      try {
        const normalized=normalizeKnowledgePath(storage[field]);
        if (!normalized.startsWith('.executionkit/')) throw new Error(`${field} must stay under .executionkit/`);
      } catch (cause) { errors.push(error('RI_CONFIG_STORAGE_PATH_INVALID',cause.message,`storage.${field}`)); }
    }
    if (storage.portableRoot === storage.localRoot) errors.push(error('RI_CONFIG_STORAGE_COLLISION','portableRoot and localRoot must be distinct','storage'));
    for (const field of ['contextPath','engineeringPath','externalKnowledgePath']) {
      if (nonEmptyString(storage.portableRoot) && nonEmptyString(storage[field]) && !(storage[field]===storage.portableRoot || storage[field].startsWith(`${storage.portableRoot}/`))) {
        errors.push(error('RI_CONFIG_PORTABLE_PATH_OUTSIDE_ROOT',`${field} must live under storage.portableRoot`,`storage.${field}`));
      }
    }
    const portableArtifacts=['contextPath','engineeringPath','externalKnowledgePath'].map((field)=>storage[field]).filter(nonEmptyString);
    if (new Set(portableArtifacts).size!==portableArtifacts.length) errors.push(error('RI_CONFIG_STORAGE_ARTIFACT_COLLISION','Portable knowledge artifact paths must be distinct','storage'));
  }

  const privacy = value.privacy;
  if (!object(privacy)) errors.push(error('RI_CONFIG_PRIVACY_REQUIRED','privacy configuration is required','privacy'));
  else {
    if (privacy.allowSourceEgress !== false) errors.push(error('RI_SOURCE_EGRESS_DEFAULT_DENY','allowSourceEgress must default to false','privacy.allowSourceEgress'));
    if (privacy.includeSecretSensitivePaths !== false) errors.push(error('RI_SECRET_PATHS_FORBIDDEN','includeSecretSensitivePaths must be false','privacy.includeSecretSensitivePaths'));
    if (!Array.isArray(privacy.extraDenyPaths)) errors.push(error('RI_EXTRA_DENY_PATHS_INVALID','privacy.extraDenyPaths must be an array','privacy.extraDenyPaths'));
    else for (let i=0;i<privacy.extraDenyPaths.length;i++) {
      try { normalizeKnowledgePath(privacy.extraDenyPaths[i]); }
      catch (cause) { errors.push(error('RI_EXTRA_DENY_PATH_INVALID',cause.message,`privacy.extraDenyPaths[${i}]`)); }
    }
  }

  const thresholds = value.thresholds;
  if (!object(thresholds)) errors.push(error('RI_CONFIG_THRESHOLDS_REQUIRED','thresholds are required','thresholds'));
  else {
    const ordered = ['trustedMin','verifyMin','degradedMin'].map((key)=>thresholds[key]);
    if (ordered.some((n)=>!Number.isInteger(n) || n < 0 || n > 100)) errors.push(error('RI_CONFIG_THRESHOLD_INVALID','Trust thresholds must be integers from 0 to 100','thresholds'));
    else if (!(ordered[0] > ordered[1] && ordered[1] > ordered[2])) errors.push(error('RI_CONFIG_THRESHOLD_ORDER','Thresholds must satisfy trustedMin > verifyMin > degradedMin','thresholds'));
  }

  const providers=value.providers;
  if (!object(providers)) errors.push(error('RI_CONFIG_PROVIDERS_REQUIRED','providers configuration is required','providers'));
  else {
    for (const field of ['required','optional']) {
      const values=providers[field];
      if (!Array.isArray(values) || values.some((id)=>!nonEmptyString(id)||!/^[a-z0-9][a-z0-9._-]*$/.test(id))) errors.push(error('RI_CONFIG_PROVIDER_LIST_INVALID',`providers.${field} must be an array of stable provider ids`,`providers.${field}`));
      else if (new Set(values).size!==values.length) errors.push(error('RI_CONFIG_PROVIDER_DUPLICATE',`providers.${field} contains duplicates`,`providers.${field}`));
    }
    if (Array.isArray(providers.required) && Array.isArray(providers.optional)) {
      const overlap=providers.required.filter((id)=>providers.optional.includes(id));
      if (overlap.length) errors.push(error('RI_CONFIG_PROVIDER_OVERLAP',`Provider ids cannot be both required and optional: ${overlap.join(', ')}`,'providers'));
    }
  }

  const autoConsumption=value.autoConsumption;
  if (autoConsumption !== undefined && !object(autoConsumption)) errors.push(error('RI_CONFIG_AUTO_CONSUMPTION_INVALID','autoConsumption must be an object when configured','autoConsumption'));
  else if (object(autoConsumption)) {
    if (typeof autoConsumption.enabled !== 'boolean') errors.push(error('RI_CONFIG_AUTO_CONSUMPTION_ENABLED','autoConsumption.enabled must be boolean','autoConsumption.enabled'));
    if (!Array.isArray(autoConsumption.preferred) || autoConsumption.preferred.some((id)=>!nonEmptyString(id)||!/^[a-z0-9][a-z0-9._-]*$/.test(id)) || new Set(autoConsumption.preferred).size!==autoConsumption.preferred.length) errors.push(error('RI_CONFIG_AUTO_PROVIDER_LIST_INVALID','autoConsumption.preferred must be a unique provider-id array','autoConsumption.preferred'));
    if (autoConsumption.fallback !== 'native') errors.push(error('RI_CONFIG_AUTO_FALLBACK_INVALID','autoConsumption.fallback must be native','autoConsumption.fallback'));
    for (const field of ['autoIndexCodeGraph','useRepomixForAgentContext','useRtkForReadonlyGit','useTerrainForMacroKnowledge']) if (autoConsumption[field] !== undefined && typeof autoConsumption[field] !== 'boolean') errors.push(error('RI_CONFIG_AUTO_FLAG_INVALID',`autoConsumption.${field} must be boolean`,`autoConsumption.${field}`));
    if (autoConsumption.terrainProject !== undefined && typeof autoConsumption.terrainProject !== 'string') errors.push(error('RI_CONFIG_TERRAIN_PROJECT_INVALID','autoConsumption.terrainProject must be a string','autoConsumption.terrainProject'));
  }

  const context=value.context;
  if (!object(context) || !Number.isInteger(context.maxBytes) || context.maxBytes<4096 || context.maxBytes>131072) errors.push(error('RI_CONFIG_CONTEXT_LIMIT_INVALID','context.maxBytes must be an integer from 4096 to 131072','context.maxBytes'));

  const ingestion=value.ingestion;
  if (!object(ingestion)) errors.push(error('RI_CONFIG_INGESTION_REQUIRED','ingestion configuration is required','ingestion'));
  else {
    if (!Array.isArray(ingestion.paths)) errors.push(error('RI_CONFIG_INGESTION_PATHS_INVALID','ingestion.paths must be an array','ingestion.paths'));
    else for (let i=0;i<ingestion.paths.length;i++) {
      try { normalizeKnowledgePath(ingestion.paths[i]); }
      catch (cause) { errors.push(error('RI_CONFIG_INGESTION_PATH_INVALID',cause.message,`ingestion.paths[${i}]`)); }
    }
    if (!Number.isInteger(ingestion.maxFileBytes) || ingestion.maxFileBytes<1024 || ingestion.maxFileBytes>2*1024*1024) errors.push(error('RI_CONFIG_INGESTION_FILE_LIMIT_INVALID','ingestion.maxFileBytes must be 1 KiB..2 MiB','ingestion.maxFileBytes'));
    if (!Number.isInteger(ingestion.maxTotalBytes) || ingestion.maxTotalBytes<1024 || ingestion.maxTotalBytes>16*1024*1024 || (Number.isInteger(ingestion.maxFileBytes)&&ingestion.maxTotalBytes<ingestion.maxFileBytes)) errors.push(error('RI_CONFIG_INGESTION_TOTAL_LIMIT_INVALID','ingestion.maxTotalBytes must be >= maxFileBytes and <= 16 MiB','ingestion.maxTotalBytes'));
  }

  const refresh=value.refresh;
  if (!object(refresh)) errors.push(error('RI_CONFIG_REFRESH_REQUIRED','refresh configuration is required','refresh'));
  else {
    if (!Number.isInteger(refresh.maxChangedPaths) || refresh.maxChangedPaths<1 || refresh.maxChangedPaths>10000) errors.push(error('RI_CONFIG_REFRESH_PATH_LIMIT_INVALID','refresh.maxChangedPaths must be an integer from 1 to 10000','refresh.maxChangedPaths'));
    if (!Number.isInteger(refresh.maxChangedSections) || refresh.maxChangedSections<1 || refresh.maxChangedSections>10) errors.push(error('RI_CONFIG_REFRESH_SECTION_LIMIT_INVALID','refresh.maxChangedSections must be an integer from 1 to 10','refresh.maxChangedSections'));
    if (!Number.isFinite(refresh.maxScopeRatio) || refresh.maxScopeRatio<=0 || refresh.maxScopeRatio>1) errors.push(error('RI_CONFIG_REFRESH_RATIO_INVALID','refresh.maxScopeRatio must be in (0,1]','refresh.maxScopeRatio'));
  }

  return result(errors);
}

export function assertRefreshMode(value) {
  if (!REFRESH_MODES.has(value)) throw new Error(`Unknown repository refresh mode: ${value}`);
  return value;
}
