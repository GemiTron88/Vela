// Standalone project-agnostic decision contract. Never accept repository names, tasks, paths or source code.
export class InputError extends Error {
  constructor(message,status=400) { super(message); this.name='InputError'; this.status=status; }
}
export const ACTIONS=Object.freeze([
  'read','edit','test','mobile_build','dependency_change','database_migration',
  'visual_review','performance_review','architecture_review','failure_triage',
  'deploy','release_approve','release_publish','quality_gate'
]);
export const EVENTS=Object.freeze(['preflight','postflight','wave','phase','release']);
export const HOSTS=Object.freeze(['vps','workstation','ci']);
export const ENVIRONMENTS=Object.freeze(['development','staging','production']);
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const BOOL=new Set(['usesAndroidTools','requiresRoot','destructive','accessesSecrets','scopeUnclear',
  'scopeExceeded','containsUntrustedInstructions','newDependency','changedSchema','missingEvidence',
  'unverifiedVisualEvidence','unverifiedPerformanceEvidence','providerInventoryInvalid']);
const INT=new Set(['visualOverflowCount','contrastViolations','regressionCount','failedChecks',
  'remoteAssetCount','missingTranslationCount','formServerErrorCount','mobileOverflowCount','componentBypassCount',
  'designTokenViolations','changedFilesCount','apiRequestCount','longTaskCount','retryCount',
  'criticalProviderUnreadyCount','providerEvidenceInvalidCount','providerSignoffPendingCount','providerDeferredCount','unverifiedDependenciesCount','visualBlockingCount','visualReviewCount','premiumUxDefectCount','antiFakeCount','marketVoiceViolationCount',
  'visualProductionMissingCount','visualProductionUnverifiedCount','visualProductionUnsafeCount']);
const SCORES=new Set(['performanceScore','performanceBudget']);
export function validateDecision(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new InputError('invalid_json_object');
  const allowed=new Set(['schemaVersion','requestId','event','action','hostClass','environment','signals']);
  for(const key of Object.keys(value)) if(!allowed.has(key))throw new InputError('unknown_field_'+key);
  if(value.schemaVersion!==2)throw new InputError('invalid_schema_version');
  if(typeof value.requestId!=='string'||!ID.test(value.requestId))throw new InputError('invalid_request_id');
  for(const [key,choices] of [['event',EVENTS],['action',ACTIONS],['hostClass',HOSTS],['environment',ENVIRONMENTS]]) {
    if(!choices.includes(value[key]))throw new InputError('invalid_'+key);
  }
  if(!value.signals||typeof value.signals!=='object'||Array.isArray(value.signals))throw new InputError('invalid_signals');
  if(Object.keys(value.signals).length>48)throw new InputError('too_many_signals');
  const signals=Object.create(null);
  for(const [key,num] of Object.entries(value.signals)){
    if(BOOL.has(key)){if(typeof num!=='boolean')throw new InputError('invalid_signal_'+key);}
    else if(INT.has(key)){if(!Number.isInteger(num)||num<0||num>100000)throw new InputError('invalid_signal_'+key);}
    else if(SCORES.has(key)){if(typeof num!=='number'||!Number.isFinite(num)||num<0||num>100)throw new InputError('invalid_signal_'+key);}
    else throw new InputError('unknown_signal_'+key);
    signals[key]=num;
  }
  return Object.freeze({schemaVersion:2,requestId:value.requestId,event:value.event,action:value.action,
    hostClass:value.hostClass,environment:value.environment,signals:Object.freeze(signals)});
}

