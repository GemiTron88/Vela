import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildSourcePack, searchSourcePack, readPackedFile } from './repository-source.mjs';
import { buildNativeMacroContext, planContextRefresh } from './repository-context.mjs';
import { buildEngineeringKnowledge } from './repository-engineering-knowledge.mjs';

function elapsed(start){return Math.round((performance.now()-start)*1000)/1000;}
function percentile(values,p){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];}

export function evaluateRepositoryIntelligence(root,{queries=[],iterations=3,contextMaxBytes=16*1024,packOptions={}}={}) {
  if(!Number.isInteger(iterations)||iterations<1||iterations>20) throw new Error('iterations must be 1..20');
  const absolute=path.resolve(root);
  const packTimes=[],contextTimes=[],engineeringTimes=[],searchTimes=[],readTimes=[];
  let pack,context,engineering;
  for(let i=0;i<iterations;i++){
    let start=performance.now(); pack=buildSourcePack(absolute,packOptions); packTimes.push(elapsed(start));
    start=performance.now(); context=buildNativeMacroContext(pack,{maxBytes:contextMaxBytes}); contextTimes.push(elapsed(start));
    start=performance.now(); engineering=buildEngineeringKnowledge(pack); engineeringTimes.push(elapsed(start));
  }
  const queryResults=[];
  for(const query of queries){
    const text=typeof query==='string'?query:query.query;
    const expected=typeof query==='string'?[]:(query.expectedPaths??[]);
    let start=performance.now(); const hits=searchSourcePack(pack,text,{limit:50,contextLines:0}); searchTimes.push(elapsed(start));
    const paths=[...new Set(hits.map((hit)=>hit.path))];
    const found=expected.filter((item)=>paths.includes(item));
    const recall=expected.length?found.length/expected.length:null;
    let sample=null;
    if(hits[0]){start=performance.now();sample=readPackedFile(pack,hits[0].path,{startLine:Math.max(1,hits[0].line-2),endLine:hits[0].line+2,maxLines:5});readTimes.push(elapsed(start));}
    const sampleBytes=sample?.content?Buffer.byteLength(sample.content,'utf8'):0;
    const sampleTokens=Math.ceil(sampleBytes/4);
    const packTokens=pack.metrics.totalEstimatedTokens||0;
    queryResults.push({
      query:text,expectedPaths:expected,hitPaths:paths.slice(0,20),expectedFound:found,recall,
      sample:{path:sample?.path??null,startLine:sample?.startLine??null,endLine:sample?.endLine??null,bytes:sampleBytes,estimatedTokens:sampleTokens},
      retrieval:{plannedToolCalls:hits[0]?2:1,estimatedTokenReductionRatio:packTokens>0?Math.max(0,1-(sampleTokens/packTokens)):null},
    });
  }
  return {
    schemaVersion:'repository-intelligence-evaluation/v1',
    repository:{baselineSha:pack.repository.baselineSha,dirty:pack.repository.dirty,fileCount:pack.metrics.fileCount,totalBytes:pack.metrics.totalBytes,totalEstimatedTokens:pack.metrics.totalEstimatedTokens,skippedCount:pack.metrics.skippedCount},
    context:{
      bytes:context.metrics.bytes,estimatedTokens:context.metrics.tokens,maxBytes:contextMaxBytes,
      orientationTokenReductionRatio:pack.metrics.totalEstimatedTokens>0?Math.max(0,1-(context.metrics.tokens/pack.metrics.totalEstimatedTokens)):null,
    },
    engineering:{sectionCount:engineering.metrics.sectionCount,sourceRefCount:engineering.metrics.sourceRefCount,fingerprints:Object.fromEntries(Object.entries(engineering.sections).map(([key,value])=>[key,value.fingerprint]))},
    latencyMs:{
      pack:{median:percentile(packTimes,.5),p95:percentile(packTimes,.95),samples:packTimes},
      context:{median:percentile(contextTimes,.5),p95:percentile(contextTimes,.95),samples:contextTimes},
      engineering:{median:percentile(engineeringTimes,.5),p95:percentile(engineeringTimes,.95),samples:engineeringTimes},
      search:{median:percentile(searchTimes,.5),p95:percentile(searchTimes,.95),samples:searchTimes},
      read:{median:percentile(readTimes,.5),p95:percentile(readTimes,.95),samples:readTimes}
    },
    queries:queryResults,
    claims:{fullPackPreloaded:false,sourceReadsBounded:true,measuredTokenEstimate:true,toolCallsAreRetrievalPlanCountsNotObservedModelCalls:true},
  };
}

export function loadEvaluationQueries(root,file){
  if(!file)return [];
  const full=path.resolve(root,file),delta=path.relative(path.resolve(root),full);
  if(!delta||delta.startsWith('..')||path.isAbsolute(delta)) throw new Error('evaluation query file must stay inside repository');
  const stat=fs.lstatSync(full); if(stat.isSymbolicLink()||!stat.isFile()||stat.size>1024*1024) throw new Error('evaluation query file is unsafe');
  const value=JSON.parse(fs.readFileSync(full,'utf8'));
  if(!Array.isArray(value)) throw new Error('evaluation query file must contain an array');
  return value;
}

export function evaluateRefreshPlan(root,artifact,options={}){return planContextRefresh(root,artifact,options);}
