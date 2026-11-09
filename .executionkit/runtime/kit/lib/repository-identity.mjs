import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const slash = (value) => String(value).replaceAll('\\', '/');

function opaqueIdentity(raw) {
  return `opaque:${slash(raw).replace(/\/+$/, '')}`;
}

function normalizeHostPath(host, repositoryPath) {
  const normalizedHost = String(host || '').toLowerCase();
  let normalizedPath = slash(repositoryPath || '').replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  if (!normalizedHost || !normalizedPath) return null;
  if (normalizedHost === 'github.com') normalizedPath = normalizedPath.toLowerCase();
  return `${normalizedHost}/${normalizedPath}`;
}

/**
 * Canonical repository identity shared by registration and the v3 Agent runtime.
 * URL schemes are parsed before SCP-style SSH syntax so `https://...` can never
 * be misclassified as an SCP host named `https`.
 */
export function canonicalRepositoryIdentity(remoteValue) {
  const raw = String(remoteValue || '').trim();
  if (!raw) return null;

  if (raw.includes('://')) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'file:') return `local:${slash(path.resolve(fileURLToPath(parsed)))}`;
      const host = `${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ''}`;
      return normalizeHostPath(host, decodeURIComponent(parsed.pathname));
    } catch {
      return opaqueIdentity(raw);
    }
  }

  const windowsDrive = /^[A-Za-z]:[\\/]/.test(raw);
  const scp = !windowsDrive ? raw.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/) : null;
  if (scp) return normalizeHostPath(scp[1], scp[2]);

  return `local:${slash(path.resolve(raw))}`;
}

export function canonicalRepositoryKey(remoteValue) {
  const identity = canonicalRepositoryIdentity(remoteValue);
  return identity ? sha256(identity) : null;
}
