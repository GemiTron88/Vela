import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnBoundedSync } from './bounded-process.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from './derived-state.mjs';
import { captureV4WorktreeIdentity } from './v4-gate-identity.mjs';
import { prepareVisualJourneyRun, finishVisualJourneyRun, verifyJourneyVisualCheckpoints } from './visual-journeys.mjs';

export const JOURNEY_CLASSES = Object.freeze(['critical-happy-path', 'cross-feature-workflow', 'adversarial-recovery']);
export const E2E_VERSIONS = Object.freeze({ e2e: '0.18.0', web: '0.13.0', mobile: '0.10.0' });
export const JOURNEY_MANIFEST = 'executionkit.journeys.json';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const problem = (code, message) => ({ code, message });
const nonempty = (x) => typeof x === 'string' && x.trim().length > 0;
const safe = (root, rel, options = {}) => resolveProjectPathSafe(root, rel, 'Agentic E2E path', options);

// This scan runs only at Test OS boundaries, never on the task hot path.
export function agenticApplicable(root) {
  try {
    const cfg = json(path.join(root, 'execution.config.json'));
    if (cfg?.v4?.systems?.test?.agentic?.applicable === false || cfg?.test?.agentic?.applicable === false) return false;
  } catch {}
  const packageAt = (dir) => { try { return json(path.join(dir, 'package.json')); } catch { return {}; } };
  const roots = [root];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.') && !['tests', 'examples', 'node_modules', 'vendor', 'docs', 'templates'].includes(entry.name)) roots.push(path.join(root, entry.name));
  }
  for (const parent of roots.slice(1)) if (['apps','packages','clients'].includes(path.basename(parent))) {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) if (entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.') && !['node_modules','vendor','tests','examples'].includes(entry.name)) roots.push(path.join(parent,entry.name));
  }
  return roots.some((dir) => {
    const p = packageAt(dir), deps = { ...p.dependencies, ...p.devDependencies };
    const pubspec=path.join(dir,'pubspec.yaml');
    return fs.existsSync(path.join(dir,'index.html')) || (fs.existsSync(pubspec)&&/^\s*sdk:\s*flutter\s*(?:#.*)?$/m.test(fs.readFileSync(pubspec,'utf8'))) ||
      (fs.existsSync(path.join(dir, 'artisan')) && fs.existsSync(path.join(dir, 'resources/views'))) ||
      (['react', 'vue', 'next', 'svelte', '@angular/core', 'vite'].some((name) => deps[name]) && ['src', 'app', 'pages', 'index.html'].some((name) => fs.existsSync(path.join(dir, name))));
  });
}

export function validateJourneyManifest(root, m) {
  const errors = [], add = (code, message) => errors.push(problem(code, message));
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.schemaVersion !== 'executionkit-agentic/v1') return [problem('AGENTIC_MANIFEST_SCHEMA', 'Expected executionkit-agentic/v1 object')];
  for (const key of Object.keys(m)) if (!['schemaVersion', 'app', 'suiteDir', 'config', 'targets', 'journeys', 'budgets', 'environmentProbe'].includes(key)) add('AGENTIC_MANIFEST_FIELD', key);
  if (!nonempty(m.app?.identity) || !nonempty(m.app?.revision) || !['test', 'staging', 'production'].includes(m.app?.environment)) add('AGENTIC_APP_IDENTITY', 'Declare app identity, immutable runtime revision, and environment');
  try {
    safe(root, m.suiteDir, { mustExist: true });
    const config = safe(root, m.config, { mustExist: true, file: true });
    if (path.dirname(config) !== safe(root, m.suiteDir)) add('AGENTIC_CONFIG_ROOT', 'Upstream treats the config directory as project root; config must be inside suiteDir');
  } catch (e) { add('AGENTIC_PATH', e.message); }
  const b = m.budgets;
  for (const [key, min, max] of [['timeoutMs', 1000, 1800000], ['maxModelCalls', 1, 300], ['maxModelTokens', 1, 1000000], ['maxJourneys', 3, 30]]) {
    if (!Number.isSafeInteger(b?.[key]) || b[key] < min || b[key] > max) add('AGENTIC_BUDGET', `${key} must be an integer between ${min} and ${max}`);
  }
  if (!nonempty(m.environmentProbe?.command) || !Array.isArray(m.environmentProbe?.args) || m.environmentProbe.args.some((x) => typeof x !== 'string')) add('AGENTIC_ENVIRONMENT_PROBE', 'A shell-free live revision/target probe is mandatory');
  const targets = Array.isArray(m.targets) ? m.targets : [], names = new Set();
  if (!targets.length) add('AGENTIC_TARGETS', 'At least one real target is required');
  for (const t of targets) {
    if (!nonempty(t.name) || names.has(t.name) || !['web', 'android', 'ios'].includes(t.platform) || !nonempty(t.role) || !nonempty(t.locale)) add('AGENTIC_TARGET', 'Targets need unique name, platform, role and locale');
    names.add(t.name);
  }
  const journeys = Array.isArray(m.journeys) ? m.journeys : [], ids = new Set(), pairs = new Set(), coverageSignatures = new Set();
  if (journeys.length > (b?.maxJourneys ?? 0)) add('AGENTIC_JOURNEY_BUDGET', 'Journey count exceeds the reviewed risk budget');
  for (const j of journeys) {
    if (!/^[A-Z0-9][A-Z0-9._-]+$/.test(j.id ?? '') || ids.has(j.id)) add('AGENTIC_JOURNEY_ID', 'Use unique stable journey IDs');
    ids.add(j.id);
    if (!JOURNEY_CLASSES.includes(j.class) || !names.has(j.target)) add('AGENTIC_JOURNEY_CLASS', `${j.id}: invalid class/target`);
    if (!nonempty(j.title) || pairs.has(`${j.target}\0${j.title}`)) add('AGENTIC_JOURNEY_TITLE', 'Each journey must map to a distinct executable test title');
    pairs.add(`${j.target}\0${j.title}`);
    if (!Array.isArray(j.risks) || !j.risks.length || j.risks.some((x) => !nonempty(x)) || !Array.isArray(j.taskIds) || !j.taskIds.length || j.taskIds.some((x) => !nonempty(x))) add('AGENTIC_RISK_TRACEABILITY', `${j.id}: risks and canonical task IDs are required`);
    try {
      const source = safe(root, j.source, { mustExist: true, file: true });
      const delta = path.relative(safe(root, m.suiteDir), source);
      if (delta.startsWith('..') || path.isAbsolute(delta) || !/\.e2e\.(?:ts|mts)$/.test(source)) throw new Error('Journey source must be a real e2e test inside suiteDir');
    } catch (e) { add('AGENTIC_SOURCE', `${j.id}: ${e.message}`); }
    const checks = Array.isArray(j.postconditions) ? j.postconditions : [];
    // Additional journeys within the same class/target must cover a genuinely distinct risk,
    // not regenerate the same oracle/assertion set under another ID/title.
    const normalized=list=>[...(Array.isArray(list)?list:[])].map(x=>String(x).trim().toLowerCase()).sort();
    const signature=JSON.stringify([j.target,j.class,normalized(j.risks),normalized(j.taskIds),normalized(checks.map(c=>[c?.kind,c?.assertion].join(':')))]);
    if(coverageSignatures.has(signature))add('AGENTIC_REDUNDANT_JOURNEY',j.id+': same target/class, risk, task and postcondition coverage as another journey; consolidate rather than add a file');
    coverageSignatures.add(signature);
    if(j.visualCheckpoints!==undefined){
      if(!Array.isArray(j.visualCheckpoints)||j.visualCheckpoints.length>12||new Set(j.visualCheckpoints.map(c=>c.id)).size!==j.visualCheckpoints.length||j.visualCheckpoints.some(c=>! /^[a-zA-Z0-9._-]+$/.test(c.id??'')||!nonempty(c.surface)||!nonempty(c.state)))add('AGENTIC_VISUAL_CHECKPOINT_CONTRACT',`${j.id}: declare bounded unique visual checkpoints with canonical surface/state`);
    }
    if (!checks.some((x) => x.kind === 'backend') || !checks.some((x) => x.kind === 'ui')) add('AGENTIC_POSTCONDITIONS', `${j.id}: independent backend and UI checks are required`);
    const checkIds = new Set();
    for (const check of checks) {
      if (!check || !/^[a-zA-Z0-9._-]+$/.test(check?.id ?? '') || checkIds.has(check?.id) || !['backend', 'ui'].includes(check?.kind) || !nonempty(check?.assertion)) add('AGENTIC_POSTCONDITION', `${j.id}: invalid/duplicate check`);
      checkIds.add(check?.id);
    }
  }
  for (const t of targets) for (const kind of JOURNEY_CLASSES) if (!journeys.some((j) => j.target === t.name && j.class === kind)) add('AGENTIC_3_OF_3_REQUIRED', `${t.name} lacks ${kind}`);
  return errors;
}

function sourceIdentity(root, m) {
  const entries = [], visit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.e2e', '.git'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new Error('Agentic suite cannot contain symlinks');
      if (e.isDirectory()) visit(full);
      else if (e.isFile()) entries.push([path.relative(root, full).replaceAll(path.sep, '/'), digest(fs.readFileSync(full))]);
    }
  };
  visit(safe(root, m.suiteDir));
  return digest(JSON.stringify({ manifest: m, files: entries.sort((a, b) => a[0].localeCompare(b[0])) }));
}

export function planAgenticJourneys(root, { manifestPath = JOURNEY_MANIFEST } = {}) {
  root = path.resolve(root);
  const file = safe(root, manifestPath);
  if (!fs.existsSync(file)) {
    const applicable = agenticApplicable(root);
    return { status: applicable ? 'BLOCKED' : 'NOT_APPLICABLE', errors: applicable ? [problem('AGENTIC_MANIFEST_MISSING', 'A user-facing product requires executionkit.journeys.json; static PASS/3-of-3 claims cannot replace it')] : [], applicable };
  }
  let manifest;
  try { manifest = json(file); } catch (e) { return { status: 'BLOCKED', errors: [problem('AGENTIC_MANIFEST_INVALID', e.message)] }; }
  const errors = validateJourneyManifest(root, manifest);
  return { schemaVersion: 'executionkit-agentic-plan/v1', status: errors.length ? 'BLOCKED' : 'PLANNED', manifestPath, manifest, errors, ...(errors.length ? {} : { sourceDigest: sourceIdentity(root, manifest) }) };
}

function artifactFiles(output, attempt, startedAtMs, errors, runId) {
  const files = [];
  for (const a of attempt.artifacts ?? []) {
    try {
      if (!['complete', 'not-required'].includes(a.redaction) || !a.path || !Number.isSafeInteger(a.size) || !/^[a-f0-9]{64}$/.test(a.sha256 ?? '')) throw new Error('Unredacted, remote-only or unhashed artifact');
      const snapshot = a.ref === `executionkit-snapshot:${runId}:${a.sha256}`;
      if (a.ref?.startsWith('executionkit-snapshot:') && !snapshot) throw new Error('Snapshot reference belongs to a different run or hash');
      const evidencePath = snapshot ? 'snapshots/' + a.sha256 : 'artifacts/' + a.path;
      const full = safe(output, evidencePath, { mustExist: true, file: true }), stat = fs.statSync(full);
      if (stat.size !== a.size || digest(fs.readFileSync(full)) !== a.sha256 || stat.mtimeMs < startedAtMs - 2000) throw new Error('Artifact hash, size or freshness mismatch');
      files.push({ ...a, full, evidencePath });
    } catch (e) { errors.push(problem('AGENTIC_ARTIFACT_INVALID', `${a.path ?? a.id}: ${e.message}`)); }
  }
  return files;
}

export function validateAgenticReport(root, manifest, report, { output, runId, startedAtMs, exitCode = 0, oracleDigests = null } = {}) {
  const errors = [], matrix = [], proofHashes = {}, run = report?.run;
  if (report?.schemaVersion !== 'report-1' || !run || !Array.isArray(run.results) || !Array.isArray(run.targets) || !Array.isArray(run.errors)) return { status: 'FAIL', errors: [problem('AGENTIC_REPORT_SCHEMA', 'Expected pinned upstream report-1 with actual result records')], matrix };
  if (exitCode !== 0 || run.exitCode !== 0 || run.status !== 'passed' || run.errors.length || run.carried || run.serialGroups?.length) errors.push(problem('AGENTIC_RUN_NOT_PASS', 'Nonzero exits, errors, carried results and serial groups cannot establish current isolated journey acceptance'));
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(Date.parse(run.startedAt)) || Date.parse(run.startedAt) < startedAtMs - 2000) errors.push(problem('AGENTIC_REPORT_STALE', 'Report predates this execution'));
  const actual = run.results.filter((r) => r.kind === 'test');
  if (actual.length !== manifest.journeys.length || actual.length > manifest.budgets.maxJourneys) errors.push(problem('AGENTIC_RESULT_DENOMINATOR', 'Executed records must match the declared risk journeys exactly'));
  let calls = 0, replayed = 0, handedOff = 0, misses = 0;
  for (const j of manifest.journeys) {
    const expectedFile = path.relative(safe(root, manifest.suiteDir), safe(root, j.source)).replaceAll(path.sep, '/');
    const matches = actual.filter((r) => r.targetId === j.target && r.titlePath?.join(' ') === j.title && r.file === expectedFile);
    const row = { id: j.id, class: j.class, target: j.target, status: 'FAIL', defects: [], artifacts: [] };
    if (matches.length !== 1) row.defects.push(problem('AGENTIC_JOURNEY_MISSING', 'No unique matching executable journey record'));
    else {
      const result = matches[0], attempt = result.attempts?.[0], target = run.targets.find((t) => t.id === j.target);
      if (result.status !== 'passed' || result.attempts?.length !== 1 || !attempt || attempt.status !== 'passed' || attempt.cleanup !== 'complete' || attempt.secondaryErrors?.length) row.defects.push(problem('AGENTIC_JOURNEY_NOT_PASS', `${result.status}; skipped, flaky, retries and failed cleanup block acceptance`));
      if (target?.platform !== manifest.targets.find((t) => t.name === j.target)?.platform || target?.environment !== manifest.app.environment) row.defects.push(problem('AGENTIC_TARGET_MISMATCH', 'Actual engine platform/environment differs from manifest'));
      if (attempt) {
        const steps = attempt.steps ?? [];
        const acts = steps.filter((s) => s.api === 'agent.act');
        const assertions = steps.filter((s) => s.api === 'agent.assert');
        if (!acts.length || acts.some((s) => s.status !== 'passed') || !acts.some((s) => s.metrics?.actionSteps > 0)) row.defects.push(problem('AGENTIC_ACTION_REQUIRED', 'Real agent.act/replayed actions are mandatory'));
        if (!assertions.length || assertions.some((s) => s.status !== 'passed' || !s.observationRevision || !nonempty(s.explanation) || !(s.metrics?.modelCalls > 0) || !nonempty(s.model?.provider) || !nonempty(s.model?.model) || !(s.model?.calls > 0))) row.defects.push(problem('AGENTIC_LIVE_SEMANTICS_REQUIRED', 'A fresh observed semantic assertion with model provenance is mandatory; scripted verdicts cannot claim agentic acceptance'));
        for (const s of steps) {
          calls += s.metrics?.modelCalls ?? 0;
          if (s.cache?.mode === 'self-finalized') replayed++;
          else if (s.cache?.mode === 'agent-concluded') handedOff++;
          else if (s.cache?.mode === 'missed') misses++;
        }
        const files = artifactFiles(output, attempt, startedAtMs, row.defects, runId);
        row.artifacts = files.map(({ full, evidencePath, ...a }) => ({ ...a, path: evidencePath }));
        for (const kind of ['screenshot', 'trace', 'log']) if (!files.some((f) => f.kind === kind)) row.defects.push(problem('AGENTIC_EVIDENCE_REQUIRED', `Missing ${kind} evidence`));
        for (const check of j.postconditions) {
          const rel = `oracles/${j.id}/postcondition-${check.id}.json`;
          let proof;
          try {
            const full = safe(output, rel, { mustExist: true, file: true }), bytes = fs.readFileSync(full), hash = digest(bytes);
            if (!Number.isFinite(startedAtMs) || fs.statSync(full).mtimeMs < startedAtMs - 2000 || (oracleDigests && oracleDigests[rel] !== hash)) throw new Error('Oracle proof changed or predates this run');
            proof = JSON.parse(bytes); proofHashes[rel] = hash;
            row.artifacts.push({ kind: 'log', path: rel, size: bytes.length, sha256: hash, redaction: 'complete', producer: { kind: 'executionkit-postcondition' } });
          } catch (e) { row.defects.push(problem('AGENTIC_ORACLE_ARTIFACT_INVALID', `${check.id}: ${e.message}`)); }
          if (!proof || proof.schemaVersion !== 'executionkit-agentic-postcondition/v1' || proof.runId !== runId || proof.journeyId !== j.id || proof.id !== check.id || proof.kind !== check.kind || proof.assertion !== check.assertion || proof.status !== 'PASS' || !/^[a-f0-9]{64}$/.test(proof.observedDigest ?? '') || !Number.isFinite(startedAtMs) || Date.parse(proof.startedAt) < startedAtMs - 2000 || !Number.isFinite(Date.parse(proof.startedAt)) || !Number.isFinite(Date.parse(proof.completedAt)) || Date.parse(proof.completedAt) < Date.parse(proof.startedAt)) row.defects.push(problem('AGENTIC_POSTCONDITION_UNPROVEN', `${check.id}: live deterministic postcondition is missing/invalid`));
        }
        for (const log of attempt.appLog ?? []) if (log.level === 'error') row.defects.push(problem('AGENTIC_RUNTIME_ERROR', `${log.source}: ${log.text}`));
        if (attempt.error) row.defects.push(problem(attempt.error.code, attempt.error.message));
      }
    }
    row.defects.push(...verifyJourneyVisualCheckpoints(root,output,j,runId));
    row.status = row.defects.length ? 'FAIL' : 'PASS'; errors.push(...row.defects.map((e) => ({ ...e, journey: j.id }))); matrix.push(row);
  }
  if (calls > manifest.budgets.maxModelCalls || !Number.isSafeInteger(run.usage?.modelTokens) || run.usage.modelTokens > manifest.budgets.maxModelTokens) errors.push(problem('AGENTIC_MODEL_BUDGET', 'Run exceeded the model call/token admission budget or usage is missing'));
  return { status: errors.length ? 'FAIL' : 'PASS', errors, matrix, oracleDigests: proofHashes, usage: { modelCalls: calls, modelTokens: run.usage?.modelTokens, replayed, handedOff, misses } };
}

function upstreamSchemaErrors(root, m, report) {
  const require = createRequire(path.join(safe(root, m.suiteDir), 'package.json'));
  const Ajv = require('ajv/dist/2020'), addFormats = require('ajv-formats');
  const validator = new Ajv({ allErrors: true, strict: false }); addFormats(validator);
  const schema = json(safe(root, `${m.suiteDir}/node_modules/e2e/schema/report-v1.schema.json`, { mustExist: true, file: true }));
  const check = validator.compile(schema);
  return check(report) ? [] : [problem('AGENTIC_UPSTREAM_SCHEMA_INVALID', JSON.stringify(check.errors).slice(0, 2000))];
}

function executeWithEnv(command, args, options, env) {
  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  try { Object.assign(process.env, env); return spawnBoundedSync(command, args, options); }
  finally { for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}

function runAgenticJourneys(root, { boundary = 'phase', manifestPath = JOURNEY_MANIFEST, deadlineAt = null } = {}) {
  root = path.resolve(root);
  if(!['wave','phase','release'].includes(boundary))throw new Error('Agentic journeys run at wave, phase or release boundaries');
  const plan = planAgenticJourneys(root, { manifestPath });
  const gateFile = resolveDerivedPath(root, `.executionkit/gates/agentic-${boundary}.json`, 'Agentic gate', { createParents: true });
  const gate = { ...plan, schemaVersion: 'executionkit-agentic-gate/v1', boundary, status: plan.status, startedAt: new Date().toISOString(), completedAt: null };
  const finish = () => { gate.completedAt = new Date().toISOString(); fs.writeFileSync(gateFile, JSON.stringify(gate, null, 2) + '\n'); return { ...gate, gatePath: path.relative(root, gateFile).replaceAll(path.sep, '/') }; };
  if (plan.status !== 'PLANNED') return finish();
  const m = plan.manifest, startedAtMs = Date.now(), runId = crypto.randomUUID();
  const identity = captureV4WorktreeIdentity(root);
  Object.assign(gate, identity, { runId, matrix: [], errors: [] });
  const timeoutMs = Math.min(m.budgets.timeoutMs, deadlineAt === null ? Infinity : deadlineAt - Date.now());
  if (timeoutMs < 1000) { gate.status = 'BLOCKED'; gate.errors.push(problem('AGENTIC_DEADLINE', 'Boundary deadline exhausted')); return finish(); }
  const suite = safe(root, m.suiteDir), outputRel = `.e2e/runs/${runId}`;
  const output = safe(root, `${m.suiteDir}/${outputRel}`, { createParents: true });
  fs.mkdirSync(output);
  gate.output = path.relative(root, output).replaceAll(path.sep, '/');
  const env = { EXECUTIONKIT_E2E_RUN_ID: runId, EXECUTIONKIT_E2E_POSTCONDITION_DIR: path.join(output, 'oracles'), E2E_TELEMETRY_DISABLED: '1', CI: '1' };
  const probe = executeWithEnv(m.environmentProbe.command, m.environmentProbe.args, { cwd: root, timeoutMs: Math.min(timeoutMs, 30000) }, env);
  let observed; try { observed = JSON.parse(probe.stdout); } catch {}
  fs.writeFileSync(path.join(output, 'environment.json'), JSON.stringify({ exitCode: probe.status, observed: observed ?? null, error: probe.error?.message ?? null }, null, 2) + '\n');
  if (probe.status !== 0 || probe.error || observed?.runId !== runId || observed?.identity !== m.app.identity || observed?.revision !== m.app.revision || JSON.stringify(observed?.targets) !== JSON.stringify(m.targets)) {
    gate.status = 'BLOCKED'; gate.errors.push(problem('AGENTIC_ENVIRONMENT_UNVERIFIED', 'Fresh runtime revision, identity and target/role matrix must match before running journeys')); return finish();
  }
  gate.environmentDigest = digest(fs.readFileSync(path.join(output, 'environment.json')));
  const cli = safe(root, `${m.suiteDir}/node_modules/e2e/dist/cli/bin.js`, { mustExist: true, file: true });
  const installed = json(safe(root, `${m.suiteDir}/node_modules/e2e/package.json`, { mustExist: true, file: true }));
  if (installed.version !== E2E_VERSIONS.e2e) { gate.status = 'BLOCKED'; gate.errors.push(problem('AGENTIC_RUNNER_VERSION', `Expected e2e ${E2E_VERSIONS.e2e}`)); return finish(); }
  for(const platform of new Set(m.targets.map((t)=>t.platform==='web'?'web':'mobile'))){
    const engine=json(safe(root,`${m.suiteDir}/node_modules/@e2e-dev/${platform}/package.json`,{mustExist:true,file:true}));
    if(engine.version!==E2E_VERSIONS[platform])throw new Error('Agentic engine version differs from the validated pin: '+platform);
  }
  const args = [cli, 'run', '--config', safe(root, m.config), '--output', outputRel, '--workers', '1', '--retries', '0', '--max-failures', '1', '--trace=on', '--debug', '--reporter', 'list,junit'];
  const visualRunId=prepareVisualJourneyRun(root,m);
  if(visualRunId){env.EXECUTIONKIT_VISUAL_RUN_ID=visualRunId;gate.visualRunId=visualRunId;}
  const remaining = timeoutMs - (Date.now() - startedAtMs);
  const result = remaining > 1000 ? executeWithEnv(process.execPath, args, { cwd: suite, timeoutMs: remaining, maxBuffer: 16 * 1024 * 1024 }, env) : { status: null, timedOut: true, stdout: '', stderr: '' };
  if(visualRunId)finishVisualJourneyRun(root,visualRunId);
  fs.writeFileSync(path.join(output, 'runner.log'), String(result.stdout) + '\n' + String(result.stderr));
  gate.invocation = { command: process.execPath, args, exitCode: result.status, timedOut: result.timedOut === true };
  let report; try { report = json(safe(output, 'report.json', { mustExist: true, file: true })); } catch (e) { gate.errors.push(problem('AGENTIC_REPORT_MISSING', e.message)); }
  if(report){
    const schemaErrors = upstreamSchemaErrors(root, m, report);
    if(schemaErrors.length){gate.status='FAIL';gate.errors.push(...schemaErrors);}
    else Object.assign(gate, validateAgenticReport(root, m, report, { output, runId, startedAtMs, exitCode: result.status }));
  }
  else gate.status = result.timedOut ? 'FAIL' : 'BLOCKED';
  if (sourceIdentity(root, m) !== plan.sourceDigest || captureV4WorktreeIdentity(root).worktreeFingerprint !== identity.worktreeFingerprint) { gate.errors.push(problem('AGENTIC_CANDIDATE_DRIFT', 'Source/worktree changed during the journey run')); gate.status = 'FAIL'; }
  if (report) gate.reportDigest = digest(fs.readFileSync(path.join(output, 'report.json')));
  return finish();
}

export function executeAgenticJourneys(root, options={}){
  try{return runAgenticJourneys(root,options);}
  catch(error){
    const gate={schemaVersion:'executionkit-agentic-gate/v1',status:'BLOCKED',boundary:options.boundary??'phase',completedAt:new Date().toISOString(),errors:[problem('AGENTIC_EXECUTION_BLOCKED',error.message)]};
    if(['wave','phase','release'].includes(gate.boundary)){
      const file=resolveDerivedPath(root,`.executionkit/gates/agentic-${gate.boundary}.json`,'Agentic gate',{createParents:true});
      fs.writeFileSync(file,JSON.stringify(gate,null,2)+'\n');gate.gatePath=path.relative(root,file).replaceAll(path.sep,'/');
    }
    return gate;
  }
}

export function inspectAgenticGate(root, { boundary = 'phase', manifestPath = JOURNEY_MANIFEST } = {}) {
  const plan = planAgenticJourneys(root, { manifestPath });
  if (plan.status !== 'PLANNED') return plan;
  try {
    const gate = json(resolveDerivedPath(root, `.executionkit/gates/agentic-${boundary}.json`, 'Agentic gate', { mustExist: true, file: true }));
    const current = captureV4WorktreeIdentity(root);
    const output = safe(root, gate.output, { mustExist: true });
    const report = json(safe(output, 'report.json', { mustExist: true, file: true }));
    if (gate.status!=='PASS'||!Number.isFinite(Date.parse(gate.startedAt))||!Number.isFinite(Date.parse(gate.completedAt))||Date.now()-Date.parse(gate.completedAt)>60*60*1000||gate.schemaVersion !== 'executionkit-agentic-gate/v1' || gate.boundary !== boundary || gate.head !== current.head || gate.worktreeFingerprint !== current.worktreeFingerprint || gate.sourceDigest !== plan.sourceDigest || gate.reportDigest !== digest(fs.readFileSync(path.join(output, 'report.json')))) throw new Error('Gate is failed/stale, or candidate, source or report differs from the executed gate');
    if (upstreamSchemaErrors(root, plan.manifest, report).length) throw new Error('Persisted report fails the pinned upstream schema');
    const environmentFile = safe(output, 'environment.json', { mustExist: true, file: true });
    const environment = json(environmentFile);
    if (gate.environmentDigest !== digest(fs.readFileSync(environmentFile)) || environment.exitCode !== 0 || environment.observed?.runId !== gate.runId || environment.observed?.revision !== plan.manifest.app.revision || environment.observed?.identity !== plan.manifest.app.identity || JSON.stringify(environment.observed?.targets) !== JSON.stringify(plan.manifest.targets)) throw new Error('Runtime attestation differs from the executed gate');
    const checked = validateAgenticReport(root, plan.manifest, report, { output, runId: gate.runId, startedAtMs: Date.parse(gate.startedAt), exitCode: gate.invocation?.exitCode, oracleDigests: gate.oracleDigests ?? {} });
    return { ...checked, current: checked.status === 'PASS' && gate.status === 'PASS', gatePath: `.executionkit/gates/agentic-${boundary}.json` };
  } catch (e) { return { status: 'BLOCKED', current: false, errors: [problem('AGENTIC_GATE_STALE', e.message)] }; }
}
