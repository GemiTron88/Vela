#!/usr/bin/env python3
"""Native exclusive agent guard and owned-worktree recovery. No command service."""
import argparse, json, os, re, signal, subprocess, sys, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from runner import HostLock
from supervisor import cleanup_orphans

def recover(root,worker,repositories):
    registry=root/'.owned-worktrees'
    result={'removed':[],'preserved':[]}
    if not registry.is_dir() or registry.is_symlink():return result
    allowed={str(Path(r).resolve()) for r in repositories}
    for record in registry.glob('job-*.json'):
        try:
            if record.is_symlink():continue
            item=json.loads(record.read_text());name=record.stem
            if not re.fullmatch(r'job-[a-f0-9-]{36}',name):continue
            work=root/name;repo=Path(item['repository']).resolve()
            if item.get('schema')!=1 or item.get('worker')!=worker or item.get('work_root')!=str(root) or item.get('path')!=str(work) or str(repo) not in allowed:continue
            if work.is_symlink():result['preserved'].append(name);continue
            rows=subprocess.check_output(['git','-C',str(repo),'worktree','list','--porcelain'],text=True,timeout=30)
            worktrees={Path(line[9:]).resolve() for line in rows.splitlines() if line.startswith('worktree ')}
            if work.resolve() not in worktrees:result['preserved'].append(name);continue
            marker=item.get('marker','')
            if marker and re.fullmatch(r'agent-'+re.escape(worker)+r'-[a-f0-9-]{8,36}',marker):
                killed=cleanup_orphans(marker)
                for pid in killed:
                    deadline=time.monotonic()+5
                    while time.monotonic()<deadline:
                        try:
                            state=Path('/proc',str(pid),'stat').read_text().split(') ',1)[1][0]
                            if state=='Z':break
                        except FileNotFoundError:break
                        time.sleep(.05)
                    else:raise RuntimeError('ORPHAN_RETIREMENT_UNVERIFIED')
            subprocess.run(['git','-C',str(repo),'worktree','remove','--force',str(work)],check=True,timeout=30,capture_output=True)
            record.unlink();result['removed'].append(name)
        except (ValueError,KeyError,OSError,subprocess.SubprocessError):result['preserved'].append(record.stem)
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--work-root',required=True);p.add_argument('--worker',required=True);p.add_argument('--repository',action='append',default=[]);a=p.parse_args()
    root=Path(a.work_root).resolve();root.mkdir(parents=True,exist_ok=True)
    if root==Path.home().resolve() or root==Path(root.anchor) or not re.fullmatch(r'[a-z][a-z0-9-]{0,63}',a.worker):raise RuntimeError('GUARD_ROOT_INVALID')
    agent=HostLock(root/'.agent.lock')
    try:
        recovery=HostLock(root/'.build.lock')
        try:result=recover(root,a.worker,a.repository)
        finally:recovery.release()
        print(json.dumps({'status':'LOCKED','recovery':result}),flush=True)
        # The pipe closes when the owning Node process exits, including crashes.
        while sys.stdin.buffer.read(1):pass
    finally:agent.release()

if __name__=='__main__':
    try:main()
    except Exception as e:
        print(json.dumps({'status':'BLOCKED','reason':'HOST_BUSY' if isinstance(e,ValueError) or isinstance(e,OSError) else str(e)}),flush=True);sys.exit(3)
