import {execFileSync} from 'node:child_process';
import {need, commit, hash, canonical} from './contracts.mjs';
const ranks = ['DART_PATCH_ELIGIBLE', 'MANUAL_REVIEW_REQUIRED', 'ASSET_RELEASE_REQUIRED', 'NATIVE_RELEASE_REQUIRED', 'TOOLCHAIN_RELEASE_REQUIRED', 'INCOMPATIBLE_CHANGE'];
export function classify(input) {
  const reasons = [], categories = new Set();
  const add = (category, detail, path = null) => { categories.add(category); reasons.push({category, detail, path}); };
  if (!input.baseline?.verified || !input.target?.verified) add('MANUAL_REVIEW_REQUIRED', 'Verified release and target compatibility snapshots are required');
  if (input.baseline?.package_id !== input.target?.package_id || input.baseline?.signing_sha256 !== input.target?.signing_sha256) add('INCOMPATIBLE_CHANGE', 'Package or signing identity changed');
  if (input.baseline?.flutter_version !== input.target?.flutter_version || input.baseline?.engine_revision !== input.target?.engine_revision) add('TOOLCHAIN_RELEASE_REQUIRED', 'Flutter/engine baseline differs');
  if (input.baseline?.plugin_digest !== input.target?.plugin_digest) add('NATIVE_RELEASE_REQUIRED', 'Resolved native plugin graph differs');
  if (!input.baseline?.plugin_digest || !input.baseline?.engine_revision || !input.baseline?.signing_sha256) add('MANUAL_REVIEW_REQUIRED', 'Baseline plugin, engine or signing evidence missing');
  for (const f of input.changes) {
    const path = f.path;
    if (/AndroidManifest\.xml$/.test(path)) {
      const permissions = s => [...String(s ?? '').matchAll(/<uses-permission\b[^>]*android:name\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
      const before = permissions(f.before), added = permissions(f.after).filter(p => !before.includes(p));
      add('NATIVE_RELEASE_REQUIRED', added.length ? `New permissions: ${added.join(', ')}` : 'Android manifest changed', path);
    } else if (/\.(gradle|gradle\.kts)$|gradle-wrapper\.properties$|ndk|CMakeLists|\.xcconfig$/.test(path)) add('TOOLCHAIN_RELEASE_REQUIRED', 'Native build toolchain/configuration changed', path);
    else if (/^(android|ios|macos|windows|linux)\/|\.(java|kt|cpp|c|h|so|dylib|dll|swift|m|mm)$/.test(path)) add('NATIVE_RELEASE_REQUIRED', 'Native source or binary changed', path);
    else if (/^(assets|fonts)\/|\.(png|jpg|jpeg|webp|svg|ttf|otf|json|arb|mp3|mp4)$/.test(path) && !/^test\//.test(path)) add('ASSET_RELEASE_REQUIRED', 'Bundled content changed', path);
    else if (path === 'pubspec.yaml') {
      const bundled = s => String(s ?? '').match(/(?:^|\n)flutter:\s*\n([\s\S]*)$/)?.[1] ?? '';
      add(bundled(f.before) !== bundled(f.after) ? 'ASSET_RELEASE_REQUIRED' : 'MANUAL_REVIEW_REQUIRED', 'Dependency, SDK, version or bundling declarations changed', path);
    } else if (/pubspec\.lock|\.flutter-plugins|shorebird\.yaml|\.metadata|\.fvm|release\.json|dart_defines/.test(path)) add('MANUAL_REVIEW_REQUIRED', 'Resolved dependencies or release configuration changed; inspect generated plugin graph', path);
    else if (/^lib\/.*\.dart$/.test(path)) { /* Candidate only: Shorebird still has final authority. */ }
    else if (/^(test|integration_test|docs)\/|^README\.md$/.test(path)) { /* Non-distributed changes do not bypass quality gates. */ }
    else add('MANUAL_REVIEW_REQUIRED', 'Unclassified source/configuration change', path);
  }
  if (categories.size === 0) add('DART_PATCH_ELIGIBLE', 'Candidate Dart-only change with matching verified compatibility snapshot');
  const classification = [...categories].sort((a,b) => ranks.indexOf(b) - ranks.indexOf(a))[0];
  const report = {schema: 1, classification, categories: [...categories], reasons, source_commit: input.commit, base_commit: input.base_commit, final_authority: 'shorebird patch android --dry-run (no diff override flags)', compatible: classification === 'DART_PATCH_ELIGIBLE'};
  return {...report, report_sha256: hash(canonical(report))};
}
export function classifyGit(repository, flutterPath, base, target, baseline, targetSnapshot) {
  commit(base); commit(target); need(!flutterPath.includes('..') && !flutterPath.startsWith('/'), 'INVALID_FLUTTER_PATH');
  const git = args => execFileSync('git', ['-C', repository, ...args], {encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024});
  need(git(['rev-parse', `${base}^{commit}`]).trim() === base && git(['rev-parse', `${target}^{commit}`]).trim() === target, 'COMMIT_NOT_FOUND');
  const prefix = flutterPath === '.' ? '' : `${flutterPath}/`;
  const names = git(['diff', '--name-only', '-z', base, target, '--', flutterPath]).split('\0').filter(Boolean);
  const read = (ref, path) => { try { return git(['show', `${ref}:${path}`]); } catch { return null; } };
  return classify({base_commit: base, commit: target, baseline, target: targetSnapshot, changes: names.map(path => ({path: path.slice(prefix.length), before: read(base, path), after: read(target, path)}))});
}
