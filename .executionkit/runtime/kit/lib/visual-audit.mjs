import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIMENSIONS, VISUAL_ROOT, digest, git, loadVisualConfig, readJSON, runDirectory, safeVisualPath, sealVisual, sha256, sourceIdentity, verifySealed, visualLocaleMatches, writeJSON } from './visual-contract.mjs';
import { discoverVisualSurfaces, planVisualMatrix } from './visual-surface.mjs';
import { assertMobileFocus } from './visual-capture.mjs';
import { inspectVisualImage, compareVisualImages } from './visual-image.mjs';
import { analyzeVisualGeometry } from './visual-geometry.mjs';
import { compileLanguageCatalog } from './surface-integrity.mjs';
import { decodeVisualCriticResponse, visualCriticRequest } from './visual-critic.mjs';
import { validateVisualSchema, visualRunSchema, visualReviewSchema, visualRemediationSchema } from './visual-schema.mjs';

function without(value,keys){return Object.fromEntries(Object.entries(value).filter(([k])=>!keys.includes(k)));}
function readArtifact(dir,artifact){const file=safeVisualPath(dir,artifact.path,{mustExist:true,file:true}),bytes=fs.readFileSync(file);if(sha256(bytes)!==artifact.sha256)throw new Error('VISUAL_ARTIFACT_HASH_MISMATCH: '+artifact.path);return bytes;}
const now=()=>new Date().toISOString();
export function currentVisualRunId(root){const f=safeVisualPath(root,`${VISUAL_ROOT}/current.json`);return fs.existsSync(f)?readJSON(f).runId:null;}

// Audit OS only reads producer/critic artifacts and independently recomputes
// coverage, schemas, hashes, pixels, signatures, geometry and review binding.
// Neither a producer's status nor a previous audit report is authoritative.
export function auditVisualRun(root,{runId=currentVisualRunId(root),requireCertification=false,archival=false}={}){
  const errors=[],qualityFindings=[],reviews=[],entries=[],add=(code,message,extra={})=>errors.push({code,message,...extra});let cfg,dir,manifest,plan,census;
  try{
    cfg=loadVisualConfig(root);dir=runDirectory(root,runId);manifest=readJSON(path.join(dir,'manifest.json'));validateVisualSchema(visualRunSchema,manifest);
    if(!verifySealed(manifest))throw new Error('VISUAL_CAPTURE_SEAL_INVALID');
    plan=readJSON(path.join(dir,'plan.json'));census=readJSON(path.join(dir,'census.json'));
    if(digest(without(plan,['planDigest','census']))!==plan.planDigest||plan.planDigest!==manifest.planDigest||digest(without(census,['censusDigest']))!==census.censusDigest||census.censusDigest!==manifest.censusDigest||plan.censusDigest!==census.censusDigest)throw new Error('VISUAL_PLAN_CENSUS_TAMPERED');
    if(manifest.configDigest!==digest(cfg)||plan.configDigest!==digest(cfg))throw new Error('VISUAL_CONFIG_CHANGED');
    if(!archival){
      const source=sourceIdentity(root);if(manifest.gitSha!==source.gitSha||manifest.gitTree!==source.gitTree)throw new Error('VISUAL_WRONG_GIT_SHA');
      const current=discoverVisualSurfaces(root,{config:cfg});if(current.censusDigest!==census.censusDigest)throw new Error('VISUAL_CENSUS_STALE');
      const replanned=planVisualMatrix(root,{mode:plan.mode,changedFiles:plan.changedFiles??[],base:plan.base??null,config:cfg});if(replanned.planDigest!==plan.planDigest)throw new Error('VISUAL_REQUIRED_MATRIX_CHANGED');
    }else {
      if(git(root,['rev-parse',manifest.gitSha+'^{tree}'])!==manifest.gitTree)throw new Error('VISUAL_ARCHIVAL_SOURCE_MISMATCH');
      for(const [p,hash] of Object.entries(census.sourceHashes))if(digest(git(root,['show',manifest.gitSha+':'+p],{trim:false}))!==hash)throw new Error('VISUAL_ARCHIVAL_SOURCE_HASH: '+p);
    }
    if(!census.complete||plan.status!=='PLANNED'||plan.expectedCells!==plan.cells.length||manifest.expectedCells!==plan.cells.length)throw new Error('VISUAL_CENSUS_OR_MATRIX_INCOMPLETE');
    if(plan.mode==='full'&&(plan.expectedSurfaces.length!==census.discovered||census.surfaces.some(s=>!plan.expectedSurfaces.includes(s.surfaceId))))throw new Error('VISUAL_FULL_SURFACE_DENOMINATOR_MISMATCH');
    const start=Date.parse(manifest.startedAt),end=Date.parse(manifest.completedAt);
    if(end<start||end-start>cfg.budgets.timeoutMs+30000||end>Date.now()+5000||!archival&&Date.now()-end>(cfg.maxEvidenceAgeHours??24)*3600000)throw new Error('VISUAL_STALE_OR_IMPLAUSIBLE_CAPTURE_TIME');
    for(const f of manifest.failures)add(f.code,f.message,{cellId:f.cellId});
  }catch(e){add(e.message.split(':')[0],e.message);return {schemaVersion:'executionkit-visual-audit/v2',status:'FAIL',runId,errors,qualityFindings,coverage:{discovered:0,captured:0,missing:[]},heatmap:[]};}
  const seenCells=new Set(),seenImages=new Map(),languages=compileLanguageCatalog(root);
  for(const entry of manifest.entries){
    try{
      if(!verifySealed(entry))throw new Error('VISUAL_ARTIFACT_SEAL_INVALID');
      const cell=plan.cells.find(c=>c.cellId===entry.cellId);if(!cell||seenCells.has(entry.cellId))throw new Error('VISUAL_UNPLANNED_OR_DUPLICATE_CELL');seenCells.add(entry.cellId);
      if(entry.runId!==runId||entry.gitSha!==manifest.gitSha||entry.gitTree!==manifest.gitTree||entry.app.identity!==cfg.app.identity||entry.app.revision!==entry.gitSha||entry.app.environment!==cfg.app.environment||entry.engine.producerId!==manifest.producerId||manifest.producerId!==cfg.capture.producerId)throw new Error('VISUAL_PROVENANCE_MISMATCH');
      for(const k of ['surfaceId','route','persona','locale','direction','theme','state','dataState','viewport'])if(digest(entry[k])!==digest(cell[k]))throw new Error('VISUAL_MATRIX_METADATA_MISMATCH: '+k);
      if(entry.actualRoute!==cell.route)throw new Error('VISUAL_WRONG_ROUTE');
      if(Date.parse(entry.captureTime)<Date.parse(manifest.startedAt)||Date.parse(entry.captureTime)>Date.parse(manifest.completedAt))throw new Error('VISUAL_CAPTURE_TIME_UNBOUND');
      const bytes=readArtifact(dir,entry.image),img=inspectVisualImage(bytes);
      if(img.blank)throw new Error('VISUAL_IMAGE_BLANK');
      if(img.width!==entry.viewport.width||entry.captureExtent==='viewport'&&img.height!==entry.viewport.height||entry.captureExtent==='full-page'&&img.height<entry.viewport.height-1||img.width!==entry.image.width||img.height!==entry.image.height)throw new Error('VISUAL_WRONG_VIEWPORT');
      if(img.perceptualHash!==entry.image.perceptualHash)throw new Error('VISUAL_PERCEPTUAL_HASH_MISMATCH');
      if(seenImages.has(img.imageSha256))throw new Error('VISUAL_DUPLICATE_SCREENSHOT: '+seenImages.get(img.imageSha256));seenImages.set(img.imageSha256,entry.cellId);
      const geometry=JSON.parse(readArtifact(dir,entry.geometry));if(entry.trace)readArtifact(dir,entry.trace);
      if(entry.engine.type==='playwright'){
        if(geometry.platform!=='web'||geometry.viewport?.width!==entry.viewport.width||geometry.viewport?.height!==entry.viewport.height||!visualLocaleMatches(geometry.htmlLocale,entry.locale)||geometry.htmlDirection!==entry.direction||geometry.theme!==entry.theme)throw new Error('VISUAL_GEOMETRY_METADATA_MISMATCH');
        if(plan.mode==='full'&&entry.captureExtent==='viewport'&&geometry.documentHeight>entry.viewport.height+2)throw new Error('VISUAL_PAGE_EXTENT_INCOMPLETE: full certification must include below-fold page content');
        if(plan.mode==='full'&&entry.captureExtent==='full-page'&&img.height<geometry.documentHeight-2)throw new Error('VISUAL_PAGE_EXTENT_INCOMPLETE: image pixels do not cover the observed full document');
        if(/^(?:404|500)\b|\b(?:Internal Server Error|Page Not Found)\b/i.test(geometry.title??'')&&!['server-error','permission-denied'].includes(entry.state))throw new Error('VISUAL_ERROR_PAGE');
      }else assertMobileFocus(geometry,cfg.capture.mobile??{});
      if(!entry.runtime.complete)throw new Error('VISUAL_RUNTIME_LOG_INCOMPLETE');
      const expectedStatus=cfg.expectedHttpStatuses?.[entry.state]??[];
      if(entry.runtime.consoleErrors.length||entry.runtime.exceptions.length||entry.runtime.failedRequests.length||entry.runtime.unexpectedRedirects.length||entry.runtime.flutterExceptions.length||entry.runtime.httpErrors.some(e=>!expectedStatus.includes(e.status)))throw new Error('VISUAL_RUNTIME_FAILURE');
      const translationKeys=[...(languages.locales.get(entry.locale)?.keys()??languages.locales.get(entry.locale.split('-')[0])?.keys()??[])];
      const mechanical=analyzeVisualGeometry(geometry,{compact:entry.viewport.width<600,spacingTokens:cfg.spacingTokens??[],translationKeys});
      const criticMechanical=analyzeVisualGeometry(geometry,{compact:entry.viewport.width<600});
      const review=readJSON(safeVisualPath(dir,`reviews/${entry.cellId}.json`,{mustExist:true,file:true}));validateVisualSchema(visualReviewSchema,review);
      if(!verifySealed(review,'review')||review.reviewerId!==cfg.critic.reviewerId||review.reviewerId===entry.engine.producerId||review.producerId!==entry.engine.producerId||review.runId!==runId||review.cellId!==entry.cellId||review.imageSha256!==img.imageSha256||review.provider!==cfg.critic.provider||Date.parse(review.reviewedAt)<Date.parse(entry.captureTime)||Date.parse(review.reviewedAt)>Date.now()+5000)throw new Error('VISUAL_REVIEW_UNSUPPORTED');
      const response=JSON.parse(readArtifact(dir,review.response)),result=decodeVisualCriticResponse(response),request=visualCriticRequest(entry,geometry,bytes,review.nonce,review.model);
      if(digest(request)!==review.requestDigest||digest(result.dimensions)!==digest(review.dimensions)||digest(result.findings)!==digest(review.findings)||digest(result.geometryDispositions??[])!==digest(review.geometryDispositions??[])||result.nonce!==review.nonce||result.imageSha256!==img.imageSha256||result.runId!==runId||result.cellId!==entry.cellId)throw new Error('VISUAL_REVIEW_IMAGE_NOT_PARTICIPATING');
      if(new Set(review.dimensions.map(d=>d.dimension)).size!==DIMENSIONS.length||review.dimensions.some(d=>d.observation.trim().length<20))throw new Error('VISUAL_REVIEW_DIMENSIONS_UNSUPPORTED');
      if(review.findings.some(f=>f.surface!==entry.surfaceId||f.checkpoint!==entry.state||f.evidenceRefs.length!==1||f.evidenceRefs[0]!==img.imageSha256))throw new Error('VISUAL_FINDING_UNBOUND');
      for(const d of review.dimensions)if(d.verdict==='FINDING'&&!review.findings.length)throw new Error('VISUAL_REVIEW_FINDING_OMITTED');
      for(const d of review.geometryDispositions??[])if(d.imageSha256!==img.imageSha256||!(mechanical.some(f=>f.id===d.findingId&&f.category===d.category&&f.severity==='review')||criticMechanical.some(f=>f.id===d.findingId&&f.category===d.category&&f.severity==='review')))throw new Error('VISUAL_GEOMETRY_DISPOSITION_UNSUPPORTED');
      const dispositions=review.findings;for(const f of mechanical){
        const intentional=f.severity==='review'&&review.geometryDispositions?.some(d=>(d.findingId===f.id||criticMechanical.some(cf=>cf.id===d.findingId&&cf.category===f.category&&cf.observedEvidence===f.observedEvidence))&&d.category===f.category&&d.verdict==='INTENTIONAL');if(intentional)continue;
        const matched=dispositions.find(x=>x.category===f.category);if(['P0','P1'].includes(f.severity))qualityFindings.push({...f,surface:entry.surfaceId,checkpoint:entry.state,evidenceRefs:[img.imageSha256]});
        else if(!matched||f.severity==='P2'&&!['P0','P1','P2'].includes(matched.severity))qualityFindings.push({...f,surface:entry.surfaceId,checkpoint:entry.state,evidenceRefs:[img.imageSha256]});
      }
      qualityFindings.push(...dispositions);reviews.push(review);entries.push(entry);
    }catch(e){add(e.message.startsWith('Visual OS path missing')?'VISUAL_SCREENSHOT_OR_REVIEW_MISSING':e.message.split(':')[0],e.message,{cellId:entry.cellId});}
  }
  const missingCells=plan.cells.filter(c=>!entries.some(e=>e.cellId===c.cellId)).map(c=>({cellId:c.cellId,surfaceId:c.surfaceId,state:c.state})),capturedSurfaces=[...new Set(entries.map(e=>e.surfaceId))],missingSurfaces=plan.expectedSurfaces.filter(s=>!capturedSurfaces.includes(s));
  if(missingCells.length)add('VISUAL_COVERAGE_MISSING','Required rendered cells or their review are missing',{missingCells});
  if(requireCertification){
    if(runId!==currentVisualRunId(root))add('VISUAL_NOT_CURRENT_STATE','A historical run cannot certify the current rendered product.');
    try{const cert=readJSON(path.join(dir,'certification.json'));if(!verifySealed(cert,'audit')||cert.status!=='PASS'||cert.runId!==runId||cert.gitSha!==manifest.gitSha||cert.manifestDigest!==digest(manifest)||cert.reviewDigest!==digest(reviews)||Date.now()-Date.parse(cert.verifiedAt)>3600000||Date.parse(cert.verifiedAt)>Date.now()+5000||plan.mode!=='full')throw new Error('VISUAL_CERTIFICATION_STALE_OR_UNSUPPORTED');}catch(e){add('VISUAL_CERTIFICATION_REQUIRED',e.message);}
  }
  const waiversFile=safeVisualPath(root,`${VISUAL_ROOT}/dispositions.json`),waivers=fs.existsSync(waiversFile)?readJSON(waiversFile):{items:[]};
  const unresolved=qualityFindings.filter(f=>{
    if(['P0','P1'].includes(f.severity))return true;
    const w=waivers.items?.find(w=>w.findingId===f.id&&w.imageSha256===f.evidenceRefs?.[0]);
    if(!w)return true;
    try{const expiry=Date.parse(w.expiresAt);return !verifySealed(w,'review')||w.reviewerId!==cfg.critic.reviewerId||!['accepted','waived'].includes(w.disposition)||typeof w.rationale!=='string'||w.rationale.trim().length<20||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+90*86400000;}catch{return true;}
  });
  const heatmap=plan.expectedSurfaces.map(surface=>{const f=qualityFindings.filter(x=>x.surface===surface),u=unresolved.filter(x=>x.surface===surface),seen=entries.filter(x=>x.surfaceId===surface);return {surface,status:missingSurfaces.includes(surface)?'MISSING':u.some(x=>['P0','P1'].includes(x.severity))?'MAJOR':u.length?'REVIEW':'PASS',requiredCells:plan.cells.filter(c=>c.surfaceId===surface).length,inspectedCells:seen.length,findings:f,dimensions:reviews.filter(r=>seen.some(e=>e.cellId===r.cellId)).map(r=>({cellId:r.cellId,dimensions:r.dimensions}))};});
  return {schemaVersion:'executionkit-visual-audit/v2',status:errors.length||unresolved.some(f=>['P0','P1'].includes(f.severity))?'FAIL':unresolved.length?'REVIEW_REQUIRED':requireCertification?'PASS':'VALIDATED',runId,mode:plan.mode,gitSha:manifest.gitSha,errors,qualityFindings,unresolved,coverage:{discovered:census.discovered,expectedSurfaces:plan.expectedSurfaces.length,captured:capturedSurfaces.length,missing:missingSurfaces,expectedCells:plan.cells.length,inspectedCells:entries.length,missingCells},heatmap,verifiedAt:now()};
}

export async function certifyVisualRun(root,{runId=currentVisualRunId(root)}={}){
  if(runId!==currentVisualRunId(root))throw new Error('VISUAL_NOT_CURRENT_STATE: recapture and inspect the latest state before certification');
  const checked=auditVisualRun(root,{runId}),cfg=loadVisualConfig(root),dir=runDirectory(root,runId);
  if(checked.status!=='VALIDATED'||checked.mode!=='full')return {...checked,status:checked.status==='VALIDATED'?'BLOCKED':checked.status,reason:'Full coverage with no unresolved findings is required'};
  const manifest=readJSON(path.join(dir,'manifest.json')),nonce=crypto.randomUUID();if(!cfg.capture.probeUrl)throw new Error('VISUAL_INDEPENDENT_LIVE_PROBE_REQUIRED');
  const url=new URL(cfg.capture.probeUrl);url.searchParams.set('visualAuditNonce',nonce);
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)throw new Error('VISUAL_LIVE_PROBE_HTTP_'+response.status);
  const probe=await response.json();if(probe.nonce!==nonce||probe.identity!==cfg.app.identity||probe.revision!==manifest.gitSha||probe.environment!==cfg.app.environment||probe.runtimeHealthy!==true||manifest.entries.some(e=>e.fixtureHash!==(probe.fixtureHashes?.[e.cellId]??probe.fixtureHash)))throw new Error('VISUAL_LIVE_PROBE_BUILD_FIXTURE_MISMATCH');
  const reviews=manifest.entries.map(e=>readJSON(path.join(dir,`reviews/${e.cellId}.json`))),certificate=sealVisual({schemaVersion:'executionkit-visual-certification/v2',status:'PASS',runId,gitSha:manifest.gitSha,manifestDigest:digest(manifest),reviewDigest:digest(reviews),verifiedAt:now(),probeDigest:digest(probe),nonce},'audit');
  writeJSON(path.join(dir,'certification.json'),certificate);const result=auditVisualRun(root,{runId,requireCertification:true});writeJSON(path.join(dir,'audit.json'),result);fs.writeFileSync(path.join(dir,'heatmap.md'),visualHeatmapMarkdown(result));return result;
}
export function inspectVisualEvidence(root,{boundary='phase'}={}){
  if(!fs.existsSync(path.join(root,'executionkit.visual.json')))return {schemaVersion:'executionkit-visual-audit/v2',status:'MISSING',errors:[{code:'VISUAL_V2_CONTRACT_REQUIRED',message:'Configure a canonical visual census and rendered evidence.'}],coverage:null};
  return auditVisualRun(root,{requireCertification:boundary!=='wave'});
}
export function compareVisualRemediation(root,claim){
  const c=validateVisualSchema(visualRemediationSchema,claim),beforeDir=runDirectory(root,c.beforeRunId),afterDir=runDirectory(root,c.afterRunId),before=readJSON(path.join(beforeDir,'manifest.json')),after=readJSON(path.join(afterDir,'manifest.json'));
  if(!verifySealed(before)||!verifySealed(after))throw new Error('VISUAL_REMEDIATION_SEAL_INVALID');
  const b=before.entries.find(e=>e.cellId===c.cellId),a=after.entries.find(e=>e.cellId===c.cellId);if(!b||!a)throw new Error('VISUAL_REMEDIATION_CELL_MISSING');
  let ancestor=false;try{ancestor=git(root,['merge-base','--is-ancestor',b.gitSha,a.gitSha])==='';}catch{ancestor=false;}
  if(Date.parse(b.captureTime)>=Date.parse(a.captureTime)||b.gitSha===a.gitSha||!ancestor||Number(git(root,['show','-s','--format=%ct',a.gitSha]))*1000<Date.parse(b.captureTime))throw new Error('VISUAL_BEFORE_NOT_PRECHANGE: before must precede the fix commit and after capture');
  for(const k of ['surfaceId','route','persona','locale','direction','theme','viewport','state','fixtureSet','fixtureHash','dataState'])if(digest(b[k])!==digest(a[k]))throw new Error('VISUAL_REMEDIATION_CONTEXT_MISMATCH: '+k);
  const beforeBytes=readArtifact(beforeDir,b.image),afterBytes=readArtifact(afterDir,a.image),comparison=compareVisualImages(beforeBytes,afterBytes),bg=JSON.parse(readArtifact(beforeDir,b.geometry)),ag=JSON.parse(readArtifact(afterDir,a.geometry));
  const geometryChanged=digest(bg)!==digest(ag);
  if(c.claim==='VISUAL_CHANGE'&&(comparison.identical||comparison.changedPixelRatio<Math.max(.001,c.minimumChangedPixelRatio)||comparison.structuralSimilarity>.9999&&!geometryChanged))return {schemaVersion:'executionkit-visual-comparison/v2',status:'FAIL',code:'VISUAL_REMEDIATION_NOT_PROVEN',claim:c,comparison,geometryChanged};
  if(c.claim==='NO_VISUAL_CHANGE_EXPECTED'&&(!comparison.identical||comparison.changedPixelRatio>0.0005))return {schemaVersion:'executionkit-visual-comparison/v2',status:'FAIL',code:'VISUAL_UNEXPECTED_CHANGE',claim:c,comparison,geometryChanged};
  const br=readJSON(safeVisualPath(beforeDir,`reviews/${b.cellId}.json`,{mustExist:true,file:true})),ar=readJSON(safeVisualPath(afterDir,`reviews/${a.cellId}.json`,{mustExist:true,file:true}));
  if(!verifySealed(br,'review')||!verifySealed(ar,'review')||br.imageSha256!==b.image.sha256||ar.imageSha256!==a.image.sha256)throw new Error('VISUAL_REMEDIATION_REINSPECTION_REQUIRED');
  const original=br.findings.find(f=>f.id===c.findingId);if(c.claim==='VISUAL_CHANGE'&&(!original||ar.findings.some(f=>f.id===c.findingId||f.category===original.category)))return {schemaVersion:'executionkit-visual-comparison/v2',status:'FAIL',code:'VISUAL_REMEDIATION_FINDING_UNRESOLVED',claim:c,comparison,geometryChanged};
  return {schemaVersion:'executionkit-visual-comparison/v2',status:'VERIFIED',code:c.claim==='NO_VISUAL_CHANGE_EXPECTED'?'NO_VISUAL_CHANGE_EXPECTED':'VISUAL_CHANGE_PROVEN',claim:c,comparison,geometryChanged,beforeSha:b.gitSha,afterSha:a.gitSha};
}
export function visualHeatmapMarkdown(audit){return ['| Surface | Status | Inspected / required | P0/P1 | Other findings |','|---|---|---:|---:|---:|',...(audit.heatmap??[]).map(x=>`| ${x.surface} | ${x.status} | ${x.inspectedCells}/${x.requiredCells} | ${x.findings.filter(f=>['P0','P1'].includes(f.severity)).length} | ${x.findings.filter(f=>!['P0','P1'].includes(f.severity)).length} |`)].join('\n')+'\n';}
