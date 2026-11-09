# Execution OS

**Standard:** AI ExecutionKit `[STANDARD_VERSION]`  
**Capability level:** `[NONE|LITE|STANDARD|FULL]`

Execution OS owns task lifecycle semantics, Definition of Ready, dependency readiness, reconciliation and closure. It does not own AI role routing; Agent OS does. Canonical mutable status lives only in `TODO.md`. Content, SEO, Audit, Test and Launch may create domain findings/gates, and State OS provides cross-session reconstruction, but none may create a second mutable execution queue.

## Lifecycle

Current semantic lifecycle:

`PLANNED -> READY -> IN_PROGRESS -> IMPLEMENTED -> REVIEW/REVALIDATE -> ACCEPTED -> RELEASED`

Auxiliary states:

- `REVIEW_REQUIRED` — explicit candidate review queue;
- `CORRECTION_REQUIRED` — review failed and focused correction is required;
- `BLOCKED` — concrete blocker + observable unblock condition;
- `CANCELLED` — terminal with rationale;
- `VERIFIED` — migration compatibility alias to `ACCEPTED` where configured.

`PLANNED` is known work but is not automatically executable. The implementation lane begins at `READY`. `IMPLEMENTED` is never sufficient for closure in the default fully AI-driven contract.

Boundary assurance does not add a task state. A canonical task may declare `Action: audit` with `Audit Boundary: ad-hoc|wave|phase|release`; that READY/IN_PROGRESS task routes to independent Audit review instead of implementation. Unsupported actions or invalid/missing audit boundaries fail closed.

SEO OS gates likewise do not create a second lifecycle. Search findings requiring executable work map to canonical tasks; the SEO contract/evidence stays non-authoritative for task status.

## Selection and closure

The lifecycle-aware scheduler selects in this order:

1. dependency-ready canonical `Action: audit` boundary gates;
2. review/revalidation of `IMPLEMENTED` / `REVIEW_REQUIRED` candidates;
3. `CORRECTION_REQUIRED` work;
4. resume interrupted `IN_PROGRESS` work;
5. inspect a `BLOCKED` task only when it explicitly declares a bounded AI-actionable unblock action;
6. new dependency-ready `READY` implementation.

External/non-actionable blockers remain visible in closure reporting but do not starve independent dependency-ready work. The scheduler may not simply scan for `READY`/unchecked implementation while audit/candidate/correction lanes remain, and it may not bypass Definition of Ready by auto-implementing `PLANNED` tasks.

Dependencies are satisfied only by configured accepted/released semantic states. Cancellation does not satisfy dependencies by default.

Project/phase closure requires zero required non-terminal tasks, including required wave/phase audit gates. `BLOCKED` is truthful non-closure, not a hidden terminal state.

## Definition of Ready continuation

A fully autonomous/task-by-task session must not stop merely because the last executable task was accepted and the next dependency-satisfied task is still `PLANNED`.

When `node bin/next-execution.mjs . --json` returns no executable lifecycle action but reports `readinessCandidates`, or when the executor otherwise reaches that condition, run:

```bash
node bin/next-readiness.mjs . --json
```

The command is **read-only**. It identifies `PLANNED` tasks whose canonical dependencies are already satisfied. The agent MUST evaluate the earliest candidate against the project-specific Definition of Ready, contract, current repository truth and required prerequisites.

- If DoR is satisfied, promote only that canonical task `PLANNED -> READY`, run `node bin/validate-execution.mjs .`, then rerun `node bin/next-execution.mjs . --json` and continue.
- If a concrete blocker prevents readiness, record the blocker truthfully under the project lifecycle rather than fabricating READY.
- If DoR is incomplete but not objectively BLOCKED, keep it PLANNED and record/reconcile the exact missing prerequisite in canonical authority as required by the project contract.
- Never implement a PLANNED task directly.

This readiness-maintenance step closes the handoff between accepted dependency work and the next executable task without changing PLANNED semantics or creating a second backlog.

## Wave and phase audit / SEO gates

Use bounded waves when they materially reduce context/integration risk. A wave is sequencing metadata, not another status system.

Default cadence:

```text
task implementation/review -> targeted verification
bounded wave converges -> focused A1 audit + affected-page-family SEO checks where applicable + targeted integration/regression -> wave audit gate
phase converges -> applicable SEO phase verification + full A2 audit -> canonical remediation -> reproduce findings -> manual self-hosted CI on final corrected candidate -> phase audit gate
release candidate -> candidate-bound SEO S3 + A3 exact-candidate Audit/Test/Launch gates
```

Executable Audit/SEO findings MUST become canonical TODO/native tasks. Keep affected owning gates non-terminal where required and add remediation dependencies before correction; reports/contracts never become private queues. If remediation changes the candidate after final phase CI or release evidence, rerun the affected final gates.

Do not run expensive full project CI after every task/wave merely to imitate rigor unless native risk policy explicitly requires it.

## Reconciliation

Before implementation or audit/SEO acceptance, compare canonical task claims with live code/tests/schema/history/evidence. Preserve partial/interrupted work and correct stale task metadata rather than reimplementing from scratch.

For native task syntax, use a deterministic `projection-json` adapter with SHA-256 source hashes. Stale projections fail validation. ExecutionKit does not rewrite unfamiliar task storage blindly. Native projections should carry blocker actionability metadata and `action`/`auditBoundary` when the native model uses canonical audit gates.

## Archive

Terminal accepted/released/cancelled historical task blocks may move to configured archives. IDs/evidence/dependencies remain resolvable and unique. Archives never become executable backlogs. A non-terminal audit/SEO remediation gate cannot be archived merely to make a phase look complete.

## Dependency-safe parallel execution and continuity

ExecutionKit may execute multiple canonical implementation/resume actions concurrently only when the configured runtime is `DEPENDENCY_SAFE_PARALLEL` and every selected task is dependency-ready, explicitly parallel-safe, ownership-disjoint and isolated in a bounded branch/worktree or equivalent host context. One orchestrator remains the sole canonical claim/integration owner. Review, audit, acceptance, correction and production-side-effect boundaries remain serialized unless an explicit audited contract says otherwise.

`/boost` raises only the maximum currently safe concurrency ceiling. It MUST NOT weaken dependencies, ownership, reviewer separation, integration barriers, evidence, Test/Audit/Launch gates or TODO.md authority. Any uncertainty, overlap, shared-hotspot conflict or resource pressure falls back to safe sequential execution.

At start/resume, rehydrate State OS and inspect configured SEO applicability/contract as required before selecting/mutating work. State checkpoints and SEO evidence accelerate safe context reconstruction; current repository/canonical task truth still wins every conflict.

## Reality closure and integration convergence

Task closure and product closure are different truths. A multi-task phase MUST NOT be considered closed merely because every task is terminal. Its canonical phase-audit gate must transitively converge the complete non-cancelled phase denominator. Release-critical user/business/operational journeys are declared in `executionkit.integration.json` (or the configured equivalent), and their phase/release gate must exercise the actual provider→consumer path using applicable black-box/runtime/browser/device evidence. `Depends` expresses execution prerequisites; the integration contract expresses components that must work together even when they could be built independently.

