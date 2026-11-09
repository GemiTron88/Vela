#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CAPABILITY_LEVELS, canonicalState, extractDependencies, extractReferenceTarget, findDependencyCycles,
  assembleCanonicalTodoMarkdown, isIgnoredRelative, isPendingEvidence, loadConfig, loadTasks, markdownHasAnchor, normalizePath,
  phaseConvergenceIssues, stateSatisfiesDependency, systemReleaseConvergenceIssues, walkFiles,
} from '../lib/execution-model.mjs';
import { validateAgentLayer } from '../lib/agent-model.mjs';
import { validateQuality } from '../lib/quality-model.mjs';
import { validateAntigravity } from '../lib/antigravity.mjs';
import { todoShardSources } from '../lib/todo-shards.mjs';
import { validateTaskProof } from '../lib/task-proof.mjs';

const projectRoot = path.resolve(process.argv[2] ?? '.');
const errors = [];
const warnings = [];
const issue = (bucket, code, message) => bucket.push({ code, message });

let config;
let configSource;
let configPolicyIssues = [];
try {
  ({ config, source: configSource, policyIssues: configPolicyIssues = [] } = loadConfig(projectRoot));
} catch (error) {
  console.error(`Execution integrity: FAIL\n\n[CONFIG_PARSE] ${error.message}`);
  process.exit(1);
}
if (!configSource) issue(errors, 'CONFIG_MISSING', 'A conforming project requires execution.config.json (or the supported equivalent) instead of implicit defaults.');
for (const finding of configPolicyIssues) issue(errors, finding.code, finding.message);

function resolveConfiguredPath(rel, label) {
  if (!rel || typeof rel !== 'string') {
    issue(errors, 'INVALID_TASK_SOURCE_PATH', `${label} must be a non-empty project-relative path`);
    return null;
  }
  const full = path.resolve(projectRoot, rel);
  const relative = path.relative(projectRoot, full);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    issue(errors, 'TASK_SOURCE_OUTSIDE_PROJECT', `${label} must resolve to a file inside the project: ${rel}`);
    return null;
  }
  return full;
}

let taskPathsSafe = true;
const todoPlan=todoShardSources(projectRoot,config);
for(const finding of todoPlan.errors){issue(errors,finding.code,finding.message);taskPathsSafe=false;}
const taskAuthorityPaths=todoPlan.mode==='sharded'
  ? [todoPlan.manifestPath,...todoPlan.active.map((x)=>x.path),...todoPlan.archives]
  : [config.todoPath,...(config.taskArchivePaths??[])];
const archivePaths=todoPlan.mode==='sharded'?todoPlan.archives:(Array.isArray(config.taskArchivePaths)?config.taskArchivePaths:[]);
if (!Array.isArray(config.taskArchivePaths)) {
  issue(errors, 'INVALID_TASK_ARCHIVE_PATHS', 'taskArchivePaths must be an array');
  taskPathsSafe = false;
}
const taskSourceFullPaths=new Set();
for(let index=0;index<taskAuthorityPaths.length;index+=1){
  const rel=taskAuthorityPaths[index],full=resolveConfiguredPath(rel,`taskAuthority[${index}]`);
  if(!full){taskPathsSafe=false;continue;}
  if(taskSourceFullPaths.has(full)){issue(errors,'TASK_SOURCE_PATH_COLLISION',`${rel} resolves to a duplicate canonical task source path`);taskPathsSafe=false;}
  taskSourceFullPaths.add(full);
}
const todoFullSafe=resolveConfiguredPath(config.todoPath,'todoPath');
if(!todoFullSafe)taskPathsSafe=false;

const allowedProfiles = new Set(['LITE', 'STANDARD', 'FULL', 'CUSTOM']);
if (!allowedProfiles.has(config.profile)) issue(errors, 'INVALID_PROFILE', `Unknown profile: ${config.profile}`);
if (!['BOOTSTRAP', 'ACTIVE'].includes(config.projectState)) issue(errors, 'INVALID_PROJECT_STATE', `projectState must be BOOTSTRAP or ACTIVE, got ${config.projectState ?? 'MISSING'}`);
if (config.projectState === 'BOOTSTRAP') issue(warnings, 'BOOTSTRAP_NOT_ACTIVE', 'Project is structurally initialized but not activated/conformant for release. Complete reconciliation and run bin/activate-project.mjs.');

const levelSet = new Set(CAPABILITY_LEVELS);
const capabilities = config.capabilities ?? {};
for (const name of ['execution', 'agent', 'content', 'seo', 'audit', 'test', 'launch']) {
  const level = capabilities[name];
  if (!levelSet.has(level)) issue(errors, 'INVALID_CAPABILITY_LEVEL', `${name} has invalid capability level: ${level ?? 'MISSING'}`);
}
for (const name of ['execution', 'agent', 'audit', 'test']) if (capabilities[name] === 'NONE') issue(errors, 'REQUIRED_CAPABILITY_DISABLED', `${name} cannot be NONE in the current standard`);
if (/^[345]\./.test(String(config.standardVersion ?? '')) && capabilities.seo !== 'NONE' && config.seo?.requiredForRelease !== true) {
  issue(errors, 'SEO_RELEASE_POLICY_BYPASS', 'Current 3.x projects with enabled SEO require seo.requiredForRelease=true');
}
if (config.profile === 'CUSTOM' && !String(config.customRationale ?? '').trim()) issue(errors, 'CUSTOM_WITHOUT_RATIONALE', 'CUSTOM profile requires customRationale');

const semanticNonTerminal = new Set(['PLANNED', 'READY', 'BLOCKED', 'IN_PROGRESS', 'IMPLEMENTED', 'REVIEW_REQUIRED', 'CORRECTION_REQUIRED']);
const semanticSets = {};
for (const key of ['acceptedStates', 'verifiedStates', 'terminalStates', 'archiveTerminalStates', 'dependencySatisfiedStates']) {
  const values = config[key] ?? [];
  if (!Array.isArray(values)) { issue(errors, 'INVALID_STATE_SET', `${key} must be an array`); semanticSets[key] = new Set(); continue; }
  const normalized = new Set(values.map((state) => canonicalState(state, config)).filter(Boolean));
  semanticSets[key] = normalized;
  for (const state of normalized) if (semanticNonTerminal.has(state)) issue(errors, 'NON_TERMINAL_STATE_IN_CLOSURE_SET', `${key} contains non-terminal semantic state ${state}`);
}
for (const required of ['ACCEPTED', 'RELEASED']) {
  if (!semanticSets.acceptedStates.has(required)) issue(errors, 'ACCEPTED_STATE_SET_INCOMPLETE', `acceptedStates must include semantic ${required}`);
  if (!semanticSets.terminalStates.has(required)) issue(errors, 'TERMINAL_STATE_SET_INCOMPLETE', `terminalStates must include semantic ${required}`);
  if (!semanticSets.archiveTerminalStates.has(required)) issue(errors, 'ARCHIVE_STATE_SET_INCOMPLETE', `archiveTerminalStates must include semantic ${required}`);
  if (!semanticSets.dependencySatisfiedStates.has(required)) issue(errors, 'DEPENDENCY_STATE_SET_INCOMPLETE', `dependencySatisfiedStates must include semantic ${required}`);
}
if (!semanticSets.terminalStates.has('CANCELLED')) issue(errors, 'TERMINAL_STATE_SET_INCOMPLETE', 'terminalStates must include CANCELLED');
if (!semanticSets.archiveTerminalStates.has('CANCELLED')) issue(errors, 'ARCHIVE_STATE_SET_INCOMPLETE', 'archiveTerminalStates must include CANCELLED');
for (const state of semanticSets.acceptedStates) if (!semanticSets.terminalStates.has(state)) issue(errors, 'ACCEPTED_STATE_NOT_TERMINAL', `${state} is accepted but not terminal`);
for (const state of semanticSets.archiveTerminalStates) if (!semanticSets.terminalStates.has(state)) issue(errors, 'ARCHIVE_STATE_NOT_TERMINAL', `${state} is archive-eligible but not terminal`);
if (!config.cancellationSatisfiesDependencies && semanticSets.dependencySatisfiedStates.has('CANCELLED')) issue(errors, 'CANCELLED_DEPENDENCY_CONTRADICTION', 'dependencySatisfiedStates includes CANCELLED while cancellationSatisfiesDependencies=false');

const rootAgents = path.join(projectRoot, 'AGENTS.md');
if (!fs.existsSync(rootAgents)) issue(errors, 'ROOT_AGENTS_MISSING', 'Root AGENTS.md is required to bind repository authority, TODO and Agent OS.');
else {
  const text = fs.readFileSync(rootAgents, 'utf8');
  if (!text.includes(config.todoPath) && !text.includes('TODO.md')) issue(errors, 'ROOT_AGENTS_TODO_UNBOUND', 'AGENTS.md does not reference the canonical TODO authority.');
  if (!/\.agents\b/.test(text)) issue(errors, 'ROOT_AGENTS_AGENT_OS_UNBOUND', 'AGENTS.md does not reference the .agents routing layer.');
}
const authorityFiles = {
  execution: 'docs/execution/EXECUTION_OS.md',
  agent: 'docs/agent/AGENT_OS.md',
  content: 'docs/content/CONTENT_OS.md',
  seo: 'docs/seo/SEO_OS.md',
  audit: 'docs/audit/AUDIT_OS.md',
  test: 'docs/testing/TEST_OS.md',
  launch: 'docs/launch/LAUNCH_OS.md',
};
for (const [capability, rel] of Object.entries(authorityFiles)) {
  if (capabilities[capability] !== 'NONE' && !fs.existsSync(path.join(projectRoot, rel))) issue(errors, 'CAPABILITY_AUTHORITY_MISSING', `${capability}=${capabilities[capability]} but authority file is missing: ${rel}`);
}

if (capabilities.agent !== 'NONE') {
  const agent = validateAgentLayer(projectRoot, config);
  errors.push(...agent.errors);
  warnings.push(...agent.warnings);
}

const taskLoad = taskPathsSafe ? loadTasks(projectRoot, config) : { tasks: [], errors: [] };
const { tasks, errors: parseErrors } = taskLoad;
errors.push(...parseErrors);
if (taskPathsSafe && tasks.length === 0 && !errors.some((e) => ['TODO_MISSING', 'PROJECTION_MISSING'].includes(e.code))) issue(errors, 'NO_TASKS', `No canonical tasks resolved from ${config.todoPath}`);

const byId = new Map();
const archiveTerminal = semanticSets.archiveTerminalStates;
const evidenceRequiredStates = semanticSets.verifiedStates;
for (const task of tasks) {
  if (byId.has(task.id)) issue(errors, 'DUPLICATE_TASK_ID', `${task.id} appears more than once (${byId.get(task.id).sourcePath}, ${task.sourcePath})`);
  else byId.set(task.id, task);

  const state = task.meta.Status;
  const semanticState = canonicalState(state, config);
  if (!state) issue(errors, 'MISSING_STATUS', `${task.id} has no Status`);
  else if (!config.validStates.includes(state)) issue(errors, 'INVALID_STATUS', `${task.id} has invalid Status: ${state}`);
  if (task.isArchive && state && !archiveTerminal.has(semanticState)) issue(errors, 'OPEN_TASK_IN_ARCHIVE', `${task.id} is ${state} inside ${task.sourcePath}; only configured semantic terminal states may be archived`);
  if (!task.meta.Phase) issue(warnings, 'MISSING_PHASE', `${task.id} has no Phase`);
  if (!task.meta.Priority) issue(warnings, 'MISSING_PRIORITY', `${task.id} has no Priority`);
  if (!task.objective) issue(warnings, 'MISSING_OBJECTIVE', `${task.id} has no one-line Objective`);
  if (config.requireVerificationField && !task.meta.Verification) issue(errors, 'MISSING_VERIFICATION', `${task.id} has no Verification field`);
  const legacyArchivedAcceptance = task.isArchive && String(task.meta['Legacy Acceptance'] ?? '').trim().toLowerCase() === 'true' && String(task.meta.Evidence ?? '').trim().toUpperCase() === 'LEGACY_STATUS_ONLY';
  if (config.requireEvidenceForVerified && evidenceRequiredStates.has(semanticState) && semanticState !== 'CANCELLED' && isPendingEvidence(task.meta.Evidence) && !legacyArchivedAcceptance) issue(errors, 'ACCEPTED_WITHOUT_EVIDENCE', `${task.id} is ${state} (${semanticState}) but Evidence is missing/pending`);
  for (const proofIssue of validateTaskProof(projectRoot, task, config)) issue(errors, proofIssue.code, proofIssue.message);

  if (config.requireBlockerForBlocked && semanticState === 'BLOCKED') {
    const blocker = task.meta.Blocker ?? task.meta['Blocked by'] ?? task.meta['Blocking condition'];
    if (!blocker || /^(NONE|N\/A|NA|TBD|PENDING|-)$/i.test(String(blocker).trim())) issue(errors, 'BLOCKED_WITHOUT_BLOCKER', `${task.id} is BLOCKED but has no concrete blocker/unblock condition`);
  }
  if (config.requireCancellationReason && semanticState === 'CANCELLED') {
    const reason = task.meta.Reason ?? task.meta.Rationale ?? task.meta['Cancellation reason'];
    if (!reason || /^(NONE|N\/A|NA|TBD|PENDING|-)$/i.test(String(reason).trim())) issue(errors, 'CANCELLED_WITHOUT_REASON', `${task.id} is CANCELLED but has no reason/rationale`);
  }
  if (config.requireExecutorForInProgress && semanticState === 'IN_PROGRESS') {
    if (!task.meta.Executor) issue(errors, 'IN_PROGRESS_WITHOUT_EXECUTOR', `${task.id} is IN_PROGRESS but has no Executor`);
    if (!task.meta['Working Branch'] && !task.meta.Branch) issue(errors, 'IN_PROGRESS_WITHOUT_BRANCH', `${task.id} is IN_PROGRESS but has no Working Branch`);
  }
  if (config.requireContractForReady && semanticState === 'READY' && !extractReferenceTarget(task.meta.Contract)) issue(errors, 'READY_WITHOUT_CONTRACT', `${task.id} is READY but has no usable Contract reference`);

  for (const key of config.referenceKeys ?? []) {
    const raw = task.meta[key];
    if (!raw) continue;
    const targets = String(raw).split(/[;,]/).map((item) => item.trim()).filter(Boolean);
    for (const target of targets) {
      const ref = extractReferenceTarget(target);
      if (!ref) continue;
      if (/[*?\[\]]/.test(ref.path)) { issue(warnings, 'NON_DETERMINISTIC_REFERENCE', `${task.id} ${key} uses a glob/non-deterministic path: ${ref.path}`); continue; }
      const full = path.resolve(projectRoot, ref.path);
      if (!full.startsWith(projectRoot + path.sep) && full !== projectRoot) issue(errors, 'REFERENCE_OUTSIDE_PROJECT', `${task.id} ${key} points outside project: ${ref.path}`);
      else if (!fs.existsSync(full)) issue(errors, 'BROKEN_REFERENCE', `${task.id} ${key} file does not exist: ${ref.path}`);
      else if (config.validateMarkdownAnchors && ref.anchor && /\.mdx?$/i.test(full)) {
        const markdown = fs.readFileSync(full, 'utf8');
        if (!markdownHasAnchor(markdown, ref.anchor)) issue(errors, 'BROKEN_REFERENCE_ANCHOR', `${task.id} ${key} anchor does not exist: ${ref.path}#${ref.anchor}`);
      }
    }
  }
}

for (const task of tasks) {
  for (const dep of extractDependencies(task)) {
    if (!byId.has(dep)) issue(errors, 'UNKNOWN_DEPENDENCY', `${task.id} depends on unknown task ${dep}`);
    if (dep === task.id) issue(errors, 'SELF_DEPENDENCY', `${task.id} depends on itself`);
  }
  if (canonicalState(task, config) === 'READY') {
    for (const dep of extractDependencies(task)) {
      const dependency = byId.get(dep);
      if (dependency && !stateSatisfiesDependency(dependency, config)) issue(errors, 'READY_WITH_OPEN_DEPENDENCY', `${task.id} is READY but ${dep} is ${dependency.meta.Status ?? 'UNKNOWN'}`);
    }
  }
}
for (const cycle of findDependencyCycles(tasks)) issue(errors, 'DEPENDENCY_CYCLE', `Dependency cycle: ${cycle.join(' -> ')}`);

const activeNonTerminalExists = tasks.some((task) => !task.isArchive && !semanticSets.terminalStates.has(canonicalState(task, config)));
for (const finding of [
  ...phaseConvergenceIssues(tasks, config, { terminalOnly: true }),
  ...systemReleaseConvergenceIssues(tasks, config, { terminalOnly: true }),
]) {
  issue(activeNonTerminalExists ? warnings : errors, finding.code, finding.message);
}

if (taskPathsSafe && config.forbidManualProgressPercentages) {
  const assembled=assembleCanonicalTodoMarkdown(projectRoot,config);
  if(assembled.errors.length)for(const finding of assembled.errors)issue(errors,finding.code,finding.message);
  else assembled.markdown.split('\n').forEach((line,i)=>{
    if (/\b(?:progress|complete|completion)\b[^\n%]{0,50}\b\d+(?:\.\d+)?\s*%/i.test(line)) issue(warnings,'MANUAL_PROGRESS_PERCENTAGE',`assembled canonical TODO:${i+1} appears to contain a manually maintained progress percentage`);
  });
}

if (config.scanCompetingBacklogs) {
  const roots = config.backlogScanRoots ?? ['docs', '.agents'];
  const ignored = [...(config.ignoreBacklogPaths ?? []), ...taskAuthorityPaths];
  const canonicalTaskPaths=new Set(taskAuthorityPaths.map((rel)=>normalizePath(rel)));
  for (const rootRel of roots) {
    const root = path.join(projectRoot, rootRel);
    for (const full of walkFiles(root, (p) => /\.md$/i.test(p))) {
      const rel = normalizePath(path.relative(projectRoot, full));
      if (canonicalTaskPaths.has(rel) || isIgnoredRelative(rel, ignored)) continue;
      fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*[-*+]\s+\[\s\]\s+/.test(line)) {
          const bucket = config.competingBacklogAsError ? errors : warnings;
          issue(bucket, 'POSSIBLE_COMPETING_BACKLOG', `${rel}:${i + 1} has an unchecked executable-looking task outside canonical TODO`);
        }
      });
    }
  }
}

if (taskPathsSafe && config.projectState === 'ACTIVE' && config.rejectPlaceholdersWhenActive) {
  const files = [...taskAuthorityPaths, 'AGENTS.md', 'docs/execution/EXECUTION_OS.md', 'docs/agent/AGENT_OS.md', ...(capabilities.seo !== 'NONE' ? ['docs/seo/SEO_OS.md'] : [])];
  const placeholder = /\[(?:STANDARD_VERSION|VERSION|PROFILE|PROJECT_RUNNER_LABEL|DATE \/ COMMIT|S0\|S1\|S2|TARGET|NAME|OUTCOME-ORIENTED TITLE|SECOND OUTCOME-ORIENTED TITLE|Concise required outcome\.|command\/reference|NONE \/ NAME|SEQUENTIAL\|CONTROLLED_PARALLEL)[^\]]*\]/g;
  for (const rel of files) {
    const full = path.resolve(projectRoot, rel);
    const relative = path.relative(projectRoot, full);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(full)) continue;
    const matches = [...fs.readFileSync(full, 'utf8').matchAll(placeholder)];
    if (matches.length) issue(errors, 'ACTIVE_PROJECT_HAS_BOOTSTRAP_PLACEHOLDERS', `${rel} still contains ${matches.length} known bootstrap placeholder(s)`);
  }
}

if (taskPathsSafe) {
  try {
    errors.push(...validateQuality(projectRoot, config).errors);
    const isV4 = /^[45]\./.test(String(config.standardVersion ?? '')) && (config?.adoption?.integrationGateTaskId?.includes('EK4') || config?.adoption?.integrationPhase === 'EK4');
    if (!isV4) errors.push(...validateAntigravity(projectRoot, config).errors);
  } catch (error) { issue(errors, 'QUALITY_OR_EDITOR_INVALID', error.message); }
}

const seen = new Set();
const dedupe = (items) => items.filter((item) => { const key = `${item.code}\0${item.message}`; if (seen.has(key)) return false; seen.add(key); return true; });
const finalErrors = dedupe(errors);
const finalWarnings = dedupe(warnings);
if (finalErrors.length === 0) {
  console.log(config.projectState === 'BOOTSTRAP' ? 'Execution structural integrity: PASS (BOOTSTRAP)' : 'Execution integrity: PASS');
  console.log(`Tasks inspected: ${tasks.length}`);
  if (finalWarnings.length) { console.log(`Warnings: ${finalWarnings.length}`); for (const warning of finalWarnings) console.log(`  WARN [${warning.code}] ${warning.message}`); }
  process.exit(0);
}
console.error('Execution integrity: FAIL');
console.error(`Tasks inspected: ${tasks.length}`);
console.error(`Errors: ${finalErrors.length}; warnings: ${finalWarnings.length}`);
for (const error of finalErrors) console.error(`  ERROR [${error.code}] ${error.message}`);
for (const warning of finalWarnings) console.error(`  WARN  [${warning.code}] ${warning.message}`);
process.exit(1);
