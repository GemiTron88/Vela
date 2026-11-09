# Reconciliation and Drift Control

**Status:** CANONICAL current-3.x guidance derived from `STANDARD.md` + `STANDARD_V3.md`.

## Purpose

Reconciliation compares project claims against actual repository/runtime evidence and restores one coherent execution model without discarding valid partial work, stronger native controls, current search truth or interrupted work.

It is mandatory before first implementation in a newly planned/adopted project, after material migration and again whenever material drift is detected.

## Reconciliation inputs

Inspect as applicable:

- current branch/HEAD, working tree, upstream/divergence and relevant repository history;
- canonical TODO/native task authority and configured archives;
- task/phase contracts;
- approved specifications and accepted decisions;
- all seven capability authorities: Execution, Agent, Content, SEO, Audit, Test and Launch;
- State OS continuity/config/checkpoint policy as cross-cutting system #8;
- `.agents` manifest/resources/routing and native adapters;
- actual public/indexable, authenticated/private and native-only surfaces plus SEO contract/applicability when configured;
- tests, CI, validators and quality/content/search contracts;
- release-candidate/launch evidence, including exact-candidate SEO S3 when applicable;
- generated artifacts, schema and configuration;
- open findings, blockers and known incidents;
- production/search-state evidence where production is actually claimed.

Conversation memory, State snapshots and external memory are secondary hints. Live repository/runtime/canonical authority wins every conflict.

## Checks

### Implemented/candidate work still presented as new

If implementation already exists:

- inspect the current code and evidence;
- preserve valid partial/interrupted work;
- route `IMPLEMENTED` / `REVIEW_REQUIRED` through independent review/revalidation rather than reimplementing;
- promote to `ACCEPTED` only when the current contract and evidence justify it.

Code/file presence on a branch — including `main` — is not acceptance or release-promotion evidence by itself.

### Open work incorrectly closed

If a task is `ACCEPTED`/`RELEASED` (or legacy `VERIFIED` mapped to `ACCEPTED`) but current acceptance/evidence fails:

- correct the canonical state according to project history policy;
- map focused corrective work when needed;
- do not preserve false completion merely because an old report was green.

### Missing tasks

Every unresolved executable requirement/finding/remediation must map to the canonical task authority. Agent OS, SEO contracts/reports, State snapshots, audits, test plans, quality contracts, launch checklists, evidence and handoffs may reference tasks but MUST NOT become execution queues.

### Capability-authority drift

Confirm the current project-specific boundary for all seven capability authorities:

- Execution owns canonical lifecycle/dependencies/selection/closure;
- Agent owns deterministic orchestration/routing/context without task state;
- Content owns content inventory/provenance/editorial lifecycle;
- SEO owns organic-search applicability, search architecture, crawl/index/canonical policy, Search Surface Contracts, specialized search modes and S0–S5 search criteria;
- Audit independently challenges implementation/evidence/denominator;
- Test owns executed checks, adequacy/freshness and reproducible evidence;
- Launch owns candidate release/deployment/rollback/production authorization.

State OS is system #8 and remains cross-cutting/non-capability-leveled. Fleet Agent, MCP, Antigravity and Elmasna3 remain integrations/subsystems rather than extra OS authorities.

### SEO drift

When SEO is configured or a public organic-search surface exists:

- reconcile `capabilities.seo`, contract profile and real applicability;
- do not infer index eligibility from route/database entity existence;
- fail closed on thin/empty/duplicate/generated/programmatic indexability until distinct intent, visible value and declared coverage are proven;
- preserve production robots/noindex/canonical/redirect/sitemap/hreflang behavior unless explicitly authorized to change it;
- ensure enabled SEO cannot bypass `requiredForRelease=true` and candidate-bound S3;
- treat Lighthouse/schema/metadata as evidence inputs, not the SEO authority or a ranking/indexing guarantee;
- mark stale candidate-bound SEO evidence invalid after material contract/candidate drift.

### State/continuity drift

Confirm current branch/HEAD/worktree/TODO/implementation/Agent route/evidence against the latest State hint. If they disagree, live truth wins. Preserve interrupted dirty work, rehydrate/reconcile, then checkpoint a new truthful state. External memory remains `ADVISORY_ONLY`.

### Agent-layer drift

Confirm:

- root `AGENTS.md` binds canonical TODO/native authority and `.agents`;
- manifest paths/IDs/routes resolve;
- specialist skills/rules/workflows/contracts are registered **and deterministically routable**;
- State rehydration and applicable SEO specialists/gates are actually reachable from normal lifecycle context;
- no `.agents` file owns mutable task state;
- lifecycle role and reviewer separation remain consistent with Execution OS;
- native resources are preserved/registered rather than duplicated by generated overlays.

`registered == integrated` is forbidden.

### Runtime/concurrency drift

Execution uses `DEPENDENCY_SAFE_PARALLEL` only where dependency, ownership, hotspot and isolation checks prove independence. One orchestrator owns canonical claims and final integration; parallel workers cannot create another queue or mutable ownership lane, and uncertainty falls back to sequential execution.

### Duplicates

Merge execution authority into one immutable canonical task ID. Preserve references from findings/history. Duplicate Agent resource IDs or equivalent competing authorities are integrity failures.

### Stale documentation

Update, demote or mark documents REFERENCE/HISTORICAL/SUPERSEDED. Do not leave a **current canonical** file teaching old lifecycle, capability-count, State-system-number, SEO ownership or routing semantics after the runtime/standard has changed. Intentionally historical version documents remain historical and must not be silently rewritten into current claims.

### Incorrect counts

Remove/fix stale hand-maintained totals. Version-bound regression floors may be declared only when synchronized with the canonical baseline; a declared floor is still not an executed PASS.

### Competing backlogs

Any executable checklist outside canonical TODO/native authority must be mapped, converted to non-executable criteria/evidence, or retired. `TODO_ARCHIVE.md` contains terminal history only and is not a backlog.

### Broken references

Validate referenced paths/anchors, native task projections and quality/evidence/search paths. A task is not READY when essential context is broken or its dependencies are unsatisfied.

### Test/evidence mismatch

Check claims such as “covered by tests”, “premium”, “accessible”, “SEO complete”, “candidate passed”, “production verified” or “release ready” against actual current candidate/environment evidence. Structural metadata, generated tests or zero-exit assumptions alone are not product/release evidence.

### Code/spec contradiction

Decide which authority is stale/wrong. Map an executable reconciliation task or explicit blocker where necessary; do not let the agent silently choose product/search intent.

### Blocker classification

Preserve exact blockers. Mark an unblock action AI-actionable only when a bounded safe repository-side action exists. External/non-actionable blockers remain visible but must not starve unrelated dependency-ready work.

## Reconciliation output

A successful pre-execution reconciliation should leave:

- one canonical mutable execution authority;
- valid active/archive task identity and dependencies;
- truthful lifecycle states with candidate/review/correction work visible;
- clear current versus historical document authority statuses;
- all seven capability authorities coherent plus State OS #8 reconciled;
- explicit SEO applicability/profile/search-surface truth or evidence-backed `NOT_APPLICABLE`;
- valid Agent OS manifest/resources with required resources registered **and routable**;
- mapped findings and quality/content/search/release gaps;
- no unresolved critical contradiction hidden by prose;
- valid essential references/projections;
- truthful validator/evidence state with unavailable required checks remaining `NOT_RUN`/blocked rather than PASS;
- first eligible lifecycle action deterministically resolvable without bypassing deep-integration or release dependencies.

`READY FOR EXECUTION` does not mean every task is READY, that implementation is accepted or that the project is release-ready; it means the control plane is coherent and the scheduler can truthfully select the next canonical lifecycle action.

## Frequency

Reconcile:

- before first execution/adoption;
- after material migration;
- when material requirements/architecture/search policy change;
- after branch/candidate/control-input drift that invalidates evidence;
- at phase/release-candidate boundaries;
- after emergency production work;
- when an interrupted session cannot be reconstructed cleanly;
- whenever validators expose structural drift.

Do not run full-system reconciliation after every tiny task without evidence of drift. Task-local verification remains targeted; complete expensive CI follows the configured phase/release-candidate cadence.