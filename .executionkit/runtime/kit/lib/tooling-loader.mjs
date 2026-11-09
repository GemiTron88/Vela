import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolveDerivedPath } from './derived-state.mjs';

function resolver(base) { return createRequire(path.join(base, 'executionkit-loader.cjs')); }
function isolatedToolingRoot(root, { mustExist = false } = {}) {
  const base = resolveDerivedPath(root, '.executionkit/tooling', 'isolated tooling root', { mustExist });
  if (fs.existsSync(base) && !fs.statSync(base).isDirectory()) throw new Error('isolated tooling root must be a directory');
  return base;
}
export function resolveToolingModule(root, specifier) {
  try { return resolver(path.resolve(root)).resolve(specifier); } catch {}
  const isolated = isolatedToolingRoot(root);
  if (!fs.existsSync(isolated)) return null;
  try { return resolver(isolated).resolve(specifier); } catch {}
  return null;
}
export async function importToolingModule(root, specifier) {
  const resolved = resolveToolingModule(root, specifier);
  if (!resolved) throw new Error(`Missing tooling module ${specifier}. Run node bin/setup-tooling.mjs . --apply or install it in the project.`);
  return import(pathToFileURL(resolved).href);
}
export function toolingStatus(root) {
  const required = ['@modelcontextprotocol/server', 'zod'];
  return Object.fromEntries(required.map((name) => [name, resolveToolingModule(root, name) ? 'READY' : 'NOT_AVAILABLE']));
}
export function toolingPackagePath(root) { return path.join(isolatedToolingRoot(root), 'package.json'); }
export function toolingInstalled(root) { return fs.existsSync(toolingPackagePath(root)); }
