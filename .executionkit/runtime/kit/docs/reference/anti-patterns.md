# Anti-Patterns

**Status:** REFERENCE.

## 1. Markdown operating-system explosion

Symptom: every concern becomes a new `Something OS` with its own procedures and backlog.

Why it fails: authority fragments and agents spend context understanding process topology instead of product work.

Correction: put the concern inside one of the six existing capabilities, a contract, adapter or gate unless it genuinely has a distinct decision owner/lifecycle that cannot be represented safely there.

## 2. Giant TODO encyclopedia

Symptom: TODO repeats specs, architecture, tests, audits, links and multi-page implementation prose for every task.

Why it fails: context saturation, slow navigation and stale duplicated detail.

Correction: keep mutable task identity/state/order in canonical TODO/native authority; move detailed criteria to deterministic contracts/references.

## 3. Competing backlogs

Symptom: Execution, Agent, Audit, Test, Content or Launch documents keep independent mutable action queues/statuses.

Correction: all independent executable work maps to the one canonical TODO/native task authority. Other capability documents keep criteria/findings/gates/routing, not execution state. `.agents` and `TODO_ARCHIVE.md` are never active backlogs.

## 4. Checkbox implementation equals completion

Symptom: `[x]`, `IMPLEMENTED` or “code exists” is treated as final acceptance.

Correction: implementation becomes a candidate; required work reaches evidence-backed independent `ACCEPTED` (or stronger `RELEASED`) under current contract. `VERIFIED` is only a configured legacy compatibility alias.

## 5. Manual progress theater

Symptom: “82.7% complete” edited by hand.

Correction: generate counts/closure from canonical semantic task state.

## 6. Agent reads everything

Symptom: every run loads all plans/OS files/resources.

Correction: deterministic minimum Agent OS context envelope, expanding only applicable skills/rules/workflows/contracts.

## 7. Agent layer becomes a shadow PM system

Symptom: `.agents` contains task checkboxes, private queues, progress ledgers or state that can disagree with TODO.

Correction: Agent OS owns routing/orchestration only. Task state remains in canonical Execution authority.

## 8. Plan beats code

Symptom: agent reimplements completed/partial behavior because TODO prose looks untouched.

Correction: inspect live repository/history/evidence and reconcile stale task metadata before mutation.

## 9. Code beats requirement automatically

Symptom: existing behavior is assumed correct because it exists.

Correction: distinguish implementation reality from approved intent and acceptance evidence.

## 10. READY-only execution

Symptom: scheduler always selects new READY/unchecked work while implemented candidates, review failures or interrupted work remain open.

Correction: closure scheduling prioritizes review/revalidation, correction and resume before new implementation; AI-actionable blockers are inspected without starving unrelated READY work.

## 11. Blocker starvation loop

Symptom: an external approval/outage/secret blocker is repeatedly selected ahead of independent READY work.

Correction: automatic blocker inspection requires an explicit bounded AI-actionable unblock action. External/non-actionable blockers remain visible but do not preempt unrelated work.

## 12. Opportunistic refactor

Symptom: a bounded task produces unrelated architecture cleanup.

Correction: independent required work maps to canonical TODO; current task remains bounded unless the new work is a direct necessary prerequisite/current-contract defect.

## 13. Rerun-until-green testing

Symptom: flaky/failing test is repeatedly run until luck produces green.

Correction: diagnose or map the failure; never use a lucky rerun as acceptance evidence.

## 14. Stale “final” documents

Symptom: `FINAL_PLAN_v7.md` or an old capability guide still teaches authority/lifecycle semantics after the standard changed.

Correction: update/demote/mark CANONICAL, REFERENCE, HISTORICAL or SUPERSEDED explicitly; distribution validation should mechanically reject known stale semantics in active canonical surfaces.

## 15. One file per tiny task

Symptom: thousands of task files create navigation overhead.

Correction: group detail by phase/domain/workstream while preserving task IDs/state in canonical authority.

## 16. One giant task per phase

Symptom: task cannot be accepted atomically and agents drift across independent risks.

Correction: split by coherent outcome/dependency/verification/rollback boundary.

## 17. Validator becomes product manager

Symptom: machine checks infer product correctness/premium quality from metadata structure alone.

Correction: validators check control-plane/evidence integrity; real product correctness still needs actual tests/runtime/review and an honest coverage denominator.

## 18. Evidence JSON becomes a green button

Symptom: agents hand-edit PASS reports, use stale artifacts or treat `exitCode: 0` as proof of every quality claim.

Correction: retain raw outputs, candidate/source/artifact identity, required freshness and independent review. Use trusted/native evidence adapters where available.

## 19. Migration for aesthetics

Symptom: healthy active project is rewritten merely to look like the newest template.

Correction: use the least destructive adoption mode; preserve stronger native task/agent/test/quality controls and migrate only to solve material execution problems.

## 20. Parallelism by declaration only

Symptom: a manifest says `maxConcurrentAgents: 4`, so the operator assumes four isolated safe workers exist.

Correction: declared concurrency is policy, not runtime proof. Actual parallel execution needs supported delegation, explicit ownership, isolated write surfaces/worktrees, integration ownership, resource limits and recoverable handoffs.