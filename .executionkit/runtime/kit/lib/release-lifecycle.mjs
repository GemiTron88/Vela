import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './execution-model.mjs';
import { loadCandidate, validateCandidate } from './evidence-model.mjs';
import { productionDeploymentStatus, validateProductionDeploymentReadiness } from './production-deployment.mjs';
import { resolveDerivedPath } from './derived-state.mjs';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function gateFile(root, name) {
  return resolveDerivedPath(root, `.executionkit/gates/${name}-release.json`, `${name} release gate`);
}
function releaseReadinessFile(root) {
  return resolveDerivedPath(root, '.executionkit/release/release-readiness.json', 'release readiness state');
}
function validateGate(root, name, candidate) {
  const file = gateFile(root, name);
  if (!fs.existsSync(file)) return { ok:false, code:`${name.toUpperCase()}_RELEASE_GATE_MISSING`, file:path.relative(root,file) };
  let gate;
  try { gate = readJson(file); }
  catch (error) { return { ok:false, code:`${name.toUpperCase()}_RELEASE_GATE_INVALID`, message:error.message, file:path.relative(root,file) }; }
  const errors = [];
  if (gate.schemaVersion !== 'executionkit-release-gate/v1') errors.push('unsupported schema');
  if (gate.boundary !== 'release') errors.push('boundary is not release');
  if (gate.status !== 'PASS') errors.push(`status is ${gate.status ?? 'MISSING'}`);
  if (gate.candidateId !== candidate.candidateId) errors.push('candidateId differs');
  if (gate.commit !== candidate.commit) errors.push('commit differs');
  if (!Number.isFinite(Date.parse(gate.completedAt ?? ''))) errors.push('completedAt is invalid');
  return errors.length
    ? { ok:false, code:`${name.toUpperCase()}_RELEASE_GATE_STALE_OR_FAILED`, errors, gate, file:path.relative(root,file) }
    : { ok:true, gate, file:path.relative(root,file) };
}
function validateReleaseReadinessMarker(root, candidate, deployment) {
  const file = releaseReadinessFile(root);
  if (!fs.existsSync(file)) return { ok:false, code:'RELEASE_READINESS_MARKER_MISSING', file:path.relative(root,file) };
  let marker;
  try { marker = readJson(file); }
  catch (error) { return { ok:false, code:'RELEASE_READINESS_MARKER_INVALID', message:error.message, file:path.relative(root,file) }; }
  const errors = [];
  if (marker.schemaVersion !== 'executionkit-release-readiness/v1') errors.push('unsupported schema');
  if (marker.status !== 'PASS') errors.push(`status is ${marker.status ?? 'MISSING'}`);
  if (marker.candidateId !== candidate.candidateId) errors.push('candidateId differs');
  if (marker.commit !== candidate.commit) errors.push('commit differs');
  if (marker.releaseId !== deployment?.artifact?.releaseId) errors.push('releaseId differs from current production artifact');
  if (!Number.isFinite(Date.parse(marker.completedAt ?? ''))) errors.push('completedAt is invalid');
  return errors.length
    ? { ok:false, code:'RELEASE_READINESS_MARKER_STALE_OR_FAILED', errors, marker, file:path.relative(root,file) }
    : { ok:true, marker, file:path.relative(root,file) };
}

export function resolveReleaseLifecycle(root, { implementationClosed = true } = {}) {
  const { config, policyIssues = [] } = loadConfig(root);
  if (!implementationClosed) {
    return { schemaVersion:'executionkit-release-lifecycle/v1', required:false, complete:false, stage:'IMPLEMENTATION_IN_PROGRESS', blockers:[], nextCommand:null };
  }

  const launchLevel = config.capabilities?.launch ?? 'NONE';
  if (launchLevel === 'NONE') {
    return { schemaVersion:'executionkit-release-lifecycle/v1', required:false, complete:true, stage:'NOT_REQUIRED', blockers:[], nextCommand:null };
  }

  const blockers = [];
  const distributionRepository = config.distributionRepository === true;
  const deploymentEnabled = config.deployment?.enabled!==false&&!distributionRepository;
  if (policyIssues.length) blockers.push(...policyIssues.map((item)=>({ code:item.code, message:item.message })));
  if (config.projectState !== 'ACTIVE') blockers.push({ code:'PROJECT_NOT_ACTIVE', message:`projectState must be ACTIVE before release; got ${config.projectState ?? 'MISSING'}` });
  if (!distributionRepository && deploymentEnabled && config.deployment?.requiredForRelease !== true) blockers.push({ code:'DEPLOYMENT_NOT_REQUIRED_BY_POLICY', message:'deployable launch-capable product projects must set deployment.requiredForRelease=true' });
  if (!distributionRepository && !deploymentEnabled) blockers.push({ code:'NON_DEPLOYABLE_PRODUCT_MUST_BE_DISTRIBUTION_REPOSITORY', message:'deployment.enabled=false is valid for libraries/cores/templates only when distributionRepository=true' });
  if (config.evidence?.releaseTruthMode !== 'STRICT') blockers.push({ code:'STRICT_RELEASE_TRUTH_DISABLED' });
  if (!Array.isArray(config.evidence?.requiredProducers) || config.evidence.requiredProducers.length === 0) blockers.push({ code:'RELEASE_PRODUCERS_MISSING' });
  if (!String(config.evidence?.testReportPath ?? '').trim()) blockers.push({ code:'TEST_REPORT_PATH_MISSING' });

  if (blockers.length) {
    return { schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'RELEASE_POLICY_BLOCKED', blockers, nextCommand:'reconcile execution.config.json and projectState before release' };
  }

  let candidate;
  try {
    candidate = loadCandidate(root);
    const checked = validateCandidate(root, candidate);
    if (checked.errors.length) throw new Error(checked.errors.map((e)=>`[${e.code}] ${e.message}`).join('; '));
  } catch (error) {
    return {
      schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'CANDIDATE_REQUIRED',
      blockers:[{ code:'CURRENT_CANDIDATE_REQUIRED', message:error.message }], nextCommand:'executionkit launch build . --run-build'
    };
  }

  const test = validateGate(root, 'test', candidate);
  if (!test.ok) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'TEST_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit, blockers:[test], nextCommand:'executionkit test release .'
  };

  const audit = validateGate(root, 'audit', candidate);
  if (!audit.ok) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'AUDIT_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit, blockers:[audit], nextCommand:'executionkit audit release .'
  };

  if (distributionRepository) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'DISTRIBUTION_PUBLICATION_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit,
    blockers:[{code:'DISTRIBUTION_PUBLICATION_NOT_PROVEN',message:'Repository Audit/Test gates are current, but distribution publication/release has not been proven by an executable publication authority.'}],
    nextCommand:'perform the repository distribution release through its authorized publication workflow; do not claim product production deployment'
  };

  let readiness;
  try { readiness = validateProductionDeploymentReadiness(root); }
  catch (error) {
    return { schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'DEPLOYMENT_READINESS_REQUIRED', candidateId:candidate.candidateId, commit:candidate.commit, blockers:[{code:'DEPLOYMENT_READINESS_ERROR',message:error.message}], nextCommand:'executionkit launch build . --run-build' };
  }
  if (!readiness.ok) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'DEPLOYMENT_READINESS_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit, blockers:readiness.errors, nextCommand:'executionkit launch build . --run-build'
  };

  const deployment = productionDeploymentStatus(root);
  const marker = validateReleaseReadinessMarker(root, candidate, deployment);
  if (!marker.ok) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'RELEASE_READINESS_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit, releaseId:deployment?.artifact?.releaseId ?? null,
    blockers:[marker], nextCommand:'executionkit launch release .'
  };

  if (deployment.productionVerified !== true) return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:false, stage:'PRODUCTION_DEPLOYMENT_REQUIRED',
    candidateId:candidate.candidateId, commit:candidate.commit, releaseId:deployment?.artifact?.releaseId ?? null,
    blockers:[{code:'PRODUCTION_NOT_VERIFIED'}], nextCommand:'executionkit launch deploy . --authorize'
  };

  if(!deployment.operationalReadiness?.ok)return {schemaVersion:'executionkit-release-lifecycle/v1',required:true,complete:false,stage:deployment.operationalReadiness?.verdict??'EXTERNAL_PROVIDER_BLOCKED',candidateId:candidate.candidateId,commit:candidate.commit,deploymentVerdict:'DEPLOYED_VERIFIED',blockers:[{code:'EXTERNAL_PROVIDER_BLOCKED',details:deployment.operationalReadiness}],nextCommand:'executionkit launch providers .'};
  return {
    schemaVersion:'executionkit-release-lifecycle/v1', required:true, complete:true, stage:deployment.operationalReadiness.verdict,
    candidateId:candidate.candidateId, commit:candidate.commit, releaseId:deployment.artifact.releaseId,
    blockers:[], nextCommand:null, auditGate:audit.file, testGate:test.file, releaseReadiness:marker.file,
    deployedAt:deployment.state?.deployedAt ?? null
  };
}
