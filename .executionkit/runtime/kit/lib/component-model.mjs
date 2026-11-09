import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { discoverProduct } from './discovery-model.mjs';

const AUDIT_IGNORE_DIRS = new Set(['.git', '.executionkit', '.dart_tool', 'node_modules', 'vendor', 'build', 'dist', 'coverage', '.idea', '.vscode', 'storage', 'bootstrap', 'docs']);
const UI_EXTENSIONS = /\.(blade\.php|html?|jsx?|tsx?|vue|dart)$/i;
const PLACEHOLDER_ASSET = /(?:via\.placeholder\.com|placehold\.co|placeholder\.com|picsum\.photos)/i;
const LOREM = /\blorem ipsum\b/i;
const nonEmptyText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizedPath = (value) => value.split(path.sep).join('/');

function load(root, rel, fallback) {
  const file = resolveProjectPathSafe(root, rel, 'component/design contract', {file:true});
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
function normalizedName(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function componentNameMatches(requiredName, item) {
  const wanted = normalizedName(requiredName);
  if (!wanted) return false;
  if (normalizedName(item.name) === wanted) return true;
  const basename = path.basename(item.path).split('.')[0];
  return normalizedName(basename) === wanted;
}

export function loadComponentContract(root) {
  const contract = load(root, 'executionkit.components.json', { schemaVersion: '1.0.0', components: [] });
  if (contract.schemaVersion !== '1.0.0' || !Array.isArray(contract.components)) throw new Error('executionkit.components.json must use schemaVersion 1.0.0 and components[]');
  return contract;
}

export function validateComponentSystem(root) {
  const contract = loadComponentContract(root);
  const inventory = discoverProduct(root);
  const found = inventory.items.filter((i) => ['component', 'component-source'].includes(i.kind));
  if (!contract.components.length) return { schemaVersion: '1.0.0', componentCount: 0, discoveredComponentFiles: found.length, findings: [], status: 'NOT_CONFIGURED' };

  const findings = [];
  for (const required of contract.components) {
    const matches = found.filter((item) => required.path ? item.path === required.path : required.name && componentNameMatches(required.name, item));
    if (!matches.length) findings.push({ code: 'COMPONENT_MISSING', severity: 'HIGH', component: required.id ?? required.name });
    for (const key of ['variants', 'states', 'platforms', 'accessibility', 'responsive', 'rtl']) if (required[key] == null || (['variants','states','platforms'].includes(key) && (!Array.isArray(required[key]) || required[key].length === 0))) findings.push({ code: 'COMPONENT_CONTRACT_INCOMPLETE', severity: 'REVIEW', component: required.id ?? required.name, field: key });
  }
  return {
    schemaVersion: '1.0.0',
    componentCount: contract.components.length,
    discoveredComponentFiles: found.length,
    findings,
    status: findings.some((f) => f.severity === 'HIGH') ? 'FAIL' : findings.length ? 'REVIEW_REQUIRED' : 'PASS',
  };
}
export const inspectComponentSystem = validateComponentSystem;

export function designDrift(root) {
  const cfg = load(root, 'executionkit.design.json', { schemaVersion: '1.0.0', scanRoots: ['resources', 'src', 'lib'], tokenFiles: [], allowHardcoded: [] });
  if (cfg.schemaVersion !== '1.0.0') throw new Error('executionkit.design.json schemaVersion must be 1.0.0');
  if (!Array.isArray(cfg.tokenFiles) || cfg.tokenFiles.length === 0) return { schemaVersion: '1.0.0', status: 'NOT_CONFIGURED', findings: [], tokenFiles: 0 };

  const findings = [];
  const tokenFileSet = new Set(cfg.tokenFiles.map((t) => normalizedPath(t).replace(/^\.\//, '')));
  const allow = (literal) => cfg.allowHardcoded?.some((value) => literal.includes(value));
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = resolveProjectPathSafe(root, path.relative(root,path.join(dir,entry.name)), 'design scan entry');
      if (entry.isDirectory()) {
        if (['node_modules', 'build', '.dart_tool', 'vendor'].includes(entry.name)) continue;
        walk(file);
      } else if (/\.(css|scss|js|ts|tsx|jsx|php|blade\.php|dart)$/i.test(entry.name)) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (tokenFileSet.has(rel)) continue;
        const text = fs.readFileSync(file, 'utf8');
        for (const match of text.matchAll(/#[0-9a-f]{6,8}\b|rgba?\([^)]*\)|Color\(0x[0-9a-f]{8}\)/gi)) if (!allow(match[0])) findings.push({ code: 'HARDCODED_DESIGN_LITERAL', severity: 'REVIEW', path: rel, literal: match[0] });
      }
    }
  }
  for (const scan of cfg.scanRoots ?? []) walk(resolveProjectPathSafe(root, scan, 'design scan root'));
  for (const token of cfg.tokenFiles) if (!fs.existsSync(resolveProjectPathSafe(root, token, 'design token file', {file:true}))) findings.push({ code: 'TOKEN_FILE_MISSING', severity: 'HIGH', path: token });
  return {
    schemaVersion: '1.0.0',
    status: findings.some((f) => f.severity === 'HIGH') ? 'FAIL' : findings.length ? 'REVIEW_REQUIRED' : 'PASS',
    findings,
    tokenFiles: cfg.tokenFiles.length,
  };
}

function auditWalk(root, dir = root, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = normalizedPath(path.relative(root, full));
    const parts = rel.split('/');
    if (parts.some((part) => AUDIT_IGNORE_DIRS.has(part))) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) auditWalk(root, full, out);
    else if (entry.isFile() && UI_EXTENSIONS.test(rel)) out.push({ full, rel });
  }
  return out;
}

function detectAuditProfile(root) {
  const configFile = resolveProjectPathSafe(root, 'execution.config.json', 'execution config', { file:true });
  let config = {};
  if (fs.existsSync(configFile)) {
    try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); }
    catch (error) { throw new Error(`execution.config.json is invalid JSON: ${error.message}`); }
  }
  const contractPath = config?.quality?.contractPath;
  if (!nonEmptyText(contractPath)) return 'standard';
  const contractFile = resolveProjectPathSafe(root, contractPath, 'quality contract', { file:true });
  if (!fs.existsSync(contractFile)) throw new Error(`Configured quality contract is missing: ${contractPath}`);
  let contract;
  try { contract = JSON.parse(fs.readFileSync(contractFile, 'utf8')); }
  catch (error) { throw new Error(`Configured quality contract is invalid JSON (${contractPath}): ${error.message}`); }
  return contract?.profile === 'premium' ? 'premium' : 'standard';
}

function classifyUiFile(file, body) {
  const p = file.rel;
  if (/\.blade\.php$/i.test(p)) {
    if (/^resources\/views\/components\//i.test(p)) return { platform: 'blade', kind: 'definition' };
    return { platform: 'blade', kind: 'surface' };
  }
  if (/\.dart$/i.test(p) && /^lib\//i.test(p)) {
    if (/(^|\/)(components?|widgets?)\//i.test(p) || /(?:_component|_widget)\.dart$/i.test(p)) return { platform: 'flutter', kind: 'definition' };
    if (/(?:_screen|_page|_view)\.dart$/i.test(p) || /(^|\/)screens?\//i.test(p) || /(^|\/)pages?\//i.test(p)) return { platform: 'flutter', kind: 'surface' };
    return { platform: 'flutter', kind: 'other' };
  }
  if (/\.(?:js|mjs|cjs|ts|tsx|jsx)$/i.test(p) && /customElements\.define\s*\(/.test(body)) return { platform: 'web-components', kind: 'definition' };
  if (/\.(?:html?|js|mjs|cjs|ts|tsx|jsx|vue)$/i.test(p) && /^(?:src|resources|app|public)\//i.test(p)) return { platform: 'web-components', kind: 'surface' };
  return { platform: 'other', kind: 'other' };
}

function countMatches(body, regex) { return [...body.matchAll(regex)].length; }
function rawUiRoles(platform, body) {
  const roles = new Map();
  const add = (role, regex) => { const count = countMatches(body, regex); if (count) roles.set(role, count); };
  if (platform === 'blade' || platform === 'web-components') {
    add('button', /<button\b/gi);
    add('input', /<input\b/gi);
    add('select', /<select\b/gi);
    add('textarea', /<textarea\b/gi);
    add('dialog', /<dialog\b/gi);
  } else if (platform === 'flutter') {
    add('button', /\b(?:ElevatedButton|FilledButton|OutlinedButton|TextButton|IconButton)\s*\(/g);
    add('input', /\b(?:TextField|TextFormField)\s*\(/g);
    add('select', /\b(?:DropdownButton|DropdownMenu)\s*(?:<[^>]+>)?\s*\(/g);
    add('dialog', /\b(?:AlertDialog|SimpleDialog)\s*\(/g);
    add('card', /\bCard\s*\(/g);
  }
  return roles;
}

function inferredUsageTokens(component, platform) {
  const explicit = component?.usage?.[platform];
  if (Array.isArray(explicit) && explicit.every(nonEmptyText)) return explicit;
  const name = component?.name;
  if (!nonEmptyText(name)) return [];
  if (platform === 'flutter') return [`${name}(`];
  if (platform === 'blade') {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_.\s]+/g, '-').toLowerCase();
    return [`<x-${kebab}`, `<livewire:${kebab}`];
  }
  if (platform === 'web-components' && name.includes('-')) return [`<${name}`];
  return [];
}

function platformApplies(component, platform) {
  if (!Array.isArray(component?.platforms) || component.platforms.length === 0) return true;
  const normalized = platform === 'blade' || platform === 'web-components' ? 'web' : platform;
  return component.platforms.some((item) => String(item).toLowerCase() === normalized || String(item).toLowerCase() === platform);
}

function knownCanonicalUsage(platform, body, catalog) {
  let count = 0;
  if (platform === 'blade') count += countMatches(body, /<(?:x-[a-z0-9_.:-]+|livewire:[a-z0-9_.:-]+)/gi);
  if (platform === 'web-components') count += countMatches(body, /<[a-z][a-z0-9]*-[a-z0-9_.:-]+/gi);
  for (const component of catalog.filter((item) => platformApplies(item, platform))) {
    for (const token of inferredUsageTokens(component, platform)) count += body.split(token).length - 1;
  }
  return count;
}

function declaredReplacementGap(platform, body, roles, catalog) {
  const gaps = [];
  for (const [role, count] of roles) {
    const replacements = catalog.filter((component) => platformApplies(component, platform) && Array.isArray(component.replaces) && component.replaces.map((value) => String(value).toLowerCase()).includes(role));
    if (!replacements.length) continue;
    const canonicalReplacementUsage = replacements.reduce((sum, component) => sum + inferredUsageTokens(component, platform).reduce((tokenSum, token) => tokenSum + body.split(token).length - 1, 0), 0);
    gaps.push({ role, count, canonicalReplacementUsage, mixedUsage: canonicalReplacementUsage > 0, components: replacements.map((component) => component.id ?? component.name).filter(Boolean) });
  }
  return gaps;
}

function genericUiSignals(platform, body) {
  const signals = [];
  if (platform === 'blade' || platform === 'web-components') {
    const rounded = countMatches(body, /\brounded-(?:lg|xl|2xl|3xl)\b/g);
    const shadows = countMatches(body, /\bshadow(?:-(?:sm|md|lg|xl|2xl))?\b/g);
    const grids = countMatches(body, /\bgrid(?:-cols-|\s)/g);
    if (rounded >= 3 && shadows >= 2 && grids >= 1) signals.push({ signal: 'repeated-rounded-shadow-grid', evidence: { rounded, shadows, grids } });
    if (/<(?:button|nav|th|label)\b[^>]*>[\s\S]*?(?:🚀|✨|🔥|💡|⚡|🎉|💎|🌟|🤖|🪄)[\s\S]*?<\/(?:button|nav|th|label)>/iu.test(body)) {
      signals.push({ signal: 'emoji-in-ui-chrome', evidence: {} });
    }
    if (/\bfrom-(?:purple|indigo|violet)-\d+\s+(?:via-[a-z]+-\d+\s+)?to-(?:blue|pink|cyan|indigo|purple)-\d+\b/i.test(body)) {
      signals.push({ signal: 'purple-blue-glow-slop', evidence: {} });
    }
    if (/\btransition-all\b|\btransition\s*:\s*all\b/i.test(body)) {
      signals.push({ signal: 'transition-all-layout-slop', evidence: {} });
    }
  }
  if (platform === 'flutter') {
    const cards = countMatches(body, /\bCard\s*\(/g);
    const tiles = countMatches(body, /\bListTile\s*\(/g);
    if (cards >= 3 && tiles >= 3) signals.push({ signal: 'repeated-card-listtile', evidence: { cards, tiles } });
  }
  if (/\b(?:supercharge\s+your|unlock\s+the\s+power\s+of|revolutionize\s+your|ai-powered\s+magic|next-gen\s+ai)\b/i.test(body)) {
    signals.push({ signal: 'ai-hype-copy-slop', evidence: {} });
  }
  if (PLACEHOLDER_ASSET.test(body)) signals.push({ signal: 'placeholder-asset', evidence: {} });
  if (LOREM.test(body)) signals.push({ signal: 'lorem-copy', evidence: {} });
  return signals;
}

export function auditUiConformance(root, { boundary = 'ad-hoc' } = {}) {
  if (!['ad-hoc', 'wave', 'phase', 'release'].includes(boundary)) throw new Error(`Unsupported audit boundary: ${boundary}`);
  const profile = detectAuditProfile(root);
  const catalog = loadComponentContract(root).components;
  const files = auditWalk(root);
  const findings = [];
  const surfaces = [];

  for (const file of files) {
    let body = '';
    try { body = fs.readFileSync(file.full, 'utf8'); } catch { continue; }
    const meta = classifyUiFile(file, body);
    if (meta.kind !== 'surface') continue;
    const roles = rawUiRoles(meta.platform, body);
    const rawPrimitiveCount = [...roles.values()].reduce((sum, value) => sum + value, 0);
    const canonicalUsage = knownCanonicalUsage(meta.platform, body, catalog);
    surfaces.push({ path: file.rel, platform: meta.platform, rawPrimitiveCount, canonicalUsage });

    for (const gap of declaredReplacementGap(meta.platform, body, roles, catalog)) {
      findings.push({
        code: 'COMPONENT_REUSE_BYPASS', severity: 'HIGH', domain: 'ui-components', platform: meta.platform, path: file.rel,
        message: `Raw ${gap.role} primitives bypass declared reusable component replacement`, evidence: gap,
      });
    }
    if (catalog.length > 0 && rawPrimitiveCount >= 4 && canonicalUsage === 0) {
      findings.push({
        code: 'COMPONENT_REUSE_REVIEW', severity: 'REVIEW', domain: 'ui-components', platform: meta.platform, path: file.rel,
        message: 'Surface contains several raw UI primitives but no detected canonical component usage', evidence: { rawPrimitiveCount },
      });
    }
    for (const signal of genericUiSignals(meta.platform, body)) {
      findings.push({
        code: 'AI_GENERIC_UI_SIGNAL', severity: signal.signal === 'placeholder-asset' || signal.signal === 'lorem-copy' ? 'HIGH' : 'REVIEW',
        domain: 'premium-ux', platform: meta.platform, path: file.rel,
        message: `Heuristic signal requires rendered review: ${signal.signal}`, evidence: signal.evidence,
      });
    }
  }

  const uiPlatforms = new Set(surfaces.map((surface) => surface.platform).filter((platform) => platform !== 'other'));
  if (profile === 'premium' && uiPlatforms.size > 0 && catalog.length === 0) {
    findings.unshift({
      code: 'PREMIUM_COMPONENT_CATALOG_MISSING', severity: 'HIGH', domain: 'ui-components', platform: 'cross-platform', path: 'executionkit.components.json',
      message: 'Premium UI is declared but the product component catalog is empty; reuse cannot be audited mechanically', evidence: { platforms: [...uiPlatforms] },
    });
  }
  const blocking = findings.filter((finding) => ['CRITICAL', 'HIGH'].includes(finding.severity));
  const review = findings.filter((finding) => finding.severity === 'REVIEW');
  return {
    schemaVersion: '1.0.0', boundary, profile, componentCatalogSize: catalog.length,
    surfaceCount: surfaces.length, surfaces, findings,
    mechanicalStatus: blocking.length ? 'FAIL' : review.length ? 'REVIEW_REQUIRED' : 'PASS',
    renderedReviewRequired: profile === 'premium' && uiPlatforms.size > 0,
    summary: { blocking: blocking.length, review: review.length, platforms: [...uiPlatforms] },
    limitations: [
      'Heuristics identify review targets; they do not prove that a rendered experience is generic or premium.',
      'A phase/release audit still requires independent rendered evidence for visual hierarchy, interaction quality, states, responsiveness, accessibility and product-specific direction.',
    ],
  };
}
