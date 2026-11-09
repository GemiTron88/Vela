# State OS — Architecture

**Status:** CANONICAL architecture for ExecutionKit execution continuity.

State OS is one of ExecutionKit's ten executable systems and a cross-cutting continuity authority. The other nine systems are Execution, Agent, Content, SEO, Docs, Audit, Test, Launch and Visual; State OS spans them because long-running autonomous work must survive context loss, context drift, process restarts, model changes, interruptions and machine/agent handoffs without inventing another task authority.

## Invariants

1. `TODO.md` or the configured preserved native task authority remains the sole mutable task/backlog authority.
2. `.executionkit/state/*` is derived, local and non-authoritative.
3. A State snapshot is a fingerprinted observation, never permission to skip canonical lifecycle/dependency/review/SEO/audit/test/launch gates.
4. Conversation context is disposable and cannot be required for safe resume.
5. External State OS memory data is **`ADVISORY_ONLY`** and must be revalidated live.
6. Live repository/canonical truth wins every conflict.
7. State recovery preserves dirty/interrupted work; it does not reset it for convenience.
8. State behavior must be reached through registered/routable Agent OS resources; file presence alone is not integration.
9. State OS may preserve references to SEO contracts/evidence for resume, but it never owns SEO applicability, search findings or remediation status.

## Storage

Default local paths:

- `.executionkit/state/latest.json` — atomic latest checkpoint.
- `.executionkit/state/journal.ndjson` — append-only checkpoint history.

The existing `.executionkit/.gitignore` keeps these artifacts out of product history. They must not be scanned as a product denominator or backlog.

## State snapshot contract

A checkpoint records schema/version and its non-authoritative marker; canonical TODO/config/Agent-manifest fingerprints; Git branch/HEAD/upstream observation and dirty-worktree fingerprint/path set; currently observed lifecycle task/action and routed resource IDs; bounded working-set paths; evidence references rather than copied evidence bodies; context-health hint; next safe action; and memory envelope policy.

It deliberately does not record a queue, task list, new requirements, task priority or authoritative completion state.

## Drift detection

Rehydration compares the latest checkpoint with live state. Drift includes material change in standard/config/TODO/Agent manifest, branch/HEAD, worktree fingerprint, current canonical task/action, or an excessively stale heartbeat. Drift requires inspection before mutation. Legitimate interrupted work can produce drift, but it must be understood and checkpointed before autonomous continuation.

A changed SEO contract that is candidate-bound is also material release evidence drift even when State OS itself does not own that contract. Candidate/Test/SEO/Launch authorities decide the consequence; State OS merely helps reconstruct the changed context.

## Runtime integration

Managed runtime checkpoints and State OS checkpoints are related but distinct. Runtime coordination tracks the currently claimed canonical action or dependency-safe batch plus host/delegate status; State OS tracks reconstructable cross-session/context state around that work. Neither is task authority.

Runtime transition boundaries write State checkpoints when configured. Long-running host agents also write semantic heartbeats/milestone checkpoints because the coordinator cannot infer internal model-context compaction while a delegated action is still running.

## Agent integration

State recovery is embedded in registered/routable task-context/runtime behavior. The managed `skill.state-rehydration` is a dependency of `skill.task-context`, so normal lifecycle routes receive State OS behavior through deterministic skill dependency expansion without adding an independent agent or queue. Reviewer separation remains unchanged.

A State resource that is merely registered but unreachable is not integrated. The same registered-and-routable rule applies independently to conditional SEO specialists when SEO is applicable.

## External memory integration

ExecutionKit exposes a sanitized `executionkit-memory-envelope/v1` through CLI (`executionkit state memory .`). A host may store/retrieve that object using any available persistence mechanism. ExecutionKit itself does not assume or fabricate a vendor-specific memory API.

Durable memory is appropriate for stable decisions, discovered invariants and re-entry hints. It is inappropriate for authoritative current task status, mutable queues, secrets or evidence claims. Every recalled value remains `ADVISORY_ONLY` and is revalidated against live repository/canonical truth before mutation.

## Amnesia Test

The mechanical Amnesia Test asks whether an agent with zero conversation history can reconstruct canonical task authority, current Git identity/worktree, current lifecycle action and Agent route, fresh continuity checkpoint, next safe action and safe external-memory policy. Failure means long-running autonomous continuity is not currently proven.

The Amnesia Test does not certify SEO applicability, external indexing, test success or release readiness. Those remain owned by the applicable capability authorities and current evidence.

## Installed runtime isolation

The unified installer may track `.executionkit/runtime/kit/` and `.executionkit/installation.json` using the exact managed-source ignore exceptions. These are immutable distribution inputs, not State storage. `resolveDerivedPath` rejects writes into them, while journals/checkpoints/tooling remain excluded. An installation lock blocks task loading until the transaction finishes or is explicitly recovered. See [installer](../adoption/installer.md).
