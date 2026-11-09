import { buildSourcePack } from './repository-source.mjs';
import { repositoryDrift } from './repository-freshness.mjs';
import { buildEngineeringKnowledge, engineeringKnowledgeSectionKeys } from './repository-engineering-knowledge.mjs';

const CROSS_CUTTING=/^(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|composer\.(?:json|lock)|pubspec\.(?:yaml|lock)|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|pyproject\.toml|requirements[^/]*\.txt|tsconfig[^/]*\.json|vite\.config\.|webpack\.|rollup\.config\.|execution\.config\.json)/i;

function validateArtifact(value){
  if(!value||value.artifactType!=='engineering-knowledge'||!value.sections) return {ok:false,reason:'invalid_engineering_artifact'};
  for(const key of engineeringKnowledgeSectionKeys){
    const s=value.sections[key];
    if(!s||typeof s.fingerprint!=='string'||!Array.isArray(s.sourceRefs)) return {ok:false,reason:`invalid_section_${key}`};
  }
  return {ok:true,reason:null};
}
function changedSections(existing,fresh){
  return engineeringKnowledgeSectionKeys.filter((key)=>existing.sections[key].fingerprint!==fresh.sections[key].fingerprint);
}
function preservedSections(changed){return engineeringKnowledgeSectionKeys.filter((key)=>!changed.includes(key));}
function relevantCrossCutting(drift){return ((drift?.changedPaths??drift?.relevantChangedPaths)??[]).filter((p)=>CROSS_CUTTING.test(p));}
function metadataFromFresh(fresh,sections,refresh){return {...fresh,sections,refresh};}
function ensurePreserved(before,after,preserved){
  for(const key of preserved){
    if(JSON.stringify(before.sections[key])!==JSON.stringify(after.sections[key])) throw new Error(`Semantic updater modified preserved section: ${key}`);
  }
}
function validateCandidate(candidate){
  const basic=validateArtifact(candidate); if(!basic.ok)throw new Error(basic.reason);
  for(const key of engineeringKnowledgeSectionKeys){
    if(!/^[a-f0-9]{64}$/.test(candidate.sections[key].fingerprint)) throw new Error(`Invalid section fingerprint: ${key}`);
  }
  return candidate;
}

export function planEngineeringKnowledgeRefresh(root,existing,{packOptions={},maxChangedSections=5,maxChangedPaths=60,maxScopeRatio=0.35}={}){
  if(!Number.isInteger(maxChangedSections)||maxChangedSections<1||maxChangedSections>engineeringKnowledgeSectionKeys.length)throw new Error('maxChangedSections is invalid');
  const pack=buildSourcePack(root,packOptions),fresh=buildEngineeringKnowledge(pack);
  const valid=validateArtifact(existing);
  if(!valid.ok) return {mode:'FULL',reason:valid.reason,pack,fresh,drift:null,changedSections:[...engineeringKnowledgeSectionKeys],preservedSections:[]};
  const drift=repositoryDrift(root,{baselineSha:existing.repository?.baselineSha,sourceScopes:existing.sourceScopes??[]});
  if(!drift.measurable) return {mode:'FULL',reason:drift.reason||'drift_unmeasurable',pack,fresh,drift,changedSections:[...engineeringKnowledgeSectionKeys],preservedSections:[]};
  const changed=changedSections(existing,fresh),preserved=preservedSections(changed);
  if(changed.length===0) return {mode:'SKIP',reason:'section_fingerprints_unchanged',pack,fresh,drift,changedSections:changed,preservedSections:preserved};
  const crossCutting=relevantCrossCutting(drift);
  if(crossCutting.length) return {mode:'FULL',reason:'cross_cutting_change',pack,fresh,drift,changedSections:changed,preservedSections:[],crossCuttingPaths:crossCutting};
  if((drift.relevantChangedPaths?.length??0)>maxChangedPaths) return {mode:'FULL',reason:'too_many_changed_paths',pack,fresh,drift,changedSections:changed,preservedSections:[]};
  if(Number.isFinite(drift.changedRatio)&&drift.changedRatio>maxScopeRatio) return {mode:'FULL',reason:'scope_change_ratio_exceeded',pack,fresh,drift,changedSections:changed,preservedSections:[]};
  if(changed.length>maxChangedSections) return {mode:'FULL',reason:'too_many_changed_sections',pack,fresh,drift,changedSections:changed,preservedSections:[]};
  return {mode:'INCREMENTAL',reason:'bounded_section_change',pack,fresh,drift,changedSections:changed,preservedSections:preserved};
}

export function executeEngineeringKnowledgeRefresh(root,existing,{semanticUpdater=null,...options}={}){
  const plan=planEngineeringKnowledgeRefresh(root,existing,options);
  const previousBaseline=existing?.repository?.baselineSha??null;
  if(plan.mode==='FULL'){
    const artifact=validateCandidate(metadataFromFresh(plan.fresh,plan.fresh.sections,{mode:'FULL',reason:plan.reason,previousBaseline,changedSections:plan.changedSections,preservedSections:[]}));
    return {status:'GENERATED',mode:'FULL',plan,artifact,artifactPreserved:existing??null};
  }
  if(plan.mode==='SKIP'){
    const artifact=validateCandidate(metadataFromFresh(plan.fresh,existing.sections,{mode:'SKIP',reason:plan.reason,previousBaseline,changedSections:[],preservedSections:[...engineeringKnowledgeSectionKeys]}));
    return {status:'CURRENT',mode:'SKIP',plan,artifact,artifactPreserved:existing};
  }
  const sections={};
  for(const key of engineeringKnowledgeSectionKeys) sections[key]=plan.changedSections.includes(key)?plan.fresh.sections[key]:existing.sections[key];
  let artifact=validateCandidate(metadataFromFresh(plan.fresh,sections,{mode:'INCREMENTAL',reason:plan.reason,previousBaseline,changedSections:plan.changedSections,preservedSections:plan.preservedSections}));
  if(semanticUpdater){
    if(typeof semanticUpdater!=='function') throw new Error('semanticUpdater must be a function');
    try{
      const updated=semanticUpdater({root,existing,candidate:artifact,plan});
      if(!updated||typeof updated!=='object'||typeof updated.then==='function') throw new Error('semanticUpdater must synchronously return a complete artifact');
      validateCandidate(updated); ensurePreserved(artifact,updated,plan.preservedSections); artifact=updated;
    }catch(error){
      return {status:'BLOCKED',mode:'INCREMENTAL',reason:'semantic_update_failed',error:error.message,plan,artifact:null,artifactPreserved:existing};
    }
  }
  return {status:'GENERATED',mode:'INCREMENTAL',plan,artifact,artifactPreserved:existing};
}
