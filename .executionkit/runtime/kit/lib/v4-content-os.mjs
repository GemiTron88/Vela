import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig } from './execution-model.mjs';
import { validateContentDepth } from './content-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { resolveNodeHost } from './bounded-process.mjs';

const CONTRACT_NAME='executionkit.content.json';
const ALLOWED_STATUSES=new Set(['PASS','REVIEW_REQUIRED','FAIL','NOT_APPLICABLE']);
const RANK={NOT_APPLICABLE:0,PASS:1,REVIEW_REQUIRED:2,FAIL:3};

function evidenceFile(root,boundary){return resolveDerivedPath(root,'.executionkit/evidence/raw/content-'+boundary+'.json','Content OS evidence',{createParents:true});}
function toPosix(rel){return rel.split(path.sep).join('/');}
function underRoot(root,rel){
  const full=path.resolve(root,rel),delta=path.relative(root,full);
  if(!rel||delta.startsWith('..')||path.isAbsolute(delta))throw new Error('Project Content OS validator path escapes repository root: '+rel);
  return full;
}
function loadProjectContract(root){
  const file=path.join(root,CONTRACT_NAME);
  if(!fs.existsSync(file))return {status:'ABSENT',path:CONTRACT_NAME,contract:null,errors:[]};
  let contract;
  try{contract=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){return {status:'INVALID',path:CONTRACT_NAME,contract:null,errors:[{code:'CONTENT_CONTRACT_INVALID_JSON',severity:'HIGH',path:CONTRACT_NAME,message:error.message}]};}
  const errors=[];
  if(contract?.schemaVersion!=='executionkit-content-contract/v1')errors.push({code:'CONTENT_CONTRACT_SCHEMA_INVALID',severity:'HIGH',path:CONTRACT_NAME,message:'Expected schemaVersion executionkit-content-contract/v1'});
  if(contract?.validators!==undefined&&!Array.isArray(contract.validators))errors.push({code:'CONTENT_CONTRACT_VALIDATORS_INVALID',severity:'HIGH',path:CONTRACT_NAME,message:'validators must be an array'});
  const ids=new Set();
  for(const [index,validator] of (Array.isArray(contract?.validators)?contract.validators:[]).entries()){
    if(!validator||typeof validator!=='object'){errors.push({code:'CONTENT_VALIDATOR_INVALID',severity:'HIGH',path:CONTRACT_NAME,message:'validator '+index+' must be an object'});continue;}
    if(typeof validator.id!=='string'||!validator.id.trim())errors.push({code:'CONTENT_VALIDATOR_ID_MISSING',severity:'HIGH',path:CONTRACT_NAME,message:'validator '+index+' has no stable id'});
    else if(ids.has(validator.id))errors.push({code:'CONTENT_VALIDATOR_ID_DUPLICATE',severity:'HIGH',path:CONTRACT_NAME,message:'duplicate validator id: '+validator.id});
    else ids.add(validator.id);
    if((validator.runner??'node')!=='node')errors.push({code:'CONTENT_VALIDATOR_RUNNER_UNSUPPORTED',severity:'HIGH',path:CONTRACT_NAME,message:'Only node project validators are supported in v4: '+(validator.id??index)});
    if(typeof validator.path!=='string'||!validator.path.trim())errors.push({code:'CONTENT_VALIDATOR_PATH_MISSING',severity:'HIGH',path:CONTRACT_NAME,message:'validator '+(validator.id??index)+' has no path'});
    if(validator.args!==undefined&&(!Array.isArray(validator.args)||validator.args.some((x)=>typeof x!=='string')))errors.push({code:'CONTENT_VALIDATOR_ARGS_INVALID',severity:'HIGH',path:CONTRACT_NAME,message:'validator '+(validator.id??index)+' args must be strings'});
    if(validator.boundaries!==undefined&&(!Array.isArray(validator.boundaries)||validator.boundaries.some((x)=>!['task','wave','phase','release'].includes(x))))errors.push({code:'CONTENT_VALIDATOR_BOUNDARIES_INVALID',severity:'HIGH',path:CONTRACT_NAME,message:'validator '+(validator.id??index)+' has invalid boundaries'});
  }
  return {status:errors.length?'INVALID':'VALID',path:CONTRACT_NAME,contract,errors};
}
function shouldRunValidator(validator,boundary,writeEvidence){
  if(Array.isArray(validator.boundaries))return validator.boundaries.includes(boundary);
  const boundaries=['wave','phase','release'];
  if(boundaries.includes(boundary))return true;
  return Boolean(writeEvidence&&validator.runOnValidate!==false);
}
function runProjectValidator(root,validator,boundary){
  const id=validator.id,required=validator.required!==false;
  let script;
  try{script=underRoot(root,validator.path);}catch(error){return {id,status:required?'FAIL':'REVIEW_REQUIRED',required,error:error.message,findings:[{code:'CONTENT_PROJECT_VALIDATOR_PATH_UNSAFE',severity:required?'HIGH':'REVIEW',validatorId:id,path:validator.path,message:error.message}]};}
  if(!fs.existsSync(script))return {id,status:required?'FAIL':'REVIEW_REQUIRED',required,findings:[{code:'CONTENT_PROJECT_VALIDATOR_MISSING',severity:required?'HIGH':'REVIEW',validatorId:id,path:validator.path,message:'Project Content OS validator is missing'}]};
  const timeoutMs=Number.isFinite(Number(validator.timeoutMs))?Math.max(1000,Math.min(600000,Number(validator.timeoutMs))):120000;
  const runner=validator.runner==='node'||validator.runner===undefined ? resolveNodeHost() : validator.runner;
  const result=spawnSync(runner,[script,...(validator.args??[])],{
    cwd:root,
    encoding:'utf8',
    shell:false,
    windowsHide:true,
    timeout:timeoutMs,
    maxBuffer:8*1024*1024,
    env:{...process.env,EXECUTIONKIT_CONTENT_BOUNDARY:boundary,EXECUTIONKIT_PROJECT_ROOT:root,EXECUTIONKIT_CONTENT_VALIDATOR_ID:id}
  });
  if(result.error)return {id,status:required?'FAIL':'REVIEW_REQUIRED',required,error:result.error.message,findings:[{code:'CONTENT_PROJECT_VALIDATOR_EXEC_FAILED',severity:required?'HIGH':'REVIEW',validatorId:id,path:validator.path,message:result.error.message}]};
  let parsed=null;
  try{parsed=JSON.parse(String(result.stdout??'').trim());}catch{}
  if(!parsed||typeof parsed!=='object'){
    const message=String(result.stderr||result.stdout||'Project Content OS validator returned no JSON').trim().slice(0,4000);
    return {id,status:required?'FAIL':'REVIEW_REQUIRED',required,exitCode:result.status,findings:[{code:'CONTENT_PROJECT_VALIDATOR_NON_JSON',severity:required?'HIGH':'REVIEW',validatorId:id,path:validator.path,message}]};
  }
  let status=typeof parsed.status==='string'?parsed.status:'FAIL';
  if(!ALLOWED_STATUSES.has(status))status='FAIL';
  if(result.status!==0&&status!=='FAIL')status='FAIL';
  const findings=Array.isArray(parsed.findings)?parsed.findings.map((finding)=>({...finding,validatorId:id,severity:finding?.severity??(status==='FAIL'?(required?'HIGH':'REVIEW'):'REVIEW')})):[];
  if(status==='FAIL'&&findings.length===0)findings.push({code:'CONTENT_PROJECT_VALIDATOR_FAILED',severity:required?'HIGH':'REVIEW',validatorId:id,path:validator.path,message:'Project Content OS validator failed without a finding'});
  return {id,status:status==='FAIL'&&!required?'REVIEW_REQUIRED':status,required,exitCode:result.status,script:toPosix(path.relative(root,script)),summary:parsed.summary??null,counts:parsed.counts??null,scope:parsed.scope??null,findings};
}
function combineStatus(baseStatus,contractStatus,validators){
  const statuses=[baseStatus];
  if(contractStatus==='INVALID')statuses.push('FAIL');
  for(const validator of validators){
    if(validator.executed===false)continue;
    statuses.push(validator.required===false&&validator.status==='FAIL'?'REVIEW_REQUIRED':validator.status);
  }
  if(statuses.every((x)=>x==='NOT_APPLICABLE'))return 'NOT_APPLICABLE';
  return statuses.reduce((best,current)=>(RANK[current]??3)>(RANK[best]??3)?current:best,'NOT_APPLICABLE');
}

export function inspectV4ContentOS(root,{boundary='task',writeEvidence=false}={}){
  root=path.resolve(root);
  const {config}=loadConfig(root);
  const capability=config.capabilities?.content??'NONE';
  if(capability==='NONE')return {schemaVersion:'executionkit-v4-content-os/v1',status:'NOT_APPLICABLE',boundary,capability,contract:{status:'DISABLED',path:CONTRACT_NAME},projectValidators:[],findings:[],counts:{total:0,placeholder:0,thin:0},evidencePath:null};

  const base=validateContentDepth(root);
  const contract=loadProjectContract(root);
  const projectValidators=[];
  if(contract.status==='VALID'){
    for(const validator of contract.contract.validators??[]){
      if(!shouldRunValidator(validator,boundary,writeEvidence)){projectValidators.push({id:validator.id,status:'DEFERRED',required:validator.required!==false,executed:false,boundaries:validator.boundaries??['wave','phase','release']});continue;}
      projectValidators.push({...runProjectValidator(root,validator,boundary),executed:true,boundaries:validator.boundaries??['wave','phase','release']});
    }
  }
  const findings=[...(base.findings??[]),...(contract.errors??[])];
  for(const validator of projectValidators)for(const finding of validator.findings??[])findings.push(finding);
  const status=combineStatus(base.status,contract.status,projectValidators);
  const result={
    schemaVersion:'executionkit-v4-content-os/v1',
    boundary,capability,status,
    counts:base.counts,items:base.items,localization:base.localization,
    contract:{status:contract.status,path:contract.path,profile:contract.contract?.profile??null,validatorCount:contract.contract?.validators?.length??0},
    projectValidators,
    findings,
    observedAt:new Date().toISOString(),
    evidencePath:null
  };
  if(writeEvidence){
    const file=evidenceFile(root,boundary);
    fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
    result.evidencePath=toPosix(path.relative(root,file));
  }
  return result;
}
