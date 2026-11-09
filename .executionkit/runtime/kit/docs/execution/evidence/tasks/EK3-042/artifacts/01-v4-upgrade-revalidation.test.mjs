import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  V4_INVARIANT_REGISTRY,
  buildV4InvariantManifest,
  diffV4InvariantManifests,
  planV4InvariantRevalidation,
  validateV4InvariantRegistry,
  v4InvariantCoverageForPath,
} from '../lib/v4-invariant-registry.mjs';
import { upgradeRevalidationStatus } from '../lib/v4-upgrade-revalidation-status.mjs';
import { V4_SYSTEM_RUNTIME_CONTRACT } from '../lib/v4-systems-status.mjs';

function manifest(overrides={}){
  const files=new Map();
  for(const item of V4_INVARIANT_REGISTRY)for(const source of item.sources)files.set(source,'a'.repeat(64));
  for(const [file,hash] of Object.entries(overrides))files.set(file,hash);
  return [...files].map(([path,sha256])=>({path,sha256,mode:420}));
}
function temp(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-upgrade-revalidation-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'.executionkit'),{recursive:true});
  return root;
}

test('invariant registry covers all ten systems without creating an eleventh system',()=>{
  const checked=validateV4InvariantRegistry();
  assert.equal(checked.status,'PASS',JSON.stringify(checked.errors));
  assert.deepEqual(checked.systems,['execution','agent','state','content','seo','docs','audit','test','launch','visual']);
  assert.equal(new Set(V4_INVARIANT_REGISTRY.filter((item)=>checked.systems.includes(item.owner)).map((item)=>item.owner)).size,10);
});

test('unchanged invariant manifests require no upgrade revalidation',()=>{
  const before=buildV4InvariantManifest(manifest()),after=buildV4InvariantManifest(manifest());
  const delta=diffV4InvariantManifests(before,after);
  assert.deepEqual(delta.changedIds,[]);
  const plan=planV4InvariantRevalidation(delta,{acceptedHistoryCount:150,releaseHistory:false});
  assert.equal(plan.required,false);
  assert.deepEqual(plan.requiredChecks,[]);
});

test('visual-only runtime change routes only Visual OS revalidation',()=>{
  const before=buildV4InvariantManifest(manifest());
  const after=buildV4InvariantManifest(manifest({'lib/visual-os.mjs':'b'.repeat(64)}));
  const delta=diffV4InvariantManifests(before,after);
  assert.deepEqual(delta.changedIds,['system.visual.premium']);
  const plan=planV4InvariantRevalidation(delta,{acceptedHistoryCount:10});
  assert.deepEqual(plan.requiredChecks,['visual-os']);
  assert.equal(plan.maxCost,'MEDIUM');
});

test('database-only runtime change routes only full Database Guard revalidation',()=>{
  const before=buildV4InvariantManifest(manifest());
  const after=buildV4InvariantManifest(manifest({'lib/database-integrity.mjs':'c'.repeat(64)}));
  const delta=diffV4InvariantManifests(before,after);
  assert.deepEqual(delta.changedIds,['fabric.database.integrity']);
  const plan=planV4InvariantRevalidation(delta,{acceptedHistoryCount:10});
  assert.deepEqual(plan.requiredChecks,['database-guard']);
});

test('docs plus content changes do not drag unrelated Test Visual or Database checks',()=>{
  const before=buildV4InvariantManifest(manifest());
  const after=buildV4InvariantManifest(manifest({
    'lib/documentation-fabric.mjs':'d'.repeat(64),
    'lib/v4-content-os.mjs':'e'.repeat(64),
  }));
  const delta=diffV4InvariantManifests(before,after);
  const plan=planV4InvariantRevalidation(delta,{acceptedHistoryCount:20});
  assert.deepEqual(new Set(plan.requiredChecks),new Set(['docs-os','content-os']));
  for(const forbidden of ['test-os','visual-os','database-guard'])assert.equal(plan.requiredChecks.includes(forbidden),false,forbidden);
});

test('project with no accepted or release history skips historical upgrade sweep entirely',()=>{
  const delta=diffV4InvariantManifests(null,buildV4InvariantManifest(manifest()));
  const plan=planV4InvariantRevalidation(delta,{acceptedHistoryCount:0,releaseHistory:false});
  assert.equal(plan.required,false);
  assert.deepEqual(plan.requiredChecks,[]);
  assert.equal(plan.maxCost,'NONE');
});

test('launch invariant is revalidated only for projects with release history',()=>{
  const before=buildV4InvariantManifest(manifest());
  const after=buildV4InvariantManifest(manifest({'lib/production-deployment.mjs':'f'.repeat(64)}));
  const delta=diffV4InvariantManifests(before,after);
  assert.deepEqual(delta.changedIds,['system.launch.release']);
  assert.equal(planV4InvariantRevalidation(delta,{acceptedHistoryCount:10,releaseHistory:false}).required,false);
  assert.deepEqual(planV4InvariantRevalidation(delta,{acceptedHistoryCount:10,releaseHistory:true}).requiredChecks,['launch-os']);
});

test('upgrade revalidation hot-path status reads one small installation receipt only',t=>{
  const root=temp(t);
  fs.writeFileSync(path.join(root,'.executionkit/installation.json'),JSON.stringify({schemaVersion:'executionkit-v4-install/v1'}));
  fs.writeFileSync(path.join(root,'.executionkit/upgrade-revalidation.json'),JSON.stringify({
    schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
    required:true,status:'PENDING',requiredChecks:['database-guard'],invariantIds:['fabric.database.integrity'],currentInvariantFingerprint:'current',maxCost:'MEDIUM'
  }));
  const result=upgradeRevalidationStatus(root);
  assert.equal(result.blocking,true);
  assert.deepEqual(result.requiredChecks,['database-guard']);
  const source=fs.readFileSync(new URL('../lib/v4-upgrade-revalidation-status.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/v4-upgrade-revalidation\.mjs|visual-os|database-integrity|v4-test-os|audit-project|walkFiles|readdirSync|spawnSync/);
});

test('every declared ten-system runtime enforcement file is mapped to at least one upgrade invariant',()=>{
  const files=[...new Set(Object.values(V4_SYSTEM_RUNTIME_CONTRACT).flatMap((system)=>system.files??[]))];
  const uncovered=files.filter((file)=>!v4InvariantCoverageForPath(file).covered);
  assert.deepEqual(uncovered,[]);
});

test('every invariant-declared check has an executable runner branch',()=>{
  const runner=fs.readFileSync(new URL('../lib/v4-upgrade-revalidation.mjs',import.meta.url),'utf8');
  const checks=[...new Set(V4_INVARIANT_REGISTRY.flatMap((item)=>item.checks??[]))];
  const missing=checks.filter((id)=>!runner.includes("id==='"+id+"'"));
  assert.deepEqual(missing,[]);
});

test('v4 authoritative contracts and Agent resources cannot exist outside invariant mapping',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const walk=(dir,out=[])=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())walk(full,out);
      else if(entry.isFile())out.push(path.relative(root,full).split(path.sep).join('/'));
    }
    return out;
  };
  const authorities=[
    'STANDARD_V4.md','AGENTS.md','templates/AGENTS_V4.md',
    ...walk(path.join(root,'contracts')).filter((file)=>file.endsWith('.md')),
    ...walk(path.join(root,'templates/.agents')).filter((file)=>/\.(?:md|json)$/.test(file)),
  ];
  const uncovered=authorities.filter((file)=>!v4InvariantCoverageForPath(file).covered);
  assert.deepEqual(uncovered,[]);
});

