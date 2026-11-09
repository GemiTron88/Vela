import {inspectProviderReadiness,providerDigest} from './provider-readiness.mjs';
import {loadConfig} from './execution-model.mjs';
import {isV5} from './v5-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { loadCandidate, validateCandidate } from './evidence-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { reconciliationStatus } from './v4-reconcile.mjs';
import { doctorV4Installation } from './v4-installer.mjs';
import { validateProductionDeploymentReadiness,validateProductionArtifact } from './production-deployment.mjs';
import { v4BoundaryStatus } from './v4-boundary.mjs';
import { inspectAgenticGate } from './agentic-e2e.mjs';
import { inspectVisualOS } from './visual-os.mjs';

function gate(root,rel,label){
  const file=resolveDerivedPath(root,rel,label);
  if(!fs.existsSync(file))return {status:'MISSING',path:rel,gate:null};
  try{return {status:'LOADED',path:rel,gate:JSON.parse(fs.readFileSync(file,'utf8'))};}
  catch(error){return {status:'INVALID',path:rel,gate:null,error:error.message};}
}
function releaseGateErrors(item,{system,candidate}){
  const errors=[],g=item.gate;
  if(item.status!=='LOADED'){errors.push({code:'V4_RELEASE_GATE_'+item.status,path:item.path,message:item.error??'release gate is not available'});return errors;}
  if(g.schemaVersion!=='executionkit-release-gate/v1'||g.system!==system||g.boundary!=='release')errors.push({code:'V4_RELEASE_GATE_SCHEMA',path:item.path,message:'release gate contract mismatch for '+system});
  if(g.status!=='PASS')errors.push({code:'V4_RELEASE_GATE_NOT_PASS',path:item.path,message:system+' release gate is not PASS',status:g.status??null});
  if(g.candidateId!==candidate.candidateId||g.commit!==candidate.commit)errors.push({code:'V4_RELEASE_GATE_CANDIDATE_MISMATCH',path:item.path,message:system+' gate is not bound to exact current candidate'});
  return errors;
}

export function validateV4ReleaseGates(root,{candidate=null,checkDoctor=true,checkDeployment=true,providerArtifactSha256=null,providerBoundary='release'}={}){
  root=path.resolve(root);
  const errors=[];
  let selected=candidate,checked={errors:[]};
  if(!selected){
    try{selected=loadCandidate(root);}
    catch(error){errors.push({code:'V4_RELEASE_CANDIDATE_MISSING',message:error.message});selected={candidateId:null,commit:null};}
  }
  if(selected.candidateId||selected.commit){
    try{checked=validateCandidate(root,selected);}
    catch(error){errors.push({code:'V4_RELEASE_CANDIDATE_INVALID',message:error.message});}
  }
  let providerArtifact=providerArtifactSha256;
  if(!providerArtifact&&checkDeployment){try{const artifact=validateProductionArtifact(root);if(artifact.ok)providerArtifact=providerDigest(artifact.manifest.files);}catch{}}
  const providers=inspectProviderReadiness(root,{candidate:{...selected,artifactSha256:providerArtifact},boundary:providerBoundary});
  if(!providers.ok)errors.push({code:'EXTERNAL_PROVIDER_BLOCKED',message:'External provider readiness is not certified for this candidate',details:providers});
  const phaseBoundary=v4BoundaryStatus(root,{boundary:'phase'});
  if(!phaseBoundary.current||phaseBoundary.gate?.status!=='PASS')errors.push({code:'V4_RELEASE_PHASE_BOUNDARY_NOT_CURRENT_PASS',message:'Release requires the exact current full phase boundary to PASS before release gates are accepted',phaseBoundary:{status:phaseBoundary.status,current:phaseBoundary.current}});
  for(const item of checked.errors??[])errors.push({code:'V4_RELEASE_CANDIDATE_INVALID',message:'['+item.code+'] '+item.message});
  const test=gate(root,'.executionkit/gates/test-release.json','v4 Test OS release gate');
  const audit=gate(root,'.executionkit/gates/audit-release.json','v4 Audit OS release gate');
  errors.push(...releaseGateErrors(test,{system:'test-os',candidate:selected}));
  errors.push(...releaseGateErrors(audit,{system:'audit-os',candidate:selected}));
  const agentic=inspectAgenticGate(root,{boundary:'release'});
  const visual=inspectVisualOS(root,{boundary:'release'});
  if(!['PASS','NOT_APPLICABLE'].includes(visual.status))errors.push({code:'V4_RELEASE_VISUAL_NOT_CERTIFIED',message:'Release requires independently verified full rendered visual certification',details:visual.visualEvidence??visual.findings});
  if(!['PASS','NOT_APPLICABLE'].includes(agentic.status))errors.push({code:'V4_RELEASE_AGENTIC_NOT_PASS',message:'Release needs executable current Agentic Browsing 3/3 for every declared target',details:agentic.errors??[]});
  const reconcile=reconciliationStatus(root,{boundary:'release'});
  if(!reconcile.current)errors.push({code:'V4_RELEASE_RECONCILIATION_STALE',message:'release reconciliation gate is missing/stale for exact current worktree/candidate'});
  if(reconcile.gate?.status!=='PASS')errors.push({code:'V4_RELEASE_RECONCILIATION_NOT_PASS',message:'release reconciliation is not PASS',status:reconcile.gate?.status??null});
  if(reconcile.gate?.candidateId!==selected.candidateId||reconcile.gate?.commit!==selected.commit)errors.push({code:'V4_RELEASE_RECONCILIATION_CANDIDATE_MISMATCH',message:'release reconciliation is not candidate-bound'});
  const productClosure=reconcile.gate?.productClosure;
  if(!productClosure||productClosure.status!=='PASS'||(productClosure.blockingGaps?.length??0)>0)errors.push({code:'V4_RELEASE_PRODUCT_CLOSURE_NOT_PASS',message:'Release requires read-only whole-product closure PASS with zero blocking gaps',status:productClosure?.status??'MISSING'});
  if(productClosure?.repositoryHead&&productClosure.repositoryHead!==selected.commit)errors.push({code:'V4_RELEASE_PRODUCT_CLOSURE_CANDIDATE_MISMATCH',message:'Whole-product closure is not bound to the exact release commit'});
  const embedded=reconcile.gate?.systems??{};
  const cfg=loadConfig(root).config;
  if(isV5(cfg)&&embedded.decision?.status!=='PASS')errors.push({code:'V5_RELEASE_DECISION_NOT_PASS',message:'Exact candidate release reconciliation requires local Decision OS PASS'});
  for(const name of ['database','route','surface']){
    const status=reconcile.gate?.fabrics?.[name]?.status??'MISSING';
    if(!['PASS','NOT_APPLICABLE'].includes(status))errors.push({code:'V4_RELEASE_INTEGRITY_GUARD_NOT_PASS',fabric:name,status,message:'Release requires current '+name+' guard evidence'});
  }
  const docsDisabled=cfg.documentation?.enabled===false||cfg.v4?.systems?.docs?.enabled===false||cfg.capabilities?.docs==='NONE';
  for(const [name,allowed] of Object.entries({test:['PASS'],content:['PASS','NOT_APPLICABLE'],seo:['PASS','NOT_APPLICABLE'],docs:docsDisabled?['PASS','NOT_APPLICABLE','DISABLED']:['PASS'],visual:['PASS','NOT_APPLICABLE']})){
    const status=embedded[name]?.status??'MISSING';
    if(!allowed.includes(status))errors.push({code:'V4_RELEASE_SYSTEM_GATE_FAILED',system:name,status,message:'release reconciliation system evidence is not acceptable: '+name+'='+status});
  }
  let doctor={status:'SKIPPED'},deployment={status:'SKIPPED',ok:true};
  if(checkDoctor){doctor=doctorV4Installation(root);if(doctor.status!=='INSTALLED')errors.push({code:'V4_RELEASE_DOCTOR_BLOCKED',message:'v4 doctor is not INSTALLED',details:doctor.errors??[]});}
  if(checkDeployment){deployment=validateProductionDeploymentReadiness(root);if(!deployment.ok)errors.push({code:'V4_RELEASE_DEPLOYMENT_NOT_READY',message:'Production Deployment Fabric is not ready',details:deployment.errors??[]});}
  const auditCheck=(audit.gate?.checks??[]).find((x)=>x.id==='v4-ten-system-evidence');
  if(!auditCheck||auditCheck.status!=='PASS')errors.push({code:'V4_RELEASE_AUDIT_SYSTEM_MATRIX_MISSING',message:'Audit release gate does not contain PASS v4 ten-system evidence'});
  return {schemaVersion:'executionkit-v4-release-gates/v1',status:errors.length?'FAIL':'PASS',ok:errors.length===0,candidateId:selected.candidateId,commit:selected.commit,errors,phaseBoundary,gates:{test:test.gate,reconcile:reconcile.gate,audit:audit.gate,agentic,visual,providers},doctor,deployment};
}

