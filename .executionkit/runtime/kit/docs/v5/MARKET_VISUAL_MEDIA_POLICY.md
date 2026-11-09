# v5 Market Voice + Visual Media + Mobile Acceptance

**Scope:** Existing Lang Guard, Assets Guard, Visual OS v2 and bundled Decision OS. No new OS, service, model dependency, daemon or repetitive full-suite test trigger.

## Market voice authority (project-specific)

Before content generation, obtain the real business geography, audience and brand register from the approved project brief. Do **not** borrow the operator/agent's Egyptian Arabic style for customer-facing Saudi content. In the *installed project* `execution.config.json`, set:

```json
{
  "surfaceIntegrity": {
    "locales": ["ar-SA"],
    "marketVoice": {
      "locale": "ar-SA",
      "register": "formal",
      "forbiddenDialects": ["ar-EG"],
      "brandVoice": "Professional, accurate Saudi-market commercial Arabic",
      "forbiddenTerms": []
    }
  }
}
```

This profile is an **example for Saudi projects**, not a universal v5 default; other clients may explicitly prefer another register, dialect or market. Do not infer geography from host/IP/domain/code comments. The compiled project language catalog plus Arabic UI copy in actual views/components undergoes bounded deterministic lexical checking. Known Egyptian colloquialisms fail with `LANG_MARKET_DIALECT_MISMATCH`; declaring `ar-SA` in required locales without its market profile fails with `LANG_MARKET_PROFILE_REQUIRED`. Decision OS denies the corresponding `marketVoiceViolationCount` at quality gates. An empty word-list result is **not** an AI semantic brand-voice certification; reviewer must assess context, meaning and copy quality. Avoid scanning personal/customer data or pretending to translate with the Kit.

## Screenshots must be read

Visual OS records real current-source PNGs and compact live DOM geometry. Capture is never review. It checks stylesheet/font state, full-page extent, call/WhatsApp fixed-bar viewport gap, hidden/overlapping CTAs, responsive overflow and media footprint. The independently bound image critic evaluates header/logo balance, navigation, typography, mobile bottom safe-area, first fold, imagery and Saudi brand-language suitability. A bar visibly detached over 48 pixels beyond its bottom placement is P1 when detected as a fixed multi-action contact surface. Media-thin marketing first folds require actual image critique; reviewer can judge a deliberate minimal composition with a reason. A poor or broken screen must cause remediation, new real capture, inspection and certification on exact changed candidate. For queued native review, keep current screenshots and finish signed responses; do not loop recapture or accept CAPTURED/REVIEW_REQUIRED as PASS.

## Gemini media generation, when useful

During planning or a relevant design task, `executionkit guard assets . --all` can surface up to 12 source-only visual-media recommendations. For customer-facing marketing pages, prefer substantive hero artwork, real-device/service scenes, supporting explanatory illustrations and occasional meaningful diagrams over endless colored cards and icons. Use the **host-provided Gemini image-generation capability**, not a new Decision OS model or Kit-side network call. Prepare a concise shot/style plan using the approved brand palette, real business/product facts and expected sections. Generate only the required images at the visual work stage, with a bounded batch and no idle polling. Save generated output as optimized local assets (AVIF/WebP where appropriate), record provenance and review license/rights through the owner's normal workflow, implement semantic alt text, responsive sizes and lazy loading for below-fold media. Keep critical hero images performant (do not indiscriminately lazy-load the LCP hero). No demo placeholders, remote runtime URLs, invented brands, devices or claims. If Gemini capability is unavailable, report `REVIEW_REQUIRED`, do not fake assets or claim completion.

Source references are not proof of media richness. Render and check each changed layout in mobile RTL and desktop before certification. If imagery would obscure instructions or harm usability, the reviewer may prefer a restrained composition with an image-bound reason.

## Performance and acceptance

Task edit: changed-file guard + targeted tests only; **no Gemini calls**, no mass screenshot captures, no full suite. Wave/phase/release: affected/full observed capture according to existing matrix, real image-bound reviews only for current uncovered cells and reuse previous verified images. Keep telemetry/results compact: `status`, severity, code, path/cell, reason, next action; details stay in local evidence. No repeated CLI replay while waiting for native review. At phase/release validate the unchanged full suite once and obtain independent real browser/client acceptance. Source tests are not a Tayf 4.1 production fix or evidence of a newly installed v5 client.

## Mandatory Visual Production method selection (v5)

The earlier source media plan is no longer an acceptance substitute. [`contracts/visual-production-v5-contract.md`](../../contracts/visual-production-v5-contract.md) defines real asset evidence. Create purpose-built **native SVG/vector/pattern illustrations first**, using local code/graphics primitives to conserve small Anti-Gravity image-generation quota. Reserve image generation for complex hero/food/photographic assets. On quota exhaustion or provider unavailability research **license-verified online source images that closely match the exact prompt**, genuinely edit crop/composition, accents and dimensions, preserve credit/license source, and verify all theme variants; no unlicensed/watermarked/NC/ND images. If quality or rights cannot be achieved, return BLOCKED, don't invent visual completion. Online research is host-owned, not performed by deterministic Decision OS. Server raster WebP and app-private local-first caching are product-dependent accepted architecture, and vector SVG may remain original vector when better. Independent real browser/Android visual inspection still required.
