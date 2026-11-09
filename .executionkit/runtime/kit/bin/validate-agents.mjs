#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { validateAgentLayer } from '../lib/agent-model.mjs';

const projectRoot = path.resolve(process.argv[2] ?? '.');
let config;
try {
  ({ config } = loadConfig(projectRoot));
} catch (error) {
  console.error(`Agent integrity: FAIL\n\n[CONFIG_PARSE] ${error.message}`);
  process.exit(1);
}

const { errors, warnings, manifestPath } = validateAgentLayer(projectRoot, config);
if (errors.length === 0) {
  console.log('Agent integrity: PASS');
  console.log(`Manifest: ${manifestPath}`);
  if (warnings.length) for (const warning of warnings) console.log(`  WARN [${warning.code}] ${warning.message}`);
  process.exit(0);
}

console.error('Agent integrity: FAIL');
console.error(`Manifest: ${manifestPath}`);
for (const error of errors) console.error(`  ERROR [${error.code}] ${error.message}`);
for (const warning of warnings) console.error(`  WARN  [${warning.code}] ${warning.message}`);
process.exit(1);
