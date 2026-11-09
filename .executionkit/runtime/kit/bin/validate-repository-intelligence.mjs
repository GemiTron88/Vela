#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { inspectRepositoryIntelligenceManagedBlock } from '../lib/agent-contract-compiler.mjs';
import { inspectRepositoryProviders } from '../lib/repository-providers.mjs';
import { repositoryIntelligenceConfig, repositoryKnowledgeCheckpointSummary, readStoredEngineeringKnowledge, readStoredExternalKnowledge } from '../lib/repository-knowledge-store.mjs';
import { validateRepositoryIntelligenceConfig } from '../lib/repository-intelligence.mjs';
import { measureArtifactFreshness } from '../lib/repository-freshness.mjs';
import { codeGraphStampStatus } from '../lib/repository-provider-adapters.mjs';
import { doctorRepositoryProviderTooling } from '../lib/repository-provider-deployment.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from '../lib/derived-state.mjs';

const root=path.resolve(process.argv[2]??'.');
const errors=[],warnings=[];
const issue=(list,code,message)=>list.push({code,message});
let projectConfig={};
try{projectConfig=loadConfig(root).config??{};}catch(error){issue(errors,'RI_EXECUTION_CONFIG_INVALID',error.message);}

const cfg=repositoryIntelligenceConfig(root,projectConfig);
if(cfg.enabled!==true){
  console.log(JSON.stringify({schemaVersion:'repository-intelligence-validation/v1',status:'DISABLED',ok:true,enabled:false,errors,warnings},null,2));
  process.exit(errors.length?1:0);
}
const checked=validateRepositoryIntelligenceConfig(cfg);
for(const item of checked.errors) issue(errors,item.code,item.message);

for(const [field,rel] of Object.entries(cfg.storage??{})){
  if(!['portableRoot','localRoot','contextPath','engineeringPath','externalKnowledgePath'].includes(field)) continue;
  try{resolveDerivedPath(root,rel,`repositoryIntelligence.storage.${field}`);}
  catch(error){issue(errors,'RI_STORAGE_PATH_INVALID',error.message);}
}

try{
  const agents=resolveProjectPathSafe(root,'AGENTS.md','Repository Intelligence AGENTS contract',{mustExist:true,file:true});
  const inspection=inspectRepositoryIntelligenceManagedBlock(fs.readFileSync(agents,'utf8'));
  if(inspection.status!=='CURRENT') issue(errors,'RI_AGENT_CONTRACT_NOT_CURRENT',`Repository Intelligence managed AGENTS block is ${inspection.status}${inspection.reason?`: ${inspection.reason}`:''}`);
}catch(error){issue(errors,'RI_AGENT_CONTRACT_MISSING',error.message);}

const providerToolingDoctor=doctorRepositoryProviderTooling(root);
if(providerToolingDoctor.status==='FAIL') issue(errors,'RI_PROVIDER_TOOLING_CORRUPT',`Managed provider tooling is corrupt: ${providerToolingDoctor.errors.join('; ')}`);

const providers=inspectRepositoryProviders(root);
if(providers.toolingError) issue(errors,'RI_PROVIDER_TOOLING_DISCOVERY_FAILED',`Managed provider discovery failed: ${providers.toolingError}`);
const byId=new Map(providers.providers.map((provider)=>[provider.id,provider]));
for(const id of cfg.providers.required??[]){
  const provider=byId.get(id);
  if(!provider) issue(errors,'RI_REQUIRED_PROVIDER_UNKNOWN',`Required provider ${id} is not present in the provider catalog`);
  else if(provider.status!=='READY') issue(errors,'RI_REQUIRED_PROVIDER_NOT_READY',`Required provider ${id} is ${provider.status}${provider.health?.reason?`: ${provider.health.reason}`:''}`);
}
for(const id of cfg.providers.optional??[]){
  const provider=byId.get(id);
  if(!provider) issue(warnings,'RI_OPTIONAL_PROVIDER_UNKNOWN',`Optional provider ${id} is not present in the provider catalog`);
  else if(provider.status!=='READY') issue(warnings,'RI_OPTIONAL_PROVIDER_NOT_READY',`Optional provider ${id} is ${provider.status}${provider.health?.reason?`: ${provider.health.reason}`:''}`);
}
const codegraphStamp=codeGraphStampStatus(root);
const codegraph=byId.get('codegraph');
if(codegraph?.status==='READY' && codegraphStamp.status!=='CURRENT'){
  const target=(cfg.providers.required??[]).includes('codegraph')?errors:warnings;
  issue(target,'RI_CODEGRAPH_INDEX_NOT_CURRENT',`CodeGraph binary is READY but the ExecutionKit exact-HEAD index stamp is ${codegraphStamp.status}; relationship queries remain disabled until explicit indexing`);
}

const knowledge=repositoryKnowledgeCheckpointSummary(root,projectConfig);
let deepKnowledge=null, externalKnowledge=null;
let deepFreshness=null, externalFreshness=null;
try{
  deepKnowledge=readStoredEngineeringKnowledge(root,projectConfig);
  if(deepKnowledge){
    const expected=['systemContext','containers','components','domains','workflows','interfaces','data','integrations','tests','deployment'];
    if(deepKnowledge.artifactType!=='engineering-knowledge') issue(errors,'RI_ENGINEERING_KNOWLEDGE_TYPE_INVALID','Stored engineering knowledge has the wrong artifact type');
    for(const key of expected) if(!deepKnowledge.sections?.[key]) issue(errors,'RI_ENGINEERING_KNOWLEDGE_SECTION_MISSING',`Stored engineering knowledge is missing section ${key}`);
    deepFreshness=measureArtifactFreshness(root,deepKnowledge,{thresholds:cfg.thresholds});
    if(['SOURCE_ONLY','UNAVAILABLE'].includes(deepFreshness.trust.state)) issue(warnings,'RI_ENGINEERING_KNOWLEDGE_NOT_TRUSTED',`Stored engineering knowledge trust is ${deepFreshness.trust.state}; regenerate or use live source`);
  }
}catch(error){issue(errors,'RI_ENGINEERING_KNOWLEDGE_INVALID',error.message);}
try{
  externalKnowledge=readStoredExternalKnowledge(root,projectConfig);
  if(externalKnowledge){
    if(externalKnowledge.artifactType!=='external-knowledge'||externalKnowledge.authority!=='ADVISORY_ONLY'||externalKnowledge.conflictPolicy!=='LIVE_SOURCE_WINS') issue(errors,'RI_EXTERNAL_KNOWLEDGE_AUTHORITY_INVALID','Stored external knowledge must remain ADVISORY_ONLY with LIVE_SOURCE_WINS');
    externalFreshness=measureArtifactFreshness(root,externalKnowledge,{thresholds:cfg.thresholds});
    if(['SOURCE_ONLY','UNAVAILABLE'].includes(externalFreshness.trust.state)) issue(warnings,'RI_EXTERNAL_KNOWLEDGE_NOT_TRUSTED',`Stored external knowledge trust is ${externalFreshness.trust.state}; re-ingest or use live source`);
  }
}catch(error){issue(errors,'RI_EXTERNAL_KNOWLEDGE_INVALID',error.message);}
if(knowledge.status==='INVALID_CONFIG'||knowledge.status==='INVALID_ARTIFACT') issue(errors,'RI_KNOWLEDGE_STORE_INVALID',knowledge.error??knowledge.status);
else if(knowledge.status==='MISSING') issue(warnings,'RI_KNOWLEDGE_CONTEXT_MISSING','No persisted repository context exists yet; agents must use live/bounded source until one is generated.');
else if(['SOURCE_ONLY','UNAVAILABLE'].includes(knowledge.trustState)) issue(warnings,'RI_KNOWLEDGE_NOT_TRUSTED',`Stored repository context trust is ${knowledge.trustState}; live source remains required.`);

const result={
  schemaVersion:'repository-intelligence-validation/v1',
  status:errors.length?'FAIL':warnings.length?'PASS_WITH_WARNINGS':'PASS',
  ok:errors.length===0,
  enabled:true,
  authority:'ADVISORY_SOURCE_GROUNDED',
  taskAuthority:projectConfig.todoPath??'TODO.md',
  configuration:{
    storage:cfg.storage,
    sourceEgressAllowed:cfg.privacy.allowSourceEgress,
    secretSensitivePathsAllowed:cfg.privacy.includeSecretSensitivePaths,
    requiredProviders:cfg.providers.required,
    optionalProviders:cfg.providers.optional,
    ingestion:{pathCount:cfg.ingestion?.paths?.length??0,maxFileBytes:cfg.ingestion?.maxFileBytes??null,maxTotalBytes:cfg.ingestion?.maxTotalBytes??null},
  },
  knowledge,
  deepKnowledge:deepKnowledge?{status:'AVAILABLE',artifactId:deepKnowledge.artifactId,baselineSha:deepKnowledge.repository?.baselineSha??null,sectionCount:Object.keys(deepKnowledge.sections??{}).length,trustState:deepFreshness?.trust?.state??'UNKNOWN'}: {status:'MISSING'},
  externalKnowledge:externalKnowledge?{status:'AVAILABLE',artifactId:externalKnowledge.artifactId,baselineSha:externalKnowledge.repository?.baselineSha??null,entryCount:externalKnowledge.entries?.length??0,authority:externalKnowledge.authority,trustState:externalFreshness?.trust?.state??'UNKNOWN'}: {status:'MISSING'},
  relationshipIndex:codegraphStamp,
  providerTooling:{status:providerToolingDoctor.status,ok:providerToolingDoctor.ok,providers:(providerToolingDoctor.providers??[]).map((item)=>({provider:item.provider,version:item.probe?.version??null})),errors:providerToolingDoctor.errors??[]},
  providers:providers.providers.map(({id,status,version,health})=>({id,status,version,reason:health?.reason??null,baselineSha:health?.baselineSha??null})),
  errors,
  warnings,
};
console.log(JSON.stringify(result,null,2));
process.exit(errors.length?1:0);
