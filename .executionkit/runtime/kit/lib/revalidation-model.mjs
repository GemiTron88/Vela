import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  extractReferenceTarget,
  loadConfig,
  loadTasks,
  normalizePath,
  stateSatisfiesDependency,
} from './execution-model.mjs';
import { todoShardSources } from './todo-shards.mjs';
import { loadIntegrationContract } from './integration-model.mjs';
import { loadCandidate, loadEvidence, validateCollectedEvidence } from './evidence-model.mjs';

function git(root, args) {
  const result = spawnSync('git', args, { cwd:root, encoding:'utf8', timeout:15000, windowsHide:true });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || result.error?.message || `git ${args.join(' ')} failed`).trim());
  return result.stdout.trim();
}
function lines(value) { return String(value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function cleanRef(value) {
  const raw = String(value ?? '').trim().replace(/^['"`]|['"`]$/g,'');
  if (!raw || /^(NONE|N\/A|NA|PENDING|TBD)$/i.test(raw) || /^https?:\/\//i.test(raw)) return null;
  const hash = raw.indexOf('#');
  const rel = (hash >= 0 ? raw.slice(0,hash) : raw).trim().replace(/^\.\//,'');
  if (!rel || path.isAbsolute(rel) || rel.startsWith('../') || rel.includes('..\\')) return null;
  return normalizePath(rel);
}
function referenceCandidates(value) {
  const out = new Set();
  const direct = extractReferenceTarget(value);
  if (direct?.path) out.add(normalizePath(direct.path));
  for (const match of String(value ?? '').matchAll(/`([^`]+)`/g)) {
    const ref = cleanRef(match[1]); if (ref) out.add(ref);
  }
  for (const token of String(value ?? '').split(/[;,|]/)) {
    const ref = cleanRef(token); if (ref && (ref.includes('/') || /\.[A-Za-z0-9]{1,8}$/.test(ref))) out.add(ref);
  }
  return [...out];
}
function touches(changed, ref) {
  const c = normalizePath(changed), r = normalizePath(ref).replace(/\/$/,'');
  return c === r || c.startsWith(`${r}/`) || r.startsWith(`${c}/`);
}
function taskReferences(task, config) {
  const keys = new Set([...(config.referenceKeys ?? []),'Contract','Requirements','Ref','Refs','Code','Files','File','Path','Paths']);
  const refs = new Set();
  for (const key of keys) for (const ref of referenceCandidates(task.meta?.[key])) refs.add(ref);
  return [...refs];
}
function controlPaths(root,config) {
  const todo=todoShardSources(root,config);
  const taskAuthority=todo.errors.length
    ? [config.todoPath ?? 'TODO.md']
    : todo.mode==='sharded'
      ? [todo.manifestPath,...todo.active.map((x)=>x.path),...todo.archives]
      : [config.todoPath ?? 'TODO.md',...(config.taskArchivePaths??[])];
  return [
    'execution.config.json',
    ...taskAuthority,
    config.agent?.manifestPath,
    config.integration?.journeyContractPath ?? 'executionkit.integration.json',
    config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json',
    config.quality?.contractPath,
    config.seo?.contractPath,
    'AGENTS.md',
  ].filter(Boolean).map(normalizePath);
}
function controlSensitive(root,changed, config) {
  const exact = controlPaths(root,config);
  return changed.some((rel) =>
    exact.some((target) => touches(rel,target)) ||
    rel.startsWith('.agents/') ||
    rel.startsWith('bin/') ||
    rel.startsWith('lib/') ||
    rel.startsWith('schemas/') ||
    rel.startsWith('config/') ||
    rel.includes('/config/') ||
    rel.startsWith('database/migrations/') ||
    rel.includes('/migrations/')
  );
}
function currentEvidenceStatus(root, config, candidate) {
  const required = [...new Set(config.evidence?.requiredProducers ?? [])];
  if (!candidate) return { required, valid:[], missing:required, invalid:[] };
  let reports = [];
  try { reports = loadEvidence(root, candidate.candidateId); } catch { return { required, valid:[], missing:required, invalid:required }; }
  const byId = new Map(reports.map((report) => [report.producer, report]));
  const valid = [], invalid = [];
  for (const id of required) {
    const report = byId.get(id);
    if (!report) continue;
    const failures = validateCollectedEvidence(root, candidate, report, { maxAgeMinutes:Number(config.evidence?.maxAgeMinutes ?? 1440) });
    if (failures.length) invalid.push(id); else valid.push(id);
  }
  return { required, valid, invalid, missing:required.filter((id) => !valid.includes(id)) };
}

export function analyzeRevalidation(root) {
  const { config } = loadConfig(root);
  const loaded = loadTasks(root, config);
  if (loaded.errors.length) throw new Error(loaded.errors.map((error) => `[${error.code}] ${error.message}`).join('; '));
  let candidate;
  try { candidate = loadCandidate(root); } catch { candidate = null; }
  const previous = candidate?.previousCandidate ?? null;
  const evidence = currentEvidenceStatus(root, config, candidate);
  if (!candidate) {
    return { schemaVersion:'1.0.0', status:'CANDIDATE_MISSING', candidate:null, previousCandidate:null, changedFiles:[], controlPlaneChanged:false, acceptedTasksAtRisk:[], impactedJourneys:[], evidence, revalidationRequired:true };
  }
  if (!previous?.commit) {
    return { schemaVersion:'1.0.0', status:'BASELINE_UNAVAILABLE', candidate:{candidateId:candidate.candidateId,commit:candidate.commit}, previousCandidate:null, changedFiles:[], controlPlaneChanged:false, acceptedTasksAtRisk:[], impactedJourneys:[], evidence, revalidationRequired:evidence.missing.length>0 };
  }

  let changedFiles;
  try { changedFiles = lines(git(root,['diff','--name-only',`${previous.commit}..${candidate.commit}`])); }
  catch (error) {
    return { schemaVersion:'1.0.0', status:'BASELINE_UNAVAILABLE', candidate:{candidateId:candidate.candidateId,commit:candidate.commit}, previousCandidate:previous, changedFiles:[], controlPlaneChanged:false, acceptedTasksAtRisk:[], impactedJourneys:[], evidence, revalidationRequired:true, error:error.message };
  }
  const changedSet = [...new Set(changedFiles.map(normalizePath))];
  const acceptedTasks = loaded.tasks.filter((task) => !task.isArchive && stateSatisfiesDependency(task,config));
  const acceptedTasksAtRisk = [];
  for (const task of acceptedTasks) {
    const refs = taskReferences(task,config);
    const matched = changedSet.filter((changed) => refs.some((ref) => touches(changed,ref)));
    if (matched.length) acceptedTasksAtRisk.push({ taskId:task.id, phase:task.meta?.Phase ?? null, references:refs, changedFiles:matched });
  }

  const controlPlaneChanged = controlSensitive(root,changedSet,config);
  let contract = null;
  try { contract = loadIntegrationContract(root,config,{required:false}).contract; } catch {}
  const journeys = Array.isArray(contract?.journeys) ? contract.journeys : [];
  const riskyTaskIds = new Set(acceptedTasksAtRisk.map((item) => item.taskId));
  const unmappedProductChange = changedSet.length > 0 && acceptedTasksAtRisk.length === 0 && !controlPlaneChanged;
  const impactedJourneys = journeys.filter((journey) => {
    const members = new Set([...(journey.tasks ?? []),journey.gateTask].filter(Boolean));
    return controlPlaneChanged || [...members].some((id) => riskyTaskIds.has(id)) || (unmappedProductChange && journey.requiredForRelease === true);
  }).map((journey) => ({
    id:journey.id,
    gateTask:journey.gateTask,
    requiredForRelease:journey.requiredForRelease === true,
    reason:controlPlaneChanged ? 'CONTROL_PLANE_CHANGED' : [...new Set([...(journey.tasks ?? []),journey.gateTask].filter(Boolean))].some((id)=>riskyTaskIds.has(id)) ? 'MEMBER_REFERENCE_CHANGED' : 'UNMAPPED_CHANGE_FAIL_CLOSED',
  }));

  const meaningfulChange = changedSet.length > 0;
  const currentProofComplete = evidence.missing.length === 0;
  const revalidationRequired = meaningfulChange && (controlPlaneChanged || acceptedTasksAtRisk.length > 0 || impactedJourneys.length > 0) && !currentProofComplete;
  const status = !meaningfulChange ? 'NO_CHANGE' : revalidationRequired ? 'REVALIDATION_REQUIRED' : 'REVALIDATED_CURRENT_CANDIDATE';
  return {
    schemaVersion:'1.0.0',
    status,
    candidate:{candidateId:candidate.candidateId,commit:candidate.commit},
    previousCandidate:previous,
    changedFiles:changedSet,
    controlPlaneChanged,
    unmappedProductChange,
    acceptedTasksAtRisk,
    impactedJourneys,
    evidence,
    revalidationRequired,
  };
}
