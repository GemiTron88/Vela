import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';

export const ADAPTER_KINDS = ['discovery', 'evidence', 'quality', 'runtime', 'integration', 'security', 'data', 'health', 'audit'];

function validId(id) { return typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(id); }
function normalizeDetection(value) {
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'detected')) return { applicable: Boolean(value.detected), details: value };
    if (Object.hasOwn(value, 'applicable')) return { applicable: Boolean(value.applicable), details: value };
    return { applicable: true, details: value };
  }
  return { applicable: Boolean(value), details: null };
}

export class AdapterRegistry {
  #items = new Map();
  register(adapter) {
    if (!adapter || typeof adapter !== 'object') throw new TypeError('Adapter must be an object');
    if (!validId(adapter.id)) throw new Error(`Invalid adapter id: ${adapter.id ?? 'MISSING'}`);
    if (!ADAPTER_KINDS.includes(adapter.kind)) throw new Error(`Invalid adapter kind for ${adapter.id}: ${adapter.kind}`);
    if (this.#items.has(adapter.id)) throw new Error(`Duplicate adapter id: ${adapter.id}`);
    for (const method of ['detect', 'collect']) if (adapter[method] !== undefined && typeof adapter[method] !== 'function') throw new Error(`${adapter.id}.${method} must be a function`);
    if (adapter.validate !== undefined && typeof adapter.validate !== 'function') throw new Error(`${adapter.id}.validate must be a function`);
    this.#items.set(adapter.id, Object.freeze({ priority: 100, optional: true, ...adapter }));
    return this;
  }
  get(id) { return this.#items.get(id) ?? null; }
  list(kind = null) { return [...this.#items.values()].filter((item) => !kind || item.kind === kind).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)); }
  async detect(root, context = {}) {
    const results = [];
    for (const adapter of this.list()) {
      try {
        const raw = adapter.detect ? await adapter.detect(root, context) : true, detection = normalizeDetection(raw);
        results.push({ id: adapter.id, kind: adapter.kind, detected: detection.applicable, details: detection.details });
      } catch (error) { results.push({ id: adapter.id, kind: adapter.kind, detected: false, error: error.message }); }
    }
    return results;
  }
  async run(kind, root, context = {}, { selected = null } = {}) {
    const out = [];
    for (const adapter of this.list(kind)) {
      if (selected?.length && !selected.includes(adapter.id)) continue;
      let detection;
      try { const raw = adapter.detect ? await adapter.detect(root, context) : true; detection = normalizeDetection(raw); }
      catch (error) { out.push({ adapter: adapter.id, status: 'DETECTION_FAILED', errors: [error.message] }); continue; }
      if (!detection.applicable) { out.push({ adapter: adapter.id, status: 'NOT_APPLICABLE', detection: detection.details }); continue; }
      try {
        const value = adapter.collect ? await adapter.collect(root, context) : null;
        const errors = adapter.validate ? await adapter.validate(value, root, context) : [];
        out.push({ adapter: adapter.id, status: errors?.length ? 'FAILED' : 'PASS', value, errors: errors ?? [], detection: detection.details });
      } catch (error) { out.push({ adapter: adapter.id, status: adapter.optional ? 'NOT_AVAILABLE' : 'FAILED', errors: [error.message], detection: detection.details }); }
    }
    return out;
  }
}

export function commandExists(command, { cwd = process.cwd(), pathEnv = process.env.PATH ?? '' } = {}) {
  if (!command || /[\\/]/.test(command)) return fs.existsSync(path.resolve(cwd, command));
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const dir of pathEnv.split(path.delimiter).filter(Boolean)) for (const ext of exts) if (fs.existsSync(path.join(dir, `${command}${ext}`))) return true;
  return false;
}

export function loadAdapterConfig(root, configPath = 'executionkit.adapters.json') {
  const file = resolveProjectPathSafe(root, configPath, 'adapter config path', { file:true });
  if (!fs.existsSync(file)) return { schemaVersion: '1.0.0', adapters: {}, sourcePath: configPath };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${configPath} must be an object`);
  if (parsed.schemaVersion !== '1.0.0') throw new Error(`Unsupported adapter config schema: ${parsed.schemaVersion ?? 'MISSING'}`);
  if (parsed.adapters !== undefined && (!parsed.adapters || typeof parsed.adapters !== 'object' || Array.isArray(parsed.adapters))) throw new Error('adapters must be an object');
  for (const [id, adapter] of Object.entries(parsed.adapters ?? {})) {
    if (!validId(id)) throw new Error(`Invalid configured adapter id: ${id}`);
    if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) throw new Error(`Configured adapter ${id} must be an object`);
    if (adapter.kind !== undefined && !ADAPTER_KINDS.includes(adapter.kind)) throw new Error(`Configured adapter ${id} has invalid kind: ${adapter.kind}`);
  }
  return { schemaVersion: '1.0.0', adapters: parsed.adapters ?? {}, sourcePath: configPath };
}
