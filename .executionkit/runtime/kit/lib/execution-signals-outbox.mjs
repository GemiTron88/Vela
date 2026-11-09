import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {validateExecutionSignal, validateExecutionLifecycleTransition} from './execution-signals.mjs';

const MAX_EVENTS = 128;
const MAX_BYTES = 262144;

function ensureNoSymlink(dir) {
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('execution-signals: unsafe storage directory');
  }
}
function ensureStorage(root) {
  const base = path.resolve(root);
  ensureNoSymlink(base);
  const managed = path.join(base, '.executionkit');
  if (!fs.existsSync(managed)) fs.mkdirSync(managed, {mode:0o700});
  ensureNoSymlink(managed);
  const signals = path.join(managed, 'signals');
  if (!fs.existsSync(signals)) fs.mkdirSync(signals, {mode:0o700});
  ensureNoSymlink(signals);
  return signals;
}
function storagePath(root, fileName = 'outbox.json') {
  const base = path.resolve(root, '.executionkit', 'signals');
  ensureNoSymlink(path.resolve(root));
  if (fs.existsSync(path.resolve(root, '.executionkit'))) ensureNoSymlink(path.resolve(root, '.executionkit'));
  if (fs.existsSync(base)) ensureNoSymlink(base);
  return path.join(base, fileName);
}
function readValidatedArray(root, fileName, validator) {
  const file = storagePath(root, fileName);
  if (!fs.existsSync(file)) return [];
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
    throw new Error('execution-signals: outbox integrity failure');
  }
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(body) || body.length > MAX_EVENTS) {
    throw new Error('execution-signals: outbox format invalid');
  }
  for (const item of body) validator(item);
  return body;
}
function readQueue(root) {
  return readValidatedArray(root, 'outbox.json', validateExecutionSignal);
}
function readLifecycleQueue(root) {
  return readValidatedArray(root, 'lifecycle-outbox.json', validateExecutionLifecycleTransition);
}
function normalizeEnrollmentState(value) {
  // Bounded, secret-free enrollment handshake state (status codes and timestamps only).
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const key of ['status', 'reason', 'lastAttemptAt', 'nextAttemptAfter']) {
    if (typeof value[key] === 'string' && value[key].length <= 128) out[key] = value[key];
  }
  if (Number.isInteger(value.httpStatus)) out.httpStatus = value.httpStatus;
  return Object.keys(out).length ? out : null;
}
function readDeliveryStateFile(root) {
  const file = storagePath(root, 'delivery-state.json');
  if (!fs.existsSync(file)) return {schema_version: 1, attempts: {}, receipts: []};
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
    throw new Error('execution-signals: outbox integrity failure');
  }
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('execution-signals: outbox format invalid');
  }
  return {
    schema_version: 1,
    attempts: body.attempts && typeof body.attempts === 'object' && !Array.isArray(body.attempts) ? body.attempts : {},
    receipts: Array.isArray(body.receipts) ? body.receipts.slice(-MAX_EVENTS) : [],
    ...(normalizeEnrollmentState(body.enrollment) ? {enrollment: normalizeEnrollmentState(body.enrollment)} : {})
  };
}
function atomicWriteFile(dir, fileName, serialized) {
  if (Buffer.byteLength(serialized) > MAX_BYTES) {
    throw new Error('execution-signals: queue capacity exceeded');
  }
  const tmp = path.join(dir, '.' + fileName + '-' + randomBytes(8).toString('hex') + '.tmp');
  let handle;
  try {
    handle = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(handle, serialized);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(tmp, path.join(dir, fileName));
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function withOutboxLock(root, fn) {
  const dir = ensureStorage(root);
  const lock = path.join(dir, '.outbox.lock');
  // Fail closed if another producer or a crashed producer holds the lock.
  // Operators reconcile a stale lock explicitly; never delete it by age alone.
  const lockHandle = fs.openSync(lock, 'wx', 0o600);
  try {
    return fn(dir);
  } finally {
    fs.closeSync(lockHandle);
    fs.unlinkSync(lock);
  }
}
function updateLocked(root, update, {fileName = 'outbox.json', reader = readQueue} = {}) {
  return withOutboxLock(root, (dir) => {
    const queue = reader(root);
    const next = update(queue);
    const serialized = JSON.stringify(next);
    if (next.length > MAX_EVENTS || Buffer.byteLength(serialized) > MAX_BYTES) {
      throw new Error('execution-signals: queue capacity exceeded');
    }
    atomicWriteFile(dir, fileName, serialized);
    return next;
  });
}

// Disabled is deliberately zero-I/O.
export function createExecutionSignalOutbox(root, {enabled = false} = {}) {
  if (typeof root !== 'string' || !root) throw new TypeError('execution-signals: root required');
  return Object.freeze({
    enqueue(event) {
      if (!enabled) return {status: 'disabled'};
      const validated = validateExecutionSignal(event);
      let outcome = 'queued';
      updateLocked(root, current => {
        const existing = current.find(item => item.source === validated.source && item.id === validated.id);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(validated)) {
            throw new Error('execution-signals: duplicate identity content conflict');
          }
          outcome = 'duplicate';
          return current;
        }
        return [...current, validated];
      });
      return {status: outcome, id: validated.id};
    },
    list() { return enabled ? readQueue(root) : []; },
    acknowledge(id) {
      if (!enabled) return {status: 'disabled'};
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) {
        throw new TypeError('execution-signals: invalid acknowledged event id');
      }
      let found = false;
      updateLocked(root, current => current.filter(event => {
        if (event.id === id) { found = true; return false; }
        return true;
      }));
      return {status: found ? 'acknowledged' : 'not_found', id};
    },
    enqueueLifecycle(transition) {
      if (!enabled) return {status: 'disabled'};
      const validated = validateExecutionLifecycleTransition(transition);
      let outcome = 'queued';
      updateLocked(root, current => {
        const existing = current.find(item => item.event_key === validated.event_key);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(validated)) {
            throw new Error('execution-signals: duplicate lifecycle identity content conflict');
          }
          outcome = 'duplicate';
          return current;
        }
        return [...current, validated];
      }, {fileName: 'lifecycle-outbox.json', reader: readLifecycleQueue});
      return {status: outcome, eventKey: validated.event_key};
    },
    listLifecycle() { return enabled ? readLifecycleQueue(root) : []; },
    acknowledgeLifecycle(eventKey) {
      if (!enabled) return {status: 'disabled'};
      if (typeof eventKey !== 'string' || !/^lifecycle-[a-f0-9]{32}$/.test(eventKey)) {
        throw new TypeError('execution-signals: invalid acknowledged lifecycle event key');
      }
      let found = false;
      updateLocked(root, current => current.filter(item => {
        if (item.event_key === eventKey) { found = true; return false; }
        return true;
      }), {fileName: 'lifecycle-outbox.json', reader: readLifecycleQueue});
      return {status: found ? 'acknowledged' : 'not_found', eventKey};
    },
    readDeliveryState() {
      if (!enabled) return {schema_version: 1, attempts: {}, receipts: []};
      return readDeliveryStateFile(root);
    },
    updateDeliveryState(updater) {
      if (!enabled) return {schema_version: 1, attempts: {}, receipts: []};
      return withOutboxLock(root, (dir) => {
        const current = readDeliveryStateFile(root);
        const next = updater(current);
        const normalized = {
          schema_version: 1,
          attempts: next?.attempts && typeof next.attempts === 'object' ? next.attempts : {},
          receipts: Array.isArray(next?.receipts) ? next.receipts.slice(-MAX_EVENTS) : [],
          ...(normalizeEnrollmentState(next?.enrollment) ? {enrollment: normalizeEnrollmentState(next.enrollment)} : {})
        };
        const serialized = JSON.stringify(normalized);
        atomicWriteFile(dir, 'delivery-state.json', serialized);
        return normalized;
      });
    }
  });
}

