#!/usr/bin/env node
import path from 'node:path';
import { validateStateOS } from '../lib/state-model.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try {
  const result = validateStateOS(root);
  if (result.errors.length) {
    console.error('State OS integrity: FAIL');
    for (const error of result.errors) console.error(`  ERROR [${error.code}] ${error.message}`);
    process.exit(1);
  }
  console.log(`State OS integrity: ${result.status}`);
} catch (error) { console.error(`State OS validation failed: ${error.message}`); process.exit(1); }
