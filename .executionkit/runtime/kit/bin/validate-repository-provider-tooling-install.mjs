#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyRepositoryProviderTooling,
  doctorRepositoryProviderTooling,
  MANAGED_REPOSITORY_PROVIDER_TOOLS,
  planRepositoryProviderTooling,
} from '../lib/repository-provider-deployment.mjs';
import { inspectRepositoryProviders } from '../lib/repository-providers.mjs';

const args=process.argv.slice(2);
const get=(name)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);return i>=0?args[i+1]??null:null;};
const providers=(get('providers')??Object.keys(MANAGED_REPOSITORY_PROVIDER_TOOLS).join(',')).split(',').map((x)=>x.trim()).filter(Boolean);
const outputArg=get('output'),outputPath=outputArg?path.resolve(outputArg):null;
const emit=(value,{error=false}={})=>{
  const body=`${JSON.stringify(value,null,2)}\n`;
  if(outputPath){fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,body,{mode:0o600});}
  (error?console.error:console.log)(body.trimEnd());
};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-provider-smoke-'));
const startedAt=new Date().toISOString();

try{
  const plan=planRepositoryProviderTooling(root,{providers});
  const blocked=plan.actions.filter((x)=>x.action==='BLOCKED'||x.action==='SKIP_INCOMPATIBLE'||x.action==='SKIP_UNSUPPORTED');
  if(blocked.length) throw new Error(`Provider smoke plan is not fully executable: ${blocked.map((x)=>`${x.provider}:${x.action}:${x.reason}`).join(', ')}`);
  const apply=applyRepositoryProviderTooling(root,{providers,expectedPlan:plan.planId});
  const doctor=doctorRepositoryProviderTooling(root);
  if(!doctor.ok) throw new Error(`Provider tooling doctor failed: ${doctor.errors.join('; ')}`);
  const status=inspectRepositoryProviders(root,{pathEnv:''});
  if(status.toolingError) throw new Error(`Managed provider tooling health error: ${status.toolingError}`);
  const selected=status.providers.filter((item)=>providers.includes(item.id));
  const missing=providers.filter((id)=>!selected.some((item)=>item.id===id));
  if(missing.length) throw new Error(`Managed provider health missing providers: ${missing.join(', ')}`);
  const notReady=selected.filter((item)=>item.status!=='READY');
  if(notReady.length) throw new Error(`Managed provider health not READY: ${notReady.map((x)=>`${x.id}:${x.status}:${x.health?.reason??'unknown'}`).join(', ')}`);
  const versionMismatch=selected.filter((item)=>MANAGED_REPOSITORY_PROVIDER_TOOLS[item.id]?.version!==item.version);
  if(versionMismatch.length) throw new Error(`Managed provider version mismatch: ${versionMismatch.map((x)=>`${x.id}:${x.version}`).join(', ')}`);

  emit({
    schemaVersion:'repository-provider-tooling-smoke/v1',
    status:'PASS',
    startedAt,
    completedAt:new Date().toISOString(),
    node:process.version,
    platform:process.platform,
    arch:process.arch,
    providers:selected.map((item)=>({id:item.id,status:item.status,version:item.version})),
    apply:{status:apply.status,receipt:apply.receipt},
    doctor:{status:doctor.status,errors:doctor.errors},
    cleanupPolicy:'remove temporary project in finally',
  });
}catch(error){
  emit({
    schemaVersion:'repository-provider-tooling-smoke/v1',
    status:'FAIL',
    startedAt,
    failedAt:new Date().toISOString(),
    node:process.version,
    platform:process.platform,
    arch:process.arch,
    providers,
    error:error.message,
  },{error:true});
  process.exitCode=1;
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
