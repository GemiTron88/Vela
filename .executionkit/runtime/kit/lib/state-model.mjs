import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, loadTasks, resolveNextExecution, canonicalState, extractDependencies, extractTags, closureSummary } from './execution-model.mjs';
import { resolveAgentContext } from './agent-model.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from './derived-state.mjs';
import { canonicalRepositoryKey } from './repository-identity.mjs';
import { repositoryKnowledgeCheckpointSummary } from './repository-knowledge-store.mjs';
import { todoShardSources } from './todo-shards.mjs';

const STATE_SCHEMA = '1.0.0';
export const DEFAULT_STATE_CONFIG = Object.freeze({
  enabled: true,
  snapshotPath: '.executionkit/state/latest.json',
  journalPath: '.executionkit/state/journal.ndjson',
  checkpointOnRuntimeTransitions: true,
  requireRehydrateOnDrift: true,
  heartbeatMinutes: 20,
  memory: Object.freeze({ mode: 'auto', authority: 'advisory', requireLiveRevalidation: true, allowTaskState: false }),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const normalize = (value) => String(value).split(path.sep).join('/');
function stateConfig(config = {}) {
  const configured = config.state ?? {};
  return { ...DEFAULT_STATE_CONFIG, ...configured, memory: { ...DEFAULT_STATE_CONFIG.memory, ...(configured.memory ?? {}) } };
}
function runGitRaw(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) return { ok: false, value: '', error: (result.stderr || result.error?.message || '').trim() || `git ${args.join(' ')} failed` };
  return { ok: true, value: result.stdout ?? '', error: null };
}
function runGit(root, args) {
  const result = runGitRaw(root, args);
  return result.ok ? { ...result, value: result.value.trim() } : result;
}
function hashProjectFile(root, rel, label) {
  if (!rel) return { path: rel ?? null, exists: false, sha256: null };
  try {
    const full = resolveProjectPathSafe(root, rel, label, { mustExist: true, file: true });
    return { path: normalize(rel), exists: true, sha256: sha256(fs.readFileSync(full)) };
  } catch { return { path: normalize(rel), exists: false, sha256: null }; }
}
function hashTaskAuthority(root,config){
  const plan=todoShardSources(root,config);
  if(plan.errors.length)return {path:config.todoPath,exists:false,sha256:null,sources:[],errors:plan.errors};
  const sources=plan.mode==='sharded'
    ? [plan.manifestPath,...plan.active.map((x)=>x.path),...plan.archives]
    : [config.todoPath,...(config.taskArchivePaths??[])];
  const parts=[];
  for(const rel of [...new Set(sources)]){
    const item=hashProjectFile(root,rel,'canonical TODO authority '+rel);
    if(!item.exists||!item.sha256)return {path:config.todoPath,exists:false,sha256:null,sources,errors:[{code:'TODO_AUTHORITY_SOURCE_MISSING',path:rel}]};
    parts.push(rel+'\0'+item.sha256);
  }
  return {path:config.todoPath,exists:true,sha256:sha256(parts.join('\n')),sources,errors:[]};
}
function unquoteGitPath(raw) {
  let s = String(raw ?? '').trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).replace(/\\([\\"])/g, '$1');
  }
  return s;
}
function parseStatusPaths(statusText) {
  return statusText.split('\n').map((line) => line.trimEnd()).filter(Boolean).map((line) => {
    const raw = line.length > 3 ? line.slice(3) : line;
    const renamed = raw.includes(' -> ') ? raw.split(' -> ').at(-1) : raw;
    return unquoteGitPath(renamed);
  }).filter(Boolean).sort();
}
function workingTreeFingerprint(root, statusText) {
  const hash = crypto.createHash('sha256');
  hash.update(statusText);
  for (const rel of parseStatusPaths(statusText)) {
    hash.update(`\0PATH\0${rel}\0`);
    const full = path.resolve(root, rel), delta = path.relative(root, full);
    if (!delta || delta.startsWith('..') || path.isAbsolute(delta)) { hash.update('UNSAFE_PATH'); continue; }
    try {
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        hash.update(`SYMLINK\0${fs.readlinkSync(full)}`);
      } else if (stat.isFile()) {
        hash.update(`FILE\0${stat.mode}\0${stat.size}\0`);
        hash.update(fs.readFileSync(full));
      } else if (stat.isDirectory()) {
        const nestedHead = runGit(full, ['rev-parse', 'HEAD']);
        const nestedStatus = runGitRaw(full, ['status', '--porcelain=v1', '--untracked-files=all']);
        hash.update(`DIR\0${nestedHead.ok ? nestedHead.value : 'NO_HEAD'}\0${nestedStatus.ok ? nestedStatus.value : 'NO_STATUS'}`);
      } else {
        hash.update(`OTHER\0${stat.mode}\0${stat.size}`);
      }
    } catch (error) {
      if (error?.code === 'ENOENT') hash.update('MISSING');
      else hash.update(`ERROR\0${error?.code ?? error?.message ?? 'UNKNOWN'}`);
    }
  }
  return hash.digest('hex');
}
export function captureGitState(root) {
  const inside = runGit(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.value !== 'true') return { available: false, error: inside.error || 'not a Git worktree' };
  const head = runGit(root, ['rev-parse', 'HEAD']);
  const branch = runGit(root, ['branch', '--show-current']);
  const status = runGitRaw(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  const upstream = runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  let ahead = null, behind = null;
  if (upstream.ok) {
    const counts = runGit(root, ['rev-list', '--left-right', '--count', `HEAD...${upstream.value}`]);
    if (counts.ok) {
      const [left, right] = counts.value.split(/\s+/).map(Number);
      if (Number.isFinite(left) && Number.isFinite(right)) { ahead = left; behind = right; }
    }
  }
  const origin = runGit(root, ['config', '--get', 'remote.origin.url']);
  return {
    available: head.ok && status.ok,
    head: head.ok ? head.value : null,
    branch: branch.ok && branch.value ? branch.value : 'DETACHED',
    dirty: status.ok ? Boolean(status.value.trim()) : null,
    dirtyPaths: status.ok ? parseStatusPaths(status.value) : [],
    workingTreeHash: status.ok ? workingTreeFingerprint(root, status.value) : null,
    upstream: upstream.ok ? upstream.value : null,
    ahead, behind,
    repositoryKey: origin.ok ? canonicalRepositoryKey(origin.value) : null,
    error: head.ok && status.ok ? null : [head.error, status.error].filter(Boolean).join('; '),
  };
}


export function captureGitStateFast(root) {
  const head=runGit(root,['rev-parse','HEAD']);
  if(!head.ok)return {available:false,head:null,branch:null,error:head.error||'not a Git worktree',identityMode:'FAST_TASK'};
  const branch=runGit(root,['branch','--show-current']);
  return {
    available:true,
    head:head.value,
    branch:branch.ok&&branch.value?branch.value:'DETACHED',
    dirty:null,
    dirtyPaths:[],
    workingTreeHash:null,
    upstream:null,
    ahead:null,
    behind:null,
    repositoryKey:null,
    error:null,
    identityMode:'FAST_TASK',
  };
}

function lifecycleFromRuntimePlan(runtimePlan,snapshot=null) {
  if(!runtimePlan)return snapshot?.lifecycle??{status:'UNKNOWN',task:null,action:null,routeId:null,resourceIds:{},dependencies:[],closure:null};
  if(runtimePlan.status!=='READY')return {
    status:runtimePlan.status??'NO_ACTIONABLE_WORK',
    task:null,
    action:null,
    routeId:null,
    resourceIds:{},
    dependencies:[],
    closure:runtimePlan.closure??null,
  };
  return {
    status:'READY',
    task:{
      id:runtimePlan.task?.id??null,
      observedState:runtimePlan.task?.state??null,
      semanticState:runtimePlan.task?.semanticState??null,
      title:runtimePlan.task?.title??null,
    },
    action:runtimePlan.action??null,
    routeId:runtimePlan.routeId??null,
    resourceIds:Object.fromEntries(Object.entries(runtimePlan.resources??{}).map(([kind,values])=>[kind,(values??[]).map((item)=>item.id).filter(Boolean)])),
    dependencies:extractDependencies(runtimePlan.task??{}),
    closure:runtimePlan.closure??null,
  };
}
function lifecycleEnvelope(root, config, tasks) {
  const next = resolveNextExecution(tasks, config, { mode: 'closure' });
  if (!next) return { status: 'NO_ACTIONABLE_WORK', task: null, action: null, routeId: null, resourceIds: {}, dependencies: [], closure: closureSummary(tasks, config) };
  const context = { taskId: next.task.id, action: next.action, state: canonicalState(next.task, config), phase: next.task.meta?.Phase ?? null, tags: extractTags(next.task), risk: next.task.meta?.Risk ?? null };
  const routed = resolveAgentContext(root, config, context);
  return {
    status: 'READY',
    task: { id: next.task.id, observedState: next.task.meta?.Status ?? null, semanticState: canonicalState(next.task, config), title: next.task.title ?? null },
    action: next.action,
    routeId: routed.routeId,
    resourceIds: Object.fromEntries(Object.entries(routed.resources).map(([kind, values]) => [kind, values.map((item) => item.id)])),
    dependencies: extractDependencies(next.task),
    closure: closureSummary(tasks, config),
  };
}
function productClosureObservation(root,repositoryHead){
  const file=resolveDerivedPath(root,'.executionkit/discovery/product-closure.json','Product Closure state observation');
  if(!fs.existsSync(file))return {status:'UNOBSERVED',current:false,repositoryHead:null,blockingCount:null,taskIds:[]};
  try{
    const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value.schemaVersion!=='executionkit-v4-product-closure/v1')return {status:'INVALID',current:false,repositoryHead:value.repositoryHead??null,blockingCount:null,taskIds:[]};
    const taskIds=[...(value.createdTasks??[]),...(value.reopenedTasks??[]),...(value.trackedGapTasks??[])].map((x)=>x.id).filter(Boolean).sort();
    return {status:value.status??'UNKNOWN',current:Boolean(repositoryHead&&value.repositoryHead===repositoryHead),repositoryHead:value.repositoryHead??null,blockingCount:Array.isArray(value.blockingGaps)?value.blockingGaps.length:null,taskIds};
  }catch(error){return {status:'INVALID',current:false,repositoryHead:null,blockingCount:null,taskIds:[],error:error.message};}
}
export function inspectLiveState(root) {
  const { config, source } = loadConfig(root);
  if (!source) throw new Error('ExecutionKit state requires execution.config.json');
  const loaded = loadTasks(root, config);
  if (loaded.errors.length) throw new Error(loaded.errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
  const state = stateConfig(config), manifestPath = config.agent?.manifestPath || '.agents/manifest.json';
  const repository=captureGitState(root);
  return {
    schemaVersion: STATE_SCHEMA, generatedAt: now(), standardVersion: config.standardVersion, config: state,
    canonical: {
      todo: hashTaskAuthority(root, config),
      executionConfig: hashProjectFile(root, normalize(path.relative(root, source)), 'execution config'),
      agentManifest: hashProjectFile(root, manifestPath, 'agent manifest'),
    },
    repository,
    repositoryIntelligence: repositoryKnowledgeCheckpointSummary(root, config),
    productClosure: productClosureObservation(root,repository.head),
    lifecycle: lifecycleEnvelope(root, config, loaded.tasks),
  };
}
function validateStateConfig(root, config) {
  const errors = [], cfg = stateConfig(config);
  for (const [key, value] of [['snapshotPath', cfg.snapshotPath], ['journalPath', cfg.journalPath]]) {
    if (typeof value !== 'string' || !value.replaceAll('\\', '/').replace(/^\.\//, '').startsWith('.executionkit/')) errors.push({ code: 'STATE_DERIVED_PATH_INVALID', message: `state.${key} must stay under .executionkit/` });
    else { try { resolveDerivedPath(root, value, `state.${key}`); } catch (error) { errors.push({ code: 'STATE_DERIVED_PATH_INVALID', message: error.message }); } }
  }
  if (!Number.isInteger(cfg.heartbeatMinutes) || cfg.heartbeatMinutes < 5 || cfg.heartbeatMinutes > 240) errors.push({ code: 'STATE_HEARTBEAT_INVALID', message: 'state.heartbeatMinutes must be an integer from 5 to 240' });
  if (!['auto', 'disabled', 'required'].includes(cfg.memory.mode)) errors.push({ code: 'STATE_MEMORY_MODE_INVALID', message: 'state.memory.mode must be auto, disabled or required' });
  if (cfg.memory.authority !== 'advisory' || cfg.memory.requireLiveRevalidation !== true || cfg.memory.allowTaskState !== false) errors.push({ code: 'STATE_MEMORY_AUTHORITY_INVALID', message: 'external memory must remain advisory, require live revalidation and forbid task-state authority' });
  return { config: cfg, errors };
}
export function validateStateOS(root) {
  const { config, source } = loadConfig(root), checked = validateStateConfig(root, config), errors = [...checked.errors];
  if (!source) errors.push({ code: 'STATE_EXECUTION_CONFIG_MISSING', message: 'execution.config.json is required' });
  const taskAuthority=todoShardSources(root,config);
  for(const issue of taskAuthority.errors)errors.push({code:'STATE_AUTHORITY_MISSING',message:'['+issue.code+'] '+issue.message});
  const authorityPaths=taskAuthority.mode==='sharded'?[taskAuthority.manifestPath,...taskAuthority.active.map((x)=>x.path),...taskAuthority.archives]:[config.todoPath,...(config.taskArchivePaths??[])];
  for (const rel of [...new Set([...authorityPaths,config.agent?.manifestPath || '.agents/manifest.json'])]) {
    try { resolveProjectPathSafe(root, rel, `State OS authority ${rel}`, { mustExist: true, file: true }); }
    catch (error) { errors.push({ code: 'STATE_AUTHORITY_MISSING', message: error.message }); }
  }
  return { status: errors.length ? 'FAIL' : checked.config.enabled === false ? 'DISABLED' : 'PASS', config: checked.config, errors };
}
export function stateSnapshotPath(root, config = null, { create = false } = {}) {
  const cfg = config ?? stateConfig(loadConfig(root).config);
  return resolveDerivedPath(root, cfg.snapshotPath, 'State OS latest snapshot', { createParents: create });
}
export function stateJournalPath(root, config = null, { create = false } = {}) {
  const cfg = config ?? stateConfig(loadConfig(root).config);
  return resolveDerivedPath(root, cfg.journalPath, 'State OS journal', { createParents: create });
}
export function readStateSnapshot(root, { strict = true } = {}) {
  const cfg = stateConfig(loadConfig(root).config), file = stateSnapshotPath(root, cfg);
  if (!fs.existsSync(file)) return null;
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (strict) throw error;
    return null;
  }
  if (value.schemaVersion !== STATE_SCHEMA) throw new Error(`Unsupported State OS snapshot schema ${value.schemaVersion ?? 'MISSING'}`);
  if (value.authority !== 'DERIVED_NON_AUTHORITATIVE') throw new Error('State OS snapshot authority marker is invalid');
  return value;
}
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, content); fs.renameSync(tmp, file); } finally { if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true }); }
}
function appendJournalBounded(journal, snapshot) {
  fs.mkdirSync(path.dirname(journal), { recursive: true });
  fs.appendFileSync(journal, `${JSON.stringify(snapshot)}\n`);
  try {
    const stat = fs.statSync(journal);
    if (stat.size > 512 * 1024) {
      const lines = fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean);
      if (lines.length > 500) {
        atomicWrite(journal, `${lines.slice(-400).join('\n')}\n`);
      }
    }
  } catch {}
}
function inferNextSafeAction(lifecycle) {
  if (!lifecycle || lifecycle.status === 'NO_ACTIONABLE_WORK') return 'Re-run canonical readiness/closure inspection before claiming completion.';
  return `Rehydrate live repository truth, then continue only ${lifecycle.task?.id ?? 'the selected canonical task'} / ${lifecycle.action ?? 'the selected lifecycle action'}.`;
}
export function writeStateCheckpoint(root, options = {}) {
  if(options.fast===true)return writeFastStateCheckpoint(root,options);
  const { config: preConfig } = loadConfig(root);
  const preState = stateConfig(preConfig);
  if (preState.enabled !== false) stateSnapshotPath(root, preState, { create: true });
  const live = inspectLiveState(root);
  if (live.config.enabled === false) return { status: 'STATE_DISABLED', live };
  const validation = validateStateOS(root);
  if (validation.errors.length) throw new Error(validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
  const explicitWorking = Array.isArray(options.workingFiles) ? options.workingFiles.map(normalize) : [];
  const snapshot = {
    schemaVersion: STATE_SCHEMA, authority: 'DERIVED_NON_AUTHORITATIVE', capturedAt: now(), reason: String(options.reason || 'manual'), standardVersion: live.standardVersion,
    canonical: live.canonical, repository: live.repository, lifecycle: live.lifecycle,
    repositoryIntelligence: live.repositoryIntelligence,
    productClosure: live.productClosure,
    working: {
      files: [...new Set([...(live.repository.dirtyPaths ?? []), ...explicitWorking])].sort(),
      contextHealth: String(options.contextHealth || 'UNKNOWN').toUpperCase(),
      nextSafeAction: options.nextSafeAction ? String(options.nextSafeAction) : inferNextSafeAction(live.lifecycle),
      note: options.note ? String(options.note) : null,
    },
    evidenceRefs: [...new Set((options.evidenceRefs ?? []).map(String))],
    runtime: options.runtimeStatus ? { status: String(options.runtimeStatus) } : null,
    memoryPolicy: live.config.memory,
  };
  atomicWrite(stateSnapshotPath(root, live.config, { create: true }), `${JSON.stringify(snapshot, null, 2)}\n`);
  const journal = stateJournalPath(root, live.config, { create: true });
  appendJournalBounded(journal, snapshot);
  return { status: 'CHECKPOINTED', snapshot };
}
function compare(name, prior, current, reasons) { if (prior !== current) reasons.push({ field: name, previous: prior ?? null, current: current ?? null }); }
export function rehydrateStateFast(root,{runtimePlan=null,config=null}={}) {
  const effectiveConfig=config??loadConfig(root).config;
  const cfg=stateConfig(effectiveConfig);
  const snapshot=readStateSnapshot(root,{strict:false});
  const repository=captureGitStateFast(root);
  const lifecycle=lifecycleFromRuntimePlan(runtimePlan,snapshot);
  const live={
    schemaVersion:STATE_SCHEMA,
    generatedAt:now(),
    standardVersion:effectiveConfig.standardVersion,
    config:cfg,
    canonical:snapshot?.canonical??{},
    repository,
    repositoryIntelligence:snapshot?.repositoryIntelligence??{status:'DEFERRED_FAST_PATH',trustState:null},
    productClosure:snapshot?.productClosure??{status:'DEFERRED_FAST_PATH',current:null},
    lifecycle,
    identityMode:'FAST_TASK',
  };
  if(!snapshot)return {
    schemaVersion:STATE_SCHEMA,status:'NO_SNAPSHOT',safeToResume:false,live,snapshot:null,drift:[],
    identityMode:'FAST_TASK',
    requiredAction:'Create one State OS checkpoint before relying on resumable execution state.'
  };
  const drift=[];
  compare('standardVersion',snapshot.standardVersion,live.standardVersion,drift);
  compare('repository.head',snapshot.repository?.head,repository.head,drift);
  compare('repository.branch',snapshot.repository?.branch,repository.branch,drift);
  compare('lifecycle.task.id',snapshot.lifecycle?.task?.id,lifecycle.task?.id,drift);
  compare('lifecycle.action',snapshot.lifecycle?.action,lifecycle.action,drift);
  const ageMinutes=snapshot.capturedAt?Math.round((Date.now()-Date.parse(snapshot.capturedAt))/60000):null;
  if(Number.isFinite(ageMinutes)&&ageMinutes>cfg.heartbeatMinutes*2){
    drift.push({field:'checkpoint.ageMinutes',previous:ageMinutes,current:`<= ${cfg.heartbeatMinutes*2}`});
  }
  const status=drift.length?'DRIFTED':'FRESH';
  return {
    schemaVersion:STATE_SCHEMA,status,safeToResume:status==='FRESH',live,snapshot,drift,
    identityMode:'FAST_TASK',
    repositoryIntelligenceDrift:[],
    repositoryIntelligenceAction:null,
    requiredAction:status==='FRESH'
      ? snapshot.working?.nextSafeAction??inferNextSafeAction(lifecycle)
      : 'Refresh the lightweight State checkpoint from current task/HEAD truth; deep validation is deferred to the next boundary.'
  };
}

function writeFastStateCheckpoint(root,options={}) {
  const {config,source}=loadConfig(root);
  const cfg=stateConfig(config);
  if(cfg.enabled===false)return {status:'STATE_DISABLED',live:null};
  stateSnapshotPath(root,cfg,{create:true});
  const previous=readStateSnapshot(root,{strict:false});
  const repository=captureGitStateFast(root);
  let lifecycle=options.runtimePlan?lifecycleFromRuntimePlan(options.runtimePlan,previous):null;
  if(!lifecycle){
    try{
      const loaded=loadTasks(root,config);
      if(!loaded.errors.length)lifecycle=lifecycleEnvelope(root,config,loaded.tasks);
    }catch{}
    lifecycle??=lifecycleFromRuntimePlan(null,previous);
  }
  const manifestPath=config.agent?.manifestPath||'.agents/manifest.json';
  const canonical=source?{
    todo:hashTaskAuthority(root,config),
    executionConfig:hashProjectFile(root,normalize(path.relative(root,source)),'execution config'),
    agentManifest:hashProjectFile(root,manifestPath,'agent manifest'),
  }:(previous?.canonical??{});
  const explicitWorking=Array.isArray(options.workingFiles)?options.workingFiles.map(normalize):[];
  const snapshot={
    schemaVersion:STATE_SCHEMA,
    authority:'DERIVED_NON_AUTHORITATIVE',
    identityMode:'FAST_TASK',
    capturedAt:now(),
    reason:String(options.reason||'fast-task'),
    standardVersion:config.standardVersion,
    canonical,
    repository:{
      ...(previous?.repository??{}),
      ...repository,
      upstream:repository.upstream??previous?.repository?.upstream??null,
      ahead:repository.ahead??previous?.repository?.ahead??null,
      behind:repository.behind??previous?.repository?.behind??null,
      repositoryKey:repository.repositoryKey??previous?.repository?.repositoryKey??null,
      dirty:null,
      dirtyPaths:explicitWorking,
      workingTreeHash:null,
    },
    lifecycle,
    repositoryIntelligence:previous?.repositoryIntelligence??{status:'DEFERRED_FAST_PATH',trustState:null},
    productClosure:productClosureObservation(root,repository.head),
    working:{
      files:[...new Set(explicitWorking)].sort(),
      contextHealth:String(options.contextHealth||'HEALTHY').toUpperCase(),
      nextSafeAction:options.nextSafeAction?String(options.nextSafeAction):inferNextSafeAction(lifecycle),
      note:options.note?String(options.note):null,
    },
    evidenceRefs:[...new Set((options.evidenceRefs??[]).map(String))],
    runtime:options.runtimeStatus?{status:String(options.runtimeStatus)}:null,
    memoryPolicy:cfg.memory,
  };
  atomicWrite(stateSnapshotPath(root,cfg,{create:true}),`${JSON.stringify(snapshot,null,2)}\n`);
  const journal=stateJournalPath(root,cfg,{create:true});
  appendJournalBounded(journal,snapshot);
  return {status:'CHECKPOINTED',snapshot,identityMode:'FAST_TASK'};
}

export function rehydrateState(root) {
  const live = inspectLiveState(root), snapshot = readStateSnapshot(root);
  if (!snapshot) return { schemaVersion: STATE_SCHEMA, status: 'NO_SNAPSHOT', safeToResume: false, live, snapshot: null, drift: [], requiredAction: 'Inspect live state and create a State OS checkpoint before relying on conversational memory.' };
  const drift = [];
  const isFastSnapshot = snapshot.identityMode === 'FAST_TASK';
  compare('standardVersion', snapshot.standardVersion, live.standardVersion, drift);
  if (!isFastSnapshot || snapshot.canonical?.todo?.sha256) compare('todo.sha256', snapshot.canonical?.todo?.sha256, live.canonical.todo.sha256, drift);
  if (!isFastSnapshot || snapshot.canonical?.executionConfig?.sha256) compare('executionConfig.sha256', snapshot.canonical?.executionConfig?.sha256, live.canonical.executionConfig.sha256, drift);
  if (!isFastSnapshot || snapshot.canonical?.agentManifest?.sha256) compare('agentManifest.sha256', snapshot.canonical?.agentManifest?.sha256, live.canonical.agentManifest.sha256, drift);
  compare('repository.head', snapshot.repository?.head, live.repository.head, drift);
  compare('repository.branch', snapshot.repository?.branch, live.repository.branch, drift);
  if (!isFastSnapshot || snapshot.repository?.workingTreeHash !== null) compare('repository.workingTreeHash', snapshot.repository?.workingTreeHash, live.repository.workingTreeHash, drift);
  compare('lifecycle.task.id', snapshot.lifecycle?.task?.id, live.lifecycle.task?.id, drift);
  compare('lifecycle.action', snapshot.lifecycle?.action, live.lifecycle.action, drift);
  if (!isFastSnapshot || !['DEFERRED_TO_BOUNDARY', 'DEFERRED_FAST_PATH'].includes(snapshot.productClosure?.status)) {
    compare('productClosure.status', snapshot.productClosure?.status, live.productClosure?.status, drift);
    compare('productClosure.current', snapshot.productClosure?.current, live.productClosure?.current, drift);
    compare('productClosure.repositoryHead', snapshot.productClosure?.repositoryHead, live.productClosure?.repositoryHead, drift);
    compare('productClosure.blockingCount', snapshot.productClosure?.blockingCount, live.productClosure?.blockingCount, drift);
    compare('productClosure.taskIds', JSON.stringify(snapshot.productClosure?.taskIds??[]), JSON.stringify(live.productClosure?.taskIds??[]), drift);
  }
  const knowledgeDrift = [];
  compare('repositoryIntelligence.status', snapshot.repositoryIntelligence?.status, live.repositoryIntelligence?.status, knowledgeDrift);
  compare('repositoryIntelligence.trustState', snapshot.repositoryIntelligence?.trustState, live.repositoryIntelligence?.trustState, knowledgeDrift);
  compare('repositoryIntelligence.baselineSha', snapshot.repositoryIntelligence?.baselineSha, live.repositoryIntelligence?.baselineSha, knowledgeDrift);
  compare('repositoryIntelligence.currentHead', snapshot.repositoryIntelligence?.currentHead, live.repositoryIntelligence?.currentHead, knowledgeDrift);
  const ageMinutes = Math.max(0, (Date.now() - Date.parse(snapshot.capturedAt)) / 60000);
  if (Number.isFinite(ageMinutes) && ageMinutes > live.config.heartbeatMinutes * 2) drift.push({ field: 'checkpoint.ageMinutes', previous: ageMinutes, current: `>${live.config.heartbeatMinutes * 2}` });
  const status = drift.length ? 'DRIFTED' : 'FRESH';
  let corruptJournalLines = 0;
  try {
    const jPath = stateJournalPath(root, live.config);
    if (fs.existsSync(jPath)) {
      for (const line of fs.readFileSync(jPath, 'utf8').split('\n').filter(Boolean)) {
        try { JSON.parse(line); } catch { corruptJournalLines++; }
      }
    }
  } catch {}
  return {
    schemaVersion: STATE_SCHEMA,
    status,
    safeToResume: status === 'FRESH',
    live,
    snapshot,
    drift,
    corruptJournalLines,
    repositoryIntelligenceDrift: knowledgeDrift,
    repositoryIntelligenceAction: live.repositoryIntelligence?.enabled && ['SOURCE_ONLY','UNAVAILABLE'].includes(live.repositoryIntelligence?.trustState)
      ? 'Repository knowledge is stale, missing or untrusted; use live/bounded source evidence and refresh knowledge independently. This does not change canonical task state.'
      : null,
    requiredAction: status === 'FRESH' ? snapshot.working?.nextSafeAction ?? inferNextSafeAction(live.lifecycle) : 'Reinspect the drifted live surfaces; then write a fresh checkpoint. Live repository truth wins over the prior snapshot or external memory.',
  };
}
export function amnesiaTest(root) {
  const rehydration = rehydrateState(root), checks = [], live = rehydration.live;
  const check = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail });
  check('canonical-todo', live.canonical.todo.exists && live.canonical.todo.sha256, live.canonical.todo.path);
  check('git-head', live.repository.available && live.repository.head, live.repository.head ?? live.repository.error);
  check('agent-manifest', live.canonical.agentManifest.exists && live.canonical.agentManifest.sha256, live.canonical.agentManifest.path);
  check('lifecycle-reconstructable', live.lifecycle.status === 'NO_ACTIONABLE_WORK' || Boolean(live.lifecycle.task?.id && live.lifecycle.action && live.lifecycle.routeId), `${live.lifecycle.task?.id ?? 'NONE'} / ${live.lifecycle.action ?? 'NONE'}`);
  check('state-snapshot', Boolean(rehydration.snapshot), rehydration.snapshot?.capturedAt ?? 'missing');
  check('state-fresh', rehydration.status === 'FRESH', rehydration.status);
  check('next-safe-action', live.lifecycle.status === 'NO_ACTIONABLE_WORK' || Boolean(rehydration.snapshot?.working?.nextSafeAction), rehydration.snapshot?.working?.nextSafeAction ?? 'missing');
  check('memory-non-authoritative', live.config.memory.authority === 'advisory' && live.config.memory.requireLiveRevalidation === true && live.config.memory.allowTaskState === false, live.config.memory);
  check('repository-intelligence-discoverable', live.repositoryIntelligence?.authority === 'ADVISORY_SOURCE_GROUNDED', `${live.repositoryIntelligence?.status ?? 'UNKNOWN'} / ${live.repositoryIntelligence?.trustState ?? 'UNKNOWN'}`);
  const ok = checks.every((item) => item.ok);
  return { schemaVersion: STATE_SCHEMA, status: ok ? 'PASS' : 'FAIL', ok, principle: 'Context is disposable. Repository state is reconstructable.', checks, rehydration };
}
export function memoryEnvelope(root) {
  const rehydration = rehydrateState(root), live = rehydration.live, snapshot = rehydration.snapshot;
  return {
    schemaVersion: 'executionkit-memory-envelope/v1', authority: 'ADVISORY_ONLY', repositoryKey: live.repository.repositoryKey, generatedAt: now(), standardVersion: live.standardVersion,
    branch: live.repository.branch, head: live.repository.head, observedTaskId: live.lifecycle.task?.id ?? null, observedAction: live.lifecycle.action ?? null,
    stateStatus: rehydration.status, checkpointAt: snapshot?.capturedAt ?? null, nextSafeAction: snapshot?.working?.nextSafeAction ?? inferNextSafeAction(live.lifecycle), contextHealth: snapshot?.working?.contextHealth ?? 'UNKNOWN',
    repositoryKnowledge: {
      authority: live.repositoryIntelligence?.authority ?? 'ADVISORY_SOURCE_GROUNDED',
      status: live.repositoryIntelligence?.status ?? 'UNKNOWN',
      trustState: live.repositoryIntelligence?.trustState ?? 'UNAVAILABLE',
      baselineSha: live.repositoryIntelligence?.baselineSha ?? null,
      currentHead: live.repositoryIntelligence?.currentHead ?? null,
      provider: live.repositoryIntelligence?.provider ?? null,
    },
    constraints: ['REVALIDATE_LIVE_REPOSITORY', 'TODO_OR_NATIVE_TASK_AUTHORITY_ONLY', 'NEVER_USE_MEMORY_AS_TASK_STATUS', 'NEVER_SKIP_DEPENDENCY_OR_ACCEPTANCE_GATES'],
  };
}
