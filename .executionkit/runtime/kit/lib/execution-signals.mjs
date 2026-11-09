import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createExecutionSignalOutbox} from './execution-signals-outbox.mjs';
import {createExecutionCollaborationClient, mintAgentCollaborationToken} from './execution-collaboration.mjs';

export const EXECUTION_SIGNAL_TYPES = Object.freeze([
  'execution.task.started', 'execution.task.completed', 'execution.task.blocked',
  'execution.test.failed', 'execution.visual.review_required', 'execution.decision.denied',
  'execution.agent.delegation_failed', 'execution.phase.completed',
  'execution.release.verified', 'execution.deploy.completed', 'execution.rollback.completed'
]);

const types = new Set(EXECUTION_SIGNAL_TYPES);
const severityByType = Object.freeze({
  'execution.task.started': 'info',
  'execution.task.completed': 'info',
  'execution.task.blocked': 'warning',
  'execution.test.failed': 'error',
  'execution.visual.review_required': 'warning',
  'execution.decision.denied': 'warning',
  'execution.agent.delegation_failed': 'error',
  'execution.phase.completed': 'info',
  'execution.release.verified': 'info',
  'execution.deploy.completed': 'info',
  'execution.rollback.completed': 'warning'
});
const completion = new Set([
  'execution.task.completed', 'execution.phase.completed', 'execution.release.verified',
  'execution.deploy.completed', 'execution.rollback.completed'
]);
const keyPattern = /^[A-Za-z0-9.][A-Za-z0-9._:/-]*$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const shaPattern = /^[a-fA-F0-9]{40}$/;
const statuses = new Set(['OBSERVED', 'BLOCKED', 'UNVERIFIED']);
const verifiedReceiptStatuses = new Set(['PASS', 'VERIFIED', 'ACCEPTED', 'SEALED', 'INSTALLED', 'ACTIVATED', 'ROLLED_BACK']);
const forbiddenPayloadKeys = new Set([
  'raw_stdout', 'raw_stderr', 'raw_logs', 'file_contents', 'prompt',
  'clipboard', 'secret', 'customer_body', 'private_key', 'token', 'accessSigningKey', 'signingKey'
]);

function boundedKey(value, key, max = 128) {
  if (typeof value !== 'string' || !value || value.length > max || value.includes('..') || !keyPattern.test(value)) {
    throw new TypeError('execution-signals: invalid ' + key);
  }
  return value;
}

function assertKeys(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw new TypeError('execution-signals: object required');
  }
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) throw new TypeError('execution-signals: unknown field ' + key);
  }
}

function assertNoForbiddenSecrets(payload) {
  if (!payload || typeof payload !== 'object') return;
  for (const [k, v] of Object.entries(payload)) {
    if (forbiddenPayloadKeys.has(k)) {
      throw new TypeError('execution-signals: forbidden secret or log field ' + k);
    }
    if (v && typeof v === 'object') assertNoForbiddenSecrets(v);
  }
}

function endpointBase(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('execution-signals: missing endpoint');
  let url;
  try { url = new URL(raw); } catch { throw new Error('execution-signals: invalid endpoint'); }
  if ((url.protocol !== 'https:' &&
     !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('execution-signals: untrusted endpoint');
  }
  return url.origin;
}

function createSignalEnvelope({repository, runId, taskId, transitionId, type, occurredAt, commit, evidence, status}) {
  const source = 'executionkit/' + repository;
  const identity = {source, run_id: runId, task_id: taskId || '', transition_id: transitionId, type};
  const id = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const data = {
    schema_version: 1,
    repository, run_id: runId,
    ...(taskId ? {task_id: taskId} : {}),
    transition_id: transitionId,
    ...(commit ? {commit_sha: commit.toLowerCase()} : {}),
    ...(evidence ? {evidence_ref: evidence} : {}),
    status,
    severity: severityByType[type]
  };
  return Object.freeze({specversion: '1.0', id, source, type,
    time: occurredAt, subject: runId + (taskId ? '/' + taskId : ''),
    data: Object.freeze(data)});
}

// Creates only a PROVISIONAL observation. Later lifecycle adapters must verify
// signed/evidence-bound receipts before constructing success notifications.
// The primitive itself cannot certify production, deployment or task completion.
export function buildExecutionSignal(input) {
  assertKeys(input, ['repository', 'runId', 'taskId', 'transitionId', 'type', 'occurredAt',
    'commitSha', 'evidenceRef', 'status']);
  const repository = boundedKey(input.repository, 'repository');
  if (!repositoryPattern.test(repository)) throw new TypeError('execution-signals: invalid repository');
  const runId = boundedKey(input.runId, 'runId');
  const transitionId = boundedKey(input.transitionId, 'transitionId');
  const taskId = input.taskId === undefined ? undefined : boundedKey(input.taskId, 'taskId');
  if (!types.has(input.type)) throw new TypeError('execution-signals: unsupported type');
  const status = input.status || 'OBSERVED';
  if (!statuses.has(status)) throw new TypeError('execution-signals: unverified or privileged status');
  if (completion.has(input.type)) throw new TypeError('execution-signals: completion needs authoritative evidence adapter');
  const commit = input.commitSha === undefined ? undefined : input.commitSha;
  if (commit !== undefined && (typeof commit !== 'string' || !shaPattern.test(commit))) {
    throw new TypeError('execution-signals: invalid commit SHA');
  }
  const evidence = input.evidenceRef === undefined ? undefined : boundedKey(input.evidenceRef, 'evidenceRef', 200);
  if (input.type !== 'execution.task.started' && evidence === undefined) {
    throw new TypeError('execution-signals: evidence reference required');
  }
  if (input.occurredAt === undefined || typeof input.occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(input.occurredAt)) {
    throw new TypeError('execution-signals: verified source time required');
  }
  const timestamp = new Date(input.occurredAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== input.occurredAt) {
    throw new TypeError('execution-signals: invalid UTC timestamp');
  }
  return createSignalEnvelope({repository, runId, taskId, transitionId, type: input.type, occurredAt: input.occurredAt, commit, evidence, status});
}

// Authoritative completion signal adapter: requires a verified receipt with matching commitSha and evidenceRef.
export function buildVerifiedCompletionSignal(input) {
  assertKeys(input, ['repository', 'runId', 'taskId', 'transitionId', 'type', 'occurredAt',
    'commitSha', 'evidenceRef', 'receipt']);
  const repository = boundedKey(input.repository, 'repository');
  if (!repositoryPattern.test(repository)) throw new TypeError('execution-signals: invalid repository');
  const runId = boundedKey(input.runId, 'runId');
  const transitionId = boundedKey(input.transitionId, 'transitionId');
  const taskId = input.taskId === undefined ? undefined : boundedKey(input.taskId, 'taskId');
  if (!completion.has(input.type)) {
    throw new TypeError('execution-signals: buildVerifiedCompletionSignal only accepts completion types');
  }
  if (input.type === 'execution.task.completed' && !taskId) {
    throw new TypeError('execution-signals: execution.task.completed requires taskId');
  }
  const commit = input.commitSha;
  if (typeof commit !== 'string' || !shaPattern.test(commit)) {
    throw new TypeError('execution-signals: verified completion requires 40-char commitSha');
  }
  const evidence = boundedKey(input.evidenceRef, 'evidenceRef', 200);
  const receipt = input.receipt;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new TypeError('execution-signals: verified completion receipt required');
  }
  const receiptStatus = String(receipt.status || '').toUpperCase();
  if (!verifiedReceiptStatuses.has(receiptStatus)) {
    throw new TypeError('execution-signals: receipt status is not verified');
  }
  const receiptSha = receipt.head || receipt.commitSha || receipt.sourceCommit || receipt.commit || receipt.candidate?.head;
  if (typeof receiptSha !== 'string' || receiptSha.toLowerCase() !== commit.toLowerCase()) {
    throw new TypeError('execution-signals: receipt commitSha mismatch');
  }
  if (input.occurredAt === undefined || typeof input.occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(input.occurredAt)) {
    throw new TypeError('execution-signals: verified source time required');
  }
  const timestamp = new Date(input.occurredAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== input.occurredAt) {
    throw new TypeError('execution-signals: invalid UTC timestamp');
  }
  return createSignalEnvelope({
    repository, runId, taskId, transitionId, type: input.type,
    occurredAt: input.occurredAt, commit, evidence, status: 'VERIFIED'
  });
}

export function validateExecutionSignal(event) {
  assertKeys(event, ['specversion', 'id', 'source', 'type', 'time', 'subject', 'data']);
  if (event.specversion !== '1.0' || !event.data || typeof event.data !== 'object') {
    throw new TypeError('execution-signals: invalid envelope');
  }
  const d = event.data;
  assertKeys(d, ['schema_version', 'repository', 'run_id', 'task_id', 'transition_id',
    'commit_sha', 'evidence_ref', 'status', 'severity']);
  if (d.schema_version !== 1) throw new TypeError('execution-signals: unsupported schema');
  const canonical = completion.has(event.type) && d.status === 'VERIFIED'
    ? buildVerifiedCompletionSignal({
        repository: d.repository, runId: d.run_id, taskId: d.task_id,
        transitionId: d.transition_id, type: event.type, occurredAt: event.time,
        commitSha: d.commit_sha, evidenceRef: d.evidence_ref,
        receipt: {status: 'VERIFIED', commitSha: d.commit_sha}
      })
    : buildExecutionSignal({repository:d.repository, runId:d.run_id, taskId:d.task_id,
        transitionId:d.transition_id, type:event.type, occurredAt:event.time,
        commitSha:d.commit_sha, evidenceRef:d.evidence_ref, status:d.status});
  if (JSON.stringify(canonical) !== JSON.stringify(event)) {
    throw new TypeError('execution-signals: mutated or forged event envelope');
  }
  return canonical;
}

export const CANONICAL_EXECUTION_HOSTS = Object.freeze(['vps01', 'vps02', 'win', 'mac']);
export const EXECUTION_LIFECYCLE_STATES = Object.freeze([
  'STARTING', 'ACTIVE', 'WAITING_REVIEW', 'WAITING_EXTERNAL',
  'BLOCKED', 'FAILED', 'COMPLETED', 'DISCONNECTED', 'UNKNOWN'
]);

const canonicalHosts = new Set(CANONICAL_EXECUTION_HOSTS);
const lifecycleStates = new Set(EXECUTION_LIFECYCLE_STATES);

// Resolves canonical repository, project slug, and host identity.
// Clearly separates a configured canonical host alias from an enrolled/verified host identity:
// arbitrary environment variables (EXECUTIONKIT_VERIFIED_HOST_ID / GEMIXC_HOST_ID) without
// enrolled host credentials or enrolled host config are reported as CONFIGURED_UNVERIFIED.
export function resolveVerifiedExecutionIdentity(root, {config = {}, env = process.env} = {}) {
  const baseName = path.basename(path.resolve(root || '.')).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  const rawProject = String(config?.executionSignals?.project || config?.projectSlug || env?.EXECUTIONKIT_PROJECT || baseName).trim();
  const project = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(rawProject) ? rawProject : 'project';
  const rawRepo = String(config?.executionSignals?.repository || config?.repository || env?.EXECUTIONKIT_REPOSITORY || `executionkit/${project}`).trim();
  const repository = repositoryPattern.test(rawRepo) ? rawRepo : `executionkit/${project}`;

  const enrolledConfigHost = config?.v4?.host?.enrolledHostId ?? config?.executionSignals?.enrolledHostId ?? null;
  const enrolledHostStr = typeof enrolledConfigHost === 'string' ? enrolledConfigHost.trim() : '';
  const configuredConfigHost = config?.executionSignals?.hostId ?? config?.v4?.host?.hostId ?? null;
  const configuredHostStr = typeof configuredConfigHost === 'string' ? configuredConfigHost.trim() : '';
  const envHostRaw = env?.EXECUTIONKIT_VERIFIED_HOST_ID ?? env?.GEMIXC_HOST_ID ?? null;
  const envHostStr = typeof envHostRaw === 'string' ? envHostRaw.trim() : '';

  const candidateHost = configuredHostStr || enrolledHostStr || envHostStr;
  const isCanonicalAlias = canonicalHosts.has(candidateHost);

  const signingKey = config?.executionSignals?.accessSigningKey || config?.executionCollaboration?.accessSigningKey || env?.GEMIXC_ACCESS_SIGNING_KEY || '';
  const hostToken = config?.executionSignals?.hostToken || config?.v4?.host?.hostToken || env?.EXECUTIONKIT_HOST_TOKEN || env?.GEMIXC_HOST_TOKEN || '';
  const serviceToken = config?.executionSignals?.token || env?.GEMIXC_SIGNALS_TOKEN || env?.GEMIXC_SERVICE_TOKEN || '';
  const hasEnrolledCredential = (typeof signingKey === 'string' && signingKey.trim().length >= 32)
    || (typeof hostToken === 'string' && hostToken.trim().length >= 16)
    || (typeof serviceToken === 'string' && serviceToken.trim().length >= 32);

  const explicitlyUnverified = config?.executionSignals?.hostEnrolled === false
    || config?.executionSignals?.hostVerified === false
    || config?.v4?.host?.enrolled === false;
  const hasConfigEnrollment = Boolean(
    !explicitlyUnverified && (
      (enrolledHostStr && canonicalHosts.has(enrolledHostStr))
      || config?.executionSignals?.hostEnrolled === true
      || config?.v4?.host?.enrolled === true
      || (configuredHostStr && canonicalHosts.has(configuredHostStr))
    )
  );
  const hostMismatch = Boolean(
    (enrolledHostStr && configuredHostStr && enrolledHostStr !== configuredHostStr)
    || (enrolledHostStr && envHostStr && enrolledHostStr !== envHostStr)
    || (configuredHostStr && envHostStr && configuredHostStr !== envHostStr)
  );

  let hostStatus = 'UNVERIFIED';
  let verifiedHost = false;
  let enrollmentSource = null;

  if (!candidateHost) {
    hostStatus = 'UNVERIFIED';
  } else if (!isCanonicalAlias) {
    hostStatus = 'INVALID_HOST_ID';
  } else if (hostMismatch) {
    hostStatus = 'HOST_MISMATCH';
  } else if (explicitlyUnverified && !hasEnrolledCredential) {
    hostStatus = 'CONFIGURED_UNVERIFIED';
    enrollmentSource = 'CONFIG_UNVERIFIED';
  } else if (hasEnrolledCredential) {
    verifiedHost = true;
    hostStatus = 'VERIFIED';
    enrollmentSource = 'ENROLLED_CREDENTIAL';
  } else if (hasConfigEnrollment) {
    verifiedHost = true;
    hostStatus = 'VERIFIED';
    enrollmentSource = 'ENROLLED_CONFIG';
  } else {
    // Canonical alias came only from an unauthenticated environment variable without credentials
    hostStatus = 'CONFIGURED_UNVERIFIED';
    enrollmentSource = 'ENV_UNVERIFIED';
  }

  return Object.freeze({
    repository,
    project,
    hostId: verifiedHost ? candidateHost : null,
    configuredHostId: isCanonicalAlias ? candidateHost : null,
    configuredHost: isCanonicalAlias,
    verified: verifiedHost,
    verifiedHost,
    hostStatus,
    enrollmentSource
  });
}

export function buildExecutionLifecycleTransition(input) {
  assertKeys(input, [
    'repository', 'project', 'runId', 'hostId', 'agentId', 'status',
    'taskId', 'phase', 'boundaryScope', 'summary', 'blockerReason', 'reviewReason',
    'commitSha', 'evidenceRef', 'occurredAt', 'heartbeat', 'projectCompleted'
  ]);
  const repository = boundedKey(input.repository, 'repository');
  if (!repositoryPattern.test(repository)) throw new TypeError('execution-signals: invalid repository');
  const project = boundedKey(input.project, 'project', 120);
  const runId = boundedKey(input.runId, 'runId');
  const hostId = boundedKey(input.hostId, 'hostId', 32);
  if (!canonicalHosts.has(hostId)) {
    throw new TypeError('execution-signals: unverified or non-canonical hostId');
  }
  const agentId = boundedKey(input.agentId, 'agentId', 120);
  const status = String(input.status || '').toUpperCase();
  if (!lifecycleStates.has(status)) {
    throw new TypeError('execution-signals: unsupported lifecycle status');
  }
  const boundaryScope = input.boundaryScope === undefined ? undefined : String(input.boundaryScope).toLowerCase();
  if (boundaryScope !== undefined && !['task', 'wave', 'phase', 'run', 'project', 'release', 'deploy'].includes(boundaryScope)) {
    throw new TypeError('execution-signals: invalid boundaryScope');
  }
  if (status === 'COMPLETED' && (
    input.projectCompleted === false
    || (boundaryScope && ['task', 'wave', 'phase'].includes(boundaryScope) && input.projectCompleted !== true)
  )) {
    throw new TypeError('execution-signals: single task completion cannot mark whole run COMPLETED');
  }
  const commit = input.commitSha === undefined ? undefined : input.commitSha;
  if (commit !== undefined && (typeof commit !== 'string' || !shaPattern.test(commit))) {
    throw new TypeError('execution-signals: invalid commit SHA');
  }
  const evidence = input.evidenceRef === undefined ? undefined : boundedKey(input.evidenceRef, 'evidenceRef', 200);
  if (status === 'COMPLETED' && (!commit || !evidence)) {
    throw new TypeError('execution-signals: COMPLETED requires verified commitSha and evidenceRef');
  }
  if (input.occurredAt === undefined || typeof input.occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(input.occurredAt)) {
    throw new TypeError('execution-signals: verified source time required');
  }
  const timestamp = new Date(input.occurredAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== input.occurredAt) {
    throw new TypeError('execution-signals: invalid UTC timestamp');
  }
  const taskId = input.taskId === undefined ? undefined : boundedKey(input.taskId, 'taskId');
  const phase = input.phase === undefined ? undefined : boundedKey(input.phase, 'phase', 64);
  const summary = input.summary === undefined ? '' : String(input.summary).slice(0, 280);
  const blockerReason = input.blockerReason === undefined ? undefined : String(input.blockerReason).slice(0, 280);
  const reviewReason = input.reviewReason === undefined ? undefined : String(input.reviewReason).slice(0, 280);
  const heartbeat = Boolean(input.heartbeat);
  const notifyOwner = !heartbeat && ['WAITING_REVIEW', 'WAITING_EXTERNAL', 'BLOCKED', 'FAILED', 'COMPLETED', 'DISCONNECTED'].includes(status);
  const eventKey = createHash('sha256').update(JSON.stringify({
    repository, project, run_id: runId, host_id: hostId, status, occurred_at: input.occurredAt, heartbeat
  })).digest('hex');

  return Object.freeze({
    event_key: `lifecycle-${eventKey.slice(0, 32)}`,
    event_type: heartbeat ? 'execution.run.heartbeat' : `execution.run.${status.toLowerCase()}`,
    project_identifier: project,
    repository,
    run_id: runId,
    host_id: hostId,
    agent_id: agentId,
    lifecycle_status: status,
    notify_owner: notifyOwner,
    ...(taskId ? {task_id: taskId} : {}),
    ...(phase ? {phase} : {}),
    ...(summary ? {summary} : {}),
    ...(blockerReason ? {blocker_reason: blockerReason} : {}),
    ...(reviewReason ? {review_reason: reviewReason} : {}),
    ...(commit ? {commit_sha: commit.toLowerCase()} : {}),
    ...(evidence ? {evidence_ref: evidence} : {}),
    occurred_at: input.occurredAt
  });
}

export function validateExecutionLifecycleTransition(event) {
  assertKeys(event, [
    'event_key', 'event_type', 'project_identifier', 'repository', 'run_id',
    'host_id', 'agent_id', 'lifecycle_status', 'notify_owner', 'task_id',
    'phase', 'summary', 'blocker_reason', 'review_reason', 'commit_sha',
    'evidence_ref', 'occurred_at'
  ]);
  const heartbeat = event.event_type === 'execution.run.heartbeat';
  const canonical = buildExecutionLifecycleTransition({
    repository: event.repository,
    project: event.project_identifier,
    runId: event.run_id,
    hostId: event.host_id,
    agentId: event.agent_id,
    status: event.lifecycle_status,
    ...(event.task_id ? {taskId: event.task_id} : {}),
    ...(event.phase ? {phase: event.phase} : {}),
    ...(event.summary ? {summary: event.summary} : {}),
    ...(event.blocker_reason ? {blockerReason: event.blocker_reason} : {}),
    ...(event.review_reason ? {reviewReason: event.review_reason} : {}),
    ...(event.commit_sha ? {commitSha: event.commit_sha} : {}),
    ...(event.evidence_ref ? {evidenceRef: event.evidence_ref} : {}),
    occurredAt: event.occurred_at,
    heartbeat,
    projectCompleted: event.lifecycle_status === 'COMPLETED' ? true : false
  });
  if (JSON.stringify(canonical) !== JSON.stringify(event)) {
    throw new TypeError('execution-signals: mutated or forged lifecycle transition');
  }
  return canonical;
}

export function classifyBoundaryCompletionScope({type, boundary, phase, lifecycleStatus, projectCompleted = false} = {}) {
  const effectiveBoundary = boundary || phase || null;
  if (type === 'execution.deploy.completed') return 'PRODUCTION_DEPLOYED';
  if (type === 'execution.rollback.completed') return 'PRODUCTION_ROLLED_BACK';
  if (type === 'execution.release.verified') return 'RELEASE_VERIFIED';
  if (type === 'execution.phase.completed') {
    return projectCompleted === true ? 'PROJECT_COMPLETED' : 'PHASE_COMPLETED';
  }
  if (type === 'execution.task.completed') {
    if (effectiveBoundary === 'wave') return 'WAVE_COMPLETED';
    return 'TASK_COMPLETED';
  }
  if (type === 'execution.task.started') return 'TASK_STARTED';
  if (lifecycleStatus === 'WAITING_REVIEW' || type === 'execution.visual.review_required') return 'WAITING_REVIEW';
  if (lifecycleStatus === 'WAITING_EXTERNAL') return 'WAITING_EXTERNAL';
  if (lifecycleStatus === 'FAILED' || type === 'execution.test.failed') return 'FAILED';
  if (lifecycleStatus === 'DISCONNECTED') return 'DISCONNECTED';
  if (lifecycleStatus === 'BLOCKED' || type === 'execution.task.blocked') return 'BLOCKED';
  return 'OBSERVED';
}

function buildDeliveryBearer({config = {}, env = process.env, identity, scopes}) {
  const signingKey = config?.executionSignals?.accessSigningKey || config?.executionCollaboration?.accessSigningKey || env?.GEMIXC_ACCESS_SIGNING_KEY;
  const token = config?.executionSignals?.token || env?.GEMIXC_SIGNALS_TOKEN || env?.GEMIXC_SERVICE_TOKEN || config?.executionCollaboration?.token || env?.GEMIXC_COLLABORATION_TOKEN;
  const agentId = config?.executionSignals?.agentId || config?.executionCollaboration?.agentId || env?.EXECUTIONKIT_AGENT_ID || 'antigravity-agent';
  if (typeof signingKey === 'string' && signingKey.trim().length >= 32) {
    return mintAgentCollaborationToken({
      signingKey: signingKey.trim(),
      sub: agentId,
      project: identity.project,
      repository: identity.repository,
      ...(identity.verifiedHost && identity.hostId ? {hostId: identity.hostId} : {}),
      scopes
    });
  }
  if (typeof token === 'string' && token.trim().length >= 32) {
    return token.trim();
  }
  return null;
}

// Opt-in, bounded, idempotent GemiXC outbox flush and lifecycle delivery adapter.
// Never acknowledges or deletes a queued event unless GemiXC confirms acceptance.
// Retains queued events safely with exponential backoff when GemiXC is unreachable.
export async function deliverExecutionSignalOutbox(root, {
  config = {},
  env = process.env,
  fetchFn = globalThis.fetch,
  maxBatch = 32,
  now = Date.now(),
  forceRetry = false
} = {}) {
  const enabled = config?.executionSignals?.enabled === true || env?.EXECUTIONKIT_SIGNALS_ENABLED === '1';
  if (!enabled) {
    return Object.freeze({
      status: 'DISABLED',
      ioPerformed: false,
      deliveredCount: 0,
      retainedCount: 0,
      receipts: Object.freeze({
        gemixcAcceptance: Object.freeze({status: 'DISABLED', accepted: false, acceptedIds: [], acceptedLifecycleKeys: []}),
        queueAcknowledgment: Object.freeze({status: 'DISABLED', acknowledgedIds: [], acknowledgedLifecycleKeys: [], remainingQueueDepth: 0}),
        retry: Object.freeze({status: 'DISABLED', retainedCount: 0, scheduledRetries: []})
      })
    });
  }

  const outbox = createExecutionSignalOutbox(root, {enabled: true});
  const queuedSignals = outbox.list();
  const queuedLifecycles = outbox.listLifecycle();
  const totalQueued = queuedSignals.length + queuedLifecycles.length;

  const identity = resolveVerifiedExecutionIdentity(root, {config, env});
  const bearer = buildDeliveryBearer({
    config,
    env,
    identity,
    scopes: ['execution:signals:ingest', 'execution.write', 'execution:projects:enroll']
  });

  if (config?.executionSignals?.deliveryEnabled === false || !bearer) {
    return Object.freeze({
      status: 'DEFERRED_NO_CREDENTIALS',
      ioPerformed: false,
      deliveredCount: 0,
      retainedCount: totalQueued,
      receipts: Object.freeze({
        gemixcAcceptance: Object.freeze({
          status: 'NOT_ATTEMPTED',
          accepted: false,
          reason: config?.executionSignals?.deliveryEnabled === false ? 'DELIVERY_DISABLED' : 'NO_CREDENTIALS_CONFIGURED',
          acceptedIds: Object.freeze([]),
          acceptedLifecycleKeys: Object.freeze([])
        }),
        queueAcknowledgment: Object.freeze({
          status: 'PENDING_DELIVERY',
          acknowledgedIds: Object.freeze([]),
          acknowledgedLifecycleKeys: Object.freeze([]),
          remainingQueueDepth: queuedSignals.length,
          remainingLifecycleDepth: queuedLifecycles.length
        }),
        retry: Object.freeze({
          status: 'DEFERRED_NO_CREDENTIALS',
          retainedCount: totalQueued,
          scheduledRetries: Object.freeze([])
        })
      })
    });
  }

  const rawBaseUrl = config?.executionSignals?.baseUrl || config?.executionCollaboration?.baseUrl || env?.GEMIXC_BASE_URL || 'https://exec.gemitron.net';
  const origin = endpointBase(rawBaseUrl);
  if (typeof fetchFn !== 'function') {
    throw new Error('execution-signals: missing network transport');
  }
  const hostToken = config?.executionSignals?.hostToken || config?.v4?.host?.hostToken || env?.EXECUTIONKIT_HOST_TOKEN || env?.GEMIXC_HOST_TOKEN || '';

  const deliveryState = outbox.readDeliveryState();
  const attemptsMap = {...(deliveryState.attempts || {})};
  const newReceipts = [];
  const acceptedIds = [];
  const acceptedLifecycleKeys = [];
  const acknowledgedIds = [];
  const acknowledgedLifecycleKeys = [];
  const scheduledRetries = [];
  let lastHttpStatus = null;
  let lastRemoteStatus = null;
  let lastAuthority = null;

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + bearer,
    ...(typeof hostToken === 'string' && hostToken.trim().length >= 16 ? {'X-GemiXC-Host-Token': hostToken.trim()} : {})
  };

  async function postJson(urlPath, payloadObj) {
    assertNoForbiddenSecrets(payloadObj);
    try {
      const res = await fetchFn(origin + urlPath, {
        method: 'POST',
        headers,
        redirect: 'error',
        body: JSON.stringify(payloadObj),
        signal: AbortSignal.timeout(4000)
      });
      lastHttpStatus = res.status;
      const raw = await res.text();
      if (raw.length > 16384) {
        return {ok: false, httpStatus: res.status, reason: 'REMOTE_RESPONSE_TOO_LARGE', data: null};
      }
      let data = null;
      try { data = JSON.parse(raw); } catch {
        return {ok: false, httpStatus: res.status, reason: 'INVALID_REMOTE_RESPONSE', data: null};
      }
      if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data)) {
        return {
          ok: false,
          httpStatus: res.status,
          reason: data?.status || ('HTTP_' + res.status),
          data
        };
      }
      return {ok: true, httpStatus: res.status, reason: null, data};
    } catch {
      return {ok: false, httpStatus: null, reason: 'DISCONNECTED', data: null};
    }
  }

  // A missing project may be enrolled only through the dedicated machine-bound
  // handshake. A 404 signal cannot create a project by itself.
  // At most one handshake per flush; terminal denials (ignored, unauthorized,
  // slug conflicts) back off persistently so queued signals are retained, not spammed.
  const explicitRepository = config?.executionSignals?.repository || config?.repository || env?.EXECUTIONKIT_REPOSITORY;
  const enrollmentEligible = config?.executionSignals?.autoEnroll !== false &&
    typeof explicitRepository === 'string' && explicitRepository.trim() === identity.repository &&
    identity.verifiedHost && Boolean(identity.hostId) &&
    typeof hostToken === 'string' && hostToken.trim().length >= 16;
  const priorEnrollment = deliveryState.enrollment && typeof deliveryState.enrollment === 'object' ? deliveryState.enrollment : null;
  let enrollmentRecord = priorEnrollment;
  let enrollmentOutcome = null;
  const TERMINAL_ENROLLMENT_BACKOFF_MS = 3600000;

  async function enrollOnce(commitSha, runId) {
    if (enrollmentOutcome) return enrollmentOutcome;
    if (!forceRetry && priorEnrollment?.nextAttemptAfter && new Date(priorEnrollment.nextAttemptAfter).getTime() > now) {
      enrollmentOutcome = {ok: false, httpStatus: priorEnrollment.httpStatus ?? null, reason: 'ENROLLMENT_BACKOFF_PENDING', data: null};
      return enrollmentOutcome;
    }
    const enrollment = await postJson('/api/v1/execution/enrollment/on-run', {
      project_slug: identity.project,
      repository: identity.repository,
      host_id: identity.hostId,
      run_id: runId,
      commit_sha: commitSha.toLowerCase()
    });
    const remote = String(enrollment.data?.status || enrollment.reason || 'UNAVAILABLE');
    const succeeded = enrollment.ok && ['ENROLLED', 'ALREADY_ENROLLED'].includes(enrollment.data?.status) &&
      enrollment.data?.project_slug === identity.project;
    // Existing repository aliases must match the configured kit project slug.
    // Never pretend that a mismatched project was enrolled.
    const reason = succeeded ? null
      : (enrollment.ok && enrollment.data?.project_slug !== identity.project ? 'ENROLLMENT_PROJECT_SLUG_MISMATCH'
        : (remote.startsWith('ENROLLMENT_') ? remote : 'ENROLLMENT_' + remote));
    // Unpushed/stale commits and in-flight enrollments recover on the next normal retry.
    const terminal = !succeeded && [403, 409, 422].includes(enrollment.httpStatus) &&
      !['ENROLLMENT_IN_PROGRESS', 'SOURCE_COMMIT_NOT_VERIFIED', 'SOURCE_COMMIT_STALE'].includes(remote);
    enrollmentRecord = {
      status: succeeded ? remote : 'DENIED',
      reason: reason || remote,
      httpStatus: enrollment.httpStatus,
      lastAttemptAt: new Date(now).toISOString(),
      ...(terminal ? {nextAttemptAfter: new Date(now + TERMINAL_ENROLLMENT_BACKOFF_MS).toISOString()} : {})
    };
    enrollmentOutcome = succeeded
      ? {ok: true, httpStatus: enrollment.httpStatus, reason: null, data: enrollment.data}
      : {ok: false, httpStatus: enrollment.httpStatus, reason, data: enrollment.data};
    return enrollmentOutcome;
  }

  async function postWithVerifiedEnrollment(urlPath, payload, commitSha, runId) {
    const initial = await postJson(urlPath, payload);
    if (initial.reason !== 'PROJECT_NOT_ENROLLED' || !enrollmentEligible ||
        typeof commitSha !== 'string' || !/^[a-f0-9]{40}$/i.test(commitSha)) {
      return initial;
    }
    const enrollment = await enrollOnce(commitSha, runId);
    if (!enrollment.ok) {
      return {ok: false, httpStatus: enrollment.httpStatus, reason: enrollment.reason, data: enrollment.data};
    }
    return postJson(urlPath, payload);
  }

  for (const signal of queuedSignals.slice(0, maxBatch)) {
    const prev = attemptsMap[signal.id];
    if (!forceRetry && prev?.nextRetryAfter && new Date(prev.nextRetryAfter).getTime() > now) {
      scheduledRetries.push(Object.freeze({
        eventId: signal.id,
        attempt: prev.attempt || 1,
        nextRetryAfter: prev.nextRetryAfter,
        reason: 'RETRY_BACKOFF_PENDING'
      }));
      continue;
    }

    const res = await postWithVerifiedEnrollment('/api/v1/execution/signals/ingest', signal, signal.data?.commit_sha, signal.data?.run_id);
    const remoteStatus = String(res.data?.status || '');
    const accepted = res.ok && ['ACCEPTED', 'IDEMPOTENT_REPLAY', 'STORED'].includes(remoteStatus);
    const observedAt = new Date(now).toISOString();

    if (accepted) {
      acceptedIds.push(signal.id);
      lastRemoteStatus = remoteStatus;
      lastAuthority = res.data?.authority || 'gemixc_execution_center';
      const ack = outbox.acknowledge(signal.id);
      if (ack.status === 'acknowledged') {
        acknowledgedIds.push(signal.id);
      }
      delete attemptsMap[signal.id];
      newReceipts.push({
        kind: 'signal',
        eventId: signal.id,
        type: signal.type,
        gemixcAcceptance: {
          status: remoteStatus,
          accepted: true,
          httpStatus: res.httpStatus,
          idempotentReplay: Boolean(res.data?.idempotent_replay || remoteStatus === 'IDEMPOTENT_REPLAY'),
          authority: lastAuthority,
          acceptedAt: observedAt
        },
        queueAcknowledgment: {
          status: ack.status === 'acknowledged' ? 'ACKNOWLEDGED' : ack.status,
          removedFromQueue: ack.status === 'acknowledged',
          acknowledgedAt: observedAt
        }
      });
    } else {
      const attempt = Number(prev?.attempt || 0) + 1;
      const backoffMs = Math.min(300000, 1000 * Math.pow(2, Math.min(attempt - 1, 8)));
      const nextRetryAfter = new Date(now + backoffMs).toISOString();
      const reason = res.reason || remoteStatus || 'DELIVERY_FAILED';
      attemptsMap[signal.id] = {
        attempt,
        lastAttemptAt: observedAt,
        nextRetryAfter,
        lastReason: reason,
        httpStatus: res.httpStatus
      };
      scheduledRetries.push(Object.freeze({
        eventId: signal.id,
        attempt,
        nextRetryAfter,
        reason,
        httpStatus: res.httpStatus
      }));
      newReceipts.push({
        kind: 'signal_retry',
        eventId: signal.id,
        type: signal.type,
        retry: {
          status: 'RETAINED_FOR_RETRY',
          attempt,
          nextRetryAfter,
          reason,
          httpStatus: res.httpStatus
        }
      });
    }
  }

  for (const transition of queuedLifecycles.slice(0, maxBatch)) {
    const key = transition.event_key;
    const prev = attemptsMap[key];
    if (!forceRetry && prev?.nextRetryAfter && new Date(prev.nextRetryAfter).getTime() > now) {
      scheduledRetries.push(Object.freeze({
        eventKey: key,
        attempt: prev.attempt || 1,
        nextRetryAfter: prev.nextRetryAfter,
        reason: 'RETRY_BACKOFF_PENDING'
      }));
      continue;
    }

    const heartbeatPayload = {
      ...transition,
      project_slug: transition.project_identifier,
      lifecycle_state: transition.lifecycle_status,
      ...(transition.phase ? {current_phase: transition.phase} : {}),
      ...(transition.blocker_reason || transition.review_reason || transition.summary
        ? {blocker_summary: transition.blocker_reason || transition.review_reason || transition.summary}
        : {}),
      last_activity_at: transition.occurred_at,
      last_heartbeat_at: transition.occurred_at
    };
    const res = await postWithVerifiedEnrollment('/api/v1/execution/signals/heartbeats', heartbeatPayload, transition.commit_sha, transition.run_id);
    const remoteStatus = String(res.data?.status || '');
    const accepted = res.ok && ['RECORDED', 'ACCEPTED', 'IDEMPOTENT_REPLAY'].includes(remoteStatus);
    const observedAt = new Date(now).toISOString();

    if (accepted) {
      acceptedLifecycleKeys.push(key);
      lastRemoteStatus = remoteStatus;
      lastAuthority = res.data?.authority || 'gemixc_execution_center';
      const ack = outbox.acknowledgeLifecycle(key);
      if (ack.status === 'acknowledged') {
        acknowledgedLifecycleKeys.push(key);
      }
      delete attemptsMap[key];
      newReceipts.push({
        kind: 'lifecycle',
        eventKey: key,
        lifecycleStatus: transition.lifecycle_status,
        gemixcAcceptance: {
          status: remoteStatus,
          accepted: true,
          httpStatus: res.httpStatus,
          authority: lastAuthority,
          acceptedAt: observedAt
        },
        queueAcknowledgment: {
          status: ack.status === 'acknowledged' ? 'ACKNOWLEDGED' : ack.status,
          removedFromQueue: ack.status === 'acknowledged',
          acknowledgedAt: observedAt
        }
      });
    } else {
      const attempt = Number(prev?.attempt || 0) + 1;
      const backoffMs = Math.min(300000, 1000 * Math.pow(2, Math.min(attempt - 1, 8)));
      const nextRetryAfter = new Date(now + backoffMs).toISOString();
      const reason = res.reason || remoteStatus || 'LIFECYCLE_DELIVERY_FAILED';
      attemptsMap[key] = {
        attempt,
        lastAttemptAt: observedAt,
        nextRetryAfter,
        lastReason: reason,
        httpStatus: res.httpStatus
      };
      scheduledRetries.push(Object.freeze({
        eventKey: key,
        attempt,
        nextRetryAfter,
        reason,
        httpStatus: res.httpStatus
      }));
      newReceipts.push({
        kind: 'lifecycle_retry',
        eventKey: key,
        lifecycleStatus: transition.lifecycle_status,
        retry: {
          status: 'RETAINED_FOR_RETRY',
          attempt,
          nextRetryAfter,
          reason,
          httpStatus: res.httpStatus
        }
      });
    }
  }

  outbox.updateDeliveryState((current) => ({
    schema_version: 1,
    attempts: attemptsMap,
    receipts: [...(current.receipts || []), ...newReceipts],
    ...(enrollmentRecord ? {enrollment: enrollmentRecord} : {})
  }));

  const remainingSignals = outbox.list().length;
  const remainingLifecycles = outbox.listLifecycle().length;
  const remainingTotal = remainingSignals + remainingLifecycles;
  const deliveredTotal = acceptedIds.length + acceptedLifecycleKeys.length;
  const overallStatus = deliveredTotal > 0 && remainingTotal === 0
    ? 'DELIVERED'
    : deliveredTotal > 0 && remainingTotal > 0
      ? 'PARTIAL_RETRY_SCHEDULED'
      : remainingTotal > 0
        ? 'RETRY_SCHEDULED'
        : 'IDLE';

  return Object.freeze({
    status: overallStatus,
    ioPerformed: true,
    deliveredCount: deliveredTotal,
    retainedCount: remainingTotal,
    receipts: Object.freeze({
      gemixcAcceptance: Object.freeze({
        status: deliveredTotal > 0 ? 'ACCEPTED' : (remainingTotal > 0 ? 'UNAVAILABLE_OR_DENIED' : 'IDLE'),
        accepted: deliveredTotal > 0 && remainingTotal === 0,
        httpStatus: lastHttpStatus,
        remoteStatus: lastRemoteStatus,
        authority: lastAuthority,
        acceptedIds: Object.freeze(acceptedIds),
        acceptedLifecycleKeys: Object.freeze(acceptedLifecycleKeys)
      }),
      queueAcknowledgment: Object.freeze({
        status: acknowledgedIds.length + acknowledgedLifecycleKeys.length > 0
          ? (remainingTotal === 0 ? 'ACKNOWLEDGED' : 'PARTIALLY_ACKNOWLEDGED')
          : (remainingTotal > 0 ? 'UNACKNOWLEDGED_RETAINED' : 'IDLE'),
        acknowledgedIds: Object.freeze(acknowledgedIds),
        acknowledgedLifecycleKeys: Object.freeze(acknowledgedLifecycleKeys),
        remainingQueueDepth: remainingSignals,
        remainingLifecycleDepth: remainingLifecycles
      }),
      retry: Object.freeze({
        status: remainingTotal > 0 ? 'RETRY_SCHEDULED' : 'NOT_REQUIRED',
        retainedCount: remainingTotal,
        scheduledRetries: Object.freeze(scheduledRetries)
      })
    })
  });
}

export async function checkSafeBoundaryCollaboration(root, {
  config = {},
  env = process.env,
  fetchFn = globalThis.fetch,
  runId,
  boundaryKey,
  force = false
} = {}) {
  const collabCfg = config?.executionCollaboration || {};
  const collabEnabled = collabCfg.enabled === true || env?.EXECUTIONKIT_COLLABORATION_ENABLED === '1';
  if (!collabEnabled) {
    return Object.freeze({
      status: 'DISABLED',
      authority: 'UNTRUSTED_ADVISORY_ONLY',
      messages: Object.freeze([])
    });
  }
  const identity = resolveVerifiedExecutionIdentity(root, {config, env});
  const effectiveRunId = runId || collabCfg.runId || config?.executionSignals?.runId || env?.EXECUTIONKIT_RUN_ID || `run-${identity.hostId || identity.configuredHostId || 'local'}`;
  const client = createExecutionCollaborationClient({
    enabled: true,
    baseUrl: collabCfg.baseUrl || config?.executionSignals?.baseUrl || env?.GEMIXC_BASE_URL || 'https://exec.gemitron.net',
    token: collabCfg.token || env?.GEMIXC_COLLABORATION_TOKEN,
    accessSigningKey: collabCfg.accessSigningKey || config?.executionSignals?.accessSigningKey || env?.GEMIXC_ACCESS_SIGNING_KEY,
    agentId: collabCfg.agentId || config?.executionSignals?.agentId || env?.EXECUTIONKIT_AGENT_ID || 'antigravity-agent',
    ...(identity.verifiedHost && identity.hostId ? {hostId: identity.hostId} : {}),
    project: identity.project,
    fetchFn
  });
  const cursorFile = collabCfg.cursorFile || path.join(path.resolve(root), '.executionkit', 'signals', 'collaboration-cursor.json');
  const inbox = await client.checkBoundaryInbox({
    runId: effectiveRunId,
    cursorFile,
    boundaryKey,
    force
  });
  return Object.freeze({
    ...inbox,
    status: inbox.status || 'OK',
    authority: 'UNTRUSTED_ADVISORY_ONLY',
    messages: Array.isArray(inbox.messages)
      ? Object.freeze(inbox.messages.map(m => Object.freeze({...m, authority: 'UNTRUSTED_ADVISORY_ONLY'})))
      : Object.freeze([])
  });
}

function runSyncBoundaryTransportWorker(root, {config, env, runId, boundaryKey}) {
  try {
    const selfUrl = new URL(import.meta.url).href;
    const payloadJson = JSON.stringify({
      root: path.resolve(root),
      config: config || {},
      runId: runId || null,
      boundaryKey: boundaryKey || null
    });
    const script = [
      `import {deliverExecutionSignalOutbox, checkSafeBoundaryCollaboration} from ${JSON.stringify(selfUrl)};`,
      `const input = JSON.parse(process.env.EK_BOUNDARY_WORKER_PAYLOAD || '{}');`,
      `const delivery = await deliverExecutionSignalOutbox(input.root, {config: input.config, env: process.env});`,
      `const collaboration = await checkSafeBoundaryCollaboration(input.root, {config: input.config, env: process.env, runId: input.runId, boundaryKey: input.boundaryKey});`,
      `process.stdout.write(JSON.stringify({delivery, collaboration}));`
    ].join('\n');
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: path.resolve(root),
      env: {...process.env, ...(env || {}), EK_BOUNDARY_WORKER_PAYLOAD: payloadJson},
      encoding: 'utf8',
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
    if (res.status === 0 && res.stdout) {
      return JSON.parse(res.stdout.trim());
    }
  } catch {}
  return null;
}

// Synchronous, bounded boundary hook: zero file/network I/O when disabled (default).
export function emitBoundaryExecutionSignalSync(root, {
  config = {},
  env = process.env,
  type,
  runId,
  taskId,
  phase,
  boundary,
  transitionId,
  commitSha,
  evidenceRef,
  receipt,
  lifecycleStatus,
  projectCompleted = false,
  summary,
  blockerReason,
  reviewReason,
  occurredAt = new Date().toISOString(),
  boundaryKey,
  _deferNetworkToAsyncHook = false
} = {}) {
  const signalsEnabled = config?.executionSignals?.enabled === true || env?.EXECUTIONKIT_SIGNALS_ENABLED === '1';
  const collabCfg = config?.executionCollaboration || {};
  const collabEnabled = collabCfg.enabled === true || env?.EXECUTIONKIT_COLLABORATION_ENABLED === '1';

  if (!signalsEnabled && !collabEnabled) {
    return Object.freeze({
      status: 'DISABLED',
      ioPerformed: false,
      signal: null,
      lifecycle: null,
      completionScope: null,
      receipts: null,
      delivery: Object.freeze({status: 'DISABLED'}),
      collaboration: Object.freeze({status: 'DISABLED', authority: 'UNTRUSTED_ADVISORY_ONLY', messages: Object.freeze([])})
    });
  }

  const identity = resolveVerifiedExecutionIdentity(root, {config, env});
  const effectiveRunId = runId || config?.executionSignals?.runId || collabCfg.runId || env?.EXECUTIONKIT_RUN_ID || `run-${identity.hostId || identity.configuredHostId || 'local'}`;
  const effectiveBoundary = boundary || phase || (taskId ? 'task' : 'boundary');
  const effectiveBoundaryKey = boundaryKey || `${type || effectiveBoundary}:${taskId || phase || 'boundary'}:${commitSha ? commitSha.slice(0, 12) : 'head'}`;

  let signal = null;
  let lifecycle = null;
  let enqueueResult = {status: 'disabled'};
  let lifecycleEnqueueResult = {status: 'disabled'};
  let completionScope = null;

  // Enforce strict separation of task/wave/phase completion from full run/project completion
  const normalizedLifecycleStatus = (() => {
    if (!lifecycleStatus) return null;
    const upper = String(lifecycleStatus).toUpperCase();
    if (upper === 'COMPLETED' && projectCompleted !== true) {
      return 'ACTIVE';
    }
    return upper;
  })();

  if (signalsEnabled && type) {
    completionScope = classifyBoundaryCompletionScope({
      type,
      boundary: effectiveBoundary,
      phase,
      lifecycleStatus: normalizedLifecycleStatus,
      projectCompleted: projectCompleted === true
    });
    const effectiveTransitionId = transitionId || `${type}-${taskId || phase || 'boundary'}-${commitSha ? commitSha.slice(0, 12) : Date.now()}`;
    signal = completion.has(type)
      ? buildVerifiedCompletionSignal({
          repository: identity.repository,
          runId: effectiveRunId,
          ...(taskId ? {taskId} : {}),
          transitionId: effectiveTransitionId,
          type,
          occurredAt,
          commitSha,
          evidenceRef,
          receipt
        })
      : buildExecutionSignal({
          repository: identity.repository,
          runId: effectiveRunId,
          ...(taskId ? {taskId} : {}),
          transitionId: effectiveTransitionId,
          type,
          occurredAt,
          ...(commitSha ? {commitSha} : {}),
          ...(evidenceRef ? {evidenceRef} : {}),
          status: type === 'execution.task.blocked' ? 'BLOCKED' : 'OBSERVED'
        });
    const outbox = createExecutionSignalOutbox(root, {enabled: true});
    enqueueResult = outbox.enqueue(signal);
    if (identity.verifiedHost && normalizedLifecycleStatus) {
      const scopeHint = effectiveBoundary === 'wave' || effectiveBoundary === 'phase' || effectiveBoundary === 'task'
        ? effectiveBoundary
        : undefined;
      lifecycle = buildExecutionLifecycleTransition({
        repository: identity.repository,
        project: identity.project,
        runId: effectiveRunId,
        hostId: identity.hostId,
        agentId: config?.executionSignals?.agentId || env?.EXECUTIONKIT_AGENT_ID || 'antigravity-agent',
        status: normalizedLifecycleStatus,
        ...(taskId ? {taskId} : {}),
        ...(phase ? {phase} : {}),
        ...(scopeHint ? {boundaryScope: scopeHint} : {}),
        ...(summary ? {summary} : {}),
        ...(blockerReason ? {blockerReason} : {}),
        ...(reviewReason ? {reviewReason} : {}),
        ...(commitSha ? {commitSha} : {}),
        ...(evidenceRef ? {evidenceRef} : {}),
        occurredAt,
        projectCompleted: projectCompleted === true
      });
      lifecycleEnqueueResult = outbox.enqueueLifecycle(lifecycle);
    }
  }

  let delivery = Object.freeze({
    status: signalsEnabled ? 'DEFERRED_NO_CREDENTIALS' : 'DISABLED',
    ioPerformed: false,
    deliveredCount: 0,
    retainedCount: signalsEnabled ? 1 : 0,
    receipts: Object.freeze({
      gemixcAcceptance: Object.freeze({status: signalsEnabled ? 'NOT_ATTEMPTED' : 'DISABLED', accepted: false, acceptedIds: Object.freeze([]), acceptedLifecycleKeys: Object.freeze([])}),
      queueAcknowledgment: Object.freeze({status: signalsEnabled ? 'PENDING_DELIVERY' : 'DISABLED', acknowledgedIds: Object.freeze([]), acknowledgedLifecycleKeys: Object.freeze([]), remainingQueueDepth: signalsEnabled ? 1 : 0}),
      retry: Object.freeze({status: signalsEnabled ? 'DEFERRED_NO_CREDENTIALS' : 'DISABLED', retainedCount: signalsEnabled ? 1 : 0, scheduledRetries: Object.freeze([])})
    })
  });
  let collaboration = Object.freeze({
    status: 'DISABLED',
    authority: 'UNTRUSTED_ADVISORY_ONLY',
    messages: Object.freeze([])
  });

  const hasRemoteSignalCreds = Boolean(buildDeliveryBearer({
    config,
    env,
    identity,
    scopes: ['execution:signals:ingest']
  })) && config?.executionSignals?.deliveryEnabled !== false;

  if (!_deferNetworkToAsyncHook && ((signalsEnabled && hasRemoteSignalCreds) || collabEnabled)) {
    const workerOut = runSyncBoundaryTransportWorker(root, {
      config,
      env,
      runId: effectiveRunId,
      boundaryKey: effectiveBoundaryKey
    });
    if (workerOut?.delivery) delivery = Object.freeze(workerOut.delivery);
    if (workerOut?.collaboration) collaboration = Object.freeze(workerOut.collaboration);
  }

  const receipts = signalsEnabled && signal
    ? Object.freeze({
        localCreation: Object.freeze({
          status: 'CREATED',
          eventId: signal.id,
          type: signal.type,
          signalStatus: signal.data.status,
          completionScope,
          lifecycleEventKey: lifecycle?.event_key ?? null,
          lifecycleStatus: lifecycle?.lifecycle_status ?? null,
          createdAt: occurredAt
        }),
        outboxPersistence: Object.freeze({
          status: enqueueResult.status === 'queued' || enqueueResult.status === 'duplicate' ? 'PERSISTED' : enqueueResult.status,
          queueOutcome: enqueueResult.status,
          eventId: signal.id,
          outboxPath: '.executionkit/signals/outbox.json',
          lifecycleQueued: Boolean(lifecycleEnqueueResult.status === 'queued' || lifecycleEnqueueResult.status === 'duplicate'),
          persistedAt: occurredAt
        }),
        gemixcAcceptance: delivery.receipts?.gemixcAcceptance ?? Object.freeze({status: 'NOT_ATTEMPTED', accepted: false}),
        queueAcknowledgment: delivery.receipts?.queueAcknowledgment ?? Object.freeze({status: 'PENDING_DELIVERY', acknowledgedIds: Object.freeze([])}),
        retry: delivery.receipts?.retry ?? Object.freeze({status: 'NOT_REQUIRED', retainedCount: 0, scheduledRetries: Object.freeze([])})
      })
    : null;

  return Object.freeze({
    status: signalsEnabled ? enqueueResult.status : 'COLLABORATION_ONLY',
    ioPerformed: Boolean(signalsEnabled || collabEnabled),
    identity,
    completionScope,
    signal,
    lifecycle,
    receipts,
    delivery,
    collaboration
  });
}

// Safe-boundary hook combining local signal emission, GemiXC outbox delivery, and optional advisory inbox check.
export async function runSafeBoundaryExecutionHook(root, {
  config = {},
  env = process.env,
  fetchFn = globalThis.fetch,
  boundaryKey,
  forceCollaborationCheck = false,
  ...signalOptions
} = {}) {
  const signalResult = emitBoundaryExecutionSignalSync(root, {
    config,
    env,
    boundaryKey,
    _deferNetworkToAsyncHook: true,
    ...signalOptions
  });

  const signalsEnabled = config?.executionSignals?.enabled === true || env?.EXECUTIONKIT_SIGNALS_ENABLED === '1';
  const delivery = signalsEnabled
    ? await deliverExecutionSignalOutbox(root, {config, env, fetchFn})
    : signalResult.delivery;

  const identity = signalResult.identity || resolveVerifiedExecutionIdentity(root, {config, env});
  const effectiveRunId = signalOptions.runId || config?.executionCollaboration?.runId || config?.executionSignals?.runId || env?.EXECUTIONKIT_RUN_ID || `run-${identity.hostId || identity.configuredHostId || 'local'}`;
  const effectiveBoundaryKey = boundaryKey || `${signalOptions.type || signalOptions.boundary || signalOptions.phase || 'boundary'}:${signalOptions.taskId || signalOptions.phase || 'boundary'}:${signalOptions.commitSha ? signalOptions.commitSha.slice(0, 12) : 'head'}`;

  const collaboration = await checkSafeBoundaryCollaboration(root, {
    config,
    env,
    fetchFn,
    runId: effectiveRunId,
    boundaryKey: effectiveBoundaryKey,
    force: forceCollaborationCheck
  });

  const receipts = signalResult.receipts
    ? Object.freeze({
        ...signalResult.receipts,
        gemixcAcceptance: delivery.receipts.gemixcAcceptance,
        queueAcknowledgment: delivery.receipts.queueAcknowledgment,
        retry: delivery.receipts.retry
      })
    : null;

  return Object.freeze({
    ...signalResult,
    receipts,
    delivery,
    collaboration
  });
}


