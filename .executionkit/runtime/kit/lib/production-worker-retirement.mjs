import fs from 'node:fs';
import path from 'node:path';
import { spawnPortableSync } from './portable-process.mjs';

// Cwd/argv cannot see PHP paths held in memory. For zero-grace cleanup, all
// declared application runtimes predating the pointer switch must retire.
export function captureWorkerRetirementBarrier(policy, { procRoot = '/proc', tickRate = null } = {}) {
  if (policy.keepRollbacks > 0) return { status: 'NOT_REQUIRED' };
  if (process.platform !== 'linux' || !(policy.workerUsers ?? []).length) return { status: 'UNVERIFIED', reason: 'DECLARE_OBSERVED_RUNTIME_WORKER_USERS' };
  try {
    const workerUids = [];
    for (const user of policy.workerUsers) {
      const read = spawnPortableSync('id', ['-u', user], { encoding: 'utf8', timeout: 5000 }).result;
      if (read.error || read.status !== 0 || !/^\d+$/.test((read.stdout ?? '').trim())) return { status: 'UNVERIFIED', reason: 'RUNTIME_WORKER_USER_UNRESOLVED' };
      workerUids.push(Number(read.stdout.trim()));
    }
    if (tickRate === null) {
      const read = spawnPortableSync('getconf', ['CLK_TCK'], { encoding: 'utf8', timeout: 5000 }).result;
      if (read.error || read.status !== 0) throw new Error('Clock unavailable');
      tickRate = Number(read.stdout.trim());
    }
    const uptimeText = fs.readFileSync(path.join(procRoot, 'uptime'), 'utf8').split(' ')[0];
    const uptime = Number(uptimeText), precision = uptimeText.split('.')[1]?.length ?? 0;
    if (!Number.isInteger(tickRate) || tickRate <= 0 || !Number.isFinite(uptime) || uptime < 0) throw new Error('Clock invalid');
    // /proc/uptime truncates decimal precision; round its uncertainty upward too.
    return { status: 'PASS', workerUsers: [...policy.workerUsers], workerUids, barrierTicks: Math.ceil((uptime + 10 ** -precision) * tickRate) };
  } catch { return { status: 'UNVERIFIED', reason: 'RUNTIME_RETIREMENT_CLOCK_UNAVAILABLE' }; }
}

export function verifyWorkerRetirement(barrier, { procRoot = '/proc' } = {}) {
  if (barrier?.status !== 'PASS' || !Array.isArray(barrier.workerUids) || !barrier.workerUids.length || barrier.workerUids.some(uid=>!Number.isSafeInteger(uid)||uid<0) || !Number.isSafeInteger(barrier.barrierTicks) || barrier.barrierTicks<0) return { status: 'UNVERIFIED', ok: false, reason: 'RUNTIME_RETIREMENT_BARRIER_MISSING' };
  try {
    for (const pid of fs.readdirSync(procRoot)) {
      if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
      const folder = path.join(procRoot, pid);
      try {
        if (!barrier.workerUids.includes(fs.statSync(folder).uid)) continue;
        const command = fs.readFileSync(path.join(folder, 'cmdline'), 'utf8').split('\0');
        const stat = fs.readFileSync(path.join(folder, 'stat'), 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/);
        if (fields[0] === 'Z') continue;
        const runtime = /^(?:php(?:[-.:\d]|$)|node(?:js)?$|bun$|deno$|httpd$|apache2?$|rr$|roadrunner$)/.test(path.basename(command[0] ?? '')) || command.some(value => /(?:^|\/)artisan$/.test(value));
        if (!runtime) continue;
        const started = Number(fields[19]);
        if (!Number.isSafeInteger(started)) throw new Error('Worker start time unavailable');
        if (started <= barrier.barrierTicks) return { status: 'DEFERRED', ok: false, reason: 'PREACTIVATION_RUNTIME_WORKER_PRESENT', pid: Number(pid) };
      } catch (error) {
        if (['ENOENT', 'ESRCH'].includes(error.code)) continue;
        return { status: 'UNVERIFIED', ok: false, reason: 'RUNTIME_WORKER_VISIBILITY_UNPROVEN', pid: Number(pid) };
      }
    }
    return { status: 'PASS', ok: true };
  } catch { return { status: 'UNVERIFIED', ok: false, reason: 'RUNTIME_WORKER_VISIBILITY_UNPROVEN' }; }
}
