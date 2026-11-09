# Agent OS

Runtime, discovery, SEO evidence and continuity artifacts are derived state;
canonical TODO remains the only mutable task authority.

**Standard:** AI ExecutionKit `[STANDARD_VERSION]`  
**Capability level:** `[NONE|LITE|STANDARD|FULL]`

Agent OS owns AI orchestration/routing, not task state. `TODO.md` (or the configured native authority) remains the single mutable execution authority. Current 3.x projects compose Agent OS with the seven capability authorities plus cross-cutting State OS as system #8; Agent OS does not absorb the authority of Content, SEO, Audit, Test, Launch or State.

## Core subsystems

- **Agent Registry** — roles and responsibility boundaries.
- **Skills Engine** — reusable capabilities with dependencies, role constraints and evidence expectations.
- **Rules Engine** — global/project constraints loaded by route.
- **Workflow Engine** — lifecycle procedures represented as ExecutionKit contracts and exportable host skills/commands.
- **Contract Registry** — routing, closure, handoff and project-native contracts.
- **Routing Engine** — deterministic task/action-to-context mapping.
- **Task Context Resolver** — minimum relevant context for the selected lifecycle action.
- **Dependency-safe Runtime Coordinator** — plans one or more dependency-ready implementation/resume actions only when explicit safety, ownership, hotspot and isolation guards allow it; otherwise falls back to sequential execution.
- **Handoff/Recovery** — resumable evidence-based continuation after interruption.
- **Adapter/Integration Registry** — MCP, Antigravity, Laravel, Flutter and other host/tool adapters without creating new authority.

## Required behavior

1. Resolve the canonical lifecycle action before choosing an agent or skill.
2. Runtime mode is `DEPENDENCY_SAFE_PARALLEL`; multiple canonical implementation/resume actions may be active only when dependency readiness, explicit parallel safety, ownership disjointness, hotspot checks and isolation are all proven.
3. One orchestrator owns task claims and final integration. Host-native delegates receive the same canonical task IDs/actions/context/acceptance requirements and MUST NOT create a private queue or competing mutable task authority. Any ambiguity falls back to sequential execution.
4. `IMPLEMENTED`/`REVIEW_REQUIRED` candidates route to independent review before normal closure.
5. `CORRECTION_REQUIRED` routes focused corrections back to implementation, then review again.
6. `IN_PROGRESS` interrupted work resumes from repository truth rather than restarting blindly.
7. `BLOCKED` remains visible; automatic blocker analysis is eligible only when canonical metadata declares a bounded AI-actionable unblock action. External blockers must not starve unrelated READY work.
8. Skills may compose through declared dependencies; circular dependencies, conflicts and forbidden roles are invalid.
9. `.agents` MUST NOT contain an executable backlog or mutable task ledger.
10. Mature native agent layers are preserved and reconciled through the manifest; migration MUST NOT overwrite or duplicate equivalent authorities.
11. Routing is deterministic and machine-validated. Every registered executable resource MUST be reachable through a route, supplement or fallback; routed skill dependencies may satisfy skill reachability when dependency expansion is enabled. Adapter metadata alone MUST NOT be treated as routing.
12. State OS rehydration behavior MUST be mechanically reachable through normal task-context/runtime/handoff resolution.
13. When SEO is enabled/applicable, required SEO discovery/planning/technical/specialized/gate resources MUST be registered **and routable**; file presence alone is not integration.
14. User pause/cancellation, safety boundaries and explicit environment authority outrank autonomous continuation.

## Dependency-safe delegation contract

The configured Agent manifest (normally `.agents/manifest.json`) uses `delegation.mode = DEPENDENCY_SAFE_PARALLEL`, `oneLifecycleActionAtATime = false`, explicit parallel-safety/ownership/isolation guards, `role.orchestrator` as final integration owner and deterministic sequential fallback.

Parallel execution is an optimization, not a second authority. Canonical task state remains in TODO/native authority; claims/worktrees/checkpoints are derived coordination state. `/boost` may raise concurrency limits only for work already proven safe and MUST preserve reviewer separation, targeted verification, phase/release gates and evidence freshness.

Current manifests MUST NOT expose a competing task queue or independent mutable ownership lane. Legacy execution-policy fields from older installs must be reconciled during migration rather than carried forward.

Reviewer separation remains mandatory where configured. Separation means the acceptance decision comes from the reviewer role on the appropriate subsequent lifecycle action; it does not require simultaneous sessions.

## Skills Engine boundary

Skills are composable Agent OS resources, not a separate Skills OS. Specialist skills supplement the lifecycle role; they must not replace reviewer separation or create private work queues.

Every skill used by a route should define enough metadata for deterministic resolution: ID, purpose/tags, dependencies/conflicts, allowed roles, preconditions, expected inputs/outputs and evidence requirements where applicable.

SEO skills serve SEO OS; State skills serve State OS. Routing them through Agent OS does not transfer their domain authority into Agent OS.

## Runtime, State, SEO, discovery and evidence boundary

Runtime checkpoints, State snapshots, SEO contracts/evidence, discovery inventories, candidate envelopes and evidence graphs are **derived/control-plane state**. They normally live under `.executionkit/` where applicable, are excluded from product discovery and MUST NOT become a backlog or mutable task authority.

Acceptance/release evidence must bind to the candidate/environment it proves. A route, skill registration, SEO contract or editor file alone does not prove execution, indexing, ranking or runtime activation occurred.

## Editor/runtime boundary

Generated editor entrypoints, plugin files, hooks and MCP configuration make canonical resources discoverable to a host. File presence proves registration shape only. Installed editor activation, MCP handshake/tool calls, delegated execution, browser/device tests, search-engine behavior and production behavior require direct runtime/external evidence.

Antigravity integration is skill/MCP/plugin oriented. Current bundles include an SEO host skill and eight-system TODO-first rule. ExecutionKit does not require a host-specific workflow file to become a second source of truth.

## Integrity gate

Runtime steps require exclusive step ownership and a validated selected-task state transition. Respect CANCELLED/INVALID_STATE/RUNTIME_BUSY; scheduler reordering or deleting a task is not progress. After the host step stops, resume an operator pause explicitly with `node bin/runtime-recover.mjs . --resume-cancelled`. Inspect stale locks before removing them; cancellation does not guarantee host process-tree termination.
