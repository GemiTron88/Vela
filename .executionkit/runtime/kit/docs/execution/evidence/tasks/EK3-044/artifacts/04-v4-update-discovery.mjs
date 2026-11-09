import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { V4_CANONICAL_REPOSITORY, V4_CANONICAL_REF, acquireOfficialV4SourceCommit, verifyV4SourceSnapshot } from './v4-source.mjs';

export const UPDATE_STATUS_REL = '.executionkit/update-status.json';
export const INSTALL_RECEIPT_REL = '.executionkit/installation.json';
export const SELF_UPDATE_LOCK_REL = '.executionkit/v4-installer/self-update-lock.json';

export const DEFAULT_UPDATE_POLICY = Object.freeze({
  channel: 'official-main',
  repository: V4_CANONICAL_REPOSITORY,
  ref: V4_CANONICAL_REF,
  checkOnStart: true,
  ttlSeconds: 3600,
  timeoutMs: 5000,
  offlineRetryIntervalSeconds: 1800,
  autoApply: false,
  failOpenOffline: true,
  refuseDirtyWorktree: true,
  requireIncomingUpdater: true,
});

export function resolveUpdatePolicy(config = {}) {
  const custom = config?.updatePolicy ?? config?.v4?.updatePolicy ?? {};
  return {
    channel: String(custom.channel ?? DEFAULT_UPDATE_POLICY.channel),
    repository: String(custom.repository ?? DEFAULT_UPDATE_POLICY.repository),
    ref: String(custom.ref ?? DEFAULT_UPDATE_POLICY.ref),
    checkOnStart: custom.checkOnStart !== false,
    ttlSeconds: typeof custom.ttlSeconds === 'number' && custom.ttlSeconds >= 0 ? custom.ttlSeconds : DEFAULT_UPDATE_POLICY.ttlSeconds,
    timeoutMs: typeof custom.timeoutMs === 'number' && custom.timeoutMs >= 100 ? custom.timeoutMs : DEFAULT_UPDATE_POLICY.timeoutMs,
    offlineRetryIntervalSeconds: typeof custom.offlineRetryIntervalSeconds === 'number' && custom.offlineRetryIntervalSeconds >= 0 ? custom.offlineRetryIntervalSeconds : DEFAULT_UPDATE_POLICY.offlineRetryIntervalSeconds,
    autoApply: custom.autoApply === true,
    failOpenOffline: custom.failOpenOffline !== false,
    refuseDirtyWorktree: custom.refuseDirtyWorktree !== false,
    requireIncomingUpdater: custom.requireIncomingUpdater !== false,
  };
}

export function readInstalledReceipt(root) {
  const receiptFile = path.join(path.resolve(root), ...INSTALL_RECEIPT_REL.split('/'));
  if (!fs.existsSync(receiptFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  } catch {
    return null;
  }
}

export function readInstalledSourceCommit(root) {
  const receipt = readInstalledReceipt(root);
  return receipt?.sourceCommit ?? null;
}

export function readCachedUpdateStatus(root) {
  const statusFile = path.join(path.resolve(root), ...UPDATE_STATUS_REL.split('/'));
  if (!fs.existsSync(statusFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWriteJson(file, data, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  const fd = fs.openSync(tmp, 'wx', mode);
  try {
    fs.writeFileSync(fd, Buffer.from(JSON.stringify(data, null, 2) + '\n'));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

export function writeCachedUpdateStatus(root, data) {
  const statusFile = path.join(path.resolve(root), ...UPDATE_STATUS_REL.split('/'));
  atomicWriteJson(statusFile, data, 0o644);
}

export function isCacheFresh(cached, { ttlSeconds = 3600, offlineRetryIntervalSeconds = 1800, now = Date.now() } = {}) {
  if (!cached || !cached.checkedAt) return false;
  const checkedAtMs = new Date(cached.checkedAt).getTime();
  if (Number.isNaN(checkedAtMs)) return false;

  if (cached.status === 'OFFLINE_OR_UNKNOWN') {
    if (cached.retryAfter) {
      const retryAfterMs = new Date(cached.retryAfter).getTime();
      if (!Number.isNaN(retryAfterMs)) return now < retryAfterMs;
    }
    return now < checkedAtMs + (offlineRetryIntervalSeconds * 1000);
  }

  const effectiveTtl = typeof cached.ttlSeconds === 'number' ? cached.ttlSeconds : ttlSeconds;
  return now < checkedAtMs + (effectiveTtl * 1000);
}

export function queryRemoteHead({ repository = V4_CANONICAL_REPOSITORY, ref = V4_CANONICAL_REF, timeoutMs = 5000 } = {}) {
  try {
    const result = spawnSync('git', ['ls-remote', '--exit-code', repository, ref], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false
    });

    if (result.status !== 0) {
      const errorMsg = String(result.stderr || result.stdout || result.error?.message || 'git ls-remote failed').trim();
      const isTimeout = result.error?.code === 'ETIMEDOUT' || Boolean(result.error?.message?.includes('TIMEDOUT'));
      return { ok: false, error: errorMsg, timeout: isTimeout };
    }

    const output = String(result.stdout ?? '').trim();
    const match = output.match(/^([a-f0-9]{40})\s+/m);
    if (!match) {
      return { ok: false, error: 'git ls-remote returned unexpected output format: ' + output.slice(0, 100), timeout: false };
    }

    return { ok: true, sha: match[1].toLowerCase() };
  } catch (error) {
    return { ok: false, error: error.message, timeout: false };
  }
}

export function discoverV4Update(root, { force = false, timeoutMs, config } = {}) {
  root = path.resolve(root);
  const receipt = readInstalledReceipt(root);
  if (!receipt) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'NOT_INSTALLED',
      message: 'Project does not have an installed ExecutionKit v4 runtime',
      checkedAt: new Date().toISOString()
    };
  }

  const installedCommit = receipt.sourceCommit ?? null;
  if (!installedCommit) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'BASELINE_REQUIRED',
      message: 'Legacy installed receipt lacks exact source-SHA identity; update/reinstall to establish canonical baseline',
      installedCommit: null,
      checkedAt: new Date().toISOString()
    };
  }

  const policy = resolveUpdatePolicy(config);
  if (!force && policy.checkOnStart === false) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'DISABLED',
      message: 'Automatic update check is disabled by project policy',
      installedCommit,
      checkedAt: new Date().toISOString()
    };
  }

  const cached = readCachedUpdateStatus(root);
  if (!force && cached && cached.installedCommit === installedCommit && isCacheFresh(cached, { ttlSeconds: policy.ttlSeconds, offlineRetryIntervalSeconds: policy.offlineRetryIntervalSeconds })) {
    return { ...cached, fromCache: true };
  }

  const effectiveTimeout = timeoutMs ?? policy.timeoutMs;
  const remote = queryRemoteHead({ repository: policy.repository, ref: policy.ref, timeoutMs: effectiveTimeout });

  const checkedAt = new Date().toISOString();
  if (!remote.ok) {
    const retryAfter = new Date(Date.now() + (policy.offlineRetryIntervalSeconds * 1000)).toISOString();
    const result = {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'OFFLINE_OR_UNKNOWN',
      message: 'Bounded remote update check failed; failing open for local execution',
      error: remote.error,
      timeout: remote.timeout,
      installedCommit,
      remoteCommit: null,
      repository: policy.repository,
      ref: policy.ref,
      checkedAt,
      retryAfter,
      ttlSeconds: policy.ttlSeconds,
      fromCache: false
    };
    try { writeCachedUpdateStatus(root, result); } catch {}
    return result;
  }

  const remoteCommit = remote.sha;
  const isCurrent = remoteCommit === installedCommit;
  const status = isCurrent ? 'CURRENT' : 'UPDATE_AVAILABLE';
  const message = isCurrent
    ? 'Installed ExecutionKit is up to date with canonical main (' + installedCommit.slice(0, 8) + ')'
    : 'Newer ExecutionKit canonical commit available (' + remoteCommit.slice(0, 8) + ')';

  const result = {
    schemaVersion: 'executionkit-v4-update-status/v1',
    status,
    message,
    installedCommit,
    remoteCommit,
    repository: policy.repository,
    ref: policy.ref,
    checkedAt,
    ttlSeconds: policy.ttlSeconds,
    fromCache: false
  };

  try { writeCachedUpdateStatus(root, result); } catch {}
  return result;
}

export function getFastUpdateStatus(root, { config } = {}) {
  root = path.resolve(root);
  const receipt = readInstalledReceipt(root);
  if (!receipt) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'NOT_INSTALLED',
      message: 'Project does not have an installed ExecutionKit v4 runtime'
    };
  }

  const installedCommit = receipt.sourceCommit ?? null;
  if (!installedCommit) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'BASELINE_REQUIRED',
      message: 'Legacy installed receipt lacks exact source-SHA identity',
      installedCommit: null
    };
  }

  const policy = resolveUpdatePolicy(config);
  if (policy.checkOnStart === false) {
    return {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'DISABLED',
      message: 'Update discovery disabled',
      installedCommit
    };
  }

  const cached = readCachedUpdateStatus(root);
  if (cached && cached.installedCommit === installedCommit && isCacheFresh(cached, { ttlSeconds: policy.ttlSeconds, offlineRetryIntervalSeconds: policy.offlineRetryIntervalSeconds })) {
    return { ...cached, fromCache: true };
  }

  return discoverV4Update(root, { force: false, config });
}

export function checkWorktreeCleanliness(root, { allowDirty = false } = {}) {
  root = path.resolve(root);
  const probe = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (probe.status !== 0) return { isGit: false, clean: true, uncommitted: [] };

  const args = ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':(exclude).executionkit/source/AI-ExecutionKit', ':(exclude).executionkit/source/AI-ExecutionKit/**'];
  const status = spawnSync('git', args, { encoding: 'utf8' });
  const raw = String(status.stdout ?? '').trim();
  if (!raw) return { isGit: true, clean: true, dirty: false, uncommitted: [] };

  const uncommitted = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    isGit: true,
    clean: allowDirty ? true : uncommitted.length === 0,
    uncommitted,
    dirty: uncommitted.length > 0
  };
}

function acquireUpdateLock(root) {
  const lockFile = path.join(path.resolve(root), ...SELF_UPDATE_LOCK_REL.split('/'));
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });

  if (fs.existsSync(lockFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      const pid = existing.pid;
      let alive = false;
      if (typeof pid === 'number') {
        try { process.kill(pid, 0); alive = true; } catch {}
      }
      const ageMs = Date.now() - new Date(existing.createdAt ?? 0).getTime();
      if (alive && ageMs < 600000) {
        return { acquired: false, lock: existing };
      }
    } catch {}
    try { fs.rmSync(lockFile, { force: true }); } catch {}
  }

  try {
    const fd = fs.openSync(lockFile, 'wx', 0o600);
    const lockData = { pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() };
    fs.writeFileSync(fd, JSON.stringify(lockData, null, 2) + '\n');
    fs.closeSync(fd);
    return { acquired: true, lockFile };
  } catch (err) {
    return { acquired: false, error: err.message };
  }
}

function releaseUpdateLock(root) {
  const lockFile = path.join(path.resolve(root), ...SELF_UPDATE_LOCK_REL.split('/'));
  try {
    if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
  } catch {}
}

export async function applyV4SelfUpdate(root, { force = false, allowDirty = false, dryRun = false, config, explicitSource = null } = {}) {
  root = path.resolve(root);
  const policy = resolveUpdatePolicy(config);

  if (policy.refuseDirtyWorktree && !allowDirty) {
    const cleanliness = checkWorktreeCleanliness(root, { allowDirty: false });
    if (!cleanliness.clean) {
      return {
        schemaVersion: 'executionkit-v4-self-update/v1',
        status: 'BLOCKED',
        code: 'V4_DIRTY_WORKTREE_REFUSAL',
        message: 'Project worktree has uncommitted changes. Commit or stash your changes before self-update, or pass --allow-dirty.',
        uncommitted: cleanliness.uncommitted
      };
    }
  }

  const lockRes = acquireUpdateLock(root);
  if (!lockRes.acquired) {
    return {
      schemaVersion: 'executionkit-v4-self-update/v1',
      status: 'BLOCKED',
      code: 'V4_CONCURRENT_UPDATE_BLOCKED',
      message: 'Another self-update process is currently active on this project',
      lock: lockRes.lock
    };
  }

  let targetSnapshot = null;
  let targetCommit = null;
  let previousCommit = readInstalledSourceCommit(root);

  try {
    if (explicitSource) {
      targetSnapshot = path.resolve(explicitSource);
      try {
        const probe = spawnSync('git', ['-C', targetSnapshot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
        if (probe.status === 0 && /^[a-f0-9]{40}$/.test(probe.stdout.trim())) {
          targetCommit = probe.stdout.trim();
        }
      } catch {}
      if (!targetCommit) targetCommit = 'explicit-source';
      for (const rel of ['STANDARD_V4.md', 'bin/executionkit-cli.mjs', 'lib/v4-installer.mjs']) {
        if (!fs.existsSync(path.join(targetSnapshot, rel))) throw new Error('Explicit source is not v4-capable: missing ' + rel);
      }
    } else {
      const discovery = discoverV4Update(root, { force, config });
      if (discovery.status === 'NOT_INSTALLED') {
        return {
          schemaVersion: 'executionkit-v4-self-update/v1',
          status: 'BLOCKED',
          code: 'V4_PROJECT_NOT_INSTALLED',
          message: 'Project is not installed; run executionkit install . first.'
        };
      }
      if (discovery.status === 'OFFLINE_OR_UNKNOWN') {
        return {
          schemaVersion: 'executionkit-v4-self-update/v1',
          status: 'BLOCKED',
          code: 'V4_UPDATE_DISCOVERY_FAILED',
          message: 'Cannot self-update: official GitHub origin is unreachable or discovery timed out',
          details: discovery
        };
      }
      if (discovery.status === 'CURRENT' && !force) {
        return {
          schemaVersion: 'executionkit-v4-self-update/v1',
          status: 'UP_TO_DATE',
          message: 'ExecutionKit is already at canonical HEAD (' + discovery.installedCommit + ')',
          installedCommit: discovery.installedCommit,
          remoteCommit: discovery.remoteCommit
        };
      }

      targetCommit = discovery.remoteCommit ?? discovery.installedCommit;
      if (!targetCommit || !/^[a-f0-9]{40}$/.test(targetCommit)) {
        return {
          schemaVersion: 'executionkit-v4-self-update/v1',
          status: 'BLOCKED',
          code: 'V4_INVALID_TARGET_COMMIT',
          message: 'Discovery did not yield a valid 40-character target commit SHA'
        };
      }

      const acquired = acquireOfficialV4SourceCommit(root, targetCommit, { repository: policy.repository, ref: policy.ref });
      targetSnapshot = acquired.sourceSnapshot;
      verifyV4SourceSnapshot(targetSnapshot, targetCommit, { repository: policy.repository });
    }
    const incomingInstallerPath = path.join(targetSnapshot, 'lib', 'v4-installer.mjs');
    if (!fs.existsSync(incomingInstallerPath)) {
      throw new Error('Incoming ExecutionKit source is missing lib/v4-installer.mjs: ' + targetSnapshot);
    }

    const incomingInstaller = await import(pathToFileURL(incomingInstallerPath).href);
    const inspection = incomingInstaller.inspectV4Installation ? incomingInstaller.inspectV4Installation(root) : null;
    const op = (inspection?.configVersion && /^4\./.test(inspection.configVersion)) ? 'update' : 'auto';

    const plan = incomingInstaller.planV4Installation(root, {
      source: targetSnapshot,
      sourceCommit: targetCommit,
      operation: op
    });

    if (plan.conflicts && plan.conflicts.length > 0) {
      return {
        schemaVersion: 'executionkit-v4-self-update/v1',
        status: 'CONFLICT',
        conflicts: plan.conflicts,
        plan: incomingInstaller.summarizeV4Plan(plan)
      };
    }

    if (dryRun) {
      return {
        schemaVersion: 'executionkit-v4-self-update/v1',
        status: 'DRY_RUN',
        plan: incomingInstaller.summarizeV4Plan(plan),
        sourceCommit: targetCommit
      };
    }

    const applyResult = incomingInstaller.applyV4Installation(plan, { allowDirty });
    const doctor = incomingInstaller.doctorV4Installation(root);

    let revalResult = null;
    const incomingRevalPath = path.join(targetSnapshot, 'lib', 'v4-upgrade-revalidation.mjs');
    if (fs.existsSync(incomingRevalPath)) {
      try {
        const incomingReval = await import(pathToFileURL(incomingRevalPath).href);
        revalResult = incomingReval.runUpgradeRevalidation(root, { apply: true, autoTask: true });
      } catch (err) {
        revalResult = { ok: false, error: err.message };
      }
    }

    writeCachedUpdateStatus(root, {
      schemaVersion: 'executionkit-v4-update-status/v1',
      status: 'CURRENT',
      message: 'Self-update completed successfully',
      installedCommit: targetCommit,
      remoteCommit: targetCommit,
      repository: policy.repository,
      ref: policy.ref,
      checkedAt: new Date().toISOString(),
      ttlSeconds: policy.ttlSeconds,
      fromCache: false
    });

    return {
      schemaVersion: 'executionkit-v4-self-update/v1',
      status: 'UPDATED',
      previousCommit,
      currentCommit: targetCommit,
      planId: plan.id,
      runtimePath: applyResult.runtimePath,
      appliedAt: new Date().toISOString(),
      doctor: { status: doctor.status, errors: doctor.errors },
      upgradeRevalidation: revalResult
    };
  } finally {
    releaseUpdateLock(root);
  }
}
