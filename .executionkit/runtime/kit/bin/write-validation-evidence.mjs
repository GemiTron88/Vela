#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
  return value;
}

try {
  const root = path.resolve(arg('root', path.join(here, '..')));
  const outputArg = arg('output');
  const declaredCommand = arg('command', 'npm run check');
  if (!outputArg) throw new Error('Usage: node bin/write-validation-evidence.mjs --output /path/to/evidence.json [--root /repo] [--command "npm run check"]');
  const commandScopes = new Map([
    ['npm run check', 'DISTRIBUTION_VALIDATION'],
    ['npm run check && npm run audit:full', 'DISTRIBUTION_AND_INDEPENDENT_AUDIT'],
    ['npm run v4:check && npm run repository:benchmark:scenarios && npm run audit:full', 'V4_DISTRIBUTION_BENCHMARK_AND_INDEPENDENT_AUDIT'],
  ]);
  if (!commandScopes.has(declaredCommand)) throw new Error(`Unsupported validation evidence command scope: ${declaredCommand}`);
  const validationScope = commandScopes.get(declaredCommand);
  const output = path.resolve(outputArg);

  function git(commandArgs) {
    const result = spawnSync('git', commandArgs, { cwd: root, encoding: 'utf8', timeout: 10000 });
    if (result.status !== 0) throw new Error(`git ${commandArgs.join(' ')} failed: ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
    return result.stdout.trim();
  }

  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  const status = git(['status', '--porcelain']);
  if (status) throw new Error('Refusing PASS evidence for a dirty working tree');
  const head = git(['rev-parse', 'HEAD']);
  const branch = process.env.GITHUB_REF_NAME || git(['branch', '--show-current']) || 'DETACHED';
  const upstreamResult = spawnSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: root, encoding: 'utf8' });
  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout.trim() : null;
  let ahead = null, behind = null;
  if (upstream) {
    ahead = Number(git(['rev-list', '--count', `${upstream}..HEAD`]));
    behind = Number(git(['rev-list', '--count', `HEAD..${upstream}`]));
    if (ahead !== 0 || behind !== 0) throw new Error(`Refusing PASS evidence for unsynchronized branch: ahead=${ahead}, behind=${behind}`);
  }
  const evidence = {
    schemaVersion: '1.0.0',
    kind: 'executionkit-distribution-validation',
    result: 'PASS',
    command: declaredCommand,
    validationScope,
    version,
    commit: head,
    branch,
    upstream,
    upstreamAhead: ahead,
    upstreamBehind: behind,
    remoteFreshness: 'NOT_ESTABLISHED_BY_WRITER',
    observedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      osRelease: os.release(),
      githubActions: process.env.GITHUB_ACTIONS === 'true',
      githubRunId: process.env.GITHUB_RUN_ID || null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      githubRepository: process.env.GITHUB_REPOSITORY || null,
      githubSha: process.env.GITHUB_SHA || null,
      runnerOs: process.env.RUNNER_OS || null,
      runnerName: process.env.RUNNER_NAME || null
    },
    limits: [
      `Written only after the caller has completed the declared command successfully: ${declaredCommand}`,
      'The writer records one bounded known command scope but does not execute or independently verify that command itself.',
      'Does not prove a fresh remote fetch unless the surrounding workflow establishes one.',
      'Does not prove product runtime, installed IDE/MCP activation, physical runner inventory or native device acceptance.'
    ]
  };
  if (evidence.environment.githubSha && evidence.environment.githubSha !== head) throw new Error(`GITHUB_SHA ${evidence.environment.githubSha} does not match tested HEAD ${head}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Validation evidence written: ${output}`);
  console.log(`PASS ${version} ${head} on ${process.platform}/${process.arch} ${process.version}`);
} catch (error) {
  console.error(`Validation evidence refused: ${error.message}`);
  process.exit(1);
}
