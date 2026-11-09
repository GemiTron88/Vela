#!/usr/bin/env python3
"""Fail closed before native tooling/downloads. No flag or environment bypass exists."""
import hashlib,json,os,platform,subprocess
from pathlib import Path

DENIED = ['/etc/gemitron-mobile-disabled','/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp','/.dockerenv','/run/.containerenv']
VIRTUAL = ('virtual','vmware','kvm','qemu','xen','amazon','google compute','digitalocean','openstack','hetzner','bochs','bhyve','parallels')

def query(argv):
    try:
        result=subprocess.run(argv,capture_output=True,text=True,timeout=5)
        return result.stdout.strip() if result.returncode==0 else None
    except (OSError,subprocess.TimeoutExpired):return None

def observations():
    system=platform.system();identity='';physical=False
    blocked=any(Path(p).exists() for p in DENIED)
    if system=='Linux':
        parts=[]
        for name in ['sys_vendor','product_name','product_uuid']:
            try:parts.append((Path('/sys/class/dmi/id')/name).read_text().strip())
            except OSError:parts.append('')
        identity='|'.join(parts)
        # systemd-detect-virt exits 1 for an observed bare metal host; query handles it separately.
        try:
            result=subprocess.run(['systemd-detect-virt'],capture_output=True,text=True,timeout=5)
            physical=result.returncode==1 and result.stdout.strip()=='none' and all(parts)
            blocked=blocked or result.returncode==0
        except (OSError,subprocess.TimeoutExpired):pass
    elif system=='Windows':
        identity=query(['powershell.exe','-NoProfile','-NonInteractive','-Command',"$c=Get-CimInstance Win32_ComputerSystem;$b=Get-CimInstance Win32_BIOS;Write-Output ($c.Manufacturer+'|'+$c.Model+'|'+$b.SerialNumber)"]) or ''
        physical=identity.count('|')==2 and all(identity.split('|'))
    elif system=='Darwin':
        identity=query(['ioreg','-rd1','-c','IOPlatformExpertDevice']) or ''
        physical='IOPlatformUUID' in identity and 'IOPlatformSerialNumber' in identity
    blocked=blocked or any(value in identity.lower() for value in VIRTUAL)
    fingerprint=hashlib.sha256((system+'\n'+identity).encode()).hexdigest()
    return {'system':system,'physical':physical and not blocked,'blocked':blocked,'fingerprint':fingerprint}

def policy_path():
    if os.name=='nt':return Path(os.environ.get('LOCALAPPDATA',str(Path.home()/'AppData/Local')))/'GemiTronAgent/host-policy.json'
    return Path.home()/'.config/gemitron-agent/host-policy.json'

def evaluate(observed,policy):
    if observed['blocked']:raise ValueError('VPS_NATIVE_MOBILE_FORBIDDEN')
    if not observed['physical']:raise ValueError('PHYSICAL_WORKSTATION_NOT_VERIFIED')
    if policy != {'schema':1,'role':'physical-workstation','fingerprint':observed['fingerprint']}:
        raise ValueError('OWNER_WORKSTATION_ENROLLMENT_REQUIRED')
    return {'status':'ALLOWED','role':'physical-workstation','fingerprint':observed['fingerprint']}

def require_workstation():
    observed=observations();policy=None
    try:policy=json.loads(policy_path().read_text())
    except (OSError,ValueError):pass
    return evaluate(observed,policy)

if __name__=='__main__':
    import sys
    if sys.argv[1:]==['inspect']:
        print(json.dumps({**observations(),'policy_path':str(policy_path()),'native_mobile':'DENIED_UNTIL_OWNER_ENROLLMENT'}))
    else:print(json.dumps(require_workstation()))
