#!/usr/bin/env node
// Opt-in real-browser infrastructure pilot. Customer certification is separate.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { git, writeJSON } from '../lib/visual-contract.mjs';
import { planVisualMatrix } from '../lib/visual-surface.mjs';
import { captureVisualMatrix } from '../lib/visual-capture.mjs';
import { inspectVisualRun } from '../lib/visual-critic.mjs';
import { executeAgenticJourneys } from '../lib/agentic-e2e.mjs';
import { auditVisualRun, certifyVisualRun } from '../lib/visual-audit.mjs';
const args=process.argv.slice(2),value=(k,d=null)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;},kit=path.resolve(import.meta.dirname,'..');
const root=path.resolve(value('project',fs.mkdtempSync(path.join(os.tmpdir(),'ek-visual-runtime-')))),port=Number(value('port','4555'));let server;
try{
  fs.mkdirSync(root,{recursive:true});
  if(!fs.existsSync(path.join(root,'executionkit.visual.json'))){
    if(fs.readdirSync(root).length)throw new Error('Pilot initialization requires an empty directory');
    for(const name of ['server.mjs','index.html','receipt.html','styles.css'])fs.copyFileSync(path.join(kit,'tests/fixtures/visual-runtime',name),path.join(root,name));
    fs.mkdirSync(path.join(root,'tests/visual'),{recursive:true});fs.copyFileSync(path.join(kit,'tests/fixtures/visual-runtime/hooks.mjs'),path.join(root,'tests/visual/hooks.mjs'));
    fs.writeFileSync(path.join(root,'.gitignore'),'.executionkit/\nnode_modules/\n');fs.writeFileSync(path.join(root,'package.json'),'{"name":"executionkit-visual-runtime-fixture","private":true,"type":"module"}\n');
    // The known injected faults are real CSS in the initial committed source.
    if(args.includes('--faults'))fs.appendFileSync(path.join(root,'styles.css'),fs.readFileSync(path.join(kit,'tests/fixtures/visual-runtime/defects.css')));
    const cfg=JSON.parse(fs.readFileSync(path.join(kit,'templates/visual/executionkit.visual.json')));cfg.app.identity='ExecutionKit-visual-runtime-fixture';cfg.capture.baseUrl=`http://127.0.0.1:${port}`;cfg.capture.probeUrl=cfg.capture.baseUrl+'/visual-build';cfg.capture.playwrightPackage='package.json';cfg.capture.hook='tests/visual/hooks.mjs';cfg.capture.producerId='chromium-fixture-producer';cfg.critic.reviewerId='independent-rendered-product-critic';cfg.budgets={maxCells:80,maxCellsPerSurface:40,timeoutMs:1800000,maxReviewCalls:80};cfg.viewports=[{id:'mobile',width:375,height:812},{id:'desktop',width:1280,height:800}];
    if(process.env.EXECUTIONKIT_VISUAL_CHROMIUM)cfg.capture.executablePath=process.env.EXECUTIONKIT_VISUAL_CHROMIUM;
    const surface=(surfaceId,route,sourcePaths,states=['loaded'])=>({surfaceId,route,sourcePaths,platform:'web',personas:['fixture-owner'],authentication:false,permissions:[],owner:'kit-pilot',entryMethod:'route',criticality:'normal',states});
    cfg.surfaces=[{...surface('stock.workspace','/',['index.html']),criticality:'high'}, {...surface('stock.saved','/saved',['receipt.html'],['success']),primaryState:'success',locales:['en']}, {...surface('stock.inventory','/stock',['receipt.html']),locales:['en']}, {...surface('stock.report','/report',['receipt.html']),locales:['en']}, {...surface('stock.recovery','/invalid',['receipt.html']),locales:['en']}];writeJSON(path.join(root,'executionkit.visual.json'),cfg);
    git(root,['init','-q']);git(root,['config','user.name','ExecutionKit pilot']);git(root,['config','user.email','pilot@local.invalid']);git(root,['add','.']);git(root,['commit','-qm','Explicit Visual OS runtime fixture with production-shaped states']);
  }
  if(JSON.parse(fs.readFileSync(path.join(root,'executionkit.visual.json'))).app.identity!=='ExecutionKit-visual-runtime-fixture')throw new Error('This pilot runs only its explicit fixture');
  if(args.includes('--init-journeys')){
    const suite=path.join(root,'tests/agentic');if(fs.existsSync(path.join(root,'executionkit.journeys.json')))throw new Error('Refuse to overwrite an existing journey suite');fs.mkdirSync(suite,{recursive:true});
    for(const name of ['package.json','package-lock.json','environment-probe.mjs','.gitignore'])fs.copyFileSync(path.join(kit,'templates/agentic',name),path.join(suite,name));
    fs.copyFileSync(path.join(kit,'lib/agentic-postconditions.mjs'),path.join(suite,'postconditions.mjs'));
    for(const name of ['workflows.e2e.ts','engine.mjs'])fs.copyFileSync(path.join(kit,'tests/fixtures/visual-runtime',name),path.join(suite,name));
    fs.writeFileSync(path.join(suite,'e2e.config.ts'),`import {createEvidenceStore} from './postconditions.mjs';
import {engine} from './engine.mjs';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
const host=process.env.EXECUTIONKIT_E2E_HOST_EXECUTOR;
const provider=host?null:createOpenAICompatible({name:'executionkit-fixture',baseURL:process.env.EXECUTIONKIT_E2E_MODEL_URL!,apiKey:process.env.EXECUTIONKIT_E2E_MODEL_KEY});
const agent=host?{executor:(await import(host)).default}:{model:provider!(process.env.EXECUTIONKIT_E2E_MODEL!)};
export default {tests:'**/*.e2e.ts',targets:[{name:'web-fixture',engine,app:{url:process.env.EXECUTIONKIT_E2E_APP_URL!,identity:'ExecutionKit-visual-runtime-fixture',environment:'test'}}],agents:{default:{...agent,maxModelCalls:12,maxSteps:20,judgmentTimeout:180000}},workers:1,retries:0,timeout:240000,trace:'on',artifacts:{store:createEvidenceStore()},cache:{mode:'read-write',dir:'.e2e/cache',strict:false}};
`);
    const revision=crypto.createHash('sha256').update(['server.mjs','index.html','receipt.html','styles.css'].map(p=>fs.readFileSync(path.join(root,p))).join('\n')).digest('hex');
    const classes=['critical-happy-path','cross-feature-workflow','adversarial-recovery'],ids=['SAVE','REPORT','RECOVER'],titles=['Save complete item','Stock links to movement report','Expired link recovers without writes'],surfaces=['stock.saved','stock.report','stock.workspace'];
    const journeys=ids.map((id,i)=>({id:'KIT-'+id,class:classes[i],target:'web-fixture',title:titles[i],source:'tests/agentic/workflows.e2e.ts',risks:['fixture-'+id.toLowerCase()],taskIds:['EK4-VISUAL-001'],postconditions:['backend','ui'].map(kind=>({id:(kind==='backend'?'db-':'ui-')+id.toLowerCase(),kind,assertion:kind==='backend'?'All persisted fields and mutation count are correct':'The expected view remains visible after reload'})),visualCheckpoints:[{id:'final',surface:surfaces[i],state:i===0?'success':'loaded'}]}));
    writeJSON(path.join(root,'executionkit.journeys.json'),{schemaVersion:'executionkit-agentic/v1',app:{identity:'ExecutionKit-visual-runtime-fixture',revision,environment:'test'},suiteDir:'tests/agentic',config:'tests/agentic/e2e.config.ts',targets:[{name:'web-fixture',platform:'web',role:'fixture-owner',locale:'en-US',viewport:{width:1280,height:800}}],journeys,budgets:{timeoutMs:600000,maxModelCalls:60,maxModelTokens:200000,maxJourneys:3},environmentProbe:{command:'node',args:['tests/agentic/environment-probe.mjs']}});
    const cfg=JSON.parse(fs.readFileSync(path.join(root,'executionkit.visual.json')));cfg.capture.playwrightPackage='tests/agentic/package.json';for(const [i,id] of surfaces.entries()){const surface=cfg.surfaces.find(s=>s.surfaceId===id);surface.requiredCells=[{persona:'fixture-owner',locale:'en',theme:'light',viewport:'desktop',state:i===0?'success':'loaded'}];}writeJSON(path.join(root,'executionkit.visual.json'),cfg);
    git(root,['add','.']);git(root,['commit','-qm','Wire the three real semantic journeys to current rendered checkpoints']);
    console.log(JSON.stringify({status:'SCAFFOLDED',project:root,reason:'Install pinned tests/agentic dependencies and provision real model/browser before --journeys'}));
  }else if(args.includes('--plan')){console.log(JSON.stringify({project:root,plan:planVisualMatrix(root,{mode:'full'})}));}
  else {
    process.env.EXECUTIONKIT_E2E_APP_URL??=`http://127.0.0.1:${port}`;process.env.EXECUTIONKIT_E2E_ENVIRONMENT_URL??=process.env.EXECUTIONKIT_E2E_APP_URL+'/environment';process.env.EXECUTIONKIT_VISUAL_JOURNEY_MODULE??=new URL('../lib/visual-journeys.mjs',import.meta.url).href;
    server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,EXECUTIONKIT_VISUAL_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','inherit']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Pilot server failed to start')),5000);server.once('error',reject);server.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});server.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
    const journeys=args.includes('--journeys')?executeAgenticJourneys(root,{boundary:'phase'}):null;if(journeys&&journeys.status!=='PASS')throw new Error(JSON.stringify(journeys));
    const capture=await captureVisualMatrix(root,{mode:'full',resume:journeys?.visualRunId??null});if(capture.status!=='CAPTURED')throw new Error(JSON.stringify(capture));
    const review=args.includes('--capture-only')?null:await inspectVisualRun(root,{runId:capture.runId});
    const audit=args.includes('--capture-only')?auditVisualRun(root,{runId:capture.runId}):await certifyVisualRun(root,{runId:capture.runId});
    console.log(JSON.stringify({schemaVersion:'executionkit-visual-pilot/v2',project:root,scope:'KIT_INFRASTRUCTURE_ONLY',journeys,capture,review,audit}));process.exitCode=args.includes('--capture-only')?0:audit.status==='PASS'?0:1;
  }
}catch(error){console.log(JSON.stringify({status:'FAIL',scope:'KIT_INFRASTRUCTURE_ONLY',message:error.message}));process.exitCode=1;}finally{server?.kill();}
