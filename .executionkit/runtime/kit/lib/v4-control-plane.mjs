import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig } from './execution-model.mjs';
import { parseTodoShardManifest } from './todo-shards.mjs';

function git(root,args,allowFail=false){
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true});
  if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());
  return {status:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'').trim(),error:r.error?.message??null};
}
function githubSlug(remote){
  const value=String(remote??'').trim();
  let m=value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if(!m)m=value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if(!m)m=value.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return m?m[1]+'/'+m[2]:null;
}
function yamlFiles(root){
  const dir=path.join(root,'.github','workflows');
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true})
    .filter((e)=>e.isFile()&&/\.ya?ml$/i.test(e.name))
    .map((e)=>({name:e.name,path:path.join(dir,e.name),body:fs.readFileSync(path.join(dir,e.name),'utf8')}));
}
const AUTOMATIC_ENTRY_TRIGGERS=['push','pull_request','pull_request_target','schedule','workflow_run','merge_group'];
const FORBIDDEN_DISPATCH_INPUTS=['command','cmd','shell','script','args','argv'];
function cleanYamlKey(value){return String(value??'').trim().replace(/^['"]|['"]$/g,'');}
function workflowTriggers(body){
  const lines=String(body??'').split(/\r?\n/);
  let index=-1,inline='',onIndent=0;
  for(let i=0;i<lines.length;i++){
    const match=lines[i].match(/^(\s*)(?:['"]?on['"]?)\s*:\s*(.*?)\s*$/i);
    if(!match)continue;
    index=i;onIndent=match[1].length;inline=match[2].replace(/\s+#.*$/,'').trim();break;
  }
  if(index<0)return new Set();
  const triggers=new Set();
  const add=(value)=>{const key=cleanYamlKey(value).replace(/^[-\s]+/,'').split(/\s*:\s*/,1)[0].trim();if(key)triggers.add(key);};
  if(inline){
    if(inline.startsWith('[')&&inline.endsWith(']'))for(const item of inline.slice(1,-1).split(','))add(item);
    else if(inline.startsWith('{')&&inline.endsWith('}'))for(const item of inline.slice(1,-1).split(','))add(item);
    else add(inline);
    return triggers;
  }
  let childIndent=null;
  for(let i=index+1;i<lines.length;i++){
    const raw=lines[i].replace(/\s+#.*$/,''),trimmed=raw.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const indent=(raw.match(/^\s*/)?.[0].length)??0;
    if(indent<=onIndent)break;
    if(childIndent===null)childIndent=indent;
    if(indent!==childIndent)continue;
    const list=trimmed.match(/^[-]\s*([^\s:#,]+)\s*$/);
    const key=trimmed.match(/^(['"]?[A-Za-z0-9_-]+['"]?)\s*:/);
    if(list)add(list[1]);else if(key)add(key[1]);
  }
  return triggers;
}
function hasWorkflowDispatch(body){return workflowTriggers(body).has('workflow_dispatch');}
function workflowDispatchInputs(body){
  const lines=String(body??'').split(/\r?\n/);
  let onIndex=-1,onIndent=0;
  for(let i=0;i<lines.length;i++){
    const match=lines[i].replace(/\s+#.*$/,'').match(/^(\s*)(?:['"]?on['"]?)\s*:\s*$/i);
    if(match){onIndex=i;onIndent=match[1].length;break;}
  }
  if(onIndex<0)return [];

  let dispatchIndex=-1,dispatchIndent=0;
  for(let i=onIndex+1;i<lines.length;i++){
    const raw=lines[i].replace(/\s+#.*$/,''),trimmed=raw.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const indent=(raw.match(/^\s*/)?.[0].length)??0;
    if(indent<=onIndent)break;
    if(/^workflow_dispatch\s*:\s*$/i.test(trimmed)){dispatchIndex=i;dispatchIndent=indent;break;}
  }
  if(dispatchIndex<0)return [];

  let inputsIndex=-1,inputsIndent=0;
  for(let i=dispatchIndex+1;i<lines.length;i++){
    const raw=lines[i].replace(/\s+#.*$/,''),trimmed=raw.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const indent=(raw.match(/^\s*/)?.[0].length)??0;
    if(indent<=dispatchIndent)break;
    if(/^inputs\s*:\s*$/i.test(trimmed)){inputsIndex=i;inputsIndent=indent;break;}
  }
  if(inputsIndex<0)return [];

  const inputs=[];let inputIndent=null;
  for(let i=inputsIndex+1;i<lines.length;i++){
    const raw=lines[i].replace(/\s+#.*$/,''),trimmed=raw.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const indent=(raw.match(/^\s*/)?.[0].length)??0;
    if(indent<=inputsIndent)break;
    if(inputIndent===null)inputIndent=indent;
    if(indent!==inputIndent)continue;
    const key=trimmed.match(/^(['"]?[A-Za-z0-9_-]+['"]?)\s*:/);
    if(key)inputs.push(cleanYamlKey(key[1]));
  }
  return [...new Set(inputs)];
}
function workflowDispatchInputBlock(body,name){
  const lines=String(body??'').split(/\r?\n/);
  const pattern=new RegExp('^(\\s*)'+String(name).replace(/[.*+?^$()|[\]{}\\-]/g,'\\$&')+'\\s*:\\s*','i');
  for(let i=0;i<lines.length;i++){
    const match=lines[i].replace(/\s+#.*$/,'').match(pattern);if(!match)continue;
    const indent=match[1].length,parts=[];
    for(let j=i+1;j<lines.length;j++){
      const raw=lines[j].replace(/\s+#.*$/,''),trimmed=raw.trim();if(!trimmed||trimmed.startsWith('#'))continue;
      const nextIndent=(raw.match(/^\s*/)?.[0].length)??0;if(nextIndent<=indent)break;
      parts.push(trimmed);
    }
    return parts.join('\n');
  }
  return '';
}
function typedDispatchContract(body){
  const operation=workflowDispatchInputBlock(body,'operation');
  const runner=workflowDispatchInputBlock(body,'runner_os');
  const target=workflowDispatchInputBlock(body,'target_sha');
  const operationOptions=['doctor','systems','wave','phase','release'];
  const operationValid=/\brequired\s*:\s*true\b/i.test(operation)&&/\btype\s*:\s*choice\b/i.test(operation)
    && operationOptions.every((value)=>new RegExp('(?:^|[-\\s,\\[])'+value+'(?:$|[\\s,\\]])','im').test(operation));
  const runnerValid=/\brequired\s*:\s*true\b/i.test(runner)&&/\btype\s*:\s*choice\b/i.test(runner)
    && ['Linux','Windows','macOS'].every((value)=>new RegExp('(?:^|[-\\s,\\[])'+value+'(?:$|[\\s,\\]])','im').test(runner));
  const targetValid=/\brequired\s*:\s*true\b/i.test(target)&&/\btype\s*:\s*string\b/i.test(target)&&!/\bdefault\s*:/i.test(target);
  return {operationValid,runnerValid,targetValid};
}
function runsOnBlocks(body){
  const lines=String(body??'').split(/\r?\n/),blocks=[];
  for(let i=0;i<lines.length;i++){
    const cleanLine=lines[i].replace(/\s+#.*$/,'');
    const match=cleanLine.match(/^(\s*)runs-on\s*:\s*(.*)$/i);
    if(!match)continue;
    const indent=match[1].length,parts=[match[2].trim()];
    if(!match[2].trim()){
      for(let j=i+1;j<lines.length;j++){
        const nextLine=lines[j].replace(/\s+#.*$/,'');
        if(!nextLine.trim()||nextLine.trim().startsWith('#'))continue;
        const nextIndent=(nextLine.match(/^\s*/)?.[0].length)??0;
        if(nextIndent<=indent)break;
        parts.push(nextLine.trim());
      }
    }
    blocks.push(parts.filter(Boolean).join(' '));
  }
  return blocks;
}
function escapeRegex(value){
  return String(value??'').replace(/[.*+?^$()|[\]{}\\-]/g,'\\$&');
}
function runnerLabelPattern(label){
  const escaped=escapeRegex(label);
  return new RegExp('(?:^|[\\s,\\[\\]"\\\'])'+escaped+'(?:$|[\\s,\\[\\]"\\\'])','i');
}
function workflowPolicy(root,projectRunnerLabel){
  const files=yamlFiles(root),violations=[],manualDispatchWorkflows=[];
  const labelPattern=projectRunnerLabel?runnerLabelPattern(projectRunnerLabel):null;
  for(const file of files){
    const rel='.github/workflows/'+file.name;
    const triggers=workflowTriggers(file.body);
    const automatic=AUTOMATIC_ENTRY_TRIGGERS.filter((trigger)=>triggers.has(trigger));
    const dispatchInputs=workflowDispatchInputs(file.body);
    const forbiddenInputs=dispatchInputs.filter((name)=>FORBIDDEN_DISPATCH_INPUTS.includes(String(name).toLowerCase()));
    const hasDispatch=hasWorkflowDispatch(file.body);
    if(automatic.length){
      violations.push({code:'V4_CONTROL_PLANE_AUTOMATIC_WORKFLOW_TRIGGER',path:rel,triggers:automatic,message:'v4 project workflows must be manually dispatched; automatic triggers found: '+automatic.join(', ')});
    }
    if(forbiddenInputs.length){
      violations.push({code:'V4_CONTROL_PLANE_GENERIC_REMOTE_INPUT',path:rel,inputs:forbiddenInputs,message:'v4 workflow_dispatch may not expose generic remote command/script inputs: '+forbiddenInputs.join(', ')});
    }
    if(hasDispatch){
      const typed=typedDispatchContract(file.body);
      if(!dispatchInputs.includes('target_sha'))violations.push({code:'V4_CONTROL_PLANE_EXACT_HEAD_INPUT_MISSING',path:rel,message:'v4 workflow_dispatch requires target_sha so execution is pinned to an exact commit'});
      if(!typed.operationValid)violations.push({code:'V4_CONTROL_PLANE_OPERATION_INPUT_INVALID',path:rel,message:'v4 workflow_dispatch requires the complete typed operation choice: doctor, systems, wave, phase, release'});
      if(!typed.runnerValid)violations.push({code:'V4_CONTROL_PLANE_RUNNER_OS_INPUT_INVALID',path:rel,message:'v4 workflow_dispatch requires runner_os choice with Linux, Windows and macOS'});
      if(!typed.targetValid)violations.push({code:'V4_CONTROL_PLANE_TARGET_SHA_INPUT_INVALID',path:rel,message:'v4 workflow_dispatch requires target_sha as a required string with no default'});
      if(!/ref:\s*\$\{\{\s*inputs\.target_sha\s*\}\}/i.test(file.body))violations.push({code:'V4_CONTROL_PLANE_EXACT_HEAD_CHECKOUT_MISSING',path:rel,message:'v4 workflow_dispatch checkout must use inputs.target_sha as the checkout ref'});
      if(!/control-plane\s+verify-head\s+\.\s+--expected/i.test(file.body))violations.push({code:'V4_CONTROL_PLANE_EXACT_HEAD_VERIFY_MISSING',path:rel,message:'v4 workflow_dispatch must verify the checked-out HEAD before executing any operation'});
    }
    const runnerBlocks=runsOnBlocks(file.body);
    let runnersValid=runnerBlocks.length>0;
    if(!runnerBlocks.length)violations.push({code:'V4_CONTROL_PLANE_RUNNER_MISSING',path:rel,message:'Every v4 workflow must contain at least one explicit self-hosted job runner'});
    for(const value of runnerBlocks){
      if(/(?:ubuntu|windows|macos)-(?:latest|\d[\w.-]*)/i.test(value)){
        runnersValid=false;
        violations.push({code:'V4_CONTROL_PLANE_GITHUB_HOSTED_RUNNER',path:rel,message:'GitHub-hosted runner detected: '+value});
      }
      if(!/\bself-hosted\b/i.test(value)){
        runnersValid=false;
        violations.push({code:'V4_CONTROL_PLANE_NON_SELF_HOSTED_RUNNER',path:rel,message:'Every v4 workflow job must explicitly target self-hosted runners: '+value});
      }
      if(labelPattern&&!labelPattern.test(value)){
        runnersValid=false;
        violations.push({code:'V4_CONTROL_PLANE_PROJECT_RUNNER_LABEL_MISSING',path:rel,projectRunnerLabel,message:'Every v4 workflow job must target the exact project-specific runner label: '+projectRunnerLabel});
      }
    }
    if(hasDispatch&&automatic.length===0&&!forbiddenInputs.length&&runnersValid&&!violations.some((item)=>item.path===rel&&['V4_CONTROL_PLANE_EXACT_HEAD_INPUT_MISSING','V4_CONTROL_PLANE_OPERATION_INPUT_INVALID','V4_CONTROL_PLANE_RUNNER_OS_INPUT_INVALID','V4_CONTROL_PLANE_TARGET_SHA_INPUT_INVALID','V4_CONTROL_PLANE_EXACT_HEAD_CHECKOUT_MISSING','V4_CONTROL_PLANE_EXACT_HEAD_VERIFY_MISSING'].includes(item.code)))manualDispatchWorkflows.push(rel);
  }
  return {files:files.map((x)=>'.github/workflows/'+x.name),manualDispatchWorkflows,projectRunnerLabel,violations};
}
function normalizeOs(value){
  const v=String(value??'').trim().toLowerCase();
  if(v==='darwin'||v==='mac'||v==='macos')return 'macos';
  if(v==='win32'||v==='windows'||v==='win')return 'windows';
  if(v==='linux')return 'linux';
  return v;
}

export function verifyV4ExactHead(root,expected){
  root=path.resolve(root);
  const value=String(expected??'').trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(value))return {schemaVersion:'executionkit-v4-exact-head/v1',status:'FAIL',expected:value||null,actual:null,errors:[{code:'V4_CONTROL_PLANE_EXPECTED_HEAD_INVALID',message:'Expected Git HEAD must be an exact 40-character commit SHA'}]};
  const probe=git(root,['rev-parse','--is-inside-work-tree'],true);
  if(probe.status!==0)return {schemaVersion:'executionkit-v4-exact-head/v1',status:'FAIL',expected:value,actual:null,errors:[{code:'V4_CONTROL_PLANE_NOT_GIT',message:'Exact-HEAD verification requires a Git worktree'}]};
  const actual=String(git(root,['rev-parse','HEAD'],true).stdout??'').trim().toLowerCase();
  if(actual!==value)return {schemaVersion:'executionkit-v4-exact-head/v1',status:'FAIL',expected:value,actual:actual||null,errors:[{code:'V4_CONTROL_PLANE_HEAD_MISMATCH',message:'Checked out Git HEAD does not match the requested exact commit SHA'}]};
  return {schemaVersion:'executionkit-v4-exact-head/v1',status:'PASS',expected:value,actual,errors:[]};
}
function todoStatus(root,config){
  const todoPath=config.todoPath??'TODO.md',file=path.resolve(root,todoPath);
  if(!fs.existsSync(file))return {status:'MISSING',path:todoPath,shards:[],errors:[{code:'V4_CONTROL_PLANE_TODO_MISSING',message:'Canonical TODO manifest is missing'}]};
  const parsed=parseTodoShardManifest(fs.readFileSync(file,'utf8'),todoPath);
  const errors=[...(parsed.errors??[])];
  for(const entry of parsed.entries??[]){
    const full=path.resolve(root,entry.path),delta=path.relative(root,full);
    if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(full))errors.push({code:'V4_CONTROL_PLANE_TODO_SHARD_MISSING',path:entry.path,message:'Declared TODO shard is missing or unsafe: '+entry.path});
  }
  return {status:errors.length?'FAIL':parsed.status,path:todoPath,shards:(parsed.entries??[]).map((x)=>({phase:x.phase,path:x.path})),errors};
}

export function inspectV4ControlPlane(root){
  root=path.resolve(root);
  const {config}=loadConfig(root),contract=config.controlPlane??{},errors=[],warnings=[];
  if(contract.mode!=='github-native')errors.push({code:'V4_CONTROL_PLANE_MODE_INVALID',message:'v4 control plane mode must be github-native'});
  if(contract.executionAgent!=='disabled')errors.push({code:'V4_CONTROL_PLANE_AGENT_NOT_DISABLED',message:'ExecutionKit Agent must be disabled in v4 control-plane architecture'});
  if(contract.repositoryAuthority!=='github-origin'||contract.taskAuthority!=='todo-shards'||contract.statusAuthority!=='github-checks-workflows'||contract.fleetAuthority!=='github-self-hosted-runners'||contract.dispatchAuthority!=='github-workflow-dispatch'||contract.workflowDispatch!=='repository-defined-manual'){
    errors.push({code:'V4_CONTROL_PLANE_AUTHORITY_INVALID',message:'v4 control-plane authorities must be GitHub origin + sharded TODO + GitHub checks/workflows + self-hosted runners + repository-defined workflow_dispatch'});
  }
  if(contract.remoteCommand!=='disabled')errors.push({code:'V4_CONTROL_PLANE_REMOTE_COMMAND_INVALID',message:'Generic remote command execution through the control plane must remain disabled'});

  const gitProbe=git(root,['rev-parse','--is-inside-work-tree'],true);
  let repository={isGit:gitProbe.status===0,origin:null,slug:null,branch:null,head:null};
  if(repository.isGit){
    const origin=git(root,['remote','get-url','origin'],true).stdout||null;
    const slug=githubSlug(origin);
    repository={isGit:true,origin,slug,branch:git(root,['branch','--show-current'],true).stdout||null,head:git(root,['rev-parse','HEAD'],true).stdout||null};
    if(!slug)warnings.push({code:'V4_CONTROL_PLANE_GITHUB_ORIGIN_UNAVAILABLE',message:'Repository origin is not a recognizable GitHub repository; Elmasna3 cannot use GitHub as control-plane authority until origin is configured'});
  }else warnings.push({code:'V4_CONTROL_PLANE_NOT_GIT',message:'Project is not a Git worktree; GitHub-native factory visibility is unavailable'});

  const todo=todoStatus(root,config);errors.push(...todo.errors);
  const projectRunnerLabel=String(config.ci?.projectRunnerLabel??'').trim();
  const runnerLabelValid=/^project-[a-z0-9][a-z0-9._-]*$/i.test(projectRunnerLabel)&&!projectRunnerLabel.includes('[');
  if(!runnerLabelValid)errors.push({code:'V4_CONTROL_PLANE_PROJECT_RUNNER_LABEL_INVALID',projectRunnerLabel,message:'v4 GitHub-native control plane requires a concrete project-specific runner label (project-<ascii-slug>)'});
  const workflow=workflowPolicy(root,runnerLabelValid?projectRunnerLabel:null);errors.push(...workflow.violations);

  const configuredOs=(config.ci?.allowedRunnerOS??[]).map(normalizeOs);
  const requiredOs=['linux','windows','macos'];
  for(const os of requiredOs)if(!configuredOs.includes(os))errors.push({code:'V4_CONTROL_PLANE_RUNNER_OS_MISSING',os,message:'v4 self-hosted runner policy must allow '+os});
  if(config.ci?.githubHostedAllowed!==false||config.ci?.automaticPushRuns!==false||config.ci?.executionMode!=='self-hosted-manual'){
    errors.push({code:'V4_CONTROL_PLANE_CI_POLICY_INVALID',message:'v4 CI must be self-hosted manual only with GitHub-hosted minutes disabled'});
  }
  if(config.fleet?.agentMode||config.fleet?.telemetry?.transport==='local-agent'){
    errors.push({code:'V4_CONTROL_PLANE_LEGACY_AGENT_COUPLING',message:'Legacy per-device ExecutionKit Agent/fleet coupling remains configured in a v4 project'});
  }

  const localExecutionAllowed=contract.requiredForLocalExecution!==true;
  const githubVisible=Boolean(repository.slug);
  const dispatchReady=workflow.manualDispatchWorkflows.length>0;
  if(!dispatchReady)warnings.push({code:'V4_CONTROL_PLANE_DISPATCH_UNAVAILABLE',message:'No repository-defined workflow_dispatch surface is available; GitHub observation remains usable but Elmasna3 cannot request typed execution until one is added'});
  const status=errors.length?'FAIL':(githubVisible&&dispatchReady)?'PASS':'DEGRADED';
  return {
    schemaVersion:'executionkit-v4-control-plane/v1',
    status,
    mode:'github-native',
    localExecutionAllowed,
    executionAgent:'disabled',
    repository,
    todo,
    workflows:workflow,
    dispatch:{authority:'github-workflow-dispatch',mode:'repository-defined-manual',ready:dispatchReady,workflows:workflow.manualDispatchWorkflows},
    runners:{authority:'github-self-hosted-runners',projectRunnerLabel:runnerLabelValid?projectRunnerLabel:null,configuredOs:[...new Set(configuredOs)].sort(),requiredOs,maxProjectRunnersPerDevice:config.ci?.maxProjectRunnersPerDevice??null},
    factoryProjection:{
      repository:repository.slug,
      branch:repository.branch,
      head:repository.head,
      todoManifest:todo.path,
      todoShards:todo.shards,
      runtimeStatusSource:'github-checks-workflows',
      deviceStatusSource:'github-self-hosted-runners',
      projectRunnerLabel:runnerLabelValid?projectRunnerLabel:null,
      dispatchSource:'github-workflow-dispatch'
    },
    errors,
    warnings,
    observedAt:new Date().toISOString()
  };
}
