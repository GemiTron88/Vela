// Only bounded abstract measurements cross into the generic deterministic engine.
export function decisionQualitySignals({surface={},visual={},mobile={},lighthouse=null,changedFilesCount=0,failedChecks=0,missingEvidence=false}={}){
  const unique=list=>[...new Map(list.map(f=>[JSON.stringify([f.code,f.path??f.file,f.dimension,f.subjectId,f.message]),f])).values()];
  const surfaceFindings=unique(surface.findings??[]),surfaceReviewFindings=unique(surface.reviewFindings??[]);
  const visualFindings=unique([...(visual.findings??[]),...(visual.visualEvidence?.unresolved??visual.visualEvidence?.qualityFindings??[])]);
  const count=(list,test)=>Math.min(100000,list.filter(test).length);
  const blocker=f=>['BLOCKER','HIGH','CRITICAL','P0','P1'].includes(String(f.severity).toUpperCase());
  const has=(f,re)=>re.test(String(f.code??'')+' '+String(f.dimension??f.category??''));
  const renderedProven=visual.renderedEvidence?.proven===true||visual.renderedEvidence?.actualRenderedReview===true;
  // Generic heuristics already resolved by independent rendered evidence do not
  // re-open a passed review; unresolved concrete findings retain their severity.
  const activeVisual=visualFindings.filter(f=>!(renderedProven&&['VISUAL_GENERIC_PATTERN_REVIEW_REQUIRED','AI_GENERIC_UI_SIGNAL'].includes(f.code)));
  const mobileGates=Array.isArray(mobile.gates)?mobile.gates:Array.isArray(mobile.signedReceipt?.payload?.gates)?mobile.signedReceipt.payload.gates:Array.isArray(mobile.receipt?.gates)?mobile.receipt.gates:[];
  const mobileFailedCount=count(mobileGates,g=>g?.status==='FAIL'||(g?.status==='PASS'&&g?.exit_code!==0));
  const mobileMissingMandatory=['analyze','unit','widget'].some(req=>mobileGates.some(g=>g?.name===req&&g?.status==='NOT_TESTED'))
    ||mobile.skipTests===true||mobile.testsExecuted===false;
  const unverifiedDeps=count(surfaceReviewFindings,f=>f.code==='LIBRARY_USAGE_UNPROVEN');
  const lh=lighthouse??surface.lighthouse??null;
  const perfLhFailures=count(surfaceFindings,f=>/^PERF_LIGHTHOUSE_/.test(String(f.code)));
  const hasPerfMetrics=Boolean((lh&&lh.status&&lh.status!=='NOT_APPLICABLE')||perfLhFailures>0);
  const perfScore=Number.isFinite(lh?.minScore)?Math.max(0,Math.min(100,lh.minScore)):((perfLhFailures>0||lh?.status==='FAIL'||lh?.status==='BLOCKED')?0:100);
  const perfBudget=Number.isFinite(lh?.budget)?Math.max(0,Math.min(100,lh.budget)):100;
  const perfUnverified=Boolean(lh?.status==='BLOCKED'||surfaceFindings.some(f=>['PERF_LIGHTHOUSE_REPORTS_MISSING','PERF_LIGHTHOUSE_THROTTLING_SPOOFED'].includes(f.code)));
  const overflowCount=count(activeVisual,f=>has(f,/OVERFLOW|RESPONSIVE|mobile|responsive/)&&blocker(f))+count(surfaceFindings,f=>/^(?:UX_LAYOUT_FIXED_WIDTH_OVERFLOW|FLUTTER_UNBOUNDED_VIEWPORT_CRASH|FLUTTER_FLEX_IN_UNBOUNDED_SCROLL)$/.test(String(f.code)));
  return {
    changedFilesCount:Math.min(100000,changedFilesCount),failedChecks:Math.min(100000,failedChecks+mobileFailedCount),
    remoteAssetCount:count(surfaceFindings,f=>f.code==='ASSET_REMOTE_FORBIDDEN'),
    missingTranslationCount:count(surfaceFindings,f=>(String(f.code).startsWith('LANG_')&&!String(f.code).startsWith('LANG_MARKET_'))||/^FLUTTER_ARB_/.test(String(f.code))),
    marketVoiceViolationCount:count(surfaceFindings,f=>String(f.code).startsWith('LANG_MARKET_')),
    formServerErrorCount:count(surfaceFindings,f=>String(f.code).startsWith('FORM_')),
    antiFakeCount:count(surfaceFindings,f=>String(f.code).startsWith('ANTIFAKE_')),
    componentBypassCount:count(activeVisual,f=>has(f,/COMPONENT.*(?:BYPASS|REUSE|REQUIRED)/))+count(surfaceFindings,f=>f.code==='UX_COMPONENT_PRIMITIVE_BYPASS'),
    designTokenViolations:count(activeVisual,f=>has(f,/TOKEN|DESIGN_(?:DRIFT|AUTHORITY)/)&&blocker(f))+count(surfaceFindings,f=>/^UX_TOKEN_|^FLUTTER_HARDCODED_(?:COLOR|TEXT_STYLE)$/.test(String(f.code))),
    contrastViolations:count(activeVisual,f=>has(f,/CONTRAST|contrast/)&&blocker(f)),
    mobileOverflowCount:overflowCount,
    visualOverflowCount:overflowCount,
    visualProductionMissingCount:count(activeVisual,f=>has(f,/VISUAL_PRODUCTION_(?:MANIFEST_REQUIRED|ROLE_UNMAPPED|ASSET_COVERAGE_MISSING|SURFACE_UNMAPPED|REQUIRED_ASSET_MISSING|THEME_VARIANT_MISSING|THEME_CENSUS_MISMATCH)/))+count(surfaceFindings,f=>/^(?:ASSET_LOCAL_MISSING|VISUALS_SURFACE_ROLES_UNMAPPED|FLUTTER_ASSET_NOT_IN_PUBSPEC)$/.test(String(f.code))),
    visualProductionUnverifiedCount:count(activeVisual,f=>has(f,/VISUAL_PRODUCTION_(?:ARTIFACT_UNVERIFIED|LOCAL_FIRST_UNVERIFIED|SERVER_UNVERIFIED|EXEMPTION_UNREVIEWED|ORIGIN_UNVERIFIED|WEB_LICENSE_UNVERIFIED|VECTOR_EVIDENCE_REQUIRED|REVIEW_EVIDENCE_INVALID)/))+count(surfaceFindings,f=>/^(?:VISUALS_CHANGED_SURFACE_STALE_RECEIPT|VISUALS_CREATIVE_PRIORITY_VIOLATION)$/.test(String(f.code))),
    visualProductionUnsafeCount:count(activeVisual,f=>has(f,/VISUAL_PRODUCTION_(?:MANIFEST_INVALID|SURFACE_INVALID|SURFACE_SOURCE_MISSING|ASSET_INVALID|ASSET_UNREFERENCED|VARIANT_INVALID|DUPLICATE_VARIANT|DUPLICATE_ASSET_BINARY|UNUSED_ASSET|DELIVERY_INVALID|WEB_VECTOR_NOT_ORIGINAL)/))+count(surfaceFindings,f=>/^(?:ASSET_(?:FONT|LOTTIE|IMAGE)_INVALID|VISUALS_(?:SVG_RASTER_WRAPPER_FORBIDDEN|SVG_TRIVIAL_PLACEHOLDER|ROLE_DIMENSIONS_TOO_SMALL|SCREENSHOT_DIMENSIONS_TOO_SMALL|LOTTIE_FRAME_RATE_OR_DURATION_INVALID|LOTTIE_RASTER_BOMB_FORBIDDEN|INTRA_ASSET_DUPLICATE_VARIANT_BINARY))$/.test(String(f.code))),
    visualBlockingCount:Math.max(visual.status==='FAIL'?1:0,count(activeVisual,blocker)),
    visualReviewCount:count(activeVisual,f=>['REVIEW','P2','P3'].includes(String(f.severity).toUpperCase())),
    premiumUxDefectCount:count(activeVisual,f=>blocker(f)&&has(f,/PROFILE_NOT_PREMIUM|hierarchy|typography|forms|navigation|accessibility|empty-loading-error-success|identity/))+count(surfaceFindings,f=>/^(?:ASSET_IMAGE_ALT_MISSING|UX_(?:STATE_|SLOP_|A11Y_|BIDI_|MOTION_)|VISUALS_(?:SVG_VIEWBOX_REQUIRED|SVG_ACCESSIBILITY_MISSING|WEB_IMG_CLS_UNBOUNDED|HERO_LAZY_LOAD_FORBIDDEN|ANIMATION_REDUCED_MOTION_MISSING)|FLUTTER_(?:DISPOSE_MISSING|SUBSCRIPTION_CANCEL_MISSING|ASYNC_CONTEXT_UNMOUNTED|DIRECTIONAL_INSETS_REQUIRED|DARK_MODE_INCOMPLETE|FORM_KEY_MISSING|NAMED_ROUTE_UNRESOLVED|NETWORK_CALL_IN_LIFECYCLE|CLEARTEXT_HTTP_FORBIDDEN|INSECURE_CREDENTIAL_STORAGE|VPS_MOBILE_BUILD_FORBIDDEN)|PERF_(?:WEB_|BACKEND_|FLUTTER_))/.test(String(f.code))),
    unverifiedVisualEvidence:visual.status!=='NOT_APPLICABLE'&&(visual.renderedEvidence?.required===true&&!renderedProven||visual.status==='REVIEW_REQUIRED'||visual.status==='SKIPPED_DEADLINE'||visual.status==='SKIPPED_AFTER_TEST_TIMEOUT'),
    ...(surfaceFindings.some(f=>f.code==='FLUTTER_VPS_MOBILE_BUILD_FORBIDDEN')?{usesAndroidTools:true}:{}),
    ...(hasPerfMetrics?{performanceScore:perfScore,performanceBudget:perfBudget,unverifiedPerformanceEvidence:perfUnverified}:{}),
    ...(unverifiedDeps>0?{unverifiedDependenciesCount:unverifiedDeps}:{}),
    ...(missingEvidence||mobileMissingMandatory?{missingEvidence:true}:{}),
  };
}
