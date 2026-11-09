import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSourcePack, captureRepositorySnapshot, isSensitiveRepositoryPath } from './repository-source.mjs';
import { normalizeKnowledgePath } from './repository-intelligence.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { resolveManagedRepositoryProviderBinary } from './repository-provider-deployment.mjs';

const MAX_OUTPUT_BYTES=2*1024*1024;
const DEFAULT_TIMEOUT_MS=30000;
const CODEGRAPH_QUERY_OPS=new Set(['callers','callees','impact','search']);
const TERRAIN_TOOL_OPS=new Set(['read-context','search','read-doc','grep-pack','freshness']);
const RTK_SAFE_PREFIXES=new Set(['git']);
const RTK_SAFE_GIT_SUBCOMMANDS=new Set(['status','log','rev-parse','ls-files','describe','show-ref']);
const DERIVED_DIRTY_PREFIXES=['.executionkit/','.codegraph/','.terrain/','.litho-agent/'];

function now(){return new Date().toISOString();}
function lstatMaybe(full){
  try{return fs.lstatSync(full);}
  catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
function hashFileSync(full){
  const digest=crypto.createHash('sha256'),fd=fs.openSync(full,'r'),buffer=Buffer.allocUnsafe(64*1024);
  try{let bytes=0;do{bytes=fs.readSync(fd,buffer,0,buffer.length,null);if(bytes>0)digest.update(buffer.subarray(0,bytes));}while(bytes>0);}
  finally{fs.closeSync(fd);}
  return digest.digest('hex');
}
function graphWorktreeFingerprint(root,snapshot=captureRepositorySnapshot(root)){
  const relevantDirtyPaths=(snapshot.dirtyPaths??[]).filter((item)=>!DERIVED_DIRTY_PREFIXES.some((prefix)=>item===prefix.slice(0,-1)||item.startsWith(prefix)));
  const parts=[`head:${snapshot.head??'none'}`,`dirty:${relevantDirtyPaths.length>0}`];
  for(const rel of relevantDirtyPaths){
    const full=path.resolve(root,...rel.split('/')),base=path.resolve(root);
    if(!(full===base||full.startsWith(`${base}${path.sep}`))){parts.push(`${rel}:unsafe`);continue;}
    if(!fs.existsSync(full)){parts.push(`${rel}:deleted`);continue;}
    const stat=fs.lstatSync(full);
    if(stat.isSymbolicLink()){parts.push(`${rel}:symlink:${fs.readlinkSync(full)}`);continue;}
    if(stat.isFile()){parts.push(`${rel}:file:${stat.size}:${hashFileSync(full)}`);continue;}
    parts.push(`${rel}:other:${stat.mode}`);
  }
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
}

function resolveProviderCommand(root,command){
  const ids={codegraph:'codegraph',repomix:'repomix',rtk:'rtk'};
  const id=ids[command];
  if(!id)return command;
  return resolveManagedRepositoryProviderBinary(root,id)??command;
}
function boundedText(value,max=MAX_OUTPUT_BYTES){
  const text=String(value??'');
  if(Buffer.byteLength(text,'utf8')>max) throw new Error(`Provider output exceeds ${max} bytes`);
  return text;
}
function exec(command,args,{root,input=null,timeoutMs=DEFAULT_TIMEOUT_MS,maxOutputBytes=MAX_OUTPUT_BYTES,env=null}={}){
  if(typeof command!=='string'||!command.trim()) throw new Error('Provider command is required');
  if(!Array.isArray(args)||args.some((arg)=>typeof arg!=='string')) throw new Error('Provider argv must be a string array');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000) throw new Error('timeoutMs must be 1000..120000');
  const effectiveEnv=env??process.env;
  const resolved=resolveProviderCommand(root??'.',command);
  const managedJs=resolved!==command&&/\.(?:c?js|mjs)$/i.test(resolved);
  const effectiveCommand=managedJs?process.execPath:resolved;
  const effectiveArgs=managedJs?[resolved,...args]:args;
  const r=spawnSync(effectiveCommand,effectiveArgs,{cwd:path.resolve(root??'.'),input,encoding:'utf8',timeout:timeoutMs,maxBuffer:maxOutputBytes,windowsHide:true,shell:false,env:effectiveEnv});
  if(r.error){
    const err=new Error(`Provider command failed: ${r.error.message}`);
    err.code=r.error.code??'PROVIDER_EXEC_FAILED'; throw err;
  }
  const stdout=boundedText(r.stdout,maxOutputBytes),stderr=boundedText(r.stderr,maxOutputBytes);
  if(r.status!==0){
    const err=new Error(`Provider command exited ${r.status}: ${stderr||stdout||command}`);
    err.code='PROVIDER_EXIT_NONZERO'; err.exitCode=r.status; throw err;
  }
  return {stdout,stderr,exitCode:r.status};
}
function parseJson(text,label){
  try{return JSON.parse(text);}catch{throw new Error(`${label} did not return valid JSON`);}
}
function stampPath(root,id){
  return resolveDerivedPath(root,`.executionkit/repository-intelligence/providers/${id}.json`,`Repository Intelligence ${id} stamp`,{createParents:true});
}
function readStamp(root,id){
  const file=stampPath(root,id);
  if(!fs.existsSync(file)) return null;
  const stat=fs.lstatSync(file); if(stat.isSymbolicLink()||!stat.isFile()||stat.size>256*1024) return null;
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}
function writeStamp(root,id,value){
  const file=stampPath(root,id),tmp=`${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  try{fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});fs.renameSync(tmp,file);}
  finally{if(fs.existsSync(tmp))fs.rmSync(tmp,{force:true});}
  return path.relative(path.resolve(root),file).split(path.sep).join('/');
}
function assertCurrentStamp(root,id){
  const snapshot=captureRepositorySnapshot(root),stamp=readStamp(root,id);
  if(!snapshot.isGit||!snapshot.head) throw new Error(`${id} requires a Git repository with a current HEAD`);
  if(!stamp) throw new Error(`${id} index provenance is missing; explicit refresh/index is required`);
  if(id==='codegraph'){
    const status=codeGraphStampStatus(root);
    if(status.status!=='CURRENT') throw new Error(`codegraph index is not current: ${status.reason??status.status}`);
  }else if(stamp.baselineSha!==snapshot.head||(stamp.worktreeFingerprint&&stamp.worktreeFingerprint!==graphWorktreeFingerprint(root,snapshot))){
    throw new Error(`${id} index is stale: ${stamp.baselineSha??'unknown'} != ${snapshot.head}`);
  }
  return {snapshot,stamp};
}
function validateRtkReadOnlyArgv(argv){
  if(!Array.isArray(argv)||argv.length===0||argv.some((arg)=>typeof arg!=='string')) throw new Error('RTK argv is required');
  if(!RTK_SAFE_PREFIXES.has(argv[0])) throw new Error(`RTK subcommand ${argv[0]} is not allowed by Repository Intelligence`);
  const lower=argv.map((x)=>x.toLowerCase());
  const forbidden=[
    '--output','--output=','--exec','--exec=','--config-env','--config-env=',
    '-o','--files-with-matches0','-p','--patch','--full-diff','--binary'
  ];
  for(const arg of lower){
    if(forbidden.some((token)=>arg===token||arg.startsWith(token))) throw new Error(`RTK argument ${arg} is not allowed by Repository Intelligence`);
  }
  if(argv[0]==='git'){
    const sub=argv[1];
    if(!sub||!RTK_SAFE_GIT_SUBCOMMANDS.has(sub)) throw new Error(`RTK git subcommand ${sub??'MISSING'} is not read-only allowlisted`);
  }
  return argv;
}

function resultEnvelope(provider,operation,root,payload,extra={}){
  const snapshot=captureRepositorySnapshot(root);
  return {schemaVersion:'1.0.0',provider,operation,observedAt:now(),repository:{baselineSha:snapshot.head,branch:snapshot.branch,dirty:snapshot.dirty},payload,...extra};
}

export function indexCodeGraph(root,{command='codegraph',prefixArgs=[],force=false,timeoutMs=120000}={}){
  const absolute=path.resolve(root),graphDir=path.join(absolute,'.codegraph');
  const existingStat=lstatMaybe(graphDir);
  if(existingStat&&(existingStat.isSymbolicLink()||!existingStat.isDirectory())) throw new Error('CodeGraph index path must be a real repository-local directory');
  const before=captureRepositorySnapshot(root);
  if(!before.isGit||!before.head) throw new Error('CodeGraph indexing requires a Git repository with a current HEAD');
  const beforeFingerprint=graphWorktreeFingerprint(root,before);
  const initialized=Boolean(existingStat);
  const operation=!initialized?'init':force?'index':'sync';
  const args=operation==='init'
    ? ['init',absolute]
    : operation==='index'
      ? ['index',absolute,'--force','--quiet']
      : ['sync',absolute,'--quiet'];
  const run=exec(command,[...prefixArgs,...args],{root,timeoutMs});
  const statusRun=exec(command,[...prefixArgs,'status',absolute,'--json'],{root,timeoutMs:Math.min(timeoutMs,30000)});
  const payload=parseJson(statusRun.stdout,'CodeGraph status');
  const snapshot=captureRepositorySnapshot(root);
  const afterFingerprint=graphWorktreeFingerprint(root,snapshot);
  if(!snapshot.head) throw new Error('CodeGraph indexing lost Git HEAD during execution');
  if(before.head!==snapshot.head||beforeFingerprint!==afterFingerprint) throw new Error('Repository source changed during CodeGraph indexing; index provenance was not stamped');
  const graphStat=lstatMaybe(graphDir);
  if(!graphStat||graphStat.isSymbolicLink()||!graphStat.isDirectory()) throw new Error('CodeGraph did not produce a safe repository-local index directory');
  const stamp={schemaVersion:'1.0.0',provider:'codegraph',baselineSha:snapshot.head,dirty:snapshot.dirty,worktreeFingerprint:afterFingerprint,indexedAt:now(),command,operation,status:payload};
  const storedAt=writeStamp(root,'codegraph',stamp);
  return resultEnvelope('codegraph',operation,root,payload,{commandOutput:run.stdout.slice(0,2000)||null,indexProvenance:{...stamp,storedAt}});
}

export function queryCodeGraph(root,operation,target,{command='codegraph',prefixArgs=[],depth=3,limit=100,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  if(!CODEGRAPH_QUERY_OPS.has(operation)) throw new Error(`Unsupported CodeGraph operation: ${operation}`);
  if(typeof target!=='string'||!target.trim()) throw new Error('CodeGraph target/query is required');
  if(!Number.isInteger(limit)||limit<1||limit>500) throw new Error('CodeGraph limit must be 1..500');
  if(!Number.isInteger(depth)||depth<1||depth>10) throw new Error('CodeGraph depth must be 1..10');
  const {stamp}=assertCurrentStamp(root,'codegraph');
  const cliOperation=operation==='search'?'query':operation;
  const args=[cliOperation,target];
  if(operation==='impact') args.push('--depth',String(depth));
  else args.push('--limit',String(limit));
  args.push('--json');
  const run=exec(command,[...prefixArgs,...args],{root,timeoutMs});
  const payload=parseJson(run.stdout,`CodeGraph ${operation}`);
  return resultEnvelope('codegraph',operation,root,payload,{cliOperation,indexProvenance:stamp,trust:'RELATIONSHIP_GRAPH_CURRENT'});
}

export function affectedTestsCodeGraph(root,files,{command='codegraph',prefixArgs=[],depth=5,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  if(!Array.isArray(files)||files.length===0) throw new Error('CodeGraph affected files are required');
  if(files.length>500) throw new Error('CodeGraph affected input exceeds 500 files');
  if(!Number.isInteger(depth)||depth<1||depth>20) throw new Error('CodeGraph affected depth must be 1..20');
  const normalized=[...new Set(files.map((item)=>normalizeKnowledgePath(item)))].sort();
  for(const rel of normalized){
    const policy=isSensitiveRepositoryPath(rel);
    if(policy.denied) throw new Error(`CodeGraph affected input denied: ${rel} (${policy.reason})`);
  }
  const {stamp}=assertCurrentStamp(root,'codegraph');
  const input=`${normalized.join('\n')}\n`;
  const args=['affected','--path',path.resolve(root),'--stdin','--depth',String(depth),'--json'];
  const run=exec(command,[...prefixArgs,...args],{root,input,timeoutMs,maxOutputBytes:MAX_OUTPUT_BYTES});
  const payload=parseJson(run.stdout,'CodeGraph affected');
  return resultEnvelope('codegraph','affected',root,payload,{indexProvenance:stamp,trust:'RELATIONSHIP_GRAPH_CURRENT'});
}

export function terrainTool(root,operation,{command='terrain',prefixArgs=[],project,query=null,pattern=null,doc=null,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  if(!TERRAIN_TOOL_OPS.has(operation)) throw new Error(`Unsupported Terrain tool operation: ${operation}`);
  if(typeof project!=='string'||!project.trim()) throw new Error('Terrain project slug is required');
  const args=['tools',operation,'--project',project];
  if(operation==='search'){
    if(typeof query!=='string'||!query.trim()) throw new Error('Terrain search query is required');
    args.push('--query',query);
  } else if(operation==='grep-pack'){
    if(typeof pattern!=='string'||!pattern.trim()) throw new Error('Terrain grep pattern is required');
    args.push('--pattern',pattern);
  } else if(operation==='read-doc'){
    if(typeof doc!=='string'||!doc.trim()) throw new Error('Terrain document identifier is required');
    args.push('--path',doc);
  }
  const run=exec(command,[...prefixArgs,...args],{root,timeoutMs});
  const payload=parseJson(run.stdout,`Terrain tools ${operation}`);
  return resultEnvelope('terrain',operation,root,payload,{trust:'EXTERNAL_DERIVED_ADVISORY'});
}

export function repomixPack(root,{command='repomix',prefixArgs=[],style='markdown',timeoutMs=60000,maxOutputBytes=4*1024*1024,packOptions={}}={}){
  if(!['markdown','json','plain','xml'].includes(style)) throw new Error('Unsupported Repomix style');
  const native=buildSourcePack(root,packOptions);
  const safePaths=native.files.map((file)=>file.path);
  if(!safePaths.length) return resultEnvelope('repomix','pack',root,'',{source:{provider:native.provider,repository:native.repository,metrics:native.metrics},trust:'SOURCE_INDEX_CURRENT'});
  const input=`${safePaths.join('\n')}\n`;
  const configFile=resolveDerivedPath(root,`.executionkit/repository-intelligence/repomix-${crypto.randomUUID()}.config.json`,'Repository Intelligence Repomix isolated config',{createParents:true});
  try{
    fs.mkdirSync(path.dirname(configFile),{recursive:true});
    fs.writeFileSync(configFile,'{}\n',{mode:0o600});
    const run=exec(command,[...prefixArgs,'--config',configFile,'--stdin','--stdout','--style',style],{root,input,timeoutMs,maxOutputBytes});
    return resultEnvelope('repomix','pack',root,run.stdout,{source:{provider:native.provider,repository:native.repository,metrics:native.metrics,includedPaths:safePaths.length,isolatedConfig:true},trust:'SOURCE_INDEX_CURRENT'});
  }finally{
    if(fs.existsSync(configFile))fs.rmSync(configFile,{force:true});
  }
}

export function rtkRun(root,argv,{command='rtk',prefixArgs=[],timeoutMs=30000,maxOutputBytes=1024*1024}={}){
  validateRtkReadOnlyArgv(argv);
  const run=exec(command,[...prefixArgs,...argv],{root,timeoutMs,maxOutputBytes});
  return resultEnvelope('rtk','compact-readonly-command',root,run.stdout,{stderr:run.stderr||null,trust:'TOOL_OUTPUT_ONLY',mutationAuthority:false});
}

export function codeGraphStampStatus(root){
  const snapshot=captureRepositorySnapshot(root),stamp=readStamp(root,'codegraph');
  if(!stamp) return {status:'UNPROVEN',baselineSha:null,currentHead:snapshot.head,reason:'stamp_missing'};
  if(!snapshot.head) return {status:'UNAVAILABLE',baselineSha:stamp.baselineSha??null,currentHead:null,reason:'git_head_unavailable'};
  const graphDir=path.join(path.resolve(root),'.codegraph'),graphStat=lstatMaybe(graphDir);
  if(!graphStat) return {status:'UNPROVEN',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:'codegraph_index_missing'};
  if(graphStat.isSymbolicLink()||!graphStat.isDirectory()) return {status:'UNPROVEN',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:'codegraph_index_unsafe'};
  if(stamp.baselineSha!==snapshot.head) return {status:'STALE',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:'head_changed'};
  const currentFingerprint=graphWorktreeFingerprint(root,snapshot);
  if(!stamp.worktreeFingerprint) return {status:'UNPROVEN',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:'worktree_fingerprint_missing'};
  if(stamp.worktreeFingerprint!==currentFingerprint) return {status:'STALE',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:'worktree_changed'};
  return {status:'CURRENT',baselineSha:stamp.baselineSha??null,currentHead:snapshot.head,indexedAt:stamp.indexedAt??null,reason:null,dirty:snapshot.dirty};
}

export const repositoryProviderAdapterCapabilities=Object.freeze({
  codegraph:Object.freeze([...CODEGRAPH_QUERY_OPS,'affected']),
  terrain:Object.freeze([...TERRAIN_TOOL_OPS]),
  repomix:Object.freeze(['pack']),
  rtk:Object.freeze([...RTK_SAFE_PREFIXES]),
});
