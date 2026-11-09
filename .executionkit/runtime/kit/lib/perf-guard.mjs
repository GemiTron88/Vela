import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { LIGHTHOUSE_FLOOR, LIGHTHOUSE_CWV_LIMITS } from './lighthouse-gate.mjs';

const PERF_EXT = new Set([
  '.php', '.html', '.htm', '.vue', '.jsx', '.tsx', '.svelte',
  '.js', '.mjs', '.ts', '.css', '.scss', '.dart'
]);

const TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__|spec|fixtures)\/|\.(?:test|spec)\.[mc]?[jt]sx?$|_test\.dart$|Test\.php$/i;

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function stripBlockAndLineComments(code) {
  const s = String(code ?? '');
  let out = '';
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < s.length) {
        out += s[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < s.length && s[i] !== '\n') i++;
      if (i < s.length) out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) {
        if (s[i] === '\n') out += '\n';
        i++;
      }
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function extractBalancedBraceBlock(source, openBraceIdx) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return source.slice(openBraceIdx, i + 1);
      }
    }
  }
  return source.slice(openBraceIdx);
}

export function inspectLighthousePerfReports(root, { requireReports = false } = {}) {
  root = path.resolve(root);
  const findings = [];
  const lhciDir = path.join(root, '.lighthouseci');
  const rawSeoPerf = path.join(root, '.executionkit/evidence/raw/seo-performance.json');

  const reports = [];
  if (fs.existsSync(lhciDir) && fs.statSync(lhciDir).isDirectory()) {
    for (const name of fs.readdirSync(lhciDir)) {
      if (!name.endsWith('.json') || name === 'assertion-results.json') continue;
      const doc = safeReadJson(path.join(lhciDir, name));
      if (doc && doc.categories) {
        reports.push({ file: `.lighthouseci/${name}`, report: doc });
      }
    }
  }

  const evidenceDir = path.join(root, '.executionkit/evidence');
  if (fs.existsSync(evidenceDir) && fs.statSync(evidenceDir).isDirectory()) {
    for (const name of fs.readdirSync(evidenceDir)) {
      if (!/^lighthouse.*\.json$/i.test(name)) continue;
      const doc = safeReadJson(path.join(evidenceDir, name));
      if (doc && doc.categories) {
        reports.push({ file: `.executionkit/evidence/${name}`, report: doc });
      }
    }
  }

  const evidenceDoc = safeReadJson(rawSeoPerf);
  if (!reports.length && evidenceDoc && Array.isArray(evidenceDoc.inlineReports)) {
    for (let i = 0; i < evidenceDoc.inlineReports.length; i++) {
      const doc = evidenceDoc.inlineReports[i];
      if (doc && doc.categories) {
        reports.push({ file: `.executionkit/evidence/raw/seo-performance.json#${i}`, report: doc });
      }
    }
  }

  if (!reports.length) {
    if (requireReports) {
      findings.push({
        code: 'PERF_LIGHTHOUSE_REPORTS_MISSING',
        severity: 'BLOCKER',
        file: '.lighthouseci',
        message: 'Lighthouse 100/100 reports are required but no Lighthouse JSON reports were found in .lighthouseci/.'
      });
      return { status: 'FAIL', ok: false, reportCount: 0, minScore: 0, findings };
    }
    return { status: 'NOT_APPLICABLE', ok: true, reportCount: 0, minScore: null, findings };
  }

  let minScore = 100;
  for (const { file, report } of reports) {
    const url = report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl ?? file;
    if (report.configSettings?.throttlingMethod === 'provided' || report.configSettings?.disableStorageReset === true) {
      findings.push({
        code: 'PERF_LIGHTHOUSE_THROTTLING_SPOOFED',
        severity: 'BLOCKER',
        file,
        url,
        message: 'Lighthouse report for "' + url + '" disables throttling or storage reset to artificially inflate scores.'
      });
    }

    for (const [category, requiredScore] of Object.entries(LIGHTHOUSE_FLOOR)) {
      const raw = report.categories?.[category]?.score;
      const pct = Number.isFinite(raw) ? Math.round(raw * 100) : 0;
      if (pct < minScore) minScore = pct;
      if (!Number.isFinite(raw) || pct < requiredScore) {
        findings.push({
          code: 'PERF_LIGHTHOUSE_SCORE_BELOW_100',
          severity: 'BLOCKER',
          file,
          url,
          category,
          score: pct,
          required: requiredScore,
          message: 'Lighthouse "' + category + '" score on "' + url + '" is ' + pct + '/100 (all categories must be 100/100).'
        });
      }
    }

    for (const [auditId, limit] of Object.entries(LIGHTHOUSE_CWV_LIMITS)) {
      const audit = report.audits?.[auditId];
      if (audit && Number.isFinite(audit.numericValue) && audit.numericValue > limit) {
        findings.push({
          code: 'PERF_LIGHTHOUSE_CWV_EXCEEDED',
          severity: 'BLOCKER',
          file,
          url,
          audit: auditId,
          value: audit.numericValue,
          limit,
          message: 'Lighthouse Core Web Vital "' + auditId + '" on "' + url + '" is ' + audit.numericValue + ' (exceeds 100/100 budget limit ' + limit + ').'
        });
      }
    }
  }

  return {
    status: findings.length ? 'FAIL' : 'PASS',
    ok: findings.length === 0,
    reportCount: reports.length,
    minScore,
    findings
  };
}

export function perfFindings(relFile, rawContent) {
  const normalizedFile = String(relFile ?? '').replaceAll('\\', '/');
  if (TEST_FILE_RE.test(normalizedFile)) return [];
  const findings = [];
  const source = String(rawContent ?? '');
  const cleanCode = stripBlockAndLineComments(source);

  const isWebTemplate = /\.(?:blade\.php|html?|vue|jsx|tsx|svelte)$/i.test(normalizedFile);
  const isStyle = /\.(?:css|scss)$/i.test(normalizedFile);
  const isScript = /\.(?:js|mjs|ts|jsx|tsx|vue|svelte)$/i.test(normalizedFile);
  const isPhp = /\.php$/i.test(normalizedFile) && !/\.blade\.php$/i.test(normalizedFile);
  const isDart = /\.dart$/i.test(normalizedFile);

  // ---------------------------------------------------------------------------
  // 1. Web Speed & Lighthouse 100/100 Source Checks
  // ---------------------------------------------------------------------------
  if (isWebTemplate) {
    // 1a. Render-blocking <script src="..."> without defer, async, or type="module"
    for (const m of source.matchAll(/<script\b([^>]*)>/gi)) {
      const attrs = m[1] ?? '';
      if (/\bsrc\s*=\s*["'][^"']+["']/i.test(attrs)) {
        const isNonBlocking = /\b(?:defer|async)\b/i.test(attrs) || /\btype\s*=\s*["'](?:module|importmap|application\/ld\+json|application\/json)["']/i.test(attrs);
        if (!isNonBlocking) {
          findings.push({
            code: 'PERF_WEB_RENDER_BLOCKING_SCRIPT',
            severity: 'HIGH',
            file: normalizedFile,
            message: 'External <script src="..."> is missing defer, async, or type="module", causing render-blocking FCP/LCP delay.'
          });
          break;
        }
      }
    }

    // 1b. Google Fonts link without display=swap
    for (const m of source.matchAll(/<link\b([^>]*)>/gi)) {
      const attrs = m[1] ?? '';
      if (/fonts\.googleapis\.com\/css/i.test(attrs) && !/[?&]display=(?:swap|optional)\b/i.test(attrs)) {
        findings.push({
          code: 'PERF_WEB_FONT_DISPLAY_SWAP_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Google Fonts <link> is missing "&display=swap", causing Flash of Invisible Text (FOIT) and Lighthouse penalty.'
        });
        break;
      }
    }

    // 1c. <iframe src="..."> without loading="lazy"
    for (const m of source.matchAll(/<iframe\b([^>]*)>/gi)) {
      const attrs = m[1] ?? '';
      if (/\bsrc\s*=\s*["'][^"']+["']/i.test(attrs) && !/\bloading\s*=\s*["']lazy["']/i.test(attrs)) {
        findings.push({
          code: 'PERF_WEB_IFRAME_LAZY_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Embedded <iframe> is missing loading="lazy", degrading Lighthouse TBT and Speed Index.'
        });
        break;
      }
    }
  }

  if (isStyle || isWebTemplate) {
    // 1d. @font-face without font-display: swap | optional
    for (const m of source.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
      const block = m[1] ?? '';
      if (!/\bfont-display\s*:\s*(?:swap|optional|fallback)\b/i.test(block)) {
        findings.push({
          code: 'PERF_WEB_FONT_DISPLAY_SWAP_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: '@font-face declaration is missing "font-display: swap" (or optional), failing Lighthouse font-display audit.'
        });
        break;
      }
    }

    // 1e. CSS @import url(...) waterfall
    if (/@import\s+(?:url\s*\(\s*)?["']?(?:https?:\/\/|\/|[A-Za-z0-9_.-]+\.css)/i.test(cleanCode)) {
      findings.push({
        code: 'PERF_WEB_CSS_IMPORT_WATERFALL',
        severity: 'HIGH',
        file: normalizedFile,
        message: 'CSS @import creates a sequential network request waterfall that blocks rendering; use <link rel="stylesheet"> or bundler imports.'
      });
    }
  }

  if (isScript || isWebTemplate) {
    // 1f. Non-passive scroll / touch / wheel event listeners
    for (const m of cleanCode.matchAll(/\.addEventListener\s*\(\s*['"](?:scroll|wheel|touchstart|touchmove)['"]\s*,\s*[^,)]+(?:,\s*([^)]+))?\)/g)) {
      const optsArg = m[1] ?? '';
      if (!/\bpassive\s*:\s*true\b/.test(optsArg)) {
        findings.push({
          code: 'PERF_WEB_NON_PASSIVE_SCROLL_LISTENER',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Scroll/touch/wheel event listener is missing { passive: true }, failing Lighthouse uses-passive-event-listeners.'
        });
        break;
      }
    }

    // 1g. Heavy monolithic barrel imports (lodash, moment)
    const barrelMatch = cleanCode.match(/\bimport\s+(?!type\b)(?:\*\s+as\s+\w+|\w+|\{[^}]+\})\s+from\s+['"](?:lodash|moment)['"]|\brequire\s*\(\s*['"](?:lodash|moment)['"]\s*\)/);
    if (barrelMatch) {
      findings.push({
        code: 'PERF_WEB_HEAVY_BARREL_IMPORT',
        severity: 'HIGH',
        file: normalizedFile,
        importStatement: barrelMatch[0],
        message: 'Unscoped monolithic import (' + barrelMatch[0] + ') bloats JS bundle size and Total Blocking Time (TBT).'
      });
    }

    // 1h. document.write or synchronous XMLHttpRequest
    if (/(?<!['"`])\bdocument\.write(?:ln)?\s*\(\s*[^)]/.test(cleanCode) || /\.open\s*\(\s*['"][A-Z]+['"]\s*,\s*[^,]+,\s*false\s*\)/.test(cleanCode)) {
      findings.push({
        code: 'PERF_WEB_SYNC_XHR_OR_DOC_WRITE',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'document.write or synchronous XMLHttpRequest blocks the main thread and fails Lighthouse Best Practices / Performance.'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Backend TTFB & Database Query Speed Checks (PHP / Laravel)
  // ---------------------------------------------------------------------------
  if (isPhp) {
    // 2a. N+1 query inside foreach / for / while loop
    for (const loopMatch of cleanCode.matchAll(/\b(?:foreach|for|while)\s*\([^)]*\)\s*\{/g)) {
      const openBrace = loopMatch.index + loopMatch[0].length - 1;
      const body = extractBalancedBraceBlock(cleanCode, openBrace);
      if (/\b(?:[A-Z][A-Za-z0-9_]*::(?:where|find|first|all|with|query|create|update|destroy)|DB::(?:table|select|statement|insert|update|delete))\s*\(|->\s*(?:where|whereIn|whereNull|whereNotNull|orderBy|latest|oldest)\s*\([^)]*\)\s*->\s*(?:get|first|count|sum|avg|pluck|paginate|exists)\s*\(|->\s*(?:paginate|load|loadMissing)\s*\(/.test(body)) {
        findings.push({
          code: 'PERF_BACKEND_N_PLUS_ONE_QUERY_IN_LOOP',
          severity: 'BLOCKER',
          file: normalizedFile,
          message: 'Database/Eloquent query executed inside a loop (N+1 query pattern), degrading server TTFB and Lighthouse Performance.'
        });
        break;
      }
    }

    // 2b. Unbounded Model::all() in Controller
    if (/Controller\.php$/i.test(normalizedFile)) {
      const allMatch = cleanCode.match(/\b([A-Z][A-Za-z0-9_]*)::all\s*\(\s*\)/);
      if (allMatch) {
        findings.push({
          code: 'PERF_BACKEND_UNBOUNDED_MODEL_ALL',
          severity: 'HIGH',
          file: normalizedFile,
          call: allMatch[0],
          message: 'Controller executes unbounded ' + allMatch[0] + ' without pagination or limit, risking memory spikes and slow TTFB.'
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Flutter 60fps / 120fps Frame-Budget & Memory Speed Checks
  // ---------------------------------------------------------------------------
  if (isDart) {
    // 3a. Eager ListView / GridView with dynamic .map() children instead of .builder
    for (const m of cleanCode.matchAll(/\b(?:ListView|GridView(?:\.count|\.extent)?)\s*\(/g)) {
      const after = cleanCode.slice(m.index, m.index + 600);
      if (/\bchildren\s*:\s*[^,;]*\.map\s*\(/.test(after) && !/\bshrinkWrap\s*:\s*true\b/.test(after)) {
        findings.push({
          code: 'PERF_FLUTTER_EAGER_LIST_CHILDREN',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Scrollable ListView/GridView materializes dynamic .map() children eagerly; use ListView.builder / GridView.builder / SliverList for 60/120fps scrolling.'
        });
        break;
      }
    }

    // 3b. Synchronous File I/O on the UI isolate
    const syncIoMatch = cleanCode.match(/\.\s*(?:readAsStringSync|readAsBytesSync|readAsLinesSync|writeAsStringSync|writeAsBytesSync)\s*\(/);
    if (syncIoMatch) {
      findings.push({
        code: 'PERF_FLUTTER_SYNC_IO_ON_UI_ISOLATE',
        severity: 'BLOCKER',
        file: normalizedFile,
        call: syncIoMatch[0].trim(),
        message: 'Synchronous file I/O (' + syncIoMatch[0].trim() + ') blocks the Flutter UI isolate and causes severe frame jank (<60fps).'
      });
    }

    // 3c. Expensive saveLayer (BackdropFilter / IntrinsicHeight / IntrinsicWidth) or uncached Image.network inside itemBuilder
    for (const ibMatch of cleanCode.matchAll(/\bitemBuilder\s*:\s*\([^)]*\)\s*\{/g)) {
      const openBrace = ibMatch.index + ibMatch[0].length - 1;
      const body = extractBalancedBraceBlock(cleanCode, openBrace);
      if (/\b(?:BackdropFilter|IntrinsicHeight|IntrinsicWidth)\s*\(/.test(body)) {
        findings.push({
          code: 'PERF_FLUTTER_SAVE_LAYER_IN_SCROLL',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Expensive BackdropFilter or IntrinsicHeight/Width used inside scroll itemBuilder, causing GPU saveLayer/O(N^2) frame drops.'
        });
      }
      if (/\bImage\.network\s*\(/.test(body) && !/\b(?:cacheWidth|cacheHeight)\s*:/.test(body)) {
        findings.push({
          code: 'PERF_FLUTTER_UNCACHED_IMAGE_IN_LIST',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Image.network() inside scroll itemBuilder is missing cacheWidth/cacheHeight, causing high memory usage and decode jank.'
        });
      }
    }
  }

  return findings;
}

function walkPerfFiles(root, dir, out = [], limit = 8000) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (out.length >= limit) break;
    if (entry.name.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build', 'coverage', 'storage', '.dart_tool'].includes(entry.name)) continue;
    const next = path.join(full, entry.name);
    const rel = path.relative(root, next).replaceAll('\\', '/');
    if (entry.isDirectory()) walkPerfFiles(root, rel, out, limit);
    else if (PERF_EXT.has(path.extname(entry.name).toLowerCase())) out.push(rel);
  }
  return out;
}

export function guardPerfIntegrity(root, { files = null, mode = 'changed', all = false, requireLighthouse = false } = {}) {
  root = path.resolve(root);
  if (all) mode = 'all';
  let candidates = [];
  if (Array.isArray(files) && files.length) {
    for (const raw of files) {
      const f = String(raw).replaceAll('\\', '/').replace(/^\.\//, '');
      const full = resolveProjectPathSafe(root, f, 'Performance Guard source');
      if (fs.existsSync(full) && fs.statSync(full).isFile()) candidates.push(f);
    }
  } else {
    for (const dir of ['app', 'resources', 'src', 'components', 'pages', 'views', 'web', 'lib', 'public', 'mobile', 'flutter_app', 'apps', 'packages']) {
      walkPerfFiles(root, dir, candidates);
    }
  }
  candidates = [...new Set(candidates)].filter((f) => !TEST_FILE_RE.test(f));

  const findings = [];
  let scanned = 0;
  for (const file of candidates) {
    const text = safeRead(path.join(root, file));
    if (text === null) continue;
    scanned++;
    findings.push(...perfFindings(file, text));
  }

  const lighthouse = inspectLighthousePerfReports(root, { requireReports: requireLighthouse });
  findings.push(...lighthouse.findings);

  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const status = scanned === 0 && lighthouse.status === 'NOT_APPLICABLE' && findings.length === 0
    ? 'NOT_APPLICABLE'
    : (blockerCount > 0 || highCount > 0) ? 'FAIL' : 'PASS';

  return {
    schemaVersion: 'executionkit-perf-guard/v1',
    kind: 'perf',
    mode,
    status,
    ok: status !== 'FAIL',
    filesScanned: scanned,
    lighthouse: {
      status: lighthouse.status,
      reportCount: lighthouse.reportCount,
      minScore: lighthouse.minScore,
      budget: 100
    },
    blockerCount,
    highCount,
    findings
  };
}
