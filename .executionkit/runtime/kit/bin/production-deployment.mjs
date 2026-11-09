#!/usr/bin/env node
import path from 'node:path';
import { buildProductionArtifact, deployProductionArtifact, planProductionArtifact, productionDeploymentHostCheck, productionDeploymentHostPlan, productionDeploymentStatus, rollbackProductionDeployment, validateProductionArtifact, validateProductionDeploymentReadiness } from '../lib/production-deployment.mjs';
import { loadConfig } from '../lib/execution-model.mjs';
import { prepareProductionBackup } from '../lib/production-backup.mjs';
import { captureRepositorySnapshot } from '../lib/repository-source.mjs';
import { inspectProductionStorage } from '../lib/production-storage-report.mjs';

const args=process.argv.slice(2);
const action=args[0]&&!args[0].startsWith('--')?args.shift():'status';
const root=path.resolve(args[0]&&!args[0].startsWith('--')?args.shift():'.');
const value=(name)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);return i>=0?args[i+1]??null:null;};
try{
  let result;
  if(action==='status')result=productionDeploymentStatus(root);
  else if(action==='storage')result=inspectProductionStorage(root);
  else if(action==='plan-artifact')result=planProductionArtifact(root,{runBuild:false});
  else if(action==='build-artifact')result=buildProductionArtifact(root,{runBuild:args.includes('--run-build')});
  else if(action==='validate-artifact')result=validateProductionArtifact(root,{releaseId:value('release')});
  else if(action==='readiness')result=validateProductionDeploymentReadiness(root);
  else if(action==='host-plan')result=productionDeploymentHostPlan(root);
  else if(action==='host-check')result=productionDeploymentHostCheck(root);
  else if(action==='backup'){
    const {config}=loadConfig(root),snapshot=captureRepositorySnapshot(root);
    if(!snapshot.head||snapshot.dirtyPaths.some(p=>!p.startsWith('.executionkit/')))throw new Error('Backup must bind to a clean exact source HEAD');
    result=await prepareProductionBackup(root,config.deployment,snapshot.head,{authorized:args.includes('--authorize')});
  }
  else if(action==='deploy'){
    const {config}=loadConfig(root);
    if(/^[45]\./.test(String(config.standardVersion??'')))throw new Error('Direct v4/v5 artifact deployment is disabled; use executionkit launch deploy . --authorize so Test/Reconcile/Audit/Launch exact-candidate gates cannot be bypassed.');
    result=await deployProductionArtifact(root,{releaseId:value('release'),authorized:args.includes('--authorize')});
  }
  else if(action==='rollback')result=await rollbackProductionDeployment(root,{authorized:args.includes('--authorize')});
  else if(action==='help')result={usage:'node bin/production-deployment.mjs status|plan-artifact|build-artifact|validate-artifact|readiness|host-plan|host-check|storage|backup|deploy|rollback [project] [--release ID] [--run-build] [--authorize]',safety:'host provisioning is one-time/outside deploy; deploy/rollback require explicit --authorize and an unprivileged-ready target'};
  else throw new Error(`Unknown Production Deployment action: ${action}`);
  console.log(JSON.stringify(result,null,2));
  if((action==='validate-artifact'||action==='readiness'||action==='host-check')&&result.ok===false)process.exitCode=1;
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exitCode=1;}

