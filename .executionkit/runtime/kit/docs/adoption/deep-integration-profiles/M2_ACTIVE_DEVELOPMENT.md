# M2_ACTIVE_DEVELOPMENT — Substantial code and active partial execution

Use this profile when substantial product implementation exists across multiple domains/surfaces and the repository has meaningful active/partial execution history, but the product is not yet primarily in final release-hardening mode.

## Primary objective

Introduce or upgrade the control plane **without destabilizing active work, losing partial implementation, rewriting healthy native governance or hiding accumulated product/search debt**.

## Preferred adoption behavior

`COMPATIBILITY_ADOPTION` is normally safest when the repository already has meaningful task/Agent/test/quality/search controls. Use `CONTROLLED_MIGRATION` only for the specific controls that genuinely violate current ExecutionKit invariants.

Do not choose a destructive mode merely because the repository shape differs from ExecutionKit templates.

## Baseline and interruption safety

Before mutation inspect:

- current branch/worktree and interrupted/uncommitted work where observable;
- unpushed commits/upstream relationship where observable;
- current canonical task/action and partial/review/correction states;
- actual implementation denominator through discovery;
- actual public/indexable web denominator, route families and current SEO behavior;
- native agents, skills, rules, workflows and editor integration;
- current test failures/flakes/skips;
- schema/data migration state;
- component/design/content systems actually consumed by the product;
- current robots/sitemap/canonical/redirect/hreflang/structured-data/internal-link behavior where applicable;
- active integrations and environment boundaries.

Never overwrite unrelated or interrupted work. Adoption runs in a dedicated branch/worktree where possible.

## Frontier-gating rule

Do **not** prepend the integration gate to historical terminal work.

Identify every independent root of the current non-terminal execution frontier that could otherwise become executable and make those roots depend on `EK00-ACTIVATE` or the native equivalent. Preserve dependency-satisfied historical tasks and their evidence.

For an `IN_PROGRESS`, `IMPLEMENTED`, `REVIEW_REQUIRED`, `CORRECTION_REQUIRED` or native equivalent task:

- preserve its current implementation and evidence;
- reconcile how the new integration gate affects its next lifecycle action;
- do not reimplement it from scratch;
- ensure reviewer/correction lanes remain prioritized after integration.

The SEO integration task must be inside the integration-audit ancestry. Existing public routes do not become accepted search surfaces simply because they predate adoption.

## Required reconciliation depth

M2 deep integration must inspect the **existing product**, not just configuration:

- reconcile actual routes/screens/APIs/jobs/data models with approved scope;
- reconcile actual public-search page families with approved search intent/value and current indexability policy;
- run deep/honest audit on representative/high-risk implemented areas;
- identify missing/demo/mock/placeholder behavior that predates adoption;
- verify reusable component-system consumption and design-token use on existing UI;
- verify existing Content OS data/source/rights behavior where applicable;
- inspect duplicate/thin/orphan/facet/programmatic search surfaces where public routes already scale;
- reconcile native tests and current failures with Test OS;
- inspect security/authorization/data/offline/money invariants that are already implemented;
- map independent findings to canonical TODO before continuing product execution.

The integration wave must not become a giant rewrite of all discovered product or SEO debt. Its job is to **make the debt visible, owned and correctly gated**. Fix only blockers required for a trustworthy control plane or explicitly owned integration acceptance.

## SEO OS strategy

For an active codebase, treat the current searchable web footprint as implementation truth to reconcile, not as a blank template:

- preserve stronger existing URL/canonical/redirect/schema/sitemap/hreflang rules;
- classify every major public page family as `INDEX`, `NOINDEX` or conditional according to actual intent/value;
- treat internal product search/filter mechanics separately from organic-search indexability;
- fail closed on programmatic/facet/location combinations until coverage/value thresholds are demonstrated;
- identify current rendered/JS discoverability risks and existing duplicate/canonical drift;
- map engineering/content remediation to canonical TODO, preserving current task ownership and dependencies;
- do not promise ranking, index inclusion or rich results as an acceptance outcome.

## Agent OS strategy

Mature/partial native `.agents` resources are valuable evidence of project specialization. Register and route them; do not replace them with generic roles.

Verify representative routing for:

- normal implementation;
- correction/resume;
- independent review;
- wave/phase audit;
- SEO discovery/technical/programmatic/local/commerce/international specialists when applicable;
- important stack/domain specialists;
- release/security/content roles where already applicable.

## Test and CI strategy

Preserve current test commands and establish a baseline. Use targeted tests for migration changes. Expensive full self-hosted CI normally runs on the final corrected integration/phase candidate, not after every adoption edit.

Classify pre-existing product/search failures separately from integration regressions; neither may be silently converted to PASS.

## Mandatory M2 evidence

Prove:

- active/partial task states and implementation were preserved;
- all current executable frontier roots are gated correctly;
- existing native Agent resources remain routable;
- SEO applicability and actual public-search page families were reconciled without manufacturing outcomes;
- discovery denominator excludes ExecutionKit runtime/derived sources and reflects real product surfaces;
- actual reusable components/design tokens/content sources are reconciled where present;
- current native test/quality/search failures are truthfully represented;
- discovered independent gaps were mapped to canonical TODO or explicitly dispositioned;
- independent integration audit reproduced after remediation;
- activation releases the scheduler back to the correct lifecycle action, not simply the next numeric OPEN task.

## Acceptance trap to avoid

The main M2 failure is **control-plane adoption that accidentally behaves like a project reset**. Substantial code, public search surfaces, partial tasks and mature native resources are preservation inputs, not clutter to be normalized away.
