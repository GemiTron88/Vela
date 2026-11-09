# Agent Handoff

- Task observed from canonical authority: `<TASK_ID>`
- Action: `<ACTION>`
- Route: `<ROUTE_ID>`
- From role: `<ROLE_ID>`
- To role: `<ROLE_ID>`
- Repository/branch/HEAD: `<LIVE_STATE>`
- Dirty worktree / interrupted work: `<NONE_OR_PATHS>`
- State OS checkpoint: `<TIMESTAMP_OR_REFERENCE>`
- Context health: `<FRESH|LONG_RUNNING|COMPACTED|UNKNOWN>`
- Working set: `<PATHS_OR_AREAS>`
- Inspected: `<PATHS_OR_AREAS>`
- Changes/findings: `<SUMMARY>`
- Verification executed: `<COMMANDS_AND_RESULTS>`
- Evidence: `<PATHS_OR_REFERENCES>`
- Remaining risks/blockers: `<NONE_OR_EXACT_DETAILS>`
- Next safe action: `<ACTION_AFTER_LIVE_REHYDRATION>`

This handoff is contextual evidence only. Do not record or mutate canonical task status here. The receiving agent MUST rehydrate State OS, compare it with live repository/TODO/native authority and continue only after any drift is understood. State OS records remain advisory.
