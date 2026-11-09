import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPathSafe } from './derived-state.mjs';

const UI_EXT = new Set(['.php', '.html', '.vue', '.jsx', '.tsx', '.svelte', '.css', '.scss']);
const TEMPLATE_EXT = /\.(?:blade\.php|vue|jsx|tsx|svelte|html)$/i;
const TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__|spec)\/|\.(?:test|spec)\.[mc]?[jt]sx?$|_test\.dart$|Test\.php$/i;
const TOKEN_FILE_RE = /(?:^|\/)(?:tokens?|theme|variables|palette|design-system|tailwind\.config)\b/i;

function relPath(root, file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function detectProjectUxContext(root) {
  root = path.resolve(root);
  const hasDesignTokens =
    fs.existsSync(path.join(root, 'design/tokens.json')) ||
    fs.existsSync(path.join(root, 'tokens.json')) ||
    fs.existsSync(path.join(root, 'tailwind.config.js')) ||
    fs.existsSync(path.join(root, 'tailwind.config.ts')) ||
    fs.existsSync(path.join(root, 'resources/css/tokens.css')) ||
    fs.existsSync(path.join(root, 'src/styles/tokens.css'));

  const hasComponentLibrary =
    fs.existsSync(path.join(root, 'resources/views/components')) ||
    fs.existsSync(path.join(root, 'src/components/ui')) ||
    fs.existsSync(path.join(root, 'components/ui'));

  let hasRtlSupport = false;
  for (const langRoot of ['lang', 'resources/lang', 'locales', 'src/locales', 'i18n']) {
    const full = path.join(root, langRoot);
    if (!fs.existsSync(full)) continue;
    try {
      const entries = fs.readdirSync(full);
      if (entries.some((name) => /^(?:ar|he|fa|ur)(?:[-_.]|$)/i.test(name))) {
        hasRtlSupport = true;
        break;
      }
    } catch {
      // ignore
    }
  }
  if (!hasRtlSupport && fs.existsSync(path.join(root, 'execution.config.json'))) {
    const cfg = safeRead(path.join(root, 'execution.config.json')) ?? '';
    if (/"(?:ar|he|fa|ur)(?:-[A-Z]{2})?"/i.test(cfg) || /"rtl"\s*:\s*true/i.test(cfg)) {
      hasRtlSupport = true;
    }
  }

  return { hasDesignTokens, hasComponentLibrary, hasRtlSupport };
}

function matchHtmlTags(text, tagName) {
  const results = [];
  const re = new RegExp('<' + tagName + '\\b', 'gi');
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    let i = start + m[0].length;
    let quote = null;
    let braceDepth = 0;
    while (i < text.length) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        i++;
        continue;
      }
      if (ch === '{') {
        braceDepth++;
        i++;
        continue;
      }
      if (ch === '}' && braceDepth > 0) {
        braceDepth--;
        i++;
        continue;
      }
      if (ch === '>' && braceDepth === 0) {
        results.push({
          openTag: text.slice(start, i + 1),
          start,
          end: i + 1
        });
        break;
      }
      i++;
    }
  }
  return results;
}

export function uxFindings(file, text, context = {}) {
  const normalizedFile = String(file ?? '').replaceAll('\\', '/');
  if (TEST_FILE_RE.test(normalizedFile)) return [];
  const source = String(text ?? '');
  if (!source.trim()) return [];

  const isTemplate = TEMPLATE_EXT.test(normalizedFile);
  const isStyle = /\.(?:css|scss)$/i.test(normalizedFile);
  const isTokenFile = TOKEN_FILE_RE.test(normalizedFile);
  if (!isTemplate && !isStyle) return [];

  const enforceTokens = context.strictUx === true || Boolean(context.hasDesignTokens);
  const enforceComponents = context.strictUx === true || Boolean(context.hasComponentLibrary);
  const enforceBidi = context.strictUx === true || Boolean(context.hasRtlSupport) || /\bdir\s*=\s*['"]rtl['"]/i.test(source);
  const findings = [];

  // 1. Design Token & Literal Drift
  if (!isTokenFile) {
    const arbitraryColorMatch = source.match(/\b(?:bg|text|border|ring|fill|stroke|from|via|to)-\[#[0-9a-fA-F]{3,8}\]/);
    if (arbitraryColorMatch) {
      findings.push({
        code: 'UX_TOKEN_RAW_COLOR_LITERAL',
        severity: 'BLOCKER',
        file: normalizedFile,
        token: arbitraryColorMatch[0],
        message: 'Arbitrary Tailwind hex color class bypasses semantic design tokens: ' + arbitraryColorMatch[0]
      });
    } else if (enforceTokens) {
      const strippedVarDefs = source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/--[A-Za-z0-9_-]+\s*:\s*[^;}\n]+/g, '');
      const rawColorMatch = strippedVarDefs.match(/(?:(?<!&)#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgb|rgba|hsl|hsla)\s*\([^)]+\))/);
      if (rawColorMatch && !/currentColor|transparent/i.test(rawColorMatch[0])) {
        findings.push({
          code: 'UX_TOKEN_RAW_COLOR_LITERAL',
          severity: 'HIGH',
          file: normalizedFile,
          token: rawColorMatch[0],
          message: 'Raw color literal in UI surface bypasses governed design tokens: ' + rawColorMatch[0]
        });
      }
    }

    if (isTemplate) {
      const inlineStyleMatch = source.match(/\bstyle\s*=\s*(?:["'][^"']*(?:\b(?:padding|margin|color|background(?:-color)?|font-size)\s*:\s*(?!var\()[^;"']+)[^"']*["']|\{\{\s*[^}]*\b(?:padding|margin|color|backgroundColor|fontSize)\s*:\s*['"#0-9])/i);
      if (inlineStyleMatch) {
        findings.push({
          code: 'UX_TOKEN_INLINE_STYLE_BYPASS',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Inline style with hardcoded visual values bypasses component and token styling.'
        });
      }
    }
  }

  // 2. Interactive State Completeness
  if (isTemplate) {
    const hasForeach = /@foreach\s*\(/.test(source);
    if (hasForeach && !/@forelse\s*\(|@empty\b|->isEmpty\s*\(|->isNotEmpty\s*\(|\bcount\s*\(|\bblank\s*\(|\bfilled\s*\(/i.test(source)) {
      findings.push({
        code: 'UX_STATE_EMPTY_MISSING',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'Blade @foreach collection rendering has no @forelse/@empty or empty-state guard.'
      });
    }

    const hasJsListMap = /\.map\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:<|\(\s*<)/.test(source);
    const isPageOrListSurface = /(?:^|\/)(?:pages|views|screens|routes|tables|lists)\//i.test(normalizedFile) || /\b(?:useQuery|useSWR|fetch\s*\(|axios\.)/.test(source);
    if (hasJsListMap && isPageOrListSurface && !/\.length\s*(?:===?\s*0|===?\s*0|>|<|!)|isEmpty|EmptyState|empty-state|no-results|No\s+[A-Za-z]+\s+found/i.test(source)) {
      findings.push({
        code: 'UX_STATE_EMPTY_MISSING',
        severity: 'BLOCKER',
        file: normalizedFile,
        message: 'Data collection .map() in UI view is missing an explicit empty-state presentation.'
      });
    }

    const hasAsyncFetch = /\b(?:useQuery|useSWR|fetch\s*\(|axios\.(?:get|post|put|delete|request)|wire:init)\b/.test(source);
    if (hasAsyncFetch) {
      if (!/\b(?:isLoading|loading|isPending|pending|skeleton|Skeleton|Spinner|spinner|wire:loading|aria-busy|Suspense)\b/.test(source)) {
        findings.push({
          code: 'UX_STATE_LOADING_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Async data-fetching view has no loading, skeleton, or wire:loading state.'
        });
      }
      if (!/\b(?:isError|error|ErrorBoundary|catch\s*\(|onError|retry|refetch|onRetry|wire:offline|role=["']alert["'])\b/.test(source)) {
        findings.push({
          code: 'UX_STATE_ERROR_RETRY_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Async data-fetching view has no error boundary, error message, or retry state.'
        });
      }
    }

    const hasAsyncForm = /\b(?:wire:submit|@submit|v-on:submit|onSubmit)\b/.test(source);
    if (hasAsyncForm && /<button\b[^>]*type\s*=\s*['"]submit['"]/i.test(source)) {
      if (!/\b(?:disabled|wire:loading\.attr\s*=\s*['"]disabled['"]|isSubmitting|submitting|processing|isPending|loading)\b/.test(source)) {
        findings.push({
          code: 'UX_STATE_SUBMIT_DISABLED_MISSING',
          severity: 'HIGH',
          file: normalizedFile,
          message: 'Async form submit button has no disabled/processing guard to prevent double submission.'
        });
      }
    }

    // 3. Component System & Anti-Slop
    const dialogMatch = source.match(/(?:\bwindow\s*\.\s*(?:alert|confirm|prompt)|(?<![.\w$])(?:alert|confirm|prompt))\s*\(/);
    if (dialogMatch) {
      findings.push({
        code: 'UX_SLOP_NATIVE_BROWSER_DIALOG',
        severity: 'BLOCKER',
        file: normalizedFile,
        call: dialogMatch[0],
        message: 'Native browser dialog (' + dialogMatch[0].trim() + ') is forbidden in premium UI; use a governed modal or toast component.'
      });
    }

    const chromeEmojiMatch = source.match(/<(?:button|nav|th|label)\b[^>]*>[\s\S]*?(🚀|✨|🔥|💡|⚡|🎉|💎|🌟|🤖|🪄)[\s\S]*?<\/(?:button|nav|th|label)>/iu);
    if (chromeEmojiMatch) {
      findings.push({
        code: 'UX_SLOP_DECORATIVE_CHROME_EMOJI',
        severity: 'HIGH',
        file: normalizedFile,
        emoji: chromeEmojiMatch[1],
        message: 'Decorative emoji (' + chromeEmojiMatch[1] + ') in navigation/button/table/label chrome is generic AI slop; use a consistent vector icon set or plain text.'
      });
    }

    const hypeCopyMatch = source.match(/\b(?:Supercharge\s+your|Unlock\s+the\s+power\s+of|Revolutionize\s+your|AI-powered\s+magic)\b|>[^<>{}\n]*?[A-Za-z][^<>{}\n]*?!!+\s*</i);
    if (hypeCopyMatch) {
      findings.push({
        code: 'UX_SLOP_HYPE_EXCLAMATION_COPY',
        severity: 'HIGH',
        file: normalizedFile,
        copy: hypeCopyMatch[0].trim(),
        message: 'Generic AI hype copy or multiple exclamation marks (' + hypeCopyMatch[0].trim() + ') violate product-specific copy discipline.'
      });
    }

    const isReusableComponentFile = /(?:^|\/)(?:components|ui|primitives|partials)\//i.test(normalizedFile);
    if (enforceComponents && !isReusableComponentFile && /(?:^|\/)(?:pages|views|screens)\//i.test(normalizedFile)) {
      const rawPrimitiveMatch = source.match(/<(?:dialog|select|textarea)\b/i);
      if (rawPrimitiveMatch) {
        findings.push({
          code: 'UX_COMPONENT_PRIMITIVE_BYPASS',
          severity: 'HIGH',
          file: normalizedFile,
          element: rawPrimitiveMatch[0],
          message: 'Screen view uses raw HTML primitive (' + rawPrimitiveMatch[0] + '>) instead of canonical project UI component.'
        });
      }
    }
  }

  // 4. Accessibility & Ergonomics (WCAG 2.2 AA)
  if (/\boutline-none\b/.test(source) && !/\bfocus(?:-visible)?:(?:ring|outline-(?!none\b|0\b))/.test(source)) {
    findings.push({
      code: 'UX_A11Y_FOCUS_RING_REMOVED',
      severity: 'BLOCKER',
      file: normalizedFile,
      message: 'Focus outline removed (outline-none) without a focus:ring or focus-visible replacement.'
    });
  } else if (/outline\s*:\s*(?:none|0)\b/i.test(source) && !/:focus-visible\b|box-shadow\s*:/i.test(source)) {
    findings.push({
      code: 'UX_A11Y_FOCUS_RING_REMOVED',
      severity: 'BLOCKER',
      file: normalizedFile,
      message: 'CSS outline: none/0 used without an accessible :focus-visible replacement.'
    });
  }

  if (isTemplate) {
    for (const btn of [...matchHtmlTags(source, 'button'), ...matchHtmlTags(source, 'a')]) {
      const closeTagRe = new RegExp('</' + (btn.openTag.toLowerCase().startsWith('<a') ? 'a' : 'button') + '\\s*>', 'gi');
      closeTagRe.lastIndex = btn.end;
      const closeMatch = closeTagRe.exec(source);
      if (!closeMatch) continue;
      const inner = source.slice(btn.end, closeMatch.index).trim();
      const hasIconOnly = /^<(?:svg|i|Icon|img)\b[\s\S]*>$/i.test(inner) && !/\bsr-only\b|\bvisually-hidden\b/i.test(inner);
      const textWithoutTags = inner.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').trim();
      if (hasIconOnly && !textWithoutTags && !/\b(?:aria-label|aria-labelledby|title)\s*=/i.test(btn.openTag)) {
        findings.push({
          code: 'UX_A11Y_ICON_BUTTON_UNLABELED',
          severity: 'BLOCKER',
          file: normalizedFile,
          message: 'Icon-only interactive button/link is missing aria-label, aria-labelledby, or sr-only text.'
        });
        break;
      }
    }

    for (const tag of [...matchHtmlTags(source, 'div'), ...matchHtmlTags(source, 'span')]) {
      if (/\b(?:onClick|@click|v-on:click|wire:click|x-on:click)\s*=/.test(tag.openTag)) {
        const hasRole = /\brole\s*=\s*['"](?:button|link|menuitem|option|tab|switch|checkbox)['"]/i.test(tag.openTag);
        const hasKeyboard = /\b(?:tabIndex|tabindex)\s*=/.test(tag.openTag) || /\b(?:onKeyDown|onKeyUp|@keydown|@keyup|x-on:keydown)\s*=/.test(tag.openTag);
        if (!hasRole || !hasKeyboard) {
          findings.push({
            code: 'UX_A11Y_CLICKABLE_NON_INTERACTIVE',
            severity: 'BLOCKER',
            file: normalizedFile,
            message: 'Clickable <div>/<span> is missing interactive role="button" and keyboard tabindex/keydown support.'
          });
          break;
        }
      }
    }
  }

  // 5. RTL / BiDi, Responsive Layout & Motion
  if (enforceBidi) {
    const bidiMatch = source.match(/\b(?:ml|mr|pl|pr|left|right)-\d+\b|\btext-(?:left|right)\b|\b(?:margin|padding)-(?:left|right)\s*:|\btext-align\s*:\s*(?:left|right)\b/);
    if (bidiMatch && !/\bdir\s*=\s*['"]ltr['"]|\/\*\s*rtl:ignore\s*\*\//.test(source)) {
      findings.push({
        code: 'UX_BIDI_PHYSICAL_DIRECTION_DRIFT',
        severity: 'HIGH',
        file: normalizedFile,
        property: bidiMatch[0],
        message: 'Physical directional class/style (' + bidiMatch[0] + ') breaks RTL/BiDi symmetry; use logical properties (ms-/me-, ps-/pe-, start-/end-, text-start/end, margin-inline-start/end).'
      });
    }
  }

  const fixedWidthMatch = source.match(/\b(?:w|min-w)-\[([4-9]\d{2}|\d{4,})px\]|\b(?:width|min-width)\s*:\s*([4-9]\d{2}|\d{4,})px\b/);
  if (fixedWidthMatch) {
    const px = Number(fixedWidthMatch[1] ?? fixedWidthMatch[2]);
    if (px >= 400 && !/\bmax-w-full\b|\bmax-width\s*:\s*100%|\b(?:sm|md|lg|xl):(?:w|min-w)-|@media\b/.test(source)) {
      findings.push({
        code: 'UX_LAYOUT_FIXED_WIDTH_OVERFLOW',
        severity: 'HIGH',
        file: normalizedFile,
        widthPx: px,
        message: 'Unbounded fixed pixel width (' + px + 'px) risks horizontal overflow on 320px-375px mobile viewports.'
      });
    }
  }

  const transitionAllMatch = source.match(/\btransition-all\b|\btransition\s*:\s*all\b/);
  if (transitionAllMatch) {
    findings.push({
      code: 'UX_MOTION_TRANSITION_ALL_FORBIDDEN',
      severity: 'HIGH',
      file: normalizedFile,
      property: transitionAllMatch[0],
      message: 'Broad transition-all (' + transitionAllMatch[0] + ') animates layout geometry; use transition-colors, transition-opacity, or transition-transform.'
    });
  }

  const animMatch = source.match(/\banimate-(?:bounce|ping|pulse|spin)\b|@keyframes\b|\banimation\s*:\s*(?!none\b)[A-Za-z0-9_-]+/);
  if (animMatch && !/\bmotion-(?:safe|reduce):|prefers-reduced-motion/.test(source)) {
    const isLoadingSpinner = animMatch[0] === 'animate-spin' && /\b(?:aria-busy|sr-only|loading|isLoading|wire:loading)\b/i.test(source);
    if (!isLoadingSpinner) {
      findings.push({
        code: 'UX_MOTION_REDUCED_MOTION_MISSING',
        severity: 'HIGH',
        file: normalizedFile,
        animation: animMatch[0],
        message: 'Animation (' + animMatch[0] + ') does not respect prefers-reduced-motion or motion-safe/motion-reduce.'
      });
    }
  }

  return findings;
}

function walkUiFiles(root, dir, out = [], limit = 6000) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (out.length >= limit) break;
    if (entry.name.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build', 'coverage', 'storage'].includes(entry.name)) continue;
    const next = path.join(full, entry.name);
    if (entry.isDirectory()) walkUiFiles(root, path.join(dir, entry.name), out, limit);
    else if (UI_EXT.has(path.extname(entry.name).toLowerCase())) out.push(relPath(root, next));
  }
  return out;
}

export function guardUxIntegrity(root, { files = null, mode = 'changed', all = false, strict = true } = {}) {
  root = path.resolve(root);
  if (all) mode = 'all';
  const projectContext = {
    ...detectProjectUxContext(root),
    strictUx: Boolean(strict)
  };
  let candidates = [];
  if (Array.isArray(files) && files.length) {
    for (const raw of files) {
      const f = String(raw).replaceAll('\\', '/').replace(/^\.\//, '');
      const full = resolveProjectPathSafe(root, f, 'UX Guard source');
      if (fs.existsSync(full) && fs.statSync(full).isFile()) candidates.push(f);
    }
  } else {
    for (const dir of ['resources', 'src', 'app', 'components', 'pages', 'views', 'web']) {
      walkUiFiles(root, dir, candidates);
    }
  }
  candidates = [...new Set(candidates)].filter((f) => !TEST_FILE_RE.test(f));

  const findings = [];
  let scanned = 0;
  for (const file of candidates) {
    const text = safeRead(path.join(root, file));
    if (text === null) continue;
    scanned++;
    findings.push(...uxFindings(file, text, projectContext));
  }

  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const status = scanned === 0 ? 'NOT_APPLICABLE' : (blockerCount > 0 || highCount > 0) ? 'FAIL' : 'PASS';
  return {
    schemaVersion: 'executionkit-ux-guard/v1',
    kind: 'ux',
    mode,
    status,
    ok: status !== 'FAIL',
    filesScanned: scanned,
    blockerCount,
    highCount,
    findings
  };
}
