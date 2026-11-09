let pulseEmitter = null;
async function resolveEmitter() {
  if (!pulseEmitter) {
    try {
      const pulse = await import('./agent-pulse.mjs');
      pulseEmitter = pulse.emitExecutionKitEvent;
    } catch {
      pulseEmitter = async () => ({ sent: false, reason: 'agent-pulse-not-available' });
    }
  }
  return pulseEmitter;
}

export const TELEMETRY_EVENT_CONTRACT_VERSION = '1.0.0';

const ALLOWED_PREFIXES = new Set([
  'runtime',
  'state',
  'agent',
  'audit',
  'test',
  'launch',
  'evidence',
  'candidate',
]);

// Fleet telemetry transports bounded operational metadata only. Canonical task/content text
// belongs to repository/GitHub projection, never routine device telemetry.
const FORBIDDEN_KEYS = /^(?:token|secret|authorization|password|cookie|transcript|prompt|sourceCode|stdout|stderr|cwd|root|workspaceRoot|localPath|dirtyPathSample|message|title|objective|verification|nextSafeAction|note|notes|dependencies)$/i;
const MAX_STRING = 2048;
const MAX_ARRAY = 32;
const MAX_KEYS = 64;
const MAX_DEPTH = 5;

function boundedString(value) {
  const text = String(value);
  return text.length <= MAX_STRING ? text : `${text.slice(0, MAX_STRING)}…`;
}

export function sanitizeTelemetryValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return '[DEPTH_LIMIT]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return boundedString(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => sanitizeTelemetryValue(item, depth + 1));
  if (typeof value !== 'object') return boundedString(value);

  const result = {};
  for (const [key, current] of Object.entries(value).slice(0, MAX_KEYS)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    result[key] = sanitizeTelemetryValue(current, depth + 1);
  }
  return result;
}

export function validateSemanticEventName(eventName) {
  const value = String(eventName || '').trim();
  if (!/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*$/.test(value)) {
    throw new Error(`Invalid semantic telemetry event name: ${value || 'EMPTY'}`);
  }
  const prefix = value.split('.')[0];
  if (!ALLOWED_PREFIXES.has(prefix)) throw new Error(`Unsupported semantic telemetry prefix: ${prefix}`);
  return value;
}

/**
 * Emit one bounded, best-effort semantic observation to the per-device Agent.
 * This API never mutates TODO/state and never makes execution depend on telemetry.
 */
export async function emitSystemEvent(root, eventName, payload = {}, options = {}) {
  const normalized = validateSemanticEventName(eventName);
  const safePayload = sanitizeTelemetryValue({
    contractVersion: TELEMETRY_EVENT_CONTRACT_VERSION,
    ...payload,
  });
  const emit = await resolveEmitter();
  return await emit(root, normalized, safePayload, {
    source: options.source || 'executionkit',
  });
}

export function compactTaskRef(task, action = null) {
  if (!task) return { taskId: null, action: action ?? null, phase: null, state: null };
  return sanitizeTelemetryValue({
    taskId: task.id ?? task.taskId ?? null,
    action: action ?? task.action ?? null,
    phase: task.meta?.Phase ?? task.phase ?? null,
    state: task.meta?.Status ?? task.state ?? task.semanticState ?? null,
  });
}
