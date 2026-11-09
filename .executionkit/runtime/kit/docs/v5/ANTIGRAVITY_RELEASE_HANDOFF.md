# ExecutionKit v5 — Antigravity execution handoff

**Owner v5 release decision (2026-10-14):** VPS Staging is **not required** to publish standalone ExecutionKit v5. Retain older staging receipts as historical evidence only; never provision a new staging service/VPS or change production CWP permissions merely to release the Kit. Real production deployments still need exact candidate checks, signed authorization, backups, health and rollback; real Android acceptance still needs a physical workstation/device. See `docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md`.

**Authority:** canonical main; `TODO.md` is the only mutable backlog. Current source line `5.0.0-dev`. This document is an *operational checklist*, not a second task queue. The Kit is owner-only, not SaaS. **No stable release, customer production deployment, live host migration or legacy repository deletion is authorized here.**

## Source-prepared result before host execution

- Eleven systems and bundled deterministic Decision OS remain installed source, with 4.1 compatibility retained.
- Updated Saudi market Lang Guard, mobile fixed-CTA and media critic, Assets Guard purposeful Gemini planning, local generated image signature, Decision quality-gate wiring and compact CLI task cadence.
- Fixed mismatched root `package-lock.json` version (`4.1.0` -> `5.0.0-dev`).
- Added the **manual read-only** exact-SHA Linux source RC workflow `.github/workflows/v5-source-release-candidate.yml` and `scripts/verify-v5-source-candidate.mjs`. It has **no tag, publish or deployment path**. It reuses the existing version-tolerant v4 executable artifact verifier rather than duplicating build logic.
- New regressions `tests/v5-market-visual-assets.test.mjs` and `tests/v5-source-release-gate.test.mjs` are required by `tests/test-baseline.json`. No unrun test or screenshot was marked PASS. Previous 9/9 isolated V8 checks are NOT Node test runner certification.

## 1. Recover exact remote truth before running anything

1. In Antigravity, open `Elwazeery/AI-ExcutionKit` canonical **main**, inspect `git status --porcelain=v1`, remotes, `git rev-parse HEAD`, uncommitted/unpushed work and open PRs before any modifications. Never reset, erase or silently overwrite.
2. Read the current canonical tasks `EK5-MARKET-VISUAL-MEDIA-ACCEPTANCE`, `EK5-WORK-PHASE-CONVERGENCE`, `EK5-PREP-CANONICAL-GATES`, `EK5-GEMITRON-LAUNCH-V2`, `EK5-GEMITRON-PUBLISH`. Do not expand into the 103 historical tasks without release dependencies.
3. Inspect this file and `STANDARD_V5.md`. Select only dependency-ready correction work. Do NOT touch paused FLOW or client production. Keep changes on main as verified fast-forwards with exact HEAD checks.

## 2. Quick targeted source verification, then one authoritative complete suite

Use the verified Node runtime (repository previous source evidence used Node 24.19.0); install declared pinned dependencies. First run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --target tests/v5-market-visual-assets.test.mjs --target tests/v5-source-release-gate.test.mjs --target tests/visual-os-v2.test.mjs --target tests/v5-decision-os.test.mjs --target tests/v4-cli-performance.test.mjs
```

Investigate the *actual* TAP failure if any (older Work session reported 1215 pass, two fail, four live skips **before** the latest changes). Fix the cause and rerun ONLY impacted tests. Do not mask, widen timeouts indiscriminately, delete assertions or substitute mock success. Preserve process-tree termination evidence.

For one **exact** clean candidate SHA, trigger the **manual** GitHub Actions `ExecutionKit v5 Source RC` workflow on main with `candidate_sha` equal to the actual main SHA. Its trusted preflight prevents other refs. It runs the full `npm run check` exactly once, `npm run v5:review`, `npm run cli:audit`, Python native-host policy guards, artifact build and source-only verification. Inspect real logs, job conclusions and downloaded JSON artifacts; record the commit, exact test counts, failures/skips, CLI count, artifact SHA, performance/elapsed timings. If workflow dispatch is unavailable, report that blocker and run the equivalent commands on the authorized source runner, keeping evidence `HOST_RUN` rather than `CI_PASS`. Never fabricate a workflow result.

After any source fix/re-commit, earlier exact-SHA acceptance is stale and must be rerun for the final candidate. Keep a concise single candidate report; failures carry detailed local logs, not dumped terminal/token spam.

## 3. Customer-like integration and genuine independent screenshots

Use **local isolated disposable fixtures**, not VPS Staging, Tayf production or real customer data.

- Saudi `ar-SA` formal business copy, actual Laravel/Blade/JS catalogs, translated keys, true RTL/mobile-first and fonts. Inject Egyptian text (`مش متأكد`, `شوية`) and assert Lang Guard fails and Decision quality gate denies. Formal Saudi commercial copy should pass the deterministic cues, then get a true content/brand review.
- Capture **real** visual states (mobile RTL plus desktop, header/hero, fixed phone+WhatsApp bar, scroll/bottom, images/fonts, forms and errors). Inspect actual PNGs through the independent native image critic; ensure source-bound digest and measured geometry. Correct any displaced CTA/safe area/overlap/large dead space and take new capture. `CAPTURED`/`REVIEW_REQUIRED` does not equal PASS; only a legitimate signed review and certification may pass.
- Test Gemini image generation through the **authorized Antigravity host** on a real visual work item only if imagery materially improves the page. Store generated assets locally, verify brand suitability, alt text, mobile crop, responsive/LCP budget, authenticity and observed loading. If provider unavailable, retain `REVIEW_REQUIRED` instead of inventing assets.
- Test a representative existing v4.1 Laravel consumer's real v4 -> v5 upgrade and rollback and an isolated new v5 install, preserving native TODO/AGENTS/production data and pinning exact source SHA. Capture actual CLI perf/bytes for task, reconcile, upgrade-revalidation and Visual gates. Enforce targeted tests during edits, full suite only on phase/release.

## 4. Launch OS v2: separate real-host acceptance

Audit current source/parity to APKrelease and Studio without starting a parallel publisher. Prove existing signed role/approval, leases/fencing, revoked attestor, retry/idempotency, key+artifact trust and history compatibility. Reuse existing historical VPS1 web evidence without rerunning it as a v5 distribution prerequisite. Real site deploys require separate owner authorization and site-scoped read-only CWP/vhost/backup/rollback preflight. Do not change active production vhosts/DNS, move DB/keys or restart services without owner-specific permission.

Native mobile proof requires an **owner-enrolled physical Windows/macOS workstation**, actual OS readback, bounded resource quotas, real APK/AAB signing, preservation of app identity/cert/versionCode, Android install/update/restart/rollback and user data/SMS retention, plus optional provider Shorebird billing/history only if explicitly enabled. **NEVER** run Gradle, Flutter mobile builds, Android SDK/emulator or device compilation on any VPS/server/container. If no physical machine/devices/permissions are accessible, mark exact missing gate `BLOCKED_EXTERNAL` and finish all eligible source/physical checks.

Inspect representative Studio API and consumer read paths only when authorized. FLOW is paused: do not mutate or deploy to FLOW merely to complete an acceptance checkbox.

## 5. Canonical convergence and release boundary

Independently resolve **six historic phase-ledger warnings** in `EK5-PREP-CANONICAL-GATES`: V4.0.4, V4.0.3, V4.0.2 (EK4-402-006), V4.0.1, V30-RC and V30-LAUNCH. Preserve prior terminal task history and do not grandfather unproven phase acceptance. Then check the eleven-system source phase `EK5-WORK-PHASE-CONVERGENCE` for the latest exact candidate. Keep external/host, live-product and physical gate statuses distinct.

`EK5-GEMITRON-PUBLISH` remains BLOCKED until mandatory source, consumer and physical evidence plus **explicit owner release approval** are present. Do not bump to stable 5.0.0, create a tag/GitHub Release, delete repositories, or execute a real production cutover without that later authorization.

## 6. Required compact report back to owner

Print one status table with: `SOURCE_TESTS`, `CLI_AUDIT`, `V5_SOURCE_RC`, `V4_TO_V5_UPGRADE`, `MARKET_VISUAL_GEMINI`, `LAUNCH_WEB_SOURCE`, `PHYSICAL_MOBILE`, `HISTORIC_GATES`, `PHASE_CONVERGENCE`, `PUBLISH`. Each row: `PASS|FAIL|PENDING|BLOCKED_EXTERNAL`, exact source SHA, evidence path/link, concise blocker and next safe action. Use at most meaningful P0/P1 reasons in default CLI/chat output. Upload verified source changes to main, not only reports/prompts. Never claim a CI, browser, physical or production PASS from source inspection, fixture existence, or model prose.

## 7. Final Deep Audit & Workstation Release Acceptance Summary (2026-10-14)

- **Receipt**: `docs/v5/evidence/workstation-acceptance-20261014/ACCEPTANCE_RECEIPT.json`
- **GemiMCP Interim Contract**: `docs/v5/GEMIMCP_INTERIM_CONTRACT_20261014.md`
- **Remediated Source Defects**:
  1. `lib/production-deployment.mjs`: `artifactBase(root, cfg, { create = false })` now creates `.executionkit/deployment/artifacts` before `fs.mkdtempSync`, fixing `ENOENT` build failures on fresh repositories.
  2. `bin/init-project.mjs`: fixed nested tuple for `lib/production-storage-report.mjs` and added `bin/inspect-workspace-storage.mjs` to the greenfield init manifest.
  3. `bin/inspect-workspace-storage.mjs`: hardened `stat.blocks === 0` fallback to `stat.size` for non-empty files.
  4. `bin/mcp-server.mjs`: added `kitRoot` dependency resolution fallback in `loadMcp()` and exposed read-only `executionkit_deployment_storage` MCP tool.
  5. `AGENTS.md`: synchronized baseline floor documentation (`125 required test files`) with `tests/test-baseline.json`.
- **Production Artifact Purity & Retention (`EK5-LAUNCH-DISK-HYGIENE` -> `VERIFIED`)**:
  - 3-release (`v1` -> `v2` -> `v3`) isolated benchmark verified `123` source files (`305,835` B) reduced to `13` allowlisted payload files (`17,457` B) and `16` activated release files (`19,650` B with production Composer `vendor/`), a **93.57%** byte reduction; `v3` active + `v2` rollback retained, `v1` pruned, producer cache pruned to `1` current artifact, and unknown historical releases, customer uploads, and DB backups preserved.
- **Workstation Android Release & ADB Lifecycle**:
  - Built and `apksigner`-verified release APK v1 (`1.0.0+1`) and v2 (`1.0.1+2`) on `DESKTOP-717CK7V` (`Flutter 3.41.5`, `Android SDK 36.1.0`), verified install (`versionCode=1`), in-place upgrade (`versionCode=2`) with persistent app data survival, mismatched-keystore rejection (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`), version-downgrade rejection (`INSTALL_FAILED_VERSION_DOWNGRADE`), and controlled rollback (`versionCode=1`) on connected Android 11 ADB target (`127.0.0.1:5555`).
- **Publication Gate (`EK5-GEMITRON-PUBLISH`)**:
  - Status: `READY_FOR_OWNER_APPROVAL` (awaiting explicit owner approval before promoting `5.0.0-dev` -> `5.0.0` and creating annotated tag `v5.0.0`).

