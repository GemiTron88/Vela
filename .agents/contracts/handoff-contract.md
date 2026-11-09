# Handoff Contract

Every agent/model handoff must be reconstructable from live repository truth with zero dependency on the sender's conversation history.

A handoff records execution context only, never a second task status:

- observed canonical task ID,
- resolved action and route,
- repository/branch/HEAD and dirty-worktree observation,
- latest State OS checkpoint timestamp/fingerprint when available,
- context-health hint and relevant working-set paths,
- inspected files/areas,
- changes made or findings,
- commands/tests executed and results,
- evidence locations/references,
- unresolved risks/blockers,
- concrete recommended **next safe action**.

Before handoff, write a State OS checkpoint when execution state materially changed. The receiving agent runs `state-rehydrate` (or equivalent CLI command), re-reads canonical task state and live repository state, verifies any drift, and then continues only the currently canonical lifecycle action.

If the receiver has no useful conversation context, the State OS Amnesia Test defines the expected recovery quality. A stale handoff, State snapshot or State OS record cannot override `TODO.md`/native task authority, source code, tests, current candidate/environment evidence or live Git state.

Handoffs, State snapshots and memory envelopes MUST NOT contain a task queue, copied backlog or independently mutable completion state.
