#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { validateQuality } from '../lib/quality-model.mjs';
const args = process.argv.slice(2), root = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
try {
  const { config } = loadConfig(root);
  const result = validateQuality(root, config, { release: args.includes('--release') });
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Product quality ${args.includes('--release') ? 'evidence' : 'contract'}: ${!result.enabled ? 'NOT_CONFIGURED' : result.errors.length ? 'FAIL' : 'PASS'}`);
    console.log('Validates declared coverage and evidence integrity; does not run product tests or certify visual/factual quality.');
    for (const error of result.errors) console.error(`[${error.code}] ${error.message}`);
  }
  process.exit(result.errors.length ? 1 : 0);
} catch (error) { console.error(`Product quality: FAIL ${error.message}`); process.exit(1); }
