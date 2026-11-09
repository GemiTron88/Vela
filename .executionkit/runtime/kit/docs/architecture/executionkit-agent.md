# ExecutionKit Agent — Architecture

**Status:** LEGACY v3 COMPATIBILITY ONLY. ExecutionKit v4 does not use this daemon as a control-plane dependency.

> v4 replacement: `executionkit control-plane status .` and the GitHub-native control-plane contract. Elmasna3 reads repository/branch/HEAD, canonical TODO shard manifest + tracked shards, commits/checks/manual workflows and GitHub self-hosted runner state directly. If a factory-triggered machine operation is needed, it may use only a repository-defined, allowlisted manual `workflow_dispatch`; generic remote shell execution remains forbidden. The v4 local execution path remains independent of Elmasna3 availability. The legacy Agent may remain for v3 installations during migration, but v4 installers remove its configuration coupling and must not require, install, register or start it.

The ExecutionKit Agent is deterministic infrastructure, not an LLM and not another Agent OS specialist. One lightweight background process runs per Windows or macOS device and supervises multiple registered worktrees.

## Authority boundaries

1. `TODO.md` / preserved native task authority remains the sole mutable backlog authority.
2. State OS owns continuity, fingerprints, checkpoints and rehydration semantics.
3. Execution OS owns canonical lifecycle selection and closure semantics.
4. Agent OS owns resource routing.
5. The ExecutionKit Agent only observes, transports and exposes presence in protocol v1.
6. Elmasna3 stores observations/projections, never authoritative task state.
7. Host activity is evidence of activity, not proof of task completion or permission to execute unrelated work.
8. Remote control remains disabled in protocol v1; any future command plane requires a separately versioned typed contract.

## One daemon per device

Do not launch one watcher per repository. The daemon maintains a registry of worktrees and uses adaptive polling plus host pulses.

Primary targets:
- Windows 10/11 on Node.js >= 20;
- macOS on Node.js >= 20.

Linux may remain technically compatible where practical, but it is not a required v1 service-install target.

The single-instance lease is owned by both the operating-system PID and the Agent `sessionId`. A second runtime object in the same process is therefore not allowed to steal or release the active daemon's lease. Startup failures clean up the lease and PID file owned by that runtime.

## Active project detection

The primary proof for an active Antigravity workspace is the existing ExecutionKit Antigravity hook.

The hook emits a tiny localhost-only UDP pulse containing the resolved workspace root whenever Antigravity invokes the hook for one unambiguous ExecutionKit workspace. The daemon maps that local root to its worktree registry and marks it `HOST_ACTIVE` for a short TTL.

Properties:
- no Internet traffic for the pulse;
- no inbound LAN/WAN port;
- UDP listener binds only `127.0.0.1`;
- missing daemon never blocks Antigravity;
- pulse is observational only and grants no command authority;
- ambiguous/multiple workspaces produce no active-project claim;
- inactivity after TTL becomes `RECENT`/`UNKNOWN`, never fabricated `FAILED`.

The daemon may auto-discover a valid ExecutionKit worktree encountered by the hook when configured, but remote control stays disabled.

## State OS integration

High-frequency heartbeats MUST NOT call full `inspectLiveState()` repeatedly.

State OS computes a working-tree fingerprint that can read changed file contents. That work is appropriate at semantic checkpoints/recovery boundaries, not every presence pulse.

The daemon instead watches cheap sentinels:
- `.executionkit/state/latest.json` metadata/content only when changed;
- `TODO.md` size/mtime only;
- Git HEAD/ref/index metadata at adaptive intervals;
- configured execution/runtime evidence metadata where available.

When the State OS snapshot changes, the daemon reads the small JSON snapshot and emits a sanitized `state.checkpoint_observed` event. It does not regenerate the checkpoint.

A State snapshot whose runtime status is `RUNNING` may contribute to `EXECUTION_ACTIVE` only while `capturedAt` is fresh within the execution-activity TTL and is not implausibly in the future. A stale RUNNING snapshot must never resurrect a project as actively executing.

Observation failure for one registered worktree is isolated to that worktree and emitted as diagnostic telemetry; it must not abort the device-wide cycle or prevent other registered projects from being observed.

## Huge TODO policy

Large TODO files are never uploaded or reparsed on every heartbeat.

Rules:
- `stat()` size/mtime is the default sentinel;
- no TODO content is sent in routine telemetry;
- a local `project.todo_changed_local` event contains metadata only;
- full canonical parsing remains inside ExecutionKit lifecycle operations or server-side GitHub reconciliation after commit/push;
- hashes are cached and only recomputed when a semantic consumer explicitly needs them;
- task identity for live presence comes from State OS/runtime evidence, not from repeatedly scanning the entire TODO.

## Resource budgets

Default design targets on an idle device:
- one daemon process;
- no busy loop;
- inactive worktree scan around every 3 minutes;
- active worktree scan around every 15 seconds;
- active server heartbeat around every 90 seconds;
- idle server heartbeat around every 5 minutes;
- event coalescing before network send;
- at most one in-flight telemetry request by default;
- bounded offline spool (default 8 MiB);
- maximum protocol-v1 batch count of 100 events, with 50 as the default;
- `maxBatchBytes` bounds the complete uncompressed serialized request envelope, not only event-line bytes;
- payload gzip above a small threshold using a CPU-conscious level;
- ACK response body capped at 64 KiB;
- delta-only event transport; unchanged observations are not resent.

Exact timings are configurable and may be tuned from measured data.

## Connectivity

The daemon initiates outbound HTTPS connections to the configured control plane.

No public/inbound developer-machine port is required. Server URL and credentials live in user-local agent configuration or environment/secure-store integration and are never committed to project repositories.

MVP transport uses batched HTTPS because it has zero extra runtime dependency and behaves predictably on Windows/macOS. The configured request timeout covers the complete HTTP exchange, including reading the ACK body. Receiving response headers does not end the timeout.

## Telemetry protocol

Every envelope is versioned and idempotent.

Common fields:
- `protocolVersion`;
- `eventId`;
- `sequence`;
- `deviceId`;
- `agentVersion`;
- `occurredAt`;
- `kind`;
- optional `project` identity;
- `source`/provenance;
- bounded `payload`.

Initial kinds include:
- `agent.hello`;
- `agent.heartbeat`;
- `agent.goodbye`;
- `project.discovered`;
- `project.host_active`;
- `project.host_inactive`;
- `project.execution_active`;
- `project.execution_inactive`;
- `project.git_changed`;
- `project.todo_changed_local`;
- `state.checkpoint_observed`;
- `executionkit.semantic`;
- `agent.diagnostic`.

A successful HTTP response does not by itself acknowledge telemetry. The Agent deletes submitted events only after a structurally valid durable ACK whose `batchId` matches, whose accepted plus duplicate counts cover the submitted batch, whose advertised protocol range includes the local protocol, and whose `upgradeRequired` flag is not true. Malformed, incompatible, oversized or timed-out ACKs retain the spool for retry.

Future typed command/decision/artifact families must keep the same authority and security model.

## Privacy

By default the server receives stable opaque worktree/device identifiers and repository identity, not arbitrary source content.

Raw local paths and machine hostname are not uploaded unless their explicit privacy settings enable them. Machine-wide resource telemetry is opt-in. Source files, TODO contents, environment variables, credentials, prompts/transcripts and raw command output are never routine telemetry.

## Offline behavior

Failed events are appended to a bounded local spool with sequence/event IDs. On reconnect they are replayed oldest-first with idempotent deduplication. The spool compacts/coalesces replaceable presence observations before dropping lower-value data, and telemetry gaps are surfaced explicitly.

Network backoff is exponential with jitter and a bounded maximum. Offline status never blocks local project execution.

## Service lifecycle

CLI surface:
- `agent run` — foreground daemon;
- `agent once` — one observation/flush cycle;
- `agent status` — side-effect-free local daemon/config inspection;
- `agent register <root>` / `unregister <root>` / `list`;
- `agent config` — configure server/privacy settings and user-local credential references;
- `agent install` / `uninstall` — per-user background startup on supported OSes;
- `agent stop` — stop the current per-user daemon.

macOS uses a per-user LaunchAgent. Windows uses a per-user Task Scheduler entry. Neither requires opening inbound firewall ports.

## Command boundary

Protocol v1 is read-only telemetry. Remote command execution must be introduced separately with typed allowlisted commands, expected-state guards, TTL, idempotency, local policy revalidation and immutable result evidence.

There is no generic remote shell contract.
