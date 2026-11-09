#!/usr/bin/env node
import path from 'node:path';
import { parseTestReport, validateAdequacy } from '../lib/test-evidence.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('Usage: validate-test-evidence.mjs <report> [--format tap|junit|playwright-json|flutter-machine] [--minimum N] [--allow-skipped] [--allow-flaky]'); process.exit(1); }
const val = (n) => { const i=args.indexOf(`--${n}`); return i>=0?args[i+1]:null; };
const root = path.resolve('.');
try {
  await emitSystemEvent(root, 'test.evidence_started', { format: val('format') ?? null, minimumTests: Number(val('minimum') ?? 0) }, { source: 'test-os' });
  const summary = parseTestReport(path.resolve(file), val('format'));
  const errors = validateAdequacy(summary, { minimumTests: Number(val('minimum') ?? 0), allowSkipped: args.includes('--allow-skipped'), allowFlaky: args.includes('--allow-flaky') });
  await emitSystemEvent(root, errors.length ? 'test.evidence_failed' : 'test.evidence_completed', {
    format: summary.format ?? val('format') ?? null,
    total: summary.total ?? summary.tests ?? null,
    passed: summary.passed ?? null,
    failed: summary.failed ?? null,
    skipped: summary.skipped ?? null,
    flaky: summary.flaky ?? null,
    errorCount: errors.length,
  }, { source: 'test-os' });
  console.log(JSON.stringify({ summary, errors }, null, 2)); process.exit(errors.length ? 1 : 0);
}
catch (error) {
  await emitSystemEvent(root, 'test.evidence_failed', { message: error.message }, { source: 'test-os' });
  console.error(`Test evidence validation failed: ${error.message}`); process.exit(1);
}
