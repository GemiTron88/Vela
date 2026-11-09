import crypto from 'node:crypto';
import {inspectVhostGuard,vhostPolicyFingerprint} from './vhost-guard.mjs';
import {assertProviderBoundary,inspectProviderReadiness,providerDigest} from './provider-readiness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnPortableSync } from './portable-process.mjs';
import { captureRepositorySnapshot, scanStrongSecrets } from './repository-source.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from './derived-state.mjs';
import { acquireDeploymentLock, retainSuccessfulReleases, validateRetentionPolicy } from './production-retention.mjs';
import { captureWorkerRetirementBarrier } from './production-worker-retirement.mjs';
import { retainProductionArtifactCache } from './production-artifact-retention.mjs';
import { verifyProductionBackup, verifyLaravelProductionRuntime, prepareProductionBackup } from './production-backup.mjs';
import { productionPathDenied, DEFAULT_ARTIFACT_BUDGET, enforceArtifactBudget, inventoryProductionTree, compareProductionInventory, verifyComposerProductionDependencies } from './production-artifact-policy.mjs';

const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const posix=(value)=>String(value).replaceAll('\\','/');
const DERIVED_DIRTY_PREFIXES=['.executionkit/','.codegraph/','.terrain/','.litho-agent/'];

export const DEFAULT_DEPLOYMENT_CONFIG=Object.freeze({
  enabled:true,
  requiredForRelease:true,
  artifactRoot:'.executionkit/deployment',
  sourceRoot:'.',
  allowSourceMaps:false,
  verifyComposerDependencies:true,
  attestationUrl:'',
  requireBackupBeforeActivate:false,
  backupReceiptPath:'',
  backupDatabase:'',
  artifactBudget:DEFAULT_ARTIFACT_BUDGET,
  requireCleanGit:true,
  extraInclude:Object.freeze([]),
  extraExclude:Object.freeze([]),
  buildCommands:Object.freeze([]),
  preActivateCommands:Object.freeze([]),
  postActivateCommands:Object.freeze([]),
  smokeCommands:Object.freeze([]),
  sharedLinks:Object.freeze([]),
  healthUrl:'',
  healthTimeoutMs:10000,
  retention:Object.freeze({enabled:true,keepRollbacks:1,artifactKeepRollbacks:0,minimumAgeMinutes:0,cleanupLegacyReleases:true,workerUsers:[]}),
  workspace:Object.freeze({
    mode:'PROJECT_ROOT',
    allowedRoots:Object.freeze([]),
    requireOutsideProduction:true,
  }),
  privilege:Object.freeze({
    model:'UNPRIVILEGED_AFTER_BOOTSTRAP',
    sudoDuringDeploy:false,
    requireWritableTarget:true,
    deploymentUser:'',
  }),
  target:Object.freeze({type:'UNCONFIGURED',releaseRoot:'',currentLink:''}),
});

function readConfig(root){
  const file=path.join(path.resolve(root),'execution.config.json');
  if(!fs.existsSync(file))return {...DEFAULT_DEPLOYMENT_CONFIG,target:{...DEFAULT_DEPLOYMENT_CONFIG.target}};
  const config=JSON.parse(fs.readFileSync(file,'utf8'));
  const raw=config.deployment??{};
  return {
    ...DEFAULT_DEPLOYMENT_CONFIG,
    ...raw,
    standardVersion:config.standardVersion,
    retention:{...DEFAULT_DEPLOYMENT_CONFIG.retention,...(raw.retention??{})},
    artifactBudget:{...DEFAULT_ARTIFACT_BUDGET,...(raw.artifactBudget??{})},
    workspace:{
      ...DEFAULT_DEPLOYMENT_CONFIG.workspace,
      ...(raw.workspace??{}),
      allowedRoots:[...(raw.workspace?.allowedRoots??[])],
    },
    privilege:{...DEFAULT_DEPLOYMENT_CONFIG.privilege,...(raw.privilege??{})},
    target:{...DEFAULT_DEPLOYMENT_CONFIG.target,...(raw.target??{})},
    extraInclude:[...(raw.extraInclude??[])],extraExclude:[...(raw.extraExclude??[])],
    buildCommands:[...(raw.buildCommands??[])],preActivateCommands:[...(raw.preActivateCommands??[])],
    postActivateCommands:[...(raw.postActivateCommands??[])],smokeCommands:[...(raw.smokeCommands??[])],sharedLinks:[...(raw.sharedLinks??[])]
  };
}
function detectStacks(root){
  const exists=(rel)=>fs.existsSync(path.join(root,...rel.split('/')));
  const stacks=[];
  const laravel=exists('artisan')&&exists('composer.json'),flutter=exists('pubspec.yaml');
  if(laravel)stacks.push('laravel');
  if(flutter)stacks.push('flutter');
  if(exists('package.json')&&!laravel&&!flutter)stacks.push('node');
  return stacks;
}
function hardDenied(rel,options={}){return productionPathDenied(rel,options);}
function sourceRootPath(root,cfg){
  if(typeof cfg.allowSourceMaps!=='boolean'||typeof cfg.verifyComposerDependencies!=='boolean')throw new Error('Production policy switches must be booleans');
  const rel=cfg.sourceRoot==='.'?'.':validateRelative(cfg.sourceRoot,'deployment.sourceRoot');
  if(rel==='.')return path.resolve(root);
  return resolveProjectPathSafe(root,rel,'deployment.sourceRoot',{mustExist:true});
}
function excludeMatch(rel,pattern){
  const normalized=validateRelative(pattern,'deployment.extraExclude');
  if(!/[?*]/.test(normalized))return prefixMatch(rel,normalized);
  let expression='';
  for(let i=0;i<normalized.length;i++){
    const ch=normalized[i];
    if(ch==='*'&&normalized[i+1]==='*'){expression+='.*';i++;}
    else if(ch==='*')expression+='[^/]*';
    else if(ch==='?')expression+='[^/]';
    else expression+=ch.replace(/[\^$+.()|{}\[\]]/g,'\\$&');
  }
  return new RegExp('^'+expression+'(?:/.*)?$').test(rel);
}
function prefixMatch(rel,prefix){
  const p=posix(prefix).replace(/^\.\//,'').replace(/\/$/,'');
  return rel===p||rel.startsWith(p+'/');
}
function nodeRuntimeEntrypoints(root){
  const file=path.join(root,'package.json');
  if(!fs.existsSync(file))return [];
  try{
    const pkg=JSON.parse(fs.readFileSync(file,'utf8')),items=[];
    if(typeof pkg.main==='string')items.push(validateRelative(pkg.main,'package.json main'));
    if(typeof pkg.bin==='string')items.push(validateRelative(pkg.bin,'package.json bin'));
    else if(pkg.bin&&typeof pkg.bin==='object')for(const value of Object.values(pkg.bin))if(typeof value==='string')items.push(validateRelative(value,'package.json bin'));
    return [...new Set(items)];
  }catch{return [];}
}
function stackAllowed(rel,stacks){
  const rootFiles=new Set();
  const prefixes=[];
  if(stacks.includes('laravel')){
    for(const f of ['artisan','composer.json','composer.lock'])rootFiles.add(f);
    prefixes.push('app','bootstrap','config','database/migrations','public','resources/views','resources/lang','lang','routes');
  }
  if(stacks.includes('node')){
    for(const f of ['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock'])rootFiles.add(f);
    prefixes.push('dist','build','.next/standalone','.next/static','public','server','src');
  }
  if(stacks.includes('flutter')){
    prefixes.push('build/web','build/app/outputs/flutter-apk','build/app/outputs/bundle');
  }
  return rootFiles.has(rel)||prefixes.some((p)=>prefixMatch(rel,p));
}
function walk(root,{cfg,stacks,prune=true}={}){
  const files=[];
  const visit=(dir,relBase='')=>{
    for(const name of fs.readdirSync(dir).sort()){
      const rel=relBase?posix(path.join(relBase,name)):name;
      if(rel==='.git')continue;
      const full=path.join(dir,name),stat=fs.lstatSync(full);
      if(stat.isSymbolicLink()){files.push({rel,full,type:'symlink',size:0});continue;}
      if(stat.isDirectory()){
        if(prune&&hardDenied(rel+'/_directory',{sourceMaps:cfg?.allowSourceMaps,nodeStandalone:stacks?.includes('node')})){files.push({rel:rel+'/',full,type:'excluded_directory',size:0});continue;}
        visit(full,rel);continue;}
      if(stat.isFile())files.push({rel,full,type:'file',size:stat.size,mode:stat.mode&0o777});
    }
  };
  visit(path.resolve(root));return files;
}
function validateRelative(rel,label){
  if(typeof rel!=='string'||!rel.trim()||path.isAbsolute(rel))throw new Error(`${label} must be a non-empty project-relative path`);
  const n=posix(path.posix.normalize(rel.replaceAll('\\','/'))).replace(/^\.\//,'');
  if(n==='.'||n.startsWith('../')||n.includes('/../'))throw new Error(`${label} escapes project: ${rel}`);
  return n;
}
function runCommands(commands,{cwd,releasePath=null,label='deployment command',beforeCommand=null}={}){
  const results=[];
  for(const item of commands??[]){
    if(!item||typeof item.command!=='string'||!item.command.trim()||!Array.isArray(item.args))throw new Error(`${label} is invalid`);
    const args=item.args.map((arg)=>String(arg).replaceAll('{release}',releasePath??cwd));
    const runCwd=item.cwd==='release'&&releasePath?releasePath:cwd;
    if(beforeCommand)beforeCommand(item,args);
    const portable=spawnPortableSync(item.command,args,{cwd:runCwd,encoding:'utf8',timeout:Number(item.timeoutMs??600000),maxBuffer:16*1024*1024,windowsHide:true});
    const r=portable.result;
    const result={command:item.command,args,portableInvocation:portable.invocation,exitCode:r.status,stdout:(r.stdout??'').slice(0,4000),stderr:(r.stderr??'').slice(0,4000),error:r.error?.message??null};
    results.push(result);
    if(r.error||r.status!==0)throw new Error(`${label} failed: ${item.command} ${args.join(' ')}: ${result.stderr||result.stdout||result.error||r.status}`);
  }
  return results;
}
function hashFile(full){
  const h=crypto.createHash('sha256'),fd=fs.openSync(full,'r'),buffer=Buffer.allocUnsafe(64*1024);
  try{let n=0;do{n=fs.readSync(fd,buffer,0,buffer.length,null);if(n>0)h.update(buffer.subarray(0,n));}while(n>0);}finally{fs.closeSync(fd);}
  return h.digest('hex');
}
export function planProductionArtifact(root,{runBuild=false}={}){
  const cfg=readConfig(root);if(cfg.enabled!==true)throw new Error('Production Deployment Fabric is disabled');
  if(runBuild&&cfg.buildCommands.length)runCommands(cfg.buildCommands,{cwd:path.resolve(root),label:'production build command'});
  const snapshot=captureRepositorySnapshot(root);
  const meaningfulDirtyPaths=(snapshot.dirtyPaths??[]).filter((p)=>!DERIVED_DIRTY_PREFIXES.some((prefix)=>p===prefix.slice(0,-1)||p.startsWith(prefix)));
  if(cfg.requireCleanGit&&meaningfulDirtyPaths.length)throw new Error(`Production artifact requires a clean working tree after build; dirty paths: ${meaningfulDirtyPaths.join(', ')}`);
  if(!snapshot.head)throw new Error('Production artifact requires a Git HEAD');
  const runtimeRoot=sourceRootPath(root,cfg),stacks=detectStacks(runtimeRoot),nodeEntrypoints=stacks.includes('node')?nodeRuntimeEntrypoints(runtimeRoot):[],all=walk(runtimeRoot,{cfg,stacks}),included=[],excluded=[];
  const pathPolicy={sourceMaps:cfg.allowSourceMaps,nodeStandalone:stacks.includes('node')};
  for(const entry of all){
    const deny=hardDenied(entry.rel.endsWith('/')?entry.rel+'_directory':entry.rel,pathPolicy);
    if(deny){excluded.push({path:entry.rel,reason:deny});continue;}
    if(stacks.includes('laravel')&&/^bootstrap\/cache\/[^/]+\.php$/.test(entry.rel)){excluded.push({path:entry.rel,reason:'generated_laravel_cache'});continue;}
    if(entry.type==='symlink'){excluded.push({path:entry.rel,reason:'source_symlink_forbidden'});continue;}
    if(cfg.extraExclude.some((p)=>excludeMatch(entry.rel,p))){excluded.push({path:entry.rel,reason:'configured_exclude'});continue;}
    const allowed=stackAllowed(entry.rel,stacks)||nodeEntrypoints.some((p)=>prefixMatch(entry.rel,p))||cfg.extraInclude.some((p)=>prefixMatch(entry.rel,validateRelative(p,'deployment.extraInclude')));
    if(!allowed){excluded.push({path:entry.rel,reason:'not_in_production_allowlist'});continue;}
    scanProductionSecrets(entry.full,entry.rel);
    if(entry.size>cfg.artifactBudget.maxFileBytes)throw new Error(`Production artifact exceeds configured budget: ${entry.rel}`);
    included.push({path:entry.rel,sourcePath:posix(path.relative(path.resolve(root),entry.full)),size:entry.size,mode:entry.mode,sha256:hashFile(entry.full)});
  }
  included.sort((a,b)=>a.path.localeCompare(b.path));
  const footprint=enforceArtifactBudget(included,cfg.artifactBudget);
  if(!included.length)throw new Error('Production artifact allowlist selected zero files; configure a supported stack or deployment.extraInclude');
  const required=[];
  if(stacks.includes('laravel'))required.push('artisan','composer.json','public/index.php');
  if(stacks.includes('node'))required.push('package.json');
  if(stacks.includes('flutter')&&fs.existsSync(path.join(runtimeRoot,'build/web')))required.push('build/web/index.html');
  const missingRequired=required.filter((p)=>!included.some((x)=>x.path===p));
  if(missingRequired.length)throw new Error(`Production artifact missing required runtime files: ${missingRequired.join(', ')}`);
  const releaseFingerprint=sha(JSON.stringify({head:snapshot.head,files:included.map(({path,sha256,size,mode})=>({path,sha256,size,mode}))}));
  const releaseId=`${snapshot.head.slice(0,12)}-${releaseFingerprint.slice(0,12)}`;
  return {schemaVersion:'production-artifact-plan/v1',releaseId,repository:{head:snapshot.head,branch:snapshot.branch,dirty:meaningfulDirtyPaths.length>0,dirtyPaths:meaningfulDirtyPaths},stacks,sourceRoot:cfg.sourceRoot,footprint,files:included,excluded,required,missingRequired,policy:{mode:'ALLOWLIST',hardDenied:true,docsExcluded:true,executionKitExcluded:true,secretsExcluded:true},artifactRoot:cfg.artifactRoot};
}
function artifactBase(root,cfg,{create=false}={}){const dir=resolveDerivedPath(root,`${cfg.artifactRoot}/artifacts`,'production artifact root',{createParents:create});if(create)fs.mkdirSync(dir,{recursive:true});return dir;}
export function buildProductionArtifact(root,{runBuild=false}={}){
  const cfg=readConfig(root),plan=planProductionArtifact(root,{runBuild}),base=artifactBase(root,cfg,{create:true}),finalDir=path.join(base,plan.releaseId),payload=path.join(finalDir,'payload');
  // Identical exact-source builds reuse verified bytes, never erase owner files.
  const existing=fs.lstatSync(finalDir,{throwIfNoEntry:false});
  if(existing){
    const collision=()=>{throw new Error('ARTIFACT_CACHE_CONFLICT_MANUAL_REVIEW_REQUIRED');};
    if(!existing.isDirectory()||existing.isSymbolicLink()||
       fs.readdirSync(finalDir).sort().join('|')!=='manifest.json|payload')collision();
    const meta=path.join(finalDir,'manifest.json'),st=fs.lstatSync(meta);
    if(!st.isFile()||st.isSymbolicLink()||st.size>16777216)collision();
    let manifest;try{manifest=JSON.parse(fs.readFileSync(meta,'utf8'));}catch{collision();}
    if(manifest.releaseId!==plan.releaseId||manifest.repository?.head!==plan.repository.head||
       manifest.sourceRoot!==plan.sourceRoot||JSON.stringify(manifest.stacks)!==JSON.stringify(plan.stacks)||
       JSON.stringify(manifest.files)!==JSON.stringify(plan.files))collision();
    const payloadStat=fs.lstatSync(payload);
    if(!payloadStat.isDirectory()||payloadStat.isSymbolicLink())collision();
    const actual=inventoryProductionTree(payload);
    if(actual.errors.length||compareProductionInventory(plan.files,actual.files).length)collision();
    return {status:'BUILT',cacheHit:true,manifest,artifactPath:finalDir};
  }
  // Do not strand multi-gigabyte, incomplete release payloads on ordinary failure.
  // Publish fully verified producer files by an atomic same-filesystem rename.
  const temporary=fs.mkdtempSync(path.join(base,'.building-'+plan.releaseId+'-'+process.pid+'-'));
  const pendingPayload=path.join(temporary,'payload');
  try {
    fs.mkdirSync(pendingPayload);
    for(const item of plan.files){
      const source=resolveProjectPathSafe(root,item.sourcePath??item.path,'production artifact source',{mustExist:true,file:true});
      const dst=path.join(pendingPayload,...item.path.split('/'));
      fs.mkdirSync(path.dirname(dst),{recursive:true});
      fs.copyFileSync(source,dst);fs.chmodSync(dst,item.mode??0o644);
      if(hashFile(dst)!==item.sha256)throw new Error('Production artifact copy hash mismatch: '+item.path);
    }
    const manifest={...plan,builtAt:new Date().toISOString(),payloadPath:'payload'};
    fs.writeFileSync(path.join(temporary,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
    if(fs.lstatSync(finalDir,{throwIfNoEntry:false}))throw new Error('ARTIFACT_CACHE_CONFLICT_MANUAL_REVIEW_REQUIRED');
    fs.renameSync(temporary,finalDir);
    return {status:'BUILT',cacheHit:false,manifest,artifactPath:finalDir};
  } catch(error) {
    // Remove only this invocation's new temporary directory; never other
    // artifacts, site content, or unknown historical owner files.
    fs.rmSync(temporary,{recursive:true,force:true});
    throw error;
  }
}
export function validateProductionArtifact(root,{releaseId=null}={}){
  const cfg=readConfig(root),base=artifactBase(root,cfg);
  let currentPlan=null,id=releaseId;
  if(!id){
    currentPlan=planProductionArtifact(root);
    id=currentPlan.releaseId;
    if(!fs.existsSync(path.join(base,id,'manifest.json')))return {schemaVersion:'production-artifact-validation/v1',status:'MISSING',ok:false,releaseId:id,errors:[{code:'CURRENT_ARTIFACT_MISSING',releaseId:id}]};
  }
  if(id&&!/^[a-f0-9]{12}-[a-f0-9]{12}$/.test(id))return {schemaVersion:'production-artifact-validation/v1',status:'FAIL',ok:false,errors:[{code:'ARTIFACT_RELEASE_ID_INVALID'}]};
  if(!id)return {schemaVersion:'production-artifact-validation/v1',status:'MISSING',ok:false,errors:[{code:'ARTIFACT_MISSING'}]};
  const dir=path.join(base,id),manifestFile=path.join(dir,'manifest.json'),errors=[];
  if(!fs.existsSync(manifestFile))return {schemaVersion:'production-artifact-validation/v1',status:'FAIL',ok:false,releaseId:id,errors:[{code:'MANIFEST_MISSING'}]};
  if(!fs.lstatSync(manifestFile).isFile()||fs.lstatSync(manifestFile).isSymbolicLink())return {schemaVersion:'production-artifact-validation/v1',status:'FAIL',ok:false,errors:[{code:'ARTIFACT_MANIFEST_UNSAFE'}]};
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),payload=path.join(dir,'payload');
  const current=currentPlan??planProductionArtifact(root);
  if(current.releaseId!==manifest.releaseId||manifest.releaseId!==id||manifest.repository?.head!==current.repository.head)errors.push({code:'ARTIFACT_STALE',expectedReleaseId:current.releaseId,actualReleaseId:manifest.releaseId});
  if(JSON.stringify(manifest.stacks)!==JSON.stringify(current.stacks)||manifest.sourceRoot!==current.sourceRoot)errors.push({code:'ARTIFACT_POLICY_MISMATCH'});
  if(!Array.isArray(manifest.files))errors.push({code:'ARTIFACT_MANIFEST_INVALID'});
  else errors.push(...compareProductionInventory(current.files,manifest.files));
  if(!fs.existsSync(payload)||!fs.lstatSync(payload).isDirectory()||fs.lstatSync(payload).isSymbolicLink())errors.push({code:'ARTIFACT_PAYLOAD_INVALID'});
  else{
    const observed=inventoryProductionTree(payload);
    errors.push(...observed.errors,...compareProductionInventory(current.files,observed.files));
    try{enforceArtifactBudget(observed.files,cfg.artifactBudget);}catch(error){errors.push({code:'ARTIFACT_BUDGET_EXCEEDED',message:error.message});}
  }
  return {schemaVersion:'production-artifact-validation/v1',status:errors.length?'FAIL':'PASS',ok:errors.length===0,releaseId:id,manifest,errors};
}
function scanProductionSecrets(file,rel){
  const fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(65536);let tail='';
  try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){
    const text=tail+buffer.subarray(0,n).toString('utf8'),findings=scanStrongSecrets(text);
    if(findings.detected)throw new Error(`Production artifact secret-like content detected in ${rel}: ${findings.pattern}`);
    tail=text.slice(-256);
  }}finally{fs.closeSync(fd);}
}
function stageProductionInventory(cfg,manifest,releaseDir,{dependencyBaseline=null}={}){
  const observed=inventoryProductionTree(releaseDir,{ignoreLinks:(cfg.sharedLinks??[]).map(item=>({path:item.releasePath,target:item.target}))});
  const errors=[...observed.errors],expected=new Map(manifest.files.map(item=>[item.path,item]));
  const lockedPackages=manifest.stacks.includes('laravel')&&fs.existsSync(path.join(releaseDir,'composer.lock'))?JSON.parse(fs.readFileSync(path.join(releaseDir,'composer.lock'),'utf8')).packages??[]:[];
  if(lockedPackages.length&&cfg.verifyComposerDependencies===false)throw new Error('Laravel production dependency verification cannot be disabled for a non-empty lock');
  const dependencyEvidence=lockedPackages.length?verifyComposerProductionDependencies(releaseDir):null;
  for(const item of observed.files){
    const original=expected.get(item.path);
    const cache=manifest.stacks.includes('laravel')&&/^bootstrap\/cache\/[^/]+\.php$/.test(item.path);
    const dependency=Boolean(dependencyEvidence)&&item.path.startsWith('vendor/');
    const marker=cfg.attestationUrl&&item.path==='public/.well-known/executionkit-release.json';
    const deny=marker?null:hardDenied(item.path,{sourceMaps:cfg.allowSourceMaps,nodeStandalone:manifest.stacks.includes('node'),dependencies:dependency});
    if(deny)errors.push({code:'STAGED_NON_RUNTIME_FILE',path:item.path,reason:deny});
    if(!original&&!cache&&!dependency&&!marker)errors.push({code:'STAGED_UNMANIFESTED_FILE',path:item.path});
    if(original&&!cache&&(original.sha256!==item.sha256||original.size!==item.size||original.mode!==item.mode))errors.push({code:'STAGED_SOURCE_HASH_OR_MODE_MISMATCH',path:item.path});
    if(process.platform!=='win32'&&(item.mode&0o002))errors.push({code:'STAGED_WORLD_WRITABLE_FILE',path:item.path});
    if(marker){const proof=JSON.parse(fs.readFileSync(path.join(releaseDir,item.path),'utf8'));if(proof.releaseId!==manifest.releaseId||proof.head!==manifest.repository.head)errors.push({code:'STAGED_ATTESTATION_MISMATCH'});}
    // Generated Laravel config holds provisioned runtime secrets, never source secrets.
    // Keep it outside public and restrict access without weakening source scanning.
    if(item.path==='bootstrap/cache/config.php'&&cache){
      if(process.platform!=='win32'&&(item.mode&0o007))errors.push({code:'STAGED_CONFIG_CACHE_PUBLIC_PERMISSIONS',path:item.path});
    }else scanProductionSecrets(path.join(releaseDir,item.path),item.path);
  }
  const found=new Set(observed.files.map(item=>item.path));
  for(const item of manifest.files)if(!found.has(item.path))errors.push({code:'STAGED_SOURCE_MISSING',path:item.path});
  const footprint=enforceArtifactBudget(observed.files,cfg.artifactBudget);
  if(dependencyBaseline)errors.push(...compareProductionInventory(dependencyBaseline.filter(f=>f.path.startsWith('vendor/')),observed.files.filter(f=>f.path.startsWith('vendor/'))).map(e=>({...e,code:'STAGED_DEPENDENCY_CHANGED_'+e.code})));
  if(errors.length)throw new Error('Staged production inventory failed: '+JSON.stringify(errors));
  return {schemaVersion:'production-stage-inventory/v1',status:'PASS',files:observed.files,footprint,dependencies:dependencyEvidence};
}

function validateAbsoluteTarget(value,label){
  if(typeof value!=='string'||!path.isAbsolute(value))throw new Error(`${label} must be an absolute path`);
  const resolved=path.resolve(value),rootPath=path.parse(resolved).root;
  if(resolved===rootPath)throw new Error(`${label} may not be a filesystem root`);
  return resolved;
}
function assertTargetPathSafe(target,label,{allowLeafSymlink=false}={}){
  const resolved=path.resolve(target),parsed=path.parse(resolved),parts=resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let cursor=parsed.root;
  for(let i=0;i<parts.length;i++){
    cursor=path.join(cursor,parts[i]);
    if(!fs.existsSync(cursor)&&!fs.lstatSync(cursor,{throwIfNoEntry:false}))continue;
    const stat=fs.lstatSync(cursor),leaf=i===parts.length-1;
    if(stat.isSymbolicLink()&&!(leaf&&allowLeafSymlink))throw new Error(`${label} traverses a symbolic link: ${cursor}`);
    if(!leaf&&!stat.isDirectory())throw new Error(`${label} parent is not a directory: ${cursor}`);
  }
  return resolved;
}
function pathWithin(child,parent){
  const c=path.resolve(child),p=path.resolve(parent),rel=path.relative(p,c);
  return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));
}
function nearestExistingPath(target){
  let cursor=path.resolve(target);
  while(!fs.existsSync(cursor)){
    const parent=path.dirname(cursor);
    if(parent===cursor)return null;
    cursor=parent;
  }
  return cursor;
}
function writablePathCheck(target,label){
  const anchor=nearestExistingPath(target);
  if(!anchor)return {label,target:path.resolve(target),anchor:null,ok:false,reason:'NO_EXISTING_PARENT'};
  try{
    fs.accessSync(anchor,fs.constants.W_OK|fs.constants.X_OK);
    return {label,target:path.resolve(target),anchor,ok:true};
  }catch(error){
    return {label,target:path.resolve(target),anchor,ok:false,reason:'NOT_WRITABLE',error:error.message};
  }
}
function declaredWorkspaceCheck(root,cfg){
  const projectRoot=path.resolve(root),allowed=(cfg.workspace?.allowedRoots??[])
    .filter((value)=>typeof value==='string'&&value.trim())
    .map((value)=>validateAbsoluteTarget(value,'deployment.workspace.allowedRoots entry'));
  if(!allowed.length)return {ok:true,projectRoot,allowedRoots:[],mode:cfg.workspace?.mode??'PROJECT_ROOT',matched:null};
  const matched=allowed.find((base)=>pathWithin(projectRoot,base))??null;
  return {ok:Boolean(matched),projectRoot,allowedRoots:allowed,mode:cfg.workspace?.mode??'PROJECT_ROOT',matched,reason:matched?null:'PROJECT_OUTSIDE_ALLOWED_WORKSPACE'};
}
export function productionDeploymentHostPlan(root){
  const cfg=readConfig(root),projectRoot=path.resolve(root),workspace=declaredWorkspaceCheck(root,cfg);
  const targetConfigured=cfg.target?.type==='local-release-root';
  const requirements=[];
  if(!targetConfigured)requirements.push({code:'DEPLOYMENT_TARGET_UNCONFIGURED',action:'Declare this project or derived instance production releaseRoot/currentLink; never infer another project path.'});
  let target=null;
  if(targetConfigured){
    const releaseRoot=validateAbsoluteTarget(cfg.target.releaseRoot,'deployment.target.releaseRoot');
    const currentLink=validateAbsoluteTarget(cfg.target.currentLink,'deployment.target.currentLink');
    target={releaseRoot,currentLink,releasesDir:path.join(releaseRoot,'releases')};
    if(detectStacks(sourceRootPath(root,cfg)).includes('laravel')){
      target.documentRoot=path.join(currentLink,'public');
      requirements.push({code:'VERIFY_OR_CONFIGURE_VHOST',owner:'Launch OS',documentRoot:target.documentRoot,publicLink:cfg.target.publicLink||null,privileged:'ONE_TIME_IF_NEEDED',action:'Declare deployment.vhost domains and actual Apache/Nginx engines; verify effective native config with guard vhost. For CWP copy/select custom HTTP tpl and HTTPS stpl per domain and pin their hashes plus observed selection keys. Preserve hosting data and a valid baseline; privileged bootstrap/reload is explicit owner work. Generated vhosts must never be routine edit targets. Declare the actual domain attestation URL.'});
    }
    requirements.push({code:'CREATE_RELEASE_ROOT',path:releaseRoot,privileged:'ONE_TIME_IF_NEEDED'});
    requirements.push({code:'CREATE_CURRENT_PARENT',path:path.dirname(currentLink),privileged:'ONE_TIME_IF_NEEDED'});
    requirements.push({code:'GRANT_DEPLOY_WRITE',paths:[releaseRoot,path.dirname(currentLink)],strategy:'OWNER_GROUP_OR_ACL',user:cfg.privilege?.deploymentUser||'DECLARED_DEPLOYMENT_USER',privileged:'ONE_TIME_IF_NEEDED'});
    if(cfg.retention.keepRollbacks===0)requirements.push({code:'VERIFY_RUNTIME_RETIREMENT',owner:'Launch OS',workerUsers:cfg.retention.workerUsers??[],action:'Observe every actual PHP/FPM/queue/app runtime owner; configure workerUsers and real post-activation drain/restart commands. Cleanup requires pre-switch runtimes to retire plus readable process proof; never guess service names or treat queue:restart exit as completed drain.'});
    if(cfg.target.publicLink)requirements.push({code:'PUBLIC_LINK_BOOTSTRAP',path:cfg.target.publicLink,target:path.join(currentLink,'public'),action:'Preserve/adopt existing hosting files and storage before a one-time public alias switch; never delete/convert an existing real directory during routine deploy.'});
  }
  return {
    schemaVersion:'production-deployment-host-plan/v1',
    status:workspace.ok?'PLANNED':'BLOCKED',
    projectRoot,
    workspace,
    target,
    privilege:{
      model:cfg.privilege?.model??'UNPRIVILEGED_AFTER_BOOTSTRAP',
      sudoDuringDeploy:cfg.privilege?.sudoDuringDeploy===true,
      requireWritableTarget:cfg.privilege?.requireWritableTarget!==false,
      deploymentUser:cfg.privilege?.deploymentUser||null,
    },
    policy:{
      sourceAndProductionSeparated:true,
      buildInProductionRoot:false,
      gitPullInProductionRoot:false,
      immutableVersionedReleases:true,
      atomicCurrentPointer:true,
      sharedPersistentPaths:true,
      smokeAndHealth:true,
      automaticRollback:true,
      privilegedBootstrapOnly:true,
    },
    requirements
  };
}
export function productionDeploymentHostCheck(root){
  const cfg=readConfig(root),plan=productionDeploymentHostPlan(root),checks=[],errors=[];
  if(!plan.workspace.ok)errors.push({code:'DEPLOYMENT_WORKSPACE_OUTSIDE_ALLOWED_ROOT',projectRoot:plan.projectRoot,allowedRoots:plan.workspace.allowedRoots});
  if(cfg.privilege?.sudoDuringDeploy===true)errors.push({code:'DEPLOYMENT_SUDO_DURING_DEPLOY_FORBIDDEN',message:'Production deploy must be unprivileged after one-time host bootstrap'});
  if((cfg.privilege?.model??'UNPRIVILEGED_AFTER_BOOTSTRAP')!=='UNPRIVILEGED_AFTER_BOOTSTRAP')errors.push({code:'DEPLOYMENT_PRIVILEGE_MODEL_UNSUPPORTED',message:'v4 requires UNPRIVILEGED_AFTER_BOOTSTRAP'});
  if(cfg.target?.type!=='local-release-root')errors.push({code:'DEPLOYMENT_TARGET_UNCONFIGURED'});
  else{
    try{
      const releaseRoot=validateAbsoluteTarget(cfg.target.releaseRoot,'deployment.target.releaseRoot');
      const currentLink=validateAbsoluteTarget(cfg.target.currentLink,'deployment.target.currentLink');
      if(cfg.target.publicLink){
        const publicLink=validateAbsoluteTarget(cfg.target.publicLink,'deployment.target.publicLink'),stat=fs.lstatSync(publicLink,{throwIfNoEntry:false});
        if(!stat?.isSymbolicLink()||path.resolve(path.dirname(publicLink),fs.readlinkSync(publicLink))!==path.join(currentLink,'public'))errors.push({code:'DEPLOYMENT_PUBLIC_LINK_NOT_ADOPTED',message:'The configured public alias must point to current/public; preserve existing hosting data before the one-time cutover',path:publicLink});
        else if(!fs.existsSync(publicLink)||!fs.statSync(publicLink).isDirectory())errors.push({code:'DEPLOYMENT_PUBLIC_BASELINE_MISSING',message:'Adopt a valid baseline before pointing a live public alias at current/public',path:publicLink});
      }
      const projectRoot=path.resolve(root);
      const releasesDir=path.join(releaseRoot,'releases');
      if(pathWithin(releaseRoot,projectRoot)||pathWithin(currentLink,projectRoot))errors.push({code:'DEPLOYMENT_TARGET_INSIDE_SOURCE'});
      if(cfg.workspace?.requireOutsideProduction!==false&&(pathWithin(projectRoot,releaseRoot)||pathWithin(projectRoot,path.dirname(currentLink))))errors.push({code:'DEPLOYMENT_SOURCE_INSIDE_PRODUCTION'});
      if(currentLink===releaseRoot||pathWithin(currentLink,releasesDir))errors.push({code:'DEPLOYMENT_CURRENT_LINK_COLLIDES_WITH_RELEASES'});
      const releaseWrite=writablePathCheck(releaseRoot,'deployment.target.releaseRoot');
      const currentWrite=writablePathCheck(path.dirname(currentLink),'deployment.target.currentLink parent');
      checks.push(releaseWrite,currentWrite);
      if(cfg.privilege?.requireWritableTarget!==false){
        if(!releaseWrite.ok)errors.push({code:'DEPLOYMENT_RELEASE_ROOT_NEEDS_PROVISIONING',...releaseWrite});
        if(!currentWrite.ok)errors.push({code:'DEPLOYMENT_CURRENT_PARENT_NEEDS_PROVISIONING',...currentWrite});
      }
    }catch(error){errors.push({code:'DEPLOYMENT_TARGET_INVALID',message:error.message});}
  }
  const vhost=inspectVhostGuard(root,{config:{standardVersion:cfg.standardVersion,deployment:cfg}});
  if(!vhost.ok)errors.push(...vhost.findings);
  if(vhost.required){
    try{const url=new URL(cfg.attestationUrl);if(url.protocol!=='https:'||url.username||url.password||!(cfg.vhost?.domains??[]).map(d=>d.toLowerCase()).includes(url.hostname.toLowerCase())||url.pathname!=='/.well-known/executionkit-release.json')throw Error('invalid domain attestation');}
    catch{errors.push({code:'VHOST_RUNTIME_ATTESTATION_REQUIRED',message:'Declare the guarded domain HTTPS release-marker URL; config syntax is not proof of the served release'});}
  }
  return {
    schemaVersion:'production-deployment-host-check/v1',
    status:!vhost.ok?'BLOCKED':errors.length?'NEEDS_PROVISIONING':'PASS',
    ok:errors.length===0,
    projectRoot:path.resolve(root),
    privilege:plan.privilege,
    workspace:plan.workspace,
    vhost,
    target:plan.target,
    checks,
    errors,
    next:errors.length?'Run one-time host provisioning outside the deploy transaction, then repeat host-check.':'Host is ready for unprivileged release activation.'
  };
}
function deploymentStatePath(root,cfg,{create=false}={}){return resolveDerivedPath(root,`${cfg.artifactRoot}/production-state.json`,'production deployment state',{createParents:create});}
function readDeploymentState(root,cfg){const file=deploymentStatePath(root,cfg);if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeDeploymentState(root,cfg,state){const file=deploymentStatePath(root,cfg,{create:true}),tmp=`${file}.tmp-${process.pid}-${Date.now()}`;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(state,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
function targetPlan(root,cfg,manifest){
  if(cfg.target?.type!=='local-release-root')throw new Error('Production target is not configured; target.type must be local-release-root for executable deployment');
  const releaseRoot=validateAbsoluteTarget(cfg.target.releaseRoot,'deployment.target.releaseRoot'),currentLink=validateAbsoluteTarget(cfg.target.currentLink,'deployment.target.currentLink');
  const projectRoot=path.resolve(root);
  for(const [label,target] of [['deployment.target.releaseRoot',releaseRoot],['deployment.target.currentLink',currentLink]]){
    if(target===projectRoot||target.startsWith(projectRoot+path.sep))throw new Error(`${label} must stay outside the source repository`);
  }
  assertTargetPathSafe(releaseRoot,'deployment.target.releaseRoot');
  assertTargetPathSafe(path.dirname(currentLink),'deployment.target.currentLink parent');
  const releasesDir=path.join(releaseRoot,'releases');
  if(releaseRoot===currentLink||currentLink===releasesDir||currentLink.startsWith(releasesDir+path.sep))throw new Error('deployment.target.currentLink may not collide with the immutable releases directory');
  return {releaseRoot,currentLink,releasesDir,releaseDir:path.join(releasesDir,manifest.releaseId)};
}
function copyTree(src,dst){
  fs.mkdirSync(dst,{recursive:true});
  for(const name of fs.readdirSync(src).sort()){
    const s=path.join(src,name),d=path.join(dst,name),stat=fs.lstatSync(s);
    if(stat.isSymbolicLink())throw new Error(`Artifact payload contains forbidden symlink: ${s}`);
    if(stat.isDirectory())copyTree(s,d);else if(stat.isFile()){fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(s,d);}
  }
}
function installSharedLinks(cfg,releaseDir){
  for(const item of cfg.sharedLinks??[]){
    const rel=validateRelative(item.releasePath,'deployment.sharedLinks.releasePath');
    const target=validateAbsoluteTarget(item.target,'deployment.sharedLinks.target');
    if(!fs.existsSync(target))throw new Error(`Shared target missing: ${target}`);
    assertTargetPathSafe(target,'deployment.sharedLinks.target');
    const targetStat=fs.lstatSync(target);
    if(targetStat.isSymbolicLink())throw new Error(`Shared target may not be a symbolic link: ${target}`);
    const link=path.join(releaseDir,...rel.split('/'));fs.mkdirSync(path.dirname(link),{recursive:true});
    if(fs.lstatSync(link,{throwIfNoEntry:false}))throw new Error(`Shared link would overwrite artifact path: ${rel}`);
    fs.symlinkSync(target,link,targetStat.isDirectory()?'dir':'file');
  }
}
function switchCurrent(currentLink,releaseDir){
  fs.mkdirSync(path.dirname(currentLink),{recursive:true});
  let previous=null;
  if(fs.existsSync(currentLink)||fs.lstatSync(currentLink,{throwIfNoEntry:false})){
    const stat=fs.lstatSync(currentLink);
    if(!stat.isSymbolicLink())throw new Error('Production currentLink exists but is not a symlink; refusing destructive conversion');
    try{previous=fs.realpathSync(currentLink);}catch{previous=null;}
  }
  const tmp=`${currentLink}.tmp-${process.pid}-${Date.now()}`;
  fs.symlinkSync(releaseDir,tmp,'dir');
  if(process.platform==='win32'&&fs.lstatSync(currentLink,{throwIfNoEntry:false})){
    fs.rmSync(currentLink,{recursive:true,force:true});
  }
  fs.renameSync(tmp,currentLink);
  return previous;
}
async function healthCheck(cfg,{releaseDir=null}={}){
  if(!cfg.healthUrl)return {status:'NOT_CONFIGURED',ok:false,url:null,error:'deployment.healthUrl is not configured'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),cfg.healthTimeoutMs);
  try{
    const response=await fetch(cfg.healthUrl,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'AI-ExecutionKit-Deployment-Health/1'}});
    const result={status:response.ok?'PASS':'FAIL',ok:response.ok,url:cfg.healthUrl,httpStatus:response.status};
    if(result.ok&&cfg.attestationUrl){
      if(!releaseDir)throw new Error('Candidate release directory is required for HTTP attestation');
      const expected=JSON.parse(fs.readFileSync(path.join(releaseDir,'public/.well-known/executionkit-release.json'),'utf8'));
      const url=new URL(cfg.attestationUrl);url.searchParams.set('release',expected.releaseId);
      const remote=await fetch(url,{redirect:'error',signal:controller.signal,headers:{'Cache-Control':'no-cache'}}),proof=await remote.json();
      if(!remote.ok||proof.releaseId!==expected.releaseId||proof.head!==expected.head)throw new Error('Production HTTP does not serve the activated exact candidate');
      result.attestation={status:'PASS',releaseId:proof.releaseId,head:proof.head};
    }
    return result;
  }catch(error){return {status:'FAIL',ok:false,url:cfg.healthUrl,error:error.message};}
  finally{clearTimeout(timer);}
}
function requireV4ReleaseReadiness(root,manifest){
  const configFile=path.join(path.resolve(root),'execution.config.json');
  if(!fs.existsSync(configFile))return {required:false,status:'NOT_V4'};
  const projectConfig=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(!/^[45]\./.test(String(projectConfig.standardVersion??'')))return {required:false,status:'NOT_V4'};
  const rel='.executionkit/release/release-readiness.json',file=resolveDerivedPath(root,rel,'v4 release readiness');
  if(!fs.existsSync(file))throw new Error('ExecutionKit v4 production deployment requires current release orchestration readiness; run executionkit launch release . before deployment');
  let readiness;
  try{readiness=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){throw new Error('ExecutionKit v4 release readiness is invalid: '+error.message);}
  if(readiness.schemaVersion!=='executionkit-release-readiness/v1'||readiness.status!=='PASS')throw new Error('ExecutionKit v4 release readiness is not PASS');
  if(readiness.releaseId!==manifest.releaseId||readiness.commit!==manifest.repository.head)throw new Error('ExecutionKit v4 release readiness is stale or does not match the exact deployment artifact');
  if(!readiness.candidateId)throw new Error('ExecutionKit v4 release readiness is not bound to an exact candidate');
  return {required:true,status:'PASS',path:rel,candidateId:readiness.candidateId,releaseId:readiness.releaseId,commit:readiness.commit};
}
async function withDeploymentLock(root,authorized,operation){
  if(authorized!==true)throw new Error('Production deployment/rollback requires explicit authorized=true');
  const cfg=readConfig(root);
  validateRetentionPolicy(cfg.retention);
  if(cfg.target?.type!=='local-release-root')throw new Error('Production target is not configured');
  const target=validateAbsoluteTarget(cfg.target.releaseRoot,'deployment.target.releaseRoot');
  assertTargetPathSafe(target,'deployment.target.releaseRoot');
  if(pathWithin(target,path.resolve(root)))throw new Error('Production target must stay outside the source repository');
  fs.mkdirSync(target,{recursive:true});
  const unlock=acquireDeploymentLock(target);
  try{return await operation();}finally{unlock();}
}
export async function deployProductionArtifact(root,options={}){
  return withDeploymentLock(root,options.authorized,()=>deployProductionArtifactUnlocked(root,options));
}
export async function rollbackProductionDeployment(root,options={}){
  return withDeploymentLock(root,options.authorized,()=>rollbackProductionDeploymentUnlocked(root,options));
}
async function deployProductionArtifactUnlocked(root,{releaseId=null,authorized=false,prepareBackup=false}={}){
  if(authorized!==true)throw new Error('Production deployment requires explicit authorized=true');
  const cfg=readConfig(root);
  if(!Array.isArray(cfg.smokeCommands)||cfg.smokeCommands.length===0)throw new Error('Production deployment requires at least one configured smoke command');
  if(typeof cfg.healthUrl!=='string'||!cfg.healthUrl.trim())throw new Error('Production deployment requires deployment.healthUrl');
  const validation=validateProductionArtifact(root,{releaseId});
  if(!validation.ok)throw new Error(`Production artifact validation failed: ${validation.errors.map((e)=>e.code).join(', ')}`);
  const manifest=validation.manifest,releaseReadiness=requireV4ReleaseReadiness(root,manifest);
  const host=productionDeploymentHostCheck(root);
  if(!host.ok)throw new Error(`Production host is not ready for unprivileged deployment: ${host.errors.map((e)=>e.code).join(', ')}`);
  if(releaseReadiness.required)assertProviderBoundary(root,{candidate:{commit:manifest.repository.head,candidateId:releaseReadiness.candidateId,artifactSha256:providerDigest(manifest.files)},boundary:'deploy'});
  const plan=targetPlan(root,cfg,manifest),artifactDir=path.join(artifactBase(root,cfg),manifest.releaseId,'payload');
  const backup=cfg.requireBackupBeforeActivate&&prepareBackup?await prepareProductionBackup(root,cfg,manifest.repository.head,{authorized:true}):await verifyProductionBackup(cfg,manifest);
  fs.mkdirSync(plan.releasesDir,{recursive:true});
  const stage=`${plan.releaseDir}.tmp-${process.pid}-${Date.now()}`;
  if(fs.lstatSync(plan.releaseDir,{throwIfNoEntry:false}))throw new Error('Immutable production release already exists; refusing to overwrite an active or rollback release');
  let pre=[],runtimeIdentity,stagedInventory,workerRetirementBarrier;
  try{
    fs.mkdirSync(stage,{recursive:true});copyTree(artifactDir,stage);installSharedLinks(cfg,stage);
    if(manifest.stacks.includes('laravel'))fs.mkdirSync(path.join(stage,'bootstrap/cache'),{recursive:true});
    // Validate the exact copied payload before executing dependency installers or hooks.
    const copied=inventoryProductionTree(stage,{ignoreLinks:cfg.sharedLinks.map(item=>({path:item.releasePath,target:item.target}))});
    const copiedErrors=[...copied.errors,...compareProductionInventory(manifest.files,copied.files)];
    if(copiedErrors.length)throw new Error('Copied production payload failed: '+JSON.stringify(copiedErrors));
    fs.renameSync(stage,plan.releaseDir);
    // Laravel optimization embeds absolute paths: generate caches only at the final path.
    pre=runCommands(cfg.preActivateCommands,{cwd:path.resolve(root),releasePath:plan.releaseDir,label:'pre-activate command',beforeCommand:(_item,args)=>{if(manifest.stacks.includes('laravel')&&args.some(a=>path.basename(a)==='artisan'))verifyLaravelProductionRuntime(plan.releaseDir,cfg,backup);}});
    const configCache=path.join(plan.releaseDir,'bootstrap/cache/config.php');
    if(manifest.stacks.includes('laravel')&&fs.lstatSync(configCache,{throwIfNoEntry:false})?.isFile()&&!fs.lstatSync(configCache).isSymbolicLink())fs.chmodSync(configCache,0o640);
    if(cfg.attestationUrl){
      const marker=path.join(plan.releaseDir,'public/.well-known/executionkit-release.json');
      if(fs.lstatSync(marker,{throwIfNoEntry:false}))throw new Error('Source may not supply the generated deployment attestation');
      fs.mkdirSync(path.dirname(marker),{recursive:true});fs.writeFileSync(marker,JSON.stringify({releaseId:manifest.releaseId,head:manifest.repository.head})+'\n',{mode:0o644});
    }
    runtimeIdentity=manifest.stacks.includes('laravel')?verifyLaravelProductionRuntime(plan.releaseDir,cfg,backup):{status:'NOT_APPLICABLE'};
    stagedInventory=stageProductionInventory(cfg,manifest,plan.releaseDir);
    const beforeActivation=productionDeploymentHostCheck(root);
    if(!beforeActivation.ok)throw new Error('Production host drift before activation: '+beforeActivation.errors.map(e=>e.code).join(', '));
    workerRetirementBarrier=captureWorkerRetirementBarrier(cfg.retention);
    if(releaseReadiness.required)assertProviderBoundary(root,{candidate:{commit:manifest.repository.head,candidateId:releaseReadiness.candidateId,artifactSha256:providerDigest(manifest.files)},boundary:'deploy'});
  }catch(preError){
    try{if(fs.lstatSync(stage,{throwIfNoEntry:false}))fs.rmSync(stage,{recursive:true,force:true});}catch{}
    try{if(fs.lstatSync(plan.releaseDir,{throwIfNoEntry:false}))fs.rmSync(plan.releaseDir,{recursive:true,force:true});}catch{}
    throw preError;
  }
  const previous=switchCurrent(plan.currentLink,plan.releaseDir);
  let post=[],smoke=[],health,vhostAtActivation;
  try{
    post=runCommands(cfg.postActivateCommands,{cwd:path.resolve(root),releasePath:plan.releaseDir,label:'post-activate command'});
    if(fs.realpathSync(plan.currentLink)!==fs.realpathSync(plan.releaseDir))throw new Error('Production currentLink target drifted during post-activate commands');
    smoke=runCommands(cfg.smokeCommands,{cwd:path.resolve(root),releasePath:plan.releaseDir,label:'production smoke command'});
    stagedInventory=stageProductionInventory(cfg,manifest,plan.releaseDir,{dependencyBaseline:stagedInventory.files});
    health=await healthCheck(cfg,{releaseDir:plan.releaseDir});
    if(!health.ok)throw new Error(`Production health check failed: ${health.error??health.httpStatus}`);
    vhostAtActivation=productionDeploymentHostCheck(root);
    if(!vhostAtActivation.ok)throw new Error('Production vhost changed during activation: '+vhostAtActivation.errors.map(e=>e.code).join(', '));

  }catch(error){
    let rollbackFailure=null;
    if(previous&&fs.existsSync(previous)){
      switchCurrent(plan.currentLink,previous);
      try{
        runCommands(cfg.postActivateCommands,{cwd:path.resolve(root),releasePath:previous,label:'automatic rollback activation command'});
        runCommands(cfg.smokeCommands,{cwd:path.resolve(root),releasePath:previous,label:'automatic rollback smoke command'});
        const rollbackHealth=await healthCheck(cfg,{releaseDir:previous});
        if(!rollbackHealth.ok)throw new Error(`automatic rollback health verification failed: ${rollbackHealth.error??rollbackHealth.httpStatus}`);
      }catch(rollbackError){rollbackFailure=rollbackError;}
    } else {
      const currentStat=fs.lstatSync(plan.currentLink,{throwIfNoEntry:false});
      if(currentStat?.isSymbolicLink())fs.rmSync(plan.currentLink,{recursive:true,force:true});
    }
    try{if(previous!==plan.releaseDir&&fs.lstatSync(plan.releaseDir,{throwIfNoEntry:false}))fs.rmSync(plan.releaseDir,{recursive:true,force:true});}catch{}
    if(rollbackFailure)throw new Error(`${error.message}; automatic rollback activation/verification also failed: ${rollbackFailure.message}`);
    throw error;
  }
  const state={schemaVersion:'production-deployment-state/v1',status:'DEPLOYED',releaseId:manifest.releaseId,head:manifest.repository.head,releaseReadiness,vhost:vhostAtActivation.vhost,target:{type:cfg.target.type,releaseRoot:plan.releaseRoot,currentLink:plan.currentLink},releaseDir:plan.releaseDir,previousReleaseDir:previous,backup,runtimeIdentity,workerRetirementBarrier,inventory:stagedInventory,deployedAt:new Date().toISOString(),preActivate:pre,postActivate:post,smoke,health};
  writeDeploymentState(root,cfg,state);
  try{state.retention=retainSuccessfulReleases(cfg,state);}
  catch(error){state.retention={status:'FAILED',removed:[],...error.retentionResult,error:error.message};}
  try{state.artifactRetention=retainProductionArtifactCache(artifactBase(root,cfg),state,cfg.retention);}
  catch(error){state.artifactRetention={status:'FAILED',error:error.message};}
  writeDeploymentState(root,cfg,state);
  return state;
}
async function rollbackProductionDeploymentUnlocked(root,{authorized=false}={}){
  if(authorized!==true)throw new Error('Production rollback requires explicit authorized=true');
  const cfg=readConfig(root),state=readDeploymentState(root,cfg);
  if(!state?.previousReleaseDir)throw new Error('No previous production release is recorded for rollback');
  if(!fs.existsSync(state.previousReleaseDir))throw new Error('Recorded previous production release no longer exists');
  const current=validateAbsoluteTarget(cfg.target.currentLink,'deployment.target.currentLink'),rolledBackFrom=fs.realpathSync(current);
  const host=productionDeploymentHostCheck(root);
  if(!host.ok)throw new Error('Production host drift blocks rollback: '+host.errors.map(e=>e.code).join(', '));
  switchCurrent(current,state.previousReleaseDir);
  let post=[],smoke=[],health;
  try{
    post=runCommands(cfg.postActivateCommands,{cwd:path.resolve(root),releasePath:state.previousReleaseDir,label:'rollback activation command'});
    smoke=runCommands(cfg.smokeCommands,{cwd:path.resolve(root),releasePath:state.previousReleaseDir,label:'rollback smoke command'});
    health=await healthCheck(cfg,{releaseDir:state.previousReleaseDir});
    if(!health.ok)throw new Error(`Rollback health verification failed: ${health.error??health.httpStatus}`);
  }catch(error){
    switchCurrent(current,rolledBackFrom);
    try{
      runCommands(cfg.postActivateCommands,{cwd:path.resolve(root),releasePath:rolledBackFrom,label:'rollback recovery activation command'});
    }catch(recoveryError){
      throw new Error(`${error.message}; restoring the newer release activation also failed: ${recoveryError.message}`);
    }
    throw new Error(`${error.message}; restored newer release`);
  }
  const next={...state,status:'ROLLED_BACK',rolledBackAt:new Date().toISOString(),rolledBackFrom,releaseDir:state.previousReleaseDir,previousReleaseDir:rolledBackFrom,postActivate:post,smoke,health};
  writeDeploymentState(root,cfg,next);return next;
}
export function productionDeploymentStatus(root){
  const cfg=readConfig(root),state=readDeploymentState(root,cfg);
  let artifact;try{artifact=validateProductionArtifact(root);}catch(error){artifact={status:'FAIL',ok:false,errors:[{code:'ARTIFACT_STATUS_ERROR',message:error.message}]};}
  const smokeConfigured=Array.isArray(cfg.smokeCommands)&&cfg.smokeCommands.length>0;
  const smokeVerified=smokeConfigured&&Array.isArray(state?.smoke)&&state.smoke.length===cfg.smokeCommands.length&&state.smoke.every((item)=>item.exitCode===0&&!item.error);
  const healthVerified=Boolean(cfg.healthUrl)&&state?.health?.status==='PASS'&&state?.health?.ok===true;
  const exactArtifact=artifact?.ok===true&&state?.releaseId===artifact?.releaseId&&state?.head===artifact?.manifest?.repository?.head;
  const vhostRequired=Boolean(cfg.vhost)||/^[45]\./.test(String(cfg.standardVersion))&&detectStacks(sourceRootPath(root,cfg)).includes('laravel')&&cfg.target.type==='local-release-root';
  const vhostVerified=!vhostRequired||state?.vhost?.status==='PASS'&&state?.vhost?.required===true&&state?.vhost?.policyFingerprint===vhostPolicyFingerprint(cfg)&&state?.health?.attestation?.status==='PASS'&&state?.health?.attestation?.releaseId===state?.releaseId&&state?.health?.attestation?.head===state?.head;
  // A third-party raw Git/rsync copy can pollute a healthy release AFTER
  // deployment. Check only known dev/control-plane roots, not every file.
  const checkedRoot=state?.releaseDir;
  const productionPollution=[];
  if(typeof checkedRoot==='string'&&path.isAbsolute(checkedRoot)&&
     cfg.target?.type==='local-release-root'&&
     path.dirname(checkedRoot)===path.join(cfg.target.releaseRoot,'releases')&&
     fs.lstatSync(checkedRoot,{throwIfNoEntry:false})?.isDirectory()){
    for(const rel of ['.agents','.agent','.executionkit','.git','.github','docs','tests','test','node_modules','coverage','reports',
                      'public/.agents','public/.executionkit','public/.git','public/docs','public/tests','public/node_modules']){
      if(fs.lstatSync(path.join(checkedRoot,rel),{throwIfNoEntry:false}))productionPollution.push(rel);
    }
  }
  const productionPurityVerified=productionPollution.length===0;
  const productionVerified=state?.status==='DEPLOYED'&&smokeVerified&&healthVerified&&exactArtifact&&vhostVerified&&productionPurityVerified;
  return {schemaVersion:'production-deployment-status/v1',enabled:cfg.enabled,targetType:cfg.target.type,requiredForRelease:cfg.requiredForRelease,artifact,state,authority:'LAUNCH_OS',retention:state?.retention??null,retentionHealthy:state?.retention?.status==='PASS'||state?.retention?.status==='DISABLED',rollbackAvailable:Boolean(state?.previousReleaseDir&&fs.existsSync(state.previousReleaseDir)),smokeConfigured,smokeVerified,healthVerified,exactArtifact,vhostVerified,productionPurityVerified,productionPollution,productionVerified,deploymentVerdict:productionVerified?'DEPLOYED_VERIFIED':'UNVERIFIED',operationalReadiness:inspectProviderReadiness(root,{candidate:{commit:state?.head??state?.commit,candidateId:state?.releaseReadiness?.candidateId,artifactSha256:artifact?.manifest?.files?providerDigest(artifact.manifest.files):null},boundary:'certification'})};
}
export function validateProductionDeploymentReadiness(root){
  const cfg=readConfig(root),errors=[],host=productionDeploymentHostCheck(root);
  try{validateRetentionPolicy(cfg.retention);}catch(error){errors.push({code:'DEPLOYMENT_RETENTION_INVALID',message:error.message});}
  if(cfg.enabled!==true)errors.push({code:'DEPLOYMENT_DISABLED'});
  if(!Array.isArray(cfg.smokeCommands)||cfg.smokeCommands.length===0)errors.push({code:'DEPLOYMENT_SMOKE_UNCONFIGURED',message:'At least one production smoke command is required'});
  if(typeof cfg.healthUrl!=='string'||!cfg.healthUrl.trim())errors.push({code:'DEPLOYMENT_HEALTH_UNCONFIGURED',message:'deployment.healthUrl is required for production verification'});
  if(cfg.target.type!=='local-release-root')errors.push({code:'DEPLOYMENT_TARGET_UNCONFIGURED'});
  else{try{validateAbsoluteTarget(cfg.target.releaseRoot,'deployment.target.releaseRoot');validateAbsoluteTarget(cfg.target.currentLink,'deployment.target.currentLink');}catch(error){errors.push({code:'DEPLOYMENT_TARGET_INVALID',message:error.message});}}
  if(!host.ok)errors.push(...host.errors.filter((item)=>!errors.some((existing)=>existing.code===item.code)));
  let artifact;try{artifact=validateProductionArtifact(root);if(!artifact.ok)errors.push(...artifact.errors);}catch(error){errors.push({code:'ARTIFACT_VALIDATION_ERROR',message:error.message});}
  return {schemaVersion:'production-deployment-readiness/v1',status:errors.length?'FAIL':'PASS',ok:errors.length===0,errors,artifact,target:cfg.target,host};
}


