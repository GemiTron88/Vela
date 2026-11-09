# TODO Scaling — v2.x

Large task counts are a context/physical-storage problem, not a reason to split execution authority.

## S0 — inline

Small projects keep task state + sufficient detail in `TODO.md`.

## S1 — contract split

`TODO.md` keeps immutable IDs, mutable state/order/dependencies and deterministic references. Phase/task contract files hold detailed scope, acceptance criteria and context envelopes. They never own mutable status.

## S2 — terminal archive

Terminal `ACCEPTED` / `RELEASED` / `CANCELLED` history can move to `TODO_ARCHIVE.md` or configured partition files. Legacy `VERIFIED` is archive-eligible only when the project explicitly aliases it to semantic `ACCEPTED`.

Non-terminal `PLANNED`, `READY`, `IN_PROGRESS`, `IMPLEMENTED`, `REVIEW_REQUIRED`, `CORRECTION_REQUIRED` and `BLOCKED` work cannot be archived.

Archives remain machine-visible for global ID uniqueness, dependencies and evidence. They are excluded from execution selection and MUST NOT gain new mutable work.

Use archive tooling in dry-run mode first and revalidate after applying. Generic archival must be loss-safe/rollback-safe. Native task storage requires a project-native round-trip/archive mechanism rather than blind generic rewriting.