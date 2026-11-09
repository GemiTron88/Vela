import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { spawnPortableSync } from './portable-process.mjs';
import { resolveDerivedPath } from './derived-state.mjs';

export const MANAGED_REPOSITORY_PROVIDER_TOOLS=Object.freeze({
  repomix:Object.freeze({provider:'repomix',package:'repomix',version:'1.18.0',bin:'repomix',node:{min:22,maxExclusive:null}}),
  codegraph:Object.freeze({provider:'codegraph',package:'@colbymchenry/codegraph',version:'1.6.0',bin:'codegraph',node:{min:20,maxExclusive:25}}),
  rtk:Object.freeze({provider:'rtk',package:'@terrain-ai/rtk',version:'0.9.5',cliVersion:'0.47.0',bin:'rtk',node:{min:18,maxExclusive:null},targets:Object.freeze(['darwin-arm64','win32-x64'])}),
});
export const EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS=Object.freeze({
  terrain:Object.freeze({
    provider:'terrain',
    reason:'registry_source_version_drift',
    sourceObservedVersion:'0.9.5',
    registryObservedVersion:'0.1.0',
    policy:'operator_managed_until_version_contract_is_reconciled',
  }),
});

const hash=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
function lstatMaybe(full){
  try{return fs.lstatSync(full);}
  catch(error){if(error?.code==='ENOENT')return null;throw error;}
}

function nodeMajor(){return Number.parseInt(process.versions.node.split('.')[0]??'0',10);}
function validateNode(tool){
  const major=nodeMajor();
  if(major<tool.node.min)return `node_${major}_below_${tool.node.min}`;
  if(tool.node.maxExclusive&&major>=tool.node.maxExclusive)return `node_${major}_not_below_${tool.node.maxExclusive}`;
  return null;
}
function validateTarget(tool){
  if(!Array.isArray(tool.targets)||!tool.targets.length)return null;
  const target=`${process.platform}-${process.arch}`;
  return tool.targets.includes(target)?null:`${target}_unsupported`;
}
function safeRoot(root,{create=false,requireSafeExisting=false}={}){
  let target;
  try{
    target=resolveDerivedPath(root,'.executionkit/provider-tooling','Repository Intelligence provider tooling',{createParents:create});
  }catch(error){
    if(/symbolic link/i.test(error?.message??'')) throw new Error('Repository provider tooling root must be a real project-local directory');
    throw error;
  }
  if(requireSafeExisting){
    const stat=lstatMaybe(target);
    if(stat&&(stat.isSymbolicLink()||!stat.isDirectory())) throw new Error('Repository provider tooling root must be a real project-local directory');
  }
  return target;
}
function trustedToolingReceipt(toolingRoot,{allowMissing=true}={}){
  const stat=lstatMaybe(toolingRoot);
  if(!stat){
    if(allowMissing)return null;
    throw new Error('Repository provider tooling is not installed');
  }
  if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Repository provider tooling root is unsafe');
  const receiptFile=path.join(toolingRoot,'executionkit-provider-tooling.json'),lockFile=path.join(toolingRoot,'package-lock.json');
  const receiptStat=lstatMaybe(receiptFile),lockStat=lstatMaybe(lockFile);
  if(!receiptStat&&!lockStat&&allowMissing)return null;
  if(!receiptStat||receiptStat.isSymbolicLink()||!receiptStat.isFile()||receiptStat.size>1024*1024)throw new Error('Repository provider tooling receipt is missing or unsafe');
  if(!lockStat||lockStat.isSymbolicLink()||!lockStat.isFile()||lockStat.size>16*1024*1024)throw new Error('Repository provider tooling package-lock is missing or unsafe');
  let receipt;
  try{receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));}catch(error){throw new Error(`Repository provider tooling receipt is invalid: ${error.message}`);}
  if(receipt.schemaVersion!=='repository-provider-tooling-receipt/v1'||!Array.isArray(receipt.providers))throw new Error('Repository provider tooling receipt contract is invalid');
  if(receipt.globalInstall!==false||receipt.globalHooks!==false||receipt.installPolicy?.projectLocal!==true||receipt.installPolicy?.registry!=='https://registry.npmjs.org/'||receipt.installPolicy?.ignoreScripts!==true) throw new Error('Repository provider tooling receipt install policy is invalid');
  const providerIds=receipt.providers.map((item)=>item?.provider);
  if(providerIds.some((id)=>typeof id!=='string')||new Set(providerIds).size!==providerIds.length)throw new Error('Repository provider tooling receipt provider set is invalid');
  const lockHash=hash(fs.readFileSync(lockFile));
  if(receipt.packageLockSha256!==lockHash)throw new Error('Repository provider tooling package-lock integrity drift');
  return receipt;
}

function managedBinaryPath(toolingRoot,tool){
  const pkgDir=path.join(toolingRoot,'node_modules',...tool.package.split('/'));
  const pkgFile=path.join(pkgDir,'package.json');
  if(!fs.existsSync(pkgFile)||!fs.lstatSync(pkgFile).isFile())return null;
  let meta;
  try{meta=JSON.parse(fs.readFileSync(pkgFile,'utf8'));}catch{return null;}
  const binField=meta.bin;
  const rel=typeof binField==='string'?binField:(binField&&typeof binField==='object'?binField[tool.bin]:null);
  if(typeof rel!=='string'||!rel.trim())return null;
  const full=path.resolve(pkgDir,rel),allowed=pkgDir+path.sep;
  if(!(full.startsWith(allowed)))return null;
  if(!fs.existsSync(full))return null;
  const stat=fs.lstatSync(full);
  if(stat.isFile())return full;
  if(!stat.isSymbolicLink())return null;
  let real;
  try{real=fs.realpathSync(full);}catch{return null;}
  if(!(real.startsWith(allowed)))return null;
  try{return fs.statSync(real).isFile()?full:null;}catch{return null;}
}
function providerBinaryInvocation(binary,args=[]){
  if(/\.(?:c?js|mjs)$/i.test(binary)) return {command:process.execPath,args:[binary,...args]};
  return {command:binary,args};
}
export function resolveManagedRepositoryProviderBinary(root,provider){
  const tool=MANAGED_REPOSITORY_PROVIDER_TOOLS[provider]; if(!tool)return null;
  const toolingRoot=safeRoot(root,{requireSafeExisting:true}),rootStat=lstatMaybe(toolingRoot);
  if(!rootStat)return null;
  const receipt=trustedToolingReceipt(toolingRoot,{allowMissing:false});
  const item=receipt.providers.find((entry)=>entry.provider===provider);
  if(!item)return null;
  if(item.package!==tool.package||item.version!==tool.version)throw new Error(`Managed provider receipt identity drift: ${provider}`);
  if(!/^[a-f0-9]{64}$/.test(item.binarySha256??''))throw new Error(`Managed provider receipt binary hash missing: ${provider}`);
  const binary=managedBinaryPath(toolingRoot,tool);
  if(!binary)throw new Error(`Managed provider binary missing or unsafe: ${provider}`);
  const relativeBinary=path.relative(toolingRoot,binary).split(path.sep).join('/');
  if(item.binary!==relativeBinary)throw new Error(`Managed provider binary path drift: ${provider}`);
  if(hash(fs.readFileSync(binary))!==item.binarySha256)throw new Error(`Managed provider binary integrity drift: ${provider}`);
  return binary;
}
function configuredProviderPolicy(root){
  const file=path.join(path.resolve(root),'execution.config.json');
  if(!fs.existsSync(file)) return {required:[],optional:Object.keys(MANAGED_REPOSITORY_PROVIDER_TOOLS)};
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2*1024*1024) throw new Error('execution.config.json is unsafe for provider tooling policy');
  const config=JSON.parse(fs.readFileSync(file,'utf8'));
  return {
    required:Array.isArray(config.repositoryIntelligence?.providers?.required)?config.repositoryIntelligence.providers.required:[],
    optional:Array.isArray(config.repositoryIntelligence?.providers?.optional)?config.repositoryIntelligence.providers.optional:Object.keys(MANAGED_REPOSITORY_PROVIDER_TOOLS),
  };
}
function selectedProviders(root,providers){
  if(providers!==null&&providers!==undefined){
    if(!Array.isArray(providers)||providers.length===0)throw new Error('At least one provider tooling id is required');
    return {values:[...new Set(providers)].sort(),explicit:true,policy:configuredProviderPolicy(root)};
  }
  const policy=configuredProviderPolicy(root);
  const values=[...new Set([...policy.required,...policy.optional])].sort();
  if(!values.length)return {values:[],explicit:false,policy};
  return {values,explicit:false,policy};
}
export function planRepositoryProviderTooling(root,{providers=null,force=false}={}){
  const selection=selectedProviders(root,providers),selected=selection.values,actions=[];
  for(const id of selected){
    const required=selection.explicit||selection.policy.required.includes(id);
    if(EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS[id]){
      actions.push({provider:id,action:required?'BLOCKED':'EXTERNAL_ONLY',required,requiredMutation:false,...EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS[id],reason:required?`external_only_${EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS[id].reason}`:EXTERNAL_ONLY_REPOSITORY_PROVIDER_TOOLS[id].reason});
      continue;
    }
    const tool=MANAGED_REPOSITORY_PROVIDER_TOOLS[id];
    if(!tool){
      actions.push({provider:id,action:required?'BLOCKED':'SKIP_UNSUPPORTED',required,requiredMutation:false,reason:'no_managed_tool_definition'});
      continue;
    }
    const compatibilityReason=validateNode(tool)??validateTarget(tool);
    const binary=resolveManagedRepositoryProviderBinary(root,id);
    const isVerify=!force&&Boolean(binary);
    actions.push({
      provider:id,package:tool.package,version:tool.version,bin:tool.bin,required,
      action:compatibilityReason?(required?'BLOCKED':'SKIP_INCOMPATIBLE'):isVerify?'VERIFY':'INSTALL',
      requiredMutation:!compatibilityReason&&!isVerify,
      reason:compatibilityReason??(isVerify?'managed_binary_present':force?'forced_reinstall':'managed_binary_missing'),
      binary,
    });
  }
  const core={
    schemaVersion:'repository-provider-tooling-plan/v1',
    destination:path.relative(path.resolve(root),safeRoot(root)).split(path.sep).join('/'),
    node:process.version,platform:process.platform,arch:process.arch,providers:selected,requiredProviders:selection.policy.required,explicitSelection:selection.explicit,actions,
    networkMutationRequired:actions.some((x)=>x.action==='INSTALL'),
    explicitApplyRequired:true,globalHooks:false,globalInstall:false,
  };
  return {...core,plannedAt:now(),planId:hash(JSON.stringify(core))};
}
function probeBinary(binary,root){
  const invocation=providerBinaryInvocation(binary,['--version']);
  const r=spawnSync(invocation.command,invocation.args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:1024*1024,windowsHide:true,shell:false});
  const output=(r.stdout||r.stderr||'').trim(),version=output.match(/\d+\.\d+\.\d+/)?.[0]??null;
  return {ok:!r.error&&r.status===0,exitCode:r.status,error:r.error?.message??null,output:output.slice(0,500),version};
}
function validateStagedTooling(stage,root,selected,{probeRunner=probeBinary}={}){
  const results=[];
  for(const id of selected){
    const tool=MANAGED_REPOSITORY_PROVIDER_TOOLS[id]; if(!tool)continue;
    const pkg=path.join(stage,'node_modules',...tool.package.split('/'),'package.json');
    if(!fs.existsSync(pkg)||!fs.lstatSync(pkg).isFile())throw new Error(`Staged provider package missing: ${tool.package}`);
    const meta=JSON.parse(fs.readFileSync(pkg,'utf8'));
    if(meta.version!==tool.version)throw new Error(`Staged provider ${id} version mismatch: ${meta.version??'MISSING'} != ${tool.version}`);
    const binary=managedBinaryPath(stage,tool);
    if(!binary)throw new Error(`Staged provider binary missing or unsafe: ${tool.bin}`);
    const probe=probeRunner(binary,root,tool);
    const expectedVersion=tool.cliVersion??tool.version;
    if(!probe.ok||probe.version!==expectedVersion)throw new Error(`Staged provider ${id} version probe failed: ${probe.output||probe.error||probe.exitCode}`);
    results.push({provider:id,package:tool.package,version:tool.version,binary:path.relative(stage,binary).split(path.sep).join('/'),binarySha256:hash(fs.readFileSync(binary)),probe});
  }
  return results;
}
function defaultInstallRunner({stage,root,npmConfigPath}){
  const registry='https://registry.npmjs.org/';
  const env={
    ...process.env,
    NPM_CONFIG_USERCONFIG:npmConfigPath,
    NPM_CONFIG_REGISTRY:registry,
    NPM_CONFIG_IGNORE_SCRIPTS:'true',
    NPM_CONFIG_AUDIT:'false',
    NPM_CONFIG_FUND:'false',
  };
  return spawnPortableSync('npm',['install','--ignore-scripts','--no-audit','--no-fund','--save-exact','--registry',registry,'--userconfig',npmConfigPath],{
    cwd:stage,encoding:'utf8',timeout:10*60_000,maxBuffer:32*1024*1024,windowsHide:true,env,
  }).result;
}
export function applyRepositoryProviderTooling(root,{providers=null,expectedPlan=null,installRunner=defaultInstallRunner,probeRunner=probeBinary,force=false}={}){
  const plan=planRepositoryProviderTooling(root,{providers,force});
  if(expectedPlan){
    const expected=typeof expectedPlan==='string'?expectedPlan:expectedPlan.planId;
    if(!expected||expected!==plan.planId)throw new Error('Repository provider tooling plan changed before apply');
  }
  const selected=plan.actions.filter((x)=>MANAGED_REPOSITORY_PROVIDER_TOOLS[x.provider]&&['INSTALL','VERIFY'].includes(x.action)).map((x)=>x.provider);
  const installRequired=plan.actions.some((x)=>x.action==='INSTALL');
  const blocked=plan.actions.filter((x)=>x.action==='BLOCKED'||x.action==='UNSUPPORTED');
  if(blocked.length)throw new Error(`Provider tooling plan blocked: ${blocked.map((x)=>`${x.provider}:${x.reason}`).join(', ')}`);
  if(!selected.length)return {schemaVersion:'repository-provider-tooling-apply/v1',status:'NO_MANAGED_PROVIDERS',plan,installed:[],receipt:null};
  if(!installRequired){
    const doctor=doctorRepositoryProviderTooling(root);
    if(!doctor.ok)throw new Error(`Managed provider tooling verification failed: ${doctor.errors.join('; ')}`);
    const receiptProviders=new Set((doctor.receipt?.providers??[]).map((item)=>item.provider));
    const missing=selected.filter((id)=>!receiptProviders.has(id));
    if(missing.length)throw new Error(`Managed provider tooling receipt missing requested providers: ${missing.join(', ')}`);
    return {schemaVersion:'repository-provider-tooling-apply/v1',status:'VERIFIED',plan,installed:[],receipt:doctor.receipt,doctor,networkMutation:false};
  }

  const target=safeRoot(root,{create:true,requireSafeExisting:true}),parent=path.dirname(target),nonce=`${process.pid}-${Date.now()}`;
  const stage=path.join(parent,`provider-tooling.tmp-${nonce}`),backup=path.join(parent,`provider-tooling.backup-${nonce}`);
  let oldMoved=false,newInstalled=false;
  try{
    fs.rmSync(stage,{recursive:true,force:true});fs.rmSync(backup,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
    const dependencies=Object.fromEntries(selected.map((id)=>{const tool=MANAGED_REPOSITORY_PROVIDER_TOOLS[id];return [tool.package,tool.version];}));
    fs.writeFileSync(path.join(stage,'package.json'),`${JSON.stringify({name:'executionkit-repository-provider-tooling',private:true,version:'1.0.0',dependencies},null,2)}\n`,{mode:0o600});
    const npmConfigPath=path.join(stage,'.npmrc');
    fs.writeFileSync(npmConfigPath,'registry=https://registry.npmjs.org/\nignore-scripts=true\naudit=false\nfund=false\n',{mode:0o600});
    const install=installRunner({stage,root,dependencies,selected,npmConfigPath});
    if(!install||install.status!==0)throw new Error((install?.stderr||install?.stdout||install?.error?.message||`npm exit ${install?.status??'UNKNOWN'}`).trim());
    const verified=validateStagedTooling(stage,root,selected,{probeRunner});
    fs.rmSync(npmConfigPath,{force:true});
    const lock=path.join(stage,'package-lock.json');
    if(!fs.existsSync(lock)||!fs.lstatSync(lock).isFile())throw new Error('Provider tooling install did not produce package-lock.json');
    const lockBytes=fs.readFileSync(lock);
    const receipt={
      schemaVersion:'repository-provider-tooling-receipt/v1',installedAt:now(),node:process.version,platform:process.platform,arch:process.arch,
      providers:verified.map((x)=>({provider:x.provider,package:x.package,version:x.version,binary:x.binary,binarySha256:x.binarySha256})),
      packageLockSha256:hash(lockBytes),
      installPolicy:{registry:'https://registry.npmjs.org/',ignoreScripts:true,audit:false,fund:false,projectLocal:true},
      globalInstall:false,globalHooks:false,
    };
    fs.writeFileSync(path.join(stage,'executionkit-provider-tooling.json'),`${JSON.stringify(receipt,null,2)}\n`,{mode:0o600});
    if(fs.existsSync(target)){fs.renameSync(target,backup);oldMoved=true;}
    fs.renameSync(stage,target);newInstalled=true;
    const doctor=doctorRepositoryProviderTooling(root,{probeRunner});
    if(!doctor.ok)throw new Error(`Installed provider tooling failed doctor: ${doctor.errors.join('; ')}`);
    if(oldMoved)fs.rmSync(backup,{recursive:true,force:true});
    return {schemaVersion:'repository-provider-tooling-apply/v1',status:'INSTALLED',plan,installed:verified,receipt,doctor};
  }catch(error){
    try{
      if(newInstalled&&fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
      if(oldMoved&&fs.existsSync(backup))fs.renameSync(backup,target);
      if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});
      if(fs.existsSync(backup))fs.rmSync(backup,{recursive:true,force:true});
    }catch(rollbackError){error.message+=`; rollback failed: ${rollbackError.message}`;}
    throw error;
  }
}
export function doctorRepositoryProviderTooling(root,{probeRunner=probeBinary}={}){
  let target;
  try{target=safeRoot(root);}
  catch(error){return {schemaVersion:'repository-provider-tooling-doctor/v1',status:'FAIL',ok:false,errors:[error.message],providers:[]};}
  const errors=[],providers=[];
  const targetStat=lstatMaybe(target);
  if(!targetStat)return {schemaVersion:'repository-provider-tooling-doctor/v1',status:'NOT_INSTALLED',ok:true,errors,providers};
  const stat=targetStat;
  if(stat.isSymbolicLink()||!stat.isDirectory())return {schemaVersion:'repository-provider-tooling-doctor/v1',status:'FAIL',ok:false,errors:['provider tooling root must be a real directory'],providers};
  let receipt=null;
  try{receipt=trustedToolingReceipt(target,{allowMissing:false});}
  catch(error){errors.push(error.message);}
  for(const item of receipt?.providers??[]){
    const tool=MANAGED_REPOSITORY_PROVIDER_TOOLS[item.provider];
    if(!tool){errors.push(`receipt provider unsupported: ${item.provider}`);continue;}
    if(item.version!==tool.version)errors.push(`receipt version drift: ${item.provider}`);
    let binary;
    try{binary=resolveManagedRepositoryProviderBinary(root,item.provider);}
    catch(error){errors.push(`managed provider integrity: ${item.provider}: ${error.message}`);continue;}
    if(!binary){errors.push(`managed binary missing: ${item.provider}`);continue;}
    const probe=probeRunner(binary,root,tool);
    providers.push({provider:item.provider,binary,probe});
    const expectedVersion=tool.cliVersion??tool.version;
    if(!probe.ok||probe.version!==expectedVersion)errors.push(`managed provider probe mismatch: ${item.provider}`);
  }
  return {schemaVersion:'repository-provider-tooling-doctor/v1',status:errors.length?'FAIL':'PASS',ok:errors.length===0,errors,providers,receipt};
}
