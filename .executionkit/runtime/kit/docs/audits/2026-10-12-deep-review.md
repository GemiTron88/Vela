# ExecutionKit deep source review — 2026-10-12

## Scope and source identity

Canonical repository: Elwazeery/AI-ExcutionKit, main, source version 4.1.0. Starting source HEAD: 5543841d1f2a740b6d4991e4b7f1c908092dcf37. All 1019 original blobs were materialized and verified against Git SHA-1; the source tree matched 58f83c9ef9732e9084ec8dbaa10adbd283ca9173. Exact Git HEAD and a shallow local boundary were restored. No host deployment or Android/Flutter/Gradle/SDK/emulator installation was performed.

History consolidation commit: 312801fffe12856faf1bd4845f4d7b9e42029609. GitHub comparisons prove all 49 original non-main tips are ancestors of the consolidated main. Zero open PRs remain. 49 named branches remain until an authenticated deletion path is available.

## Confirmed source corrections

| Finding | Before | Correction and negative verification |
|---|---|---|
| Distribution regression registry | Ten consolidated Launch Service files were discovered but not baselined, breaking the distribution gate | Register all ten in the baseline, retain the 600 minimum, align documented required-file count to 118 |
| Launch Service command parsing | Unknown actions, stop/restart, unknown flags and invalid ports could fall through to start; an explicit absent config could fall back to another config | Strict start/status/help parsing, exit 2 for invalid usage, config lookup fails closed, sample config is never startup fallback |
| Readiness evidence | Any HTTP 200 could report RUNNING; malformed JSON tried to consume the response twice | Read response once; require ready status and a positive integer schema; reject malformed/false 200 and redirects |
| Canonical CLI service routing | Service was absent from command registry/help; action parsing depended on whether a directory named status/start existed | Register service/config/port and parse the action separately from the project path; route real HTTP status checks deterministically |
| Persistent service lifecycle | Canonical start imposed a 30-minute process timeout | Remove the CLI-imposed lifetime timeout; keep bounded status network requests and explicit graceful signal handling |
| Production constructor boundary | Enrollment enforcement was confined to file config loading | Enforce it again before direct server construction or state-directory writes; testing options cannot exempt production |
| Upgrade revalidation | Consolidated mobile service and native host policy changes were outside Launch invariant fingerprints | Launch revision 5 covers mobile adapter, service tree, optional updater source and native host guard; released baselines request Launch revalidation |
| Python cache pollution | Ignored bytecode changed distribution fingerprints and entered runtime packages; pinned-submodule bootstrap failed on a Git-clean source | Exclude Python bytecode/cache directories from source distributions in both compatibility and v4 installers; preserve immutable-runtime drift checks and retire existing cached payload on update |
| False regression-floor evidence | Total discovered cases counted skipped/todo tests as executed evidence | Count successful runtime tests only; real all-skipped and mixed skip/todo subprocess cases cannot satisfy the floor |
| Authority documentation | Root AGENTS/standard still described an unpromoted v4, synchronous host observation and a universal hosted-runner ban | Match live 4.1 source/compatibility distinction, CLI-only entry and the existing Kit-only manual release exception |

## Ten-system review matrix

This is source/fixture coverage, not physical or production certification.

| System | Reviewed behavior and evidence surfaces |
|---|---|
| Execution | Dependencies/lifecycle, canonical TODO/shards, durable task proof, boundary/Product Closure, failed gate enforcement |
| Agent | Resource routing/reachability, claims/ownership, isolated integration, deterministic sequential fallback |
| State | Checkpoint/rehydration/drift, source-first recovery, Amnesia contract |
| Content | Applicability, provenance/depth/localization contracts and executable validator integration |
| SEO | Applicability, content/search contracts, release and performance evidence |
| Docs | Source freshness, incremental knowledge, manual authority preservation, corrected live-standard wording |
| Audit | Independent boundary evidence, negative gate checks and exact candidate binding |
| Test | Complete recursive regression discovery, required inventory/floor, bounded selection and semantic journey evidence |
| Launch | Artifact purity, signing/role separation, SQLite leases/backup, idempotency, workstation guards, service CLI/health/config, upgrade fingerprints |
| Visual | Current-render evidence, premium/component/geometry contracts, stale/bypass rejection and independent review |

Cross-cutting review includes CLI discovery, portability/process adapters, installation/update/rollback, repository knowledge, database and route guards, evidence and invariant fingerprints. Compatibility v2/v3 code remains because older projects need upgrade paths; it is not reintroduced as v4 host architecture.

## Validation checkpoint

- Initial full test suite: 1088 total, 1081 pass, 3 fail, 4 skipped.
- One initial failure was the missing distribution inventory. One bootstrap failure disappeared after exact HEAD restoration. A clean exact-source recheck reproduced the pinned-submodule failure: ignored Python bytecode polluted the source distribution; this is now corrected.
- Focused correction suite: 30/30 pass, including real HTTP probes and CLI subprocess negative cases.
- Distribution validator: PASS, required test files 118.
- Syntax checks: 265 JS/CJS files and 11 Python files passed.
- CLI discovery: all 35 registered commands return successful machine-readable help.
- Server-safe Python policy suites: guard 4/4 and host policy 4/4 pass.
- First clean source candidate 0b278478b0e6ce4601ce19cdf37eb06bfb817157: 1094 tests, 1089 pass, 1 failure (Python cache pollution), 4 live skips.
- Clean tested source `0caa305cad8a0798c97d3cd97eaffb337bb25f17` / tree `fc44fca8a971da6445389b3ad7882e363f38dd92`: **npm run check PASS** with every required stage present; **npm run v4:check PASS**. Full suite 1097 total / 1093 pass / 0 fail / 4 live skips; targeted v4 369/369; packaged smoke 1/1. The floor counts 1093 executed passing tests.
- Cache/floor focused negative and installation rechecks: 6/6 PASS.
- [Machine receipt](2026-10-12-review-evidence/summary.json) and [original compressed logs](2026-10-12-review-evidence/logs.tar.gz) bind results to the tested source SHA; later documentation/evidence-only commits do not claim a new physical or exact-HEAD release certification.

Live Studio credentials are absent, so the four live service tests are skipped explicitly. Synthetic fixture artifact/device assertions never certify a real APK, physical workload limit, native signing, Android device, Shorebird account or production deployment. Existing canonical external-acceptance tasks remain blocking. No version-5 release or production activation is claimed.

## Remaining source/operational frontier

Existing canonical Launch parity, physical workstation/device, signing/provider and consumer cutover tasks remain open. The provider/classifier path in `lib/launch-mobile.mjs` still expects the legacy pinned APKrelease adapter even though the implementation is consolidated under `lib/launch-service`; reconcile that dependency under EK4-LAUNCH-PARITY-008 before retiring the legacy repository. This review does not claim end-to-end provider parity or v5 readiness.

## Source follow-up — 2026-10-13

The identified provider/classifier dependency has been corrected and source-tested under EK5-PREP-ADAPTER. Installed consumers resolve their exact local Kit source, explicit legacy pins remain compatible, and wrong/dirty/symlink/partial pins are rejected. Full source evidence is in [v5 preparation](../v5/PREPARATION_20261013.md). Live provider/device parity remains independently blocked.
