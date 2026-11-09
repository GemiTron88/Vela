import {
  ACTION_PRIORITY,
  canonicalState,
  executionActionForTask,
  extractDependencies,
  integrationAllowsTask,
  resolveNextExecution,
  unresolvedDependencies,
} from './execution-model.mjs';

const SAFE_TRUE = /^(YES|TRUE|1|SAFE|PARALLEL)$/i;
const HOTSPOT_PATTERNS = [
  /(^|\/)TODO\.md$/i,
  /^(?:\.executionkit|\.agents|todo)(?:\/|$)/i,
  /(^|\/)(package-lock(?:\.json)?|pnpm-lock(?:\.yaml)?|yarn\.lock|composer\.lock|pubspec\.lock)$/i,
  /(^|\/)migrations?\//i,
  /(^|\/)(schema|schemas|openapi|routes?|bootstrap|config|locales?|l10n|generated|ci|workflows?)(?:\/|$|\.)/i,
  /(^|\/)(design[-_ ]?tokens?|authorization|policies?|release[-_ ]?manifest)/i,
];

function listMeta(task, keys) {
  for (const key of keys) {
    const raw = task?.meta?.[key];
    if (!raw) continue;
    return String(raw).split(/[,;\n]/).map((v) => v.trim().replace(/^`+|`+$/g, '').trim()).filter(Boolean);
  }
  return [];
}

export function taskParallelSafe(task) {
  const explicit = task?.meta?.['Parallel Safe'] ?? task?.meta?.Parallel ?? task?.meta?.Concurrency;
  if (explicit) return SAFE_TRUE.test(String(explicit).trim());
  // Auto-infer: a task with inferred ownership that touches no hotspots and no unsafe tags is parallel-safe
  const ownership = taskOwnership(task);
  if (!ownership.length) return false;
  if (taskHasUnsafeTags(task)) return false;
  return ownership.every((scope) => !isHotspotSurface(scope));
}

const PATH_PATTERN = /(?:^|\s|[`'"])((?:app|lib|src|bin|contracts|schemas|config|resources|database|routes|public|tests?|components?|screens?|widgets?|models?|controllers?|services?|views?|pages?|features?)\/[\w./-]+)/gi;
const UNSAFE_TAGS = /\b(migration|schema|authorization|auth|config|routes|api[- ]?contract|design[- ]?tokens?|release|deployment|ci|workflow)\b/i;

function inferOwnership(task) {
  const body = [task.title ?? '', task.body ?? '', task.description ?? ''].join('\n');
  const paths = [];
  for (const match of body.matchAll(PATH_PATTERN)) {
    const p = match[1].replace(/[`'"]+$/g, '').replace(/[.,;:]+$/g, '').trim();
    if (p) paths.push(p); // Keep unsafe paths visible to scheduling checks.
  }
  return [...new Set(paths)];
}

export function taskOwnership(task) {
  const explicit = listMeta(task, ['Ownership', 'Claim Scope', 'Owned Surfaces', 'Code Surfaces', 'Code', 'Files']);
  if (explicit.length) return explicit;
  return inferOwnership(task);
}

export function isHotspotSurface(surface) {
  return HOTSPOT_PATTERNS.some((pattern) => pattern.test(String(surface).trim()));
}

export function taskHasUnsafeTags(task) {
  const tags = [task.title ?? '', ...(task.tags ?? []), task.meta?.Tags ?? '', task.meta?.Risk ?? ''].join(' ');
  return UNSAFE_TAGS.test(tags);
}

function normalizedScopes(task) {
  return taskOwnership(task).map((scope) => scope.toLowerCase().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/\*\*$/, '').replace(/\/$/, ''));
}

function scopesOverlap(a, b) {
  const left = normalizedScopes(a), right = normalizedScopes(b);
  if (!left.length || !right.length) return true; // fail closed when ownership is unknown
  for (const x of left) for (const y of right) {
    if (x === '.' || y === '.' || x === '' || y === '' || x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)) return true;
    if (isHotspotSurface(x) || isHotspotSurface(y)) return true;
  }
  return false;
}

function dependencyRelated(a, b) {
  const aDeps = new Set(extractDependencies(a));
  const bDeps = new Set(extractDependencies(b));
  return aDeps.has(b.id) || bDeps.has(a.id);
}

export function parallelRuntimePolicy(config, { boost = false } = {}) {
  const runtime = config?.runtime ?? {};
  const parallel = runtime.parallel ?? {};
  const boostPolicy = runtime.boost ?? {};
  const mode = runtime.mode ?? 'DEPENDENCY_SAFE_PARALLEL';
  const enabled = mode === 'DEPENDENCY_SAFE_PARALLEL' && parallel.enabled !== false;
  const normalCap = Math.max(1, Number(parallel.maxConcurrentTasks ?? 3));
  const boostCap = Math.max(normalCap, Number(boostPolicy.maxConcurrentTasks ?? parallel.boostMaxConcurrentTasks ?? 6));
  return {
    enabled,
    boost,
    maxConcurrentTasks: boost ? boostCap : normalCap,
    maxAgentsPerTask: Math.max(1, Number(boost ? (boostPolicy.maxAgentsPerTask ?? 6) : (parallel.maxAgentsPerTask ?? 4))),
    requireExplicitParallelSafe: parallel.requireExplicitParallelSafe !== false,
    requireOwnership: parallel.requireOwnership !== false,
    sequentialFallback: parallel.sequentialFallback !== false,
    integrationOwner: parallel.integrationOwner ?? 'orchestrator',
    qualityGatesPreserved: true,
  };
}

export function resolveExecutionBatch(tasks, config, { mode = 'closure', boost = false, includeConvergence = true } = {}) {
  const taskIndex=new Map(tasks.map((task)=>[task.id,task]));
  const primary = resolveNextExecution(tasks, config, { mode, taskIndex, includeConvergence });
  const policy = parallelRuntimePolicy(config, { boost });
  if (!primary) return { primary: null, batch: [], policy, reason: 'NO_EXECUTABLE_ACTION' };

  const batch = [primary];
  // Audit/review/acceptance/correction closure remains serialized unless a future explicit contract proves otherwise.
  if (!policy.enabled || !['implement', 'resume'].includes(primary.action)) {
    return { primary, batch, policy, reason: policy.enabled ? 'CLOSURE_ACTION_SERIALIZED' : 'SEQUENTIAL_RUNTIME' };
  }
  if (policy.requireExplicitParallelSafe && !taskParallelSafe(primary.task)) {
    return { primary, batch, policy, reason: 'PRIMARY_NOT_EXPLICITLY_PARALLEL_SAFE' };
  }
  if (policy.requireOwnership && !taskOwnership(primary.task).length) {
    return { primary, batch, policy, reason: 'PRIMARY_OWNERSHIP_UNDECLARED' };
  }

  const candidates = [];
  for (const task of tasks.filter((item) => !item.isArchive && item.id !== primary.task.id)) {
    if (!integrationAllowsTask(task, tasks, config, taskIndex)) continue;
    const action = executionActionForTask(task, config);
    if (!['implement', 'resume'].includes(action)) continue;
    if (unresolvedDependencies(task, tasks, config, taskIndex).length) continue;
    if (policy.requireExplicitParallelSafe && !taskParallelSafe(task)) continue;
    if (policy.requireOwnership && !taskOwnership(task).length) continue;
    if (dependencyRelated(primary.task, task)) continue;
    if (batch.some((entry) => scopesOverlap(entry.task, task) || dependencyRelated(entry.task, task))) continue;
    candidates.push({ task, action, semanticState: canonicalState(task, config), unresolvedDependencies: [], priority: ACTION_PRIORITY[action] ?? 999 });
  }
  candidates.sort((a, b) => a.priority - b.priority || (a.task.order ?? 0) - (b.task.order ?? 0) || a.task.id.localeCompare(b.task.id));
  for (const candidate of candidates) {
    if (batch.length >= policy.maxConcurrentTasks) break;
    if (batch.some((entry) => scopesOverlap(entry.task, candidate.task) || dependencyRelated(entry.task, candidate.task))) continue;
    batch.push(candidate);
  }

  return {
    primary,
    batch,
    policy,
    reason: batch.length > 1 ? 'DEPENDENCY_SAFE_PARALLEL_BATCH' : 'NO_ADDITIONAL_SAFE_CLAIMS',
    claimRequirements: {
      atomicCanonicalClaim: true,
      oneExecutorPerTask: true,
      isolatedBranchOrWorktree: true,
      orchestratorOwnsTodoMutation: true,
      postIntegrationVerification: true,
      reviewerSeparation: true,
    },
  };
}
