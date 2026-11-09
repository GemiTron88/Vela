# GemiTron Local Build Agent

Task: EK4-LAUNCH-AGENT-002. Authority: ExecutionKit Launch OS. Queue/leases/receipts: this APKrelease
service (single SQLite store, no duplicate queue). Hub UI: GemiKit Studio (`/mobile/releases`).

The agent is a standalone Node with native SQLite and online-backup support (Node 22.16+ or 24+, tested here on 24) + Python (>= 3.10) program in `agent/` and `scripts/`. It runs
without Antigravity. It makes **outbound HTTPS requests only** and opens no listening port.

## What it will and will not do

- Executes only typed jobs `verify`, `debug_apk`, `apk` for projects mapped in its local config to a
  trusted local clone, at the exact 40-hex commit, in a disposable `git worktree`.
- Never executes commands, scripts or repositories supplied over HTTP. Server responses can only carry a
  job `{id, commit, kind}` or a directive `ACTIVE | PAUSED | STOP`.
- Runner subprocesses receive a sanitized environment. The bearer token never enters the build
  environment. The runner HMAC key is used only to sign the receipt. Signing approval material is passed
  **only** to `apk` jobs and only with an independent commit-scoped signed approval file.
- `debug_apk` builds are debug-signed packaging evidence; the server refuses to make them releases.

## Operating modes

| Mode | Command | Use |
|---|---|---|
| Manual drain (recommended for metered/quota links, e.g. Windows) | `node agent/cli.mjs run --until-idle` (or the generated `Run GemiTron Build Agent.cmd`) | Takes queued work, exits when the queue is empty. Zero traffic while not running. |
| Single cycle | `node agent/cli.mjs run --once` | One capabilities probe + one claim. |
| Continuous | `node agent/cli.mjs run` | Long-running; use with `install --autostart`. |

`network_profile: "metered"` sets idle poll 300 s, lease renewal 120 s (server lease is 300 s) and a 900 s
backoff ceiling. Presence piggybacks on the claim request, so no separate idle heartbeat is sent; the agent
declares `contact_interval_seconds`, and the server keeps it `ONLINE` for 1.5 x that interval.

Jobs queued while an agent is off stay `QUEUED` durably. There is no fallback to a VPS or production host.

## Install

```sh
node agent/cli.mjs install --config <agent.json>               # manual launcher only
node agent/cli.mjs install --autostart --config <agent.json>   # opt-in autostart
node agent/cli.mjs uninstall --config <agent.json>
```

No administrator rights are needed:

- Linux: a `systemd --user` unit with `Restart=always`, `RestartPreventExitStatus=3` and `KillMode=control-group`. Starting at boot without a login needs `loginctl enable-linger <user>`.
- Windows: an `HKCU\...\Run` entry that runs a hidden restart loop. It stops when `state/DISABLED` exists.
- macOS: a LaunchAgent with `KeepAlive`.

Other lifecycle commands:

- `status` shows the local state.
- `doctor` checks the config, credentials, git, the supervisor backend and service compatibility.
- `rotate-credentials --from new.json` atomically replaces the credentials file. A running agent reloads it at its next cycle.

## Credentials and enrollment

`credentials.json` holds `{token, runner_key[, approval_key]}`. On POSIX it must have mode `0600`; the
agent refuses to start otherwise. Enrollment is done by a registry principal:
`POST /v1/projects/:p/agents/enroll {worker_id, principal_id, platform, capabilities}`. The agent principal
must be scoped to exactly that project with only `build`/`read`. Revocation requeues and fences the agent's
running leases. You must also rotate its token hash and runner key in the service config.

## Resource protection

`scripts/supervisor.py` reports the backend it really used. The backend is recorded in `resources.json`,
in the receipt (`resource_enforcement`) and in presence.

| Backend | Where | Guarantees |
|---|---|---|
| `windows-job-object` | Windows | The process is created suspended, assigned to the Job Object, then resumed. Hard job memory cap, active-process cap and hard CPU-rate cap. Kill-on-close reaps every descendant even if the agent dies. **Source-implemented; not yet executed on Windows hardware.** |
| `systemd-scope` | Linux with cgroup v2 and delegated memory+cpu controllers | Kernel-enforced MemoryMax, CPUQuota and TasksMax. |
| `watchdog-soft` | Linux cgroup v1 / macOS | Hard CPU core cap via affinity (Linux), nice 10, and the parent-death signal. RSS, disk and timeout are polled every 0.5 s, and the whole tree is killed on breach. Escaped descendants are reaped by an environment marker. Memory is *soft*: a fast allocation can overshoot before it is killed. |

The agent refuses to claim under `CRITICAL` pressure (free disk or free memory below its limits). It runs one job at a time, and
the runner holds a host-wide lock. On start-up it reaps orphaned trees and reclaims stale worktrees.

## Operator control (Studio hub / Launch OS CLI)

- `POST /v1/projects/:p/jobs` with permission `enqueue` (verify/debug_apk only) or `build`.
- `POST /v1/projects/:p/jobs/:id/cancel` with permission `cancel`. This fences the lease; the agent aborts at its next renewal.
- `POST /v1/projects/:p/agents/control {worker_id, desired}` with permission `agents.control`. `PAUSED` means connected but no jobs. `STOP` means the agent exits at its next contact with code 3 and autostart does not relaunch it. A stopped or manually-run agent must be started on the workstation itself; the design is outbound-only on purpose.
- Release creation, approval, promotion, signing and Shorebird remain Launch OS operations with independent approvals.

## Safety correction (2026-10-12)

Canonical owner: ExecutionKit EK4-LAUNCH-SAFETY-006. Agent startup now holds a native exclusive .agent.lock before recovery; recovery also holds the runner .build.lock. Only registered Git worktrees with matching .owned-worktrees ownership records, local repository mapping and worker identity are removed. Unknown UUID directories/symlinks are preserved. A simultaneous manual/autostart agent exits HOST_BUSY before reaping or cleanup.

CWP hosts are rejected as builders. Native agent execution defaults to hard Windows Job Objects or Linux cgroup v2 controls, with actual limit read-back. Missing hard controls blocks before claim; allow_soft_limits=true is an explicit development-only concession and is not native release certification. Never enable it on production servers. Windows/Linux physical control acceptance remains pending. Gradle daemon/parallelism/workers/JVM heap are bounded in the sanitized build environment.

AAB jobs reuse the same queue/lease/receipt engine. An exact-source `aab.build` approval and existing signing identity are required. The bundle inspector uses configured jarsigner/keytool/bundletool paths (android_tools in local config); the service also verifies uploads. Bundle bytes remain private and cannot become APK updater releases. Published artifacts/keys/receipts are outside scratch cleanup.

Scratch/cache sizes are polled every five seconds with explicit pressure-stop reasons; these are sampled limits, not filesystem hard quotas. Per-project cache eviction requires its private ownership marker and the native host build lock; unmarked existing caches are preserved and block use until reviewed adoption. Gradle worker/heap bounds are explicit.

## Mandatory physical-host gate (owner requirement, 2026-10-12)

VPS/server native mobile work is prohibited without exception: debug/release APK, AAB, Gradle, Android SDK/build-tools/system-image downloads, emulator installation/execution, and Shorebird build/patch workloads. KVM and free resources do not change the rule. CWP, detected VM/cloud/container hosts and `/etc/gemitron-mobile-disabled` are denied. Unknown hardware fails closed. `runner.py`, `provision.py`, `emulator.py`, provider entrypoints and real agent startup check this before tooling/downloads; agent install cannot enable server autostart. No `--allow-vps` or environment bypass exists.

Physical workstation enrollment is separate from server queue enrollment. On the intended owner's physical workstation, `python scripts/host_policy.py inspect` prints a fingerprint and policy path without starting/installing Android tools. The owner places only this JSON at that private local path:

```json
{"schema":1,"role":"physical-workstation","fingerprint":"the_exact_observed_fingerprint"}
```

The literal example fingerprint is rejected; the actual fingerprint must match physical-host detection every run. Enrollment cannot override a denied/virtual host. Keep it out of project repositories. A dedicated account still needs native CPU/memory/process enforcement; disk/cache budgets are sampled pressure protection, not a hard filesystem quota. Windows/macOS/physical Linux observations still require real acceptance.

Historical `docs/evidence/vps1` logs describe earlier activity, including an earlier sample debug build and Android tools on VPS1. They are retained provenance and never permission to repeat it. The current prohibition supersedes prior KVM/emulator/VPS-build recommendations. This source change does not prove a live VPS has stopped services or installed a system-level restriction; verify that separately without mobile workloads.
