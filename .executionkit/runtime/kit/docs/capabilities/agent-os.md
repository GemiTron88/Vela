# Agent OS Capability — current 3.x

Agent OS is the orchestration/routing authority of AI ExecutionKit. It coordinates work across Execution, Content, SEO, Audit, Test and Launch while deliberately not owning task state. State OS is the cross-cutting continuity system whose rehydration behavior must be mechanically reachable through normal Agent OS context/routing.

## Authority boundary

- Execution OS + canonical `TODO.md`/native authority own task lifecycle and mutable status.
- Agent OS owns roles, skills, rules, workflow contracts, routing, context minimization, dependency-safe parallel runtime coordination and handoffs.
- Content/SEO/Audit/Test/Launch remain domain authorities and may contribute specialist resources to Agent OS routing.
- State OS owns continuity/reconstruction semantics, not task selection; its skills/context must be routable through Agent OS.
- Runtime/discovery/SEO evidence/State/evidence artifacts are derived/control-plane state, not another task authority.

This separation prevents the agent layer from becoming a second project manager or shadow backlog.

## Required components

Every conforming AI-executed project has a configured machine-readable manifest and registered resources for roles, skills, rules, workflows and contracts. Templates are required where referenced by the manifest.

Registration alone is not integration. Every registered executable Agent resource must be reachable through a deterministic route, supplement or fallback. A skill may additionally be reachable transitively as a declared dependency of a routed skill when dependency expansion is enabled. `adapterFor`/adapter metadata documents composition intent but does not by itself make a resource routable. `registered == integrated` is forbidden.

For current 3.x projects with SEO enabled, the project-specific routing graph must make applicable SEO discovery/planning/architecture/technical/specialized/gate behavior reachable. A file-only SEO skill bundle is not deep integration. State rehydration must likewise be reachable through the normal execution-context graph.

The validator rejects missing manifests/resources, duplicate IDs, broken references, unsupported predicates, skill dependency cycles/conflicts/forbidden roles, registered-but-unroutable resources, executable task markers under `.agents`, unregistered managed resources, task-authority mismatches and invalid dependency-safe delegation policy.

## Skills Engine (not a separate OS)

Skills are composable Agent OS resources. A skill may declare:

- ID, path, purpose/capabilities and tags;
- `requires` and `conflictsWith`;
- preconditions, inputs and outputs;
- required evidence;
- allowed roles;
- risk and routing priority metadata.

The resolver expands transitive dependencies deterministically and loads only the selected minimum context. A separate Skills OS is intentionally avoided because skills do not own an independent task lifecycle or mutable authority.

SEO skills are Agent OS resources serving the SEO capability authority; State skills serve the cross-cutting State authority. Their existence does not transfer SEO/State ownership into Agent OS.

## Lifecycle-aware routing

The default closure-oriented scheduler prioritizes:

1. independent review/revalidation of `IMPLEMENTED` / `REVIEW_REQUIRED` candidates;
2. `CORRECTION_REQUIRED` focused correction;
3. resume of interrupted `IN_PROGRESS` work;
4. blocker inspection only when canonical metadata declares a bounded AI-actionable unblock action;
5. new dependency-ready `READY` implementation.

`PLANNED` is not executable. External/non-actionable blockers remain visible to closure but do not repeatedly preempt unrelated READY work. A project is not closed while any required task remains non-terminal.

Task tags/context may add SEO specialist supplements, but supplements do not alter canonical lifecycle priority or create a parallel SEO lane. For example, a search-facing correction remains the same canonical `correct` action with the relevant SEO + stack/domain resources composed into its resolved context.

## Dependency-safe parallel runtime and bounded delegation

Current 3.x ExecutionKit uses `DEPENDENCY_SAFE_PARALLEL` for implementation/resume work when independence is proven. The runtime and Agent manifest MUST agree on the policy.

Canonical task fan-out requires all of the following:

- dependencies are satisfied;
- each task explicitly opts into parallel-safe execution or an equivalent deterministic adapter proves it;
- file/domain ownership is disjoint;
- shared coordination hotspots do not overlap;
- isolated worktrees/branches or equivalent bounded contexts are available;
- one orchestrator owns claims, deterministic integration and final candidate reconciliation;
- reviewer separation, targeted verification, phase/release gates and evidence freshness remain intact.

`/boost` may raise only the maximum currently safe concurrency ceiling. It MUST NOT create a second queue, skip gates or turn agent availability into proof of independence. Any uncertainty or conflict forces sequential fallback.

Runtime checkpoints/claims remain derived coordination state. They support interruption/recovery of the active safe batch but never become canonical task authority.

## Runtime, State, discovery, SEO and evidence

Agent OS consumes the managed runtime/discovery/evidence subsystems and routed State/SEO resources without taking over their domain contracts:

- runtime checkpoints support interruption/recovery of one sequential action;
- State OS provides cross-session/context rehydration and bounded checkpoints;
- discovery provides a derived product inventory denominator;
- SEO discovery/contract evaluation provides a search-surface denominator and applicable specialist context;
- reconciliation maps executable gaps back to canonical project authority;
- candidate identity binds evidence to commit/tree/control hashes/environment/toolchain identity, including the SEO contract when configured;
- trusted evidence adapters normalize raw product/tool results;
- evidence and coverage graphs provide traceability, not task state.

Derived artifacts live under `.executionkit/` by default and are excluded from product discovery and canonical mutable task state.

## Stack, quality, SEO and editor packs

Native template skills use `SKILL.md`. Specialist supplements cover Laravel/Livewire/Tailwind/Alpine, Flutter/Dart, Web Components, premium component/design quality, content, SEO discovery/planning/architecture/technical/programmatic/local/commerce/international/structured-data/gates, search-facing performance, security, data/migrations, offline sync, transaction integrity, authorization and observability while retaining the lifecycle role.

SEO OS is not synonymous with Lighthouse/performance. Search-facing performance is one routed evidence dimension; search intent/indexability/canonical/structured-data/programmatic policy stays with SEO OS.

Optional Antigravity integration uses plugin/skills/hooks and CLI. Current bundles expose an `ek-seo` host skill and a ten-system TODO-first entry rule. Registration/discovery is not evidence of IDE activation, CLI integration, delegated execution, search-engine behavior or product behavior. Use direct runtime evidence for those claims.

Use plain criteria bullets in `.agents`; mutable task checkboxes/status markers belong only in canonical task authority. Nested skill reference files are supporting context, not separate skills unless explicitly registered.

## Runtime step integrity

The runtime serializes CLI invocations with `.executionkit/runtime/step.lock`. `RUNTIME_BUSY` never starts another delegate. A real step validates canonical Execution/current policy before and after delegation and reports `STEP_COMPLETED` only when the selected task changes canonical state. Invalid authority/removal returns `INVALID_STATE`; a changed scheduler order alone returns `NO_STATE_TRANSITION`. None of these reports owns task progress.

Cancellation survives subsequent calls and a running delegate's return. See `docs/architecture/failure-recovery.md` for explicit resume and stale-lock handling. Cancellation stops further delegation; host process-tree termination is not guaranteed.
