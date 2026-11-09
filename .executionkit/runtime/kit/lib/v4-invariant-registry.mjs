import crypto from 'node:crypto';

const SYSTEMS=['execution','agent','state','content','seo','docs','audit','test','launch','visual'];
const sha=(value)=>crypto.createHash('sha256').update(String(value)).digest('hex');
const norm=(value)=>String(value??'').replaceAll('\\','/').replace(/^\.\//,'');

function entry(id,owner,{revision=1,scope='CURRENT',cost='LIGHT',checks=[],sources=[]}={}){
  return Object.freeze({id,owner,revision,scope,cost,checks:Object.freeze([...checks]),sources:Object.freeze([...sources])});
}

export const V4_INVARIANT_REGISTRY=Object.freeze([
  entry('system.execution.closure','execution',{scope:'HISTORY',cost:'MEDIUM',checks:['execution-structure','product-closure'],sources:['STANDARD_V4.md','STANDARD_V5.md','AGENTS.md','lib/execution-model.mjs','lib/execution-signals.mjs','lib/execution-signals-outbox.mjs','lib/execution-collaboration.mjs','bin/validate-execution.mjs','lib/runtime-orchestrator.mjs','lib/v4-product-closure.mjs','lib/discovery-model.mjs','lib/todo-maintenance.mjs','lib/v4-boundary.mjs','lib/v4-reconcile.mjs','lib/reconcile-budget.mjs','lib/reconcile-runner.mjs','bin/reconcile-worker.mjs','lib/v4-activation.mjs','lib/v4-maturity.mjs','lib/v4-gate-identity.mjs','contracts/task-contract.md','contracts/finding-contract.md','contracts/phase-contract.md','contracts/execution-signals-v1-contract.md']}),
  entry('system.agent.routing','agent',{scope:'CURRENT',cost:'LIGHT',checks:['agent-layer'],sources:['lib/agent-model.mjs','lib/v4-agent-runtime.mjs','lib/parallel-execution.mjs','templates/.agents']}),
  entry('system.state.rehydration','state',{scope:'CURRENT',cost:'LIGHT',checks:['state-os'],sources:['lib/state-model.mjs','bin/state-status.mjs','bin/state-rehydrate.mjs','bin/state-checkpoint.mjs']}),
  entry('system.content.acceptance','content',{scope:'HISTORY',cost:'MEDIUM',checks:['content-os'],sources:['lib/v4-content-os.mjs','lib/content-model.mjs']}),
  entry('system.seo.acceptance','seo',{scope:'HISTORY',cost:'MEDIUM',checks:['seo-os'],sources:['lib/v4-seo-os.mjs','lib/seo-model.mjs','bin/seo-os.mjs']}),
  entry('system.docs.freshness','docs',{scope:'HISTORY',cost:'MEDIUM',checks:['docs-os'],sources:['lib/documentation-fabric.mjs','bin/documentation-fabric.mjs','contracts/document-authority-contract.md','contracts/documentation-fabric-contract.md']}),
  entry('system.audit.boundary','audit',{scope:'HISTORY',cost:'HEAVY',checks:['audit-os'],sources:['lib/v4-audit-evidence.mjs','bin/audit-project.mjs']}),
  entry('system.test.boundary','test',{revision:4,scope:'HISTORY',cost:'HEAVY',checks:['test-os'],sources:['lib/v4-test-os.mjs','lib/lighthouse-gate.mjs','bin/validate-seo-performance.mjs','lib/agentic-e2e.mjs','lib/agentic-postconditions.mjs','bin/init-agentic-e2e.mjs','bin/test-project.mjs','bin/run-tests.mjs','lib/impact-model.mjs','lib/test-evidence.mjs','contracts/agentic-e2e-contract.md']}),
  entry('system.launch.release','launch',{revision:8,scope:'RELEASE',cost:'MEDIUM',checks:['launch-os'],sources:['lib/provider-readiness.mjs','contracts/provider-readiness-contract.md','bin/launch-service.mjs','lib/launch-mobile.mjs','lib/launch-service','packages/global_mobile_updater','lib/native-host-policy.mjs','lib/production-deployment.mjs','lib/vhost-guard.mjs','lib/production-retention.mjs','lib/production-worker-retirement.mjs','lib/production-artifact-policy.mjs','lib/production-backup.mjs','lib/production-artifact-retention.mjs','lib/release-lifecycle.mjs','lib/v4-release-gates.mjs','bin/production-deployment.mjs','bin/release-project.mjs','bin/release-readiness.mjs','contracts/production-deployment-contract.md','contracts/release-gate-contract.md']}),
  entry('system.visual.premium','visual',{revision:5,scope:'HISTORY',cost:'MEDIUM',checks:['visual-os'],sources:['lib/media-integrity.mjs','lib/media-decode.py','lib/visual-production.mjs','lib/visual-production-plan.mjs','contracts/visual-production-v5-contract.md','lib/visual-os.mjs','lib/visual-audit.mjs','lib/visual-boundary.mjs','lib/visual-capture.mjs','lib/visual-contract.mjs','lib/visual-critic.mjs','lib/visual-enums.mjs','lib/visual-geometry.mjs','lib/visual-image.mjs','lib/visual-journeys.mjs','lib/visual-schema.mjs','lib/visual-schema-compiled.cjs','lib/visual-schema-runtime/ucs2length.cjs','lib/visual-schema-runtime/formats.cjs','lib/visual-schema-runtime/provenance.json','schemas/visual-finding.schema.json','lib/visual-surface.mjs','lib/visual-trace.mjs','bin/visual-project.mjs','bin/visual-boundary.mjs','contracts/visual-os-v2-contract.md','templates/visual/executionkit.visual.json','templates/visual/project-hooks.mjs','schemas/visual-config.schema.json','schemas/visual-artifact.schema.json','schemas/visual-review.schema.json','schemas/visual-run.schema.json','schemas/visual-remediation.schema.json','lib/quality-model.mjs','lib/component-model.mjs','templates/quality.contract.json','templates/executionkit.components.json','templates/executionkit.design.json']}),
  entry('fabric.database.integrity','database-fabric',{scope:'HISTORY',cost:'MEDIUM',checks:['database-guard'],sources:['lib/database-integrity.mjs']}),
  entry('fabric.route.integrity','route-fabric',{scope:'HISTORY',cost:'MEDIUM',checks:['route-guard'],sources:['lib/route-integrity.mjs']}),
  entry('fabric.surface.integrity','surface-fabric',{scope:'HISTORY',cost:'MEDIUM',checks:['surface-guard'],sources:['lib/surface-integrity.mjs','lib/anti-fake-guard.mjs','lib/ux-guard.mjs','lib/flutter-guard.mjs','lib/visuals-guard.mjs','lib/perf-guard.mjs']}),
  entry('fabric.decision.local-adapter','decision-adapter',{scope:'CURRENT',cost:'LIGHT',checks:['decision-adapter'],sources:['lib/decision-adapter.mjs','bin/decision-adapter.mjs','lib/decision-os.mjs','lib/decision','lib/v5-config.mjs','templates/execution.config.v5.json','schemas/execution-config-v5.schema.json']}),
  entry('fabric.evidence.durable-proof','evidence-fabric',{revision:2,scope:'HISTORY',cost:'MEDIUM',checks:['task-proof'],sources:['lib/task-proof.mjs','contracts/evidence-contract.md']}),
  entry('fabric.integration.journeys','integration-fabric',{scope:'HISTORY',cost:'MEDIUM',checks:['integration-contract'],sources:['lib/integration-model.mjs','lib/revalidation-model.mjs']}),
  entry('fabric.repository-intelligence','repository-intelligence',{scope:'CURRENT',cost:'LIGHT',checks:['repository-intelligence'],sources:['lib/repository-intelligence-api.mjs','lib/v4-knowledge-runtime.mjs','lib/repository-context.mjs','lib/repository-freshness.mjs','lib/repository-providers.mjs','bin/setup-repository-provider-tooling.mjs','contracts/repository-intelligence-contract.md']}),
  entry('host.antigravity.integration','host',{scope:'CURRENT',cost:'LIGHT',checks:['antigravity'],sources:['lib/antigravity-v4.mjs','bin/validate-deep-integration.mjs','bin/integrate-antigravity-v4.mjs','templates/AGENTS_V4.md','templates/AGENTS_V5.md']}),
  entry('kernel.policy-routing','kernel',{scope:'CURRENT',cost:'LIGHT',checks:['v4-policy','kernel-routing'],sources:['bin/executionkit-cli.mjs','bin/executionkit.mjs','lib/v4-cli-contract.mjs','lib/v4-kernel.mjs','lib/v4-config.mjs','lib/v4-context-economy.mjs','templates/execution.config.v4.json','schemas/execution-config-v4.schema.json']}),
  entry('platform.portability','platform',{revision:2,scope:'CURRENT',cost:'LIGHT',checks:['platform'],sources:['lib/v4-platform.mjs','lib/cli-output.mjs','lib/v4-cli-entry.mjs','lib/portable-process.mjs','lib/bounded-process.mjs','bin/bounded-process-runner.mjs']}),
  entry('control-plane.github-native','control-plane',{scope:'CURRENT',cost:'LIGHT',checks:['control-plane'],sources:['lib/v4-control-plane.mjs','templates/github/executionkit-v4.yml']}),
  entry('installer.upgrade-transaction','installer',{scope:'CURRENT',cost:'LIGHT',checks:['installer'],sources:['lib/v4-installer.mjs','lib/v4-upgrade-transform.mjs','lib/v4-source.mjs','lib/v4-update-discovery.mjs','lib/derived-state.mjs','lib/v4-invariant-registry.mjs','lib/v4-upgrade-revalidation.mjs','lib/v4-upgrade-revalidation-status.mjs','bin/upgrade-revalidation-worker.mjs']}),
]);

export const V4_INVARIANT_REGISTRY_VERSION='1';

export function sourceMatchesV4Invariant(pathValue,pattern){
  const rel=norm(pathValue),p=norm(pattern);
  return rel===p||rel.startsWith(p.endsWith('/')?p:p+'/');
}

export function validateV4InvariantRegistry(){
  const errors=[],ids=new Set();
  for(const item of V4_INVARIANT_REGISTRY){
    if(ids.has(item.id))errors.push({code:'V4_INVARIANT_DUPLICATE',id:item.id});
    ids.add(item.id);
    if(!item.owner||!item.checks.length||!item.sources.length)errors.push({code:'V4_INVARIANT_INCOMPLETE',id:item.id});
    if(!['CURRENT','HISTORY','RELEASE'].includes(item.scope))errors.push({code:'V4_INVARIANT_SCOPE_INVALID',id:item.id,scope:item.scope});
    if(!['LIGHT','MEDIUM','HEAVY'].includes(item.cost))errors.push({code:'V4_INVARIANT_COST_INVALID',id:item.id,cost:item.cost});
  }
  for(const system of SYSTEMS)if(!V4_INVARIANT_REGISTRY.some((item)=>item.owner===system))errors.push({code:'V4_INVARIANT_SYSTEM_UNCOVERED',system});
  for(const owner of ['database-fabric','route-fabric','evidence-fabric','integration-fabric','repository-intelligence','host','kernel','platform','control-plane','installer'])if(!V4_INVARIANT_REGISTRY.some((item)=>item.owner===owner))errors.push({code:'V4_INVARIANT_FABRIC_UNCOVERED',owner});
  return {status:errors.length?'FAIL':'PASS',errors,systems:[...SYSTEMS],invariantCount:V4_INVARIANT_REGISTRY.length};
}

export function buildV4InvariantManifest(runtimeManifest=[]){
  const files=(Array.isArray(runtimeManifest)?runtimeManifest:[]).map((item)=>({path:norm(item.path),sha256:String(item.sha256??'')})).filter((item)=>item.path&&item.sha256);
  const entries=V4_INVARIANT_REGISTRY.map((item)=>{
    const matched=files.filter((file)=>item.sources.some((source)=>sourceMatchesV4Invariant(file.path,source))).sort((a,b)=>a.path.localeCompare(b.path));
    const sourceFingerprint=sha(JSON.stringify(matched));
    const fingerprint=sha(JSON.stringify({id:item.id,revision:item.revision,owner:item.owner,scope:item.scope,checks:item.checks,sourceFingerprint}));
    return {id:item.id,owner:item.owner,revision:item.revision,scope:item.scope,cost:item.cost,checks:[...item.checks],sourceFingerprint,fingerprint,sourceCount:matched.length};
  });
  const fingerprint=sha(JSON.stringify(entries.map((item)=>({id:item.id,fingerprint:item.fingerprint}))));
  return {schemaVersion:'executionkit-v4-invariant-manifest/v1',registryVersion:V4_INVARIANT_REGISTRY_VERSION,fingerprint,entries};
}

export function diffV4InvariantManifests(previous,current){
  if(!current||current.schemaVersion!=='executionkit-v4-invariant-manifest/v1')throw new Error('Current v4 invariant manifest is missing/invalid');
  const before=new Map((previous?.entries??[]).map((item)=>[item.id,item]));
  const after=new Map((current.entries??[]).map((item)=>[item.id,item]));
  const changed=[];
  for(const item of current.entries??[]){
    const prior=before.get(item.id);
    if(!prior)changed.push({...item,reason:previous?'INVARIANT_ADDED':'BASELINE_MISSING',previousFingerprint:null});
    else if(prior.fingerprint!==item.fingerprint)changed.push({...item,reason:'INVARIANT_CHANGED',previousFingerprint:prior.fingerprint});
  }
  for(const item of previous?.entries??[])if(!after.has(item.id))changed.push({...item,reason:'INVARIANT_REMOVED',removed:true,previousFingerprint:item.fingerprint});
  const checks=[...new Set(changed.flatMap((item)=>item.checks??[]))];
  const scopes=[...new Set(changed.map((item)=>item.scope))];
  const costs=[...new Set(changed.map((item)=>item.cost))];
  return {
    schemaVersion:'executionkit-v4-invariant-delta/v1',
    previousFingerprint:previous?.fingerprint??null,
    currentFingerprint:current.fingerprint,
    changed,
    changedIds:changed.map((item)=>item.id),
    checks,
    scopes,
    costs,
    requiresHistoricalRevalidation:changed.some((item)=>item.scope==='HISTORY'),
    requiresReleaseRevalidation:changed.some((item)=>item.scope==='RELEASE'),
    currentOnly:changed.length>0&&changed.every((item)=>item.scope==='CURRENT'),
  };
}

export function planV4InvariantRevalidation(delta,{acceptedHistoryCount=0,releaseHistory=false}={}){
  const hasHistoricalBaseline=acceptedHistoryCount>0||releaseHistory===true;
  const applicable=hasHistoricalBaseline?(delta.changed??[]).filter((item)=>{
    if(item.scope==='CURRENT')return true;
    if(item.scope==='HISTORY')return acceptedHistoryCount>0;
    if(item.scope==='RELEASE')return releaseHistory===true;
    return false;
  }):[];
  const requiredChecks=[...new Set(applicable.flatMap((item)=>item.checks??[]))];
  const maxCost=applicable.some((item)=>item.cost==='HEAVY')?'HEAVY':applicable.some((item)=>item.cost==='MEDIUM')?'MEDIUM':applicable.length?'LIGHT':'NONE';
  return {
    schemaVersion:'executionkit-v4-invariant-revalidation-plan/v1',
    required:requiredChecks.length>0,
    acceptedHistoryCount,
    releaseHistory:releaseHistory===true,
    invariantIds:applicable.map((item)=>item.id),
    requiredChecks,
    maxCost,
    skippedInvariantIds:(delta.changed??[]).filter((item)=>!applicable.includes(item)).map((item)=>item.id),
  };
}

export function v4InvariantCoverageForPath(pathValue){
  const matches=V4_INVARIANT_REGISTRY.filter((item)=>item.sources.some((source)=>sourceMatchesV4Invariant(pathValue,source)));
  return {path:norm(pathValue),covered:matches.length>0,invariants:matches.map((item)=>item.id)};
}



