import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import { spawnBoundedSync } from './bounded-process.mjs';
import { detectStacks } from './discovery-model.mjs';
import {detectVisualSurfaces} from './visual-os.mjs';
import { analyzeImpact, selectTests } from './impact-model.mjs';
import {inspectTestPortfolio} from './test-portfolio.mjs';
import { loadConfig, loadTasks } from './execution-model.mjs';
import { resolveRuntimePlan } from './runtime-orchestrator.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { useV4Knowledge } from './v4-knowledge-runtime.mjs';
import { executeAgenticJourneys, planAgenticJourneys } from './agentic-e2e.mjs';
import { captureV4FastWorktreeIdentity, captureV4WorktreeIdentity } from './v4-gate-identity.mjs';
const kitRoot=fileURLToPath(new URL('..',import.meta.url));

const SAFE_VERIFY_DENY=/\b(?:deploy|rollback|release:deploy|scp|rsync|ssh|kubectl\s+(?:apply|delete)|terraform\s+apply|artisan\s+migrate(?=\s|$)|rm\s+(?:-[a-z]*r[a-z]*\s+-[a-z]*f|-[a-z]*f[a-z]*\s+-[a-z]*r|-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)|curl\b[^\n]*(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE))\b/i;
const SHELL_META=/[\r\n;&|<>\`$(){}]/;
const TEST_SCRIPT_NAME=/(?:^|[:._-])(?:test|tests|lint|analyse|analyze|typecheck|check)(?:$|[:._-])/i;
const ORCHESTRATION_TEST_SCRIPT=/\b(?:preflight|executionkit(?::|[-\s])|context:validate|projection:generate|agents:validate|state:validate|execution:validate|integration:validate|doctor)\b/i;
const SURFACE_IGNORE=new Set(['.git','.executionkit','node_modules','vendor','build','.dart_tool','.idea','.vscode','coverage','storage','bootstrap']);
const MAX_TEST_COMMAND_MS=30*60*1000;
const TASK_TEST_COMMAND_MS=15*60*1000;
const MAX_FOCUSED_TEST_FILES=24; // Review broad impact; do not silently drop risk coverage.
function normalizedScopeRoot(value){
  const raw=String(value??'').trim().replaceAll('\\','/');
  if(!raw||raw==='.')return '.';
  if(path.posix.isAbsolute(raw)||raw.split('/').some((part)=>part==='..'))throw new Error('Test OS surfaceScope roots must be safe project-relative paths: '+value);
  return raw.replace(/^\.\//,'').replace(/\/+$/,'');
}
function configuredSurfaceScope(config){
  const raw=config.v4?.systems?.test?.surfaceScope??{};
  const includeRoots=Array.isArray(raw.includeRoots)?raw.includeRoots.map(normalizedScopeRoot):[];
  const excludeRoots=Array.isArray(raw.excludeRoots)?raw.excludeRoots.map(normalizedScopeRoot):[];
  const unique=(items)=>[...new Set(items)];
  return {includeRoots:unique(includeRoots),excludeRoots:unique(excludeRoots)};
}
function surfaceMatchesRoot(cwd,root){
  const rel=String(cwd??'.').replaceAll('\\','/');
  if(root==='.')return true;
  return rel===root||rel.startsWith(root+'/');
}
function surfaceAllowed(cwd,scope){
  if(scope.excludeRoots.some((root)=>surfaceMatchesRoot(cwd,root)))return false;
  return scope.includeRoots.length===0||scope.includeRoots.some((root)=>surfaceMatchesRoot(cwd,root));
}
function tokenizePortable(raw){
  if(SHELL_META.test(raw))return {blocked:true,reason:'Task Verification contains shell/control syntax; v4 Test OS accepts portable argv only'};
  const tokens=[];let current='',quote=null,escaped=false;
  for(const ch of String(raw)){
    if(escaped){current+=ch;escaped=false;continue;}
    if(ch==='\\'){escaped=true;continue;}
    if(quote){if(ch===quote)quote=null;else current+=ch;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(/\s/.test(ch)){if(current){tokens.push(current);current='';}continue;}
    current+=ch;
  }
  if(escaped||quote)return {blocked:true,reason:'Task Verification contains an unterminated quote/escape'};
  if(current)tokens.push(current);
  if(!tokens.length)return {blocked:true,reason:'Task Verification is empty'};
  return {tokens};
}
export function portableVerification(raw){
  if(SAFE_VERIFY_DENY.test(raw))return {blocked:true,reason:'Task Verification contains production/destructive side-effect language',raw};
  const parsed=tokenizePortable(raw);if(parsed.blocked)return {...parsed,raw};
  const [command,...args]=parsed.tokens,base=path.basename(command).toLowerCase().replace(/\.(?:cmd|bat|exe|com)$/,'');
  const a=(i)=>String(args[i]??'').toLowerCase();
  let allowed=false;
  if(base==='node')allowed=a(0)==='--test';
  else if(['npm','pnpm','yarn'].includes(base)){
    if(a(0)==='test')allowed=true;
    else if(a(0)==='run'&&args[1]&&TEST_SCRIPT_NAME.test(args[1]))allowed=true;
  } else if(base==='npx')allowed=['vitest','jest','playwright','phpunit','pest'].includes(a(0));
  else if(base==='php')allowed=(a(0)==='artisan'&&a(1)==='test')||/^(?:\.\/)?vendor[\\/]bin[\\/](?:phpunit|pest)(?:\.bat)?$/i.test(args[0]??'');
  else if(base==='flutter'||base==='dart')allowed=a(0)==='test';
  else if(['python','python3'].includes(base))allowed=a(0)==='-m'&&['pytest','unittest'].includes(a(1));
  else if(base==='pytest')allowed=true;
  else if(base==='go'||base==='cargo')allowed=a(0)==='test';
  else if(base==='bundle')allowed=a(0)==='exec'&&(a(1)==='rspec'||(a(1)==='rake'&&a(2)==='test'));
  else if(['phpunit','pest'].includes(base)||/^(?:phpunit|pest)(?:\.bat)?$/i.test(path.basename(command)))allowed=true;
  else if(['executionkit','ek'].includes(base))allowed=a(0)==='test';
  if(!allowed)return {blocked:true,reason:'Task Verification is not an approved shell-free test/check invocation',raw};
  return {id:'task-contract-verification',source:'TODO.Verification',command,args,timeoutMs:900000};
}
// Task verification cannot quietly launch an entire suite when no specific test was selected.
export function broadTaskTest(item){
  if(typeof item==='string')item=portableVerification(item);
  if(!item||item.blocked)return false;
  const base=path.basename(item.command).toLowerCase().replace(/\.(cmd|bat|exe|com)$/,'');
  const args=item.args??[],lower=args.map(x=>String(x).toLowerCase());
  const selector=(rawValue)=>{
    const value=String(rawValue).replaceAll('\\','/').replace(/::.*$/,'').replace(/:\d+$/,'');
    if(value.startsWith('-'))return false;
    if(base==='cargo'&&/^[A-Za-z_][A-Za-z0-9_:]*$/.test(String(rawValue)))return true;
    return /(?:^|\/)[^/]+\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]sx?|php|dart|py|go|rs|rb)$/i.test(value)
      || /^(?:tests?|spec|__tests__|integration_test)\/[A-Za-z0-9_.\/-]+$/i.test(value);
  };
  let scan=null;
  if(base==='node'&&lower[0]==='--test')scan=args.slice(1);
  else if(['npm','pnpm','yarn'].includes(base)&&lower[0]==='test')scan=args.slice(1);
  else if(['npm','pnpm','yarn'].includes(base)&&lower[0]==='run'&&(/(?:^|[:._-])tests?(?:$|[:._-])/.test(lower[1]??'')||lower[1]==='check'))scan=args.slice(2);
  else if(base==='npx'&&['vitest','jest','playwright','phpunit','pest'].includes(lower[0]))scan=args.slice(1).filter(x=>x!=='run'&&x!=='test');
  else if(base==='php'&&lower[0]==='artisan'&&lower[1]==='test')scan=args.slice(2);
  else if(base==='php'&&/phpunit|pest/.test(lower[0]??''))scan=args.slice(1);
  else if(['phpunit','pest'].includes(base))scan=args;
  else if(['flutter','dart'].includes(base)&&lower[0]==='test')scan=args.slice(1);
  else if(['python','python3'].includes(base)&&lower[0]==='-m'&&['pytest','unittest'].includes(lower[1]))scan=args.slice(2);
  else if(base==='pytest')scan=args;
  else if(base==='go'&&lower[0]==='test')scan=args.slice(1).filter(x=>x!=='./...');
  else if(base==='cargo'&&lower[0]==='test')scan=args.slice(1);
  else if(base==='bundle'&&lower[0]==='exec'&&lower[1]==='rspec')scan=args.slice(2);
  else if(base==='bundle'&&lower[0]==='exec'&&lower[1]==='rake'&&lower[2]==='test')return true;
  else if(['executionkit','ek'].includes(base)&&lower[0]==='test')scan=args.slice(1);
  if(scan===null)return false;
  for(let i=0;i<scan.length;i++){
    const value=String(scan[i]);
    const option=/^(?:--(?:target|files|filter|testsuite|group|test-name-pattern|grep|match|runTestsByPath|testPathPattern|testPathPatterns|name|plain-name|run|test|bin)|-(?:k|t|e|n|run))(?:=(.*))?$/i.exec(value);
    if(option){
      const target=option[1]===undefined?String(scan[++i]??''):option[1];
      if(target.trim()&&!target.startsWith('-'))return false;
    }else if(/^--(?:configuration|bootstrap|coverage(?:-[a-z]+)?|log-[a-z]+|test-reporter(?:-destination)?|output(?:File)?|reporter)(?:=|$)/i.test(value)){
      // Output/config paths are not selected tests, even when named *.test.mjs.
      if(!value.includes('='))i++;
    }else if(selector(value))return false;
  }
  return true;
}
function uniqueCommands(items){const seen=new Set();return items.filter((item)=>{const key=[item.cwd??'.',item.command,...(item.args??[])].join('\0');if(seen.has(key))return false;seen.add(key);return true;});}
function packageJsonAt(root,cwd='.'){const file=path.join(root,cwd,'package.json');try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function exists(root,rel){return fs.existsSync(path.join(root,rel));}
function discoverTestSurfaces(root){
  const out=[],queue=[{dir:root,rel:'.',depth:0}];
  while(queue.length){
    const current=queue.shift(),dir=current.dir,rel=current.rel;
    if(fs.existsSync(path.join(dir,'artisan'))&&fs.existsSync(path.join(dir,'composer.json')))out.push({type:'laravel',cwd:rel});
    if(fs.existsSync(path.join(dir,'pubspec.yaml'))){
      const pubspec=fs.readFileSync(path.join(dir,'pubspec.yaml'),'utf8');
      out.push({type:/^\s*sdk:\s*flutter\s*(?:#.*)?$/m.test(pubspec)?'flutter':'dart',cwd:rel});
    }
    if(fs.existsSync(path.join(dir,'package.json')))out.push({type:'node',cwd:rel});
    if(['pytest.ini','setup.py','pyproject.toml','tox.ini'].some((f)=>fs.existsSync(path.join(dir,f))))out.push({type:'python',cwd:rel});
    if(fs.existsSync(path.join(dir,'go.mod')))out.push({type:'go',cwd:rel});
    if(fs.existsSync(path.join(dir,'Cargo.toml')))out.push({type:'rust',cwd:rel});
    if(fs.existsSync(path.join(dir,'Gemfile'))&&fs.existsSync(path.join(dir,'Rakefile')))out.push({type:'ruby',cwd:rel});
    if(current.depth>=2)continue;
    let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
    for(const entry of entries){
      if(!entry.isDirectory()||entry.isSymbolicLink()||SURFACE_IGNORE.has(entry.name))continue;
      const childRel=rel==='.'?entry.name:path.join(rel,entry.name);
      queue.push({dir:path.join(dir,entry.name),rel:childRel,depth:current.depth+1});
    }
  }
  return out;
}
function pathsForSurface(paths,cwd,pattern){
  const prefix=cwd==='.'?'':cwd.replaceAll('\\','/')+'/';
  return paths.filter((p)=>pattern.test(p)&&(!prefix||p.startsWith(prefix))).map((p)=>prefix?p.slice(prefix.length):p);
}
function nodeTargetCommand(root,paths,{phase=false,cwd='.',filter=null}={}){
  // A missing target must never expand an ordinary task edit into the entire npm/Vitest/Jest/Playwright suite.
  if(!phase&&!paths.length&&!filter)return null;
  const pkg=packageJsonAt(root,cwd);if(!pkg)return null;
  if(pkg.name==='executionkit-agentic-journeys')return null;
  const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})};
  if(deps.vitest)return {id:(phase?'node-vitest-phase':'node-vitest-targeted')+(cwd==='.'?'':'-'+cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:'npx',args:['vitest','run',...(phase?[]:paths),...(filter?['-t',filter]:[])],cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS};
  if(deps.jest)return {id:(phase?'node-jest-phase':'node-jest-targeted')+(cwd==='.'?'':'-'+cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:'npx',args:['jest',...(phase?[]:paths),...(filter?['-t',filter]:[])],cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS};
  if(deps['@playwright/test'])return {id:(phase?'playwright-phase':'playwright-targeted')+(cwd==='.'?'':'-'+cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:'npx',args:['playwright','test',...(phase?[]:paths),...(filter?['--grep',filter]:[])],cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS};
  const testScript=String(pkg.scripts?.test??'').trim();
  if(testScript&&!/no test specified/i.test(testScript)&&!ORCHESTRATION_TEST_SCRIPT.test(testScript))return {id:(phase?'node-script-phase':'node-script-targeted')+(cwd==='.'?'':'-'+cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'package.json',command:'npm',args:phase?['test']:pkg.name==='ai-executionkit'?['test','--',...paths.flatMap(file=>['--target',file]),...(filter?['--filter',filter]:[])]:['test','--',...paths,...(filter?['-t',filter]:[])],cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS};
  if(paths.length&&paths.every((p)=>/\.(?:js|mjs|cjs)$/i.test(p)))return {id:'node-native-targeted'+(cwd==='.'?'':'-'+cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:process.execPath,args:['--test',...(filter?[`--test-name-pattern=${filter}`]:[]),...paths],cwd,timeoutMs:TASK_TEST_COMMAND_MS};
  return null;
}
function inferredCommands(root,selection,boundary,config,{filter=null}={}){
  // Wave checks are impact-targeted. Full deterministic suites are reserved for phase/release.
  const phase=boundary==='phase',paths=phase?selection.phase:selection.targeted,hasPaths=paths.length>0,out=[];
  const surfaceScope=configuredSurfaceScope(config);
  const surfaces=discoverTestSurfaces(root).filter((surface)=>surfaceAllowed(surface.cwd,surfaceScope));
  const hasProductSurface=surfaces.some((s)=>s.type==='laravel'||s.type==='flutter'||s.cwd!=='.');
  for(const surface of surfaces){
    if(surface.type==='laravel'){
      const php=pathsForSurface(paths,surface.cwd,/\.php$/i);
      if(phase||php.length||(!hasPaths&&filter))out.push({id:(phase?'laravel-phase':'laravel-targeted')+(surface.cwd==='.'?'':'-'+surface.cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:'php',args:['artisan','test',...(phase?[]:php),...(filter?['--filter='+filter]:[])],cwd:surface.cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS});
    }else if(surface.type==='flutter'||surface.type==='dart'){
      const dart=pathsForSurface(paths,surface.cwd,/\.dart$/i);
      if(phase||dart.length||(!hasPaths&&filter))out.push({id:surface.type+(phase?'-phase':'-targeted')+(surface.cwd==='.'?'':'-'+surface.cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command:surface.type,args:['test',...(phase?[]:dart),...(filter?['--plain-name',filter]:[])],cwd:surface.cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS});
    }else if(surface.type==='node'){
      const node=pathsForSurface(paths,surface.cwd,/\.(?:js|mjs|cjs|ts|tsx|jsx)$/i);
      if(!phase&&!node.length&&(hasPaths||!filter))continue;
      const pkg=packageJsonAt(root,surface.cwd),script=String(pkg?.scripts?.test??'');
      if(surface.cwd==='.'&&hasProductSurface&&ORCHESTRATION_TEST_SCRIPT.test(script))continue;
      const cmd=nodeTargetCommand(root,node,{phase,cwd:surface.cwd,filter});if(cmd)out.push(cmd);
    }else if(['python','go','rust','ruby'].includes(surface.type)){
      const patterns={python:/\.py$/i,go:/\.go$/i,rust:/\.rs$/i,ruby:/\.rb$/i};
      const selected=pathsForSurface(paths,surface.cwd,patterns[surface.type]);
      if(!phase&&!selected.length&&(hasPaths||!filter))continue;
      const read=(name)=>{try{return fs.readFileSync(path.join(root,surface.cwd,name),'utf8');}catch{return '';}};
      let command,args;
      if(surface.type==='python'){
        const pytest=exists(root,path.join(surface.cwd,'pytest.ini'))||/pytest/i.test(['pyproject.toml','setup.py','setup.cfg','tox.ini','requirements.txt'].map(read).join('\n'));
        command=process.platform==='win32'?'python':(spawnBoundedSync('python',['--version'],{timeoutMs:2000}).status===0?'python':'python3');
        args=pytest?['-m','pytest',...(phase?[]:selected),...(filter?['-k',filter]:[])]:['-m','unittest','discover'];
      }else if(surface.type==='go'){
        command='go';args=['test',...(phase||!selected.length?['./...']:[...new Set(selected.map((file)=>'./'+path.posix.dirname(file)))]),...(filter?['-run',filter]:[])];
      }else if(surface.type==='rust'){
        command='cargo';args=['test',...(filter?[filter]:[])];
      }else{
        const rspec=/\brspec\b/.test(read('Gemfile'));
        command='bundle';args=rspec?['exec','rspec',...(phase?[]:selected),...(filter?['-e',filter]:[])]:['exec','rake','test'];
      }
      out.push({id:surface.type+(phase?'-phase':'-targeted')+(surface.cwd==='.'?'':'-'+surface.cwd.replace(/[^A-Za-z0-9]+/g,'-')),source:'discovery',command,args,cwd:surface.cwd,timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS});
    }
  }
  if(phase&&!surfaces.length){
    // Stack-discovery fallback is allowed only at an explicit full-suite wave/phase boundary.
    const stacks=detectStacks(root);
    if(stacks.includes('laravel'))out.push({id:phase?'laravel-phase':'laravel-targeted',source:'discovery',command:'php',args:['artisan','test'],cwd:'.',timeoutMs:phase?MAX_TEST_COMMAND_MS:TASK_TEST_COMMAND_MS});
  }
  return out;
}
function taskVerificationCommand(task){
  const raw=String(task?.meta?.Verification??'').trim();
  if(!raw||/^NONE$/i.test(raw)||/^PENDING$/i.test(raw))return null;
  return portableVerification(raw);
}
function configuredCommands(config,boundary){
  const values=config.v4?.systems?.test?.commands?.[boundary]??[];
  if(!Array.isArray(values))throw new Error('v4.systems.test.commands.'+boundary+' must be an array');
  return values.map((item,i)=>{
    if(typeof item==='string'){
      if(boundary!=='task')throw new Error('Automatic v4 '+boundary+' Test OS commands must use portable structured {command,args}; shell strings are not accepted at automatic boundaries');
      const parsed=portableVerification(item);
      if(parsed.blocked)throw new Error('Configured Test OS command is unsafe/non-portable: '+parsed.reason+' — '+item);
      return {...parsed,id:'configured-'+boundary+'-'+(i+1),source:'v4-config',timeoutMs:Math.min(parsed.timeoutMs??TASK_TEST_COMMAND_MS,TASK_TEST_COMMAND_MS)};
    }
    if(!item||typeof item!=='object'||typeof item.command!=='string'||!Array.isArray(item.args??[]))throw new Error('Invalid configured Test OS command at '+boundary+'['+i+']');
    return {id:item.id??'configured-'+boundary+'-'+(i+1),source:'v4-config',command:item.command,args:item.args??[],cwd:item.cwd??'.',timeoutMs:Math.min(Number(item.timeoutMs??TASK_TEST_COMMAND_MS),MAX_TEST_COMMAND_MS)};
  });
}
function removeTestScratch(dir){
  if(fs.lstatSync(dir).isSymbolicLink()||fs.realpathSync(dir)!==path.join(fs.realpathSync(os.tmpdir()),path.basename(dir)))throw new Error('Scratch ownership changed');
  const unseal=current=>{
    fs.chmodSync(current,fs.statSync(current).mode|0o700);
    for(const entry of fs.readdirSync(current,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink())unseal(path.join(current,entry.name));
  };
  unseal(dir);fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
function runOne(root,item,{deadlineAt=null}={}){
  const cwd=path.resolve(root,item.cwd??'.');
  if(!(cwd===root||cwd.startsWith(root+path.sep)))return {...item,status:'BLOCKED',exitCode:null,durationMs:0,error:'command cwd escapes project root'};
  const remaining=deadlineAt===null?Infinity:deadlineAt-Date.now();
  if(remaining<=1000)return {...item,status:'FAIL',exitCode:null,durationMs:0,error:'boundary deadline exhausted before test command started',timedOut:true,stdout:'',stderr:''};
  const timeoutMs=Math.max(1000,Math.min(item.timeoutMs??TASK_TEST_COMMAND_MS,remaining));
  const started=Date.now();
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-test-run-'));
  const testEnv={...process.env,TMPDIR:scratch,TEMP:scratch,TMP:scratch};
  delete testEnv.NODE_TEST_CONTEXT;
  let result;
  try{
    result=spawnBoundedSync(item.command,item.args??[],{cwd,encoding:'utf8',timeoutMs,maxBuffer:16*1024*1024,windowsHide:true,env:testEnv});
  }finally{
    try{removeTestScratch(scratch);}
    catch(error){result??={};result.error=new Error('TEST_SCRATCH_CLEANUP_FAILED: '+(error.code??'ERROR'));}
  }
  const durationMs=Date.now()-started;
  const output=String(result.stdout??'').slice(-12000),errorOutput=String(result.stderr??'').slice(-12000);
  return {...item,portableInvocation:result.invocation,status:!result.error&&result.status===0?'PASS':'FAIL',exitCode:result.status,error:result.error?.message??null,timedOut:result.timedOut===true,durationMs,stdout:output,stderr:errorOutput};
}
function gatePath(root,boundary,taskId=null){const suffix=boundary==='task'?(taskId?'-'+String(taskId).replace(/[^A-Za-z0-9._-]+/g,'-'):''):'-'+boundary;return resolveDerivedPath(root,'.executionkit/gates/test'+suffix+'.json','v4 Test OS gate',{createParents:true});}
function writeGate(root,result){const file=gatePath(root,result.boundary,result.taskId);fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');return path.relative(root,file).split(path.sep).join('/');}
function parseExplicitTargets(targets){
  const list=(Array.isArray(targets)?targets:[targets]).flatMap(x=>String(x??'').split(/[;,]/)).map(x=>x.trim().replaceAll('\\','/').replace(/^\.\//,'')).filter(Boolean);
  for(const item of list){
    if(path.posix.isAbsolute(item)||item.split('/').includes('..'))throw new Error('Test target path must be a safe project-relative path: '+item);
  }
  return [...new Set(list)];
}

export function planV4Tests(root,{boundary='task',base='HEAD~1',taskId=null,targets=[],filter=null}={}){
  root=path.resolve(root);
  if(!['task','wave','phase'].includes(boundary))throw new Error('v4 Test OS plan supports manual task checks plus automatic wave/phase boundaries');
  const explicitTargets=parseExplicitTargets(targets);
  const explicitFilter=typeof filter==='string'&&filter.trim()?filter.trim():null;
  const {config,policyIssues=[]}=loadConfig(root);
  if(policyIssues.length)throw new Error(policyIssues.map((x)=>'['+x.code+'] '+x.message).join('; '));
  if(config.v4?.systems?.test?.enabled===false||config.capabilities?.test==='NONE')throw new Error('Test OS is disabled');
  const fastExplicitTarget=boundary==='task'&&explicitTargets.length>0&&!taskId;
  const impact=fastExplicitTarget?{schemaVersion:'1.0.0',mode:'EXPLICIT_TARGETS',changed:explicitTargets,impactedTests:[],impactedSurfaces:[]}:analyzeImpact(root,{base});
  const baseSelection=fastExplicitTarget?{targeted:explicitTargets,scopeReviewRequired:false,scopeReason:null,phase:[],release:[]}:selectTests(root,impact,{boundary});
  const selection=explicitTargets.length?{...baseSelection,targeted:explicitTargets,scopeReviewRequired:false}:baseSelection;
  // Run portfolio checks once at deliberate boundaries, never on every task edit.
  // Existing historical duplication is advisory; newly copied tests or a large
  // burst of generated tests must be reviewed before launching expensive suites.
  const portfolio=boundary==='task'?null:inspectTestPortfolio(root,{base});
  if(portfolio&&(portfolio.status==='BLOCKED'||portfolio.newDuplicateGroups>0||portfolio.newTestFiles>8)){
    return {schemaVersion:'executionkit-v4-test-plan/v1',status:'BLOCKED',boundary,taskId:taskId??null,
      reason:'TEST_PORTFOLIO_REVIEW_REQUIRED',portfolio,commands:[],
      nextAction:'Inspect executionkit test portfolio ., consolidate newly redundant test sources with preserved risk coverage, then retry this boundary.'};
  }
  const knowledge=fastExplicitTarget?{decision:{purpose:'test-impact',outcome:'EXPLICIT_TARGETS'},evidence:null}:useV4Knowledge(root,{purpose:'test-impact',base});
  const runtime=fastExplicitTarget?{task:null,action:'targeted-test'}:resolveRuntimePlan(root);
  const taskSet=fastExplicitTarget?{tasks:[],errors:[]}:loadTasks(root,config);
  if(taskSet.errors?.length)throw new Error(taskSet.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const selectedTask=taskId?taskSet.tasks.find((x)=>!x.isArchive&&x.id===taskId):runtime.task?.id?taskSet.tasks.find((x)=>!x.isArchive&&x.id===runtime.task.id)??runtime.task:null;
  if(taskId&&!selectedTask)throw new Error('Unknown Test OS task: '+taskId);
  if(boundary==='task'&&!selectedTask&&!explicitTargets.length&&!explicitFilter)throw new Error('No current task available for task-boundary testing');
  const commands=[],deferred=[];
  if(boundary!=='phase'&&selection.targeted.length>MAX_FOCUSED_TEST_FILES)return {
    schemaVersion:'executionkit-v4-test-plan/v1',status:'BLOCKED',boundary,taskId:selectedTask?.id??null,
    reason:'FOCUSED_TEST_SCOPE_TOO_BROAD',targetedCount:selection.targeted.length,
    maxFocusedTestFiles:MAX_FOCUSED_TEST_FILES,
    nextAction:'Review changed risk/ownership and select a bounded meaningful test set; the complete suite remains at the phase boundary.',
    impact,selection,commands:[]
  };
  let verification=null;
  if(boundary==='task'&&selectedTask&&!explicitTargets.length){
    verification=taskVerificationCommand(selectedTask);
    if(verification?.blocked)return {schemaVersion:'executionkit-v4-test-plan/v1',status:'BLOCKED',boundary,taskId:selectedTask?.id??taskId??null,reason:verification.reason,verification:verification.raw,impact,selection,knowledge,commands:[]};
    if(verification){
      if(broadTaskTest(verification))deferred.push('TODO.Verification: unscoped suite moved to wave/phase');
      else commands.push(verification);
    }
  }
  const surfaceScope=configuredSurfaceScope(config);
  const normalizedVerificationTargets=new Set((verification?.args??[]).flatMap(arg=>String(arg).replace(/^--targets?=/,'').split(/[;,]/).map(s=>s.trim().replaceAll('\\','/').replace(/^\.\//,'')).filter(Boolean)));
  const verificationCoversImpact=boundary==='task'&&verification&&!broadTaskTest(verification)&&selection.targeted.length>0
    &&selection.targeted.every(file=>normalizedVerificationTargets.has(file));
  if(!verificationCoversImpact)commands.push(...inferredCommands(root,selection,boundary,config,{filter:explicitFilter}));
  if(boundary==='task'&&selection.scopeReviewRequired&&!commands.length)deferred.push('Configuration/dependency edit needs reviewed, explicitly targeted regression coverage');
  if(!explicitTargets.length){
    for(const item of configuredCommands(config,boundary)){
      if(boundary==='task'&&broadTaskTest(item))deferred.push(item.id+': unscoped suite moved to wave/phase');
      else commands.push(item);
    }
  }
  if(boundary!=='task'){
    const ui=detectVisualSurfaces(root,config.visual?.maxFiles??5000,config.v4?.systems?.visual?.surfaceScope??{});
    if(ui.uiBearing&&ui.stacks.some(stack=>['blade','javascript','web-components','css','tailwind','alpine'].includes(stack)))commands.push({id:'web-mobile-lighthouse',source:'mandatory-web-quality',command:process.execPath,args:[path.join(kitRoot,'bin/validate-seo-performance.mjs'),root],cwd:'.',timeoutMs:MAX_TEST_COMMAND_MS});
  }
  const deduped=uniqueCommands(commands);
  const agenticPlan=boundary==='task'?{status:'DEFERRED_TO_BOUNDARY'}:planAgenticJourneys(root);
  // A real, risk-mapped Agentic E2E wave may be the sole relevant user-journey
  // check. Never manufacture deterministic PASS when none was selected.
  const agenticOnlyWave=boundary==='wave'&&!deduped.length&&agenticPlan.status==='PLANNED';
  return {schemaVersion:'executionkit-v4-test-plan/v1',status:deduped.length||agenticOnlyWave?'PLANNED':'BLOCKED',boundary,taskId:selectedTask?.id??null,action:taskId?'verify-task':explicitTargets.length||explicitFilter?'targeted-test':runtime.action??null,base,impact,selection,surfaceScope,knowledge:{decision:knowledge.decision,evidence:knowledge.evidence},commands:deduped,deferred,agenticPlan,deterministicScope:deduped.length?'TARGETED_OR_PHASE':'NOT_SELECTED',reason:deduped.length||agenticOnlyWave?null:(selection.scopeReviewRequired&&boundary==='task'?'CONFIG_CHANGE_NEEDS_TARGETED_TEST_SELECTION':'NO_EXECUTABLE_TEST_COMMANDS')};
}

export function executeV4Tests(root,{boundary='task',base='HEAD~1',taskId=null,targets=[],filter=null,dryRun=false,deadlineAt=null}={}){
  root=path.resolve(root);const plan=planV4Tests(root,{boundary,base,taskId,targets,filter});
  let identity={head:null,worktreeFingerprint:null};
  try{identity=boundary==='task'?captureV4FastWorktreeIdentity(root):captureV4WorktreeIdentity(root);}catch{}
  if(plan.status==='BLOCKED'){const result={...plan,schemaVersion:'executionkit-v4-test-gate/v1',status:'BLOCKED',head:identity.head,worktreeFingerprint:identity.worktreeFingerprint,completedAt:new Date().toISOString(),gatePath:null};if(!dryRun)result.gatePath=writeGate(root,result);return result;}
  if(dryRun)return {...plan,status:'PLANNED',dryRun:true};
  const runs=[];for(const command of plan.commands){const run=runOne(root,command,{deadlineAt});runs.push(run);if(run.timedOut)break;}
  const deterministicPassed=runs.length===plan.commands.length&&runs.every((x)=>x.status==='PASS');
  const agentic=boundary==='task'?{status:'DEFERRED_TO_BOUNDARY'}:deterministicPassed?executeAgenticJourneys(root,{boundary,deadlineAt}):{status:'BLOCKED',reason:'deterministic-gate-failed'};
  try{identity=boundary==='task'?captureV4FastWorktreeIdentity(root):captureV4WorktreeIdentity(root);}catch{}
  const status=deterministicPassed&&['PASS','NOT_APPLICABLE','DEFERRED_TO_BOUNDARY'].includes(agentic.status)?'PASS':'FAIL';
  const result={schemaVersion:'executionkit-v4-test-gate/v1',status,head:identity.head,worktreeFingerprint:identity.worktreeFingerprint,deterministicScope:plan.deterministicScope,deterministicStatus:plan.commands.length?(deterministicPassed?'PASS':'FAIL'):'NOT_SELECTED',agentic,boundary:plan.boundary,taskId:plan.taskId,action:plan.action,base:plan.base,impact:plan.impact,selection:plan.selection,knowledge:plan.knowledge,commands:plan.commands,runs,completedAt:new Date().toISOString(),evidenceDigest:crypto.createHash('sha256').update(JSON.stringify({runs:runs.map((x)=>({id:x.id,status:x.status,exitCode:x.exitCode,durationMs:x.durationMs})),agenticStatus:agentic.status,agenticReportDigest:agentic.reportDigest??null})).digest('hex')};
  result.gatePath=writeGate(root,result);return result;
}
