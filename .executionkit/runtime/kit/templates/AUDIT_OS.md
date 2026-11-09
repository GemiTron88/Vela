# Audit OS

**Status:** CANONICAL for project audit policy.  
**Capability level:** `[LITE|STANDARD|FULL]`

Audit owns assessment/finding quality. Agent OS routes independent reviewer context; Execution/TODO owns mutable task and boundary-gate state. SEO OS owns search applicability/architecture/policy. This file MUST NOT become a remediation backlog or a competing SEO authority.

## 1. Truth source and audit language

Current repository/runtime/candidate evidence is authoritative for implementation reality. Plans, prior summaries, TODO state and old screenshots are supporting context only.

Treat requests such as `deep audit`, `honest audit`, `full audit`, `comprehensive audit` and `premium audit` as requests for stronger evidence depth. Report claims as:

- **VERIFIED CURRENT**
- **DOCUMENTED/PLANNED**
- **UNVERIFIED**
- **MISSING/BROKEN**

Never convert planned intent or a completed checkbox into implementation truth.

For SEO, never convert route existence, a green Lighthouse score, schema syntax, sitemap presence or a repository validator PASS into proof that a search engine indexed/ranked the page or will show rich results.

## 2. Audit denominator

Reconcile applicable project authorities and discovered reality before claiming completeness:

- `[requirements/spec paths]`
- canonical `TODO.md` / native task authority;
- `[routes/navigation/screen inventories]`;
- `executionkit.components.json` and native component/widget/custom-element authorities;
- `executionkit.seo.json` plus public/indexable route/page-family inventory when SEO applies;
- `[design/token/brand paths]`;
- `[content/assets/localization paths]`;
- `[API/data/integration inventories]`;
- `[test/quality/evidence paths]`.

Missing or undiscovered scope is a finding; do not silently narrow the denominator.

For public-search products, reconstruct the searchable denominator by page family/intent/index policy rather than auditing only URLs already named in documentation. A database entity or route family does not automatically deserve indexing.

## 3. Audit domains

Select applicable domains:

- requirements/scope coverage;
- architecture/integration ownership;
- security/privacy/authentication/authorization;
- data integrity/migrations/business rules;
- UX/product-specific visual direction;
- **component-system reuse and conformance**;
- interaction/state completeness;
- accessibility;
- responsive/adaptive/mobile/platform behavior;
- performance;
- localization/content/real assets;
- SEO applicability, intent/page-family architecture, crawl/index/canonical policy, internal discovery, structured data and specialized local/commerce/international/programmatic behavior where applicable;
- offline/recovery where applicable;
- operations/observability;
- integrations/failure handling;
- test adequacy;
- evidence freshness/candidate identity;
- release readiness.

Audit independently challenges whether SEO OS configuration and evidence match live product truth. It does not rewrite search policy inside an audit report; material search findings map to canonical TODO and the SEO contract/policy is corrected through its owning lifecycle.

## 4. Severity policy

- P0: `[definition]`
- P1: `[definition]`
- P2: `[definition]`
- P3: `[definition]`

Mechanical `REVIEW` signals require independent inspection and do not automatically mean visual/search failure. Map adapter severity into this project's Finding Contract policy.

## 5. Cadence and boundary policy

### A0 — implementation self-check

`[targeted policy]`  
Not independent acceptance. Do not run expensive full project CI after every task unless native risk policy requires it. Changed public-search surfaces should run the smallest applicable S0 SEO check without turning A0 into a project-wide crawl.

### A1 — wave/workstream audit

After every bounded wave:

1. inspect changed code/surfaces plus affected integration seams;
2. run `node bin/validate-component-system.mjs . --audit --boundary=wave`;
3. run applicable design/browser/Flutter/content checks;
4. when SEO applies, independently challenge affected page families, index/canonical rules, internal-link seams and the declared S1 evidence;
5. perform rendered review for affected premium UI/search-facing web surfaces;
6. map material findings to canonical TODO/native tasks;
7. correct/reproduce findings before dependent next-wave work proceeds;
8. run targeted integration/regression checks only.

**Project wave definition:** `[define bounded wave/workstream grouping and gate task convention]`

### A2 — phase audit

Before every phase closes:

```text
phase implementation/reviews converge
-> full phase denominator reconciliation
-> mechanical audit/component/design checks
-> applicable SEO S2 denominator/search-contract challenge
-> independent rendered/runtime audit
-> map findings to canonical TODO
-> remediation + finding-specific reproduction
-> reconcile TODO/findings/evidence
-> manual self-hosted CI on final corrected phase candidate
-> phase gate acceptance
```

Run `node bin/validate-component-system.mjs . --audit --boundary=phase`. If remediation changes the candidate after CI, rerun the affected final gate. Applicable SEO evidence is likewise stale if the corrected candidate or `executionkit.seo.json` materially changes.

**Phase CI policy:** `[self-hosted manual command/workflow; one final candidate run by default]`

### A3 — release candidate

Run `node bin/validate-component-system.mjs . --audit --boundary=release`, then repeat the applicable full matrix on the exact RC/artifacts. When SEO applies, independently challenge candidate-bound S3, the current SEO contract hash, representative page-family evidence and release blockers. Do not reuse stale phase evidence after material candidate/search-contract changes.

### A4 — launch

`[production verification/monitoring/rollback policy]`

When SEO applies, A4 independently checks that authorized S4 production verification actually observed the deployed target and that S5 monitoring/ownership exists where declared. Production search observations remain evidence, not a ranking/indexing guarantee.

## 6. Premium UI/UX acceptance

For every applicable premium web/Flutter surface, inspect actual rendered output with production-shaped data and the native brand/product direction. At minimum verify:

- product-specific identity rather than framework/default starter appearance;
- role/job-specific hierarchy, navigation, information density and actions;
- canonical reusable components/widgets/custom elements are actually consumed;
- useful variants and loading/skeleton/empty/error/success/disabled/permission/recovery states;
- keyboard/touch/focus/navigation/feedback/overlay/destructive interactions;
- narrow/mobile, tablet, wide, RTL/LTR, long Arabic/Latin copy, safe areas, keyboard insets and text scale;
- accessibility semantics, contrast, focus order, screen reader and reduced motion;
- real copy/data/assets/localization; no lorem/demo/placeholder/fake metrics;
- production performance budgets;
- required browser/native Android/iOS behavior.

For public search-facing pages, premium presentation never substitutes for useful intent-matched visible content, crawlable semantics, truthful structured data or sane internal discovery.

### AI-generic / poor / basic signals to challenge

- framework/starter-template look with weak product identity;
- repeated rounded-card + shadow + grid composition across unrelated jobs;
- cloned admin/owner/field/consumer layouts despite different workflows;
- decorative cards/gradients/badges/charts/animation without useful hierarchy/action;
- raw buttons/inputs/dialogs/cards that bypass an existing canonical component family;
- duplicated variants, one-off styling and hardcoded token drift;
- sparse/basic screens missing useful actions/context/filtering/feedback/recovery;
- generic state copy, placeholder assets, demo/mock residue or fake metrics;
- inconsistent typography/icons/spacing/elevation/motion/interaction grammar;
- screenshot polish that hides incomplete states, non-functional interactions or broken responsiveness;
- AI-generated search landing pages that differ only by swapped keywords/location names and lack distinct user value.

These are review signals, not blanket aesthetic bans. Record concrete rendered evidence and rationale for the final verdict.

## 7. Component-system conformance

Use the project's native component authority and `executionkit.components.json`.

- **Livewire/Blade/Tailwind/Alpine:** verify screens consume canonical Blade/Livewire components and semantic tokens where applicable; test actual browser lifecycle/interactions.
- **Web Components:** verify host screens consume applicable registered custom elements and their attribute/property/event/slot/lifecycle contracts.
- **Flutter:** verify screens consume the reusable widget/component system and semantic theme tokens; validate relevant Android/iOS behavior.

Where component entries declare `replaces` roles and platform `usage` tokens, bypass is a mechanical finding. Without explicit equivalence, require reviewer inspection instead of guessing.

## 8. Finding register

This register records findings, not independent execution work.

| Finding | Domain | Severity | Observed gap | Evidence/reproduction | TODO task | Disposition |
| --- | --- | --- | --- | --- | --- | --- |

Use Finding Contract dispositions including `ACCEPTED_RISK`. Do not use finding `ACCEPTED` because task `ACCEPTED` has a different lifecycle meaning.

Every executable finding MUST map into canonical `TODO.md`/native authority before remediation. Audit never owns a private queue. SEO findings follow the same rule; do not create `SEO_TODO.md` or keep actionable search debt only in crawl/audit reports.

## 9. Accepted risks

For `ACCEPTED_RISK`, record authority, rationale, residual impact, affected scope/environment, compensating controls and expiry/review condition where applicable.

## 10. Audit evidence

For each boundary retain enough evidence to reconstruct:

- candidate/commit/worktree identity;
- denominator/inventories inspected;
- commands/checks and raw outputs;
- rendered browser/device/build evidence for premium surfaces;
- applicable SEO contract hash, page-family denominator, URL samples and source/rendered/production evidence;
- component reuse and state coverage inspected;
- findings/dispositions and TODO mappings;
- finding-specific closure reproduction;
- final phase/RC CI evidence where required.

Reviewer labels alone do not authenticate independence. A screenshot diff proves visual change, not design quality. A crawl/schema/Lighthouse artifact proves only its declared observations, not third-party search-engine outcomes.

## 11. Boundary closure

A wave/phase/release gate may close only when required findings are `FIXED` or validly dispositioned by policy, executable findings are reconciled into canonical tasks, evidence matches the current candidate and all applicable Audit/Test/Content/SEO/quality/CI gates pass.

Do not report `100% complete`, `fully integrated`, `premium`, `SEO ready`, `production ready` or equivalent solely from TODO/phase state or a single mechanical adapter.

## 12. Reality-closure audit

At phase/release boundaries, independently challenge whether accepted tasks actually compose into the declared critical journeys. Inspect integration seams, shared state, provider/consumer contracts, failure propagation and persistence/restart behavior rather than summing checkboxes. A gate remains non-terminal when any journey member is outside its transitive dependency closure, the current candidate invalidates earlier proof, or required black-box/runtime evidence is unavailable.

## 13. System release convergence

Before release acceptance, Audit independently checks the canonical system release gate in addition to phase gates. The release gate must transitively converge the complete active non-cancelled denominator, and each release-critical journey must have concrete required scenarios bound to an executable candidate-scoped producer at an appropriate external/runtime observation boundary. Treat missing scenario coverage, generic test-only evidence, or disconnected accepted phases as a material closure finding.

## Executable Audit OS runtime

`bin/audit-project.mjs` is the canonical mechanical/orchestration entrypoint. It executes the configured audit matrix; `validate-component-system` is only one component of that matrix.

At phase/release boundaries the project may register first-class `kind: "audit"` entries in `executionkit.adapters.json` with explicit `domains`, `boundaries`, `command` and `args`. These commands MUST execute current checks; they MUST NOT merely echo or re-read a project-authored PASS certificate.

For `Audit OS = FULL`, release acceptance requires project-domain audit adapters in addition to generic framework/security/data/runtime checks. Examples include tenant isolation, financial ledger invariants, migration/data reconciliation, authorization boundaries, queue/scheduler behavior and live-integration invariants as applicable to the product.

Release Audit writes a candidate-bound `.executionkit/gates/audit-release.json`. A stale candidate, failed/missing required executable adapter or unresolved `REVIEW_REQUIRED` rendered-quality decision cannot become a release PASS.
