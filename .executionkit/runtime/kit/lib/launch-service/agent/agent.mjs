// GemiTron Local Build Agent — standalone, outbound-only, cross-platform (Linux/Windows/macOS).
// It runs independently of Antigravity. It never accepts commands over HTTP: the server can only hand it a
// typed job {id, commit, kind} for a project mapped locally to a trusted repository; the agent then runs the
// fixed runner (scripts/runner.py) under the native resource supervisor (scripts/supervisor.py).
import {readFile, writeFile, appendFile, mkdir, rename, stat, statfs, readdir, rm} from 'node:fs/promises';
import {createReadStream, existsSync} from 'node:fs';
import {join, resolve, dirname, delimiter, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, execFile} from 'node:child_process';
import {randomUUID, createHash, createHmac} from 'node:crypto';
import {canonical} from '../src/contracts.mjs';
import os from 'node:os';

export const AGENT_VERSION = '1.0.0';
export const SCHEMA = 'gemitron-build-agent/v1';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const IS_WINDOWS = process.platform === 'win32';
const KINDS = ['verify', 'apk', 'debug_apk', 'aab'];
const FATAL_LEASE = new Set(['LEASE_LOST', 'LEASE_FENCED', 'JOB_CANCELLED', 'AGENT_NOT_ENROLLED', 'FORBIDDEN']);
// Network profiles. "metered" is for quota-limited links (e.g. a Windows workstation on a capped connection):
// presence rides on the claim request, idle polling is rare, lease renewals are sparse, backoff ceiling is high.
const PROFILES = {
  standard: {idle_poll_seconds: 30, lease_renew_seconds: 60, max_backoff_seconds: 120},
  metered: {idle_poll_seconds: 300, lease_renew_seconds: 120, max_backoff_seconds: 900},
};

export class AgentError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
const need = (ok, code, status) => { if (!ok) throw new AgentError(code, status); };
const slug = v => typeof v === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v);

export async function loadAgentConfig(path, {exists = existsSync} = {}) {
  const cfg = JSON.parse(await readFile(path, 'utf8'));
  if(process.platform==='linux'&&['/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp'].some(exists))throw new AgentError('PRODUCTION_CWP_BUILDER_FORBIDDEN');
  need(cfg && cfg.schema === SCHEMA && slug(cfg.worker_id), 'AGENT_CONFIG_INVALID');
  const url = new URL(cfg.service_url);
  const loopback = url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname) && cfg.allow_loopback_http === true;
  need((url.protocol === 'https:' || loopback) && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash, 'AGENT_HTTPS_ORIGIN_REQUIRED');
  cfg.service_url = url.origin;
  need(['standard', 'metered', undefined].includes(cfg.network_profile), 'AGENT_NETWORK_PROFILE_INVALID');
  const profile = PROFILES[cfg.network_profile ?? 'standard'];
  for (const [k, def] of Object.entries(profile)) {
    cfg[k] = cfg[k] ?? def;
    need(Number.isSafeInteger(cfg[k]) && cfg[k] >= 5 && cfg[k] <= 3600, 'AGENT_TIMING_INVALID');
  }
  // Renewals must comfortably beat the server's 300s lease.
  need(cfg.lease_renew_seconds <= 150, 'AGENT_LEASE_RENEW_TOO_SLOW');
  for (const k of ['credentials_file', 'state_dir', 'work_root', 'evidence_root']) { need(typeof cfg[k] === 'string' && cfg[k].length, 'AGENT_CONFIG_INVALID'); cfg[k] = resolve(dirname(path), cfg[k]); }
  cfg.limits = {cpu_cores: 2, memory_mb: 6144, max_processes: 512, min_free_disk_gb: 8, min_free_memory_mb: 1024, step_timeout_minutes: 30, max_load_per_cpu: 1.5, max_scratch_bytes: 16*1024**3,max_cache_bytes:8*1024**3, ...(cfg.limits ?? {})};
  for (const [k, v] of Object.entries(cfg.limits)) need(typeof v === 'number' && v > 0 && Number.isFinite(v), 'AGENT_LIMIT_INVALID');
  need(cfg.projects && typeof cfg.projects === 'object' && Object.keys(cfg.projects).length >= 1, 'AGENT_PROJECTS_REQUIRED');
  for (const [id, m] of Object.entries(cfg.projects)) {
    need(slug(id) && typeof m.repository === 'string' && typeof m.runner_config === 'string', 'AGENT_PROJECT_MAPPING_INVALID');
    m.repository = resolve(dirname(path), m.repository); m.runner_config = resolve(dirname(path), m.runner_config);
    if (m.signing_approval_dir) m.signing_approval_dir = resolve(dirname(path), m.signing_approval_dir);
  }
  // Pinned toolchains (e.g. an isolated Flutter SDK) are prepended to PATH for the runner only.
  need(cfg.path_prepend === undefined || (Array.isArray(cfg.path_prepend) && cfg.path_prepend.length <= 8 && cfg.path_prepend.every(p => typeof p === 'string' && isAbsolute(p) && !p.includes(delimiter))), 'AGENT_PATH_PREPEND_INVALID');
  need(cfg.python === undefined || (typeof cfg.python === 'string' && isAbsolute(cfg.python)), 'AGENT_PYTHON_INVALID');
  need(cfg.allow_soft_limits===undefined||typeof cfg.allow_soft_limits==='boolean','AGENT_ENFORCEMENT_POLICY_INVALID');
  need(cfg.principal_id===undefined||(typeof cfg.principal_id==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(cfg.principal_id)),'AGENT_PRINCIPAL_ID_INVALID');
  cfg.python = cfg.python ?? (IS_WINDOWS ? 'python' : 'python3');
  cfg.config_path = resolve(path);
  return cfg;
}

export async function loadCredentials(file) {
  if (!IS_WINDOWS) {
    // Credentials must be private to the agent account (Windows relies on the per-user profile ACL).
    need(((await stat(file)).mode & 0o077) === 0, 'AGENT_CREDENTIALS_PERMISSIONS');
  }
  const c = JSON.parse(await readFile(file, 'utf8'));
  need(typeof c.token === 'string' && c.token.length >= 24 && typeof c.runner_key === 'string' && c.runner_key.length >= 32, 'AGENT_CREDENTIALS_INVALID');
  need(c.approval_key === undefined || (typeof c.approval_key === 'string' && c.approval_key.length >= 32), 'AGENT_CREDENTIALS_INVALID');
  return c;
}

function execText(cmd, args, options = {}) {
  return new Promise(done => execFile(cmd, args, {timeout: 60000, windowsHide: true, maxBuffer: 4 << 20, ...options}, (error, stdout) => done(error ? null : String(stdout).trim())));
}
async function flutterVersion(prepend = []) {
  const env = {...process.env, PATH: [...prepend, process.env.PATH].join(delimiter)};
  const out = (IS_WINDOWS ? await execText(process.env.COMSPEC ?? 'cmd.exe', ['/d', '/c', 'flutter', '--version', '--machine'], {env}) : await execText('flutter', ['--version', '--machine'], {env})) ?? '';
  try { const v = JSON.parse(out.slice(out.indexOf('{'))); return {flutter: v.frameworkVersion, dart: v.dartSdkVersion}; } catch { return {}; }
}

export function createAgent({config, credentials, fetchImpl = fetch, runRunner = null, sleep = ms => new Promise(r => setTimeout(r, ms)), log = null, now = Date.now}) {
  const state = {directive: 'ACTIVE', stoppedByDirective: false, stopping: false, child: null, backoff: 0, capabilities: null, toolchain: null, enforcement: null, credentials, credMtime: 0, jobsRun: 0};
  const secrets = () => [state.credentials.token, state.credentials.runner_key, state.credentials.approval_key].filter(Boolean);
  const write = log ?? (entry => {
    let line = JSON.stringify({ts: new Date().toISOString(), worker: config.worker_id, ...entry});
    for (const s of secrets()) line = line.split(s).join('[REDACTED]');
    process.stdout.write(line + '\n');
    appendFile(join(config.state_dir, 'agent.log'), line + '\n').catch(() => {});
  });

  async function rotateLogs() {
    const file = join(config.state_dir, 'agent.log');
    try { if ((await stat(file)).size > 5 * 1024 * 1024) await rename(file, file + '.1'); } catch {}
  }
  async function saveState(patch) {
    const file = join(config.state_dir, 'state.json');
    let cur = {}; try { cur = JSON.parse(await readFile(file, 'utf8')); } catch {}
    const next = {...cur, ...patch, updated_at: new Date().toISOString()};
    await writeFile(file + '.tmp', JSON.stringify(next, null, 2)); await rename(file + '.tmp', file);
    return next;
  }
  async function readState() { try { return JSON.parse(await readFile(join(config.state_dir, 'state.json'), 'utf8')); } catch { return {}; } }

  async function api(method, route, body, key) {
    const headers = {Authorization: 'Bearer ' + state.credentials.token, Accept: 'application/json'};
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; if (key) headers['Idempotency-Key'] = key; }
    let response;
    try {
      response = await fetchImpl(config.service_url + route, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000)});
    } catch { throw new AgentError('CONTROL_PLANE_UNREACHABLE', 0); }
    let data = null; try { data = await response.json(); } catch {}
    if (!response.ok) throw new AgentError(data?.error?.code ?? 'HTTP_' + response.status, response.status);
    return data;
  }
  // Retries the SAME idempotency key so a lost response never duplicates a server-side effect.
  async function durable(method, route, body, key, attempts = 5) {
    for (let i = 0; ; i++) {
      try { return await api(method, route, body, key); }
      catch (e) {
        if (e.code !== 'CONTROL_PLANE_UNREACHABLE' && !(e.status >= 500) || i + 1 >= attempts || state.stopping) throw e;
        await sleep(Math.min(config.max_backoff_seconds, 5 * 2 ** i) * 1000);
      }
    }
  }

  async function resources() {
    const cpu = os.cpus().length, load = os.loadavg()[0];
    let disk = null; try { await mkdir(config.work_root, {recursive: true}); const s = await statfs(config.work_root); disk = Number(s.bavail) * Number(s.bsize); } catch {}
    const L = config.limits;
    let pressure = 'OK';
    if (!IS_WINDOWS && load / cpu > L.max_load_per_cpu) pressure = 'HIGH';
    if ((disk !== null && disk < L.min_free_disk_gb * 1024 ** 3) || os.freemem() < L.min_free_memory_mb * 1024 * 1024) pressure = 'CRITICAL';
    return {cpu_count: cpu, memory_free_bytes: os.freemem(), memory_total_bytes: os.totalmem(), ...(disk !== null ? {disk_free_bytes: disk} : {}),
      load_average: Math.round(load * 100) / 100, enforcement: state.enforcement ?? 'none', pressure};
  }
  async function presence(activity) {
    const r = await resources();
    return {activity: r.pressure === 'CRITICAL' ? 'DRAINING' : activity, agent_version: AGENT_VERSION,
      os_release: `${process.platform} ${os.release()} ${process.arch}`.slice(0, 120), toolchain: {...state.toolchain, node: process.version},
      resources: r, contact_interval_seconds: Math.max(config.idle_poll_seconds, config.lease_renew_seconds)};
  }

  async function probe() {
    const caps = await api('GET', '/v1/capabilities');
    need(caps?.api_version === 'v1' && caps.arbitrary_shell === false && caps.production_requires_independent_approval === true, 'SERVICE_INCOMPATIBLE');
    need(caps.agent_enrollment_enforced === true, 'SERVICE_ENROLLMENT_NOT_ENFORCED');
    need(Array.isArray(caps.capabilities) && ['agents.presence', 'jobs.lease.fenced'].every(c => caps.capabilities.includes(c)), 'SERVICE_AGENT_PROTOCOL_MISSING');
    state.capabilities = caps;
    return caps;
  }

  async function reloadCredentialsIfRotated() {
    try {
      const m = (await stat(config.credentials_file)).mtimeMs;
      if (state.credMtime && m !== state.credMtime) { state.credentials = await loadCredentials(config.credentials_file); write({event: 'CREDENTIALS_RELOADED'}); }
      state.credMtime = m;
    } catch (e) { write({event: 'CREDENTIALS_RELOAD_FAILED', code: e.code ?? 'UNKNOWN'}); }
  }

  async function git(repo, args, timeout = 60000) { return execText('git', ['-C', repo, ...args], {timeout}); }
  async function ensureCommit(repo, sha) {
    if ((await git(repo, ['rev-parse', '--verify', '--quiet', sha + '^{commit}'])) === sha) return true;
    // Fetch only when the exact commit is missing locally (bandwidth-conscious on metered links).
    await git(repo, ['fetch', '--no-tags', '--quiet', 'origin', sha], 600000);
    return (await git(repo, ['rev-parse', '--verify', '--quiet', sha + '^{commit}'])) === sha;
  }

  function defaultRunRunner(args, env) {
    return new Promise((done, reject) => {
      const python = config.python;
      let stderr = '';
      const child = spawn(python, [join(ROOT, 'scripts', 'runner.py'), ...args], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
      state.child = child;
      child.stdout.on('data', d => write({event: 'RUNNER_STDOUT', text: String(d).slice(0, 2000)}));
      child.stderr.on('data', d => { stderr = (stderr + d).slice(-8000); });
      child.on('error', reject);
      child.on('close', code => { state.child = null; done({code, stderr}); });
    });
  }
  const runner = runRunner ?? defaultRunRunner;
  function killRunner() {
    // POSIX: SIGTERM makes runner.py unwind (worktree removal + process-group kill via supervisor).
    // Windows: terminating runner.py closes its Job Object handle; KILL_ON_JOB_CLOSE reaps the build tree.
    if (state.child) try { state.child.kill(IS_WINDOWS ? undefined : 'SIGTERM'); } catch {}
  }
  function failureReason(stderr) {
    const m = [...String(stderr).matchAll(/(?:ValueError|AgentError): ([A-Za-z][A-Za-z0-9_:]{2,80})/g)].pop();
    const reason = (m ? m[1] : 'RUNNER_FAILED').toUpperCase().replace(/[^A-Z0-9_:]/g, '_');
    return /^[A-Z][A-Z0-9_:]{2,80}$/.test(reason) ? reason : 'RUNNER_FAILED';
  }

  async function execute(project, mapping, claim) {
    const job = claim.job, generation = claim.lease_generation;
    need(Number.isSafeInteger(generation) && generation > 0, 'ENROLLED_LEASE_REQUIRED');
    const base = `/v1/projects/${project}/jobs/${job.id}`;
    const update = (s, extra = {}, key = `upd:${job.id}:${generation}:${s}:${randomUUID().slice(0, 8)}`) =>
      durable('POST', base, {worker_id: config.worker_id, state: s, lease_generation: generation, ...extra}, key);
    await saveState({current: {project, job_id: job.id, kind: job.kind, commit: job.commit, generation, started_at: new Date().toISOString()}});
    write({event: 'JOB_CLAIMED', project, job_id: job.id, kind: job.kind, commit: job.commit, generation, recovered: claim.recovered === true});
    let abort = null, lastRenew = now();
    const renew = setInterval(async () => {
      try { await api('POST', base, {worker_id: config.worker_id, state: 'RUNNING', lease_generation: generation}, `renew:${job.id}:${generation}:${randomUUID().slice(0, 12)}`); lastRenew = now(); }
      catch (e) {
        if (FATAL_LEASE.has(e.code) || e.status === 401 || e.status === 403) { abort = e.code; write({event: 'LEASE_ABORT', job_id: job.id, code: e.code}); killRunner(); }
        else if (now() - lastRenew > 240000) { abort = 'LEASE_RENEWAL_TIMEOUT'; killRunner(); } // stop before the 300s lease can be re-granted
      }
    }, config.lease_renew_seconds * 1000);
    renew.unref?.();
    const evidence = join(config.evidence_root, project, job.id, String(generation));
    try {
      need(KINDS.includes(job.kind), 'JOB_KIND_UNSUPPORTED');
      need(/^[a-f0-9]{40}$/.test(job.commit), 'INVALID_SOURCE_COMMIT');
      need(await ensureCommit(mapping.repository, job.commit), 'INVALID_SOURCE_COMMIT');
      const r = await resources(); need(r.pressure !== 'CRITICAL', 'HOST_RESOURCE_PRESSURE');
      await mkdir(evidence, {recursive: true, mode: 0o700});
      const L = config.limits;
      const args = ['--project', mapping.runner_config, '--repository', mapping.repository, '--commit', job.commit, '--job-id', job.id,
        '--lease-generation', String(generation), '--evidence', evidence, '--work-root', config.work_root, '--max-scratch-bytes',String(config.limits.max_scratch_bytes),'--max-cache-bytes',String(config.limits.max_cache_bytes),'--report-enforcement',...(config.allow_soft_limits===true?[]:['--require-hard-limits']),
        '--cpu-cores', String(L.cpu_cores), '--memory-mb', String(L.memory_mb), '--max-processes', String(L.max_processes),
        '--min-free-disk-gb', String(L.min_free_disk_gb), '--step-timeout-minutes', String(L.step_timeout_minutes)];
      const env = {PATH: [...(config.path_prepend ?? []), process.env.PATH].join(delimiter), HOME: process.env.HOME ?? os.homedir(), MOBILE_RELEASE_RUNNER_ID: config.worker_id,
        MOBILE_RELEASE_RUNNER_KEY: state.credentials.runner_key, GEMITRON_AGENT_JOB_MARKER: `agent-${config.worker_id}-${job.id.slice(0, 8)}`};
      for (const k of ['JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'FLUTTER_ROOT', 'LANG', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY',
        'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'NUMBER_OF_PROCESSORS']) if (process.env[k]) env[k] = process.env[k];
      if(config.android_tools)env.MOBILE_ANDROID_TOOLS=JSON.stringify(config.android_tools);
      if (job.kind === 'debug_apk') args.push('--debug-apk');
      if (['apk','aab'].includes(job.kind)) {
        // Release signing needs an independent, commit-scoped signed approval; it is never sent for verify/debug work.
        need(mapping.signing_approval_dir && state.credentials.approval_key, 'SIGNING_APPROVAL_REQUIRED');
        args.push(job.kind==='aab'?'--aab':'--apk', '--signing-approval', join(mapping.signing_approval_dir, `${job.commit}.json`));
        env.MOBILE_RELEASE_APPROVAL_KEY = state.credentials.approval_key;
        for (const name of mapping.signing_env ?? []) if (/^[A-Z][A-Z0-9_]+$/.test(name) && process.env[name]) env[name] = process.env[name];
      }
      const started = now();
      const result = await runner(args, env);
      if (abort) throw new AgentError(abort);
      if (result.code !== 0) write({event: 'RUNNER_STDERR', job_id: job.id, tail: String(result.stderr).slice(-1500)});
      need(result.code === 0, failureReason(result.stderr));
      const receipt = JSON.parse(await readFile(join(evidence, 'receipt.json'), 'utf8'));
      need(receipt.payload.job_id === job.id && receipt.payload.lease_generation === generation && receipt.payload.commit === job.commit, 'RECEIPT_SCOPE_MISMATCH');
      if (['apk','aab'].includes(job.kind)) {
        const digest = receipt.payload.artifact_sha256;
        // Native inspection ran on this workstation (runner -> apk-inspection.json). Sign it with the scoped runner
        // key so the server can accept metadata without ever running Android SDK tools itself.
        const meta = JSON.parse(await readFile(join(evidence, 'apk-inspection.json'), 'utf8'));
        const artifactPath = join(evidence, `${digest}.${job.kind==='aab'?'aab':'apk'}`);
        const size = (await stat(artifactPath)).size;
        need(meta.sha256 === digest && meta.size === size && meta.verification === 'VERIFIED' && (meta.format ?? 'apk') === job.kind && meta.debug_signed !== true, 'LOCAL_INSPECTION_MISMATCH');
        need(typeof config.principal_id === 'string' && config.principal_id.length > 0, 'AGENT_PRINCIPAL_ID_REQUIRED');
        const payload = {type: 'workstation.artifact_inspection.v1', id: randomUUID(), project, worker_id: config.worker_id, principal_id: config.principal_id,
          job_id: job.id, lease_generation: generation, commit: job.commit, artifact_sha256: digest, size, format: job.kind,
          package_id: meta.package_id, version_code: meta.version_code, version: String(meta.version), minimum_android_sdk: meta.minimum_android_sdk,
          signing_sha256: meta.signing_sha256, debug_signed: false, verifier: String(meta.verifier ?? 'workstation-native').toLowerCase().replace(/[^a-z0-9+._-]/g, '-').slice(0, 80),
          inspected_at: new Date().toISOString(), ...(job.kind === 'apk' ? {architectures: meta.architectures} : {})};
        const inspection = Buffer.from(JSON.stringify({payload, signature: createHmac('sha256', state.credentials.runner_key).update(canonical(payload)).digest('hex')})).toString('base64');
        const res = await fetchImpl(`${config.service_url}/v1/projects/${project}/artifacts/${digest}${job.kind==='aab'?'?format=aab':''}`,  {method: 'PUT', duplex: 'half', redirect: 'error',
          headers: {Authorization: 'Bearer ' + state.credentials.token, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size), 'X-Workstation-Inspection': inspection}, body: createReadStream(artifactPath), signal: AbortSignal.timeout(1800000)})
          .catch(() => null);
        need(res?.ok, 'ARTIFACT_UPLOAD_FAILED');
      }
      await durable('POST', `/v1/projects/${project}/receipts`, receipt, `receipt:${receipt.payload.id}`);
      await update('SUCCEEDED', {}, `done:${job.id}:${generation}`);
      // Exact completion readback: the server must show this job SUCCEEDED with this receipt attached.
      const back = await durable('GET', base);
      need(back?.job?.state === 'SUCCEEDED' && back.receipts?.some(x => x.id === receipt.payload.id && x.lease_generation === generation), 'COMPLETION_READBACK_MISMATCH');
      const rec = {event: 'JOB_SUCCEEDED', project, job_id: job.id, kind: job.kind, commit: job.commit, generation, receipt_id: receipt.payload.id,
        artifact_sha256: receipt.payload.artifact_sha256, resource_enforcement: receipt.payload.resource_enforcement ?? null, seconds: Math.round((now() - started) / 1000)};
      write(rec); await appendFile(join(config.state_dir, 'history.jsonl'), JSON.stringify({ts: new Date().toISOString(), ...rec}) + '\n');
      return rec;
    } catch (e) {
      const reason = e instanceof AgentError ? e.code : 'AGENT_INTERNAL_ERROR';
      write({event: 'JOB_FAILED', project, job_id: job.id, generation, code: reason});
      await appendFile(join(config.state_dir, 'history.jsonl'), JSON.stringify({ts: new Date().toISOString(), event: 'JOB_FAILED', project, job_id: job.id, generation, code: reason}) + '\n').catch(() => {});
      // Never report on a lease we no longer own; on shutdown leave the lease so a restart can recover it.
      if (!FATAL_LEASE.has(reason) && reason !== 'LEASE_RENEWAL_TIMEOUT' && !state.stopping && /^[A-Z][A-Z0-9_:]{2,80}$/.test(reason)) {
        await update('FAILED', {reason}, `fail:${job.id}:${generation}`).catch(err => write({event: 'FAIL_REPORT_ERROR', code: err.code}));
      }
      return {event: 'JOB_FAILED', code: reason};
    } finally {
      clearInterval(renew);
      await saveState({current: null});
    }
  }

  async function cycle() {
    await reloadCredentialsIfRotated();
    let worked = false;
    for (const [project, mapping] of Object.entries(config.projects)) {
      if (state.stopping) break;
      const p = await presence('IDLE');
      if (p.resources.pressure === 'CRITICAL') {
        write({event: 'RESOURCE_PRESSURE', pressure: 'CRITICAL'});
        const hb = await api('POST', `/v1/projects/${project}/agents/heartbeat`, {worker_id: config.worker_id, presence: p});
        if (hb?.directive) await applyDirective(hb.directive);
        continue;
      }
      // A persisted claim key is retried after a lost response, so the same lease is returned, never a second job.
      // The exact body is persisted with its key: a retry must be byte-identical or the server reports a conflict.
      const st = await readState();
      const pending = st.pending_claim?.project === project ? st.pending_claim
        : {project, key: `claim:${config.worker_id}:${randomUUID()}`, body: {worker_id: config.worker_id, presence: p}};
      await saveState({pending_claim: pending});
      let claim;
      try { claim = await api('POST', `/v1/projects/${project}/jobs/claim`, pending.body, pending.key); }
      catch (e) { if (e.code === 'IDEMPOTENCY_CONFLICT') await saveState({pending_claim: null}); throw e; }
      await saveState({pending_claim: null});
      if (claim?.directive) await applyDirective(claim.directive);
      if (state.stopping) break;
      if (!claim?.job) continue;
      worked = true; state.jobsRun++;
      await execute(project, mapping, claim);
    }
    return worked;
  }

  async function applyDirective(directive) {
    if (directive === state.directive) return;
    state.directive = directive;
    write({event: 'DIRECTIVE', directive});
    if (directive === 'STOP') {
      // Remote stop: exit and keep autostart wrappers from relaunching until resumed locally.
      await writeFile(join(config.state_dir, 'DISABLED'), new Date().toISOString()).catch(() => {});
      state.stopping = true; state.stoppedByDirective = true; process.exitCode = 3;
    }
  }
  async function stopRequested() { return existsSync(join(config.state_dir, 'STOP')); }

  // Manual operation (default for quota-limited Windows links): untilIdle drains queued work then exits;
  // once performs exactly one claim cycle. No background polling happens while the agent is not running.
  async function run({maxCycles = Infinity, untilIdle = false, once = false} = {}) {
    if (once) maxCycles = 1;
    if (!runRunner) {
      const policy = await execText(config.python, [join(ROOT, 'scripts', 'host_policy.py')]);
      try { need(JSON.parse(policy).status === 'ALLOWED', 'VPS_NATIVE_MOBILE_FORBIDDEN'); } catch { throw new AgentError('VPS_NATIVE_MOBILE_FORBIDDEN'); }
    }
    await mkdir(config.state_dir, {recursive: true, mode: 0o700});
    await rotateLogs();
    // Native host lock precedes cleanup; unknown directories are never reclaimed.
    const guard=spawn(config.python,[join(ROOT,'scripts','agent_guard.py'),'--work-root',config.work_root,'--worker',config.worker_id,...Object.values(config.projects).flatMap(m=>['--repository',m.repository])],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    await new Promise((done,fail)=>{
      let buffer='';const timer=setTimeout(()=>{guard.stdin.end();fail(new AgentError('AGENT_GUARD_TIMEOUT'));},30000);
      guard.on('error',e=>{clearTimeout(timer);fail(e);});
      guard.stdout.on('data',chunk=>{buffer+=chunk.toString();if(!buffer.includes('\n'))return;clearTimeout(timer);try{const r=JSON.parse(buffer.split('\n')[0]);if(r.status!=='LOCKED'){guard.stdin.end();fail(new AgentError(r.reason??'HOST_BUSY'));}else{write({event:'OWNED_WORKTREE_RECOVERY',...r.recovery});done();}}catch{guard.stdin.end();fail(new AgentError('GUARD_PROTOCOL_INVALID'));}});
      guard.on('close',code=>{clearTimeout(timer);if(code!==0)fail(new AgentError('HOST_BUSY'));});
    });
    try {
    if (!runRunner) {
      // Fail fast on an unsupported interpreter instead of consuming queued jobs (e.g. systemd PATH -> Python 3.6).
      const pyv = await execText(config.python, ['-c', 'import sys;print("%d.%d" % sys.version_info[:2])']);
      const [maj, min] = String(pyv ?? '0.0').split('.').map(Number);
      if (!(maj === 3 && min >= 10)) { write({event: 'BLOCKED', code: 'PYTHON_UNSUPPORTED', found: pyv ?? 'MISSING'}); process.exitCode = 3; return; }
      const probeOut = await execText(config.python, [join(ROOT, 'scripts', 'supervisor.py'), 'probe']);
      try { state.enforcement = JSON.parse(probeOut).backend; } catch { state.enforcement = 'none'; }
      if(config.allow_soft_limits!==true&&!['windows-job-object','systemd-scope'].includes(state.enforcement))throw new AgentError('KERNEL_RESOURCE_LIMITS_REQUIRED');
      state.toolchain = await flutterVersion(config.path_prepend ?? []);
    } else { state.enforcement = state.enforcement ?? 'watchdog-soft'; state.toolchain = state.toolchain ?? {}; }
    write({event: 'AGENT_START', version: AGENT_VERSION, platform: process.platform, enforcement: state.enforcement, profile: config.network_profile ?? 'standard', mode: once ? 'once' : untilIdle ? 'until-idle' : 'continuous'});
    let cycles = 0;
    while (!state.stopping && cycles < maxCycles) {
      cycles++;
      if (await stopRequested()) { write({event: 'STOP_FILE'}); break; }
      let worked = false;
      try {
        if (!state.capabilities) await probe();
        worked = await cycle();
        state.backoff = 0;
        if (untilIdle && !worked) { write({event: 'QUEUE_DRAINED_EXIT'}); break; }
      } catch (e) {
        if (e.status === 401 || e.status === 403 || ['SERVICE_INCOMPATIBLE', 'SERVICE_ENROLLMENT_NOT_ENFORCED', 'SERVICE_AGENT_PROTOCOL_MISSING', 'AGENT_CREDENTIALS_PERMISSIONS'].includes(e.code)) {
          write({event: 'BLOCKED', code: e.code}); process.exitCode = 3; break;
        }
        state.backoff = Math.min(state.backoff + 1, 12);
        if ((untilIdle || once) && state.backoff >= 3) { write({event: 'OFFLINE_EXIT', code: e.code ?? 'UNKNOWN'}); process.exitCode = 4; break; }
        if (e.code === 'CONTROL_PLANE_UNREACHABLE') state.capabilities = state.capabilities; // keep cached probe; no extra traffic
        write({event: 'OFFLINE_RETRY', code: e.code ?? 'UNKNOWN', attempt: state.backoff});
      }
      if (state.stopping || cycles >= maxCycles) break;
      const delay = state.backoff
        ? Math.min(config.max_backoff_seconds, 10 * 2 ** (state.backoff - 1)) * (0.8 + Math.random() * 0.4)
        : worked ? 1 : config.idle_poll_seconds;
      await sleep(delay * 1000);
    }
    write({event: 'AGENT_STOP'});
    } finally {guard.stdin.end();await new Promise(r=>{if(guard.exitCode!==null)return r();guard.once('close',r);});}
  }

  function stop() { state.stopping = true; killRunner(); }
  return {run, stop, cycle, probe, presence, resources, state, saveState, readState};
}

export function digestFile(path) { return new Promise((done, fail) => { const h = createHash('sha256'); createReadStream(path).on('data', d => h.update(d)).on('end', () => done(h.digest('hex'))).on('error', fail); }); }
