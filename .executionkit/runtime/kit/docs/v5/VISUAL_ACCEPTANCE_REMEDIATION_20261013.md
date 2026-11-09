# Visual OS v5 — rendered presentation acceptance remediation

Code checkpoint: `4569a743af4299e23666f99780658595d2f53558`, tree `99afe5be03cd63517b2ae142028aa3697293d30c`; parent `5e288c90e82a317ce703fa2c76a0f6594e29f9e3`.

Owner-provided Tayf Connect mobile screenshots show an unstyled page with an oversized theme icon, and a styled page with broken hero media and a fixed contact surface overlapping a CTA. These are incident examples. The Tayf repository, deployment, actual Kit version/source receipt, capture manifest and review/certification records were not inspected. This report does not claim which path ran there or certify a client fix.

## Confirmed reusable gaps

- The original ten/eleven-system matrix accepted Visual `REVIEW_REQUIRED`. An isolated evaluation of the original Git source reproduced PASS at wave, phase and release with otherwise passing declared systems. The v4 reconcile classifier had the same permissive status; v5 Decision denial was a backstop, not a reason to leave either layer permissive.
- Visual audit returned `REVIEW_REQUIRED` for a P1 broken image. The wrapper did not promote the rendered audit's errors/unresolved defects into its own findings. Current code propagates them to acceptance, canonical remediation and Decision signals; P0/P1 are FAIL and pending review cannot be accepted.
- A signed soft finding disposition with missing/invalid expiration could fail open through NaN comparisons. Expiration must now be finite and bounded, with a concrete trimmed rationale.
- Documentation claimed native `visual inspect` automatically reviewed screenshots. Its actual default protocol queues requests until a real image reviewer supplies signed image-bound responses. Current output explicitly reports this pending work, with no automatic retry command.
- Re-entering a boundary could discard pending screenshots or completed reviews through recapture. Current valid pending runs are preserved; after reviews, the next step certifies that same run. Missing/corrupt images and source/config drift still require correction or recapture.

## Presentation and coverage enforcement

Fresh web geometry now observes active author CSS/load failures, computed primary font families and matching FontFace load state, visible enabled-action hit regions and control SVG dimensions. Missing CSS, failed/loading primary fonts, blocking overlays and oversized control icons produce P1 findings. Unknown named fonts require review. Legitimate system fonts, unused font declarations, decorative artwork, disabled/inert actions and backgrounds behind a visibly open modal are treated separately. A hidden modal does not suppress action checks.

FontFace loading and computed families do not prove every glyph or conformity to approved typography. Actual image review against project tokens remains necessary. No design premium score or browser result is invented.

Web capture is full-page by default. Full-plan acceptance checks both capture extent and image height against observed document height, rejecting below-fold omissions or a short image relabeled full-page. The existing 24M-pixel decoder limit is checked before browser image allocation. Exceptionally large pages must be bound into meaningful bounded states rather than silently truncated.

Visual invariant revision increased from 3 to 4. Existing installations must use the official updater/revalidation path; old geometry without presentation observations cannot be grandfathered into new acceptance. This source update does not deploy to client projects.

## Screenshot lifecycle

Current images live at `.executionkit/visual/runs/<runId>/images/`; neighboring directories retain geometry, native review requests/responses, image reviews, plan/census and certification. `.executionkit/visual/current.json` points to the current selected cells. CAPTURED is not REVIEWED, and INSPECTED is not independent certification. Release acceptance rechecks the current full run and live probe.

Routine images are derived artifacts, not committed source. Default retention declares 14-day CI diagnostics and 365-day release evidence; actual CI/durable artifact preservation must be configured. Policy text alone does not prove screenshots were saved, retained or reviewed in a project.

## Executed evidence

Final affected group: **96/96 PASS, zero failures/skips, 9,415.940680 ms** across Visual v2, v4 audit/evidence, v5 Decision, v4 reconcile/boundary and upgrade-revalidation tests. Three pre-fix negative cases reproduced defects. The original-source matrix reproduction separately records all six permissive combinations. Collector tests use a DOM model and protocol tests use isolated signed fixtures/PNG data; these are infrastructure acceptance, not actual product/browser screenshots or model reviews.

Agent instruction, canonical documentation and TODO validation passed. Six historical convergence warnings remain. A real native read-only reviewer independently reviewed the source and identified two final edge cases, both corrected and regression-checked. No complete unchanged test suite was rerun.

Terminal Playwright packages exist, but its Chromium executable is absent; no real browser/device/client visual acceptance was executed here. Actual Tayf forensic diagnosis and post-upgrade browser acceptance remain pending. No client repository, FLOW, production services, CWP/DNS/database or native mobile workloads were accessed or mutated.

Commands, source hashes, original matrix output, red-before failures and final logs are under `docs/v5/evidence/visual-20261013/verification.json`.
