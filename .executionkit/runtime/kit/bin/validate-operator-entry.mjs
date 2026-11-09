#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..'));
const errors = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`required operator-contract file missing: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireMarkers(rel, markers) {
  const text = read(rel);
  for (const marker of markers) {
    if (!text.includes(marker)) errors.push(`${rel} missing operator-contract marker: ${marker}`);
  }
  return text;
}

function validateOperatorConfig(rel) {
  let config;
  try { config = JSON.parse(read(rel)); }
  catch (error) { errors.push(`${rel} invalid JSON: ${error.message}`); return; }
  const operator = config.operator;
  const expected = {
    entrypoint: 'todo-first',
    additionalBootstrapPromptRequired: false,
    hostChecklistMode: 'derived-mirror',
    syncHostChecklistAfterTask: true,
    fullCiCadence: 'phase-boundary',
    targetedTaskVerification: true,
    hostPersistenceAuthority: 'none',
  };
  if (!operator || typeof operator !== 'object') {
    errors.push(`${rel} missing machine-readable operator policy`);
    return;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (operator[key] !== value) errors.push(`${rel} operator.${key} must equal ${JSON.stringify(value)}`);
  }
}

requireMarkers('STANDARD_V3.md', [
  'TODO_FIRST_ENTRY_INVARIANT',
  'HOST_CHECKLIST_DERIVED_MIRROR',
  'PHASE_BOUNDARY_FULL_CI',
  'The owner MUST NOT be required to remember or separately prompt bootstrap commands',
  'canonical TODO remain responsible for what happens next',
]);

requireMarkers('PLAYBOOK.md', [
  'TODO-first owner entrypoint',
  'TODO_FIRST_ENTRY_INVARIANT',
  'HOST_CHECKLIST_DERIVED_MIRROR',
  'PHASE_BOUNDARY_FULL_CI',
  'Antigravity `/goal`',
]);

const todoTemplate = requireMarkers('templates/TODO.md', [
  'TODO — Canonical Execution Entry Point',
  'Task-by-task continuation is mandatory',
  'Deep integration is mandatory before product execution',
]);
if (/shadow backlog/i.test(todoTemplate) === false) errors.push('templates/TODO.md must explicitly reject shadow backlog semantics');

requireMarkers('templates/AGENTS.md', [
  'Owner entrypoint contract',
  'TODO_FIRST_ENTRY_INVARIANT',
  'HOST_CHECKLIST_DERIVED_MIRROR',
  'PHASE_BOUNDARY_FULL_CI',
  'Antigravity `/goal`',
]);

requireMarkers('templates/TEST_OS.md', [
  'PHASE_BOUNDARY_FULL_CI',
  'complete expensive self-hosted CI suite is not a per-task/per-commit action',
  'Task-level work still runs the smallest sufficient targeted',
]);

for (const rel of ['templates/.agents/skills/implementation/SKILL.md', '.agents/skills/implementation/SKILL.md']) {
  requireMarkers(rel, [
    'TODO_FIRST_ENTRY_INVARIANT',
    'HOST_CHECKLIST_DERIVED_MIRROR',
    'PHASE_BOUNDARY_FULL_CI',
    'Antigravity `/goal`',
  ]);
}

const antigravityRule = requireMarkers('plugins/antigravity-executionkit/rules/executionkit.md', [
  'TODO_FIRST_ENTRY_INVARIANT',
  'HOST_CHECKLIST_DERIVED_MIRROR',
  'PHASE_BOUNDARY_FULL_CI',
  'Antigravity `/goal`',
  'do not invent a `brain/task.md` repository path',
]);
if (!antigravityRule.includes('all **eight systems**')) errors.push('Antigravity TODO-first rule must explicitly load all **eight systems**');

requireMarkers('schemas/execution-config.schema.json', [
  '"operator"',
  '"todo-first"',
  '"derived-mirror"',
  '"phase-boundary"',
]);
for (const rel of [
  'execution.config.json',
  'templates/execution.config.json',
  'examples/small/execution.config.json',
  'examples/medium/execution.config.json',
  'examples/large/execution.config.json',
]) validateOperatorConfig(rel);

requireMarkers('bin/migrate-v3.mjs', [
  "entrypoint:'todo-first'",
  "hostChecklistMode:'derived-mirror'",
  "fullCiCadence:'phase-boundary'",
  "hostPersistenceAuthority:'none'",
]);
requireMarkers('bin/validate-v30-project.mjs', [
  'V30_OPERATOR_ENTRYPOINT_INVALID',
  'V30_HOST_CHECKLIST_AUTHORITY_INVALID',
  'V30_FULL_CI_CADENCE_INVALID',
  'V30_HOST_PERSISTENCE_AUTHORITY_INVALID',
]);

const pkg = JSON.parse(read('package.json') || '{}');
if (!pkg.scripts?.['validate:operator-entry']) errors.push('package.json missing validate:operator-entry script');
if (!String(pkg.scripts?.check || '').includes('validate:operator-entry')) errors.push('canonical npm run check must include validate:operator-entry');

console.log(JSON.stringify({
  schemaVersion: 'executionkit-operator-entry/v1',
  status: errors.length ? 'FAIL' : 'PASS',
  invariants: ['TODO_FIRST_ENTRY_INVARIANT', 'HOST_CHECKLIST_DERIVED_MIRROR', 'PHASE_BOUNDARY_FULL_CI'],
  errors,
}, null, 2));
process.exit(errors.length ? 1 : 0);
