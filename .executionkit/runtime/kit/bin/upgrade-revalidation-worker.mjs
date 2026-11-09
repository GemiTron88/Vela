#!/usr/bin/env node
import {executeUpgradeRevalidation} from '../lib/v4-upgrade-revalidation.mjs';
try{
  const options=JSON.parse(Buffer.from(process.argv[3],'base64').toString('utf8'));
  process.stdout.write(JSON.stringify(executeUpgradeRevalidation(process.argv[2],options))+'\n');
}catch(error){
  process.stdout.write(JSON.stringify({schemaVersion:'executionkit-v4-upgrade-revalidation-run/v1',status:'FAIL',ok:false,findings:[{code:error.code??'UPGRADE_REVALIDATION_FAILED',message:error.message}]})+'\n');
  process.exitCode=1;
}
