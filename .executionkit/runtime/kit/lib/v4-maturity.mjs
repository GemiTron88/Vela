import fs from 'node:fs';
import path from 'node:path';
import { discoverProduct } from './discovery-model.mjs';
import { canonicalState, loadConfig, loadTasks, stateIsTerminal } from './execution-model.mjs';
import { V4_MATURITY_PROFILES } from './v4-config.mjs';

const IMPLEMENTATION_KINDS=new Set(['route','controller','model','policy','job','notification','listener','event','component','view','screen','component-source']);
const RELEASE_TERMS=/\b(?:release|release[-_ ]candidate|\brc\b|hardening|go[-_ ]?live|deployment|deploy|signing|app[-_ ]?store|play[-_ ]?store|production[-_ ]?readiness|launch)\b/i;

function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function walkTaskText(root){
  const out=[];
  const todo=path.join(root,'TODO.md');if(fs.existsSync(todo))out.push(fs.readFileSync(todo,'utf8'));
  const dir=path.join(root,'todo');
  if(fs.existsSync(dir)){
    const walk=(d)=>{for(const entry of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(d,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())walk(full);else if(entry.isFile()&&/\.md$/i.test(entry.name))out.push(fs.readFileSync(full,'utf8'));}};
    walk(dir);
  }
  return out.join('\n');
}
function taskEvidence(root){
  try{
    const {config}=loadConfig(root),loaded=loadTasks(root,config);
    if(!loaded.errors.length){
      const active=loaded.tasks.filter((x)=>!x.isArchive),allTerminal=loaded.tasks.filter((x)=>stateIsTerminal(x,config)),nonTerminal=active.filter((x)=>!stateIsTerminal(x,config));
      const releaseShaped=loaded.tasks.filter((x)=>!['REL-AUDIT','EK00-AUDIT','EK4-AUDIT'].includes(x.id)&&RELEASE_TERMS.test([x.title,x.meta?.Tags,x.objective].filter(Boolean).join(' '))&&['IMPLEMENTED','REVIEW_REQUIRED','ACCEPTED','RELEASED'].includes(canonicalState(x,config)??''));
      return {source:'execution-model',taskCount:loaded.tasks.length,activeTaskCount:active.length,terminalTaskCount:allTerminal.length,nonTerminalTaskCount:nonTerminal.length,historyPresent:allTerminal.length>0||active.some((x)=>!['PLANNED','READY'].includes(canonicalState(x,config)??'')),releaseSignal:releaseShaped.length>0,releaseTaskIds:releaseShaped.map((x)=>x.id)};
    }
  }catch{}
  const text=walkTaskText(root),canonicalStates=[...text.matchAll(/^- Status:\s*([A-Z_]+)/gm)].map((m)=>m[1]);
  const legacyTasks=[...text.matchAll(/^\s*[-*+]\s+\[([^\]])\]\s+([A-Z][A-Z0-9._-]*-[A-Z0-9._-]+)\s+(.+)$/gm)].map((m)=>({
    marker:m[1],id:m[2],title:String(m[3]).split('|')[0].trim()
  }));
  const legacyState=(marker)=>marker==='x'||marker==='X'?'ACCEPTED':marker==='~'?'IMPLEMENTED':marker==='R'||marker==='r'?'REVIEW_REQUIRED':marker==='!'?'CORRECTION_REQUIRED':marker==='B'||marker==='b'||marker==='?'?'BLOCKED':'PLANNED';
  const legacyStates=legacyTasks.map((task)=>legacyState(task.marker)),states=[...canonicalStates,...legacyStates];
  const terminal=states.filter((x)=>['ACCEPTED','RELEASED','CANCELLED','VERIFIED'].includes(x));
  const canonicalReleaseSignal=/^###\s+(?!REL-AUDIT\b|EK00-AUDIT\b|EK4-AUDIT\b).*(?:release|hardening|go[-_ ]?live|signing|app[-_ ]?store|play[-_ ]?store)[\s\S]{0,700}?^- Status:\s*(?:IMPLEMENTED|REVIEW_REQUIRED|ACCEPTED|RELEASED)\b/gim.test(text);
  const legacyReleaseTasks=legacyTasks.filter((task)=>!/(?:^|-)(?:REL-AUDIT|EK00-AUDIT|EK4-AUDIT)(?:-|$)/i.test(task.id)&&RELEASE_TERMS.test(task.title)&&['IMPLEMENTED','REVIEW_REQUIRED','ACCEPTED','RELEASED'].includes(legacyState(task.marker)));
  return {source:text?(legacyTasks.length?'markdown-legacy-checklist-fallback':'markdown-fallback'):'none',taskCount:states.length,terminalTaskCount:terminal.length,nonTerminalTaskCount:Math.max(0,states.length-terminal.length),historyPresent:terminal.length>0||states.some((x)=>['IN_PROGRESS','IMPLEMENTED','REVIEW_REQUIRED','CORRECTION_REQUIRED','BLOCKED'].includes(x)),releaseSignal:canonicalReleaseSignal||legacyReleaseTasks.length>0,releaseTaskIds:legacyReleaseTasks.map((task)=>task.id)};
}
function productionEvidence(root){
  const candidates=['.executionkit/deployment/production-state.json'];
  try{const {config}=loadConfig(root);const artifactRoot=String(config.deployment?.artifactRoot??'.executionkit/deployment');const rel=path.posix.join(artifactRoot.replace(/\\/g,'/'),'production-state.json');if(!candidates.includes(rel))candidates.unshift(rel);}catch{}
  for(const rel of candidates){
    const full=path.resolve(root,rel),delta=path.relative(root,full);if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(full))continue;
    const state=readJson(full);if(!state)continue;
    const smoke=Array.isArray(state.smoke)&&state.smoke.length>0&&state.smoke.every((x)=>x.status==='PASS'||x.exitCode===0);
    const health=state.health?.status==='PASS'&&state.health?.ok===true;
    if(state.schemaVersion==='production-deployment-state/v1'&&state.status==='DEPLOYED'&&smoke&&health)return {verified:true,path:rel,status:state.status,deployedAt:state.deployedAt??null,releaseId:state.releaseId??null,smokeVerified:true,healthVerified:true};
    return {verified:false,path:rel,status:state.status??'UNKNOWN',deployedAt:state.deployedAt??null,releaseId:state.releaseId??null,smokeVerified:smoke,healthVerified:health};
  }
  return {verified:false,path:null,status:'UNOBSERVED',deployedAt:null,releaseId:null,smokeVerified:false,healthVerified:false};
}
function configuredReleaseSignals(root){
  const signals=[];
  const config=readJson(path.join(root,'execution.config.json'));
  if(config?.deployment?.target?.type&&config.deployment.target.type!=='UNCONFIGURED')signals.push('deployment-target-configured');
  if(config?.deployment?.requiredForRelease===true&&config?.deployment?.target?.type&&config.deployment.target.type!=='UNCONFIGURED')signals.push('deployment-required-with-target');
  if(fs.existsSync(path.join(root,'fastlane'))||fs.existsSync(path.join(root,'android/fastlane'))||fs.existsSync(path.join(root,'ios/fastlane')))signals.push('mobile-release-tooling');
  const candidate=readJson(path.join(root,'.executionkit/candidate.json'));
  if(candidate?.candidateId&&candidate?.commit)signals.push('exact-candidate-present');
  const workflows=path.join(root,'.github/workflows');
  if(fs.existsSync(workflows)){
    for(const entry of fs.readdirSync(workflows,{withFileTypes:true})){
      if(!entry.isFile()||!/\.ya?ml$/i.test(entry.name))continue;
      const body=fs.readFileSync(path.join(workflows,entry.name),'utf8');
      if(/\b(?:deploy|release|publish|signing|app store|play store|production)\b/i.test(entry.name+'\n'+body)){signals.push('release-workflow:'+entry.name);break;}
    }
  }
  return [...new Set(signals)];
}

export function classifyV4Maturity(root){
  root=path.resolve(root);
  const inventory=discoverProduct(root),tasks=taskEvidence(root),production=productionEvidence(root),releaseSignals=configuredReleaseSignals(root);
  const implementationItems=inventory.items.filter((x)=>IMPLEMENTATION_KINDS.has(x.kind)),implementationKinds=[...new Set(implementationItems.map((x)=>x.kind))].sort();
  const runtimePresent=inventory.stacks.length>0;
  const meaningfulImplementation=implementationItems.length>=1;
  const substantialImplementation=implementationItems.length>=8&&implementationKinds.length>=3;
  const releaseSignal=tasks.releaseSignal||releaseSignals.length>0;
  let profile='M0_PLANNING_ONLY',rationale=['No material product implementation/runtime evidence was observed.'];
  if(production.verified){
    profile='M4_PRODUCTION';rationale=['Verified production deployment state with successful smoke and health evidence is present.'];
  }else if(runtimePresent&&substantialImplementation&&releaseSignal){
    profile='M3_NEAR_COMPLETE';rationale=['Material multi-area implementation is present together with release/hardening/deployment evidence, but verified live production evidence is absent.'];
  }else if(runtimePresent&&substantialImplementation&&tasks.historyPresent){
    profile='M2_ACTIVE_DEVELOPMENT';rationale=['Substantial implementation spans multiple product kinds and active/partial execution history is present.'];
  }else if(runtimePresent&&meaningfulImplementation){
    profile='M1_EARLY_IMPLEMENTATION';rationale=['A real runtime/manifest and meaningful product implementation are present, without stronger M2–M4 evidence.'];
  }
  return {
    schemaVersion:'executionkit-v4-maturity/v1',profile,rank:V4_MATURITY_PROFILES.indexOf(profile),rationale,
    evidence:{
      stacks:inventory.stacks,productFileCount:inventory.fileCount,productItemCount:inventory.items.length,
      implementationItemCount:implementationItems.length,implementationKinds,
      tasks,releaseSignals,production
    }
  };
}
