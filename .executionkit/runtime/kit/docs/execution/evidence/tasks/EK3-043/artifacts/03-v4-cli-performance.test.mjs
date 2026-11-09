import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { inspectRepositoryProviders } from '../lib/repository-providers.mjs';
import { loadTasks } from '../lib/execution-model.mjs';
import { clearV4KnowledgeContextCache, useV4Knowledge } from '../lib/v4-knowledge-runtime.mjs';
import { spawnBoundedSync } from '../lib/bounded-process.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'executionkit-perf-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=(args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return String(r.stdout??'').trim();};
  git(['init','-q']);git(['config','user.email','test@example.invalid']);git(['config','user.name','Perf Test']);
  fs.writeFileSync(path.join(root,'README.md'),'# Perf Test\n');
  fs.writeFileSync(path.join(root,'.gitignore'),'.executionkit/\n');
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify({
    standardVersion:'4.0.0-dev',
    repositoryIntelligence:{enabled:true,context:{maxBytes:16384},providers:{required:[],optional:[]},autoConsumption:{enabled:true,preferred:[],fallback:'native'}}
  },null,2)+'\n');
  git(['add','-A']);git(['commit','-qm','init']);
  return root;
}

test('provider inspection is native-only and creates no probe cache',t=>{
  const root=fixture(t);
  const report=inspectRepositoryProviders(root);
  assert.equal(report.mode,'NATIVE_ONLY');
  assert.deepEqual(report.providers.map((p)=>p.id),['native-macro-context','native-source-pack']);
  assert.ok(report.providers.every((p)=>p.health.processSpawned===false));
  assert.equal(fs.existsSync(path.join(root,'.executionkit/repository-intelligence/provider-probes-cache.json')),false);
});

test('cross-cutting and explicit Repomix requests remain native-only',t=>{
  const root=fixture(t);
  clearV4KnowledgeContextCache();
  let nativeCalls=0,externalCalls=0;
  const operations={
    nativeContext:()=>{nativeCalls++;return {artifact:{body:'NATIVE_DATA'},source:{provider:'native-macro-context'}};},
    repomixPack:()=>{externalCalls++;throw new Error('external process must not run');},
  };
  for(const options of [
    {task:{id:'TASK-1',title:'whole-repo architecture refactor',crossCutting:true}},
    {task:{id:'TASK-2',title:'normal'},requestRepomix:true,forceRefresh:true},
  ]){
    const result=useV4Knowledge(root,{purpose:'agent-context',operations,...options});
    assert.equal(result.data.context,'NATIVE_DATA');
    assert.deepEqual(result.decision.externalUsed,[]);
  }
  assert.ok(nativeCalls>=1);
  assert.equal(externalCalls,0);
});

test('Antigravity PreInvocation hook is constant-time by contract',()=>{
  const hook=fs.readFileSync(path.resolve('bin/antigravity-v4-hook.mjs'),'utf8');
  assert.doesNotMatch(hook,/buildV4ExecutionEnvelope|inspectRepositoryProviders|reconcileV4Lifecycle|inspectV4ProductClosure/);
  assert.match(hook,/recordV4HostObservation/);
  assert.match(hook,/intentionally lightweight/);
});

test('CLI start/status/next default to fast path and require --deep for full inspection',()=>{
  const cli=fs.readFileSync(path.resolve('bin/executionkit-cli.mjs'),'utf8');
  assert.match(cli,/const deep=has\('deep'\)/);
  assert.match(cli,/fast:!deep/);
  assert.match(cli,/DEFERRED_FAST_PATH/);
  assert.doesNotMatch(cli,/planRepositoryProviderTooling|applyRepositoryProviderTooling|doctorRepositoryProviderTooling/);
});

test('timing instrumentation still emits performance metrics',()=>{
  const kitCli=path.resolve('bin/executionkit-cli.mjs');
  const result=spawnSync(process.execPath,[kitCli,'activation','status','.','--timing'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const json=JSON.parse(result.stdout);
  assert.ok(json.performance);
  assert.equal(typeof json.performance.totalMs,'number');
});


test('v4 templates ship with no external repository providers',()=>{
  for(const rel of ['templates/execution.config.v4.json','templates/execution.config.json']){
    const cfg=JSON.parse(fs.readFileSync(path.resolve(rel),'utf8'));
    assert.deepEqual(cfg.repositoryIntelligence?.providers?.required??[],[]);
    assert.deepEqual(cfg.repositoryIntelligence?.providers?.optional??[],[]);
    assert.deepEqual(cfg.repositoryIntelligence?.autoConsumption?.preferred??[],[]);
  }
});

test('v4 operator scripts expose no external provider install or graph commands',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.resolve('package.json'),'utf8'));
  for(const name of [
    'repository:providers:plan','repository:providers:apply','repository:graph:index',
    'repository:tooling:plan','repository:tooling:apply','repository:tooling:doctor',
    'repository:tooling:catalog','repository:tooling:smoke'
  ])assert.equal(pkg.scripts[name],undefined,name);
});

test('v4 policy rejects legacy external repository tool configuration',async()=>{
  const { validateV4Policy }=await import('../lib/v4-config.mjs');
  const base=JSON.parse(fs.readFileSync(path.resolve('templates/execution.config.v4.json'),'utf8'));
  const cfg=structuredClone(base);
  cfg.capabilities={execution:'STANDARD',agent:'STANDARD',content:'STANDARD',seo:'STANDARD',audit:'STANDARD',test:'STANDARD',launch:'STANDARD'};
  cfg.adoption={...cfg.adoption,maturityProfile:'M2_ACTIVE_DEVELOPMENT',maturityRationale:['fixture'],maturityEvidence:{classifier:'executionkit-v4-maturity/v1'}};
  cfg.ci.projectRunnerLabel='project-perf-fixture';
  cfg.repositoryIntelligence.providers.optional=['repomix'];
  const result=validateV4Policy(cfg);
  assert.ok(result.errors.some((item)=>item.code==='V4_EXTERNAL_REPOSITORY_TOOLS_FORBIDDEN'));
});

test('State checkpoint source cannot trigger Product Closure inspection',()=>{
  const source=fs.readFileSync(path.resolve('lib/state-model.mjs'),'utf8');
  const fn=source.slice(source.indexOf('export function writeStateCheckpoint'),source.indexOf('function compare(',source.indexOf('export function writeStateCheckpoint')));
  assert.doesNotMatch(fn,/inspectV4ProductClosure|v4-product-closure/);
});


test('fast kernel uses lightweight State and indexed archives',()=>{
  const kernel=fs.readFileSync(path.resolve('lib/v4-kernel.mjs'),'utf8');
  assert.match(kernel,/rehydrateStateFast/);
  assert.match(kernel,/archiveMode:fastTaskPath\?'index':'full'/);
});

test('runtime planning uses manifest-only Agent routing',()=>{
  const runtime=fs.readFileSync(path.resolve('lib/runtime-orchestrator.mjs'),'utf8');
  assert.match(runtime,/resolveAgentContextFast/);
  assert.doesNotMatch(runtime,/resolveAgentContext\(/);
});

test('Agent delegation does not prebuild Repository Intelligence context',()=>{
  const agents=fs.readFileSync(path.resolve('lib/v4-agent-runtime.mjs'),'utf8');
  assert.doesNotMatch(agents,/useV4Knowledge|todoMaintenanceStatus/);
  assert.match(agents,/NATIVE_ON_DEMAND/);
  assert.match(agents,/archiveMode:'index'/);
});

test('fast task identity never hashes dirty file contents',()=>{
  const source=fs.readFileSync(path.resolve('lib/v4-gate-identity.mjs'),'utf8');
  const start=source.indexOf('export function captureV4FastWorktreeIdentity');
  const body=source.slice(start);
  assert.doesNotMatch(body,/hashFile\(/);
  assert.match(body,/FAST_TASK_METADATA/);
});


test('fast kernel explicitly defers phase and release convergence scans',()=>{
  const kernel=fs.readFileSync(path.resolve('lib/v4-kernel.mjs'),'utf8');
  assert.match(kernel,/includeConvergence:!fastTaskPath/);
  const agent=fs.readFileSync(path.resolve('lib/v4-agent-runtime.mjs'),'utf8');
  assert.match(agent,/includeConvergence:false/);
});

test('task dependency resolution reuses one graph index per batch',()=>{
  const parallel=fs.readFileSync(path.resolve('lib/parallel-execution.mjs'),'utf8');
  assert.match(parallel,/const taskIndex=new Map/);
  assert.match(parallel,/resolveNextExecution\(tasks, config, \{ mode, taskIndex, includeConvergence \}\)/);
  assert.match(parallel,/unresolvedDependencies\(task, tasks, config, taskIndex\)/);
});

test('Agent runtime status reads active claims only, not terminal history',()=>{
  const agent=fs.readFileSync(path.resolve('lib/v4-agent-runtime.mjs'),'utf8');
  const listStart=agent.indexOf('export function listV4AgentClaims');
  const listEnd=agent.indexOf('function hostDelegation',listStart);
  const listBody=agent.slice(listStart,listEnd);
  assert.match(listBody,/CLAIM_ROOT/);
  assert.doesNotMatch(listBody,/CLAIM_HISTORY_ROOT|historyClaimFile/);
  assert.match(agent,/archiveClaimRecord\(root,next\)/);
});


test('v4 task loading refuses legacy projection commands before spawning them',t=>{
  const root=fixture(t);
  const marker=path.join(root,'PROJECTION_MUST_NOT_RUN');
  const config={
    standardVersion:'4.0.0-dev',
    taskModel:{adapter:'projection-json',projectionPath:'projection.json',projectionCommand:`${process.execPath} -e "require('fs').writeFileSync('${marker.replaceAll('\\','\\\\')}','bad')"`}
  };
  const result=loadTasks(root,config);
  assert.ok(result.errors.some((item)=>item.code==='V4_PROJECTION_TASK_ADAPTER_FORBIDDEN'));
  assert.equal(fs.existsSync(marker),false);
});


test('v4 legacy direct executor cannot run project delegate commands',()=>{
  const runtime=fs.readFileSync(path.resolve('lib/runtime-orchestrator.mjs'),'utf8');
  assert.match(runtime,/V4_AGENT_OS_REQUIRED/);
  assert.match(runtime,/if\(v4StateRequired && !dryRun && delegateCommand\)/);
});

test('v4 Git operations have bounded fail-fast timeouts',()=>{
  const gate=fs.readFileSync(path.resolve('lib/v4-gate-identity.mjs'),'utf8');
  assert.match(gate,/timeout:10000/);
  const agents=fs.readFileSync(path.resolve('lib/v4-agent-runtime.mjs'),'utf8');
  assert.match(agents,/timeout=15000/);
  assert.doesNotMatch(agents,/300000/);
});


test('bounded subprocess runner terminates a hung command near its deadline',()=>{
  const started=Date.now();
  const result=spawnBoundedSync(process.execPath,['-e','setTimeout(()=>{},10000)'],{timeoutMs:1000,maxBuffer:1024*1024});
  const elapsed=Date.now()-started;
  assert.equal(result.timedOut,true,JSON.stringify({result,elapsed}));
  assert.equal(result.error?.code,'ETIMEDOUT');
  assert.ok(elapsed<5000,'bounded command took '+elapsed+'ms');
});

test('CLI boundary surface exposes explicit timeout override',()=>{
  const cli=fs.readFileSync(path.resolve('bin/executionkit-cli.mjs'),'utf8');
  assert.match(cli,/timeout-ms/);
  assert.match(cli,/runV4Boundary\(root,\{boundary:action/);
});


test('phase reconciliation skips remaining heavy systems after a test timeout',()=>{
  const source=fs.readFileSync(path.resolve('lib/v4-reconcile.mjs'),'utf8');
  assert.match(source,/SKIPPED_AFTER_TEST_TIMEOUT/);
  assert.match(source,/testTimedOut/);
  assert.match(source,/remaining-heavy-gates/);
});

test('bounded runner exposes periodic liveness heartbeat and process-tree kill',()=>{
  const source=fs.readFileSync(path.resolve('bin/bounded-process-runner.mjs'),'utf8');
  assert.match(source,/executionkit-v4-process-progress\/v1/);
  assert.match(source,/setInterval/);
  assert.match(source,/taskkill/);
  assert.match(source,/process\.kill\(-child\.pid/);
});


test('fast non-database task path does not inspect database authority contents',()=>{
  const kernel=fs.readFileSync(path.resolve('lib/v4-kernel.mjs'),'utf8');
  assert.match(kernel,/databaseRelevant\|\|heavyBoundary\|\|!fastTaskPath/);
  assert.match(kernel,/DEFERRED_FAST_NON_DB_TASK/);
  const database=fs.readFileSync(path.resolve('lib/database-integrity.mjs'),'utf8');
  assert.match(database,/contentReads:0/);
  assert.match(database,/hotPath:'manifest-metadata-only'/);
});

test('upgrade revalidation adds only a constant-time receipt read to the fast kernel',()=>{
  const kernel=fs.readFileSync(path.resolve('lib/v4-kernel.mjs'),'utf8');
  assert.match(kernel,/from '\.\/v4-upgrade-revalidation-status\.mjs'/);
  assert.doesNotMatch(kernel,/from '\.\/v4-upgrade-revalidation\.mjs'/);
  const status=fs.readFileSync(path.resolve('lib/v4-upgrade-revalidation-status.mjs'),'utf8');
  for(const forbidden of ['visual-os','database-integrity','v4-test-os','v4-audit-evidence','documentation-fabric','repository-intelligence-api','spawnSync','readdirSync','walkFiles']){
    assert.equal(status.includes(forbidden),false,forbidden);
  }
  assert.match(status,/upgrade-revalidation\.json/);
  assert.match(status,/readFileSync/);
  assert.doesNotMatch(status,/readJson\(path\.join\(root,\.\.\.INSTALL_RECEIPT_REL/);
});

