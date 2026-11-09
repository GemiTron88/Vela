# Visual OS V2 — current-state implementation and pilot

## Acceptance scope

The user's updated acceptance model is **CURRENT_STATE**: render the current candidate, inspect the actual image, find defects, fix the product, recapture and reinspect. Before/after albums are not mandatory. Historical comparisons are optional forensic tools; copied historical evidence still cannot prove remediation.

Implementation commit: `1d10ee23498b3405d7a9716ee2c6d784db92cbb9`. The follow-up delivery commit registers the focused infrastructure tests and this report. Exact delivery-head command receipts are associated with PR #33 (merged into main at commit `2ab5d1a16caa8d62014e426a371dcb56b9f37789`) and the pilot evidence archive. Do not infer a newer candidate PASS from this Markdown report.

This program belongs to Execution Kit. No FLOW or Entlaqa production implementation was changed. A real, isolated, executable kit fixture was used to verify web infrastructure; this does **not** certify an authenticated customer product, Flutter application, or remote runner.

## Architecture and delivered components

Test OS continues to own pinned native `tester-army/e2e` journeys, replay, live agent fallback, fresh semantic assertions and independent UI/backend postconditions. Visual OS owns canonical surface/state discovery, bounded matrix selection, capture, measured geometry, actual image-bearing vision requests and remediation. Audit OS independently recomputes coverage, image integrity, runtime health and review bindings; it does not accept the producer's PASS label.

| Responsibility | Added or changed components |
| --- | --- |
| Canonical contracts and strict validation | `lib/visual-contract.mjs`, `visual-schema.mjs`, `visual-enums.mjs`; six `schemas/visual-*.schema.json`; pinned standalone validators and audited local runtime helpers |
| Census, impact and risk-aware pairwise planning | `lib/visual-surface.mjs` |
| Generic web capture, Android/iOS adapters, immutable run artifacts/current index | `lib/visual-capture.mjs` |
| Actual PNG decoding, SHA-256, perceptual hash and optional comparisons | `lib/visual-image.mjs` |
| DOM geometry, spacing, overflow, contrast, density and mobile instrumentation findings | `lib/visual-geometry.mjs` |
| Image-bearing critic requests, 21 dimensions, findings and review dispositions | `lib/visual-critic.mjs` |
| Independent read-only verification and source/runtime-bound certificates | `lib/visual-audit.mjs` |
| Same-page native tester-army checkpoints | `lib/visual-journeys.mjs`, `lib/agentic-e2e.mjs` integration |
| Lifecycle and CLI | `lib/visual-boundary.mjs`, `bin/visual-boundary.mjs`, `bin/visual-project.mjs`, CLI registry/dispatch |
| Existing systems and installation | `lib/visual-os.mjs`, v4 Audit/release/reconciliation, installer/native init, invariant registry and system status |
| Project assets | Config/hook templates, managed self-hosted CI, evidence rules, visual/premium workflows/skills, canonical TODO |
| Focused infrastructure verification | `tests/visual-os-v2.test.mjs`, registered in full/v4 suites and the required-file baseline |

Existing component, token/design authority, generic-risk, responsive, accessibility and Flutter source checks remain. Deterministic Playwright and PHPUnit/Pest/backend contracts, Route/DB guards and Lighthouse protections remain complementary requirements.

CLI: `executionkit visual status|discover|plan|capture|inspect|compare|remediate|validate|certify`. Impact/full modes, JSON/human output, explicit failing exit codes, bounded budgets, resumable current runs and canonical task insertion are executable. `compare` is optional, not a certification dependency.

## Evidence model and trust boundary

Every artifact records actual source Git SHA, capture time, cell/surface/state, route/navigation, persona, fixture hash, locale/direction/theme, viewport/device, application build, capture engine, runtime observations, SHA-256 and perceptual hash. The capture hook must observe the real running build and data. Unresolved route/auth/state bindings block; Laravel route groups require a candidate-bound runtime route export rather than guessed middleware.

Capture, review and audit use separate operator keys. The critic receives actual PNG bytes with a fresh image-bound challenge and produces specific observations for all 21 dimensions. Audit reconstructs the request digest and validates the retained provider response, provenance, signatures, image hashes, current index, expected states and runtime logs. These are distinct executable responsibilities; they are not separate human identities. Trusted project instrumentation and operator key custody remain necessary.

A sparse composition creates a review finding. A genuinely image-bound critic may explain an intentional sparse fixture state. Such a disposition cannot dismiss an objective P1/P2 geometry defect. P0/P1 cannot be waived; P2/review acceptance requires a source/image-bound rationale and expiry.

Only the current complete candidate run may certify. Failed or missing cells replace current coverage with gaps instead of borrowing older successful screenshots. Release certificates require a fresh nonce-bound running-app probe and expire after one hour. Archived certificates are historical receipts, not future live approval.

Evidence defaults to CI retention (14 days), with durable release/certification evidence (365 days) under project/operator control. PNGs and sessions are not blindly committed. Capture uses production-shaped synthetic fixtures, masks private fields, excludes raw auth/network trace resources and scrubs retained action logs. Generic production capture is forbidden.

## Executed pilot

| Item | Actual execution |
| --- | --- |
| Pilot | Isolated real HTTP kit stock/workspace fixture with genuine browser interactions and persisted backend state |
| Candidate app Git SHA | `d90ac7f0f68c5ffbaefea9fd1009886a491f0529` |
| App code SHA-256 | `08a8fc355144136bbbd82fd08ec1946481c01b9c6be6823e981d16d0b37cc7bf` |
| Native packages | `e2e@0.18.0`, `@e2e-dev/web@0.13.0`, `playwright-core@1.63.0` |
| Browser | Actual Chromium `153.0.8010.0` |
| Native journey run | `d9ac5832-184c-43e8-9ddd-a757a61eefc0` |
| Current visual run | `610a1950-f378-498f-9a62-bc610b7fe2c2` |
| Full coverage | 5 discovered surfaces; 27 required, captured and actually reviewed cells |
| Scope | Desktop 1280×800/mobile 375×812; light/dark; Arabic RTL/English LTR where declared; loaded/validation-error/form-filled/saving/success |
| Actual image volume | 839,639 bytes; 27 distinct image hashes |
| Final runtime / findings | Zero console/network/uncaught errors; no unresolved P0/P1/P2 findings within this fixture scope |
| Impact execution | Change to shared `receipt.html`: 4 affected surfaces, 16 planned cells |

Three real native journeys passed with live backend and visible-UI postconditions:

1. **KIT-SAVE / critical happy-path:** populate the form, persist both fields exactly once, verify actual backend values and visible success, capture the same agent page.
2. **KIT-REPORT / cross-feature workflow:** navigate from stock to movements/report, validate actual report state without unintended writes, capture the report checkpoint.
3. **KIT-RECOVER / adversarial recovery:** recover from an expired link to the workspace with no writes, verify backend and visible recovery, capture the checkpoint.

The final native run replayed two actual actions and executed one cache miss with the agent. All three semantic assertions were freshly evaluated. It reported five model calls, `handedOff=0`, `misses=1`; this run therefore does **not** prove replay-break handoff. The preceding Test OS program has separately retained actual live handoff failures/fixes. Host token usage was unmetered; a zero token counter is not a free-cost claim.

The native SDK and the Visual capture layer shared the real SDK page/context, rather than replaying business mutations for screenshots. Three journey checkpoints populated the full visual run; generic capture resumed the remaining cells. The full plan gained one meaningful required workspace checkpoint, producing 27 cells rather than duplicating a dummy state.

All 27 actual PNGs were individually viewed by the current conversation's vision reviewer. The real HTTP OpenAI-compatible bridge forwarded the image-bearing requests and fresh challenge to that reviewer; it did not return canned responses. Specific 21-dimension observations, provider responses and signed request/image bindings are retained. The independent full audit returned PASS after a healthy candidate-bound runtime probe. Plain stock/report receipt pages were reviewed as intentionally sparse infrastructure views, not as premium customer dashboards.

Cold-start and interrupted attempts are not reported as successful 3/3 runs. The final successful run is identified explicitly above.

## Actual defects and fixes

The fixture deliberately seeded concrete failures to challenge the kit: 1,100px minimum width causing mobile overflow/off-screen controls, a 24px critical save target, doubled 32px padding, weak CTA hierarchy, poor help contrast and a 650px information void. Actual screenshot review and runtime geometry found them. The faulty capture had 25/26 cells and a rejected blank frame; it correctly could not certify. Only two faulty images received diagnostic vision review, so that run never claimed full visual coverage. The seeded CSS was removed and the fixed current candidate was recaptured and fully inspected.

The pilot also exposed real **kit/integration defects**, which were fixed:

| Defect | Implemented correction / evidence |
| --- | --- |
| Review contracts could imply rendered proof without inspecting pixels | Actual image-bearing provider response plus independent source/runtime/image audit now controls `renderedEvidence.proven` |
| Capture resolved `playwright` while pinned web SDK provides `playwright-core` | Resolve actual project-owned `playwright-core`; actual native/generic capture succeeded |
| Rejected blank captures lost the failure image | Retain original rejected PNG and sealed geometry metadata; faulty rerun preserved the blank frame |
| SDK page was requested before `app.open`, and initial runtime errors could escape listeners | Observe SDK context pages before navigation; lazily resolve the actual page; initial console failures are retained |
| A single intentional centering margin triggered nested-margin inflation | Require actual nested substantial margins; genuine nested spacing remains measured |
| Trace text replacement could corrupt JSON or retain sensitive resources | Parse and recursively redact trace JSON; retain sanitized action/stack data, omit raw network/auth resources |
| Docs commit after journeys invalidated the tested source SHA | Perform candidate-mutating Docs work before Test OS / Visual evidence |
| Review-only whitespace had no bounded way to record intentional composition | Exact finding/image-bound, explained dispositions; objective P1/P2 cannot be dismissed |
| A weaker critic finding could shadow a measured P2 of the same category | Preserve the measured P2 when the critic downgrades it; accepting the weaker finding cannot waive the measured defect |
| The installed runtime imported Zod although installation does not provision npm dependencies | Generate pinned Ajv standalone validators from canonical schemas and distribute audited helper bytes/licenses; real installed CLI and legacy release checks exercise dependency-free execution |
| Optional state fixture/status maps demanded every enum state if configured | Use strict partial records: reject undeclared keys while allowing only meaningful configured states |
| Pilot engine configured the native CDP endpoint using the wrong API type | Use the actual SDK endpoint function and real public `surfaceOf` seam |

A separate **real runtime-negative** run (`61ab5383-b496-4ed7-93ce-991117a41675`) captured a normal-looking workspace whose actual JavaScript emitted `VISUAL_PILOT_BACKEND_INTEGRATION_FAILURE`. Audit rejected it with `VISUAL_RUNTIME_FAILURE`, in addition to its deliberately incomplete diagnostic coverage. The diagnostic did not publish or replace the certified current run. Removing the injected runtime fault and probing the healthy app restored independent current audit PASS.

## Entlaqa independent forensic review

Reference source tree: `15eb86680673aa480c0392df72049d008e9fd2fd`. The real web script captures AFTER then copies it to BEFORE; this is not genuine remediation evidence.

| Reference matrix | Before files | Paired | Byte-identical Git blobs | Changed pairs |
| --- | ---: | ---: | ---: | ---: |
| Light | 126 | 117 | 116 | 1 |
| Dark | 126 | 117 | 116 | 1 |
| English | 126 | 117 | 114 | 3 |

Two real reference PNGs were also inspected: admin spreadsheet blob `fffb1996576344a26d9e60ff2a1ca82864c2ba35` shows missing essential legal data and mixed/clipped English labels in Arabic UI; customer mobile blob `5bc2f6b2b53f786d76eba37b53de108065d5ff21` shows an actual DEBUG banner, warning indicator, light-looking UI in a dark evidence folder, repetitive placeholder media and dense truncated cards. These are sample observations, not exhaustive product findings or a full Entlaqa audit.

## Verification and CI

Twelve focused infrastructure tests cover missing/corrupt/blank/duplicate/copied/stale screenshots, Git/viewport/locale provenance, console/HTTP failures, missing surface/state coverage, unsupported review/PASS, optional historical visual/nonvisual comparison, bounded pairwise/impact/full planning, mobile focus/debug signals, trace privacy and intentional whitespace versus forbidden major dismissal. Assertions exercise failure behavior rather than increasing product test counts.

Final delivery commands: `npm run v4:check` (full tests, explicit v4 tests and packaged-runtime smoke) and `npm run check` (source/distribution/compatibility checks). Exact-head stdout, exit codes and observed counts are delivery artifacts/PR receipts; this report does not treat previous green runs as acceptance.

Managed CI adds **manual self-hosted exact-SHA** impact/certification gates, model/private operator-key configuration, bounded capture/review budgets and always-uploaded failure evidence. Existing deterministic gates remain. Remote workflow dispatch/execution has not been observed in this environment; configured YAML is **not** a remote CI PASS.

## Final acceptance matrix

| Requirement | Status and proof |
| --- | --- |
| Canonical surfaces / expected counts / meaningful states | WEB VERIFIED: actual 5-surface census, 27 cells; unresolved bindings fail |
| Bounded risk/pairwise matrix, impact and full modes | VERIFIED: focused pair-coverage test and real 16-cell impact / 27-cell full run |
| Generic web capture | VERIFIED: isolated contexts, real PNGs, route/state/data/build observations |
| Flutter/mobile architecture | IMPLEMENTED; native runtime certification BLOCKED by missing SDK/device/build/authentication |
| tester-army checkpoints / previous Test OS operational | VERIFIED: actual pinned SDK 3/3, same-page checkpoints and fresh backend/UI receipts |
| Geometry / whitespace / generic/media risks | VERIFIED within fixture: actual DOM measurements and image-bound review; no blind sparse-design failure |
| Actual image content participates in review | VERIFIED: all 27 PNGs viewed; fresh image-bearing request/response binding independently checked |
| Current source/time/data provenance | VERIFIED: actual app Git SHA/fixture/build, image hashes/current index and live probe |
| Before/after proof | OPTIONAL by user direction; copy detection retained and focused-test verified; reference Git copies independently identified |
| Missing / copied / duplicate / stale evidence rejects | VERIFIED with focused negatives and faulty incomplete/blank runtime capture |
| Runtime-error correlation | VERIFIED: actual normal-looking failed-console capture independently rejected |
| Independent Audit / unresolved P0/P1 rejection | VERIFIED: independent verifier rejects producer claims and major dismissals; final scoped audit clean |
| Remediation / recapture / reinspect | VERIFIED: seeded rendered failures found, repaired, current candidate recaptured/reviewed |
| Practical manual CI / retention / privacy | IMPLEMENTED + local checks; remote runner execution NOT RUN |
| Existing useful Visual/Test/backend/guards | PRESERVED; exact delivery-source checks and packaged smoke provide compatibility receipts |
| Real pilot / kit defects fixed | VERIFIED: executable web fixture and real vision/SDK/runtime; kit defects above repaired |
| Authenticated full product / Flutter release / all-runner production acceptance | BLOCKED, canonical task `EK4-VISUAL-002`; fixture evidence does not replace these |

## Limits and handoff

Native Android/iOS capture requires real focus/navigation/semantics/runtime instrumentation; no native device was available here. Authenticated project personas require actual setup hooks, fixtures, role/permission observation and running build probes. No Entlaqa runtime or full authenticated FLOW pilot was available. Dynamic Laravel/Flutter navigation requires explicit/runtime census binding and is not silently guessed.

PNG decoding is deliberately limited to supported bounded 8-bit formats; unsupported encodings block rather than pass. Optional historical pixel comparison requires equal dimensions. Vision remains fallible and cannot replace behavioral/backend correctness. Native host usage in this pilot is unmetered, so billing savings are not quantified. Retention/export and operator keys remain project/operator responsibilities beyond CI expiration.

PR #33 was merged into main at commit `2ab5d1a16caa8d62014e426a371dcb56b9f37789`. Kit-level implementation acceptance is complete (canonical task `EK4-VISUAL-001` ACCEPTED); downstream customer product (FLOW / Entlaqa) authenticated and native device certification remains decoupled and tracked in `EK4-VISUAL-002`. Do not publish or certify a customer product from this kit fixture report.
