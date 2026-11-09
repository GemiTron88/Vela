import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDerivedStateDirectory } from './derived-state.mjs';
import { verifyInstalledRuntime } from './installer.mjs';

export const HOST_BOOTSTRAP_STATE = '.executionkit/host-bootstrap.json';
const RECEIPT = '.executionkit/installation.json';
const SCHEMA = 'executionkit-host-bootstrap/v2';
const LEGACY_SCHEMA = 'executionkit-host-bootstrap/v1';
const HOST_SURFACE_ROOTS = [
  '.agents/plugins/executionkit',
  '.agents/hooks.json',
  '.agents/rules/executionkit-entry.md',
];
const now = () => new Date().toISOString();
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function stateFile(root) { return path.join(path.resolve(root), HOST_BOOTSTRAP_STATE); }
function receiptFile(root) { return path.join(path.resolve(root), RECEIPT); }

function validState(state) {
  if (!state) return null;
  if (![SCHEMA, LEGACY_SCHEMA].includes(state.schemaVersion) || state.host !== 'antigravity' || !state.boundaryId || !state.sourceHash) {
    throw new Error('Host bootstrap state is invalid or unsupported');
  }
  if (state.schemaVersion === LEGACY_SCHEMA) {
    const legacy = { ...state };
    delete legacy[['re', 'startRequiredAt'].join('')];
    return {
      ...legacy,
      schemaVersion: SCHEMA,
      status: 'HOST_VERIFY_PENDING',
      verificationRequiredAt: now(),
      observation: null,
      acceptance: null,
    };
  }
  return state;
}

function safeProjectRelative(rel) {
  if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`unsafe project-relative path: ${String(rel)}`);
  }
  return rel;
}
function safeHostRelative(rel) {
  safeProjectRelative(rel);
  if (!rel.startsWith('.agents/')) throw new Error(`unsafe Antigravity adapter path: ${String(rel)}`);
  return rel;
}

function configuredAdapterSurfaces(root) {
  const config = readJson(path.join(path.resolve(root), 'execution.config.json'));
  const manifestRel = safeProjectRelative(config?.agent?.manifestPath ?? '.agents/manifest.json');
  const manifest = readJson(path.join(path.resolve(root), manifestRel));
  if (!manifest?.resources || typeof manifest.resources !== 'object') throw new Error('configured Agent manifest is missing while fingerprinting Antigravity host surfaces');
  const result = [];
  for (const resources of Object.values(manifest.resources)) {
    if (!Array.isArray(resources)) continue;
    for (const resource of resources) {
      if (resource?.adapterHost !== 'antigravity') continue;
      result.push(safeHostRelative(resource.path));
    }
  }
  return result;
}

function collectHostSurface(root, rel, entries) {
  const full = path.join(path.resolve(root), rel);
  if (!fs.existsSync(full)) throw new Error(`required Antigravity host surface is missing: ${rel}`);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new Error(`Antigravity host surface must not be a symlink: ${rel}`);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(full, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      collectHostSurface(root, `${rel}/${entry.name}`, entries);
    }
    return;
  }
  if (!stat.isFile()) throw new Error(`Antigravity host surface must be a regular file: ${rel}`);
  entries.push({ path: rel.split(path.sep).join('/'), sha256: digest(fs.readFileSync(full)) });
}

function requireMcpSession({ transport, sessionId, sessionStartedAt } = {}) {
  if (transport !== 'antigravity-mcp') throw new Error('Host acceptance must arrive through the Antigravity ExecutionKit MCP server');
  if (typeof sessionId !== 'string' || sessionId.length < 8) throw new Error('Antigravity MCP host session identity is missing');
  const started = Date.parse(sessionStartedAt ?? '');
  if (!Number.isFinite(started)) throw new Error('Antigravity MCP host session start time is missing or invalid');
  return { sessionId, sessionStartedAt };
}

export function hostSurfaceFingerprint(root) {
  const entries = [];
  const surfaces = new Set(HOST_SURFACE_ROOTS);
  for (const rel of configuredAdapterSurfaces(root)) surfaces.add(rel);
  for (const rel of [...surfaces].sort((a, b) => a.localeCompare(b))) collectHostSurface(root, rel, entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return digest(JSON.stringify(entries));
}

export function readHostBootstrap(root) { return validState(readJson(stateFile(root))); }

export function hostRuntimeStatus(root) {
  const state = readHostBootstrap(root);
  if (!state) return { status: 'NOT_CONFIGURED', runtimeVerified: false, host: 'antigravity' };
  const receipt = readJson(receiptFile(root));
  if (!receipt || receipt.sourceHash !== state.sourceHash) return { ...state, status: 'STALE', runtimeVerified: false, reason: 'Installed ExecutionKit receipt no longer matches the accepted host source' };
  const runtimeVerification = verifyInstalledRuntime(root, receipt.runtime, receipt.runtimeManifest, receipt.sourceHash);
  if (!runtimeVerification.ok) return { ...state, status: 'STRUCTURAL_DRIFT', runtimeVerified: false, reason: runtimeVerification.reason, runtimeDrift: runtimeVerification.drift };
  if (!state.hostSurfaceHash) return { ...state, status: 'STRUCTURAL_DRIFT', runtimeVerified: false, reason: 'Antigravity host-surface fingerprint is missing; establish a new live verification boundary' };
  let currentHostSurfaceHash;
  try { currentHostSurfaceHash = hostSurfaceFingerprint(root); }
  catch (error) { return { ...state, status: 'STRUCTURAL_DRIFT', runtimeVerified: false, reason: error.message }; }
  if (currentHostSurfaceHash !== state.hostSurfaceHash) {
    return { ...state, status: 'STRUCTURAL_DRIFT', runtimeVerified: false, reason: 'Antigravity plugin/adapter/rule/skill/MCP/hook surface changed after the live verification boundary' };
  }
  return { ...state, runtimeVerified: state.status === 'HOST_VERIFIED' };
}

export function markHostVerificationRequired(root, { sourceHash, version, planId = null, reason = 'host-integration-changed', force = false } = {}) {
  if (!/^[a-f0-9]{64}$/.test(sourceHash ?? '')) throw new Error('A verified ExecutionKit sourceHash is required before host bootstrap');
  ensureDerivedStateDirectory(root);
  const currentHostSurfaceHash = hostSurfaceFingerprint(root);
  const existing = readHostBootstrap(root);
  if (!force && existing?.status === 'HOST_VERIFIED' && existing.sourceHash === sourceHash && existing.hostSurfaceHash === currentHostSurfaceHash) return existing;
  const state = {
    schemaVersion: SCHEMA,
    host: 'antigravity',
    status: 'HOST_VERIFY_PENDING',
    sourceHash,
    hostSurfaceHash: currentHostSurfaceHash,
    version: version ?? null,
    planId,
    generation: (existing?.generation ?? 0) + 1,
    boundaryId: crypto.randomUUID(),
    verificationRequiredAt: now(),
    reason,
    observation: null,
    acceptance: null,
  };
  atomic(stateFile(root), state);
  return state;
}

export function recordHostObservation(root, { source = 'antigravity-hook', invocationNum = null } = {}) {
  const state = readHostBootstrap(root);
  if (!state || !['HOST_VERIFY_PENDING', 'HOST_VERIFIED'].includes(state.status)) return { status: 'IGNORED', runtimeVerified: false };
  const observedAt = now();
  const next = {
    ...state,
    status: state.status === 'HOST_VERIFIED' ? 'HOST_VERIFIED' : 'HOST_VERIFY_PENDING',
    observation: { source, invocationNum, observedAt, boundaryId: state.boundaryId },
  };
  atomic(stateFile(root), next);
  return { status: next.status, runtimeVerified: next.status === 'HOST_VERIFIED', observedAt, boundaryId: next.boundaryId, invocationNum };
}

export function acceptHostRuntime(root, options = {}) {
  const state = readHostBootstrap(root);
  if (!state) throw new Error('Host bootstrap has not been structurally prepared');
  const session = requireMcpSession(options);
  const current = hostRuntimeStatus(root);
  if (['STALE', 'STRUCTURAL_DRIFT', 'NOT_CONFIGURED'].includes(current.status)) throw new Error(current.reason ?? `Host runtime is ${current.status}`);
  if (state.status === 'HOST_VERIFIED') return { ...state, runtimeVerified: true, idempotent: true, activeMcpSession: session };
  if (state.status !== 'HOST_VERIFY_PENDING') throw new Error(`Host bootstrap cannot be accepted from ${state.status}`);
  const observation = state.observation;
  if (
    !observation ||
    observation.boundaryId !== state.boundaryId ||
    observation.source !== 'antigravity-hook' ||
    Date.parse(observation.observedAt) < Date.parse(state.verificationRequiredAt)
  ) {
    throw new Error('No fresh Antigravity hook observation exists for the current live verification boundary');
  }
  const acceptedAt = now();
  const next = {
    ...state,
    status: 'HOST_VERIFIED',
    acceptance: {
      transport: options.transport,
      acceptedAt,
      boundaryId: state.boundaryId,
      observationAt: observation.observedAt,
      invocationNum: observation.invocationNum,
      mcpSessionId: session.sessionId,
      mcpSessionStartedAt: session.sessionStartedAt,
    },
  };
  atomic(stateFile(root), next);
  return { ...next, runtimeVerified: true, idempotent: false };
}

export function invalidateHostRuntime(root, reason = 'host-integration-invalidated') {
  const state = readHostBootstrap(root);
  if (!state) return null;
  const next = { ...state, status: 'HOST_VERIFY_PENDING', boundaryId: crypto.randomUUID(), verificationRequiredAt: now(), reason, observation: null, acceptance: null, generation: state.generation + 1 };
  atomic(stateFile(root), next);
  return next;
}
