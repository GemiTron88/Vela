#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  repositoryChangeImpact,
  repositoryKnowledgeContext,
  repositoryEngineeringKnowledge,
  repositoryEngineeringKnowledgeRefresh,
  repositoryStoredEngineeringKnowledge,
  repositoryExternalKnowledgeIngest,
  repositoryExternalKnowledgeStored,
  repositoryExternalKnowledgeSearch,
  repositoryKnowledgeFreshness,
  repositoryKnowledgeRefresh,
  repositoryKnowledgeSearch,
  repositoryKnowledgeStatus,
  repositorySourceRead,
  repositorySymbolQuery,
  repositoryRelationshipQuery,
} from '../lib/repository-intelligence-api.mjs';

const argv=process.argv.slice(2);
const action=argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'status';
const rootArg=argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const root=path.resolve(rootArg);
const value=(name)=>{
  const exact=argv.find((arg)=>arg.startsWith(`--${name}=`));
  if(exact) return exact.slice(name.length+3);
  const i=argv.indexOf(`--${name}`);
  if(i<0) return undefined;
  const v=argv[i+1];
  if(!v||v.startsWith('--')) throw new Error(`Missing value for --${name}`);
  return v;
};
const int=(name,fallback)=>{const raw=value(name);if(raw===undefined)return fallback;const n=Number.parseInt(raw,10);if(!Number.isInteger(n))throw new Error(`--${name} must be an integer`);return n;};
const loadArtifact=()=>{
  const rel=value('artifact');
  if(!rel)return null;
  const full=path.resolve(root,rel);
  const delta=path.relative(root,full);
  if(!delta||delta.startsWith('..')||path.isAbsolute(delta))throw new Error('artifact path must stay inside project');
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error(`artifact file not found: ${rel}`);
  if(fs.statSync(full).size>1024*1024)throw new Error('artifact file exceeds 1 MiB safety limit');
  const realRoot=fs.realpathSync(root), realFile=fs.realpathSync(full), realDelta=path.relative(realRoot,realFile);
  if(!realDelta||realDelta.startsWith('..')||path.isAbsolute(realDelta))throw new Error('artifact realpath escapes project');
  return JSON.parse(fs.readFileSync(realFile,'utf8'));
};

try{
  let result;
  if(action==='status') result=repositoryKnowledgeStatus(root);
  else if(action==='context') result=repositoryKnowledgeContext(root,{maxBytes:int('max-bytes',undefined)});
  else if(action==='freshness') result=repositoryKnowledgeFreshness(root,{artifact:loadArtifact(),maxBytes:int('max-bytes',undefined)});
  else if(action==='engineering') result=repositoryEngineeringKnowledge(root,{persist:argv.includes('--persist'),includeDocs:argv.includes('--docs')});
  else if(action==='engineering-stored') result=repositoryStoredEngineeringKnowledge(root);
  else if(action==='engineering-refresh') result=repositoryEngineeringKnowledgeRefresh(root,{persist:argv.includes('--persist')});
  else if(action==='external-ingest') result=repositoryExternalKnowledgeIngest(root,{paths:value('paths')?.split(',').map((x)=>x.trim()).filter(Boolean)??null,persist:argv.includes('--persist')});
  else if(action==='external-stored') result=repositoryExternalKnowledgeStored(root);
  else if(action==='external-search') result=repositoryExternalKnowledgeSearch(root,value('query')??'',{limit:int('limit',20)});
  else if(action==='search') result=repositoryKnowledgeSearch(root,value('query')??'',{limit:int('limit',20),contextLines:int('context-lines',1)});
  else if(action==='read') result=repositorySourceRead(root,value('path')??'',{startLine:int('start-line',1),endLine:int('end-line',null),maxLines:int('max-lines',150)});
  else if(action==='impact') result=repositoryChangeImpact(root,{base:value('base')??'HEAD~1',graphDepth:int('depth',5)});
  else if(action==='relation') result=repositoryRelationshipQuery(root,value('op')??'',value('target')??'',{limit:int('limit',50),depth:int('depth',3)});
  else if(action==='symbol') result=repositorySymbolQuery(root,value('symbol')??'',{limit:int('limit',20)});
  else if(action==='refresh') result=repositoryKnowledgeRefresh(root,{existingArtifact:loadArtifact(),apply:argv.includes('--apply'),persist:argv.includes('--persist'),forceFull:argv.includes('--full'),maxBytes:int('max-bytes',undefined)});
  else if(action==='help') result={usage:'node bin/repository-intelligence.mjs status|context|engineering|engineering-stored|engineering-refresh|external-ingest|external-stored|external-search|freshness|search|read|symbol|impact|relation|refresh [project] [options]',notes:['search --query <text>','relation --op callers|callees|impact|search --target <value> [--limit N --depth N]','read --path <file> [--start-line N --end-line N --max-lines N]','freshness [--artifact <json>]','refresh [--artifact <json>] [--apply] [--persist] [--full]','--persist writes only the validated compact artifact under configured .executionkit storage']};
  else throw new Error(`Unknown Repository Intelligence action: ${action}`);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  console.error(JSON.stringify({status:'BLOCKED',error:error.message}));
  process.exitCode=1;
}
