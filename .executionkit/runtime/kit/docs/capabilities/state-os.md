# State OS Capability — v4

**Status:** CANONICAL capability guidance.
**Mandatory:** Yes (Core)
**Purpose:** Make execution position reconstructable across interruptions, context compactions, and model/agent handoffs. Govern state rehydration, drift detection, and lifecycle checkpoints.

## Continuity and reconstruction

State OS is the cross-cutting continuity layer. It ensures that an agent can safely resume its work loop even after losing working memory, being terminated, or passing control to another agent. State OS captures checkpoints and handles drift recovery, enabling zero-context reconstruction of the project state.

## Key responsibilities

State OS covers:
- Capturing deterministic execution state snapshots
- Writing NDJSON journaling for incremental state transitions
- Rehydrating agent context from the latest verified state
- Detecting filesystem and project state drift between active execution loops
- Enforcing memory retention, checkpointing, and safe amnesia limits
- Providing zero-context task recovery when required

## CLI Surface

```bash
executionkit state status
executionkit state rehydrate
executionkit state checkpoint
executionkit state amnesia
```

## Trigger / cadence

- **Trigger**: always (participates in every lifecycle action)
- **Cadence**: Continuous during transitions, heartbeats, and before/after tool execution.

## What it does NOT own

- Mutable task status ledgers or lifecycle execution queues (owned by Execution OS).
- Routing of work or selecting the next task to process (owned by Execution OS).
- Domain knowledge extraction or semantic codebase summaries (owned by Docs OS).

## Evidence / contracts

- Produces: `latest.json` (checkpoint), `journal.ndjson` (event log), `StateCheckpoint`
- Reads: Workspace state, environment context, filesystem state, repository hashes
