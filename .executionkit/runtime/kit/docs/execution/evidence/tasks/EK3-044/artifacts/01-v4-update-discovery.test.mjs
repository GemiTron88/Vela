import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_UPDATE_POLICY,
  UPDATE_STATUS_REL,
  INSTALL_RECEIPT_REL,
  SELF_UPDATE_LOCK_REL,
  resolveUpdatePolicy,
  readInstalledReceipt,
  readInstalledSourceCommit,
  readCachedUpdateStatus,
  writeCachedUpdateStatus,
  isCacheFresh,
  queryRemoteHead,
  discoverV4Update,
  getFastUpdateStatus,
  checkWorktreeCleanliness,
  applyV4SelfUpdate
} from '../lib/v4-update-discovery.mjs';

import { buildV4ExecutionEnvelope } from '../lib/v4-kernel.mjs';
import { parseCliArgs, getCliCommandRegistry } from '../lib/v4-cli-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'executionkit-cli.mjs');
const launcher = path.join(root, 'bin', 'executionkit.mjs');

function fixture(t) {
  const dir = path.join(os.tmpdir(), 'ek4-update-' + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  return dir;
}

function initGitRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: dir, windowsHide: true });
  spawnSync('git', ['config', 'user.name', 'Test Runner'], { cwd: dir, windowsHide: true });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, windowsHide: true });
}

function commitAll(dir, message = 'initial') {
  spawnSync('git', ['add', '-A'], { cwd: dir, windowsHide: true });
  spawnSync('git', ['commit', '-m', message, '--no-gpg-sign'], { cwd: dir, windowsHide: true });
}

test('update policy defaults match canonical v4 specification', () => {
  const policy = resolveUpdatePolicy();
  assert.equal(policy.channel, 'official-main');
  assert.equal(policy.repository, 'https://github.com/Elwazeery/AI-ExcutionKit.git');
  assert.equal(policy.ref, 'refs/heads/main');
  assert.equal(policy.checkOnStart, true);
  assert.equal(policy.ttlSeconds, 3600);
  assert.equal(policy.timeoutMs, 5000);
  assert.equal(policy.offlineRetryIntervalSeconds, 1800);
  assert.equal(policy.autoApply, false);
  assert.equal(policy.failOpenOffline, true);
  assert.equal(policy.refuseDirtyWorktree, true);
  assert.equal(policy.requireIncomingUpdater, true);
});

test('update policy merges custom project configuration correctly', () => {
  const custom = {
    updatePolicy: {
      ttlSeconds: 7200,
      timeoutMs: 10000,
      checkOnStart: false,
      refuseDirtyWorktree: false
    }
  };
  const policy = resolveUpdatePolicy(custom);
  assert.equal(policy.ttlSeconds, 7200);
  assert.equal(policy.timeoutMs, 10000);
  assert.equal(policy.checkOnStart, false);
  assert.equal(policy.refuseDirtyWorktree, false);
  assert.equal(policy.channel, 'official-main');
});

test('cache freshness evaluates TTL and offline retry correctly', () => {
  const now = Date.now();
  const fresh = {
    status: 'CURRENT',
    checkedAt: new Date(now - 10000).toISOString(),
    ttlSeconds: 3600
  };
  assert.equal(isCacheFresh(fresh, { now }), true);

  const expired = {
    status: 'CURRENT',
    checkedAt: new Date(now - 4000000).toISOString(),
    ttlSeconds: 3600
  };
  assert.equal(isCacheFresh(expired, { now }), false);

  const offlineFresh = {
    status: 'OFFLINE_OR_UNKNOWN',
    checkedAt: new Date(now - 10000).toISOString(),
    retryAfter: new Date(now + 60000).toISOString()
  };
  assert.equal(isCacheFresh(offlineFresh, { now }), true);

  const offlineExpired = {
    status: 'OFFLINE_OR_UNKNOWN',
    checkedAt: new Date(now - 100000).toISOString(),
    retryAfter: new Date(now - 1000).toISOString()
  };
  assert.equal(isCacheFresh(offlineExpired, { now }), false);
});

test('discoverV4Update returns NOT_INSTALLED when project has no installation receipt', (t) => {
  const dir = fixture(t);
  const result = discoverV4Update(dir);
  assert.equal(result.status, 'NOT_INSTALLED');
});

test('discoverV4Update returns BASELINE_REQUIRED when receipt lacks sourceCommit', (t) => {
  const dir = fixture(t);
  const receiptPath = path.join(dir, '.executionkit', 'installation.json');
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify({ schemaVersion: 'executionkit-v4-install/v1', version: '4.0.0-dev' }, null, 2));

  const result = discoverV4Update(dir);
  assert.equal(result.status, 'BASELINE_REQUIRED');
  assert.match(result.message, /baseline/i);
});

test('discoverV4Update returns cached result when cache is fresh without network calls', (t) => {
  const dir = fixture(t);
  const installedCommit = '1111111111111111111111111111111111111111';
  const receiptPath = path.join(dir, '.executionkit', 'installation.json');
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: installedCommit
  }, null, 2));

  const statusPath = path.join(dir, '.executionkit', 'update-status.json');
  fs.writeFileSync(statusPath, JSON.stringify({
    schemaVersion: 'executionkit-v4-update-status/v1',
    status: 'CURRENT',
    installedCommit,
    remoteCommit: installedCommit,
    checkedAt: new Date().toISOString(),
    ttlSeconds: 3600
  }, null, 2));

  const result = discoverV4Update(dir);
  assert.equal(result.status, 'CURRENT');
  assert.equal(result.fromCache, true);
  assert.equal(result.installedCommit, installedCommit);
});

test('discoverV4Update fails open with OFFLINE_OR_UNKNOWN when remote lookup fails or times out', (t) => {
  const dir = fixture(t);
  const installedCommit = '1111111111111111111111111111111111111111';
  const receiptPath = path.join(dir, '.executionkit', 'installation.json');
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: installedCommit
  }, null, 2));

  // Point to a non-existent local bare repo that will fail immediately
  const config = {
    updatePolicy: {
      repository: path.join(dir, 'non-existent-repo.git'),
      ref: 'refs/heads/main',
      timeoutMs: 500,
      offlineRetryIntervalSeconds: 600
    }
  };

  const result = discoverV4Update(dir, { force: true, config });
  assert.equal(result.status, 'OFFLINE_OR_UNKNOWN');
  assert.equal(result.fromCache, false);
  assert.ok(result.retryAfter);
  assert.ok(result.error);

  // Cached file was written with retryAfter
  const cached = readCachedUpdateStatus(dir);
  assert.equal(cached.status, 'OFFLINE_OR_UNKNOWN');
  assert.equal(cached.installedCommit, installedCommit);
});

test('discoverV4Update detects CURRENT when remote exact SHA equals installed exact SHA', (t) => {
  const dir = fixture(t);
  const remoteDir = path.join(dir, 'remote.git');
  initGitRepo(remoteDir);
  fs.writeFileSync(path.join(remoteDir, 'VERSION'), '4.0.0\n');
  commitAll(remoteDir, 'feat: v4 release');

  const headSha = spawnSync('git', ['-C', remoteDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

  const projectDir = path.join(dir, 'project');
  fs.mkdirSync(path.join(projectDir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: headSha
  }, null, 2));

  const config = {
    updatePolicy: {
      repository: remoteDir,
      ref: 'refs/heads/master' // or main, match branch
    }
  };
  // Rename branch to main if needed
  spawnSync('git', ['-C', remoteDir, 'branch', '-M', 'main'], { windowsHide: true });
  config.updatePolicy.ref = 'refs/heads/main';

  const result = discoverV4Update(projectDir, { force: true, config });
  assert.equal(result.status, 'CURRENT');
  assert.equal(result.installedCommit, headSha);
  assert.equal(result.remoteCommit, headSha);
});

test('discoverV4Update detects UPDATE_AVAILABLE when remote exact SHA differs from installed exact SHA', (t) => {
  const dir = fixture(t);
  const remoteDir = path.join(dir, 'remote.git');
  initGitRepo(remoteDir);
  fs.writeFileSync(path.join(remoteDir, 'VERSION'), '4.0.0\n');
  commitAll(remoteDir, 'initial');
  spawnSync('git', ['-C', remoteDir, 'branch', '-M', 'main'], { windowsHide: true });

  const headSha = spawnSync('git', ['-C', remoteDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const olderSha = '2222222222222222222222222222222222222222';

  const projectDir = path.join(dir, 'project');
  fs.mkdirSync(path.join(projectDir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: olderSha
  }, null, 2));

  const config = {
    updatePolicy: {
      repository: remoteDir,
      ref: 'refs/heads/main'
    }
  };

  const result = discoverV4Update(projectDir, { force: true, config });
  assert.equal(result.status, 'UPDATE_AVAILABLE');
  assert.equal(result.installedCommit, olderSha);
  assert.equal(result.remoteCommit, headSha);

  const cached = readCachedUpdateStatus(projectDir);
  assert.equal(cached.status, 'UPDATE_AVAILABLE');
  assert.equal(cached.remoteCommit, headSha);
});

test('checkWorktreeCleanliness detects dirty files excluding managed source', (t) => {
  const dir = fixture(t);
  initGitRepo(dir);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Project\n');
  commitAll(dir, 'init');

  const clean = checkWorktreeCleanliness(dir);
  assert.equal(clean.clean, true);
  assert.equal(clean.dirty, false);

  // Untracked owner file
  fs.writeFileSync(path.join(dir, 'feature.js'), 'console.log("hi");\n');
  const dirty = checkWorktreeCleanliness(dir);
  assert.equal(dirty.clean, false);
  assert.equal(dirty.dirty, true);
  assert.ok(dirty.uncommitted.length >= 1);

  // allowDirty bypasses cleanliness refusal
  const allowed = checkWorktreeCleanliness(dir, { allowDirty: true });
  assert.equal(allowed.clean, true);

  // Managed source tree should be excluded
  fs.rmSync(path.join(dir, 'feature.js'), { force: true });
  const managedDir = path.join(dir, '.executionkit', 'source', 'AI-ExecutionKit');
  fs.mkdirSync(managedDir, { recursive: true });
  fs.writeFileSync(path.join(managedDir, 'dummy.txt'), 'downloaded\n');

  const cleanWithManaged = checkWorktreeCleanliness(dir);
  assert.equal(cleanWithManaged.clean, true);
});

test('applyV4SelfUpdate refuses dirty worktree and returns V4_DIRTY_WORKTREE_REFUSAL without discarding owner files', async (t) => {
  const dir = fixture(t);
  initGitRepo(dir);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Original Code\n');
  commitAll(dir, 'init');

  // Create dirty worktree
  fs.writeFileSync(path.join(dir, 'owner-uncommitted.js'), 'const importantWork = 42;\n');

  const result = await applyV4SelfUpdate(dir, { allowDirty: false });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'V4_DIRTY_WORKTREE_REFUSAL');
  assert.match(result.message, /uncommitted changes/i);

  // Owner file must be intact
  assert.ok(fs.existsSync(path.join(dir, 'owner-uncommitted.js')));
  assert.equal(fs.readFileSync(path.join(dir, 'owner-uncommitted.js'), 'utf8'), 'const importantWork = 42;\n');
});

test('applyV4SelfUpdate returns UP_TO_DATE when already at canonical HEAD', async (t) => {
  const dir = fixture(t);
  initGitRepo(dir);
  const headSha = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || '3333333333333333333333333333333333333333';

  fs.mkdirSync(path.join(dir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: headSha
  }, null, 2));

  // Mock cached status as CURRENT
  writeCachedUpdateStatus(dir, {
    schemaVersion: 'executionkit-v4-update-status/v1',
    status: 'CURRENT',
    installedCommit: headSha,
    remoteCommit: headSha,
    checkedAt: new Date().toISOString(),
    ttlSeconds: 3600
  });

  const result = await applyV4SelfUpdate(dir, { force: false, allowDirty: true });
  assert.equal(result.status, 'UP_TO_DATE');
  assert.match(result.message, /already at canonical HEAD/i);
});

test('applyV4SelfUpdate detects active concurrent update and blocks with V4_CONCURRENT_UPDATE_BLOCKED', async (t) => {
  const dir = fixture(t);
  initGitRepo(dir);

  const lockPath = path.join(dir, ...SELF_UPDATE_LOCK_REL.split('/'));
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid, // current running process PID -> alive!
    host: os.hostname(),
    createdAt: new Date().toISOString()
  }, null, 2));

  // Create valid installation and mock discovery of an update
  const installedSha = '4444444444444444444444444444444444444444';
  const remoteSha = '5555555555555555555555555555555555555555';
  fs.mkdirSync(path.join(dir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: installedSha
  }, null, 2));

  writeCachedUpdateStatus(dir, {
    schemaVersion: 'executionkit-v4-update-status/v1',
    status: 'UPDATE_AVAILABLE',
    installedCommit: installedSha,
    remoteCommit: remoteSha,
    checkedAt: new Date().toISOString(),
    ttlSeconds: 3600
  });

  const result = await applyV4SelfUpdate(dir, { force: true, allowDirty: true, explicitSource: root });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'V4_CONCURRENT_UPDATE_BLOCKED');
});

test('kernel execution envelope reflects V4_UPDATE_AVAILABLE blocker and routes nextCommand to self-update', (t) => {
  const dir = fixture(t);
  initGitRepo(dir);

  // Setup minimal valid v4 project structure
  fs.writeFileSync(path.join(dir, 'execution.config.json'), JSON.stringify({
    standardVersion: '4.0.0-dev',
    profile: 'STANDARD',
    v4: {
      cliFirst: true,
      mcp: false,
      host: { primary: 'antigravity', entryAuthority: 'AGENTS.md', requireLiveHookObservation: false },
      kernel: { failClosed: true, requireSystemEvidence: true, requireNegativeRegressions: true, automaticImpactRouting: true },
      systems: {
        execution: { enabled: true, level: 'STANDARD', always: true },
        agent: { enabled: true, level: 'STANDARD', always: true, parallelMode: 'DEPENDENCY_SAFE_PARALLEL' },
        state: { enabled: true, level: 'STANDARD', always: true, rehydrateBeforeMutation: true, checkpointAfterLifecycle: true },
        content: { enabled: true, level: 'STANDARD', trigger: 'impact' },
        seo: { enabled: true, level: 'STANDARD', trigger: 'applicability-and-impact' },
        docs: { enabled: true, level: 'STANDARD', trigger: 'material-source-impact', requiredForRelease: true },
        audit: { enabled: true, level: 'STANDARD', trigger: 'wave-phase-release' },
        test: { enabled: true, level: 'STANDARD', trigger: 'wave-phase-release', runTaskVerification: false, runImpactedTests: false, requireExecutableTaskCheck: false, phaseFullSuite: true, waveFullSuite: true },
        launch: { enabled: true, level: 'STANDARD', trigger: 'release' },
        visual: { enabled: true, level: 'FULL', profile: 'PREMIUM', trigger: 'ui-surface-impact', requireResponsive: true, requireComponentSystem: true, requireDesignAuthority: true, requireRenderedReview: true, requireProductionShapedData: true, requireAccessibility: true, requireIndependentReview: true }
      }
    },
    runtime: { mode: 'DEPENDENCY_SAFE_PARALLEL' },
    repositoryIntelligence: { enabled: true, autoConsumption: { enabled: true, fallback: 'native', preferred: [] } },
    documentation: { enabled: true, requiredForRelease: true },
    operator: { entrypoint: 'todo-first', targetedTaskVerification: false, fullCiCadence: 'wave-or-phase-boundary' },
    agent: { manifestPath: '.agents/manifest.json' },
    todoPath: 'TODO.md',
    todoAuthority: { mode: 'sharded', shardRoot: 'todo', archiveRoot: 'todo/archive', maintenanceRequired: true },
    productClosure: { enabled: true, treatProjectAsSingleProduct: true, autoCreateGapTasks: true, autoCreateSystemFindingTasks: true, systemFindingSeverity: 'HIGH', runBeforeSelection: true, runAfterIntegration: true, closureRequiredBeforeNoActionableWork: true },
    adoption: { deepIntegrationRequired: true, integrationPhase: 'EK4', integrationGateTaskId: 'EK4-AUDIT', integrationActivationTaskId: 'EK4-ACTIVATE', productExecutionBlockedUntilGateAccepted: true, maturityProfile: 'M0_PLANNING_ONLY', maturityRationale: ['test'] },
    integration: { requirePhaseConvergenceForClosure: true, minTasksForPhaseGate: 2, journeyContractPath: 'executionkit.integration.json', requireCriticalJourneysForRelease: true, allowNotApplicableForRelease: false, requireSystemReleaseGate: false, requireJourneyDenominator: true, releaseGateAuthority: 'runtime-exact-candidate' },
    controlPlane: { mode: 'github-native', executionAgent: 'disabled', repositoryAuthority: 'github-origin', taskAuthority: 'todo-shards', statusAuthority: 'github-checks-workflows', fleetAuthority: 'github-self-hosted-runners', dispatchAuthority: 'github-workflow-dispatch', workflowDispatch: 'repository-defined-manual', remoteCommand: 'disabled', requiredForLocalExecution: false },
    ci: { provider: 'github-actions', executionMode: 'self-hosted-manual', githubHostedAllowed: false, automaticPushRuns: false, maxProjectRunnersPerDevice: 1, allowedRunnerOS: ['linux', 'windows', 'macos'] },
    evidence: { requireDurableTaskEvidence: true, taskProofRoot: 'docs/execution/evidence/tasks' }
  }, null, 2));

  fs.mkdirSync(path.join(dir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: '6666666666666666666666666666666666666666'
  }, null, 2));

  fs.writeFileSync(path.join(dir, '.executionkit', 'upgrade-revalidation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-upgrade-revalidation-receipt/v1',
    status: 'PASS',
    required: false
  }, null, 2));

  // Write UPDATE_AVAILABLE cache
  writeCachedUpdateStatus(dir, {
    schemaVersion: 'executionkit-v4-update-status/v1',
    status: 'UPDATE_AVAILABLE',
    installedCommit: '6666666666666666666666666666666666666666',
    remoteCommit: '7777777777777777777777777777777777777777',
    checkedAt: new Date().toISOString(),
    ttlSeconds: 3600
  });

  const envelope = buildV4ExecutionEnvelope(dir, { host: 'other' });
  assert.equal(envelope.blocked, true);
  assert.ok(envelope.blockers.some((b) => b.code === 'V4_UPDATE_AVAILABLE'));
  assert.equal(envelope.nextCommand, 'executionkit self-update apply .');
  assert.equal(envelope.fabrics.update?.status, 'UPDATE_AVAILABLE');
});

test('CLI self-update commands and parity between CLI and launcher', () => {
  const statusRes = spawnSync(process.execPath, [cli, 'self-update', 'status'], { cwd: root, encoding: 'utf8' });
  const launcherStatusRes = spawnSync(process.execPath, [launcher, 'self-update', 'status'], { cwd: root, encoding: 'utf8' });

  assert.equal(statusRes.status, launcherStatusRes.status);
  const out1 = JSON.parse(statusRes.stdout);
  const out2 = JSON.parse(launcherStatusRes.stdout);
  assert.equal(out1.schemaVersion, 'executionkit-v4-update-status/v1');
  assert.equal(out2.schemaVersion, 'executionkit-v4-update-status/v1');

  // Help command on self-update family
  const helpRes = spawnSync(process.execPath, [cli, 'self-update', '--help'], { cwd: root, encoding: 'utf8' });
  const launcherHelpRes = spawnSync(process.execPath, [launcher, 'self-update', '--help'], { cwd: root, encoding: 'utf8' });

  assert.equal(helpRes.status, 0);
  assert.equal(launcherHelpRes.status, 0);
  const helpOut1 = JSON.parse(helpRes.stdout);
  const helpOut2 = JSON.parse(launcherHelpRes.stdout);
  assert.equal(helpOut1.status, 'OK');
  assert.equal(helpOut2.status, 'OK');
  assert.equal(helpOut1.command, 'self-update');
  assert.deepEqual(helpOut1.usage, helpOut2.usage);
});

test('self-update dry-run plans migration without applying changes', async (t) => {
  const dir = fixture(t);
  initGitRepo(dir);

  const headSha = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || '8888888888888888888888888888888888888888';
  fs.mkdirSync(path.join(dir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'execution.config.json'), JSON.stringify({
    standardVersion: '4.0.0-dev',
    profile: 'STANDARD'
  }, null, 2));
  fs.writeFileSync(path.join(dir, '.executionkit', 'installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    sourceCommit: headSha
  }, null, 2));

  // Run dry-run with explicit source pointing to root
  const result = await applyV4SelfUpdate(dir, {
    dryRun: true,
    allowDirty: true,
    explicitSource: root
  });

  assert.equal(result.status, 'DRY_RUN');
  assert.ok(result.plan);
  assert.ok(result.plan.planId);
  // Verify lock was released
  assert.equal(fs.existsSync(path.join(dir, ...SELF_UPDATE_LOCK_REL.split('/'))), false);
});
