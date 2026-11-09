#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnBoundedSync} from '../lib/bounded-process.mjs';
import { buildCandidate, writeCandidate } from '../lib/evidence-model.mjs';
import { buildProductionArtifact, deployProductionArtifact, productionDeploymentStatus, validateProductionDeploymentReadiness } from '../lib/production-deployment.mjs';
import { resolveDerivedPath } from '../lib/derived-state.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
import { closureSummary, declaredAuditBoundary, declaredExecutionAction, extractTags, loadConfig, loadTasks } from '../lib/execution-model.mjs';
import { fileURLToPath } from 'node:url';
import {runBoundedReconciliation as reconcileV4Lifecycle} from '../lib/reconcile-runner.mjs';
import { validateV4ReleaseGates } from '../lib/v4-release-gates.mjs';
import { v4BoundaryStatus } from '../lib/v4-boundary.mjs';
import { emitBoundaryExecutionSignalSync } from '../lib/execution-signals.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const root=path.resolve(args.find((arg)=>!arg.startsWith('--'))??'.');
const authorized=args.includes('--authorize');
const dryRun=args.includes('--dry-run');

function run(script,extra=[]) {
  const result=spawnBoundedSync(process.execPath,[path.join(kitRoot,script),root,...extra],{cwd:root,encoding:'utf8',timeoutMs:3600000,forwardProgress:true,maxBuffer:64*1024*1024});
  return {ok:!result.error&&result.status===0,exitCode:result.status,stdout:result.stdout??'',stderr:result.stderr??'',error:result.error?.message??null};
}
function assertRun(label,result) {
  if(!result.ok) throw new Error(`${label} failed: ${(result.stderr||result.stdout||result.error||'unknown error').trim().slice(0,8000)}`);
}
function writeJson(rel,value) {
  const file=resolveDerivedPath(root,rel,rel,{createParents:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
  return path.relative(root,file).split(path.sep).join('/');
}

try {
  await emitSystemEvent(root,'launch.started',{operation:'release-project',authorized,dryRun},{source:'launch-os'});

  const {config,policyIssues=[]}=loadConfig(root);
  if(policyIssues.length) throw new Error(`Release policy is invalid: ${policyIssues.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  const distributionRepository=config.distributionRepository===true;
  const deploymentEnabled=config.deployment?.enabled!==false&&!distributionRepository;
  if(authorized&&!deploymentEnabled)throw new Error('Production deployment is disabled for this repository; release certification/publication is non-deploying.');
  if(config.projectState!=='ACTIVE') throw new Error(`Release orchestration requires projectState=ACTIVE; got ${config.projectState ?? 'MISSING'}`);
  const loaded=loadTasks(root,config);
  if(loaded.errors.length) throw new Error(`Canonical task authority is invalid: ${loaded.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  const implementationTasks = loaded.tasks.filter((t) => !(declaredExecutionAction(t) === 'audit' && declaredAuditBoundary(t) === 'release') && !extractTags(t).includes('launch') && !extractTags(t).includes('release'));
  const implementation = closureSummary(implementationTasks, config);
  if (implementation.closed !== true) throw new Error('Release orchestration requires canonical implementation convergence before candidate Audit/Test/Launch gates execute.');

  const v4=/^[45]\./.test(String(config.standardVersion??''));
  if(v4){
    const phaseGate=v4BoundaryStatus(root,{boundary:'phase'});
    if(!phaseGate.current||phaseGate.gate?.status!=='PASS')throw new Error('v4 release requires a CURRENT PASS full phase boundary gate (reconciliation + Audit OS + State) before candidate creation.');
  }

  const candidate=buildCandidate(root);
  if(dryRun){
    const payload={schemaVersion:'executionkit-launch-orchestrator/v1',status:'DRY_RUN_READY',dryRun:true,candidateId:candidate.candidateId,commit:candidate.commit,deploymentEnabled,distributionRepository,authorized};
    console.log(JSON.stringify(payload,null,2));
    process.exit(0);
  }
  writeCandidate(root,candidate);

  let releaseReconciliation=null;
  let built=null;
  if(v4){
    const test=run('bin/test-project.mjs',['--boundary=release']);
    assertRun('Test OS release gate',test);

    releaseReconciliation=reconcileV4Lifecycle(root,{boundary:'release',commitGeneratedDocs:false});
    if(releaseReconciliation.status!=='PASS')throw new Error('v4 release reconciliation did not PASS: '+JSON.stringify({status:releaseReconciliation.status,blockingSystems:releaseReconciliation.blockingSystems,reviewSystems:releaseReconciliation.reviewSystems}));

    if(deploymentEnabled){
      built=buildProductionArtifact(root,{runBuild:true});
      const deploymentReadiness=validateProductionDeploymentReadiness(root);
      if(!deploymentReadiness.ok) throw new Error(`Production Deployment readiness failed: ${deploymentReadiness.errors.map((e)=>e.code+(e.message?':'+e.message:'')).join(', ')}`);
    }

    const audit=run('bin/audit-project.mjs',['--boundary=release']);
    assertRun('Audit OS release gate',audit);

    const v4Gates=validateV4ReleaseGates(root,{candidate,checkDeployment:deploymentEnabled});
    if(!v4Gates.ok)throw new Error('v4 final release gates failed: '+v4Gates.errors.map((e)=>e.code+(e.system?':'+e.system:'')+(e.message?':'+e.message:'')).join(', '));
  }else{
    const audit=run('bin/audit-project.mjs',['--boundary=release']);
    assertRun('Audit OS release gate',audit);
    const test=run('bin/test-project.mjs',['--boundary=release']);
    assertRun('Test OS release gate',test);
    if(deploymentEnabled){
      built=buildProductionArtifact(root,{runBuild:true});
      const deploymentReadiness=validateProductionDeploymentReadiness(root);
      if(!deploymentReadiness.ok) throw new Error(`Production Deployment readiness failed: ${deploymentReadiness.errors.map((e)=>e.code+(e.message?':'+e.message:'')).join(', ')}`);
    }
  }

  const allowUnpushed = args.includes('--allow-unpushed') || config?.controlPlane?.requiredForLocalExecution === false;
  const releaseCheck=run('bin/release-readiness.mjs', allowUnpushed ? ['--allow-unpushed'] : []);
  assertRun('Release readiness',releaseCheck);

  const readinessPath=writeJson('.executionkit/release/release-readiness.json',{
    schemaVersion:'executionkit-release-readiness/v1',status:'PASS',candidateId:candidate.candidateId,commit:candidate.commit,
    releaseId:built?.manifest?.releaseId??null,artifactHead:built?.manifest?.repository?.head??candidate.commit,deploymentRequired:deploymentEnabled,distributionRepository,completedAt:new Date().toISOString(),
    auditGate:'.executionkit/gates/audit-release.json',testGate:'.executionkit/gates/test-release.json',reconcileGate:v4?'.executionkit/gates/reconcile-release.json':null
  });

  if(!authorized) {
    let signals={status:'DISABLED',ioPerformed:false};
    try{
      const headSha=/^[a-f0-9]{40}$/i.test(String(candidate.commit??''))?candidate.commit:'0'.repeat(40);
      signals=emitBoundaryExecutionSignalSync(root,{
        config,
        type:'execution.release.verified',
        phase:'release',
        boundary:'release',
        boundaryKey:'release-verified:'+headSha.slice(0,12),
        commitSha:headSha,
        evidenceRef:readinessPath,
        receipt:{status:'PASS',commitSha:headSha},
        lifecycleStatus:deploymentEnabled?'WAITING_REVIEW':'COMPLETED',
        projectCompleted:!deploymentEnabled,
        summary:'Release candidate verified ('+candidate.candidateId+')'
      });
    }catch{}
    const payload=deploymentEnabled
      ? {schemaVersion:'executionkit-launch-orchestrator/v1',status:'AWAITING_PRODUCTION_AUTHORIZATION',candidateId:candidate.candidateId,commit:candidate.commit,releaseId:built.manifest.releaseId,readinessPath,nextCommand:'executionkit launch deploy . --authorize',signals}
      : {schemaVersion:'executionkit-launch-orchestrator/v1',status:'RELEASE_READY_NON_DEPLOYABLE',candidateId:candidate.candidateId,commit:candidate.commit,releaseId:null,readinessPath,nextCommand:null,distributionRepository,signals};
    await emitSystemEvent(root,deploymentEnabled?'launch.awaiting_authorization':'launch.release_ready',payload,{source:'launch-os'});
    console.log(JSON.stringify(payload,null,2));
    process.exit(deploymentEnabled?2:0);
  }

  const deployed=await deployProductionArtifact(root,{releaseId:built.manifest.releaseId,authorized:true,prepareBackup:true});
  const status=productionDeploymentStatus(root);
  if(status.productionVerified!==true) throw new Error('Production deployment completed without productionVerified=true');

  const statePath=writeJson('.executionkit/release/state.json',{
    schemaVersion:'executionkit-release-state/v1',status:'RELEASED',candidateId:candidate.candidateId,commit:candidate.commit,
    releaseId:built.manifest.releaseId,deployedAt:deployed.deployedAt,verifiedAt:new Date().toISOString(),
    auditGate:'.executionkit/gates/audit-release.json',testGate:'.executionkit/gates/test-release.json',reconcileGate:v4?'.executionkit/gates/reconcile-release.json':null,releaseReadiness:readinessPath,
    production:{health:deployed.health,smoke:deployed.smoke,target:deployed.target}
  });
  let signals={status:'DISABLED',ioPerformed:false};
  try{
    const headSha=/^[a-f0-9]{40}$/i.test(String(candidate.commit??''))?candidate.commit:'0'.repeat(40);
    signals=emitBoundaryExecutionSignalSync(root,{
      config,
      type:'execution.deploy.completed',
      phase:'deploy',
      boundary:'deploy',
      boundaryKey:'deploy-completed:'+headSha.slice(0,12),
      commitSha:headSha,
      evidenceRef:statePath,
      receipt:{status:'ACTIVATED',commitSha:headSha},
      lifecycleStatus:'COMPLETED',
      projectCompleted:true,
      summary:'Production deployment completed ('+built.manifest.releaseId+')'
    });
  }catch{}
  const payload={schemaVersion:'executionkit-launch-orchestrator/v1',status:'RELEASED',candidateId:candidate.candidateId,commit:candidate.commit,releaseId:built.manifest.releaseId,statePath,productionVerified:true,signals};
  await emitSystemEvent(root,'launch.completed',payload,{source:'launch-os'});
  console.log(JSON.stringify(payload,null,2));
} catch(error) {
  await emitSystemEvent(root,'launch.failed',{operation:'release-project',message:error.message},{source:'launch-os'});
  console.error(`Launch OS failed: ${error.message}`);
  process.exit(1);
}

