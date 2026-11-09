# ExecutionKit 3.0 Bootstrap Mode

**Status:** normative 3.0 contract.

Bootstrap Mode defines how AI ExecutionKit operates when no external fleet/control-plane server is available yet. It exists to keep local execution authoritative and usable while a control plane such as Elmasna3 is absent, unfinished, unconfigured, offline, incompatible, or temporarily unhealthy.

## Core invariant

External fleet observability is never a prerequisite for canonical local execution.

The seven ExecutionKit systems keep their existing authority boundaries:

- Execution OS selects and closes canonical lifecycle actions.
- Agent OS routes registered and reachable resources.
- Content OS governs product content work.
- Audit OS governs audit boundaries and findings.
- Test OS governs test evidence.
- Launch OS governs release/production gates.
- State OS governs continuity, checkpoints and rehydration.

`TODO.md`, or the configured preserved native canonical projection, remains the sole mutable task/backlog authority. Neither Agent local state nor a remote control plane may replace it.

## Bootstrap states

The fleet integration state is reported independently from project execution state.

- `NOT_CONFIGURED`: no usable control-plane URL and/or device credential is configured.
- `READY`: transport is configured and the latest compatible server exchange succeeded.
- `DEGRADED`: transport is configured but network/server/credential/ACK health is currently degraded.
- `INCOMPATIBLE`: the server explicitly rejects the telemetry protocol/version contract, including HTTP 426.
- `UNKNOWN`: evidence is absent or too stale to classify safely.

None of `NOT_CONFIGURED`, `DEGRADED`, `INCOMPATIBLE`, or `UNKNOWN` may be projected as a canonical execution failure.

## Local behavior without a control plane

When transport is not configured:

1. ExecutionKit lifecycle selection and execution continue normally.
2. State OS checkpoints and rehydration continue normally.
3. Antigravity host pulses remain local best-effort observations and may be ignored when the Agent is absent.
4. Semantic events may be emitted locally, but the Agent does not create a network spool merely to preserve pre-enrollment history.
5. `agent status`, `agent list`, `agent stop`, Agent Doctor and MCP inspection must be side-effect-free: inspection alone must not create a per-device Agent configuration.
6. No release, audit, test or launch result may depend on server availability unless that project explicitly defines an independent product requirement unrelated to fleet telemetry.

## Behavior when configured but unreachable

When a server is configured but unavailable or rejects a request:

1. The Agent records transport health locally and uses bounded retry/backoff.
2. Eligible telemetry is retained in the bounded offline spool.
3. Canonical local lifecycle work continues and is never rolled back because telemetry failed.
4. A transport failure may generate an observability warning, but must not fabricate a project blocker.
5. On reconnect, replay is idempotent and server projections must not move backward because late events arrive.
6. If bounded spool policy drops events, a telemetry-gap signal must be surfaced; surrounding history must not be presented as complete.

## Elmasna3 dogfood bootstrap

Elmasna3 itself is expected to prove this mode.

Initial sequence:

1. Elmasna3 exists as an ordinary ExecutionKit-managed repository with canonical `TODO.md` planning/execution authority.
2. Antigravity or another proven host executes Elmasna3 tasks through ExecutionKit while no Elmasna3 telemetry endpoint exists.
3. The per-device Agent may remain unconfigured, or may be configured later after the server endpoint is implemented.
4. Elmasna3 builds its Laravel control-plane ingestion/projection API and Flutter clients in canonical dependency order.
5. Once the protocol-compatible server endpoint exists, the device Agent enrolls and begins reporting subsequent observations.
6. Historical facts before enrollment come from durable repository/evidence reconciliation, not invented telemetry replay.
7. Elmasna3 may then observe its own later execution without becoming task authority for itself.

This removes the circular dependency: ExecutionKit can build the control plane that will later observe ExecutionKit.

## Resource and privacy requirements

Bootstrap Mode preserves all normal 3.0 resource limits. No server configuration may cause busy-loop discovery, repeated full TODO parsing, routine source upload, transcript upload, or machine-wide resource telemetry without explicit opt-in.

Secrets remain outside project repositories. Local paths and hostname remain private by default. One Agent daemon per device supervises many worktrees; no bootstrap operation installs one daemon per project.

## Release acceptance

3.0 cannot be released unless executable tests prove at minimum:

- read-only Agent inspection does not create configuration/state;
- local semantic execution state can progress with no server configured;
- `flush()` with no configured transport is non-fatal and produces no invented success;
- a configured but unreachable server returns a transport error result without throwing through canonical execution;
- queued telemetry remains available for retry after transport failure;
- control-plane availability is never used as TODO/lifecycle authority.

Windows and macOS service lifecycle still require physical self-hosted validation on exact release-candidate SHAs.