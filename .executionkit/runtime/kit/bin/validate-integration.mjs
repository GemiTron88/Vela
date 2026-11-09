#!/usr/bin/env node
import path from 'node:path';
import { loadConfig, loadTasks } from '../lib/execution-model.mjs';
import { validateIntegrationContract } from '../lib/integration-model.mjs';

const args = process.argv.slice(2);
const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');
const release = args.includes('--release');

try {
  const { config } = loadConfig(root);
  const loaded = loadTasks(root, config);
  if (loaded.errors.length) throw new Error(loaded.errors.map((error) => `[${error.code}] ${error.message}`).join('; '));
  const result = validateIntegrationContract(root, config, loaded.tasks, { release });
  if (result.errors.length) {
    console.error(`Integration reality gate: FAIL${release ? ' (release)' : ''}`);
    for (const error of result.errors) console.error(`  ERROR [${error.code}] ${error.message}`);
    for (const note of result.notes) console.error(`  · ${note}`);
    process.exit(1);
  }
  console.log(`Integration reality gate: PASS${release ? ' (release)' : ''}`);
  for (const note of result.notes) console.log(`  · ${note}`);
} catch (error) {
  console.error(`Integration reality gate: FAIL\n  ERROR ${error.message}`);
  process.exit(1);
}
