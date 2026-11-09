# Execution Signals v1 — Optional local engineering event fabric

Decision date: 2026-11-01. Status: **IMPLEMENTED & VERIFIED (v5.2.1; selective enrollment handshake v5.2.2)**.

ExecutionKit retains exactly **11 executable systems**. Execution Signals is a small optional supporting module, not a twelfth OS, daemon, agent, control-plane dependency, GemiTron-specific requirement, telemetry collector, or direct notification engine. This Kit runs offline/portably and must not make model, SaaS or network calls in Decision OS evaluation, regular task entry, or mandatory quality/release gates.

## Source and event rules
- A signal describes a transition or independently verified boundary result; must bind source/path or evidence reference, canonical run/task identity when known, exact observed Git commit when applicable, and a stable identity with source + event ID.
- The producer must distinguish `observed`, `verified`, `blocked`, `unverified`, and `not_applicable`; never promote reports or self-declared success to release proof. Pending/suspected state is never a verified failure.
- CloudEvents-compatible v1 envelope: `specversion=1.0`, `id`, `source`, `type`, `time`, `subject?`, `data` with `schema_version=1`, `run_id`, `task_id?`, `repository`, `commit_sha?`, `severity`, `status`, `evidence_ref?`. Reject unrestricted payloads, raw logs, secrets, prompt text and uncontrolled URLs. All values have bounded lengths; no user-provided id masquerading as host verification.
- Allowed types initially: `execution.task.started`, `execution.task.completed`, `execution.task.blocked`, `execution.test.failed`, `execution.visual.review_required`, `execution.decision.denied`, `execution.agent.delegation_failed`, `execution.phase.completed`, `execution.release.verified`, `execution.deploy.completed`, `execution.rollback.completed`. `execution.approval.requested` is GemiXC-created after authorization, not a Kit-owned approval.
- No duplicated task backlog or permanent event ledger: TODO is canonical; local signals and delivery journal are derived/non-authoritative and excluded from git. Source receipts survive failed event delivery.

## Delivery and performance
- Disabled by default; installation requires zero new services/dependencies. A standalone Kit stays fully functional without GemiXC/TronNotif.
- Only emit after real state transitions with verified provenance; never output a notification for every command, file, heartbeat or test assertion.
- Persist bounded, atomic local queue when enabled; bounded idempotent flush at allowed boundaries only (`deliverExecutionSignalOutbox`) with five separate receipts (`localCreation`, `outboxPersistence`, `gemixcAcceptance`, `queueAcknowledgment`, `retry`); no blocking dependency for execution/release. Failed delivery retains unacknowledged outbox items and can be retried idempotently without rewriting events; avoid unbounded disk use/console output and credential disclosure.
- Recovery reconciles canonical state/receipts with the queue for crash windows; do not claim atomicity across unrelated files. No network probe during Decision evaluation.
- GemiXC is one optional owner of event ingestion and notification forwarding. The Kit **never** gains direct ownership of TronNotif, Gemi Access, GemiGuard or Studio; it is reusable outside GemiTron.

## Acceptance
Unit tests must cover schema reject, path/secret sanitization, deterministic identity, duplicate vs changed payload, capped buffer, atomic persistence, disabled default with no I/O, failure recovery, GemiXC delivery/ack/retry separation, intermediate phase vs whole-project completion scope, and impossible success without accepted evidence. Benchmarks must measure token/output and latency overhead, not assume it is free.

Downstream authority: `GemiTron88/GemiXC/docs/EXECUTION_SIGNALS_ARCHITECTURE_V1.md`.
