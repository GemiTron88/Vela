#!/usr/bin/env python3
"""Read-only host discovery; does not install packages or start an emulator."""
import json, os, platform, shutil, subprocess
from pathlib import Path
from host_policy import observations

def command(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=20)
        return {'exit_code': p.returncode, 'output': (p.stdout + p.stderr)[-2000:]}
    except (OSError, subprocess.TimeoutExpired) as e:
        return {'exit_code': None, 'status': 'NOT_AVAILABLE', 'reason': type(e).__name__}

def diagnose():
    memory = None
    if Path('/proc/meminfo').exists():
        memory = int(Path('/proc/meminfo').read_text().split('MemTotal:')[1].split()[0])*1024
    disk = shutil.disk_usage(Path.cwd())
    kvm = Path('/dev/kvm').exists() and os.access('/dev/kvm', os.R_OK | os.W_OK)
    cpu = Path('/proc/cpuinfo').read_text() if Path('/proc/cpuinfo').exists() else ''
    tools = {n: shutil.which(n) for n in ['flutter','dart','java','adb','emulator','sdkmanager','apksigner','apkanalyzer','shorebird','git','node']}
    host=observations()
    acceleration = {'status':'NOT_EXECUTED_HOST_POLICY'}
    ready = kvm and platform.machine() == 'x86_64' and acceleration.get('exit_code') == 0
    return {'schema':1,'os':platform.system(),'architecture':platform.machine(),'cores':os.cpu_count(),
        'ram_bytes':memory,'disk_free_bytes':disk.free,'tools':tools,'kvm_accessible':kvm,
        'cpu_virtualization_flags': any(v in cpu.split() for v in ['vmx','svm']),
        'nested_virtualization':'UNKNOWN_REQUIRES_HOST_CONFIRMATION','acceleration':acceleration,
        'java':command(['java','-version']) if tools['java'] else {'status':'NOT_AVAILABLE'},
        'host_policy':host,
        'decision':'VPS_NATIVE_MOBILE_FORBIDDEN' if not host['physical'] else 'PHYSICAL_WORKSTATION_REQUIRES_OWNER_ENROLLMENT',
        'emulator_test_status':'NOT_TESTED','production_services_inspected':False}

if __name__ == '__main__': print(json.dumps(diagnose(),indent=2))
