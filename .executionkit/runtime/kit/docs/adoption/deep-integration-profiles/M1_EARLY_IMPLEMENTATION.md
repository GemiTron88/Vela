# M1_EARLY_IMPLEMENTATION — Runtime exists, implementation is still early

Use this profile when real product runtime/framework manifests and meaningful product code exist, but implementation history is still limited and the project is not operating like a release candidate.

Examples include a Laravel/Flutter bootstrap with a few real domains/screens/routes, an early MVP implementation, or a project that has completed only the first implementation waves.

## Primary objective

Integrate ExecutionKit without treating early code as disposable and without postponing real runtime/search evidence until the end of the project.

## Preservation strategy

Choose adoption mode independently:

- `NATIVE_RECONCILIATION` when planning/task authorities are strong and early code has not accumulated conflicting execution semantics;
- `COMPATIBILITY_ADOPTION` when useful native tooling/agents/tests already exist;
- `CONTROLLED_MIGRATION` only when current execution semantics materially violate current ExecutionKit invariants.

Preserve real implemented work, partial work, migrations, tests, SEO/search architecture and evidence. Do not reset implemented tasks to OPEN/PLANNED simply because deep integration is new.

## Intake before mutation

Capture at least:

- exact baseline commit/worktree and active branch;
- actual runtime manifests and toolchain versions;
- implemented routes/screens/models/controllers/services/components/migrations;
- which web surfaces are public/indexable, private/authenticated or intentionally non-indexable;
- existing robots/sitemap/canonical/redirect/metadata/structured-data behavior where present;
- current tests and native validators;
- current canonical task states and any in-progress task;
- current `.agents` resources/routing;
- existing component/token/content systems;
- external integration configuration and sandbox boundaries.

Run discovery before large structural migration so existing code and existing search-visible surfaces are not accidentally treated as missing scope.

## Integration frontier

Gate every independent **current non-terminal frontier root** that could otherwise execute around the integration phase. If all product work is still ahead of a single early frontier, one transitive `EK00-ACTIVATE` dependency may be enough.

Do not rewrite historical terminal work. Do not invalidate implementation evidence merely to make all tasks look uniformly post-EK00.

An existing `IN_PROGRESS` task must be preserved and explicitly reconciled. Either finish/review it under safe native rules before the new gate, or pause it truthfully and insert the integration prerequisite without discarding its work.

`EK00-005S` (or the native semantic equivalent) must resolve current SEO applicability before `EK00-AUDIT`; early public surfaces cannot bypass search architecture merely because the project is not release-like yet.

## Runtime applicability

Unlike M0, actual detected stacks are applicable now:

- Laravel/PHP tests and Boost checks when installed/intended;
- Flutter analyzer/unit/widget/device checks when Flutter exists;
- browser/accessibility/visual checks for existing rendered web surfaces;
- SEO technical/on-page/renderability checks for actual public organic-search surfaces;
- component/design validation against actual current source;
- database migration/data-safety checks for existing schema;
- candidate-bound evidence for claims that depend on the current code.

Private/authenticated panels, APIs and native-only surfaces remain outside SEO OS unless they also expose a real public search surface. Missing required tools are `NOT_AVAILABLE`/`BLOCKED`, not `NOT_APPLICABLE` merely because integration is inconvenient.

## SEO reconciliation at M1

Early implementation is the best point to correct search architecture before URL/content debt becomes expensive. When SEO is applicable:

- inventory implemented and approved public page families;
- distinguish internal product search from organic-search discoverability;
- assign intended index/noindex/canonical policy per page family;
- define information architecture, intent/entity targets and internal-link expectations;
- preserve existing good redirects/canonicals/structured data rather than replacing them with generic defaults;
- keep programmatic/facet/location generation fail-closed until distinct intent, visible value and coverage thresholds exist;
- map missing engineering/content work into canonical TODO rather than an SEO side list.

Do not claim indexing/ranking or rich-result outcomes from repository structure alone.

## Quality/component/design reconciliation

Build contracts from **actual implementation plus approved design authority**:

- inventory existing reusable components before defining replacements;
- register real token files rather than planned filenames;
- identify one-off/raw UI that legitimately predates the component system versus genuine reuse debt;
- map material component/design drift to canonical TODO;
- do not perform a mass cosmetic refactor inside the adoption task unless required to restore a safety/authority invariant.

## Testing strategy

Establish a trustworthy baseline before integration changes, then rerun affected tests after migration. At minimum separate:

- pre-existing failures;
- migration-induced failures;
- newly discovered product/search gaps;
- unavailable platform/tool/search-engine evidence.

A green control-plane validator does not erase a failing product suite that was already applicable. An SEO contract PASS does not prove search-engine indexing or ranking.

## Mandatory M1 evidence

Prove:

- baseline code/task state preserved;
- existing product surfaces are visible to discovery;
- SEO applicability is explicit and implemented public search surfaces are represented in the current search-surface contract;
- real stack adapters are correctly applicable;
- native tests/validators remain reachable;
- Agent routing covers implemented domains/platforms and applicable SEO specialists;
- current component/design/content contracts reference real files where those systems already exist;
- current non-terminal frontier cannot bypass integration activation;
- no early implementation was reset/reimplemented only for adoption;
- independent integration audit passes on the final reconciled candidate.

## Acceptance trap to avoid

The main M1 failure is **planning-only treatment of a real runtime**. Once product code or public search surfaces exist, `NOT_IMPLEMENTED`, empty runtime catalogs and unexamined SEO applicability are no longer acceptable shortcuts for applicable surfaces.
