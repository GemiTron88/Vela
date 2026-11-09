#!/usr/bin/env node
// Opt-in paid/provider pilot. Three distinct adapter risks, never product acceptance.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { executeAgenticJourneys } from '../lib/agentic-e2e.mjs';
import { spawnBoundedSync } from '../lib/bounded-process.mjs';
const kit=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const option=name=>{const i=args.indexOf('--'+name);return i<0?null:args[i+1];};
let server;
try {
 const root=path.resolve(option('project')??fs.mkdtempSync(path.join(os.tmpdir(),'ek-agentic-runtime-')));
 const variant=option('variant')??'healthy',port=Number(option('port')??4444);
 if(!['healthy','rename','partial-save'].includes(variant)||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use healthy, rename or partial-save and an unprivileged port');
 fs.mkdirSync(root,{recursive:true});
 if(!fs.existsSync(path.join(root,'executionkit.journeys.json'))){
  if(fs.readdirSync(root).length)throw new Error('Fixture setup requires an empty project directory');
  const initialized=spawnSync(process.execPath,[path.join(kit,'bin/init-agentic-e2e.mjs'),root],{encoding:'utf8'});
  if(initialized.status!==0)throw new Error(initialized.stderr);
  for(const file of ['server.mjs','executionkit.journeys.json'])fs.copyFileSync(path.join(kit,'tests/fixtures/agentic-runtime',file),path.join(root,file));
  fs.copyFileSync(path.join(kit,'tests/fixtures/agentic-runtime/workflows.e2e.ts'),path.join(root,'tests/agentic/workflows.e2e.ts'));
  fs.writeFileSync(path.join(root,'.gitignore'),'.executionkit/\nnode_modules/\n');
  const m=JSON.parse(fs.readFileSync(path.join(root,'executionkit.journeys.json')));
  m.app.revision=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.mjs'))).digest('hex');
  fs.writeFileSync(path.join(root,'executionkit.journeys.json'),JSON.stringify(m,null,2)+'\n');
  for(const argv of [['init','-q'],['add','.'],['-c','user.name=ExecutionKit fixture','-c','user.email=fixture@example.invalid','commit','-qm','Explicit adapter fixture, not product evidence']]){
   const g=spawnSync('git',argv,{cwd:root,encoding:'utf8'});if(g.status!==0)throw new Error(g.stderr);
  }
 }
 const m=JSON.parse(fs.readFileSync(path.join(root,'executionkit.journeys.json')));
 if(m.app?.identity!=='ExecutionKit-local-integration-fixture')throw new Error('This command runs only the explicit Kit fixture');
 if(args.includes('--install')){
  const install=spawnBoundedSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--prefix','tests/agentic','--ignore-scripts','--no-audit','--no-fund'],{cwd:root,timeoutMs:300000});
  process.stdout.write(install.stdout);process.stderr.write(install.stderr);if(install.status!==0||install.error)throw new Error('Fixture producer installation failed');
 }
 fs.mkdirSync(path.join(root,'.executionkit'),{recursive:true});
 fs.writeFileSync(path.join(root,'.executionkit/variant.json'),JSON.stringify({rename:variant==='rename',partialSave:variant==='partial-save'}));
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,EXECUTIONKIT_AGENTIC_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture did not start')),5000);server.once('error',reject);server.once('exit',code=>{clearTimeout(timer);reject(new Error('Fixture server exited '+code));});server.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
 process.env.EXECUTIONKIT_E2E_APP_URL=`http://127.0.0.1:${port}`;
 process.env.EXECUTIONKIT_E2E_ENVIRONMENT_URL=process.env.EXECUTIONKIT_E2E_APP_URL+'/environment';
 const gate=executeAgenticJourneys(root);
 console.log(JSON.stringify({project:root,variant,gate},null,2));process.exitCode=gate.status==='PASS'?0:gate.status==='BLOCKED'?2:1;
}catch(error){console.error(error.message);process.exitCode=2;}finally{server?.kill();}
