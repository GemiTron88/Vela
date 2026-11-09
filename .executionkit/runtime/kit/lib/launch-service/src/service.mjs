import {createHmac, timingSafeEqual} from 'node:crypto';
import {canonical, fields, need, slug, sha, commit, integer, channel, uuid, envelope, hash} from './contracts.mjs';
import {verifyLaunchGate} from './launch-gates.mjs';
const BASE_GATES = ['analyze', 'unit', 'widget', 'apk_build', 'apk_signature'];
// Typed, allowlisted job kinds. debug_apk produces a non-publishable debug-signed binary (never a release artifact).
export const JOB_KINDS = ['verify', 'apk', 'debug_apk', 'aab'];
const REQUIRED_GATES = {verify: ['analyze', 'unit', 'widget'], apk: BASE_GATES, debug_apk: ['analyze', 'unit', 'widget', 'debug_apk_build'], aab:['analyze','unit','widget','aab_build','aab_signature']};
export class ReleaseService {
  constructor(store, config) { this.store = store; this.config = config; }
  authorize(actor, project, permission) {
    need(actor && actor.permissions.includes(permission) && (actor.projects.includes(project) || actor.projects.includes('*')), 'FORBIDDEN', 403);
  }
  project(id) { slug(id); const p = this.store.one('SELECT data FROM projects WHERE id=?', id); need(p, 'PROJECT_NOT_FOUND', 404); return JSON.parse(p.data); }
  launchGateRecord(actor,project,key,signed) {
    this.authorize(actor,project,'release');
    const p=verifyLaunchGate(signed,project,this.project(project).repository,this.config.launchGatePublicKeys);
    need(p.status!=='EXPIRED','LAUNCH_GATE_EXPIRED',409);
    return this.store.operation(actor.id,project,key,'launch.gate.record',signed,()=>{
      const old=this.store.one('SELECT signed FROM launch_gates WHERE id=?',p.id);
      if(old)need(old.signed===canonical(signed),'LAUNCH_GATE_ID_CONFLICT',409);
      else this.store.run('INSERT INTO launch_gates VALUES(?,?,?,?,?,?)',p.id,project,p.commit,p.artifact_sha256,Date.parse(p.issued_at),canonical(signed));
      return {id:p.id,project,commit:p.commit,artifact_sha256:p.artifact_sha256,status:p.status};
    });
  }
  launchGateStatus(project,source,artifact) {
    commit(source);sha(artifact);
    const row=this.store.one('SELECT signed FROM launch_gates WHERE project=? AND source_commit=? AND artifact_sha256=? ORDER BY issued_at DESC,rowid DESC LIMIT 1',project,source,artifact);
    if(!row)return {status:'MISSING'};
    try {
      const p=verifyLaunchGate(JSON.parse(row.signed),project,this.project(project).repository,this.config.launchGatePublicKeys);
      return {status:p.status,id:p.id,candidate_id:p.candidate_id,commit:p.commit,artifact_sha256:p.artifact_sha256,expires_at:p.expires_at};
    } catch {return {status:'INVALID_OR_REVOKED'};}
  }
  requireLaunchGate(project,source,artifact) {
    const gate=this.launchGateStatus(project,source,artifact);
    need(gate.status==='PASS','CANONICAL_LAUNCH_GATE_REQUIRED',409);return gate;
  }
  providerRecord(actor,project,key,signed) {
    this.authorize(actor,project,'build');this.project(project);fields(signed,['payload','signature']);const b=signed.payload;
    fields(b,['project','runner_id','action','provider_app_id','finished_at','exit_code','evidence_sha256','confidence'],['commit','release_version','patch_number','track']);
    need(b.project===project&&b.confidence==='OBSERVED'&&b.exit_code===0,'PROVIDER_OBSERVATION_INVALID',403);slug(b.runner_id);sha(b.evidence_sha256);
    this.enrollment(actor,project,b.runner_id);
    need(['patch','release','promote','rollback','history','usage'].includes(b.action)&&/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(b.provider_app_id),'PROVIDER_OPERATION_INVALID');
    if(b.commit)commit(b.commit);if(b.track)channel(b.track);if(b.patch_number!=null)integer(b.patch_number);
    const secret=this.config.runnerKeys[project]?.[b.runner_id];need(secret,'RUNNER_UNKNOWN',403);
    const expected=createHmac('sha256',secret).update(canonical(b)).digest(),actual=Buffer.from(signed.signature??'','hex');
    need(actual.length===expected.length&&timingSafeEqual(actual,expected),'INVALID_RECEIPT_SIGNATURE',401);
    const at=Date.parse(b.finished_at);need(at<=Date.now()+300000&&at>=Date.now()-7*86400000,'STALE_OR_INVALID_RECEIPT');
    return this.store.operation(actor.id,project,key,'provider.command_observed',b,()=>{
      this.enrollment(actor,project,b.runner_id);
      return {...b,acceptance:'REQUIRES_DEVICE_AND_PROVIDER_READBACK'};
    });
  }
  inspectorSecret(project, workerId) {
    return this.config.workstationKeys?.[project]?.[workerId] ?? this.config.runnerKeys?.[project]?.[workerId];
  }
  requireManualInspector(actor, project, workerId) {
    need(actor && actor.enabled !== false && Array.isArray(actor.permissions) && actor.permissions.includes('build') &&
      Array.isArray(actor.projects) && (actor.projects.includes(project) || actor.projects.includes('*')), 'FORBIDDEN', 403);
    slug(workerId);
    const secret = this.inspectorSecret(project, workerId); need(secret, 'RUNNER_UNKNOWN', 403);
    const secretSha = hash(secret);
    const revoked = this.store.one(
      'SELECT 1 FROM agent_revocations WHERE project=? AND (worker_id=? OR principal_id=? OR runner_key_sha256=?)',
      project, workerId, actor.id, secretSha
    );
    const enrolled = this.store.one('SELECT status,principal_id FROM agent_enrollments WHERE project=? AND worker_id=?', project, workerId);
    need(!revoked && (!enrolled || (enrolled.status === 'ACTIVE' && enrolled.principal_id === actor.id)), 'WORKSTATION_INSPECTOR_REVOKED', 403);
    return secret;
  }
  establishSigning(actor, project, key, signed) {
    this.authorize(actor,project,'approve'); const p=this.project(project);
    fields(signed,['payload','signature']); const b=signed.payload;
    fields(b,['project','package_id','signing_sha256','installed_version_code','installed_apk_sha256','runner_id','observed_at','source'],['mode','principal_id']);
    const isManual=b.mode==='manual_workstation';
    need(b.mode===undefined||isManual,'SIGNING_ATTESTATION_MODE_INVALID');
    const validSource=isManual?['adb-installed-apk','manual-workstation-keystore'].includes(b.source):b.source==='adb-installed-apk';
    need(b.project===project && b.package_id===p.package_id && validSource,'SIGNING_ATTESTATION_SCOPE_MISMATCH',403);
    sha(b.signing_sha256);sha(b.installed_apk_sha256);integer(b.installed_version_code);slug(b.runner_id);
    const requireAttestor=()=>{
      if(isManual){
        const attestor=(this.config.principals??[]).find(pr=>pr.enabled===true&&pr.id!==actor.id&&(b.principal_id?pr.id===b.principal_id:pr.permissions?.includes('build')&&(pr.projects?.includes(project)||pr.projects?.includes('*'))));
        need(attestor,'ATTESTOR_UNKNOWN',403);
        this.requireManualInspector(attestor,project,b.runner_id);
        return;
      }
      if(this.config.requireAgentEnrollment!==true)return;
      const agent=this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?',project,b.runner_id);
      need(agent&&agent.status==='ACTIVE','AGENT_NOT_ENROLLED',403);
      // The attestor is a build principal; the approving caller remains independent.
      this.enrollment((this.config.principals??[]).find(p=>p.id===agent.principal_id&&p.enabled===true),project,b.runner_id);
    };
    requireAttestor();
    const secret=isManual?this.inspectorSecret(project,b.runner_id):this.config.runnerKeys[project]?.[b.runner_id];need(secret,'ATTESTOR_UNKNOWN',403);
    const expected=createHmac('sha256',secret).update(canonical(b)).digest(),actual=Buffer.from(signed.signature??'','hex');
    need(actual.length===expected.length && timingSafeEqual(actual,expected),'SIGNING_ATTESTATION_SIGNATURE_INVALID',401);
    const observed=Date.parse(b.observed_at);need(Number.isFinite(observed)&&observed<=Date.now()+300000&&observed>=Date.now()-86400000,'SIGNING_ATTESTATION_STALE');
    return this.store.operation(actor.id,project,key,'signing.establish',b,()=>{
      requireAttestor();
      need(p.signing_sha256===null || p.signing_sha256===b.signing_sha256,'SIGNING_ROTATION_REQUIRES_SEPARATE_MIGRATION',409);
      const data={...p,signing_sha256:b.signing_sha256,installed_baseline_version_code:Math.max(p.installed_baseline_version_code??0,b.installed_version_code),signing_evidence:{source:b.source,observed_at:b.observed_at,installed_apk_sha256:b.installed_apk_sha256,confidence:'OBSERVED',approved_by:actor.id}};
      this.store.run('UPDATE projects SET data=? WHERE id=?',canonical(data),project);return data;
    });
  }
  register(actor, key, body) {
    fields(body, ['id', 'package_id', 'repository', 'flutter_path', 'flutter_version', 'signing_sha256', 'required_device_gates', 'public_updates'], ['shorebird_app_id']);
    const id = slug(body.id); this.authorize(actor, id, 'registry');
    need(/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(body.package_id), 'INVALID_PACKAGE_ID');
    need(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(body.repository), 'INVALID_REPOSITORY');
    need(typeof body.flutter_path === 'string' && /^(?:\.|[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/.test(body.flutter_path), 'INVALID_FLUTTER_PATH');
    need(/^\d+\.\d+\.\d+$/.test(body.flutter_version), 'INVALID_FLUTTER_VERSION');
    if (body.signing_sha256 !== null) sha(body.signing_sha256);
    need(Array.isArray(body.required_device_gates) && body.required_device_gates.every(v => ['install_launch', 'package_replacement', 'sms_recovery'].includes(v)), 'INVALID_DEVICE_GATES');
    need(typeof body.public_updates === 'boolean', 'INVALID_PUBLIC_POLICY');
    if (body.shorebird_app_id != null) need(/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(body.shorebird_app_id), 'INVALID_SHOREBIRD_ID');
    return this.store.operation(actor.id, id, key, 'project.register', body, () => {
      const old = this.store.one('SELECT data FROM projects WHERE id=?', id);
      if (old) { need(canonical(JSON.parse(old.data)) === canonical(body), 'PROJECT_CONFIG_IMMUTABLE_USE_REVIEWED_MIGRATION', 409); return body; }
      this.store.run('INSERT INTO projects VALUES(?,?,?)', id, canonical(body), new Date().toISOString()); return body;
    });
  }
  recordArtifact(actor, project, info) {
    this.authorize(actor, project, 'build'); const p = this.project(project);
    need(p.signing_sha256 !== null, 'SIGNING_CONTINUITY_UNKNOWN', 409);
    need(info.verification === 'VERIFIED' && info.package_id === p.package_id, 'PACKAGE_ID_MISMATCH', 409);
    need(info.signing_sha256 === p.signing_sha256, 'SIGNING_MISMATCH', 409);
    sha(info.sha256); integer(info.version_code); integer(info.size, 1, this.config.maxArtifactBytes);
    return this.store.tx(() => {
      const old = this.store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, info.sha256);
      if (old) { need(canonical(JSON.parse(old.data)) === canonical(info), 'ARTIFACT_CONFLICT', 409); return info; }
      this.store.run('INSERT INTO artifacts VALUES(?,?,?)', project, info.sha256, canonical(info));
      this.store.event(actor.id, project, 'artifact.verified', info, uuid()); return info;
    });
  }
  // Signed physical-workstation inspection bridge. Supports both the direct manual operator/workstation
  // inspection path (workstation.manual_inspection.v1) and the retained leased Build Agent path
  // (workstation.artifact_inspection.v1). The server never runs Android SDK tools and independently re-hashes bytes.
  verifyWorkstationInspection(actor, project, digest, format, signed) {
    this.authorize(actor, project, 'build'); const p = this.project(project);
    fields(signed, ['payload', 'signature']); const b = signed.payload;
    const isManual = b?.type === 'workstation.manual_inspection.v1';
    if (!isManual) need(this.config.requireAgentEnrollment === true, 'WORKSTATION_ENROLLMENT_ENFORCEMENT_REQUIRED', 409);
    need(p.signing_sha256 !== null, 'SIGNING_CONTINUITY_UNKNOWN', 409);
    if (isManual) {
      fields(b, ['type', 'id', 'project', 'worker_id', 'principal_id', 'commit', 'artifact_sha256', 'size', 'format',
        'package_id', 'version_code', 'version', 'minimum_android_sdk', 'signing_sha256', 'debug_signed', 'verifier', 'inspected_at'], ['architectures', 'host_fingerprint']);
      if (b.host_fingerprint !== undefined) need(typeof b.host_fingerprint === 'string' && /^[a-f0-9]{16,128}$/.test(b.host_fingerprint), 'INVALID_HOST_FINGERPRINT');
    } else {
      fields(b, ['type', 'id', 'project', 'worker_id', 'principal_id', 'job_id', 'lease_generation', 'commit', 'artifact_sha256', 'size', 'format',
        'package_id', 'version_code', 'version', 'minimum_android_sdk', 'signing_sha256', 'debug_signed', 'verifier', 'inspected_at'], ['architectures']);
      need(b.type === 'workstation.artifact_inspection.v1', 'INSPECTION_TYPE_INVALID');
      need(typeof b.job_id === 'string' && /^[a-f0-9-]{36}$/.test(b.job_id), 'INVALID_JOB_ID');
      integer(b.lease_generation);
    }
    need(typeof b.id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(b.id), 'INVALID_INSPECTION_ID');
    need(b.project === project && b.principal_id === actor.id, 'INSPECTION_SCOPE_MISMATCH', 403);
    slug(b.worker_id); commit(b.commit); sha(b.artifact_sha256); sha(b.signing_sha256);
    integer(b.size, 1, this.config.maxArtifactBytes); integer(b.version_code); integer(b.minimum_android_sdk, 1, 1000);
    need(b.artifact_sha256 === digest && b.format === format && ['apk', 'aab'].includes(format), 'INSPECTION_ARTIFACT_MISMATCH', 409);
    need(typeof b.version === 'string' && b.version.length >= 1 && b.version.length <= 64, 'INVALID_VERSION_NAME');
    need(typeof b.verifier === 'string' && /^[a-z0-9+._-]{3,80}$/.test(b.verifier), 'INVALID_VERIFIER');
    if (format === 'apk') need(Array.isArray(b.architectures) && b.architectures.length > 0 && b.architectures.every(a => ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'].includes(a)), 'APK_ARCHITECTURES_UNKNOWN');
    else need(b.architectures === undefined, 'AAB_ARCHITECTURES_NOT_APPLICABLE');
    need(b.debug_signed === false, 'DEBUG_SIGNED_ARTIFACT', 409);
    need(b.package_id === p.package_id && b.signing_sha256 === p.signing_sha256, 'APK_IDENTITY_MISMATCH', 409);
    const secret = isManual ? this.requireManualInspector(actor, project, b.worker_id) : this.config.runnerKeys[project]?.[b.worker_id];
    need(secret, 'RUNNER_UNKNOWN', 403);
    const expected = createHmac('sha256', secret).update(canonical(b)).digest();
    const actual = typeof signed.signature === 'string' && /^[a-f0-9]{64}$/.test(signed.signature) ? Buffer.from(signed.signature, 'hex') : Buffer.alloc(0);
    need(actual.length === expected.length && timingSafeEqual(actual, expected), 'INSPECTION_SIGNATURE_INVALID', 401);
    const at = Date.parse(b.inspected_at);
    need(Number.isFinite(at) && at <= Date.now() + 300000 && at >= Date.now() - 3600000, 'INSPECTION_STALE');
    if (!isManual) this.requireInspectionLease(actor, project, b);
    const maximum = Math.max(this.store.one('SELECT MAX(version_code) AS n FROM releases WHERE project=?', project)?.n ?? 0, p.installed_baseline_version_code ?? 0);
    need(b.version_code > maximum, 'VERSION_CODE_REGRESSION', 409);
    const prior = this.store.one('SELECT signed FROM artifact_inspections WHERE id=?', b.id);
    need(!prior || prior.signed === canonical(signed), 'INSPECTION_REPLAY_CONFLICT', 409);
    return b;
  }
  requireInspectionLease(actor, project, b) {
    const agent = this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?', project, b.worker_id);
    need(agent && agent.status === 'ACTIVE' && agent.principal_id === actor.id, 'AGENT_NOT_ENROLLED', 403);
    const job = this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', b.job_id, project);
    const fence = job ? this.store.one('SELECT generation FROM job_fences WHERE job_id=?', job.id) : null;
    const data = job ? JSON.parse(job.data) : {};
    need(job && job.state === 'RUNNING' && job.owner === actor.id + ':' + b.worker_id && job.lease_until > Date.now() &&
      fence && fence.generation === b.lease_generation && data.commit === b.commit && data.kind === b.format,
      'INSPECTION_LEASE_INVALID', 409);
  }
  // Called only after the server has persisted bytes whose SHA-256 and size it computed itself.
  recordInspectedArtifact(actor, project, signed, observed) {
    const b = signed.payload, isManual = b.type === 'workstation.manual_inspection.v1';
    need(observed.sha256 === b.artifact_sha256 && observed.size === b.size, 'UPLOADED_BYTES_MISMATCH', 409);
    const jobId = isManual ? 'MANUAL_LOCAL' : b.job_id, leaseGen = isManual ? 0 : b.lease_generation;
    const info = {package_id: b.package_id, version_code: b.version_code, version: b.version, minimum_android_sdk: b.minimum_android_sdk,
      signing_sha256: b.signing_sha256, ...(b.format === 'apk' ? {architectures: [...b.architectures].sort()} : {}), sha256: observed.sha256, size: observed.size,
      verification: 'VERIFIED', verification_source: isManual ? 'manual_workstation_inspection' : 'workstation_signed_inspection', debug_signed: false, format: b.format,
      verifier: 'workstation:' + b.verifier, inspection_id: b.id, inspected_by: b.worker_id, source_commit: b.commit, job_id: jobId};
    return this.store.tx(() => {
      if (isManual) this.requireManualInspector(actor, project, b.worker_id);
      else this.requireInspectionLease(actor, project, b);
      const prior = this.store.one('SELECT signed FROM artifact_inspections WHERE id=?', b.id);
      if (prior) need(prior.signed === canonical(signed), 'INSPECTION_REPLAY_CONFLICT', 409);
      else this.store.run('INSERT INTO artifact_inspections VALUES(?,?,?,?,?,?,?,?)', b.id, project, b.artifact_sha256, jobId, leaseGen, b.worker_id, new Date().toISOString(), canonical(signed));
      const old = this.store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, info.sha256);
      if (old) {
        const o = JSON.parse(old.data);
        need(o.package_id === info.package_id && o.version_code === info.version_code && o.signing_sha256 === info.signing_sha256 && (o.format ?? 'apk') === info.format && o.size === info.size && o.version === info.version && o.minimum_android_sdk === info.minimum_android_sdk && canonical(o.architectures??[])===canonical(info.architectures??[]), 'ARTIFACT_CONFLICT', 409);
        return o;
      }
      this.store.run('INSERT INTO artifacts VALUES(?,?,?)', project, info.sha256, canonical(info));
      this.store.event(actor.id, project, 'artifact.workstation_verified', info, uuid()); return info;
    });
  }
  receipt(actor, project, key, signed) {
    this.authorize(actor, project, 'build'); this.project(project);
    fields(signed, ['payload', 'signature']); const b = signed.payload;
    fields(b, ['id', 'project', 'commit', 'artifact_sha256', 'gates', 'started_at', 'finished_at', 'runner_id', 'toolchain'], ['job_id', 'lease_generation', 'resource_enforcement', 'mode', 'inspection_id']);
    need(b.resource_enforcement === undefined || ['systemd-scope', 'windows-job-object', 'watchdog-soft', 'none'].includes(b.resource_enforcement), 'INVALID_RESOURCE_ENFORCEMENT');
    const isManual = b.mode === 'manual_workstation';
    need(b.mode === undefined || isManual, 'INVALID_RECEIPT_MODE');
    need(b.project === project, 'RECEIPT_PROJECT_MISMATCH', 403); slug(b.runner_id); commit(b.commit); sha(b.artifact_sha256);
    need(typeof b.id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(b.id), 'INVALID_RECEIPT_ID');
    let secret;
    if (isManual) {
      need(typeof b.inspection_id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(b.inspection_id) && b.job_id === undefined && b.lease_generation === undefined, 'MANUAL_RECEIPT_INSPECTION_REQUIRED', 409);
      secret = this.requireManualInspector(actor, project, b.runner_id);
      const inspRow = this.store.one("SELECT signed FROM artifact_inspections WHERE id=? AND project=? AND artifact_sha256=? AND job_id='MANUAL_LOCAL' AND worker_id=?", b.inspection_id, project, b.artifact_sha256, b.runner_id);
      need(inspRow, 'MANUAL_RECEIPT_INSPECTION_MISMATCH', 409);
      const inspPayload = JSON.parse(inspRow.signed).payload;
      need(inspPayload.commit === b.commit && inspPayload.principal_id === actor.id, 'MANUAL_RECEIPT_INSPECTION_MISMATCH', 409);
    } else {
      if (this.config.requireAgentEnrollment === true) {
        this.enrollment(actor, project, b.runner_id);
        const running = typeof b.job_id === 'string'
          ? this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', b.job_id, project) : null;
        const fence = running
          ? this.store.one('SELECT generation FROM job_fences WHERE job_id=?', running.id) : null;
        need(running && running.state === 'RUNNING' &&
          running.owner === actor.id + ':' + b.runner_id &&
          running.lease_until > Date.now() &&
          JSON.parse(running.data).commit === b.commit &&
          fence && b.lease_generation === fence.generation,
          'AGENT_RECEIPT_LEASE_INVALID', 409);
      }
      secret = this.config.runnerKeys[project]?.[b.runner_id]; need(secret, 'RUNNER_UNKNOWN', 403);
    }
    const expected = createHmac('sha256', secret).update(canonical(b)).digest();
    const actual = typeof signed.signature === 'string' ? Buffer.from(signed.signature, 'hex') : Buffer.alloc(0);
    need(actual.length === expected.length && timingSafeEqual(actual, expected), 'INVALID_RECEIPT_SIGNATURE', 401);
    const start = Date.parse(b.started_at), end = Date.parse(b.finished_at);
    need(Number.isFinite(start) && Number.isFinite(end) && start <= end && end <= Date.now() + 300000 && end >= Date.now() - 7 * 86400000, 'STALE_OR_INVALID_RECEIPT');
    need(typeof b.toolchain === 'object' && b.toolchain !== null && typeof b.toolchain.flutter === 'string', 'TOOLCHAIN_MISSING');
    need(Array.isArray(b.gates) && b.gates.length <= 30 && new Set(b.gates.map(g => g.name)).size === b.gates.length, 'INVALID_GATES');
    for (const g of b.gates) {
      fields(g, ['name', 'status', 'exit_code', 'evidence_sha256']);
      need([...BASE_GATES, 'debug_apk_build', 'install_launch', 'package_replacement', 'sms_recovery', 'shorebird_compatibility','aab_build','aab_signature'].includes(g.name) && ['PASS', 'FAIL', 'NOT_TESTED'].includes(g.status), 'INVALID_GATE');
      if (g.status === 'NOT_TESTED') {
        need(g.exit_code === null || Number.isInteger(g.exit_code), 'INVALID_GATE');
        if (g.evidence_sha256 !== null) sha(g.evidence_sha256);
      } else {
        sha(g.evidence_sha256);
        need(Number.isInteger(g.exit_code), 'INVALID_GATE');
        need(g.status !== 'PASS' || g.exit_code === 0, 'FALSE_PASS');
        need(g.status !== 'FAIL' || g.exit_code !== 0, 'INVALID_GATE');
      }
    }
    return this.store.operation(actor.id, project, key, 'receipt.record', b, () => {
      const old = this.store.one('SELECT data FROM receipts WHERE id=?', b.id);
      if (old) { need(old.data === canonical(b), 'RECEIPT_CONFLICT', 409); return b; }
      this.store.run('INSERT INTO receipts VALUES(?,?,?)', b.id, project, canonical(b)); return b;
    });
  }
  createRelease(actor, project, key, b) {
    this.authorize(actor, project, 'release'); const p = this.project(project);
    fields(b, ['artifact_sha256', 'commit', 'receipt_id', 'notes', 'minimum_supported_version_code', 'required']);
    sha(b.artifact_sha256); commit(b.commit); integer(b.minimum_supported_version_code);
    need(typeof b.required === 'boolean' && typeof b.notes === 'string' && b.notes.length <= 8000, 'INVALID_RELEASE_POLICY');
    return this.store.operation(actor.id, project, key, 'release.create', b, () => {
      const a = this.store.one('SELECT data FROM artifacts WHERE project=? AND sha=?', project, b.artifact_sha256); need(a, 'ARTIFACT_NOT_VERIFIED', 409);
      let artifact = JSON.parse(a.data);
      need(artifact.format!=='aab','APK_UPDATER_REQUIRES_APK',409);
      const row = this.store.one('SELECT data FROM receipts WHERE id=? AND project=?', b.receipt_id, project); need(row, 'RECEIPT_MISSING', 409);
      const receipt = JSON.parse(row.data);
      need(receipt.commit === b.commit && receipt.artifact_sha256 === b.artifact_sha256 && receipt.toolchain.flutter === p.flutter_version, 'BASELINE_MISMATCH', 409);
      if (artifact.verification_source === 'manual_workstation_inspection' || receipt.mode === 'manual_workstation') {
        need(artifact.verification_source === 'manual_workstation_inspection' && receipt.mode === 'manual_workstation', 'INSPECTION_RECEIPT_MISMATCH', 409);
        const inspRow = this.store.one("SELECT signed FROM artifact_inspections WHERE id=? AND project=? AND artifact_sha256=? AND job_id='MANUAL_LOCAL' AND worker_id=? ORDER BY rowid DESC LIMIT 1", receipt.inspection_id ?? '', project, b.artifact_sha256, receipt.runner_id ?? '');
        need(inspRow, 'INSPECTION_RECEIPT_MISMATCH', 409);
        const signed = JSON.parse(inspRow.signed), inspection = signed.payload;
        const inspectorPrincipal = (this.config.principals ?? []).find(pr => pr.id === inspection.principal_id && pr.enabled === true);
        need(inspectorPrincipal, 'INSPECTION_PRINCIPAL_MISMATCH', 409);
        const secret = this.requireManualInspector(inspectorPrincipal, project, receipt.runner_id);
        const expected = createHmac('sha256', secret).update(canonical(inspection)).digest(), actual = Buffer.from(signed.signature ?? '', 'hex');
        need(actual.length === expected.length && timingSafeEqual(actual, expected), 'INSPECTION_SIGNATURE_INVALID', 401);
        need(inspection.commit === b.commit && inspection.artifact_sha256 === artifact.sha256 && inspection.package_id === artifact.package_id && inspection.signing_sha256 === artifact.signing_sha256 && inspection.size === artifact.size && inspection.version_code === artifact.version_code && inspection.format === 'apk', 'INSPECTION_SOURCE_MISMATCH', 409);
        artifact = {...artifact, inspection_id: inspection.id, inspected_by: inspection.worker_id, source_commit: inspection.commit, job_id: 'MANUAL_LOCAL'};
        need(BASE_GATES.every(name => receipt.gates.some(g => g.name === name && g.status === 'PASS' && g.exit_code === 0 && typeof g.evidence_sha256 === 'string' && /^[a-f0-9]{64}$/.test(g.evidence_sha256))), 'QUALITY_GATE_FAILED', 409);
      } else {
        if(artifact.verification_source==='workstation_signed_inspection') {
          need(this.config.requireAgentEnrollment===true,'WORKSTATION_ENROLLMENT_ENFORCEMENT_REQUIRED',409);
          const row=this.store.one('SELECT signed FROM artifact_inspections WHERE project=? AND artifact_sha256=? AND job_id=? AND lease_generation=? AND worker_id=? ORDER BY rowid DESC LIMIT 1',project,b.artifact_sha256,receipt.job_id??'',receipt.lease_generation??0,receipt.runner_id??'');
          need(row,'INSPECTION_RECEIPT_MISMATCH',409);
          const signed=JSON.parse(row.signed),inspection=signed.payload;
          const secret=this.config.runnerKeys?.[project]?.[receipt.runner_id];need(secret,'RUNNER_UNKNOWN',403);
          const expected=createHmac('sha256',secret).update(canonical(inspection)).digest(),actual=Buffer.from(signed.signature??'','hex');
          need(actual.length===expected.length&&timingSafeEqual(actual,expected),'INSPECTION_SIGNATURE_INVALID',401);
          const enrolled=this.store.one('SELECT principal_id,status FROM agent_enrollments WHERE project=? AND worker_id=?',project,receipt.runner_id);
          need(enrolled?.status==='ACTIVE'&&enrolled.principal_id===inspection.principal_id,'INSPECTION_PRINCIPAL_MISMATCH',409);
          need(inspection.commit===b.commit&&inspection.artifact_sha256===artifact.sha256&&inspection.package_id===artifact.package_id&&inspection.signing_sha256===artifact.signing_sha256&&inspection.size===artifact.size&&inspection.version_code===artifact.version_code&&inspection.format==='apk','INSPECTION_SOURCE_MISMATCH',409);
          // Bytes/metadata stay immutable. Each release binds its own accepted inspection, not the first upload's job.
          artifact={...artifact,inspection_id:inspection.id,inspected_by:inspection.worker_id,source_commit:inspection.commit,job_id:inspection.job_id};
        }
        need(BASE_GATES.every(name => receipt.gates.some(g => g.name === name && g.status === 'PASS' && g.exit_code === 0 && typeof g.evidence_sha256 === 'string' && /^[a-f0-9]{64}$/.test(g.evidence_sha256))), 'QUALITY_GATE_FAILED', 409);
        if (this.config.requireAgentEnrollment === true) {
          const job = typeof receipt.job_id === 'string'
            ? this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', receipt.job_id, project) : null;
          const agent = job && typeof receipt.runner_id === 'string'
            ? this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?', project, receipt.runner_id) : null;
          const fence = job ? this.store.one('SELECT generation FROM job_fences WHERE job_id=?', job.id) : null;
          need(job && job.state === 'SUCCEEDED' && agent?.status === 'ACTIVE' &&
            fence && receipt.lease_generation === fence.generation &&
            JSON.parse(job.data).commit === receipt.commit && JSON.parse(job.data).kind === 'apk',
            'AGENT_RELEASE_EVIDENCE_INVALID', 409);
        }
      }
      const maximum = Math.max(this.store.one('SELECT MAX(version_code) AS n FROM releases WHERE project=?', project)?.n ?? 0,p.installed_baseline_version_code??0);
      need(artifact.version_code > maximum, 'VERSION_CODE_REGRESSION', 409);
      need(b.minimum_supported_version_code <= artifact.version_code, 'INVALID_MINIMUM_VERSION');
      this.requireLaunchGate(project,b.commit,b.artifact_sha256);
      const r = {id: uuid(), project, artifact, ...b, created_by: actor.id, created_at: new Date().toISOString()};
      this.store.run('INSERT INTO releases VALUES(?,?,?,?)', r.id, project, artifact.version_code, canonical(r)); return r;
    });
  }
  release(project, id) { const r = this.store.one('SELECT data FROM releases WHERE project=? AND id=?', project, id); need(r, 'RELEASE_NOT_FOUND', 404); return JSON.parse(r.data); }
  approve(actor, project, key, b) {
    this.authorize(actor, project, 'approve'); fields(b, ['release_id', 'channel', 'release_digest']); channel(b.channel); sha(b.release_digest);
    return this.store.operation(actor.id, project, key, 'release.approve', b, () => {
      const r = this.release(project, b.release_id); need(hash(canonical(r)) === b.release_digest, 'APPROVAL_DIGEST_MISMATCH', 409);
      this.requireLaunchGate(project,r.commit,r.artifact.sha256);
      need(r.created_by !== actor.id, 'INDEPENDENT_APPROVER_REQUIRED', 403);
      const a = {...b, actor: actor.id, approved_at: new Date().toISOString()};
      this.store.run('INSERT INTO approvals VALUES(?,?,?,?) ON CONFLICT(release_id,channel) DO UPDATE SET actor=excluded.actor,data=excluded.data', r.id, b.channel, actor.id, canonical(a)); return a;
    });
  }
  promote(actor, project, key, b) {
    this.authorize(actor, project, 'release'); fields(b, ['release_id', 'channel', 'rollout_percent']); channel(b.channel); integer(b.rollout_percent, 1, 100);
    const p = this.project(project);
    return this.store.operation(actor.id, project, key, 'release.promote', b, () => {
      const r = this.release(project, b.release_id);
      this.requireLaunchGate(project,r.commit,r.artifact.sha256);
      if (b.channel !== 'staging') {
        need(this.store.one('SELECT 1 FROM approvals WHERE release_id=? AND channel=?', r.id, b.channel), 'APPROVAL_REQUIRED', 409);
        const staging = this.store.one('SELECT data FROM tracks WHERE project=? AND channel=?', project, 'staging');
        need(staging && JSON.parse(staging.data).release_id === r.id, 'STAGING_REQUIRED', 409);
        const receipts = this.store.all('SELECT data FROM receipts WHERE project=?', project).map(x=>JSON.parse(x.data))
          .filter(x=>x.commit === r.commit && x.artifact_sha256 === r.artifact.sha256 && x.toolchain.flutter === p.flutter_version && Date.parse(x.finished_at)>=Date.now()-7*86400000)
          .sort((a,b)=>Date.parse(b.finished_at)-Date.parse(a.finished_at));
        // Fresh failing evidence supersedes an older pass. Device receipts can arrive after staging.
        need(BASE_GATES.every(name => receipts.flatMap(x=>x.gates).find(g=>g.name === name)?.status === 'PASS'), 'QUALITY_GATE_FAILED', 409);
        need([...new Set(['install_launch','package_replacement',...p.required_device_gates])].every(name => receipts.flatMap(x=>x.gates).find(g=>g.name === name)?.status === 'PASS'), 'DEVICE_EVIDENCE_REQUIRED', 409);
      }
      const old = this.store.one('SELECT generation,data FROM tracks WHERE project=? AND channel=?', project, b.channel);
      if (old) { const prior = this.release(project, JSON.parse(old.data).release_id); need(r.artifact.version_code >= prior.artifact.version_code, 'NATIVE_ROLLBACK_REQUIRES_NEW_VERSION_CODE', 409); }
      const track = {...b, project, generation: (old?.generation ?? 0) + 1, published_at: new Date().toISOString()};
      this.store.run('INSERT INTO tracks VALUES(?,?,?,?) ON CONFLICT(project,channel) DO UPDATE SET generation=excluded.generation,data=excluded.data', project, b.channel, track.generation, canonical(track)); return track;
    });
  }
  manifest(project, track) {
    const p = this.project(project); channel(track);
    const row = this.store.one('SELECT data FROM tracks WHERE project=? AND channel=?', project, track); need(row, 'NO_RELEASE', 404);
    const t = JSON.parse(row.data), r = this.release(project, t.release_id);
    return envelope({schema: 1, project_id: project, package_id: p.package_id, channel: track, generation: t.generation,
      release_id: r.id, version: r.artifact.version, version_code: r.artifact.version_code, signing_sha256: r.artifact.signing_sha256,
      architectures: r.artifact.architectures, minimum_android_sdk: r.artifact.minimum_android_sdk,
      sha256: r.artifact.sha256, size: r.artifact.size, artifact_url: `${this.config.publicUrl}/v1/projects/${project}/artifacts/${r.artifact.sha256}`,
      minimum_supported_version_code: r.minimum_supported_version_code, required: r.required, rollout_percent: t.rollout_percent,
      notes: r.notes, source_commit: r.commit, published_at: t.published_at, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
    }, this.config.manifestKey, this.config.manifestKeyId);
  }


  // ---------------------------------------------------------------------------
  // Local build agent control (EK4-LAUNCH-AGENT-002). All state stays in the one
  // existing SQLite store; enforcement is opt-in via requireAgentEnrollment.
  // ---------------------------------------------------------------------------
  get maxAttempts() { const n = this.config.maxJobAttempts ?? 3; return Number.isSafeInteger(n) && n >= 1 && n <= 10 ? n : 3; }
  get presenceWindowMs() { const n = this.config.presenceWindowMs ?? 90000; return Number.isSafeInteger(n) && n >= 15000 ? n : 90000; }
  enrollment(actor, project, workerId) {
    this.authorize(actor, project, 'build');
    slug(workerId);
    if (this.config.requireAgentEnrollment !== true) return null;
    const row = this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?', project, workerId);
    need(row && row.status === 'ACTIVE' && row.principal_id === actor.id, 'AGENT_NOT_ENROLLED', 403);
    return row;
  }
  enrollAgent(actor, project, key, body) {
    this.authorize(actor, project, 'registry'); this.project(project);
    fields(body, ['worker_id', 'principal_id', 'platform', 'capabilities']);
    slug(body.worker_id); slug(body.principal_id);
    need(['linux', 'windows', 'macos'].includes(body.platform), 'AGENT_PLATFORM_INVALID');
    need(Array.isArray(body.capabilities) && body.capabilities.length >= 1 &&
      body.capabilities.length <= JOB_KINDS.length && new Set(body.capabilities).size === body.capabilities.length &&
      body.capabilities.every(kind => JOB_KINDS.includes(kind)), 'AGENT_CAPABILITIES_INVALID');
    need(body.principal_id !== actor.id, 'AGENT_ADMIN_IDENTITY_REUSE_FORBIDDEN', 403);
    const principal = (this.config.principals ?? []).find(p => p.id === body.principal_id && p.enabled === true);
    need(principal && principal.permissions.includes('build') &&
      principal.permissions.every(permission => ['build', 'read'].includes(permission)) &&
      principal.projects.length === 1 && principal.projects[0] === project &&
      this.config.runnerKeys?.[project]?.[body.worker_id],
      'AGENT_PRINCIPAL_OR_RECEIPT_KEY_MISSING', 403);
    return this.store.operation(actor.id, project, key, 'agent.enroll', body, () => {
      const previous = this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?', project, body.worker_id);
      need(!previous || previous.status === 'REVOKED', 'AGENT_ALREADY_ENROLLED', 409);
      const currentRunnerKey = this.config.runnerKeys?.[project]?.[body.worker_id] ?? '';
      const currentRunnerKeySha = currentRunnerKey ? hash(currentRunnerKey) : '0'.repeat(64);
      if (previous && previous.status === 'REVOKED') {
        need(body.principal_id !== previous.principal_id, 'AGENT_CREDENTIAL_ROTATION_REQUIRED', 409);
      }
      const revokedCred = this.store.one(
        'SELECT principal_id, runner_key_sha256 FROM agent_revocations WHERE project=? AND worker_id=? AND (principal_id=? OR runner_key_sha256=?)',
        project, body.worker_id, body.principal_id, currentRunnerKeySha
      );
      if (revokedCred) {
        need(revokedCred.principal_id !== body.principal_id, 'AGENT_CREDENTIAL_ROTATION_REQUIRED', 409);
        need(revokedCred.runner_key_sha256 !== currentRunnerKeySha, 'AGENT_RUNNER_KEY_ROTATION_REQUIRED', 409);
      }
      const other = this.store.one("SELECT worker_id FROM agent_enrollments WHERE project=? AND principal_id=? AND status='ACTIVE'", project, body.principal_id);
      need(!other, 'AGENT_PRINCIPAL_ALREADY_ASSIGNED', 409);
      const now = new Date().toISOString();
      this.store.run(
        'INSERT INTO agent_enrollments(project,worker_id,principal_id,platform,capabilities,status,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,worker_id) DO UPDATE SET principal_id=excluded.principal_id,platform=excluded.platform,capabilities=excluded.capabilities,status=excluded.status,updated_at=excluded.updated_at',
        project, body.worker_id, body.principal_id, body.platform, canonical(body.capabilities), 'ACTIVE', now
      );
      return {worker_id:body.worker_id,principal_id:body.principal_id,platform:body.platform,
        capabilities:body.capabilities,status:'ACTIVE',updated_at:now};
    });
  }
  revokeAgent(actor, project, key, body) {
    this.authorize(actor, project, 'registry'); this.project(project);
    fields(body, ['worker_id']); slug(body.worker_id);
    return this.store.operation(actor.id, project, key, 'agent.revoke', body, () => {
      const row = this.store.one('SELECT * FROM agent_enrollments WHERE project=? AND worker_id=?', project, body.worker_id);
      need(row, 'AGENT_UNKNOWN', 404);
      const runnerKey = this.config.runnerKeys?.[project]?.[body.worker_id] ?? '';
      const runnerKeySha = runnerKey ? hash(runnerKey) : '0'.repeat(64);
      const now = new Date().toISOString();
      this.store.run("UPDATE agent_enrollments SET status='REVOKED',updated_at=? WHERE project=? AND worker_id=?", now, project, body.worker_id);
      this.store.run(
        'INSERT OR REPLACE INTO agent_revocations(project,worker_id,principal_id,runner_key_sha256,revoked_at) VALUES(?,?,?,?,?)',
        project, body.worker_id, row.principal_id, runnerKeySha, now
      );
      const owned = this.store.all("SELECT id FROM jobs WHERE project=? AND state='RUNNING' AND owner=?", project, row.principal_id+':'+body.worker_id);
      for (const job of owned) {
        // Advance the fence so any in-flight heartbeat/receipt from the revoked lease is stale.
        this.store.run('UPDATE job_fences SET generation=generation+1 WHERE job_id=?', job.id);
        this.store.run("UPDATE jobs SET state='QUEUED',owner=NULL,lease_until=NULL WHERE id=?", job.id);
      }
      this.store.run("UPDATE agent_presence SET activity='DRAINING' WHERE project=? AND worker_id=?", project, body.worker_id);
      return {worker_id:body.worker_id,status:'REVOKED',interruptedJobs:owned.length,
        credentialRotationRequired:true, updated_at:now};
    });
  }
  presence(actor, project, body) {
    fields(body, ['worker_id', 'presence']); slug(body.worker_id);
    const enrolled = this.enrollment(actor, project, body.worker_id);
    need(enrolled, 'AGENT_PRESENCE_REQUIRES_ENROLLMENT', 409);
    this.recordPresence(project, body.worker_id, body.presence);
    return {worker_id: body.worker_id, recorded: true, presence_window_seconds: this.presenceWindowMs / 1000, directive: this.directive(project, body.worker_id)};
  }
  recordPresence(project, workerId, p, activityOverride = null) {
    fields(p, ['activity'], ['agent_version', 'os_release', 'toolchain', 'resources', 'contact_interval_seconds']);
    // Metered agents poll rarely; they declare their maximum contact interval so presence stays truthful.
    need(p.contact_interval_seconds === undefined || (Number.isSafeInteger(p.contact_interval_seconds) && p.contact_interval_seconds >= 10 && p.contact_interval_seconds <= 3600), 'PRESENCE_INVALID');
    need(['IDLE', 'BUSY', 'DRAINING'].includes(p.activity), 'PRESENCE_INVALID');
    const text = (v, n = 80) => v === undefined || (typeof v === 'string' && v.length <= n && /^[\x20-\x7E]*$/.test(v));
    need(text(p.agent_version, 40) && text(p.os_release, 120), 'PRESENCE_INVALID');
    if (p.toolchain !== undefined) {
      fields(p.toolchain, [], ['flutter', 'dart', 'java', 'node', 'python']);
      need(Object.values(p.toolchain).every(v => text(v, 120)), 'PRESENCE_INVALID');
    }
    if (p.resources !== undefined) {
      fields(p.resources, [], ['cpu_count', 'memory_free_bytes', 'memory_total_bytes', 'disk_free_bytes', 'load_average', 'enforcement', 'pressure']);
      const r = p.resources;
      for (const k of ['cpu_count', 'memory_free_bytes', 'memory_total_bytes', 'disk_free_bytes']) need(r[k] === undefined || (Number.isSafeInteger(r[k]) && r[k] >= 0), 'PRESENCE_INVALID');
      need(r.load_average === undefined || (typeof r.load_average === 'number' && Number.isFinite(r.load_average) && r.load_average >= 0), 'PRESENCE_INVALID');
      need(r.enforcement === undefined || ['systemd-scope', 'windows-job-object', 'watchdog-soft', 'none'].includes(r.enforcement), 'PRESENCE_INVALID');
      need(r.pressure === undefined || ['OK', 'HIGH', 'CRITICAL'].includes(r.pressure), 'PRESENCE_INVALID');
    }
    const activity = activityOverride ?? p.activity;
    this.store.run('INSERT INTO agent_presence(project,worker_id,last_seen_at,activity,data) VALUES(?,?,?,?,?) ON CONFLICT(project,worker_id) DO UPDATE SET last_seen_at=excluded.last_seen_at,activity=excluded.activity,data=excluded.data',
      project, workerId, Date.now(), activity, canonical(p));
  }
  touchPresence(project, workerId, activity) {
    this.store.run('UPDATE agent_presence SET last_seen_at=?,activity=? WHERE project=? AND worker_id=?', Date.now(), activity, project, workerId);
  }
  directive(project, workerId) {
    return this.store.one('SELECT desired FROM agent_directives WHERE project=? AND worker_id=?', project, workerId)?.desired ?? 'ACTIVE';
  }
  controlAgent(actor, project, key, body) {
    this.authorize(actor, project, 'agents.control'); this.project(project);
    fields(body, ['worker_id', 'desired']); slug(body.worker_id);
    need(['ACTIVE', 'PAUSED', 'STOP'].includes(body.desired), 'AGENT_DIRECTIVE_INVALID');
    return this.store.operation(actor.id, project, key, 'agent.control', body, () => {
      const row = this.store.one('SELECT status FROM agent_enrollments WHERE project=? AND worker_id=?', project, body.worker_id);
      need(row, 'AGENT_UNKNOWN', 404);
      const now = new Date().toISOString();
      this.store.run('INSERT INTO agent_directives(project,worker_id,desired,actor,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(project,worker_id) DO UPDATE SET desired=excluded.desired,actor=excluded.actor,updated_at=excluded.updated_at',
        project, body.worker_id, body.desired, actor.id, now);
      return {worker_id: body.worker_id, desired: body.desired, effective: 'AT_NEXT_AGENT_CONTACT', updated_at: now};
    });
  }
  agentList(actor, project) {
    this.authorize(actor, project, 'read'); this.project(project);
    const now = Date.now(), win = this.presenceWindowMs;
    const presence = new Map(this.store.all('SELECT * FROM agent_presence WHERE project=?', project).map(r => [r.worker_id, r]));
    return {presence_window_seconds: win / 1000, agents:this.store.all('SELECT worker_id,principal_id,platform,capabilities,status,updated_at FROM agent_enrollments WHERE project=? ORDER BY worker_id',project)
      .map(row => {
        const p = presence.get(row.worker_id), data = p ? JSON.parse(p.data) : null;
        return {...row, capabilities:JSON.parse(row.capabilities),
          presence: !p ? 'NEVER_SEEN' : (row.status === 'ACTIVE' && now - p.last_seen_at <= Math.max(win, (data?.contact_interval_seconds ?? 0) * 1500) ? 'ONLINE' : 'OFFLINE'),
          contact_interval_seconds: data?.contact_interval_seconds ?? null, desired_state: this.directive(project, row.worker_id),
          last_seen_at: p ? new Date(p.last_seen_at).toISOString() : null, activity: p?.activity ?? null,
          agent_version: data?.agent_version ?? null, os_release: data?.os_release ?? null,
          toolchain: data?.toolchain ?? null, resources: data?.resources ?? null};
      })};
  }
  jobView(row) {
    const fence = this.store.one('SELECT generation FROM job_fences WHERE job_id=?', row.id);
    const outcome = this.store.one('SELECT reason FROM job_outcomes WHERE job_id=?', row.id);
    return {...row, data: JSON.parse(row.data), attempts: fence?.generation ?? null, outcome_reason: outcome?.reason ?? null};
  }
  jobList(actor, project, limit) {
    this.authorize(actor, project, 'read'); this.project(project);
    return {items: this.store.all('SELECT * FROM jobs WHERE project=? ORDER BY rowid DESC LIMIT ?', project, limit).map(r => this.jobView(r))};
  }
  jobDetail(actor, project, id) {
    this.authorize(actor, project, 'read'); this.project(project);
    const row = this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', id, project); need(row, 'JOB_NOT_FOUND', 404);
    const receipts = this.store.all('SELECT data FROM receipts WHERE project=?', project).map(x => JSON.parse(x.data)).filter(x => x.job_id === id)
      .map(x => ({id:x.id, commit:x.commit, artifact_sha256:x.artifact_sha256, runner_id:x.runner_id, started_at:x.started_at, finished_at:x.finished_at,
        lease_generation:x.lease_generation ?? null, toolchain:x.toolchain, gates:x.gates, resource_enforcement:x.resource_enforcement ?? null}));
    return {job: this.jobView(row), receipts};
  }
  approvalList(actor, project) {
    this.authorize(actor, project, 'read'); this.project(project);
    return {items: this.store.all('SELECT a.release_id,a.channel,a.actor,a.data FROM approvals a JOIN releases r ON r.id=a.release_id WHERE r.project=? ORDER BY a.rowid DESC LIMIT 200', project)
      .map(r => ({release_id:r.release_id, channel:r.channel, actor:r.actor, approved_at:JSON.parse(r.data).approved_at ?? null}))};
  }
  outcome(jobId, state, reason, actor) {
    this.store.run('INSERT INTO job_outcomes(job_id,state,reason,actor,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET state=excluded.state,reason=excluded.reason,actor=excluded.actor,updated_at=excluded.updated_at',
      jobId, state, reason, actor, new Date().toISOString());
  }
  enqueue(actor, project, key, b) {
    need(actor && (actor.permissions.includes('build') || actor.permissions.includes('enqueue')), 'FORBIDDEN', 403);
    this.authorize(actor, project, actor.permissions.includes('build') ? 'build' : 'enqueue');
    // 'enqueue'-only principals (e.g. Studio operator) may trigger quality/debug work, never release builds.
    need(actor.permissions.includes('build') || !['apk','aab'].includes(b?.kind), 'RELEASE_BUILD_REQUIRES_LAUNCH_OS', 403); this.project(project); fields(b, ['commit', 'kind'], ['base_commit', 'release_version']); commit(b.commit);
    need([...JOB_KINDS, 'patch'].includes(b.kind), 'INVALID_JOB_KIND');
    need(b.kind !== 'patch', 'PATCH_USE_APPROVAL_GATED_PROVIDER_CLI', 409);
    return this.store.operation(actor.id, project, key, 'job.enqueue', b, () => {
      const job = {id: uuid(), project, created_at:new Date().toISOString(), ...b}; this.store.run('INSERT INTO jobs VALUES(?,?,?,NULL,NULL,?)', job.id, project, 'QUEUED', canonical(job)); return job;
    });
  }
  cancel(actor, project, id, key, b) {
    this.authorize(actor, project, 'cancel'); this.project(project);
    fields(b ?? {}, [], ['reason']);
    need(b?.reason === undefined || (typeof b.reason === 'string' && /^[A-Za-z0-9 _.:-]{1,120}$/.test(b.reason)), 'INVALID_CANCEL_REASON');
    return this.store.operation(actor.id, project, key, 'job.cancel', {id, ...(b ?? {})}, () => {
      const row = this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', id, project); need(row, 'JOB_NOT_FOUND', 404);
      need(['QUEUED', 'RUNNING'].includes(row.state), 'JOB_ALREADY_TERMINAL', 409);
      this.store.run('UPDATE job_fences SET generation=generation+1 WHERE job_id=?', id);
      this.store.run("UPDATE jobs SET state='CANCELLED',owner=NULL,lease_until=NULL WHERE id=?", id);
      this.outcome(id, 'CANCELLED', 'CANCELLED_BY_OPERATOR', actor.id);
      return {id, state: 'CANCELLED', previous_state: row.state};
    });
  }
  expireLeases(project, now) {
    const expired = this.store.all("SELECT j.id, f.generation FROM jobs j LEFT JOIN job_fences f ON f.job_id=j.id WHERE j.project=? AND j.state='RUNNING' AND j.lease_until<?", project, now);
    for (const job of expired) {
      if (job.generation != null && job.generation >= this.maxAttempts) {
        // Crash-loop protection: a job that lost its lease maxAttempts times is not retried forever.
        this.store.run("UPDATE jobs SET state='FAILED',owner=NULL,lease_until=NULL WHERE id=?", job.id);
        this.outcome(job.id, 'FAILED', 'ATTEMPTS_EXHAUSTED', 'system');
      } else this.store.run("UPDATE jobs SET state='QUEUED',owner=NULL,lease_until=NULL WHERE id=?", job.id);
    }
  }
  claim(actor, project, key, b) {
    this.authorize(actor, project, 'build'); fields(b, ['worker_id'], ['presence']); slug(b.worker_id);
    const enrolled = this.enrollment(actor, project, b.worker_id);
    need(b.presence === undefined || enrolled, 'AGENT_PRESENCE_REQUIRES_ENROLLMENT', 409);
    return this.store.operation(actor.id, project, key, 'job.claim', b, () => {
      const now = Date.now(), owner = `${actor.id}:${b.worker_id}`;
      if (enrolled) this.expireLeases(project, now);
      else this.store.run("UPDATE jobs SET state='QUEUED',owner=NULL,lease_until=NULL WHERE project=? AND state='RUNNING' AND lease_until<?", project, now);
      const acceptedKinds = enrolled ? JSON.parse(enrolled.capabilities) : [];
      const directive = enrolled ? this.directive(project, b.worker_id) : 'ACTIVE';
      // A restarted agent (crash, reboot, lost claim response) re-acquires its own live lease under a new fence.
      const own = enrolled ? this.store.one("SELECT * FROM jobs WHERE project=? AND state='RUNNING' AND owner=? AND lease_until>=? ORDER BY rowid LIMIT 1", project, owner, now) : null;
      const row = own ?? (directive !== 'ACTIVE' ? null : enrolled
        ? this.store.one("SELECT * FROM jobs WHERE project=? AND state='QUEUED' AND json_extract(data, '$.kind') IN (" +
          acceptedKinds.map(() => '?').join(',') + ") ORDER BY rowid LIMIT 1", project, ...acceptedKinds)
        : this.store.one("SELECT * FROM jobs WHERE project=? AND state='QUEUED' ORDER BY rowid LIMIT 1", project));
      if (enrolled && b.presence) this.recordPresence(project, b.worker_id, b.presence, row ? 'BUSY' : null);
      if (!row) return enrolled ? {job: null, directive} : {job: null};
      const lease = now + 300000;
      this.store.run("UPDATE jobs SET state='RUNNING',owner=?,lease_until=? WHERE id=?", owner, lease, row.id);
      if (enrolled) {
        this.store.run('INSERT INTO job_fences(job_id,generation) VALUES(?,1) ON CONFLICT(job_id) DO UPDATE SET generation=generation+1', row.id);
        const generation=this.store.one('SELECT generation FROM job_fences WHERE job_id=?',row.id).generation;
        return {job:JSON.parse(row.data),lease_until:lease,lease_generation:generation,max_attempts:this.maxAttempts,directive,...(own?{recovered:true}:{})};
      }
      return {job: JSON.parse(row.data), lease_until: lease};
    });
  }
  jobUpdate(actor, project, id, key, b) {
    this.authorize(actor, project, 'build'); fields(b, ['worker_id', 'state'], ['lease_generation', 'reason']); slug(b.worker_id); need(['RUNNING', 'FAILED', 'SUCCEEDED'].includes(b.state), 'INVALID_JOB_STATE');
    need(b.reason === undefined || (b.state === 'FAILED' && typeof b.reason === 'string' && /^[A-Z][A-Z0-9_:]{2,80}$/.test(b.reason)), 'INVALID_FAILURE_REASON');
    const enrolled = this.enrollment(actor, project, b.worker_id);
    if (enrolled) need(Number.isSafeInteger(b.lease_generation) && b.lease_generation > 0, 'LEASE_GENERATION_REQUIRED', 409);
    return this.store.operation(actor.id, project, key, 'job.update', {id, ...b}, () => {
      const r = this.store.one('SELECT * FROM jobs WHERE id=? AND project=?', id, project);
      need(r && r.owner === `${actor.id}:${b.worker_id}` && r.state === 'RUNNING' && r.lease_until > Date.now(), r?.state === 'CANCELLED' ? 'JOB_CANCELLED' : 'LEASE_LOST', 409);
      if (enrolled) {
        const fence=this.store.one('SELECT generation FROM job_fences WHERE job_id=?',id);
        need(fence && fence.generation === b.lease_generation,'LEASE_FENCED',409);
      }
      if (b.state === 'SUCCEEDED') {
        const job=JSON.parse(r.data);
        // Latest matching receipt wins: newer failing evidence supersedes an older pass for the same lease.
        const evidence=this.store.all('SELECT data FROM receipts WHERE project=? ORDER BY rowid DESC',project).map(x=>JSON.parse(x.data)).find(x=>x.job_id===id && x.commit===job.commit && Date.parse(x.started_at)>=Date.parse(job.created_at) &&
          (!enrolled || (x.lease_generation === b.lease_generation && x.runner_id === b.worker_id)));
        const required=REQUIRED_GATES[job.kind] ?? BASE_GATES;
        need(evidence && required.every(name=>evidence.gates.some(g=>g.name===name && g.status==='PASS' && g.exit_code===0)), 'EXECUTION_RECEIPT_REQUIRED', 409);
      }
      this.store.run('UPDATE jobs SET state=?,lease_until=? WHERE id=?', b.state, b.state === 'RUNNING' ? Date.now() + 300000 : null, id);
      if (b.state === 'FAILED') this.outcome(id, 'FAILED', 'WORKER_FAILURE:' + (b.reason ?? 'UNSPECIFIED'), actor.id);
      if (b.state === 'SUCCEEDED') this.outcome(id, 'SUCCEEDED', 'RECEIPT_VERIFIED', actor.id);
      if (enrolled) this.touchPresence(project, b.worker_id, b.state === 'RUNNING' ? 'BUSY' : 'IDLE');
      return {id, state: b.state};
    });
  }
}

