#!/usr/bin/env node
import path from 'node:path';
import { buildCandidate, writeCandidate } from '../lib/evidence-model.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try {
  await emitSystemEvent(root, 'launch.started', { operation: 'build-candidate' }, { source: 'launch-os' });
  const candidate = buildCandidate(root, { allowDirty: process.argv.includes('--allow-dirty') });
  writeCandidate(root, candidate);
  await emitSystemEvent(root, 'candidate.built', {
    candidateId: candidate.candidateId ?? candidate.id ?? null,
    head: candidate.repository?.head ?? candidate.head ?? null,
    branch: candidate.repository?.branch ?? candidate.branch ?? null,
    environment: candidate.environment ?? null,
  }, { source: 'launch-os' });
  await emitSystemEvent(root, 'launch.completed', { operation: 'build-candidate', status: 'CANDIDATE_BUILT' }, { source: 'launch-os' });
  console.log(JSON.stringify(candidate, null, 2));
}
catch (error) {
  await emitSystemEvent(root, 'launch.failed', { operation: 'build-candidate', message: error.message }, { source: 'launch-os' });
  console.error(`Candidate build failed: ${error.message}`); process.exit(1);
}
