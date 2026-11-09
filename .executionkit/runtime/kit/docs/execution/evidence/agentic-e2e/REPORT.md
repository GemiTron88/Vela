# Agentic E2E implementation pilot

Scope: Execution Kit v4 / Test OS. FLOW was inspected and probed without changing its repository or writing product data. Kit-level implementation is ACCEPTED (`EK4-E2E-001`); authenticated product and physical mobile certification remain BLOCKED in canonical TODO task `EK4-E2E-002`. PR #33 was merged into main at commit `2ab5d1a16caa8d62014e426a371dcb56b9f37789`.

## Architecture delivered

Pinned `e2e@0.18.0`, web engine `0.13.0` and mobile engine `0.10.0` execute native journeys through the existing Test OS. PHPUnit/Pest, Playwright, Flutter, DB/Route guards, Lighthouse and other applicable deterministic protections remain. The manifest defines one critical happy path, one realistic cross-feature workflow and one adversarial/recovery journey for every declared role/platform target. Native mobile requires an actual suitable device/build runner; a narrow browser viewport is not mobile certification.

`executionkit test journeys . --init --platform web|android|ios` installs the scaffold contract without overwriting existing suites. `--dry-run` validates admission; execution creates a fresh nonce, verifies the live application revision, runs the actual upstream CLI and consumes its complete published report schema. Source, title, target, cleanup, model decisions, complete screenshots/traces/logs and independent live API/DB/UI receipts are checked. Release revalidates the actual files and current source instead of trusting a PASS claim.

Replay caches actions only. Semantic judgments and backend/UI oracles execute afresh. Native non-strict replay hands off to the agent on stale controls or changed end state. Serial execution, no retries, fail-fast, explicit call/step/time budgets and scoped CI caches keep cost bounded. Risk/task mappings and a distinct-invariant rule prohibit test-count inflation. The Kit's existing regression floor preserves its protections; it is not a product quality metric.

## Real executions

The adapter pilot used the real published producer and a real local HTTP application with independent API reads. Its fixture is committed under `tests/fixtures/agentic-runtime`, with `npm run test:agentic-runtime` for an explicitly configured authorized model. These are adapter observations, not FLOW acceptance. `pilot-summary.json` archives producer IDs, report hashes, semantic steps, oracle receipts and artifact hashes. It is historical evidence and cannot be reused as a current release gate.

| Execution | Observed result |
|---|---|
| Cold healthy fixture | All three native journeys passed; 10 live model calls, three cache misses. The Kit correctly rejected incomplete host evidence before instrumentation was repaired. |
| Warm healthy fixture | Kit 3/3 PASS, six fresh backend/UI postconditions, three replayed action steps and three live model calls. Independent release-style revalidation passed. Calls fell 70%; this is not a token or currency estimate. |
| Renamed control / replay handoff | Actual agent fallback completed all three upstream journeys. The Kit rejected a trace whose registered bytes changed during engine/replay cleanup. |
| Immutable evidence repair | The public ArtifactStore captured registered bytes before cleanup. All three journeys and independent checks passed, including a live replay handoff; the original report hashes were preserved. |
| Partial save fault | The visible page confirmed `Widget — EG`, and the fresh semantic UI assertion passed. The independent API oracle found `country: null`. The journey and gate failed; the remaining journeys were skipped by fail-fast and cannot count towards 3/3. |
| Follow-up host IPC failure | A later interactive-host run failed when its response file became visible before complete JSON was written. The gate rejected the run. The scratch host now waits for complete JSON; atomic file publication is required for custom bridges. This failure is archived and is not a product defect or a replacement for the earlier completed 3/3 run. |
| FLOW `/login` | Real public sign-in navigation reached actionable phone/password fields. An initial ambiguous deterministic textbox locator failed; the corrected phone-field check passed in a separate fresh run. |
| FLOW `/portal-links` | Unauthenticated access reached the visible OAuth sign-in form. Authenticated role behavior and return-path correctness were not tested. |
| FLOW invalid statement link | A real browser reached an English `404 / Not Found` with no visible recovery, help or contact action. The agent rejected the recovery journey. |

FLOW source `tests/Feature/Portal/StatementPortalTest.php` at `c40d3683717fcbe0c7ef6fdc7a9861c677aa5bf3` asserts only HTTP 404 for revoked statement/PDF links. That contract does not establish recoverable UX. The deployed revision was not independently attested, and that PHP suite was not run on the deployed build; this is a diagnostic finding and a source coverage gap, not proof that the same-build deterministic suite passed.

## Defects fixed in the Kit

| Defect exposed by code/runtime verification | Fix |
|---|---|
| Legacy bootstrap omitted the new Test OS dependency | Add it to explicit bootstrap and installed-runtime inventories; installation regressions pass. |
| Upstream report uses JSON Schema 2020-12 | Load Ajv 2020 and validate the complete actual schema. |
| Native artifacts are relative to the artifacts directory | Resolve against the real output layout and retain original hashes. |
| Public upstream API has no artifacts fixture | Write Kit-owned, nonce-bound independent oracle receipts without internal producer APIs. |
| Engine cleanup rewrites a registered replay trace | Snapshot exact registered bytes through the public ArtifactStore; reject foreign-run refs and modified snapshots. Never repair a report hash after execution. |
| Scaffold timeout/discovery assumptions differed from the actual producer | Use supported judgment timeout and native `**/*.e2e.ts` discovery. |
| Environment token names differed between CI and probe | Align the explicit token variable. |
| A shortened deterministic command plan could report success | Require every planned command to have run successfully. |
| Existing deployment test wrote a transient mock into shared Kit source | Isolate its temporary test module in the project fixture, preserving installer integrity. |
| Concurrent full gates shared `npm ci` in the SEA source toolchain | Install the exact pinned injector in a private temporary directory per build and clean it on every return; exercise two actual concurrent SEA builds. |
| Missing manifests could evade UI applicability | Detect static web roots and nested app/package/client surfaces; applicable products block instead of claiming 3/3. |
| A named `agent.act` without actions, or a model-call count without provenance, could satisfy a weak gate | Require actual action metrics and provider/model/call identity; reject foreign snapshot refs even when a matching original local file exists. |

## Validation and acceptance

The repaired clean implementation predecessor passed `npm run v4:check`: 939 full regressions, 317 v4 regressions and one packaged-runtime smoke, with no failures/skips. `npm run check` also passed. The immutable-evidence change passed 18 focused tests, including seven agentic contract checks. The final published candidate must have fresh command receipts for both full gates; the PR records those results on its exact SHA. Historical checks do not certify later bytes.

At integration commit `4e57e80a320a1cee5d8059f50649e1a14230001b`, `npm run check` passed all 940 regressions and source validators. A concurrent `v4:check` failed one SEA provision test because another build's `npm ci` removed its shared injector. That failure is retained; the private-toolchain fix and real concurrency regression require fresh final validation.

| Requirement | Acceptance |
|---|---|
| Actual pinned library execution and native scaffold | IMPLEMENTED; real producer executed |
| Three mandatory risk classes | PASS on adapter fixture |
| Live semantics plus independent complete-state checks | PASS; partial-save fault rejected |
| Replay and agent fallback | PASS; fresh judgments/oracles retained |
| Screenshot, trace, log and receipt integrity | PASS after immutable-store repair; tamper/foreign nonce rejected in regression |
| Existing deterministic guards / installation | Preserved; full predecessor and focused regressions passed |
| Web production integration | Implemented; each project needs its own attested manifest, journeys and authorized model |
| Native Flutter Android/iOS execution | Supported scaffold; BLOCKED physical/device execution |
| Authenticated FLOW happy path, cross-feature and roles | BLOCKED credentials, isolated fixtures and runtime revision attestation |
| Exact-SHA remote CI and physical release matrix | BLOCKED workflow dispatch/device runner; no remote PASS claimed |
| Production certification | BLOCKED until operational rows above have actual evidence |

The host pilot used live decisions from the current conversational model through upstream's custom executor API. Reported zero tokens mean accounting unavailable for that host; they do not mean zero cost. No model API key was invented or automatic sign-in performed. Repeated CI uses the scaffold's explicitly authorized provider and its spending limits.

The browser infrastructure's official download was truncated in this environment. Diagnostics used an available Chromium 153.0.8010.0 binary through the environment proxy with its installed CA public keys trusted. This does not certify the exact official upstream browser build or production TLS. No blanket TLS verification bypass was used. Production/device certification must use the project's provisioned runner.
