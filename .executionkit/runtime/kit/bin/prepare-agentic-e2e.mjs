#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { planAgenticJourneys } from '../lib/agentic-e2e.mjs';
import { spawnBoundedSync } from '../lib/bounded-process.mjs';

// CI setup is explicit: the gate runner never silently installs a moving dependency.
const root=path.resolve(process.argv[2]??'.');
try {
  const plan=planAgenticJourneys(root);
  if(plan.status==='NOT_APPLICABLE'){
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'applicable=false\n');
    console.log(JSON.stringify(plan));
  }else{
    if(plan.status!=='PLANNED')throw new Error(JSON.stringify(plan.errors));
    const m=plan.manifest;
    if(/[\r\n]/.test(m.suiteDir))throw new Error('CI suite paths cannot contain newlines');
    const lock=path.join(root,m.suiteDir,'package-lock.json');
    if(!fs.existsSync(lock)||fs.lstatSync(lock).isSymbolicLink())throw new Error('Commit the native agentic package-lock.json before CI');
    const cacheKey=crypto.createHash('sha256').update(fs.readFileSync(lock)).update(JSON.stringify({identity:m.app.identity,environment:m.app.environment,targets:m.targets})).digest('hex');
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`applicable=true\nsuite=${m.suiteDir}\ncache-key=${cacheKey}\n`);
    if(process.argv.includes('--install')){
      const run=(command,args,timeoutMs)=>{const r=spawnBoundedSync(command,args,{cwd:root,timeoutMs});process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status!==0||r.error)throw new Error('Agentic dependency/device setup failed');};
      run(process.platform==='win32'?'npm.cmd':'npm',['ci','--prefix',m.suiteDir,'--ignore-scripts','--no-audit','--no-fund'],300000);
      if(m.targets.some(t=>t.platform==='web'))run(process.execPath,[path.join(root,m.suiteDir,'node_modules/@e2e-dev/web/dist/bin.js'),'install','chromium'],300000);
    }
    console.log(JSON.stringify({status:'READY_FOR_SETUP',suite:m.suiteDir,cacheKey}));
  }
}catch(error){console.error(error.message);process.exitCode=1;}
