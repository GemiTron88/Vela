# Visual OS — Current Rendered State Contract

The acceptance model is **CURRENT_STATE**: capture each selected meaningful state, inspect the actual rendered image, fix defects in source, recapture and reinspect. The newest run owns `.executionkit/visual/current.json`; old runs cannot fill missing cells.

## 1. Responsibilities & Cryptographic Keys

- **Visual OS** owns surface/state discovery, pairwise/impact capture plans, rendered PNG artifacts, computed DOM/Flutter geometry, and vision critic review.
- **Audit OS** independently recomputes coverage, pixels, hashes, runtime health, provenance, and review bindings.
- **Operator Keys:** `EXECUTIONKIT_VISUAL_CAPTURE_KEY`, `EXECUTIONKIT_VISUAL_REVIEW_KEY`, and `EXECUTIONKIT_VISUAL_AUDIT_KEY` must be distinct (`>= 32` bytes) and kept outside repository files. `producerId` and `reviewerId` must differ.

## 2. Configuration, Census & Planning

- `executionkit.visual.json` (`schemas/visual-config.schema.json`) binds routes/screens to real source, owner, role/persona, auth, criticality, entry method, and states (`default`, `empty`, `loading`, `offline`, `error`, `forbidden`, `dynamic`). Unresolved discoveries block the denominator.
- `executionkit visual plan . --mode impact --base <sha>` selects changed surfaces and shared layout/token/locale dependents; `--mode full` covers the entire census without silent truncation.

## 3. Capture, Geometry & Native Critic Review

```bash
executionkit visual discover|plan|capture|inspect|remediate|validate|certify|boundary .
```

- **Capture:** Uses pinned `playwright-core` (full-page web PNGs by default, masked sensitive selectors, computed geometry, active stylesheet/FontFace load states, hit-testing of visible actions, console/page/network errors) or native Android (`adb` + foreground package) / iOS / Flutter semantics hooks. Builds expose a nonce-bound live probe (`gitSha`, `fixtureHash`, `runtimeHealthy: true`).
- **Geometry P1 Violations:** Overflow, clipped/off-screen actions, tiny touch targets, low contrast, missing/unreadable CSS, failed primary fonts, detached fixed bottom contact/WhatsApp bars, or actions obscured by overlays.
- **Vision Critic (`visual inspect`):** Default provider `'antigravity'` writes an enriched `native/requests/<cell>.json` (`executionkit-native-visual-request/v1`, containing surface/state/locale/theme/viewport metadata, pre-computed `geometryFindings`, `appliedTypefaces`, the 5-part Design Direction & 9-pass refinement framework, and `responseShape`) and returns `REVIEW_REQUIRED` until an independent reviewer (`reviewerId !== producerId`) inspects the actual PNG screenshot and submits its signed response via `executionkit visual inspect . --run <runId> --cell <cellId> --response <file>` (or `EXECUTIONKIT_VISUAL_HOST_EXECUTOR`), sealing `native/responses/<cell>.json` and `reviews/<cell>.json` across all 21 quality dimensions bound to the exact screenshot SHA-256.
- **Certification (`visual certify`):** `REVIEW_REQUIRED` is never PASS. `P0/P1` findings return FAIL and cannot be waived. `P2`/review dispositions require concrete rationale and finite expiration. `visual remediate . --task-findings` routes defects into canonical `TODO.md`. Release validation expires after 1 hour.

## 4. Journey Checkpoints & Source Artwork Gate

- **Journey Checkpoints:** `executionkit.journeys.json` may declare up to 12 `visualCheckpoints: [{id, surface, state}]` per journey via `startJourneyVisualObservation` and `recordJourneyVisualCheckpoint` without repeating navigation or writes.
- **Source Artwork Gate:** Separate from rendered screenshots, UI projects enforce [visual-production-v5-contract.md](visual-production-v5-contract.md) (`executionkit visual media-plan|media-check .`) at wave, phase, and release boundaries.
