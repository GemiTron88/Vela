#!/usr/bin/env node
import path from 'node:path';
import { readStateSnapshot, rehydrateState, validateStateOS } from '../lib/state-model.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try {
  const validation = validateStateOS(root);
  console.log(JSON.stringify({ validation, snapshot: readStateSnapshot(root), rehydration: rehydrateState(root) }, null, 2));
  process.exit(validation.errors.length ? 1 : 0);
} catch (error) { console.error(`State OS status failed: ${error.message}`); process.exit(1); }
