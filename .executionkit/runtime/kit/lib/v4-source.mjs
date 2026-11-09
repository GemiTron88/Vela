import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const V4_CANONICAL_REPOSITORY='https://github.com/Elwazeery/AI-ExcutionKit.git';
export const V4_CANONICAL_REF='refs/heads/main';
export const V4_SOURCE_ROOT='.executionkit/source/AI-ExecutionKit';

function run(cmd,args,cwd,timeout=120000){return spawnSync(cmd,cmd==='git'?['-c','core.longpaths=true',...args]:args,{cwd,encoding:'utf8',timeout,maxBuffer:32*1024*1024,windowsHide:true});}
function fail(result,fallback){const detail=String(result?.stderr||result?.stdout||result?.error?.message||'').trim();throw new Error(detail||fallback);}
function gitText(cwd,args,timeout=120000){const result=run('git',args,cwd,timeout);if(result.status!==0)fail(result,'Git command failed');return String(result.stdout).trim();}

function normRepo(url){return String(url??'').trim().replace(/^git@github\.com:/,'https://github.com/').replace(/\.git$/,'');}

export function verifyV4SourceSnapshot(sourceSnapshot,commit,{repository=V4_CANONICAL_REPOSITORY}={}){
  if(!/^[a-f0-9]{40}$/.test(commit??''))throw new Error('ExecutionKit source commit must be an exact SHA');
  if(gitText(sourceSnapshot,['rev-parse','HEAD'])!==commit)throw new Error('Project-local v4 source snapshot HEAD mismatch');
  const originUrl=run('git',['config','--get','remote.origin.url'],sourceSnapshot).stdout.trim()||gitText(sourceSnapshot,['remote','get-url','origin']);
  if(normRepo(originUrl)!==normRepo(repository))throw new Error('Project-local v4 source snapshot origin mismatch');
  if(gitText(sourceSnapshot,['status','--porcelain=v1','--untracked-files=all']))throw new Error('Project-local v4 source snapshot is dirty/tampered');
  for(const rel of ['STANDARD_V4.md','bin/executionkit-cli.mjs','lib/v4-installer.mjs'])if(!fs.existsSync(path.join(sourceSnapshot,rel)))throw new Error('Resolved source is not v4-capable: missing '+rel);
  return {commit,path:sourceSnapshot};
}

export function acquireLatestOfficialV4Source(root,{repository=V4_CANONICAL_REPOSITORY,ref=V4_CANONICAL_REF}={}){
  root=path.resolve(root);
  if(repository!==V4_CANONICAL_REPOSITORY||ref!==V4_CANONICAL_REF)throw new Error('v4 automatic acquisition accepts only official GitHub main');
  const sourceRoot=path.join(root,V4_SOURCE_ROOT);
  fs.mkdirSync(sourceRoot,{recursive:true});
  const tmp=path.join(sourceRoot,'.resolve-'+crypto.randomUUID());
  fs.mkdirSync(tmp,{recursive:true});
  let resolvedCommit=null,sourceSnapshot=null;
  try{
    let result=run('git',['init','-q'],tmp);if(result.status!==0)fail(result,'Cannot initialize v4 source resolver');
    result=run('git',['remote','add','origin',repository],tmp);if(result.status!==0)fail(result,'Cannot configure official ExecutionKit origin');
    result=run('git',['fetch','--depth=1','origin',ref],tmp,300000);if(result.status!==0)fail(result,'Latest ExecutionKit GitHub fetch failed');
    resolvedCommit=gitText(tmp,['rev-parse','FETCH_HEAD']);
    if(!/^[a-f0-9]{40}$/.test(resolvedCommit))throw new Error('Official GitHub main did not resolve to exact SHA');
    result=run('git',['checkout','--detach',resolvedCommit],tmp);if(result.status!==0)fail(result,'Cannot checkout resolved ExecutionKit v4 commit');
    sourceSnapshot=path.join(sourceRoot,resolvedCommit);
    if(fs.existsSync(sourceSnapshot)){verifyV4SourceSnapshot(sourceSnapshot,resolvedCommit,{repository});fs.rmSync(tmp,{recursive:true,force:true});}
    else {fs.renameSync(tmp,sourceSnapshot);verifyV4SourceSnapshot(sourceSnapshot,resolvedCommit,{repository});}
    return {schemaVersion:'executionkit-v4-source/v1',repository,ref,updatePolicy:'latest-remote-head',resolvedCommit,sourceSnapshot,sourceLocation:path.relative(root,sourceSnapshot).split(path.sep).join('/')};
  }catch(error){fs.rmSync(tmp,{recursive:true,force:true});throw error;}
}

export function acquireOfficialV4SourceCommit(root,commit,{repository=V4_CANONICAL_REPOSITORY,ref=V4_CANONICAL_REF}={}){
  root=path.resolve(root);
  if(!/^[a-f0-9]{40}$/.test(commit??''))throw new Error('ExecutionKit source commit must be an exact SHA');
  const sourceRoot=path.join(root,V4_SOURCE_ROOT);
  fs.mkdirSync(sourceRoot,{recursive:true});
  const sourceSnapshot=path.join(sourceRoot,commit);
  if(fs.existsSync(sourceSnapshot)){
    try{
      verifyV4SourceSnapshot(sourceSnapshot,commit,{repository});
      return {schemaVersion:'executionkit-v4-source/v1',repository,ref,updatePolicy:'exact-commit',resolvedCommit:commit,sourceSnapshot,sourceLocation:path.relative(root,sourceSnapshot).split(path.sep).join('/')};
    }catch{
      fs.rmSync(sourceSnapshot,{recursive:true,force:true});
    }
  }
  const tmp=path.join(sourceRoot,'.resolve-'+crypto.randomUUID());
  fs.mkdirSync(tmp,{recursive:true});
  try{
    let result=run('git',['init','-q'],tmp);if(result.status!==0)fail(result,'Cannot initialize v4 source resolver');
    result=run('git',['remote','add','origin',repository],tmp);if(result.status!==0)fail(result,'Cannot configure official ExecutionKit origin');
    result=run('git',['fetch','--depth=1','origin',commit],tmp,300000);
    if(result.status!==0){
      result=run('git',['fetch','--depth=50','origin',ref],tmp,300000);
      if(result.status!==0)fail(result,'Cannot fetch ExecutionKit source for commit '+commit);
    }
    result=run('git',['checkout','--detach',commit],tmp);if(result.status!==0)fail(result,'Cannot checkout resolved ExecutionKit v4 commit '+commit);
    if(fs.existsSync(sourceSnapshot)){verifyV4SourceSnapshot(sourceSnapshot,commit,{repository});fs.rmSync(tmp,{recursive:true,force:true});}
    else {fs.renameSync(tmp,sourceSnapshot);verifyV4SourceSnapshot(sourceSnapshot,commit,{repository});}
    return {schemaVersion:'executionkit-v4-source/v1',repository,ref,updatePolicy:'exact-commit',resolvedCommit:commit,sourceSnapshot,sourceLocation:path.relative(root,sourceSnapshot).split(path.sep).join('/')};
  }catch(error){fs.rmSync(tmp,{recursive:true,force:true});throw error;}
}

