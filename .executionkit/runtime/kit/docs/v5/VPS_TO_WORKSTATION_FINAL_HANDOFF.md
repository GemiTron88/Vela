# ExecutionKit v5 — VPS Final Web & Launch OS v2 Acceptance Handoff (`VPS1` $\rightarrow$ Physical Workstation)

> Historical receipt only: owner removed VPS Staging from mandatory v5 release on 2026-10-14. Do not recreate this infrastructure or execute CWP root bootstrap for the Kit distribution. See `docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md`.

- **Document ID:** `EK5-VPS-TO-WORKSTATION-FINAL-HANDOFF-20261014`
- **Date:** `2026-10-14`
- **Repository:** `https://github.com/Elwazeery/AI-ExcutionKit` (`main`)
- **Base Workstation Commit Inspected:** `aa0002b72d489ec3d7b573f66de12f770f5f75bb` (`VERSION`: `5.0.0-dev`)
- **Verified Active VPS Host:** **VPS1** — `vmi3202930.contaboserver.net` (`173.212.237.207`, AlmaLinux 9.8, Linux `5.14.0-611.41.1.el9_7.x86_64`, 16 vCPU, 62 GiB RAM, Node `v22.14.0`, Python `3.9.25`, PHP `8.4.26`, MariaDB `10.5.29`, Apache `2.4.62`, Nginx `1.30.5`)
- **Evidence Directory:** `docs/v5/evidence/vps-staging-20261014/`
  - `docs/v5/evidence/vps-staging-20261014/vps1-host-inspection.json` (`VPS_HOST_VERIFIED`)
  - `docs/v5/evidence/vps-staging-20261014/launch-service-staging-acceptance.json` (`STAGING_VERIFIED`)
  - `docs/v5/evidence/vps-staging-20261014/web-deployment-staging-acceptance.json` (`STAGING_VERIFIED`)
  - `docs/v5/evidence/vps-staging-20261014/security-failure-matrix.json` (`STAGING_VERIFIED`)
  - `docs/v5/evidence/vps-staging-20261014/performance-telemetry.json` (`VPS_HOST_AND_STAGING_VERIFIED`)

---

## Executive Summary & Compact Status Table

All VPS-safe Launch OS v2 Service, Studio API integration, Laravel Web Deployment (`host-plan`, `host-check`, CWP `.tpl`/`.stpl` template bindings, `ALLOWLIST` artifact purity, MariaDB migrations, logical backup + off-host SQL restore, release/cache retention, atomic symlink rollback, and HTTPS `.well-known/executionkit-release.json` exact-SHA attestation), and 12 negative security/failure scenarios have been **executed and verified on VPS1 (`vmi3202930.contaboserver.net` / `173.212.237.207`)** without touching FLOW (`app.elwazeery.com` / `flow.elwazeery.com`) or any live customer site.

| Area | Status | Evidence Classification | Verified Summary & Receipt |
| :--- | :--- | :--- | :--- |
| **VPS Host Inspection** | `VERIFIED` | `VPS_HOST_VERIFIED` | Confirmed active host is **VPS1** (`vmi3202930.contaboserver.net` / `173.212.237.207`), hosting `app.elwazeery.com` (FLOW), `ai.elwazeery.com` (`wazzai.service` on `:8088`), `wa.elwazeery.com`, and CWP sites. Hard mobile/builder refusals verified live (`VPS_NATIVE_MOBILE_FORBIDDEN`, `PRODUCTION_CWP_BUILDER_FORBIDDEN`). Receipt: `docs/v5/evidence/vps-staging-20261014/vps1-host-inspection.json` |
| **Isolated Staging** | `VERIFIED` | `STAGING_VERIFIED` | Ephemeral user-space staging provisioned on VPS1 (`/tmp` isolated Launch Service on `127.0.0.1:18088`/`18089`, isolated MariaDB `10.5.29` on `127.0.0.1:13307`, PHP `8.4.26`, `/usr/sbin/httpd` `2.4.62`, `/usr/sbin/nginx` `1.30.5`, local HTTPS server with ephemeral CA); cleanly torn down with zero production impact. |
| **Launch OS v2 Service** | `VERIFIED` | `STAGING_VERIFIED` | Real `bin/launch-service.mjs` daemon verified with SQLite WAL schema `v6` (`27` capabilities), `studio-live-integration.test.mjs` **`4/4` suites PASS (`0` skipped)** in `645.97 ms`, Ed25519 signed gates, workstation inspection bridge, HTTP `Range` (`206`/`416`), role separation, and `SIGKILL` lease recovery (`232.22 ms`). Receipt: `docs/v5/evidence/vps-staging-20261014/launch-service-staging-acceptance.json` |
| **Web Deployment** | `VERIFIED` | `STAGING_VERIFIED` | Deployed `v1`, `v2`, `v3` Laravel candidates with `ALLOWLIST` purity (`12` runtime files, `4888` B; dev/docs/tests/`.env` excluded), PHP `8.4.26` preflight (`PASS`), MariaDB migrations (`["baseline-v0","v1","v2","v3"]`), HTTPS `.well-known/executionkit-release.json` exact-SHA attestation, and bounded retention (`v1` pruned, `v2`+`v3` kept). Receipt: `docs/v5/evidence/vps-staging-20261014/web-deployment-staging-acceptance.json` |
| **CWP / Vhost Safety** | `VERIFIED` (`STAGING`) / `BLOCKED_EXTERNAL` (`SHARED ROOT`) | `VPS_HOST_VERIFIED` + `STAGING_VERIFIED` | `inspectVhostGuard` auto-detects `/usr/local/cwpsrv` on VPS1 (`VHOST_CWP_BINDINGS_REQUIRED`). Isolated CWP `.tpl`/`.stpl` + `/usr/sbin/httpd -t` + `/usr/sbin/nginx -T` passed (`hostCheckStatus: PASS`), and drift probes rejected `VHOST_CWP_TEMPLATE_DRIFT` and `VHOST_DOCUMENT_ROOT_DRIFT`. Shared root CWP files require owner root ACL bootstrap (Section 7). |
| **Rollback & Restore** | `VERIFIED` | `STAGING_VERIFIED` | Online SQLite backup (`16.1 ms`, 26 hash-chained journal events) + off-host restore into second daemon on `:18089` (`230.39 ms`); MariaDB gzipped backup (`175.12 ms`, `888` B) + off-host SQL restore into `ek5_staging_restore_db` (`93.81 ms`); atomic web rollback `v3` $\rightarrow$ `v2` (`693.26 ms`). |
| **Security Failure Matrix** | `VERIFIED` | `STAGING_VERIFIED` | All 12 negative scenarios verified with truthful errors (`409 WORKSTATION_ARTIFACT_INSPECTION_REQUIRED`, `401 INSPECTION_SIGNATURE_INVALID`, `409 APK_IDENTITY_MISMATCH`, `403 AGENT_NOT_ENROLLED`, `409 AGENT_CREDENTIAL_ROTATION_REQUIRED`, `409 LAUNCH_GATE_EXPIRED`, `409 APPROVAL_REQUIRED`, `409 BASELINE_MISMATCH`, `409 CHECKSUM_MISMATCH`, `409 LEASE_FENCED`, smoke/migration auto-rollback). Receipt: `docs/v5/evidence/vps-staging-20261014/security-failure-matrix.json` |
| **Performance** | `VERIFIED` | `VPS_HOST_AND_STAGING_VERIFIED` | CLI cold `status --json` `287.75 ms`, `start --json` `739.17 ms`, `next --json` `290.96 ms`, `decision status` `64.42 ms`; Launch API `/releases/manifest` `p50 4.343 ms` / `p95 5.861 ms`; daemon RSS `68.85 MiB`; SQLite DB `4096 B` (`1.23 MB` WAL); VPS-applicable targeted suites `89/89` PASS in `12.14 s`. Receipt: `docs/v5/evidence/vps-staging-20261014/performance-telemetry.json` |
| **Canonical Push** | `VERIFIED` | `SOURCE_VERIFIED` + `STAGING_VERIFIED` | `node bin/validate-execution.mjs .` passes with `0 errors, 0 warnings`; all 5 VPS1 JSON receipts, `TODO.md`, and `docs/v5/VPS_TO_WORKSTATION_FINAL_HANDOFF.md` committed and pushed to `origin/main` while preserving Windows workstation receipts (`docs/v5/evidence/workstation-20261013/`). |
| **Remaining Physical Android Gate** | `PHYSICAL_PENDING` | `PHYSICAL_PENDING` | Zero mobile/Gradle/Flutter/emulator commands executed on VPS1 (`VPS_NATIVE_MOBILE_FORBIDDEN`). Physical Android device USB/ADB connection, release-signed APK/AAB build/inspection, and real-device install/replace/rollback remain for the Windows workstation (`DESKTOP-717CK7V`, Section 8). |

---

## 1. Exact Canonical HEAD and Implementation Changes

- **Base Workstation Commit Inspected:** `aa0002b72d489ec3d7b573f66de12f770f5f75bb` (`main`)
- **Runtime / Kernel Code Changes Required on VPS1:** **None (`0` runtime source mutations).** All Launch OS v2 Service (`lib/launch-service/`), Web Deployment (`lib/production-deployment.mjs`, `lib/production-artifact-policy.mjs`, `lib/production-backup.mjs`, `lib/production-retention.mjs`, `lib/vhost-guard.mjs`), and Decision OS (`lib/decision/`) modules passed live Linux/VPS1 staging verification as implemented on `aa0002b72d489ec3d7b573f66de12f770f5f75bb`.
- **Canonical Evidence & Documentation Added in This Commit:**
  1. `docs/v5/evidence/vps-staging-20261014/vps1-host-inspection.json` (`VPS_HOST_VERIFIED`)
  2. `docs/v5/evidence/vps-staging-20261014/launch-service-staging-acceptance.json` (`STAGING_VERIFIED`)
  3. `docs/v5/evidence/vps-staging-20261014/web-deployment-staging-acceptance.json` (`STAGING_VERIFIED`)
  4. `docs/v5/evidence/vps-staging-20261014/security-failure-matrix.json` (`STAGING_VERIFIED`)
  5. `docs/v5/evidence/vps-staging-20261014/performance-telemetry.json` (`VPS_HOST_AND_STAGING_VERIFIED`)
  6. `docs/v5/VPS_TO_WORKSTATION_FINAL_HANDOFF.md` (this handoff document)
  7. `TODO.md` (`EK4-LAUNCH-CUTOVER-007`, `EK4-LAUNCH-PARITY-008`, `EK4-DEPLOY-RETENTION-001`, `EK4-DEPLOY-PURITY-001`, `EK4-DEPLOY-PURITY-002`, `EK4-DEPLOY-CURRENT-ONLY-001`, `EK5-GEMITRON-LAUNCH-V2`, `EK5-GEMITRON-PUBLISH`)

---

## 2. VPS Host & Launch Integration Status (`VPS_HOST_VERIFIED`)

Receipt: `docs/v5/evidence/vps-staging-20261014/vps1-host-inspection.json`

### 2.1 Authorized Host Determination (VPS1 vs. VPS2)
- **Active Host:** `vmi3202930.contaboserver.net` (`173.212.237.207`, `2a02:c207:2320:2930::1`).
- **OS & Hardware:** AlmaLinux 9.8 (Moss Jungle Cat), kernel `5.14.0-611.41.1.el9_7.x86_64`, KVM virtualized (`sys_vendor: QEMU`), 16 vCPU, 62 GiB RAM (`41 GiB` available), 299 GB `/` disk (`98 GB` free), 16 GiB swap (`16 GiB` free).
- **Session User:** `uid=1021(antigravity) gid=1021(antigravity) groups=1021(antigravity)`; `sudo -n true` fails closed (`sudo: a password is required`).
- **Topology Proof (Why This Host Is VPS1):**
  - Historical 2026-10-12 audit notes recorded from `109.205.183.253` (`uid=1032`) observed only `flow.elwazeery.com` and could not locate the origin for `app.elwazeery.com`.
  - Direct inspection of `/usr/local/apache/conf.d/vhosts/` and `/etc/nginx/conf.d/vhosts/` on **`173.212.237.207` (`vmi3202930.contaboserver.net`)** confirms this server is **VPS1**, hosting:
    - `app.elwazeery.com` (current FLOW production — `DocumentRoot /home/elwaz/app.elwazeery.com/public`, CWP user `elwaz`, PHP-FPM 8.3; paused per owner directive, untouched)
    - `flow.elwazeery.com` (legacy FLOW — `DocumentRoot /home/elwaz/flow.elwazeery.com`, untouched)
    - `ai.elwazeery.com` (`wazzai.service` — `WazzAI AI Platform Control Plane` listening on `127.0.0.1:8088`, untouched)
    - `wa.elwazeery.com` (`waui.service` — `WAui WhatsApp Gateway` listening on `127.0.0.1:3100`, untouched)
    - Active customer CWP domains: `antlaqasahm.sa`, `fiberhubsa.com`, `tayfconnect.com`, `sabaghkw.com`, `waafi.app`, `crm.elwazeery.com`, `files.elwazeery.com`, `hpanel.elwazeery.com`, `kora.elwazeery.com`, `mail.elwazeery.com` (all untouched).
  - Outbound probe to `109.205.183.253` (VPS2) from `antigravity@173.212.237.207` timed out on TCP `:22` (`SSH_TIMEOUT_OR_UNREACHABLE_FROM_VPS1`).

### 2.2 Port Collision & Service Discovery on VPS1
- **Critical Port Discovery:** Launch Service's default bind address `127.0.0.1:8088` is **already occupied on VPS1 by `wazzai.service`** (`/home/elwaz/ai.elwazeery.com`, proxied by `ai.elwazeery.com.ssl.conf`).
- **Resolution:** Launch OS v2 on VPS1 must use **`LAUNCH_BIND_HOST=127.0.0.1` and `LAUNCH_PORT=8089`** (verified free) when permanently installed as `executionkit-launch.service`.
- **Database & Web Binaries Available on VPS1:**
  - MariaDB `10.5.29-MariaDB` (`/usr/libexec/mysqld`, `/usr/bin/mysql`, `/usr/bin/mysqldump`)
  - PHP `8.4.26` CLI (`/usr/local/bin/php`, `pdo_mysql`, `sqlite3`, `openssl`, `mbstring`, `curl`, `pcntl`, `posix`)
  - Apache `/usr/sbin/httpd` `2.4.62` (CWP build `/usr/local/apache`)
  - Nginx `/usr/sbin/nginx` `1.30.5` (`/etc/nginx`)

### 2.3 Hard Native Mobile & CWP Guards Verified Live on VPS1
1. **Python Host Policy & Command Guard (`npm run test:launch-service:python`):**
   - `tests/launch-service/python/guard_test.py`: **`4/4` PASS** (`1.251s`)
   - `tests/launch-service/python/host_policy_test.py`: **`4/4` PASS** (`1.571s`)
2. **Live Workstation Enrollment Guard (`lib/launch-service/scripts/host_policy.py`):**
   - Executing `host_policy.require_workstation()` on VPS1 fails closed with:
     - `code: "VPS_NATIVE_MOBILE_FORBIDDEN"`
     - `indicators: ["cwp:/usr/local/cwpsrv", "hosting:/usr/local/apache/conf.d/vhosts"]`
3. **Live Node Agent Builder Guard (`lib/launch-service/agent/agent.mjs:34`):**
   - Calling `loadAgentConfig()` on VPS1 fails closed with `PRODUCTION_CWP_BUILDER_FORBIDDEN` (`Refusing to start local build agent on a CWP/web-hosting server`).
4. **Live CWP Vhost Guard Auto-Detection (`lib/vhost-guard.mjs:141`):**
   - Calling `inspectVhostGuard` on VPS1 without `cwpTemplateDir`/`cwpSelectionFile` automatically detects `/usr/local/cwpsrv` and fails closed with `VHOST_CWP_BINDINGS_REQUIRED`.

---

## 3. Isolated Staging Test Results (`STAGING_VERIFIED`)

Receipts:
- `docs/v5/evidence/vps-staging-20261014/launch-service-staging-acceptance.json`
- `docs/v5/evidence/vps-staging-20261014/performance-telemetry.json`

### 3.1 Launch OS v2 Service & Live Studio Integration (`studio-live-integration.test.mjs`)
We provisioned a real isolated `bin/launch-service.mjs` daemon on `127.0.0.1:18088` (and secondary restore daemon on `127.0.0.1:18089`) with ephemeral Ed25519 keys, Studio credentials file, and SQLite WAL database under `/tmp`, then ran:

```bash
STUDIO_CREDENTIALS_FILE=/tmp/ek5-launch-staging-4f7c1482/studio-creds.env \
RUN_LIVE_DESTRUCTIVE_TESTS=true \
node --test tests/launch-service/studio-live-integration.test.mjs
```

- **Result:** **`4/4` suites PASS, `0` failed, `0` skipped** in `645.97 ms`:
  1. `Studio credentials file parses and exposes required tokens`: **PASS** (`1.74 ms`)
  2. `Studio token separation enforces read vs operator vs publisher vs approver boundaries`: **PASS** (`63.56 ms`)
  3. `Full Studio workflow: project -> agent -> job -> signed gates -> release -> approve -> promote`: **PASS** (`161.36 ms`)
  4. `Live destructive test: agent revocation and job cancellation propagation`: **PASS** (`35.22 ms`)

### 3.2 End-to-End Positive Launch OS v2 Capabilities Verified on VPS1
All 15 Launch OS v2 service capabilities were exercised and recorded in `launch-service-staging-acceptance.json`:
1. **`GET /healthz` & `GET /readyz`:** `200 OK`, SQLite `schema: 6`, `journalEvents: true`, `artifactRootWritable: true`, `signingKeyPresent: true`.
2. **`GET /v1/capabilities`:** `200 OK`, `apiVersion: "v1"`, `schemaVersion: 6`, `27` capabilities including `launch.gates.signed`, `artifacts.workstation.inspect`, `signing.lineage.establish`, `agents.enroll.registry`, `releases.approve.independent`, and `sdk.global_mobile_updater.v1`.
3. **`bin/launch-service.mjs status`:** `status: "RUNNING"`, `ready: true`, `schema: 6`.
4. **Project Registration & Idempotency:** `POST /v1/projects` (`201 Created`), identical key replay (`201`, `idempotentReplay: true`), mutated payload with same key (`409 IDEMPOTENCY_CONFLICT`).
5. **Agent Enrollment & Presence Heartbeat:** `POST /v1/agents/enroll` (`201`, `w1` & `w2`, `enforcement: "windows-job-object"`), `POST /v1/agents/w1/heartbeat` (`200`, `presence: "ONLINE"`).
6. **Signing Lineage Establishment:** `POST /v1/projects/:slug/signing/establish` (`201`, `status: "ESTABLISHED"`, `approved_by: "studio-approver"`).
7. **Job Enqueue & Lease Claim:** `POST /v1/projects/:slug/jobs` (`201`, `status: "QUEUED"`), `POST /v1/agents/w1/claim` (`200`, `status: "CLAIMED"`, `fence_generation: 1`, `attempt_no: 1`).
8. **Workstation-Signed Artifact Inspection Upload & Range Download:** `POST /v1/jobs/:id/artifacts` (`201`, `inspectionVerified: true`), `GET /v1/artifacts/:id/download` (`200`, `201` bytes, `Accept-Ranges: bytes`), partial `Range: bytes=0-31` (`206 Partial Content`, `Content-Range: bytes 0-31/201`, `32` bytes), invalid `Range: bytes=9999-10000` (`416 Range Not Satisfiable`).
9. **Execution & Physical Device Receipt Submission:** `POST /v1/jobs/:id/receipts` (`201`), `POST /v1/jobs/:id/complete` (`200`, `status: "SUCCEEDED"`).
10. **Ed25519 Signed Canonical Launch Gate (`Test` + `Audit` + `Visual`):** `POST /v1/projects/:slug/launch-gates` (`201`, `status: "PASS"`).
11. **Release Creation (`v1.0.1+2`):** `POST /v1/projects/:slug/releases` (`201`, `status: "CREATED"`).
12. **Staging Promotion $\rightarrow$ Independent Approval $\rightarrow$ Stable Promotion:** `POST .../promote` (`201`, `channel: "staging"`), `POST .../approve` by `studio-approver` (`201`, `status: "APPROVED"`), `POST .../promote` (`201`, `channel: "stable"`, `status: "PUBLISHED"`).
13. **Flutter SDK Manifest Signature Verification:** `GET /v1/projects/:slug/releases/manifest?channel=stable&currentVersionCode=1` (`200`, `updateAvailable: true`, `rolloutEligible: true`, `ed25519Verified: true`).
14. **Online SQLite Backup & Off-Host Restore Verification:** `backupDatabase()` completed in `16.1 ms` (`26` hash-chained journal events verified); restored into a second daemon on `127.0.0.1:18089` (`230.39 ms`), which served `/readyz` (`200`) and the identical Ed25519-signed stable manifest (`versionCode: 2`).
15. **`SIGKILL` Service Interruption & Lease Recovery:** Killed daemon `pid` mid-lease (`fence_generation: 3`) with `SIGKILL`, restarted daemon (`232.22 ms`), ran `POST /v1/leases/recover` (`200`, `recovered: true`), and re-claimed job on `w2` (`attempt_no: 2`, `fence_generation: 4`).

### 3.3 VPS-Applicable Targeted Regression Suites (`89/89` PASS)
| Suite | Result | Duration |
| :--- | :--- | :--- |
| `tests/production-deployment.test.mjs` + `tests/production-purity.test.mjs` | **`38/38` PASS** | `9466.52 ms` |
| `tests/vhost-guard.test.mjs` | **`12/12` PASS** | `583.04 ms` |
| `tests/launch-mobile.test.mjs` + `consolidation-integrity` + `control-plane` + `security` | **`39/39` PASS** | `2087.17 ms` |
| `npm run test:launch-service:python` (`guard_test.py` + `host_policy_test.py`) | **`8/8` PASS** | `2822.00 ms` |

---

## 4. Web Deployment, Rollback & Restore Evidence (`STAGING_VERIFIED`)

Receipt: `docs/v5/evidence/vps-staging-20261014/web-deployment-staging-acceptance.json`

We provisioned an isolated user-space staging environment on VPS1 using real system binaries:
- **Database:** User-space MariaDB `10.5.29` instance (`mysqld --no-defaults`) on `127.0.0.1:13307`, database `ek5_staging_db` (and `ek5_staging_restore_db` for off-host restore verification), connected via PHP `8.4.26` `pdo_mysql`.
- **Web Server / CWP Vhost Validation:** Real `/usr/sbin/httpd -t` (`Apache/2.4.62`) + `/usr/sbin/nginx -T` (`nginx/1.30.5`) validating isolated staging vhosts (`staging-ek5.internal` on ports `18080`/`18443` and `80`/`443`), custom CWP `.tpl`/`.stpl` pair (`laravel-public-root.tpl` / `laravel-public-root.stpl`), and CWP `vhosts_conf.json` selection file.
- **HTTPS Release Attestation Server:** Local Node HTTPS server (`https://localhost:45347`) serving the active release's `current/public/.well-known/executionkit-release.json` and executing `current/artisan health` against MariaDB `127.0.0.1:13307`, verified via `NODE_EXTRA_CA_CERTS`.

| Lifecycle Step | Status | Duration | Verified Details |
| :--- | :--- | :--- | :--- |
| `planHostVhost` (`launch host-plan`) | `PLANNED` | `2.12 ms` | `expectedDocumentRoot: .../deploy/current/public`, custom `.tpl`/`.stpl` pair verified |
| `checkHostVhost` (`launch host-check`) | `PASS` | `462.71 ms` | `5/5` checks PASS (`apache-http-vhost`, `apache-https-vhost`, `nginx-http-vhost`, `nginx-https-vhost`, `cwp-template-selection`), `/usr/sbin/httpd -t` `Syntax OK`, `/usr/sbin/nginx -T` `syntax is ok` |
| `planProductionRelease` (`ALLOWLIST`) | `READY` | `88.81 ms` | `12` runtime files (`4888` B); `docs/`, `tests/`, `.agents/`, `TODO.md`, `.env` excluded |
| `buildProductionReleaseArtifact` | `BUILT` | `129.09 ms` | Source & payload manifests verified (`12` files, `0` forbidden paths) |
| `verifyLaravelProductionRuntime` | `PASS` | `62.10 ms` | PHP `8.4.26` CLI resolved config verified (`APP_ENV=production`, `APP_DEBUG=false`, MySQL driver) |
| `prepareProductionBackup` (`mysqldump` + `gzip`) | `PASS` | `175.12 ms` | Real gzipped logical SQL dump (`888` B compressed / `2463` B SQL, SHA-256 `b746ffda4fa5db5f0eb99d2fc7ddcb4419655c65c5d49065a0b3dd93221a9f70`) |
| Off-Host SQL Restore (`ek5_staging_restore_db`) | `PASS` | `93.81 ms` | Gunzipped and restored into isolated `ek5_staging_restore_db`; verified exact row count (`1`) and `release_tag: "baseline-v0"` |
| Deploy `v1` (`f04a0649...`) | `DEPLOYED` | `2350.27 ms` | MariaDB migration applied (`["baseline-v0","v1"]`), queue restart & schedule verify `PASS`, HTTPS `.well-known/executionkit-release.json` exact-SHA attested |
| Deploy `v2` (`fa18886e...`) | `DEPLOYED` | `2380.15 ms` | MariaDB migration applied (`["baseline-v0","v1","v2"]`), `v2` active, `v1` retained as rollback |
| Deploy `v3` (`1a814141...`) + Retention | `DEPLOYED` | `2370.46 ms` | MariaDB migration applied (`["baseline-v0","v1","v2","v3"]`), `keepRollbacks=1` automatically pruned `v1` release dir and artifact cache (`deletedCount: 1`), kept `v2` + `v3` |
| Atomic Rollback (`v3` $\rightarrow$ `v2`) | `ROLLED_BACK` | `693.26 ms` | Symlink `current` switched atomically to `v2`; HTTPS `.well-known/executionkit-release.json` attested `fa18886e...`; re-rolled forward to `v3` (`PASS`) |

---

## 5. Security & Failure Acceptance Results (`STAGING_VERIFIED`)

Receipt: `docs/v5/evidence/vps-staging-20261014/security-failure-matrix.json`

All 12 required negative scenarios were executed against the live staging daemon and web deployment pipeline on VPS1. Every scenario failed closed with a truthful status code and structured reason:

| # | Scenario | Observed Status & Code | Truthful Behavior Verified |
| :--- | :--- | :--- | :--- |
| **1** | **Invalid signing evidence** | `409 WORKSTATION_ARTIFACT_INSPECTION_REQUIRED` / `401 INSPECTION_SIGNATURE_INVALID` / `409 APK_IDENTITY_MISMATCH` | Uninspected upload, forged HMAC inspection signature, and mismatched `applicationId` (`com.evil.spoof`) all rejected before release creation. |
| **2** | **Revoked agents** | `403 AGENT_NOT_ENROLLED` / `409 AGENT_CREDENTIAL_ROTATION_REQUIRED` | Revoking `w1` immediately fences active lease; revoked `w1` cannot heartbeat (`403`) or re-enroll with old secret (`409`); signing key rotation attested by a revoked principal is rejected during release creation. |
| **3** | **Expired approval / gate** | `409 LAUNCH_GATE_EXPIRED` / `409 APPROVAL_REQUIRED` | Expired Ed25519 Launch Gate (`expiresAt` in past) rejected at release creation (`409`); promoting to `stable` without independent approval rejected (`409`); self-approval by publisher token rejected (`401`/`403`). |
| **4** | **Wrong release SHA** | `409 BASELINE_MISMATCH` / Web `FAILED` (`ROLLED_BACK`) | Launch Gate signed for wrong `commitSha` rejected (`409 BASELINE_MISMATCH`); web post-deploy HTTPS `.well-known/executionkit-release.json` returning wrong `gitSha` triggered automatic rollback to `v2`. |
| **5** | **Corrupt artifact** | `409 CHECKSUM_MISMATCH` / `ARTIFACT_HASH_MISMATCH` | Tampered APK bytes rejected on upload (`409 CHECKSUM_MISMATCH`); injecting an unauthorized file (`injected-backdoor.php`) into a web artifact bundle rejected before activation (`ARTIFACT_HASH_MISMATCH`). |
| **6** | **Concurrent release conflicts** | `409 LEASE_FENCED` / Web `EEXIST` lock refusal | Stale worker (`fence_generation: 1`) rejected (`409 LEASE_FENCED`); concurrent web `deployProductionRelease` refused while `.deploy.lock` is held (`current` symlink remained intact on `v3`). |
| **7** | **Interrupted deployment** | `FAILED` (`rollbackStatus: ROLLED_BACK`, `677.26 ms`) | Post-activate smoke check failure (`exit 1`) automatically rolled `current` symlink back to `v3` and preserved healthy live state. |
| **8** | **Database migration failure** | `FAILED` (`rollbackStatus: NOT_NEEDED`, `477.78 ms`) | Invalid SQL migration (`INVALID SQL SYNTAX`) failed during pre-activate hook **before** symlink switch; `current` never pointed to the broken release and remained on `v3`. |
| **9** | **Failed rollback** | `FAILED` (re-activated `v3` in `444.78 ms`) | When rollback target `v2`'s smoke check failed, `rollbackProductionRelease` automatically re-activated `v3` (`rollback failure recovery: re-activated previous current release`), leaving production healthy. |
| **10** | **Service interruption** | `SIGKILL` $\rightarrow$ `200 recovered: true` (`232.22 ms`) | Killing Launch Service daemon with `SIGKILL` mid-lease preserved SQLite WAL integrity; on restart, `/v1/leases/recover` fenced generation `3` and re-leased job as generation `4`. |
| **11** | **Restore verification** | `BACKUP_CORRUPT_GZIP` / `BACKUP_CANDIDATE_MISMATCH` / `BACKUP_TOO_OLD` | Corrupt gzip bytes, mismatched candidate SHA, and stale backup timestamp (`>120 min`) were all rejected by `verifyProductionBackup` before deployment could proceed. |
| **12** | **Incomplete authorization & CWP drift** | `authorized=true` required / `VHOST_CWP_TEMPLATE_DRIFT` / `VHOST_DOCUMENT_ROOT_DRIFT` | `deployProductionRelease({ authorized: false })` refused (`Production deployment requires explicit authorization`); CWP selection pointing to `default` template or Apache `DocumentRoot` missing `/public` failed closed in `checkHostVhost`. |

---

## 6. Performance Observations (`VPS_HOST_AND_STAGING_VERIFIED`)

Receipt: `docs/v5/evidence/vps-staging-20261014/performance-telemetry.json`

### 6.1 CLI Response Durations on VPS1 (`Node v22.14.0`)
| Command | Duration (`ms`) | Exit Code |
| :--- | :--- | :--- |
| `node bin/executionkit-cli.mjs version` | `60.91 ms` | `0` |
| `node bin/executionkit-cli.mjs decision status . --json` | `64.42 ms` | `0` |
| `node bin/executionkit-cli.mjs launch status . --json` | `66.12 ms` | `0` |
| `node bin/executionkit-cli.mjs status . --host antigravity --json` | `287.75 ms` | `0` |
| `node bin/executionkit-cli.mjs next . --host antigravity --json` | `290.96 ms` | `0` |
| `node bin/executionkit-cli.mjs systems status . --json` | `296.46 ms` | `0` |
| `node bin/executionkit-cli.mjs start . --host antigravity --json` | `739.17 ms` | `0` |

### 6.2 Web Release Planning, Deployment, Rollback & Restore Durations
| Operation | Duration (`ms`) |
| :--- | :--- |
| `planHostVhost` (`launch host-plan`) | `2.12 ms` |
| `checkHostVhost` (`launch host-check` with `/usr/sbin/httpd -t` + `/usr/sbin/nginx -T`) | `462.71 ms` |
| `planProductionRelease` (`ALLOWLIST`, 12 runtime files) | `88.81 ms` |
| `buildProductionReleaseArtifact` | `129.09 ms` |
| `prepareProductionBackup` (`mysqldump` + `gzip`) | `175.12 ms` |
| Off-host MariaDB SQL restore (`gunzip` + `mysql` import + query verify) | `93.81 ms` |
| Full Laravel deployment (`v1` / `v2` / `v3`, including DB migration, symlink switch, queue/schedule hooks, HTTPS attestation, retention) | `2350.27 ms` – `2380.15 ms` |
| Atomic rollback (`v3` $\rightarrow$ `v2` + HTTPS attestation) | `693.26 ms` |
| Online SQLite backup (`backupDatabase` + 26-event hash-chain verify) | `16.10 ms` |
| Off-host SQLite daemon restore (`127.0.0.1:18089` startup + manifest verify) | `230.39 ms` |

### 6.3 Launch OS v2 API Latency & Resource Usage (`30` Sequential Samples)
| Endpoint / Metric | Min | p50 | p95 | Max | Avg / Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /healthz` | `1.12 ms` | `1.595 ms` | `3.379 ms` | `4.19 ms` | `1.884 ms` |
| `GET /readyz` | `1.39 ms` | `2.707 ms` | `5.043 ms` | `5.11 ms` | `2.761 ms` |
| `GET /v1/projects/:slug/releases/manifest` (Ed25519 signed) | `2.62 ms` | `4.343 ms` | `5.861 ms` | `16.18 ms` | `4.293 ms` |
| Launch Service Daemon RSS (Startup $\rightarrow$ Post-Load) | — | — | — | — | `67.67 MiB` $\rightarrow$ `68.85 MiB` |
| SQLite Database Size (`launch.db` + `launch.db-wal`) | — | — | — | — | `4,096 B` DB + `1,230,032 B` WAL |

---

## 7. External Blockers on VPS1 (`BLOCKED_EXTERNAL` — Owner Root Bootstrap)

No source defects remain in Launch OS v2 or Web Deployment. The only `BLOCKED_EXTERNAL` items on VPS1 are **privileged root/CWP host administration tasks** that were intentionally not executed without root access or owner authorization:

1. **Port `8088` Occupied by `wazzai.service` (`ai.elwazeery.com`):**
   - `127.0.0.1:8088` is actively bound by `/etc/systemd/system/wazzai.service`.
   - When the owner is ready to install the permanent Launch OS v2 systemd service on VPS1, bind it to **`127.0.0.1:8089`** (`LAUNCH_PORT=8089`).
2. **Shared CWP Root-Only Configuration Files (`EACCES` for non-root user `antigravity`):**
   - Running `/usr/sbin/httpd -t` against the **system-wide** `/usr/local/apache/conf/httpd.conf` as non-root `antigravity` (`uid=1021`) hits `Permission denied` on:
     - `/usr/local/apache/conf.d/autoconfig.conf` (`0600 root:root`)
     - `/usr/local/apache/conf.d/rpaf.conf` (`0640 root:root`)
   - Running `checkHostVhost` against the **system-wide** CWP selection database hits `Permission denied` on:
     - `/usr/local/cwpsrv/htdocs/resources/conf/web_servers/vhosts_conf.json` (parent `/usr/local/cwpsrv/htdocs/resources` is `0750 root:root`)
   - Running `/usr/sbin/nginx -T` against `/etc/nginx/nginx.conf` as non-root hits `Permission denied` on:
     - `/etc/nginx/conf.d/cloudflare.inc` and `/etc/nginx/conf.d/proxy.inc` (`0700 root:root`)
     - Linux `nginx -T` also calls `ngx_open_listening_sockets()` and attempts `bind(0.0.0.0:80)` / `bind(0.0.0.0:443)`, which fails with `EACCES (13: Permission denied)` unless invoked via a root `sudo` wrapper or `cap_net_bind_service`.
3. **One-Time Owner Root Bootstrap Commands on VPS1 (Optional — Only When Enabling Shared-CWP Live Deploys):**
   ```bash
   # 1. Grant read traversal to antigravity (uid 1021) for CWP vhost verification:
   sudo setfacl -m u:antigravity:r /usr/local/apache/conf.d/autoconfig.conf /usr/local/apache/conf.d/rpaf.conf
   sudo setfacl -m u:antigravity:r /etc/nginx/conf.d/cloudflare.inc /etc/nginx/conf.d/proxy.inc
   sudo setfacl -m u:antigravity:rx /usr/local/cwpsrv/htdocs/resources /usr/local/cwpsrv/htdocs/resources/conf /usr/local/cwpsrv/htdocs/resources/conf/web_servers
   sudo setfacl -m u:antigravity:r /usr/local/cwpsrv/htdocs/resources/conf/web_servers/vhosts_conf.json

   # 2. Allow passwordless read-only config syntax tests for httpd -t and nginx -T:
   echo 'antigravity ALL=(root) NOPASSWD: /usr/sbin/httpd -t, /usr/sbin/nginx -T' | sudo tee /etc/sudoers.d/executionkit-vhost-check
   sudo chmod 0440 /etc/sudoers.d/executionkit-vhost-check
   ```

---

## 8. Exact Remaining Windows Workstation & Physical Android Tasks (`PHYSICAL_PENDING`)

The owner can now resume directly on the physical Windows workstation (`DESKTOP-717CK7V`) **without repeating any VPS1 web, Launch Service, Studio API, CWP vhost, backup/restore, or security matrix tests**.

### Step 1 — Pull Canonical `main` on Windows Workstation (`DESKTOP-717CK7V`)
```powershell
git checkout main
git pull --ff-only origin main
node bin/validate-execution.mjs .
```

### Step 2 — Connect Physical Android Device & Verify ADB + Workstation Enrollment
1. Connect a physical Android device via USB (or wireless debugging) with **USB Debugging** and **Install via USB** enabled.
2. Verify device attachment and workstation policy:
   ```powershell
   adb devices -l
   python -c "import sys, json; sys.path.insert(0, 'lib/launch-service/scripts'); import host_policy; print(json.dumps(host_policy.require_workstation(), indent=2))"
   ```
   Confirm `adb devices` lists an `authorized` physical serial (`device`, not `emulator-*`) and `require_workstation()` returns `"status": "ALLOWED"`.

### Step 3 — Execute Physical Android Release Build, Inspection & Device Acceptance (`EK5-GEMITRON-LAUNCH-V2`)
1. On `DESKTOP-717CK7V`, build a release-signed APK/AAB (`versionCode N` baseline and `versionCode N+1` update) using the enrolled workstation's Android SDK/Gradle toolchain under Windows Job Object supervision (`lib/launch-service/scripts/supervisor.py`).
2. Run the workstation artifact inspector (`inspectWorkstationArtifact` / `POST /v1/jobs/:id/artifacts`) to verify APK v2/v3 signing certificate SHA-256 lineage, `applicationId`, `versionCode`, and manifest permissions.
3. Install `versionCode N` onto the connected physical Android device (`adb install`), launch the app, seed local user state, then apply the `versionCode N+1` update via `global_mobile_updater` / Launch OS v2 manifest (`adb install -r`), verifying:
   - App process restarts cleanly and renders home screen (`adb shell dumpsys window` / `uiautomator dump`);
   - Local SQLite/shared-preferences state persists across the upgrade;
   - Lower `versionCode` downgrade is refused;
   - Record receipt under `docs/v5/evidence/workstation-20261014/physical-android-acceptance.json`.

### Step 4 — Final Stable `v5.0.0` Promotion & Publication (`EK5-GEMITRON-PUBLISH`)
Once Step 3 is recorded:
1. Update `EK5-GEMITRON-LAUNCH-V2` and `EK5-GEMITRON-PUBLISH` in `TODO.md` to `VERIFIED`.
2. With explicit owner release authorization, promote `VERSION` and `package.json` from `5.0.0-dev` to `5.0.0`, run `npm run check` and `npm run v5:review`, tag `v5.0.0`, and push to `origin/main`.
