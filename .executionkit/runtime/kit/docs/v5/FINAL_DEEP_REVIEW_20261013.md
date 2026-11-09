# Final deep source review — 2026-10-13

The final source review corrected execution, goal alignment, update safety and v5 gate gaps. Published implementation: `4c382650ac0a4fd7bd6de83ec4f3b6b22162bd42`. The tested local commit `7312fd2e5c980caa56f8f7844ce78be46e728764` and published implementation have the identical Git tree `6b6c9d80e1592e7d393831165bf1bbb0714c3c1d`.

This is verification of the `5.0.0-dev` source candidate. Current code and executable fixtures are the evidence; this review does not certify stable v5, production, physical devices or undocumented product intent.

## Corrected findings

| ID | Gap | Result and evidence |
|---|---|---|
| F01 | ASCII output on one stream was truncated before its limit was checked and could report exit 0 | Combined cumulative byte accounting detects overflow and returns `MAXBUFFER`; reproduced against baseline `708faec` |
| F02 | Chunk-by-chunk string conversion could corrupt split UTF-8; JSON escaping could exceed the outer buffer | Preserve bytes and decode once; budget the JSON transport for escaped output; Arabic and NUL-output regressions pass |
| F03 | A leader exiting on TERM could cancel its forced-kill timer while a resistant descendant survived | Force termination of the remaining process group before completion; heartbeat-file regression proves the descendant stops |
| F04 | Nested detached runners could escape parent cancellation | Propagate cancellation into their child groups; handle expected broken parent pipes without an unhandled `EPIPE`; nested heartbeat and captured-stderr regressions pass |
| F05 | Zero or non-finite subprocess budgets could become a default long wait | Reject invalid budgets; allow valid short inherited budgets without adding a second |
| F06 | A reconciliation exception could leave an old PASS receipt; parsed PASS did not require successful process exit | Every failed attempt writes a new FAIL gate; exception and exit-contract regressions pass |
| F07 | An expired inherited reconciliation deadline was extended to at least one second | Preserve the exact deadline, refuse an expired attempt before spawning, and reject completion past the deadline |
| F08 | Only the first Objective line was hashed, and projected objectives were ignored | Hash continuation lines and projected objectives; both baseline reproductions now return `REVIEW_REQUIRED` |
| F09 | Changed product files could reconcile without active task context | Missing context blocks integration; task postflight regression exercises the actual changed-file path; archived tasks cannot act as mutable task context |
| F10 | Ordinary Decision advice queried physical-host tooling on every call | Probe only native workloads, use conservative VPS classification for ordinary advice, and retain physical enrollment checks at native execution entrypoints |
| F11 | Upgrade revalidation could wait 30 minutes per helper without a total bound | One bounded worker, 10-minute default total budget, explicit override, progress, pending unfinished checks and fresh timeout failure gate |
| F12 | A valid near-limit KB could be accepted then rejected because JSON escaping enlarged its cache | Consistent serialized-cache bound; padded valid catalog can refresh, reload and advance to the next revision |
| F13 | An interrupted KB refresh could leave a permanent empty lock | Recover an abandoned owner or old legacy empty lock; retain active owners and remove only the acquired lock |
| F14 | Installer/update Git failures could be interpreted as a clean or non-Git project | Bounded Git inspection fails closed, including `--allow-dirty`; doctor refuses failed tracking inspection |
| F15 | Update cache/lock paths could write through a project symlink | Safe project-relative resolution and isolated derived writes; outside-directory regression remains untouched |
| F16 | Self-update could remove a live owner's lock after ten minutes and later remove a different owner's lock | Active local owner remains exclusive regardless of age; abandoned local owners can recover; release matches the acquired owner ID |
| F17 | Cached TTL, future timestamps or distant retry dates could suppress discovery beyond configured policy | Bound cache freshness by configured TTL/retry interval and reject unreasonable future timestamps and invalid policy numbers |
| F18 | Audit's runtime matrix and command entrypoint still selected ten-system/v4-only behavior | v5 requires eleven systems, including local Decision policy and reconciliation evidence; missing Decision evidence fails |
| F19 | v5 Release/readiness and direct deployment could use older paths without current native gates | v5 now requires the current phase prerequisite and candidate-bound native pipeline; direct artifact deployment is refused; release reconciliation uses the bounded worker |
| F20 | v5 Lighthouse validation skipped strict mobile coverage and source identity | Reject incomplete or desktop-only evidence on v5; actual command regression records missing mobile targets |
| F21 | v5 deep integration could fall into legacy hook/MCP acceptance | Use native activation in v5; direct command regression verifies the native strategy; enabled SEO cannot disable its release requirement |
| F22 | Some v5 authorities and worker/acceptance helpers were absent from upgrade invariant coverage | Map v5 Standard/AGENTS, bounded worker, upgrade worker, execution/deep-integration/readiness/tooling helpers; declare the KB manifest as a required Decision runtime surface |
| F23 | Direct legacy repository-tooling setup only refused v4 projects | Extend the native-only refusal to v5; no external repository tooling is added to the execution path |

Permanent regressions are in `tests/v4-cli-performance.test.mjs`, `tests/v5-decision-os.test.mjs`, `tests/v4-audit-evidence.test.mjs`, `tests/v4-update-discovery.test.mjs`, `tests/v4-upgrade-revalidation.test.mjs` and the existing installer/release/production suites. The prior v4 deployment assertion and isolated production test adapter were updated to match the corrected implementation.

## Verification and coverage

| Check | Executed result |
|---|---|
| `npm run check` on the clean tested tree | PASS: 1165 discovered, 1161 passed, 0 failed, 4 explicit live skips; runtime tests 135.618 seconds; all subsequent validation/distribution checks passed |
| `node bin/review-v5.mjs` | PASS: 11 system contracts, 22 invariants, 286 helper syntax checks, 146 CLI help surfaces |
| `node bin/audit-cli.mjs` | PASS: 162 real dispatch/refusal/mode/invalid-action cases in disposable local projects |
| `npm run test:launch-service:python` | PASS: 4 guard and 4 host-policy cases |
| Focused review iterations | 146/146 regressions, then 52/52 pipe and CLI cases; the final full suite includes the final changes |
| Hung upgrade Test command on the published code | 1500ms configured budget; FAIL and fresh FAIL gate in 1649ms; unfinished Test check remains pending; no broken-pipe stack trace |

All eleven systems participate in source verification: Execution, Agent, State, Content, SEO, Docs, Audit, Test, Launch, Visual and Decision. Runtime tests cover positive and negative installer, migration, rollback, task/claim, guard and evidence paths. The command matrix includes expected refusal paths where configuration, authorization or live capabilities are absent. A case marked PASS means its command contract behaved correctly; a returned BLOCKED result does not become product acceptance. Helper syntax inspection does not claim every legacy helper was run against a live service.

The first full attempt found one outdated static deployment-message assertion. It was corrected, the parent-pipe handling received an additional regression, and the final complete gate was rerun successfully on the clean tree above. No failed attempt is presented as acceptance.

## Performance and cadence

The baseline comparison executed actual code from `708faec` and the corrected local implementation `5da087a`. Fifty measured ordinary offline Decision calls had median **11.375ms → 0.827ms**, with p95 **49.363ms → 2.792ms**, on Linux x64 / Node v24.19.0 under concurrent source validation. This is a local repeated-call measurement, not physical or production acceptance. The subsequent pipe fix does not change ordinary Decision evaluation.

Task reconciliation keeps the lightweight guard/checkpoint cadence. Its default total budget is 30 seconds; wave, phase and release reconciliation use 5, 10 and 15 minutes. Heavy Test/Audit/Docs/Visual work remains at boundaries. Explicit `--timeout-ms` overrides remain capped; inherited expiry cannot be extended. Upgrade revalidation defaults to one 10-minute total budget and keeps skipped work uncertified. Native mobile execution still requires a detected and owner-enrolled physical workstation; no SDK, emulator or mobile build was run on this host.

## Evidence and remaining acceptance

Machine receipts and original logs are in [evidence/final-review-20261013](evidence/final-review-20261013/): `completion.json`, `source-review.json`, `cli-audit.json`, `reproductions-performance.json`, `upgrade-timeout.json` and `verification-logs.tar.gz`. The completion receipt records artifact SHA-256 values and tested/published tree equality.

Four live Launch/Studio tests skipped because their live credentials/keys were absent. Existing live consumer, staging, physical device/OTA, backup/restore and stable publication tasks remain open. This source review cannot replace those results.

Six existing historical source-phase warnings remain owned by `EK5-PREP-CANONICAL-GATES`: V4.0.4, V4.0.3, V4.0.1, V30-RC and V30-LAUNCH lack a declared phase audit; V4.0.2 does not transitively converge `EK4-402-006`. Their original acceptance history was preserved. Closing these gates requires current independent evidence; source-test success does not silently accept historical release work. Stable v5 publication remains gated by this task and the existing Launch/physical acceptance frontier.
