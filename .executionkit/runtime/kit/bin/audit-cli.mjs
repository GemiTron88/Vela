#!/usr/bin/env node
// Source CLI audit: real dispatch in disposable projects; never production hosts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {CLI_COMMAND_REGISTRY} from '../lib/v4-cli-contract.mjs';
import {planV4Installation,applyV4Installation} from '../lib/v4-installer.mjs';
const source=fileURLToPath(new URL('../',import.meta.url)),root=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-cli-audit-')),empty=path.join(root,'not-installed');
const errors=[],cases=[];
// This disposable source-audit asks commands to stop before its own watchdog.
// Keep margin for Node startup, nested cleanup and structured failure output.
const AUDIT_INTERNAL_TIMEOUT_MS=7000;
const AUDIT_COMMAND_TIMEOUT_MS=12000;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(?:TOKEN|SECRET|PASSWORD|SSH_AUTH|PRIVATE_KEY)/i.test(key)));
env.GIT_TERMINAL_PROMPT='0';
const cli=path.join(source,'bin/executionkit-cli.mjs');
function clean(dir){fs.chmodSync(dir,0o755);for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory()&&!e.isSymbolicLink())clean(path.join(dir,e.name));}
try{
  fs.mkdirSync(empty);
  for(const args of [['init','-q'],['config','user.name','CLI Audit'],['config','user.email','cli-audit@example.invalid']])spawnSync('git',args,{cwd:root,env,encoding:'utf8'});
  fs.writeFileSync(path.join(root,'README.md'),'# Disposable CLI audit product\n');
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/product.js'),'export const product = 1;\n');
  spawnSync('git',['add','.'],{cwd:root,env});spawnSync('git',['commit','-qm','fixture'],{cwd:root,env});
  applyV4Installation(planV4Installation(root,{source,targetVersion:'5.2.3'}));
  // Keep external check commands out of this isolated source-dispatch audit.
  const config=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json')));
  config.v4.systems.test.commands={wave:[],phase:[]};
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(config));
  const request=path.join(root,'request.json');fs.writeFileSync(request,JSON.stringify({schemaVersion:2,requestId:'cli-audit',event:'preflight',action:'read',hostClass:'vps',environment:'development',signals:{}}));
  for(const spec of CLI_COMMAND_REGISTRY){
    const actions=spec.subcommands.length?spec.subcommands:[null];
    for(const action of actions){
      const label=[spec.name,action].filter(Boolean).join(' ');let args=[spec.name,...(action?[action]:[])],project=root,expectation='LOCAL_DISPATCH_OR_HONEST_GATE';
      if(['install','update','upgrade','repair'].includes(spec.name)){args.push('--source',path.join(root,'missing-source'));expectation='INVALID_SOURCE_REFUSED';}
      if(spec.name==='platform'&&action==='provision'){args.push('--source',path.join(root,'missing-source'));expectation='INVALID_SOURCE_REFUSED';}
      if(spec.name==='self-update'){project=empty;expectation='UNINSTALLED_PROJECT';}
      if(spec.name==='decision'&&action==='advise')args.push('--input',request);
      if(spec.name==='decision'&&action==='refresh')expectation='PRIVATE_KB_NO_CREDENTIAL_FALLBACK';
      if(spec.name==='guard')args.push('--all');
      if(spec.name==='reconcile'&&action!=='status')args.push('--base','HEAD','--no-doc-commit','--timeout-ms',String(AUDIT_INTERNAL_TIMEOUT_MS));
      if(spec.name==='boundary')args.push('--base','HEAD','--timeout-ms',String(AUDIT_INTERNAL_TIMEOUT_MS));
      if(spec.name==='launch'&&action==='service'){args=['launch','service',root,'status','--config',path.join(root,'missing-service-config')];}
      const started=Date.now();
      // Insert project only after command/subcommand; top-level commands have one token.
      const argv=[spec.name,...(action?[action]:[]),project,...args.slice(action?2:1)];
      if(spec.name==='launch'&&action==='service')argv.splice(0,argv.length,'launch','service','status',project,'--config',path.join(root,'missing-service-config'));
      const r=spawnSync(process.execPath,[cli,...argv],{cwd:project,env,encoding:'utf8',timeout:AUDIT_COMMAND_TIMEOUT_MS,maxBuffer:512*1024,windowsHide:true,shell:false});
      let value=null,outputChannel='stdout';try{value=JSON.parse(r.stdout);}catch{if(r.status!==0&&!r.stdout.trim()){try{value=JSON.parse(r.stderr.trim().split('\n').at(-1));outputChannel='stderr';}catch{}}}
      const timedOut=r.error?.code==='ETIMEDOUT',unknown=['UNKNOWN_COMMAND','UNKNOWN_ACTION'].includes(value?.code);
      const bounded=Buffer.byteLength(r.stdout??'')<=32768; // discovery help is intentionally larger than normal envelopes
      const ok=!timedOut&&!unknown&&[0,1,2].includes(r.status)&&value!==null&&bounded;
      if(!ok)errors.push({command:label,code:timedOut?'COMMAND_TIMEOUT':unknown?'REGISTRY_DISPATCH_DRIFT':!value?'MACHINE_OUTPUT_INVALID':'OUTPUT_OR_EXIT_CONTRACT',exitCode:r.status,stderr:String(r.stderr??'').slice(-300)});
      cases.push({command:label,expectation,status:ok?'PASS':'FAIL',outputChannel,returnedStatus:value?.status??null,returnedCode:value?.code??null,exitCode:r.status,stdoutBytes:Buffer.byteLength(r.stdout??''),durationMs:Date.now()-started});
      process.stderr.write(JSON.stringify({operation:'cli-audit',command:label,status:ok?'PASS':'FAIL',durationMs:Date.now()-started})+'\n');
    }
  }
  const extraCases=[
    ...['status','plan','submit','agents','cancel','control','attest','release','approve','publish','rollback','provider','classify','history','doctor','build','inspect','handoff','import'].map(mode=>({command:'launch mobile --mode '+mode,argv:['launch','mobile',root,'--mode',mode],expectation:'NO_REMOTE_CONFIG_OR_NATIVE_AUTHORITY'})),
    ...['start','status'].map(action=>({command:'launch service '+action,argv:['launch','service',action,root,'--config',path.join(root,'missing-service-config')],expectation:'MISSING_SERVICE_CONFIG_REFUSED'})),
    ...CLI_COMMAND_REGISTRY.filter(spec=>spec.subcommands.length).map(spec=>({command:spec.name+' <invalid-action>',argv:[spec.name,'__invalid_action__',root],expectation:'UNKNOWN_ACTION_REFUSED'}))
  ];
  for(const item of extraCases){
    const started=Date.now(),r=spawnSync(process.execPath,[cli,...item.argv],{cwd:root,env,encoding:'utf8',timeout:AUDIT_COMMAND_TIMEOUT_MS,maxBuffer:512*1024,windowsHide:true,shell:false});
    let value=null,outputChannel='stdout';try{value=JSON.parse(r.stdout);}catch{try{value=JSON.parse(r.stderr.trim().split('\n').at(-1));outputChannel='stderr';}catch{}}
    const refused=r.status!==0&&r.error?.code!=='ETIMEDOUT'&&value!==null;
    if(!refused)errors.push({command:item.command,code:'REFUSAL_CONTRACT_FAILED',exitCode:r.status,error:r.error?.message??null});
    cases.push({command:item.command,expectation:item.expectation,status:refused?'PASS':'FAIL',outputChannel,returnedStatus:value?.status??null,returnedCode:value?.code??null,exitCode:r.status,stdoutBytes:Buffer.byteLength(r.stdout??''),durationMs:Date.now()-started});
    process.stderr.write(JSON.stringify({operation:'cli-audit',command:item.command,status:refused?'PASS':'FAIL',durationMs:Date.now()-started})+'\n');
  }
  const report={schemaVersion:'executionkit-cli-command-audit/v1',status:errors.length?'FAIL':'PASS',scope:'DISPOSABLE_LOCAL_PROJECTS',caseCount:cases.length,cases,errors,limitations:['Runtime browser/physical device/provider/production success remains separate evidence','Mutations without required approval/config/source are exercised through refusal paths; focused regressions cover successful lifecycles']};
  const i=process.argv.indexOf('--output');if(i>=0){const out=path.resolve(process.argv[i+1]);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,caseCount:cases.length,errors}));process.exitCode=errors.length?1:0;
}finally{clean(root);fs.rmSync(root,{recursive:true,force:true});}
