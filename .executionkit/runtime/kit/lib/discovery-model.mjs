import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDerivedPath, resolveProjectPathSafe } from './derived-state.mjs';

const IGNORE = new Set(['.git', '.executionkit', 'node_modules', 'vendor', 'build', '.dart_tool', '.idea', '.vscode', 'coverage', 'storage/framework', 'bootstrap/cache']);
const norm = (p) => p.split(path.sep).join('/');
function ignored(rel) { const n = norm(rel); return [...IGNORE].some((part) => n === part || n.startsWith(`${part}/`) || n.endsWith(`/${part}`) || n.includes(`/${part}/`)); }
function stableId(kind, value) { return `${kind}:${crypto.createHash('sha1').update(value).digest('hex').slice(0, 12)}`; }
function walk(root, dir = root, out = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name), rel = path.relative(root, full); if (ignored(rel)) continue; if (entry.isSymbolicLink()) continue; if (entry.isDirectory()) walk(root, full, out); else if (entry.isFile()) out.push({ full, rel: norm(rel) }); } return out; }
function text(file, max = 2_000_000) { try { const st = fs.statSync(file); if (st.size > max) return ''; return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function push(items, kind, pathValue, extra = {}) { const identity = `${pathValue}|${extra.name ?? ''}|${extra.method ?? ''}|${extra.stack ?? ''}`; items.push({ id: stableId(kind, identity), kind, path: pathValue, ...extra }); }

export function resolveDerivedDiscoveryPath(root, rel, label = 'discovery output') {
  const normalized = norm(rel).replace(/^\.\//, '');
  return resolveDerivedPath(root, normalized, label, { createParents:true });
}

export function detectStacks(root) {
  const stacks = [];
  if (fs.existsSync(path.join(root, 'artisan')) && fs.existsSync(path.join(root, 'composer.json'))) stacks.push('laravel');
  if (fs.existsSync(path.join(root, 'pubspec.yaml'))) stacks.push('flutter');
  if (fs.existsSync(path.join(root, 'package.json'))) stacks.push('node');
  const packageText = text(path.join(root, 'package.json')), composerText = text(path.join(root, 'composer.json'));
  if (/livewire\/livewire/i.test(composerText)) stacks.push('livewire');
  if (/tailwindcss/i.test(packageText)) stacks.push('tailwind');
  if (/alpinejs/i.test(packageText)) stacks.push('alpine');
  return [...new Set(stacks)];
}

export function discoverProduct(root) {
  const files = walk(root), items = [], stacks = detectStacks(root);
  for (const file of files) {
    const p = file.rel, body = /\.(php|dart|js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|html)$/i.test(p) ? text(file.full) : '';
    if (/^routes\/.*\.php$/i.test(p)) for (const m of body.matchAll(/Route::(get|post|put|patch|delete|options|match|any)\s*\(\s*['"]([^'"]+)['"]/g)) push(items, 'route', p, { name: m[2], method: m[1].toUpperCase(), stack: 'laravel' });
    if (/^app\/Http\/Controllers\/.*\.php$/i.test(p)) push(items, 'controller', p, { stack: 'laravel' });
    if (/^app\/Models\/.*\.php$/i.test(p)) push(items, 'model', p, { stack: 'laravel' });
    if (/^app\/Policies\/.*\.php$/i.test(p)) push(items, 'policy', p, { stack: 'laravel' });
    if (/^app\/(Jobs|Notifications|Listeners|Events)\/.*\.php$/i.test(p)) push(items, p.split('/')[1].slice(0, -1).toLowerCase(), p, { stack: 'laravel' });
    if (/^app\/Livewire\/.*\.php$/i.test(p)) push(items, 'component', p, { stack: 'livewire' });
    if (/^resources\/views\/.*\.blade\.php$/i.test(p)) push(items, 'view', p, { stack: /\/livewire\//i.test(p) ? 'livewire' : 'blade' });
    if (/^(?:src\/)?(?:app|pages)\/.*\.(?:tsx|jsx|vue|svelte|astro)$/i.test(p)) push(items, 'view', p, { stack: /\.vue$/i.test(p) ? 'vue' : /\.svelte$/i.test(p) ? 'svelte' : /\.astro$/i.test(p) ? 'astro' : 'react' });
    if (/^lib\/.*\.dart$/i.test(p)) {
      if (/(screen|page|view)\.dart$/i.test(p)) push(items, 'screen', p, { stack: 'flutter' });
      if (/(widget|component)\.dart$/i.test(p)) push(items, 'component', p, { stack: 'flutter' });
      for (const m of body.matchAll(/(?:GoRoute\s*\([^)]*path\s*:\s*|['"]route['"]\s*:\s*)['"]([^'"]+)['"]/gms)) push(items, 'route', p, { name: m[1], stack: 'flutter' });
    }
    for (const m of body.matchAll(/customElements\.define\s*\(\s*['"]([^'"]+)['"]/g)) push(items, 'component', p, { name: m[1], stack: 'web-components' });
    if (/(^|\/)(tests?|test|specs?|integration_test)\//i.test(p) || /(?:(?:\.test|\.spec|_test|_spec)\.(?:php|js|mjs|cjs|ts|tsx|dart|py|go|rs|rb)|(?:^|\/)test_[^/]+\.py)$/i.test(p)) push(items, 'test', p);
    if (/^(content|resources\/content|docs\/content|data)\//i.test(p) && /\.(md|mdx|json|ya?ml|csv)$/i.test(p)) push(items, 'content', p);
    if (/^(resources\/views\/components|lib\/.*components?|src\/.*components?)\//i.test(p)) push(items, 'component-source', p);
  }
  const unique = [...new Map(items.map((item) => [`${item.kind}|${item.path}|${item.name ?? ''}|${item.method ?? ''}|${item.stack ?? ''}`, item])).values()];
  return { schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), root: '.', stacks, fileCount: files.length, items: unique, counts: Object.fromEntries([...new Set(unique.map((i) => i.kind))].sort().map((kind) => [kind, unique.filter((i) => i.kind === kind).length])) };
}

export function writeDiscovery(root, inventory, rel = '.executionkit/discovery/product-inventory.json') {
  const file = resolveDerivedDiscoveryPath(root, rel, 'discovery.inventoryPath');
  fs.writeFileSync(file, `${JSON.stringify(inventory, null, 2)}\n`);
  return file;
}

export function writeReconciliation(root, report, rel = '.executionkit/discovery/reconciliation.json') {
  const file = resolveDerivedDiscoveryPath(root, rel, 'discovery.reconciliationPath');
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export function loadDeclaredScope(root, rel = 'executionkit.scope.json') {
  const file = resolveProjectPathSafe(root, rel, 'discovery.scopePath', { file:true });
  if (!fs.existsSync(file)) return { schemaVersion: '1.0.0', required: [], excluded: [] };
  const scope = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (scope.schemaVersion !== '1.0.0' || !Array.isArray(scope.required ?? []) || !Array.isArray(scope.excluded ?? [])) throw new Error(`${rel} must use schemaVersion 1.0.0 with required/excluded arrays`);
  return { schemaVersion: '1.0.0', required: scope.required ?? [], excluded: scope.excluded ?? [] };
}

export function matchesScopeReference(ref, item) {
  if (!ref || typeof ref !== 'object') return false;
  if (ref.id) return ref.id === item.id;
  if (ref.kind && ref.kind !== item.kind) return false;
  if (ref.path && ref.path !== item.path) return false;
  if (ref.name && ref.name !== item.name) return false;
  if (ref.method && String(ref.method).toUpperCase() !== String(item.method ?? '').toUpperCase()) return false;
  return Boolean(ref.kind || ref.path || ref.name || ref.method);
}

export function reconcileCoverage(root, inventory, { todoText = '', scopePath = 'executionkit.scope.json' } = {}) {
  const scope = loadDeclaredScope(root, scopePath), findings = [];
  for (const required of scope.required) {
    // Integration journeys are a declared behavioral denominator validated by integration-model,
    // not source-discoverable inventory items. Do not fabricate DECLARED_NOT_IMPLEMENTED because
    // the static repository scanner cannot emit a "journey" item.
    if (required?.kind === 'journey') continue;
    if (!inventory.items.some((item) => matchesScopeReference(required, item))) findings.push({ code: 'DECLARED_NOT_IMPLEMENTED', severity: 'HIGH', required });
  }
  for (const item of inventory.items) {
    if (scope.excluded.some((ref) => matchesScopeReference(ref, item))) continue;
    const declared = scope.required.some((ref) => matchesScopeReference(ref, item));
    const mapped = todoText.includes(item.path) || (item.name && todoText.includes(item.name));
    if (!declared && !mapped && ['route', 'screen', 'component', 'view', 'content'].includes(item.kind)) findings.push({ code: 'DISCOVERED_UNMAPPED', severity: 'INFO', item });
  }
  const blockingFindings = findings.filter((f) => ['HIGH', 'CRITICAL'].includes(f.severity));
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    inventoryCounts: inventory.counts,
    declaredRequired: scope.required.length,
    declaredExcluded: scope.excluded.length,
    findings,
    blockingFindings,
    releaseReady: blockingFindings.length === 0,
    counts: Object.fromEntries([...new Set(findings.map((f) => f.code))].map((code) => [code, findings.filter((f) => f.code === code).length])),
  };
}
