import fs from 'node:fs';
import path from 'node:path';
import { beginVisualRun, captureWebCheckpoint, captureMobileCheckpoint, finishVisualRun, observeVisualRuntime, resumeVisualCapture } from './visual-capture.mjs';
import { loadVisualConfig, readJSON, runDirectory, safeVisualPath, sha256, sourceIdentity, verifySealed, writeJSON } from './visual-contract.mjs';

export function prepareVisualJourneyRun(root,manifest){
  if(!manifest.journeys.some(j=>j.visualCheckpoints?.length))return null;
  return beginVisualRun(root).run.runId;
}
export function resumeVisualJourneyRun(root,runId=process.env.EXECUTIONKIT_VISUAL_RUN_ID){
  return resumeVisualCapture(root,runId);
}
export function finishVisualJourneyRun(root,runId){return finishVisualRun(resumeVisualJourneyRun(root,runId));}

// surfaceOf is the public @e2e-dev/web seam. It exposes the SAME live page the
// semantic agent used. Capturing it does not navigate or repeat journey writes.
export function startJourneyVisualObservation(engine,surfaceOf){
  const live=surfaceOf(engine);if(!live)throw new Error('VISUAL_JOURNEY_WEB_SURFACE_UNAVAILABLE');
  // The pinned SDK creates its page on app.open(), but its attempt context is
  // already available. Observe page creation BEFORE navigation so initial
  // console/network failures cannot escape the checkpoint runtime evidence.
  const context=live.context(),runtime={consoleErrors:[],exceptions:[],failedRequests:[],httpErrors:[],unexpectedRedirects:[],flutterExceptions:[],complete:true},observers=new Map();
  const attach=page=>{if(!observers.has(page))observers.set(page,observeVisualRuntime(page,{runtime}));};
  context.pages().forEach(attach);context.on('page',attach);
  return {get page(){const page=live.page();attach(page);return page;},runtime,dispose(){context.off('page',attach);for(const o of observers.values())o.dispose();}};
}
export async function recordJourneyVisualCheckpoint({root,journeyId,checkpointId,dimensions,observation=null,mobile=false}){
  const e2eRun=process.env.EXECUTIONKIT_E2E_RUN_ID,proofRoot=process.env.EXECUTIONKIT_E2E_POSTCONDITION_DIR;if(!e2eRun||!proofRoot||!path.isAbsolute(proofRoot))throw new Error('Visual checkpoints require the Kit-owned semantic journey run');
  const session=resumeVisualJourneyRun(root),manifest=readJSON(path.join(root,'executionkit.journeys.json')),journey=manifest.journeys.find(j=>j.id===journeyId),checkpoint=journey?.visualCheckpoints?.find(c=>c.id===checkpointId);
  if(!checkpoint)throw new Error('Undeclared visual checkpoint');
  const cells=session.plan.cells.filter(c=>c.surfaceId===checkpoint.surface&&c.state===checkpoint.state&&Object.entries(dimensions).every(([k,v])=>k==='viewport'?c.viewport.id===v:c[k]===v));
  if(cells.length!==1)throw new Error('VISUAL_CHECKPOINT_MATRIX_AMBIGUOUS: add an explicit requiredCell for this target/state');
  const binding={runId:e2eRun,journeyId,checkpointId},entry=mobile?await captureMobileCheckpoint(session,{cell:cells[0],journey:binding}):await captureWebCheckpoint(session,{page:observation?.page,cell:cells[0],runtime:observation?.runtime,journey:binding});
  const receipt={schemaVersion:'executionkit-journey-visual-checkpoint/v2',...binding,visualRunId:session.run.runId,cellId:entry.cellId,entryDigest:sha256(JSON.stringify(entry)),imageSha256:entry.image.sha256};
  writeJSON(safeVisualPath(path.dirname(proofRoot),`visual-checkpoints/${journeyId}/${checkpointId}.json`),receipt,true);return receipt;
}
export function verifyJourneyVisualCheckpoints(root,output,journey,runId){
  const errors=[];for(const c of journey.visualCheckpoints??[]){try{
    const receipt=readJSON(safeVisualPath(output,`visual-checkpoints/${journey.id}/${c.id}.json`,{mustExist:true,file:true})),dir=runDirectory(root,receipt.visualRunId),manifest=readJSON(path.join(dir,'manifest.json')),entry=manifest.entries.find(e=>e.cellId===receipt.cellId);
    const source=sourceIdentity(root);if(manifest.gitSha!==source.gitSha||manifest.gitTree!==source.gitTree)throw new Error('Checkpoint source is stale');
    if(receipt.schemaVersion!=='executionkit-journey-visual-checkpoint/v2'||receipt.runId!==runId||receipt.journeyId!==journey.id||receipt.checkpointId!==c.id||!verifySealed(manifest)||!entry||!verifySealed(entry)||entry.journey?.runId!==runId||entry.journey?.journeyId!==journey.id||entry.journey?.checkpointId!==c.id||entry.surfaceId!==c.surface||entry.state!==c.state||receipt.entryDigest!==sha256(JSON.stringify(entry))||receipt.imageSha256!==entry.image.sha256||sha256(fs.readFileSync(safeVisualPath(dir,entry.image.path,{mustExist:true,file:true})))!==entry.image.sha256)throw new Error('Checkpoint receipt or captured bytes do not match the real journey');
  }catch(error){errors.push({code:'AGENTIC_VISUAL_CHECKPOINT_UNPROVEN',message:`${c.id}: ${error.message}`});}}return errors;
}
