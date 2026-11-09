import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildV4ExecutionEnvelope } from '../lib/v4-kernel.mjs';
import { prepareV4AgentExecution } from '../lib/v4-agent-runtime.mjs';
import { buildV4ProjectConfig, prepareAgentManifestV4 } from '../lib/v4-upgrade-transform.mjs';
import { writeStateCheckpoint } from '../lib/state-model.mjs';
import { executeRuntimeStep } from '../lib/runtime-orchestrator.mjs';
import { maintainTodoAuthority, todoMaintenanceStatus } from '../lib/todo-maintenance.mjs';
import { INSTALLED_IGNORE_CONTENT } from '../lib/derived-state.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function git(root,args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return String(r.stdout??'').trim();}
function block({id,status='READY',phase='P01',depends='EK4-ACTIVATE',action=null,audit=null,parallel='NO',ownership='src/app',upgradeRevalidation=false}){
  return ['<!-- TASK:'+id+' -->','### '+id+' — fixture','- Status: '+status,'- Phase: '+phase,'- Priority: P1','- Depends: '+depends,'- Parallel Safe: '+parallel,'- Ownership: '+ownership,...(action?['- Action: '+action]:[]),...(audit?['- Audit Boundary: '+audit]:[]),...(upgradeRevalidation?['- Upgrade Revalidation: true']:[]),'- Contract: NONE','- Verification: NONE','- Evidence: '+(['ACCEPTED','RELEASED'].includes(status)?'commit:fixture':'PENDING'),'Objective: fixture','<!-- /TASK -->',''].join('\n');
}
function fixture(t,tasks){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-v4-kernel-')),sibling=path.join(path.dirname(root),'.executionkit-worktrees',path.basename(root));
  t.after(()=>{try{spawnSync('git',['-C',root,'worktree','prune']);}catch{}fs.rmSync(sibling,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});});
  const base=JSON.parse(fs.readFileSync(path.join(kitRoot,'templates/execution.config.json'),'utf8'));
  const v4=JSON.parse(fs.readFileSync(path.join(kitRoot,'templates/execution.config.v4.json'),'utf8'));
  const cfg=buildV4ProjectConfig(v4,{standardVersion:'4.0.0-dev',projectState:'ACTIVE'},'.executionkit/runtime/kit',base,{projectRunnerLabel:'project-v4-kernel-fixture'});
  cfg.projectState='ACTIVE';
  cfg.adoption={
    ...cfg.adoption,
    deepIntegrationRequired:true,
    integrationPhase:'EK4',
    integrationGateTaskId:'EK4-AUDIT',
    integrationActivationTaskId:'EK4-ACTIVATE',
    productExecutionBlockedUntilGateAccepted:true,
    activatedAt:'2026-09-20T00:00:00Z',
    activationEvidencePath:'.executionkit/gates/activation.json'
  };
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  fs.writeFileSync(path.join(root,'TODO.md'),['# TODO','','<!-- EXECUTIONKIT_TODO_SHARDS:START -->','- P01: `todo/P01.md`','<!-- EXECUTIONKIT_TODO_SHARDS:END -->',''].join('\n'));
  fs.mkdirSync(path.join(root,'todo'),{recursive:true});fs.writeFileSync(path.join(root,'todo/P01.md'),'# P01\n\n'+tasks.join(''));
  fs.mkdirSync(path.join(root,'todo/archive/EK4'),{recursive:true});
  fs.writeFileSync(path.join(root,'todo/archive/EK4/0001.md'),[
    '# Phase EK4 — terminal archive 0001','',
    'Terminal history only. This file is not executable backlog.','',
    '<!-- TASK:EK4-AUDIT -->','### EK4-AUDIT — phase gate','- Status: ACCEPTED','- Phase: EK4','- Priority: P0','- Depends: NONE','- Action: audit','- Audit Boundary: phase','- Contract: STANDARD_V4.md','- Verification: executionkit boundary phase .','- Evidence: commit:ek4-audit','Objective: phase gate','<!-- /TASK -->','',
    '<!-- TASK:EK4-ACTIVATE -->','### EK4-ACTIVATE — activate product execution','- Status: ACCEPTED','- Phase: EK4','- Priority: P0','- Depends: EK4-AUDIT','- Contract: STANDARD_V4.md','- Verification: executionkit activation status .','- Evidence: .executionkit/gates/activation.json','Objective: activate product execution','<!-- /TASK -->',''
  ].join('\n'));
  fs.mkdirSync(path.join(root,'.executionkit/gates'),{recursive:true});
  fs.writeFileSync(path.join(root,'.executionkit/.gitignore'),INSTALLED_IGNORE_CONTENT);
  fs.writeFileSync(path.join(root,'.executionkit/gates/activation.json'),'{"schemaVersion":"executionkit-v4-activation/v1","status":"ACTIVE"}\n');
  fs.cpSync(path.join(kitRoot,'templates/.agents'),path.join(root,'.agents'),{recursive:true});
  const rawManifest=JSON.parse(fs.readFileSync(path.join(root,'.agents/manifest.json'),'utf8'));
  const prepared=prepareAgentManifestV4(rawManifest);fs.writeFileSync(path.join(root,'.agents/manifest.json'),JSON.stringify(prepared.manifest,null,2)+'\n');
  fs.rmSync(path.join(root,'.agents/skills/dart-mcp'),{recursive:true,force:true});
  fs.writeFileSync(path.join(root,'.gitignore'),'.executionkit/\n');
  const maintenance=todoMaintenanceStatus(root,cfg);
  if(maintenance.needed)maintainTodoAuthority(root,cfg,{apply:true});
  git(root,['init','-q']);git(root,['add','-A']);git(root,['-c','user.name=ExecutionKit Test','-c','user.email=executionkit@example.invalid','commit','-qm','fixture']);
  writeStateCheckpoint(root,{reason:'fixture',contextHealth:'HEALTHY'});
  return root;
}

test('kernel blocks actionable mutation until State OS has a fresh checkpoint',t=>{
  const root=fixture(t,[block({id:'APP-1'})]);
  fs.rmSync(path.join(root,'.executionkit/state/latest.json'),{force:true});
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli'});
  assert.equal(envelope.state.status,'NO_SNAPSHOT');
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_STATE_REHYDRATION_REQUIRED'&&x.system==='state'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.nextCommand,'executionkit state checkpoint . --reason pre-mutation --context-health HEALTHY');
});

test('v4 direct runtime refuses fallback-only Agent OS routing',t=>{
  const root=fixture(t,[block({id:'APP-1'})]);
  const manifestPath=path.join(root,'.agents/manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  manifest.routing.routes=manifest.routing.routes.map((route)=>route.id==='route.implementation'
    ? {...route,when:{actions:['document']}}
    : route);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  writeStateCheckpoint(root,{reason:'route-fallback-fixture',contextHealth:'HEALTHY'});
  const result=executeRuntimeStep(root,{dryRun:true});
  assert.equal(result.status,'AGENT_ROUTE_REQUIRED',JSON.stringify(result));
  assert.equal(result.plan.routeId,null);
});

test('v4 direct runtime refuses to serialize a dependency-safe parallel Agent OS batch',t=>{
  const root=fixture(t,[block({id:'APP-1',parallel:'YES',ownership:'src/a'}),block({id:'APP-2',parallel:'YES',ownership:'src/b'})]);
  const result=executeRuntimeStep(root,{dryRun:true});
  assert.equal(result.status,'AGENT_DELEGATION_REQUIRED',JSON.stringify(result));
  assert.equal(result.plan.batch.length,2);
});

test('v4 direct runtime routes deploy actions exclusively to Launch OS',t=>{
  const root=fixture(t,[block({id:'DEPLOY-1',action:'deploy',ownership:'deployment'})]);
  const result=executeRuntimeStep(root,{dryRun:true});
  assert.equal(result.status,'LAUNCH_OS_REQUIRED',JSON.stringify(result));
  assert.equal(result.plan.action,'deploy');
});

test('v4 direct runtime routes phase audit actions exclusively to the Boundary Orchestrator',t=>{
  const root=fixture(t,[block({id:'APP-1',status:'ACCEPTED'}),block({id:'P01-AUDIT',depends:'APP-1',action:'audit',audit:'phase',ownership:'phase/P01'})]);
  const result=executeRuntimeStep(root,{dryRun:true});
  assert.equal(result.status,'BOUNDARY_ORCHESTRATOR_REQUIRED',JSON.stringify(result));
  assert.equal(result.boundary,'phase');
});

test('kernel requires Agent OS delegation instead of silently serializing a safe parallel batch',t=>{
  const root=fixture(t,[block({id:'APP-1',parallel:'YES',ownership:'src/a'}),block({id:'APP-2',parallel:'YES',ownership:'src/b'})]);
  let envelope=buildV4ExecutionEnvelope(root,{host:'cli'});
  assert.equal(envelope.runtime.batch.length,2,JSON.stringify(envelope.runtime));
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_AGENT_DELEGATION_REQUIRED'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.nextCommand,'executionkit agents run .');
  assert.equal(envelope.hostAction,'PREPARE_NATIVE_SUBAGENTS');

  const prepared=prepareV4AgentExecution(root,{apply:true});
  assert.equal(prepared.hostAction,'SPAWN_NATIVE_SUBAGENTS');
  envelope=buildV4ExecutionEnvelope(root,{host:'cli'});
  assert.equal(envelope.hostAction,'SPAWN_NATIVE_SUBAGENTS');
  assert.equal(envelope.hostDelegations.length,2);
  assert.equal(envelope.nextCommand,'executionkit agents status .');
});

test('kernel routes a canonical phase audit task to the atomic Boundary Orchestrator',t=>{
  const root=fixture(t,[block({id:'APP-1',status:'ACCEPTED'}),block({id:'P01-AUDIT',depends:'APP-1',action:'audit',audit:'phase',ownership:'phase/P01'})]);
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli'});
  assert.equal(envelope.runtime.task.id,'P01-AUDIT');
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_BOUNDARY_COMMAND_REQUIRED'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.nextCommand,'executionkit boundary phase .');
});

test('kernel routes deploy work to Launch OS instead of normal Agent execution',t=>{
  const root=fixture(t,[block({id:'DEPLOY-1',action:'deploy',ownership:'deployment'})]);
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli'});
  assert.equal(envelope.runtime.action,'deploy');
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_LAUNCH_COMMAND_REQUIRED'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.nextCommand,'executionkit launch status .');
});


test('kernel blocks database-impacting work until Database Integrity Fabric truth is current',t=>{
  const root=fixture(t,[block({id:'DB-1',ownership:'database/migrations'})]);
  fs.mkdirSync(path.join(root,'database/migrations'),{recursive:true});
  fs.writeFileSync(path.join(root,'database/migrations/2026_09_22_000000_create_users.php'),"<?php Schema::create('users', function (Blueprint $table) { $table->id(); $table->string('phone'); });");
  writeStateCheckpoint(root,{reason:'database-fixture',contextHealth:'HEALTHY'});
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli',fast:true});
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_DATABASE_CONTEXT_REQUIRED'&&x.system==='database-fabric'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.fabrics.database.required,true);
  assert.equal(envelope.fabrics.database.status,'MISSING');
  assert.equal(envelope.nextCommand,'executionkit db refresh .');
});
  
test('kernel blocks normal canonical execution while upgrade invariant revalidation is pending',t=>{
  const root=fixture(t,[block({id:'APP-1'})]);
  const receiptPath=path.join(root,'.executionkit/installation.json');
  fs.writeFileSync(receiptPath,JSON.stringify({schemaVersion:'executionkit-v4-install/v1'},null,2)+'\n');
  fs.writeFileSync(path.join(root,'.executionkit/upgrade-revalidation.json'),JSON.stringify({
    schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
    required:true,status:'PENDING',reason:'INVARIANT_DELTA',
    invariantIds:['fabric.database.integrity'],
    requiredChecks:['database-guard'],
    currentInvariantFingerprint:'new-invariants',
    acceptedHistoryCount:10,
    maxCost:'MEDIUM'
  },null,2)+'\n');
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli',fast:true});
  assert.ok(envelope.blockers.some((x)=>x.code==='V4_UPGRADE_REVALIDATION_REQUIRED'),JSON.stringify(envelope.blockers));
  assert.equal(envelope.nextCommand,'executionkit upgrade-revalidation run .');
  assert.equal(envelope.fabrics.upgradeRevalidation.blocking,true);
});

test('kernel permits the canonical upgrade correction task while the baseline is pending',t=>{
  const root=fixture(t,[block({id:'GAP-DATABASE-1',upgradeRevalidation:true})]);
  fs.writeFileSync(path.join(root,'.executionkit/installation.json'),JSON.stringify({schemaVersion:'executionkit-v4-install/v1'},null,2)+'\n');
  fs.writeFileSync(path.join(root,'.executionkit/upgrade-revalidation.json'),JSON.stringify({
    schemaVersion:'executionkit-v4-upgrade-revalidation-receipt/v1',
    required:true,status:'PENDING',reason:'INVARIANT_DELTA',
    invariantIds:['fabric.database.integrity'],
    requiredChecks:['database-guard'],
    currentInvariantFingerprint:'new-invariants',
    acceptedHistoryCount:10,
    maxCost:'MEDIUM'
  },null,2)+'\n');
  const envelope=buildV4ExecutionEnvelope(root,{host:'cli',fast:true});
  assert.equal(envelope.runtime.task?.id,'GAP-DATABASE-1',JSON.stringify(envelope.runtime));
  assert.equal(envelope.blockers.some((x)=>x.code==='V4_UPGRADE_REVALIDATION_REQUIRED'),false,JSON.stringify(envelope.blockers));
});

