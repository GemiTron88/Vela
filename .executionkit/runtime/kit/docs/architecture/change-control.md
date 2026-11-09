# Change Control and Discovered Work

**Status:** CANONICAL guidance derived from `STANDARD.md`.

## Principle

AI agents discover real issues while implementing/reviewing. The system must capture those discoveries without uncontrolled scope expansion or private queues.

The rule is:

> No independent implementation work exists until it is represented by the canonical TODO/native task authority.

## Discovery classes

### Current-contract defect

The discovered issue must be fixed to satisfy the current task's existing acceptance criteria and remains within scope.

Action: keep it under the current task ID, preserve the finding/evidence, correct the implementation and return the candidate to required review. Do not create a duplicate task just to reset state.

### Direct dependency

The current task cannot be accepted correctly without an independently scoped prerequisite.

Action:

- search canonical TODO for an existing task;
- if absent, create a new immutable task ID;
- link it as a dependency/child/source-discovered-by;
- execute it first only when dependency-ready and authorized.

Examples:

- missing DB column required by the feature;
- broken shared helper that makes acceptance impossible;
- required authorization policy absent.

### Independent required work

Important, but the current task can complete without it.

Action:

- create/map canonical TODO task;
- assign priority/phase/dependencies;
- return to current task;
- do not opportunistically implement it.

### Duplicate

The issue is already represented.

Action: link the finding/evidence to the existing task/finding and do not create another ID.

### Non-actionable / `ACCEPTED_RISK`

No implementation is currently required or an unresolved risk is explicitly accepted.

Action: use the finding disposition `ACCEPTED_RISK` with decision authority, rationale, scope/duration and review/expiry when applicable. This is distinct from task state `ACCEPTED`.

### Invalid/stale finding

The repository already satisfies the finding or the finding came from stale documentation.

Action: mark the finding `INVALID`/`FIXED` as justified, attach specific evidence and reconcile/demote its source.

## Scope-creep guardrails

Without explicit authority, the agent must not:

- redesign unrelated UI;
- migrate libraries/frameworks for preference;
- refactor broad areas “while here”;
- add speculative abstractions;
- implement unapproved product features;
- turn a local fix into a platform rewrite;
- clean unrelated code unless necessary for safe current acceptance;
- create a private `.agents`/handoff/quality backlog for discovered work.

## Legitimate adjacent cleanup

Small adjacent cleanup may occur in the same task when all are true:

- necessary to implement/test/review safely or removes code made obsolete by the task;
- does not alter unrelated behavior;
- does not materially increase review surface;
- is covered by the same verification/rollback envelope.

Otherwise create a separate canonical task.

## Requirement change

When approved product intent changes during execution:

1. update/replace authoritative requirement;
2. mark superseded intent clearly;
3. reconcile affected canonical tasks;
4. cancel obsolete tasks with rationale rather than deleting/recycling IDs;
5. add/map new tasks;
6. update tests/quality/release gates;
7. rerun dependency/Agent/Execution integrity validation.

## Emergency production change

For incidents, normal order may be compressed. Minimum emergency record:

- incident/hotfix task ID;
- symptom/impact;
- change made;
- safety verification;
- exact release commit/artifact;
- post-release health check;
- follow-up tasks for deferred testing/documentation/root-cause work.

Emergency mode ends only when normal traceability and canonical task truth are restored.