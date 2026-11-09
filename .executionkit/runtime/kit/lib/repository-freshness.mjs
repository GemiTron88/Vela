import { spawnSync } from 'node:child_process';
import { normalizeKnowledgePath } from './repository-intelligence.mjs';
import { captureRepositorySnapshot } from './repository-source.mjs';

export const DEFAULT_TRUST_THRESHOLDS = Object.freeze({
  trustedMin: 85,
  verifyMin: 65,
  degradedMin: 40,
});

const EVIDENCE_CAPS = Object.freeze({
  LIVE_SOURCE: 100,
  SOURCE_INDEX: 100,
  RELATIONSHIP_GRAPH: 95,
  GENERATED_CONTEXT: 90,
  GENERATED_HUMAN_DOC: 82,
  HUMAN_DOMAIN_KNOWLEDGE: 78,
  EXTERNAL_ADVISORY: 55,
});

function git(root, args) {
  const r=spawnSync('git', args, { cwd:root, encoding:'utf8', timeout:15000, maxBuffer:16*1024*1024, windowsHide:true });
  return { ok:r.status===0, stdout:r.stdout ?? '', stderr:r.stderr ?? '', status:r.status, error:r.error ?? null };
}
function lines(value) { return String(value ?? '').trim().split(/\r?\n/).filter(Boolean); }
function pathInScope(rel, scope) { return rel===scope || rel.startsWith(`${scope}/`); }
function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length===0) return [];
  return [...new Set(scopes.map(normalizeKnowledgePath))].sort();
}
function clamp(value, min=0, max=100) { return Math.min(max,Math.max(min,value)); }

export function trustStateForScore(score, thresholds = DEFAULT_TRUST_THRESHOLDS) {
  if (!Number.isFinite(score)) return 'UNAVAILABLE';
  if (score >= thresholds.trustedMin) return 'TRUSTED';
  if (score >= thresholds.verifyMin) return 'VERIFY';
  if (score >= thresholds.degradedMin) return 'DEGRADED';
  return 'SOURCE_ONLY';
}

export function gitBaselineReachability(root, baselineSha) {
  if (typeof baselineSha!=='string' || !/^[a-f0-9]{7,64}$/i.test(baselineSha)) {
    return { reachable:false, ancestor:false, reason:'baseline_missing_or_invalid' };
  }
  const exists=git(root,['cat-file','-e',`${baselineSha}^{commit}`]);
  if(!exists.ok) return {reachable:false,ancestor:false,reason:'baseline_unreachable'};
  const ancestor=git(root,['merge-base','--is-ancestor',baselineSha,'HEAD']);
  if(!ancestor.ok) return {reachable:true,ancestor:false,reason:'baseline_not_ancestor'};
  return {reachable:true,ancestor:true,reason:null};
}

export function repositoryDrift(root, { baselineSha, sourceScopes=[] } = {}) {
  const snapshot=captureRepositorySnapshot(root);
  const scopes=normalizeScopes(sourceScopes);
  if (!snapshot.isGit) {
    return {measurable:false,reason:'not_git',baselineSha:baselineSha ?? null,currentHead:null,commitsSince:null,changedPaths:[],dirtyPaths:[],relevantChangedPaths:[],relevantTrackedFiles:0,changedRatio:null,scopes};
  }
  const reachable=gitBaselineReachability(root,baselineSha);
  if (!reachable.reachable || reachable.ancestor===false) {
    return {measurable:false,reason:reachable.reason,baselineSha:baselineSha ?? null,currentHead:snapshot.head,commitsSince:null,changedPaths:[],dirtyPaths:snapshot.dirtyPaths,relevantChangedPaths:[],relevantTrackedFiles:0,changedRatio:null,scopes};
  }
  const commitCount=git(root,['rev-list','--count',`${baselineSha}..HEAD`]);
  const changed=git(root,['diff','--name-only',`${baselineSha}..HEAD`]);
  const tracked=git(root,['ls-files']);
  if(!commitCount.ok || !changed.ok || !tracked.ok) {
    return {measurable:false,reason:'git_drift_command_failed',baselineSha,currentHead:snapshot.head,commitsSince:null,changedPaths:[],dirtyPaths:snapshot.dirtyPaths,relevantChangedPaths:[],relevantTrackedFiles:0,changedRatio:null,scopes};
  }
  const parsedCommits=Number.parseInt(commitCount.stdout.trim() || '0',10);
  if(!Number.isInteger(parsedCommits) || parsedCommits<0) {
    return {measurable:false,reason:'git_commit_count_invalid',baselineSha,currentHead:snapshot.head,commitsSince:null,changedPaths:[],dirtyPaths:snapshot.dirtyPaths,relevantChangedPaths:[],relevantTrackedFiles:0,changedRatio:null,scopes};
  }
  const isInternal=(rel)=>rel==='.executionkit'||rel.startsWith('.executionkit/');
  const cleanDirty=(snapshot.dirtyPaths??[]).filter((rel)=>!isInternal(rel));
  const changedPaths=lines(changed.stdout).filter((rel)=>!isInternal(rel));
  const allChanged=[...new Set([...changedPaths,...cleanDirty])].sort();
  const isRelevant=(rel)=>scopes.length ? scopes.some((scope)=>pathInScope(rel,scope)) : true;
  const relevantChangedPaths=allChanged.filter(isRelevant);
  const trackedPaths=lines(tracked.stdout).filter((rel)=>!isInternal(rel));
  const relevantTrackedFiles=scopes.length ? trackedPaths.filter(isRelevant).length : trackedPaths.length;
  const changedRatio=Math.min(1,relevantChangedPaths.length/Math.max(1,relevantTrackedFiles));
  return {measurable:true,reason:null,baselineSha,currentHead:snapshot.head,commitsSince:parsedCommits,changedPaths:allChanged,dirtyPaths:cleanDirty,relevantChangedPaths,relevantTrackedFiles,changedRatio,scopes};
}

export function scoreRepositoryKnowledge({evidenceKind,drift,generatedAt,thresholds=DEFAULT_TRUST_THRESHOLDS,maxAgeDays=30} = {}) {
  if (!Object.hasOwn(EVIDENCE_CAPS,evidenceKind)) throw new Error(`Unknown evidence kind: ${evidenceKind}`);
  if (!drift || typeof drift!=='object') throw new Error('drift report is required');
  const reasons=[]; const factors={}; const intrinsicCap=EVIDENCE_CAPS[evidenceKind];
  if (!drift.measurable) {
    return {score:Math.min(intrinsicCap,20),state:'SOURCE_ONLY',measured:true,intrinsicCap,factors:{unmeasurablePenalty:80},reasons:[drift.reason || 'drift_unmeasurable'],sourceValidationRequired:true};
  }
  let score=intrinsicCap;
  const commits=Number.isInteger(drift.commitsSince) ? drift.commitsSince : 0;
  const relevantDrift=(drift.relevantChangedPaths?.length??0)>0;
  factors.commitPenalty=relevantDrift ? Math.min(30,Math.max(6,commits*3)) : 0; score-=factors.commitPenalty;
  const ratio=Number.isFinite(drift.changedRatio) ? clamp(drift.changedRatio,0,1) : 1;
  factors.scopeDriftPenalty=Math.round(ratio*35); score-=factors.scopeDriftPenalty;
  const relevantDirty=drift.dirtyPaths?.some((rel)=>drift.scopes?.length ? drift.scopes.some((scope)=>pathInScope(rel,scope)) : true) ?? false;
  factors.relevantDirtyPenalty=relevantDirty ? 10 : 0; score-=factors.relevantDirtyPenalty;
  const parsed=Date.parse(generatedAt ?? '');
  if (!Number.isFinite(parsed)) { factors.agePenalty=10; reasons.push('generated_at_unknown'); }
  else {
    const ageDays=Math.max(0,(Date.now()-parsed)/(24*60*60*1000));
    factors.agePenalty=Math.min(10,Math.floor((ageDays/Math.max(1,maxAgeDays))*10));
    if (ageDays>maxAgeDays) reasons.push('artifact_age_exceeded');
  }
  score-=factors.agePenalty; score=clamp(Math.round(score));
  if (commits>0) reasons.push(`repo_advanced_${commits}_commits`);
  if (drift.relevantChangedPaths?.length) reasons.push(`scope_changed_${drift.relevantChangedPaths.length}_paths`);
  if (relevantDirty) reasons.push('relevant_worktree_dirty');
  if (score===intrinsicCap && intrinsicCap<100) reasons.push('derived_evidence_cap');
  const state=trustStateForScore(score,thresholds);
  return {score,state,measured:true,intrinsicCap,factors,reasons:[...new Set(reasons)],sourceValidationRequired:state!=='TRUSTED'};
}

export function measureArtifactFreshness(root, artifact, options = {}) {
  if (!artifact || typeof artifact!=='object') throw new Error('artifact metadata is required');
  const drift=repositoryDrift(root,{baselineSha:artifact.repository?.baselineSha,sourceScopes:artifact.sourceScopes ?? []});
  const trust=scoreRepositoryKnowledge({evidenceKind:artifact.evidenceKind,drift,generatedAt:artifact.generatedAt,thresholds:options.thresholds ?? DEFAULT_TRUST_THRESHOLDS,maxAgeDays:options.maxAgeDays ?? 30});
  return {schemaVersion:'1.0.0',artifactId:artifact.artifactId ?? null,measuredAt:new Date().toISOString(),repositoryKey:artifact.repository?.key ?? null,currentHead:drift.currentHead,baselineSha:drift.baselineSha,scopes:drift.scopes,drift,trust};
}

export function pathTrustMap(root, artifacts, options = {}) {
  if (!Array.isArray(artifacts)) throw new Error('artifacts must be an array');
  return artifacts.map((artifact)=>measureArtifactFreshness(root,artifact,options));
}
