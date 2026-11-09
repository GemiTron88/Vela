import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveManagedRepositoryProviderBinary } from './repository-provider-deployment.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { spawnPortableSync } from './portable-process.mjs';

const PROBE_CACHE_REL = '.executionkit/repository-intelligence/provider-probes-cache.json';
const memoryProbeCache = new Map();

function projectIsV4(root) {
  try {
    const file=path.join(path.resolve(root),'execution.config.json');
    if(!fs.existsSync(file))return false;
    const stat=fs.lstatSync(file);
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2*1024*1024)return false;
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    return /^[45]\./.test(String(config.standardVersion??''));
  } catch {
    return false;
  }
}

export function clearRepositoryProviderProbeCache() {
  memoryProbeCache.clear();
}

function probeCacheFile(root) {
  try {
    return resolveDerivedPath(root, PROBE_CACHE_REL, 'provider probes cache', { createParents: true });
  } catch {
    return null;
  }
}

function readDiskProbeCache(root) {
  try {
    const file = probeCacheFile(root);
    if (file && fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data === 'object' && data.schemaVersion === 'executionkit-v4-provider-probe-cache/v1') {
        return data.probes ?? {};
      }
    }
  } catch {}
  return null;
}

function writeDiskProbeCache(root, probes) {
  try {
    const file = probeCacheFile(root);
    if (file) {
      const payload = {
        schemaVersion: 'executionkit-v4-provider-probe-cache/v1',
        savedAt: new Date().toISOString(),
        probes
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
    }
  } catch {}
}

function getCachedProbe(root, providerId, executable, versionArgs, force = false) {
  if (force) return null;
  const argsKey = JSON.stringify(versionArgs ?? ['--version']);
  const mem = memoryProbeCache.get(`${root}:${providerId}`);
  if (mem) {
    try {
      const stat = fs.statSync(executable);
      if (mem.executable === executable && mem.mtimeMs === stat.mtimeMs && mem.size === stat.size && mem.argsKey === argsKey) {
        return mem.probe;
      }
    } catch {
      return null;
    }
  }
  const disk = readDiskProbeCache(root);
  if (disk && disk[providerId]) {
    const entry = disk[providerId];
    try {
      const stat = fs.statSync(executable);
      if (entry.executable === executable && entry.mtimeMs === stat.mtimeMs && entry.size === stat.size && entry.argsKey === argsKey) {
        memoryProbeCache.set(`${root}:${providerId}`, entry);
        return entry.probe;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function setCachedProbe(root, providerId, executable, versionArgs, probe) {
  try {
    const stat = fs.statSync(executable);
    const argsKey = JSON.stringify(versionArgs ?? ['--version']);
    const entry = {
      executable,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      argsKey,
      probe,
      probedAt: new Date().toISOString()
    };
    memoryProbeCache.set(`${root}:${providerId}`, entry);
    const disk = readDiskProbeCache(root) ?? {};
    disk[providerId] = entry;
    writeDiskProbeCache(root, disk);
  } catch {}
}

export const DEFAULT_REPOSITORY_PROVIDERS = Object.freeze([
  Object.freeze({id:'native-source-pack',kind:'native',optional:false,capabilities:['source-pack','source-search','source-read'],version:'1.0.0'}),
  Object.freeze({id:'native-macro-context',kind:'native',optional:false,capabilities:['macro-context','context-refresh'],version:'1.0.0'}),
  Object.freeze({id:'repomix',kind:'external',optional:true,capabilities:['source-pack'],command:'repomix',versionArgs:['--version']}),
  Object.freeze({id:'codegraph',kind:'external',optional:true,capabilities:['relationship-graph','change-impact'],command:'codegraph',versionArgs:['--version']}),
  Object.freeze({id:'rtk',kind:'external',optional:true,capabilities:['token-output'],command:'rtk',versionArgs:['--version']}),
  Object.freeze({id:'terrain',kind:'external',optional:true,capabilities:['macro-context','knowledge-search','source-pack-read','freshness'],command:'terrain',versionArgs:['--version']}),
]);

function validId(value){return typeof value==='string'&&/^[a-z0-9][a-z0-9._-]*$/.test(value);}
function currentHead(root){const r=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:10000,windowsHide:true});return r.status===0?r.stdout.trim():null;}
function versionTuple(value){const match=String(value??'').match(/(\d+)\.(\d+)\.(\d+)/);return match?match.slice(1).map(Number):null;}
function compareVersion(a,b){const av=versionTuple(a),bv=versionTuple(b);if(!av||!bv)return null;for(let i=0;i<3;i++){if(av[i]!==bv[i])return av[i]-bv[i];}return 0;}
function executablePath(command,{cwd=process.cwd(),pathEnv=process.env.PATH??''}={}) {
  if(!command||typeof command!=='string')return null;
  if(command.includes('/')||command.includes('\\')){const full=path.resolve(cwd,command);return fs.existsSync(full)?full:null;}
  const exts=process.platform==='win32'?(process.env.PATHEXT??'.EXE;.CMD;.BAT;.COM').split(';'):[''];
  for(const dir of pathEnv.split(path.delimiter).filter(Boolean))for(const ext of exts){const full=path.join(dir,`${command}${ext}`);if(fs.existsSync(full))return full;}
  return null;
}
function probeVersion(executable,args,root){
  const requested=args??['--version'];
  const js=/\.(?:c?js|mjs)$/i.test(executable);
  const command=js?process.execPath:executable,argv=js?[executable,...requested]:requested;
  const {result: r}=spawnPortableSync(command,argv,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  const output=(r.stdout||r.stderr||'').trim();
  return {ok:!r.error&&r.status===0,exitCode:r.status,error:r.error?.message??null,output,version:versionTuple(output)?output.match(/\d+\.\d+\.\d+/)?.[0]??null:null};
}
function validateDefinition(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Provider definition must be an object');
  if(!validId(value.id))throw new Error(`Invalid provider id: ${value.id??'MISSING'}`);
  if(!['native','external'].includes(value.kind))throw new Error(`Invalid provider kind for ${value.id}`);
  if(typeof value.optional!=='boolean')throw new Error(`Provider ${value.id} optional must be boolean`);
  if(!Array.isArray(value.capabilities)||!value.capabilities.length)throw new Error(`Provider ${value.id} capabilities are required`);
  if(value.kind==='external'&&!value.command)throw new Error(`External provider ${value.id} command is required`);
  return value;
}

export function buildRepositoryProviderCatalog(overrides={}) {
  if(overrides&&typeof overrides!=='object')throw new Error('Provider overrides must be an object');
  const byId=new Map(DEFAULT_REPOSITORY_PROVIDERS.map((item)=>[item.id,{...item}]));
  for(const [id,override] of Object.entries(overrides??{})){
    if(!validId(id))throw new Error(`Invalid provider override id: ${id}`);
    const base=byId.get(id)??{id,kind:'external',optional:true,capabilities:[]};
    byId.set(id,{...base,...override,id});
  }
  return [...byId.values()].map(validateDefinition).sort((a,b)=>a.id.localeCompare(b.id));
}

export function inspectRepositoryProvider(root,provider,{pathEnv=process.env.PATH??'',repositoryHead=currentHead(root),force=false}={}) {
  validateDefinition(provider);
  if(projectIsV4(root)&&provider.kind==='external')throw new Error(`ExecutionKit v4 external repository provider removed: ${provider.id}`);
  if(provider.kind==='native'){
    return {schemaVersion:'1.0.0',id:provider.id,kind:'native',optional:provider.optional,capabilities:provider.capabilities,status:'READY',version:provider.version??'builtin',health:{reachable:true,checkedAt:new Date().toISOString(),baselineSha:repositoryHead,reason:null}};
  }
  const executable=executablePath(provider.command,{cwd:root,pathEnv});
  if(!executable)return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'NOT_AVAILABLE',version:null,health:{reachable:false,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha??null,reason:'command_not_found'}};
  let probe=getCachedProbe(root,provider.id,executable,provider.versionArgs,force);
  let fromCache=true;
  if(!probe){
    probe=probeVersion(executable,provider.versionArgs,root);
    setCachedProbe(root,provider.id,executable,provider.versionArgs,probe);
    fromCache=false;
  }
  if(!probe.ok)return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'FAILED',version:probe.version,health:{reachable:false,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha??null,reason:probe.error||`version_probe_exit_${probe.exitCode}`,probeOutput:probe.output.slice(0,500),cached:fromCache}};
  if(provider.minimumVersion&&!probe.version)return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'INCOMPATIBLE',version:null,health:{reachable:true,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha??null,reason:`version_unparseable_minimum_${provider.minimumVersion}`,probeOutput:probe.output.slice(0,500),cached:fromCache}};
  if(provider.minimumVersion&&compareVersion(probe.version,provider.minimumVersion)<0)return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'INCOMPATIBLE',version:probe.version,health:{reachable:true,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha??null,reason:`minimum_version_${provider.minimumVersion}`,cached:fromCache}};
  if(provider.observedBaselineSha&&repositoryHead&&provider.observedBaselineSha!==repositoryHead)return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'STALE',version:probe.version,health:{reachable:true,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha,reason:'repository_baseline_drift',currentHead:repositoryHead,cached:fromCache}};
  return {schemaVersion:'1.0.0',id:provider.id,kind:'external',optional:provider.optional,capabilities:provider.capabilities,status:'READY',version:probe.version??probe.output.slice(0,100)??null,health:{reachable:true,checkedAt:new Date().toISOString(),baselineSha:provider.observedBaselineSha??null,reason:null,cached:fromCache}};
}

export function inspectRepositoryProviders(root,{overrides={},pathEnv=null,force=false}={}) {
  const effectivePath=pathEnv??process.env.PATH??'';
  const v4=projectIsV4(root);
  let toolingError=null;
  const catalog=buildRepositoryProviderCatalog(overrides).filter((provider)=>!v4||provider.kind==='native');
  const providers=catalog.map((provider)=>{
    let effectiveProvider=provider;
    if(!v4){
      try{
        const managed=resolveManagedRepositoryProviderBinary(root,provider.id);
        if(managed) effectiveProvider={...provider,command:managed};
      }catch(error){toolingError=toolingError??error.message;}
    }
    const inspected=inspectRepositoryProvider(root,effectiveProvider,{pathEnv:effectivePath,force});
    return v4?{...inspected,health:{...inspected.health,cached:true,processSpawned:false}}:inspected;
  });
  return {
    schemaVersion:v4?'executionkit-v4-native-providers/v1':'1.0.0',
    checkedAt:new Date().toISOString(),
    ...(v4?{mode:'NATIVE_ONLY',externalProviders:'REMOVED'}:{}),
    providers,
    toolingError
  };
}

export function planRepositoryProviders(statusReport,{required=[]}={}) {
  if(!statusReport?.providers||!Array.isArray(statusReport.providers))throw new Error('Provider status report is required');
  const requiredSet=new Set(required);
  const actions=statusReport.providers.map((provider)=>{
    const requiredNow=requiredSet.has(provider.id)||provider.optional===false;
    if(provider.status==='READY')return {provider:provider.id,action:'NOOP',required:requiredNow,reason:'ready'};
    if(provider.status==='STALE')return {provider:provider.id,action:'RESYNC_REQUIRED',required:requiredNow,reason:provider.health?.reason??'stale'};
    if(provider.status==='INCOMPATIBLE')return {provider:provider.id,action:'UPGRADE_REQUIRED',required:requiredNow,reason:provider.health?.reason??'incompatible'};
    if(provider.status==='FAILED')return {provider:provider.id,action:'REPAIR_REQUIRED',required:requiredNow,reason:provider.health?.reason??'failed'};
    if(provider.status==='NOT_AVAILABLE')return {provider:provider.id,action:requiredNow?'INSTALL_REQUIRED':'OPTIONAL_MISSING',required:requiredNow,reason:'not_available'};
    return {provider:provider.id,action:'REPAIR_REQUIRED',required:requiredNow,reason:`unexpected_status_${provider.status}`};
  });
  return {schemaVersion:'1.0.0',plannedAt:new Date().toISOString(),actions,mutationRequired:actions.some((x)=>['INSTALL_REQUIRED','UPGRADE_REQUIRED','RESYNC_REQUIRED','REPAIR_REQUIRED'].includes(x.action)&&x.required)};
}

export async function applyRepositoryProviderPlan(plan,{installers={},resyncers={},repairers={}}={}) {
  if(!plan?.actions||!Array.isArray(plan.actions))throw new Error('Provider plan is required');
  const results=[];
  for(const item of plan.actions){
    if(item.action==='NOOP'||item.action==='OPTIONAL_MISSING'){results.push({...item,status:'SKIPPED'});continue;}
    const map=item.action==='RESYNC_REQUIRED'?resyncers:item.action==='REPAIR_REQUIRED'?repairers:installers;
    const fn=map[item.provider];
    if(typeof fn!=='function'){results.push({...item,status:'BLOCKED',reason:`explicit_${item.action.toLowerCase()}_handler_required`});continue;}
    try{const value=await fn(item);results.push({...item,status:'APPLIED',value:value??null});}
    catch(error){results.push({...item,status:'FAILED',reason:error.message});}
  }
  return {schemaVersion:'1.0.0',appliedAt:new Date().toISOString(),results,ok:results.every((x)=>['SKIPPED','APPLIED'].includes(x.status))};
}
