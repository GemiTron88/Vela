#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { loadCandidate, validateCandidate } from '../lib/evidence-model.mjs';
import { evaluateSeoApplicability, inferSeoApplicabilityFromRepository, loadSeoContract, seoContractSummary } from '../lib/seo-model.mjs';
import { resolveDerivedPath } from '../lib/derived-state.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const release = process.argv.includes('--release');

function writeEvidence(payload) {
  if (process.argv.includes('--no-write')) return null;
  const dir = resolveDerivedPath(root, '.executionkit/evidence/raw', 'SEO evidence directory', { createParents: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, release ? 'seo-release.json' : 'seo-contract.json');
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return path.relative(root, file).replaceAll('\\', '/');
}

try {
  const { config } = loadConfig(root);
  const capability = config.capabilities?.seo ?? 'NONE';
  const inferred=inferSeoApplicabilityFromRepository(root);
  const requiredByCapability = capability !== 'NONE' && inferred.applicable;
  const loaded = loadSeoContract(root, config, { required: requiredByCapability });

  if (loaded.status === 'NOT_CONFIGURED' && !requiredByCapability) {
    const result = { schemaVersion: 'executionkit-seo-validation/v1', status: 'NOT_APPLICABLE', capability, inferredApplicability:inferred, message: inferred.rationale, observedAt: new Date().toISOString() };
    result.evidencePath = writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const errors = [...loaded.errors];
  const applicability = evaluateSeoApplicability(loaded.contract);
  const contractProfile = loaded.contract?.profile ?? null;
  let candidate = null;
  if(inferred.applicable&&loaded.contract){
    if(loaded.contract.applicability==='AUTO'&&!applicability.applicable)errors.push({code:'SEO_PUBLIC_WEB_APPLICABILITY_UNRESOLVED',message:'Public-web-capable repository detected but AUTO SEO contract declares no search surface/base URL; explicitly ENABLE surfaces or DISABLE SEO with a concrete rationale'});
    if(loaded.contract.applicability==='ENABLED'&&!(loaded.contract.surfaceFamilies?.length||loaded.contract.publicWeb?.baseUrls?.length))errors.push({code:'SEO_ENABLED_SURFACES_MISSING',message:'ENABLED SEO requires at least one declared surface family or public base URL'});
  }

  if (capability === 'NONE' && contractProfile && contractProfile !== 'NONE') {
    errors.push({ code: 'SEO_CAPABILITY_PROFILE_MISMATCH', message: `capabilities.seo is NONE but the SEO contract profile is ${contractProfile}` });
  }
  if (capability !== 'NONE' && contractProfile && contractProfile !== capability) {
    errors.push({ code: 'SEO_CAPABILITY_PROFILE_MISMATCH', message: `capabilities.seo=${capability} but the SEO contract profile is ${contractProfile}; capability depth and the managed SEO contract must be reconciled explicitly` });
  }
  if (capability === 'NONE' && applicability.applicable) errors.push({ code: 'SEO_CAPABILITY_DISABLED_BUT_APPLICABLE', message: 'SEO contract declares applicable search surfaces while capabilities.seo is NONE' });
  if (capability !== 'NONE' && loaded.contract?.profile === 'NONE' && loaded.contract?.applicability === 'ENABLED') errors.push({ code: 'SEO_PROFILE_ENABLED_MISMATCH', message: 'ENABLED applicability cannot use profile NONE' });

  if (release && applicability.applicable) {
    const releaseGate = loaded.contract?.gates?.release;
    if (releaseGate?.required !== true) errors.push({ code: 'SEO_RELEASE_GATE_REQUIRED', message: 'Applicable SEO contract must require the release gate for --release validation' });
    if (loaded.contract?.evidence?.requireCandidateBindingForRelease !== true) errors.push({ code: 'SEO_CANDIDATE_BINDING_REQUIRED', message: 'Applicable release SEO requires candidate-bound evidence' });
    if (loaded.contract?.evidence?.requireContractHash !== true) errors.push({ code: 'SEO_CONTRACT_HASH_REQUIRED', message: 'Applicable release SEO requires SEO contract hash binding' });
    const applicableFamilies = loaded.contract?.surfaceFamilies?.filter((family) => family.indexPolicy !== 'NOINDEX') ?? [];
    for (const family of applicableFamilies) if (!family.verificationSamples?.length) errors.push({ code: 'SEO_RELEASE_SAMPLE_MISSING', message: `${family.id} has no representative verification sample` });
    try {
      candidate = loadCandidate(root);
      const checked = validateCandidate(root, candidate);
      for (const failure of checked.errors) errors.push({ code: `SEO_${failure.code}`, message: `SEO release candidate is not current: ${failure.message}` });
      if ((candidate.hashes?.[loaded.path] ?? null) !== (loaded.contractHash ?? null)) errors.push({ code: 'SEO_CONTRACT_NOT_CANDIDATE_BOUND', message: `Candidate does not bind the current SEO contract hash for ${loaded.path}` });
    } catch (error) {
      errors.push({ code: 'SEO_CANDIDATE_REQUIRED', message: `Applicable SEO release requires a current candidate envelope: ${error.message}` });
    }
  }

  const status = errors.length ? 'FAIL' : (applicability.applicable ? 'PASS' : 'NOT_APPLICABLE');
  const result = {
    schemaVersion: 'executionkit-seo-validation/v1',
    status,
    capability,
    release,
    contractPath: loaded.path,
    contractHash: loaded.contractHash ?? null,
    candidateId: candidate?.candidateId ?? null,
    candidateCommit: candidate?.commit ?? null,
    candidateEnvironment: candidate?.environment ?? null,
    inferredApplicability:inferred,
    summary: seoContractSummary(loaded.contract),
    errors,
    limitations: [
      'Contract/release validation does not itself crawl or render production pages.',
      'PASS proves configured SEO architecture and candidate binding only unless runtime evidence is separately collected.',
      'Rankings, indexing, rich results and traffic are never guaranteed.'
    ],
    observedAt: new Date().toISOString(),
  };
  result.evidencePath = writeEvidence(result);
  console.log(JSON.stringify(result, null, 2));
  process.exit(status === 'FAIL' ? 1 : 0);
} catch (error) {
  console.error(`SEO OS validation failed: ${error.message}`);
  process.exit(1);
}
