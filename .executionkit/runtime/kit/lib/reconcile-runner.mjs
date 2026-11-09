import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnBoundedSync,resolveNodeHost} from './bounded-process.mjs';
import {resolveDerivedPath} from './derived-state.mjs';
import {reconciliationBudget} from './reconcile-budget.mjs';
const worker=fileURLToPath(new URL('../bin/reconcile-worker.mjs',import.meta.url));
export function runBoundedReconciliation(root,options={}){
  const boundary=options.boundary??'task',configured=reconciliationBudget(root,options);
  const started=Date.now();
  if(options.deadlineAt!=null&&!Number.isFinite(options.deadlineAt))throw Error('Reconciliation deadline must be finite');
  const deadlineAt=options.deadlineAt!=null&&options.timeoutMs==null?Math.min(started+60*60*1000,options.deadlineAt):Math.min(started+configured,options.deadlineAt??Infinity);
  const timeoutMs=Math.max(0,deadlineAt-started);
  const request={...options,boundary,deadlineAt};delete request.timeoutMs;
  const run=timeoutMs>0?spawnBoundedSync(resolveNodeHost(),[worker,root,Buffer.from(JSON.stringify(request)).toString('base64')],{cwd:root,timeoutMs,maxBuffer:16*1024*1024,forwardProgress:true,progressContext:{operation:'reconcile',boundary}}):{timedOut:true,durationMs:0};
  if(Date.now()>deadlineAt)run.timedOut=true;
  let parsed=null;
  if(!run.error&&timeoutMs>0){try{
    const value=JSON.parse(run.stdout);
    if(value.schemaVersion==='executionkit-v4-reconciliation/v1'&&['PASS','FAIL','REVIEW_REQUIRED'].includes(value.status)){
      if(value.errors?.some(e=>e.code==='V4_BOUNDARY_DEADLINE_EXCEEDED'))run.timedOut=true;
      else if(!run.timedOut&&run.status===0&&['PASS','REVIEW_REQUIRED'].includes(value.status))return {...value,boundary,timeoutMs,durationMs:run.durationMs};
      else if(!run.timedOut&&['FAIL','REVIEW_REQUIRED'].includes(value.status))parsed=value;
    }
  }catch{}}
  // Every unsuccessful attempt replaces old acceptance, including an exception
  // before the worker could write a gate. A parsed PASS never overrides exit 1.
  const value={...(parsed??{}),schemaVersion:'executionkit-v4-reconciliation/v1',status:'FAIL',boundary,timedOut:run.timedOut===true,timeoutMs,durationMs:run.durationMs??Date.now()-started,blockingSystems:parsed?.blockingSystems?.length?parsed.blockingSystems:['execution'],errors:parsed?.errors??[{code:run.timedOut?'RECONCILE_TIMEOUT':'RECONCILE_WORKER_FAILED',message:run.timedOut?'Reconciliation exceeded its total deadline; unfinished checks are not accepted':'Reconciliation worker failed; inspect the last progress stage'}],nextCommand:'executionkit reconcile status . --boundary '+boundary,gatePath:'.executionkit/gates/reconcile-'+boundary+'.json',reconciledAt:new Date().toISOString()};
  const file=resolveDerivedPath(root,'.executionkit/gates/reconcile-'+boundary+'.json','reconciliation timeout receipt',{file:true,createParents:true});
  fs.writeFileSync(file,JSON.stringify(value)+'\n');
  return value;
}
