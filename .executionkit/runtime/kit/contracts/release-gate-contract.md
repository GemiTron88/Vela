# Release Gate Contract

**Status:** CANONICAL contract.

## Purpose

A release gate is a condition that must be satisfied, waived/accepted by authority, or declared non-applicable before production distribution.

## Required fields

- Gate ID, normally `REL-*`.
- Name.
- Applicability.
- Pass criteria.
- Evidence requirement.
- Status.
- Blocking severity.

## Recommended statuses

- `NOT_EVALUATED`
- `PASS`
- `FAIL`
- `WAIVED`
- `N/A`

## Work-generation rule

A failed gate may identify work, but the implementation action must be represented in TODO.

Example:

```text
REL-DATA-004: FAIL
Reason: restore rehearsal failed on encrypted backup
Execution task: EX-0872
```

The gate remains FAIL until verification proves the pass criteria.

## Waiver

A waiver must record:

- authority;
- rationale;
- residual risk;
- duration/release scope;
- follow-up task if risk remains actionable.

## Candidate binding

Release-gate evidence must be bound to the candidate revision/artifact where the result could change with code/configuration.
## Reality-closure requirement

A production/release gate MUST fail closed when configured critical-journey applicability is unresolved, a required journey gate is non-terminal, the gate does not converge all declared journey members, or candidate-bound trusted evidence is unavailable. `all tasks terminal` is necessary execution truth but is not sufficient release truth.

