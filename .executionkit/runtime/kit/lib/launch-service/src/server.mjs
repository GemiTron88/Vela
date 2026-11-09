import http from 'node:http';
import {readFile, mkdir, open, rename, unlink, stat, statfs, readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash, createPrivateKey, createPublicKey, timingSafeEqual} from 'node:crypto';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from './store.mjs';
import {ReleaseService, JOB_KINDS} from './service.mjs';
import {checksum} from './apk.mjs';
import {Fault, need, slug, sha, hash, canonical, uuid} from './contracts.mjs';

async function body(req) {
  let size = 0; const buffers = [];
  for await (const b of req) { size += b.length; need(size <= 131072, 'BODY_TOO_LARGE', 413); buffers.push(b); }
  try { return JSON.parse(Buffer.concat(buffers)); } catch { throw new Fault('INVALID_JSON'); }
}
function identity(req, config) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const digest = Buffer.from(hash(header.slice(7)), 'hex');
  return config.principals.find(p => {
    const expected = Buffer.from(p.token_sha256, 'hex');
    return p.enabled && expected.length === digest.length && timingSafeEqual(digest, expected);
  }) ?? null;
}
export function uploadedArtifactInspector(options,format){
  const inspector=format==='aab'?options.inspectBundle:options.inspectApk;
  need(options.testing===true&&typeof inspector==='function','WORKSTATION_ARTIFACT_INSPECTION_REQUIRED',409);
  return inspector;
}
function requireProductionEnrollment(config) {
  if (process.env.NODE_ENV === 'production' || config.environment === 'production' || config.production === true) {
    need(config.requireAgentEnrollment === true, 'PRODUCTION_AGENT_ENROLLMENT_REQUIRED');
  }
}
export async function createServer(config, options = {}) {
  requireProductionEnrollment(config);
  need(config.publicUrl && /^https:\/\//.test(config.publicUrl) || options.testing === true, 'HTTPS_PUBLIC_URL_REQUIRED');
  for(const keys of Object.values(config.launchGatePublicKeys??{}))for(const pem of Object.values(keys)){
    need(!createPublicKey(pem).export({type:'spki',format:'der'}).equals(createPublicKey(config.manifestKey).export({type:'spki',format:'der'})),'LAUNCH_MANIFEST_KEY_REUSE_FORBIDDEN');
  }
  const root = resolve(config.stateDir); await mkdir(root, {recursive: true, mode: 0o700});
  const store = new Store(join(root, 'release.db')), service = new ReleaseService(store, config);
  // Expired partial uploads are not release artifacts. Keep recent files for active requests.
  const artifactRoot=join(root,'artifacts');await mkdir(artifactRoot,{recursive:true,mode:0o700});
  const dirs=await readdir(artifactRoot,{withFileTypes:true});
  for(const d of dirs.filter(d=>d.isDirectory()&&/^[a-z][a-z0-9-]{0,63}$/.test(d.name))) {
    for(const f of await readdir(join(artifactRoot,d.name))) if(/^[a-f0-9-]+\.part$/.test(f)) {
      const path=join(artifactRoot,d.name,f);if((await stat(path)).mtimeMs<Date.now()-86400000) await unlink(path);
    }
  }
  let activeUploads=0;
  const server = http.createServer(async (req, res) => {
    const requestId = uuid(); res.setHeader('X-Request-Id', requestId); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    const json = (status, value) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
    try {
      need(!req.headers.origin || config.allowedOrigins?.includes(req.headers.origin), 'ORIGIN_REJECTED', 403);
      if (config.allowedHosts?.length) need(config.allowedHosts.includes(req.headers.host), 'HOST_REJECTED', 403);
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/healthz') return json(200, {status: 'alive'});
      if (req.method === 'GET' && url.pathname === '/readyz') { const version = store.one('SELECT MAX(version) AS version FROM schema_versions')?.version; return json(200, {status: 'ready', schema: version}); }
      if (req.method === 'GET' && url.pathname === '/v1/capabilities') return json(200, {schema:1, api_version:'v1',
        capabilities:['launch.gates.signed','agents.enroll','agents.revoke','agents.list','agents.presence','agents.control','jobs.cancel','jobs.enqueue.scoped','jobs.outcomes','jobs.detail','jobs.kind.debug_apk','approvals.read','jobs.lease.fenced','projects.register','projects.list','signing.establish','provider.receipts.record',...(options.testing===true?['artifacts.upload.verified']:[]),...(config.requireAgentEnrollment===true?['artifacts.upload.workstation_signed','artifacts.upload.manual_workstation_signed']:['artifacts.upload.manual_workstation_signed']),'mobile.update_strategy.signed_apk','manifests.signed','releases.create','releases.approve','releases.promote','receipts.record','jobs.enqueue','jobs.claim','jobs.lease','journal.read'],
        provider_cli:['shorebird.patch.staging','shorebird.release.apk','shorebird.patch.promote','shorebird.patch.rollback','shorebird.history','shorebird.usage'],
        arbitrary_shell:false, canonical_launch_gates_required:true, artifact_verification_mode:'WORKSTATION_ATTESTATION_REQUIRED', mobile_update_strategy:'SIGNED_APK', build_agent_required:false, shorebird_required:false, production_requires_independent_approval:true, agent_enrollment_enforced: config.requireAgentEnrollment === true, job_kinds: JOB_KINDS, presence_window_seconds: service.presenceWindowMs / 1000});
      const actor = identity(req, config), key = req.headers['idempotency-key'];
      if (url.pathname === '/v1/projects' && req.method === 'POST') return json(201, service.register(actor, key, await body(req)));
      if (url.pathname === '/v1/projects' && req.method === 'GET') {
        need(actor && actor.permissions.includes('read'), 'FORBIDDEN', 403);
        return json(200, {projects: store.all('SELECT id,data FROM projects').filter(p => actor.projects.includes('*') || actor.projects.includes(p.id)).map(p => JSON.parse(p.data))});
      }
      const m = url.pathname.match(/^\/v1\/projects\/([a-z][a-z0-9-]{0,63})(?:\/(.*))?$/); need(m, 'NOT_FOUND', 404);
      const project = slug(m[1]), route = m[2] ?? '', p = service.project(project);
      if (req.method === 'GET' && (route.startsWith('manifest/') || route.startsWith('artifacts/'))) {
        if (route.startsWith('manifest/') && !p.public_updates)service.authorize(actor,project,'updates');
        if (route.startsWith('manifest/')) return json(200, service.manifest(project, route.slice(9)));
        const digest = sha(route.slice(10)), a = store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, digest); need(a, 'ARTIFACT_NOT_FOUND', 404);
        const metadata=JSON.parse(a.data);if(metadata.format==='aab')service.authorize(actor,project,'read');else if(!p.public_updates)service.authorize(actor,project,'updates');
        const path=join(root,'artifacts',project,`${digest}.${metadata.format==='aab'?'aab':'apk'}`),size=(await stat(path)).size;
        need(size === metadata.size, 'ARTIFACT_CORRUPT', 503);
        let start = 0, end = size - 1, partial = false;
        const etag = `"${digest}"`;
        if (req.headers.range && (!req.headers['if-range'] || req.headers['if-range'] === etag)) {
          const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
          if (!range) { res.setHeader('Content-Range', `bytes */${size}`); return json(416, {error: 'INVALID_RANGE'}); }
          start = Number(range[1]); end = range[2] ? Number(range[2]) : end;
          if (!(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && end < size)) { res.setHeader('Content-Range', `bytes */${size}`); return json(416, {error: 'INVALID_RANGE'}); }
          partial = true;
        }
        res.setHeader('ETag', etag); res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
        res.setHeader('Content-Length', end - start + 1); res.setHeader('Content-Type',metadata.format==='aab'?'application/octet-stream':'application/vnd.android.package-archive');
        if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.writeHead(partial ? 206 : 200);
        const stream = createReadStream(path, {start, end}); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res); return;
      }
      if (req.method === 'PUT' && route.startsWith('artifacts/')) {
        service.authorize(actor, project, 'build');
        need(p.signing_sha256 !== null, 'SIGNING_CONTINUITY_UNKNOWN', 409);
        need(activeUploads < (config.maxConcurrentUploads ?? 1), 'UPLOAD_CAPACITY_EXHAUSTED', 429);
        const digest = sha(route.slice(10));const format=url.searchParams.get('format')??'apk';need(['apk','aab'].includes(format),'ARTIFACT_FORMAT_INVALID');
        // Production path: signed physical-workstation inspection (no server-side Android SDK). Legacy injected
        // inspectors remain available only to isolated tests (options.testing) and never in production.
        const attestation=req.headers['x-workstation-inspection'];
        let signedInspection=null,inspector=null;
        if(attestation!==undefined){
          need(typeof attestation==='string'&&attestation.length<=8192&&/^[A-Za-z0-9+/=_-]+$/.test(attestation),'INSPECTION_HEADER_INVALID');
          try{signedInspection=JSON.parse(Buffer.from(attestation,'base64').toString('utf8'));}catch{throw new Fault('INSPECTION_HEADER_INVALID');}
          service.verifyWorkstationInspection(actor,project,digest,format,signedInspection);
          const declared=Number(req.headers['content-length']);
          need(!req.headers['content-length']||declared===signedInspection.payload.size,'UPLOAD_SIZE_MISMATCH',409);
        } else inspector=uploadedArtifactInspector(options,format);
        activeUploads++;
        let file, temp;
        try {
        const dir = join(root, 'artifacts', project); await mkdir(dir, {recursive: true, mode: 0o700});
        const disk=await statfs(root);
        need(disk.bavail*disk.bsize >= (config.minimumFreeDiskBytes ?? 0)+config.maxArtifactBytes, 'INSUFFICIENT_STORAGE', 507);
        const files=await readdir(dir); let used=0;
        for(const name of files) used+=(await stat(join(dir,name))).size;
        need(used+config.maxArtifactBytes <= (config.maxProjectStorageBytes ?? 4*1024*1024*1024), 'PROJECT_STORAGE_LIMIT', 507);
        temp = join(dir, `${uuid()}.part`);
        const destination = join(dir, `${digest}.${format}`);
        file = await open(temp, 'wx', 0o600); let bytes = 0;
          for await (const chunk of req) { bytes += chunk.length; need(bytes <= config.maxArtifactBytes, 'ARTIFACT_TOO_LARGE', 413); await file.write(chunk); }
          await file.sync(); await file.close(); need(bytes > 0 && await checksum(temp) === digest, 'CHECKSUM_MISMATCH', 409);
          if(signedInspection){
            need(bytes===signedInspection.payload.size,'UPLOADED_BYTES_MISMATCH',409);
            const existing = store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, digest);
            if (existing || await stat(destination).then(()=>true,()=>false)) { need(await checksum(destination) === digest, 'ARTIFACT_STORAGE_CORRUPT', 503); await unlink(temp); }
            else await rename(temp, destination);
            // Persisted bytes are re-hashed from their final path before metadata is published (TOCTOU guard).
            const final=await stat(destination);
            return json(201, service.recordInspectedArtifact(actor, project, signedInspection, {sha256: await checksum(destination), size: final.size}));
          }
          const info = await inspector(temp);
          if(format==='aab')need(info.format==='aab','INSPECTOR_FORMAT_MISMATCH',409);
          need(info.sha256 === digest && info.size === bytes, 'INSPECTOR_DIGEST_MISMATCH', 409);
          need(info.package_id===p.package_id && info.signing_sha256===p.signing_sha256, 'APK_IDENTITY_MISMATCH', 409);
          // Only verified bytes move to an immutable, project-scoped content address.
          const existing = store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, digest);
          if (existing) { need(await checksum(destination) === digest, 'ARTIFACT_STORAGE_CORRUPT', 503); await unlink(temp); }
          else await rename(temp, destination);
          return json(201, service.recordArtifact(actor, project, info));
        } finally { activeUploads--; if(file) await file.close().catch(() => {}); if(temp) await unlink(temp).catch(() => {}); }
      }
      const actions = {'launch/gates':'launchGateRecord',receipts: 'receipt', 'provider/receipts':'providerRecord', releases: 'createRelease', approvals: 'approve', promotions: 'promote', jobs: 'enqueue', 'jobs/claim': 'claim', 'signing/establish':'establishSigning', 'agents/enroll':'enrollAgent', 'agents/revoke':'revokeAgent', 'agents/control':'controlAgent'};
      // Presence heartbeats are not journaled operations; they only refresh last_seen state.
      if (req.method === 'POST' && route === 'agents/heartbeat') return json(200, service.presence(actor, project, await body(req)));
      if (req.method === 'POST' && /^jobs\/[a-f0-9-]{36}\/cancel$/.test(route)) return json(200, service.cancel(actor, project, route.slice(5, 41), key, await body(req)));
      if (req.method === 'POST' && actions[route]) return json(201, service[actions[route]](actor, project, key, await body(req)));
      if (req.method === 'POST' && /^jobs\/[a-f0-9-]{36}$/.test(route)) return json(200, service.jobUpdate(actor, project, route.slice(5), key, await body(req)));
      if (req.method === 'GET') {
        service.authorize(actor, project, 'read');
        if (!route) return json(200, p);
        if(/^releases\/[a-f0-9-]{36}$/.test(route))return json(200,service.release(project,route.slice(9)));
        if(route==='launch/gates')return json(200,service.launchGateStatus(project,url.searchParams.get('commit'),url.searchParams.get('artifact_sha256')));
        if (route === 'agents') return json(200, service.agentList(actor, project));
        if (route === 'approvals') return json(200, service.approvalList(actor, project));
        if (/^jobs\/[a-f0-9-]{36}$/.test(route)) return json(200, service.jobDetail(actor, project, route.slice(5)));
        if (['journal', 'jobs', 'releases', 'receipts', 'tracks'].includes(route)) {
          // Identifiers come exclusively from this allow-list.
          const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
          need(Number.isInteger(limit), 'INVALID_LIMIT');
          if (route === 'jobs') return json(200, service.jobList(actor, project, limit));
          const rows = store.all(`SELECT * FROM ${route} WHERE project=? ORDER BY rowid DESC LIMIT ?`, project, limit);
          return json(200, {items: rows.map(r => ({...r, data: JSON.parse(r.data),...(route==='releases'?{release_digest:hash(canonical(JSON.parse(r.data))),launch_gate:service.launchGateStatus(project,JSON.parse(r.data).commit,JSON.parse(r.data).artifact.sha256)}:{})}))});
        }
      }
      throw new Fault('NOT_FOUND', 404);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(error instanceof Fault ? error.status : 500, {error: {code: error instanceof Fault ? error.code : 'INTERNAL_ERROR', request_id: requestId}});
      // Request payloads, SMS, credentials and raw provider stderr never enter logs.
      if (!(error instanceof Fault)) console.error(JSON.stringify({level: 'error', request_id: requestId, code: 'INTERNAL_ERROR'}));
    }
  });
  server.requestTimeout = 120000; server.headersTimeout = 15000; server.maxHeadersCount = 50;
  return {server, store, service};
}
export async function loadConfig(path) {
  const input = JSON.parse(await readFile(path, 'utf8'));
  const origin=new URL(input.publicUrl);
  need(origin.protocol==='https:' && origin.pathname==='/' && !origin.username && !origin.password && !origin.search && !origin.hash, 'HTTPS_ORIGIN_REQUIRED');
  input.publicUrl=origin.origin;
  need(input.requireAgentEnrollment === undefined || typeof input.requireAgentEnrollment === 'boolean', 'AGENT_ENROLLMENT_MODE_INVALID');
  requireProductionEnrollment(input);
  need(input.maxJobAttempts === undefined || (Number.isSafeInteger(input.maxJobAttempts) && input.maxJobAttempts >= 1 && input.maxJobAttempts <= 10), 'MAX_JOB_ATTEMPTS_INVALID');
  need(Array.isArray(input.principals) && input.principals.length > 0, 'PRINCIPALS_REQUIRED');
  for (const p of input.principals) { slug(p.id); sha(p.token_sha256); need(Array.isArray(p.projects) && Array.isArray(p.permissions) && typeof p.enabled === 'boolean', 'INVALID_PRINCIPAL'); }
  need(input.maxArtifactBytes > 0 && input.maxArtifactBytes <= 1024 * 1024 * 1024, 'INVALID_ARTIFACT_LIMIT');
  const raw = await readFile(input.manifestKeyPath, 'utf8');
  const key = createPrivateKey(raw); need(key.asymmetricKeyType === 'ed25519', 'ED25519_REQUIRED');
  if (process.platform !== 'win32') { const mode = (await stat(input.manifestKeyPath)).mode & 0o777; need((mode & 0o077) === 0, 'PRIVATE_KEY_PERMISSIONS'); }
  for(const [project,keys] of Object.entries(input.launchGatePublicKeys??{})){slug(project);need(keys&&typeof keys==='object'&&!Array.isArray(keys),'LAUNCH_PUBLIC_KEYS_INVALID');for(const [id,pem] of Object.entries(keys)){slug(id);need(typeof pem==='string'&&pem.startsWith('-----BEGIN PUBLIC KEY-----'),'LAUNCH_PUBLIC_KEY_ONLY');need(createPublicKey(pem).asymmetricKeyType==='ed25519','LAUNCH_ED25519_PUBLIC_KEY_REQUIRED');}}
  const runnerKeys = {};
  for (const [project, entries] of Object.entries(input.runnerKeyEnv ?? {})) {
    slug(project); runnerKeys[project] = {};
    for (const [runner, env] of Object.entries(entries)) { slug(runner); need(/^[A-Z][A-Z0-9_]+$/.test(env), 'INVALID_KEY_ENV'); need(process.env[env]?.length >= 32, 'RUNNER_SECRET_REQUIRED'); runnerKeys[project][runner] = process.env[env]; }
  }
  return {...input, manifestKey: key, runnerKeys};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = await loadConfig(process.env.MOBILE_RELEASE_CONFIG ?? 'config/service.json');
  const {server, store} = await createServer(config);
  server.listen(config.port ?? 8088, '127.0.0.1', () => console.log(JSON.stringify({status: 'ready', port: config.port ?? 8088})));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { store.close(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); });
}
