#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {validateV4SystemRuntimeSurfaces,V5_SYSTEM_RUNTIME_CONTRACT} from '../lib/v4-systems-status.mjs';
import {validateV4InvariantRegistry,V4_INVARIANT_REGISTRY,sourceMatchesV4Invariant} from '../lib/v4-invariant-registry.mjs';
import {CLI_COMMAND_REGISTRY,CLI_VERSION} from '../lib/v4-cli-contract.mjs';
import {validateV5DecisionPolicy,V5_SYSTEM_NAMES} from '../lib/v5-config.mjs';
import {validateCatalogRelease} from '../lib/decision/kb-sync.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),projectRoot=process.argv[2]&&!process.argv[2].startsWith('--')?path.resolve(process.argv[2]):root,started=performance.now(),errors=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const run=args=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:64*1024,windowsHide:true,shell:false});
function walk(rel){const full=path.join(root,rel);if(!fs.existsSync(full))return [];return fs.readdirSync(full,{withFileTypes:true}).flatMap(e=>e.isSymbolicLink()?[]:e.isDirectory()&&!['node_modules','__pycache__'].includes(e.name)?walk(rel+'/'+e.name):e.isFile()?[rel+'/'+e.name]:[]);}
const files=[...walk('bin'),...walk('lib'),...walk('scripts')].sort();
const systems=validateV4SystemRuntimeSurfaces(root,{v5:true});errors.push(...systems.errors);
const registry=validateV4InvariantRegistry();errors.push(...registry.errors);
const invariants=V4_INVARIANT_REGISTRY.map(item=>{
  const sources=item.sources.map(pattern=>({pattern,matches:files.filter(rel=>sourceMatchesV4Invariant(rel,pattern)).length+(fs.existsSync(path.join(root,pattern))&&!files.includes(pattern)?1:0)}));
  for(const source of sources)if(!source.matches&&(!source.pattern.startsWith('scripts/')||fs.existsSync(path.join(root,'scripts'))))errors.push({code:'REVIEW_INVARIANT_SOURCE_MISSING',id:item.id,path:source.pattern});
  return {id:item.id,checks:item.checks,sources};
});
const helpers=files.filter(rel=>rel.endsWith('.mjs')).map(rel=>{
  const result=run(['--check',rel]);
  if(result.status!==0)errors.push({code:'REVIEW_HELPER_SYNTAX_FAILED',path:rel});
  return {path:rel,status:result.status===0?'PASS':'FAIL',sha256:crypto.createHash('sha256').update(read(rel)).digest('hex')};
});
const cli=[];
for(const command of CLI_COMMAND_REGISTRY){
  const surfaces=[[],...(command.subcommands??[]).map(sub=>[sub])];
  for(const sub of surfaces){
    const args=[command.name,...sub,'--help'],result=run(['bin/executionkit-cli.mjs',...args]);let value=null;
    try{value=JSON.parse(result.stdout);}catch{}
    const ok=result.status===0&&value?.status==='OK';
    if(!ok)errors.push({code:'REVIEW_CLI_HELP_FAILED',command:args.join(' ')});
    cli.push({command:args.join(' '),status:ok?'PASS':'FAIL',outputBytes:Buffer.byteLength(result.stdout??'')});
  }
}
const config=JSON.parse(read('templates/execution.config.v5.json'));errors.push(...validateV5DecisionPolicy(config));
const schema=JSON.parse(read('schemas/execution-config-v5.schema.json'));
if(!V5_SYSTEM_NAMES.every(name=>schema.properties.v4.properties.systems.required.includes(name)))errors.push({code:'REVIEW_V5_SCHEMA_SYSTEM_MISSING'});
const raw=read('lib/decision/knowledge/catalog.json').replace(/\r\n/g,'\n'),manifest=JSON.parse(read('lib/decision/knowledge/manifest.json'));
const kb=validateCatalogRelease(manifest,raw);
const requiredDocs=['STANDARD_V5.md','README.md','PLAYBOOK.md','AGENTS.md','templates/AGENTS_V5.md'];
for(const rel of requiredDocs){
  const full=fs.existsSync(path.join(root,rel))?path.join(root,rel):fs.existsSync(path.join(projectRoot,rel))?path.join(projectRoot,rel):null;
  if(!full)continue;
  const text=fs.readFileSync(full,'utf8');
  if((!['AGENTS.md','templates/AGENTS_V5.md'].includes(rel)&&!/v5|V5/.test(text))||!/(?:eleven|11)/.test(text))errors.push({code:'REVIEW_V5_DOC_AUTHORITY_MISSING',path:rel});
}
const guards=['lib/database-integrity.mjs','lib/route-integrity.mjs','lib/surface-integrity.mjs','lib/ux-guard.mjs','lib/flutter-guard.mjs','lib/visuals-guard.mjs','lib/perf-guard.mjs','lib/lighthouse-gate.mjs','lib/visual-os.mjs','lib/agentic-e2e.mjs'].map(rel=>({path:rel,syntax:helpers.find(h=>h.path===rel)?.status??'MISSING',scope:'SOURCE_CONTRACT; runtime coverage is in npm run v5:check'}));
const report={schemaVersion:'executionkit-v5-source-review/v1',status:errors.length?'FAIL':'PASS',scope:'SOURCE_ONLY',version:CLI_VERSION,systemCount:Object.keys(systems.systems).length,systems,contracts:V5_SYSTEM_RUNTIME_CONTRACT,invariantCount:invariants.length,invariants,helpers,cli,guards,knowledge:{repository:manifest.repository,revision:manifest.revision,factCount:kb.catalog.facts.length,ruleCount:kb.catalog.rules.length,domains:[...new Set(kb.catalog.facts.map(f=>f.domain))],sha256:manifest.sha256},documentation:requiredDocs,errors,durationMs:Math.round(performance.now()-started),acceptance:{liveConsumer:'NOT_RUN',staging:'NOT_RUN',physical:'NOT_RUN',production:'NOT_RUN'}};
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){const output=process.argv[outputIndex+1];if(!output)throw Error('Missing --output path');fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,scope:report.scope,version:report.version,systems:report.systemCount,invariants:report.invariantCount,helpers:helpers.length,cliSurfaces:cli.length,knowledge:report.knowledge,errors:report.errors,durationMs:report.durationMs}));
process.exitCode=errors.length?1:0;
