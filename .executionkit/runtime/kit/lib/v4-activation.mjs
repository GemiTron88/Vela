import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalState, loadConfig, loadTasks, stateSatisfiesDependency, unresolvedDependencies } from './execution-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { DEFAULT_STATE_CONFIG, writeStateCheckpoint } from './state-model.mjs';
import { captureV4WorktreeIdentity } from './v4-gate-identity.mjs';
import { todoMaintenanceStatus } from './todo-maintenance.mjs';

function git(root,args,allowFail=false){
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true});
  if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());
  return {status:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'').trim(),error:r.error?.message??null};
}
function atomicWrite(file,content){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.executionkit-'+process.pid+'-'+Date.now()+'.tmp';
  fs.writeFileSync(tmp,content,{flag:'wx'});
  fs.renameSync(tmp,file);
}
function activationGatePath(root,{create=true}={}){return resolveDerivedPath(root,'.executionkit/gates/activation.json','v4 activation gate',{createParents:create});}
function backupFile(file){return fs.existsSync(file)?{exists:true,data:fs.readFileSync(file),mode:fs.statSync(file).mode&0o777}:{exists:false,data:null,mode:0o644};}
function restoreFile(file,backup){
  if(backup.exists){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,backup.data,{mode:backup.mode});}
  else fs.rmSync(file,{force:true});
}
function activationDerivedFiles(root,config){
  const state=config.state??{},snapshotRel=state.snapshotPath??DEFAULT_STATE_CONFIG.snapshotPath,journalRel=state.journalPath??DEFAULT_STATE_CONFIG.journalPath;
  return {
    gate:activationGatePath(root,{create:false}),
    snapshot:resolveDerivedPath(root,snapshotRel,'v4 activation state snapshot'),
    journal:resolveDerivedPath(root,journalRel,'v4 activation state journal'),
  };
}

export function inspectV4Activation(root){
  root=path.resolve(root);
  const {config,policyIssues=[]}=loadConfig(root),reasons=[];
  if(policyIssues.length)reasons.push(...policyIssues.map((x)=>({code:x.code,message:x.message})));
  if(! /^[45]\./.test(String(config.standardVersion??'')))return {schemaVersion:'executionkit-v4-activation/v1',status:'MIGRATION_REQUIRED',ready:false,projectState:config.projectState??null,reasons:[{code:'V4_REQUIRED',message:'Activation requires a v4 project'}]};
  if(config.adoption?.bootstrapAuthority==='runtime-receipt'){
    const receiptFile=path.join(root,'.executionkit','installation.json');
    let receipt=null;
    try{receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));}catch{}
    if(receipt?.schemaVersion!=='executionkit-v4-install/v1')reasons.push({code:'V4_INSTALLATION_RECEIPT_REQUIRED',message:'Fast activation requires a valid project-local v4 installation receipt'});
    if(receipt?.runtimePolicy?.mode!=='IMMUTABLE')reasons.push({code:'V4_IMMUTABLE_RUNTIME_REQUIRED',message:'Fast activation requires immutable managed runtime authority'});
    if(config.projectState==='ACTIVE')return {schemaVersion:'executionkit-v4-activation/v1',status:reasons.length?'INVALID_ACTIVE':'ACTIVE',ready:!reasons.length,projectState:'ACTIVE',authority:'runtime-receipt',reasons};
    if(config.projectState!=='BOOTSTRAP')reasons.push({code:'V4_PROJECT_STATE_INVALID',message:'Expected BOOTSTRAP or ACTIVE, found '+String(config.projectState)});
    return {schemaVersion:'executionkit-v4-activation/v1',status:reasons.length?'BLOCKED':'READY_TO_ACTIVATE',ready:reasons.length===0,projectState:config.projectState??null,authority:'runtime-receipt',reasons};
  }
  if(config.adoption?.deepIntegrationRequired!==true)return {schemaVersion:'executionkit-v4-activation/v1',status:'NOT_APPLICABLE',ready:true,projectState:config.projectState??null,reasons:[]};
  const loaded=loadTasks(root,config);
  if(loaded.errors.length)reasons.push(...loaded.errors.map((x)=>({code:x.code,message:x.message})));
  const gateId=String(config.adoption?.integrationGateTaskId??'EK4-AUDIT').trim();
  const activationId=String(config.adoption?.integrationActivationTaskId??'EK4-ACTIVATE').trim();
  const gate=loaded.tasks.find((x)=>x.id===gateId)??null;
  const activationAny=loaded.tasks.find((x)=>x.id===activationId)??null;
  const activation=loaded.tasks.find((x)=>!x.isArchive&&x.id===activationId)??null;
  if(!gate)reasons.push({code:'V4_INTEGRATION_GATE_MISSING',message:'Integration gate task is missing: '+gateId});
  else if(!stateSatisfiesDependency(gate,config))reasons.push({code:'V4_INTEGRATION_GATE_NOT_ACCEPTED',message:gateId+' is '+(canonicalState(gate,config)??'UNKNOWN')});
  if(config.projectState==='ACTIVE'){
    if(!activationAny)reasons.push({code:'V4_ACTIVATION_TASK_MISSING',message:'Activation task is missing: '+activationId});
    else if(!stateSatisfiesDependency(activationAny,config))reasons.push({code:'V4_ACTIVATION_TASK_NOT_ACCEPTED',message:activationId+' is '+(canonicalState(activationAny,config)??'UNKNOWN')});
    return {schemaVersion:'executionkit-v4-activation/v1',status:reasons.length?'INVALID_ACTIVE':'ACTIVE',ready:!reasons.length,projectState:'ACTIVE',gateId,activationId,gateState:gate?canonicalState(gate,config):null,gateArchived:gate?.isArchive===true,activationState:activationAny?canonicalState(activationAny,config):null,activationArchived:activationAny?.isArchive===true,reasons};
  }
  const maintenance=todoMaintenanceStatus(root,config);
  if(maintenance.needed)reasons.push({code:'V4_TODO_MAINTENANCE_REQUIRED',message:'Canonical TODO shard maintenance must complete before v4 activation',maintenance});
  if(!activation)reasons.push({code:'V4_ACTIVATION_TASK_MISSING',message:'Active activation task is missing: '+activationId});
  else {
    const activationState=canonicalState(activation,config);
    const unresolved=unresolvedDependencies(activation,loaded.tasks,config);
    if(unresolved.length)reasons.push({code:'V4_ACTIVATION_DEPENDENCIES_OPEN',message:activationId+' has unresolved dependencies: '+unresolved.join(', '),taskIds:unresolved});
    if(['BLOCKED','CORRECTION_REQUIRED','CANCELLED','RELEASED','ACCEPTED'].includes(activationState??''))reasons.push({code:'V4_ACTIVATION_TASK_NOT_ACTIONABLE',message:activationId+' is '+(activationState??'UNKNOWN')+' and cannot be auto-accepted from BOOTSTRAP'});
  }
  if(config.projectState!=='BOOTSTRAP')reasons.push({code:'V4_PROJECT_STATE_INVALID',message:'Expected BOOTSTRAP or ACTIVE, found '+String(config.projectState)});
  return {schemaVersion:'executionkit-v4-activation/v1',status:reasons.length?'BLOCKED':'READY_TO_ACTIVATE',ready:reasons.length===0,projectState:config.projectState??null,gateId,activationId,gateState:gate?canonicalState(gate,config):null,gateArchived:gate?.isArchive===true,activationState:activation?canonicalState(activation,config):null,activationArchived:activationAny?.isArchive===true,reasons};
}

function activationTaskFile(root,task){
  const full=path.resolve(root,task.sourcePath),delta=path.relative(root,full);
  if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(full))throw new Error('Activation task source is unsafe or missing: '+task.sourcePath);
  return full;
}
function acceptActivationTask(markdown,taskId){
  const escaped=String(taskId).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  const match=String(markdown).match(re);if(!match)throw new Error('Activation task block not found: '+taskId);
  let block=match[1].replace(/^- Status:\s*.*$/m,'- Status: ACCEPTED');
  if(/^- Evidence:/m.test(block))block=block.replace(/^- Evidence:\s*.*$/m,'- Evidence: .executionkit/gates/activation.json');
  else block=block.replace(/^- Verification:.*$/m,(line)=>line+'\n- Evidence: .executionkit/gates/activation.json');
  return String(markdown).replace(match[1],()=>block);
}

export function applyV4Activation(root,{commit=true}={}){
  root=path.resolve(root);const inspection=inspectV4Activation(root);
  if(inspection.status==='ACTIVE')return {...inspection,changed:false};
  if(inspection.status!=='READY_TO_ACTIVATE')return {...inspection,changed:false};

  const configFile=path.join(root,'execution.config.json');if(!fs.existsSync(configFile))throw new Error('execution.config.json is required for v4 activation');
  const before=fs.readFileSync(configFile,'utf8'),config=JSON.parse(before),gitProbe=git(root,['rev-parse','--is-inside-work-tree'],true),isGit=gitProbe.status===0;
  if(config.adoption?.bootstrapAuthority==='runtime-receipt'){
    let parentHead=null;
    if(isGit&&commit){
      const status=git(root,['status','--porcelain=v1','--untracked-files=all']).stdout;
      if(status)throw new Error('v4 activation requires a clean worktree when commit mode is enabled');
      parentHead=git(root,['rev-parse','HEAD']).stdout;
    }
    const derived=activationDerivedFiles(root,config),backups={gate:backupFile(derived.gate),snapshot:backupFile(derived.snapshot),journal:backupFile(derived.journal)};
    const activatedAt=new Date().toISOString();
    config.projectState='ACTIVE';
    config.adoption={...(config.adoption??{}),activatedAt,activationEvidencePath:'.executionkit/gates/activation.json'};
    atomicWrite(configFile,JSON.stringify(config,null,2)+'\n');
    let configCommit=null,commitCreated=false;
    try{
      if(isGit&&commit){
        git(root,['add','--','execution.config.json']);
        git(root,['-c','user.name=ExecutionKit','-c','user.email=executionkit@local.invalid','commit','-m','executionkit: activate fast v4 bootstrap','--','execution.config.json']);
        configCommit=git(root,['rev-parse','HEAD']).stdout;commitCreated=true;
      }
      let identity={head:null,worktreeFingerprint:null};try{identity=captureV4WorktreeIdentity(root);}catch{}
      let receipt=null;try{receipt=JSON.parse(fs.readFileSync(path.join(root,'.executionkit','installation.json'),'utf8'));}catch{}
      const evidence={schemaVersion:'executionkit-v4-activation/v1',status:'ACTIVE',authority:'runtime-receipt',activatedAt,configCommit,sourceCommit:receipt?.sourceCommit??null,runtimePolicy:receipt?.runtimePolicy?.mode??null,...identity};
      fs.mkdirSync(path.dirname(derived.gate),{recursive:true});atomicWrite(derived.gate,JSON.stringify(evidence,null,2)+'\n');
      const checkpoint=writeStateCheckpoint(root,{reason:'v4-fast-activation',note:'ExecutionKit v4 runtime receipt accepted; product execution is ACTIVE without Kit tasks in product TODO',nextSafeAction:'executionkit next .',contextHealth:'HEALTHY',evidenceRefs:['.executionkit/gates/activation.json']});
      return {...inspection,status:'ACTIVE',projectState:'ACTIVE',authority:'runtime-receipt',changed:true,activatedAt,configCommit,evidencePath:'.executionkit/gates/activation.json',checkpoint};
    }catch(error){
      if(commitCreated&&parentHead)git(root,['reset','--hard',parentHead],true);else{atomicWrite(configFile,before);if(isGit&&commit)git(root,['reset','--','execution.config.json'],true);}
      restoreFile(derived.gate,backups.gate);restoreFile(derived.snapshot,backups.snapshot);restoreFile(derived.journal,backups.journal);throw error;
    }
  }
  const loaded=loadTasks(root,config);if(loaded.errors.length)throw new Error(loaded.errors.map((x)=>'['+x.code+'] '+x.message).join('; '));
  const activationTask=loaded.tasks.find((x)=>!x.isArchive&&x.id===inspection.activationId);
  if(!activationTask)throw new Error('Activation task disappeared before transaction: '+inspection.activationId);
  const activationFile=activationTaskFile(root,activationTask),activationBefore=fs.readFileSync(activationFile,'utf8');
  let parentHead=null;
  if(isGit&&commit){
    const status=git(root,['status','--porcelain=v1','--untracked-files=all']).stdout;
    if(status)throw new Error('v4 activation requires a clean worktree before the BOOTSTRAP → ACTIVE transition');
    parentHead=git(root,['rev-parse','HEAD']).stdout;
  }

  const derived=activationDerivedFiles(root,config),backups={
    gate:backupFile(derived.gate),
    snapshot:backupFile(derived.snapshot),
    journal:backupFile(derived.journal),
  };
  const activatedAt=new Date().toISOString();
  config.projectState='ACTIVE';
  config.adoption={...(config.adoption??{}),activatedAt,activationEvidencePath:'.executionkit/gates/activation.json'};
  atomicWrite(activationFile,acceptActivationTask(activationBefore,inspection.activationId));
  atomicWrite(configFile,JSON.stringify(config,null,2)+'\n');

  let configCommit=null,commitCreated=false;
  try{
    if(isGit&&commit){
      git(root,['add','--','execution.config.json',activationTask.sourcePath]);
      git(root,['-c','user.name=ExecutionKit','-c','user.email=executionkit@local.invalid','commit','-m','executionkit: activate v4 product execution','--','execution.config.json',activationTask.sourcePath]);
      configCommit=git(root,['rev-parse','HEAD']).stdout;commitCreated=true;
    }

    let identity={head:null,worktreeFingerprint:null};try{identity=captureV4WorktreeIdentity(root);}catch{}
    const evidence={
      schemaVersion:'executionkit-v4-activation/v1',status:'ACTIVE',activatedAt,
      gateTaskId:inspection.gateId,activationTaskId:inspection.activationId,
      gateState:inspection.gateState,activationState:'ACCEPTED',
      configCommit,...identity
    };
    fs.mkdirSync(path.dirname(derived.gate),{recursive:true});
    atomicWrite(derived.gate,JSON.stringify(evidence,null,2)+'\n');

    const checkpoint=writeStateCheckpoint(root,{
      reason:'v4-activation',
      note:'ExecutionKit v4 deep integration accepted; product execution is ACTIVE',
      nextSafeAction:'executionkit next .',
      contextHealth:'HEALTHY',
      evidenceRefs:['.executionkit/gates/activation.json']
    });

    return {...inspection,status:'ACTIVE',projectState:'ACTIVE',changed:true,activatedAt,configCommit,evidencePath:'.executionkit/gates/activation.json',checkpoint};
  }catch(error){
    if(commitCreated&&parentHead){
      const reset=git(root,['reset','--hard',parentHead],true);
      if(reset.status!==0)throw new Error(error.message+'; activation rollback failed to restore Git HEAD: '+String(reset.stderr||reset.error||'unknown'));
    }else{
      atomicWrite(configFile,before);
      atomicWrite(activationFile,activationBefore);
      if(isGit&&commit)git(root,['reset','--','execution.config.json',activationTask.sourcePath],true);
    }
    restoreFile(derived.gate,backups.gate);
    restoreFile(derived.snapshot,backups.snapshot);
    restoreFile(derived.journal,backups.journal);
    throw error;
  }
}

export function reconcileV4Activation(root,{applyIfReady=false,commit=true}={}){
  const status=inspectV4Activation(root);
  if(applyIfReady&&status.status==='READY_TO_ACTIVATE')return applyV4Activation(root,{commit});
  return status;
}
