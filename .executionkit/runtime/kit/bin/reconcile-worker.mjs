#!/usr/bin/env node
import {reconcileV4Lifecycle} from '../lib/v4-reconcile.mjs';
try{
  const options=JSON.parse(Buffer.from(process.argv[3],'base64').toString('utf8'));
  process.stdout.write(JSON.stringify(reconcileV4Lifecycle(process.argv[2],options))+'\n');
}catch(error){
  process.stdout.write(JSON.stringify({schemaVersion:'executionkit-v4-reconciliation/v1',status:'FAIL',errors:[{code:error.code??'RECONCILE_FAILED',message:error.message}],blockingSystems:['execution']})+'\n');
  process.exitCode=1;
}
