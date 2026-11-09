#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { canonicalState, loadConfig, loadTasks } from '../lib/execution-model.mjs';
import { discoverProduct, loadDeclaredScope, matchesScopeReference, resolveDerivedDiscoveryPath } from '../lib/discovery-model.mjs';

const root = path.resolve(process.argv[2] ?? '.');
function taskText(task) {
  return [task.title, task.objective, task.body, ...Object.values(task.meta ?? {})].filter(Boolean).join('\n');
}
try {
  const { config } = loadConfig(root);
  const loaded = loadTasks(root, config);
  if (loaded.errors.length) throw new Error(loaded.errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
  const inventory = discoverProduct(root);
  const scope = loadDeclaredScope(root, config.discovery?.scopePath ?? 'executionkit.scope.json');
  const nodes = [], edges = [];
  for (const task of loaded.tasks) nodes.push({ id: `task:${task.id}`, type: 'task', data: { id: task.id, state: canonicalState(task, config), sourcePath: task.sourcePath } });
  for (const item of inventory.items) nodes.push({ id: `surface:${item.id}`, type: 'surface', data: item });
  scope.required.forEach((required, index) => nodes.push({ id: `required:${index}`, type: 'requirement', data: required }));

  for (const task of loaded.tasks) {
    const haystack = taskText(task);
    for (const item of inventory.items) {
      if (haystack.includes(item.path) || (item.name && haystack.includes(item.name))) edges.push({ from: `task:${task.id}`, to: `surface:${item.id}`, relation: 'maps' });
    }
  }
  scope.required.forEach((required, index) => {
    for (const item of inventory.items) if (matchesScopeReference(required, item)) edges.push({ from: `required:${index}`, to: `surface:${item.id}`, relation: 'implemented-by' });
  });

  const graph = { schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), nodes, edges };
  const output = resolveDerivedDiscoveryPath(root, '.executionkit/discovery/coverage-graph.json', 'coverage graph');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(graph, null, 2)}\n`);
  console.log(JSON.stringify({ ...graph, output: path.relative(root, output).split(path.sep).join('/') }, null, 2));
} catch (error) {
  console.error(`Coverage graph failed: ${error.message}`);
  process.exit(1);
}
