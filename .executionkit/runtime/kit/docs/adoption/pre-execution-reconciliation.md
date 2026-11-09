# Pre-Execution Reconciliation Checklist

**Status:** CANONICAL adoption gate.

Use this before implementation begins in a newly planned/adopted project, after a material migration, or when execution drift is suspected.

## Repository reality

Confirm:

- default/current branch and HEAD;
- local working tree/uncommitted/interrupted work when locally observable;
- unpushed/behind state when an upstream exists;
- existing code/tooling and package/framework versions;
- current schema/migrations/data boundaries;
- CI workflows/validators and actual runner assumptions;
- native test/build commands that really run;
- implemented public/indexable versus authenticated/private/native-only surfaces;
- no remote-only inspection is being presented as proof of a user's local state.

## Planning authority

Confirm:

- current approved product specification;
- accepted architecture/implementation/search decisions/contracts;
- known superseded plans;
- unresolved product/search decisions are explicit blockers/dependencies;
- no two canonical/current documents claim contradictory authority.

## Canonical task integrity

Confirm:

- one mutable TODO/native task authority exists;
- configured archives contain terminal history only;
- every remaining executable requirement has a task or deliberate mapping strategy;
- implemented/candidate work is not presented as untouched READY work;
- task IDs are globally unique/stable across active + archive;
- dependencies exist and are acyclic;
- READY tasks satisfy Definition of Ready and accepted dependency semantics;
- candidate/review/correction/blocker work remains visible;
- SEO contracts/reports, State snapshots, audits, evidence, Agent resources and handoffs do not become a second executable checklist/status ledger.

## Agent OS reconciliation

Confirm:

- root `AGENTS.md` binds the canonical task authority and `.agents`;
- the configured manifest exists and validates;
- roles, skills, rules, workflows, contracts and required templates are registered;
- required resources are also deterministically routable — `registered == integrated` is forbidden;
- State rehydration and applicable SEO specialists/gates are reachable from normal execution/review/release context;
- stack/quality specialists are selected by deterministic task metadata/tags rather than private agent queues;
- reviewer separation is preserved where required;
- `.agents` contains no mutable task state/backlog markers;
- mature native resources are preserved/registered rather than overwritten or duplicated;
- execution uses `DEPENDENCY_SAFE_PARALLEL` only for dependency-ready, explicitly parallel-safe, ownership-disjoint and isolated implementation/resume work; one orchestrator owns claims/integration, `/boost` changes only the safe concurrency ceiling, and uncertainty falls back to sequential execution without creating another task/session queue.

## Capability reconciliation

Select and validate all **seven capability-authority levels** — Execution, Agent, Content, SEO, Audit, Test and Launch. State OS is cross-cutting system #8 and is reconciled separately; it is not capability-leveled.

### Execution OS

Lifecycle, dependencies, closure, archive and canonical state semantics are coherent. `PLANNED` is not auto-executable; `IMPLEMENTED` is non-terminal; normal current-line closure targets independently evidenced `ACCEPTED`.

### Agent OS

Routing/context/skills/reviewer/blocker policies are deterministic and connected to Execution without owning task state. State and enabled SEO behavior must be registered **and routable**.

### Content OS

All actionable content gaps map to canonical TODO; content inventories remain criteria/coverage, not a backlog. Content OS owns content inventory, provenance, editorial lifecycle and actual content quality.

### SEO OS

Make an explicit applicability/depth decision from real public organic-search intent and surfaces:

- `NONE` / evidence-backed `NOT_APPLICABLE` is valid where no public organic-search surface exists;
- enabled SEO uses `LITE`, `STANDARD` or `FULL` with a matching SEO contract profile;
- enabled SEO cannot bypass `seo.requiredForRelease=true`;
- reconcile intent/entities/page families, Search Surface Contracts, crawl/index/canonical rules, structured search semantics, internal discovery, and applicable local/ecommerce/international/programmatic modes;
- route/database entity existence never implies index eligibility;
- programmatic indexability is fail-closed until distinct intent/value/coverage is proven;
- S0–S5 are SEO search criteria/evidence boundaries, not task-state authority;
- Lighthouse/schema/metadata presence alone is not SEO acceptance and no validation guarantees indexing, ranking, traffic or rich-result appearance.

### Audit OS

All unresolved material findings map to TODO or an authorized non-action disposition such as `ACCEPTED_RISK`. Audit independently challenges SEO denominator, implementation and evidence; it does not take over SEO policy.

### Test OS

Missing implementation/test work is mapped; required commands/environments are real; skipped/flaky/not-run required checks stay visible. Test owns execution/adequacy/freshness of browser/Lighthouse/performance/schema/check evidence while SEO owns search criteria.

### Launch OS

Release blockers requiring implementation map to TODO; operational gates remain gates/evidence rather than shadow tasks. Launch owns candidate release/deployment/rollback authority and invokes applicable SEO S3/S4/S5 gates; SEO owns the search criteria those gates evaluate.

## State OS reconciliation

Confirm:

- State OS is enabled/reconciled as cross-cutting system #8 where current 3.x policy requires it;
- snapshots/journal/checkpoints remain derived observations under `.executionkit/`, never task authority;
- resume follows `BOOT → REHYDRATE → VERIFY → RESUME` against live branch/HEAD/worktree/TODO/code/evidence;
- external memory, if present, is advisory and live-revalidated;
- current safe execution position can be reconstructed through the zero-context Amnesia Test before long-running continuity is claimed.

## Product quality / coverage

When product quality is contractual:

- select standard/premium quality deliberately;
- inventory applicable screens/components/journeys/APIs/content/search domains;
- compare declared inventory with real route/component/content/spec/search-surface discovery;
- map every required dimension to canonical tasks and reproducible verification;
- preserve stronger project-native quality/search gates;
- do not treat structural coverage as proof that the inventory is exhaustive, the product is premium or a page is search-eligible.

## Counts/progress

- remove stale manually typed completion percentages/totals;
- derive counts from canonical state;
- ensure phase/project closure matches actual non-terminal task state.

## References and adapters

- task/phase contract paths/anchors exist;
- important spec/code/test/search references exist;
- native task projection is current/hash-bound when used;
- quality/editor/runtime paths remain inside the project and satisfy path/symlink safety;
- superseded references are not used by READY tasks;
- external references needed for execution are accessible or truthfully blocked.

## CI / release boundary

Confirm:

- manual self-hosted CI policy unless an explicit allowed exception exists;
- stable project runner label;
- no silent hosted-runner fallback;
- full CI runs at configured phase/release-candidate boundaries rather than after every task; targeted verification remains task-local;
- required Mac/Windows evidence only where contractually applicable;
- candidate identity includes the current SEO contract when present;
- applicable SEO S3 is bound to the exact current candidate and cannot be bypassed by enabled SEO configuration;
- S4 production verification and S5 ongoing SEO observability remain distinct from S3 and require real post-deployment/operational evidence;
- release-readiness cannot pass with non-terminal canonical work, dirty/unsynchronized local git, invalid Agent/Execution/State/SEO/CI state, or failed configured product evidence.

## Final gate

Run the project integrity validators and inspect warnings. Resolve structural failures before autonomous selection. Where deep integration is required, the independent integration audit gate must be accepted before activation/product-frontier execution.

Result should be one of:

- `READY FOR EXECUTION` — control plane is coherent and a deterministic lifecycle action is eligible;
- `BLOCKED BEFORE EXECUTION` — concrete blockers/unblock conditions are preserved;
- `PLANNING RECONCILIATION REQUIRED` — authoritative product/search intent still conflicts.

`READY FOR EXECUTION` does not mean every task is READY or that the project is release-ready. Review/correction/resume work may correctly be the next action.