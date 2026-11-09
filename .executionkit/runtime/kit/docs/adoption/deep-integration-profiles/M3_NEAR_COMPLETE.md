# M3_NEAR_COMPLETE — Release-hardening / near-complete product

Use this profile when the implemented product denominator is largely present and the project is primarily closing gaps, polishing, validating, hardening or preparing release candidates.

Do not classify solely from a claimed percentage. `M3` is defined by **release-oriented observable behavior**: most intended runtime surfaces exist and current work is dominated by acceptance, remediation, certification, performance, security, stores/deployment or launch readiness.

## Primary objective

Integrate ExecutionKit without causing late-stage scope churn while aggressively preventing **false completeness** or search-release regressions from surviving into release.

## Preferred adoption behavior

Strongly prefer `COMPATIBILITY_ADOPTION`. Preserve mature task history, CI, tests, release tooling, agents, components, design systems, SEO/search architecture and domain controls.

Use `CONTROLLED_MIGRATION` only where an existing control is unsafe or semantically incompatible. A near-complete project is not the place for cosmetic framework or URL-architecture rewrites.

## Baseline before any migration

Capture:

- exact source/release baseline and current candidate if one exists;
- current non-terminal/review/correction/release frontier;
- complete implemented surface inventory;
- complete public organic-search page-family inventory and current intended index/noindex/canonical behavior;
- current robots/sitemap/canonical/redirect/hreflang/structured-data/internal-link behavior where applicable;
- current test suites and known failures/flakes/skips;
- release environments, signing/build/deployment configuration authority;
- database migration/rollback state;
- current observability/health/incident/rollback procedures;
- premium UI/component/design status on real rendered surfaces;
- security/privacy/authorization and high-risk domain evidence;
- current audit/SEO findings and launch blockers;
- current search-monitoring evidence when available, while keeping external Search Console/index/ranking truth distinct from repository validation.

## Frontier-gating rule

Gate the **remaining release/acceptance frontier**, not historical implementation.

Existing terminal tasks stay terminal unless current evidence independently proves they must be reopened under the project's normal governance. Do not reopen hundreds of tasks merely because a new kit was installed.

Existing review/correction candidates retain their lifecycle state and should be consumed before new feature work after activation.

`EK00-005S` or the native SEO equivalent must be inside the accepted integration-gate ancestry. A nearly released public site cannot treat search architecture as optional simply because URLs already exist.

## Mandatory deep audit before activation

M3 adoption requires a current evidence-first audit of the implemented product denominator. It should explicitly distinguish:

- verified current implementation;
- documented/planned but not implemented;
- implemented but unverified;
- missing/broken/incomplete;
- placeholder/demo/mock residue;
- generic/basic/poor or design-system-bypassing UI requiring rendered review;
- stale or candidate-mismatched evidence;
- public page families whose crawl/index/canonical/redirect/structured-data behavior conflicts with the approved SEO contract;
- duplicate/thin/orphan/facet/programmatic search surfaces lacking proven distinct intent/value/coverage;
- search-facing rendering/performance behavior that is structurally configured but not currently evidenced.

Independent findings become canonical TODO work. Do not hide them inside the integration or SEO report.

## SEO OS release expectations

When SEO is applicable, M3 requires release-grade reconciliation rather than a generic checklist:

- bind the current `executionkit.seo.json` to the exact candidate identity;
- verify representative samples for every material indexable page family;
- verify status/indexability/canonical/redirect/robots/sitemap/rendered-HTML semantics on the release candidate or an explicitly equivalent environment;
- verify structured data only for eligible visible content and keep validation distinct from guaranteed rich-result display;
- validate hreflang/locale relationships when international mode applies;
- validate commerce/local/directory/programmatic policies according to the real product modes;
- treat unexplained noindex, canonical drift, mass redirect changes, orphaning and indexable low-value generated combinations as release findings;
- preserve stronger native SEO tooling/monitoring and map remediation to canonical TODO;
- never claim Google indexing, ranking, rich results or organic traffic as a repository PASS.

The SEO S3 release gate is candidate-bound. Production S4/S5 verification remains distinct and must not be inferred before deployment.

## Test/Evidence expectations

For applicable surfaces, M3 normally requires real candidate-bound evidence rather than planning placeholders:

- unit/feature/integration/regression suites;
- browser E2E/accessibility/visual evidence;
- Flutter analyzer/widget/integration/device evidence;
- security/authorization/data migration checks;
- offline/sync/money integrity where applicable;
- SEO contract/release checks plus search-facing performance budgets where applicable;
- exact candidate/environment identity;
- skipped/flaky policy enforcement.

A structurally installed adapter with no current run is not adequate evidence for a near-release claim. Lighthouse/performance evidence is one input, not the SEO OS authority itself.

## Launch OS is material

Reconcile Launch OS against the real release path, including:

- candidate identity including applicable SEO control-file hashes;
- environment/config ownership;
- signing/store/deployment/provider authority;
- migrations/backups/restore/rollback;
- observability and production smoke/health;
- search-sensitive deployment concerns such as host/domain/TLS/redirect/robots/sitemap changes where applicable;
- launch blockers and external approvals;
- stabilization and rollback criteria.

Generic release-readiness output never overrides stronger native launch certification.

## Change-minimization rule

During adoption, avoid unrelated architectural/UI/URL refactors. Prefer:

1. control-plane safety fixes;
2. visibility/traceability fixes;
3. blockers to trustworthy tests/audit/SEO/release evidence;
4. canonical TODO mapping for remaining product/search gaps;
5. normal task-by-task remediation after the control plane is accepted.

## Mandatory M3 evidence

Prove:

- historical completion/evidence preserved;
- full current implementation denominator reconstructed;
- current public-search denominator and SEO applicability reconstructed;
- release/acceptance frontier is gated without rewriting history;
- current quality/test/audit/SEO/release evidence is candidate-bound where applicable;
- pre-existing gaps are visible in canonical TODO;
- component/design/content/search systems are validated against real product use;
- no required release/search tool/platform is hidden as `NOT_APPLICABLE` merely to pass;
- no search-engine outcome is fabricated from repository validation;
- independent deep integration audit and release-oriented recheck pass before activation.

## Acceptance trap to avoid

The main M3 failure is **mistaking “almost finished” for “already proven.”** Late adoption must increase evidence quality and expose remaining product/search gaps, not rubber-stamp existing completion, SEO or launch claims.
