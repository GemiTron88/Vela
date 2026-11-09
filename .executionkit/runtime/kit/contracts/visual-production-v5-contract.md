# Mandatory Visual Production Gate Contract

**Normative engineering contract for UI-bearing projects** at wave, phase and release boundaries. Non-UI infrastructure projects return `NOT_APPLICABLE`.

## 1. Executable Planning & Verification

```bash
executionkit visual media-plan . --offset=0 --limit=50
executionkit visual media-check . --limit=50
```

- `media-plan` is read-only and paginated: it scans UI sources within `visual.surfaceScope` and emits tasks for every applicable `hero`, `banner`, `background`, `illustration`, `icon`, `empty`, and `dynamic` role.
- `media-check` verifies the surface census plus real binary artifacts, cryptographic receipt signatures, and palette/mode variants. Unpartitioned apps with >1,000 primary surfaces fail closed with `VISUAL_SURFACE_CENSUS_INCOMPLETE` until `surfaceScope.partitions: [{id, includeRoots, excludeRoots}]` covers 100% of discovered UI surfaces without gaps (`VISUAL_PARTITION_COVERAGE_GAP`).

## 2. Generation & Adaptation Cascade

Always use the lowest-cost valid method meeting premium art quality:
1. **Native Vector / Structured Drawing First (`authored-vector`):** Hand-author original, safe static `SVG` (`local-svg-code` with `sourceSvg: {path, sha256}`, no embedded rasters, scripts, external refs, or DTDs) or procedural code-drawn primitives (`flutter-custom-painter`, `css-drawing`, `html-canvas`, `procedural-graphics`, `native-chart-primitives`, `licensed-icon-system` with `sourceCode: {path, sha256, symbol}`). Vector art consumes zero AI raster quota.
2. **Host Image Generator (`generated` / `owned-original`):** Reserve raster generation quota for complex photographic or editorial scenes that vector drawing cannot match. Requires capture-key-signed `executionkit-visual-artwork-production/v1` (`productionEvidenceRef`).
3. **Licensed Online Research + Real Adaptation (`licensed-web-edited`):** When generator quota is exhausted or unavailable, research high-match images with verified commercial modification rights (`CC0`, `public-domain`, `CC-BY` with attribution, or held paid commercial license). Reject `NC`, `ND`, watermarks, or unclear provenance. Apply real layout/RTL/palette/Light-Dark edits (`crop_resize`, `palette_adapt`, etc.) and bind a review-key-signed `executionkit-visual-license/v2` receipt (`original`, `rightsSnapshot`, `attribution`, `editsSha256`) plus signed search proof.
4. **Safe Unfulfilled State:** If no valid source satisfies a screen, leave the task `BLOCKED` with exact reason. Never fabricate hashes, URLs, or signatures.

## 3. Manifest, Theme Variants & Cryptographic Receipts

Root `executionkit.media.json` (`schemaVersion: "executionkit-media-production/v1"`):
- **Theme Reconciliation (`VISUAL_PRODUCTION_THEME_CENSUS_MISMATCH`):** `theme.paletteIds[]` and `theme.modes[]` must include every palette and mode (`light`, `dark`) declared in `executionkit.design.json`, `design/tokens.json`, or `executionkit.visual.json`. Discover actual project tokens; never force hardcoded palette colors across unrelated products.
- **Surface Role Mapping (`MEDIA-001`):** Every discovered surface maps all 7 roles to `required` + `assetIds` OR `not_applicable` + `reason` + `reviewCell` + `reviewEvidenceRef` (`executionkit-visual-role-exemption/v2` signed by an independent `reviewerId !== producerId` with decoded local screenshot `{path, sha256}`).
- **Artwork Review (`executionkit-visual-artwork-review/v2`):** Signed by `reviewerId !== producerId`, binding `assetIdentity`, `sourceSha256`, `variantSha256` for every `palette × mode` variant (`neutral/neutral` requires `neutralThemeApproved: true`), and a decoded local screenshot `{path, sha256}`.
- **UI Bindings:** `uiBindings[]` verifies direct `{path, sourceSha256, reference}` or indirect `{path, sourceSha256, componentPath, componentSha256, componentSymbol, reference}` chains.
- **Candidate & Run Binding:** Receipts declaring `projectIdentity`, `gitSha`, `visualRunId`, and `reviewCell` are verified against `executionkit.visual.json` and `.executionkit/visual/runs/<runId>/manifest.json`.
- **Server-Cached Delivery:** `delivery: "server-cached"` requires WebP plus audit-key-signed `executionkit-media-cache/v1` (localFirst, persistent, hashVerified, authorizedScope, offlineRestartTested) and `executionkit-media-publication/v1` (HTTPS 200, WebP MIME).

## 4. Binary Decoding, Fonts, Lottie & Decision OS Enforcement

- **Binary & Format Integrity (`MEDIA-002`):** Built-in PNG/SVG validators and `lib/media-decode.py` (Pillow JPEG/WebP/AVIF, max 12 MiB, 24M pixels, no unexpected animation) verify actual bytes. `inspectFontBytes` validates `.woff2/.woff/.ttf/.otf` headers; `inspectLottieBytes` validates `.lottie.json` and rejects scripts/external URLs. Duplicate hashes across distinct assets fail (`VISUAL_PRODUCTION_DUPLICATE_ASSET_BINARY`) unless `sharedFromAssetId` + `sharedReuseReason` is declared; unreferenced files in `managedAssetDirs` fail (`VISUAL_PRODUCTION_UNUSED_ASSET`).
- **Decision OS Hard Denial:** Nonzero `visualProductionMissingCount`, `visualProductionUnverifiedCount`, or `visualProductionUnsafeCount` hard-denies `quality_gate`, `release_approve`, `release_publish`, and `deploy`.
