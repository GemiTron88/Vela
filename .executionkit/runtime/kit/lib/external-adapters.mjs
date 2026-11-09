import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandExists, loadAdapterConfig } from './adapter-registry.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { resolveToolingModule } from './tooling-loader.mjs';
import { loadConfig } from './execution-model.mjs';

export function localBin(root, name) {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const projectBin = path.join(root, 'node_modules', '.bin', `${name}${ext}`);
  if (fs.existsSync(projectBin)) return projectBin;
  const isolatedBinDir = resolveDerivedPath(root, '.executionkit/tooling/node_modules/.bin', 'isolated tooling binary directory');
  if (!fs.existsSync(isolatedBinDir)) return null;
  if (!fs.statSync(isolatedBinDir).isDirectory()) throw new Error('isolated tooling binary directory must be a directory');
  const isolatedBin = path.join(isolatedBinDir, `${name}${ext}`);
  return fs.existsSync(isolatedBin) ? isolatedBin : null;
}

export function runCommand(root, command, args = [], { env = {}, timeoutMs = 900000, shell = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, shell, env: { ...process.env, ...env } });
  return { command: [command, ...args].join(' '), exitCode: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message ?? null, ok: !result.error && result.status === 0 };
}

export function configuredAdapter(root, id) {
  const { config } = loadConfig(root);
  return loadAdapterConfig(root, config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json').adapters?.[id] ?? {};
}
export function jsonFile(root, rel, fallback = null) { const full = path.join(root, rel); if (!fs.existsSync(full)) return fallback; return JSON.parse(fs.readFileSync(full, 'utf8')); }
export function packageHas(root, name) { const pkg = jsonFile(root, 'package.json', {}); const declared = Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name] || pkg?.optionalDependencies?.[name]); return declared || Boolean(resolveToolingModule(root, name)); }
export function composerHas(root, name) { const pkg = jsonFile(root, 'composer.json', {}); return Boolean(pkg?.require?.[name] || pkg?.['require-dev']?.[name]); }
export function executable(command, root = process.cwd()) { return commandExists(command, { cwd: root }); }
export function writeRaw(root, name, value) {
  if (typeof name !== 'string' || path.basename(name) !== name || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`Invalid raw evidence filename: ${name ?? 'MISSING'}`);
  const file = resolveDerivedPath(root, `.executionkit/evidence/raw/${name}`, 'raw evidence path', { createParents:true });
  fs.writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
}
