#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { ensureDerivedStateDirectory } from '../lib/derived-state.mjs';
import { buildNativeMarkdownProjection } from '../lib/native-markdown-projector.mjs';

const args=process.argv.slice(2), root=path.resolve(args.find(arg=>!arg.startsWith('--')) ?? '.');
const write=args.includes('--write');
try {
  const {config}=loadConfig(root), projection=buildNativeMarkdownProjection(root,config);
  if (write) {
    ensureDerivedStateDirectory(root);
    const rel=config.taskModel?.projectionPath ?? '.executionkit/task-projection.json';
    const full=path.resolve(root,rel), delta=path.relative(root,full);
    if (!delta || delta.startsWith('..') || path.isAbsolute(delta) || !rel.startsWith('.executionkit/')) throw new Error('Native task projection must remain derived under .executionkit/');
    fs.mkdirSync(path.dirname(full),{recursive:true});
    fs.writeFileSync(full,`${JSON.stringify(projection,null,2)}\n`);
  }
  console.log(JSON.stringify({status:'PASS',taskCount:projection.tasks.length,projectionPath:config.taskModel?.projectionPath ?? '.executionkit/task-projection.json',write},null,2));
} catch (error) {
  console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
  process.exit(1);
}
