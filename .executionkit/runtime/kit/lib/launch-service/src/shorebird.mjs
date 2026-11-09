import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {need, integer, channel, canonical, hash, commit} from './contracts.mjs';
export function shorebirdCommand(action, p, input) {
  need(/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(p.shorebird_app_id ?? ''), 'SHOREBIRD_APP_NOT_REGISTERED');
  need(/^\d+\.\d+\.\d+\+\d+$/.test(input.release_version ?? ''), 'EXPLICIT_BASE_RELEASE_REQUIRED');
  const identity = ['--app-id', p.shorebird_app_id];
  if (action === 'release') return ['release', 'android', '--artifact', 'apk', '--flutter-version', p.flutter_version, '--public-key-path', input.public_key_path];
  if (action === 'validate' || action === 'patch') return ['patch', 'android', '--release-version', input.release_version, '--track', 'staging', '--public-key-path', input.public_key_path, '--private-key-path', input.private_key_path, ...(action === 'validate' ? ['--dry-run'] : [])];
  if (action === 'history') return ['patches', 'list', '--release-version', input.release_version, ...identity, '--json'];
  if (action === 'promote') { channel(input.track); integer(input.patch_number); return ['patches', 'set-track', '--release', input.release_version, '--patch', String(input.patch_number), '--track', input.track, ...identity, '--json']; }
  if (action === 'rollback') { integer(input.patch_number); return ['patches', 'rollback', '--release-version', input.release_version, '--patch-number', String(input.patch_number), ...identity, '--json']; }
  throw Error('Unsupported Shorebird operation');
}
export async function providerRun(args, cwd, logPath, timeout = 3600000, signingEnv = []) {
  need(args.every(a => typeof a === 'string' && a.length > 0 && !a.startsWith('--allow-')), 'UNSAFE_PROVIDER_ARGUMENT');
  // Token is process environment only. No command interpolation or arbitrary shell.
  const allow=['PATH','HOME','JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','PUB_CACHE','GRADLE_USER_HOME','LANG','HTTPS_PROXY','HTTP_PROXY','NO_PROXY','SHOREBIRD_TOKEN'];
  for(const name of signingEnv){need(/^[A-Z][A-Z0-9_]+$/.test(name)&&!/^MOBILE_|^SHOREBIRD_/.test(name),'INVALID_SIGNING_ENV');allow.push(name);}
  const env=Object.fromEntries(allow.filter(name=>process.env[name]!=null).map(name=>[name,process.env[name]]));env.CI='true';
  const chunks = []; const secrets = [process.env.SHOREBIRD_TOKEN,...signingEnv.map(name=>process.env[name])].filter(Boolean);
  return new Promise((resolvePromise, reject) => {
    const child = spawn('shorebird', args, {cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'});
    let length = 0; const collect = chunk => { length += chunk.length; if (length <= 2 * 1024 * 1024) chunks.push(chunk); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }, timeout);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', async code => {
      clearTimeout(timer); let text = Buffer.concat(chunks).toString(); for (const s of secrets) text = text.replaceAll(s, '[REDACTED]');
      await writeFile(logPath, text, {mode: 0o600});
      if (code !== 0) return reject(Error('SHOREBIRD_COMMAND_FAILED; inspect protected runner evidence'));
      resolvePromise({exit_code: code, evidence_sha256: hash(text)});
    });
  });
}
export async function signedApproval(path, secret, expected) {
  need(typeof secret==='string' && secret.length>=32,'APPROVAL_KEY_REQUIRED');
  const approval = JSON.parse(await readFile(path, 'utf8'));
  need(approval.payload?.expires_at && Date.parse(approval.payload.expires_at) > Date.now(), 'APPROVAL_EXPIRED');
  for (const [k, v] of Object.entries(expected)) need(approval.payload[k] === v, 'APPROVAL_SCOPE_MISMATCH', 403);
  const signature = createHmac('sha256', secret).update(canonical(approval.payload)).digest();
  const supplied = Buffer.from(approval.signature ?? '', 'hex');
  need(supplied.length === signature.length && timingSafeEqual(signature, supplied), 'APPROVAL_SIGNATURE_INVALID', 403);
  return approval.payload;
}
export async function verifiedQuality(p,input,required=['analyze','unit','widget']) {
  commit(input.commit);
  const quality=JSON.parse(await readFile(input.quality_path,'utf8'));
  need(process.env.MOBILE_RELEASE_RUNNER_KEY?.length>=32,'RUNNER_KEY_REQUIRED');
  const expected=createHmac('sha256',process.env.MOBILE_RELEASE_RUNNER_KEY).update(canonical(quality.payload)).digest();
  const actual=Buffer.from(quality.signature??'','hex');
  need(actual.length===expected.length && timingSafeEqual(actual,expected),'QUALITY_RECEIPT_SIGNATURE_INVALID');
  const b=quality.payload,finished=Date.parse(b.finished_at);
  need(b.project===p.id && b.commit===input.commit && b.toolchain?.flutter===p.flutter_version,'PATCH_BASELINE_MISMATCH');
  need(Number.isFinite(finished)&&finished>=Date.now()-86400000&&finished<=Date.now()+300000,'QUALITY_RECEIPT_STALE');
  need(required.every(name=>b.gates.some(g=>g.name===name&&g.status==='PASS'&&g.exit_code===0)),'QUALITY_GATE_FAILED');
  const cwd=resolve(input.workspace);
  const exec=(await import('node:child_process')).execFileSync;
  need(exec('git',['-C',cwd,'rev-parse','HEAD'],{encoding:'utf8'}).trim()===input.commit,'WORKTREE_COMMIT_MISMATCH');
  need(exec('git',['-C',cwd,'status','--porcelain'],{encoding:'utf8'}).trim()==='','DIRTY_WORKTREE');
  const yaml=await readFile(join(cwd,'shorebird.yaml'),'utf8');
  need(new RegExp('^app_id:\\s*'+p.shorebird_app_id+'\\s*$', 'm').test(yaml)&&/auto_update:\s*false/.test(yaml),'SHOREBIRD_CONFIGURATION_MISMATCH');
  need(p.shorebird_public_key_sha256&&hash(await readFile(input.public_key_path))===p.shorebird_public_key_sha256,'PATCH_SIGNING_BASELINE_UNKNOWN_OR_MISMATCH');
  const version=(await readFile(join(cwd,'pubspec.yaml'),'utf8')).match(/^version:\s*([^\s#]+)/m)?.[1];
  if(required.includes('apk_build')) need(version===input.release_version,'BASE_RELEASE_VERSION_MISMATCH');
  return b;
}
export async function patchPipeline(p, input, run = providerRun) {
  commit(input.commit); commit(input.base_commit);
  const classification = JSON.parse(await readFile(input.classification_path, 'utf8'));
  need(classification.classification === 'DART_PATCH_ELIGIBLE' && classification.source_commit === input.commit && classification.base_commit === input.base_commit, 'PATCH_CLASSIFICATION_REJECTED', 409);
  need(process.env.SHOREBIRD_TOKEN, 'SHOREBIRD_TOKEN_REQUIRED');
  need(process.env.MOBILE_RELEASE_APPROVAL_KEY?.length >= 32, 'PROVIDER_APPROVAL_KEY_REQUIRED');
  // Operator confirms account limits/no unintended paid overages and this exact source/baseline.
  const approval=await signedApproval(input.approval_path, process.env.MOBILE_RELEASE_APPROVAL_KEY, {project: p.id, action: 'patch.staging', commit: input.commit, base_commit: input.base_commit, release_version: input.release_version});
  need(approval.billing_reviewed===true && approval.automatic_overages_allowed===false && approval.account_evidence_sha256, 'BILLING_REVIEW_REQUIRED');
  need(p.shorebird_public_key_sha256 && hash(await readFile(input.public_key_path))===p.shorebird_public_key_sha256, 'PATCH_SIGNING_BASELINE_UNKNOWN_OR_MISMATCH');
  await verifiedQuality(p,input);
  const cwd = resolve(input.workspace);
  const yaml = await readFile(join(cwd, 'shorebird.yaml'), 'utf8');
  need(new RegExp('^app_id:\\s*'+p.shorebird_app_id+'\\s*$', 'm').test(yaml) && /auto_update:\s*false/.test(yaml), 'SHOREBIRD_CONFIGURATION_MISMATCH');
  const actual = (await import('node:child_process')).execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(); need(actual === input.commit, 'WORKTREE_COMMIT_MISMATCH');
  const dirty = (await import('node:child_process')).execFileSync('git', ['-C', cwd, 'status', '--porcelain'], {encoding: 'utf8'}); need(dirty.trim() === '', 'DIRTY_WORKTREE');
  await mkdir(input.evidence_dir, {recursive: true, mode: 0o700});
  const validation = await run(shorebirdCommand('validate', p, input), cwd, join(input.evidence_dir, 'shorebird-compatibility.log'));
  const published = await run(shorebirdCommand('patch', p, input), cwd, join(input.evidence_dir, 'shorebird-staging.log'));
  return {project: p.id, commit: actual, base_commit: input.base_commit, release_version: input.release_version, track: 'staging', compatibility: validation, publication: published, status: 'PUBLISHED_STAGING_REQUIRES_DEVICE_VALIDATION'};
}
