# ExecutionKit v5.2.0 — Execution Signals Integration Release Plan

Decision date: 2026-11-01. **OFFICIAL v5.2.0 RELEASE SPECIFICATION**. Preserves all eleven ExecutionKit systems including bundled deterministic Decision OS.

## Motivation
Turn trustworthy lifecycle outcomes from the portable ExecutionKit into owner notifications with correlation, replay and controlled approvals. Avoid an OS #12, duplicated queue/notify services, paid AI APIs, long-running daemon, token-heavy agent instructions or blocking network dependencies.

## Architecture ownership & GemiIsland non-dependency policy
- Portable ExecutionKit v5.2.0: a supporting **Execution Signals** local event fabric (`lib/execution-signals.mjs`), bounded optional outbox (`lib/execution-signals-outbox.mjs`), and optional safe-boundary collaboration adapter (`lib/execution-collaboration.mjs`). Canonical TODO/active shards and receipt validation remain in their current systems.
- GemiXC: accepts source-scoped events over authenticated private HTTPS (`https://exec.gemitron.net`); binds project/run/task/repo/commit/evidence, owns verified host lifecycle tracking (`vps01`, `vps02`, `win`, `mac`), ephemeral 7-day collaboration messages, and its transactional delivery outbox.
- TronNotif: verifies `gemixc` as an OWNER-only authorized publisher (`https://notif.gemitron.net`); stores/delivers actionable owner notifications to Studio.
- Studio: exclusive owner Inbox, host lifecycle dashboard, and collaboration surface (`https://studio.gemitron.net/execution`).
- **GemiIsland Non-Dependency Decision:** `GemiIsland` is an independent, unfinished desktop client application and is **NOT** a dependency or release gate for ExecutionKit v5.2.0. Server-side ExecutionKit → GemiXC → TronNotif → Studio/GemiMCP flows operate independently without `GemiIsland`.
- Gemi Access / ZITADEL: identity, grants and scoped machine access; GemiGuard: entitlement authority; GemiMCP: cloud MCP (`https://mcp.gemitron.net/mcp`). Launch OS: sole release/deploy/rollback authority.

## Build order and verified status
1. [x] Architecture contracts committed in ExecutionKit/GemiXC/TronNotif/GemiMCP/Studio and canonical TODO tasks verified.
2. [x] ExecutionKit local event schema, receipt-validated completion signal adapter (`buildVerifiedCompletionSignal`), verified host identity resolver (`resolveVerifiedExecutionIdentity`), lifecycle transition builder (`buildExecutionLifecycleTransition`), and bounded outbox (`lib/execution-signals.mjs`, `lib/execution-signals-outbox.mjs`, `tests/execution-signals.test.mjs`).
3. [x] TronNotif `gemixc` OWNER-only catalog/grants/allowlisted deep links and negative tests deployed and verified on `https://notif.gemitron.net`.
4. [x] Kit focused tests and native Node suites executed; trusted lifecycle hooks integrated at `completeCanonicalTask` (`lib/todo-maintenance.mjs`) and `runV4Boundary` (`lib/v4-boundary.mjs`) with zero file/network I/O when disabled.
5. [x] GemiXC scoped service/machine auth, event ingestion, verified host registry (`vps01`, `vps02`, `win`, `mac`), idempotency, and outbox verified in production (`https://exec.gemitron.net`).
6. [x] Real GemiXC -> TronNotif event ingest, owner/scope verification, PostgreSQL persistence, and Studio owner Inbox verified end-to-end.
7. [x] Global (`syncGlobalHostContract` with marker-delimited preservation) and Workspace (`AGENTS.md`, `templates/AGENTS_V5.md`, `templates/AGENTS.md`, `plugins/antigravity-executionkit/rules/executionkit.md`) agent instructions reconciled.
8. [x] GemiIsland explicitly decoupled as an independent future client; not required for ExecutionKit v5.2.0 release.
9. [x] Full `npm run check`, `npm run v5:review`, `executionkit doctor . --cli-audit`, `executionkit doctor . --distribution`, fresh install, upgrade (`5.1.0 -> 5.2.0 -> 5.2.1`), and rollback verified.
10. [x] Promoted `VERSION`, `package.json`, `package-lock.json`, `tests/test-baseline.json`, and `CHANGELOG.md` to **5.2.1** (preserving immutable annotated tag `v5.2.0` and publishing official GitHub Release objects for both `v5.2.0` and `v5.2.1`).

## Security acceptance
Fail closed on forged events, unsupported types, unauthenticated publisher, cross-audience leak, raw logs/secret fields, missing exact receipts, spoofed/expired grants, stale/changed SHA approvals, action URL redirects and repeated event IDs with changed payload. No execution on notification click. Default disabled path performs zero file or network IO.

## Crash recovery and lifecycle truth
Use durable idempotent publisher and no synchronous test/deploy coupling. File-backed local signals are advisory; if a TODO/receipt changes before enqueue, inspect source and repair missed observation without inventing success. The outbox must not overwrite unrelated native user files; locks are never auto-broken without checking live writers. Distinguish unverified runtime observations from accepted release evidence.

Canonical contract: `contracts/execution-signals-v1-contract.md`; product integration: `GemiTron88/GemiXC/docs/EXECUTION_SIGNALS_ARCHITECTURE_V1.md`.
