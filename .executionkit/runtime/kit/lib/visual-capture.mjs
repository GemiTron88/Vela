import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ensureDerivedStateDirectory } from './derived-state.mjs';
import { VISUAL_ROOT, digest, loadVisualConfig, readJSON, runDirectory, safeVisualPath, sealVisual, scrubRuntime, sha256, sourceIdentity, verifySealed, visualLocaleMatches, writeJSON } from './visual-contract.mjs';
import { planVisualMatrix } from './visual-surface.mjs';
import { inspectVisualImage,VISUAL_MAX_PIXELS } from './visual-image.mjs';
import { collectWebGeometry } from './visual-geometry.mjs';
import { validateVisualSchema, visualArtifactSchema, visualRunSchema } from './visual-schema.mjs';
import { sanitizeVisualTrace } from './visual-trace.mjs';

export function observeVisualRuntime(page,{runtime:shared=null}={}){
  const runtime=shared??{consoleErrors:[],exceptions:[],failedRequests:[],httpErrors:[],unexpectedRedirects:[],flutterExceptions:[],complete:true},listeners=[];
  const push=(key,value)=>{if(runtime[key].length>=100){runtime.complete=false;return;}runtime[key].push(value);};
  const on=(event,fn)=>{page.on(event,fn);listeners.push([event,fn]);};
  on('console',m=>{if(m.type()==='error')push('consoleErrors',scrubRuntime(m.text()));});
  on('pageerror',e=>push('exceptions',scrubRuntime(e.message)));
  on('requestfailed',r=>push('failedRequests',scrubRuntime(r.url())+' '+scrubRuntime(r.failure()?.errorText??'failure')));
  on('response',r=>{if(r.status()>=400)push('httpErrors',{url:scrubRuntime(r.url()),status:r.status()});});
  return {runtime,dispose(){for(const [event,fn] of listeners)page.off(event,fn);}};
}
async function loadHooks(root,cfg){
  if(!cfg.capture.hook)throw new Error('A project session/state/live-observation hook is required');
  const mod=await import(pathToFileURL(safeVisualPath(root,cfg.capture.hook,{mustExist:true,file:true})).href);
  for(const name of ['prepare','observe'])if(typeof mod[name]!=='function')throw new Error('Visual hook must implement '+name);
  return mod;
}
function sameObservation(cfg,cell,identity,observed){
  if(observed.appIdentity!==cfg.app.identity||observed.revision!==identity.gitSha)throw new Error('VISUAL_RUNTIME_BUILD_MISMATCH');
  for(const k of ['persona','locale','direction','theme','state'])if(observed[k]!==cell[k])throw new Error('VISUAL_RUNTIME_DIMENSION_MISMATCH: '+k);
  if(!observed.fixtureSet||observed.fixtureData===undefined||observed.stateData===undefined)throw new Error('VISUAL_LIVE_FIXTURES_REQUIRED');
  if(observed.route!==cell.route)throw new Error('VISUAL_WRONG_ROUTE');
}
export function beginVisualRun(root,{config=null,plan=null,mode='full',base=null,changedFiles=[]}={}){
  const cfg=config??loadVisualConfig(root),p=plan??planVisualMatrix(root,{config:cfg,mode,base,changedFiles});
  if(p.status!=='PLANNED')throw new Error('VISUAL_PLAN_BLOCKED: '+JSON.stringify(p.issues));
  ensureDerivedStateDirectory(root);const identity=sourceIdentity(root),runId=crypto.randomUUID(),dir=safeVisualPath(root,`${VISUAL_ROOT}/runs/${runId}`);
  fs.mkdirSync(dir,{recursive:true});writeJSON(path.join(dir,'plan.json'),p,true);writeJSON(path.join(dir,'census.json'),p.census,true);
  const run={schemaVersion:'executionkit-visual-run/v2',runId,mode:p.mode,...identity,startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),producerId:cfg.capture.producerId,configDigest:digest(cfg),planDigest:p.planDigest,censusDigest:p.censusDigest,expectedCells:p.expectedCells,entries:[],failures:[]};
  writeJSON(path.join(dir,'manifest.json'),sealVisual(run),true);
  return {root,cfg,plan:p,run,dir,identity};
}
export function finishVisualRun(session){
  const {root,cfg,run,dir,identity}=session;
  if(digest(loadVisualConfig(root))!==digest(cfg)||digest(sourceIdentity(root))!==digest(identity))throw new Error('VISUAL_SOURCE_CHANGED_DURING_CAPTURE');
  run.completedAt=new Date().toISOString();const sealed=sealVisual(run);validateVisualSchema(visualRunSchema,sealed);writeJSON(path.join(dir,'manifest.json'),sealed);
  // One active image per planned state. Re-capture atomically replaces this
  // index; old runs are temporary diagnostics, never a second baseline tree.
  writeJSON(safeVisualPath(root,`${VISUAL_ROOT}/current.json`),{
    schemaVersion:'executionkit-visual-current/v2',runId:run.runId,gitSha:run.gitSha,
    updatedAt:run.completedAt,evidenceModel:'CURRENT_STATE',
    cells:session.plan.cells.map(cell=>{const entry=run.entries.find(e=>e.cellId===cell.cellId);return {cellId:cell.cellId,surfaceId:cell.surfaceId,state:cell.state,image:entry?{path:`${VISUAL_ROOT}/runs/${run.runId}/${entry.image.path}`,sha256:entry.image.sha256}:null};})
  });
  return {schemaVersion:'executionkit-visual-capture-result/v2',status:run.failures.length?'FAIL':'CAPTURED',runId:run.runId,expected:run.expectedCells,captured:run.entries.length,failures:run.failures};
}
export function resumeVisualCapture(root,runId){
  const dir=runDirectory(root,runId),run=readJSON(path.join(dir,'manifest.json')),cfg=loadVisualConfig(root),identity=sourceIdentity(root),plan=readJSON(path.join(dir,'plan.json'));
  if(!verifySealed(run)||run.gitSha!==identity.gitSha||run.configDigest!==digest(cfg)||Date.now()-Date.parse(run.startedAt)>cfg.budgets.timeoutMs)throw new Error('VISUAL_RESUME_STALE_OR_CHANGED');
  return {root,cfg,dir,run:{...run,signature:undefined},plan,identity};
}
export async function captureWebCheckpoint(session,{page,cell,runtime,hooks=null,journey=null,trace=null}){
  const {root,cfg,dir,run,identity}=session;if(run.entries.some(x=>x.cellId===cell.cellId))throw new Error('VISUAL_CHECKPOINT_ALREADY_CAPTURED');
  const h=hooks??await loadHooks(root,cfg),observed=await h.observe({page,cell,config:cfg,root});sameObservation(cfg,cell,identity,observed);
  const url=new URL(page.url()),expected=new URL(cell.route,cfg.capture.baseUrl??process.env.EXECUTIONKIT_E2E_APP_URL);
  if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.search!==expected.search)throw new Error('VISUAL_UNEXPECTED_REDIRECT');
  const geometry=await page.evaluate(collectWebGeometry);
  if(geometry.viewport.width!==cell.viewport.width||geometry.viewport.height!==cell.viewport.height||geometry.htmlDirection!==cell.direction||!visualLocaleMatches(geometry.htmlLocale,cell.locale))throw new Error('VISUAL_RENDERED_DIMENSION_MISMATCH');
  if(geometry.theme!==cell.theme)throw new Error('VISUAL_RENDERED_THEME_UNVERIFIED: expose the actual applied theme via html data-theme');
  if(cell.viewport.width*Math.max(cell.viewport.height,cfg.capture.fullPage!==false?geometry.documentHeight:cell.viewport.height)>VISUAL_MAX_PIXELS)throw new Error('VISUAL_CAPTURE_PIXEL_BUDGET: page exceeds the existing image decoder limit; bind bounded meaningful states instead of allocating an oversized screenshot');
  const selectors=['input[type=password]','input[type=email]','input[type=tel]','input[autocomplete*=cc-]','[data-visual-private]',...(cfg.capture.redactionSelectors??[])],mask=selectors.map(s=>page.locator(s));let maskCount=0;for(const locator of mask)maskCount+=await locator.count();
  const bytes=await page.screenshot({type:'png',fullPage:cfg.capture.fullPage!==false,animations:'disabled',mask,maskColor:'#202020'}),image=inspectVisualImage(bytes);
  if(image.blank){const rejected=`rejected/${cell.cellId}.png`;fs.mkdirSync(path.join(dir,'rejected'),{recursive:true});fs.writeFileSync(path.join(dir,rejected),bytes,{flag:'wx'});writeJSON(path.join(dir,'rejected',cell.cellId+'.json'),sealVisual({runId:run.runId,cell,gitSha:identity.gitSha,captureTime:new Date().toISOString(),reason:'VISUAL_IMAGE_BLANK',image:{path:rejected,sha256:image.imageSha256},geometry}),true);throw new Error('VISUAL_IMAGE_BLANK');}
  const imagePath=`images/${cell.cellId}.png`,geometryPath=`geometry/${cell.cellId}.json`;
  fs.mkdirSync(path.join(dir,'images'),{recursive:true});fs.writeFileSync(safeVisualPath(dir,imagePath),bytes,{flag:'wx'});writeJSON(safeVisualPath(dir,geometryPath),geometry,true);
  const entry={schemaVersion:'executionkit-visual-artifact/v2',runId:run.runId,cellId:cell.cellId,surfaceId:cell.surfaceId,route:cell.route,actualRoute:url.pathname+url.search,...identity,captureTime:new Date().toISOString(),app:{identity:cfg.app.identity,revision:observed.revision,environment:cfg.app.environment},persona:cell.persona,locale:cell.locale,direction:cell.direction,theme:cell.theme,viewport:cell.viewport,state:cell.state,dataState:cell.dataState,fixtureSet:observed.fixtureSet,fixtureHash:digest(observed.fixtureData),stateHash:digest(observed.stateData),engine:{type:'playwright',version:page.context().browser()?.version()??'connected-browser',producerId:cfg.capture.producerId},image:{path:imagePath,sha256:image.imageSha256,perceptualHash:image.perceptualHash,width:image.width,height:image.height},geometry:{path:geometryPath,sha256:sha256(fs.readFileSync(path.join(dir,geometryPath)))},runtime:structuredClone(runtime),privacy:{policy:'synthetic-fixtures',maskCount},...(journey?{journey}:{}),...(trace?{trace}:{})};
  entry.captureExtent=cfg.capture.fullPage!==false?'full-page':'viewport';
  const sealed=sealVisual(entry);validateVisualSchema(visualArtifactSchema,sealed);run.entries.push(sealed);writeJSON(path.join(dir,'manifest.json'),sealVisual({...run,completedAt:new Date().toISOString()}));return sealed;
}
function deviceCommand(executable,args,{binary=false}={}){
  const r=spawnSync(executable,args,{encoding:binary?null:'utf8',timeout:20000,maxBuffer:64*1024*1024,windowsHide:true});if(r.error||r.status!==0)throw new Error('VISUAL_DEVICE_COMMAND_FAILED: '+scrubRuntime(String(r.stderr||r.error?.message)));return r.stdout;
}
export function assertMobileFocus(observed,{platform,bundleId}){
  if(!observed.focus||!bundleId||!observed.focus.includes(bundleId)||/(?:launcher|HomeActivity|SpringBoard)/i.test(observed.focus))throw new Error('VISUAL_WRONG_APP_FOCUS');
  if(!['android','ios'].includes(platform))throw new Error('Unsupported device platform');
}
export async function captureMobileCheckpoint(session,{cell,hooks=null,journey=null}){
  const {root,cfg,run,dir,identity}=session,h=hooks??await loadHooks(root,cfg),device=cfg.capture.mobile;
  if(!device?.deviceId||!device.bundleId||!['android','ios'].includes(device.platform))throw new Error('VISUAL_DEVICE_NOT_PROVISIONED');
  const observed=await h.observe({cell,config:cfg,root});sameObservation(cfg,cell,identity,observed);
  const focus=device.platform==='android'?deviceCommand(device.adb??'adb',['-s',device.deviceId,'shell','dumpsys','window','windows']):deviceCommand('xcrun',['simctl','spawn',device.deviceId,'launchctl','list']);
  // iOS needs an instrumented foreground-app attestation. A process list alone
  // does not prove the simulator is displaying this app.
  const focused=device.platform==='android'?focus.split('\n').filter(l=>/mCurrentFocus|mFocusedApp/.test(l)).join('\n'):observed.focus;
  assertMobileFocus({focus:focused},device);
  if(device.platform==='ios'&&(!observed.foregroundVerified||!focus.includes(device.bundleId)))throw new Error('VISUAL_IOS_FOREGROUND_UNVERIFIED');
  if(!observed.geometry||!observed.runtime||!observed.navigationVerified)throw new Error('VISUAL_MOBILE_INSTRUMENTATION_REQUIRED: semantics/render tree, navigation and runtime health');
  const imagePath=`images/${cell.cellId}.png`;fs.mkdirSync(path.join(dir,'images'),{recursive:true});const imageFile=safeVisualPath(dir,imagePath);
  if(device.platform==='android')fs.writeFileSync(imageFile,deviceCommand(device.adb??'adb',['-s',device.deviceId,'exec-out','screencap','-p'],{binary:true}),{flag:'wx'});else {if(fs.existsSync(imageFile))throw new Error('Mobile evidence is immutable');deviceCommand('xcrun',['simctl','io',device.deviceId,'screenshot','--type=png',imageFile]);}
  const img=inspectVisualImage(fs.readFileSync(imageFile));if(img.blank)throw new Error('VISUAL_IMAGE_BLANK');
  if(img.width!==cell.viewport.width||img.height!==cell.viewport.height)throw new Error('VISUAL_MOBILE_DEVICE_DIMENSIONS_MISMATCH');
  const geometry={...observed.geometry,platform:'flutter',focus:focused},geometryPath=`geometry/${cell.cellId}.json`;writeJSON(safeVisualPath(dir,geometryPath),geometry,true);
  const entry=sealVisual({schemaVersion:'executionkit-visual-artifact/v2',runId:run.runId,cellId:cell.cellId,surfaceId:cell.surfaceId,route:cell.route,actualRoute:observed.route,...identity,captureTime:new Date().toISOString(),app:{identity:cfg.app.identity,revision:observed.revision,environment:cfg.app.environment},persona:cell.persona,locale:cell.locale,direction:cell.direction,theme:cell.theme,viewport:cell.viewport,state:cell.state,dataState:cell.dataState,captureExtent:'viewport',fixtureSet:observed.fixtureSet,fixtureHash:digest(observed.fixtureData),stateHash:digest(observed.stateData),engine:{type:device.platform==='android'?'android-adb':'ios-simulator',version:observed.deviceVersion,producerId:cfg.capture.producerId},image:{path:imagePath,sha256:img.imageSha256,perceptualHash:img.perceptualHash,width:img.width,height:img.height},geometry:{path:geometryPath,sha256:sha256(fs.readFileSync(path.join(dir,geometryPath)))},runtime:observed.runtime,privacy:{policy:'synthetic-fixtures',maskCount:observed.maskCount??0},...(journey?{journey}:{})});
  validateVisualSchema(visualArtifactSchema,entry);run.entries.push(entry);writeJSON(path.join(dir,'manifest.json'),sealVisual({...run,completedAt:new Date().toISOString()}));return entry;
}
export async function captureVisualMatrix(root,{mode='full',base=null,changedFiles=[],config=null,resume=null}={}){
  const session=resume?resumeVisualCapture(root,resume):beginVisualRun(root,{config,mode,base,changedFiles}),{cfg,plan,dir}=session,hooks=await loadHooks(root,cfg),deadline=Date.parse(session.run.startedAt)+cfg.budgets.timeoutMs;
  if(plan.mode!==mode)throw new Error('VISUAL_RESUME_MODE_MISMATCH');
  let browser=null;
  try{
    if(plan.cells.some(c=>c.platform==='web')){
      const req=createRequire(safeVisualPath(root,cfg.capture.playwrightPackage,{mustExist:true,file:true})),{chromium}=req('playwright-core');
      browser=await chromium.launch({headless:true,...(cfg.capture.executablePath?{executablePath:cfg.capture.executablePath}:{})});
    }
    for(const cell of plan.cells){
      if(session.run.entries.some(e=>e.cellId===cell.cellId))continue;
      if(Date.now()>=deadline){session.run.failures.push({cellId:cell.cellId,code:'VISUAL_CAPTURE_TIMEOUT',message:'Matrix exceeded the reviewed runtime budget'});break;}
      let context=null,observer=null;
      try{
        if(cell.platform==='web'){
          context=await browser.newContext({viewport:{width:cell.viewport.width,height:cell.viewport.height},locale:cell.locale,colorScheme:cell.theme,deviceScaleFactor:1});
          const page=await context.newPage();page.setDefaultTimeout(Math.min(15000,Math.max(1000,deadline-Date.now())));page.setDefaultNavigationTimeout(Math.min(20000,Math.max(1000,deadline-Date.now())));observer=observeVisualRuntime(page);
          await hooks.prepare({page,context,cell,config:cfg,root});await page.evaluate(()=>document.fonts.ready);
          await context.tracing.start({screenshots:false,snapshots:false,sources:false});await page.evaluate(collectWebGeometry);
          const tracePath=`traces/${cell.cellId}.zip`;fs.mkdirSync(path.join(dir,'traces'),{recursive:true});const raw=path.join(dir,'traces',cell.cellId+'.private.zip');await context.tracing.stop({path:raw});
          try{fs.writeFileSync(path.join(dir,tracePath),sanitizeVisualTrace(fs.readFileSync(raw)),{flag:'wx'});}finally{fs.rmSync(raw,{force:true});}
          await captureWebCheckpoint(session,{page,cell,runtime:observer.runtime,hooks,trace:{path:tracePath,sha256:sha256(fs.readFileSync(path.join(dir,tracePath)))}});
        }else {await hooks.prepare({cell,config:cfg,root});await captureMobileCheckpoint(session,{cell,hooks});}
      }catch(error){session.run.failures.push({cellId:cell.cellId,code:'VISUAL_CAPTURE_FAILED',message:scrubRuntime(error.message)});}
      finally{observer?.dispose();await context?.close();}
    }
  }finally{await browser?.close();}
  return finishVisualRun(session);
}
