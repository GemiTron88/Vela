#!/usr/bin/env node
import path from 'node:path';
import { collectEvidence } from '../lib/evidence-model.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
const args = process.argv.slice(2), root = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const i = args.indexOf('--producer'); const selected = i >= 0 ? [args[i + 1]] : null;
try {
  await emitSystemEvent(root, 'evidence.collection_started', { selectedProducers: selected ?? [] }, { source: 'test-os' });
  const result = collectEvidence(root, { selected });
  const failed = result.reports.filter((r) => r.result === 'FAIL');
  await emitSystemEvent(root, failed.length ? 'evidence.collection_failed' : 'evidence.collection_completed', {
    reportCount: result.reports.length,
    failedCount: failed.length,
    producers: result.reports.map((report) => ({ id: report.id ?? report.producer ?? null, result: report.result ?? null })),
  }, { source: 'test-os' });
  console.log(JSON.stringify(result, null, 2)); process.exit(failed.length ? 1 : 0);
}
catch (error) {
  await emitSystemEvent(root, 'evidence.collection_failed', { message: error.message }, { source: 'test-os' });
  console.error(`Evidence collection failed: ${error.message}`); process.exit(1);
}
