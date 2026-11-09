# Remote local agents — additive server enforcement checkpoint

**Scope:** EK4-LAUNCH-AGENT-002, server-side stage only. APKrelease retains the single SQLite job queue; the existing API remains compatible until the `requireAgentEnrollment` flag is deliberately enabled after enrollment.

## Control

Use a registry/admin principal with project scope to call POST `/v1/projects/:project/agents/enroll` with strict body:

~~~json
{"worker_id":"a","principal_id":"agent-a","platform":"linux","capabilities":["verify","apk"]}
~~~

Corresponding build principal must already be enabled and scoped to the project. A separate per-worker HMAC receipt key must exist in `runnerKeys[project][worker_id]`. Admin and builder principals must not be shared. `GET /v1/projects/:project/agents` requires read. `POST /v1/projects/:project/agents/revoke` with `{ "worker_id": "a" }` requires registry permission, marks the agent revoked and immediately requeues active jobs.

Configure `requireAgentEnrollment: true` only after all existing workers have been registered and updated to return `lease_generation` with heartbeats and completion requests. Once enforced, each claim checks principal ID + worker ID + typed capability and advances durable fencing generation, preventing stale completions from a previous lease, including after recovery by the same principal. The worker receives and echoes `lease_generation`; legacy workers still use the v1 payload when enforcement is off.

**Important:** revoking an agent enrollment does not invalidate its existing bearer credential or HMAC signing key; the operator must rotate/revoke both in the private service configuration. The current server-side stage does not implement native Windows Job Objects, workstation installation/auto-start, TLS staging, host quota acceptance or production cutover. Do not describe it as a verified local build agent.

## Evidence

Run `node --test tests/agent-control.test.mjs tests/control-plane.test.mjs tests/security.test.mjs` on the exact source SHA, then the full Node/Python/Flutter and operating-system acceptance gates. This branch's tests are authored but not run by the GitHub connector runtime. Existing platforms and SDK endpoints remain untouched.

## Current receipt fencing

In enforced mode the signed runner receipt carries both `job_id` and `lease_generation`. The service verifies that the signed receipt belongs to the current running, non-expired lease, bound to the current agent principal and source commit. Release creation requires a completed job with the same generation and an active enrolled agent. Old or revoked worker receipts cannot be used to create a new release. This does not replace physical build integrity, real app signing validation or native device tests.

Windows execution is currently fail-closed: the existing Unix/Python runner does not implement Windows Job Objects, so the Windows workstation worker must not be activated before a genuine supervised native port. Linux service resources remain limited through the existing systemd unit; host-level resource measurements and actual installation are still required. Only enable `requireAgentEnrollment` after deployment rehearsal, enrolled worker upgrade, and backup of existing SQLite state; default remains legacy compatibility mode. For effective emergency deauthorization, the operator must also disable/rotate the worker's scoped bearer token and HMAC receipt key outside the repo.
