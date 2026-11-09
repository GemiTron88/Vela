# Finding Contract

**Status:** CANONICAL contract.  
**Used by:** Audit, Content, Test, Launch and reconciliation findings.

## Required fields

- Finding ID.
- Source capability/domain.
- Severity/priority.
- Statement of the observed gap.
- Evidence/reproduction.
- Disposition.
- TODO mapping if executable work is required.

## Recommended finding IDs

- `AUD-*` audit;
- `CNT-*` content;
- `TSTGAP-*` test gap where a dedicated finding ID is useful;
- `RELGAP-*` launch/release gap.

## Dispositions

- `OPEN` — not yet triaged; should be transient.
- `MAPPED` — linked to a canonical TODO task.
- `DUPLICATE` — linked to another finding/task.
- `FIXED` — closure evidence proves the original failure condition no longer fails.
- `ACCEPTED_RISK` — unresolved risk/gap consciously accepted by authorized decision with rationale/scope/expiry as applicable.
- `INVALID` — disproved/stale with evidence.
- `DEFERRED` — linked to a future canonical TODO task and explicitly allowed by gate policy.

`ACCEPTED_RISK` is intentionally distinct from task lifecycle state `ACCEPTED`. A finding can be accepted as risk while the task that records/implements a mitigation follows its own lifecycle; do not overload one word for both meanings.

## Executable finding rule

If a finding requires code/content/configuration/documentation work, it MUST map to a canonical TODO/native task ID before it can be considered properly triaged.

A finding document is not allowed to become an autonomous action queue or status ledger.

## Closure evidence

`FIXED` requires evidence specific to the original reproduction/acceptance condition, not merely a generic task completion statement or unrelated green suite.

## Accepted risk

`ACCEPTED_RISK` should include:

- decision authority;
- rationale;
- impact;
- affected scope/environment;
- duration/expiry or review condition where appropriate;
- compensating controls where applicable;
- linked task/gate if future remediation remains required.

P0/P1 or otherwise material findings MUST NOT disappear by being archived, renamed or converted to prose. Their disposition and evidence remain auditable.