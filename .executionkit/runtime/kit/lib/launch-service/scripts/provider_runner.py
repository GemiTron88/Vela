#!/usr/bin/env python3
"""Typed provider operations under the same host build lock and kernel quotas."""
import json,os,sys,tempfile
from pathlib import Path
from runner import HostLock
from supervisor import run_limited,select_backend
def main():
 from host_policy import require_workstation
 require_workstation()
 operation,project_file,input_file=sys.argv[1:]
 if operation not in ['patch','release','promote','rollback']:raise ValueError('TYPED_PROVIDER_ACTION_REQUIRED')
 if any(Path(p).exists() for p in ['/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp']):raise ValueError('PRODUCTION_CWP_BUILDER_FORBIDDEN')
 if select_backend() not in ['windows-job-object','systemd-scope']:raise ValueError('KERNEL_RESOURCE_LIMITS_REQUIRED')
 data=json.loads(Path(input_file).read_text());limits=data['resource_limits'];root=Path(data['work_root']).resolve()
 for key in ['cpu_cores','memory_mb','max_processes','min_free_disk_bytes']:
  if not isinstance(limits.get(key),int) or limits[key]<1:raise ValueError('PROVIDER_RESOURCE_LIMIT_REQUIRED')
 if root==Path.home().resolve() or root==Path(root.anchor):raise ValueError('DEDICATED_WORK_ROOT_REQUIRED')
 root.mkdir(parents=True,exist_ok=True);lock=HostLock(root/'.build.lock')
 try:
  evidence=Path(data['evidence_dir']).resolve();evidence.mkdir(parents=True,exist_ok=True,mode=0o700)
  limits={**limits,'require_hard_limits':True,'disk_path':str(root)}
  node=os.environ.get('MOBILE_NODE_EXECUTABLE','node');cli=str(Path(__file__).resolve().parent.parent/'src/provider-cli.mjs')
  code,report=run_limited([node,cli,operation,project_file,input_file],data['workspace'],dict(os.environ),str(evidence/'provider-driver.log'),3600,limits)
  (evidence/'provider-resource.json').write_text(json.dumps(report))
  if code:raise ValueError('PROVIDER_FAILED_OR_UNCERTAIN_READBACK_REQUIRED')
  print(json.dumps({'status':'COMMAND_SUCCEEDED','operation':operation,'resource_enforcement':report['enforcement'],'device_acceptance':'NOT_VERIFIED'}))
 finally:lock.release()
if __name__=='__main__':main()
