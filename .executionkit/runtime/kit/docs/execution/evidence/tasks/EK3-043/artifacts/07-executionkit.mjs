#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArgs } from '../lib/v4-cli-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawArgs = process.argv.slice(2);
const parsed = parseCliArgs(rawArgs);

function resolveTargetProject(args, parsedArgs) {
  if (parsedArgs.projectArg && parsedArgs.projectArg !== '.') {
    return path.resolve(parsedArgs.projectArg);
  }
  return process.cwd();
}

const targetRoot = resolveTargetProject(rawArgs, parsed);
const installedRuntimeCli = path.join(targetRoot, '.executionkit', 'runtime', 'kit', 'bin', 'executionkit-cli.mjs');
const sourceCli = path.join(here, 'executionkit-cli.mjs');

const pinnedNodeDir = path.join(targetRoot, '.executionkit', 'runtime', 'node', 'bin');
const pinnedNodeBin = path.join(pinnedNodeDir, process.platform === 'win32' ? 'node.exe' : 'node');
const hasPinnedNode = fs.existsSync(pinnedNodeBin);

if (fs.existsSync(installedRuntimeCli) && hasPinnedNode) {
  const result = spawnSync(pinnedNodeBin, [installedRuntimeCli, ...rawArgs], {
    cwd: targetRoot,
    stdio: 'inherit',
    windowsHide: true
  });
  process.exitCode = result.status ?? (result.error ? 1 : 0);
} else if (fs.existsSync(installedRuntimeCli) && installedRuntimeCli !== sourceCli) {
  // If target project has installed runtime, run that project's installed CLI
  const result = spawnSync(process.execPath, [installedRuntimeCli, ...rawArgs], {
    cwd: targetRoot,
    stdio: 'inherit',
    windowsHide: true
  });
  process.exitCode = result.status ?? (result.error ? 1 : 0);
} else {
  // Run canonical local CLI engine directly in-process
  await import('./executionkit-cli.mjs');
}
