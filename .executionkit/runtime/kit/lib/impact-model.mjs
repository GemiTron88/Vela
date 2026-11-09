import { spawnSync } from 'node:child_process';
import { discoverProduct } from './discovery-model.mjs';

function gitResult(root, args) { return spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024, windowsHide:true }); }
function outputPaths(value) { return String(value ?? '').split('\0').filter(Boolean); }
function requireGit(result) {
  if(result.error||result.status!==0)throw new Error((result.stderr||result.stdout||result.error?.message||'git diff failed').trim());
  return outputPaths(result.stdout);
}

export function changedFiles(root, base = 'HEAD~1') {
  if(typeof base!=='string'||!base||base.startsWith('-')||/[\r\n\0]/.test(base))throw new Error('Invalid impact base');
  const resolved=gitResult(root,['rev-parse','--verify',base+'^{commit}']);
  let changed;
  if(!resolved.error&&resolved.status===0){
    // Compare the base to current worktree content, including staged edits.
    // A base..HEAD comparison silently loses fixes until they are committed.
    changed=requireGit(gitResult(root,['diff','--name-only','-z',resolved.stdout.trim(),'--']));
  }else if(base==='HEAD~1'){
    requireGit(gitResult(root,['rev-parse','--verify','HEAD^{commit}']));
    changed=requireGit(gitResult(root,['ls-files','-z']));
  }else requireGit(resolved);
  const untracked=requireGit(gitResult(root,['ls-files','--others','--exclude-standard','-z']));
  return [...new Set([...changed,...untracked])];
}

const GENERIC_IMPACT_TOKENS=new Set(['test','tests','spec','specs','unit','feature','integration','src','lib','app','resources','packages','vendor','model','models','controller','controllers','api','php','js','mjs','cjs','ts','tsx','jsx','dart','json','config','service','services','repository','repositories','component','components','widget','widgets','screen','screens','page','pages','view','views','route','routes','handler','handlers','middleware','helper','helpers','util','utils','e2e','index']);
function tokens(rel) {
  // Generic directory/extension tokens make one changed test select an entire test tree.
  const parts=String(rel).replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().split(/[\\/_.\-\s]+/);
  return new Set(parts.filter(v=>v.length>=3&&!GENERIC_IMPACT_TOKENS.has(v)));
}

function executableTestPath(rel){
  return /(?:[._-](?:test|spec)\.[cm]?[jt]sx?|(?:Test|_test)\.php|_test\.dart|\.e2e\.(?:ts|mts)|_test\.go|_(?:spec|test)\.rb|_test\.rs)$/i.test(rel) ||
    /(?:^|\/)test_[^/]+\.py$|_test\.py$/i.test(rel) ||
    /(?:^|\/)(?:tests?|integration_test)\/.+\.(?:php|rs)$/i.test(rel) ||
    /(?:^|\/)__tests__\/.+\.[cm]?[jt]sx?$/i.test(rel);
}
export function analyzeImpact(root, { base = 'HEAD~1' } = {}) {
  const changed = changedFiles(root, base), inventory = discoverProduct(root);
  const tests = inventory.items.filter((i) => i.kind === 'test' && executableTestPath(i.path)), surfaces = inventory.items.filter((i) => i.kind !== 'test');
  const impactedTests = [], impactedSurfaces = [];
  for (const file of changed) {
    const fileTokens = tokens(file);
    // A directly edited executable test is always in scope, even when its
    // basename contains only generic terms or short numeric identifiers.
    for (const test of tests) if (test.path === file || [...tokens(test.path)].some((value) => fileTokens.has(value))) impactedTests.push(test);
    for (const surface of surfaces) if ([...tokens(surface.path)].some((value) => fileTokens.has(value))) impactedSurfaces.push(surface);
  }
  return {
    schemaVersion: '1.0.0',
    base,
    changed,
    impactedTests: [...new Map(impactedTests.map((item) => [item.path, item])).values()],
    impactedSurfaces: [...new Map(impactedSurfaces.map((item) => [`${item.kind}:${item.path}:${item.name ?? ''}`, item])).values()],
  };
}

export function selectTests(root, impact, { boundary = 'phase' } = {}) {
  // The impact analyzer already scanned source once. Task and wave never need
  // an extra full discovery solely to construct a suite they must not execute.
  const all = boundary === 'phase'
    ? discoverProduct(root).items.filter((i) => i.kind === 'test' && executableTestPath(i.path))
    : [];
  const configSensitive = impact.changed.some((changed) => changed.startsWith('composer.') || changed.startsWith('package') || changed.startsWith('pubspec') || changed.startsWith('config/') || changed.includes('/config/'));
  // A dependency/config edit is not evidence that thousands of test files must run at task scope.
  // Keep full coverage at the phase/release boundary, but require explicit targeted evidence now.
  const selected = impact.impactedTests;
  const scopeReviewRequired = configSensitive && selected.length === 0;
  return {
    targeted: [...new Map(selected.map((item) => [item.path, item.path])).values()],
    scopeReviewRequired,
    scopeReason: scopeReviewRequired ? 'CONFIG_CHANGE_NEEDS_TARGETED_TEST_SELECTION' : null,
    phase: all.map((item) => item.path),
    release: all.map((item) => item.path),
  };
}
