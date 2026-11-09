import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inventoryProductionTree, compareProductionInventory } from './production-artifact-policy.mjs';

// Project-local immutable build copies are separate from live production releases.
// Only complete, manifest-verified producer directories can be housekeeping targets.
export function retainProductionArtifactCache(base,state,policy,{now=Date.now()}={}){
  if(!policy.enabled)return {status:'DISABLED',removed:[]};
  const records=[],skipped=[],removed=[];
  for(const name of fs.readdirSync(base)){
    const dir=path.join(base,name),stat=fs.lstatSync(dir);
    if(!/^[a-f0-9]{12}-[a-f0-9]{12}$/.test(name)||!stat.isDirectory()||stat.isSymbolicLink()){skipped.push({releaseId:name,reason:'UNKNOWN_ARTIFACT'});continue;}
    if(fs.readdirSync(dir).sort().join('|')!=='manifest.json|payload'){skipped.push({releaseId:name,reason:'UNOWNED_EXTRA_FILES'});continue;}
    const file=path.join(dir,'manifest.json');
    try{
      if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw new Error('unsafe manifest');
      const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
      if(manifest.releaseId!==name||!Array.isArray(manifest.files)||!Number.isFinite(Date.parse(manifest.builtAt)))throw new Error('invalid manifest');
      const fingerprint=crypto.createHash('sha256').update(JSON.stringify({head:manifest.repository?.head,files:manifest.files.map(({path,sha256,size,mode})=>({path,sha256,size,mode}))})).digest('hex');
      if(typeof manifest.repository?.head!=='string'||`${manifest.repository.head.slice(0,12)}-${fingerprint.slice(0,12)}`!==name)throw new Error('unbound artifact identity');
      records.push({releaseId:name,dir,manifest});
    }catch{skipped.push({releaseId:name,reason:'INVALID_ARTIFACT_MANIFEST'});}
  }
  // Live rollback bytes exist under /releases. Build-cache copies are separate and
  // default to current-only, avoiding a second duplicate rollback on disk.
  const keepCopies=policy.artifactKeepRollbacks??policy.keepRollbacks;
  const kept=new Set([state.releaseId]);
  if(keepCopies>0&&state.previousReleaseDir)kept.add(path.basename(state.previousReleaseDir));
  records.sort((a,b)=>Date.parse(b.manifest.builtAt)-Date.parse(a.manifest.builtAt));
  for(const record of records)if(kept.size<keepCopies+1)kept.add(record.releaseId);
  for(const record of records){
    if(kept.has(record.releaseId))continue;
    if(now-Date.parse(record.manifest.builtAt)<policy.minimumAgeMinutes*60000){skipped.push({releaseId:record.releaseId,reason:'MINIMUM_ARTIFACT_AGE'});continue;}
    const payload=path.join(record.dir,'payload');
    if(!fs.lstatSync(payload).isDirectory()||fs.lstatSync(payload).isSymbolicLink()){skipped.push({releaseId:record.releaseId,reason:'UNSAFE_PAYLOAD'});continue;}
    const actual=inventoryProductionTree(payload);
    if(actual.errors.length||compareProductionInventory(record.manifest.files,actual.files).length){skipped.push({releaseId:record.releaseId,reason:'UNOWNED_OR_TAMPERED_PAYLOAD'});continue;}
    fs.rmSync(record.dir,{recursive:true});removed.push(record.releaseId);
  }
  return {status:skipped.length?'DEFERRED':'PASS',removed,kept:[...kept],skipped};
}
