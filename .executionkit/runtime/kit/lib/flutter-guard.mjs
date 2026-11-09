import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';

const FLUTTER_ROOT_CANDIDATES = ['.', 'mobile', 'flutter_app', 'app', 'apps/mobile', 'packages/mobile'];
const TEST_FILE_RE = /(?:^|\/)(?:test|integration_test)\/|_test\.dart$/i;
const THEME_FILE_RE = /(?:^|\/)(?:theme|tokens?|colors?|palette|typography|text_theme|app_theme|design_system)[A-Za-z0-9_.-]*\.dart$/i;

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function relPath(root, file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

export function discoverFlutterRoots(root) {
  root = path.resolve(root);
  const found = [];
  const seen = new Set();
  const candidates = [...FLUTTER_ROOT_CANDIDATES];
  for (const parent of ['apps', 'packages']) {
    const parentDir = path.join(root, parent);
    if (!fs.existsSync(parentDir)) continue;
    try {
      for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          candidates.push(path.posix.join(parent, entry.name));
        }
      }
    } catch {
      // ignore
    }
  }
  for (const candidate of candidates) {
    const rel = candidate === '.' ? '' : candidate;
    if (seen.has(rel)) continue;
    const dir = path.join(root, candidate);
    const pubspec = path.join(dir, 'pubspec.yaml');
    if (fs.existsSync(pubspec)) {
      const content = safeRead(pubspec) ?? '';
      if (/^\s*flutter\s*:/m.test(content) || /\bsdk\s*:\s*flutter\b/.test(content)) {
        seen.add(rel);
        found.push({ rel, dir, pubspec, pubspecContent: content });
      }
    }
  }
  return found;
}

export function parsePubspecAssets(pubspecContent) {
  const lines = String(pubspecContent ?? '').split(/\r?\n/);
  const assets = [];
  let inFlutter = false;
  let inAssets = false;
  let flutterIndent = -1;
  let assetsIndent = -1;

  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/#.*$/, '').trimEnd();
    if (!trimmed.trim()) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    if (/^\s*flutter\s*:\s*$/.test(trimmed)) {
      inFlutter = true;
      flutterIndent = indent;
      inAssets = false;
      continue;
    }
    if (inFlutter && indent <= flutterIndent && !/^\s*flutter\s*:/.test(trimmed)) {
      inFlutter = false;
      inAssets = false;
    }
    if (inFlutter && /^\s*assets\s*:\s*$/.test(trimmed)) {
      inAssets = true;
      assetsIndent = indent;
      continue;
    }
    if (inAssets) {
      if (indent <= assetsIndent && !/^\s*-\s+/.test(trimmed)) {
        inAssets = false;
        continue;
      }
      const m = trimmed.match(/^\s*-\s+(['"]?)([^'"]+)\1\s*$/);
      if (m) assets.push(m[2].trim());
    }
  }
  return assets;
}

function isAssetDeclaredInPubspec(assetRef, declaredAssets) {
  const clean = String(assetRef ?? '').replace(/^\.\//, '');
  for (const entry of declaredAssets) {
    const norm = entry.replace(/^\.\//, '');
    if (norm === clean) return true;
    if (norm.endsWith('/') && clean.startsWith(norm)) return true;
    if (!norm.includes('.') && clean.startsWith(norm.replace(/\/$/, '') + '/')) return true;
  }
  return false;
}

function extractDartMethodBody(source, methodPattern) {
  const match = methodPattern.exec(source);
  if (!match) return null;
  const open = source.indexOf('{', match.index);
  if (open < 0) return null;
  let depth = 0;
  let quote = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
}

export function inspectArbCatalog(flutterDir, root) {
  const findings = [];
  for (const relL10n of ['lib/l10n', 'l10n', 'assets/l10n']) {
    const dir = path.join(flutterDir, relL10n);
    if (!fs.existsSync(dir)) continue;
    let arbFiles = [];
    try {
      arbFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.arb')).sort();
    } catch {
      continue;
    }
    if (arbFiles.length < 2) continue;

    const catalogs = new Map();
    for (const file of arbFiles) {
      const full = path.join(dir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
        const keys = new Map();
        for (const [k, v] of Object.entries(parsed)) {
          if (k.startsWith('@')) continue;
          const placeholders = [...String(v ?? '').matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
          keys.set(k, { value: String(v ?? ''), placeholders });
        }
        catalogs.set(file, { full, rel: relPath(root, full), keys });
      } catch {
        // ignore invalid json here
      }
    }
    const baseName = arbFiles.find((f) => /_en\.arb$/i.test(f)) ?? arbFiles[0];
    const base = catalogs.get(baseName);
    if (!base) continue;

    for (const [fileName, cat] of catalogs.entries()) {
      if (fileName === baseName) continue;
      for (const [key, baseEntry] of base.keys.entries()) {
        if (!cat.keys.has(key)) {
          findings.push({
            code: 'FLUTTER_ARB_KEY_MISSING',
            severity: 'BLOCKER',
            file: cat.rel,
            key,
            baseLocale: baseName,
            message: 'ARB localization file ' + cat.rel + ' is missing translation key "' + key + '" present in ' + baseName + '.'
          });
        } else {
          const targetEntry = cat.keys.get(key);
          for (const ph of baseEntry.placeholders) {
            if (!targetEntry.placeholders.includes(ph)) {
              findings.push({
                code: 'FLUTTER_ARB_PLACEHOLDER_MISMATCH',
                severity: 'BLOCKER',
                file: cat.rel,
                key,
                placeholder: ph,
                message: 'ARB translation "' + key + '" in ' + cat.rel + ' is missing placeholder {' + ph + '} required by ' + baseName + '.'
              });
            }
          }
        }
      }
    }
  }
  return findings;
}

export function flutterFindings(file, text, context = {}) {
  const normalizedFile = String(file ?? '').replaceAll('\\', '/');
  if (TEST_FILE_RE.test(normalizedFile)) return [];
  const source = String(text ?? '');
  if (!source.trim()) return [];
  const findings = [];

  // Platform manifests & scripts
  if (/AndroidManifest\.xml$/i.test(normalizedFile)) {
    if (/usesCleartextTraffic\s*=\s*["']true["']/i.test(source)) {
      findings.push({
        code: 'FLUTTER_CLEARTEXT_HTTP_FORBIDDEN',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'AndroidManifest.xml enables android:usesCleartextTraffic="true" in production manifest.'
      });
    }
    return findings;
  }
  if (/Info\.plist$/i.test(normalizedFile)) {
    if (/<key>\s*NSAllowsArbitraryLoads\s*<\/key>\s*<true\s*\/>/i.test(source)) {
      findings.push({
        code: 'FLUTTER_CLEARTEXT_HTTP_FORBIDDEN',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'Info.plist enables NSAllowsArbitraryLoads=<true/> allowing insecure cleartext HTTP.'
      });
    }
    return findings;
  }
  if (/\.(?:sh|bash|zsh|yml|yaml|json)$/i.test(normalizedFile) || /(?:^|\/)Makefile$/i.test(normalizedFile)) {
    if (!/(?:^|\/)(?:tests?|docs|contracts|rules|skills)\//i.test(normalizedFile)) {
      const forbiddenCmd = source.match(/\b(?:flutter\s+build\s+(?:apk|appbundle|ipa)|gradlew\s+assemble\w*|flutter\s+emulators\s+--launch)\b/);
      if (forbiddenCmd && !/workstation|NEVER|forbidden|prohibited/i.test(source)) {
        findings.push({
          code: 'FLUTTER_VPS_MOBILE_BUILD_FORBIDDEN',
          severity: 'BLOCKER',
          file: normalizedFile,
          command: forbiddenCmd[0],
          message: 'Headless VPS boundary violation: mobile binary build or emulator launch command (' + forbiddenCmd[0] + ') is forbidden on VPS hosts.'
        });
      }
    }
    return findings;
  }

  if (!normalizedFile.endsWith('.dart')) return findings;

  const isThemeFile = THEME_FILE_RE.test(normalizedFile);
  const isStateClass = /\bextends\s+State\s*</.test(source) || /\bConsumerState\s*</.test(source);

  // 1. StatefulWidget Lifecycle & Memory Leaks
  if (isStateClass) {
    const controllerMatches = [...source.matchAll(/\b(?:final|late(?:\s+final)?)\s+(?:(?:TextEditingController|AnimationController|ScrollController|PageController|TabController|FocusNode)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:TextEditingController|AnimationController|ScrollController|PageController|TabController|FocusNode)\s*\(/g)];
    const typedFieldMatches = [...source.matchAll(/\b(?:late\s+(?:final\s+)?|final\s+)(?:TextEditingController|AnimationController|ScrollController|PageController|TabController|FocusNode)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)];
    const controllers = [...new Set([...controllerMatches.map((m) => m[1]), ...typedFieldMatches.map((m) => m[1])])];
    const disposeBody = extractDartMethodBody(source, /\bvoid\s+dispose\s*\(\s*\)/) ?? '';
    for (const ctrl of controllers) {
      const disposeRe = new RegExp('\\b' + ctrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\??\\.dispose\\s*\\(');
      if (!disposeRe.test(disposeBody) && !disposeRe.test(source)) {
        findings.push({
          code: 'FLUTTER_DISPOSE_MISSING',
          severity: 'BLOCKER',
          file: normalizedFile,
          controller: ctrl,
          message: 'Controller/FocusNode "' + ctrl + '" is instantiated in State without calling ' + ctrl + '.dispose() in dispose().'
        });
      }
    }
  }

  const subMatches = [...source.matchAll(/\b(?:StreamSubscription(?:\s*<[^>]+>)?|Timer)\??\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)];
  if (subMatches.length) {
    const cleanupBody = (extractDartMethodBody(source, /\b(?:Future<void>|void)\s+(?:dispose|close)\s*\(\s*\)/) ?? '');
    for (const m of subMatches) {
      const field = m[1];
      if (['subscription', 'timer'].includes(field) && /\([^)]*\bStreamSubscription|\([^)]*\bTimer/.test(m[0])) continue;
      const cancelRe = new RegExp('\\b' + field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\??\\.cancel\\s*\\(');
      if (!cancelRe.test(cleanupBody) && !cancelRe.test(source)) {
        findings.push({
          code: 'FLUTTER_SUBSCRIPTION_CANCEL_MISSING',
          severity: 'BLOCKER',
          file: normalizedFile,
          subscription: field,
          message: 'StreamSubscription/Timer "' + field + '" is declared without calling ' + field + '.cancel() in dispose()/close().'
        });
      }
    }
  }

  // Async BuildContext across await gap
  for (const methodMatch of source.matchAll(/\b(?:Future\s*(?:<[^>]+>)?|void)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*async\s*\{/g)) {
    const body = extractDartMethodBody(source.slice(methodMatch.index), /\basync\s*\{/);
    if (!body) continue;
    const awaitIdx = body.search(/\bawait\s+/);
    if (awaitIdx < 0) continue;
    const afterAwait = body.slice(awaitIdx);
    const contextUse = afterAwait.match(/\b(?:Navigator\.of\s*\(\s*context|ScaffoldMessenger\.of\s*\(\s*context|Theme\.of\s*\(\s*context|MediaQuery\.of\s*\(\s*context|showDialog\s*\([^)]*\bcontext\s*:|showModalBottomSheet\s*\([^)]*\bcontext\s*:|context\.(?:go|push|pop|read|watch)\s*\()/);
    if (contextUse) {
      const between = afterAwait.slice(0, contextUse.index);
      if (!/\bmounted\b/.test(between)) {
        findings.push({
          code: 'FLUTTER_ASYNC_CONTEXT_UNMOUNTED',
          severity: 'BLOCKER',
          file: normalizedFile,
          method: methodMatch[1],
          message: 'BuildContext is used after an await gap in "' + methodMatch[1] + '()" without checking `if (!mounted)` / `if (!context.mounted)`.'
        });
      }
    }
  }

  // 2. RenderBox & Viewport Crash Prevention
  for (const flexMatch of source.matchAll(/\b(?:Column|Row)\s*\(\s*(?:[^()]*|\([^()]*\))*?\bchildren\s*:\s*(?:<[^>]+>\s*)?\[([\s\S]{1,2500}?)\]/g)) {
    const childrenBlock = flexMatch[1];
    const scrollMatch = childrenBlock.match(/\b(ListView|GridView|PageView|CustomScrollView)(?:\.[A-Za-z]+)?\s*\(([\s\S]{0,600}?)\)/);
    if (scrollMatch) {
      const beforeScroll = childrenBlock.slice(0, scrollMatch.index);
      const scrollArgs = scrollMatch[2] ?? '';
      let isWrapped = false;
      for (const wm of beforeScroll.matchAll(/\b(?:Expanded|Flexible|SizedBox|ConstrainedBox)\s*\(/g)) {
        let depth = 0;
        for (let i = wm.index + wm[0].length - 1; i < beforeScroll.length; i++) {
          if (beforeScroll[i] === '(') depth++;
          else if (beforeScroll[i] === ')') {
            depth--;
            if (depth <= 0) break;
          }
        }
        if (depth > 0) {
          isWrapped = true;
          break;
        }
      }
      const hasShrinkWrap = /\bshrinkWrap\s*:\s*true\b/.test(scrollArgs);
      if (!isWrapped && !hasShrinkWrap) {
        findings.push({
          code: 'FLUTTER_UNBOUNDED_VIEWPORT_CRASH',
          severity: 'BLOCKER',
          file: normalizedFile,
          widget: scrollMatch[1],
          message: scrollMatch[1] + ' inside Column/Row without Expanded/Flexible or shrinkWrap: true causes unbounded viewport RenderBox crash.'
        });
      }
    }
  }

  for (const scrollMatch of source.matchAll(/\bSingleChildScrollView\s*\([\s\S]{1,1200}?\bchild\s*:\s*Column\s*\([\s\S]{1,1500}?\bchildren\s*:\s*(?:<[^>]+>\s*)?\[([\s\S]{1,2000}?)\]/g)) {
    const childrenBlock = scrollMatch[1];
    if (/\b(?:Expanded|Flexible)\s*\(/.test(childrenBlock)) {
      findings.push({
        code: 'FLUTTER_FLEX_IN_UNBOUNDED_SCROLL',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'Expanded/Flexible inside SingleChildScrollView -> Column causes RenderFlex unbounded height crash.'
      });
    }
  }

  // 3. RTL / BiDi, Theme & Form Integrity
  const directionalMatch = source.match(/\bEdgeInsets\.(?:only\s*\([^)]*\b(?:left|right)\s*:|fromLTRB\s*\()|\bAlignment\.(?:centerLeft|centerRight|topLeft|topRight|bottomLeft|bottomRight)\b|\bPositioned\s*\([^)]*\b(?:left|right)\s*:/);
  if (directionalMatch) {
    findings.push({
      code: 'FLUTTER_DIRECTIONAL_INSETS_REQUIRED',
      severity: 'HIGH',
      file: normalizedFile,
      usage: directionalMatch[0],
      message: 'Non-directional layout (' + directionalMatch[0].trim() + ') breaks Arabic/RTL layout mirroring; use EdgeInsetsDirectional, AlignmentDirectional, or PositionedDirectional.'
    });
  }

  const buildBodies = [];
  for (const bm of source.matchAll(/\bWidget\s+build\s*\(\s*BuildContext\b[^)]*\)/g)) {
    const b = extractDartMethodBody(source.slice(bm.index), /\bWidget\s+build\s*\(\s*BuildContext\b[^)]*\)/);
    if (b) buildBodies.push(b);
  }
  const buildBody = buildBodies.join('\n');
  if (buildBody && !isThemeFile) {
    const rawColor = buildBody.match(/\bColor\s*\(\s*0x[0-9a-fA-F]{8}\s*\)|\bColors\.(?!transparent\b)[A-Za-z0-9_]+/);
    if (rawColor) {
      findings.push({
        code: 'FLUTTER_HARDCODED_COLOR',
        severity: 'HIGH',
        file: normalizedFile,
        color: rawColor[0],
        message: 'Hardcoded color (' + rawColor[0] + ') inside Widget.build() bypasses Theme.of(context).colorScheme.'
      });
    }
    const rawTextStyle = buildBody.match(/\bTextStyle\s*\([^)]*\bfontSize\s*:/);
    if (rawTextStyle) {
      findings.push({
        code: 'FLUTTER_HARDCODED_TEXT_STYLE',
        severity: 'HIGH',
        file: normalizedFile,
        message: 'Hardcoded TextStyle(fontSize: ...) inside Widget.build() bypasses Theme.of(context).textTheme.'
      });
    }
  }

  for (const appMatch of source.matchAll(/\b(?:MaterialApp|CupertinoApp)(?:\.router)?\s*\(([\s\S]{1,2000}?)\)/g)) {
    const args = appMatch[1];
    if (/\btheme\s*:/.test(args) && !/\bdarkTheme\s*:/.test(args) && !/\bthemeMode\s*:\s*ThemeMode\.dark\b/.test(args)) {
      findings.push({
        code: 'FLUTTER_DARK_MODE_INCOMPLETE',
        severity: 'HIGH',
        file: normalizedFile,
        message: 'MaterialApp/CupertinoApp defines theme: without darkTheme: support.'
      });
    }
  }

  if (/\bForm\s*\(/.test(source) && /\bTextFormField\s*\(/.test(source)) {
    if (!/\bGlobalKey\s*<\s*FormState\s*>|\bkey\s*:\s*_[A-Za-z0-9_]*formKey/i.test(source) || !/\bvalidator\s*:/.test(source)) {
      findings.push({
        code: 'FLUTTER_FORM_KEY_MISSING',
        severity: 'HIGH',
        file: normalizedFile,
        message: 'Form with TextFormField is missing GlobalKey<FormState> binding or field validator.'
      });
    }
  }

  // 4. Pubspec Asset & Route Integrity
  for (const assetCall of source.matchAll(/\b(?:Image\.asset|SvgPicture\.asset|Lottie\.asset|rootBundle\.load(?:String)?)\s*\(\s*['"]([^'"$]+)['"]/g)) {
    const assetPath = assetCall[1];
    const flutterRoot = context.flutterRoot ?? context.root;
    if (flutterRoot) {
      const fullAsset = path.join(flutterRoot, assetPath);
      const existsOnDisk = fs.existsSync(fullAsset);
      const declared = Array.isArray(context.declaredAssets)
        ? isAssetDeclaredInPubspec(assetPath, context.declaredAssets)
        : true;
      if (!existsOnDisk || !declared) {
        findings.push({
          code: 'FLUTTER_ASSET_NOT_IN_PUBSPEC',
          severity: 'BLOCKER',
          file: normalizedFile,
          asset: assetPath,
          existsOnDisk,
          declaredInPubspec: declared,
          message: 'Flutter asset "' + assetPath + '" is missing on disk or not declared under flutter.assets in pubspec.yaml.'
        });
      }
    }
  }

  if (context.declaredRoutes && context.declaredRoutes.size > 0) {
    for (const navMatch of source.matchAll(/\b(?:Navigator(?:\.of\s*\([^)]*\))?\.push(?:Replacement)?Named\s*\([^,]+,\s*['"]([^'"]+)['"]|context\.(?:go|push)\s*\(\s*['"]([^'"]+)['"])/g)) {
      const targetRoute = (navMatch[1] ?? navMatch[2] ?? '').split('?')[0];
      if (targetRoute.startsWith('/') && !context.declaredRoutes.has(targetRoute)) {
        findings.push({
          code: 'FLUTTER_NAMED_ROUTE_UNRESOLVED',
          severity: 'BLOCKER',
          file: normalizedFile,
          route: targetRoute,
          message: 'Navigation target route "' + targetRoute + '" is not registered in the Flutter route catalog.'
        });
      }
    }
  }

  // 5. Architecture & Security
  if (buildBody || isStateClass) {
    const initBody = extractDartMethodBody(source, /\bvoid\s+initState\s*\(\s*\)/) ?? '';
    const combinedLifecycle = (buildBody ?? '') + '\n' + initBody;
    const directNet = combinedLifecycle.match(/\b(?:http\.(?:get|post|put|delete|patch)|Dio\s*\(\s*\)\.(?:get|post|put|delete)|FirebaseFirestore\.instance|Supabase\.instance\.client)\b/);
    if (directNet) {
      findings.push({
        code: 'FLUTTER_NETWORK_CALL_IN_LIFECYCLE',
        severity: 'HIGH',
        file: normalizedFile,
        call: directNet[0],
        message: 'Direct network/database call (' + directNet[0] + ') inside Widget build()/initState(); delegate to a repository, controller, Cubit, or Notifier.'
      });
    }
  }

  for (const httpMatch of source.matchAll(/['"](http:\/\/(?!localhost\b|127\.0\.0\.1\b|10\.0\.2\.2\b|schemas\.android\.com\b|www\.w3\.org\b|ns\.adobe\.com\b)[^'"]+)['"]/g)) {
    findings.push({
      code: 'FLUTTER_CLEARTEXT_HTTP_FORBIDDEN',
      severity: 'BLOCKER',
      file: normalizedFile,
      url: httpMatch[1],
      message: 'Cleartext HTTP URL (' + httpMatch[1] + ') is forbidden; use HTTPS.'
    });
  }

  const insecurePrefs = source.match(/\b(?:setString|setStringList)\s*\(\s*['"][^'"]*(?:token|access_token|refresh_token|password|secret|api_key|private_key)[^'"]*['"]/i);
  if (insecurePrefs && /SharedPreferences/i.test(source)) {
    findings.push({
      code: 'FLUTTER_INSECURE_CREDENTIAL_STORAGE',
      severity: 'BLOCKER',
      file: normalizedFile,
      message: 'Sensitive credential/token stored in plaintext SharedPreferences; use flutter_secure_storage.'
    });
  }

  return findings;
}

function walkFlutterFiles(root, dir, out = [], limit = 8000) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= limit) break;
    if (entry.name.startsWith('.') || ['build', 'node_modules', 'vendor', 'ios/Pods', '.dart_tool'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFlutterFiles(root, full, out, limit);
    else if (/\.(?:dart|arb|xml|plist|yaml|yml|sh)$/i.test(entry.name) || entry.name === 'package.json') out.push(relPath(root, full));
  }
  return out;
}

export function collectDeclaredFlutterRoutes(root, dartFiles = null) {
  if (!Array.isArray(dartFiles)) {
    const flutterRoots = discoverFlutterRoots(root);
    const allFiles = [];
    for (const fr of flutterRoots) walkFlutterFiles(root, fr.dir, allFiles);
    dartFiles = allFiles.filter((f) => f.endsWith('.dart'));
  }
  const routes = new Set();
  for (const rel of dartFiles) {
    const text = safeRead(path.join(root, rel));
    if (!text) continue;
    for (const m of text.matchAll(/\bGoRoute\s*\([^)]*\bpath\s*:\s*['"]([^'"]+)['"]/g)) {
      routes.add(m[1]);
    }
    for (const m of text.matchAll(/['"](\/[A-Za-z0-9_/-]*)['"]\s*:\s*\(\s*context\s*\)\s*=>/g)) {
      routes.add(m[1]);
    }
  }
  return routes;
}

export function guardFlutterIntegrity(root, { files = null, mode = 'changed', all = false } = {}) {
  root = path.resolve(root);
  if (all) mode = 'all';
  const flutterRoots = discoverFlutterRoots(root);
  const explicitDartFiles = Array.isArray(files) ? files.filter((f) => String(f).endsWith('.dart')) : [];
  if (!flutterRoots.length && !explicitDartFiles.length) {
    return {
      schemaVersion: 'executionkit-flutter-guard/v1',
      kind: 'flutter',
      mode,
      status: 'NOT_APPLICABLE',
      ok: true,
      filesScanned: 0,
      blockerCount: 0,
      highCount: 0,
      findings: []
    };
  }

  const primaryFlutter = flutterRoots[0] ?? { rel: '', dir: root, pubspecContent: safeRead(path.join(root, 'pubspec.yaml')) ?? '' };
  const declaredAssets = parsePubspecAssets(primaryFlutter.pubspecContent);

  const allFiles = [];
  for (const fr of (flutterRoots.length ? flutterRoots : [primaryFlutter])) {
    walkFlutterFiles(root, fr.dir, allFiles);
  }
  const declaredRoutes = collectDeclaredFlutterRoutes(root, allFiles.filter((f) => f.endsWith('.dart')));

  let candidates = [];
  if (Array.isArray(files) && files.length) {
    for (const raw of files) {
      const f = String(raw).replaceAll('\\', '/').replace(/^\.\//, '');
      const full = resolveProjectPathSafe(root, f, 'Flutter Guard source');
      if (fs.existsSync(full) && fs.statSync(full).isFile()) candidates.push(f);
    }
  } else {
    candidates = allFiles;
  }
  candidates = [...new Set(candidates)].filter((f) => !TEST_FILE_RE.test(f));

  const findings = [];
  for (const fr of flutterRoots) {
    findings.push(...inspectArbCatalog(fr.dir, root));
  }

  let scanned = 0;
  for (const file of candidates) {
    const text = safeRead(path.join(root, file));
    if (text === null) continue;
    scanned++;
    findings.push(
      ...flutterFindings(file, text, {
        root,
        flutterRoot: primaryFlutter.dir,
        declaredAssets,
        declaredRoutes
      })
    );
  }

  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const status = scanned === 0 && findings.length === 0
    ? 'NOT_APPLICABLE'
    : (blockerCount > 0 || highCount > 0) ? 'FAIL' : 'PASS';

  return {
    schemaVersion: 'executionkit-flutter-guard/v1',
    kind: 'flutter',
    mode,
    status,
    ok: status !== 'FAIL',
    flutterRoots: flutterRoots.map((r) => r.rel || '.'),
    filesScanned: scanned,
    blockerCount,
    highCount,
    findings
  };
}
