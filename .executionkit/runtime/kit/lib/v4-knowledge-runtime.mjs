import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig } from './execution-model.mjs';
import {
  repositoryChangeImpact,
  repositoryEngineeringKnowledge,
  repositoryKnowledgeContext,
  repositoryKnowledgeSearch,
} from './repository-intelligence-api.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { captureV4WorktreeIdentity } from './v4-gate-identity.mjs';

const LATEST='.executionkit/repository-intelligence/provider-usage-latest.json';
const JOURNAL='.executionkit/repository-intelligence/provider-usage.ndjson';
const MAX_JOURNAL_BYTES=1024*1024;
const CONTEXT_CACHE_REL='.executionkit/repository-intelligence/context-cache.json';
const memoryContextCache=new Map();

export function clearV4KnowledgeContextCache(){memoryContextCache.clear();}

function contextCacheFile(root){
  try{return resolveDerivedPath(root,CONTEXT_CACHE_REL,'v4 knowledge context cache',{createParents:true});}
  catch{return null;}
}
function readDiskContextCache(root){
  try{
    const file=contextCacheFile(root);
    if(file&&fs.existsSync(file)){
      const data=JSON.parse(fs.readFileSync(file,'utf8'));
      if(data&&typeof data==='object'&&data.schemaVersion==='executionkit-v4-context-cache/v1')return data.entries??{};
    }
  }catch{}
  return null;
}
function writeDiskContextCache(root,entries){
  try{
    const file=contextCacheFile(root);
    if(!file)return;
    const keys=Object.keys(entries??{});
    const pruned=keys.length>64?Object.fromEntries(keys.slice(-64).map((k)=>[k,entries[k]])):(entries??{});
    fs.writeFileSync(file,JSON.stringify({schemaVersion:'executionkit-v4-context-cache/v1',savedAt:new Date().toISOString(),entries:pruned},null,2)+'\n');
  }catch{}
}
function bounded(value,maxBytes=16384){
  const text=typeof value==='string'?value:JSON.stringify(value);
  if(Buffer.byteLength(text,'utf8')<=maxBytes)return text;
  let out=text.slice(0,Math.min(text.length,maxBytes)).replace(/[\uD800-\uDBFF]$/,'');
  while(Buffer.byteLength(out,'utf8')>maxBytes)out=out.slice(0,Math.floor(out.length*0.9)).replace(/[\uD800-\uDBFF]$/,'');
  return out+'\n[TRUNCATED_BY_EXECUTIONKIT]';
}
function gitText(root,args){
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  if(r.status!==0)throw new Error(String(r.stderr||r.stdout||r.error?.message||'git command failed').trim());
  return String(r.stdout??'').trim();
}
function record(root,event){
  const payload={schemaVersion:'executionkit-v4-provider-usage/v1',observedAt:new Date().toISOString(),runtimeMode:'NATIVE_ONLY',...event};
  const latest=resolveDerivedPath(root,LATEST,'v4 provider usage latest',{createParents:true});
  fs.writeFileSync(latest,JSON.stringify(payload,null,2)+'\n');
  const journal=resolveDerivedPath(root,JOURNAL,'v4 provider usage journal',{createParents:true});
  if(fs.existsSync(journal)&&fs.statSync(journal).size>MAX_JOURNAL_BYTES){
    const previous=journal+'.previous';fs.rmSync(previous,{force:true});fs.renameSync(journal,previous);
  }
  fs.appendFileSync(journal,JSON.stringify(payload)+'\n');
  return payload;
}

export function readV4ProviderUsage(root){
  const file=resolveDerivedPath(root,LATEST,'v4 provider usage latest');
  if(!fs.existsSync(file))return {status:'UNUSED',usage:null};
  try{return {status:'OBSERVED',usage:JSON.parse(fs.readFileSync(file,'utf8'))};}
  catch(error){return {status:'INVALID',usage:null,error:error.message};}
}
export function readV4ProviderUsageHistory(root,{limit=200}={}){
  if(!Number.isInteger(limit)||limit<1||limit>2000)throw new Error('provider usage history limit must be 1..2000');
  const file=resolveDerivedPath(root,JOURNAL,'v4 provider usage journal');
  if(!fs.existsSync(file))return {status:'UNUSED',entries:[]};
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2*MAX_JOURNAL_BYTES)return {status:'INVALID',entries:[],error:'provider usage journal is unsafe or oversized'};
  try{
    const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean);
    return {status:'OBSERVED',entries:lines.slice(-limit).map((line)=>JSON.parse(line)).filter((entry)=>entry?.schemaVersion==='executionkit-v4-provider-usage/v1')};
  }catch(error){return {status:'INVALID',entries:[],error:error.message};}
}

function baseDecision(root,purpose){
  let head=null;try{head=gitText(root,['rev-parse','HEAD']);}catch{}
  return {
    purpose,
    head,
    runtimeMode:'NATIVE_ONLY',
    externalToolsEnabled:false,
    preferred:['native-source-pack','native-macro-context','native-git'],
    fallback:null,
    providers:[
      {id:'native-source-pack',status:'READY',version:'1.0.0'},
      {id:'native-macro-context',status:'READY',version:'1.0.0'},
      {id:'native-git',status:'READY',version:'builtin'},
    ],
  };
}

export function useV4Knowledge(root,{
  purpose='agent-context',
  query=null,
  target=null,
  operation='search',
  base='HEAD~1',
  gitArgs=['git','status'],
  maxBytes=null,
  operations={},
  forceRefresh=false,
  worktreeIdentity=null,
  requestRepomix=null,
  crossCutting=false,
}={}){
  root=path.resolve(root);
  const {config}=loadConfig(root);
  if(config.repositoryIntelligence?.enabled===false)throw new Error('v4 Knowledge Fabric requires Repository Intelligence enabled');
  const decision=baseDecision(root,purpose);
  const ops={
    impact:repositoryChangeImpact,
    nativeContext:repositoryKnowledgeContext,
    nativeSearch:repositoryKnowledgeSearch,
    nativeEngineering:repositoryEngineeringKnowledge,
    ...operations,
  };
  const contextLimit=maxBytes??config.repositoryIntelligence?.context?.maxBytes??16384;
  const mode='native';
  let cacheKey=null;

  if(['agent-context','source-pack','macro-context','docs-context'].includes(purpose)&&!forceRefresh&&!query){
    const wtId=worktreeIdentity??(()=>{try{return captureV4WorktreeIdentity(root);}catch{return {head:decision.head,worktreeFingerprint:null};}})();
    if(wtId.head&&wtId.worktreeFingerprint){
      cacheKey=`${wtId.head}:${wtId.worktreeFingerprint}:${purpose}:${mode}:${contextLimit}`;
      let cached=memoryContextCache.get(`${root}:${cacheKey}`);
      if(!cached){
        const disk=readDiskContextCache(root);
        if(disk?.[cacheKey]){cached=disk[cacheKey];memoryContextCache.set(`${root}:${cacheKey}`,cached);}
      }
      if(cached){
        const evidence=record(root,{purpose,outcome:'NATIVE_CACHE',attempted:[],used:cached.decision.used??[],externalUsed:[],repositoryHead:decision.head,cached:true});
        return {schemaVersion:'executionkit-v4-knowledge-use/v1',status:'OK',fromCache:true,decision:{...cached.decision,head:decision.head},data:cached.data,evidence};
      }
    }
  }

  let data;
  let used=[];
  if(['agent-context','source-pack','macro-context'].includes(purpose)){
    const native=ops.nativeContext(root,{maxBytes:contextLimit});
    data={context:bounded(native?.artifact?.body??native,contextLimit),provenance:native};
    used=['native-macro-context'];
  }else if(purpose==='docs-context'){
    const native=ops.nativeEngineering(root,{persist:false,includeDocs:false});
    data={context:bounded(native?.artifact??native,contextLimit),provenance:native};
    used=['native-engineering-knowledge'];
  }else if(['knowledge-search','relationship','symbol-relationship'].includes(purpose)){
    data=ops.nativeSearch(root,target??query??'',{limit:20,contextLines:1});
    used=['native-source-pack'];
  }else if(['impact','test-impact'].includes(purpose)){
    data=ops.impact(root,{base});
    used=['native-change-impact'];
  }else if(purpose==='git-read'){
    if(!Array.isArray(gitArgs)||gitArgs[0]!=='git')throw new Error('git-read requires gitArgs beginning with git');
    data={output:bounded(gitText(root,gitArgs.slice(1)),contextLimit),provenance:{provider:'native-git'}};
    used=['native-git'];
  }else throw new Error('Unsupported v4 knowledge purpose: '+purpose);

  const ignoredExternalRequest=requestRepomix===true||crossCutting===true;
  const evidence=record(root,{
    purpose,
    outcome:'NATIVE',
    attempted:[],
    used,
    externalUsed:[],
    fallbackReason:ignoredExternalRequest?'external_tools_removed_native_used':null,
    repositoryHead:decision.head,
  });
  const resultDecision={...decision,outcome:'NATIVE',attempted:[],used,externalUsed:[],fallbackReason:evidence.fallbackReason??null};

  if(cacheKey&&data){
    const entry={cacheKey,purpose,mode,contextLimit,decision:resultDecision,data,evidence,cachedAt:new Date().toISOString()};
    memoryContextCache.set(`${root}:${cacheKey}`,entry);
    const disk=readDiskContextCache(root)??{};disk[cacheKey]=entry;writeDiskContextCache(root,disk);
  }
  return {schemaVersion:'executionkit-v4-knowledge-use/v1',status:'OK',decision:resultDecision,data,evidence};
}
