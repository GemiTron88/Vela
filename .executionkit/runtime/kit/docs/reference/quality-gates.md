# Quality Gate Reference

**Status:** REFERENCE.

This is a menu, not a requirement to apply every gate to every project. Project risk/contract selects the applicable set. Gate documents are criteria/evidence, never another backlog.

## Task gate

Potential checks:

- targeted unit/feature/component/widget tests;
- lint/type/static analysis for changed scope;
- local/native acceptance scenarios;
- security/authorization negative cases;
- migration/schema/data invariant checks;
- accessibility/visual checks where directly affected;
- current contract/evidence review before `ACCEPTED`.

`IMPLEMENTED` is a candidate, not a passing task gate. When reviewer separation is required, independent acceptance follows implementation.

## Workstream gate

Potential checks:

- subsystem integration;
- shared contracts/dependencies;
- cross-component state;
- retry/error/recovery paths;
- representative UX flow;
- workstream audit A1;
- candidate/source evidence freshness.

## Phase gate

Potential checks:

- all mandatory phase tasks `ACCEPTED` or stronger `RELEASED` (legacy `VERIFIED` only when configured as an alias to `ACCEPTED`);
- no required review/correction/blocker work hidden outside canonical TODO;
- phase regression;
- phase E2E/integration;
- data/schema consistency;
- A2 audit;
- C2 content coverage where applicable;
- documentation/authority reconciliation;
- Agent + Execution + CI integrity PASS;
- configured product-quality structural/evidence gates as required.

## Release-candidate gate

Potential checks:

- exact candidate SHA/tag/artifact identity;
- full applicable automated suite with no required hidden skips/empty-suite false positives;
- production build;
- dependency/security scan;
- migration/backfill rehearsal;
- performance budgets from raw current measurements;
- accessibility baseline + required manual review;
- visual acceptance against approved references/tokens;
- localization/content completeness;
- SEO/crawl/index/structured-data checks for public inventory;
- A3 audit;
- accepted-risk review (`ACCEPTED_RISK` findings with authority/rationale);
- current candidate-bound evidence and environment/platform matrix.

A PASS from another commit/build is not RC evidence merely because it is recent.

## Launch gate

Potential checks:

- backup availability and restore viability;
- production config/secrets;
- DNS/TLS;
- workers/queues/schedulers;
- storage/CDN;
- observability/alerts;
- external integrations;
- deployment;
- smoke/health/critical journeys;
- rollback/roll-forward viability;
- post-launch monitoring/observation window;
- production data/integration spot checks where required.

## Gate outcome vocabulary

Prefer:

- `PASS`;
- `FAIL`;
- `WAIVED` only with explicit authority/rationale and where policy permits;
- `N/A` with rationale;
- `NOT_EVALUATED` / `NOT_RUN`.

Avoid ambiguous “mostly done”, “looks fine”, hidden required skips or percentage-based release readiness.

## v2.1 configured quality contracts

Projects that opt into product-quality contracts use `bin/validate-quality.mjs` for declared subject/dimension/task coverage and `--release` for current evidence integrity. See `docs/quality/product-quality.md` and `docs/quality/seo-content-performance.md`.

A structural quality PASS proves the declared contract is internally coherent. It does not prove that the declared inventory is exhaustive, that automated checks actually measure the criterion, that reviewer identity is authentic, or that the product is premium. Native discovery/test/runtime/review gates remain required for those claims.

Time-sensitive evidence SHOULD be bound to the exact release candidate/environment and a project-defined freshness rule; file hashes alone do not establish current live behavior.

## Reality-closure gate

For any multi-task phase/release, add a convergence check beyond task counts: the canonical phase/release audit gate must transitively cover its denominator, and every declared release-critical journey must have current black-box/runtime/browser/device evidence from a trusted candidate-bound producer. Isolated unit/component evidence cannot satisfy this gate. A production-origin string in a report is descriptive only and cannot replace collector provenance.

## Change-impact revalidation gate

A new release candidate must not inherit trust from older accepted evidence after shared contracts, control inputs or runtime seams change. Build the new candidate, run `node bin/analyze-revalidation.mjs .`, inspect accepted contracts/critical journeys at risk, and recollect the configured trusted evidence for the current candidate. `REVALIDATION_REQUIRED` blocks strict release readiness until current proof exists. The mechanism preserves valid implementation history while invalidating stale proof.
