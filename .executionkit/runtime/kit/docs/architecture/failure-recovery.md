# Failure Recovery

**Status:** CANONICAL guidance derived from `STANDARD.md`.

## Principle

Autonomous execution must fail diagnostically, not chaotically. A failure is useful when the repository still contains enough truthful state for the next session/agent to understand what happened and resume safely.

Agent OS coordinates recovery context; Execution OS and the canonical TODO/native task authority own lifecycle state.

## Failure classes

### Implementation defect before review

Code does not satisfy the current task contract or targeted verification.

Response: remain `IN_PROGRESS` when active work is continuing, or move to `CORRECTION_REQUIRED` when an explicit review/verification result has identified focused corrections. Diagnose, fix and re-run relevant checks. Do not promote to `ACCEPTED`.

### Review/acceptance failure

An `IMPLEMENTED` / `REVIEW_REQUIRED` candidate fails independent acceptance.

Response: preserve exact findings/evidence, move to `CORRECTION_REQUIRED`, route the focused correction to the implementer, then return the corrected candidate to independent review. Do not discard valid implementation or open a duplicate task merely to reset the workflow.

### Invalid task assumption

The task contract assumed repository/product state that is false.

Response: reconcile task/spec/code. Block when product intent is ambiguous; do not let implementation choose authority by convenience.

### Missing dependency

Required task/infrastructure/access is absent.

Response: map the dependency, mark `BLOCKED` when appropriate, or execute the dependency only when it is canonical, dependency-ready and authorized.

### Environment failure

Tool/service/environment prevents meaningful verification.

Response: capture the exact error and environment. Use a safe equivalent only when the contract allows it; otherwise remain non-terminal/`BLOCKED`. Never convert unavailable verification into a PASS.

### Flaky/non-deterministic test

Response: reproduce, classify and fix flakiness when within scope or map a dedicated canonical task. Re-running until green without diagnosis is not acceptance evidence.

### External service unavailable

Use approved mocks/sandboxes only for the layer they legitimately prove. Keep production/integration gates open where real behavior remains unverified.

### Agent/context interruption

Recovery state must be reconstructable from repository truth:

- canonical task state and dependencies;
- current branch/worktree and relevant uncommitted changes;
- last commit/upstream relationship when available;
- task contract and routed Agent OS resources;
- verification/evidence/failure note;
- exact blocker/unblock metadata where blocked.

Conversation history must not be required.

## Blocker actionability

`BLOCKED` is always non-terminal. Automatic blocker inspection is eligible only when the canonical task declares a bounded AI-actionable unblock action. External approvals, unavailable secrets, third-party outages and other non-actionable blockers remain visible to closure but MUST NOT repeatedly preempt unrelated dependency-ready `READY` work.

## Stop conditions

Stop/mark blocked rather than guess when:

- product intent is contradictory or missing;
- destructive/irreversible action lacks explicit authorization or a safety precondition;
- secret/access is required and unavailable;
- required external approval is pending;
- migration/data operation cannot be safely reproduced or rolled back;
- required verification cannot run and no approved substitute exists;
- independent review cannot be performed where required.

## Retry discipline

Before retrying a failed command repeatedly:

1. inspect the error;
2. classify the cause;
3. change a hypothesis/condition;
4. retry only to test that hypothesis;
5. preserve the failure when it remains unresolved.

Blind repeated retries are noise, not recovery.

## Partial work

Do not discard valid partial/interrupted work because a task becomes blocked or review fails. Preserve the implementation and evidence, but distinguish `IN_PROGRESS`/`IMPLEMENTED`/`CORRECTION_REQUIRED` reality from `ACCEPTED` closure.

## Rollback

For production failures, follow Launch OS rollback criteria. A rollback needs evidence and may create/map follow-up canonical tasks for forward fixes, data repair or root-cause prevention. Rollback completion does not automatically accept the original failed implementation.

## Runtime cancellation and lock recovery

`runtime-cancel.mjs` persists cancellation without changing TODO. New runtime steps stay CANCELLED, and a cancellation observed while a delegate runs is retained after it returns. The coordinator does not promise to kill shell descendants or terminate an external IDE action; inspect/stop the host process through its native controls if necessary.

After the active step has stopped, `node bin/runtime-recover.mjs . --resume-cancelled` explicitly clears the pause into a newly resolved WAITING_FOR_HOST checkpoint after authority validation. Recovery without that flag remains read-only and stays cancelled.

A step holds `.executionkit/runtime/step.lock` with PID, host, token and start time. It releases its own lock on normal/error completion; another invocation returns RUNTIME_BUSY. After a crash, inspect the recorded host/PID and confirm no delegate remains active before removing only that stale lock, then run runtime-recover and inspect canonical TODO/checkpoint. Never remove a live lock to start a second action.
