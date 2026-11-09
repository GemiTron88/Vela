import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { spawnPortableSync } from './portable-process.mjs';

const RECEIPT='.executionkit/route-integrity.json';
const TEXT_EXT=/\.(?:php|blade\.php|js|jsx|ts|tsx|vue|svelte)$/i;
const SKIP_DIRS=new Set(['.git','.executionkit','vendor','node_modules','dist','build','storage','bootstrap/cache']);
const ROUTE_REF_RE=/(?<!->\s*|::\s*|\bfunction\s+)\b(?:route|to_route)\s*\(\s*['"]([^'"]+)['"]\s*([),])?/g;
const ROUTE_METHOD_RE=/(?:\bredirect\s*\([^)]*\)\s*->\s*route|\b(?:Redirect|URL)::\s*(?:temporarySignedRoute|signedRoute|route)|->\s*redirectToRoute)\s*\(\s*['"]([^'"]+)['"]\s*([),])?/g;

function normalize(value){return String(value??'').split(path.sep).join('/');}
function sha(value){return crypto.createHash('sha256').update(value).digest('hex');}
function inside(root,full){const rel=path.relative(root,full);return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));}
function safeFile(root,rel){return resolveProjectPathSafe(root,rel,'Route Integrity source');}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
function run(command,args,cwd,timeout=30000){return spawnPortableSync(command,args,{cwd,encoding:'utf8',timeout,maxBuffer:32*1024*1024,windowsHide:true}).result;}

function walk(root,rel,out,{extensions=null,maxFiles=20000}={}){
  if(out.length>=maxFiles)throw Error('ROUTE_SCAN_LIMIT_EXCEEDED');
  const full=safeFile(root,rel);
  if(!fs.existsSync(full))return;
  const st=fs.statSync(full);
  if(st.isFile()){if(!extensions||extensions.test(rel))out.push(normalize(rel));return;}
  for(const entry of fs.readdirSync(full,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(out.length>=maxFiles)throw Error('ROUTE_SCAN_LIMIT_EXCEEDED');
    if(entry.isSymbolicLink())continue;
    const child=normalize(path.join(rel,entry.name));
    if(entry.isDirectory()&&(SKIP_DIRS.has(child)||SKIP_DIRS.has(entry.name)))continue;
    walk(root,child,out,{extensions,maxFiles});
  }
}

export function detectRouteFramework(root){
  root=path.resolve(root);
  if(fs.existsSync(path.join(root,'artisan'))&&fs.existsSync(path.join(root,'composer.json')))return {applicable:true,framework:'laravel'};
  return {applicable:false,framework:null};
}

function routeSourceFiles(root){
  const files=[];
  for(const rel of ['artisan','composer.json','composer.lock','bootstrap/app.php','bootstrap/providers.php'])if(fs.existsSync(safeFile(root,rel)))files.push(rel);
  walk(root,'routes',files,{extensions:/\.php$/i,maxFiles:5000});
  walk(root,'app/Http/Controllers',files,{extensions:/\.php$/i,maxFiles:10000});
  walk(root,'app/Livewire',files,{extensions:/\.php$/i,maxFiles:5000});
  walk(root,'app/Actions',files,{extensions:/\.php$/i,maxFiles:5000});
  walk(root,'app/Providers',files,{extensions:/\.php$/i,maxFiles:5000});
  walk(root,'config',files,{extensions:/\.php$/i,maxFiles:5000});
  return [...new Set(files)].sort();
}

export function routeSourceFingerprint(root){
  root=path.resolve(root);
  const files=routeSourceFiles(root);
  const meta=files.map((rel)=>{const st=fs.statSync(safeFile(root,rel));return {path:rel,size:st.size,mtimeMs:Math.trunc(st.mtimeMs)};});
  return {files:meta,fingerprint:sha(JSON.stringify(meta))};
}

function methods(value){
  if(Array.isArray(value))return value.map((x)=>String(x).toUpperCase()).filter(Boolean);
  return String(value??'').split(/[|,]/).map((x)=>x.trim().toUpperCase()).filter(Boolean);
}
function routeUri(value){const raw=String(value??'').trim();return raw===''?'/':raw.startsWith('/')?raw:'/'+raw;}

export function analyzeRouteCatalog(routes){
  const findings=[],names=new Map(),signatures=new Map();
  for(const route of routes){
    if(route.name){
      if(names.has(route.name))findings.push({code:'ROUTE_NAME_DUPLICATE',severity:'BLOCKER',name:route.name,message:'Duplicate named route: '+route.name});
      else names.set(route.name,route);
    }
    for(const method of route.methods){
      const key=(route.domain??'')+' '+method+' '+route.uri;
      if(signatures.has(key))findings.push({code:'ROUTE_SIGNATURE_DUPLICATE',severity:'BLOCKER',method,uri:route.uri,message:'Duplicate route signature: '+key});
      else signatures.set(key,route);
    }
  }
  return findings;
}

export function parseLaravelRouteList(raw){
  const parsed=JSON.parse(String(raw??''));
  if(!Array.isArray(parsed))throw new Error('Laravel route:list --json did not return an array');
  for(const item of parsed){
    if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.uri!=='string'||!methods(item.method??item.methods).length||methods(item.method??item.methods).some(method=>! /^[A-Z]+$/.test(method)))throw new Error('Laravel route:list contains an invalid route');
  }
  const routes=parsed.map((item,index)=>({
    index,
    methods:methods(item.method??item.methods),
    uri:routeUri(item.uri),
    name:item.name?String(item.name):null,
    action:item.action?String(item.action):null,
    middleware:Array.isArray(item.middleware)?item.middleware.map(String):String(item.middleware??'').split(',').map((x)=>x.trim()).filter(Boolean),
    domain:item.domain?String(item.domain):null,
  }));
  return {routes,findings:analyzeRouteCatalog(routes)};
}

export function refreshRouteIntegrity(root,{write=true,php='php'}={}){
  root=path.resolve(root);
  const framework=detectRouteFramework(root);
  if(!framework.applicable)return {schemaVersion:'executionkit-route-integrity/v1',status:'NOT_APPLICABLE',applicable:false,framework:null,findings:[]};
  const command=run(php,['artisan','route:list','--json','--no-ansi'],root,45000);
  if(command.status!==0){
    const result={schemaVersion:'executionkit-route-integrity/v1',status:'INVALID',applicable:true,framework:'laravel',findings:[{code:'ROUTE_DISCOVERY_FAILED',severity:'BLOCKER',message:String(command.stderr||command.stdout||command.error?.message||'php artisan route:list failed').trim().slice(0,4000)}],generatedAt:new Date().toISOString()};
    if(write)atomicJson(safeFile(root,RECEIPT),result);
    return result;
  }
  let parsed;
  try{parsed=parseLaravelRouteList(command.stdout);}
  catch(error){
    const result={schemaVersion:'executionkit-route-integrity/v1',status:'INVALID',applicable:true,framework:'laravel',findings:[{code:'ROUTE_DISCOVERY_INVALID_JSON',severity:'BLOCKER',message:error.message}],generatedAt:new Date().toISOString()};
    if(write)atomicJson(safeFile(root,RECEIPT),result);
    return result;
  }
  const source=routeSourceFingerprint(root);
  const result={schemaVersion:'executionkit-route-integrity/v1',status:parsed.findings.some((x)=>x.severity==='BLOCKER')?'INVALID':'CURRENT',applicable:true,framework:'laravel',sourceFingerprint:source.fingerprint,sourceFiles:source.files,routeCount:parsed.routes.length,routes:parsed.routes,findings:parsed.findings,generatedAt:new Date().toISOString()};
  if(write)atomicJson(safeFile(root,RECEIPT),result);
  return result;
}

export function inspectRouteIntegrity(root,{fast=true}={}){
  root=path.resolve(root);
  const framework=detectRouteFramework(root);
  if(!framework.applicable)return {schemaVersion:'executionkit-route-integrity/v1',status:'NOT_APPLICABLE',applicable:false,framework:null,cacheHit:false};
  const receipt=readJson(safeFile(root,RECEIPT));
  if(!receipt||receipt.schemaVersion!=='executionkit-route-integrity/v1')return {schemaVersion:'executionkit-route-integrity/v1',status:'MISSING',applicable:true,framework:'laravel',cacheHit:false,nextCommand:'executionkit route refresh .'};
  const source=routeSourceFingerprint(root);
  if(receipt.sourceFingerprint!==source.fingerprint)return {schemaVersion:'executionkit-route-integrity/v1',status:'STALE',applicable:true,framework:'laravel',cacheHit:false,routeCount:receipt.routeCount??0,generatedAt:receipt.generatedAt??null,nextCommand:'executionkit route refresh .'};
  return {...receipt,cacheHit:true,hotPath:fast?'manifest-metadata-only':'catalog'};
}

function gitChangedFiles(root){
  const results=[['diff','--name-only','-z','HEAD'],['ls-files','--others','--exclude-standard','-z']].map(args=>run('git',args,root,15000));
  if(results.some(result=>result.error||result.status!==0))throw Error('ROUTE_CHANGED_FILES_UNAVAILABLE: use --all outside Git');
  const changed=[...new Set(results.flatMap(result=>String(result.stdout??'').split('\0').filter(Boolean)))];
  if(changed.length)return changed;
  const prev=run('git',['diff','--name-only','-z','HEAD~1','HEAD'],root,15000);
  if(!prev.error&&prev.status===0)return [...new Set(String(prev.stdout??'').split('\0').filter(Boolean))];
  return [];
}

function scanCandidates(root,mode,files){
  if(Array.isArray(files)){
    const expanded=[];
    for(const rel of files.map(normalize).filter(rel=>!rel.split('/').some(part=>SKIP_DIRS.has(part)))){
      const full=safeFile(root,rel);
      if(fs.existsSync(full)&&fs.statSync(full).isDirectory())walk(root,rel,expanded,{extensions:TEXT_EXT,maxFiles:20000});else expanded.push(rel);
    }
    return [...new Set(expanded)];
  }
  if(mode!=='all')return gitChangedFiles(root);
  const out=[];
  for(const rel of ['app','resources','routes','src','frontend','web'])walk(root,rel,out,{extensions:TEXT_EXT,maxFiles:20000});
  return [...new Set(out)];
}

function escapeRegex(value){return String(value).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');}
function controllerFindings(root,routes){
  const findings=[];
  for(const route of routes){
    const action=String(route.action??'');
    const match=action.match(/^App\\(Http\\Controllers|Livewire|Actions)\\(.+?)(?:@([A-Za-z_][A-Za-z0-9_]*))?$/);
    if(!match)continue;
    const prefix=match[1].replaceAll('\\','/');
    const rel='app/'+prefix+'/'+match[2].replaceAll('\\','/')+'.php';
    const file=safeFile(root,rel);
    if(!fs.existsSync(file)){findings.push({code:'ROUTE_CONTROLLER_MISSING',severity:'BLOCKER',route:route.name??route.uri,action,path:rel,message:'Route controller/action file does not exist: '+rel});continue;}
    if(match[1]==='Livewire'&&!match[3])continue;
    const method=match[3]??'__invoke';
    const body=fs.readFileSync(file,'utf8');
    const re=new RegExp('function\\s+'+escapeRegex(method)+'\\s*\\(');
    if(!re.test(body))findings.push({code:'ROUTE_CONTROLLER_METHOD_UNRESOLVED',severity:'REVIEW',route:route.name??route.uri,action,path:rel,method,message:'Controller method was not found directly in source; verify inheritance/magic dispatch intentionally provides it'});
  }
  return findings;
}

export function scanRouteReferences(root,snapshot,{files=null,mode='changed'}={}){
  root=path.resolve(root);
  const routeByName=new Map((snapshot?.routes??[]).filter((x)=>x.name).map((x)=>[x.name,x]));
  const names=new Set(routeByName.keys());
  const findings=[...analyzeRouteCatalog(snapshot?.routes??[]),...controllerFindings(root,snapshot?.routes??[])];
  const scanned=[];
  for(const rel of scanCandidates(root,mode,files)){
    if(!TEXT_EXT.test(rel))continue;
    const file=safeFile(root,rel);if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
    let body;try{body=fs.readFileSync(file,'utf8');}catch{continue;}
    scanned.push(rel);
    for(const regex of [ROUTE_REF_RE,ROUTE_METHOD_RE]){
      regex.lastIndex=0;
      for(const match of body.matchAll(regex)){
        const name=match[1],delim=match[2]??'';
        if(!names.has(name)){
          findings.push({code:'ROUTE_NAME_MISMATCH',severity:'BLOCKER',file:rel,name,message:'Named route reference is not present in canonical route truth: '+name});
        }else if(delim===')'){
          const routeObj=routeByName.get(name);
          const reqParam=String(routeObj?.uri??'').match(/\{([A-Za-z_][A-Za-z0-9_]*)(?::[A-Za-z0-9_]+)?\}/);
          if(reqParam){
            findings.push({code:'ROUTE_MISSING_REQUIRED_PARAM',severity:'BLOCKER',file:rel,name,parameter:reqParam[1],uri:routeObj.uri,message:'Named route '+name+' ('+routeObj.uri+') requires parameter {'+reqParam[1]+'} but was called with no arguments'});
          }
        }
      }
    }
  }
  const unique=[];const seen=new Set();
  for(const item of findings){const key=JSON.stringify([item.code,item.file??'',item.name??'',item.method??'',item.uri??'',item.path??'']);if(seen.has(key))continue;seen.add(key);unique.push(item);}
  return {scannedFiles:scanned,findings:unique};
}

export function guardRouteReferences(root,{files=null,mode='changed',all=false,autoRefresh=true}={}){
  if(all)mode='all';
  root=path.resolve(root);
  let status=inspectRouteIntegrity(root,{fast:true});
  if(autoRefresh&&['MISSING','STALE'].includes(status.status))status=refreshRouteIntegrity(root,{write:true});
  if(status.status==='NOT_APPLICABLE')return {...status,ok:true,guardStatus:'NOT_APPLICABLE'};
  if(status.status!=='CURRENT')return {...status,status:'BLOCKED',ok:false,catalogStatus:status.status,guardStatus:'BLOCKED',nextCommand:'executionkit route refresh .'};
  const scan=scanRouteReferences(root,status,{files,mode});
  const blocked=scan.findings.some((x)=>x.severity==='BLOCKER');
  return {schemaVersion:'executionkit-route-guard/v1',status:blocked?'FAIL':'PASS',ok:!blocked,guardStatus:blocked?'BLOCKED':'PASS',framework:status.framework,routeCount:status.routeCount,sourceFingerprint:status.sourceFingerprint,scannedFiles:scan.scannedFiles,findings:scan.findings,nextCommand:blocked?'resolve-route-integrity-findings':null};
}

function envBaseUrl(root){
  const config=readJson(path.join(root,'execution.config.json'));
  const configured=String(config?.routeIntegrity?.baseUrl??'').trim();
  if(/^https?:\/\//i.test(configured))return configured;
  const envFile=path.join(root,'.env');
  if(fs.existsSync(envFile)){
    const line=fs.readFileSync(envFile,'utf8').split(/\r?\n/).find((x)=>/^APP_URL\s*=/.test(x.trim()));
    if(line){
      const value=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');
      if(/^https?:\/\//i.test(value))return value;
    }
  }
  return null;
}

async function probeOne(baseUrl,route,timeoutMs){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const started=Date.now();
  try{
    const url=new URL(route.uri==='/'?'':route.uri.replace(/^\//,''),baseUrl.endsWith('/')?baseUrl:baseUrl+'/');
    const response=await fetch(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'user-agent':'ExecutionKit-RouteGuard/4'}});
    return {name:route.name??null,uri:route.uri,url:url.toString(),status:response.status,durationMs:Date.now()-started,error:null};
  }catch(error){return {name:route.name??null,uri:route.uri,url:null,status:null,durationMs:Date.now()-started,error:error.name==='AbortError'?'TIMEOUT':error.message};}
  finally{clearTimeout(timer);}
}

export async function probeRouteHealth(root,{baseUrl=null,timeoutMs=5000,limit=250,concurrency=8}={}){
  root=path.resolve(root);
  let snapshot=inspectRouteIntegrity(root,{fast:true});
  if(['MISSING','STALE'].includes(snapshot.status))snapshot=refreshRouteIntegrity(root,{write:true});
  if(snapshot.status==='NOT_APPLICABLE')return {...snapshot,probeStatus:'NOT_APPLICABLE'};
  if(snapshot.status!=='CURRENT')return {schemaVersion:'executionkit-route-probe/v1',status:'BLOCKED',findings:snapshot.findings??[],nextCommand:'executionkit route refresh .'};
  const resolved=baseUrl||envBaseUrl(root);
  if(!resolved)return {schemaVersion:'executionkit-route-probe/v1',status:'BLOCKED',baseUrl:null,findings:[{code:'ROUTE_BASE_URL_REQUIRED',severity:'BLOCKER',message:'HTTP route probing requires --base-url or routeIntegrity.baseUrl/APP_URL'}]};
  let origin;
  try{origin=new URL(resolved);if(!['http:','https:'].includes(origin.protocol))throw new Error('protocol');}
  catch{return {schemaVersion:'executionkit-route-probe/v1',status:'BLOCKED',baseUrl:resolved,findings:[{code:'ROUTE_BASE_URL_INVALID',severity:'BLOCKER',message:'HTTP route probing requires an absolute http(s) base URL'}]};}
  const staticRoutes=(snapshot.routes??[]).filter((route)=>route.methods.includes('GET')&&!/[{}]/.test(route.uri));
  const candidates=staticRoutes.filter((route)=>!route.domain||route.domain===origin.hostname);
  const skippedDomain=staticRoutes.length-candidates.length;
  const cap=Math.max(1,Number(limit)||250);
  if(candidates.length>cap)return {schemaVersion:'executionkit-route-probe/v1',status:'BLOCKED',baseUrl:resolved,checked:0,skippedLimit:candidates.length-cap,skippedDomain,findings:[{code:'ROUTE_PROBE_LIMIT_EXCEEDED',severity:'BLOCKER',message:'The probe limit excludes declared static GET routes; increase --limit to cover the full catalog'}]};
  const results=new Array(candidates.length);let cursor=0;
  const worker=async()=>{while(cursor<candidates.length){const i=cursor++;results[i]=await probeOne(resolved,candidates[i],Math.max(250,Number(timeoutMs)||5000));}};
  await Promise.all(Array.from({length:Math.min(Math.max(1,Number(concurrency)||8),Math.max(1,candidates.length))},worker));
  const findings=[];
  for(const result of results){
    if(result.error)findings.push({code:'ROUTE_PROBE_UNREACHABLE',severity:'BLOCKER',uri:result.uri,error:result.error,message:'Route probe could not reach '+result.uri+': '+result.error});
    else if(result.status===404)findings.push({code:'ROUTE_HTTP_404',severity:'BLOCKER',uri:result.uri,url:result.url,status:404,message:'Declared route returned HTTP 404'});
    else if(result.status>=500)findings.push({code:'ROUTE_HTTP_5XX',severity:'BLOCKER',uri:result.uri,url:result.url,status:result.status,message:'Declared route returned HTTP '+result.status});
  }
  return {schemaVersion:'executionkit-route-probe/v1',status:findings.length?'FAIL':'PASS',baseUrl:resolved,checked:results.length,skippedDomain,skippedDynamic:(snapshot.routes??[]).filter((route)=>route.methods.includes('GET')&&/[{}]/.test(route.uri)).length,results,findings};
}
