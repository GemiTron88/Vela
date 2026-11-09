import fs from 'node:fs';
import path from 'node:path';

function safeInside(root, rel) {
  if (typeof rel !== 'string' || !rel.trim() || path.isAbsolute(rel)) return null;
  const full=path.resolve(root,rel), delta=path.relative(root,full);
  return delta && !delta.startsWith('..') && !path.isAbsolute(delta) ? full : null;
}
function fileStatus(root, rel) {
  const full=safeInside(root,rel); if(!full) return {status:'UNSAFE',path:rel}; if(!fs.existsSync(full)) return {status:'MISSING',path:rel};
  if(fs.lstatSync(full).isSymbolicLink()) return {status:'UNSAFE_SYMLINK',path:rel};
  return {status:fs.statSync(full).isFile()?'PRESENT':'INVALID_TYPE',path:rel};
}
export function auditProject(inputRoot){
  const root=path.resolve(inputRoot), cfgPath=path.join(root,'execution.config.json');
  if(!fs.existsSync(cfgPath)) return {root,status:'NOT_ADOPTED'};
  try{
    const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8')), manifestRel=cfg.agent?.manifestPath??'.agents/manifest.json', manifestFile=fileStatus(root,manifestRel);
    let manifest=null, manifestError=null;
    if(manifestFile.status==='PRESENT') try{manifest=JSON.parse(fs.readFileSync(path.resolve(root,manifestRel),'utf8'));}catch(e){manifestError=e.message;}
    const sequential=cfg.runtime?.mode==='SEQUENTIAL'&&cfg.runtime?.oneLifecycleActionAtATime===true&&manifest?.delegation?.mode==='SEQUENTIAL'&&manifest?.delegation?.oneLifecycleActionAtATime===true&&!Object.hasOwn(manifest??{},'parallelism');
    const parallel=cfg.runtime?.mode==='DEPENDENCY_SAFE_PARALLEL'&&cfg.runtime?.oneLifecycleActionAtATime===false&&cfg.runtime?.parallel?.enabled===true&&cfg.runtime?.parallel?.requireExplicitParallelSafe===true&&cfg.runtime?.parallel?.requireOwnership===true&&cfg.runtime?.parallel?.isolatedWorktrees===true&&cfg.runtime?.parallel?.integrationOwner==='orchestrator'&&cfg.runtime?.parallel?.sequentialFallback===true&&cfg.runtime?.boost?.enabled===true&&cfg.runtime?.boost?.command==='/boost'&&cfg.runtime?.boost?.qualityGatesPreserved===true&&manifest?.delegation?.mode==='DEPENDENCY_SAFE_PARALLEL'&&manifest?.delegation?.oneLifecycleActionAtATime===false&&manifest?.delegation?.requireExplicitParallelSafe===true&&manifest?.delegation?.requireOwnership===true&&manifest?.delegation?.isolatedWorktrees===true&&manifest?.delegation?.integrationOwner==='role.orchestrator'&&manifest?.delegation?.sequentialFallback===true&&manifest?.delegation?.boostCommand==='/boost'&&manifest?.delegation?.qualityGatesPreserved===true&&!Object.hasOwn(manifest??{},'parallelism');
    const runtimeRoot=['.executionkit/runtime/kit','.executionkit/runtime/AI-ExecutionKit'].includes(cfg.installation?.runtimePath) ? path.join(root,cfg.installation.runtimePath) : root;
    const tooling={runtime:fs.existsSync(path.join(runtimeRoot,'lib/runtime-orchestrator.mjs')),parallel:fs.existsSync(path.join(runtimeRoot,'lib/parallel-execution.mjs')),boost:fs.existsSync(path.join(runtimeRoot,'bin/boost.mjs')),discovery:fs.existsSync(path.join(runtimeRoot,'lib/discovery-model.mjs')),evidence:fs.existsSync(path.join(runtimeRoot,'lib/evidence-model.mjs')),policy:fs.existsSync(path.join(runtimeRoot,'bin/validate-v22-policy.mjs')),derivedIgnore:fs.existsSync(path.join(root,'.executionkit/.gitignore'))};
    const status=manifestFile.status==='PRESENT'&&!manifestError?'ADOPTED':'DEGRADED';
    return {root,status,standardVersion:cfg.standardVersion??null,projectState:cfg.projectState??null,agentManifest:manifestFile,agentSchemaVersion:manifest?.schemaVersion??null,runtimeMode:cfg.runtime?.mode??null,sequentialOnly:sequential,dependencySafeParallel:parallel,qualityConfigured:Boolean(cfg.quality),antigravityConfigured:Boolean(cfg.editors?.antigravity),discoveryRequiredForRelease:cfg.discovery?.requiredForRelease===true,candidateRequiredForRelease:cfg.evidence?.candidateRequiredForRelease===true,tooling,manifestError};
  }catch(e){return{root,status:'INVALID_CONFIG',error:e.message};}
}
export function auditFleet(roots){return roots.map((r)=>auditProject(r));}
export function planFleetUpgrade(audit,targetVersion,{kitRoot}={}){
  const targetMajor=String(targetVersion??'').split('.')[0];
  const migrator=kitRoot?path.join(path.resolve(kitRoot),'bin',targetMajor==='2'?'migrate-v2.mjs':'migrate-current.mjs'):null;
  return audit.map((item)=>{
    const runtimeReady=targetMajor==='2'?item.sequentialOnly===true:item.dependencySafeParallel===true;
    const toolingReady=Object.values(item.tooling??{}).every(Boolean);
    const action=item.status==='NOT_ADOPTED'||item.status==='INVALID_CONFIG'?'INSPECT':item.standardVersion===targetVersion&&runtimeReady&&toolingReady?'NONE':'MIGRATE';
    return {...item,action,command:action==='MIGRATE'&&migrator?`node ${JSON.stringify(migrator)} --target ${JSON.stringify(item.root)}`:null,targetVersion};
  });
}
