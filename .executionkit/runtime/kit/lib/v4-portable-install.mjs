import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveDerivedPath } from './derived-state.mjs';
import { acquireOfficialV4SourceCommit } from './v4-source.mjs';
import { detectPlatformArchitecture, verifyArtifactIntegrity } from './v4-platform.mjs';
import { projectCliCommand } from './v4-cli-entry.mjs';

const RECEIPT='.executionkit/installation.json';

function exactSource(source,commit){
  const head=spawnSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',shell:false});
  if(head.status!==0||head.stdout.trim()!==commit)throw new Error('Portable build source must be the exact installed Kit commit');
  const dirty=spawnSync('git',['-C',source,'status','--porcelain=v1','--untracked-files=all'],{encoding:'utf8',shell:false});
  if(dirty.status!==0||dirty.stdout.trim())throw new Error('Portable build source has uncommitted changes');
  if(!fs.existsSync(path.join(source,'scripts/build-executionkit-binary.mjs')))throw new Error('Portable builder is absent from exact Kit source');
}

export async function provisionV4PortableBinary(project,{source=null}={}){
  const root=path.resolve(project);
  if(process.platform!=='linux')throw new Error('Project-local SEA provisioning currently supports Linux; other targets require an explicit platform artifact');
  const receipt=JSON.parse(fs.readFileSync(path.join(root,RECEIPT),'utf8'));
  if(receipt.schemaVersion!=='executionkit-v4-install/v1'||!/^[a-f0-9]{40}$/.test(receipt.sourceCommit??''))throw new Error('Install v4 from an exact Kit commit before provisioning the binary');
  const snapshot=source?path.resolve(source):acquireOfficialV4SourceCommit(root,receipt.sourceCommit).sourceSnapshot;
  exactSource(snapshot,receipt.sourceCommit);
  const binary=resolveDerivedPath(root,'.executionkit/bin/executionkit','portable binary',{file:true,createParents:true});
  const identityFile=resolveDerivedPath(root,'.executionkit/bin/artifact-identity.json','portable identity',{file:true});
  const lock=resolveDerivedPath(root,'.executionkit/bin/provision.lock','portable provision lock',{file:true});
  let fd;
  try{fd=fs.openSync(lock,'wx',0o600);}catch(err){
    if(err.code==='EEXIST'){
      try{
        const existing=JSON.parse(fs.readFileSync(lock,'utf8'));
        const pid=Number(existing?.pid);
        let alive=true;
        if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}}
        if(!alive){fs.unlinkSync(lock);fd=fs.openSync(lock,'wx',0o600);}else throw err;
      }catch{throw err;}
    }else throw err;
  }
  fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');
  const stagedBinary=binary+'.'+crypto.randomUUID()+'.tmp';
  const stagedIdentity=identityFile+'.'+crypto.randomUUID()+'.tmp';
  const backupBinary=binary+'.'+crypto.randomUUID()+'.previous';
  const backupIdentity=identityFile+'.'+crypto.randomUUID()+'.previous';
  const buildDir=path.join(os.tmpdir(),'executionkit-sea-'+receipt.sourceCommit+'-'+crypto.randomUUID());
  let movedBinary=false,movedIdentity=false;
  let installed=false;
  try{
    fs.closeSync(fd);
    const {buildExecutionKitBinary}=await import(pathToFileURL(path.join(snapshot,'scripts/build-executionkit-binary.mjs')).href);
    const build=buildExecutionKitBinary({outDir:buildDir});
    if(build.status!=='SUCCESS')throw new Error('Portable SEA build failed: '+build.status+' '+String(build.error??''));
    const expected=build.identity;
    if(expected.sourceSha!==receipt.sourceCommit||expected.targetId!==detectPlatformArchitecture().targetId||expected.strategy!=='STANDALONE_SEA')throw new Error('Built artifact identity differs from installed Kit source or Linux target');
    if(!verifyArtifactIntegrity(build.binaryPath,expected).valid)throw new Error('Built artifact failed digest or executable verification');
    fs.copyFileSync(build.binaryPath,stagedBinary);
    fs.chmodSync(stagedBinary,0o755);
    fs.writeFileSync(stagedIdentity,JSON.stringify(expected,null,2)+'\n',{mode:0o600});
    if(!verifyArtifactIntegrity(stagedBinary,expected).valid)throw new Error('Staged artifact failed digest verification');
    if(fs.existsSync(binary)){fs.renameSync(binary,backupBinary);movedBinary=true;}
    if(fs.existsSync(identityFile)){fs.renameSync(identityFile,backupIdentity);movedIdentity=true;}
    fs.renameSync(stagedBinary,binary);
    fs.renameSync(stagedIdentity,identityFile);
    installed=true;
    const smoke=spawnSync(binary,['help'],{cwd:root,encoding:'utf8',timeout:60000,shell:false});
    if(smoke.status!==0||JSON.parse(smoke.stdout).status!=='OK')throw new Error('Installed portable binary did not execute the project-local CLI: '+String(smoke.stderr||smoke.error?.message||''));
    fs.rmSync(backupBinary,{force:true});fs.rmSync(backupIdentity,{force:true});
    const quotedSource="'"+snapshot.replaceAll("'","'\\''")+"'";
    return {schemaVersion:'executionkit-v4-portable-provision/v1',status:'PROVISIONED',binary:'.executionkit/bin/executionkit',sourceCommit:receipt.sourceCommit,sha256:expected.sha256,next:projectCliCommand()+' update . --source '+quotedSource+' --apply'};
  }catch(error){
    if(installed||movedBinary)fs.rmSync(binary,{force:true});
    if(installed||movedIdentity)fs.rmSync(identityFile,{force:true});
    if(movedBinary)fs.renameSync(backupBinary,binary);
    if(movedIdentity)fs.renameSync(backupIdentity,identityFile);
    throw error;
  }finally{
    fs.rmSync(stagedBinary,{force:true});fs.rmSync(stagedIdentity,{force:true});
    fs.rmSync(buildDir,{recursive:true,force:true});
    fs.rmSync(lock,{force:true});
  }
}
