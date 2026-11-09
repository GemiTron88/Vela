import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function git(root,args,allowFail=false){
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,maxBuffer:32*1024*1024,windowsHide:true});
  if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());
  return {status:r.status,stdout:String(r.stdout??'').trim(),rawStdout:String(r.stdout??''),stderr:String(r.stderr??'').trim(),error:r.error?.message??null};
}
function hashFile(full){
  const digest=crypto.createHash('sha256'),fd=fs.openSync(full,'r'),buffer=Buffer.allocUnsafe(64*1024);
  try{let n=0;do{n=fs.readSync(fd,buffer,0,buffer.length,null);if(n>0)digest.update(buffer.subarray(0,n));}while(n>0);}finally{fs.closeSync(fd);}
  return digest.digest('hex');
}
export function captureV4WorktreeIdentity(root){
  root=path.resolve(root);
  const head=git(root,['rev-parse','HEAD']).stdout;
  const diff=git(root,['diff','--no-ext-diff','--binary'],true).stdout;
  const cached=git(root,['diff','--cached','--no-ext-diff','--binary'],true).stdout;
  const untracked=git(root,['ls-files','--others','--exclude-standard','-z'],true).rawStdout.split('\0').filter(Boolean).sort();
  const untrackedParts=[];
  for(const rel of untracked){
    const full=path.resolve(root,rel),delta=path.relative(root,full);
    if(delta.startsWith('..')||path.isAbsolute(delta))continue;
    const stat=fs.lstatSync(full,{throwIfNoEntry:false});
    if(!stat)continue;
    if(stat.isSymbolicLink()){untrackedParts.push(rel+':symlink:'+fs.readlinkSync(full));continue;}
    if(stat.isFile())untrackedParts.push(rel+':'+stat.size+':'+hashFile(full));
  }
  const worktreeFingerprint=crypto.createHash('sha256').update(JSON.stringify({head,diff,cached,untracked:untrackedParts})).digest('hex');
  return {head,worktreeFingerprint};
}


export function captureV4FastWorktreeIdentity(root){
  root=path.resolve(root);
  const head=git(root,['rev-parse','HEAD']).stdout;
  const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']).rawStdout;
  const changed=[];
  const records=status.split('\0');
  for(let index=0;index<records.length;index++){
    const line=records[index];if(line.length<4)continue;
    const rel=line.slice(3);
    if(rel)changed.push(rel);
    if(/[RC]/.test(line.slice(0,2))){
      const orig=records[++index];
      if(orig)changed.push(orig);
    }
  }
  const files=[];
  for(const rel of [...new Set(changed)].sort()){
    const full=path.resolve(root,rel),delta=path.relative(root,full);
    if(delta.startsWith('..')||path.isAbsolute(delta)){files.push([rel,'missing']);continue;}
    const stat=fs.lstatSync(full,{throwIfNoEntry:false});
    if(!stat){files.push([rel,'missing']);continue;}
    if(stat.isSymbolicLink()){files.push([rel,'symlink',fs.readlinkSync(full)]);continue;}
    if(stat.isFile())files.push([rel,'file',stat.size,Math.trunc(stat.mtimeMs),stat.mode]);
    else if(stat.isDirectory())files.push([rel,'directory',Math.trunc(stat.mtimeMs)]);
    else files.push([rel,'other',stat.size,Math.trunc(stat.mtimeMs),stat.mode]);
  }
  const worktreeFingerprint=crypto.createHash('sha256').update(JSON.stringify({head,status,files})).digest('hex');
  return {head,worktreeFingerprint,changedFiles:files.map((item)=>item[0]),identityMode:'FAST_TASK_METADATA'};
}
