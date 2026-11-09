#!/usr/bin/env node
import path from 'node:path';
import { captureVisualMatrix } from '../lib/visual-capture.mjs';
import { inspectVisualRun } from '../lib/visual-critic.mjs';
import { auditVisualRun, certifyVisualRun } from '../lib/visual-audit.mjs';
const args=process.argv.slice(2),root=path.resolve(args[0]&&!args[0].startsWith('--')?args.shift():'.'),value=(k,d=null)=>{const eq=args.find(x=>x.startsWith('--'+k+'='));if(eq)return eq.slice(k.length+3);const i=args.indexOf('--'+k);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:d;};
try{
  const boundary=value('boundary','phase'),journeyRunId=value('run');
  // Native journey checkpoints belong to a full plan and are completed by the
  // generic capture engine, without reexecuting successful semantic writes.
  const capture=await captureVisualMatrix(root,{mode:journeyRunId||boundary!=='wave'?'full':'impact',base:boundary==='wave'&&!journeyRunId?value('base','HEAD~1'):null,resume:journeyRunId});
  if(capture.status!=='CAPTURED')throw new Error('VISUAL_CAPTURE_NOT_COMPLETE: '+JSON.stringify(capture.failures));
  const review=await inspectVisualRun(root,{runId:capture.runId});
  if(review.status==='REVIEW_REQUIRED'){
    console.log(JSON.stringify({schemaVersion:'executionkit-visual-boundary/v2',status:'REVIEW_REQUIRED',reason:review.reason,message:review.message,boundary,runId:capture.runId,pending:review.pending,nextCommand:null,resumeCommand:review.resumeCommand,capture,review}));process.exitCode=1;
  }else{
    const audit=boundary==='wave'?auditVisualRun(root,{runId:capture.runId}):await certifyVisualRun(root,{runId:capture.runId});
    console.log(JSON.stringify({schemaVersion:'executionkit-visual-boundary/v2',status:['PASS','VALIDATED'].includes(audit.status)?'PASS':'FAIL',boundary,capture,review,audit}));if(!['PASS','VALIDATED'].includes(audit.status))process.exitCode=1;
  }
}catch(error){console.log(JSON.stringify({schemaVersion:'executionkit-visual-boundary/v2',status:'FAIL',message:error.message}));process.exitCode=1;}
