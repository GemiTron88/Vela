# Task Decomposition and Granularity Guide

**Status:** CANONICAL reference derived from the Task Contract and `STANDARD.md`.

## 1. Goal

A canonical execution task must be small enough that an AI agent can reason about its scope, implement/correct/review it and produce evidence without ambiguity, while still being large enough to represent a meaningful outcome.

Task decomposition is not an attempt to maximize task count. It creates stable execution, review and acceptance boundaries.

## 2. Outcome over activity

Prefer an observable outcome:

```text
EX-0421 — Enforce idempotent order submission
```

over a vague activity:

```text
EX-0421 — Work on orders
```

and over mechanical microsteps:

```text
Create service file
Add method
Add route
Write test
```

Files and methods are implementation details unless their creation is itself the contractual outcome.

## 3. One task, one coherent acceptance contract

A good task has a single answer to:

> What observable condition proves this unit of work can be independently accepted?

If parts of a proposed task need materially independent acceptance gates, split them.

## 4. Strong split signals

Split a task when two parts have independent:

- hard dependencies;
- product decisions;
- security/risk boundaries;
- schema/migration impact;
- external integration contracts;
- rollback behavior;
- test environments;
- deployment/release behavior;
- blockers;
- ownership/workstreams;
- evidence requirements;
- reviewer/acceptance conditions;
- opportunity to be cancelled/deferred separately.

Example:

```text
Bad single task:
Build payments including provider integration, refunds, reconciliation and admin reporting.

Better:
EX-0301 Establish payment intent and transaction invariants
EX-0302 Integrate provider authorization/capture
EX-0303 Process signed provider callbacks idempotently
EX-0304 Implement refund workflow
EX-0305 Implement reconciliation controls
EX-0306 Expose admin payment operations and audit trail
```

## 5. Strong merge signals

Merge proposed tasks when:

- neither produces useful value independently;
- they always touch the same contract and tests;
- splitting would require artificial intermediate states;
- each "task" is merely one code-edit step;
- verification only makes sense after all pieces exist;
- reviewer/rollback behavior is identical;
- dependency edges would be trivial one-to-one chains that add no planning value.

Example:

Instead of:

```text
Create Address model
Create Address migration
Create Address repository
Create Address form
Create Address tests
```

use a coherent outcome such as:

```text
Implement customer address management with ownership validation and accepted CRUD flows.
```

Split only if, for example, geocoding or delivery-zone calculation has an independent contract/risk boundary.

## 6. Vertical slices vs horizontal infrastructure

Prefer vertical slices when they can deliver/verify a complete behavior without destabilizing architecture.

Use horizontal/foundation tasks when multiple later tasks genuinely depend on one invariant/platform capability, for example:

- tenant identity contract;
- authorization policy foundation;
- event/outbox infrastructure;
- offline mutation journal;
- design-token foundation;
- shared API schema;
- CI/test harness.

Do not create generic abstractions before there is a real dependency/requirement for them.

## 7. Dependency grammar

A hard dependency means:

> This task cannot safely satisfy its Definition of Ready/acceptance until the referenced task reaches a configured dependency-satisfied semantic state (normally `ACCEPTED`/`RELEASED`).

Do not use hard dependencies merely to express preferred chronological order.

Soft sequencing can be documented separately when useful.

Excessive hard dependencies create a false serial pipeline; missing hard dependencies create invalid READY tasks. Legacy `VERIFIED` may satisfy dependencies only through explicit project aliasing to `ACCEPTED`.

## 8. Task size heuristics

There is no universal line-count or duration limit because AI capability, repository complexity and risk vary.

A task is probably too large when:

- its title contains several unrelated "and" clauses;
- its contract spans unrelated domains;
- it needs multiple different release strategies;
- several parts could fail/block independently;
- the context envelope must include most of the repository;
- evidence would be a long list of unrelated suites;
- the agent cannot summarize its non-goals concisely;
- rollback would need partial task states;
- different parts require different independent reviewers/environments.

A task is probably too small when:

- it is defined by a single trivial edit with no independent acceptance value;
- its only dependency and successor always move together;
- verification is identical to another adjacent task;
- completing it leaves the product intentionally broken until the next microtask;
- the task exists only to make progress counts larger.

## 9. High-risk work should often be smaller

Security, finance, migrations, data loss, offline sync and external side effects benefit from narrower contracts because evidence and rollback matter more.

For example, do not combine:

- destructive schema migration;
- data backfill;
- application cutover;
- production cleanup;

into one opaque task if each has a distinct safety/rollback gate.

## 10. UI task decomposition

A UI task should usually be organized around a user outcome/surface contract rather than individual components.

Good:

```text
Implement checkout address selection including loading, empty, validation and error states.
```

Potential split:

```text
EX-0501 Implement address selection interaction/state
EX-0502 Add map/location picker
EX-0503 Verify checkout accessibility/responsive states
```

Split when the map/location integration or accessibility remediation is independently risky/blocked.

Avoid one task per button/card unless those are reusable design-system primitives with their own contract.

For premium products, surface tasks should reference the product's approved visual direction/tokens and cover applicable loading, empty, error, disabled, permission, offline, RTL/LTR, responsive and accessibility states. A generic component count is not an acceptance criterion.

## 11. Backend/API task decomposition

Group behavior that shares one transaction/invariant.

Example:

```text
Implement atomic order creation with validated tenant ownership, line items and deterministic totals.
```

Separate tasks may then cover:

- idempotency;
- payment initiation;
- external fulfillment;
- cancellation state machine;
- reporting projections.

Those have different dependencies/failure modes.

## 12. Database task decomposition

Separate schema foundation from risky data movement when appropriate.

A safe additive schema change and its application behavior may share one task if deployment is straightforward.

Split when:

- backfill is large;
- locks/downtime are material;
- old/new application versions must coexist;
- cleanup/drop is delayed;
- rollback differs by step.

Typical expand/contract sequence can become several tasks/gates:

```text
add compatible structure
backfill/verify
switch application behavior
observe
remove obsolete structure
```

## 13. Offline/synchronization task decomposition

Offline systems often need distinct contracts for:

- durable local storage;
- operation identity/outbox;
- transport/sync scheduling;
- retry/idempotency;
- conflict detection;
- conflict resolution;
- tombstones/deletion;
- attachment sync;
- authentication expiry/recovery;
- schema migration;
- full replay/reordering verification.

Do not hide all of this inside `Make app offline-first`.

## 14. Integration task decomposition

For external providers, useful boundaries include:

- canonical adapter/contract;
- auth/configuration;
- outbound operation;
- inbound webhook/callback validation;
- retry/idempotency;
- reconciliation;
- degraded/outage mode;
- production launch enablement.

Provider production enablement should normally remain a Launch/authorized environment action even when implementation is `ACCEPTED`.

## 15. Content task decomposition

For content-heavy products, do not make one TODO task per content row unless row-level execution genuinely requires independent ownership/evidence.

Prefer batches with explicit coverage rules, e.g.:

```text
Validate and import car make/model taxonomy v1 with provenance and duplicate controls.
```

Split by:

- source/provenance;
- content type;
- taxonomy boundary;
- localization batch;
- risk/quality gate;
- independently releasable inventory.

Use Content OS inventories for coverage; use TODO only for executable work.

## 16. Test tasks

Testing should normally be part of the implementation task's acceptance path.

Create an independent test task when:

- a cross-cutting regression suite spans several implemented tasks;
- legacy behavior needs characterization before implementation;
- a dedicated performance/security/compatibility campaign is an independent gate;
- a discovered coverage gap is independent of the current task;
- specialized environment/setup is required.

Do not create `write tests` as a routine successor to every implementation task; that encourages `IMPLEMENTED` without acceptance.

## 17. Audit/review tasks

Audit itself may be a phase/workstream gate. Remediation findings become separate TODO tasks only when they represent independent executable work.

A finding that can be fixed within the still-open current task and its acceptance contract need not inflate the backlog with a new ID.

A finding that changes scope/risk or requires independent work should receive/match a task ID. The final accepting review may be a lifecycle action on the same task rather than a new backlog item.

## 18. Launch tasks

Launch checklists are gates, not automatically tasks.

Create TODO tasks for launch-related implementation such as:

- add missing production health endpoint;
- build backup restore verification tooling;
- make migration backward compatible;
- configure required observability as code;
- implement rollback-safe feature flag.

Keep purely operational gate evidence in Launch OS/runbooks.

## 19. Documentation tasks

Do not create tasks for every documentation edit caused by implementation; reconciliation is usually part of acceptance.

Create an independent documentation task when the document itself is a deliverable or substantial independent work, for example:

- public API documentation;
- operator runbook;
- migration guide;
- legal/help content;
- architecture decision requiring independent review.

## 20. Refactoring tasks

Refactoring is valid when it has a concrete purpose such as:

- remove a blocker for upcoming required work;
- fix measured maintainability/testability debt;
- eliminate duplicated security/business invariants;
- enable a required migration;
- resolve a proven performance issue.

Avoid speculative abstractions justified only by possible future use.

A refactor task should state preserved behavior and regression verification.

## 21. Bug tasks

A bug task should include/refer to:

- reproduction/failing assertion;
- expected behavior authority;
- scope of affected paths;
- regression test/check;
- evidence of fix;
- independent acceptance when required by risk/policy.

If the bug reveals a broader invariant failure, split the invariant remediation from unrelated symptoms when appropriate.

## 22. Discovered work while executing

Classify before creating a new task:

### Current-contract defect

If fixing it is necessary to satisfy the current task's acceptance criteria and remains within scope, fix it under the current ID.

### Direct prerequisite

Create/match a prerequisite task and make the dependency explicit if the prerequisite has independent scope/evidence.

### Independent required work

Create/match a TODO task and return to current scope unless priority/dependency rules require switching.

### Duplicate

Link to the existing task/finding.

### Optional improvement

Record only if project policy keeps optional work; do not implement opportunistically.

Do not create a private Agent OS queue for discovered work.

## 23. Titles

Good titles start with a behavior/outcome verb:

- Enforce...
- Implement...
- Verify...
- Migrate...
- Reconcile...
- Establish...
- Prevent...
- Expose...
- Integrate...
- Harden...

Avoid titles such as:

- Misc fixes
- Work on auth
- Improvements
- Backend
- TODO later
- Polish stuff

## 24. Non-goals (`Must not`)

AI execution benefits strongly from explicit negative scope when temptation to overbuild is high.

Example:

```text
Must not:
- add social login;
- redesign the account settings screen;
- change global session duration;
- introduce a new auth framework.
```

A concise non-goal list often prevents more drift than several paragraphs of rationale.

## 25. Context envelope sizing

A task should ideally be executable after reading:

- repository instructions;
- TODO card;
- one phase/workstream contract section;
- applicable Agent OS role/skills/rules/workflow/contracts resolved deterministically;
- a small set of requirement/architecture references;
- relevant code/tests/history.

If every task requires loading every plan and every OS document, decomposition or authority boundaries are probably wrong.

## 26. Acceptance criteria quality

Acceptance criteria should be observable.

Weak:

```text
Make login secure and good.
```

Better:

```text
- privileged login from an unverified device requires the approved challenge;
- verified devices follow the documented bypass window;
- challenge cannot be skipped by direct API call;
- failure/rate-limit paths are covered by named tests.
```

Do not prescribe unnecessary implementation details when behavior is the contract.

## 27. Verification alignment

Every task should have a verification/acceptance strategy proportional to its risk.

If a proposed task needs unrelated test suites A, B, C and D, ask whether it is actually several tasks.

If it has no meaningful verification beyond "look at code", improve the contract or classify why automated/reproducible evidence is not applicable.

Where quality/runtime evidence is time-sensitive, declare the relevant candidate/environment/freshness requirement instead of treating old file hashes as permanent proof.

## 28. Release relevance

A task may be fully `ACCEPTED` before production. Only tasks whose semantics require production presence need `RELEASED` tracking.

Do not make every internal task wait for production to be technically accepted. Conversely, do not treat `ACCEPTED` local implementation evidence as proof of production launch behavior when the contract requires a release/operational gate.

## 29. Decomposition review questions

Before accepting a task set, ask:

1. Does every task describe an outcome?
2. Can each task be accepted independently enough to justify its boundary?
3. Are hard dependencies real and based on configured accepted/released states?
4. Are any tasks hiding several independent risks?
5. Are any tasks merely mechanical microsteps?
6. Are cross-cutting foundations justified by downstream dependencies?
7. Is routine testing inside the task acceptance path?
8. Are audit/content/test/launch findings mapped without creating parallel queues?
9. Can Agent OS resolve a bounded context envelope for each lifecycle action?
10. Would cancellation/blocking of one part require splitting?
11. Does candidate/reviewer/freshness behavior stay coherent if work is interrupted and resumed?

## 30. Final rule

The best task size is the smallest coherent unit that can move from `READY` through implementation and independent review to `ACCEPTED` under one stable contract without inventing hidden intermediate scope.

Optimize for correctness, resumption, reviewability and evidence—not for the number of checkboxes.
## 31. Journey-first integration rule

Task decomposition must preserve whole-product behavior. For every release-critical user/business/operational journey, identify the task members and the seams they provide/consume, then converge them through one canonical phase/release audit gate. Use `Depends` only for true execution prerequisites; use the integration/journey contract for cross-component relationships that must work together even when they could be implemented independently.

Example journey:

```text
Browser → Auth → Admin → DB → Policy → Gateway → Worker → Response → Metrics/Audit → Restart → persisted state
```

Each member can have targeted tests, but the journey is not accepted until the actual provider/consumer path is exercised from outside the isolated components, including material failure and persistence/restart behavior where applicable.

## 32. Change-impact revalidation rule

Task acceptance is historical; release proof is candidate-specific. After later work changes a task contract, shared seam, control input or runtime surface, use `node bin/analyze-revalidation.mjs .` to identify accepted contracts and critical journeys whose previous proof is at risk. Do not mechanically reset unrelated accepted implementation. Instead route focused reviewer/journey revalidation and recollect trusted evidence for the current candidate. Unmapped product changes fail closed across release-critical journeys until current black-box/runtime evidence exists.
