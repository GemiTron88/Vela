#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { loadAgentManifest, validateAgentLayer } from '../lib/agent-model.mjs';
import { resolveProjectPathSafe } from '../lib/derived-state.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const apply = process.argv.includes('--apply');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function safe(rel, label) {
  return resolveProjectPathSafe(root, rel, label);
}

let snapshots = null, todoFull = null, todoBytes = null;
const createdDirectories = new Set();
function rollback() {
  if (!snapshots) return;
  for (const [rel, snapshot] of snapshots) {
    const full = safe(rel, 'rollback path');
    try {
      if (snapshot.exists) {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, snapshot.bytes);
      } else fs.rmSync(full, { force: true });
    } catch {}
  }
  for (const dir of [...createdDirectories].reverse()) { try { fs.rmdirSync(dir); } catch {} }
  try { if (todoFull && todoBytes) fs.writeFileSync(todoFull, todoBytes); } catch {}
}

try {
  const { config } = loadConfig(root);
  const loaded = loadAgentManifest(root, config), manifest = structuredClone(loaded.manifest), manifestPath = loaded.manifestPath;
  todoFull = safe(config.todoPath, 'todoPath');
  todoBytes = fs.readFileSync(todoFull);
  const todoHash = hash(todoBytes);

  const slugs = new Map(), entries = [];
  for (const workflow of manifest.resources.workflows ?? []) {
    const slug = workflow.id.replace(/^workflow\./, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (!slug) throw new Error(`Workflow id cannot produce a safe skill slug: ${workflow.id}`);
    const prior = slugs.get(slug);
    if (prior && prior !== workflow.id) throw new Error(`Workflow slug collision: ${prior} and ${workflow.id} -> ${slug}`);
    slugs.set(slug, workflow.id);
    const id = `skill.workflow-${slug}`, rel = `.agents/skills/ek-workflow-${slug}/SKILL.md`;
    const content = `---\nname: ek-workflow-${slug}\ndescription: ${JSON.stringify(`Host-executable skill adapter for canonical workflow ${workflow.id}`)}\n---\n\nRead and follow the canonical workflow at \`${workflow.path}\`. Resolve the current task through ExecutionKit first. This skill is a host adapter; it does not own task state or create a second workflow backlog. Execute sequentially and return evidence/handoff to the canonical lifecycle.\n`;
    const existing = manifest.resources.skills.find((skill) => skill.id === id);
    if (existing && existing.path !== rel) throw new Error(`Workflow skill id collision: ${id}`);
    if (!existing) manifest.resources.skills.push({ id, path: rel, requires: ['skill.task-context'], native: true, adapterForWorkflow: workflow.id });
    entries.push({ rel, content });
  }

  const writes = entries.filter(({ rel, content }) => {
    const full = safe(rel, 'workflow skill path');
    return !fs.existsSync(full) || fs.readFileSync(full, 'utf8').replaceAll('\r\n','\n') !== content;
  });
  const manifestFull = safe(manifestPath, 'manifestPath');
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  if (fs.readFileSync(manifestFull, 'utf8').replaceAll('\r\n','\n') !== manifestText) writes.push({ rel: manifestPath, content: manifestText });

  if (!apply) {
    console.log(JSON.stringify({ apply: false, writes: writes.map((write) => write.rel), todoHash }, null, 2));
    process.exit(0);
  }

  snapshots = new Map(writes.map(({ rel }) => {
    const full = safe(rel, 'write path'), exists = fs.existsSync(full);
    return [rel, { exists, bytes: exists ? fs.readFileSync(full) : null }];
  }));
  for (const write of writes) {
    const full = safe(write.rel, 'write path');
    const missing = [];
    for (let dir = path.dirname(full); dir !== root && !fs.existsSync(dir); dir = path.dirname(dir)) missing.unshift(dir);
    for (const dir of missing) createdDirectories.add(dir);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, write.content);
  }

  if (hash(fs.readFileSync(todoFull)) !== todoHash) throw new Error('TODO changed during workflow-skill export');
  const validation = validateAgentLayer(root, config);
  if (validation.errors.length) throw new Error(validation.errors.map((error) => `[${error.code}] ${error.message}`).join('; '));
  snapshots = null;
  console.log(JSON.stringify({ apply: true, writes: writes.map((write) => write.rel), todoPreserved: true, agentLayerValid: true }, null, 2));
} catch (error) {
  rollback();
  console.error(`Workflow-to-skills export failed${snapshots ? ' and changes were rolled back' : ''}: ${error.message}`);
  process.exit(1);
}
