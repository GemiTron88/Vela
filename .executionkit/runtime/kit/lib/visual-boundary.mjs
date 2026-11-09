import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnBoundedSync } from './bounded-process.mjs';
import { loadVisualConfig } from './visual-contract.mjs';
import { inspectVisualEvidence } from './visual-audit.mjs';

export function executeVisualBoundary(root,{boundary,base='HEAD~1',deadlineAt=null,journeyRunId=null}={}){
  if(!fs.existsSync(path.join(root,'executionkit.visual.json')))return {status:'NOT_CONFIGURED'};
  const prior=inspectVisualEvidence(root,{boundary});if(prior.status==='PASS'||(boundary==='wave'&&prior.status==='VALIDATED'))return {status:'REUSED_CURRENT_EVIDENCE',evidence:prior};
  const missingReviews=(prior.errors??[]).filter(e=>e.code==='VISUAL_SCREENSHOT_OR_REVIEW_MISSING'&&/(?:^|[/: ])reviews\//.test(String(e.message).replaceAll('\\','/')));
  const reviewOnlyErrors=new Set(['VISUAL_SCREENSHOT_OR_REVIEW_MISSING','VISUAL_COVERAGE_MISSING','VISUAL_CERTIFICATION_REQUIRED']);
  if(missingReviews.length&&(prior.errors??[]).every(e=>e.code==='VISUAL_SCREENSHOT_OR_REVIEW_MISSING'?/(?:^|[/: ])reviews\//.test(String(e.message).replaceAll('\\','/')):reviewOnlyErrors.has(e.code))&&fs.existsSync(path.join(root,'.executionkit/visual/runs',prior.runId,'native/requests')))return {
    status:'EXPLICIT_IMAGE_REVIEW_REQUIRED',reason:'VISUAL_NATIVE_IMAGE_REVIEW_REQUIRED',runId:prior.runId,
    message:'Review the queued current PNGs and provide signed image-bound responses. Repeating the boundary must not discard pending screenshots or recapture them.',
    imageRoot:'.executionkit/visual/runs/'+prior.runId+'/images',requestRoot:'.executionkit/visual/runs/'+prior.runId+'/native/requests',nextCommand:null,
    submitCommand:'executionkit visual inspect . --run '+prior.runId+' --cell <cellId> --response <review-json-file>',
    resumeCommand:'executionkit visual inspect . --run '+prior.runId,evidence:prior,
  };
  if((prior.errors??[]).length&&(prior.errors??[]).every(e=>e.code==='VISUAL_CERTIFICATION_REQUIRED')&&!(prior.unresolved??[]).length&&prior.coverage?.missingCells?.length===0)return {
    status:'EXPLICIT_CERTIFICATION_REQUIRED',runId:prior.runId,message:'Current images and reviews are validated; certify this run instead of recapturing it.',
    nextCommand:'executionkit visual certify . --run '+prior.runId,evidence:prior,
  };
  const cfg=loadVisualConfig(root);if(cfg.autoRunOnBoundary!==true)return {status:'EXPLICIT_CAPTURE_REQUIRED',evidence:prior};
  const script=fileURLToPath(new URL('../bin/visual-boundary.mjs',import.meta.url)),remaining=Math.min(cfg.budgets.timeoutMs,deadlineAt===null?Infinity:deadlineAt-Date.now());
  if(remaining<1000)return {status:'FAIL',code:'VISUAL_BOUNDARY_DEADLINE'};
  const r=spawnBoundedSync(process.execPath,[script,root,'--boundary='+boundary,'--base='+base,...(journeyRunId?['--run='+journeyRunId]:[])],{cwd:root,timeoutMs:remaining,maxBuffer:16*1024*1024});
  let result;try{result=JSON.parse(r.stdout.trim());}catch{return {status:'FAIL',code:'VISUAL_BOUNDARY_PROCESS_FAILED',message:r.error?.message??r.stderr??'Invalid JSON'};}
  return r.status===0?result:{...result,status:'FAIL',exitCode:r.status};
}
