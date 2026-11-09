import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { inspectMediaBytes, inspectSafeSVG, inspectLottieBytes } from './media-integrity.mjs';
import { REQUIRED_VISUAL_ROLES, VISUAL_PRODUCTION_FILE } from './visual-production.mjs';
import { detectVisualSurfaces } from './visual-os.mjs';

const ROLE_MIN_DIMENSIONS = Object.freeze({
  hero: { width: 600, height: 300 },
  banner: { width: 480, height: 120 },
  background: { width: 600, height: 400 },
  illustration: { width: 160, height: 120 },
  empty: { width: 160, height: 120 },
  dynamic: { width: 80, height: 80 },
  icon: { width: 16, height: 16 }
});

const SCREENSHOT_MIN = Object.freeze({ width: 320, height: 240 });
const COMPLEX_VECTOR_ROLES = new Set(['hero', 'banner', 'illustration', 'empty']);
const TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__|spec|fixtures)\/|\.(?:test|spec)\.[mc]?[jt]sx?$|_test\.dart$|Test\.php$/i;

function safeReadText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function safeReadBuffer(file) {
  try {
    return fs.readFileSync(file);
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

function formatOf(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))) return 'image/avif';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'image/jpeg';
  if (buffer.length >= 7 && /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(buffer.toString('utf8', 0, 256).replace(/^\uFEFF/, '').trimStart())) return 'image/svg+xml';
  if (buffer.length >= 16 && /^\{[\s\S]*"v"\s*:[\s\S]*"layers"\s*:\s*\[/.test(buffer.toString('utf8', 0, Math.min(buffer.length, 4096)).trimStart())) return 'application/lottie+json';
  return null;
}

export function inspectSvgVisualQuality(arg1, arg2, arg3 = {}) {
  let relPath = arg1;
  let svgText = arg2;
  let opts = arg3;
  if (typeof arg2 === 'object' && arg2 !== null && !Buffer.isBuffer(arg2)) {
    svgText = arg1;
    opts = arg2;
    relPath = opts.relPath ?? 'inline.svg';
  }
  const { role = null, standalone = true } = opts ?? {};
  const findings = [];
  const text = Buffer.isBuffer(svgText) ? svgText.toString('utf8') : String(svgText ?? '');
  if (!/<svg\b/i.test(text)) return findings;

  // 1. Embedded raster wrapper inside SVG
  if (/<image\b/i.test(text) || /data:image\/(?:png|jpeg|jpg|webp|gif|avif|bmp)/i.test(text)) {
    findings.push({
      code: 'VISUALS_SVG_RASTER_WRAPPER_FORBIDDEN',
      severity: 'BLOCKER',
      file: relPath,
      role,
      message: 'SVG wraps an embedded raster image (<image> or data:image/*); vector artwork must be genuine vector geometry.'
    });
  }

  // 2. ViewBox required for responsive scaling
  const svgOpen = text.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  if (!/\bviewBox\s*=\s*["']\s*-?\d+(?:\.\d+)?[\s,]+-?\d+(?:\.\d+)?[\s,]+\d+(?:\.\d+)?[\s,]+\d+(?:\.\d+)?\s*["']/i.test(svgOpen)) {
    findings.push({
      code: 'VISUALS_SVG_VIEWBOX_REQUIRED',
      severity: 'HIGH',
      file: relPath,
      role,
      message: 'SVG is missing a valid responsive viewBox="minX minY width height" attribute.'
    });
  }

  // 3. Accessibility for standalone or non-hidden SVGs
  const isDecorative = /\baria-hidden\s*=\s*["']true["']/i.test(svgOpen) || /\brole\s*=\s*["'](?:presentation|none)["']/i.test(svgOpen);
  const hasA11yLabel = /<title\b[^>]*>[\s\S]*?<\/title\s*>/i.test(text) || /\b(?:aria-label|aria-labelledby)\s*=\s*["'][^"']+["']/i.test(svgOpen);
  if (standalone && !isDecorative && !hasA11yLabel && role && COMPLEX_VECTOR_ROLES.has(role)) {
    findings.push({
      code: 'VISUALS_SVG_ACCESSIBILITY_MISSING',
      severity: 'HIGH',
      file: relPath,
      role,
      message: 'Non-decorative SVG for role "' + role + '" requires <title>, aria-label, or aria-hidden="true".'
    });
  }

  // 4. Trivial placeholder geometry check for complex visual roles
  const checkComplexity = (role && COMPLEX_VECTOR_ROLES.has(role)) || /(?:^|\/)(?:hero|heroes|banner|banners|illustration|illustrations|empty|scenes)\//i.test(relPath);
  if (checkComplexity) {
    const primitiveCount = [...text.matchAll(/<(?:path|g|polygon|polyline|circle|rect|ellipse|line|linearGradient|radialGradient|clipPath|mask|text)\b/gi)].length;
    const hasPathOrGroup = /<(?:path|g|polygon|polyline|linearGradient|radialGradient)\b/i.test(text);
    if (primitiveCount <= 1 || (!hasPathOrGroup && primitiveCount <= 2)) {
      findings.push({
        code: 'VISUALS_SVG_TRIVIAL_PLACEHOLDER',
        severity: 'BLOCKER',
        file: relPath,
        role: role ?? 'illustration',
        primitiveCount,
        message: 'SVG for "' + (role ?? relPath) + '" is a trivial 1-primitive geometric placeholder (' + primitiveCount + ' element); rich multi-element vector composition is required.'
      });
    }
  }

  return findings;
}

export function inspectLottieVisualQuality(arg1, arg2) {
  let relPath = arg1;
  let rawTextOrBuffer = arg2;
  if (Buffer.isBuffer(arg1) || (typeof arg2 === 'object' && arg2 !== null && !Buffer.isBuffer(arg2))) {
    rawTextOrBuffer = arg1;
    relPath = arg2?.relPath ?? 'inline-lottie';
  }
  const findings = [];
  const text = Buffer.isBuffer(rawTextOrBuffer) ? rawTextOrBuffer.toString('utf8') : String(rawTextOrBuffer ?? '');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    findings.push({
      code: 'VISUALS_LOTTIE_FRAME_RATE_OR_DURATION_INVALID',
      severity: 'BLOCKER',
      file: relPath,
      message: 'Lottie animation file is not valid JSON.'
    });
    return findings;
  }

  const fr = Number(doc?.fr);
  const ip = Number(doc?.ip);
  const op = Number(doc?.op);
  const durationSeconds = Number.isFinite(fr) && fr > 0 && Number.isFinite(ip) && Number.isFinite(op) ? (op - ip) / fr : NaN;
  if (!Number.isFinite(fr) || fr <= 0 || fr > 120 || !Number.isFinite(ip) || !Number.isFinite(op) || op <= ip || durationSeconds > 60) {
    findings.push({
      code: 'VISUALS_LOTTIE_FRAME_RATE_OR_DURATION_INVALID',
      severity: 'BLOCKER',
      file: relPath,
      frameRate: fr,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 100) / 100 : null,
      message: 'Lottie animation has invalid frame rate (fr=' + fr + ') or excessive duration (>60s).'
    });
  }

  if (Array.isArray(doc?.assets)) {
    for (const asset of doc.assets) {
      if (typeof asset?.p === 'string' && /^data:image\//i.test(asset.p)) {
        if (asset.p.length > 65536) {
          findings.push({
            code: 'VISUALS_LOTTIE_RASTER_BOMB_FORBIDDEN',
            severity: 'BLOCKER',
            file: relPath,
            assetId: asset.id ?? null,
            payloadBytes: asset.p.length,
            message: 'Lottie animation embeds a large base64 raster payload (' + asset.p.length + ' chars > 64KB).'
          });
        }
      }
    }
  }

  return findings;
}

export function visualsSourceFindings(relPath, body) {
  const normalizedFile = String(relPath ?? '').replaceAll('\\', '/');
  if (TEST_FILE_RE.test(normalizedFile)) return [];
  const findings = [];
  const text = String(body ?? '');

  if (/\.svg$/i.test(normalizedFile)) {
    findings.push(...inspectSvgVisualQuality(normalizedFile, text, { standalone: true }));
    return findings;
  }

  if (/\.lottie\.json$/i.test(normalizedFile) || (normalizedFile.endsWith('.json') && /"v"\s*:[\s\S]{0,400}?"layers"\s*:\s*\[/.test(text.slice(0, 1024)))) {
    findings.push(...inspectLottieVisualQuality(normalizedFile, text));
    return findings;
  }

  if (!/\.(?:blade\.php|html?|vue|jsx|tsx|svelte|dart)$/i.test(normalizedFile)) return findings;

  // Web template visual checks
  if (!normalizedFile.endsWith('.dart')) {
    for (const match of text.matchAll(/<img\b/gi)) {
      let quote = null;
      let endIdx = -1;
      for (let i = match.index + 4; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
          if (ch === '\\') { i++; continue; }
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === '>') { endIdx = i; break; }
      }
      if (endIdx < 0) continue;
      const tag = text.slice(match.index, endIdx + 1);
      const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      const isHero = /\b(?:hero|banner)\b/i.test(tag) || /\b(?:hero|banner)\b/i.test(src);

      if (isHero && /\bloading\s*=\s*["']lazy["']/i.test(tag)) {
        findings.push({
          code: 'VISUALS_HERO_LAZY_LOAD_FORBIDDEN',
          severity: 'HIGH',
          file: normalizedFile,
          src,
          message: 'Above-the-fold hero/banner <img> uses loading="lazy", degrading LCP performance.'
        });
      }

      const hasExplicitDims = /\bwidth\s*=\s*["']?\d+/i.test(tag) && /\bheight\s*=\s*["']?\d+/i.test(tag);
      const hasAspectOrSizeClass = /\b(?:aspect-|w-\d+|h-\d+|size-\d+|object-cover|fill)\b/.test(tag) || /\baspect-ratio\s*:/i.test(tag);
      if (!hasExplicitDims && !hasAspectOrSizeClass && (isHero || /^(?:\/assets\/generated\/|\/images\/generated\/)/i.test(src))) {
        findings.push({
          code: 'VISUALS_WEB_IMG_CLS_UNBOUNDED',
          severity: 'HIGH',
          file: normalizedFile,
          src,
          message: 'Generated or hero visual <img> lacks width/height attributes or aspect-ratio sizing, risking Cumulative Layout Shift (CLS).'
        });
      }
    }

    // Inline SVG raster wrapper check
    for (const svgMatch of text.matchAll(/<svg\b[\s\S]*?<\/svg\s*>/gi)) {
      if (/<image\b/i.test(svgMatch[0]) || /data:image\//i.test(svgMatch[0])) {
        findings.push({
          code: 'VISUALS_SVG_RASTER_WRAPPER_FORBIDDEN',
          severity: 'BLOCKER',
          file: normalizedFile,
          message: 'Inline <svg> embeds a raster <image> wrapper instead of true vector paths.'
        });
      }
    }
  }

  // Animation reduced-motion check for Lottie / Rive / Canvas animations
  if (/\b(?:Lottie\.asset|RiveAnimation\.asset|lottie-player|<canvas\b[^>]*data-animation)\b/i.test(text)) {
    if (!/\b(?:prefers-reduced-motion|disableAnimations|reducedMotion|motion-reduce)\b/i.test(text)) {
      findings.push({
        code: 'VISUALS_ANIMATION_REDUCED_MOTION_MISSING',
        severity: 'HIGH',
        file: normalizedFile,
        message: 'Rich animation (Lottie/Rive/Canvas) is rendered without checking prefers-reduced-motion / MediaQuery.disableAnimations.'
      });
    }
  }

  return findings;
}

function loadMediaManifest(root) {
  for (const rel of [VISUAL_PRODUCTION_FILE, '.executionkit/visual/media-production.json']) {
    const full = path.join(root, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      const doc = safeReadJson(full);
      if (doc && typeof doc === 'object') {
        return { rel, full, stat: fs.statSync(full), doc };
      }
    }
  }
  return null;
}

export function inspectVisualManifestDeep(root, { changedFiles = null, strictFixture = true } = {}) {
  root = path.resolve(root);
  const findings = [];
  const manifestInfo = loadMediaManifest(root);
  if (!manifestInfo) return findings;

  const { doc: spec, stat: manifestStat } = manifestInfo;
  const surfaces = Array.isArray(spec.surfaces) ? spec.surfaces : [];
  const assets = Array.isArray(spec.assets) ? spec.assets : [];
  const surfaceMap = new Map();

  for (const s of surfaces) {
    if (s && typeof s.source === 'string') {
      surfaceMap.set(s.source, s);
      const roles = s.roles ?? {};
      for (const role of REQUIRED_VISUAL_ROLES) {
        if (!roles[role] || !['required', 'not_applicable'].includes(roles[role].state)) {
          findings.push({
            code: 'VISUALS_SURFACE_ROLES_UNMAPPED',
            severity: 'BLOCKER',
            file: s.source,
            role,
            message: 'Surface "' + s.source + '" is missing mandatory visual role mapping for "' + role + '".'
          });
        }
      }
    }
  }

  // Incremental changed surface checks
  if (Array.isArray(changedFiles) && changedFiles.length) {
    const config = safeReadJson(path.join(root, 'execution.config.json')) ?? {};
    const discovered = detectVisualSurfaces(root, 10000, config?.visual?.surfaceScope);
    const discoveredPaths = new Set((discovered.surfaces ?? []).map((x) => x.path));

    for (const file of changedFiles) {
      const norm = String(file).replaceAll('\\', '/').replace(/^\.\//, '');
      if (!discoveredPaths.has(norm)) continue;
      if (!surfaceMap.has(norm)) {
        findings.push({
          code: 'VISUALS_SURFACE_ROLES_UNMAPPED',
          severity: 'BLOCKER',
          file: norm,
          message: 'Changed UI surface "' + norm + '" is not mapped in ' + manifestInfo.rel + '.'
        });
      }
    }
  }

  // Deep asset & variant inspection
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') continue;
    const isSyntheticFixture = !strictFixture && asset.provenance?.producerId === 'fixture-author';
    const role = asset.role;
    const origin = asset.provenance ?? asset.origin ?? {};
    let variants = [];
    if (Array.isArray(asset.variants)) {
      variants = asset.variants;
    } else if (asset.variants && typeof asset.variants === 'object') {
      for (const [key, val] of Object.entries(asset.variants)) {
        if (typeof val === 'string') {
          const parts = key.split(':');
          const mode = parts.length > 1 ? parts[1] : parts[0];
          const palette = parts.length > 1 ? parts[0] : 'default';
          variants.push({ palette, mode, path: val });
        } else if (val && typeof val === 'object') {
          variants.push(val);
        }
      }
    }
    if (!variants.length && typeof asset.file === 'string') {
      variants.push({ palette: 'default', mode: 'light', path: asset.file });
    }

    // Check creative priority:
    // 1. icon & empty roles should be vector/procedural unless exempted
    // 2. WEB_LICENSED_EDITED_RASTER / licensed-web-edited requires quotaExhaustionReason or vectorFallbackReason/vectorExemptionReason
    const sourceMethod = origin.method ?? origin.type ?? asset.sourceMode ?? '';
    const isWebFallback = ['licensed-web-edited', 'WEB_RESEARCHED_MODIFIED', 'WEB_LICENSED_EDITED_RASTER'].includes(sourceMethod);
    if (isWebFallback && !isSyntheticFixture) {
      const hasFallbackReason = Boolean(
        origin.quotaExhaustionReason ||
        origin.vectorFallbackReason ||
        origin.vectorExemptionReason ||
        asset.vectorExemptionReason ||
        origin.searchQuery
      );
      if (!hasFallbackReason) {
        findings.push({
          code: 'VISUALS_CREATIVE_PRIORITY_VIOLATION',
          severity: 'HIGH',
          file: asset.source ?? asset.file ?? manifestInfo.rel,
          assetId: asset.id,
          role,
          method: sourceMethod,
          message: 'Asset "' + asset.id + '" uses web raster fallback (' + sourceMethod + ') without documenting quotaExhaustionReason or vectorFallbackReason.'
        });
      }
    }
    if (['icon', 'empty'].includes(role) && ['licensed-web-edited', 'WEB_RESEARCHED_MODIFIED', 'WEB_LICENSED_EDITED_RASTER', 'generated', 'HOST_GENERATED'].includes(sourceMethod)) {
      const hasRasterOnly = variants.length > 0 && variants.every((v) => v?.mime && v.mime !== 'image/svg+xml' && v.mime !== 'application/lottie+json');
      if (hasRasterOnly && !asset.vectorExemptionReason && !origin.vectorExemptionReason) {
        findings.push({
          code: 'VISUALS_CREATIVE_PRIORITY_VIOLATION',
          severity: 'HIGH',
          file: asset.source ?? manifestInfo.rel,
          assetId: asset.id,
          role,
          method: sourceMethod,
          message: 'Visual role "' + role + '" on asset "' + asset.id + '" uses non-vector mode (' + sourceMethod + ') without vectorExemptionReason; Creative Priority #1 requires native vector/SVG first.'
        });
      }
    }

    // Intra-asset light/dark duplicate binary check
    if ((asset.themeAware !== false) && variants.length >= 2) {
      const byPalette = new Map();
      for (const v of variants) {
        if (!v || typeof v !== 'object') continue;
        const pal = v.palette ?? 'default';
        if (!byPalette.has(pal)) byPalette.set(pal, new Map());
        byPalette.get(pal).set(v.mode, v);
      }
      for (const [pal, modeMap] of byPalette.entries()) {
        const light = modeMap.get('light');
        const dark = modeMap.get('dark');
        if (light && dark && !asset.themeNeutralReason && !origin.themeNeutralReason) {
          let sameBinary = light.path === dark.path || Boolean(light.sha256 && light.sha256 === dark.sha256);
          if (!sameBinary && typeof light.path === 'string' && typeof dark.path === 'string') {
            const b1 = safeReadBuffer(path.join(root, light.path));
            const b2 = safeReadBuffer(path.join(root, dark.path));
            if (b1 && b2) {
              sameBinary = crypto.createHash('sha256').update(b1).digest('hex') === crypto.createHash('sha256').update(b2).digest('hex');
            }
          }
          if (sameBinary) {
            findings.push({
              code: 'VISUALS_INTRA_ASSET_DUPLICATE_VARIANT_BINARY',
              severity: 'BLOCKER',
              file: light.path ?? asset.source ?? manifestInfo.rel,
              assetId: asset.id,
              palette: pal,
              message: 'Theme-aware asset "' + asset.id + '" (palette "' + pal + '") uses identical binary/file for light and dark modes.'
            });
          }
        }
      }
    }

    // Inspect each variant file
    for (const v of variants) {
      if (!v || typeof v.path !== 'string') continue;
      let fullVariant;
      try {
        fullVariant = resolveProjectPathSafe(root, v.path, 'visual variant');
      } catch {
        continue;
      }
      const bytes = safeReadBuffer(fullVariant);
      if (!bytes) continue;
      const mime = v.mime ?? formatOf(bytes);

      if (mime === 'image/svg+xml') {
        if (!isSyntheticFixture) {
          findings.push(...inspectSvgVisualQuality(v.path, bytes.toString('utf8'), { role, standalone: true }));
          try {
            const info = inspectSafeSVG(bytes);
            const minDim = ROLE_MIN_DIMENSIONS[role];
            if (minDim && (info.width < minDim.width || info.height < minDim.height)) {
              findings.push({
                code: 'VISUALS_ROLE_DIMENSIONS_TOO_SMALL',
                severity: 'BLOCKER',
                file: v.path,
                assetId: asset.id,
                role,
                width: info.width,
                height: info.height,
                minWidth: minDim.width,
                minHeight: minDim.height,
                message: 'Visual SVG variant "' + v.path + '" for role "' + role + '" has viewBox/dimensions ' + info.width + 'x' + info.height + ' (minimum ' + minDim.width + 'x' + minDim.height + ').'
              });
            }
          } catch {
            // handled by media-integrity
          }
        }
      } else if (mime === 'application/lottie+json') {
        findings.push(...inspectLottieVisualQuality(v.path, bytes));
      } else if (['image/png', 'image/webp', 'image/avif', 'image/jpeg'].includes(mime)) {
        try {
          const info = inspectMediaBytes(bytes, mime);
          const minDim = ROLE_MIN_DIMENSIONS[role];
          if (minDim && !isSyntheticFixture && (info.width < minDim.width || info.height < minDim.height)) {
            findings.push({
              code: 'VISUALS_ROLE_DIMENSIONS_TOO_SMALL',
              severity: 'BLOCKER',
              file: v.path,
              assetId: asset.id,
              role,
              width: info.width,
              height: info.height,
              minWidth: minDim.width,
              minHeight: minDim.height,
              message: 'Visual variant "' + v.path + '" for role "' + role + '" is ' + info.width + 'x' + info.height + 'px (minimum ' + minDim.width + 'x' + minDim.height + 'px).'
            });
          }
        } catch {
          // handled by media-integrity
        }
      }
    }

    // Check review receipt screenshot dimensions and staleness
    if (typeof origin.reviewEvidenceRef === 'string') {
      try {
        const reviewFull = resolveProjectPathSafe(root, origin.reviewEvidenceRef, 'visual review proof');
        const reviewDoc = safeReadJson(reviewFull);
        if (reviewDoc?.screenshot?.path && !isSyntheticFixture) {
          const shotFull = resolveProjectPathSafe(root, reviewDoc.screenshot.path, 'visual review screenshot');
          const shotBytes = safeReadBuffer(shotFull);
          if (shotBytes) {
            const shotMime = formatOf(shotBytes);
            const shotInfo = inspectMediaBytes(shotBytes, shotMime);
            if (shotInfo.width < SCREENSHOT_MIN.width || shotInfo.height < SCREENSHOT_MIN.height) {
              findings.push({
                code: 'VISUALS_SCREENSHOT_DIMENSIONS_TOO_SMALL',
                severity: 'BLOCKER',
                file: reviewDoc.screenshot.path,
                assetId: asset.id,
                width: shotInfo.width,
                height: shotInfo.height,
                message: 'Review screenshot "' + reviewDoc.screenshot.path + '" is ' + shotInfo.width + 'x' + shotInfo.height + 'px (minimum ' + SCREENSHOT_MIN.width + 'x' + SCREENSHOT_MIN.height + 'px).'
              });
            }
          }
        }
        if (asset.source && Array.isArray(changedFiles) && changedFiles.includes(asset.source)) {
          const srcFull = resolveProjectPathSafe(root, asset.source, 'visual surface');
          if (fs.existsSync(srcFull) && reviewDoc?.sourceSha256) {
            const currentSha = crypto.createHash('sha256').update(fs.readFileSync(srcFull)).digest('hex');
            if (currentSha !== reviewDoc.sourceSha256) {
              findings.push({
                code: 'VISUALS_CHANGED_SURFACE_STALE_RECEIPT',
                severity: 'HIGH',
                file: asset.source,
                assetId: asset.id,
                message: 'Changed UI surface "' + asset.source + '" has modified content since review receipt "' + origin.reviewEvidenceRef + '" was sealed.'
              });
            }
          }
        }
      } catch {
        // ignore missing proof here; handled by inspectVisualProduction
      }
    }
  }

  return findings;
}

function walkVisualFiles(root, dir, out = [], limit = 6000) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (out.length >= limit) break;
    if (entry.name.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build', 'coverage', 'storage'].includes(entry.name)) continue;
    const next = path.join(full, entry.name);
    const rel = path.relative(root, next).replaceAll('\\', '/');
    if (entry.isDirectory()) walkVisualFiles(root, rel, out, limit);
    else if (/\.(?:svg|lottie\.json|blade\.php|html?|vue|jsx|tsx|svelte|dart)$/i.test(entry.name)) out.push(rel);
  }
  return out;
}

export function guardVisualsIntegrity(root, { files = null, mode = 'changed', all = false, strictFixture = true } = {}) {
  root = path.resolve(root);
  if (all) mode = 'all';
  let candidates = [];
  if (Array.isArray(files) && files.length) {
    for (const raw of files) {
      const f = String(raw).replaceAll('\\', '/').replace(/^\.\//, '');
      const full = resolveProjectPathSafe(root, f, 'Visuals Guard source');
      if (fs.existsSync(full) && fs.statSync(full).isFile()) candidates.push(f);
    }
  } else {
    for (const dir of ['public', 'resources', 'src', 'app', 'assets', 'pages', 'views', 'web', 'lib']) {
      walkVisualFiles(root, dir, candidates);
    }
  }
  candidates = [...new Set(candidates)].filter((f) => !TEST_FILE_RE.test(f));

  const findings = [];
  let scanned = 0;
  for (const file of candidates) {
    const text = safeReadText(path.join(root, file));
    if (text === null) continue;
    scanned++;
    findings.push(...visualsSourceFindings(file, text));
  }

  findings.push(...inspectVisualManifestDeep(root, { changedFiles: Array.isArray(files) ? files : null, strictFixture }));

  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const hasManifest = Boolean(loadMediaManifest(root));
  const status = scanned === 0 && !hasManifest && findings.length === 0
    ? 'NOT_APPLICABLE'
    : (blockerCount > 0 || highCount > 0) ? 'FAIL' : 'PASS';

  return {
    schemaVersion: 'executionkit-visuals-guard/v1',
    kind: 'visuals',
    mode,
    status,
    ok: status !== 'FAIL',
    filesScanned: scanned,
    blockerCount,
    highCount,
    findings
  };
}
