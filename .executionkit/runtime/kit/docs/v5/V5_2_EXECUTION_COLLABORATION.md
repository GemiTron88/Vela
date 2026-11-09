# ExecutionKit v5.2 — Optional Execution Collaboration Integration

Decision 2026-11-01, canonical branch `main` (`v5.2.0` / `v5.2.1`). This is a supplemental capability, NOT a twelfth OS, direct cloud dependency, changed Decision engine, new notification server or replacement of canonical TODO.

ExecutionKit optionally surfaces a **read-only task-boundary inbox** and bounded sender (`lib/execution-collaboration.mjs`) for authenticated project-scoped GemiXC messages (`UNTRUSTED_ADVISORY_ONLY`). Messages are advisory and never override agent instructions/decisions, task transitions, Launch authorization or executed evidence. No remote shell and no always-on polling.

GemiXC owns 7-day ephemeral messages/correlation; GemiMCP owns ChatGPT-facing `gemixc.execution.*` tools; TronNotif transports only actionable owner-facing alerts (`WAITING_REVIEW`, `WAITING_EXTERNAL`, `BLOCKED`, `FAILED`, `COMPLETED`, `DISCONNECTED`), not routine heartbeats or agent-to-agent chat bodies. `GemiIsland` is an independent non-blocking desktop client and is not a dependency for ExecutionKit v5.2. A portable Kit without GemiXC or Internet behaves identically to local offline execution.

Acceptance: specific project + run + task + source SHA, legitimate verified sender, max 1200-character message, no raw logs/secrets/transcripts, bounded safe-boundary checks only (session start, after task completion, before/after wave/phase/release boundaries, or on blocker/review/external wait) with `boundaryKey` deduplication (`SKIPPED_DUPLICATE_BOUNDARY`), offline recovery and no fake success. Agent must explicitly record any accepted decision in the appropriate canonical TODO/receipt before message expires.

### Release closure status (2026-11-01)
- Optional adapter (`lib/execution-collaboration.mjs`) and signals modules (`lib/execution-signals.mjs`, `lib/execution-signals-outbox.mjs`) are registered in `lib/v4-invariant-registry.mjs`, `lib/v4-installer.mjs`, and `bin/init-project.mjs`. Neither installer auto-enables network collaboration.
- Outbound agent connector refuses HTTP redirects with its scoped token, caps responses at 16 KiB, rejects foreign project/run identity, stamps returned messages with `authority: 'UNTRUSTED_ADVISORY_ONLY'`, validates envelope fields, deduplicates boundary checks via `boundaryKey`, and performs zero file or network I/O when disabled.
- Global (`lib/v4-platform.mjs` `syncGlobalHostContract` with per-target `IN_SYNC`/`UPDATED`/`CREATED`/`CONFLICT`/`FAILED`/`SKIPPED` and `PARTIAL` reporting) and Workspace (`AGENTS.md`, `templates/AGENTS_V5.md`, `templates/AGENTS.md`, `plugins/antigravity-executionkit/rules/executionkit.md`) instructions teach agents verified host identity (`vps01`, `vps02`, `win`, `mac`), truthful lifecycle boundaries, and safe-boundary collaboration.

### Selective Project Enrollment (v5.2.2 patch, 2026-11-03)
ExecutionKit now attempts one scoped GemiXC project enrollment handshake only after a real `PROJECT_NOT_ENROLLED` delivery response, when Signals are opted in, the enrolled host identity is verified, a 40-character source commit exists, and a scoped Gemi Access machine credential plus host proof are configured. GemiXC remains the sole project registry; the Kit never inventories GitHub or calls TronNotif directly. Explicitly setting `executionSignals.autoEnroll=false` suppresses this handshake while preserving other signal delivery. Legacy/fork/ignored GitHub repositories are not auto-imported, and an existing mismatched slug is rejected.

Handshake is attempted at most once per delivery flush and only with an explicitly configured repository and an enrolled host credential; terminal denials (ignored repository, identity binding denied, slug conflict) back off for one hour via the bounded `enrollment` record in `delivery-state.json`. Queued events are never dropped.

**Release status:** shipped in tag `v5.2.2` (not in immutable `v5.2.1`). Pinned installations are not changed automatically; adopt per project with `executionkit update` only where Signals are explicitly authorized. Production GemiXC acceptance of the server side is tracked by GemiXC `GXC-ENROLL-530`.
