#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? '.');
const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, 'run-tests.mjs');
const report = path.join(root, '.executionkit', 'reports', 'full-regression.tap');
fs.mkdirSync(path.dirname(report), { recursive: true });

const result = spawnSync(process.execPath, [runner], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  env: { ...process.env },
});
fs.writeFileSync(report, result.stdout ?? '');
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Regression evidence producer failed: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
