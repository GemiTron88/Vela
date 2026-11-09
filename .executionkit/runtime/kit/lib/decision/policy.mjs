import {retrieveFacts,evaluateKnowledgeRules} from './knowledge.mjs';
const RANK={ALLOW:0,REVIEW:1,DENY:2};
export function decide(input,knowledge){
  const reasons=[];let decision='ALLOW';
  function mark(level,code){
    if(RANK[level]>RANK[decision])decision=level;
    if(!reasons.includes(code))reasons.push(code);
  }
  const s=input.signals;
  // Selected quality acceptance boundaries are strict; planning advice stays advisory.
  // v5 Visual Production hard gate; empty KB or advisory decisions cannot override.
  if(['quality_gate','deploy','release_approve','release_publish'].includes(input.action)||(input.event==='postflight'&&input.action==='edit')){
    if((s.visualProductionMissingCount??0)>0)mark('DENY','VISUAL_PRODUCTION_COVERAGE_REQUIRED');
    if((s.visualProductionUnverifiedCount??0)>0)mark('DENY','VISUAL_PRODUCTION_REAL_MEDIA_EVIDENCE_REQUIRED');
    if((s.visualProductionUnsafeCount??0)>0)mark('DENY','VISUAL_PRODUCTION_INTEGRITY_REQUIRED');
    for(const [signal,reason] of [['visualBlockingCount','VISUAL_BLOCKING_DEFECTS'],['visualReviewCount','VISUAL_REVIEW_UNRESOLVED'],['premiumUxDefectCount','PREMIUM_UX_REQUIRED'],['antiFakeCount','REAL_PRODUCTION_DATA_REQUIRED'],['marketVoiceViolationCount','APPROVED_MARKET_VOICE_REQUIRED'],['designTokenViolations','DESIGN_TOKENS_REQUIRED'],['contrastViolations','ACCESSIBLE_CONTRAST_REQUIRED']])if((s[signal]??0)>0)mark('DENY',reason);
    if(s.unverifiedVisualEvidence)mark('DENY','INDEPENDENT_RENDERED_EVIDENCE_REQUIRED');
    for(const [signal,reason] of [['remoteAssetCount','LOCAL_ASSETS_REQUIRED'],['missingTranslationCount','TRANSLATIONS_REQUIRED'],['formServerErrorCount','FORM_SERVER_FAILURE'],['mobileOverflowCount','MOBILE_LAYOUT_FAILURE'],['visualOverflowCount','MOBILE_LAYOUT_FAILURE'],['componentBypassCount','CANONICAL_COMPONENTS_REQUIRED']])if((s[signal]??0)>0)mark('DENY',reason);
    if(s.unverifiedPerformanceEvidence||
      (s.performanceScore!==undefined||s.performanceBudget!==undefined)&&
      (s.performanceScore===undefined||s.performanceBudget===undefined))mark('DENY','PERFORMANCE_MEASUREMENTS_REQUIRED');
    if(s.performanceScore!==undefined&&s.performanceBudget!==undefined&&s.performanceScore<s.performanceBudget)mark('DENY','PERFORMANCE_BUDGET_FAILED');
  }
  if(input.action==='quality_gate'){
    for(const [signal,reason] of [['failedChecks','QUALITY_CHECKS_FAILED'],['regressionCount','QUALITY_REGRESSION']])if((s[signal]??0)>0)mark('DENY',reason);
    if(s.missingEvidence)mark('DENY','QUALITY_EVIDENCE_REQUIRED');
  }
  if(['release_approve','release_publish','deploy'].includes(input.action)){
    if(s.providerInventoryInvalid)mark('DENY','PROVIDER_INVENTORY_REQUIRED');
    if((s.criticalProviderUnreadyCount??0)>0)mark('DENY','MANDATORY_EXTERNAL_PROVIDER_REQUIRED');
    if((s.providerEvidenceInvalidCount??0)>0)mark('DENY','VALID_EXTERNAL_PROVIDER_EVIDENCE_REQUIRED');
    if((s.providerSignoffPendingCount??0)>0)mark('DENY','EXTERNAL_PROVIDER_SIGNOFF_REQUIRED');
    if(s.missingEvidence)mark('DENY','QUALITY_EVIDENCE_REQUIRED');
    if((s.failedChecks??0)>0)mark('DENY','QUALITY_CHECKS_FAILED');
    if((s.regressionCount??0)>0)mark('DENY','QUALITY_REGRESSION');
  }
  // Hard safety rules are compiled into the engine, immutable and deterministic.
  if(input.hostClass==='vps'&&(input.action==='mobile_build'||s.usesAndroidTools))mark('DENY','NO_NATIVE_MOBILE_BUILD_ON_VPS');
  if(s.requiresRoot)mark('DENY','ROOT_OPERATION_FORBIDDEN');
  if(s.accessesSecrets)mark('DENY','CREDENTIAL_ACCESS_FORBIDDEN');
  if(s.scopeExceeded)mark('REVIEW','CHANGED_SCOPE_EXCEEDED');
  if(s.scopeUnclear)mark('REVIEW','SCOPE_UNCLEAR');
  if(s.containsUntrustedInstructions)mark('REVIEW','UNTRUSTED_INSTRUCTION_RISK');
  if(s.destructive)mark('REVIEW','DESTRUCTIVE_OPERATION_REVIEW');
  if(s.missingEvidence)mark('REVIEW','INSUFFICIENT_EVIDENCE'); // Explicit missing required evidence is actionable at any event, including preflight.
  if((s.failedChecks??0)>0)mark('REVIEW','FAILED_CHECKS');
  if((s.regressionCount??0)>0)mark('REVIEW','MEASURED_REGRESSION');
  if(s.changedSchema||input.action==='database_migration')mark('REVIEW','DATABASE_VALIDATION_REQUIRED');
  if(s.newDependency||(s.unverifiedDependenciesCount??0)>0||input.action==='dependency_change')mark('REVIEW','DEPENDENCY_REVIEW_REQUIRED');
  if(input.environment==='production'||['deploy','release_approve','release_publish'].includes(input.action))mark('REVIEW','EXTERNAL_RELEASE_AUTHORITY_REQUIRED');
  if(input.event==='release')mark('REVIEW','RELEASE_EVIDENCE_REQUIRED');
  if(input.action==='visual_review')mark('REVIEW','RENDERED_VISUAL_REVIEW_REQUIRED');
  if(input.action==='performance_review'&&(s.performanceScore===undefined||s.performanceBudget===undefined||s.unverifiedPerformanceEvidence))mark('REVIEW','PERFORMANCE_MEASUREMENTS_REQUIRED');
  if(input.action==='architecture_review')mark('REVIEW','ARCHITECTURE_REVIEW_REQUIRED');

  // Reviewed general engineering knowledge rules.
  // Knowledge rules can only ESCALATE to REVIEW; never allow/deny privileges.
  const appliedRules=evaluateKnowledgeRules(knowledge,input);
  for(const rule of appliedRules)mark('REVIEW',rule.reason);
  if(decision==='ALLOW')mark('ALLOW','NO_KNOWN_POLICY_FINDINGS');
  return {schemaVersion:2,requestId:input.requestId,decision,advisoryOnly:true,
    policyClass:decision==='DENY'?'MANDATORY_DENIAL':decision==='REVIEW'?'ADVISORY_REVIEW':'NO_AUTHORITY_GRANT',
    reasons,knowledgeVersion:knowledge.version,
    appliedRuleIds:appliedRules.map(r=>r.id),
    factIds:retrieveFacts(knowledge,input.event,input.action).map(f=>f.id)};
}

