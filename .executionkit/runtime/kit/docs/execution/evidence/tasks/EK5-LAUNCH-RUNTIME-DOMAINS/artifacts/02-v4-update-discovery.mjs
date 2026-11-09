import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { V4_CANONICAL_REPOSITORY, V4_CANONICAL_REF, acquireOfficialV4SourceCommit, verifyV4SourceSnapshot } from './v4-source.mjs';
import { resolveExecutionRuntime } from './v4-platform.mjs';
import {resolveDerivedPath,resolveProjectPathSafe} from './derived-state.mjs';

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
    ttlSeconds: Number.isFinite(custom.ttlSeconds) && custom.ttlSeconds >= 0 ? custom.ttlSeconds : DEFAULT_UPDATE_POLICY.ttlSeconds,
    timeoutMs: Number.isFinite(custom.timeoutMs) && custom.timeoutMs >= 100 && custom.timeoutMs<=60000 ? custom.timeoutMs : DEFAULT_UPDATE_POLICY.timeoutMs,
    offlineRetryIntervalSeconds: Number.isFinite(custom.offlineRetryIntervalSeconds) && custom.offlineRetryIntervalSeconds >= 0 ? custom.offlineRetryIntervalSeconds : DEFAULT_UPDATE_POLICY.offlineRetryIntervalSeconds,
    autoApply: custom.autoApply === true,
    failOpenOffline: custom.failOpenOffline !== false,
    refuseDirtyWorktree: custom.refuseDirtyWorktree !== false,
    requireIncomingUpdater: custom.requireIncomingUpdater !== false,
  };
}

export function readInstalledReceipt(root) {
  const receiptFile = resolveProjectPathSafe(root,INSTALL_RECEIPT_REL,'installed update receipt',{file:true});
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
  const statusFile = resolveProjectPathSafe(root,UPDATE_STATUS_REL,'update discovery cache',{file:true});
  if (!fs.existsSync(statusFile)) return null;
  if(fs.statSync(statusFile).size>65536)return null;
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWriteJson(file, data, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    const fd=fs.openSync(tmp,'wx',mode);
    try{fs.writeFileSync(fd,Buffer.from(JSON.stringify(data,null,2)+'\n'));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,file);
  }finally{fs.rmSync(tmp,{force:true});}
}

export function writeCachedUpdateStatus(root, data) {
  const statusFile = resolveDerivedPath(root,UPDATE_STATUS_REL,'update discovery cache',{file:true,createParents:true});
  atomicWriteJson(statusFile, data, 0o644);
}

export function isCacheFresh(cached, { ttlSeconds = 3600, offlineRetryIntervalSeconds = 1800, now = Date.now() } = {}) {
  if (!cached || !cached.checkedAt) return false;
  const checkedAtMs = new Date(cached.checkedAt).getTime();
  if (!Number.isFinite(checkedAtMs)||checkedAtMs>now+300000) return false;

  if (cached.status === 'OFFLINE_OR_UNKNOWN') {
    if (cached.retryAfter) {
      const retryAfterMs = new Date(cached.retryAfter).getTime();
      if (Number.isFinite(retryAfterMs)) return now < Math.min(retryAfterMs,checkedAtMs+offlineRetryIntervalSeconds*1000);
    }
    return now < checkedAtMs + (offlineRetryIntervalSeconds * 1000);
  }

  const effectiveTtl = Number.isFinite(cached.ttlSeconds)&&cached.ttlSeconds>=0 ? Math.min(cached.ttlSeconds,ttlSeconds) : ttlSeconds;
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
  const probe = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', timeout:10000, windowsHide:true });
  if(probe.error||probe.status!==0){
    if(!probe.error&&/not a git repository/i.test(String(probe.stderr)))return { isGit:false, clean:true, uncommitted:[] };
    return {isGit:null,clean:false,uncommitted:[],error:'V4_WORKTREE_INSPECTION_FAILED'};
  }

  const args = ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':(exclude).executionkit/source/AI-ExecutionKit', ':(exclude).executionkit/source/AI-ExecutionKit/**'];
  const status = spawnSync('git', args, { encoding: 'utf8', timeout:10000, windowsHide:true });
  if(status.error||status.status!==0)return {isGit:true,clean:false,uncommitted:[],error:'V4_WORKTREE_INSPECTION_FAILED'};
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
  let lockFile;
  try{lockFile=resolveDerivedPath(root,SELF_UPDATE_LOCK_REL,'self-update lock',{file:true,createParents:true});}
  catch(error){return {acquired:false,code:'V4_SELF_UPDATE_PATH_UNSAFE',error:error.message};}
  for(let attempt=0;attempt<2;attempt++){
  try {
    const fd = fs.openSync(lockFile, 'wx', 0o600);
    const lockData = { pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString(),ownerId:crypto.randomUUID() };
    try{fs.writeFileSync(fd,JSON.stringify(lockData)+'\n');}finally{fs.closeSync(fd);}
    return { acquired: true, lockFile,ownerId:lockData.ownerId };
  } catch (err) {
    if(err.code!=='EEXIST')return {acquired:false,error:err.message};
    try{
      const before=fs.lstatSync(lockFile);
      if(!before.isFile()||before.size>4096)return {acquired:false};
      let existing;try{existing=JSON.parse(fs.readFileSync(lockFile,'utf8'));}catch{}
      let abandoned=false;
      if(Number.isSafeInteger(existing?.pid)&&existing.pid>0&&(!existing.host||existing.host===os.hostname())){
        try{process.kill(existing.pid,0);}catch(error){abandoned=error.code==='ESRCH';}
      }else if(before.size===0&&Date.now()-before.mtimeMs>60000)abandoned=true;
      if(!abandoned)return {acquired:false,lock:existing??null};
      const current=fs.lstatSync(lockFile);
      if(current.dev!==before.dev||current.ino!==before.ino)return {acquired:false};
      fs.unlinkSync(lockFile);
    }catch(error){if(error.code!=='ENOENT')return {acquired:false,error:error.message};}
  }
  }
  return {acquired:false};
}

function releaseUpdateLock(root,ownerId) {
  try {
    const lockFile=resolveDerivedPath(root,SELF_UPDATE_LOCK_REL,'self-update lock',{file:true});
    if(JSON.parse(fs.readFileSync(lockFile,'utf8')).ownerId===ownerId)fs.unlinkSync(lockFile);
  } catch {}
}

export async function applyV4SelfUpdate(root, { force = false, allowDirty = false, dryRun = false, config, explicitSource = null, provisionPortable = null } = {}) {
  root = path.resolve(root);
  const policy = resolveUpdatePolicy(config);

  {
    const cleanliness = checkWorktreeCleanliness(root, { allowDirty });
    if (cleanliness.error||policy.refuseDirtyWorktree&&!cleanliness.clean) {
      return {
        schemaVersion: 'executionkit-v4-self-update/v1',
        status: 'BLOCKED',
        code: cleanliness.error??'V4_DIRTY_WORKTREE_REFUSAL',
        message: cleanliness.error?'Git could not verify project worktree safety; self-update is blocked.':'Project worktree has uncommitted changes. Commit or stash your changes before self-update, or pass --allow-dirty.',
        uncommitted: cleanliness.uncommitted
      };
    }
  }

  const lockRes = acquireUpdateLock(root);
  if (!lockRes.acquired) {
    return {
      schemaVersion: 'executionkit-v4-self-update/v1',
      status: 'BLOCKED',
      code: lockRes.code??'V4_CONCURRENT_UPDATE_BLOCKED',
      message: lockRes.code?lockRes.error:'Another self-update process is currently active on this project',
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
        const probe = spawnSync('git', ['-C', targetSnapshot, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout:10000, windowsHide:true });
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
      const portableReady=process.platform!=='linux'||(
        resolveExecutionRuntime(root).type==='STANDALONE_BINARY'
        && fs.existsSync(path.join(root,'AGENTS.md'))
        && fs.readFileSync(path.join(root,'AGENTS.md'),'utf8').includes('./.executionkit/bin/executionkit start . --host antigravity')
      );
      if (discovery.status === 'CURRENT' && !force && portableReady) {
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
    const op = (inspection?.configVersion && /^[45]\./.test(inspection.configVersion)) ? 'update' : 'auto';

    const incomingVersionFile = path.join(targetSnapshot, 'VERSION');
    const incomingVersion = fs.existsSync(incomingVersionFile) ? fs.readFileSync(incomingVersionFile, 'utf8').trim() : '5.0.1';
    const resolvedTargetVersion = inspection?.configVersion?.startsWith('5.')?(incomingVersion.startsWith('5.')?incomingVersion:'5.0.1'):'4.1.0';
    const plan = incomingInstaller.planV4Installation(root, {
      source: targetSnapshot,
      sourceCommit: targetCommit,
      operation: op,
      targetVersion: resolvedTargetVersion
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

    let applyResult = incomingInstaller.applyV4Installation(plan, { allowDirty });
    let portable = null;
    if(process.platform==='linux'&&/^[a-f0-9]{40}$/.test(targetCommit)){
      try{
        const portableModule=provisionPortable?null:await import(pathToFileURL(path.join(targetSnapshot,'lib/v4-portable-install.mjs')).href);
        portable=await (provisionPortable??portableModule.provisionV4PortableBinary)(root,{source:targetSnapshot});
        const portablePlan=incomingInstaller.planV4Installation(root,{source:targetSnapshot,sourceCommit:targetCommit,operation:'update',targetVersion:resolvedTargetVersion});
        if(portablePlan.conflicts.length)throw new Error('Portable CLI activation conflict: '+JSON.stringify(portablePlan.conflicts));
        applyResult=incomingInstaller.applyV4Installation(portablePlan,{allowDirty:true});
      }catch(error){
        let rollback=null;
        if(applyResult.transaction){
          try{rollback=incomingInstaller.rollbackV4Installation(root,applyResult.transaction);}
          catch(rollbackError){rollback={status:'FAILED',error:rollbackError.message};}
        }
        return {schemaVersion:'executionkit-v4-self-update/v1',status:'BLOCKED',code:'V4_PORTABLE_ACTIVATION_FAILED',message:error.message,previousCommit,currentCommit:readInstalledSourceCommit(root),rollback,nextCommand:'executionkit self-update apply .'};
      }
    }
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
      portable,
      appliedAt: new Date().toISOString(),
      doctor: { status: doctor.status, errors: doctor.errors },
      upgradeRevalidation: revalResult
    };
  } finally {
    releaseUpdateLock(root,lockRes.ownerId);
  }
}
