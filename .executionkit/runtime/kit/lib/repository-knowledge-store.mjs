import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './execution-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { measureArtifactFreshness } from './repository-freshness.mjs';
import { validateArtifactMetadata, validateRepositoryIntelligenceConfig } from './repository-intelligence.mjs';

export const DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG=Object.freeze({
  enabled:false,
  storage:Object.freeze({
    portableRoot:'.executionkit/knowledge',
    localRoot:'.executionkit/repository-intelligence',
    contextPath:'.executionkit/knowledge/repository-context.json',
    engineeringPath:'.executionkit/knowledge/engineering-knowledge.json',
    externalKnowledgePath:'.executionkit/knowledge/external-knowledge.json',
  }),
  privacy:Object.freeze({allowSourceEgress:false,includeSecretSensitivePaths:false,extraDenyPaths:Object.freeze([])}),
  thresholds:Object.freeze({trustedMin:85,verifyMin:65,degradedMin:40}),
  providers:Object.freeze({required:Object.freeze([]),optional:Object.freeze([])}),
  autoConsumption:Object.freeze({enabled:false,preferred:Object.freeze([]),fallback:'native'}),
  context:Object.freeze({maxBytes:16*1024}),
  ingestion:Object.freeze({paths:Object.freeze([]),maxFileBytes:256*1024,maxTotalBytes:2*1024*1024}),
  refresh:Object.freeze({maxChangedPaths:60,maxChangedSections:5,maxScopeRatio:0.35}),
});

const hash=(value)=>crypto.createHash('sha256').update(value).digest('hex');

function rawProjectConfig(root,config){
  if(config&&typeof config==='object') return config;
  try{return loadConfig(root).config;}catch{}
  try{
    const file=path.join(path.resolve(root),'execution.config.json');
    if(fs.existsSync(file)&&fs.statSync(file).isFile()){
      const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)) return parsed;
    }
  }catch{}
  return {};
}
export function repositoryIntelligenceConfig(root,config=null){
  const project=rawProjectConfig(root,config), raw=project.repositoryIntelligence;
  if(!raw||typeof raw!=='object') return {
    ...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG,
    storage:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.storage},
    privacy:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.privacy,extraDenyPaths:[]},
    thresholds:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.thresholds},
    providers:{required:[],optional:[...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.providers.optional]},
    autoConsumption:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.autoConsumption,preferred:[...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.autoConsumption.preferred]},
    context:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.context},
    ingestion:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.ingestion,paths:[]},
    refresh:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.refresh},
  };
  return {
    ...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG,
    ...raw,
    storage:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.storage,...(raw.storage??{})},
    privacy:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.privacy,...(raw.privacy??{}),extraDenyPaths:[...(raw.privacy?.extraDenyPaths??[])]},
    thresholds:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.thresholds,...(raw.thresholds??{})},
    providers:{required:[],optional:[]},
    autoConsumption:{
      enabled:raw.autoConsumption?.enabled??DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.autoConsumption.enabled,
      preferred:[],
      fallback:'native',
    },
    context:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.context,...(raw.context??{})},
    ingestion:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.ingestion,...(raw.ingestion??{}),paths:[...(raw.ingestion?.paths??[])]},
    refresh:{...DEFAULT_REPOSITORY_INTELLIGENCE_CONFIG.refresh,...(raw.refresh??{})},
  };
}

export function repositoryContextArtifactPath(root,config=null,{create=false}={}){
  const cfg=repositoryIntelligenceConfig(root,config);
  return resolveDerivedPath(root,cfg.storage.contextPath,'Repository Intelligence context artifact',{createParents:create});
}

export function repositoryEngineeringArtifactPath(root,config=null,{create=false}={}){
  const cfg=repositoryIntelligenceConfig(root,config);
  return resolveDerivedPath(root,cfg.storage.engineeringPath,'Repository Intelligence engineering knowledge artifact',{createParents:create});
}
export function repositoryExternalKnowledgeArtifactPath(root,config=null,{create=false}={}){
  const cfg=repositoryIntelligenceConfig(root,config);
  return resolveDerivedPath(root,cfg.storage.externalKnowledgePath,'Repository Intelligence external knowledge artifact',{createParents:create});
}

function readArtifactFile(file,label,{requireBody=false,maxBytes=4*1024*1024}={}){
  if(!fs.existsSync(file)) return null;
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()) throw new Error(`${label} must be a real file`);
  if(stat.size>maxBytes) throw new Error(`${label} exceeds ${maxBytes} byte safety limit`);
  const artifact=JSON.parse(fs.readFileSync(file,'utf8'));
  const validation=validateArtifactMetadata(artifact);
  if(!validation.ok) throw new Error(`${label} invalid: ${validation.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  if(requireBody && (typeof artifact.body!=='string'||!artifact.body.trim())) throw new Error(`${label} body is missing`);
  return artifact;
}
function writeArtifactFile(root,file,artifact,label,{requireBody=false,maxBytes=4*1024*1024}={}){
  const validation=validateArtifactMetadata(artifact);
  if(!validation.ok) throw new Error(`${label} invalid: ${validation.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  if(requireBody && (typeof artifact.body!=='string'||!artifact.body.trim())) throw new Error(`${label} body is required`);
  const content=`${JSON.stringify(artifact,null,2)}\n`;
  if(Buffer.byteLength(content,'utf8')>maxBytes) throw new Error(`${label} exceeds ${maxBytes} byte safety limit`);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try{fs.writeFileSync(tmp,content,{mode:0o600});fs.renameSync(tmp,file);}
  finally{if(fs.existsSync(tmp))fs.rmSync(tmp,{force:true});}
  return {status:'STORED',path:path.relative(path.resolve(root),file).split(path.sep).join('/'),sha256:hash(content),bytes:Buffer.byteLength(content,'utf8'),artifactId:artifact.artifactId,baselineSha:artifact.repository?.baselineSha??null};
}

export function readStoredRepositoryContext(root,config=null){
  const cfg=repositoryIntelligenceConfig(root,config);
  if(cfg.enabled!==true) return null;
  return readArtifactFile(repositoryContextArtifactPath(root,config),'Repository Intelligence context artifact',{requireBody:true,maxBytes:2*1024*1024});
}

export function writeStoredRepositoryContext(root,artifact,config=null){
  const cfg=repositoryIntelligenceConfig(root,config);
  const cfgValidation=validateRepositoryIntelligenceConfig(cfg);
  if(!cfgValidation.ok) throw new Error(`Repository Intelligence config invalid: ${cfgValidation.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  if(cfg.enabled!==true) throw new Error('Repository Intelligence is disabled');
  return writeArtifactFile(root,repositoryContextArtifactPath(root,config,{create:true}),artifact,'Repository Intelligence context artifact',{requireBody:true,maxBytes:2*1024*1024});
}

export function repositoryKnowledgeCheckpointSummary(root,config=null){
  const cfg=repositoryIntelligenceConfig(root,config), authority='ADVISORY_SOURCE_GROUNDED';
  if(cfg.enabled!==true) return {authority,enabled:false,status:'DISABLED',trustState:'UNAVAILABLE',artifactId:null,baselineSha:null,currentHead:null,generatedAt:null,provider:null};
  const configValidation=validateRepositoryIntelligenceConfig(cfg);
  if(!configValidation.ok) return {authority,enabled:true,status:'INVALID_CONFIG',trustState:'UNAVAILABLE',artifactId:null,baselineSha:null,currentHead:null,generatedAt:null,provider:null,errors:configValidation.errors.map((item)=>item.code)};
  let artifact;
  try{artifact=readStoredRepositoryContext(root,config);}catch(error){return {authority,enabled:true,status:'INVALID_ARTIFACT',trustState:'UNAVAILABLE',artifactId:null,baselineSha:null,currentHead:null,generatedAt:null,provider:null,error:error.message};}
  if(!artifact) return {authority,enabled:true,status:'MISSING',trustState:'UNAVAILABLE',artifactId:null,baselineSha:null,currentHead:null,generatedAt:null,provider:null};
  const freshness=measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds});
  return {
    authority,
    enabled:true,
    status:'AVAILABLE',
    trustState:freshness.trust.state,
    score:freshness.trust.score,
    sourceValidationRequired:freshness.trust.sourceValidationRequired,
    artifactId:artifact.artifactId,
    baselineSha:artifact.repository?.baselineSha??null,
    currentHead:freshness.currentHead??null,
    generatedAt:artifact.generatedAt??null,
    provider:artifact.provider?.id??null,
    reasons:freshness.trust.reasons,
  };
}


export function readStoredEngineeringKnowledge(root,config=null){
  const cfg=repositoryIntelligenceConfig(root,config); if(cfg.enabled!==true)return null;
  return readArtifactFile(repositoryEngineeringArtifactPath(root,config),'Repository Intelligence engineering knowledge',{maxBytes:4*1024*1024});
}
export function writeStoredEngineeringKnowledge(root,artifact,config=null){
  const cfg=repositoryIntelligenceConfig(root,config),validation=validateRepositoryIntelligenceConfig(cfg);
  if(!validation.ok)throw new Error(`Repository Intelligence config invalid: ${validation.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  if(cfg.enabled!==true)throw new Error('Repository Intelligence is disabled');
  return writeArtifactFile(root,repositoryEngineeringArtifactPath(root,config,{create:true}),artifact,'Repository Intelligence engineering knowledge',{maxBytes:4*1024*1024});
}
export function readStoredExternalKnowledge(root,config=null){
  const cfg=repositoryIntelligenceConfig(root,config); if(cfg.enabled!==true)return null;
  return readArtifactFile(repositoryExternalKnowledgeArtifactPath(root,config),'Repository Intelligence external knowledge',{maxBytes:4*1024*1024});
}
export function writeStoredExternalKnowledge(root,artifact,config=null){
  const cfg=repositoryIntelligenceConfig(root,config),validation=validateRepositoryIntelligenceConfig(cfg);
  if(!validation.ok)throw new Error(`Repository Intelligence config invalid: ${validation.errors.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  if(cfg.enabled!==true)throw new Error('Repository Intelligence is disabled');
  return writeArtifactFile(root,repositoryExternalKnowledgeArtifactPath(root,config,{create:true}),artifact,'Repository Intelligence external knowledge',{maxBytes:4*1024*1024});
}
