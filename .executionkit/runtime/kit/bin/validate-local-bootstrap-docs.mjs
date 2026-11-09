#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..'));
const errors = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`required local-bootstrap file missing: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireMarkers(rel, markers) {
  const text = read(rel);
  for (const marker of markers) {
    if (!text.includes(marker)) errors.push(`${rel} missing local-bootstrap marker: ${marker}`);
  }
  return text;
}

const bootstrapDoc = requireMarkers('docs/executionkit/local-antigravity-bootstrap.md', [
  'GitHub-live bootstrap entry',
  'https://github.com/Elwazeery/AI-ExcutionKit.git',
  'refs/heads/main',
  'latest-remote-head',
  'FETCH_HEAD',
  'exact 40-character SHA',
  'detached',
  'distribution/runtime fingerprint',
  'path + file-bytes SHA-256',
  'POSIX mode bits',
  '.executionkit/bootstrap-source.json',
  '.executionkit/installation.json',
  '.executionkit/source/AI-ExecutionKit/<sha>',
  'No shared user-local Kit checkout/cache',
  '.executionkit/runtime/kit',
  '.executionkit/runtime/AI-ExecutionKit',
  'host-surface fingerprint',
  'HOST_VERIFY_PENDING',
  'HOST_VERIFIED',
  'executionkit_host_accept',
  'fresh hook observation',
  'already-running MCP process may accept',
  'Runtime byte drift is also structural drift',
  'Native TODO compatibility',
  'Native Agent OS compatibility',
  'Deep integration acceptance boundary',
]);

for (const stale of [
  'fetch exactly the pinned ExecutionKit commit',
  'Never execute a moving branch head',
  'with repository, exact commit and source fingerprint',
]) {
  if (bootstrapDoc.includes(stale)) errors.push(`canonical local bootstrap still contains stale static-pin wording: ${stale}`);
}

requireMarkers('docs/integrations/antigravity.md', [
  'Preferred live-verification local bootstrap',
  'docs/executionkit/local-antigravity-bootstrap.md',
  'Direct workspace integration — internal/recovery primitive',
  'RUNTIME MANIFEST VERIFIED',
  'HOST SURFACE FINGERPRINTED',
  'HOST_VERIFY_PENDING',
  'executionkit_host_accept',
  'HOST_VERIFIED',
  'fresh live-boundary PreInvocation hook observation',
  'MCP process',
  'already-running MCP process is valid',
  'Runtime byte drift is `STRUCTURAL_DRIFT`',
  'generated Antigravity adapter roles/skills',
  'Custom checklist markers are never guessed',
]);

requireMarkers('lib/installer.mjs', [
  'PROJECT_SOURCE_ROOT',
  'PROJECT_LOCAL_IMMUTABLE_UPSTREAM',
  'approvedProjectLocalSource',
  'runtimeManifestFor',
  'verifyInstalledRuntime',
  'const sourceHash = digest(json(runtimeManifest))',
  'runtimeManifest,managed',
]);
requireMarkers('lib/host-bootstrap.mjs', [
  'verifyInstalledRuntime',
  'hostSurfaceFingerprint',
  'configuredAdapterSurfaces',
  'hostSurfaceHash',
  "state.status !== 'HOST_VERIFY_PENDING'",
  "transport !== 'antigravity-mcp'",
  'sessionStartedAt',
  'verificationRequiredAt',
  'STRUCTURAL_DRIFT',
]);
requireMarkers('bin/bootstrap-host.mjs', [
  'HOST_VERIFY_PENDING',
  'host-bootstrap',
  'PROJECT_SOURCE_ROOT',
  'canonicalBootstrapConfig',
  'verifyOfficialCleanSource',
  'localizeCanonicalProjectSource',
  'PROJECT_LOCALIZED',
  'PROJECT_LOCAL_SOURCE_VERIFIED',
  'upstream snapshots are immutable',
]);
const exporter = requireMarkers('bin/export-bootstrap.mjs', [
  "schemaVersion: 'executionkit-bootstrap/v2'",
  "repository = 'https://github.com/Elwazeery/AI-ExcutionKit.git'",
  "ref = 'refs/heads/main'",
  "updatePolicy = 'latest-remote-head'",
  "['fetch', '--depth=1', 'origin', cfg.ref]",
  "['rev-parse', 'FETCH_HEAD']",
  "['checkout', '--detach', resolvedCommit]",
  "path.join(root, '.executionkit', 'source', 'AI-ExecutionKit')",
  "path.join(projectSourceRoot, resolvedCommit)",
  'PROJECT_LOCAL_IMMUTABLE_UPSTREAM',
  'verifySourceSnapshot(sourceSnapshot, resolvedCommit)',
  "['remote', 'get-url', 'origin']",
  "['status', '--porcelain=v1', '--untracked-files=all']",
  'executionkit-source-resolution/v1',
  'bootstrap-source.json',
  'executionkit.bootstrap.json',
  'executionkit-bootstrap.mjs',
]);
for (const stale of [
  "value('--commit')",
  "'--expected-source'",
  'cfg.commit',
  'cfg.sourceHash',
  'EXECUTIONKIT_CACHE_ROOT',
  'os.homedir()',
]) {
  if (exporter.includes(stale)) errors.push(`bootstrap exporter still contains stale static-pin behavior: ${stale}`);
}
requireMarkers('bin/host-mcp-server.mjs', [
  'executionkit_host_accept',
  'crypto.randomUUID()',
  'startedAt',
  "transport: 'antigravity-mcp'",
  'sessionStartedAt',
]);

let pkg = {};
try {
  pkg = JSON.parse(read('package.json'));
} catch (error) {
  errors.push(`package.json invalid JSON: ${error.message}`);
}

const expectedScripts = {
  'project:bootstrap': 'node bin/bootstrap-host.mjs',
  'project:bootstrap:export': 'node bin/export-bootstrap.mjs',
  'validate:local-bootstrap': 'node bin/validate-local-bootstrap-docs.mjs .',
};
for (const [name, expected] of Object.entries(expectedScripts)) {
  if (pkg.scripts?.[name] !== expected) errors.push(`package.json scripts.${name} must equal ${JSON.stringify(expected)}`);
}
if (!String(pkg.scripts?.check || '').includes('validate:local-bootstrap')) {
  errors.push('canonical npm run check must include validate:local-bootstrap');
}

const noRestartSurfaces = [
  'AGENTS.md',
  'README.md',
  'PLAYBOOK.md',
  'docs/executionkit/local-antigravity-bootstrap.md',
  'docs/integrations/antigravity.md',
  'plugins/antigravity-executionkit/rules/executionkit.md',
  'bin/bootstrap-host.mjs',
  'bin/export-bootstrap.mjs',
  'bin/host-mcp-server.mjs',
  'bin/integrate-antigravity.mjs',
];
const forbiddenHostRestartPatterns = [
  { label: 'RESTART_REQUIRED', pattern: /RESTART_REQUIRED/i },
  { label: 'restart/reopen', pattern: /restart\s*\/\s*reopen/i },
  { label: 'restart-bound', pattern: /restart-bound/i },
  { label: 'post-restart', pattern: /post-restart/i },
  { label: 'restart boundary', pattern: /restart\s+boundary/i },
  { label: 'restart Antigravity', pattern: /restart(?:ing)?\s+Antigravity/i },
  { label: 'reopen Antigravity', pattern: /reopen(?:ing)?\s+Antigravity/i },
];
for (const rel of noRestartSurfaces) {
  const text = read(rel);
  for (const { label, pattern } of forbiddenHostRestartPatterns) {
    if (pattern.test(text)) errors.push(`${rel} violates no-restart Antigravity invariant: ${label}`);
  }
}

const forbiddenRoot = ['os', 'ti', 'trade'].join('');
const forbiddenPosix = [forbiddenRoot, 'kit'].join('/').toLowerCase();
const forbiddenWindows = [forbiddenRoot, 'kit'].join('\\').toLowerCase();
const ignored = new Set(['.git', 'node_modules', 'vendor', '.dart_tool', '.venv', 'build', 'dist', 'target']);
const binary = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.7z','.tar','.mp3','.wav','.mp4','.mov','.woff','.woff2','.ttf','.otf','.dll','.exe','.dylib','.so','.a','.lib','.bin','.model','.onnx','.gguf']);
const forbiddenMatches = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(abs); continue; }
    if (!entry.isFile() || binary.has(path.extname(entry.name).toLowerCase())) continue;
    let data; try { data = fs.readFileSync(abs); } catch { continue; }
    if (data.includes(0)) continue;
    const text = data.toString('utf8').toLowerCase();
    if (text.includes(forbiddenPosix) || text.includes(forbiddenWindows)) forbiddenMatches.push(path.relative(root, abs).replaceAll('\\', '/'));
  }
}
walk(root);
if (forbiddenMatches.length) errors.push(`retired local sibling source path found in: ${forbiddenMatches.join(', ')}`);

console.log(JSON.stringify({
  schemaVersion: 'executionkit-local-bootstrap-docs/v2',
  status: errors.length ? 'FAIL' : 'PASS',
  sourcePolicy: {
    repository: 'https://github.com/Elwazeery/AI-ExcutionKit.git',
    ref: 'refs/heads/main',
    updatePolicy: 'latest-remote-head',
    executionIdentity: 'resolved detached SHA + runtime source fingerprint',
    sourcePlacement: '.executionkit/source/AI-ExecutionKit/<sha>',
    sharedLocalCache: false,
    localSourceOverrides: false,
  },
  invariants: [
    'OFFICIAL_GITHUB_MAIN_FETCHED',
    'EXACT_SHA_RESOLVED',
    'DETACHED_CLEAN_SOURCE',
    'PROJECT_LOCAL_SOURCE_SNAPSHOT',
    'NO_SHARED_LOCAL_KIT_SOURCE',
    'UPSTREAM_SNAPSHOT_IMMUTABLE',
    'RUNTIME_MANIFEST_VERIFIED',
    'EIGHT_SYSTEM_DEEP_INTEGRATION',
    'HOST_SURFACE_FINGERPRINTED',
    'NO_RESTART_HOST_LIFECYCLE',
    'LIVE_VERIFICATION_REQUIRED_WHEN_CHANGED',
    'FRESH_BOUNDARY_HOOK_OBSERVATION',
    'CURRENT_MCP_SESSION',
    'MCP_HOST_ACCEPTANCE',
    'HOST_VERIFIED',
    'INTEGRATION_GATE_BEFORE_PRODUCT',
  ],
  forbiddenMatches,
  errors,
}, null, 2));
process.exit(errors.length ? 1 : 0);
