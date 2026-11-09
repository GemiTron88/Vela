import {
  buildSourcePack,
  captureRepositorySnapshot,
  readPackedFile,
  searchSourcePack,
} from './repository-source.mjs';
import {
  buildNativeMacroContext,
  planContextRefresh,
} from './repository-context.mjs';
import { measureArtifactFreshness } from './repository-freshness.mjs';
import { inspectRepositoryProviders } from './repository-providers.mjs';
import { analyzeImpact, selectTests } from './impact-model.mjs';
import { repositoryIntelligenceEnums } from './repository-intelligence.mjs';
import { buildEngineeringKnowledge, renderEngineeringKnowledgeMarkdown } from './repository-engineering-knowledge.mjs';
import { executeEngineeringKnowledgeRefresh } from './repository-engineering-refresh.mjs';
import { ingestExternalKnowledge, searchExternalKnowledge } from './repository-external-knowledge.mjs';
import {
  readStoredRepositoryContext,
  readStoredEngineeringKnowledge,
  readStoredExternalKnowledge,
  repositoryIntelligenceConfig,
  repositoryKnowledgeCheckpointSummary,
  writeStoredRepositoryContext,
  writeStoredEngineeringKnowledge,
  writeStoredExternalKnowledge,
} from './repository-knowledge-store.mjs';

function packProvenance(pack) {
  return {
    provider: pack.provider,
    repository: pack.repository,
    limits: pack.limits,
    metrics: pack.metrics,
    skippedByReason: Object.fromEntries([...new Set(pack.skipped.map((item)=>item.reason))].sort().map((reason)=>[reason,pack.skipped.filter((item)=>item.reason===reason).length])),
  };
}

function boundedPackOptions(options={},cfg=null) {
  const out={};
  for(const key of ['maxFiles','maxFileBytes','maxTotalBytes','maxEstimatedTokens','extraDenyPaths']) if(options[key]!==undefined) out[key]=options[key];
  if(out.extraDenyPaths===undefined && cfg?.privacy?.extraDenyPaths) out.extraDenyPaths=[...cfg.privacy.extraDenyPaths];
  return out;
}
function requireEnabled(root){
  const cfg=repositoryIntelligenceConfig(root);
  if(cfg.enabled!==true) throw new Error('Repository Intelligence is disabled for this project');
  return cfg;
}

export function repositoryKnowledgeStatus(root) {
  const snapshot=captureRepositorySnapshot(root);
  const providers=inspectRepositoryProviders(root);
  const config=repositoryIntelligenceConfig(root);
  const stored=repositoryKnowledgeCheckpointSummary(root);
  return {
    schemaVersion:'1.0.0',
    authority:{
      task:'TODO.md_or_configured_native_authority',
      implementation:'LIVE_REPOSITORY',
      knowledge:'ADVISORY_SOURCE_GROUNDED',
      state:'ADVISORY_CONTINUITY',
    },
    repository:snapshot,
    configuration:{enabled:config.enabled,storage:config.storage,context:config.context,refresh:config.refresh,providers:config.providers,privacy:{allowSourceEgress:config.privacy.allowSourceEgress,includeSecretSensitivePaths:config.privacy.includeSecretSensitivePaths,extraDenyPathCount:config.privacy.extraDenyPaths.length}},
    stored,
    providers,
    trustStates:repositoryIntelligenceEnums.trustStates,
    refreshModes:repositoryIntelligenceEnums.refreshModes,
    limits:{
      fullSourcePackReturnedByDefault:false,
      liveSourceWins:true,
      unknownFreshnessFailsClosed:true,
    },
  };
}

export function repositoryKnowledgeContext(root,{maxBytes,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  const effectiveMaxBytes=maxBytes??cfg.context.maxBytes;
  const pack=buildSourcePack(root,boundedPackOptions(packOptions,cfg));
  const artifact=buildNativeMacroContext(pack,{maxBytes:effectiveMaxBytes});
  const freshness=measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds});
  return {
    schemaVersion:'1.0.0',
    artifact,
    freshness,
    source:packProvenance(pack),
  };
}

export function repositoryEngineeringKnowledge(root,{persist=false,includeDocs=false,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  const pack=buildSourcePack(root,boundedPackOptions(packOptions,cfg));
  const artifact=buildEngineeringKnowledge(pack);
  const freshness=measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds});
  const storage=persist ? writeStoredEngineeringKnowledge(root,artifact) : null;
  return {
    schemaVersion:'1.0.0',
    artifact,
    freshness,
    storage,
    persisted:Boolean(storage),
    docs:includeDocs?renderEngineeringKnowledgeMarkdown(artifact):null,
    source:packProvenance(pack),
  };
}

export function repositoryStoredEngineeringKnowledge(root) {
  const cfg=requireEnabled(root);
  const artifact=readStoredEngineeringKnowledge(root);
  if(!artifact) return {schemaVersion:'1.0.0',status:'MISSING',artifact:null,freshness:null};
  return {schemaVersion:'1.0.0',status:'AVAILABLE',artifact,freshness:measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds})};
}

export function repositoryEngineeringKnowledgeRefresh(root,{persist=false,semanticUpdater=null,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  const existing=readStoredEngineeringKnowledge(root);
  const result=executeEngineeringKnowledgeRefresh(root,existing,{
    semanticUpdater,
    packOptions:boundedPackOptions(packOptions,cfg),
    maxChangedPaths:cfg.refresh.maxChangedPaths,
    maxChangedSections:cfg.refresh.maxChangedSections,
    maxScopeRatio:cfg.refresh.maxScopeRatio,
  });
  const storage=(persist && result.artifact && result.status!=='BLOCKED') ? writeStoredEngineeringKnowledge(root,result.artifact) : null;
  const freshness=result.artifact ? measureArtifactFreshness(root,result.artifact,{thresholds:cfg.thresholds}) : null;
  return {
    schemaVersion:'1.0.0',
    status:result.status,
    mode:result.mode,
    reason:result.reason??result.plan?.reason??null,
    plan:{
      mode:result.plan?.mode??result.mode,
      reason:result.plan?.reason??null,
      changedSections:result.plan?.changedSections??[],
      preservedSections:result.plan?.preservedSections??[],
      changedPaths:result.plan?.drift?.relevantChangedPaths??[],
      crossCuttingPaths:result.plan?.crossCuttingPaths??[],
    },
    artifact:result.artifact??null,
    artifactPreserved:result.artifactPreserved??existing??null,
    freshness,
    storage,
    persisted:Boolean(storage),
    error:result.error??null,
  };
}

export function repositoryExternalKnowledgeIngest(root,{paths=null,persist=false,pdfProvider=null}={}) {
  const cfg=requireEnabled(root);
  const selected=paths??cfg.ingestion.paths;
  if(!Array.isArray(selected)||selected.length===0) throw new Error('No external knowledge paths configured or supplied');
  const artifact=ingestExternalKnowledge(root,selected,{maxFileBytes:cfg.ingestion.maxFileBytes,maxTotalBytes:cfg.ingestion.maxTotalBytes,pdfProvider});
  const freshness=measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds});
  const storage=persist?writeStoredExternalKnowledge(root,artifact):null;
  return {schemaVersion:'1.0.0',artifact,freshness,storage,persisted:Boolean(storage)};
}

export function repositoryExternalKnowledgeStored(root) {
  const cfg=requireEnabled(root),artifact=readStoredExternalKnowledge(root);
  if(!artifact)return {schemaVersion:'1.0.0',status:'MISSING',artifact:null,freshness:null};
  return {schemaVersion:'1.0.0',status:'AVAILABLE',artifact,freshness:measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds})};
}

export function repositoryExternalKnowledgeSearch(root,query,{limit=20}={}) {
  const cfg=requireEnabled(root),artifact=readStoredExternalKnowledge(root);
  if(!artifact) return {schemaVersion:'1.0.0',status:'MISSING',query,hits:[],freshness:null};
  return {schemaVersion:'1.0.0',status:'AVAILABLE',query,hits:searchExternalKnowledge(artifact,query,{limit}),freshness:measureArtifactFreshness(root,artifact,{thresholds:cfg.thresholds}),authority:'ADVISORY_ONLY',conflictPolicy:'LIVE_SOURCE_WINS'};
}

export function repositoryKnowledgeFreshness(root,{artifact=null,maxBytes,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  let selected=artifact, source=null, origin=artifact?'supplied':'stored';
  if(!selected) selected=readStoredRepositoryContext(root);
  if(!selected){
    const current=repositoryKnowledgeContext(root,{maxBytes,packOptions});
    selected=current.artifact;
    source=current.source;
    origin='generated-current';
  }
  return {
    schemaVersion:'1.0.0',
    origin,
    freshness:measureArtifactFreshness(root,selected,{thresholds:cfg.thresholds}),
    artifact:{artifactId:selected.artifactId??null,artifactType:selected.artifactType??null,evidenceKind:selected.evidenceKind??null,provider:selected.provider??null,repository:selected.repository??null,sourceScopes:selected.sourceScopes??[]},
    source,
  };
}

export function repositoryKnowledgeSearch(root,query,{limit=20,contextLines=1,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  if(typeof query!=='string'||!query.trim()) throw new Error('search query is required');
  const pack=buildSourcePack(root,boundedPackOptions(packOptions,cfg));
  return {
    schemaVersion:'1.0.0',
    query,
    hits:searchSourcePack(pack,query,{limit,contextLines}),
    source:packProvenance(pack),
  };
}

export function repositorySourceRead(root,filePath,{startLine=1,endLine=null,maxLines=150,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  if(!Number.isInteger(maxLines)||maxLines<1||maxLines>300) throw new Error('maxLines must be between 1 and 300');
  const pack=buildSourcePack(root,boundedPackOptions(packOptions,cfg));
  return {
    schemaVersion:'1.0.0',
    slice:readPackedFile(pack,filePath,{startLine,endLine,maxLines}),
    source:packProvenance(pack),
  };
}

export function repositoryChangeImpact(root,{base='HEAD~1'}={}) {
  requireEnabled(root);
  const impact=analyzeImpact(root,{base});
  const tests=selectTests(root,impact);
  return {
    schemaVersion:'1.0.0',
    impact,
    tests,
    graphAffectedTests:null,
    graphStamp:{status:'REMOVED',provider:'codegraph'},
    graphError:null,
    relationshipProviders:[],
    authority:'ADVISORY_CHANGE_IMPACT',
    testAuthorityNote:'ExecutionKit v4 uses native Git/source impact only; external relationship providers are removed from the runtime.',
  };
}

export function repositoryKnowledgeRefresh(root,{existingArtifact=null,apply=false,persist=false,forceFull=false,maxBytes,packOptions={}}={}) {
  const cfg=requireEnabled(root);
  const selected=existingArtifact??readStoredRepositoryContext(root);
  const plan=planContextRefresh(root,selected,{maxChangedPaths:cfg.refresh.maxChangedPaths,maxScopeRatio:cfg.refresh.maxScopeRatio});
  if(!apply) return {schemaVersion:'1.0.0',status:'PLANNED',plan,artifactPreserved:selected??null,stored:repositoryKnowledgeCheckpointSummary(root)};

  if(plan.mode==='SKIP') {
    return {schemaVersion:'1.0.0',status:'CURRENT',plan,artifact:selected,artifactPreserved:selected,stored:repositoryKnowledgeCheckpointSummary(root)};
  }
  if(plan.mode==='INCREMENTAL' && !forceFull) {
    return {
      schemaVersion:'1.0.0',
      status:'BLOCKED',
      plan,
      reason:'incremental_generation_provider_required',
      artifactPreserved:selected,
      stored:repositoryKnowledgeCheckpointSummary(root),
      note:'The native provider will not pretend a full regeneration is an incremental update. Configure an incremental-capable provider or explicitly request a FULL refresh.',
    };
  }
  if(plan.mode==='BLOCKED') return {schemaVersion:'1.0.0',status:'BLOCKED',plan,artifactPreserved:selected,stored:repositoryKnowledgeCheckpointSummary(root)};

  const current=repositoryKnowledgeContext(root,{maxBytes,packOptions});
  const storage=persist ? writeStoredRepositoryContext(root,current.artifact) : null;
  return {
    schemaVersion:'1.0.0',
    status:'GENERATED',
    effectiveMode:'FULL',
    fallbackReason: plan.mode==='INCREMENTAL' && forceFull ? 'explicit_full_fallback_from_incremental' : null,
    persisted:Boolean(storage),
    storage,
    plan,
    artifact:current.artifact,
    freshness:current.freshness,
    source:current.source,
    artifactPreserved:selected??null,
    stored:persist?repositoryKnowledgeCheckpointSummary(root):repositoryKnowledgeCheckpointSummary(root),
  };
}


export function repositoryRelationshipIndex(root) {
  requireEnabled(root);
  return {schemaVersion:'1.0.0',status:'REMOVED',provider:null,authority:'NATIVE_SOURCE_ONLY',note:'External CodeGraph indexing was removed from ExecutionKit v4.'};
}

export function repositoryProviderPack(root,{provider='native'}={}) {
  requireEnabled(root);
  if(provider!=='native')throw new Error('External source-pack providers were removed from ExecutionKit v4');
  return repositoryKnowledgeContext(root,{});
}

export function repositoryTerrainRead() {
  throw new Error('Terrain integration was removed from ExecutionKit v4');
}

export function repositoryRelationshipQuery(root,operation,target,{limit=50}={}) {
  requireEnabled(root);
  if(!['callers','callees','impact','search'].includes(operation))throw new Error(`Unsupported relationship operation: ${operation}`);
  if(typeof target!=='string'||!target.trim())throw new Error('relationship target/query is required');
  const source=repositoryKnowledgeSearch(root,target,{limit,contextLines:1});
  return {
    schemaVersion:'1.0.0',
    operation,
    target,
    relationshipGraphUsed:false,
    provider:'native-source-pack',
    graph:null,
    relationshipProviders:[],
    sourceHits:source.hits,
    note:'External relationship graph providers were removed; conservative live-source matches are returned.',
    authority:'ADVISORY_SOURCE_SEARCH',
  };
}

export function repositorySymbolQuery(root,symbol,{limit=20,packOptions={}}={}) {
  requireEnabled(root);
  if(typeof symbol!=='string'||!symbol.trim())throw new Error('symbol is required');
  const source=repositoryKnowledgeSearch(root,symbol,{limit,contextLines:0,packOptions});
  return {
    schemaVersion:'1.0.0',
    symbol,
    sourceHits:source.hits,
    source:source.source,
    relationshipProviders:[],
    relationshipGraphUsed:false,
    graph:null,
    graphStamp:{status:'REMOVED',provider:'codegraph'},
    graphError:null,
    note:'External relationship providers were removed; live source search is authoritative for navigation.',
  };
}