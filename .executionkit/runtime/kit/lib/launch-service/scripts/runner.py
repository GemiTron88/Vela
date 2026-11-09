#!/usr/bin/env python3
"""Fixed-command build runner; source executes only inside an operator-approved disposable worktree.
Run on a dedicated non-admin account/workstation with resource limits, never the production Laravel user.
Every subprocess is a fixed argv from this file executed through scripts/supervisor.py; nothing from HTTP
is ever evaluated as a command.
"""
import argparse, hashlib, hmac, json, os, re, shutil, signal, subprocess, sys, tempfile, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cache_policy import prepare_cache
from supervisor import run_limited, resolve_command, select_backend  # noqa: E402

IS_WINDOWS = os.name == 'nt'
LIMITS = {}
REPORTS = []


def canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
def now(): return datetime.now(timezone.utc).isoformat()


def run(args, cwd, env, log, timeout=1800):
    code, report = run_limited(args, str(cwd), env, str(log), timeout, {**LIMITS, 'marker': LIMITS.get('marker_prefix', 'runner') + '-' + log.stem})
    REPORTS.append({'step': log.stem, 'exit_code': code, **report})
    return code


def repo_id(value):
    """Normalize GitHub remotes (https, scp-like ssh, ssh://) to lowercase owner/name or None."""
    m = re.fullmatch(r'(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?/?', value.strip())
    return m.group(1).lower() if m else None


class HostLock:
    """Host-wide single build lock (fcntl on POSIX, msvcrt on Windows). Non-blocking: a second
    concurrent runner fails fast with HOST_BUSY instead of oversubscribing the workstation."""
    def __init__(self, path):
        self.handle = open(path, 'a+')
        try:
            if IS_WINDOWS:
                import msvcrt
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise ValueError('HOST_BUSY')

    def release(self):
        try:
            if IS_WINDOWS:
                import msvcrt
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.handle, fcntl.LOCK_UN)
        finally:
            self.handle.close()


def sanitized_env(root, project):
    # Strip service/runner/provider/signing credentials from quality commands.
    allow = ['PATH', 'HOME', 'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'LANG', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'FLUTTER_ROOT','MOBILE_ANDROID_TOOLS']
    if IS_WINDOWS:
        allow += ['SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA',
                  'APPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']
    env = {k: os.environ[k] for k in allow if k in os.environ}
    env['CI'] = 'true'
    env['PUB_CACHE'] = str(root / 'cache' / project / 'pub')
    env['GRADLE_OPTS']='-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.workers.max='+str(max(1,min(4,LIMITS.get('cpu_cores') or 1)))+' -Dorg.gradle.jvmargs=-Xmx'+str(max(256,min(2048,(LIMITS.get('memory_mb') or 6144)//3)))+'m'
    env['GRADLE_USER_HOME'] = str(root / 'cache' / project / 'gradle')
    return env


def gate(name, code, log):
    return {'name': name, 'status': 'PASS' if code == 0 else 'FAIL', 'exit_code': code, 'evidence_sha256': hashlib.sha256(log.read_bytes()).hexdigest()}


def main():
    from host_policy import require_workstation
    require_workstation()
    def terminate(signum, frame): raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, terminate)
    if IS_WINDOWS and hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, terminate)
    p = argparse.ArgumentParser()
    p.add_argument('--project', required=True); p.add_argument('--repository', required=True)
    p.add_argument('--commit', required=True); p.add_argument('--evidence', required=True); p.add_argument('--work-root', required=True)
    p.add_argument('--offline', action='store_true'); p.add_argument('--apk', action='store_true'); p.add_argument('--debug-apk', action='store_true');p.add_argument('--aab',action='store_true')
    p.add_argument('--signing-approval'); p.add_argument('--job-id'); p.add_argument('--lease-generation', type=int)
    p.add_argument('--cpu-cores', type=int); p.add_argument('--memory-mb', type=int); p.add_argument('--max-processes', type=int)
    p.add_argument('--min-free-disk-gb', type=int, default=8); p.add_argument('--step-timeout-minutes', type=int, default=30)
    p.add_argument('--report-enforcement', action='store_true');p.add_argument('--require-hard-limits',action='store_true');p.add_argument('--max-scratch-bytes',type=int,default=16*1024**3);p.add_argument('--max-cache-bytes',type=int,default=8*1024**3)
    a = p.parse_args()
    if sum([a.apk,a.debug_apk,a.aab])>1: raise ValueError('APK_MODE_CONFLICT')
    if sys.platform.startswith('linux') and any(Path(p).exists() for p in ['/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp']):raise ValueError('PRODUCTION_CWP_BUILDER_FORBIDDEN')
    if a.require_hard_limits and select_backend() not in ['windows-job-object','systemd-scope']:raise ValueError('KERNEL_RESOURCE_LIMITS_REQUIRED')
    config = json.loads(Path(a.project).read_text()); project = config['id']; sha = a.commit
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', project) or not re.fullmatch(r'[a-f0-9]{40}', sha): raise ValueError('INVALID_PROJECT_OR_COMMIT')
    repository = Path(a.repository).resolve()
    actual = subprocess.run(['git', '-C', str(repository), 'rev-parse', '--verify', '--quiet', sha + '^{commit}'], capture_output=True, text=True).stdout.strip()
    if actual != sha: raise ValueError('COMMIT_MISMATCH')
    remote = subprocess.check_output(['git', '-C', str(repository), 'remote', 'get-url', 'origin'], text=True).strip()
    if repo_id(remote) is None or repo_id(remote) != repo_id(config['repository']): raise ValueError('REPOSITORY_MISMATCH')
    root = Path(a.work_root).resolve(); root.mkdir(parents=True, exist_ok=True)
    evidence = Path(a.evidence).resolve(); evidence.mkdir(parents=True, exist_ok=True, mode=0o700)
    min_free = a.min_free_disk_gb * 1024 ** 3
    if shutil.disk_usage(root).free < min_free: raise ValueError('INSUFFICIENT_DISK')
    LIMITS.update({'cpu_cores': a.cpu_cores, 'memory_mb': a.memory_mb, 'max_processes': a.max_processes,
                   'min_free_disk_bytes': max(1024 ** 3, min_free // 4), 'disk_path': str(root),
                   'require_hard_limits':a.require_hard_limits,'marker_prefix': os.environ.get('GEMITRON_AGENT_JOB_MARKER', 'runner-' + uuid.uuid4().hex[:8])})
    step_timeout = max(60, a.step_timeout_minutes * 60)
    # Host-wide concurrency of one until actual host benchmarking permits more.
    lock = HostLock(root / '.build.lock')
    work = root / ('job-' + str(uuid.uuid4())); started = now(); gates = []
    cache=prepare_cache(root,project,a.max_cache_bytes)
    (evidence/'cache-policy.json').write_text(canonical(cache))
    LIMITS.update({'scratch_path':str(work),'max_scratch_bytes':a.max_scratch_bytes,'cache_path':cache['path'],'max_cache_bytes':a.max_cache_bytes})
    env = sanitized_env(root, project)
    ownership=root/'.owned-worktrees';ownership.mkdir(mode=0o700,exist_ok=True)
    record=ownership/(work.name+'.json')
    subprocess.run(['git', '-C', str(repository), 'worktree', 'add', '--detach', str(work), sha], check=True, capture_output=True)
    record.write_text(canonical({'schema':1,'worker':os.environ.get('MOBILE_RELEASE_RUNNER_ID','runner'),'repository':str(repository),'work_root':str(root),'path':str(work),'marker':os.environ.get('GEMITRON_AGENT_JOB_MARKER','')}));record.chmod(0o600)
    try:
        app = (work / config['flutter_path']).resolve()
        if not app.is_relative_to(work) or not (app / 'pubspec.yaml').is_file(): raise ValueError('WORKSPACE_BOUNDARY')
        version = json.loads(subprocess.check_output(resolve_command(['flutter', '--version', '--machine'], env), env=env, text=True))
        if version['frameworkVersion'] != config['flutter_version']: raise ValueError('FLUTTER_PIN_MISMATCH')
        sources = '\n'.join(file.read_text(errors='replace') for file in (app / 'test').rglob('*.dart'))
        if not re.search(r'\btest\s*\(', sources) or not re.search(r'\btestWidgets\s*\(', sources): raise ValueError('BOTH_UNIT_AND_WIDGET_TESTS_REQUIRED')
        steps = [('dependencies', ['flutter', 'pub', 'get', *(['--offline'] if a.offline else [])]), ('analyze', ['flutter', 'analyze', '--fatal-infos']), ('combined', ['flutter', 'test', '--reporter', 'expanded'])]
        for name, args in steps:
            log = evidence / (name + '.log'); code = run(args, app, env, log, step_timeout)
            if name != 'dependencies':
                for g in (['unit', 'widget'] if name == 'combined' else [name]):
                    gates.append(gate(g, code, log))
            if code: raise ValueError('QUALITY_GATE_FAILED:' + name)
        artifact_sha = '0' * 64
        if a.debug_apk:
            # Debug binaries are compile/packaging evidence only: no signing env, never uploaded as a release artifact.
            log = evidence / 'debug-apk-build.log'; code = run(['flutter', 'build', 'apk', '--debug'], app, env, log, 3600)
            apk = app / 'build/app/outputs/flutter-apk/app-debug.apk'
            if code == 0 and not apk.is_file(): code = 3
            gates.append(gate('debug_apk_build', code, log))
            if code: raise ValueError('DEBUG_APK_BUILD_FAILED')
            artifact_sha = hashlib.sha256(apk.read_bytes()).hexdigest()
            shutil.copyfile(apk, evidence / (artifact_sha + '.debug.apk'))
            try:
                inspection = subprocess.check_output(['node', str(Path(__file__).resolve().parent.parent / 'src/inspect-cli.mjs'), str(apk), '--observation-only'], env=env, text=True, timeout=120)
                meta = json.loads(inspection)
                allowed = {config.get('package_id'), config.get('debug_package_id')} - {None}
                if allowed and meta['package_id'] not in allowed: raise ValueError('DEBUG_PACKAGE_ID_MISMATCH')
                (evidence / 'debug-apk-inspection.json').write_text(canonical(meta) + '\n')
            except (subprocess.SubprocessError, OSError, json.JSONDecodeError) as error:
                (evidence / 'debug-apk-inspection.json').write_text(canonical({'status': 'INSPECTOR_UNAVAILABLE', 'error': type(error).__name__}) + '\n')
        if a.apk or a.aab:
            if select_backend()=='watchdog-soft':raise ValueError('RELEASE_REQUIRES_KERNEL_LIMITS')
            if not a.signing_approval or len(os.environ.get('MOBILE_RELEASE_APPROVAL_KEY', '')) < 32: raise ValueError('SIGNING_APPROVAL_REQUIRED')
            signed = json.loads(Path(a.signing_approval).read_text()); b = signed['payload']
            if not hmac.compare_digest(signed['signature'], hmac.new(os.environ['MOBILE_RELEASE_APPROVAL_KEY'].encode(), canonical(b).encode(), 'sha256').hexdigest()): raise ValueError('BAD_SIGNING_APPROVAL')
            if b['project'] != project or b['commit'] != sha or b['action'] != ('aab.build' if a.aab else 'apk.build') or datetime.fromisoformat(b['expires_at'].replace('Z', '+00:00')) <= datetime.now(timezone.utc): raise ValueError('SIGNING_APPROVAL_SCOPE')
            # Signing env is application-declared, never shell-evaluated, and only enters the release build step.
            for name in config.get('signing_env', []):
                if not re.fullmatch(r'[A-Z][A-Z0-9_]+', name) or name not in os.environ: raise ValueError('SIGNING_ENV_REQUIRED')
                env[name] = os.environ[name]
            log = evidence / 'apk-build.log'; code = run(['flutter', 'build', 'appbundle' if a.aab else 'apk', '--release'], app, env, log, 3600)
            text = log.read_text(errors='replace')
            for name in config.get('signing_env', []):
                value = env.get(name)
                if value: text = text.replace(value, '[REDACTED]')
            log.write_text(text)
            gates.append(gate('aab_build' if a.aab else 'apk_build', code, log))
            if code: raise ValueError('APK_BUILD_FAILED')
            apk = app / ('build/app/outputs/bundle/release/app-release.aab' if a.aab else 'build/app/outputs/flutter-apk/app-release.apk')
            inspection = subprocess.check_output(['node', str(Path(__file__).resolve().parent.parent / 'src/inspect-cli.mjs'), str(apk)], env=env, text=True)
            meta = json.loads(inspection)
            if meta['package_id'] != config['package_id'] or meta['signing_sha256'] != config['signing_sha256']: raise ValueError('SIGNING_OR_PACKAGE_MISMATCH')
            artifact_sha = meta['sha256']; shutil.copyfile(apk, evidence / (artifact_sha + ('.aab' if a.aab else '.apk'))); (evidence / 'apk-inspection.json').write_text(canonical(meta) + '\n')
            gates.append({'name': 'aab_signature' if a.aab else 'apk_signature', 'status': 'PASS', 'exit_code': 0, 'evidence_sha256': hashlib.sha256(inspection.encode()).hexdigest()})
        (evidence / 'resources.json').write_text(canonical(REPORTS) + '\n')
        payload = {'id': str(uuid.uuid4()), 'project': project, 'commit': sha, 'artifact_sha256': artifact_sha, 'gates': gates, 'started_at': started, 'finished_at': now(),
                   'runner_id': os.environ.get('MOBILE_RELEASE_RUNNER_ID', 'runner'), 'toolchain': {'flutter': version['frameworkVersion'], 'engine': version['engineRevision'], 'dart': version['dartSdkVersion']}}
        if a.report_enforcement:
            payload['resource_enforcement'] = REPORTS[-1]['enforcement'] if REPORTS else select_backend()
        if a.job_id: payload['job_id'] = a.job_id
        if a.lease_generation is not None:
            if a.lease_generation < 1: raise ValueError('INVALID_LEASE_GENERATION')
            payload['lease_generation'] = a.lease_generation
        secret = os.environ.get('MOBILE_RELEASE_RUNNER_KEY')
        if not secret or len(secret) < 32: raise ValueError('RUNNER_SECRET_REQUIRED')
        receipt = {'payload': payload, 'signature': hmac.new(secret.encode(), canonical(payload).encode(), 'sha256').hexdigest()}
        (evidence / 'receipt.json').write_text(canonical(receipt) + '\n'); os.chmod(evidence / 'receipt.json', 0o600)
        print(json.dumps({'status': 'PASS', 'project': project, 'source_commit': sha, 'receipt': str(evidence / 'receipt.json'), 'emulator': 'NOT_TESTED'}))
    finally:
        if REPORTS:
            (evidence / 'resources.json').write_text(canonical(REPORTS) + '\n')
        subprocess.run(['git', '-C', str(repository), 'worktree', 'remove', '--force', str(work)], check=True, capture_output=True)
        record.unlink(missing_ok=True)
        lock.release()


if __name__ == '__main__': main()
