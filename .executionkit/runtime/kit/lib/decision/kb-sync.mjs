import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveDerivedPath} from '../derived-state.mjs';
import {parseKnowledge} from './knowledge.mjs';

export const KB_REPOSITORY='GemiTron88/KB';
const snapshot=fileURLToPath(new URL('./knowledge/catalog.json',import.meta.url));
const manifestFile=fileURLToPath(new URL('./knowledge/manifest.json',import.meta.url));
const TTL=6*60*60*1000,MAX_AGE=7*24*60*60*1000,LIMIT=256*1024,CACHE_LIMIT=2*LIMIT+8192;
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
export function validateCatalogRelease(manifest,raw){
  if(!manifest||Object.keys(manifest).some(k=>!['schemaVersion','repository','revision','updatedAt','catalogPath','sha256','factCount','ruleCount'].includes(k))||manifest.schemaVersion!==1||manifest.repository!==KB_REPOSITORY||!Number.isSafeInteger(manifest.revision)||manifest.revision<1||manifest.catalogPath!=='catalog.json'||!Number.isFinite(Date.parse(manifest.updatedAt))||Date.parse(manifest.updatedAt)>Date.now()+300000||! /^[a-f0-9]{64}$/.test(manifest.sha256??'')||digest(raw)!==manifest.sha256)throw Error('KB_RELEASE_INVALID');
  const knowledge=parseKnowledge(raw);
  if(manifest.factCount!==knowledge.catalog.facts.length||manifest.ruleCount!==knowledge.catalog.rules.length)throw Error('KB_RELEASE_COUNTS_INVALID');
  return knowledge;
}
function cacheFile(root,create=false){return resolveDerivedPath(root,'.executionkit/decision/kb-cache.json','Decision KB cache',{file:true,createParents:create});}
export function readLocalKnowledge(root,{now=Date.now()}={}){
  const bundledManifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const bundled=validateCatalogRelease(bundledManifest,fs.readFileSync(snapshot,'utf8').replace(/\r\n/g,'\n'));
  try{
    const file=cacheFile(root);
    if(fs.statSync(file).size>CACHE_LIMIT)throw Error('KB_CACHE_OVERSIZE');
    const cache=JSON.parse(fs.readFileSync(file,'utf8'));
    if(cache.schemaVersion!==1||! /^[a-f0-9]{40}$/.test(cache.sourceCommit??'')||!Number.isFinite(cache.fetchedAt)||cache.fetchedAt>now+300000||now-cache.fetchedAt>MAX_AGE)throw Error('KB_CACHE_STALE');
    const knowledge=validateCatalogRelease(cache.manifest,cache.raw);
    if(cache.manifest.revision<bundledManifest.revision||(cache.manifest.revision===bundledManifest.revision&&cache.manifest.sha256!==bundledManifest.sha256))throw Error('KB_CACHE_ROLLBACK');
    return {status:'CURRENT',source:'CACHE',knowledge,manifest:cache.manifest,sourceCommit:cache.sourceCommit,fetchedAt:cache.fetchedAt,refreshDue:now-cache.fetchedAt>=TTL};
  }catch(error){return {status:'BUNDLED_FALLBACK',source:'BUNDLED',knowledge:bundled,manifest:bundledManifest,sourceCommit:null,fetchedAt:null,refreshDue:true,reason:error.code==='ENOENT'?'KB_CACHE_MISSING':'KB_CACHE_UNAVAILABLE'};}
}
async function boundedGet(fetchImpl,url,token,signal,maxBytes){
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})}});
  if(response.status!==200)throw Error('KB_SOURCE_UNAVAILABLE');
  if(Number(response.headers.get('content-length')??0)>maxBytes)throw Error('KB_RESPONSE_OVERSIZE');
  const reader=response.body.getReader();let length=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes)throw Error('KB_RESPONSE_OVERSIZE');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function decodeContent(value,path,limit){
  if(value?.type!=='file'||value.path!==path||value.encoding!=='base64'||!Number.isSafeInteger(value.size)||value.size>limit||typeof value.content!=='string')throw Error('KB_CONTENT_INVALID');
  const bytes=Buffer.from(value.content.replace(/\s/g,''),'base64');
  if(bytes.length!==value.size||bytes.length>limit)throw Error('KB_CONTENT_OVERSIZE');
  return bytes.toString('utf8');
}
function sameFile(a,b){return a.dev===b.dev&&a.ino===b.ino;}
function acquireRefreshLock(lock){
  for(let attempt=0;attempt<2;attempt++){
    try{const fd=fs.openSync(lock,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,createdAt:Date.now()})+'\n');return fd;}catch(error){fs.closeSync(fd);fs.unlinkSync(lock);throw error;}}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      try{
        const before=fs.lstatSync(lock);
        if(!before.isFile()||before.size>1024)return null;
        let owner=null;try{owner=JSON.parse(fs.readFileSync(lock,'utf8'));}catch{}
        const age=Date.now()-before.mtimeMs;
        let abandoned=false;
        if(Number.isSafeInteger(owner?.pid)&&owner.pid>0&&age>15000){
          try{process.kill(owner.pid,0);}catch(error){abandoned=error.code==='ESRCH';}
        }else if((before.size===0||!owner)&&age>15000)abandoned=true; // legacy or corrupt interrupted lock
        if(!abandoned||!sameFile(before,fs.lstatSync(lock)))return null;
        fs.unlinkSync(lock);
      }catch(error){if(error.code!=='ENOENT')return null;}
    }
  }
  return null;
}
export async function refreshLocalKnowledge(root,{force=false,fetchImpl=globalThis.fetch,token=process.env.GEMITRON_KB_TOKEN,timeoutMs=5000,now=Date.now()}={}){
  const current=readLocalKnowledge(root,{now});
  if(!force&&!current.refreshDue)return {status:'CURRENT',revision:current.manifest.revision,sourceCommit:current.sourceCommit,networkCalls:0};
  if(!token)return {status:'UNAVAILABLE',reason:'KB_PRIVATE_READ_CREDENTIAL_REQUIRED',fallback:current.source,networkCalls:0};
  if(!Number.isFinite(timeoutMs)||timeoutMs<100||timeoutMs>10000)throw Error('KB_TIMEOUT_INVALID');
  const file=cacheFile(root,true),lock=resolveDerivedPath(root,'.executionkit/decision/kb-refresh.lock','Decision KB lock',{file:true}),temp=resolveDerivedPath(root,'.executionkit/decision/kb-'+crypto.randomUUID()+'.tmp','Decision KB temporary file',{file:true});
  const fd=acquireRefreshLock(lock);
  if(fd===null)return {status:'UNAVAILABLE',reason:'KB_REFRESH_BUSY',fallback:current.source,networkCalls:0};
  const lockIdentity=fs.fstatSync(fd);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let calls=0;
  try{
    const base='https://api.github.com/repos/'+KB_REPOSITORY;
    const get=async(url,limit)=>{calls++;return boundedGet(fetchImpl,url,token,controller.signal,limit);};
    const branch=await get(base+'/branches/main',32*1024),commit=branch.commit?.sha;
    if(! /^[a-f0-9]{40}$/.test(commit??''))throw Error('KB_COMMIT_INVALID');
    const manifestRaw=decodeContent(await get(base+'/contents/manifest.json?ref='+commit,16*1024),'manifest.json',4096),manifest=JSON.parse(manifestRaw);
    const raw=decodeContent(await get(base+'/contents/catalog.json?ref='+commit,400*1024),'catalog.json',LIMIT);
    validateCatalogRelease(manifest,raw);
    // Inspect even an expired cache for rollback protection; expiry must not reset revision.
    let floor=current.manifest;
    if(fs.existsSync(file)){try{if(fs.statSync(file).size<=CACHE_LIMIT){const previous=JSON.parse(fs.readFileSync(file,'utf8'));validateCatalogRelease(previous.manifest,previous.raw);if(previous.manifest.revision>floor.revision)floor=previous.manifest;}}catch{}}
    if(manifest.revision<floor.revision||(manifest.revision===floor.revision&&manifest.sha256!==floor.sha256))throw Error('KB_REVISION_ROLLBACK_OR_CONFLICT');
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,sourceCommit:commit,fetchedAt:now,manifest,raw})+'\n',{mode:0o600,flag:'wx'});
    // Recheck the target path before replacing it; never follow a symbolic link.
    cacheFile(root);fs.renameSync(temp,file);
    return {status:'CURRENT',revision:manifest.revision,sourceCommit:commit,networkCalls:calls,changed:manifest.sha256!==current.manifest.sha256};
  }catch{return {status:'UNAVAILABLE',reason:'KB_REFRESH_REJECTED',fallback:current.source,networkCalls:calls};}
  finally{clearTimeout(timer);fs.closeSync(fd);fs.rmSync(temp,{force:true});try{if(sameFile(lockIdentity,fs.lstatSync(lock)))fs.unlinkSync(lock);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
export async function verifyAndApplyCanonicalKbSnapshot({
  issue,
  checkoutHead,
  kitRoot='.',
  readCandidateBlob,
  readCanonicalFile,
}={}){
  if(!issue||issue.title!=='[KB-SYNC] Validated canonical knowledge snapshot')throw Error('KB_SYNC_ISSUE_TITLE_INVALID');
  const body=String(issue.body??'');
  if(body.length>6000)throw Error('KB_SYNC_REQUEST_TOO_LARGE');
  let p;try{p=JSON.parse(body);}catch{throw Error('KB_SYNC_REQUEST_INVALID');}
  if(!p||Object.keys(p).sort().join(',')!==['protocol','expectedKitHead','catalogBlobSha','manifestBlobSha','sourceCommit','sourceRevision','sourceDigest'].sort().join(',')||
     p.protocol!=='KB_SYNC_V1')throw Error('KB_SYNC_REQUEST_INVALID');
  for(const key of ['expectedKitHead','catalogBlobSha','manifestBlobSha','sourceCommit']){
    if(!/^[a-f0-9]{40}$/.test(p[key]??''))throw Error('KB_SHA_INVALID_'+key);
  }
  if(!/^[a-f0-9]{64}$/.test(p.sourceDigest??'')||!Number.isSafeInteger(p.sourceRevision)||p.sourceRevision<1)
    throw Error('KB_SOURCE_IDENTITY_INVALID');
  if(checkoutHead!==p.expectedKitHead)throw Error('KB_KIT_HEAD_CHANGED');
  if(typeof readCandidateBlob!=='function')throw Error('KB_CANDIDATE_BLOB_READER_REQUIRED');
  if(typeof readCanonicalFile!=='function')throw Error('KB_CANONICAL_READ_CREDENTIAL_REQUIRED');
  const catalog=await readCandidateBlob(p.catalogBlobSha),manifestBytes=await readCandidateBlob(p.manifestBlobSha);
  const canonicalCatalog=await readCanonicalFile('catalog.json',p.sourceCommit);
  const canonicalManifest=await readCanonicalFile('manifest.json',p.sourceCommit);
  if(!catalog.equals(canonicalCatalog)||!manifestBytes.equals(canonicalManifest))
    throw Error('KB_CANONICAL_SOURCE_BYTES_MISMATCH');
  const next=JSON.parse(manifestBytes.toString('utf8'));
  if(next.revision!==p.sourceRevision||next.sha256!==p.sourceDigest)throw Error('KB_SOURCE_REFERENCE_MISMATCH');
  const rootDir=fs.realpathSync(kitRoot);
  const catPath=path.join(rootDir,'lib/decision/knowledge/catalog.json');
  const manPath=path.join(rootDir,'lib/decision/knowledge/manifest.json');
  for(const p of [catPath,manPath]){
    if(fs.lstatSync(p).isSymbolicLink())throw Error('KB_SYMLINK_TARGET_FORBIDDEN');
  }
  const old=JSON.parse(fs.readFileSync(manPath,'utf8'));
  if(next.revision<old.revision||(next.revision===old.revision&&next.sha256!==old.sha256))
    throw Error('KB_ROLLBACK_OR_REVISION_CONFLICT');
  validateCatalogRelease(next,catalog.toString('utf8'));
  const same=catalog.equals(fs.readFileSync(catPath))&&manifestBytes.equals(fs.readFileSync(manPath));
  if(!same){
    if(next.revision<=old.revision)throw Error('KB_NON_MONOTONIC_CHANGE');
    fs.writeFileSync(catPath,catalog);
    fs.writeFileSync(manPath,manifestBytes);
  }
  return {status:same?'ALREADY_SYNCHRONIZED':'CANDIDATE_VALIDATED',changed:!same,revision:next.revision,facts:next.factCount,rules:next.ruleCount};
}

