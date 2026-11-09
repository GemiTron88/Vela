#!/usr/bin/env node
import path from 'node:path';
import { countByState, loadConfig, loadTasks, resolveReadyTasks } from '../lib/execution-model.mjs';

const projectRoot = path.resolve(process.argv[2] ?? '.');
const { config } = loadConfig(projectRoot);
const { tasks, errors } = loadTasks(projectRoot, config);

if (errors.length) {
  console.error('Cannot produce reliable execution report:');
  for (const error of errors) console.error(`- [${error.code}] ${error.message}`);
  process.exit(1);
}

const counts = countByState(tasks);
const ordered = config.validStates;
const verified = tasks.filter((t) => config.verifiedStates.includes(t.meta.Status)).length;
const released = tasks.filter((t) => t.meta.Status === 'RELEASED').length;
const readyNow = resolveReadyTasks(tasks, config);

console.log(`AI ExecutionKit report — ${path.basename(projectRoot)}`);
console.log(`Profile: ${config.profile}`);
console.log(`Standard: ${config.standardVersion}`);
console.log(`Total canonical tasks: ${tasks.length}`);
console.log(`Verified-or-released: ${verified} / ${tasks.length}`);
console.log(`Released: ${released} / ${tasks.length}`);
console.log('');
for (const state of ordered) {
  console.log(`${state.padEnd(13)} ${counts[state] ?? 0}`);
}
console.log('');
console.log(`Executable READY now: ${readyNow.length}`);
for (const task of readyNow.slice(0, 20)) {
  console.log(`- ${task.id}${task.title ? ` — ${task.title}` : ''}`);
}
if (readyNow.length > 20) console.log(`- ...and ${readyNow.length - 20} more`);
