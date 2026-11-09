"""Bound only the runner-owned per-project caches while holding the native host build lock."""
import json,os,shutil
from pathlib import Path
def footprint(root):
 total=0
 for folder,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if not Path(folder,d).is_symlink()]
  for file in files:
   p=Path(folder,file)
   if not p.is_symlink():total+=p.stat().st_size
 return total
def prepare_cache(root,project,maximum):
 root=Path(root).resolve();parent=root/'cache';cache=parent/project
 if parent.is_symlink() or cache.is_symlink():raise ValueError('CACHE_BOUNDARY_SYMLINK')
 cache.mkdir(parents=True,exist_ok=True,mode=0o700);marker=cache/'.runner-owner.json'
 expected={'schema':1,'root':str(root),'project':project}
 if marker.exists():
  if marker.is_symlink() or json.loads(marker.read_text())!=expected:raise ValueError('CACHE_OWNERSHIP_UNKNOWN')
 elif any(cache.iterdir()):raise ValueError('CACHE_OWNERSHIP_UNKNOWN')
 else:marker.write_text(json.dumps(expected));marker.chmod(0o600)
 used=footprint(cache);evicted=False
 if used>maximum:
  shutil.rmtree(cache);cache.mkdir(mode=0o700);marker.write_text(json.dumps(expected));marker.chmod(0o600);evicted=True
 return {'path':str(cache),'measured_bytes':used,'evicted':evicted,'limit_bytes':maximum}
