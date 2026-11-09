# Reality Closure & Integration Graph

**Status:** CANONICAL architecture for the V35 hardening line.

## Purpose

ExecutionKit must distinguish **Task truth** from **system truth**. A repository can contain individually accepted tasks while the resulting product is still incoherent because provider/consumer seams, shared state, runtime behavior, failure paths, restart persistence or production evidence were never exercised together.

This capability is cross-cutting across the existing eight systems. It is **not a ninth OS**.

## Failure class that triggered V35

The reproduced failure pattern was:

1. component tasks were implemented and accepted independently;
2. hard dependencies described implementation order but not every integration relationship;
3. the scheduler could exhaust all non-terminal tasks;
4. closure treated terminal task count as sufficient;
5. evidence validators could prove that an evidence file existed without proving the claimed whole-system behavior;
6. later changes did not explicitly surface which earlier accepted proof had become stale;
7. a project could therefore report complete/production-ready while a first black-box user journey still exposed disconnected or simulated behavior.

The root cause was not simply missing tests. It was an enforcement gap between documented integration/acceptance policy and the machine closure model.

## V35 invariants

### 1. Phase convergence

A multi-task phase requires a canonical `Action: audit` / `Audit Boundary: phase` gate. That gate must transitively depend on the complete non-cancelled phase denominator. Terminal task counts without convergence are non-closure.

### 2. Critical-journey graph

`executionkit.integration.json` declares release-critical user, business and operational journeys. A journey records:

- member canonical task IDs;
- the canonical phase/release gate that converges them;
- whether it is release-required;
- the required black-box/runtime/browser/device/integration verification modes;
- trusted evidence producers.

`Depends` continues to mean a hard execution prerequisite. Journey membership represents components that may be implemented independently but still must work together.

### 2A. System release convergence

Individually converged phases still do not prove that the complete release candidate coheres. When `integration.requireSystemReleaseGate=true`, the integration contract declares one canonical `releaseGateTask` with `Action: audit` / `Audit Boundary: release`. At release, that gate must be accepted and its transitive dependency closure must cover every active non-cancelled canonical task in the release denominator. This prevents disconnected phase islands from adding up to a false system-level completion claim.

### 2B. Scenario-scoped journey proof

A producer name alone is not sufficient journey evidence. Every release-required journey declares concrete `requiredScenarios`; each bound evidence adapter declares an explicit black-box/runtime/browser/device/integration observation boundary plus `journeyCoverage` for those scenario IDs. Release validation rejects missing producer configuration, generic test-only producer types, absent report paths/commands and incomplete scenario coverage. The collector still binds the resulting artifact to the exact candidate/environment.

### 3. Candidate-bound evidence

A production/release claim cannot be established by a prose label or hand-authored `REAL_PRODUCTION` JSON. Strict Launch truth requires an exact candidate plus current reports emitted by configured ExecutionKit collectors. The collector binds command, commit/tree/candidate, environment, timestamps, exit status and produced artifact hash.

### 4. Change-impact revalidation

Building a new candidate preserves the previous candidate lineage. `bin/analyze-revalidation.mjs` compares the prior and current candidate revisions, identifies accepted contracts referenced by changed files, classifies control-plane changes and maps affected release-critical journeys.

When mapping is incomplete, product changes fail closed across release-critical journeys rather than assuming they are unrelated. Current trusted candidate evidence clears release proof; historical ACCEPTED task state remains history but cannot make stale evidence current.

### 5. Scheduler revalidation

If an accepted phase gate no longer converges its phase denominator, the lifecycle scheduler may return that gate as a `revalidate` action. This prevents a zero-open-task dead end where closure is false but no lifecycle action explains why.

### 6. Migration safety

Existing projects are not reset wholesale. Migration preserves canonical TODO bytes and valid implementation, installs the new integration/revalidation controls, sets strict release truth, initializes unresolved journey applicability when necessary and blocks only unsupported closure/activation claims until project-specific reconciliation is complete.

Implementation may continue while closure proof is being reconciled; production/release acceptance may not.

## System ownership

- **Execution OS:** phase convergence, scheduler revalidation, canonical closure semantics.
- **Agent OS:** journey-aware routing, provider/consumer seam review and revalidation priority.
- **Audit OS:** independently challenges system composition and evidence truth.
- **Test OS:** supplies actual journey/black-box/runtime evidence and negative failure coverage.
- **Launch OS:** fails closed on unresolved journeys, stale evidence and unproven candidate truth.
- **State OS:** preserves continuity but never upgrades stale proof into current truth.
- **Content/SEO OS:** retain their own applicability/quality authorities and participate in journeys when their surfaces are release-critical.

## Closure equation

A release is not:

```text
all tasks terminal = complete
```

The minimum truth is:

```text
canonical task closure
+ phase convergence
+ declared critical-journey convergence
+ system release-gate convergence
+ scenario-scoped black-box producer coverage
+ current candidate identity
+ current trusted evidence
+ applicable black-box/runtime proof
+ change-impact revalidation clear
+ Audit/Test/Launch gates
= eligible for release acceptance
```

Every term is fail-closed when required and unavailable.
