# ExecutionKit Launch OS — Physical Workstation Handoff Runbook
**Date:** October 12, 2026  
**Status:** READY FOR WORKSTATION EXECUTION  
**Canonical Repository:** `Elwazeery/AI-ExcutionKit`  
**Target Projects:** `studio-pilot`, `FLOW` (future)  

---

## 1. Executive Summary & Production Status

All release platform capabilities from `Elwazeery/APKrelease` have been consolidated into **ExecutionKit Launch OS** (`Elwazeery/AI-ExcutionKit`).

### VPS Service Status (Live)
- **Service Name:** `launch-service.service` (Systemd User Unit)
- **Local Endpoint:** `http://127.0.0.1:8088`
- **Public Domain:** `https://release.elwazeery.com` (Cloudflare Edge SSL + Nginx reverse proxy)
- **Database:** `/home/antigravity/projects/launch-unification/launch-data/release.db` (Schema Version: **6**)
- **Storage Directory:** `/home/antigravity/projects/launch-unification/launch-data` (mode `0700`)
- **Studio Dashboard:** `https://studio.elwazeery.com/mobile/releases` (FrankenPHP port 8000)

### Absolute VPS Boundaries (Non-Negotiable)
- **Web / API / Queue / Monitoring Only:** The VPS handles the HTTP API, release registry, job leasing/fencing, and audit ledger.
- **STRICTLY FORBIDDEN ON VPS:** Never compile APKs/AABs, run `./gradlew`, execute `flutter build`, launch Android emulators, or download Android SDKs on the VPS.
- **APKrelease Repository Preservation:** The GitHub repository `Elwazeery/APKrelease` **must not be deleted** until physical workstation execution and physical Android device acceptance test succeed end-to-end.

---

## 2. Security & Least-Privilege Role Separation

Authentication is strictly enforced via SHA-256 token hashing and project-scoped principal grants:

| Role Principal | Allowed Permissions | Canonical Scope | Upstream Action |
|:---|:---|:---|:---|
| **Reader** | `read` | `studio-pilot` | Status, queue inspection, artifact downloads |
| **Registry** | `read`, `registry` | `studio-pilot` | Project registration, agent enrollment, revocation |
| **Operator** | `read`, `cancel`, `build`, `agents.control` | `studio-pilot` | Job enqueuing, cancellation, pause/drain directives |
| **Publisher** | `read`, `release` | `studio-pilot` | Release candidate creation, channel promotions |
| **Approver** | `read`, `approve` | `studio-pilot` | Independent promotion approval (cannot publish) |
| **Builder / Runner** | `read`, `build` | Project-scoped | Job lease claim, heartbeat, signed execution receipt |

> [!NOTE]
> All credentials on the VPS were rotated atomically with SHA-256 hashes registered in `config/launch-service.json`. Actual tokens and signing keys are stored exclusively in private configuration (`chmod 0600`) and must **never** be checked into Git or printed in logs.

---

## 3. Revocation & Credential Rotation Invariant

When an agent is revoked by the Registry:
1. All running leases for that worker are cancelled immediately with fence generation advanced.
2. The agent is marked `REVOKED` in `agent_enrollments`.
3. The previous `principal_id` and HMAC receipt signing key hash (`runner_key_sha256`) are permanently recorded in `agent_revocations`.
4. **Re-enrollment requirement:** Any re-enrollment attempt reusing the previous principal or the previous receipt signing key is rejected fail-closed with `HTTP 409 AGENT_CREDENTIAL_ROTATION_REQUIRED` or `AGENT_RUNNER_KEY_ROTATION_REQUIRED`. Both credentials must be rotated.

---

## 4. Physical Workstation Step-by-Step Runbook

Follow these steps on your local physical workstation (Linux, macOS, or Windows):

### Step 1: Clone Canonical ExecutionKit
```bash
git clone https://github.com/Elwazeery/AI-ExcutionKit.git
cd AI-ExcutionKit
npm install
```

### Step 2: Verify Workstation Host Policy & Toolchains
Ensure your workstation has Flutter 3.29+, Java 17+, and Android SDK command-line tools installed.
Verify using the Python policy test suite:
```bash
python3 -m unittest tests/launch-service/host_policy_test.py -v
python3 -m unittest tests/launch-service/guard_test.py -v
```

### Step 3: Generate Agent Keys & Configuration
On the workstation, generate your Ed25519 signing keypair for workstation inspections:
```bash
mkdir -p config keys
# Generate Ed25519 private key
openssl genpkey -algorithm Ed25519 -out keys/workstation-inspection.key
openssl pkey -in keys/workstation-inspection.key -pubout -out keys/workstation-inspection.pub
```

Create `config/runner.json` (set permissions `chmod 0600 config/runner.json`):
```json
{
  "serverUrl": "https://release.elwazeery.com",
  "project": "studio-pilot",
  "workerId": "workstation-pc-01",
  "principalToken": "<BUILDER_BEARER_TOKEN>",
  "runnerSecret": "<32_BYTE_HMAC_RECEIPT_SECRET>",
  "inspectionKeyPath": "keys/workstation-inspection.key",
  "inspectionKeyId": "workstation-v1",
  "platform": "windows",
  "capabilities": ["verify", "apk", "aab"]
}
```

### Step 4: Enroll Workstation Agent via Studio UI or CLI
Using the Studio UI at `https://studio.elwazeery.com/mobile/releases`:
1. Navigate to **Agent Registry**.
2. Click **Enroll Agent**.
3. Enter:
   - **Worker ID:** `workstation-pc-01`
   - **Principal ID:** `pilot-builder`
   - **Platform:** `windows` (or `linux` / `macos`)
   - **Capabilities:** `verify`, `apk`
4. Confirm enrollment.

Or enroll via CLI:
```bash
curl -X POST https://release.elwazeery.com/v1/projects/studio-pilot/agents/enroll \
  -H "Authorization: Bearer <REGISTRY_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "worker_id": "workstation-pc-01",
    "principal_id": "pilot-builder",
    "platform": "windows",
    "capabilities": ["verify", "apk"]
  }'
```

### Step 5: Run Agent Doctor Diagnostic
On your workstation:
```bash
node bin/agent-doctor.mjs --config config/runner.json
```
Verify that:
- Server `/readyz` responds with schema `6`.
- Builder bearer token is authenticated for `studio-pilot`.
- Local Flutter toolchain is detected and valid.
- Process sandboxing (Windows Job Object on Windows, systemd scope on Linux) is available.

### Step 6: Execute One Real "verify" Job
1. Enqueue a job via Studio Dashboard or CLI:
   ```bash
   curl -X POST https://release.elwazeery.com/v1/projects/studio-pilot/jobs \
     -H "Authorization: Bearer <OPERATOR_TOKEN>" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d '{
       "commit": "<GIT_COMMIT_40_HEX>",
       "kind": "verify"
     }'
   ```
2. Start the workstation agent runner:
   ```bash
   node bin/executionkit-agent.mjs once --config config/runner.json
   ```
3. The runner claims the job, checks lease fencing, executes `flutter analyze` and `flutter test`, computes proof hashes, signs the HMAC execution receipt, and submits completion to Launch OS.
4. Verify the job transitions to `SUCCEEDED` on Studio (`https://studio.elwazeery.com/mobile/releases`).

### Step 7: Build & Inspect APK on Workstation
1. Build the APK locally on your physical machine:
   ```bash
   flutter build apk --release
   ```
2. Run local workstation inspection:
   ```bash
   node bin/workstation-inspector.mjs \
     --apk build/app/outputs/flutter-apk/app-release.apk \
     --key keys/workstation-inspection.key \
     --key-id workstation-v1 \
     --job-id <JOB_ID> \
     --out inspection.json
   ```
3. Upload the APK and signed inspection to Launch OS:
   ```bash
   node bin/upload-artifact.mjs \
     --apk build/app/outputs/flutter-apk/app-release.apk \
     --inspection inspection.json \
     --server https://release.elwazeery.com \
     --token <BUILDER_TOKEN>
   ```
4. Launch OS verifies:
   - Server re-hashes APK bytes and validates exact match against signed inspection.
   - APK size and checksum match.
   - Appends entry into immutable `artifact_inspections` ledger.

### Step 8: Release Creation, Approval, and Track Promotion
1. **Publisher creates candidate:**
   Via Studio UI or API, Publisher registers the release candidate linked to the verified inspection.
2. **Approver signs off:**
   Independent Approver reviews test gates and promotes the release to `beta` or `stable`.
3. Launch OS signs the release manifest with Ed25519 (`manifest-v1`).

### Step 9: Physical Android Device Acceptance
1. Download the released APK onto the connected physical Android device.
2. Verify package replacement / in-place upgrade without data loss.
3. Verify GemiKit updater SDK checks `https://release.elwazeery.com/v1/projects/studio-pilot/releases/latest` and detects updates.

---

## 5. Deletion Checklist for `Elwazeery/APKrelease`

Only execute after Step 9 succeeds:
- [ ] Workstation host policy verified (`host_policy_test.py` 100% pass)
- [ ] Agent enrolled and active on `https://release.elwazeery.com`
- [ ] Real verify job completed with verified HMAC receipt
- [ ] Real APK inspected on workstation and uploaded to Launch OS
- [ ] Release candidate approved and manifest signed
- [ ] Physical device installation and in-place upgrade verified
- [ ] Final confirmation from repository owner
- [ ] Archive/Delete `Elwazeery/APKrelease` on GitHub
