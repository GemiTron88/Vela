# Execution OS — AI ExecutionKit repository

**Standard:** AI ExecutionKit 2.2.4 release line with 3.0 release-candidate work in progress.  
**Capability level:** `STANDARD`

For work on this distribution repository, `TODO.md` is the sole mutable execution/backlog authority. `examples/*/TODO.md` are fixtures only and MUST NOT drive repository work.

Execution uses `DEPENDENCY_SAFE_PARALLEL` for implementation/resume work when independence is proven by dependency, ownership, hotspot and isolation guards. `/boost` may increase only that proven-safe concurrency ceiling. One orchestrator owns canonical claims/integration; reviewer independence, phase/release gates, evidence and TODO.md authority remain unchanged, and uncertainty falls back to sequential execution. Existing implementation discovered during 3.0 reconciliation may be represented at its evidence-supported non-terminal state, but historical review/acceptance MUST NOT be fabricated.

State OS, PR descriptions, architecture waves, checklists, validation output and release notes are derived evidence/context. None may own mutable task state.

Use `node bin/next-execution.mjs . --json`, `node bin/next-readiness.mjs . --json`, `node bin/resolve-task-context.mjs . --next --json` and the runtime tools against the repository root when selecting work.

## V35 reality-closure execution rule

For this distribution repository, terminal task counts are insufficient for closure. Multi-task phases require a canonical phase audit gate that transitively converges the complete non-cancelled denominator. The V35 critical journey is declared in `executionkit.integration.json`; changes that invalidate accepted proof are routed through `node bin/analyze-revalidation.mjs .` and stale accepted gates may be selected as `revalidate` actions. Historical ACCEPTED state does not make stale evidence valid for a new candidate.
