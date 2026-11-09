#!/usr/bin/env node
import path from 'node:path';
import { auditUiConformance, validateComponentSystem } from '../lib/component-model.mjs';

const args = process.argv.slice(2);
const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');
function value(name, fallback = null) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

try {
  const component = validateComponentSystem(root);
  if (!args.includes('--audit')) {
    console.log(JSON.stringify(component, null, 2));
    process.exit(component.status === 'FAIL' ? 1 : 0);
  }

  const boundary = value('boundary', 'ad-hoc');
  const audit = auditUiConformance(root, { boundary });
  const status = component.status === 'FAIL' || audit.mechanicalStatus === 'FAIL'
    ? 'FAIL'
    : component.status === 'REVIEW_REQUIRED' || audit.mechanicalStatus === 'REVIEW_REQUIRED'
      ? 'REVIEW_REQUIRED'
      : 'PASS';
  console.log(JSON.stringify({ schemaVersion: '1.0.0', boundary, status, component, audit }, null, 2));
  process.exit(status === 'FAIL' ? 1 : 0);
} catch (error) {
  console.error(`Component/audit validation failed: ${error.message}`);
  process.exit(1);
}
