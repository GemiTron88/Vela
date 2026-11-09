# Phase EK4 — active canonical tasks

# TODO — ExecutionKit v4 Canonical Entry

> This declared shard owns EK4 task bodies/status. Root `TODO.md` remains the single execution entrypoint/manifest; runtime evidence is never a shadow backlog.

<!-- TASK:EK4-001 -->
### EK4-001 — Verify v4 transactional installation
- Status: READY
- Phase: EK4
- Priority: P0
- Depends: NONE
- Contract: STANDARD_V4.md
- Verification: executionkit doctor .
- Evidence: PENDING

Objective: prove the managed v4 runtime/config/receipt is current and MCP-free.
<!-- /TASK -->

<!-- TASK:EK4-002 -->
### EK4-002 — Prove Antigravity CLI host integration
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-001
- Contract: STANDARD_V4.md
- Verification: invoke Antigravity PreInvocation then run executionkit start . --host antigravity
- Evidence: PENDING

Objective: prove AGENTS→hook→CLI kernel execution in the live host; file presence alone is insufficient.
<!-- /TASK -->

<!-- TASK:EK4-003 -->
### EK4-003 — Reconcile Execution and Agent OS
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-002
- Contract: STANDARD_V4.md
- Verification: executionkit agents plan . --boost
- Evidence: PENDING

Objective: prove deterministic routing, ownership, claims, isolated parallelism and orchestrator integration semantics.
<!-- /TASK -->

<!-- TASK:EK4-004 -->
### EK4-004 — Reconcile State OS
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-003
- Contract: STANDARD_V4.md
- Verification: executionkit state rehydrate . && executionkit state checkpoint . --reason v4-integration && executionkit state amnesia .
- Evidence: PENDING

Objective: prove reconstruction, drift handling, checkpointing and zero-conversation recovery.
<!-- /TASK -->

<!-- TASK:EK4-005 -->
### EK4-005 — Reconcile native Repository Intelligence
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-004
- Contract: STANDARD_V4.md
- Verification: executionkit knowledge status . && executionkit knowledge providers .
- Evidence: PENDING

Objective: prove native source/Git/context consumption, scope freshness and bounded fallback. External CodeGraph, Repomix, RTK and Terrain processes are forbidden from the v4 execution hot path.
<!-- /TASK -->

<!-- TASK:EK4-006 -->
### EK4-006 — Reconcile Content and SEO OS
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-005
- Parallel Safe: YES
- Ownership: content/, public/, resources/, routes/
- Contract: STANDARD_V4.md
- Verification: executionkit seo status .
- Evidence: PENDING

Objective: inspect real product/public surfaces, enable applicable content/search contracts and map executable gaps to TODO.
<!-- /TASK -->

<!-- TASK:EK4-007 -->
### EK4-007 — Build and validate Docs OS knowledge base
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-005
- Parallel Safe: YES
- Ownership: docs/
- Action: document
- Contract: STANDARD_V4.md
- Verification: executionkit docs refresh . && executionkit docs validate .
- Evidence: PENDING

Objective: produce current source-grounded project documentation/knowledge without overwriting manual authorities.
<!-- /TASK -->

<!-- TASK:EK4-008 -->
### EK4-008 — Reconcile Visual OS premium frontend contract
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-005
- Parallel Safe: YES
- Ownership: resources/, src/, lib/, public/
- Contract: STANDARD_V4.md
- Verification: executionkit visual validate .
- Evidence: PENDING

Objective: for every UI-bearing Blade/JS/Web Components/Tailwind/Alpine/Flutter surface, prove premium component/design/responsive/accessibility/rendered-review requirements or truthfully resolve NOT_APPLICABLE.
<!-- /TASK -->

<!-- TASK:EK4-009 -->
### EK4-009 — Reconcile Test OS wave, phase and release execution
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-006, EK4-007, EK4-008
- Contract: STANDARD_V4.md
- Verification: executionkit test wave . --dry-run && executionkit test phase . --dry-run
- Evidence: PENDING

Objective: prove Test OS can plan executable wave/phase coverage and retains exact release evidence paths without imposing automatic per-task testing.
<!-- /TASK -->

<!-- TASK:EK4-010 -->
### EK4-010 — Reconcile Audit OS runtime and boundary configuration
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-009
- Contract: STANDARD_V4.md
- Verification: executionkit systems status .
- Evidence: PENDING

Objective: prove Audit OS runtime, adapters and evidence surfaces are executable; the real heavy audit runs once through the phase boundary gate.
<!-- /TASK -->

<!-- TASK:EK4-011 -->
### EK4-011 — Reconcile Launch OS production path
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-010
- Contract: STANDARD_V4.md
- Verification: executionkit launch status .
- Evidence: PENDING

Objective: prove Launch OS is executable and truthfully reports configured/unconfigured deployment state; exact-candidate readiness, smoke, health, rollback and authorization remain mandatory at release.
<!-- /TASK -->

<!-- TASK:EK4-AUDIT -->
### EK4-AUDIT — Independent v4 deep-integration audit
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-011
- Action: audit
- Audit Boundary: phase
- Contract: STANDARD_V4.md
- Verification: executionkit boundary phase .
- Evidence: PENDING

Objective: atomically run Product Closure, phase Test OS, Content/SEO/Docs/Visual reconciliation, independent Audit OS and State checkpoint; reject any merely installed/documented surface and auto-task blocking findings.
<!-- /TASK -->

<!-- TASK:EK4-ACTIVATE -->
### EK4-ACTIVATE — Activate project execution through v4 kernel
- Status: PLANNED
- Phase: EK4
- Priority: P0
- Depends: EK4-AUDIT
- Contract: STANDARD_V4.md
- Verification: executionkit start . --host antigravity
- Evidence: PENDING

Objective: allow product execution only after v4 host/runtime/system integration is proven.
<!-- /TASK -->

Visual acceptance tasks must reference the canonical surface/state plan, newest source-bound capture run, actual image critic responses and independent audit. Use CURRENT_STATE recapture/reinspection. P0/P1 remain blocking; P2/review requires a dated image-bound rationale. Infrastructure implementation, product certification and unavailable native device evidence are separate statuses.
