# Dependency-safe parallel execution and `/boost` — current 3.x

AI ExecutionKit uses **dependency-safe parallel Agent OS execution with deterministic sequential fallback**. Parallelism is an optimization of wall-clock time, never a relaxation of canonical authority, dependency ordering, verification, reviewer independence, evidence freshness or release controls.

## Canonical authority

`TODO.md`, or an explicitly preserved project-native canonical authority configured by ExecutionKit, remains the sole mutable execution/backlog/status authority. Parallel workers MUST NOT create a private queue, second task ledger, competing scheduler or hidden completion state.

The orchestrator is the single canonical claim and integration owner. Every active canonical task has one unambiguous executor. Specialists may collaborate inside a task only when the orchestrator partitions disjoint scopes and retains integration ownership.

## Two levels of safe parallelism

### Intra-task specialist parallelism

This is the preferred/default acceleration path. A selected canonical task may delegate independent specialist scopes such as backend, Flutter/UI, tests, security, content, documentation or evidence in parallel when their write and semantic ownership is disjoint.

The selected task remains one lifecycle unit. Specialists do not individually accept the task, mutate canonical status or create additional backlog entries. Their results are integrated and verified as one candidate before lifecycle promotion.

### Inter-task canonical parallelism

Multiple canonical tasks may execute concurrently only when all of the following are true:

- every task is dependency-ready against current integrated canonical truth;
- each task explicitly opts into parallel execution (`Parallel Safe`, an equivalent project-native contract, or a deterministic adapter); 
- each task declares concrete write/domain ownership;
- ownership is disjoint after semantic hotspot analysis;
- no task depends directly or transitively on another active claim;
- isolation is available through separate branches/worktrees or an equivalent bounded host context;
- one orchestrator owns claim/release/integration order;
- applicable reviewers remain independent from implementers;
- affected verification and candidate-bound evidence are refreshed after integration.

If any of those facts is unknown or ambiguous, ExecutionKit MUST fall back to sequential execution rather than guess.

## Coordination hotspots

Different filenames do not prove independence. The planner treats shared or global surfaces conservatively. Typical hotspots include:

- canonical `TODO.md` and task/status metadata;
- database/schema migrations;
- API/openapi/shared contract definitions;
- generated registries and generated code;
- global configuration/bootstrap files;
- localization registries;
- design tokens/component foundations;
- authorization/policy matrices;
- shared mutable fixtures;
- dependency lockfiles;
- CI/workflow/release manifests;
- production/deployment/destructive side effects.

A project may define stricter hotspots. It MUST NOT weaken these controls merely to increase concurrency.

## Claims, isolation and stale recovery

Canonical claims are orchestrator-owned and must be atomic relative to the configured task authority. One canonical task may have only one executor claim at a time.

Parallel canonical workers use isolated branches/worktrees or equivalent host-native bounded contexts. A worker branch is not accepted project truth. Integration order is deterministic, conflicts are resolved by the orchestrator, and affected checks run again against the integrated candidate.

A stale claim is not permission to discard work. Before recovery, inspect the claimed worktree/branch/process, preserve unique or interrupted changes, reconcile State OS with live repository truth and only then release/reassign the claim. State OS snapshots remain advisory continuity inputs and cannot override canonical claim/task truth.

## Reviewer and quality boundaries

Parallelism MUST preserve all normal lifecycle gates:

- implementers cannot accept their own work;
- review/audit/acceptance closure remains serialized unless a future explicit audited contract proves a safe parallel form;
- targeted task verification still runs for each changed surface;
- full expensive CI remains wave/phase/final-candidate scoped by project policy, not task-ritual scoped;
- Audit OS, Test OS, Launch OS and Premium Experience obligations are unchanged;
- branch-local PASS does not become integrated PASS automatically;
- stale, skipped, unavailable or candidate-mismatched evidence is never PASS;
- production/external side effects remain separately authorized and are not fan-out targets merely because source changes are independent.

## Runtime policy

Current project configuration may use:

```json
{
  "runtime": {
    "mode": "DEPENDENCY_SAFE_PARALLEL",
    "oneLifecycleActionAtATime": false,
    "parallel": {
      "enabled": true,
      "maxConcurrentTasks": 3,
      "maxAgentsPerTask": 4,
      "requireExplicitParallelSafe": true,
      "requireOwnership": true,
      "isolatedWorktrees": true,
      "integrationOwner": "orchestrator",
      "sequentialFallback": true
    },
    "boost": {
      "enabled": true,
      "command": "/boost",
      "maxConcurrentTasks": 6,
      "maxAgentsPerTask": 6,
      "qualityGatesPreserved": true
    }
  }
}
```

The numeric values are ceilings, not targets. A safe plan may contain fewer workers or only one canonical task. Host/device resource pressure may reduce the effective caps at any time.

Projects may explicitly select `SEQUENTIAL` when parallel isolation cannot be guaranteed or when a sensitive integration/release operation demands it.

## `/boost`

`/boost` means use the maximum **currently safe** concurrency.

It does not mean:

- skip tests or audits;
- ignore dependencies;
- let multiple agents edit the same hotspot;
- let workers mutate TODO concurrently;
- merge without integrated verification;
- bypass reviewer separation;
- turn `/goal`, Brain/task, State OS into a scheduler;
- execute unapproved production/destructive actions.

The installed planner is exposed through `bin/boost.mjs` / `npm run runtime:boost` and through the Antigravity `boost` skill. It validates canonical execution/Agent/State integrity before returning a conservative safe batch. When it returns one canonical task, the host should prefer safe intra-task specialist fan-out rather than inventing a shadow queue.

## Antigravity behavior

Antigravity `/goal` is persistence only. `/boost` is concurrency policy only. Neither owns task truth.

The expected host flow is:

1. inspect live repository/worktree/HEAD/uncommitted/unpushed state;
2. rehydrate State OS and reconcile drift;
3. read canonical TODO/native authority and resolve current lifecycle closure;
4. resolve task context and Agent resources;
5. obtain normal or `/boost` safe concurrency plan;
6. claim canonical tasks through the orchestrator;
7. isolate workers and execute bounded scopes;
8. integrate deterministically;
9. rerun affected verification and independent review;
10. mutate canonical task state only from current evidence;
11. synchronize any supported Brain/task host checklist as a derived mirror;
12. checkpoint State OS and resolve live truth again.

## Evidence boundary

Source implementation of the parallel planner, schemas, rules, tests and Antigravity skill is not physical-host certification. A real-host acceptance claim requires an authorized workstation/runner to execute the exact candidate, verify fresh CLI hook observation, exercise both safe-parallel and forced-sequential cases, run the applicable complete validation/audit gate and record exact SHA/environment evidence.
