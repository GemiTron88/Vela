# P00 — [Phase Name]

**Status:** `[PLANNED|ACTIVE|BLOCKED|GATING|CLOSED]`  
**Authority scope:** detailed contracts for task IDs already registered in canonical `TODO.md`; this file never owns mutable task status.

## Objective

[Observable phase outcome.]

## Entry criteria

- [criterion]

## Scope

### In scope

- [item]

### Out of scope

- [item]

## Cross-cutting invariants

- [security/data/design/architecture constraint]

## Wave plan

A wave is a bounded dependency-aware batch inside this phase. Wave definitions are sequencing/gate metadata only; every executable implementation, audit-remediation and gate action still exists in canonical `TODO.md`/native task authority.

| Wave | Scope/outcome | Dependency gate | Audit gate |
| --- | --- | --- | --- |
| W01 | `[bounded outcome]` | `[task IDs]` | `[canonical wave-audit gate task ID]` |
| W02 | `[bounded outcome]` | `[W01 gate task]` | `[canonical wave-audit gate task ID]` |

Wave audit policy:

- run a focused A1 audit after the bounded wave before dependent next-wave work;
- inspect changed surfaces plus integration seams and applicable premium/component conformance;
- run `node bin/validate-component-system.mjs . --audit --boundary=wave` plus applicable native adapters;
- map/fix material findings through canonical TODO tasks;
- run targeted tests/integration checks;
- do **not** run expensive full self-hosted CI after every task/wave unless native policy explicitly requires it.

## Task contracts

<a id="ex-0001"></a>
### EX-0001 — [Outcome-oriented title]

**Objective**

[Outcome.]

**Scope**

- [item]

**Must not**

- [boundary]

**Context envelope**

Read first:

- `[path]`

Read if needed:

- `[path]`

**Acceptance criteria**

- [observable criterion]

**Verification**

```bash
[command]
```

<a id="ex-0002"></a>
### EX-0002 — [Second outcome-oriented title]

**Objective**

[Outcome.]

**Scope**

- [item]

**Must not**

- [boundary]

**Context envelope**

Read first:

- `[path]`

**Acceptance criteria**

- [observable criterion]

**Verification**

```bash
[command]
```

## Critical journeys and integration seams

Declare the release-critical journeys crossing this phase in `executionkit.integration.json`. For each journey, identify the member task IDs, provider/consumer seams, canonical phase/release gate and the trusted black-box/runtime/browser/device evidence producer. `Depends` remains reserved for true execution prerequisites; journey membership captures independently implementable parts that still must work together.

Before the phase gate is accepted:

- verify the phase-audit gate transitively converges every non-cancelled phase task;
- exercise the actual integrated provider→consumer path, not isolated mocks;
- include material failure/recovery and persistence/restart behavior where applicable;
- build the current candidate and run `node bin/analyze-revalidation.mjs .` after later shared-seam/control changes;
- keep the gate non-terminal while `REVALIDATION_REQUIRED` or any integration finding remains.

## Phase boundary audit

The phase gate is an executable canonical TODO/native task, not prose-only status. Before it can be accepted:

1. phase implementation/task reviews converge;
2. reconstruct the complete phase denominator;
3. run the A2 full phase audit, including `node bin/validate-component-system.mjs . --audit --boundary=phase` and applicable native adapters;
4. independently review rendered premium UI/UX and component-system reuse across affected Livewire/Blade, Web Components and/or Flutter surfaces;
5. map every executable finding to canonical TODO/native tasks and keep the gate non-terminal;
6. remediate and reproduce each material original failure;
7. reconcile findings, TODO and evidence;
8. run the required **manual self-hosted CI once on the final corrected phase candidate** by default;
9. if later remediation changes that candidate, rerun the affected final gate;
10. accept the phase gate only when all required evidence passes;
11. verify `node bin/validate-integration.mjs .` and current-candidate revalidation are clear before closure.

## Phase exit gate

- all required implementation/remediation tasks are `ACCEPTED`/`RELEASED`, or explicitly `CANCELLED` with rationale where allowed;
- every required wave-audit gate and the phase-audit gate are `ACCEPTED`/`RELEASED`;
- no required `IMPLEMENTED`, `REVIEW_REQUIRED`, `CORRECTION_REQUIRED`, open or blocked work remains;
- no unresolved material Audit finding remains outside allowed `ACCEPTED_RISK`/`DEFERRED` policy;
- required integration/regression and independent rendered/runtime review evidence passes;
- final corrected candidate passed required manual self-hosted CI;
- required Audit/Test/Content/quality gates pass;
- documentation and canonical TODO are reconciled;
- Agent + Execution integrity passes;
- Launch gates pass when applicable;
- local Git state/push policy is satisfied before release.
