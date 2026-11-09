import {createHash, sign, verify, randomUUID} from 'node:crypto';
export class Fault extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function need(condition, code, status = 400) { if (!condition) throw new Fault(code, status); }
export function fields(value, required, optional = []) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_OBJECT');
  need(required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => [...required, ...optional].includes(k)), 'INVALID_FIELDS');
}
export function slug(v) { need(typeof v === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v), 'INVALID_ID'); return v; }
export function sha(v) { need(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), 'INVALID_SHA256'); return v; }
export function commit(v) { need(typeof v === 'string' && /^[a-f0-9]{40}$/.test(v), 'INVALID_COMMIT'); return v; }
export function integer(v, min = 1, max = 2147483647) { need(Number.isSafeInteger(v) && v >= min && v <= max, 'INVALID_INTEGER'); return v; }
export function channel(v) { need(['internal', 'staging', 'beta', 'stable'].includes(v), 'INVALID_CHANNEL'); return v; }
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const hash = v => createHash('sha256').update(v).digest('hex');
export const uuid = () => randomUUID();
export function envelope(value, key, keyId) {
  const bytes = Buffer.from(canonical(value));
  return {schema: 1, key_id: keyId, payload: bytes.toString('base64'), signature: sign(null, bytes, key).toString('base64')};
}
export function decodeEnvelope(e, key) {
  fields(e, ['schema', 'key_id', 'payload', 'signature']);
  need(e.schema === 1 && typeof e.payload === 'string' && typeof e.signature === 'string', 'INVALID_ENVELOPE');
  const bytes = Buffer.from(e.payload, 'base64');
  need(verify(null, bytes, key, Buffer.from(e.signature, 'base64')), 'INVALID_SIGNATURE', 401);
  return JSON.parse(bytes.toString());
}
