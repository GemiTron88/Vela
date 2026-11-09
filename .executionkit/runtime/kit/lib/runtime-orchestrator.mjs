import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { canonicalState, declaredAuditBoundary, extractTags, loadConfig, loadTasks, closureSummary } from './execution-model.mjs';
import { resolveExecutionBatch } from './parallel-execution.mjs';
import { resolveAgentContextFast } from './agent-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { readStateSnapshot, rehydrateState, writeStateCheckpoint } from './state-model.mjs';
import { resolveReleaseLifecycle } from './release-lifecycle.mjs';
import { repositoryKnowledgeContext, repositoryKnowledgeStatus } from './repository-intelligence-api.mjs';
import { todoMaintenanceStatus } from './todo-maintenance.mjs';

const RUNTIME_SCHEMA = '1.1.0';
export function runtimeDirectory(root, { create = false } = {}) { return resolveDerivedPath(root, '.executionkit/runtime', 'runtime directory', { createParents:create }); }
export function checkpointPath(root, { create = false } = {}) { return resolveDerivedPath(root, '.executionkit/runtime/checkpoint.json', 'runtime checkpoint', { createParents:create }); }
export function historyPath(root, { create = false } = {}) { return resolveDerivedPath(root, '.executionkit/runtime/history.ndjson', 'runtime history', { createParents:create }); }
function taskContext(task, action, config) { return { taskId: task.id, action, state: canonicalState(task, config), phase: task.meta?.Phase ?? null, tags: extractTags(task), risk: task.meta?.Risk ?? null }; }
function repositoryExecutionContext(root, config) {
  if (config.repositoryIntelligence?.enabled !== true) return { enabled:false, status:'DISABLED', context:null };
  try {
    const status=repositoryKnowledgeStatus(root);
    let compact=null;
    try { compact=repositoryKnowledgeContext(root,{maxBytes:config.repositoryIntelligence?.context?.maxBytes}); }
    catch(error){ compact={status:'SOURCE_FALLBACK',error:error.message}; }
    return {enabled:true,status,context:compact,authority:'ADVISORY_LIVE_SOURCE_WINS'};
  } catch(error) {
    return {enabled:true,status:'DEGRADED',context:null,error:error.message,authority:'ADVISORY_LIVE_SOURCE_WINS'};
  }
}

export function resolveRuntimePlan(root, { boost = false, includeRepositoryContext = true, archiveMode = 'full', includeConvergence = true, compact = false, config: preloadedConfig = null } = {}) {
  const { config, policyIssues = [] } = preloadedConfig ? { config: preloadedConfig, policyIssues: [] } : loadConfig(root);
  if (policyIssues.length) throw new Error(`Runtime policy invalid: ${policyIssues.map((item)=>`[${item.code}] ${item.message}`).join('; ')}`);
  const loaded = loadTasks(root, config, {archiveMode});
  if (loaded.errors.length) throw new Error(loaded.errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
  const resolved = resolveExecutionBatch(loaded.tasks, config, { mode: 'closure', boost, includeConvergence });
  const next = resolved.primary;
  const runtimeMode = resolved.policy?.enabled ? 'DEPENDENCY_SAFE_PARALLEL' : 'SEQUENTIAL';
  if (!next) {
    const implementationClosure=closureSummary(loaded.tasks, config);
    const release=resolveReleaseLifecycle(root,{implementationClosed:implementationClosure.closed});
    const closure={...implementationClosure,implementationClosed:implementationClosure.closed,closed:implementationClosure.closed&&release.complete===true};
    return { schemaVersion: RUNTIME_SCHEMA, mode: runtimeMode, status: 'NO_ACTIONABLE_WORK', boost, closure, release, generatedAt: new Date().toISOString() };
  }
  const agent = resolveAgentContextFast(root, config, taskContext(next.task, next.action, config));
  const repositoryIntelligence = includeRepositoryContext
    ? repositoryExecutionContext(root, config)
    : {enabled:config.repositoryIntelligence?.enabled===true,status:'DEFERRED_FAST_PATH',context:null,authority:'ADVISORY_LIVE_SOURCE_WINS'};
  const batch = resolved.batch.map((entry) => ({
    taskId: entry.task.id,
    title: entry.task.title ?? null,
    action: entry.action,
    semanticState: entry.semanticState,
    ownership: entry.task.meta?.Ownership ?? entry.task.meta?.['Claim Scope'] ?? entry.task.meta?.['Code Surfaces'] ?? entry.task.meta?.Files ?? null,
    sourcePath: entry.task.sourcePath ?? null,
    startLine: entry.task.startLine ?? null,
    phase: entry.task.meta?.Phase ?? null,
  }));
  return {
    schemaVersion: RUNTIME_SCHEMA,
    mode: runtimeMode,
    boost,
    status: 'READY',
    generatedAt: new Date().toISOString(),
    // One lifecycle task shape for every consumer (Decision OS plan alignment,
    // audit-boundary guards, database/route routing): meta and objective must
    // survive fast-mode plans. Presentation compaction is owned by
    // compactExecutionEnvelope/compactTaskPayload at the output boundary only.
    task: { id: next.task.id, state: next.task.meta?.Status ?? null, semanticState: canonicalState(next.task, config), title: next.task.title ?? null, phase: next.task.meta?.Phase ?? null, sourcePath: next.task.sourcePath ?? null, startLine: next.task.startLine ?? null, tags: extractTags(next.task), ownership: next.task.meta?.Ownership ?? next.task.meta?.['Claim Scope'] ?? next.task.meta?.['Code Surfaces'] ?? next.task.meta?.Files ?? null, meta: next.task.meta, objective: next.task.objective ?? null, body: next.task.body ?? null },
    action: next.action,
    batch,
    batchReason: resolved.reason,
    parallelPolicy: resolved.policy,
    claimRequirements: resolved.claimRequirements ?? null,
    routeId: agent.routeId,
    supplementIds: agent.supplementIds,
    resources: Object.fromEntries(Object.entries(agent.resources).map(([kind, values]) => [kind, values.map((r) => ({ id: r.id, path: r.path }))])),
    delegation: agent.delegation,
    repositoryIntelligence,
    authority: config.todoPath,
    closure: compact ? null : closureSummary(loaded.tasks, config, {includeConvergence}),
  };
}
function appendHistory(root, event) { const dir = runtimeDirectory(root, { create:true }); fs.mkdirSync(dir, { recursive: true }); const file=historyPath(root,{create:true}); fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`); }
function stateReason(checkpoint) { return `runtime:${String(checkpoint.status ?? 'unknown').toLowerCase()}`; }
function stateNextAction(checkpoint) {
  const plan = checkpoint.next ?? checkpoint.plan;
  if (!plan || plan.status === 'NO_ACTIONABLE_WORK') return 'Re-run canonical readiness/closure inspection before claiming completion.';
  const count = plan.batch?.length ?? 1;
  return count > 1
    ? `Rehydrate live truth, then continue the dependency-safe batch beginning with ${plan.task?.id ?? 'the selected canonical task'}; orchestrator owns claims/integration.`
    : `Rehydrate live truth, then continue only ${plan.task?.id ?? 'the selected canonical task'} / ${plan.action ?? 'the selected lifecycle action'}.`;
}
export function writeCheckpoint(root, checkpoint) {
  const dir = runtimeDirectory(root, { create:true }); fs.mkdirSync(dir, { recursive: true });
  const file=checkpointPath(root,{create:true}), tmpRel=`.executionkit/runtime/checkpoint.${process.pid}.${crypto.randomUUID()}.tmp`, tmp=resolveDerivedPath(root,tmpRel,'runtime checkpoint temporary file',{createParents:true});
  try { fs.writeFileSync(tmp, `${JSON.stringify(checkpoint, null, 2)}\n`); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.rmSync(tmp, { force:true }); }
  appendHistory(root, { type: 'checkpoint', taskId: checkpoint.plan?.task?.id ?? checkpoint.next?.task?.id ?? null, action: checkpoint.plan?.action ?? checkpoint.next?.action ?? null, status: checkpoint.status });
  const cfg = loadConfig(root).config.state ?? {};
  if (cfg.enabled !== false && cfg.checkpointOnRuntimeTransitions !== false) {
    writeStateCheckpoint(root, { reason: stateReason(checkpoint), runtimeStatus: checkpoint.status, nextSafeAction: stateNextAction(checkpoint), contextHealth: checkpoint.status === 'RUNNING' ? 'LONG_RUNNING' : 'FRESH' });
  }
}
export function readCheckpoint(root) { const file = checkpointPath(root); if (!fs.existsSync(file)) return null; resolveDerivedPath(root,'.executionkit/runtime/checkpoint.json','runtime checkpoint',{mustExist:true,file:true}); const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (!['1.0.0', RUNTIME_SCHEMA].includes(value.schemaVersion)) throw new Error(`Unsupported runtime checkpoint schema ${value.schemaVersion ?? 'MISSING'}`); return value; }
export function cancelRuntime(root, reason = 'cancelled by operator') { const existing = readCheckpoint(root); const checkpoint = { schemaVersion: RUNTIME_SCHEMA, status: 'CANCELLED', reason, cancelledAt: new Date().toISOString(), plan: existing?.plan ?? null }; writeCheckpoint(root, checkpoint); return checkpoint; }
export function recoverRuntime(root, { resumeCancelled = false } = {}) {
  const checkpoint = readCheckpoint(root), current = resolveRuntimePlan(root), state = rehydrateState(root);
  if (!checkpoint) return {status:'NO_CHECKPOINT',current,state};
  if (checkpoint.status === 'CANCELLED') {
    if (!resumeCancelled) return {status:'CANCELLED',checkpoint,current,state};
    const lock=resolveDerivedPath(root,'.executionkit/runtime/step.lock','runtime step lock');
    if (fs.existsSync(lock)) throw new Error('Cannot resume cancellation while a runtime step owns its lock');
    validateRuntimeAuthority(root);
    writeCheckpoint(root,{schemaVersion:RUNTIME_SCHEMA,status:'WAITING_FOR_HOST',plan:current,resumedAt:new Date().toISOString()});
    return {status:'RESUMABLE',checkpoint:readCheckpoint(root),current,state:rehydrateState(root)};
  }
  const same=checkpoint.plan?.task?.id===current.task?.id && checkpoint.plan?.action===current.action;
  return {status:same?'RESUMABLE':'STALE_CHECKPOINT',checkpoint,current,state};
}
function validateRuntimeAuthority(root) {
  for (const name of ['validate-execution.mjs','validate-v22-policy.mjs','validate-state.mjs']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../bin/${name}`, import.meta.url)), root], { cwd:root, encoding:'utf8', timeout:60000, maxBuffer:32*1024*1024 });
    if (result.error || result.status !== 0) throw new Error(`Runtime authority validation failed (${name}): ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
  }
}

// This direct executor intentionally performs one primary lifecycle mutation at a time.
// Multi-task concurrency is a host/Agent-OS orchestration concern (`resolveRuntimePlan({boost:true})` / `/boost`),
// so one delegate cannot race another delegate on the canonical TODO or integration worktree.
export function executeRuntimeStep(root, { delegateCommand = null, timeoutMs = 30 * 60_000, dryRun = false } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Runtime timeoutMs must be a positive integer');
  const cancelled = readCheckpoint(root); if (cancelled?.status === 'CANCELLED') return cancelled;
  const loadedConfig = loadConfig(root).config, stateCfg = loadedConfig.state ?? {}, state = rehydrateState(root);
  const v4StateRequired = /^[45]\./.test(String(loadedConfig.standardVersion ?? '')) && (loadedConfig.v4 !== undefined || loadedConfig.todoAuthority?.mode === 'sharded' || loadedConfig.adoption?.integrationGateTaskId?.includes('EK4') || loadedConfig.adoption?.integrationPhase === 'EK4');
  if(v4StateRequired && !dryRun && delegateCommand){
    return {
      schemaVersion:RUNTIME_SCHEMA,
      status:'V4_AGENT_OS_REQUIRED',
      message:'ExecutionKit v4 does not execute project work through the legacy direct delegate. Use the CLI/Agent OS task path.'
    };
  }
  if(v4StateRequired){
    const maintenance=todoMaintenanceStatus(root,loadedConfig);
    if(maintenance.needed)return {schemaVersion:RUNTIME_SCHEMA,status:'TODO_MAINTENANCE_REQUIRED',maintenance,message:'ExecutionKit v4 direct runtime execution is blocked until canonical TODO shard maintenance is complete.'};
  }
  if ((v4StateRequired && state.safeToResume !== true) || (!v4StateRequired && state.snapshot && state.status === 'DRIFTED' && stateCfg.requireRehydrateOnDrift !== false)) {
    return { schemaVersion:RUNTIME_SCHEMA, status:'STATE_REHYDRATION_REQUIRED', state, message:v4StateRequired?'ExecutionKit v4 requires a fresh State OS checkpoint before direct runtime delegation. Inspect live repository/TODO/working tree and checkpoint the current truth first.':'State OS detected drift. Inspect live repository/TODO/working tree and write a fresh checkpoint before delegation.' };
  }
  const lock = resolveDerivedPath(root, '.executionkit/runtime/step.lock', 'runtime step lock', {createParents:true}), token = crypto.randomUUID();
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') {
      let stale = false;
      try {
        const stat = fs.lstatSync(lock);
        const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
        if (owner?.host === os.hostname() && Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
          try { process.kill(owner.pid, 0); } catch (killErr) { if (killErr.code === 'ESRCH') stale = true; }
        } else if (Date.now() - stat.mtimeMs > 60_000) stale = true;
      } catch {
        try { if (Date.now() - fs.lstatSync(lock).mtimeMs > 60_000) stale = true; } catch {}
      }
      if (stale) {
        try { fs.rmSync(lock, { force: true }); fd = fs.openSync(lock, 'wx'); }
        catch { return { schemaVersion:RUNTIME_SCHEMA, status:'RUNTIME_BUSY', message:'Another direct integration step owns the runtime lock; parallel workers must use isolated Agent OS claims/worktrees instead of sharing this lock' }; }
      } else {
        return { schemaVersion:RUNTIME_SCHEMA, status:'RUNTIME_BUSY', message:'Another direct integration step owns the runtime lock; parallel workers must use isolated Agent OS claims/worktrees instead of sharing this lock' };
      }
    } else throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({pid:process.pid,host:os.hostname(),token,startedAt:new Date().toISOString()})); fs.closeSync(fd); fd = null;
    const paused = readCheckpoint(root); if (paused?.status === 'CANCELLED') return paused;
    if (!dryRun && delegateCommand) validateRuntimeAuthority(root);
    const before = resolveRuntimePlan(root); if (before.status !== 'READY') return before;
    if (v4StateRequired) {
      if (!before.routeId) return { schemaVersion:RUNTIME_SCHEMA, status:'AGENT_ROUTE_REQUIRED', plan:before, message:'ExecutionKit v4 direct runtime execution requires a deterministic Agent OS route.' };
      if ((before.batch?.length ?? 0) > 1) return { schemaVersion:RUNTIME_SCHEMA, status:'AGENT_DELEGATION_REQUIRED', plan:before, message:'ExecutionKit v4 dependency-safe parallel work must be delegated through Agent OS instead of serialized by the direct runtime executor.' };
      if (before.action === 'deploy') return { schemaVersion:RUNTIME_SCHEMA, status:'LAUNCH_OS_REQUIRED', plan:before, message:'ExecutionKit v4 deploy actions are owned by Launch OS and may not run through the generic direct runtime executor.' };
      if (before.action === 'audit') {
        const currentConfig=loadConfig(root).config,currentTasks=loadTasks(root,currentConfig).tasks;
        const selected=currentTasks.find((task)=>task.id===before.task?.id);
        const auditBoundary=selected?declaredAuditBoundary(selected):null;
        if (['wave','phase'].includes(auditBoundary)) return { schemaVersion:RUNTIME_SCHEMA, status:'BOUNDARY_ORCHESTRATOR_REQUIRED', plan:before, boundary:auditBoundary, message:'ExecutionKit v4 wave/phase audit actions are owned by the atomic Boundary Orchestrator.' };
      }
    }
    const checkpoint = { schemaVersion:RUNTIME_SCHEMA, status:dryRun || !delegateCommand ? 'WAITING_FOR_HOST' : 'RUNNING', startedAt:new Date().toISOString(), plan:before }; writeCheckpoint(root, checkpoint);
    if (dryRun || !delegateCommand) return checkpoint;
    const beforeConfig = loadConfig(root).config, beforeTasks = loadTasks(root,beforeConfig).tasks;
    const env = { ...process.env, EXECUTIONKIT_ROOT:root, EXECUTIONKIT_TASK_ID:before.task.id, EXECUTIONKIT_ACTION:before.action, EXECUTIONKIT_ROUTE:before.routeId ?? '', EXECUTIONKIT_CONTEXT_JSON:JSON.stringify(before), EXECUTIONKIT_STATE_JSON:JSON.stringify(readStateSnapshot(root)) };
    const result = spawnSync(delegateCommand, {cwd:root,env,shell:true,encoding:'utf8',timeout:timeoutMs,maxBuffer:32*1024*1024});
    const stop = readCheckpoint(root); if (stop?.status === 'CANCELLED') return stop;
    let after = null, status = 'DELEGATE_FAILED', validationError = null;
    try {
      validateRuntimeAuthority(root);
      const config = loadConfig(root).config, tasks = loadTasks(root,config).tasks, selected = tasks.find((task)=>task.id===before.task.id);
      if (beforeTasks.some((task)=>!tasks.some((other)=>other.id===task.id))) throw new Error('Delegate removed a canonical task; deletion cannot prove lifecycle progress');
      after = resolveRuntimePlan(root);
      const changed = selected && canonicalState(selected,config) !== before.task.semanticState;
      if (!result.error && result.status === 0) status = changed ? 'STEP_COMPLETED' : 'NO_STATE_TRANSITION';
    } catch (error) { status = 'INVALID_STATE'; validationError = error.message; }
    const final = {schemaVersion:RUNTIME_SCHEMA,status,startedAt:checkpoint.startedAt,completedAt:new Date().toISOString(),plan:before,result:{exitCode:result.status,signal:result.signal,stdout:result.stdout??'',stderr:result.stderr??'',error:result.error?.message??validationError},next:after};
    const finalStop = readCheckpoint(root); if (finalStop?.status === 'CANCELLED') return finalStop;
    writeCheckpoint(root,final); return final;
  } finally {
    if (fd !== null && fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(lock) && JSON.parse(fs.readFileSync(lock,'utf8')).token === token) fs.rmSync(lock);
  }
}
