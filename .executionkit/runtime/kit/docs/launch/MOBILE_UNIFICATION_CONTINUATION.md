# Launch OS Global Mobile Unification — Code Checkpoint & Full Continuation Handoff

Updated: 2026-10-12 (Continuation Execution Session).
Authority Hierarchy: Official Specs / Current Law -> MASTER_PLAN -> Root Architecture Docs -> Canonical TODO.md -> Phase Packages / .agents -> Implementation & Tests -> Evidence Records.
Canonical tasks in `ExecutionKit/TODO.md`:
- `EK4-LAUNCH-MOBILE-001`: VERIFIED (Launch mobile CLI plan/status/submit/agents/cancel/control modes; debug_apk kind).
- `EK4-LAUNCH-AGENT-002`: VERIFIED (Additive schema migrations 002/003, agent presence, lease fences, operator cancellation, crash-loop fences, directives, local agent CLI & daemon, supervisor with CPU affinity, metered profile, manual `--until-idle`/`--once` modes).
- `EK4-LAUNCH-STUDIO-003`: VERIFIED (GemiKit Studio read-only mobile monitor & scoped operator controls for queueing verify/debug_apk, cancellation, agent directives; separate operator token, CSRF, rate-limiting, idempotency keys).
- `EK4-LAUNCH-ACCEPT-004`: BLOCKED (real physical Windows hardware for Job Objects, physical Android device for installed FLOW app upgrade testing, production signing certificate holder, Shorebird credentials/billing authorization, and explicit production release authorization).

---

## 1. Published Source-Stage Branches & Exact Commit Checkpoints

| Repository | Branch | Draft PR / Upstream Ref | Exact Commit SHA | Verified Changes |
|---|---|---|---|---|
| **ExecutionKit** | `codex/launch-mobile-adapter-20261012` | [PR #34](https://github.com/Elwazeery/AI-ExcutionKit/pull/34) | `49d5b621dc6d4da0d5281bf863f2634832a7a1ea` | `launch mobile` CLI plan, status, typed submit, `agents`, `cancel`, and `control` modes; `debug_apk` typed kind; strict Git source registry identity; 12/12 unit tests PASS; `validate-execution.mjs` PASS. |
| **APKrelease** | `codex/launch-local-agents-20261012` | [PR #1](https://github.com/Elwazeery/APKrelease/pull/1) | `04d225d68ece643438d22ceaf77408811adc3b68` | Schema migrations `002.sql` & `003.sql`, genuine agent presence (`ONLINE`, `OFFLINE`, `NEVER_SEEN`), lease fencing, operator cancellation (`/jobs/:id/cancel`), attempts limit & crash-loop fences, agent directives (`/agents/control`), job detail with receipts. Standalone outbound-only Local Build Agent (`agent/agent.mjs`, `agent/cli.mjs`) supporting metered profile, manual drain (`--until-idle`, `--once`), and opt-in autostart. Cross-platform resource supervisor (`scripts/supervisor.py`). 57/57 Node tests PASS, 2/2 Python tests PASS. |
| **GemiKit Studio** | `codex/launch-mobile-studio-monitor-20261012` | [PR #1](https://github.com/GemiTron88/studio/pull/1) | `c7f5edfddc7f8c8670b4d7bbb94691480d03cbd1` | Capability-gated read-only monitor (`agents.presence`, `jobs.outcomes`, `jobs.detail`, `approvals.read`) and scoped operator controls (`jobs.enqueue`, `jobs.cancel`, `agents.control`). Strict validation, CSRF, rate-limiting, separate operator token (`mobile_release_operator_token`), SHA-256 idempotency keys, and audit logging. 60/60 PHPUnit tests PASS (including 19/19 mobile tests), 6 routes verified, views cached cleanly. |

---

## 2. Real FLOW Pilot Integration & Execution Evidence

- **Target Commit**: FLOW commit `2aa01f76657caf27b9af9112161b54d7d34c7c40`.
- **Flutter SDK**: Isolated Flutter 3.47.7 toolchain (`Dart 3.13.5`, `Engine deb287481e3ce9468f3434937ced4240a70539ca`) installed at `pilot/sdk/flutter-3.47.7`.
- **Negative Test Verification**:
  - Pinned host Flutter (3.47.4) mismatch against project requirement (3.47.7) cleanly failed fast with exit code `FLUTTER_PIN_MISMATCH` and 0 bogus receipts generated.
- **Positive Verification Job**:
  - **Job ID**: `6bf8ae0c-3606-4a57-b2cc-694609a8c951`
  - **Runner ID**: `vps-linux-pilot`
  - **State**: `SUCCEEDED` (attempts: 1, outcome: `RECEIPT_VERIFIED`)
  - **Quality Gates**:
    - `analyze`: PASS (exit code 0, evidence SHA `510a9df5cfd337065bfa69f3647f4ee7b8fceb632495aeef6bf31747cd60d473`, `No issues found!`)
    - `unit`: PASS (exit code 0, evidence SHA `154c58087b29929bf2a1ae910d4cccde98001c0b629ab1c1f731342be8ad8d3f`)
    - `widget`: PASS (exit code 0, evidence SHA `154c58087b29929bf2a1ae910d4cccde98001c0b629ab1c1f731342be8ad8d3f`)
    - Total tests executed: **1037 / 1037 tests PASSED** in 723 seconds.
  - **HMAC Receipt**: `0f0c6a17-6fe7-4245-b66a-6a1c98618576` signed with HMAC-SHA256 signature `d4887a0f1cdfcbef78b92013cb0b7875acd5a6fa1d0ad1280c8bf009f7c90f82`.
  - **Resource Supervision Metrics**:
    - Selected backend: `watchdog-soft` (truthfully reported; cgroup v2 controllers not delegated to unprivileged user slice on this host).
    - CPU cores cap: 2 cores enforced via `sched_setaffinity` (`cpu_affinity: [0, 1]`).
    - Memory cap: 6,144 MB cap. Observed peak RSS: 268 MB (dependencies) -> 1,322 MB (analyze) -> 2,819 MB (test suite). Zero memory limits breached.
    - Orphan reap: 0 orphans left; disposable git worktree `job-60c7d220-b3dc-4d69-b802-84f298015b73` automatically reclaimed and cleaned up.

---

## 3. Quota-Constrained / Metered Windows Workstation Architecture

To protect quota-limited workstations (e.g. metered Windows connections):
1. **Metered Network Profile (`network_profile: "metered"`)**:
   - Idle poll interval: 300 seconds (5 minutes).
   - Lease renewal: 120 seconds.
   - Max backoff ceiling: 900 seconds (15 minutes).
   - Piggybacked presence: Agent declares `contact_interval_seconds: 300` directly in the claim request. Zero separate idle heartbeat pings are sent.
2. **First-Class Manual Draining Modes**:
   - `node agent/cli.mjs run --until-idle`: Connects, executes all pending queued jobs sequentially, reports signed receipts, and cleanly terminates with exit code 0 when queue is empty.
   - `node agent/cli.mjs run --once`: Executes exactly one capabilities probe and one claim cycle, then terminates.
   - Double-click Windows launcher `Run GemiTron Build Agent.cmd` is generated during `install` for desktop users who only run builds on demand.
   - Zero network traffic or background processes when the agent is not running.
3. **Outbound-Only HTTPS**:
   - Agent initiates all connections over HTTPS. Zero inbound open ports. Zero firewall/NAT configuration required.
   - Upstream cannot push arbitrary scripts or code; it can only return typed job payloads (`{id, commit, kind}`) or directives (`ACTIVE`, `PAUSED`, `STOP`).

---

## 4. GemiKit Studio: Operator Monitoring & Control Hub

- **Hub Responsibilities**:
  - Real-time visibility into agent presence (`ONLINE`, `OFFLINE`, `NEVER_SEEN`), host platform, OS release, and resource enforcement.
  - Job history, attempt counts, outcome reasons, and deep receipt inspection with gate evidence SHAs.
  - Operator write controls: Enqueue verify / debug builds (`verify`, `debug_apk`), cancel running/queued jobs, and issue worker directives (`PAUSED`, `STOP`).
- **Security & Authorization Boundaries**:
  - Independent tokens: Read token (`mobile_release_token`) and Operator token (`mobile_release_operator_token`) are strictly separated and never rendered in HTML.
  - CSRF protection, admin middleware, and rate-limiting (`throttle:10,1`).
  - Idempotency: All write actions use deterministic SHA-256 keys to prevent duplicate enqueues or actions on network retries.
  - Fail-closed capability detection: Controls are only visible and actionable if upstream advertises the respective capability (`jobs.enqueue`, `jobs.cancel`, `agents.control`).
  - Gated Release Authority: Native production release creation, approval, signing, and track promotions remain strictly within ExecutionKit Launch OS. Studio cannot create production releases or sign artifacts.

---

## 5. Status Truth & Verification Summary

| Component | Status | Verified Evidence |
|---|---|---|
| ExecutionKit Mobile Adapter | **VERIFIED** | 12/12 unit tests PASS (`tests/launch-mobile.test.mjs`); task validation PASS (0 errors). |
| APKrelease Service & Migrations | **VERIFIED** | 57/57 Node tests PASS (34 agent control/E2E + 23 core); 2/2 Python tests PASS. |
| Local Build Agent & Supervisor | **VERIFIED** | Outbound HTTPS, metered profile, manual `--until-idle`, watchdog-soft with CPU affinity verified in live FLOW pilot run. |
| GemiKit Studio Hub & Controls | **VERIFIED** | 60/60 PHPUnit tests PASS (including 19/19 mobile tests); 6 routes verified; Blade cached. |
| FLOW Pilot Execution | **VERIFIED** | 1037/1037 tests PASS; analyze PASS; signed receipt generated; worktree cleaned up. |
| Windows Job Objects Native Execution | **BLOCKED** | Source-implemented in `scripts/supervisor.py`; not executed on physical Windows hardware. |
| FLOW Production Device Upgrade | **BLOCKED** | Requires physical Android device with production FLOW installed. |
| Production Release Signing & Distribution | **BLOCKED** | Requires real keystore certificates, Shorebird billing authorization, and owner release sign-off. |
