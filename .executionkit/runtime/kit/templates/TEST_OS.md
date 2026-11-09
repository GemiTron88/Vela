# Test OS

**Status:** CANONICAL for project verification strategy.  
**Capability level:** `[LITE|STANDARD|FULL]`

> Test OS owns verification policy/evidence requirements. Agent OS routes testing/reviewer skills and context; Execution OS + canonical TODO own mutable task state. CI executes checks but is not a second source of truth. SEO OS owns organic-search applicability, search-surface/index/canonical policy and SEO gate semantics; Test OS verifies declared SEO checks/evidence but does not decide what should be indexable.

## 1. Test layers

For each applicable layer define command, environment and coverage intent:

| Layer | Command/tool | Environment | Required cadence |
| --- | --- | --- | --- |
| Unit | | Local task loop / phase self-hosted CI | Task-targeted + Phase |
| Feature/API | | Local task loop / phase self-hosted CI | Task-targeted + Phase |
| Integration | | Local targeted check / self-hosted project runner | Phase |
| E2E | | Self-hosted project runner | Phase/RC |
| Static/type/lint | | Local task loop / phase self-hosted CI | Task-targeted + Phase |
| Security | | Self-hosted project runner | Phase/RC |
| SEO contract/render/crawl evidence | `node bin/validate-seo.mjs .` + native/browser checks | Local/RC/authorized target as declared | Task/Wave/Phase/RC when applicable |
| Performance | | Self-hosted project runner | RC where applicable |
| Smoke/health | | Authorized target environment | Launch |

SEO validation is **not** synonymous with Lighthouse. Performance/Core Web Vitals can be SEO-relevant evidence, but search intent, page-family value, indexability, canonicalization, structured-data eligibility and programmatic safeguards remain SEO OS decisions. A test PASS never guarantees search-engine indexing, ranking, rich results or traffic.

`PHASE_BOUNDARY_FULL_CI`: applicable task-targeted verification is part of ordinary task closure, but the **complete expensive self-hosted CI suite is not a per-task/per-commit action**. The portfolio default is one deliberate full-suite run on the corrected phase candidate at the phase boundary. A release/Launch contract may require another explicit exact-candidate run, but ordinary task completion MUST NOT silently dispatch the full suite.

## 2. CI runner policy

Canonical policy: `docs/architecture/ci-runner-policy.md` in the adopted ExecutionKit reference.

Project runner label: `[PROJECT_RUNNER_LABEL]`

Rules:

- CI/Test OS GitHub Actions jobs use `self-hosted` runners; do not use GitHub-hosted `*-latest` pools as the normal/fallback path.
- CI is manually dispatched by default; do not autorun the test suite on every push.
- Do not dispatch the complete CI suite automatically after each task, lifecycle action, commit or push.
- Run the full suite at the end of the phase after applicable SEO/Audit remediation has produced the candidate being verified.
- Task-level work still runs the smallest sufficient targeted unit/feature/widget/static/integration/SEO checks required by the task contract; deferring full CI does not permit unverified task implementation.
- The project may register runners on macOS, Windows, or both.
- **At most one runner for this project may exist on any one physical device.**
- The same physical device may host separate runners for other projects.
- A missing/offline required runner is `BLOCKED`/`NOT_RUN`, never an excuse to fall back silently to GitHub-hosted compute.
- Run both Mac and Windows only when the current phase/release contract requires both.

### Runner inventory

Keep aliases only; never commit runner registration tokens, secrets, private IPs, passwords or hardware serial numbers.

| Device alias | OS | Runner name | Project label | Status/notes |
| --- | --- | --- | --- | --- |
| | macOS/Windows | | `[PROJECT_RUNNER_LABEL]` | |

## 3. Critical journeys

List high-value flows that must remain covered. For public-search products, include representative rendered/crawl samples only where the owning SEO contract declares them applicable.

## 4. Fixtures and environments

Define deterministic data, mocks/sandboxes, time/locale/device/network requirements.

Record Mac/Windows separately when platform behavior matters. For SEO/browser evidence, record host/base URL, rendering environment, locale and candidate identity where those facts affect the result.

## 5. Test requirement IDs

Use `TST-*` only where traceability is useful.

## 6. Flaky test policy

No rerun-until-green closure. Map persistent flakiness to TODO.

## 7. Gate thresholds

Define targeted task verification, phase full-suite, RC and launch requirements separately.

The absence of autorun CI does not weaken the gate. Required targeted checks still execute before task acceptance; the complete self-hosted suite executes deliberately on the phase candidate before the phase can pass.

When SEO is applicable, its task/wave/phase/release gates remain owned by SEO OS. Test OS supplies the requested executable/browser/performance evidence and freshness rules; it cannot waive an SEO gate.

At release, applicable S3 evidence must bind to the same candidate and current SEO contract. After authorized deployment, S4/S5 remain SEO/Launch production and operational gates; Test OS may execute/normalize requested checks but does not turn pre-release evidence into a production PASS or search-engine outcome claim.

## 8. Known gaps

Actionable gaps map to TODO IDs. Do not maintain a separate Test or SEO-remediation TODO.

## Product quality contract

When `quality.contractPath` is configured, maintain subject/dimension/test coverage linked to TODO. Run `node bin/validate-quality.mjs .` at structural gates and `node bin/validate-quality.mjs . --release` at RC. Execute the native checks first; these validators inspect the report, they do not run the product suite.

Record the actual discovered scope beside the contract's declared scope. Required skips, zero-test runs and mock-only E2E must not become product PASS merely because a process exits zero. Independently review rendered output and baseline changes. Identify the RC/build/environment and freshness of runtime-dependent evidence in native gates; the generic source hashes cover declared files only.

## Candidate-bound evidence integrity

For release-required test adequacy, configure an evidence producer with the native command and reportPath, build the current candidate, then collect evidence. `testReportPath` must identify the same collected artifact. Missing/incomplete results, hidden failures and all-skipped runs fail. `minimumTests` excludes skips. Retain the executed report and actual platform coverage.

Applicable SEO release validation additionally binds the current SEO contract hash into candidate identity. Test evidence that predates a material SEO contract/candidate change is stale for the affected gate.

## 9. Critical-journey black-box proof

Release-critical journeys are declared in the configured integration contract. Targeted task tests remain necessary but cannot prove the whole journey. At the owning phase/release gate, Test OS must execute the declared end-to-end/provider-consumer path from outside the isolated components, including material auth, error, persistence/restart and degraded behavior where applicable. The resulting report must come from the configured trusted evidence producer and bind to the exact candidate/environment; a hand-authored PASS JSON is not test evidence.

## 10. Scenario-scoped journey evidence

For every release-required journey, list concrete scenario IDs covering the material happy path and risk-relevant failure/recovery/persistence/security behavior. Bind those IDs to a configured candidate-bound evidence producer with a declared black-box/runtime/browser/device/integration observation boundary. A generic full-suite producer may remain required for regression coverage, but it cannot by itself claim a journey unless its adapter explicitly declares and executes the journey scenario coverage required by the integration contract.

## Executable release Test OS

Test OS does not satisfy release truth by parsing a pre-existing report alone.

For release verification:

```bash
node bin/test-project.mjs . --boundary=release
```

The orchestrator requires a current exact candidate, executes every configured `evidence.requiredProducers` command through ExecutionKit evidence collection, verifies fresh report/scenario artifacts and hashes, validates test adequacy, and writes the candidate-bound `.executionkit/gates/test-release.json`.

When Repository Intelligence is enabled, the release gate also records current change-impact/test-selection context. Terrain/CodeGraph/Repomix/RTK-derived evidence may improve selection and navigation, but it cannot replace executed producer evidence.

An empty producer set, missing `testReportPath`, stale artifact, zero-test report, hidden failure, required skip, unapproved flake or candidate drift is a hard release failure.

## Executable semantic journey layer

Test OS now runs pinned `tester-army/e2e` alongside existing deterministic suites and backend/route/database protections. Agentic Browsing 3/3 means critical happy-path, cross-feature workflow and adversarial/recovery journeys for each required actual target/role. See `contracts/agentic-e2e-contract.md` and `docs/architecture/agentic-e2e.md`. Use `executionkit test journeys .`; automatic wave/phase/release gates reject missing, stale, skipped, flaky or unproven journey evidence. Replay actions with live agent fallback; semantic assertions and independent persistence/permission/state oracles always run fresh. New tests require distinct risk mapping, never a count target.

Visual checkpoints connect the same tester-army live page to Visual OS V2. Test OS validates behavior and live state; Visual OS captures/reviews actual rendering; Audit OS independently verifies their evidence. Use the current-state remediation loop, bounded impact/full matrices and `contracts/visual-os-v2-contract.md`. Do not require before/after albums or treat screenshots as backend correctness.
