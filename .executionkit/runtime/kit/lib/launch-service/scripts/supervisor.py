#!/usr/bin/env python3
"""Resource-limited process supervisor for the GemiTron local build agent.

Backends (reported verbatim in receipts, never upgraded in wording):
  windows-job-object  Windows Job Object: kill-on-close, job memory cap, active process cap,
                      hard CPU-rate cap. The child is created suspended, assigned, then resumed,
                      so no descendant can escape before the limits apply.
  systemd-scope       Linux transient systemd user scope (MemoryMax/CPUQuota/TasksMax) used ONLY
                      when cgroup v2 with delegated memory+cpu controllers is detected. On cgroup v1
                      hosts systemd silently ignores those properties, so it is never claimed there.
  watchdog-soft       Linux/macOS fallback: new session, CPU affinity (Linux hard core cap), nice,
                      parent-death signal, 1s RSS/disk/timeout watchdog that kills the whole tree.

The supervisor executes only the fixed argv vector it is given by runner.py. It never evaluates a shell.
"""
import json, os, signal, subprocess, sys, threading, time, uuid, shutil
from pathlib import Path
from cache_policy import footprint

IS_WINDOWS = os.name == 'nt'
MARKER_ENV = 'GEMITRON_AGENT_JOB_MARKER'


def resolve_command(args, env):
    """Resolve argv[0] against the sanitized PATH. On Windows, .bat/.cmd shims (flutter.bat) are
    launched through cmd.exe /d /c with a fixed argv; arguments come from the runner allowlist only."""
    exe = shutil.which(args[0], path=env.get('PATH'))
    if not exe:
        return list(args)
    if IS_WINDOWS and exe.lower().endswith(('.bat', '.cmd')):
        comspec = env.get('COMSPEC') or os.environ.get('COMSPEC') or 'cmd.exe'
        return [comspec, '/d', '/c', exe, *args[1:]]
    return [exe, *args[1:]]


# --------------------------------------------------------------------------- Linux helpers
def _cgroup_v2_delegated():
    if not sys.platform.startswith('linux') or not Path('/sys/fs/cgroup/cgroup.controllers').is_file():
        return False
    uid = os.getuid()
    ctl = Path(f'/sys/fs/cgroup/user.slice/user-{uid}.slice/user@{uid}.service/cgroup.subtree_control')
    try:
        enabled = ctl.read_text().split()
    except OSError:
        return False
    return 'memory' in enabled and 'cpu' in enabled and shutil.which('systemd-run') is not None


def select_backend(preferred=None):
    if IS_WINDOWS:
        return 'windows-job-object'
    if preferred == 'watchdog-soft':
        return 'watchdog-soft'
    if _cgroup_v2_delegated():
        return 'systemd-scope'
    return 'watchdog-soft'


def _proc_tree_rss(session_id):
    """Sum RSS (bytes) of every process whose session id equals session_id (Linux /proc)."""
    total, page = 0, os.sysconf('SC_PAGE_SIZE')
    for entry in os.scandir('/proc'):
        if not entry.name.isdigit():
            continue
        try:
            stat = Path(entry.path, 'stat').read_text()
            fields = stat[stat.rindex(')') + 2:].split()
            if int(fields[3]) == session_id:  # field 6 (session) after pid/comm/state/ppid/pgrp
                total += int(fields[21]) * page  # rss pages (field 24)
        except (OSError, ValueError, IndexError):
            continue
    return total


def _ps_tree_rss(pgid):
    try:
        out = subprocess.run(['ps', '-A', '-o', 'pgid=,rss='], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return 0
    total = 0
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0] == str(pgid):
            total += int(parts[1]) * 1024
    return total


def cleanup_orphans(marker_prefix):
    """Kill processes owned by this user whose environment carries our job marker (Linux).
    Used at agent start-up to reap trees left behind by a crashed agent/supervisor."""
    killed = []
    if not sys.platform.startswith('linux') or not marker_prefix:
        return killed
    needle = f'{MARKER_ENV}={marker_prefix}'.encode()
    me = os.getpid()
    for entry in os.scandir('/proc'):
        if not entry.name.isdigit() or int(entry.name) == me:
            continue
        try:
            if os.stat(entry.path).st_uid != os.getuid():
                continue
            env = Path(entry.path, 'environ').read_bytes().split(b'\0')
            if any(item.startswith(needle) for item in env):
                os.kill(int(entry.name), signal.SIGKILL)
                killed.append(int(entry.name))
        except (OSError, ValueError):
            continue
    return killed


# --------------------------------------------------------------------------- Windows Job Object
def _windows_job(limits):
    import ctypes
    from ctypes import wintypes
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in ('ReadOperationCount', 'WriteOperationCount', 'OtherOperationCount',
                                                      'ReadTransferCount', 'WriteTransferCount', 'OtherTransferCount')]

    class BASIC(ctypes.Structure):
        _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64),
                    ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t),
                    ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD),
                    ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD), ('SchedulingClass', wintypes.DWORD)]

    class EXTENDED(ctypes.Structure):
        _fields_ = [('BasicLimitInformation', BASIC), ('IoInfo', IO_COUNTERS), ('ProcessMemoryLimit', ctypes.c_size_t),
                    ('JobMemoryLimit', ctypes.c_size_t), ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]

    class CPU_RATE(ctypes.Structure):
        _fields_ = [('ControlFlags', wintypes.DWORD), ('CpuRate', wintypes.DWORD)]

    k32.CreateJobObjectW.restype = wintypes.HANDLE
    k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    k32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    k32.QueryInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.c_void_p]
    k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    k32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]

    job = k32.CreateJobObjectW(None, None)
    if not job:
        raise OSError(ctypes.get_last_error(), 'CreateJobObjectW failed')
    info = EXTENDED()
    flags = 0x2000 | 0x400 | 0x20  # KILL_ON_JOB_CLOSE | DIE_ON_UNHANDLED_EXCEPTION | PRIORITY_CLASS
    info.BasicLimitInformation.PriorityClass = 0x4000  # BELOW_NORMAL_PRIORITY_CLASS
    if limits.get('memory_mb'):
        flags |= 0x200  # JOB_OBJECT_LIMIT_JOB_MEMORY
        info.JobMemoryLimit = int(limits['memory_mb']) * 1024 * 1024
    if limits.get('max_processes'):
        flags |= 0x8  # JOB_OBJECT_LIMIT_ACTIVE_PROCESS
        info.BasicLimitInformation.ActiveProcessLimit = int(limits['max_processes'])
    info.BasicLimitInformation.LimitFlags = flags
    if not k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
        err = ctypes.get_last_error(); k32.CloseHandle(job)
        raise OSError(err, 'SetInformationJobObject(extended) failed')
    applied = {'memory_mb': limits.get('memory_mb'), 'max_processes': limits.get('max_processes'), 'cpu_rate_percent': None}
    cores = limits.get('cpu_cores')
    total = os.cpu_count() or 1
    if cores and cores < total:
        rate = CPU_RATE(0x1 | 0x4, max(1, min(10000, int(cores * 10000 / total))))  # ENABLE | HARD_CAP
        if not k32.SetInformationJobObject(job, 15, ctypes.byref(rate), ctypes.sizeof(rate)):
            err = ctypes.get_last_error(); k32.CloseHandle(job)
            raise OSError(err, 'SetInformationJobObject(cpu rate) failed')
        applied['cpu_rate_percent'] = rate.CpuRate / 100

    actual=EXTENDED()
    if not k32.QueryInformationJobObject(job,9,ctypes.byref(actual),ctypes.sizeof(actual),None) or actual.JobMemoryLimit!=info.JobMemoryLimit or actual.BasicLimitInformation.ActiveProcessLimit!=info.BasicLimitInformation.ActiveProcessLimit:
        k32.CloseHandle(job);raise RuntimeError('WINDOWS_QUOTA_READBACK_FAILED')
    if cores and cores<total:
        actual_cpu=CPU_RATE()
        if not k32.QueryInformationJobObject(job,15,ctypes.byref(actual_cpu),ctypes.sizeof(actual_cpu),None) or actual_cpu.CpuRate!=rate.CpuRate or not actual_cpu.ControlFlags&0x4:
            k32.CloseHandle(job);raise RuntimeError('WINDOWS_CPU_QUOTA_READBACK_FAILED')
    applied['verified_readback']=True

    def peak():
        q = EXTENDED()
        if k32.QueryInformationJobObject(job, 9, ctypes.byref(q), ctypes.sizeof(q), None):
            return int(q.PeakJobMemoryUsed)
        return None
    return k32, job, applied, peak


def _windows_resume(handle):
    import ctypes
    ntdll = ctypes.WinDLL('ntdll')
    ntdll.NtResumeProcess.argtypes = [ctypes.c_void_p]
    status = ntdll.NtResumeProcess(ctypes.c_void_p(int(handle)))
    if status != 0:
        raise OSError(status, 'NtResumeProcess failed')


# --------------------------------------------------------------------------- main entry point
def run_limited(args, cwd, env, log_path, timeout, limits, backend=None):
    """Run argv under resource limits. Returns (exit_code, report). Exit 124 = timeout,
    137 = killed by watchdog (memory/disk). Raises if the requested enforcement cannot be applied."""
    limits = dict(limits or {})
    backend = backend or select_backend(limits.get('backend'))
    if limits.get('require_hard_limits') and backend=='watchdog-soft':raise RuntimeError('KERNEL_RESOURCE_LIMITS_REQUIRED')
    marker = limits.get('marker') or ('job-' + uuid.uuid4().hex)
    env = {**env, MARKER_ENV: marker}
    argv = resolve_command(list(args), env)
    report = {'enforcement': backend, 'killed_reason': None, 'peak_rss_bytes': 0, 'limits': {
        'cpu_cores': limits.get('cpu_cores'), 'memory_mb': limits.get('memory_mb'),
        'max_processes': limits.get('max_processes'), 'timeout_seconds': timeout}}
    started = time.monotonic()
    memory_cap = int(limits['memory_mb']) * 1024 * 1024 if limits.get('memory_mb') else None
    min_free = int(limits.get('min_free_disk_bytes') or 0)
    disk_path = limits.get('disk_path') or cwd

    with open(log_path, 'wb') as output:
        if backend == 'windows-job-object':
            k32, job, applied, peak = _windows_job(limits)
            report['applied'] = applied
            try:
                creation = 0x4 | 0x200 | 0x08000000  # CREATE_SUSPENDED | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
                process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, creationflags=creation)
                try:
                    if not k32.AssignProcessToJobObject(job, int(process._handle)):
                        raise OSError('AssignProcessToJobObject failed')
                    _windows_resume(process._handle)
                except BaseException:
                    process.kill(); process.wait()
                    raise
                code = _wait_with_watchdog(process, timeout, min_free, disk_path, report,
                                           kill=lambda: k32.TerminateJobObject(job, 137), limits=limits)
                report['peak_rss_bytes'] = peak() or 0
                return code, _finish(report, started)
            finally:
                k32.CloseHandle(job)  # KILL_ON_JOB_CLOSE reaps any surviving descendant

        if backend == 'systemd-scope':
            unit = 'gemitron-' + marker[:40]
            props = ['-p', 'TasksMax=%d' % int(limits.get('max_processes') or 512)]
            if memory_cap:
                props += ['-p', 'MemoryMax=%d' % memory_cap, '-p', 'MemorySwapMax=0']
            if limits.get('cpu_cores'):
                props += ['-p', 'CPUQuota=%d%%' % (int(limits['cpu_cores']) * 100)]
            proof=str(log_path)+'.limits.json'
            argv=[sys.executable,str(Path(__file__).with_name('cgroup_entry.py')),'--memory',str(memory_cap or 0),'--cpu-cores',str(int(limits.get('cpu_cores') or 1)),'--processes',str(int(limits.get('max_processes') or 512)),'--report',proof,'--',*argv]
            argv = ['systemd-run', '--user', '--scope', '--quiet', '--collect', '--unit', unit, *props, '--', *argv]

        def preexec():
            os.setsid()
            try:
                os.nice(10)
            except OSError:
                pass
            if limits.get('cpu_cores') and hasattr(os, 'sched_setaffinity'):
                cpus = sorted(os.sched_getaffinity(0))[:max(1, int(limits['cpu_cores']))]
                os.sched_setaffinity(0, cpus)
            if sys.platform.startswith('linux'):
                try:
                    import ctypes
                    ctypes.CDLL('libc.so.6', use_errno=True).prctl(1, signal.SIGKILL)  # PR_SET_PDEATHSIG
                except Exception:
                    pass

        process = subprocess.Popen(argv, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, preexec_fn=preexec)
        if sys.platform.startswith('linux') and limits.get('cpu_cores') and hasattr(os, 'sched_getaffinity'):
            try:
                report['applied'] = {'cpu_affinity': sorted(os.sched_getaffinity(process.pid))}
            except OSError:
                pass

        def rss():
            return _proc_tree_rss(process.pid) if sys.platform.startswith('linux') else _ps_tree_rss(process.pid)

        def kill():
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(process.pid, sig)
                except ProcessLookupError:
                    break
                try:
                    process.wait(timeout=10)
                    break
                except subprocess.TimeoutExpired:
                    continue
            cleanup_orphans(marker)  # descendants that escaped the process group but kept our marker

        try:
            code = _wait_with_watchdog(process, timeout, min_free, disk_path, report, kill=kill, rss=rss, memory_cap=memory_cap,limits=limits)
        except BaseException:
            kill()
            raise
        # Two reaping passes: a grandchild may still be mid-fork when the direct child exits.
        report['orphans_reaped'] = len(cleanup_orphans(marker))
        time.sleep(0.3)
        report['orphans_reaped'] += len(cleanup_orphans(marker))
        if backend=='systemd-scope' and code==0:
            report['verified_kernel_limits']=json.loads(Path(proof).read_text())
        return code, _finish(report, started)


def _wait_with_watchdog(process, timeout, min_free, disk_path, report, kill, rss=None, memory_cap=None,limits=None):
    limits=limits or {};last_disk_sample=0
    deadline = time.monotonic() + timeout
    while True:
        try:
            return process.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            pass
        if rss is not None:
            current = rss()
            report['peak_rss_bytes'] = max(report['peak_rss_bytes'], current)
            if memory_cap and current > memory_cap:
                report['killed_reason'] = 'MEMORY_LIMIT'
                kill(); process.wait()
                return 137
        if time.monotonic()-last_disk_sample>5:
            last_disk_sample=time.monotonic()
            for category in ['scratch','cache']:
                directory=limits.get(category+'_path');maximum=limits.get('max_'+category+'_bytes')
                if directory and maximum and Path(directory).exists():
                    measured=footprint(directory);report[category+'_bytes']=measured
                    if measured>maximum:
                        report['killed_reason']=category.upper()+'_LIMIT';kill();process.wait();return 137
        if min_free and shutil.disk_usage(disk_path).free < min_free:
            report['killed_reason'] = 'DISK_PRESSURE'
            kill(); process.wait()
            return 137
        if time.monotonic() > deadline:
            report['killed_reason'] = 'TIMEOUT'
            kill(); process.wait()
            return 124


def _finish(report, started):
    report['wall_seconds'] = round(time.monotonic() - started, 3)
    return report


if __name__ == '__main__':
    # Maintenance entry points used by the agent: backend probe and orphan cleanup.
    if len(sys.argv) >= 2 and sys.argv[1] == 'probe':
        print(json.dumps({'backend': select_backend(), 'platform': sys.platform, 'cpu_count': os.cpu_count()}))
    elif len(sys.argv) >= 4 and sys.argv[1] == 'cleanup' and sys.argv[2] == '--marker-prefix':
        print(json.dumps({'killed': cleanup_orphans(sys.argv[3])}))
    else:
        print('usage: supervisor.py probe | cleanup --marker-prefix <prefix>', file=sys.stderr)
        sys.exit(2)
