# Phase Contract

A phase contract groups detailed scope and boundary gates for canonical task IDs. It is not a separate task-status authority.

## Entry & Waves

- Define objective, prerequisites, invariants, risk boundaries and deterministic references needed to start the phase.
- A phase MAY be divided into bounded dependency-aware waves. Wave metadata never becomes a second backlog.
- At wave boundaries (`executionkit boundary wave .`), run focused audit/integration checks and map executable findings back to canonical TODO tasks.

## Phase boundary protocol & Exit gate

Run `executionkit boundary phase .` at phase closure. A phase closes only when:
1. All required implementation/remediation tasks and wave/phase audit gates are `ACCEPTED`/`RELEASED` (or explicitly `CANCELLED` with rationale where policy permits).
2. No required `PLANNED`, `READY`, `IN_PROGRESS`, `IMPLEMENTED`, `REVIEW_REQUIRED`, `CORRECTION_REQUIRED` or `BLOCKED` lane remains for the phase.
3. No unresolved material Audit finding remains except an explicitly permitted `ACCEPTED_RISK` disposition.
4. Required Test, Audit, Content, SEO, Docs, Visual and Decision OS evidence passes on the current candidate.
5. For multi-task phases, the phase boundary gate transitively covers the complete non-cancelled phase denominator, and release-critical journeys verify real cross-component behavior.
6. Projects with `integration.requireSystemReleaseGate=true` converge all active non-cancelled tasks through the canonical release gate before release.
