import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadTasks, canonicalState } from './execution-model.mjs';
import { validateAgentLayer } from './agent-model.mjs';
import { validateStateOS } from './state-model.mjs';
import { inspectV4ContentOS } from './v4-content-os.mjs';
import { inspectSeoImplementation } from './v4-seo-os.mjs';
import { validateDocumentationFabric } from './documentation-fabric.mjs';
import { evaluateV4AuditEvidence } from './v4-audit-evidence.mjs';
import { executeV4Tests } from './v4-test-os.mjs';
import { inspectVisualOS } from './visual-os.mjs';
import { refreshDatabaseIntegrity, guardDatabaseReferences } from './database-integrity.mjs';
import { taskProofStatus } from './task-proof.mjs';
import { validateIntegrationContract } from './integration-model.mjs';
import { repositoryKnowledgeStatus } from './repository-intelligence-api.mjs';
import { validateV4Policy } from './v4-config.mjs';
import { inspectV4Platform } from './v4-platform.mjs';
import { inspectV4ControlPlane } from './v4-control-plane.mjs';
import { validateAntigravityV4 } from './antigravity-v4.mjs';
import { inspectV4ProductClosure, taskV4SystemFindingGroups } from './v4-product-closure.mjs';
import { productionDeploymentStatus, validateProductionDeploymentReadiness } from './production-deployment.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { UPGRADE_REVALIDATION_STATUS_REL, upgradeRevalidationStatus } from './v4-upgrade-revalidation-status.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RECEIPT_REL='.executionkit/installation.json';
const GATE_REL='.executionkit/gates/upgrade-revalidation.json';
const PASS=new Set(['PASS','CURRENT','NOT_APPLICABLE','INSTALLED','NOT_REQUIRED','ADVISORY_PASS','SKIPPED_NOT_RELEASED']);

function readJson(file){if(!fs.existsSync(file))return null;try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function receiptPath(root){return path.join(path.resolve(root),...RECEIPT_REL.split('/'));}
function atomicJson(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o644});
  fs.renameSync(tmp,file);
}
function finding(code,message,extra={}){return {code,severity:'HIGH',message,...extra};}
function normalizeFindings(items=[]){return items.map((item)=>({...item,severity:String(item?.severity??'HIGH').toUpperCase()}));}
function result(id,system,status,{findings=[],details=null,durationMs=null}={}){
  return {id,system,status,ok:PASS.has(status),findings:normalizeFindings(findings),details,durationMs};
}
function runNode(root,script,args=[]){
  const started=performance.now();
  const r=spawnSync(process.execPath,[path.join(kitRoot,script),root,...args],{cwd:root,encoding:'utf8',timeout:30*60*1000,maxBuffer:32*1024*1024,windowsHide:true});
  return {status:r.status,error:r.error?.message??null,stdout:String(r.stdout??''),stderr:String(r.stderr??''),durationMs:Math.round((performance.now()-started)*100)/100};
}
function openUpgradeCorrectionTasks(root,config){
  const loaded=loadTasks(root,config);
  if(loaded.errors.length)return {errors:loaded.errors,tasks:[]};
  const terminal=new Set((config.terminalStates??[]).map((state)=>canonicalState(state,config)));
  return {
    errors:[],
    tasks:loaded.tasks.filter((task)=>!task.isArchive&&String(task.meta?.['Upgrade Revalidation']??'').trim().toLowerCase()==='true'&&!terminal.has(canonicalState(task,config))).map((task)=>({id:task.id,status:canonicalState(task,config),phase:task.meta?.Phase??null,path:task.sourcePath}))
  };
}

export function planUpgradeRevalidation(root){
  root=path.resolve(root);
  const status=upgradeRevalidationStatus(root),receipt=readJson(receiptPath(root));
  return {
    schemaVersion:'executionkit-v4-upgrade-revalidation-plan/v1',
    status:status.blocking?'PENDING':status.status,
    required:status.required,
    blocking:status.blocking,
    invariantIds:status.invariantIds,
    checks:status.requiredChecks,
    maxCost:status.maxCost,
    acceptedHistoryCount:status.acceptedHistoryCount,
    releaseHistory:status.releaseHistory,
    receipt:RECEIPT_REL,
    currentInvariantFingerprint:status.currentInvariantFingerprint,
    receiptVersion:receipt?.version??null,
  };
}

function runCheck(root,id,config,tasks){
  const started=performance.now();
  try{
    if(id==='execution-structure'){
      const r=runNode(root,'bin/validate-execution.mjs');
      return result(id,'execution',r.status===0?'PASS':'FAIL',{durationMs:r.durationMs,findings:r.status===0?[]:[finding('UPGRADE_EXECUTION_VALIDATION_FAILED',(r.stderr||r.stdout||r.error||'Execution validation failed').trim().slice(0,6000),{domain:'execution'})]});
    }
    if(id==='product-closure'){
      const x=inspectV4ProductClosure(root,{autoCreate:false,autoCommit:false});
      return result(id,'execution',x.status==='PASS'?'PASS':'FAIL',{details:{status:x.status,blockingGaps:x.blockingGaps?.length??0},findings:(x.blockingGaps??[]).map((item)=>({...item,severity:item.severity??'HIGH'}))});
    }
    if(id==='agent-layer'){
      const x=validateAgentLayer(root,config);
      return result(id,'agent',x.errors?.length?'FAIL':'PASS',{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'agent'}))});
    }
    if(id==='state-os'){
      const x=validateStateOS(root);
      return result(id,'state',x.status==='PASS'?'PASS':'FAIL',{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'state'}))});
    }
    if(id==='content-os'){
      const x=inspectV4ContentOS(root,{boundary:'phase',writeEvidence:true});
      return result(id,'content',x.status,{details:{counts:x.counts??null,evidencePath:x.evidencePath??null},findings:x.findings??[]});
    }
    if(id==='seo-os'){
      const x=inspectSeoImplementation(root,{boundary:'phase',writeEvidence:true});
      return result(id,'seo',x.status,{details:{checks:x.checks??null,evidencePath:x.evidencePath??null},findings:x.findings??[]});
    }
    if(id==='docs-os'){
      const x=validateDocumentationFabric(root);
      return result(id,'docs',x.ok?'PASS':'FAIL',{details:{coverage:x.registry?.coverage??null},findings:(x.errors??[]).map((item)=>finding(item.code,item.message??item.code,{path:item.path,documentId:item.documentId}))});
    }
    if(id==='audit-os'){
      const x=evaluateV4AuditEvidence(root,{boundary:'phase',checkUpgradeRevalidation:false});
      return result(id,'audit',x.status,{details:{checkCount:x.checks?.length??0},findings:x.findings??[]});
    }
    if(id==='test-os'){
      const x=executeV4Tests(root,{boundary:'phase',base:'HEAD'});
      const findings=(x.runs??[]).filter((run)=>run.status!=='PASS').map((run)=>finding('UPGRADE_TEST_FAILED','Upgrade revalidation test failed: '+run.id,{checkId:run.id,path:run.cwd??null}));
      if(x.status==='BLOCKED')findings.push(finding('UPGRADE_TEST_BLOCKED',x.reason??'Test OS could not construct executable phase verification'));
      return result(id,'test',x.status==='PASS'?'PASS':'FAIL',{details:{gatePath:x.gatePath??null,runCount:x.runs?.length??0},findings});
    }
    if(id==='launch-os'){
      const production=productionDeploymentStatus(root);
      const maturity=String(config.adoption?.maturityProfile??'');
      const applicable=maturity==='M4_PRODUCTION'||Boolean(production.state)||config.deployment?.requiredForRelease===true&&Boolean(production.artifact?.manifest);
      if(!applicable)return result(id,'launch','SKIPPED_NOT_RELEASED',{details:{maturity,productionVerified:production.productionVerified===true}});
      const x=validateProductionDeploymentReadiness(root);
      return result(id,'launch',x.ok?'PASS':'FAIL',{details:{artifact:x.artifact?.releaseId??null},findings:(x.errors??[]).map((item)=>finding(item.code,item.message??item.code,{domain:'launch'}))});
    }
    if(id==='visual-os'){
      const x=inspectVisualOS(root,{boundary:'phase',config});
      return result(id,'visual',x.status,{details:{stacks:x.discovery?.stacks??[],requiredTestEvidence:x.requiredTestEvidence??[]},findings:x.findings??[]});
    }
    if(id==='database-guard'){
      const refreshed=refreshDatabaseIntegrity(root,{write:true});
      if(refreshed.status==='NOT_APPLICABLE')return result(id,'database','NOT_APPLICABLE',{details:refreshed});
      if(refreshed.status!=='CURRENT')return result(id,'database','FAIL',{details:{databaseStatus:refreshed.status},findings:refreshed.findings??[finding('UPGRADE_DATABASE_TRUTH_INVALID','Database Integrity Fabric could not compile current schema truth')]});
      const x=guardDatabaseReferences(root,{files:null,mode:'all',autoRefresh:false});
      return result(id,'database',x.status,{details:{databaseFingerprint:x.databaseFingerprint??refreshed.fingerprint,performance:x.performance},findings:x.findings??[]});
    }
    if(id==='task-proof'){
      const x=taskProofStatus(root,{includeArchive:true});
      return result(id,'evidence',x.status,{details:{inspected:x.inspected??0,invalidTasks:x.invalidTasks??0},findings:(x.issues??[]).map((item)=>({...item,severity:'HIGH',subjectId:item.taskId??null}))});
    }
    if(id==='integration-contract'){
      const x=validateIntegrationContract(root,config,tasks,{release:false});
      return result(id,'integration',x.errors?.length?'FAIL':'PASS',{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'integration'}))});
    }
    if(id==='repository-intelligence'){
      const x=repositoryKnowledgeStatus(root),required=new Set(config.repositoryIntelligence?.providers?.required??[]);
      const unavailable=(x.providers?.providers??[]).filter((provider)=>required.has(provider.id)&&provider.status!=='READY');
      return result(id,'repository-intelligence',unavailable.length?'FAIL':'ADVISORY_PASS',{details:{authority:x.authority,stored:x.stored,providers:x.providers},findings:unavailable.map((provider)=>finding('UPGRADE_REQUIRED_KNOWLEDGE_PROVIDER_UNAVAILABLE','Required Repository Intelligence provider is not READY: '+provider.id,{provider:provider.id}))});
    }
    if(id==='v4-policy'||id==='kernel-routing'){
      const x=validateV4Policy(config);
      return result(id,'execution',x.errors?.length?'FAIL':'PASS',{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:item.system??'execution'}))});
    }
    if(id==='antigravity'){
      const x=validateAntigravityV4(root,config);
      return result(id,'host',(x.errors??[]).length?'FAIL':'PASS',{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'host'}))});
    }
    if(id==='platform'){
      const x=inspectV4Platform(root);
      return result(id,'platform',x.status,{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'platform'}))});
    }
    if(id==='control-plane'){
      const x=inspectV4ControlPlane(root);
      return result(id,'control-plane',x.status,{findings:(x.errors??[]).map((item)=>finding(item.code,item.message,{domain:'control-plane'}))});
    }
    if(id==='installer'){
      const receipt=readJson(receiptPath(root));
      const ok=receipt?.schemaVersion==='executionkit-v4-install/v1'&&receipt?.invariantManifest?.fingerprint;
      return result(id,'installer',ok?'PASS':'FAIL',{details:{receiptVersion:receipt?.version??null},findings:ok?[]:[finding('UPGRADE_INSTALL_RECEIPT_INVARIANT_MISSING','Installation receipt does not contain the current invariant manifest')]});
    }
    return result(id,'unknown','FAIL',{findings:[finding('UPGRADE_REVALIDATION_CHECK_UNKNOWN','Unknown upgrade revalidation check: '+id)]});
  }catch(error){
    return result(id,'unknown','FAIL',{durationMs:Math.round((performance.now()-started)*100)/100,findings:[finding('UPGRADE_REVALIDATION_CHECK_EXCEPTION',error.message,{checkId:id})]});
  }
}

function taskableGroups(checks){
  const groups={};
  for(const check of checks){
    if(check.ok)continue;
    const system=check.system==='database'?'database':check.system==='evidence'?'evidence':check.system==='integration'?'integration':check.system;
    if(!groups[system])groups[system]=[];
    const sourceFindings=check.findings?.length?check.findings:[finding('UPGRADE_REVALIDATION_FAILED',check.id+' failed',{domain:system})];
    groups[system].push(...sourceFindings.map((item)=>({...item,originalSeverity:item.severity??null,severity:['CRITICAL','HIGH'].includes(String(item.severity??'').toUpperCase())?String(item.severity).toUpperCase():'HIGH'})));
  }
  return groups;
}

export function runUpgradeRevalidation(root,{apply=true,autoTask=true}={}){
  root=path.resolve(root);
  const status=upgradeRevalidationStatus(root);
  if(!status.required||status.status==='NOT_REQUIRED')return {schemaVersion:'executionkit-v4-upgrade-revalidation-run/v1',status:'NOT_REQUIRED',ok:true,checks:[],tasking:null};
  if(status.status==='PASS')return {schemaVersion:'executionkit-v4-upgrade-revalidation-run/v1',status:'PASS',ok:true,checks:[],tasking:null,alreadyCertified:true,certifiedAt:status.certifiedAt};

  const {config}=loadConfig(root),loaded=loadTasks(root,config);
  if(loaded.errors.length)return {schemaVersion:'executionkit-v4-upgrade-revalidation-run/v1',status:'FAIL',ok:false,checks:[],findings:loaded.errors};
  const started=performance.now(),checks=[];
  for(const id of status.requiredChecks)checks.push(runCheck(root,id,config,loaded.tasks));
  const failures=checks.filter((item)=>!item.ok);
  let tasking=null;
  if(failures.length&&autoTask){
    const groups=taskableGroups(failures);
    tasking=taskV4SystemFindingGroups(root,{boundary:'upgrade',groups,currentTaskId:null,gatePath:GATE_REL,autoCommit:true});
  }
  const open=openUpgradeCorrectionTasks(root,config);
  const gateStatus=failures.length?'FAIL':open.errors.length?'FAIL':open.tasks.length?'CORRECTION_REQUIRED':'PASS';
  const gate={
    schemaVersion:'executionkit-v4-upgrade-revalidation-gate/v1',
    status:gateStatus,
    invariantFingerprint:status.currentInvariantFingerprint,
    invariantIds:status.invariantIds,
    requiredChecks:status.requiredChecks,
    checks,
    openCorrectionTasks:open.tasks,
    tasking,
    completedAt:new Date().toISOString(),
    performance:{durationMs:Math.round((performance.now()-started)*100)/100,hotPathImpact:'NONE_AFTER_CERTIFICATION'}
  };
  const gateFile=resolveDerivedPath(root,GATE_REL,'upgrade revalidation gate',{createParents:true});
  if(apply)atomicJson(gateFile,gate);

  if(gateStatus==='PASS'&&apply){
    const statusFile=path.join(root,...UPGRADE_REVALIDATION_STATUS_REL.split('/'));
    const current=readJson(statusFile)??{};
    atomicJson(statusFile,{
      ...current,
      schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
      status:'PASS',
      required:true,
      certifiedAt:new Date().toISOString(),
      certifiedInvariantFingerprint:status.currentInvariantFingerprint,
      currentInvariantFingerprint:status.currentInvariantFingerprint,
      gatePath:GATE_REL,
    });
  }

  return {
    schemaVersion:'executionkit-v4-upgrade-revalidation-run/v1',
    status:gateStatus,
    ok:gateStatus==='PASS',
    invariantFingerprint:status.currentInvariantFingerprint,
    checks,
    tasking,
    openCorrectionTasks:open.tasks,
    gatePath:GATE_REL,
    commitRequired:gateStatus==='PASS',
    performance:gate.performance,
    nextCommand:gateStatus==='PASS'?null:tasking?.createdOrReopened?'executionkit next .':'executionkit upgrade-revalidation run .'
  };
}
