# Task Lifecycle — v2.x

## Canonical semantic states

Fresh v2 projects use:

- `PLANNED` — known work that is not yet Definition-of-Ready eligible; never auto-implemented;
- `READY` — eligible for implementation when hard dependencies are satisfied;
- `IN_PROGRESS` — actively owned implementation/resume work;
- `IMPLEMENTED` — implementation evidence exists; independent acceptance remains;
- `REVIEW_REQUIRED` — explicit independent review/revalidation lane;
- `CORRECTION_REQUIRED` — reviewer found concrete corrections;
- `BLOCKED` — exact unresolved blocker exists and remains non-terminal;
- `ACCEPTED` — independent contract/evidence acceptance; normal terminal execution state;
- `RELEASED` — terminal state tied to a release/deployment outcome;
- `CANCELLED` — terminal with rationale;
- `VERIFIED` — legacy compatibility state normally aliased to `ACCEPTED`.

## Closure scheduler

Default closure mode prioritizes:

1. `IMPLEMENTED` / `REVIEW_REQUIRED` -> `review`/`revalidate`;
2. `CORRECTION_REQUIRED` -> `correct`;
3. `IN_PROGRESS` -> `resume`;
4. `BLOCKED` -> `inspect_blocker` only when `Blocker Actionable: YES` (or equivalent projected metadata) declares a bounded AI-actionable unblock action;
5. dependency-ready `READY` -> `implement`.

`PLANNED` does not enter the implementation lane until the project promotes it to `READY` under its Definition of Ready.

External/non-actionable blockers remain visible in closure and blocker reports but do not preempt independent `READY` work. This prevents both candidate-review starvation and endless blocker loops.

## Transition integrity

A state transition MUST be justified by live implementation/evidence, not merely an agent assertion. Review failure preserves exact findings and normally routes `CORRECTION_REQUIRED`. Blocked state requires a concrete blocker and observable unblock condition. `Blocker Actionable: YES` is routing metadata only; it does not expand the agent's production/destructive authority. Cancellation requires rationale.

When reviewer separation is configured, the implementer cannot be the independent accepting reviewer.

## Dependencies

Only configured semantic accepted/released states satisfy hard dependencies. Fresh v2 SHOULD use `ACCEPTED`; legacy `VERIFIED` is valid only through explicit aliasing. `CANCELLED` does not satisfy by default. Archives remain dependency-resolvable.

## Native status markers

Projects may preserve native symbols such as `[ ]`, `[~]`, `[R]`, `[!]`, `[x]` if an adapter maps them deterministically to semantic states/actions. Native projections should carry blocker actionability when native blocked states distinguish agent-resolvable from external blockers. Storage syntax is not global authority; semantic closure is.

## Closure truth

Phase/project closure is false while any required non-terminal canonical work remains, including candidate/review, correction and blocked states. An empty READY lane is not closure.

Evidence/candidate freshness remains a separate acceptance concern: a terminal-looking task whose required evidence is stale/invalid must be reconciled rather than treated as permanently closed.