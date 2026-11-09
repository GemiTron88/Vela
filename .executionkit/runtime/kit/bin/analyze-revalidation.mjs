#!/usr/bin/env node
import path from 'node:path';
import { analyzeRevalidation } from '../lib/revalidation-model.mjs';

const root = path.resolve(process.argv[2] ?? '.');
try {
  const report = analyzeRevalidation(root);
  console.log(JSON.stringify(report,null,2));
  if (process.argv.includes('--require-clear') && report.revalidationRequired) process.exit(1);
} catch (error) {
  console.error(`Revalidation analysis failed: ${error.message}`);
  process.exit(1);
}
