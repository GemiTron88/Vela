#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
let errors = 0;
let warnings = 0;
const fail = (message) => { errors += 1; console.error(`ERROR CI_POLICY: ${message}`); };
const warn = (message) => { warnings += 1; console.warn(`WARN CI_POLICY: ${message}`); };
const pass = (message) => console.log(`PASS CI_POLICY: ${message}`);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

let config = null;
if (!exists('execution.config.json')) {
  fail('execution.config.json is missing');
} else {
  try {
    config = JSON.parse(read('execution.config.json'));
  } catch (error) {
    fail(`execution.config.json is invalid JSON: ${error.message}`);
  }
}

const ci = config?.ci;
if (!ci) {
  fail('execution.config.json must declare ci policy');
} else {
  if (ci.executionMode !== 'self-hosted-manual') fail(`ci.executionMode must be self-hosted-manual; found ${ci.executionMode}`);
  if (ci.githubHostedAllowed !== false) fail('ci.githubHostedAllowed must be false by default');
  if (ci.automaticPushRuns !== false) fail('ci.automaticPushRuns must be false');
  if (ci.maxProjectRunnersPerDevice !== 1) fail('ci.maxProjectRunnersPerDevice must equal 1');
  if (!/^project-[a-z0-9][a-z0-9._-]*$/i.test(ci.projectRunnerLabel ?? '')) fail('ci.projectRunnerLabel must be a stable project-* label');
  const allowed = new Set(ci.allowedRunnerOS ?? []);
  if (!allowed.has('macOS') || !allowed.has('windows')) warn('ci.allowedRunnerOS normally includes both canonical GitHub self-hosted labels macOS and windows; project-specific narrowing is allowed');
}

const workflowDir = path.join(root, '.github', 'workflows');
const workflowFiles = [];
if (fs.existsSync(workflowDir)) {
  for (const entry of fs.readdirSync(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    workflowFiles.push(path.join(workflowDir, entry.name));
  }
}

const hosted = /\b(?:ubuntu|windows|macos)-(?:latest|\d+\.\d+)\b/i;
const canonicalKitReleaseWorkflows = new Set([
  '.github/workflows/v4-release-candidate.yml',
  '.github/workflows/v5-source-release-candidate.yml'
]);
const canonicalKitSource = (() => {
  try { return JSON.parse(read('package.json')).name === 'ai-executionkit'; }
  catch { return false; }
})();
const automaticTriggers = /^(\s{0,2})(push|pull_request|pull_request_target|schedule|workflow_run)\s*:/gm;
const allowedAutomaticWorkflowPaths = new Set(ci?.allowedAutomaticWorkflowPaths ?? []);

for (const file of workflowFiles) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');

  const hostedReleaseException = canonicalKitSource && canonicalKitReleaseWorkflows.has(rel) && /runs-on:\s*ubuntu-24\.04/i.test(text);
  if (hosted.test(text) && !hostedReleaseException) fail(`${rel} references a GitHub-hosted runner outside the canonical Kit release exception`);

  const triggers = [...text.matchAll(automaticTriggers)].map((match) => match[2]);
  for (const trigger of triggers) {
    if (trigger === 'push') {
      fail(`${rel} autoruns on push; project CI must not use push autorun`);
      continue;
    }
    if (!allowedAutomaticWorkflowPaths.has(rel)) {
      fail(`${rel} uses automatic trigger ${trigger}; add the workflow path to ci.allowedAutomaticWorkflowPaths only after an explicit project-level decision`);
    }
  }

  if (!/^\s{0,2}workflow_dispatch\s*:/m.test(text)) fail(`${rel} must expose workflow_dispatch for explicit manual execution`);

  const runsOnBlocks = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)runs-on\s*:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    let block = match[2];
    for (let j = i + 1; j < lines.length; j += 1) {
      const current = lines[j];
      if (!current.trim()) { block += `\n${current}`; continue; }
      const currentIndent = current.match(/^\s*/)[0].length;
      if (currentIndent <= indent && !/^\s*-/.test(current)) break;
      block += `\n${current}`;
    }
    runsOnBlocks.push(block);
  }

  if (runsOnBlocks.length === 0) continue;
  for (const block of runsOnBlocks) {
    if (canonicalKitSource && canonicalKitReleaseWorkflows.has(rel) && /ubuntu-24\.04/i.test(block)) continue;
    if (!/\bself-hosted\b/i.test(block)) fail(`${rel} has a runs-on block without self-hosted`);
    if (ci?.projectRunnerLabel && !block.includes(ci.projectRunnerLabel)) fail(`${rel} has a runs-on block without project label ${ci.projectRunnerLabel}`);
  }
}

for (const rel of allowedAutomaticWorkflowPaths) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) warn(`ci.allowedAutomaticWorkflowPaths references missing workflow: ${rel}`);
}

if (workflowFiles.length === 0) warn('no GitHub Actions workflow files found; CI policy is documented but not orchestrated');
else pass(`checked ${workflowFiles.length} workflow file(s)`);

if (errors > 0) {
  console.error(`\nCI runner policy: FAIL (${errors} error(s), ${warnings} warning(s)).`);
  process.exit(1);
}
console.log(`\nCI runner policy: PASS (${warnings} warning(s)).`);
