# Document Authority Contract

**Status:** CANONICAL contract.

## Purpose

Prevent stale plans, generated reports, editor files or compatibility projections from silently competing with current authority.

## Recommended header

```text
Status: CANONICAL | REFERENCE | HISTORICAL | SUPERSEDED
Authority scope: <bounded domain>
Superseded by: <path/version, when applicable>
Last reconciled: <date/commit, optional>
```

## CANONICAL

Current authority for its declared scope.

A project may have many canonical documents as long as their scopes are non-conflicting or explicitly ordered. Canonical product/specification authority still does not own mutable task state unless it is the explicitly configured canonical task source.

## REFERENCE

Useful information, examples or background. Must not override canonical material.

## HISTORICAL

Records a prior state/decision/release. Not implementation or execution authority.

Historical audits/validation logs may legitimately contain old lifecycle/version terminology; they MUST NOT be scanned as current normative guidance.

## SUPERSEDED

Explicitly replaced. Should point to the replacement.

## Special authority classes

- `TODO.md` or configured native equivalent: sole mutable executable task-state authority.
- `TODO_ARCHIVE.md`/configured archives: terminal historical task storage only; not active work authority.
- `.agents`: Agent OS routing/orchestration resources only; never mutable task state.
- native task projection: read-only derived representation of canonical native task storage.
- quality contract/report: acceptance criteria/evidence only; never task state.
- audit/finding files: findings/dispositions/evidence only; executable remediation maps to TODO.
- handoffs/walkthroughs/plans: context/reference unless another explicit authority contract says otherwise.
- generated matrices/reports: derived output, never an editable source of execution truth.

## Rules

- Do not delete valuable historical context merely to remove conflict; demote/mark it.
- Do not leave “current”, “master plan”, “final plan” or old OS/lifecycle wording active in a superseded document without a supersession banner.
- A generated report should identify itself as generated/reference output.
- Canonical task authority owns execution state regardless of statuses copied elsewhere.
- A current CANONICAL document that teaches a superseded capability/lifecycle model is an integrity defect and must be corrected or demoted.
