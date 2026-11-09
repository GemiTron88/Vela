# Closure Contract

A required task is not closed merely because implementation exists.

## Semantic closure

- `PLANNED`, `READY`, `IN_PROGRESS`, `IMPLEMENTED`, `REVIEW_REQUIRED` and `BLOCKED` are non-terminal.
- `IMPLEMENTED` routes to independent review/revalidation.
- Review failure routes to correction; correction routes back to review.
- `ACCEPTED` is the normal terminal execution state for completed required work.
- `RELEASED` is terminal and stronger than accepted.
- `CANCELLED` is terminal only with an explicit rationale and must not silently satisfy dependencies.
- A configured legacy alias such as `VERIFIED -> ACCEPTED` is compatibility semantics, not a second mutable authority.

Project/phase closure is false while any required non-terminal task remains. A blocker may explain why closure cannot proceed; it does not disappear from closure truth.

## Upgrade invariant closure

A prior terminal state is historical truth, not immunity from newly introduced enforcement semantics. If the installed Kit reports mandatory upgrade revalidation, ordinary product closure is suspended until the registry-derived affected checks pass and any generated `Upgrade Revalidation: true` correction tasks close. Unaffected systems MUST NOT be rescanned merely because another invariant changed. A certified compact upgrade receipt restores normal closure authority.
