import fs from 'node:fs';
import path from 'node:path';
import { spawnPortableSync } from './portable-process.mjs';
import { verifyWorkerRetirement } from './production-worker-retirement.mjs';

function realDirectory(target) {
  const absolute = path.resolve(target);
  if (!fs.lstatSync(absolute).isDirectory() || fs.realpathSync(absolute) !== absolute) {
    throw new Error(`Retention requires a real directory without symlink ancestors: ${absolute}`);
  }
  return absolute;
}

function childRelease(releases, target) {
  if (typeof target !== 'string' || path.dirname(target) !== releases || target !== path.resolve(target)) {
    throw new Error('Release must be a direct child of the configured releases directory');
  }
  return realDirectory(target);
}

function readJson(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular JSON file: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

// Linux workers can keep executing an older release after current switches.
export function processUsesRelease(release, procRoot = '/proc', { workerUids = null } = {}) {
  if (process.platform !== 'linux') return true; // preserve when worker inspection is unavailable
  for (const entry of fs.readdirSync(procRoot)) {
    if (!/^\d+$/.test(entry)) continue;
    const processRoot = path.join(procRoot, entry);
    if (workerUids) {
      try { if (!workerUids.includes(fs.statSync(processRoot).uid)) continue; }
      catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) continue; return true; }
    }
    try {
      const command = fs.readFileSync(path.join(processRoot, 'cmdline'), 'utf8').split('\0');
      if (command.some(value => value === release || value.startsWith(release + path.sep))) return true;
    } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) return true; }
    for (const link of ['cwd', 'exe']) {
      try {
        const target = fs.readlinkSync(path.join(procRoot, entry, link));
        if (target === release || target.startsWith(release + path.sep)) return true;
      } catch (error) {
        if (['ENOENT', 'ESRCH'].includes(error.code)) continue;
        // Never infer idle runtime workers from unreadable /proc links, including other users.
        return true;
      }
    }
  }
  return false;
}

function workerReferenceChecker(policy) {
  if (!(policy.workerUsers ?? []).length) return release => processUsesRelease(release);
  const workerUids = [process.getuid()];
  for (const user of policy.workerUsers) {
    const read = spawnPortableSync('id', ['-u', user], { encoding: 'utf8', timeout: 5000 }).result;
    if (read.error || read.status !== 0 || !/^\d+$/.test((read.stdout ?? '').trim())) return () => true;
    workerUids.push(Number(read.stdout.trim()));
  }
  return release => processUsesRelease(release, '/proc', { workerUids });
}

export function retentionTarget(deployment) {
  if (deployment?.target?.type !== 'local-release-root') throw new Error('Unsupported deployment target');
  const root = realDirectory(deployment.target.releaseRoot);
  const releases = realDirectory(path.join(root, 'releases'));
  const current = deployment.target.currentLink;
  if (typeof current !== 'string' || !path.isAbsolute(current) ||
      current !== path.resolve(current) || current.startsWith(releases + path.sep)) throw new Error('Unsafe current link');
  realDirectory(path.dirname(current));
  if (!fs.lstatSync(current).isSymbolicLink()) throw new Error('Current must be a symlink');
  return { root, releases, current };
}

export function acquireDeploymentLock(root) {
  const lock = path.join(root, '.executionkit-deployment.lock');
  let fd;
  try {
    fd = fs.openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') {
      try {
        const existing = JSON.parse(fs.readFileSync(lock, 'utf8'));
        const pid = Number(existing?.pid);
        let alive = true;
        if (Number.isInteger(pid) && pid > 0) {
          try { process.kill(pid, 0); } catch (killErr) { if (killErr.code === 'ESRCH') alive = false; }
        }
        if (!alive) {
          fs.unlinkSync(lock);
          fd = fs.openSync(lock, 'wx', 0o600);
        } else {
          throw error;
        }
      } catch {
        throw error;
      }
    } else {
      throw error;
    }
  }
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n'); }
  finally { fs.closeSync(fd); }
  return () => { try { fs.unlinkSync(lock); } catch {} };
}

function legacyReleaseEvidence(deployment, releases, release) {
  const name = path.basename(release);
  if (!/^(?:[a-f0-9]{12}-[a-f0-9]{12}|(?:adopted-)?\d{14}-[a-f0-9]{7,40})$/.test(name)) return 'UNKNOWN_RELEASE_NAME';
  try {
    childRelease(releases, release);
    for (const relative of ['artisan', 'composer.json', 'bootstrap/app.php', 'public/index.php']) {
      const file = path.join(release, relative), stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(file) !== file) return 'UNVERIFIED_LARAVEL_LAYOUT';
    }
    const composerFile = path.join(release, 'composer.json');
    if (fs.statSync(composerFile).size > 1048576 || !JSON.parse(fs.readFileSync(composerFile, 'utf8')).require?.['laravel/framework']) return 'UNVERIFIED_LARAVEL_LAYOUT';
    const sourceRoots = new Set(['app','bootstrap','config','database','public','resources','routes','vendor','node_modules','tests','test','docs','todo','reports','scripts','bin','lang','storage','.git','.github','.agents','.agent','.executionkit','.idea','.vscode']);
    for (const entry of fs.readdirSync(release)) {
      if (!sourceRoots.has(entry) && !/^(?:artisan|\.env|\.env\.example|composer\.(?:json|lock)|package(?:-lock)?\.json|(?:pnpm-lock\.yaml|yarn\.lock)|.*\.md|(?:executionkit.*|execution\.config|quality\.contract)\.json|(?:vite|tailwind|postcss)\.config\.[cm]?[jt]s|phpunit\.xml(?:\.dist)?|\.(?:gitignore|gitattributes|editorconfig))$/.test(entry)) return 'UNVERIFIED_RELEASE_CONTENT';
    }
    for (const relative of ['.env', 'storage']) {
      const configured = (deployment.sharedLinks ?? []).find(item => item.releasePath === relative);
      const file = path.join(release, relative), stat = fs.lstatSync(file);
      if (!configured || !stat.isSymbolicLink() || fs.realpathSync(file) !== fs.realpathSync(configured.target)) return 'UNSHARED_PERSISTENT_STATE';
    }
    for (const relative of ['uploads', 'upload', 'backups', 'backup', 'public/uploads', 'public/upload', 'public/media', 'public/storage']) {
      const file = path.join(release, relative), stat = fs.lstatSync(file, { throwIfNoEntry: false });
      if (stat && !(stat.isSymbolicLink() && (deployment.sharedLinks ?? []).some(item => item.releasePath === relative && fs.realpathSync(file) === fs.realpathSync(item.target)))) return 'UNOWNED_PERSISTENT_TREE';
    }
    return null;
  } catch { return 'UNVERIFIED_LEGACY_RELEASE'; }
}

export function retainSuccessfulReleases(deployment, state, { busy = null, retirementCheck = verifyWorkerRetirement, now = Date.now() } = {}) {
  const policy = deployment.retention ?? { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 0, cleanupLegacyReleases: true };
  validateRetentionPolicy(policy);
  if (policy.enabled === false) return { status: 'DISABLED', removed: [] };
  busy ??= workerReferenceChecker(policy);
  const { root, releases, current } = retentionTarget(deployment);
  if (state?.status !== 'DEPLOYED' || state?.health?.ok !== true || state?.health?.status !== 'PASS') {
    throw new Error('Cleanup requires a successful deployment and health receipt');
  }
  if (!Array.isArray(deployment.smokeCommands) || !deployment.smokeCommands.length ||
      !Array.isArray(state.smoke) || state.smoke.length !== deployment.smokeCommands.length ||
      state.smoke.some(item => item.exitCode !== 0 || item.error)) {
    throw new Error('Cleanup requires every configured smoke command to pass');
  }
  const active = childRelease(releases, state.releaseDir);
  if (fs.realpathSync(current) !== active || state.releaseId !== path.basename(active) ||
      state.target?.releaseRoot !== root || state.target?.currentLink !== current ||
      !Number.isFinite(Date.parse(state.deployedAt))) throw new Error('Deployment receipt does not match current');
  const registryFile = path.join(root, '.executionkit-release-retention.json');
  const registry = readJson(registryFile) ?? { schemaVersion: 'executionkit-release-retention/v1', releases: [] };
  if (registry.schemaVersion !== 'executionkit-release-retention/v1' || !Array.isArray(registry.releases)) {
    throw new Error('Invalid release retention registry');
  }
  const records = new Map();
  for (const record of registry.releases) {
    if (typeof record.releaseId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(record.releaseId) ||
        !Number.isFinite(Date.parse(record.retentionSince ?? record.deployedAt))) throw new Error('Invalid successful release record');
    const release = path.join(releases, record.releaseId);
    if (!fs.lstatSync(release, { throwIfNoEntry: false })) continue; // operator already deleted it
    childRelease(releases, release);
    records.set(release, record);
  }
  records.set(active, { releaseId: state.releaseId, head: state.head, deployedAt: state.deployedAt });
  const legacyRecognized = [], legacyPreserved = [];
  if (policy.cleanupLegacyReleases === true) {
    for (const name of fs.readdirSync(releases)) {
      const release = path.join(releases, name);
      if (records.has(release)) continue;
      const reason = legacyReleaseEvidence(deployment, releases, release);
      if (reason) { legacyPreserved.push({ release, reason }); continue; }
      // Recognition proves a disposable old code layout, not a historical successful deployment.
      records.set(release, { releaseId: name, origin: 'LEGACY_LARAVEL_LAYOUT', retentionSince: new Date(now).toISOString() });
      legacyRecognized.push(release);
    }
  }
  const kept = new Set([active]);
  if (policy.keepRollbacks > 0 && state.previousReleaseDir && fs.lstatSync(state.previousReleaseDir, { throwIfNoEntry: false })) {
    kept.add(childRelease(releases, state.previousReleaseDir));
  }
  const ordered = [...records].sort((a, b) => Date.parse(b[1].retentionSince ?? b[1].deployedAt) - Date.parse(a[1].retentionSince ?? a[1].deployedAt));
  for (const [release] of ordered) { if (kept.size < policy.keepRollbacks + 1) kept.add(release); }
  const candidates = ordered.filter(([release]) => !kept.has(release));
  // Persist verified history before deletion; partial cleanup is safe to retry next deploy.
  writeJson(registryFile, { ...registry, releases: [...records.values()] });
  const removed = [], skipped = [];
  const retirement = policy.keepRollbacks === 0 ? retirementCheck(state.workerRetirementBarrier) : { status: 'NOT_REQUIRED', ok: true };
  try {
    for (const [release] of candidates) {
      if (!retirement.ok) { skipped.push({ release, reason: 'WORKER_RETIREMENT_UNVERIFIED' }); continue; }
      if (now - Date.parse(records.get(release).retentionSince ?? records.get(release).deployedAt) < policy.minimumAgeMinutes * 60000) {
        skipped.push({ release, reason: 'MINIMUM_RELEASE_AGE' }); continue;
      }
      if (busy(release)) { skipped.push({ release, reason: 'WORKER_RUNNING_OR_VISIBILITY_UNPROVEN' }); continue; }
      if (records.get(release).origin === 'LEGACY_LARAVEL_LAYOUT') {
        const reason = legacyReleaseEvidence(deployment, releases, release);
        if (reason) { skipped.push({ release, reason }); continue; }
      }
      for (const name of ['.env', 'storage']) {
        const stat = fs.lstatSync(path.join(release, name), { throwIfNoEntry: false });
        if (stat && !stat.isSymbolicLink()) throw new Error(`Refusing cleanup of real persistent ${name}: ${release}`);
      }
      // Persistent state must be shared links, never real .env/storage inside a deleted release.
      for (const item of deployment.sharedLinks ?? []) {
        const relative = item.releasePath;
        if (typeof relative !== 'string' || path.isAbsolute(relative) ||
            relative.split(/[\\/]/).some(part => part === '..' || part === '.')) {
          throw new Error('Unsafe shared link configuration');
        }
        const link = path.join(release, relative);
        const shared = fs.realpathSync(item.target);
        if (shared === releases || shared.startsWith(releases + path.sep)) throw new Error('Shared state may not live inside releases');
        const stat = fs.lstatSync(link, { throwIfNoEntry: false });
        if (!stat) continue; // A missing path holds no data; older releases may predate new shared links.
        if (!stat?.isSymbolicLink() || fs.realpathSync(link) !== shared) {
          throw new Error(`Refusing cleanup of unshared persistent state: ${link}`);
        }
      }
      if (fs.realpathSync(current) !== active) throw new Error('Current changed during cleanup');
      childRelease(releases, release);
      fs.rmSync(release, { recursive: true });
      records.delete(release);
      removed.push(release);
    }
    const unknown = fs.readdirSync(releases).filter(name => !records.has(path.join(releases, name)));
    const currentOnlySatisfied = policy.keepRollbacks === 0 && records.size === 1 && unknown.length === 0;
    const result = { status: skipped.length || policy.keepRollbacks === 0 && !currentOnlySatisfied ? 'DEFERRED' : 'PASS', policy, retirement, currentOnlySatisfied, removed, skipped,
      kept: [...kept], legacyRecognized, legacyPreserved, untrackedPreserved: unknown, completedAt: new Date().toISOString() };
    writeJson(registryFile, { ...registry, releases: [...records.values()], lastCleanup: result });
    return result;
  } catch (error) {
    error.retentionResult = { removed, skipped, kept: [...kept] };
    throw error;
  }
}

export function validateRetentionPolicy(policy) {
  if (typeof policy?.enabled !== 'boolean' || !Number.isInteger(policy.keepRollbacks) ||
      policy.keepRollbacks < 0 || policy.keepRollbacks > 100 ||
      (policy.artifactKeepRollbacks !== undefined && (!Number.isInteger(policy.artifactKeepRollbacks) || policy.artifactKeepRollbacks < 0 || policy.artifactKeepRollbacks > 100)) ||
      (policy.cleanupLegacyReleases !== undefined && typeof policy.cleanupLegacyReleases !== 'boolean') ||
      (policy.workerUsers !== undefined && (!Array.isArray(policy.workerUsers) || policy.workerUsers.some(user => typeof user !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]*\$?$/.test(user)))) ||
      !Number.isInteger(policy.minimumAgeMinutes) || policy.minimumAgeMinutes < 0 || policy.minimumAgeMinutes > 525600) {
    throw new Error('Invalid deployment.retention: enabled boolean, keepRollbacks 0..100, optional cleanupLegacyReleases boolean, minimumAgeMinutes 0..525600 required');
  }
}
