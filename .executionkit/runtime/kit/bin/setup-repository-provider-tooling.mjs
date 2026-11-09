#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  applyRepositoryProviderTooling,
  doctorRepositoryProviderTooling,
  EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS,
  MANAGED_REPOSITORY_PROVIDER_TOOLS,
  planRepositoryProviderTooling,
} from '../lib/repository-provider-deployment.mjs';

const args=process.argv.slice(2);
const action=args[0]&&!args[0].startsWith('--')?args.shift():'plan';
const rootArg=args[0]&&!args[0].startsWith('--')?args.shift():'.';
const root=path.resolve(rootArg);
const configFile=path.join(root,'execution.config.json');
if(fs.existsSync(configFile)){
  try{
    const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
    const isV4 = /^[45]\./.test(String(config.standardVersion ?? '')) && (config?.v4 || config?.adoption?.integrationGateTaskId?.includes('EK4') || config?.adoption?.integrationPhase === 'EK4');
    if (isV4) {
      console.error(JSON.stringify({status:'REMOVED',mode:'NATIVE_ONLY',message:'External repository provider tooling is forbidden in ExecutionKit v4/v5.'}));
      process.exit(2);
    }
  }catch(error){
    console.error(JSON.stringify({status:'BLOCKED',error:'Cannot validate v4 provider-tooling policy: '+error.message}));
    process.exit(1);
  }
}
const value=(name)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);if(i<0)return null;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(`Missing value for --${name}`);return v;};
const providers=value('providers')?.split(',').map((x)=>x.trim()).filter(Boolean)??null;

const force=args.includes('--force');

try{
  let result;
  if(action==='plan') result=planRepositoryProviderTooling(root,{providers,force});
  else if(action==='apply'){
    const plan=planRepositoryProviderTooling(root,{providers,force});
    result=applyRepositoryProviderTooling(root,{providers,expectedPlan:plan.planId,force});
  }
  else if(action==='doctor') result=doctorRepositoryProviderTooling(root);
  else if(action==='catalog') result={managed:MANAGED_REPOSITORY_PROVIDER_TOOLS,externalOnly:EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS};
  else if(action==='help') result={usage:'node bin/setup-repository-provider-tooling.mjs plan|apply|doctor|catalog [project] [--providers repomix,codegraph,rtk] [--force]',policy:'plan-first, explicit apply, isolated project-local install, exact package pins, no global hooks/install'};
  else throw new Error(`Unknown provider tooling action: ${action}`);
  console.log(JSON.stringify(result,null,2));
  if(action==='doctor'&&result.ok===false)process.exitCode=1;
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exitCode=1;}
