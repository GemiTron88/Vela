import {inspectProviderReadiness} from './provider-readiness.mjs';
import {loadCandidate} from './evidence-model.mjs';
import {inspectDecisionPlan} from './decision/plan-alignment.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluateDecision,validateDecision} from './decision/index.mjs';
import {readLocalKnowledge} from './decision/kb-sync.mjs';
import {requireNativeWorkstation} from './native-host-policy.mjs';
import {resolveDerivedPath} from './derived-state.mjs';
import {resolveNodeHost} from './bounded-process.mjs';
import {isV5,validateV5DecisionPolicy} from './v5-config.mjs';
export function decisionOSStatus(root,config={}){
  try{const local=readLocalKnowledge(root);return {schemaVersion:'executionkit-decision-os/v1',status:validateV5DecisionPolicy(config).length?'BLOCKED':'AVAILABLE',officialSystem:isV5(config),engine:'BUNDLED_DETERMINISTIC',models:false,hotPathNetwork:false,knowledge:{source:local.source,revision:local.manifest.revision,version:local.knowledge.version,refreshDue:local.refreshDue,sourceCommit:local.sourceCommit}};}catch{return {schemaVersion:'executionkit-decision-os/v1',status:'UNAVAILABLE',engine:'BUNDLED_DETERMINISTIC',models:false,hotPathNetwork:false};}
}
export function executeBundledDecision(root,config,{action='advise',request=null}={}){
  try{
    if(validateV5DecisionPolicy(config).length)throw Error('V5_DECISION_POLICY_INVALID');
    if(action==='refresh'){
      const child=fileURLToPath(new URL('../bin/decision-kb-refresh.mjs',import.meta.url));
      const r=spawnSync(resolveNodeHost(),[child,root],{encoding:'utf8',timeout:6500,maxBuffer:8192,shell:false,windowsHide:true});
      if(r.error||r.status!==0)throw Error('KB_REFRESH_UNAVAILABLE');
      return {...JSON.parse(r.stdout),advisoryOnly:true};
    }
    if(action!=='advise'||Buffer.byteLength(JSON.stringify(request))>12*1024)throw Error('DECISION_REQUEST_INVALID');
    // Only native workloads need a physical-host probe. Conservative VPS
    // classification for ordinary advice grants no execution authority.
    const input=validateDecision(request);
    const local=readLocalKnowledge(root),native=input.action==='mobile_build'||input.signals.usesAndroidTools;
    let workstation=false;if(native){try{requireNativeWorkstation();workstation=true;}catch{}}
    const hostClass=workstation?'workstation':'vps';
    let providerReadiness=null,signals=input.signals;
    if(['deploy','release_approve','release_publish'].includes(input.action)){
      let candidate=null;try{candidate=loadCandidate(root);}catch{}
      providerReadiness=inspectProviderReadiness(root,{candidate,environment:input.environment,boundary:input.action});
      // Caller-supplied zeros cannot suppress compiled source-derived provider signals.
      signals={...signals,...providerReadiness.signals};
    }
    const result=evaluateDecision({...input,hostClass,signals},{knowledge:local.knowledge});
    const mandatory=result.decision==='DENY';
    return {schemaVersion:'executionkit-decision-os/v1',status:'AVAILABLE',advisoryOnly:true,engine:'BUNDLED_DETERMINISTIC',result,providerReadiness,knowledge:{source:local.source,revision:local.manifest.revision,version:local.knowledge.version},enforcement:{status:mandatory?'BLOCKED':'NO_AUTHORITY_GRANT',mandatoryBlock:mandatory,reasons:mandatory?result.reasons:[],owner:'EXECUTIONKIT_LOCAL_POLICY'},localOnly:true,hotPathCalls:false};
  }catch{return {schemaVersion:'executionkit-decision-os/v1',status:'UNAVAILABLE',advisoryOnly:true,authority:'NONE',enforcement:{mandatoryBlock:isV5(config),status:isV5(config)?'BLOCKED':'NO_AUTHORITY_GRANT'},reason:'DECISION_INVALID_OR_UNAVAILABLE',localOnly:true,hotPathCalls:false};}
}
export function decisionPreflight(root,config,{action='edit',task=null}={}){
  const plan=inspectDecisionPlan(root,{task,capture:true});
  const value=executeBundledDecision(root,config,{request:{schemaVersion:2,requestId:crypto.randomUUID(),event:'preflight',action,hostClass:'vps',environment:'development',signals:{scopeUnclear:plan.reasons?.includes('PLAN_SCOPE_UNCLEAR')===true,scopeExceeded:plan.reasons?.includes('PLAN_SCOPE_EXCEEDED')===true}}});
  return {...value,plan,enforcement:{...value.enforcement,mandatoryBlock:value.enforcement?.mandatoryBlock===true||plan.blocking,status:plan.blocking?'BLOCKED':value.enforcement?.status}};
}
export function writeDecisionEvidence(root,value){
  const file=resolveDerivedPath(root,'.executionkit/decision/latest.json','Decision evidence',{file:true,createParents:true});
  fs.writeFileSync(file,JSON.stringify(value)+'\n',{mode:0o600});return '.executionkit/decision/latest.json';
}

