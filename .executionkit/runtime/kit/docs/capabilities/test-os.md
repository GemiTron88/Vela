# Test OS Capability — current 3.x

**Status:** CANONICAL capability guidance.  
**Mandatory:** Yes for software intended for real use.  
**Purpose:** Define how correctness is proved at task, integration, regression and release levels.

## Principle

Test documentation defines required verification. Executed checks provide truth.

Test OS owns **what must be tested, when it must be tested, and what evidence is sufficient**. Agent OS may route tasks to testing/reviewer skills and environments, but it does not own test truth or task state. Execution OS/canonical TODO owns mutable task lifecycle. CI is one execution/orchestration lane for checks; CI is not a separate source of test truth.

SEO OS separately owns organic-search applicability, public search-surface intent/value, crawl/index/canonical policy, structured-data eligibility, programmatic safeguards and S0–S5 SEO gate semantics. Test OS verifies requested SEO checks/evidence; it does not decide which pages should be indexable or replace SEO OS with Lighthouse.

The canonical runner topology and trigger policy are defined in `docs/architecture/ci-runner-policy.md`.

## Coverage dimensions

Select according to system risk:

- unit/business-rule tests;
- component/widget/UI tests;
- feature/API tests;
- integration tests;
- contract tests;
- database/migration tests;
- authorization/security tests;
- end-to-end flows;
- offline/sync tests;
- concurrency/idempotency tests;
- error/retry/timeout tests;
- accessibility checks;
- visual regression;
- SEO contract/render/crawl evidence where applicable;
- performance/Core Web Vitals/load evidence where applicable;
- compatibility/platform tests;
- installation/upgrade tests;
- deployment smoke tests.

A green browser/Lighthouse result is only declared evidence. It does not establish search intent, canonical correctness across all page families, index inclusion, ranking, rich results or organic traffic.

## CI execution policy

Default project CI/Test OS execution uses **self-hosted runners only** and is **manually dispatched**.

- Do not consume GitHub-hosted runner minutes as the normal or fallback path.
- Do not autorun the full CI/Test OS on every push.
- The canonical GitHub Actions trigger is `workflow_dispatch` unless the project explicitly approves a narrower automatic exception.
- Every project uses a stable project-specific runner label such as `project-da7y`.
- A project may have runners on macOS, Windows, or both.
- A physical device must not host more than one runner registration for the same project.
- The same physical device may host one runner for each of several different projects.
- If a required self-hosted runner is unavailable, the result is `BLOCKED`/`NOT_RUN`; never silently fall back to a hosted runner.

Local targeted testing remains the normal task-loop path. Broader CI is dispatched deliberately at the corrected phase, release-candidate or other contractually required gates.

## Test requirement IDs

Named test contracts may use `TST-*` where traceability adds value.

Do not assign IDs to every assertion just to increase paperwork.

## Cadence

### Task gate

Fastest relevant checks for changed behavior, normally local/native on the active development device. For a changed public-search surface, include the smallest applicable SEO contract/render check declared by SEO OS.

### Workstream / wave gate

Targeted subsystem integration. Applicable SEO OS wave checks evaluate affected public page families independently of Test OS. Manually dispatch broader self-hosted CI only when project policy requires it.

### Phase gate

Phase-wide regression and cross-workstream behavior on the corrected candidate. Run applicable SEO phase verification and Audit remediation before the normal complete phase CI so material corrections are tested in their final form.

### Release candidate

Full applicable suite, static/type/lint/security/build checks and critical E2E on the exact candidate. When SEO is applicable, candidate-bound S3 remains owned by SEO OS and its declared evidence must match the same candidate. Run each required platform only when the release contract requires it.

### Launch

Deployment-specific smoke/health verification. Production SEO S4/S5 observations remain distinct from pre-release Test evidence and require authorized target-environment evidence when applicable.

## Multi-OS evidence

A project may move between Mac and Windows during implementation.

A PASS on one operating system proves only the declared scope. When behavior is platform-sensitive or the release matrix requires both, record independent evidence for macOS and Windows rather than assuming parity.

Do not dispatch duplicate cross-platform runs merely because both runners are registered; run both only when the task/phase/release contract requires both.

## Flaky tests

A flaky test is a defect in the delivery system.

Do not:

- rerun until green and call it evidence;
- permanently skip without a mapped task/risk decision;
- lower assertions to avoid investigation.

## Test environment truth

Record important environmental differences:

- local vs CI;
- Mac vs Windows;
- mock vs sandbox vs production integration;
- device/browser/platform;
- host/base URL and rendering mode for search-facing browser evidence;
- seeded fixtures;
- time/locale/timezone;
- network/offline simulation;
- external dependency versions.

## Lite

At minimum:

- documented commands;
- unit/feature checks for core behavior;
- task targeted tests;
- basic regression;
- launch smoke test;
- applicable SEO checks at the owning SEO gate when public search surfaces exist;
- self-hosted/manual CI policy where GitHub Actions is used.

## Standard

Adds layered strategy, explicit self-hosted CI gates, integration/E2E for critical journeys, fixtures and phase/release cadence.

## Full

Adds risk-based matrices, failure-mode tests, concurrency/offline/security/performance/platform coverage where applicable, stricter evidence and release-candidate reproducibility across required Mac/Windows targets. Full test depth still does not transfer SEO policy ownership into Test OS.

## Task relationship

A test or SEO-evidence gap discovered during verification maps to TODO if implementation is required.

The Test OS may list coverage requirements, not unowned implementation tasks. SEO findings remain owned by SEO OS until any executable remediation is mapped to canonical TODO.

## Product quality traceability

For selected quality contracts, map each inventoried subject and required dimension to real TODO IDs, measurable acceptance and a check/procedure. Use `bin/validate-quality.mjs` for structural coverage and `--release` for current evidence integrity. Neither command runs the product suite. See `docs/quality/product-quality.md` for risk matrices, failure scenarios and evidence limits. Code coverage and kit validator passes do not establish complete product coverage. Preserve native stronger tests and real platform evidence.

Quality input validation rejects malformed reports, including JSON null and other non-object values, schema-invalid field types and unsupported fields. Invalid contracts yield structured failures. Native checks are still needed for inventory discovery, raw result interpretation, candidate binding and runtime freshness; strict JSON validation does not perform those checks.

## Executed-result adequacy

TAP plans/numbering must match completed points; failure/skip/cancellation/bailout signals cannot be hidden by a green summary. JUnit cases are counted without duplicating nested suite totals, and malformed XML or conflicting counters fail. Playwright requires result records and respects expected outcomes, retries, skips and global errors. Flutter counts completed visible tests, requires successful final completion and rejects uncaught errors including late errors. Aggregate-only, all-skipped and incomplete runs cannot pass; `minimumTests` excludes skips.

At release, `requireTestAdequacy` additionally binds `testReportPath` to a current-candidate artifact produced by `collect-evidence`. Configuring only a test report path is insufficient. Use the recipe in `docs/architecture/traceability-evidence.md`. Native coverage decisions, domain assertions and platform acceptance remain required.

Applicable SEO release evidence additionally depends on the current SEO contract hash and candidate. A materially changed search contract or candidate makes affected prior SEO evidence stale even if the generic test report itself is still green.

## Executable semantic journey layer

Test OS now runs pinned `tester-army/e2e` alongside existing deterministic suites and backend/route/database protections. Agentic Browsing 3/3 means critical happy-path, cross-feature workflow and adversarial/recovery journeys for each required actual target/role. See `contracts/agentic-e2e-contract.md` and `docs/architecture/agentic-e2e.md`. Use `executionkit test journeys .`; automatic wave/phase/release gates reject missing, stale, skipped, flaky or unproven journey evidence. Replay actions with live agent fallback; semantic assertions and independent persistence/permission/state oracles always run fresh. New tests require distinct risk mapping, never a count target.

## Focused-test economy (v5 development)

Task checks and wave checks must be risk-targeted; `phase` is the deliberate full deterministic suite boundary. Editing dependency or configuration files never silently selects every test file. If no defensible target exists, return BLOCKED and request a scoped test, rather than fabricating PASS or running `npm test`/PHPUnit for hours. A selection over 24 test files requires risk/ownership review; it is not silently truncated. Agentic E2E remains the independent three-class, real-journey acceptance layer at wave/phase boundaries and does not replace backend invariants. Do not generate route-by-route or field-by-field speculative tests. Consolidate duplicate tests only after retained coverage and regression intent have been reviewed; do not bulk-delete.
