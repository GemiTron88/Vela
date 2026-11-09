#!/usr/bin/env python3
"""Read back the actual scope's kernel controls before entering source workload."""
import argparse,json,os,sys
from pathlib import Path
def main():
 p=argparse.ArgumentParser();p.add_argument('--memory',type=int,required=True);p.add_argument('--cpu-cores',type=int,required=True);p.add_argument('--processes',type=int,required=True);p.add_argument('--report',required=True);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args()
 group=next(l.split(':',2)[2].strip() for l in Path('/proc/self/cgroup').read_text().splitlines() if l.startswith('0:'))
 root=Path('/sys/fs/cgroup')/group.lstrip('/');memory=(root/'memory.max').read_text().strip();cpu=(root/'cpu.max').read_text().split();tasks=(root/'pids.max').read_text().strip()
 if memory=='max' or int(memory)>a.memory or cpu[0]=='max' or int(cpu[0])/int(cpu[1])>a.cpu_cores or tasks=='max' or int(tasks)>a.processes:raise RuntimeError('CGROUP_QUOTA_READBACK_FAILED')
 Path(a.report).write_text(json.dumps({'verified':True,'memory_max':int(memory),'cpu_max':cpu,'pids_max':int(tasks),'scope':group}))
 command=a.command[1:] if a.command and a.command[0]=='--' else a.command
 if not command:raise RuntimeError('FIXED_WORKLOAD_REQUIRED')
 os.execvpe(command[0],command,os.environ)
if __name__=='__main__':main()
