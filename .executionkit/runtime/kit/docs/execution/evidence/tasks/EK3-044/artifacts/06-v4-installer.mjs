import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bindV4TaskAuthority, buildV4ProjectConfig, discoverLegacyAgentAdapters, legacyPluginDisablePlan, mergeAgentManifestV4, prepareAgentManifestV4, reconcileAgentsBootV4, reconcileHooksV4, reconcileRootGitignoreV4, V4_RUNTIME_PATH, V4_STANDARD_TARGET } from './v4-upgrade-transform.mjs';
import { validateAgentLayer } from './agent-model.mjs';
import { DERIVED_IGNORE_CONTENT, INSTALLED_IGNORE_CONTENT } from './derived-state.mjs';
import { doctorInstallation } from './installer.mjs';
import { planTodoMaintenance, todoMaintenanceStatus } from './todo-maintenance.mjs';
import { canonicalState, declaredAuditBoundary, declaredExecutionAction, extractDependencies, parseTaskBlocks, stateIsTerminal } from './execution-model.mjs';
import { parseTodoShardManifest, renderTodoShardManifest } from './todo-shards.mjs';
import { validateV4SystemRuntimeSurfaces } from './v4-systems-status.mjs';
import { detectVisualSurfaces } from './visual-os.mjs';
import { validateV4Policy } from './v4-config.mjs';
import { classifyV4Maturity } from './v4-maturity.mjs';
import { renderAntigravityV4Rule, validateAntigravityV4 } from './antigravity-v4.mjs';
import { inspectV4ControlPlane } from './v4-control-plane.mjs';
import { inspectV4Platform, verifyArtifactIntegrity } from './v4-platform.mjs';
import { UPGRADE_REVALIDATION_STATUS_REL, upgradeRevalidationStatus } from './v4-upgrade-revalidation-status.mjs';
import { buildV4InvariantManifest, diffV4InvariantManifests, planV4InvariantRevalidation } from './v4-invariant-registry.mjs';

const RECEIPT='.executionkit/installation.json';
const JOURNALS='.executionkit/v4-installer';
const MANAGED_CONTROL_PLANE_WORKFLOW='.github/workflows/executionkit-v4.yml';
const MANAGED_CONTROL_PLANE_MARKER='EXECUTIONKIT_V4_MANAGED_WORKFLOW';
const LEGACY_PINNED_RUNTIME='.executionkit/runtime/AI-ExecutionKit';
const LEGACY_CANONICAL_REPOSITORY='https://github.com/Elwazeery/AI-ExcutionKit.git';
const ROOT_FILES=['README.md','PLAYBOOK.md','STANDARD.md','STANDARD_V3.md','STANDARD_V4.md'];
const ROOT_DIRS=['bin','lib','schemas','templates','docs','contracts'];
const EXCLUDED_RUNTIME=new Set([
  'bin/mcp-server.mjs',
  'bin/host-mcp-server.mjs',
  'bin/adapter-dart-mcp.mjs',
  'bin/setup-tooling.mjs',
  'bin/integrate-antigravity.mjs',
  'bin/antigravity-hook.mjs',
  'bin/bootstrap-host.mjs',
  'bin/export-bootstrap.mjs',
  'bin/executionkit-agent.mjs',
  'bin/agent-doctor.mjs',
  'bin/activate-project.mjs',
  'bin/adopt-project.mjs',
  'bin/archive-todo.mjs',
  'bin/boost.mjs',
  'bin/coordinate-agents.mjs',
  'bin/execute-loop.mjs',
  'bin/executionkit.mjs',
  'bin/init-project.mjs',
  'bin/materialize-native-authority.mjs',
  'bin/migrate-current.mjs',
  'bin/migrate-documentation-deployment.mjs',
  'bin/migrate-premium-experience.mjs',
  'bin/migrate-seo-os.mjs',
  'bin/migrate-state-os.mjs',
  'bin/migrate-v2-base.mjs',
  'bin/migrate-v2.mjs',
  'bin/migrate-v3.mjs',
  'bin/next-execution.mjs',
  'bin/next-readiness.mjs',
  'bin/reconcile-agent-contract.mjs',
  'bin/reconcile-product.mjs',
  'bin/refresh-projection-with-integration.mjs',
  'bin/resolve-task-context.mjs',
  'bin/runtime-cancel.mjs',
  'bin/runtime-recover.mjs',
  'bin/runtime-status.mjs',
  'bin/fleet-audit.mjs',
  'bin/fleet-plan-upgrade.mjs',
  'bin/fleet-report.mjs',
  'lib/executionkit-agent.mjs',
  'lib/executionkit-agent-v3.mjs',
  'lib/agent-inspection.mjs',
  'lib/agent-pulse.mjs',
  'schemas/agent-telemetry.schema.json',
  'schemas/agent-telemetry-ack.schema.json',
  'templates/.agents/skills/dart-mcp/SKILL.md',
]);
const V4_RUNTIME_SCRIPTS=Object.freeze({
  'antigravity:v4':'node bin/integrate-antigravity-v4.mjs . --apply',
  'v4:start':'node bin/executionkit-cli.mjs start .',
  'v4:status':'node bin/executionkit-cli.mjs status .',
  'v4:doctor':'node bin/executionkit-cli.mjs doctor .',
  'v4:systems':'node bin/executionkit-cli.mjs systems status .',
  'v4:product':'node bin/executionkit-cli.mjs product status .',
  'v4:visual':'node bin/executionkit-cli.mjs visual validate .',
  'v4:reconcile':'node bin/executionkit-cli.mjs reconcile task .',
  'v4:wave':'node bin/executionkit-cli.mjs boundary wave .',
  'v4:phase':'node bin/executionkit-cli.mjs boundary phase .',
  'v4:activation':'node bin/executionkit-cli.mjs activation status .',
  'v4:control-plane':'node bin/executionkit-cli.mjs control-plane status .',
  'v4:platform':'node bin/executionkit-cli.mjs platform status .',
  'db:status':'node bin/executionkit-cli.mjs db status .',
  'db:refresh':'node bin/executionkit-cli.mjs db refresh .',
  'db:guard':'node bin/executionkit-cli.mjs db guard . --all',
  'todo:status':'node bin/executionkit-cli.mjs todo status .',
  'todo:maintain':'node bin/executionkit-cli.mjs todo maintain . --apply',
  'upgrade-revalidation:status':'node bin/executionkit-cli.mjs upgrade-revalidation status .',
  'upgrade-revalidation:run':'node bin/executionkit-cli.mjs upgrade-revalidation run .',
  'release:run':'node bin/executionkit-cli.mjs launch release .',
  'release:deploy':'node bin/executionkit-cli.mjs launch deploy . --authorize',
  'deploy:apply':'node bin/executionkit-cli.mjs launch deploy . --authorize',
  'deploy:rollback':'node bin/executionkit-cli.mjs launch rollback . --authorize',
});
const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');

function normalize(value){return String(value).split(path.sep).join('/');}
function relSafe(rel){
  if(typeof rel!=='string'||!rel||path.isAbsolute(rel)||rel.includes('\\')||rel.split('/').some((p)=>!p||p==='.'||p==='..'))throw new Error('Unsafe v4 install path: '+String(rel));
  return rel;
}
function targetPath(root,rel){
  relSafe(rel);
  const full=path.resolve(root,rel);
  const delta=path.relative(root,full);
  if(delta.startsWith('..')||path.isAbsolute(delta))throw new Error('v4 install path escapes project: '+rel);
  let cursor=root;
  for(const part of rel.split('/').slice(0,-1)){
    cursor=path.join(cursor,part);
    if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw new Error('v4 install path traverses symlink: '+rel);
  }
  if(fs.existsSync(full)&&fs.lstatSync(full).isSymbolicLink())throw new Error('v4 install target may not be a symlink: '+rel);
  return full;
}
function runnerSlug(value){return String(value??'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^[-._]+|[-._]+$/g,'');}
function projectRunnerLabel(root){
  const slug=runnerSlug(path.basename(path.resolve(root)));
  if(!slug)throw new Error('Unable to derive project self-hosted runner label from target path');
  return 'project-'+slug;
}

function gitResult(root,args,{allowFailure=false}={}){
  const result=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,windowsHide:true,shell:false});
  if(!allowFailure&&result.status!==0)throw new Error(String(result.stderr||result.stdout||result.error?.message||'Git command failed').trim());
  return result;
}
function gitlinkInfo(root,rel){
  const probe=gitResult(root,['rev-parse','--is-inside-work-tree'],{allowFailure:true});
  if(probe.status!==0)return null;
  const result=gitResult(root,['ls-files','--stage','--',rel],{allowFailure:true});
  if(result.status!==0)return null;
  const line=String(result.stdout??'').trim();
  if(!line)return null;
  const match=line.match(/^160000\s+([a-f0-9]{40})\s+\d+\t(.+)$/i);
  return match&&normalize(match[2])===rel?{sha:match[1].toLowerCase(),path:rel}:null;
}
function stripLegacySubmoduleSection(text){
  const source=String(text??'');
  const sections=source.split(/(?=^\[submodule\s+"[^"]+"\]\s*$)/m);
  let found=false,canonical=false;
  const kept=[];
  for(const section of sections){
    if(!section.trim())continue;
    if(!/^\[submodule\s+"/m.test(section)){kept.push(section);continue;}
    const pathMatch=section.match(/^\s*path\s*=\s*(.+?)\s*$/m);
    if(pathMatch?.[1]?.trim()!==LEGACY_PINNED_RUNTIME){kept.push(section);continue;}
    found=true;
    const url=section.match(/^\s*url\s*=\s*(.+?)\s*$/m)?.[1]?.trim()??'';
    canonical=url===LEGACY_CANONICAL_REPOSITORY||url==='git@github.com:Elwazeery/AI-ExcutionKit.git';
    if(!canonical)kept.push(section);
  }
  return {found,canonical,content:kept.join('').trim()?kept.join('').replace(/^\n+/,'').trimEnd()+'\n':''};
}
function inspectLegacyPinnedRuntime(root){
  const gitlink=gitlinkInfo(root,LEGACY_PINNED_RUNTIME);
  const modules=existingText(root,'.gitmodules');
  const section=stripLegacySubmoduleSection(modules);
  const runtimeFull=path.join(root,...LEGACY_PINNED_RUNTIME.split('/'));
  const runtimeExists=fs.existsSync(runtimeFull);
  if(!gitlink&&!section.found&&!runtimeExists)return {status:'ABSENT',required:false};
  if(runtimeExists&&!gitlink&&!section.found)return {status:'BLOCKED',required:true,reason:'Legacy ExecutionKit runtime path exists without a canonical tracked gitlink; explicit reconciliation is required',gitlink,section,runtimeExists};
  if(section.found&&!section.canonical)return {status:'BLOCKED',required:true,reason:'Legacy ExecutionKit submodule uses an unknown repository URL',gitlink,section,runtimeExists};
  if(gitlink&&!section.found)return {status:'BLOCKED',required:true,reason:'Legacy ExecutionKit gitlink exists without its canonical .gitmodules section',gitlink,section,runtimeExists};
  if(section.found&&!gitlink)return {status:'BLOCKED',required:true,reason:'Legacy ExecutionKit .gitmodules section exists without a tracked gitlink',gitlink,section,runtimeExists};
  return {status:'MIGRATE',required:true,gitlink,section,runtimeExists};
}
function readMaybe(file){return fs.existsSync(file)?fs.readFileSync(file):null;}
function modeMaybe(file){return fs.existsSync(file)?(fs.statSync(file).mode&0o777):null;}
function hashMaybe(file){const data=readMaybe(file);return data===null?null:sha(data);}
function gitStatus(root,{excludeManagedSource=false}={}){
  const probe=spawnSync('git',['-C',root,'rev-parse','--is-inside-work-tree'],{encoding:'utf8'});
  if(probe.status!==0)return {isGit:false,dirty:false,head:null,porcelain:''};
  const args=['-C',root,'status','--porcelain=v1','--untracked-files=all'];
  if(excludeManagedSource)args.push('--','.',':(exclude).executionkit/source/AI-ExecutionKit',':(exclude).executionkit/source/AI-ExecutionKit/**');
  const status=spawnSync('git',args,{encoding:'utf8'});
  const head=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  const porcelain=String(status.stdout??'').trim();
  return {isGit:true,dirty:Boolean(porcelain),head:head.status===0?String(head.stdout).trim():null,porcelain};
}
function walkSource(base,dir,rootPrefix,out){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw new Error('v4 distribution may not contain symlink: '+normalize(path.relative(base,full)));
    const rel=normalize(path.join(rootPrefix,entry.name));
    if(entry.isDirectory())walkSource(base,full,rel,out);
    else if(entry.isFile()&&!EXCLUDED_RUNTIME.has(rel))out.push({path:rel,content:fs.readFileSync(full),mode:fs.statSync(full).mode&0o777});
  }
}
function runtimeDistribution(source){
  const entries=[];
  for(const rel of ROOT_FILES){const full=path.join(source,rel);if(fs.existsSync(full))entries.push({path:rel,content:fs.readFileSync(full),mode:fs.statSync(full).mode&0o777});}
  for(const rel of ROOT_DIRS)walkSource(source,path.join(source,rel),rel,entries);
  const pkgPath=path.join(source,'package.json');
  if(!fs.existsSync(pkgPath))throw new Error('v4 source package.json missing');
  const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
  pkg.version=V4_STANDARD_TARGET;
  pkg.description='AI ExecutionKit v4 CLI-first ten-system runtime';
  if(pkg.dependencies){delete pkg.dependencies['@modelcontextprotocol/server'];if(!Object.keys(pkg.dependencies).length)delete pkg.dependencies;}
  pkg.scripts={...V4_RUNTIME_SCRIPTS};
  const encoded=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
  const index=entries.findIndex((e)=>e.path==='package.json');
  if(index>=0)entries[index]={path:'package.json',content:encoded,mode:0o644};else entries.push({path:'package.json',content:encoded,mode:0o644});
  entries.push({path:'VERSION',content:Buffer.from(V4_STANDARD_TARGET+'\n'),mode:0o644});
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  return entries;
}
function validateSource(source){
  const required=[
    'STANDARD_V4.md',
    'bin/executionkit-cli.mjs',
    'bin/antigravity-v4-hook.mjs',
    'bin/audit-project.mjs',
    'bin/production-deployment.mjs',
    'bin/documentation-fabric.mjs',
    'lib/v4-kernel.mjs',
    'lib/v4-cli-contract.mjs',
    'lib/database-integrity.mjs',
    'lib/antigravity-v4.mjs',
    'bin/integrate-antigravity-v4.mjs',
    'lib/v4-installer.mjs',
    'lib/v4-source.mjs',
    'lib/v4-maturity.mjs',
    'lib/v4-control-plane.mjs',
    'lib/v4-platform.mjs',
    'lib/portable-process.mjs',
    'lib/bounded-process.mjs',
    'bin/bounded-process-runner.mjs',
    'lib/v4-knowledge-runtime.mjs',
    'lib/repository-provider-deployment.mjs',
    'lib/execution-model.mjs',
    'lib/todo-maintenance.mjs',
    'lib/v4-boundary.mjs',
    'lib/v4-activation.mjs',
    'lib/v4-gate-identity.mjs',
    'lib/v4-product-closure.mjs',
    'lib/v4-agent-runtime.mjs',
    'lib/v4-test-os.mjs',
    'lib/v4-content-os.mjs',
    'lib/v4-seo-os.mjs',
    'lib/v4-reconcile.mjs',
    'lib/v4-audit-evidence.mjs',
    'lib/v4-release-gates.mjs',
    'lib/v4-systems-status.mjs',
    'lib/v4-invariant-registry.mjs',
    'lib/v4-upgrade-revalidation.mjs',
    'lib/v4-upgrade-revalidation-status.mjs',
    'lib/visual-os.mjs',
    'lib/state-model.mjs',
    'lib/documentation-fabric.mjs',
    'lib/production-deployment.mjs',
    'templates/AGENTS_V4.md',
    'templates/execution.config.v4.json',
    'templates/github/executionkit-v4.yml',
    'schemas/execution-config-v4.schema.json'
  ];
  for(const rel of required)if(!fs.existsSync(path.join(source,rel)))throw new Error('v4 source missing required runtime file: '+rel);
}
function writeSpec(root,rel,content,mode=0o644){
  const full=targetPath(root,rel),before=hashMaybe(full),buffer=Buffer.isBuffer(content)?content:Buffer.from(content),after=sha(buffer),beforeMode=modeMaybe(full);
  const modeMatches=process.platform==='win32'||beforeMode===null||beforeMode===mode;
  if(before===after&&modeMatches)return null;
  return {path:rel,before,after,content:buffer.toString('base64'),mode,beforeMode};
}
function deleteSpec(root,rel){
  const full=targetPath(root,rel);
  if(!fs.existsSync(full))return null;
  if(!fs.statSync(full).isFile())throw new Error('v4 managed delete target is not a file: '+rel);
  return {path:rel,before:hashMaybe(full),after:null,content:null,mode:null,beforeMode:modeMaybe(full)};
}
function existingJson(root,rel){const file=targetPath(root,rel);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;}
function existingText(root,rel){const file=targetPath(root,rel);return fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';}
function isRecognizedManagedAntigravityV4Rule(content){
  const normalized=String(content??'').replaceAll('\r\n','\n');
  return normalized.startsWith('# ExecutionKit v4 Antigravity entry\n')
    &&normalized.includes('executionkit-cli.mjs start . --host antigravity')
    &&normalized.includes('v4 is CLI-first and MCP-free')
    &&normalized.includes('No restart/reopen step is part of the v4 lifecycle')
    &&normalized.includes('legacy per-device ExecutionKit Agent');
}
function starterAuthority(src,name,nextConfig){
  const file=path.join(src,'templates',name);
  if(!fs.existsSync(file))throw new Error('v4 source authority template missing: '+name);
  if(name!=='executionkit.seo.json')return fs.readFileSync(file);
  const seo=JSON.parse(fs.readFileSync(file,'utf8'));
  if(nextConfig.capabilities?.seo==='NONE'){
    seo.applicability='DISABLED';
    seo.applicabilityRationale='Project execution config declares SEO capability NONE. Re-enable and reconcile this contract if public indexable web surfaces are introduced.';
    seo.profile='NONE';
    seo.modes=[];
    seo.surfaceFamilies=[];
  }else{
    seo.profile=nextConfig.capabilities?.seo??'STANDARD';
  }
  return Buffer.from(JSON.stringify(seo,null,2)+'\n');
}


function replaceTaskBlock(markdown,taskId,mutator){
  const re=new RegExp('(<!--\\s*TASK:'+taskId+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  const match=String(markdown).match(re);if(!match)throw new Error('Canonical task block not found during v4 migration: '+taskId);
  return String(markdown).replace(match[1],mutator(match[1]));
}
function setTaskDepends(block,dependencies){
  const value=dependencies.length?dependencies.join(', '):'NONE';
  if(/^- Depends:/m.test(block))return block.replace(/^- Depends:\s*.*$/m,'- Depends: '+value);
  return block.replace(/^- Priority:.*$/m,(line)=>line+'\n- Depends: '+value);
}
function taskBlockRaw(markdown,taskId){
  const re=new RegExp('(<!--\\s*TASK:'+taskId+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  return String(markdown).match(re)?.[1]??null;
}
function cancelLegacyIntegrationTask(block){
  let out=block.replace(/^- Status:\s*.*$/m,'- Status: CANCELLED');
  if(/^- Reason:/m.test(out))out=out.replace(/^- Reason:\s*.*$/m,'- Reason: Superseded by the v4 EK4 runtime-first deep-integration authority.');
  else out=out.replace(/^- Evidence:.*$/m,(line)=>line+'\n- Reason: Superseded by the v4 EK4 runtime-first deep-integration authority.');
  if(!/^- Reason:/m.test(out))out=out.replace(/<!--\s*\/TASK\s*-->/,'- Reason: Superseded by the v4 EK4 runtime-first deep-integration authority.\n<!-- /TASK -->');
  return out;
}
function cancelLegacyReleaseGate(block){
  let out=block.replace(/^- Status:\s*.*$/m,'- Status: CANCELLED');
  if(/^- Reason:/m.test(out))out=out.replace(/^- Reason:\s*.*$/m,'- Reason: Superseded by v4 runtime exact-candidate Test/Audit/Launch release gates.');
  else out=out.replace(/^- Evidence:.*$/m,(line)=>line+'\n- Reason: Superseded by v4 runtime exact-candidate Test/Audit/Launch release gates.');
  if(!/^- Reason:/m.test(out))out=out.replace(/<!--\s*\/TASK\s*-->/,'- Reason: Superseded by v4 runtime exact-candidate Test/Audit/Launch release gates.\n<!-- /TASK -->');
  return out;
}
function planV4TodoUpgrade(root,src,nextConfig,existingConfig){
  const result={writes:new Map(),deletes:new Set(),conflicts:[],summary:{migrated:false,ek4Injected:false,activationDependencies:0,legacyReleaseGateCancelled:false}};
  const manifestRel=nextConfig.todoPath??'TODO.md',manifestFull=targetPath(root,manifestRel);
  if(!fs.existsSync(manifestFull))return result;
  let maintenance;
  try{maintenance=planTodoMaintenance(root,nextConfig);}
  catch(error){result.conflicts.push({code:'V4_TODO_MIGRATION_BLOCKED',path:manifestRel,message:error.message});return result;}
  for(const [rel,content] of maintenance.writes??[])result.writes.set(rel,content);
  for(const rel of maintenance.deletes??[])result.deletes.add(rel);
  result.summary.migrated=maintenance.summary?.migrated===true;

  const virtual=(rel)=>result.writes.has(rel)?String(result.writes.get(rel)):existingText(root,rel);
  let manifest=virtual(manifestRel),parsed=parseTodoShardManifest(manifest,manifestRel);
  if(parsed.errors.length||parsed.status!=='CURRENT'){result.conflicts.push({code:'V4_TODO_MANIFEST_INVALID_AFTER_MIGRATION',path:manifestRel,message:(parsed.errors[0]?.message??'Sharded TODO manifest unavailable after migration')});return result;}

  const integrationPhase='EK4',shardRoot=nextConfig.todoAuthority?.shardRoot??'todo';
  const gateId=String(nextConfig.adoption?.integrationGateTaskId??'EK4-AUDIT').trim();
  const activationId=String(nextConfig.adoption?.integrationActivationTaskId??'EK4-ACTIVATE').trim();
  const suffix='EK4-AUDIT';
  const integrationPrefix=gateId.endsWith(suffix)?gateId.slice(0,-suffix.length):'';
  const firstIntegrationId=integrationPrefix+'EK4-001';
  let integrationEntry=parsed.entries.find((entry)=>entry.phase===integrationPhase);
  const archiveDir=path.join(root,shardRoot,'archive',integrationPhase);
  const archiveText=(()=>{
    try{
      if(fs.existsSync(archiveDir)){
        return fs.readdirSync(archiveDir).map((f)=>fs.readFileSync(path.join(archiveDir,f),'utf8')).join('\n');
      }
    }catch{}
    return '';
  })();
  const isArchived=Boolean(archiveText&&archiveText.includes('TASK:'+activationId));

  if(!integrationEntry && !isArchived){
    const rel=normalize(path.posix.join(shardRoot,'EK4.md')),existing=virtual(rel);
    if(existing&&existing.trim()){result.conflicts.push({code:'V4_EK4_SHARD_COLLISION',path:rel,message:'Reserved EK4 integration shard path already exists outside the TODO manifest'});return result;}
    integrationEntry={phase:integrationPhase,path:rel,order:0};
    const templateFile=path.join(src,'templates/todo/EK4.md');
    if(!fs.existsSync(templateFile)){result.conflicts.push({code:'V4_EK4_TEMPLATE_MISSING',path:'templates/todo/EK4.md',message:'v4 integration TODO template missing'});return result;}
    let integrationTemplate=fs.readFileSync(templateFile,'utf8');
    if(integrationPrefix)integrationTemplate=integrationTemplate.replace(/\bEK4-/g,integrationPrefix+'EK4-');
    result.writes.set(rel,integrationTemplate);
    parsed={...parsed,entries:[integrationEntry,...parsed.entries].map((entry,index)=>({...entry,order:index}))};
    result.writes.set(manifestRel,renderTodoShardManifest(parsed.entries));
    result.summary.ek4Injected=true;
  }else if(integrationEntry){
    const text=virtual(integrationEntry.path);
    const allIntegrationText=text+'\n'+archiveText;
    for(const id of [firstIntegrationId,gateId,activationId])if(!allIntegrationText.includes('TASK:'+id))result.conflicts.push({code:'V4_EK4_PHASE_COLLISION',path:integrationEntry.path,message:'Existing EK4 phase is not the configured v4 integration phase; missing '+id});
    if(result.conflicts.length)return result;
  }

  const legacyReleaseGateId=String(existingConfig.integration?.systemReleaseGateTaskId??'REL-AUDIT').trim();
  const allTasks=[];
  for(const entry of parsed.entries){
    const text=virtual(entry.path),parsedTasks=parseTaskBlocks(text,entry.path);
    if(parsedTasks.errors.length){result.conflicts.push(...parsedTasks.errors.map((issue)=>({code:'V4_TODO_TASK_PARSE_ERROR',path:entry.path,message:issue.message})));continue;}
    for(const task of parsedTasks.tasks)allTasks.push({...task,phase:entry.phase});
  }
  if(result.conflicts.length)return result;

  const legacyIntegrationPhase=String(existingConfig.adoption?.integrationPhase??'EK00').trim();
  const legacyActivationId=String(existingConfig.adoption?.integrationActivationTaskId??'EK00-ACTIVATE').trim();
  const legacyIntegrationTasks=legacyIntegrationPhase&&legacyIntegrationPhase!=='EK4'
    ? allTasks.filter((task)=>task.phase===legacyIntegrationPhase&&!stateIsTerminal(task,nextConfig))
    : [];
  if(legacyIntegrationTasks.length){
    const legacyIds=new Set(legacyIntegrationTasks.map((task)=>task.id));
    const externalDependents=allTasks.filter((task)=>{
      if(task.phase===legacyIntegrationPhase||stateIsTerminal(task,nextConfig))return false;
      return extractDependencies(task).some((dep)=>legacyIds.has(dep)&&dep!==legacyActivationId);
    });
    if(externalDependents.length){
      result.conflicts.push({
        code:'V4_LEGACY_INTEGRATION_DEPENDENTS',
        path:manifestRel,
        message:'Open tasks depend directly on superseded '+legacyIntegrationPhase+' tasks other than '+legacyActivationId+': '+externalDependents.map((x)=>x.id).join(', ')
      });
      return result;
    }
  }

  const legacy=allTasks.find((task)=>task.id===legacyReleaseGateId&&!stateIsTerminal(task,nextConfig)&&declaredExecutionAction(task)==='audit'&&declaredAuditBoundary(task)==='release');
  if(legacy){
    const dependents=allTasks.filter((task)=>task.id!==legacy.id&&!stateIsTerminal(task,nextConfig)&&extractDependencies(task).includes(legacy.id));
    if(dependents.length){
      result.conflicts.push({code:'V4_LEGACY_RELEASE_GATE_DEPENDENTS',path:legacy.sourcePath,message:'Legacy release audit gate has open dependents and cannot be cancelled safely: '+dependents.map((x)=>x.id).join(', ')});
      return result;
    }
  }

  const byPath=new Map(),removeActiveEntries=new Set();

  if(legacyIntegrationTasks.length){
    const archivedBlocks=[];
    for(const task of legacyIntegrationTasks){
      const rel=task.sourcePath,current=byPath.get(rel)??virtual(rel),raw=taskBlockRaw(current,task.id);
      if(!raw)throw new Error('Legacy integration task block missing during v4 migration: '+task.id);
      archivedBlocks.push(cancelLegacyIntegrationTask(raw));
      const without=current.replace(raw,'').replace(/\n{3,}/g,'\n\n').trimEnd()+'\n';
      byPath.set(rel,without);
      if(parseTaskBlocks(without,rel).tasks.length===0)removeActiveEntries.add(rel);
    }
    const archiveRoot=nextConfig.todoAuthority?.archiveRoot??'todo/archive';
    const archiveRel=normalize(path.posix.join(archiveRoot,legacyIntegrationPhase,'v4-superseded-deep-integration.md'));
    const existingArchive=virtual(archiveRel);
    if(existingArchive&&existingArchive.trim()&&!legacyIntegrationTasks.every((task)=>existingArchive.includes('TASK:'+task.id))){
      result.conflicts.push({code:'V4_LEGACY_INTEGRATION_ARCHIVE_COLLISION',path:archiveRel,message:'Legacy integration archive target already contains unrelated content'});
      return result;
    }
    result.writes.set(archiveRel,'# Superseded v3 deep-integration archive\n\nTerminal history only. v4 deep integration is owned by EK4.\n\n'+archivedBlocks.join('\n\n')+'\n');
    result.summary.legacyIntegrationArchived=legacyIntegrationTasks.map((task)=>task.id);
    result.summary.legacyIntegrationArchive=archiveRel;
  }

  for(const task of allTasks){
    if(task.phase===integrationPhase||task.phase===legacyIntegrationPhase||stateIsTerminal(task,nextConfig))continue;
    const rel=task.sourcePath,current=byPath.get(rel)??virtual(rel);
    if(task.id===legacyReleaseGateId&&declaredExecutionAction(task)==='audit'&&declaredAuditBoundary(task)==='release'){
      const raw=taskBlockRaw(current,task.id);if(!raw)throw new Error('Legacy release gate block missing during v4 migration: '+task.id);
      const cancelled=cancelLegacyReleaseGate(raw),without=current.replace(raw,'').replace(/\n{3,}/g,'\n\n').trimEnd()+'\n';
      const archiveRoot=nextConfig.todoAuthority?.archiveRoot??'todo/archive',archiveRel=normalize(path.posix.join(archiveRoot,String(task.meta?.Phase??task.phase??'LEGACY'),'v4-legacy-release-gate.md'));
      const existingArchive=virtual(archiveRel);
      if(existingArchive&&existingArchive.trim()&&!existingArchive.includes('TASK:'+task.id)){result.conflicts.push({code:'V4_LEGACY_RELEASE_ARCHIVE_COLLISION',path:archiveRel,message:'Legacy release archive target already contains unrelated content'});return result;}
      result.writes.set(archiveRel,'# Legacy v3 release-gate archive\n\nTerminal history only. v4 release truth is the runtime exact-candidate gate set.\n\n'+cancelled+'\n');
      byPath.set(rel,without);result.summary.legacyReleaseGateCancelled=true;result.summary.legacyReleaseGateArchive=archiveRel;
      if(parseTaskBlocks(without,rel).tasks.length===0)removeActiveEntries.add(rel);
      continue;
    }
    const activation=nextConfig.adoption?.integrationActivationTaskId??'EK4-ACTIVATE';
    const deps=extractDependencies(task).filter((dep)=>dep!==legacyActivationId);
    const nextDeps=[...new Set([...deps,activation])];
    if(JSON.stringify(nextDeps)===JSON.stringify(extractDependencies(task)))continue;
    const updated=replaceTaskBlock(current,task.id,(block)=>setTaskDepends(block,nextDeps));
    byPath.set(rel,updated);result.summary.activationDependencies++;
  }
  if(removeActiveEntries.size){
    parsed.entries=parsed.entries.filter((entry)=>!removeActiveEntries.has(entry.path)).map((entry,index)=>({...entry,order:index}));
    result.writes.set(manifestRel,renderTodoShardManifest(parsed.entries));
    for(const rel of removeActiveEntries){result.writes.delete(rel);result.deletes.add(rel);byPath.delete(rel);}
  }
  for(const [rel,content] of byPath)result.writes.set(rel,content);
  return result;
}

export function inspectV4Installation(root){
  root=path.resolve(root);
  const config=existingJson(root,'execution.config.json');
  const receipt=existingJson(root,RECEIPT);
  const maturity=classifyV4Maturity(root);
  const legacyPinned=inspectLegacyPinnedRuntime(root);
  const isPinnedSubmodule=legacyPinned.status==='MIGRATE'||Boolean(legacyPinned.gitlink);
  const installed=(receipt?.schemaVersion==='executionkit-v4-install/v1')||isPinnedSubmodule;
  return {root,git:gitStatus(root),configVersion:config?.standardVersion??null,installed,receipt,maturity};
}

function updatePreflightBlockers(doctor){
  const hardCodes=new Set(['V4_RECEIPT_INVALID','V4_RUNTIME_DRIFT']);
  return (doctor?.errors??[]).filter((issue)=>hardCodes.has(issue.code));
}

export function planV4Installation(target,{source,operation='auto',sourceCommit=null}={}){
  const root=path.resolve(target),src=path.resolve(source??'.');
  validateSource(src);
  let resolvedSourceCommit = sourceCommit;
  if(!resolvedSourceCommit){
    const probe = spawnSync('git',['-C',src,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
    if(probe.status===0&&/^[a-f0-9]{40}$/.test(String(probe.stdout).trim())){
      resolvedSourceCommit = String(probe.stdout).trim();
    } else if(/^[a-f0-9]{40}$/.test(path.basename(src))){
      resolvedSourceCommit = path.basename(src);
    }
  }
  const inspection=inspectV4Installation(root);
  const existingConfig=existingJson(root,'execution.config.json')??{};
  const detected=!inspection.configVersion?'install':/^4\./.test(inspection.configVersion)?'update':'upgrade';
  const mode=operation==='auto'?detected:operation;
  if(!['install','update','upgrade','repair'].includes(mode))throw new Error('Unsupported v4 installation operation: '+mode);
  if(mode==='install'&&inspection.configVersion)throw new Error('install requested for an already configured project; use upgrade/update');
  if(mode==='update'&&!/^4\./.test(String(inspection.configVersion??'')))throw new Error('update requires an existing v4 project');
  if(mode==='upgrade'&&(!inspection.configVersion||/^4\./.test(inspection.configVersion)))throw new Error('upgrade requires a pre-v4 configured project');
  if(mode==='repair'&&(!inspection.installed||!/^4\./.test(String(inspection.configVersion??''))))throw new Error('repair requires an existing installed v4 project');

  const distribution=runtimeDistribution(src);
  const runtimeManifest=distribution.map((e)=>({path:e.path,sha256:sha(e.content),mode:e.mode}));
  const sourceHash=sha(Buffer.from(JSON.stringify(runtimeManifest)));
  const writes=[],deletes=[],conflicts=[];
  const legacyRuntime=mode==='upgrade'?inspectLegacyPinnedRuntime(root):{status:'ABSENT',required:false};
  if(legacyRuntime.status==='BLOCKED')conflicts.push({code:'V4_LEGACY_PINNED_RUNTIME_BLOCKED',path:LEGACY_PINNED_RUNTIME,message:legacyRuntime.reason});
  if(mode==='update'&&inspection.installed){
    const currentDoctor=doctorV4Installation(root,{checkProviderTooling:false}),hard=updatePreflightBlockers(currentDoctor);
    if(hard.length)conflicts.push({code:'V4_EXISTING_INSTALLATION_DRIFT',path:V4_RUNTIME_PATH,message:'Existing managed v4 runtime/receipt is drifted; run repair or reconcile before update',errors:hard});
  }
  if(mode==='upgrade'&&inspection.receipt?.schemaVersion==='executionkit-install/v1'){
    const legacyDoctor=doctorInstallation(root);
    if(legacyDoctor.status!=='INSTALLED')conflicts.push({code:'V4_LEGACY_RUNTIME_DRIFT',path:inspection.receipt.runtime??V4_RUNTIME_PATH,message:'Legacy v3 runtime is drifted; reconcile before major upgrade',details:legacyDoctor});
  }
  const put=(rel,content,modeBits=0o644)=>{const spec=writeSpec(root,rel,content,modeBits);if(spec)writes.push(spec);};
  const del=(rel)=>{const spec=deleteSpec(root,rel);if(spec)deletes.push(spec);};

  for(const entry of distribution)put(V4_RUNTIME_PATH+'/'+entry.path,entry.content,entry.mode);
  const existingRuntime=path.join(root,V4_RUNTIME_PATH);
  if(fs.existsSync(existingRuntime)){
    const current=[];walkSource(existingRuntime,existingRuntime,'',current);
    const wanted=new Set(runtimeManifest.map((e)=>e.path));
    for(const item of current){const rel=item.path.replace(/^\/+/, '');if(rel&&!wanted.has(rel))del(V4_RUNTIME_PATH+'/'+rel);}
  }
  for(const rel of EXCLUDED_RUNTIME)del(V4_RUNTIME_PATH+'/'+rel);

  if(legacyRuntime.status==='MIGRATE'){
    if(legacyRuntime.section.content)put('.gitmodules',legacyRuntime.section.content);
    else del('.gitmodules');
  }

  const template=JSON.parse(fs.readFileSync(path.join(src,'templates/execution.config.v4.json'),'utf8'));
  const baseTemplate=JSON.parse(fs.readFileSync(path.join(src,'templates/execution.config.json'),'utf8'));
  const nextConfig=buildV4ProjectConfig(template,existingConfig,V4_RUNTIME_PATH,baseTemplate,{projectRunnerLabel:projectRunnerLabel(root)});
  const preserveMaturity=existingConfig.adoption?.maturityEvidence&&existingConfig.adoption?.maturityProfile===inspection.maturity.profile;
  nextConfig.adoption={
    ...(nextConfig.adoption??{}),
    maturityProfile:inspection.maturity.profile,
    maturityRationale:[...inspection.maturity.rationale],
    maturityEvidence:preserveMaturity?existingConfig.adoption.maturityEvidence:{
      classifier:inspection.maturity.schemaVersion,
      rank:inspection.maturity.rank,
      ...inspection.maturity.evidence,
    },
  };
  const visualDiscovery=detectVisualSurfaces(root);
  if(existingConfig.quality)nextConfig.quality={...existingConfig.quality};
  else if(visualDiscovery.uiBearing)nextConfig.quality={contractPath:'quality.contract.json'};
  else delete nextConfig.quality;
  put('execution.config.json',JSON.stringify(nextConfig,null,2)+'\n');
  const workflowTemplate=fs.readFileSync(path.join(src,'templates/github/executionkit-v4.yml'),'utf8');
  const managedWorkflow=workflowTemplate.replaceAll('[PROJECT_RUNNER_LABEL]',nextConfig.ci.projectRunnerLabel);
  const existingWorkflow=existingText(root,MANAGED_CONTROL_PLANE_WORKFLOW);
  if(existingWorkflow&& !existingWorkflow.includes(MANAGED_CONTROL_PLANE_MARKER)){
    conflicts.push({code:'V4_CONTROL_PLANE_WORKFLOW_COLLISION',path:MANAGED_CONTROL_PLANE_WORKFLOW,message:'Reserved v4 GitHub control-plane workflow path contains unmanaged content; explicit reconciliation is required'});
  }else{
    put(MANAGED_CONTROL_PLANE_WORKFLOW,managedWorkflow);
  }
  if(fs.existsSync(targetPath(root,nextConfig.todoPath??'TODO.md'))){
    const todoUpgrade=planV4TodoUpgrade(root,src,nextConfig,existingConfig);
    conflicts.push(...todoUpgrade.conflicts);
    if(!todoUpgrade.conflicts.length){
      for(const [rel,content] of todoUpgrade.writes)put(rel,content);
      for(const rel of todoUpgrade.deletes)del(rel);
    }
  }
  const authorityStarters=[
    'executionkit.scope.json',
    'executionkit.integration.json',
    'executionkit.adapters.json',
    'quality.contract.json',
    'executionkit.components.json',
    'executionkit.design.json',
    'executionkit.seo.json',
  ];
  for(const rel of authorityStarters)if(!fs.existsSync(targetPath(root,rel)))put(rel,starterAuthority(src,rel,nextConfig));
  put('.gitignore',reconcileRootGitignoreV4(existingText(root,'.gitignore')));
  const agentsSource=existingText(root,'AGENTS.md')||fs.readFileSync(path.join(src,'templates/AGENTS_V4.md'),'utf8');
  put('AGENTS.md',reconcileAgentsBootV4(agentsSource,V4_RUNTIME_PATH));
  if(!fs.existsSync(targetPath(root,'TODO.md'))){
    put('TODO.md',fs.readFileSync(path.join(src,'templates/TODO_V4.md'),'utf8').replaceAll('\r\n','\n'));
    const freshTodoRoot=path.join(src,'templates/todo');
    if(fs.existsSync(freshTodoRoot)){
      const todoEntries=[];walkSource(freshTodoRoot,freshTodoRoot,'todo',todoEntries);
      for(const entry of todoEntries){
        const text=Buffer.isBuffer(entry.content)?entry.content.toString('utf8'):String(entry.content);
        put(entry.path,text.replaceAll('\r\n','\n'),entry.mode);
      }
    }
  }

  const hooks=reconcileHooksV4(existingJson(root,'.agents/hooks.json')??{},V4_RUNTIME_PATH);
  put('.agents/hooks.json',JSON.stringify(hooks,null,2)+'\n');
  const antigravityRuleRel='.agents/rules/executionkit-v4.md',expectedAntigravityRule=renderAntigravityV4Rule(nextConfig),existingAntigravityRule=existingText(root,antigravityRuleRel);
  if(existingAntigravityRule&&existingAntigravityRule.replaceAll('\r\n','\n')!==expectedAntigravityRule&&!inspection.installed&&!isRecognizedManagedAntigravityV4Rule(existingAntigravityRule)){
    conflicts.push({code:'V4_ANTIGRAVITY_RULE_COLLISION',path:antigravityRuleRel,message:'Reserved v4 Antigravity rule path already contains native/unmanaged content; explicit reconciliation is required'});
  }else put(antigravityRuleRel,expectedAntigravityRule);

  const manifestPath=nextConfig.agent?.manifestPath??'.agents/manifest.json';
  const templateManifestPath=path.join(src,'templates/.agents/manifest.json');
  if(!fs.existsSync(templateManifestPath))conflicts.push({code:'V4_AGENT_TEMPLATE_MISSING',path:manifestPath,message:'v4 source agent manifest template missing'});
  else {
    const rawTemplateManifest=JSON.parse(fs.readFileSync(templateManifestPath,'utf8'));
    const preparedTemplate=prepareAgentManifestV4(rawTemplateManifest);
    const templateManifest=bindV4TaskAuthority(preparedTemplate.manifest,nextConfig);
    const existingManifest=existingJson(root,manifestPath);
    let boundManifest=null;
    if(existingManifest){
      const migrated=mergeAgentManifestV4(existingManifest,templateManifest);
      boundManifest=bindV4TaskAuthority(migrated.manifest,nextConfig);
      put(manifestPath,JSON.stringify(boundManifest,null,2)+'\n');
      for(const rel of migrated.deletePaths)del(rel);
    } else {
      const nativeAgents=fs.existsSync(path.join(root,'.agents'))&&fs.readdirSync(path.join(root,'.agents')).some((name)=>name!=='hooks.json');
      if(nativeAgents)conflicts.push({code:'V4_NATIVE_AGENT_MANIFEST_REQUIRED',path:manifestPath,message:'Native .agents content exists without a manifest; explicit reconciliation is required'});
      else put(manifestPath,JSON.stringify(templateManifest,null,2)+'\n');
      for(const rel of preparedTemplate.deletePaths)del(rel);
    }
    const agentEntries=[];
    walkSource(path.join(src,'templates/.agents'),path.join(src,'templates/.agents'),'.agents',agentEntries);
    const activeManifest=boundManifest??existingManifest??templateManifest;
    const registeredPaths=new Set(Object.values(activeManifest.resources??{}).flatMap((items)=>Array.isArray(items)?items.map((x)=>x.path):[]));
    for(const entry of agentEntries){
      if(['.agents/manifest.json','.agents/hooks.json','.agents/rules/executionkit-v4.md','.agents/skills/dart-mcp/SKILL.md'].includes(entry.path))continue;
      const target=targetPath(root,entry.path);
      if(!fs.existsSync(target))put(entry.path,entry.content,entry.mode);
      else if(hashMaybe(target)!==sha(entry.content)&&!registeredPaths.has(entry.path))conflicts.push({code:'V4_AGENT_RESOURCE_COLLISION',path:entry.path,message:'Unregistered native file collides with a v4 Agent OS resource'});
    }
  }

  for(const rel of discoverLegacyAgentAdapters(root))del(rel);
  for(const rel of legacyPluginDisablePlan(root))del(rel);

  const ignorePath=targetPath(root,'.executionkit/.gitignore');
  if(!fs.existsSync(ignorePath))put('.executionkit/.gitignore',INSTALLED_IGNORE_CONTENT);
  else {
    const ignore=fs.readFileSync(ignorePath,'utf8').replaceAll('\r\n','\n');
    if(ignore===DERIVED_IGNORE_CONTENT)put('.executionkit/.gitignore',INSTALLED_IGNORE_CONTENT);
    else if(ignore!==INSTALLED_IGNORE_CONTENT){
      conflicts.push({code:'V4_DERIVED_IGNORE_POLICY_CONFLICT',path:'.executionkit/.gitignore',message:'Custom .executionkit ignore policy must match the canonical v4 installed-runtime/receipt tracking contract'});
    }
  }

  const invariantManifest=buildV4InvariantManifest(runtimeManifest);
  const invariantDelta=diffV4InvariantManifests(inspection.receipt?.invariantManifest??null,invariantManifest);
  const acceptedHistoryCount=Number(inspection.maturity?.evidence?.tasks?.terminalTaskCount??0);
  const releaseHistory=inspection.maturity?.profile==='M4_PRODUCTION'||inspection.maturity?.evidence?.tasks?.releaseSignal===true||inspection.maturity?.evidence?.production?.verified===true;
  const invariantPlan=planV4InvariantRevalidation(invariantDelta,{acceptedHistoryCount,releaseHistory});
  const priorRevalidation=existingJson(root,UPGRADE_REVALIDATION_STATUS_REL);
  const carriedPending=priorRevalidation?.required===true&&!['PASS','NOT_REQUIRED'].includes(priorRevalidation.status);
  const requiredChecks=[...new Set([...(carriedPending?(priorRevalidation.requiredChecks??[]):[]),...invariantPlan.requiredChecks])];
  const invariantIds=[...new Set([...(carriedPending?(priorRevalidation.invariantIds??[]):[]),...invariantPlan.invariantIds])];
  const revalidationRequired=requiredChecks.length>0;
  const unchangedCertified=!invariantDelta.changed.length&&['PASS','NOT_REQUIRED'].includes(priorRevalidation?.status);
  const upgradeRevalidation=unchangedCertified
    ? {...priorRevalidation,currentInvariantFingerprint:invariantManifest.fingerprint}
    : revalidationRequired
      ? {
          schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
          required:true,
          status:'PENDING',
          reason:carriedPending?'CARRIED_PENDING_AND_INVARIANT_DELTA':inspection.receipt?.invariantManifest?'INVARIANT_DELTA':'INVARIANT_BASELINE_MISSING',
          previousInvariantFingerprint:inspection.receipt?.invariantManifest?.fingerprint??null,
          currentInvariantFingerprint:invariantManifest.fingerprint,
          invariantIds,
          requiredChecks,
          maxCost:invariantPlan.maxCost,
          acceptedHistoryCount,
          releaseHistory,
        }
      : {
          schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
          required:false,
          status:'NOT_REQUIRED',
          reason:invariantDelta.changed.length?'NO_APPLICABLE_PROJECT_HISTORY':'NO_INVARIANT_CHANGE',
          previousInvariantFingerprint:inspection.receipt?.invariantManifest?.fingerprint??null,
          currentInvariantFingerprint:invariantManifest.fingerprint,
          invariantIds:[],
          requiredChecks:[],
          maxCost:'NONE',
          acceptedHistoryCount,
          releaseHistory,
        };
  const receipt={schemaVersion:'executionkit-v4-install/v1',version:V4_STANDARD_TARGET,runtime:V4_RUNTIME_PATH,sourceHash,sourceCommit:resolvedSourceCommit??null,maturityProfile:inspection.maturity.profile,runtimeManifest,invariantManifest};
  put(RECEIPT,JSON.stringify(receipt,null,2)+'\n');
  put(UPGRADE_REVALIDATION_STATUS_REL,JSON.stringify(upgradeRevalidation,null,2)+'\n');

  const legacyRuntimePlan=legacyRuntime.status==='MIGRATE'?{path:LEGACY_PINNED_RUNTIME,gitlinkSha:legacyRuntime.gitlink.sha,repository:LEGACY_CANONICAL_REPOSITORY,wasInitialized:legacyRuntime.runtimeExists,backupRoot:JOURNALS+'/legacy-runtime'}:null;
  const planCore={schemaVersion:'executionkit-v4-install-plan/v1',target:root,source:src,sourceCommit:resolvedSourceCommit??null,operation:mode,sourceHash,runtimePath:V4_RUNTIME_PATH,maturity:inspection.maturity,inspection,legacyRuntime:legacyRuntimePlan,invariantDelta,invariantPlan,upgradeRevalidation,conflicts,writes:writes.map(({content,...rest})=>rest),deletes:deletes.map(({content,...rest})=>rest)};
  const id=sha(Buffer.from(JSON.stringify(planCore)));
  return {...planCore,id,_writes:writes,_deletes:deletes};
}

export function summarizeV4Plan(plan){
  return {schemaVersion:plan.schemaVersion,planId:plan.id,status:plan.conflicts.length?'CONFLICT':(plan.writes.length||plan.deletes.length)?'PLANNED':'UP_TO_DATE',operation:plan.operation,target:plan.target,runtimePath:plan.runtimePath,sourceHash:plan.sourceHash,maturity:plan.maturity,upgradeRevalidation:plan.upgradeRevalidation,invariantDelta:{changedIds:plan.invariantDelta?.changedIds??[],requiredChecks:plan.invariantPlan?.requiredChecks??[],maxCost:plan.invariantPlan?.maxCost??'NONE'},changes:[...plan.writes.map((x)=>({path:x.path,operation:x.before?'update':'create'})),...plan.deletes.map((x)=>({path:x.path,operation:'delete'}))],conflicts:plan.conflicts,integrationAcceptance:'NOT_CLAIMED'};
}

function atomicWrite(file,data,mode){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  const fd=fs.openSync(tmp,'wx',mode??0o644);
  try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(tmp,file);
}

export function applyV4Installation(plan,{expectedPlanId=null,allowDirty=false}={}){
  if(expectedPlanId&&expectedPlanId!==plan.id)throw new Error('v4 plan changed; inspect the fresh plan');
  if(plan.conflicts.length)throw new Error('v4 installation conflicts: '+JSON.stringify(plan.conflicts));
  const applyGit=gitStatus(plan.target,{excludeManagedSource:true});
  if(applyGit.isGit&&applyGit.dirty&&!allowDirty)throw new Error('Dirty worktree: commit/stash work or pass --allow-dirty after reviewing the plan');
  if(!plan._writes.length&&!plan._deletes.length)return {status:'UP_TO_DATE',operation:plan.operation,planId:plan.id,runtimePath:plan.runtimePath};
  const current=inspectV4Installation(plan.target);
  for(const spec of [...plan._writes,...plan._deletes])if(hashMaybe(targetPath(plan.target,spec.path))!==spec.before)throw new Error('Stale v4 planned file: '+spec.path);
  const lock=targetPath(plan.target,JOURNALS+'/lock.json');
  fs.mkdirSync(path.dirname(lock),{recursive:true});
  const fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({planId:plan.id,pid:process.pid,host:os.hostname()}));fs.closeSync(fd);
  const journalFile=targetPath(plan.target,JOURNALS+'/'+plan.id+'.json');
  const all=[...plan._writes,...plan._deletes];
  const legacyRuntime=plan.legacyRuntime??null;
  const legacyBackupRel=legacyRuntime?legacyRuntime.backupRoot+'/'+plan.id:null;
  const legacyBackup=legacyBackupRel?targetPath(plan.target,legacyBackupRel):null;
  const journal={schemaVersion:'executionkit-v4-install-transaction/v1',id:plan.id,status:'APPLYING',operation:plan.operation,legacyRuntime:legacyRuntime?{...legacyRuntime,backupRel:legacyBackupRel}:null,files:all.map((spec)=>{const file=targetPath(plan.target,spec.path);const prior=readMaybe(file);return {path:spec.path,before:spec.before,after:spec.after,previous:prior===null?null:prior.toString('base64'),previousMode:modeMaybe(file)};})};
  atomicWrite(journalFile,Buffer.from(JSON.stringify(journal,null,2)+'\n'),0o600);
  try{
    if(legacyRuntime){
      const current=gitlinkInfo(plan.target,legacyRuntime.path);
      if(!current||current.sha!==legacyRuntime.gitlinkSha)throw new Error('Legacy ExecutionKit gitlink changed after planning');
      const active=targetPath(plan.target,legacyRuntime.path);
      if(Boolean(fs.existsSync(active))!==Boolean(legacyRuntime.wasInitialized))throw new Error('Legacy ExecutionKit submodule initialization state changed after planning');
      if(legacyRuntime.wasInitialized&&(!fs.lstatSync(active).isDirectory()||fs.lstatSync(active).isSymbolicLink()))throw new Error('Legacy ExecutionKit submodule working tree is unsafe');
      if(fs.existsSync(legacyBackup))throw new Error('Legacy ExecutionKit migration backup path already exists');
      if(legacyRuntime.wasInitialized)fs.mkdirSync(path.dirname(legacyBackup),{recursive:true});
      const removed=gitResult(plan.target,['rm','--cached','-f','--',legacyRuntime.path],{allowFailure:true});
      if(removed.status!==0)throw new Error('Cannot detach legacy ExecutionKit gitlink: '+String(removed.stderr||removed.stdout||'').trim());
      if(legacyRuntime.wasInitialized)fs.renameSync(active,legacyBackup);
    }
    for(const spec of plan._writes){const file=targetPath(plan.target,spec.path);atomicWrite(file,Buffer.from(spec.content,'base64'),spec.mode);}
    for(const spec of plan._deletes){
      const file=targetPath(plan.target,spec.path);
      if(fs.existsSync(file)){
        fs.rmSync(file,{force:true});
        const parent=path.dirname(file);
        try{
          if(fs.existsSync(parent)&&fs.readdirSync(parent).length===0){
            fs.rmdirSync(parent);
          }
        }catch{}
      }
    }
    journal.status='APPLIED';journal.appliedAt=new Date().toISOString();atomicWrite(journalFile,Buffer.from(JSON.stringify(journal,null,2)+'\n'),0o600);
    fs.rmSync(lock,{force:true});
    return {
      status:'INSTALLED',
      operation:plan.operation,
      planId:plan.id,
      transaction:plan.id,
      runtimePath:plan.runtimePath,
      providerTooling:'REMOVED',
      integration:'PENDING',
      upgradeRevalidation:plan.upgradeRevalidation,
      next:plan.upgradeRevalidation?.required?'Run executionkit upgrade-revalidation run . before normal product execution, then doctor/host/integration gates.':'Run executionkit doctor, prove Antigravity host observation, then complete the canonical v4 integration gate before product execution.'
    };
  }catch(error){
    try{rollbackV4Installation(plan.target,plan.id);}catch(rollbackError){throw new Error(error.message+'; rollback failed: '+rollbackError.message);}
    throw error;
  }
}

export function rollbackV4Installation(target,id){
  const root=path.resolve(target),journalFile=targetPath(root,JOURNALS+'/'+id+'.json');
  if(!fs.existsSync(journalFile))throw new Error('v4 transaction journal not found: '+id);
  const journal=JSON.parse(fs.readFileSync(journalFile,'utf8'));
  if(journal.schemaVersion!=='executionkit-v4-install-transaction/v1'||journal.id!==id)throw new Error('Invalid v4 transaction journal');
  for(const item of [...journal.files].reverse()){
    const file=targetPath(root,item.path),actual=hashMaybe(file);
    if(actual!==item.after&&actual!==item.before)throw new Error('Rollback would overwrite later work: '+item.path);
    if(item.previous===null)fs.rmSync(file,{force:true});
    else atomicWrite(file,Buffer.from(item.previous,'base64'),item.previousMode??0o644);
  }
  if(journal.legacyRuntime){
    const active=targetPath(root,journal.legacyRuntime.path);
    const backup=targetPath(root,journal.legacyRuntime.backupRel);
    const activeExists=fs.existsSync(active),backupExists=fs.existsSync(backup);
    if(journal.legacyRuntime.wasInitialized){
      if(activeExists&&backupExists)throw new Error('Rollback found both active and backup legacy runtime paths');
      if(!activeExists){
        if(!backupExists||!fs.lstatSync(backup).isDirectory())throw new Error('Legacy runtime rollback backup is missing');
        fs.mkdirSync(path.dirname(active),{recursive:true});
        fs.renameSync(backup,active);
      }
    }else if(activeExists||backupExists){
      throw new Error('Rollback found unexpected legacy runtime bytes for an originally uninitialized submodule');
    }
    const restored=gitResult(root,['update-index','--add','--cacheinfo',`160000,${journal.legacyRuntime.gitlinkSha},${journal.legacyRuntime.path}`],{allowFailure:true});
    if(restored.status!==0)throw new Error('Could not restore legacy ExecutionKit gitlink during rollback: '+String(restored.stderr||restored.stdout||'').trim());
    gitResult(root,['restore','--staged','--','.gitmodules'],{allowFailure:true});
  }
  journal.status='ROLLED_BACK';journal.rolledBackAt=new Date().toISOString();atomicWrite(journalFile,Buffer.from(JSON.stringify(journal,null,2)+'\n'),0o600);
  const lock=targetPath(root,JOURNALS+'/lock.json');if(fs.existsSync(lock))fs.rmSync(lock,{force:true});
  return {status:'ROLLED_BACK',transaction:id};
}

export function doctorV4Installation(target,{checkProviderTooling=true,checkUpgradeRevalidation=true}={}){
  const root=path.resolve(target),receipt=existingJson(root,RECEIPT),errors=[];
  const legacyPinned=inspectLegacyPinnedRuntime(root);
  const isPinnedSubmodule=legacyPinned.status==='MIGRATE'||Boolean(legacyPinned.gitlink);
  if(!receipt&&!isPinnedSubmodule)return {status:'NOT_INSTALLED',errors:[{code:'V4_RECEIPT_MISSING',message:'v4 receipt missing'}]};
  if(receipt&&receipt.schemaVersion!=='executionkit-v4-install/v1')errors.push({code:'V4_RECEIPT_INVALID',message:'unsupported v4 receipt schema'});
  if(checkUpgradeRevalidation){const revalidation=upgradeRevalidationStatus(root);if(revalidation.blocking)errors.push({code:'V4_UPGRADE_REVALIDATION_REQUIRED',message:'ExecutionKit upgrade changed enforcement invariants; mandatory scoped revalidation is not yet certified',details:revalidation});}
  const runtimeRel=receipt?.runtime??(isPinnedSubmodule?LEGACY_PINNED_RUNTIME:V4_RUNTIME_PATH);
  const runtimeFull=targetPath(root,runtimeRel);
  if(receipt?.runtimeManifest){
    for(const entry of receipt.runtimeManifest){
      const file=path.join(runtimeFull,entry.path);
      if(hashMaybe(file)!==entry.sha256)errors.push({code:'V4_RUNTIME_DRIFT',path:entry.path,message:'runtime hash mismatch'});
    }
  }
  if(runtimeRel!==LEGACY_PINNED_RUNTIME){
    for(const rel of EXCLUDED_RUNTIME)if(fs.existsSync(targetPath(root,runtimeRel+'/'+rel)))errors.push({code:'V4_LEGACY_HOST_RUNTIME_PRESENT',path:rel,message:'Legacy v3 host/MCP/bootstrap runtime file is forbidden in installed v4'});
    if(legacyPinned.status!=='ABSENT')errors.push({code:'V4_LEGACY_PINNED_RUNTIME_PRESENT',path:LEGACY_PINNED_RUNTIME,message:'legacy pinned ExecutionKit submodule/gitlink remains active after v4 installation'});
  }
  const systemRuntime=validateV4SystemRuntimeSurfaces(runtimeFull);
  errors.push(...systemRuntime.errors);
  const pkg=existingJson(root,runtimeRel+'/package.json');
  if(runtimeRel!==LEGACY_PINNED_RUNTIME){
    if(pkg?.dependencies?.['@modelcontextprotocol/server'])errors.push({code:'V4_MCP_DEPENDENCY_PRESENT',message:'MCP package dependency is forbidden in v4 runtime'});
    const actualScripts=pkg?.scripts??{};
    for(const [key,command] of Object.entries(V4_RUNTIME_SCRIPTS)){
      if(actualScripts[key]!==command)errors.push({code:'V4_RUNTIME_SCRIPT_MISSING_OR_DRIFTED',script:key,message:'Installed v4 runtime script is missing or differs from the canonical CLI-first command'});
    }
    for(const key of Object.keys(actualScripts)){
      if(!(key in V4_RUNTIME_SCRIPTS))errors.push({code:'V4_RUNTIME_SCRIPT_UNEXPECTED',script:key,message:'Installed v4 runtime exposes an unexpected npm script outside the canonical runtime allowlist'});
    }
    if(pkg?.scripts?.['antigravity:v4']!=='node bin/integrate-antigravity-v4.mjs . --apply')errors.push({code:'V4_ANTIGRAVITY_V4_SCRIPT_MISSING',message:'Installed v4 runtime must expose the MCP-free Antigravity v4 integration script'});
  }
  const providerTooling={status:'REMOVED',ok:true,providers:[],receipt:null,errors:[],mode:'NATIVE_ONLY'};
  const providerPlan={status:'REMOVED',mode:'NATIVE_ONLY',actions:[]};
  const config=existingJson(root,'execution.config.json');
  const projectWorkflow=existingText(root,MANAGED_CONTROL_PLANE_WORKFLOW);
  if(!projectWorkflow.includes(MANAGED_CONTROL_PLANE_MARKER))errors.push({code:'V4_CONTROL_PLANE_WORKFLOW_MISSING',path:MANAGED_CONTROL_PLANE_WORKFLOW,message:'Managed v4 GitHub control-plane workflow is missing'});
  else if(config?.ci?.projectRunnerLabel&&!projectWorkflow.includes(config.ci.projectRunnerLabel))errors.push({code:'V4_CONTROL_PLANE_WORKFLOW_RUNNER_LABEL_MISMATCH',path:MANAGED_CONTROL_PLANE_WORKFLOW,message:'Managed control-plane workflow does not target the configured project-specific runner label'});
  if(!/^4\./.test(String(config?.standardVersion??''))||config?.v4?.mcp!==false)errors.push({code:'V4_CONFIG_INVALID',message:'project is not configured for MCP-free v4'});
  if(config){
    const policy=validateV4Policy(config);
    for(const issue of policy.errors??[])errors.push({...issue,code:'V4_POLICY_'+issue.code,message:issue.message});
  }
  if(config&&config.todoAuthority?.mode==='sharded'){
    const todoMaintenance=todoMaintenanceStatus(root,config);
    if(todoMaintenance.needed)errors.push({code:'V4_TODO_MAINTENANCE_REQUIRED',message:'Sharded TODO authority requires migration/archive/split maintenance',details:todoMaintenance});
  }
  const manifestPath=config?.agent?.manifestPath??'.agents/manifest.json';
  const agentManifest=existingJson(root,manifestPath);
  if(!agentManifest)errors.push({code:'V4_AGENT_MANIFEST_MISSING',path:manifestPath,message:'v4 Agent OS manifest is missing'});
  else{
    if(agentManifest.standardVersion!==config?.standardVersion)errors.push({code:'V4_AGENT_MANIFEST_VERSION_MISMATCH',message:'Agent manifest standardVersion differs from execution config'});
    if(JSON.stringify(agentManifest).includes('skill.dart-mcp'))errors.push({code:'V4_AGENT_MCP_RESOURCE_PRESENT',message:'MCP-specific Agent OS resource is forbidden in v4'});
    if(config){
      const agentLayer=validateAgentLayer(root,config);
      for(const issue of agentLayer.errors??[])errors.push({...issue,code:'V4_DOCTOR_'+issue.code,message:issue.message});
    }
  }
  for(const rel of discoverLegacyAgentAdapters(root)){
    errors.push({code:'V4_LEGACY_AGENT_ADAPTER_PRESENT',path:rel,message:'Legacy ExecutionKit host adapter file must be retired in v4: '+rel});
  }
  if(fs.existsSync(targetPath(root,'.agents/skills/dart-mcp/SKILL.md')))errors.push({code:'V4_AGENT_MCP_FILE_PRESENT',path:'.agents/skills/dart-mcp/SKILL.md',message:'MCP-specific Agent skill file is forbidden in v4'});
  const qualityContractRel=config?.quality?.contractPath??'quality.contract.json';
  const integrationContractRel=config?.integration?.journeyContractPath??'executionkit.integration.json';
  for(const rel of ['executionkit.scope.json',integrationContractRel,'executionkit.adapters.json',qualityContractRel,'executionkit.components.json','executionkit.design.json','executionkit.seo.json']){
    if(!fs.existsSync(targetPath(root,rel)))errors.push({code:'V4_PROJECT_AUTHORITY_MISSING',path:rel,message:'Required v4 project authority is missing: '+rel});
  }
  const agents=existingText(root,'AGENTS.md');if(!agents.includes('EXECUTIONKIT_V4_BOOT_CONTRACT'))errors.push({code:'V4_AGENTS_BOOT_MISSING',message:'AGENTS.md v4 boot contract missing'});
  const hooks=existingJson(root,'.agents/hooks.json')??{};if(!hooks['executionkit-v4-kernel'])errors.push({code:'V4_ANTIGRAVITY_HOOK_MISSING',message:'v4 Antigravity hook missing'});
  if(config){
    const antigravity=validateAntigravityV4(root,config);
    for(const issue of antigravity.errors??[])errors.push({...issue,code:'V4_DOCTOR_'+issue.code,message:issue.message});
    const controlPlane=inspectV4ControlPlane(root);
    if(controlPlane.status==='FAIL')for(const issue of controlPlane.errors??[])errors.push({...issue,code:'V4_DOCTOR_'+issue.code,message:issue.message});
    const platform=inspectV4Platform(root);
    if(platform.status==='FAIL')for(const issue of platform.errors??[])errors.push({...issue,code:'V4_DOCTOR_'+issue.code,message:issue.message});
  }
  for(const rel of ['.agents/plugins/executionkit/plugin.json','.agents/plugins/executionkit/mcp_config.json'])if(fs.existsSync(targetPath(root,rel)))errors.push({code:'V4_LEGACY_PLUGIN_ACTIVE',path:rel,message:'legacy Antigravity plugin/MCP surface is still active'});
  if(runtimeRel!==LEGACY_PINNED_RUNTIME&&legacyPinned.status!=='ABSENT')errors.push({code:'V4_LEGACY_PINNED_RUNTIME_PRESENT',path:LEGACY_PINNED_RUNTIME,message:'legacy pinned ExecutionKit submodule/gitlink remains active after v4 installation'});
  const gitProbe=spawnSync('git',['-C',root,'rev-parse','--is-inside-work-tree'],{encoding:'utf8'});
  if(gitProbe.status===0){
    const runtimeIgnored=spawnSync('git',['-C',root,'check-ignore','-q',runtimeRel+'/VERSION']);
    const receiptIgnored=spawnSync('git',['-C',root,'check-ignore','-q','.executionkit/installation.json']);
    const revalidationIgnored=spawnSync('git',['-C',root,'check-ignore','-q',UPGRADE_REVALIDATION_STATUS_REL]);
    if(runtimeRel!==LEGACY_PINNED_RUNTIME&&runtimeIgnored.status===0)errors.push({code:'V4_RUNTIME_PARENT_GIT_IGNORED',message:'Managed v4 runtime is ignored by parent Git; remove conflicting root ignore rules'});
    if(receipt&&receiptIgnored.status===0)errors.push({code:'V4_RECEIPT_PARENT_GIT_IGNORED',message:'v4 installation receipt is ignored by parent Git; remove conflicting root ignore rules'});
    if(fs.existsSync(targetPath(root,UPGRADE_REVALIDATION_STATUS_REL))&&revalidationIgnored.status===0)errors.push({code:'V4_UPGRADE_REVALIDATION_RECEIPT_IGNORED',message:'compact upgrade-revalidation receipt is ignored by parent Git; remove conflicting root ignore rules'});
  }

  const binaryIdentityFile=targetPath(root,'.executionkit/bin/artifact-identity.json');
  const binaryFile=targetPath(root,'.executionkit/bin/'+(process.platform==='win32'?'executionkit.exe':'executionkit'));
  if(fs.existsSync(binaryFile)){
    let expected=null;
    if(fs.existsSync(binaryIdentityFile)){
      try{expected=JSON.parse(fs.readFileSync(binaryIdentityFile,'utf8'));}catch{}
    }
    const binaryCheck=verifyArtifactIntegrity(binaryFile,expected);
    if(!binaryCheck.valid){
      errors.push({code:'V4_BINARY_'+binaryCheck.code,path:'.executionkit/bin',message:binaryCheck.message});
    }
  }

  return {status:errors.length?'BLOCKED':'INSTALLED',version:receipt?.version??V4_STANDARD_TARGET,runtimePath:runtimeRel,sourceHash:receipt?.sourceHash??'pinned-submodule',sourceCommit:receipt?.sourceCommit??null,systemRuntime,providerTooling,providerPlan,errors};
}
