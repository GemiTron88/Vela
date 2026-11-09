#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSeoImplementation } from '../lib/v4-seo-os.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),action=args[0]&&!args[0].startsWith('--')?args.shift():'status';
const root=path.resolve(args[0]&&!args[0].startsWith('--')?args.shift():'.');
const bIdx=args.indexOf('--boundary');
const boundary=args.includes('--release')?'release':(args.find((x)=>x.startsWith('--boundary='))?.split('=')[1]??(bIdx>=0&&args[bIdx+1]&&!args[bIdx+1].startsWith('--')?args[bIdx+1]:'task'));
const write=action==='validate'&&!args.includes('--no-write');
function contract(){const argv=[path.join(here,'validate-seo.mjs'),root];if(boundary==='release')argv.push('--release');if(!write)argv.push('--no-write');const r=spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:16*1024*1024});if(r.error)return {status:'FAIL',errors:[{code:'SEO_CONTRACT_EXEC_FAILED',message:r.error.message}]};try{return JSON.parse(String(r.stdout??'').trim());}catch{return {status:'FAIL',errors:[{code:'SEO_CONTRACT_OUTPUT_INVALID',message:String(r.stderr||r.stdout||'').slice(0,4000)}]};}}
try{
  if(!['status','validate'].includes(action))throw new Error('Unknown SEO OS action: '+action);
  const contractResult=contract(),implementation=inspectSeoImplementation(root,{boundary,writeEvidence:write});
  const statuses=[contractResult.status,implementation.status];
  const status=statuses.includes('FAIL')?'FAIL':statuses.includes('REVIEW_REQUIRED')?'REVIEW_REQUIRED':statuses.every((x)=>x==='NOT_APPLICABLE')?'NOT_APPLICABLE':'PASS';
  const implGates=implementation.gates??{};
  const gates={
    S0:contractResult.status,
    S1:implGates.S1??implementation.status,
    S2:['wave','phase','release'].includes(boundary)?(implGates.S2&&implGates.S2!=='DEFERRED'?implGates.S2:status):'DEFERRED',
    S3:['phase','release'].includes(boundary)?(implGates.S3&&implGates.S3!=='DEFERRED'?implGates.S3:status):'DEFERRED',
    S4:boundary==='release'?(implGates.S4&&implGates.S4!=='DEFERRED'?implGates.S4:status):'DEFERRED',
    S5:implGates.S5??'ADVISORY'
  };
  const result={schemaVersion:'executionkit-v4-seo-os/v1',status,boundary,gates,contract:contractResult,implementation,observedAt:new Date().toISOString()};
  console.log(JSON.stringify(result,null,2));process.exitCode=status==='FAIL'?1:status==='REVIEW_REQUIRED'?2:0;
}catch(error){console.error(JSON.stringify({schemaVersion:'executionkit-v4-seo-os/v1',status:'BLOCKED',error:error.message}));process.exitCode=1;}
