import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIMENSIONS, digest, loadVisualConfig, readJSON, runDirectory, safeVisualPath, sealVisual, sha256, verifySealed, writeJSON } from './visual-contract.mjs';
import { analyzeVisualGeometry } from './visual-geometry.mjs';
import { inspectVisualImage } from './visual-image.mjs';
import { validateVisualSchema, visualReviewSchema } from './visual-schema.mjs';

export const DESIGN_REFINEMENT_FRAMEWORK = Object.freeze({
  designDirectionParts: Object.freeze(['Product', 'Character', 'World', 'Moments', 'Signature']),
  interventionLevels: Object.freeze(['No Change', 'Light Polish', 'Full Refinement']),
  conceptualPasses: Object.freeze(['Spacing', 'Color', 'Icons', 'Copy', 'Typography', 'Layout', 'Details', 'Visuals', 'Motion']),
});

export function visualCriticRequest(entry,geometry,image,nonce,model){
  const findings=analyzeVisualGeometry(geometry,{compact:entry.viewport.width<600});
  // Show blocking geometry first and cap context; audit still enforces EVERY finding.
  const priority={P0:0,P1:1,P2:2,review:3};
  const selectedFindings=[...findings].sort((a,b)=>(priority[a.severity]??4)-(priority[b.severity]??4)).slice(0,24);
  const geometrySeverityCounts=Object.fromEntries(['P0','P1','P2','review'].map(s=>[s,findings.filter(f=>f.severity===s).length]));
  const appliedTypefaces=[...new Set((geometry.nodes??[]).filter(node=>node.ownText).map(node=>node.fontFamily).filter(Boolean))].slice(0,20);
  return {model,max_tokens:3000,messages:[
    {role:'system',content:'Inspect the supplied rendered product image itself. Do not accept a stable baseline or a PASS report as visual quality. Evaluate product hierarchy, useful information, layout, nested padding/margins, whitespace, readable type, CTA and navigation discoverability, forms, mobile ergonomics, RTL/LTR, actual applied theme, accessibility, generic framework/card/icon/KPI abuse, actual stylesheet/font loading, named-font fallbacks, header/logo sizing and horizontal balance, the real bottom gap and safe-area of fixed WhatsApp/call CTA bars, hidden actions under overlays, first-fold rhythm, oversized control icons, below-fold content, whether useful brand-specific local Gemini imagery is missing or merely decorative, media usefulness, placeholders, debug indicators and meaningful loading/empty/error/success affordances. Apply the 5-part Design Direction (Product, Character, World, Moments, Signature), determine the warranted intervention level (No Change, Light Polish, Full Refinement), and check all 9 conceptual refinement passes (Spacing, Color, Icons, Copy, Typography, Layout, Details, Visuals, Motion) mapped onto the 21 required dimensions (flagging decorative emoji in UI chrome, purple-to-blue glowing gradients, uniform icon-in-circle card grids, AI hype copy or bare KPI deltas without baselines, 800-900 weight abuse, negative tracking on small/Arabic text, non-concentric nested radii, 3D blobs/orbs, and layout-shifting transition-all while preserving legitimate brand-approved visual languages). Geometry findings are review leads, not a substitute for vision. Return only JSON. Each dimension needs a specific visible observation or a reason it is not applicable. Never fabricate a visual observation or approve an uninspected image. P0/P1 defects block; P2 and review findings need independent disposition. Use actionable findings with acceptance criteria. For review-severity mechanical leads only, geometryDispositions may explicitly judge a specific finding INTENTIONAL with concrete image-based rationale or CONFIRMED. Never dismiss P0/P1 or objective P2 failures this way.'},
    {role:'user',content:[{type:'text',text:JSON.stringify({nonce,runId:entry.runId,cellId:entry.cellId,imageSha256:entry.image.sha256,surface:entry.surfaceId,state:entry.state,route:entry.route,persona:entry.persona,locale:entry.locale,direction:entry.direction,theme:entry.theme,viewport:entry.viewport,geometryFindings:selectedFindings,geometryFindingCount:findings.length,geometrySeverityCounts,presentationObservation:geometry.presentation,appliedTypefaces,designRefinementFramework:DESIGN_REFINEMENT_FRAMEWORK,requiredDimensions:DIMENSIONS,responseShape:{nonce:'echo',runId:'echo',cellId:'echo',imageSha256:'echo',dimensions:[{dimension:'each required dimension exactly once',verdict:'PASS|FINDING|NOT_APPLICABLE',observation:'specific actual rendered observation'}],geometryDispositions:[{findingId:'geometry finding id',category:'exact category',verdict:'INTENTIONAL|CONFIRMED',reason:'specific rendered rationale',imageSha256:entry.image.sha256}],findings:[{id:'stable id',surface:entry.surfaceId,checkpoint:entry.state,severity:'P0|P1|P2|review',category:'code',observedEvidence:'visible location and defect',reason:'product implication',recommendedRemediation:'action',acceptanceCriteria:'observable outcome',evidenceRefs:[entry.image.sha256]}]}})},
      {type:'image_url',image_url:{url:'data:image/png;base64,'+image.toString('base64'),detail:'high'}}]}
  ]};
}

export function executeAntigravityVisualCritic(){
  throw new Error('VISUAL_HOST_EXECUTOR_REQUIRED: provide a trusted native image reviewer; geometry cannot manufacture image observations or PASS');
}

function parseResponse(body){
  if(typeof body.choices?.[0]?.message?.content==='string'){
    const text=body.choices[0].message.content.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
    return JSON.parse(text);
  }
  if(body&&typeof body==='object'){
    if(body.result&&typeof body.result==='object')return body.result;
    if(Array.isArray(body.dimensions))return body;
  }
  throw new Error('VISUAL_CRITIC_RESPONSE_INVALID');
}

export function decodeVisualCriticResponse(body){return parseResponse(body);}

function buildNativeVisualRequest(entry, geometry, runId, reviewerId, nonce = crypto.randomUUID()) {
  const findings = analyzeVisualGeometry(geometry, { compact: entry.viewport.width < 600 });
  const priority = { P0: 0, P1: 1, P2: 2, review: 3 };
  const selectedFindings = [...findings].sort((a, b) => (priority[a.severity] ?? 4) - (priority[b.severity] ?? 4)).slice(0, 24);
  const geometrySeverityCounts = Object.fromEntries(['P0', 'P1', 'P2', 'review'].map((s) => [s, findings.filter((f) => f.severity === s).length]));
  const appliedTypefaces = [...new Set((geometry.nodes ?? []).filter((node) => node.ownText).map((node) => node.fontFamily).filter(Boolean))].slice(0, 20);
  return {
    schemaVersion: 'executionkit-native-visual-request/v1',
    nonce,
    runId,
    cellId: entry.cellId,
    imageSha256: entry.image.sha256,
    geometrySha256: entry.geometry.sha256,
    reviewerId,
    imagePath: entry.image.path,
    geometryPath: entry.geometry.path,
    surface: entry.surfaceId,
    state: entry.state,
    route: entry.route,
    persona: entry.persona,
    locale: entry.locale,
    direction: entry.direction,
    theme: entry.theme,
    viewport: entry.viewport,
    geometryFindings: selectedFindings,
    geometryFindingCount: findings.length,
    geometrySeverityCounts,
    presentationObservation: geometry.presentation ?? null,
    appliedTypefaces,
    designRefinementFramework: DESIGN_REFINEMENT_FRAMEWORK,
    requiredDimensions: DIMENSIONS,
    responseShape: {
      nonce,
      runId,
      cellId: entry.cellId,
      imageSha256: entry.image.sha256,
      dimensions: [{ dimension: 'each required dimension exactly once', verdict: 'PASS|FINDING|NOT_APPLICABLE', observation: 'specific actual rendered observation (>= 20 chars)' }],
      geometryDispositions: [{ findingId: 'geometry finding id', category: 'exact category', verdict: 'INTENTIONAL|CONFIRMED', reason: 'specific rendered rationale (>= 20 chars)', imageSha256: entry.image.sha256 }],
      findings: [{ id: 'stable id', surface: entry.surfaceId, checkpoint: entry.state, severity: 'P0|P1|P2|review', category: 'code', observedEvidence: 'visible location and defect', reason: 'product implication', recommendedRemediation: 'action', acceptanceCriteria: 'observable outcome', evidenceRefs: [entry.image.sha256] }],
    },
    submitCommand: `executionkit visual inspect . --run ${runId} --cell ${entry.cellId} --response <review-json-file>`,
  };
}

export async function submitNativeVisualReview(root, { runId, cellId, responseFile = null, response = null, reviewerId = null, config = null } = {}) {
  if (!runId) throw new Error('VISUAL_NATIVE_SUBMIT_RUN_REQUIRED: --run <runId> is required');
  if (!cellId) throw new Error('VISUAL_NATIVE_SUBMIT_CELL_REQUIRED: --cell <cellId> is required');
  if (!response && !responseFile) throw new Error('VISUAL_NATIVE_SUBMIT_RESPONSE_REQUIRED: --response <file> or response payload is required');
  const cfg = config ?? loadVisualConfig(root), dir = runDirectory(root, runId), manifest = readJSON(path.join(dir, 'manifest.json'));
  if (!verifySealed(manifest) || manifest.configDigest !== digest(cfg)) throw new Error('VISUAL_CAPTURE_SEAL_INVALID');
  const entry = manifest.entries.find((e) => e.cellId === cellId);
  if (!entry) throw new Error('VISUAL_REVIEW_CELL_UNKNOWN');
  const effectiveReviewer = reviewerId ?? cfg.critic?.reviewerId;
  if (!effectiveReviewer || effectiveReviewer !== cfg.critic?.reviewerId) throw new Error('VISUAL_NATIVE_REVIEWER_MISMATCH');
  if (effectiveReviewer === manifest.producerId) throw new Error('VISUAL_REVIEWER_SEPARATION_VIOLATION: native reviewer must differ from capture producer');
  const bytes = fs.readFileSync(safeVisualPath(dir, entry.image.path, { mustExist: true, file: true }));
  const geometryBytes = fs.readFileSync(safeVisualPath(dir, entry.geometry.path, { mustExist: true, file: true }));
  if (sha256(bytes) !== entry.image.sha256 || sha256(geometryBytes) !== entry.geometry.sha256) throw new Error('VISUAL_REVIEW_ARTIFACT_CHANGED');
  const imgMeta = inspectVisualImage(bytes);
  if (imgMeta.width < entry.viewport.width || imgMeta.height < entry.viewport.height) throw new Error('VISUAL_REVIEW_SCREENSHOT_DIMENSIONS_INVALID');
  const requestFile = safeVisualPath(dir, `native/requests/${entry.cellId}.json`);
  const geometry = JSON.parse(geometryBytes);
  const nativeRequest = fs.existsSync(requestFile) ? readJSON(requestFile) : buildNativeVisualRequest(entry, geometry, runId, cfg.critic.reviewerId);
  if (nativeRequest.runId !== runId || nativeRequest.cellId !== entry.cellId || nativeRequest.imageSha256 !== entry.image.sha256 || nativeRequest.geometrySha256 !== entry.geometry.sha256 || nativeRequest.reviewerId !== cfg.critic.reviewerId) {
    throw new Error('VISUAL_NATIVE_REQUEST_CHANGED');
  }
  if (!fs.existsSync(requestFile)) writeJSON(requestFile, nativeRequest, true);
  const rawBody = response ?? readJSON(path.resolve(root, responseFile));
  const parsed = parseResponse(rawBody);
  for (const [k, v] of Object.entries({ nonce: nativeRequest.nonce, runId, cellId: entry.cellId, imageSha256: entry.image.sha256 })) {
    if (parsed[k] !== v) throw new Error('VISUAL_CRITIC_INPUT_NOT_REVIEWED: ' + k);
  }
  if (!Array.isArray(parsed.dimensions) || new Set(parsed.dimensions.map((x) => x.dimension)).size !== DIMENSIONS.length || parsed.dimensions.some((d) => typeof d.observation !== 'string' || d.observation.trim().length < 20)) {
    throw new Error('VISUAL_CRITIC_DIMENSIONS_INCOMPLETE');
  }
  if (!Array.isArray(parsed.findings) || parsed.findings.some((f) => f.surface !== entry.surfaceId || f.checkpoint !== entry.state || !Array.isArray(f.evidenceRefs) || f.evidenceRefs.length !== 1 || f.evidenceRefs[0] !== entry.image.sha256)) {
    throw new Error('VISUAL_CRITIC_FINDING_UNBOUND');
  }
  const nativeResponseFile = safeVisualPath(dir, `native/responses/${entry.cellId}.json`);
  const sealedNative = sealVisual({
    schemaVersion: 'executionkit-native-visual-response/v1',
    requestDigest: digest(nativeRequest),
    reviewerId: effectiveReviewer,
    reviewedAt: new Date(Math.max(Date.now(), Date.parse(entry.captureTime) + 1)).toISOString(),
    result: parsed,
  }, 'review');
  writeJSON(nativeResponseFile, sealedNative, true);
  const allReady = manifest.entries.every((e) => e.cellId === cellId || fs.existsSync(safeVisualPath(dir, `reviews/${e.cellId}.json`)) || fs.existsSync(safeVisualPath(dir, `native/responses/${e.cellId}.json`)));
  return inspectVisualRun(root, { runId, config: cfg, cellIds: allReady ? null : [cellId] });
}

export async function inspectVisualRun(root,{runId,config=null,cellIds=null}={}){
  const cfg=config??loadVisualConfig(root),dir=runDirectory(root,runId),manifest=readJSON(path.join(dir,'manifest.json'));
  if(!verifySealed(manifest)||manifest.configDigest!==digest(cfg))throw new Error('VISUAL_CAPTURE_SEAL_INVALID');
  const provider=cfg.critic?.provider??'antigravity';
  const model=process.env[cfg.critic?.modelEnv??'EXECUTIONKIT_VISUAL_MODEL']||cfg.critic?.model||(provider==='antigravity'?'antigravity':null);
  let url=null,key=null;
  if(provider==='openai-compatible'){
    const endpoint=process.env[cfg.critic?.endpointEnv??'EXECUTIONKIT_VISUAL_MODEL_URL'];
    key=process.env[cfg.critic?.keyEnv??'EXECUTIONKIT_VISUAL_MODEL_KEY'];
    if(!endpoint||!model)throw new Error('VISUAL_CRITIC_NOT_PROVISIONED: actual vision model endpoint/model required');
    url=new URL(endpoint);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Visual model endpoint requires HTTPS or an explicit local bridge');
  }else if(provider!=='antigravity'){
    throw new Error('VISUAL_CRITIC_UNSUPPORTED_PROVIDER: '+provider);
  }
  const selected=cellIds?manifest.entries.filter(e=>cellIds.includes(e.cellId)):manifest.entries;
  if(cellIds&&selected.length!==new Set(cellIds).size)throw new Error('VISUAL_REVIEW_CELL_UNKNOWN');
  if(selected.length>cfg.budgets.maxReviewCalls)throw new Error('VISUAL_REVIEW_CALL_BUDGET');
  const deadline=Date.now()+cfg.budgets.timeoutMs,results=[];
  const inspectEntry=async entry=>{
    const file=safeVisualPath(dir,`reviews/${entry.cellId}.json`);
    if(fs.existsSync(file)){
      const prior=readJSON(file);if(!verifySealed(prior,'review')||prior.imageSha256!==entry.image.sha256)throw new Error('VISUAL_PRIOR_REVIEW_INVALID');
      results.push({cellId:entry.cellId,status:'REUSED_IMMUTABLE_REVIEW'});return;
    }
    const bytes=fs.readFileSync(safeVisualPath(dir,entry.image.path,{mustExist:true,file:true})),geometryBytes=fs.readFileSync(safeVisualPath(dir,entry.geometry.path,{mustExist:true,file:true}));
    if(sha256(bytes)!==entry.image.sha256||sha256(geometryBytes)!==entry.geometry.sha256)throw new Error('VISUAL_REVIEW_ARTIFACT_CHANGED');
    const imgMeta=inspectVisualImage(bytes);
    if(imgMeta.width<entry.viewport.width||imgMeta.height<entry.viewport.height)throw new Error('VISUAL_REVIEW_SCREENSHOT_DIMENSIONS_INVALID');
    const geometry=JSON.parse(geometryBytes);
    const requestFile=safeVisualPath(dir,`native/requests/${entry.cellId}.json`),nativeResponseFile=safeVisualPath(dir,`native/responses/${entry.cellId}.json`);
    let nativeRequest=null;
    if(provider==='antigravity'&&!process.env.EXECUTIONKIT_VISUAL_HOST_EXECUTOR){
      nativeRequest=fs.existsSync(requestFile)?readJSON(requestFile):buildNativeVisualRequest(entry,geometry,runId,cfg.critic.reviewerId);
      if(nativeRequest.runId!==runId||nativeRequest.cellId!==entry.cellId||nativeRequest.imageSha256!==entry.image.sha256||nativeRequest.geometrySha256!==entry.geometry.sha256||nativeRequest.reviewerId!==cfg.critic.reviewerId)throw Error('VISUAL_NATIVE_REQUEST_CHANGED');
      if(!fs.existsSync(requestFile))writeJSON(requestFile,nativeRequest,true);
      if(!fs.existsSync(nativeResponseFile)){results.push({cellId:entry.cellId,status:'REVIEW_REQUIRED',requestPath:path.relative(root,requestFile).split(path.sep).join('/'),imagePath:path.relative(root,path.join(dir,entry.image.path)).split(path.sep).join('/'),submitCommand:`executionkit visual inspect . --run ${runId} --cell ${entry.cellId} --response <review-json-file>`});return;}
    }
    const nonce=nativeRequest?.nonce??crypto.randomUUID(),request=visualCriticRequest(entry,geometry,bytes,nonce,model),remaining=deadline-Date.now();if(remaining<1)throw new Error('VISUAL_REVIEW_TIMEOUT');
    let providerBody,result;
    if(provider==='antigravity'){
      if(process.env.EXECUTIONKIT_VISUAL_HOST_EXECUTOR){
        const mod=await import(pathToFileURL(path.resolve(process.env.EXECUTIONKIT_VISUAL_HOST_EXECUTOR)).href);
        const fn=mod.default??mod.inspectVisualCell;
        result=await fn({entry,geometry,image:bytes,nonce,model,config:cfg});
      }else{
        const native=readJSON(nativeResponseFile),reviewed=Date.parse(native.reviewedAt);
        if(native.schemaVersion!=='executionkit-native-visual-response/v1'||!verifySealed(native,'review')||native.requestDigest!==digest(nativeRequest)||native.reviewerId!==cfg.critic.reviewerId||!Number.isFinite(reviewed)||reviewed<Date.parse(entry.captureTime)||reviewed>Date.now()+5000)throw Error('VISUAL_NATIVE_RESPONSE_UNTRUSTED');
        result=native.result;
      }
      providerBody={provider:'antigravity',model,choices:[{message:{content:JSON.stringify(result)}}]};
    }else{
      const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},body:JSON.stringify(request),signal:AbortSignal.timeout(Math.min(120000,remaining))});
      if(!response.ok)throw new Error('VISUAL_CRITIC_HTTP_'+response.status);
      const responseText=await response.text();if(responseText.length>1024*1024)throw new Error('VISUAL_CRITIC_RESPONSE_BUDGET');
      providerBody=JSON.parse(responseText);
      result=parseResponse(providerBody);
    }
    for(const [k,v] of Object.entries({nonce,runId,cellId:entry.cellId,imageSha256:entry.image.sha256}))if(result[k]!==v)throw new Error('VISUAL_CRITIC_INPUT_NOT_REVIEWED: '+k);
    const responsePath=`reviews/${entry.cellId}.response.json`;writeJSON(safeVisualPath(dir,responsePath),providerBody,true);
    const review=sealVisual({schemaVersion:'executionkit-visual-review/v2',runId,cellId:entry.cellId,imageSha256:entry.image.sha256,nonce,reviewerId:cfg.critic.reviewerId,producerId:manifest.producerId,provider,model,reviewedAt:new Date().toISOString(),requestDigest:digest(request),response:{path:responsePath,sha256:sha256(fs.readFileSync(path.join(dir,responsePath)))},dimensions:result.dimensions,findings:result.findings,...(result.geometryDispositions?{geometryDispositions:result.geometryDispositions}:{})},'review');
    validateVisualSchema(visualReviewSchema,review);
    if(new Set(review.dimensions.map(x=>x.dimension)).size!==DIMENSIONS.length)throw new Error('VISUAL_CRITIC_DIMENSIONS_INCOMPLETE');
    if(review.findings.some(f=>f.surface!==entry.surfaceId||f.checkpoint!==entry.state||f.evidenceRefs.length!==1||f.evidenceRefs[0]!==entry.image.sha256))throw new Error('VISUAL_CRITIC_FINDING_UNBOUND');
    writeJSON(file,review,true);results.push({cellId:entry.cellId,status:'REVIEWED',findings:review.findings.length});
  };
  const concurrency=cfg.critic?.concurrency??2;
  for(let i=0;i<selected.length;i+=concurrency){const batch=await Promise.allSettled(selected.slice(i,i+concurrency).map(inspectEntry));const failure=batch.find(r=>r.status==='rejected');if(failure)throw failure.reason;}
  results.sort((a,b)=>selected.findIndex(e=>e.cellId===a.cellId)-selected.findIndex(e=>e.cellId===b.cellId));
  const pending=results.filter(result=>result.status==='REVIEW_REQUIRED').length;
  return {schemaVersion:'executionkit-visual-inspection/v2',status:pending?'REVIEW_REQUIRED':cellIds?'INSPECTED_SUBSET':'INSPECTED',runId,calls:results.filter(x=>x.status==='REVIEWED').length,pending,results,...(pending?{reason:'VISUAL_NATIVE_IMAGE_REVIEW_REQUIRED',message:'Open every pending image with a native image reviewer and provide its signed image-bound response via --response <review-json-file> before resumeCommand. Repeating inspect alone cannot review screenshots.',resumeCommand:'executionkit visual inspect . --run '+runId,submitCommand:'executionkit visual inspect . --run '+runId+' --cell <cellId> --response <review-json-file>'}:{}),nextCommand:null};
}
