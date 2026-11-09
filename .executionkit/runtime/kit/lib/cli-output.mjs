import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {resolveDerivedPath} from './derived-state.mjs';

export const CLI_OUTPUT_BUDGET=4096;
const important=['schemaVersion','status','blocked','ok','code','error','message','reason','action','taskId','sourceCommit','candidateId','commit','head','version','boundary','nextCommand','cliEntry','gatePath','evidencePath','enforcement','blockers','errors','findings','hostAction','hostDelegations','claims','subagentSpec','workerPrompt','performance','runtime','systems','fabrics'];
function project(value,limits,omitted,at='',depth=0){
  if(typeof value==='string'){
    const textLimit=/(?:workerPrompt|prompt)$/.test(at)?Math.max(limits.text*4,600):limits.text;
    if(value.length>textLimit){omitted[at]='text';return value.slice(0,textLimit)+'…';}
    return value;
  }
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value)){
    const cap=value.every(item=>typeof item==='string'&&item.length<80)?Math.max(limits.items*2,12):limits.items;
    if(value.length>cap)omitted[at]=value.length-cap;
    return value.slice(0,cap).map((item,i)=>project(item,limits,omitted,at+'['+i+']',depth+1));
  }
  const entries=Object.entries(value),ordered=entries.sort(([a],[b])=>{const ai=important.indexOf(a),bi=important.indexOf(b);return (ai<0?1000:ai)-(bi<0?1000:bi);});
  const cap=depth===0?40:depth>=limits.depth?6:limits.keys;
  if(entries.length>cap)omitted[at||'$']=entries.length-cap;
  return Object.fromEntries(ordered.slice(0,cap).map(([key,item])=>[key,depth>=limits.depth&&key!=='subagentSpec'&&item&&typeof item==='object'?{count:Array.isArray(item)?item.length:Object.keys(item).length}:project(item,limits,omitted,at?at+'.'+key:key,depth+1)]));
}
function retainPayload(root,command,raw){
  if(!fs.existsSync(path.join(root,'.executionkit/.gitignore')))return null;
  const name=String(command).replace(/[^a-z0-9-]/gi,'').slice(0,48)||'command';
  const rel='.executionkit/cli-output/'+name+'-'+randomUUID()+'.json';
  const full=resolveDerivedPath(root,rel,'CLI detail cache',{file:true,createParents:true});
  fs.writeFileSync(full,raw+'\n',{flag:'wx',mode:0o600});
  const files=fs.readdirSync(path.dirname(full)).filter(file=>new RegExp('^'+name+'-[a-f0-9-]{36}\\.json$').test(file)).map(file=>({file,mtime:fs.statSync(resolveDerivedPath(root,'.executionkit/cli-output/'+file,'CLI detail cache',{file:true})).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);
  for(const item of files.slice(2))fs.rmSync(resolveDerivedPath(root,'.executionkit/cli-output/'+item.file,'CLI detail cache',{file:true}));
  return rel;
}
function stripPassingLogs(item){
  if(!item||typeof item!=='object'||Array.isArray(item))return item;
  const ok=item.ok===true||['PASS','CURRENT','VALID','VALIDATED','NOT_APPLICABLE','AVAILABLE','INSTALLED','ACTIVE','READY','SYNCHRONIZED','IN_SYNC','COMPLETED'].includes(item.status);
  if(!ok)return item;
  const next={...item};
  for(const k of ['stdout','stderr','stdoutTail','stderrTail','portableInvocation','rawOutput'])delete next[k];
  return next;
}
export function compactCliResult(value,{root=null,command='command',budget=CLI_OUTPUT_BUDGET,full=false,persist=true}={}){
  if(full||value===null||typeof value!=='object')return value;
  const sensitive=item=>item&&typeof item==='object'&&Object.entries(item).some(([key,child])=>/^(?:token|secret|password|privateKey|authorization|credential)$/i.test(key)&&typeof child==='string'&&child.length>0||sensitive(child));
  // One-time credential responses must remain usable and are never cached here.
  if(sensitive(value))return value;
  const raw=JSON.stringify(value);
  let concise=value;
  const passed=item=>item?.ok===true||['PASS','CURRENT','VALID','VALIDATED','NOT_APPLICABLE','AVAILABLE','INSTALLED','ACTIVE','READY','SYNCHRONIZED','IN_SYNC','COMPLETED'].includes(item?.status);
  for(const key of ['checks','runs','results','rows','stages'])if(Array.isArray(value[key])&&value[key].some(passed)){
    concise={...concise,[key]:value[key].filter(item=>!passed(item)),[key+'Summary']:{total:value[key].length,passed:value[key].filter(passed).length,remaining:value[key].filter(item=>!passed(item)).length}};
  }
  const healthyStatus=['PASS','OK','CURRENT','VALID','VALIDATED','INSTALLED','ACTIVE','READY','SYNCHRONIZED','IN_SYNC','NOT_APPLICABLE','COMPLETED','SEALED','NO_CHANGE','SKIPPED'].includes(value.status)||(value.ok===true&&!value.status);
  const hasProblems=value.blocked===true||(Array.isArray(value.errors)&&value.errors.length>0)||(Array.isArray(value.blockers)&&value.blockers.length>0)||(Array.isArray(value.findings)&&value.findings.length>0);
  const isHealthy=healthyStatus&&!hasProblems;
  if(concise.rehydration?.status==='FRESH'&&concise.snapshot&&typeof concise.rehydration==='object'){
    concise={...concise,rehydration:{status:'FRESH',safeToResume:concise.rehydration.safeToResume??true,drift:concise.rehydration.drift??[]}};
  }
  if(isHealthy&&concise.runsSummary&&concise.schemaVersion==='executionkit-v4-test-gate/v1'){
    const next={...concise};
    delete next.impact;delete next.knowledge;delete next.commands;
    if(next.selection?.targeted)next.targeted=next.selection.targeted;
    delete next.selection;
    concise=next;
  }
  if(isHealthy&&Buffer.byteLength(raw)>1536){
    const next={...concise};
    for(const key of ['scannedFiles','sourceFiles','limitations','negativeRegressions','runtimeEvidenceRequired','visualHeatmapMarkdown','modelsByFqcn']){
      if(Array.isArray(next[key])){if(next[key+'Count']===undefined)next[key+'Count']=next[key].length;delete next[key];}
      else if(next[key]&&typeof next[key]==='object'){if(next[key+'Count']===undefined)next[key+'Count']=Object.keys(next[key]).length;delete next[key];}
      else if(typeof next[key]==='string'&&next[key].length>256)delete next[key];
    }
    for(const mapKey of ['gates','systems'])if(next[mapKey]&&typeof next[mapKey]==='object'&&!Array.isArray(next[mapKey])){
      next[mapKey]=Object.fromEntries(Object.entries(next[mapKey]).map(([k,v])=>[k,stripPassingLogs(v)]));
    }
    concise=next;
  }
  const conciseBytes=Buffer.byteLength(JSON.stringify(concise));
  if(concise!==value){
    let detailPath=null;
    if((!isHealthy||conciseBytes>budget)&&root&&persist)try{detailPath=retainPayload(root,command,raw);}catch{}
    concise.output={compact:true,fullBytes:Buffer.byteLength(raw),...(detailPath?{detailPath}:{}),fullOutputFlag:'--full-output'};
  }
  if(Buffer.byteLength(JSON.stringify(concise))<=budget)return concise;
  // Discovery keeps every command while omitting optional flag repetition.
  if(Array.isArray(value.commands)&&Array.isArray(value.usage)){
    const discovery={...value,usage:[...new Set(value.usage.map(line=>String(line).replace(/\s+\[(?!project\])[^\]]+\]/g,'').replace(/\s+--[^\s]+.*$/,'')))],output:{compact:true,fullBytes:Buffer.byteLength(raw),fullOutputFlag:'--full-output'}};
    if(Buffer.byteLength(JSON.stringify(discovery))<=budget)return discovery;
  }
  let detailPath=concise.output?.detailPath??null;if(root&&persist&&!detailPath)try{detailPath=retainPayload(root,command,raw);}catch{}
  let output;
  for(const limits of [{items:6,keys:16,depth:3,text:240},{items:3,keys:10,depth:2,text:160},{items:2,keys:8,depth:1,text:120}]){
    const omitted={};output=project(concise,limits,omitted);
    output.output={compact:true,fullBytes:Buffer.byteLength(raw),detailPath,fullOutputFlag:'--full-output',omittedCount:Object.keys(omitted).length,counts:Object.fromEntries(['errors','blockers','findings','checks','runs','results','writes','deletes','commands','rows','stages'].filter(key=>Array.isArray(value[key])).map(key=>[key,value[key].length]))};
    if(Buffer.byteLength(JSON.stringify(output))<=budget)return output;
  }
  // No result is promoted to PASS; the original status and exit code remain authoritative.
  const minimal={};
  for(const key of ['schemaVersion','status','blocked','ok','code','error','message','reason','nextCommand']){
    if(!Object.hasOwn(output,key))continue;
    const item=output[key];
    if(item===null||typeof item!=='object')minimal[key]=typeof item==='string'?item.slice(0,120):item;
  }
  minimal.output=output.output;
  return minimal;
}
export function renderHumanCli(value,{color=false}={}){
  const status=value.status??(value.blocked?'BLOCKED':value.ok===true?'PASS':'RESULT');
  const failed=value.blocked===true||['FAIL','FAILED','BLOCKED','INVALID','UNAVAILABLE'].includes(status),mark=failed?'✗':['PASS','OK','CURRENT','INSTALLED','AVAILABLE','PROVISIONED','SYNCHRONIZED','IN_SYNC','COMPLETED','VALID','VALIDATED'].includes(status)?'✓':'•';
  const vSuffix=value.version&&!value.commands?' (v'+value.version+')':'';
  const line=mark+' '+status+vSuffix,prefix=color?'\u001b['+(failed?'31':'32')+'m':'';
  const out=[prefix+line+(color?'\u001b[0m':'')];
  if(value.message||value.reason)out.push('  '+(value.message??value.reason));
  if(value.runtime?.task?.id){
    const t=value.runtime.task;
    out.push('  Task: '+t.id+' ('+(t.state??'READY')+')'+(t.title?' — '+t.title:'')+(t.sourcePath?' ['+t.sourcePath+(t.startLine?':'+t.startLine:'')+']':''));
  }
  if(value.hostAction&&value.hostAction!=='NONE')out.push('  Host Action: '+value.hostAction);
  if(typeof value.outputTail==='string'&&value.outputTail.trim()&&!value.message&&!value.reason)out.push(value.outputTail.trim());
  const list=key=>Array.isArray(value[key])?value[key]:[];
  for(const item of [...list('blockers'),...list('errors'),...list('findings')].slice(0,6))out.push('  '+(typeof item==='string'?item:(item?.code??'finding')+(item?.message?': '+item.message:'')));
  if(Array.isArray(value.usage))out.push(...value.usage);
  if(value.nextCommand)out.push('→ '+value.nextCommand);
  for(const key of ['checksSummary','runsSummary','resultsSummary','stagesSummary'])if(value[key])out.push(key.replace('Summary','')+': '+value[key].passed+'/'+value[key].total+' passed');
  if(value.performance?.totalMs!==undefined)out.push('time: '+value.performance.totalMs+'ms');
  if(value.output?.counts)out.push(Object.entries(value.output.counts).map(([key,n])=>key+': '+n).join(' · '));
  if(value.output?.detailPath)out.push('Details: '+value.output.detailPath);
  return out.join('\n');
}
