import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assembleTodoMarkdown as assembleTodoShardMarkdown, todoShardSources } from './todo-shards.mjs';

export const CAPABILITY_LEVELS = ['NONE', 'LITE', 'STANDARD', 'FULL'];
export const PROFILE_CAPABILITIES = {
  LITE: { execution: 'LITE', agent: 'LITE', content: 'NONE', seo: 'LITE', audit: 'LITE', test: 'LITE', launch: 'LITE' },
  STANDARD: { execution: 'STANDARD', agent: 'STANDARD', content: 'NONE', seo: 'STANDARD', audit: 'STANDARD', test: 'STANDARD', launch: 'STANDARD' },
  FULL: { execution: 'FULL', agent: 'FULL', content: 'FULL', seo: 'FULL', audit: 'FULL', test: 'FULL', launch: 'FULL' },
};
export const DEFAULT_CAPABILITIES = PROFILE_CAPABILITIES.STANDARD;
export const DECLARED_EXECUTION_ACTIONS = ['audit','document','deploy'];
export const AUDIT_BOUNDARIES = ['ad-hoc', 'wave', 'phase', 'release'];

export const DEFAULT_CONFIG = {
  standardVersion: '3.0.0',
  projectState: 'ACTIVE',
  profile: 'STANDARD',
  capabilities: DEFAULT_CAPABILITIES,
  customRationale: '',
  ci: {
    provider: 'github-actions', executionMode: 'self-hosted-manual', githubHostedAllowed: false,
    automaticPushRuns: false, allowedAutomaticWorkflowPaths: [], projectRunnerLabel: 'project-executionkit',
    maxProjectRunnersPerDevice: 1, allowedRunnerOS: ['macOS', 'windows'],
  },
  agent: { manifestPath: '.agents/manifest.json' },
  runtime: {
    mode: 'DEPENDENCY_SAFE_PARALLEL', oneLifecycleActionAtATime: false, allowBoundedHostDelegation: true,
    checkpointPath: '.executionkit/runtime/checkpoint.json',
    parallel: {
      enabled: true, maxConcurrentTasks: 3, maxAgentsPerTask: 4,
      requireExplicitParallelSafe: true, requireOwnership: true, isolatedWorktrees: true,
      integrationOwner: 'orchestrator', sequentialFallback: true,
    },
    boost: {
      enabled: true, command: '/boost', maxConcurrentTasks: 6, maxAgentsPerTask: 6,
      qualityGatesPreserved: true,
    },
  },
  discovery: {
    enabled: true, scopePath: 'executionkit.scope.json', inventoryPath: '.executionkit/discovery/product-inventory.json',
    reconciliationPath: '.executionkit/discovery/reconciliation.json', requiredForRelease: false, failOnDeclaredMissing: true,
  },
  evidence: {
    releaseTruthMode: 'STRICT',
    candidateRequiredForRelease: false, adapterConfigPath: 'executionkit.adapters.json', maxAgeMinutes: 1440,
    requiredProducers: [], requireTestAdequacy: false, testReportPath: '', testFormat: '', minimumTests: 0,
    allowSkipped: false, allowFlaky: false,
    requireDurableTaskEvidence: false, taskProofRoot: 'docs/execution/evidence/tasks',
  },
  seo: { contractPath: 'executionkit.seo.json', requiredForRelease: false },
  integration: {
    requirePhaseConvergenceForClosure: true,
    minTasksForPhaseGate: 2,
    journeyContractPath: 'executionkit.integration.json',
    requireCriticalJourneysForRelease: false,
    requireJourneyDenominator: false,
    requireSystemReleaseGate: false,
    systemReleaseGateTaskId: 'REL-AUDIT',
    allowNotApplicableForRelease: false,
  },
  documentation: { enabled: true, outputRoot: 'docs/knowledge-base/generated', registryPath: '.executionkit/knowledge/documentation-registry.json', requiredForRelease: false, minimumCoveragePercent: 100 },
  deployment: { enabled: true, requiredForRelease: false, artifactRoot: '.executionkit/deployment', sourceRoot: '.', allowSourceMaps: false, verifyComposerDependencies: true, attestationUrl: '', requireBackupBeforeActivate: false, backupReceiptPath: '', backupDatabase: '', artifactBudget: { maxFiles:50000, maxTotalBytes:1073741824, maxFileBytes:134217728 }, requireCleanGit: true, extraInclude: [], extraExclude: [], buildCommands: [], preActivateCommands: [], postActivateCommands: [], smokeCommands: [], sharedLinks: [], healthUrl: '', healthTimeoutMs: 10000, retention: { enabled: true, keepRollbacks: 0, minimumAgeMinutes: 0, cleanupLegacyReleases: true, workerUsers: [] }, target: { type:'UNCONFIGURED', releaseRoot:'', currentLink:'' } },
  taskModel: { adapter: 'canonical-blocks', projectionPath: '', projectionCommand: '' },
  todoPath: 'TODO.md',
  todoAuthority: {
    mode: 'single-file',
    shardRoot: 'todo',
    archiveRoot: 'todo/archive',
    requirePhaseMatch: true,
    maxTasksPerShard: 60,
    maxShardBytes: 262144,
    maxRootBytes: 65536,
    archiveMaxTasksPerFile: 100,
    archiveMaxBytesPerFile: 524288,
    maintenanceRequired: true,
  },
  taskArchivePaths: ['TODO_ARCHIVE.md'],
  validStates: ['PLANNED','READY','BLOCKED','IN_PROGRESS','IMPLEMENTED','REVIEW_REQUIRED','CORRECTION_REQUIRED','ACCEPTED','VERIFIED','RELEASED','CANCELLED'],
  stateAliases: { VERIFIED: 'ACCEPTED' },
  acceptedStates: ['ACCEPTED','RELEASED'],
  verifiedStates: ['ACCEPTED','VERIFIED','RELEASED'],
  terminalStates: ['ACCEPTED','VERIFIED','RELEASED','CANCELLED'],
  archiveTerminalStates: ['ACCEPTED','VERIFIED','RELEASED','CANCELLED'],
  dependencySatisfiedStates: ['ACCEPTED','VERIFIED','RELEASED'],
  cancellationSatisfiesDependencies: false,
  referenceKeys: ['Contract'],
  scanCompetingBacklogs: true,
  backlogScanRoots: ['docs','.agents'],
  ignoreBacklogPaths: ['docs/reference','docs/archive'],
  competingBacklogAsError: true,
  forbidManualProgressPercentages: true,
  requireEvidenceForVerified: true,
  requireContractForReady: false,
  requireVerificationField: true,
  requireBlockerForBlocked: true,
  requireCancellationReason: true,
  requireExecutorForInProgress: false,
  validateMarkdownAnchors: true,
  rejectPlaceholdersWhenActive: true,
};

export function normalizePath(value) { return String(value).split(path.sep).join('/'); }
function insideProject(root, full) { const rel = path.relative(root, full); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }
function resolveProjectFile(root, rel) { const full = path.resolve(root, rel); return insideProject(root, full) ? full : null; }

export function v3ExplicitPolicyIssues(raw = {}) {
  if (!/^3\./.test(String(raw.standardVersion ?? '')) || raw.projectState !== 'ACTIVE') return [];
  const issues = [];
  const needObject = (key) => {
    const value = raw[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ code:'V3_EXPLICIT_POLICY_MISSING', message:`ACTIVE 3.x config must explicitly declare ${key}; permissive defaults cannot establish release/runtime truth` });
      return null;
    }
    return value;
  };
  const operator = needObject('operator');
  const runtime = needObject('runtime');
  const fleet = needObject('fleet');
  needObject('adoption');
  const discovery = needObject('discovery');
  const evidence = needObject('evidence');
  needObject('seo');
  const integration = needObject('integration');

  if (operator && (operator.entrypoint !== 'todo-first' || operator.hostPersistenceAuthority !== 'none')) {
    issues.push({ code:'V3_OPERATOR_POLICY_INVALID', message:'ACTIVE 3.x operator policy must keep TODO-first authority and no host persistence authority' });
  }
  if (runtime) {
    const parallel=runtime.parallel ?? {}, boost=runtime.boost ?? {};
    if (runtime.mode !== 'DEPENDENCY_SAFE_PARALLEL' || runtime.oneLifecycleActionAtATime !== false ||
        parallel.enabled !== true || parallel.requireExplicitParallelSafe !== true || parallel.requireOwnership !== true ||
        parallel.isolatedWorktrees !== true || parallel.integrationOwner !== 'orchestrator' || parallel.sequentialFallback !== true ||
        boost.enabled !== true || boost.command !== '/boost' || boost.qualityGatesPreserved !== true) {
      issues.push({ code:'V3_RUNTIME_POLICY_INVALID', message:'ACTIVE 3.x runtime must explicitly use dependency-safe parallel execution with ownership/isolation/orchestrator integration, /boost and sequential fallback' });
    }
  }
  if (fleet && (fleet.enabled !== true || fleet.agentMode !== 'per-device' || fleet.remoteControl !== 'disabled' || fleet.telemetry?.authority !== 'observational')) {
    issues.push({ code:'V3_FLEET_POLICY_INVALID', message:'ACTIVE 3.x fleet policy must remain enabled, per-device, observational and remote-control disabled' });
  }
  if (discovery && (discovery.enabled !== true || discovery.failOnDeclaredMissing !== true || !String(discovery.scopePath ?? '').trim())) {
    issues.push({ code:'V3_DISCOVERY_POLICY_INVALID', message:'ACTIVE 3.x discovery must be explicitly enabled, fail closed and bind a scope denominator' });
  }
  if (evidence) {
    if (evidence.releaseTruthMode !== 'STRICT' || evidence.candidateRequiredForRelease !== true || evidence.requireTestAdequacy !== true) {
      issues.push({ code:'V3_EVIDENCE_POLICY_INVALID', message:'ACTIVE 3.x evidence must explicitly require STRICT truth, exact candidate identity and test adequacy' });
    }
    const launchEnabled = raw.capabilities?.launch && raw.capabilities.launch !== 'NONE';
    if (launchEnabled && (!Array.isArray(evidence.requiredProducers) || evidence.requiredProducers.length === 0 || !String(evidence.testReportPath ?? '').trim())) {
      issues.push({ code:'V3_RELEASE_EVIDENCE_INCOMPLETE', message:'ACTIVE launch-capable 3.x projects require configured trusted producers and a concrete testReportPath' });
    }
  }
  if (integration && (
    integration.requirePhaseConvergenceForClosure !== true ||
    integration.requireCriticalJourneysForRelease !== true ||
    integration.requireJourneyDenominator !== true ||
    integration.requireSystemReleaseGate !== true ||
    !String(integration.systemReleaseGateTaskId ?? '').trim() ||
    !String(integration.journeyContractPath ?? '').trim()
  )) {
    issues.push({ code:'V3_REALITY_POLICY_INVALID', message:'ACTIVE 3.x integration must explicitly require phase, journey-denominator and whole-system release convergence' });
  }
  const launchEnabled = raw.capabilities?.launch && raw.capabilities.launch !== 'NONE';
  const productDeploymentRequired = launchEnabled && raw.distributionRepository !== true;
  if (productDeploymentRequired) {
    const deployment = raw.deployment;
    if (!deployment || deployment.enabled !== true || deployment.requiredForRelease !== true) {
      issues.push({ code:'V3_RELEASE_DEPLOYMENT_POLICY_INVALID', message:'ACTIVE launch-capable 3.x projects must enable Production Deployment Fabric and require it for release' });
    }
    // Project activation proves that the eight-system control plane is live. It does not
    // prove a production target is configured. Target/smoke/health remain fail-closed
    // release-readiness requirements in Production Deployment Fabric / Launch OS.
  }
  return issues;
}

export function loadConfig(projectRoot) {
  const candidates = [path.join(projectRoot, 'execution.config.json'), path.join(projectRoot, '.executionkit.json')];
  let loaded = {}, source = null;
  for (const candidate of candidates) if (fs.existsSync(candidate)) { loaded = JSON.parse(fs.readFileSync(candidate, 'utf8')); source = candidate; break; }
  const profile = loaded.profile ?? DEFAULT_CONFIG.profile;
  const profileCapabilities = PROFILE_CAPABILITIES[profile] ?? DEFAULT_CAPABILITIES;
  return {
    config: {
      ...DEFAULT_CONFIG, ...loaded,
      capabilities: { ...profileCapabilities, ...(loaded.capabilities ?? {}) },
      ci: { ...DEFAULT_CONFIG.ci, ...(loaded.ci ?? {}) },
      agent: { ...DEFAULT_CONFIG.agent, ...(loaded.agent ?? {}) },
      runtime: {
        ...DEFAULT_CONFIG.runtime,
        ...(loaded.runtime ?? {}),
        parallel: { ...DEFAULT_CONFIG.runtime.parallel, ...(loaded.runtime?.parallel ?? {}) },
        boost: { ...DEFAULT_CONFIG.runtime.boost, ...(loaded.runtime?.boost ?? {}) },
      },
      discovery: { ...DEFAULT_CONFIG.discovery, ...(loaded.discovery ?? {}) },
      evidence: { ...DEFAULT_CONFIG.evidence, ...(loaded.evidence ?? {}) },
      seo: { ...DEFAULT_CONFIG.seo, ...(loaded.seo ?? {}) },
      integration: { ...DEFAULT_CONFIG.integration, ...(loaded.integration ?? {}) },
      documentation: { ...DEFAULT_CONFIG.documentation, ...(loaded.documentation ?? {}) },
      deployment: { ...DEFAULT_CONFIG.deployment, ...(loaded.deployment ?? {}), artifactBudget: { ...DEFAULT_CONFIG.deployment.artifactBudget, ...(loaded.deployment?.artifactBudget ?? {}) }, retention: { ...DEFAULT_CONFIG.deployment.retention, ...(loaded.deployment?.retention ?? {}) }, target: { ...DEFAULT_CONFIG.deployment.target, ...(loaded.deployment?.target ?? {}) } },
      taskModel: { ...DEFAULT_CONFIG.taskModel, ...(loaded.taskModel ?? {}) },
      todoAuthority: { ...DEFAULT_CONFIG.todoAuthority, ...(loaded.todoAuthority ?? {}) },
      stateAliases: { ...DEFAULT_CONFIG.stateAliases, ...(loaded.stateAliases ?? {}) },
    },
    source,
    policyIssues: v3ExplicitPolicyIssues(loaded),
  };
}

export function parseTaskBlocks(markdown, sourcePath = 'TODO.md') {
  const tasks = [], errors = [];
  const re = /<!--\s*TASK:([A-Za-z0-9._-]+)\s*-->([\s\S]*?)<!--\s*\/TASK\s*-->/g;
  let match, order = 0, line = 1, cursor = 0;
  while ((match = re.exec(markdown)) !== null) {
    for(let i=cursor;i<match.index;i++)if(markdown.charCodeAt(i)===10)line++;
    cursor=match.index;
    const markerId = match[1].trim(), body = match[2], startLine = line, meta = {};
    if (/<!--\s*TASK:[A-Za-z0-9._-]+\s*-->/.test(body)) {
      errors.push({ code: 'UNBALANCED_TASK_MARKERS', message: `${sourcePath}:${startLine} task ${markerId} contains an unclosed or nested task marker` });
    }
    let inFence = false;
    for (const rawLine of body.split('\n')) {
      if (/^\s*(?:```|~~~)/.test(rawLine)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = rawLine.match(/^\s*-\s+([A-Za-z][A-Za-z0-9 _/-]*):\s*(.*?)\s*$/);
      if (m) meta[m[1].trim()] = m[2].trim();
    }
    if (inFence) errors.push({ code: 'TASK_SOURCE_UNCLOSED_FENCE', message: `${sourcePath}:${startLine} task ${markerId} has an unclosed markdown code fence` });
    const heading = body.match(/^\s*#{2,6}\s+([A-Za-z0-9._-]+)\s+[—-]\s+(.+)$/m);
    const headingId = heading?.[1]?.trim() ?? null;
    if (headingId && headingId !== markerId) errors.push({ code: 'TASK_ID_MISMATCH', message: `${sourcePath}:${startLine} marker ${markerId} does not match heading ${headingId}` });
    const rawTitle = heading?.[2]?.trim() ?? null;
    const cleanTitle = rawTitle ? rawTitle.replace(/\s+\((?:P[0-3]|PLANNED|IN_PROGRESS|IMPLEMENTED|REVIEW_REQUIRED|CORRECTION_REQUIRED|ACCEPTED|BLOCKED)\)\s*$/i, '').trim() : null;
    tasks.push({
      id: markerId, title: cleanTitle, meta,
      objective: body.match(/^\s*Objective:\s*(.+)$/m)?.[1]?.trim() ?? null,
      sourcePath, startLine, body, order: order++, isArchive: false,
    });
  }
  let topFence = false;
  for (const rawLine of markdown.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(rawLine)) topFence = !topFence;
  }
  if (topFence && !errors.some((e) => e.code === 'TASK_SOURCE_UNCLOSED_FENCE')) {
    errors.push({ code: 'TASK_SOURCE_UNCLOSED_FENCE', message: `${sourcePath} has an unclosed markdown code fence` });
  }
  const opening = [...markdown.matchAll(/<!--\s*TASK:([A-Za-z0-9._-]+)\s*-->/g)].length;
  const closing = [...markdown.matchAll(/<!--\s*\/TASK\s*-->/g)].length;
  if (opening !== closing) errors.push({ code: 'UNBALANCED_TASK_MARKERS', message: `${sourcePath} has ${opening} opening and ${closing} closing task markers` });
  return { tasks, errors };
}

export function splitList(value) {
  if (!value) return [];
  const normalized = String(value).trim();
  if (!normalized || /^(NONE|N\/A|NA|-)$/.test(normalized.toUpperCase())) return [];
  return normalized.split(/[,;]/).map((x) => x.trim().replace(/^`|`$/g, '')).filter(Boolean);
}
export function extractDependencies(task) { return splitList(task?.meta?.Depends ?? task?.meta?.Dependencies ?? task?.depends ?? task?.dependencies); }
const UI_ROUTING_TAGS = new Set(['ui','ux','design-refinement','unslop','redesign','polish','visual-remediation','frontend','web','blade','livewire','tailwind','alpine','web-components','flutter','mobile','android','design','component-system','premium','accessibility']);
export function extractTags(task) {
  const explicit = splitList(task?.meta?.Tags ?? task?.meta?.Tag ?? task?.tags);
  if (explicit.some((t) => UI_ROUTING_TAGS.has(t.toLowerCase()))) return explicit;
  const action = declaredExecutionAction(task);
  if (action === 'audit' || action === 'deploy' || action === 'document') return explicit;
  const phase = String(task?.meta?.Phase ?? '').trim();
  if (/^EK(?:00|4|5)$/i.test(phase)) return explicit;
  const ownership = String(task?.meta?.Ownership ?? task?.meta?.['Claim Scope'] ?? task?.meta?.['Code Surfaces'] ?? task?.meta?.Files ?? '');
  const skills = String(task?.meta?.Skills ?? '');
  const title = String(task?.title ?? '');
  const hasUiSurface = /\.(?:blade\.php|vue|tsx|jsx|svelte|css|scss)\b/i.test(ownership)
    || /(?:^|[\s,;/`])(?:resources\/views|resources\/css|screens|widgets|pages|components\/ui)\//i.test(ownership)
    || /\bskill\.(?:design-refinement|premium-experience|design-system|component-system|livewire-tailwind-alpine|flutter|web-components)\b/i.test(skills)
    || /\b(?:unslop|design[- ]refinement|visual[- ]remediation|redesign|livewire|blade|tailwind|flutter)\b/i.test(title);
  return hasUiSurface ? [...explicit, 'ui'] : explicit;
}
export function isPendingEvidence(value) { if (!value) return true; return ['', 'PENDING','NONE','N/A','NA','TODO','TBD','-','LEGACY_STATUS_ONLY'].includes(String(value).replace(/`/g, '').trim().toUpperCase()); }

export function extractReferenceTarget(value) {
  if (!value) return null;
  const cleaned = String(value).trim().replace(/^`+|`+$/g, '').split(/[\s,;]+/)[0].replace(/^`+|`+$/g, '').trim().replace(/[,;]+$/, '');
  if (!cleaned || /^(NONE|N\/A|NA|TBD|PENDING)$/i.test(cleaned) || /^[a-z]+:\/\//i.test(cleaned)) return null;
  const hash = cleaned.indexOf('#');
  return hash === -1 ? { path: cleaned, anchor: null } : { path: cleaned.slice(0, hash), anchor: cleaned.slice(hash + 1) || null };
}
export function extractReferencePath(value) { return extractReferenceTarget(value)?.path ?? null; }
export function githubHeadingSlug(text) { return text.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-'); }
export function markdownHasAnchor(markdown, anchor) {
  if (!anchor) return true;
  let decoded = anchor; try { decoded = decodeURIComponent(anchor); } catch {}
  const wanted = decoded.toLowerCase();
  if ([...markdown.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/gi)].some((m) => m[1].toLowerCase() === wanted)) return true;
  for (const line of markdown.split('\n')) { const m = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/); if (m && githubHeadingSlug(m[1]) === wanted) return true; }
  return false;
}

export function findDependencyCycles(tasks) {
  const ids = new Set(tasks.map((t) => t.id)), graph = new Map(tasks.map((t) => [t.id, extractDependencies(t).filter((d) => ids.has(d))]));
  const visiting = new Set(), visited = new Set(), cycles = [];
  function dfs(id, stack) {
    if (visiting.has(id)) { cycles.push([...stack.slice(stack.indexOf(id)), id]); return; }
    if (visited.has(id)) return;
    visiting.add(id); stack.push(id); for (const dep of graph.get(id) ?? []) dfs(dep, stack); stack.pop(); visiting.delete(id); visited.add(id);
  }
  for (const id of graph.keys()) dfs(id, []);
  return cycles;
}

export function walkFiles(root, predicate = () => true) {
  const out = []; if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const full = path.join(root, entry.name); if (entry.isDirectory()) out.push(...walkFiles(full, predicate)); else if (predicate(full)) out.push(full); }
  return out;
}
export function isIgnoredRelative(relativePath, ignored) {
  const normalized = normalizePath(relativePath).replace(/^\.\//, '');
  return ignored.some((prefix) => { const p = normalizePath(prefix).replace(/^\.\//, '').replace(/\/$/, ''); return normalized === p || normalized.startsWith(`${p}/`); });
}
function sha256File(fullPath) { return crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex'); }

export function declaredExecutionAction(task) {
  const value = String(task?.meta?.Action ?? '').trim().toLowerCase();
  return value || null;
}
export function declaredAuditBoundary(task) {
  const value = String(task?.meta?.['Audit Boundary'] ?? task?.meta?.Boundary ?? '').trim().toLowerCase();
  return value || null;
}
function validateDeclaredTaskActions(tasks, config) {
  const errors = [];
  for (const task of tasks) {
    const action = declaredExecutionAction(task);
    const boundary = declaredAuditBoundary(task);
    if (!action) {
      if (boundary) errors.push({ code: 'AUDIT_BOUNDARY_WITHOUT_ACTION', message: `${task.id} declares Audit Boundary without Action: audit` });
      continue;
    }
    if (!DECLARED_EXECUTION_ACTIONS.includes(action)) {
      errors.push({ code: 'UNSUPPORTED_TASK_ACTION', message: `${task.id} declares unsupported Action: ${task.meta.Action}` });
      continue;
    }
    if (action === 'audit') {
      if (config.capabilities?.audit === 'NONE') errors.push({ code: 'AUDIT_ACTION_WITH_AUDIT_DISABLED', message: `${task.id} declares Action: audit while Audit capability is disabled` });
      if (!AUDIT_BOUNDARIES.includes(boundary)) errors.push({ code: 'AUDIT_BOUNDARY_INVALID', message: `${task.id} Action: audit requires Audit Boundary: ${AUDIT_BOUNDARIES.join('|')}` });
    } else {
      if (boundary) errors.push({ code: 'AUDIT_BOUNDARY_WITH_NON_AUDIT_ACTION', message: `${task.id} declares Audit Boundary with Action: ${action}; Audit Boundary is valid only for Action: audit` });
      if (action === 'document' && config.documentation?.enabled !== true) errors.push({ code: 'DOCUMENT_ACTION_WITH_DOCUMENTATION_DISABLED', message: `${task.id} declares Action: document while Documentation Fabric is disabled` });
      if (action === 'deploy') {
        if (config.capabilities?.launch === 'NONE') errors.push({ code: 'DEPLOY_ACTION_WITH_LAUNCH_DISABLED', message: `${task.id} declares Action: deploy while Launch capability is disabled` });
        if (config.deployment?.enabled !== true) errors.push({ code: 'DEPLOY_ACTION_WITH_DEPLOYMENT_DISABLED', message: `${task.id} declares Action: deploy while Production Deployment Fabric is disabled` });
      }
    }
  }
  return errors;
}

function projectionTaskToTask(item, index) {
  const meta = {
    Status: item.state, Phase: item.phase ?? '', Priority: item.priority ?? '', Depends: (item.dependencies ?? []).join(', '),
    Action: item.action ?? '', 'Audit Boundary': item.auditBoundary ?? '', Contract: item.contract ?? '', Verification: item.verification ?? '', Evidence: item.evidence ?? '', Blocker: item.blocker ?? '',
    'Blocker Actionable': item.blockerActionable === true ? 'YES' : item.blockerActionable === false ? 'NO' : '',
    'Unblock Action': item.unblockAction ?? '', Reason: item.reason ?? '', Tags: (item.tags ?? []).join(', '), Risk: item.risk ?? '',
  };
  return { id: item.id, title: item.title ?? null, meta, objective: item.objective ?? null, sourcePath: item.sourcePath, startLine: item.startLine ?? null, body: '', order: Number.isInteger(item.order) ? item.order : index, isArchive: Boolean(item.isArchive), projected: true };
}

export function loadTaskProjection(projectRoot, config) {
  const errors = [], rel = config.taskModel?.projectionPath;
  if (!rel) return { tasks: [], errors: [{ code: 'PROJECTION_PATH_MISSING', message: 'projection-json adapter requires taskModel.projectionPath' }] };
  const full = resolveProjectFile(projectRoot, rel);
  if (!full) return { tasks: [], errors: [{ code: 'PROJECTION_OUTSIDE_PROJECT', message: `Task projection points outside project: ${rel}` }] };
  if (!fs.existsSync(full)) return { tasks: [], errors: [{ code: 'PROJECTION_MISSING', message: `Task projection not found: ${rel}` }] };
  let projection; try { projection = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (error) { return { tasks: [], errors: [{ code: 'PROJECTION_PARSE', message: `${rel}: ${error.message}` }] }; }
  if (projection.schemaVersion !== '2.0.0') errors.push({ code: 'PROJECTION_SCHEMA_VERSION', message: `${rel} schemaVersion must be 2.0.0` });
  if (!Array.isArray(projection.sources) || projection.sources.length === 0) errors.push({ code: 'PROJECTION_SOURCES_MISSING', message: `${rel} must declare hashed source files` });
  for (const source of projection.sources ?? []) {
    const sourceFull = source.path ? resolveProjectFile(projectRoot, source.path) : null;
    if (!sourceFull) { errors.push({ code: 'PROJECTION_SOURCE_OUTSIDE_PROJECT', message: `${rel} has invalid source path: ${source.path ?? 'MISSING'}` }); continue; }
    if (!fs.existsSync(sourceFull)) { errors.push({ code: 'PROJECTION_SOURCE_MISSING', message: `${rel} source missing: ${source.path}` }); continue; }
    if (sha256File(sourceFull) !== source.sha256) errors.push({ code: 'STALE_TASK_PROJECTION', message: `${rel} is stale for ${source.path}; regenerate the native projection` });
  }
  if (!Array.isArray(projection.tasks)) errors.push({ code: 'PROJECTION_TASKS_INVALID', message: `${rel} tasks must be an array` });
  const tasks = Array.isArray(projection.tasks) ? projection.tasks.map(projectionTaskToTask) : [];
  errors.push(...validateDeclaredTaskActions(tasks, config));
  return { tasks, errors };
}

function refreshTaskProjection(projectRoot, config) {
  const command = String(config.taskModel?.projectionCommand ?? '').trim();
  if (!command) return null;
  const result = spawnSync(command, {
    cwd: projectRoot,
    shell: true,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    const timeout = result.error.code === 'ETIMEDOUT';
    return {
      code: timeout ? 'PROJECTION_COMMAND_TIMEOUT' : 'PROJECTION_COMMAND_FAILED',
      message: `Native task projection refresh ${timeout ? 'timed out' : 'failed to start'}: ${result.error.message}`,
    };
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim().slice(0, 2000);
    return {
      code: 'PROJECTION_COMMAND_FAILED',
      message: `Native task projection refresh exited ${result.status}${detail ? `: ${detail}` : ''}`,
    };
  }
  return null;
}

function archiveIndexPath(projectRoot){
  return path.join(path.resolve(projectRoot),'.executionkit','todo','archive-index.json');
}
function archiveSignatures(projectRoot,archives){
  const signatures=[];
  for(const rel of archives){
    const full=resolveProjectFile(projectRoot,rel);
    if(!full||!fs.existsSync(full))continue;
    const stat=fs.statSync(full);
    if(!stat.isFile())continue;
    signatures.push({path:rel,size:stat.size,mtimeMs:Math.trunc(stat.mtimeMs)});
  }
  return signatures.sort((a,b)=>a.path.localeCompare(b.path));
}
function readArchiveIndex(projectRoot,signatures){
  const file=archiveIndexPath(projectRoot);
  if(!fs.existsSync(file))return null;
  try{
    const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value.schemaVersion!=='executionkit-todo-archive-index/v1')return null;
    if(JSON.stringify(value.signatures)!==JSON.stringify(signatures))return null;
    if(!Array.isArray(value.tasks))return null;
    return value;
  }catch{return null;}
}
function writeArchiveIndex(projectRoot,value){
  const file=archiveIndexPath(projectRoot);
  try{
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const tmp=file+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');
    fs.renameSync(tmp,file);
  }catch{}
}
function indexedArchiveTasks(projectRoot,archives){
  const signatures=archiveSignatures(projectRoot,archives);
  const cached=readArchiveIndex(projectRoot,signatures);
  if(cached){
    return {
      tasks:cached.tasks.map((item,index)=>({
        id:item.id,
        title:item.title??null,
        meta:item.meta??{},
        objective:item.objective??null,
        sourcePath:item.sourcePath,
        startLine:item.startLine??null,
        body:'',
        order:index,
        isArchive:true,
        indexedArchive:true,
      })),
      errors:[],
      cache:'HIT',
    };
  }
  const tasks=[],errors=[];
  for(const rel of archives){
    const full=resolveProjectFile(projectRoot,rel);
    if(!full||!fs.existsSync(full))continue;
    const parsed=parseTaskBlocks(fs.readFileSync(full,'utf8'),rel);
    errors.push(...parsed.errors);
    for(const task of parsed.tasks){
      tasks.push({
        id:task.id,
        title:task.title??null,
        meta:{
          Status:task.meta?.Status??null,
          Depends:task.meta?.Depends??task.meta?.Dependencies??'NONE',
          Phase:task.meta?.Phase??null,
          Action:task.meta?.Action??null,
          'Audit Boundary':task.meta?.['Audit Boundary']??task.meta?.Boundary??null,
          Ownership:task.meta?.Ownership??null,
          Evidence:task.meta?.Evidence??null,
          Code:task.meta?.Code??null,
          Verification:task.meta?.Verification??null,
          'Legacy Acceptance':task.meta?.['Legacy Acceptance']??null,
        },
        objective:task.objective??null,
        sourcePath:rel,
        startLine:task.startLine??null,
        body:'',
        order:tasks.length,
        isArchive:true,
        indexedArchive:true,
      });
    }
  }
  if(!errors.length){
    writeArchiveIndex(projectRoot,{
      schemaVersion:'executionkit-todo-archive-index/v1',
      generatedAt:new Date().toISOString(),
      signatures,
      tasks:tasks.map((task)=>({id:task.id,title:task.title,meta:task.meta,objective:task.objective,sourcePath:task.sourcePath,startLine:task.startLine})),
    });
  }
  return {tasks,errors,cache:'MISS'};
}

function hasActiveInstallerLock(projectRoot){
  for(const rel of ['.executionkit/installer/lock.json','.executionkit/v4-installer/lock.json']){
    const full=path.join(projectRoot,rel);
    if(!fs.existsSync(full))continue;
    try{
      const owner=JSON.parse(fs.readFileSync(full,'utf8'));
      if(Number.isSafeInteger(owner?.pid)&&owner.pid>0){
        try{process.kill(owner.pid,0);return true;}catch(err){if(err.code==='ESRCH')continue;}
      }
    }catch{}
    return true;
  }
  return false;
}

export function loadTasks(projectRoot, config = null, {archiveMode='full'} = {}) {
  if (!config) config = loadConfig(projectRoot).config;
  if (hasActiveInstallerLock(projectRoot)) return {tasks:[],errors:[{code:'INSTALLATION_IN_PROGRESS',message:'Recover or finish the installation transaction before selecting canonical work'}]};
  if (/^[45]\./.test(String(config.standardVersion ?? '')) && config.adoption?.integrationPhase !== 'EK00' && config.taskModel?.adapter === 'projection-json') {
    return {tasks:[],errors:[{code:'V4_PROJECTION_TASK_ADAPTER_FORBIDDEN',message:'ExecutionKit v4 uses canonical TODO shards directly; projection-json and its projectionCommand are forbidden in the execution path'}]};
  }
  if (config.taskModel?.adapter === 'projection-json') {
    const refreshError = refreshTaskProjection(projectRoot, config);
    if (refreshError) return { tasks: [], errors: [refreshError] };
    return loadTaskProjection(projectRoot, config);
  }
  if (!['canonical-blocks','native-markdown'].includes(config.taskModel?.adapter)) return { tasks: [], errors: [{ code: 'UNKNOWN_TASK_ADAPTER', message: `Unknown taskModel.adapter: ${config.taskModel?.adapter}` }] };

  const shardPlan=todoShardSources(projectRoot,config,{archiveMode});
  if (shardPlan.errors.length) return {tasks:[],errors:shardPlan.errors};
  if (shardPlan.mode==='sharded' && config.taskModel?.adapter!=='canonical-blocks') {
    return {tasks:[],errors:[{code:'SHARDED_TODO_REQUIRES_CANONICAL_BLOCKS',message:'Sharded TODO authority currently requires canonical-blocks; native/projection authorities must migrate explicitly'}]};
  }

  const all=[],errors=[];let globalOrder=0;
  if(shardPlan.mode==='sharded'){
    const manifestFull=resolveProjectFile(projectRoot,shardPlan.manifestPath);
    const rootParsed=parseTaskBlocks(fs.readFileSync(manifestFull,'utf8'),shardPlan.manifestPath);
    errors.push(...rootParsed.errors);
    if(rootParsed.tasks.length)errors.push({code:'SHARDED_TODO_ROOT_CONTAINS_TASKS',message:shardPlan.manifestPath+' is an index/manifest only; canonical task bodies belong in declared shards'});
  }

  const sources=shardPlan.mode==='sharded'
    ? [
        ...shardPlan.active.map((entry)=>({rel:entry.path,isArchive:false,phase:entry.phase})),
        ...(archiveMode==='full'?shardPlan.archives.map((rel)=>({rel,isArchive:true,phase:null})):[]),
      ]
    : [config.todoPath,...(archiveMode==='full'?(config.taskArchivePaths??[]):[])].map((rel)=>({rel,isArchive:rel!==config.todoPath,phase:null}));

  for(const source of sources){
    const {rel,isArchive,phase}=source;
    const full=resolveProjectFile(projectRoot,rel);
    if(!full){errors.push({code:'TASK_SOURCE_OUTSIDE_PROJECT',message:`${isArchive?'Archive':'TODO'} path points outside project: ${rel}`});continue;}
    if(!fs.existsSync(full)){
      if(shardPlan.mode==='sharded'&&isArchive)continue;
      errors.push({code:isArchive?'ARCHIVE_MISSING':'TODO_MISSING',message:`${isArchive?'Configured task archive':'Canonical TODO'} not found: ${rel}`});continue;
    }
    const markdown=fs.readFileSync(full,'utf8'),parsed=parseTaskBlocks(markdown,rel);
    if(config.taskModel.adapter==='native-markdown'){
      const native=parseNativeMarkdown(markdown,rel,config);
      parsed.tasks.push(...native.tasks);parsed.errors.push(...native.errors);
      parsed.tasks.sort((a,b)=>a.startLine-b.startLine);
    }
    for(const task of parsed.tasks){
      task.isArchive=isArchive;task.order=globalOrder++;
      if(!isArchive&&phase&&config.todoAuthority?.requirePhaseMatch!==false&&String(task.meta?.Phase??'').trim()!==phase){
        errors.push({code:'TODO_SHARD_PHASE_MISMATCH',message:`${task.id} declares Phase ${task.meta?.Phase??'MISSING'} but shard ${rel} is declared for ${phase}`});
      }
    }
    all.push(...parsed.tasks);errors.push(...parsed.errors);
  }

  if(archiveMode==='index'){
    const indexed=indexedArchiveTasks(projectRoot,shardPlan.archives??config.taskArchivePaths??[]);
    for(const task of indexed.tasks){task.order=globalOrder++;all.push(task);}
    errors.push(...indexed.errors);
  }

  const byId=new Map();
  for(const task of all){
    const previous=byId.get(task.id);
    if(previous)errors.push({code:'DUPLICATE_TASK_ID',message:`Task ${task.id} appears in both ${previous.sourcePath}:${previous.startLine} and ${task.sourcePath}:${task.startLine}`});
    else byId.set(task.id,task);
  }
  errors.push(...validateDeclaredTaskActions(all, config));
  return { tasks: all, taskIndex: byId, errors };
}

export function assembleCanonicalTodoMarkdown(projectRoot,config,{includeArchives=false}={}){
  return assembleTodoShardMarkdown(projectRoot,config,{includeArchives});
}

/** Preserve native Markdown bytes; derive lifecycle metadata without another task store. */
export function parseNativeMarkdown(markdown, sourcePath, config) {
  const tasks = [], errors = [], seen = new Set();
  const outside = markdown.replace(/<!-- TASK:[\s\S]*?<!-- \/TASK -->/g,block => block.replace(/[^\n]/g,' '));
  const lines = outside.split('\n');
  const states = {' ':'PLANNED',x:'ACCEPTED',X:'ACCEPTED','~':'IMPLEMENTED',R:'REVIEW_REQUIRED','!':'CORRECTION_REQUIRED',B:'BLOCKED'};
  let fence = false;
  for (let i=0;i<lines.length;i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const match = lines[i].match(/^\s*[-*+] \[([^\]])\] (.+)$/);
    if (!match) continue;
    const title = match[2].trim(), explicit = title.match(/^([A-Z][A-Z0-9._]*-[A-Z0-9._-]+)\b/)?.[1];
    const id = explicit ?? `NATIVE-${crypto.createHash('sha256').update(title).digest('hex').slice(0,16)}`;
    if (!states[match[1]] || seen.has(id)) { errors.push({code:'NATIVE_TASK_AMBIGUOUS',message:`${sourcePath}:${i+1}: unknown marker or duplicate task ID; reconcile native task semantics`}); continue; }
    seen.add(id);
    const meta = {Status:states[match[1]],Phase:'NATIVE',Priority:'P2',Depends:'NONE',Contract:'NONE',Verification:'PENDING',Evidence:'PENDING'};
    for (let j=i+1;j<lines.length && !/^\s*[-*+] \[.\]/.test(lines[j]) && !/^#/.test(lines[j]);j++) {
      const field = lines[j].match(/^\s*- ([A-Za-z][A-Za-z ]+):\s*(.*)$/);
      if (field && field[1] !== 'Status') meta[field[1]] = field[2];
    }
    if (config.adoption?.deepIntegrationRequired && config.adoption?.bootstrapAuthority!=='runtime-receipt' && !stateIsTerminal(meta.Status,config)) {
      const activation = config.adoption.integrationActivationTaskId ?? 'EK00-ACTIVATE';
      const deps = splitList(meta.Depends); meta.Depends = [...new Set([...deps,activation])].join(', ');
    }
    tasks.push({id,title,meta,objective:title,sourcePath,startLine:i+1,body:lines[i],order:i,isArchive:false,projected:true});
  }
  return {tasks,errors};
}

export function canonicalState(stateOrTask, config) {
  let state = typeof stateOrTask === 'string' ? stateOrTask : stateOrTask?.meta?.Status;
  if (!state) return null;
  const aliases = config.stateAliases ?? {}, seen = new Set();
  while (aliases[state] && !seen.has(state)) { seen.add(state); state = aliases[state]; }
  return state;
}
export function stateIsTerminal(stateOrTask, config) { const canonical = canonicalState(stateOrTask, config); return new Set((config.terminalStates ?? []).map((s) => canonicalState(s, config))).has(canonical); }
export function stateSatisfiesDependency(stateOrTask, config) {
  const canonical = canonicalState(stateOrTask, config);
  if (canonical === 'CANCELLED') return Boolean(config.cancellationSatisfiesDependencies);
  return new Set((config.dependencySatisfiedStates ?? []).map((s) => canonicalState(s, config))).has(canonical);
}
export function blockerIsAgentActionable(task) {
  const explicit = task?.meta?.['Blocker Actionable'] ?? task?.meta?.['Agent Actionable'];
  if (explicit != null && String(explicit).trim()) return /^(YES|TRUE|1|AI|AGENT)$/i.test(String(explicit).trim());
  const action = task?.meta?.['Unblock Action'] ?? task?.meta?.['Blocker Action'];
  return Boolean(action) && !/^(NONE|N\/A|NA|TBD|PENDING|BLOCKED|EXTERNAL|-)$/i.test(String(action).trim());
}
export function executionActionForTask(task, config) {
  if (task.isArchive) return null;
  const state = canonicalState(task, config), declared = declaredExecutionAction(task);
  if (declared && (['READY','IN_PROGRESS'].includes(state) || (declared === 'audit' && state === 'CORRECTION_REQUIRED'))) {
    if (!DECLARED_EXECUTION_ACTIONS.includes(declared)) return null;
    if (declared === 'audit' && !AUDIT_BOUNDARIES.includes(declaredAuditBoundary(task))) return null;
    if (declared === 'document' && config.documentation?.enabled !== true) return null;
    if (declared === 'deploy' && (config.capabilities?.launch === 'NONE' || config.deployment?.enabled !== true)) return null;
    return declared;
  }
  switch (state) {
    case 'READY': return 'implement';
    case 'IN_PROGRESS': return 'resume';
    case 'CORRECTION_REQUIRED': return 'correct';
    case 'IMPLEMENTED': case 'REVIEW_REQUIRED': return 'review';
    case 'BLOCKED': return blockerIsAgentActionable(task) ? 'inspect_blocker' : null;
    default: return null;
  }
}
export const ACTION_PRIORITY = { audit: 5, review: 10, revalidate: 10, correct: 20, resume: 30, inspect_blocker: 40, document: 45, implement: 50, deploy: 60 };
export function unresolvedDependencies(task, tasks, config, taskIndex = null) { const byId = taskIndex ?? new Map(tasks.map((t) => [t.id, t])); return extractDependencies(task).filter((dep) => !byId.has(dep) || !stateSatisfiesDependency(byId.get(dep), config)); }
/** One guard shared by lifecycle, readiness, runtime and MCP consumers. */
export function integrationAllowsTask(task, tasks, config, taskIndex = null) {
  if (config.integration?.requireSystemReleaseGate === true && task?.id === String(config.integration?.systemReleaseGateTaskId ?? '').trim()) {
    const denominator = tasks.filter((item) => !item.isArchive && item.id !== task.id && canonicalState(item, config) !== 'CANCELLED');
    if (denominator.some((item) => !stateIsTerminal(item, config))) return false;
    if (systemReleaseConvergenceIssues(tasks, config, { terminalOnly:false }).length) return false;
  }
  const policy = config.adoption;
  if (policy?.bootstrapAuthority==='runtime-receipt') return config.projectState==='ACTIVE';
  if (!policy?.deepIntegrationRequired) return true;
  const phase = policy.integrationPhase ?? 'EK00';
  const gateId = policy.integrationGateTaskId ?? 'EK00-AUDIT';
  const activationId = policy.integrationActivationTaskId ?? 'EK00-ACTIVATE';
  const authorityById = taskIndex ?? new Map(tasks.map(t => [t.id, t]));
  if (String(task.meta?.Phase ?? '').trim() === phase) {
    return task.id !== activationId || stateSatisfiesDependency(authorityById.get(gateId), config);
  }
  if (config.projectState !== 'ACTIVE' || policy.productExecutionBlockedUntilGateAccepted !== true) return false;
  if (![gateId, activationId].every(id => authorityById.has(id) && ['ACCEPTED','RELEASED'].includes(canonicalState(authorityById.get(id),config)))) return false;
  const seen = new Set(), stack = [...extractDependencies(task)];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = authorityById.get(id);
    if (dep) stack.push(...extractDependencies(dep));
  }
  return seen.has(activationId);
}
export function resolveNextExecution(tasks, config, { mode = 'closure', taskIndex = null, includeConvergence = true } = {}) {
  const allowedByMode = {
    closure: new Set(['audit','review','revalidate','correct','resume','inspect_blocker','document','implement','deploy']),
    implementer: new Set(['correct','resume','document','implement']),
    reviewer: new Set(['audit','review','revalidate']),
    blocker: new Set(['inspect_blocker']),
    deployment: new Set(['deploy']),
  };
  const allowed = allowedByMode[mode] ?? allowedByMode.closure, candidates = [];
  const graph=taskIndex??new Map(tasks.map((task)=>[task.id,task]));
  if (includeConvergence && allowed.has('revalidate')) {
    const byId = graph;
    for (const finding of [
      ...phaseConvergenceIssues(tasks, config, { terminalOnly: true }),
      ...systemReleaseConvergenceIssues(tasks, config, { terminalOnly: true }),
    ]) {
      if (!['PHASE_GATE_INCOMPLETE_CONVERGENCE','SYSTEM_RELEASE_GATE_INCOMPLETE_CONVERGENCE'].includes(finding.code) || !finding.gateTaskId) continue;
      const gate = byId.get(finding.gateTaskId);
      if (!gate || !stateSatisfiesDependency(gate, config)) continue;
      candidates.push({
        task: gate,
        action: 'revalidate',
        semanticState: canonicalState(gate, config),
        unresolvedDependencies: finding.taskIds ?? [],
        revalidationReason: finding,
        priority: ACTION_PRIORITY.revalidate,
      });
    }
  }
  for (const task of tasks.filter((t) => !t.isArchive)) {
    if (!integrationAllowsTask(task, tasks, config, graph)) continue;
    const action = executionActionForTask(task, config); if (!action || !allowed.has(action)) continue;
    const unresolved = unresolvedDependencies(task, tasks, config, graph); if (action !== 'inspect_blocker' && unresolved.length) continue;
    candidates.push({ task, action, semanticState: canonicalState(task, config), unresolvedDependencies: unresolved, priority: ACTION_PRIORITY[action] ?? 999 });
  }
  candidates.sort((a,b) => a.priority - b.priority || (a.task.order ?? 0) - (b.task.order ?? 0) || a.task.id.localeCompare(b.task.id));
  return candidates[0] ?? null;
}
export function transitiveDependencyIds(task, tasks) {
  const byId = new Map(tasks.map((item) => [item.id, item]));
  const seen = new Set(), stack = [...extractDependencies(task)];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = byId.get(id);
    if (dep) stack.push(...extractDependencies(dep));
  }
  return seen;
}

export function phaseConvergenceIssues(tasks, config, { terminalOnly = true } = {}) {
  if (config.integration?.requirePhaseConvergenceForClosure === false) return [];
  const minTasks = Math.max(1, Number(config.integration?.minTasksForPhaseGate ?? 2));
  const active = tasks.filter((task) => !task.isArchive);
  const phases = new Map();
  for (const task of active) {
    const phase = String(task.meta?.Phase ?? '').trim();
    if (!phase) continue;
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase).push(task);
  }
  const issues = [];
  for (const [phase, phaseTasks] of phases) {
    const gates = phaseTasks.filter((task) => declaredExecutionAction(task) === 'audit' && (declaredAuditBoundary(task) === 'phase' || (declaredAuditBoundary(task) === 'release' && task.id === config.integration?.systemReleaseGateTaskId)));
    const activationId=config.adoption?.deepIntegrationRequired===true?String(config.adoption?.integrationActivationTaskId??'').trim():'';
    const members = phaseTasks.filter((task) => !gates.includes(task) && task.id!==activationId && canonicalState(task, config) !== 'CANCELLED');
    if (members.length < minTasks) continue;
    const allTerminal = phaseTasks.every((task) => stateIsTerminal(task, config));
    if (terminalOnly && !allTerminal) continue;
    if (gates.length === 0) {
      issues.push({ code: 'PHASE_GATE_MISSING', phase, taskIds: members.map((task) => task.id), message: `Phase ${phase} has ${members.length} canonical tasks but no canonical Action:audit / Audit Boundary:phase convergence gate` });
      continue;
    }
    const acceptedGates = gates.filter((gate) => stateSatisfiesDependency(gate, config));
    if (allTerminal && acceptedGates.length === 0) {
      issues.push({ code: 'PHASE_GATE_NOT_ACCEPTED', phase, taskIds: gates.map((task) => task.id), message: `Phase ${phase} is otherwise terminal but no phase convergence gate is ACCEPTED/RELEASED` });
      continue;
    }
    const candidates = terminalOnly ? acceptedGates : gates;
    const coverage = candidates.map((gate) => ({ gate, deps: transitiveDependencyIds(gate, tasks) }));
    const converged = coverage.find(({ deps }) => members.every((task) => deps.has(task.id)));
    if (!converged) {
      const best = coverage.sort((a,b) => b.deps.size - a.deps.size)[0];
      const missing = members.filter((task) => !best?.deps.has(task.id)).map((task) => task.id);
      issues.push({ code: 'PHASE_GATE_INCOMPLETE_CONVERGENCE', phase, gateTaskId: best?.gate?.id ?? null, taskIds: missing, message: `Phase ${phase} gate does not transitively converge the complete phase denominator; missing: ${missing.join(', ')}` });
    }
  }
  return issues;
}

export function systemReleaseConvergenceIssues(tasks, config, { terminalOnly = true } = {}) {
  if (config.integration?.requireSystemReleaseGate !== true) return [];
  const active = tasks.filter((task) => !task.isArchive);
  const allTerminal = active.every((task) => stateIsTerminal(task, config));
  if (terminalOnly && !allTerminal) return [];
  const gateId = String(config.integration?.systemReleaseGateTaskId ?? '').trim();
  if (!gateId) return [{ code:'SYSTEM_RELEASE_GATE_ID_MISSING', gateTaskId:null, taskIds:[], message:'integration.systemReleaseGateTaskId is required when requireSystemReleaseGate=true' }];
  const gate = active.find((task) => task.id === gateId);
  if (!gate) return [{ code:'SYSTEM_RELEASE_GATE_MISSING', gateTaskId:gateId, taskIds:[], message:`Configured system release gate does not exist in active canonical tasks: ${gateId}` }];
  if (declaredExecutionAction(gate) !== 'audit' || declaredAuditBoundary(gate) !== 'release') {
    return [{ code:'SYSTEM_RELEASE_GATE_NOT_AUDIT', gateTaskId:gate.id, taskIds:[], message:`System release gate ${gate.id} must be Action:audit with Audit Boundary:release` }];
  }
  if (allTerminal && !stateSatisfiesDependency(gate, config)) {
    return [{ code:'SYSTEM_RELEASE_GATE_NOT_ACCEPTED', gateTaskId:gate.id, taskIds:[gate.id], message:`System release gate ${gate.id} is not ACCEPTED/RELEASED` }];
  }
  const deps = transitiveDependencyIds(gate, tasks);
  const denominator = active.filter((task) => task.id !== gate.id && canonicalState(task, config) !== 'CANCELLED');
  const missing = denominator.filter((task) => !deps.has(task.id)).map((task) => task.id);
  return missing.length ? [{ code:'SYSTEM_RELEASE_GATE_INCOMPLETE_CONVERGENCE', gateTaskId:gate.id, taskIds:missing, message:`System release gate ${gate.id} does not transitively converge the complete active denominator; missing: ${missing.join(', ')}` }] : [];
}

export function closureSummary(tasks, config, {includeConvergence=true} = {}) {
  const active = tasks.filter((task) => !task.isArchive), nonTerminal = active.filter((task) => !stateIsTerminal(task, config)), blocked = nonTerminal.filter((task) => canonicalState(task, config) === 'BLOCKED');
  const integrationIssues = includeConvergence ? [
    ...phaseConvergenceIssues(tasks, config, { terminalOnly: true }),
    ...systemReleaseConvergenceIssues(tasks, config, { terminalOnly: true }),
  ] : [];
  return {
    closed: nonTerminal.length === 0 && integrationIssues.length === 0,
    active: active.length,
    terminal: active.length - nonTerminal.length,
    nonTerminal: nonTerminal.length,
    blocked: blocked.length,
    nonTerminalTaskIds: nonTerminal.map((t) => t.id),
    blockedTaskIds: blocked.map((t) => t.id),
    integrationIssues,
  };
}
export function countByState(tasks) { const counts = {}; for (const task of tasks) { const state = task.meta.Status ?? 'MISSING'; counts[state] = (counts[state] ?? 0) + 1; } return counts; }
export function resolveReadyTasks(tasks, config) { return tasks.filter((task) => !task.isArchive && integrationAllowsTask(task, tasks, config) && canonicalState(task, config) === 'READY' && unresolvedDependencies(task, tasks, config).length === 0); }

