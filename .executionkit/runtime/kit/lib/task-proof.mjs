import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalState, isPendingEvidence, loadConfig, loadTasks } from './execution-model.mjs';

const DEFAULT_PROOF_ROOT='docs/execution/evidence/tasks';
const normalize=(value)=>String(value).split(path.sep).join('/');
const safeId=(value)=>String(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'task';
const sha256=(full)=>crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');

function inside(root,full){
  const rel=path.relative(root,full);
  return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));
}
function git(root,args){
  return spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:15000,maxBuffer:16*1024*1024,windowsHide:true});
}
function gitRoot(root){
  const r=git(root,['rev-parse','--is-inside-work-tree']);
  return r.status===0&&String(r.stdout??'').trim()==='true';
}
function isTracked(root,rel,{prefix=false}={}){
  if(!gitRoot(root))return null;
  const normalized=normalize(rel).replace(/^\.\//,'');
  if(prefix){
    const r=git(root,['ls-files','--',normalized]);
    return r.status===0&&Boolean(String(r.stdout??'').trim());
  }
  const r=git(root,['ls-files','--error-unmatch','--',normalized]);
  return r.status===0;
}
function cleanToken(token){
  return String(token)
    .replace(/^[\[{"'<>]+/,'')
    .replace(/[\]}"'<>.:]+$/,'')
    .replace(/^`+|`+$/g,'')
    .trim();
}

export function extractTaskPathReferences(value){
  const text=String(value??'').replace(/\\/g,'/');
  const refs=new Set();
  for(const part of text.split(/[\s,;()]+/)){
    let token=cleanToken(part);
    if(!token||token.includes('://')||/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(token))continue;
    token=token.split('#')[0].replace(/:\d+(?::\d+)?$/,'').trim();
    if(!token||/^[A-Za-z][A-Za-z0-9+.-]*:/.test(token))continue;
    if(!token||/^(NONE|N\/A|NA|PENDING|TBD|TODO|-)$/.test(token.toUpperCase()))continue;
    const fileLike=/^(?:\.{1,2}\/)?[A-Za-z0-9_./-]+\.(?:json|md|mdx|txt|log|xml|html|csv|tap|sarif|junit|png|jpe?g|webp|pdf|mjs|cjs|js|ts|tsx|jsx|php|dart|py|go|rs|rb|sql|ya?ml|toml|sh|css|scss|svg)$/i.test(token);
    const rooted=/^(?:\.{1,2}\/|\.executionkit\/|docs\/|app\/|src\/|tests?\/|database\/|routes\/|config\/|resources\/|public\/|storage\/|artifacts?\/|reports?\/|build\/|dist\/|lib\/|bin\/|contracts\/|schemas\/|templates\/|packages?\/|apps?\/|mobile\/|web\/|server\/|client\/|backend\/|frontend\/|flutter\/|modules?\/|cmd\/|internal\/|pkg\/)/i.test(token);
    if(!fileLike&&rooted){
      const cleanRel=token.replace(/^\.\//,'').replace(/\/$/,'');
      const segments=cleanRel.split('/');
      if(segments.length===2&&!/[*?.\[\]]/.test(segments[1])&&/^(?:web\/mobile|mobile\/web|client\/server|server\/client|frontend\/backend|backend\/frontend|app\/user|build\/release|src\/dist)$/i.test(cleanRel))continue;
    }
    const pathLike=fileLike||rooted;
    if(!pathLike)continue;
    if(/^\/[A-Za-z]/.test(token)||/^[A-Za-z]:\//.test(token))continue;
    refs.add(normalize(token.replace(/^\.\//,'')));
  }
  return [...refs];
}

function wildcardPrefix(rel){
  const normalized=normalize(rel);
  const indexes=['*','?','['].map((ch)=>normalized.indexOf(ch)).filter((i)=>i>=0);
  if(!indexes.length)return normalized.replace(/\/$/,'');
  const first=Math.min(...indexes);
  return normalized.slice(0,first).replace(/\/+$/,'');
}
function localRefStatus(root,rel,{allowWildcard=false,requireTracked=false,requireFile=false}={}){
  const normalized=normalize(rel).replace(/^\.\//,'');
  const hasWildcard=/[*?\[]/.test(normalized);
  if(hasWildcard&&!allowWildcard)return {ok:false,code:'TASK_REFERENCE_WILDCARD_FORBIDDEN',rel:normalized,message:`Evidence reference must identify a concrete artifact, not a wildcard: ${normalized}`};
  const probeRel=hasWildcard?wildcardPrefix(normalized):normalized;
  if(!probeRel)return {ok:false,code:'TASK_REFERENCE_INVALID',rel:normalized,message:`Reference has no resolvable local prefix: ${normalized}`};
  const full=path.resolve(root,probeRel);
  if(!inside(root,full))return {ok:false,code:'TASK_REFERENCE_OUTSIDE_PROJECT',rel:normalized,message:`Reference points outside project: ${normalized}`};
  if(!fs.existsSync(full))return {ok:false,code:'TASK_REFERENCE_MISSING',rel:normalized,message:`Referenced path does not exist: ${normalized}`};
  if(requireFile&&!hasWildcard){
    const lst=fs.lstatSync(full);
    if(lst.isSymbolicLink())return {ok:false,code:'TASK_EVIDENCE_SYMLINK_FORBIDDEN',rel:normalized,message:`Evidence reference may not be a symbolic link: ${normalized}`};
    const real=fs.realpathSync(full);
    if(!inside(root,real))return {ok:false,code:'TASK_EVIDENCE_REALPATH_OUTSIDE_PROJECT',rel:normalized,message:`Evidence real path escapes project: ${normalized}`};
    if(!lst.isFile())return {ok:false,code:'TASK_EVIDENCE_NOT_FILE',rel:normalized,message:`Evidence reference must resolve to a file: ${normalized}`};
  }
  if(requireTracked){
    const tracked=isTracked(root,probeRel,{prefix:hasWildcard||fs.statSync(full).isDirectory()});
    if(tracked===false)return {ok:false,code:'TASK_REFERENCE_UNTRACKED',rel:normalized,message:`Referenced proof/code is not tracked by Git: ${normalized}`};
  }
  return {ok:true,rel:normalized,full,tracked:isTracked(root,probeRel,{prefix:hasWildcard||fs.statSync(full).isDirectory()})};
}

function legacyAcceptance(task){
  return task?.isArchive===true
    && String(task?.meta?.['Legacy Acceptance']??'').trim().toLowerCase()==='true'
    && String(task?.meta?.Evidence??'').trim().toUpperCase()==='LEGACY_STATUS_ONLY';
}
function durablePolicy(config){
  if(config?.evidence?.requireDurableTaskEvidence===false)return false;
  return config?.evidence?.requireDurableTaskEvidence===true||/^[45]\./.test(String(config?.standardVersion??''));
}
function proofRoot(config){
  return normalize(String(config?.evidence?.taskProofRoot??DEFAULT_PROOF_ROOT).replace(/^\.\//,'').replace(/\/$/,''));
}

function validateDurableReceipt(root,task,receiptRel,config){
  const issues=[],expectedRoot=proofRoot(config),safeTask=safeId(task.id);
  const expectedReceipt=normalize(path.posix.join(expectedRoot,safeTask,'receipt.json'));
  if(receiptRel!==expectedReceipt){
    issues.push({code:'ACCEPTED_PROOF_RECEIPT_LOCATION_INVALID',taskId:task.id,path:receiptRel,message:`${task.id} durable receipt must be ${expectedReceipt}, got ${receiptRel}`});
    return issues;
  }
  const full=path.resolve(root,receiptRel);
  let receipt;
  try{receipt=JSON.parse(fs.readFileSync(full,'utf8'));}
  catch(error){
    issues.push({code:'ACCEPTED_PROOF_RECEIPT_INVALID',taskId:task.id,path:receiptRel,message:`${task.id} durable receipt is unreadable/invalid JSON: ${error.message}`});
    return issues;
  }
  if(receipt?.schemaVersion!=='executionkit-task-proof/v1'||receipt?.taskId!==task.id){
    issues.push({code:'ACCEPTED_PROOF_RECEIPT_SCHEMA_INVALID',taskId:task.id,path:receiptRel,message:`${task.id} durable receipt schema/task identity is invalid`});
  }
  const artifacts=Array.isArray(receipt?.artifacts)?receipt.artifacts:[];
  if(!artifacts.length){
    issues.push({code:'ACCEPTED_PROOF_ARTIFACTS_MISSING',taskId:task.id,path:receiptRel,message:`${task.id} durable receipt contains no proof artifacts`});
    return issues;
  }
  for(const artifact of artifacts){
    const rel=normalize(String(artifact?.durablePath??'')).replace(/^\.\//,'');
    const expectedPrefix=normalize(path.posix.join(expectedRoot,safeTask,'artifacts'))+'/';
    if(!rel.startsWith(expectedPrefix)){
      issues.push({code:'ACCEPTED_PROOF_ARTIFACT_PATH_INVALID',taskId:task.id,path:rel||null,message:`${task.id} proof artifact escapes its durable task-proof directory: ${rel||'MISSING'}`});
      continue;
    }
    const checked=localRefStatus(root,rel,{allowWildcard:false,requireTracked:true,requireFile:true});
    if(!checked.ok){
      const code=checked.code==='TASK_REFERENCE_MISSING'?'ACCEPTED_PROOF_ARTIFACT_MISSING'
        : checked.code==='TASK_REFERENCE_UNTRACKED'?'ACCEPTED_PROOF_ARTIFACT_UNTRACKED'
        : checked.code;
      issues.push({code,taskId:task.id,path:rel,message:`${task.id}: ${checked.message}`});
      continue;
    }
    const expectedHash=String(artifact?.sha256??'');
    if(!/^[a-f0-9]{64}$/.test(expectedHash)||sha256(checked.full)!==expectedHash){
      issues.push({code:'ACCEPTED_PROOF_ARTIFACT_HASH_MISMATCH',taskId:task.id,path:rel,message:`${task.id} durable proof artifact hash no longer matches its receipt: ${rel}`});
    }
    const expectedBytes=Number(artifact?.bytes);
    if(Number.isFinite(expectedBytes)&&expectedBytes>=0&&fs.statSync(checked.full).size!==expectedBytes){
      issues.push({code:'ACCEPTED_PROOF_ARTIFACT_SIZE_MISMATCH',taskId:task.id,path:rel,message:`${task.id} durable proof artifact size no longer matches its receipt: ${rel}`});
    }
  }
  return issues;
}

export function validateTaskProof(root,task,config,{validateCode=true}={}){
  root=path.resolve(root);
  const semantic=canonicalState(task,config);
  if(!['ACCEPTED','RELEASED'].includes(semantic)||legacyAcceptance(task))return [];
  const issues=[];
  const evidence=String(task?.meta?.Evidence??'').trim();
  if(isPendingEvidence(evidence))return issues;
  const strict=durablePolicy(config);
  if(!strict)return [];
  const evidenceRefs=extractTaskPathReferences(evidence);
  const activationId=String(config?.adoption?.integrationActivationTaskId??'EK4-ACTIVATE').trim();
  const isActivation=Boolean(task?.id&&(task.id===activationId||/^(?:[A-Za-z0-9._-]+-)?EK4-ACTIVATE$/.test(task.id)));
  if(isActivation){
    const expected=normalize(String(config?.adoption?.activationEvidencePath??'.executionkit/gates/activation.json')).replace(/^\.\//,'');
    if(evidenceRefs.includes(expected)){
      const full=path.resolve(root,expected);
      if(!fs.existsSync(full))issues.push({code:'ACCEPTED_EVIDENCE_REFERENCE_MISSING',taskId:task.id,path:expected,message:`${task.id}: activation evidence missing: ${expected}`});
      return issues;
    }
  }
  const expectedReceipt=normalize(path.posix.join(proofRoot(config),safeId(task.id),'receipt.json'));
  if(evidenceRefs.length&&!evidenceRefs.includes(expectedReceipt)){
    issues.push({code:'ACCEPTED_EVIDENCE_NOT_SEALED',taskId:task.id,path:null,message:`${task.id} local terminal evidence must be sealed to ${expectedReceipt} before ACCEPTED/RELEASED`});
  }
  for(const ref of evidenceRefs){
    if(strict&&(ref==='.executionkit'||ref.startsWith('.executionkit/'))){
      issues.push({code:'ACCEPTED_EVIDENCE_VOLATILE_PATH',taskId:task.id,path:ref,message:`${task.id} terminal evidence points at volatile .executionkit runtime state: ${ref}; seal it into durable tracked task proof before ACCEPTED/RELEASED`});
      continue;
    }
    const checked=localRefStatus(root,ref,{allowWildcard:false,requireTracked:strict,requireFile:false});
    if(!checked.ok){
      const code=checked.code==='TASK_REFERENCE_MISSING'?'ACCEPTED_EVIDENCE_REFERENCE_MISSING'
        : checked.code==='TASK_REFERENCE_UNTRACKED'?'ACCEPTED_EVIDENCE_UNTRACKED'
        : checked.code==='TASK_REFERENCE_OUTSIDE_PROJECT'?'ACCEPTED_EVIDENCE_OUTSIDE_PROJECT'
        : checked.code==='TASK_REFERENCE_WILDCARD_FORBIDDEN'?'ACCEPTED_EVIDENCE_WILDCARD'
        : checked.code;
      issues.push({code,taskId:task.id,path:ref,message:`${task.id}: ${checked.message}`});
    }
    else if(ref===expectedReceipt)issues.push(...validateDurableReceipt(root,task,ref,config));
  }

  if(validateCode){
    for(const ref of extractTaskPathReferences(task?.meta?.Code)){
      const checked=localRefStatus(root,ref,{allowWildcard:true,requireTracked:strict,requireFile:false});
      if(!checked.ok){
        const code=checked.code==='TASK_REFERENCE_MISSING'?'ACCEPTED_CODE_REFERENCE_MISSING'
          : checked.code==='TASK_REFERENCE_UNTRACKED'?'ACCEPTED_CODE_REFERENCE_UNTRACKED'
          : checked.code==='TASK_REFERENCE_OUTSIDE_PROJECT'?'ACCEPTED_CODE_REFERENCE_OUTSIDE_PROJECT'
          : checked.code;
        issues.push({code,taskId:task.id,path:ref,message:`${task.id}: stale Code reference: ${checked.message}`});
      }
    }
  }
  return issues;
}

function taskBlockRegex(taskId){
  const escaped=String(taskId).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
}
function rewriteEvidenceInTaskFile(root,task,evidenceRel){
  const full=path.resolve(root,task.sourcePath);
  if(!inside(root,full)||!fs.existsSync(full))throw new Error('Task source is missing/unsafe: '+task.sourcePath);
  const before=fs.readFileSync(full,'utf8'),re=taskBlockRegex(task.id),match=before.match(re);
  if(!match)throw new Error('Task block not found: '+task.id);
  let block=match[1];
  if(/^- Evidence:/m.test(block))block=block.replace(/^- Evidence:\s*.*$/m,()=>'- Evidence: '+evidenceRel);
  else if(/^- Verification:/m.test(block))block=block.replace(/^- Verification:.*$/m,(line)=>line+'\n- Evidence: '+evidenceRel);
  else throw new Error('Task has no Verification/Evidence insertion point: '+task.id);
  fs.writeFileSync(full,before.replace(match[1],()=>block));
  return {full,before};
}

export function sealTaskEvidence(root,{taskId,apply=false,sourceRefs=null,extra={}}={}){
  root=path.resolve(root);
  if(!taskId)throw new Error('sealTaskEvidence requires taskId');
  const {config}=loadConfig(root);
  const loaded=loadTasks(root,config);
  if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const task=loaded.tasks.find((item)=>item.id===taskId);
  if(!task)throw new Error('Unknown canonical task: '+taskId);
  const rootRel=proofRoot(config);
  const receiptRel=normalize(path.posix.join(rootRel,safeId(task.id),'receipt.json'));
  const currentEvidence=String(task.meta?.Evidence??'').trim();
  if(currentEvidence===receiptRel&&!sourceRefs){
    const receiptFull=path.resolve(root,receiptRel),proofDirRel=normalize(path.posix.dirname(receiptRel));
    if(fs.existsSync(receiptFull)&&validateDurableReceipt(root,task,receiptRel,config).length===0){
      return {schemaVersion:'executionkit-task-proof-seal/v1',status:'UP_TO_DATE',taskId:task.id,receiptPath:receiptRel,proofRoot:proofDirRel,issues:[]};
    }
    throw new Error('Durable proof receipt is referenced but missing or invalid for '+task.id+': '+receiptRel);
  }
  const refs=[...new Set((sourceRefs??extractTaskPathReferences(currentEvidence)).map((x)=>normalize(String(x))).filter(Boolean))];
  if(!refs.length)throw new Error('Task '+task.id+' has no local evidence artifact references to seal. Produce reproducible evidence first.');
  const sources=[];
  for(const rel of refs){
    if(/[*?\[]/.test(rel))throw new Error('Cannot seal wildcard evidence reference: '+rel);
    const checked=localRefStatus(root,rel,{allowWildcard:false,requireTracked:false,requireFile:true});
    if(!checked.ok)throw new Error('Cannot seal '+task.id+': '+checked.message);
    sources.push({rel:checked.rel,full:checked.full,bytes:fs.statSync(checked.full).size,sha256:sha256(checked.full)});
  }
  const proofDirRel=normalize(path.posix.join(rootRel,safeId(task.id)));
  const artifacts=sources.map((source,index)=>({
    sourcePath:source.rel,
    durablePath:normalize(path.posix.join(proofDirRel,'artifacts',String(index+1).padStart(2,'0')+'-'+path.basename(source.rel))),
    sha256:source.sha256,
    bytes:source.bytes
  }));
  const receipt={
    schemaVersion:'executionkit-task-proof/v1',
    taskId:task.id,
    stateAtSeal:canonicalState(task,config),
    phase:task.meta?.Phase??null,
    sealedAt:new Date().toISOString(),
    taskSource:task.sourcePath,
    verification:task.meta?.Verification??null,
    originalEvidence:currentEvidence||null,
    code:task.meta?.Code??null,
    artifacts,
    extra
  };
  if(!apply)return {schemaVersion:'executionkit-task-proof-seal/v1',status:'PLANNED',taskId:task.id,receiptPath:receiptRel,proofRoot:proofDirRel,artifacts,receipt};

  const proofDir=path.resolve(root,proofDirRel),parent=path.dirname(proofDir);
  if(!inside(root,proofDir))throw new Error('Task proof root escapes project: '+proofDirRel);
  const temp=proofDir+'.executionkit-'+crypto.randomUUID()+'.tmp';
  const backup=proofDir+'.executionkit-'+crypto.randomUUID()+'.bak';
  fs.mkdirSync(path.join(temp,'artifacts'),{recursive:true});
  for(let i=0;i<sources.length;i+=1)fs.copyFileSync(sources[i].full,path.join(temp,'artifacts',path.basename(artifacts[i].durablePath)));
  fs.writeFileSync(path.join(temp,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');

  let taskBackup=null,hadProof=false;
  try{
    fs.mkdirSync(parent,{recursive:true});
    if(fs.existsSync(proofDir)){fs.renameSync(proofDir,backup);hadProof=true;}
    fs.renameSync(temp,proofDir);
    taskBackup=rewriteEvidenceInTaskFile(root,task,receiptRel);
    if(hadProof)fs.rmSync(backup,{recursive:true,force:true});
  }catch(error){
    try{if(taskBackup)fs.writeFileSync(taskBackup.full,taskBackup.before);}catch{}
    try{if(fs.existsSync(proofDir))fs.rmSync(proofDir,{recursive:true,force:true});}catch{}
    try{if(hadProof&&fs.existsSync(backup))fs.renameSync(backup,proofDir);}catch{}
    try{if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:true});}catch{}
    throw error;
  }
  return {
    schemaVersion:'executionkit-task-proof-seal/v1',
    status:'SEALED',
    taskId:task.id,
    receiptPath:receiptRel,
    proofRoot:proofDirRel,
    artifacts,
    commitRequired:true,
    message:'Commit the rewritten canonical task source and durable proof directory together before ACCEPTED/RELEASED.'
  };
}

export function taskProofStatus(root,{taskId=null,includeArchive=true}={}){
  root=path.resolve(root);
  const {config}=loadConfig(root);
  const loaded=loadTasks(root,config);
  if(loaded.errors.length)return {schemaVersion:'executionkit-task-proof-status/v1',status:'FAIL',issues:loaded.errors};
  const tasks=loaded.tasks.filter((task)=>(includeArchive||!task.isArchive)&&(!taskId||task.id===taskId)&&['ACCEPTED','RELEASED'].includes(canonicalState(task,config)));
  if(taskId&&!tasks.length)return {schemaVersion:'executionkit-task-proof-status/v1',status:'NOT_FOUND',taskId,issues:[{code:'TASK_NOT_FOUND',message:'No ACCEPTED/RELEASED canonical task found for '+taskId}]};
  const rows=tasks.map((task)=>({taskId:task.id,archived:Boolean(task.isArchive),sourcePath:task.sourcePath,issues:validateTaskProof(root,task,config)}));
  const issues=rows.flatMap((row)=>row.issues);
  return {
    schemaVersion:'executionkit-task-proof-status/v1',
    status:issues.length?'FAIL':'PASS',
    inspected:rows.length,
    invalidTasks:rows.filter((row)=>row.issues.length).length,
    rows,
    issues
  };
}
