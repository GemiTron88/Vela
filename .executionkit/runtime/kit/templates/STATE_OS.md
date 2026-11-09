# State OS

**Document status:** PROJECT AUTHORITY for execution continuity and context recovery.  
**AI ExecutionKit version:** `[STANDARD_VERSION]`

State OS is the eighth ExecutionKit system. It is a **cross-cutting runtime integrity system**, not an eighth backlog and not a replacement for any of the seven capability authorities: Execution, Agent, Content, SEO, Audit, Test and Launch.

## Principle

> **Context is disposable. Repository state is reconstructable.**

Conversation history, model working memory, `/goal` persistence and external memory are caches/hints. A new agent with zero conversation history must be able to determine the current canonical work, repository state, evidence and next safe action from live project truth plus State OS derived artifacts.

## Authority boundary

State OS never owns task status, task order, priorities, requirements or remaining work.

- Canonical task/backlog truth: configured `TODO.md` or preserved native task authority/projection.
- Product truth: live code, schema, assets and runtime behavior.
- Search-domain truth: current SEO contract/public surfaces plus current external evidence where claimed; State may retain references only.
- Verification truth: current tests/evidence tied to the relevant candidate/environment.
- Working continuity: `.executionkit/state/latest.json` and `.executionkit/state/journal.ndjson`.
- Durable external memory: advisory only and always revalidated against live repository truth.

State snapshots may record an **observed pointer** to the current task/action. That observation is never an authority and must not be used to mutate or bypass canonical task state.

## State layers

### Canonical state

Reconstruct from the configured task authority, Git branch/HEAD/worktree, code, tests/evidence, `AGENTS.md`, execution config and Agent OS manifest.

### Working state

State OS writes compact local derived snapshots under `.executionkit/state/`. The latest snapshot and append-only journal are ignored by Git and must contain no secrets and no shadow backlog.

A checkpoint records only continuity facts such as repository fingerprint, canonical authority fingerprints, observed lifecycle pointer, routed Agent resources, working-set paths, evidence references, context-health hint and the next **safe action**.

### Durable memory

If the host exposes a Memory MCP or equivalent durable-memory service, agents may use it for stable reusable decisions/discoveries/invariants and a sanitized State OS memory envelope. External memory MUST NOT own task status or be trusted as current repository truth.

Before acting on recalled memory, revalidate it against current branch/HEAD/worktree, canonical task authority, implementation and evidence. Conflicts are resolved in favor of current repository/canonical truth.

## BOOT → REHYDRATE → VERIFY → RESUME

Use this protocol at session start, after suspected context compaction, after interruption/crash/model/tool restart, after changing machines, and at every agent/model handoff:

1. **BOOT** — inspect repository/config/task authorities; do not infer state from chat.
2. **REHYDRATE** — read State OS snapshot/journal and optional external memory as hints.
3. **VERIFY** — compare snapshot/memory with live HEAD, branch, dirty worktree, TODO/native task state, implementation, routed Agent resources and relevant evidence.
4. **RESUME** — continue only the currently canonical lifecycle action. If drift exists, inspect it and write a fresh checkpoint before mutation.

Live reality always wins. A stale checkpoint is evidence of history, not permission to continue blindly.

## Automatic checkpoint events

Agents and managed runtime MUST checkpoint on meaningful boundaries, including canonical task/lifecycle selection, substantial discovery/analysis, implementation milestones, architecture/contract decisions, before/after review/SEO/audit/expensive tests/release gates, lifecycle transitions, commits, task changes, interruption/handoff and semantic heartbeats during long tasks.

The default heartbeat interval is configured by `state.heartbeatMinutes`. A heartbeat is compact structured state, not a transcript dump.

## Context compaction rule

Never depend on conversation history for information required to resume safely. Materialize important execution knowledge into code, canonical documentation, an explicit decision record, reproducible tests/evidence, Git history, or a State OS checkpoint. External memory can accelerate recall but cannot substitute for these sources.

## Context integrity check

Before mutating after a resume, the agent must be able to answer from current evidence: current canonical task/action and dependencies; branch/HEAD/dirty worktree; existing implementation; task contract/acceptance conditions; current evidence; and the next safe action. If a critical answer is unknown, rehydrate/inspect before coding.

## Amnesia Test

```bash
node bin/state-amnesia-test.mjs .
```

The test assumes zero conversation history. It passes only when current task/action routing, Git identity, authority fingerprints, a fresh State checkpoint, safe resume guidance and non-authoritative memory policy are reconstructable. A failed Amnesia Test is a State OS gap and never changes `TODO.md` automatically.

The Amnesia Test does not prove SEO applicability/indexing, test PASS or release readiness; those remain owned by their capability authorities and current evidence.

## Integration with the other systems

- **Execution OS:** observes lifecycle selection/transition and checkpoints it; Execution OS alone decides task eligibility/state.
- **Agent OS:** State recovery behavior is loaded through registered/routable task-context/runtime skills and handoffs; receiving agents revalidate it.
- **Content OS:** stable content decisions/provenance may be remembered, while content execution state remains canonical-task-owned.
- **SEO OS:** stable search-architecture decisions/evidence references may be remembered, while applicability, contract validity, search findings and remediation remain owned by SEO/Execution/Audit/Test/Launch as applicable.
- **Audit OS:** checkpoint before/after boundaries; stale audit context cannot certify current reality.
- **Test OS:** record exact evidence references/candidate context; previous success never becomes current PASS after drift.
- **Launch OS:** rehydrate exact branch/HEAD/candidate/environment/rollback context before high-risk release operations.

## CLI

```bash
node bin/state-status.mjs .
node bin/state-checkpoint.mjs . --reason heartbeat --context-health LONG_RUNNING
node bin/state-rehydrate.mjs .
node bin/state-amnesia-test.mjs .
node bin/state-memory-envelope.mjs .
```

Optional checkpoint fields include `--next-safe-action`, repeated `--working-file` and repeated `--evidence` references.

## Memory MCP bridge

When an external Memory MCP is available: produce the sanitized State OS memory envelope; store only that envelope and genuinely durable reusable project knowledge; never store secrets, transcript dumps, private queues or mutable task-state authority; recall it as `ADVISORY_ONLY`; and rehydrate/verify live repository truth before mutation.

If no Memory MCP exists, State OS remains fully functional from repository + local derived state. `state.memory.mode=required` may be used only when a project deliberately requires external durable-memory availability; file presence alone is not runtime proof.

## Failure and recovery

On drift, interruption or stale memory: preserve the dirty worktree, inspect differences, reconcile the current canonical task and write a fresh checkpoint. Never reset/discard work merely to make the checkpoint look clean. Never claim a stale test/candidate/SEO/handoff/memory item is current evidence.
