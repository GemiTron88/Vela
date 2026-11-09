# Migration Policy — current 3.x

Read [`first-pass-integration-checklist.md`](first-pass-integration-checklist.md) before the first write of any material adoption/upgrade.

## Compatibility adoption — preferred when the local system is healthy

A healthy native execution/agent/content/SEO/test/quality/release system should be preserved and semantically integrated, not replaced for aesthetic conformity.

Use `COMPATIBILITY_ADOPTION` when stable task IDs, lifecycle semantics, native validators, strong domain/search evidence or mature `.agents` resources already exist.

`NATIVE_RECONCILIATION` is appropriate when strong project-native authorities exist but a managed current control plane still needs to be composed around them. Maturity and adoption mode remain independent classifications.

## Controlled migration

Use `CONTROLLED_MIGRATION` only when live evidence shows the current control plane materially breaks required invariants.

Migration MUST NOT manufacture progress, reset task state, erase blockers/review findings, duplicate work or weaken tests/quality/SEO gates. The canonical TODO/native source SHOULD be hashed/diffed before and after any migration that claims not to alter unrelated state.

## Prior ExecutionKit history

A project that already adopted an older ExecutionKit version is not a fresh bootstrap merely because the standard changed.

When historical adoption/setup tasks are valid terminal history:

- preserve their IDs, terminal states and evidence;
- do not replay or reopen them for cosmetic version normalization;
- add/reconcile the new material upgrade phase at the current non-terminal execution frontier;
- gate that frontier through the new independent integration audit/activation ancestry;
- record the old/new managed-runtime relationship explicitly;
- preserve stronger native SEO/search contracts, authority documents, URL/index/canonical/redirect/sitemap/hreflang/structured-data controls and monitoring rather than replacing them with template defaults.

A major semantic version migration returns ExecutionKit control to `BOOTSTRAP`, but that does **not** reset product/planning history or current production search truth.

## Current migration router and SEO overlay

For a current 3.x distribution, `node bin/migrate-current.mjs --target <project>` is the supported inspection/router entrypoint. It composes the base 3.x project migration and the SEO OS overlay rather than requiring the operator to remember a second hidden migration step.

Mechanical SEO migration MUST preserve canonical TODO/native task bytes, unrelated/native Agent resources and an existing project-specific `docs/seo/SEO_OS.md` authority by default. It installs/reconciles the managed SEO schema/model/validator/Agent resources/config surface but does not fabricate applicability, indexability, ranking, search-engine observations or acceptance. An enabled SEO capability defaults to release gating; it may not silently migrate into `requiredForRelease=false`.

The SEO contract and project SEO authority are separate preservation boundaries:

- replacing an existing `executionkit.seo.json` requires explicit `--replace-seo-contract` intent;
- replacing an existing project `docs/seo/SEO_OS.md` requires separate explicit `--replace-seo-authority` intent;
- `--replace-seo-contract` MUST NOT implicitly authorize replacement of the project SEO authority document;
- when SEO is enabled and no project SEO authority exists, migration may install the current template as the missing authority;
- `SEO NONE` must not manufacture a new applicable contract/authority merely because the migration runtime contains SEO support.

The current migration router strips SEO-only replacement flags from the base migration and passes them only to the SEO overlay. Existing project-specific SEO contracts/authority documents are preservation inputs, not disposable managed files.

## Managed-tool conflicts

Existing managed validators/runtime files are not automatically overwritten. A conflict blocks preflight until the operator deliberately reconciles it. If replacement is authorized, the old file MUST be backed up before replacement and the current attempt MUST be rollback-safe.

Native project validators or stronger domain/search controls are preservation targets even when they are colocated with an old managed runtime.

## Staged managed-runtime retirement

Do not delete an old managed `bin/lib/schemas/plugins` surface before its dependents move.

Required upgrade order:

1. establish the new supported runtime topology and exact pin/version;
2. add compatibility wrappers/adapters needed by the target project and host integrations;
3. migrate project-specific validators/imports/configuration to the new authority;
4. reconcile Agent, SEO, State, MCP/editor/tooling and CI paths;
5. mechanically/explicitly prove no retained project tool depends on stale managed internals;
6. only then remove superseded managed files;
7. rerun structural/deep-integration/SEO validation after removal.

This staged rule applies whether the new topology is root-distributed or an isolated pinned runtime.

## Agent migration

- missing `.agents`: install managed foundation;
- existing `.agents`: preserve native resources and install/register a namespaced current overlay;
- register preserved native resources with unique IDs;
- reconcile routing deliberately;
- route applicable SEO specialists and State rehydration rather than merely registering them;
- never create duplicate equivalent agents/skills;
- never write task status inside `.agents`;
- preserve editor/native discovery files unless explicit conflict reconciliation requires change.

### Bootstrap-valid versus activation-complete routing

A material upgrade may temporarily use a **bootstrap-valid** overlay so the canonical integration task that completes Agent migration can execute. This exception exists only inside the gated integration phase and prevents circular migration deadlock.

Activation requires **activation-complete** routing: every retained executable specialist required by current/future canonical work must be reachable through deterministic routing/supplements/context, State rehydration must be reachable, applicable SEO specialists/gates must be reachable, and independent review/audit ownership must remain intact.

File/manifest registration without reachability is not completed Agent integration.

## Native task models

Unrecognized native task syntax MUST NOT be rewritten blindly. Use deterministic `projection-json` or a project-native validator/normalizer satisfying the projection contract. Projections are read-only and source-hashed.

For large canonical Markdown/native authorities, preserve unrelated task bytes/IDs/states/dependencies where possible and inspect a diff after insertion of the integration phase/frontier dependency. Upgrade work must not silently rephrase the product backlog.

Current 3.x deep integration must include `EK00-005S` or a semantically equivalent SEO applicability/reconciliation task inside the integration-audit ancestry. The task may truthfully resolve SEO to `NOT_APPLICABLE`; omitting the decision is not equivalent to N/A.

## Runtime topology and host wrapper parity

When an isolated pinned runtime is selected, project-root compatibility wrappers/adapters must cover all path-sensitive host/plugin entrypoints that the chosen integrations reference. Inspect generated plugin/hook/MCP configuration rather than assuming direct runtime invocation is sufficient.

Plugin assets used by a managed command are sourced from the **ExecutionKit runtime executing that command**, not assumed to exist under the target project root. Root-distributed and isolated-runtime topologies must both behave correctly.

The full managed runtime tree must remain excluded from product/UI/content/SEO/discovery denominators.

## Version/state behavior

A **major-version** migration returns the project to `BOOTSTRAP` because authority/lifecycle conformance changed. Existing implementation/task state remains intact. Activation happens only after reconciliation, independent integration audit and required validation.

A compatible current minor/patch migration MAY preserve `ACTIVE` when native authority/routing/state remains valid and all required post-migration validators pass. Merely changing the version string is not a reason to reset project state.

Adding a new first-class capability authority such as SEO OS is material even when version-compatible: existing projects must make an explicit capability/applicability decision and reconcile the current frontier before claiming the new conformance model.

## Planning-only transition behavior

M0 projects may truthfully begin with absent product runtime, empty implemented-surface/component/design denominators and unavailable product tests. Every such exception requires an observable transition trigger. Once the corresponding Laravel/Flutter/UI/browser/release surface exists, stale empty adapters/catalogs stop being N/A and become blocking integration defects until reconciled.

SEO is split deliberately between planning applicability and runtime evidence: approved intent for a public organic-search surface makes search architecture/page-family/index policy applicable before implementation, while actual crawl/render/search-engine evidence remains unavailable until the surface exists. A generated route is not automatically indexable.

A prior-adoption M0 project must also preserve its valid historical adoption/control-plane/search evidence rather than being treated as a blank project.

## CI portability

If a project allows more than one runner OS, mandatory structural workflow steps must run on every allowed OS or be explicitly scoped to an OS that supports them. Do not make a universal Windows/macOS gate depend on Bash-only syntax. Prefer cross-platform Node/Python validators for portable structural checks.

Workflow configuration never proves physical runner registration, availability or successful execution.

## Quality/editor additions

Adding an optional quality contract/editor adapter MUST NOT alter canonical task progress. An incomplete newly selected quality/SEO contract may require BOOTSTRAP reconciliation before release. Editor file registration is not runtime verification.

MCP/editor/tooling evidence remains layered: registration, dependency resolution, process startup, tool discovery, host visibility and safe smoke are separate states. Static configuration is not a PASS for host-runtime behavior. Antigravity integrations with SEO enabled must expose the current SEO-aware host entry/skill rather than a stale seven-system bundle.

## Idempotency

A completed migration run MUST be safely repeatable. A second run SHOULD produce no managed changes when versions/config/resources are already aligned. Failure during a repeat attempt MUST restore the state from that attempt, not a stale historical backup.

Idempotency includes runtime topology and SEO overlay: a repeat upgrade must not recreate a retired competing managed runtime, duplicate preserved native Agent resources or silently replace a project-specific SEO contract/authority document.
