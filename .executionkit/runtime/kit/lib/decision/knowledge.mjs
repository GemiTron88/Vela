import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {ACTIONS, EVENTS} from './contract.mjs';
const ROOT=dirname(fileURLToPath(import.meta.url));
const DOMAINS=new Set(['quality','visual','performance','architecture','security','operations','delivery']);
const NUMERIC_SIGNALS=new Set(['visualOverflowCount','contrastViolations','regressionCount','failedChecks',
  'remoteAssetCount','missingTranslationCount','formServerErrorCount','mobileOverflowCount','componentBypassCount',
  'designTokenViolations','changedFilesCount','apiRequestCount','longTaskCount','retryCount',
  'criticalProviderUnreadyCount','providerEvidenceInvalidCount','providerSignoffPendingCount','providerDeferredCount','marketVoiceViolationCount','unverifiedDependenciesCount','visualBlockingCount','visualReviewCount','premiumUxDefectCount','antiFakeCount','visualProductionMissingCount','visualProductionUnverifiedCount','visualProductionUnsafeCount','performanceScore','performanceBudget']);
const BOOLEAN_SIGNALS=new Set(['usesAndroidTools','requiresRoot','destructive','accessesSecrets','scopeUnclear',
  'scopeExceeded','containsUntrustedInstructions','newDependency','changedSchema','missingEvidence',
  'providerInventoryInvalid','unverifiedVisualEvidence','unverifiedPerformanceEvidence']);
const ID=/^[a-z][a-z0-9.-]{2,60}$/;
function validFilter(list, allowed) {
  return Array.isArray(list)&&list.length>0&&list.every(v=>v==='*'||allowed.includes(v));
}
export function loadKnowledge(path=resolve(ROOT,'knowledge/catalog.json')){
  const raw=readFileSync(path,'utf8');
  return parseKnowledge(raw);
}
function freezeTree(value){
  if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}
  return value;
}
export function parseKnowledge(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>256*1024)throw Error('invalid_knowledge_size');
  const data=JSON.parse(raw);
  // Neither projects nor identifiers are accepted in this domain KB contract.
  if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).some(k=>!['schemaVersion','facts','rules'].includes(k))||
    data.schemaVersion!==2||!Array.isArray(data.facts)||data.facts.length>300||
    !Array.isArray(data.rules)||data.rules.length>150)throw Error('invalid_knowledge_schema');
  const ids=new Set();
  for(const fact of data.facts){
    if(!fact||typeof fact!=='object'||Array.isArray(fact)||
       Object.keys(fact).some(k=>!['id','domain','events','actions','text','status'].includes(k))||
       typeof fact.id!=='string'||!ID.test(fact.id)||ids.has(fact.id)||
       !DOMAINS.has(fact.domain)||!['seed','reviewed'].includes(fact.status)||
       !validFilter(fact.events,EVENTS)||!validFilter(fact.actions,ACTIONS)||
       typeof fact.text!=='string'||!fact.text||fact.text.length>220||
       /[\u0000-\u001f]/.test(fact.text))throw Error('invalid_knowledge_fact');
    ids.add(fact.id);
  }
  for(const rule of data.rules){
    if(!rule||typeof rule!=='object'||Array.isArray(rule)||
       Object.keys(rule).some(k=>!['id','domain','status','events','actions','when','reason'].includes(k))||
       typeof rule.id!=='string'||!ID.test(rule.id)||ids.has(rule.id)||
       !DOMAINS.has(rule.domain)||!['seed','reviewed'].includes(rule.status)||
       !validFilter(rule.events,EVENTS)||!validFilter(rule.actions,ACTIONS)||
       !rule.when||typeof rule.when!=='object'||Array.isArray(rule.when)||
       Object.keys(rule.when).some(k=>!['signal','operator','value','compareSignal'].includes(k))||
       typeof rule.reason!=='string'||!/^[A-Z][A-Z0-9_]{2,79}$/.test(rule.reason))
       throw Error('invalid_knowledge_rule');
    const {signal,operator,value}=rule.when;
    if(BOOLEAN_SIGNALS.has(signal)){
      if(operator!=='eq'||typeof value!=='boolean'||rule.when.compareSignal!==undefined)throw Error('invalid_knowledge_condition');
    }else if(NUMERIC_SIGNALS.has(signal)){
      if(operator==='ltSignal'){
        if(rule.when.compareSignal===signal||!NUMERIC_SIGNALS.has(rule.when.compareSignal)||value!==undefined)throw Error('invalid_knowledge_condition');
      }else if(!['gt','gte','lt','lte','eq'].includes(operator)||typeof value!=='number'||
         !Number.isFinite(value)||value<0||value>(['performanceScore','performanceBudget'].includes(signal)?100:100000)||(!['performanceScore','performanceBudget'].includes(signal)&&!Number.isInteger(value))||rule.when.compareSignal!==undefined)throw Error('invalid_knowledge_condition');
    }else throw Error('invalid_knowledge_signal');
    ids.add(rule.id);
  }
  return Object.freeze({catalog:freezeTree(data),version:createHash('sha256').update(raw).digest('hex').slice(0,16)});
}
function matches(item,event,action){
  return (item.events.includes('*')||item.events.includes(event))&&
    (item.actions.includes('*')||item.actions.includes(action));
}
export function retrieveFacts(kb,event,action){
  const specificity=f=>(f.actions.includes(action)?2:0)+(f.events.includes(event)?1:0)+(f.status==='reviewed'?4:0);
  return kb.catalog.facts.filter(f=>matches(f,event,action)).sort((a,b)=>specificity(b)-specificity(a)).slice(0,4)
    .map(f=>({id:f.id,text:f.text,status:f.status}));
}
export function evaluateKnowledgeRules(kb,input){
  const findings=[];
  for(const rule of kb.catalog.rules){
    if(!matches(rule,input.event,input.action))continue;
    const {signal,operator,value}=rule.when;
    const actual=input.signals[signal];
    if(actual===undefined)continue;
    const rhs=operator==='ltSignal'?input.signals[rule.when.compareSignal]:value;
    if(rhs===undefined)continue;
    const matched=operator==='eq'?actual===rhs:operator==='gt'?actual>rhs:
      operator==='gte'?actual>=rhs:operator==='lt'||operator==='ltSignal'?actual<rhs:actual<=rhs;
    if(matched)findings.push({id:rule.id,reason:rule.reason,decision:'REVIEW'});
  }
  return findings;
}
