# Operator runbook

## Authenticated API and CLI

`MOBILE_RELEASE_URL` is the approved HTTPS origin (or loopback for local operator testing); `MOBILE_RELEASE_TOKEN` is one project-scoped role token. Never print tokens. Writes need `Idempotency-Key` and strict JSON fields. The CLI derives a stable key from command/body, so retries return the existing result and conflicting content is rejected.

```sh
# Via ExecutionKit CLI or direct module runner:
node bin/launch-service.mjs status
node bin/launch-service.mjs start --config config/launch-service.json

# API interactions via lib/launch-service/src/cli.mjs:
node lib/launch-service/src/cli.mjs register lib/launch-service/config/flow.registry.json
node lib/launch-service/src/cli.mjs register lib/launch-service/config/sample.registry.json
node lib/launch-service/src/cli.mjs list
node lib/launch-service/src/cli.mjs jobs flow
node lib/launch-service/src/cli.mjs enqueue flow reviewed-job.json
node lib/launch-service/src/cli.mjs releases flow
node lib/launch-service/src/cli.mjs journal flow
node lib/launch-service/src/cli.mjs manifest flow staging
```

Example verify job: `{"commit":"EXACT_40_HEX_APPROVED_SOURCE","kind":"verify"}`. APK jobs add only `kind: apk`; approval/keystore values remain local worker config/environment, not API inputs. Patch enqueue returns an explicit policy error directing clients to the reviewed provider pipeline.

| Route under `/v1` | Permission | Input/result |
|---|---|---|
| POST `/projects` | registry for project ID | `config/*.registry.json` strict fields |
| GET `/projects` | read | Only permitted projects |
| POST `/projects/:id/signing/establish` | approve | Fresh signed installed-APK attestation; immutable cert pin; baseline versionCode |
| PUT `/projects/:id/artifacts/:sha256` | build | APK/AAB bytes with signed enrolled-workstation inspection; server verifies enrollment, lease/fence and recomputes SHA-256/size |
| GET `/projects/:id/artifacts/:sha256` | updates or public project | Resumable Range/ETag content |
| POST `/projects/:id/receipts` | build | Project/runner HMAC payload; real evidence checksums |
| POST `/projects/:id/releases` | release | artifact_sha256, commit, receipt_id, notes, minimum_supported_version_code, required |
| POST `/projects/:id/approvals` | independent approve | release_id, channel, SHA256 canonical release_digest |
| POST `/projects/:id/promotions` | release | release_id, channel, rollout_percent 1..100 |
| GET `/projects/:id/manifest/:channel` | updates or public project | Ed25519 envelope with 24-hour validity and generation |
| POST `/projects/:id/jobs` | build | exact commit, verify/apk |
| POST `/projects/:id/jobs/claim` | build | worker_id; actor-bound lease |
| POST `/projects/:id/jobs/:job_id` | build | worker_id, RUNNING/SUCCEEDED/FAILED; signed job-bound evidence required for success |
| GET `/projects/:id/jobs`, `/releases`, `/journal` | read | Durable records, provenance and activity |

## Dedicated build worker

Use one isolated worker process/account per project's signing and receipt credentials. Multiple projects share platform/tooling, not secrets. Set `MOBILE_RELEASE_RUNNER_ID=runner`, that project's `MOBILE_RELEASE_RUNNER_KEY`, and its builder token. Add local `signing_env` names to runner JSON, not to the registry API. FLOW accepts `FLOW_KEYSTORE_PATH`, `FLOW_KEYSTORE_PASSWORD`, `FLOW_KEY_ALIAS`, `FLOW_KEY_PASSWORD`; the sample accepts separate `ANDROID_*` signing names. Approved worktree source must preserve each app's existing signing identity.

```sh
node lib/launch-service/src/worker.mjs "$WORKER_CONFIG"
# Direct isolated verification, independent of the API:
CI=true python3 lib/launch-service/scripts/runner.py --project "$RUNNER_PROJECT" --repository "$LOCAL_REPOSITORY" --commit "$SOURCE_SHA" --evidence "$EVIDENCE_DIR" --work-root "$BUILD_WORK_ROOT"
```

A combined real Flutter test suite must contain unit and widget tests; runner executes it once and records both gates against the same log. Projects needing separate suite selection can extend runner configuration after preserving this truth condition. It never manufactures a widget PASS from `flutter analyze`. File/source evidence still needs operator review: receipts establish trusted runner provenance, not independently guaranteed truth from malicious build code.

For `--apk`, supply `--signing-approval` with a short-lived HMAC payload `{project, action: apk.build, commit, expires_at}` signed using `lib/launch-service/src/approval-cli.mjs`. Retain protected raw receipts, publish only sanitized evidence. Use reviewed `lib/launch-service/deploy/mobile-builder@.service` per-project instances with private environment files and actual SDK/Java PATH. Prewarm trusted SDK caches or provide approved writable cache paths; do not make trusted toolchain executables writable by repository build code. Host-wide build concurrency defaults to one; use memory/CPU limits for workers and benchmark before increasing. Never combine signing workers with GitHub pull-request execution or production Laravel privileges.

## Shorebird

Initialize using installed official `shorebird init` after inspecting `shorebird --version`, `doctor`, command help and available Flutter pins. Record actual app ID in local project config and `shorebird.yaml`; set `auto_update: false`. Never invent a cloud app ID. Embed reviewed patch public key in the first actual Shorebird APK; baseline and future patches use matching private key. Cloud commands need `SHOREBIRD_TOKEN` and operator-reviewed billing/overage controls.

```sh
node lib/launch-service/src/baseline-cli.mjs "$CLEAN_FLUTTER_WORKSPACE" "$PROVIDER_PROJECT" "$BASELINE_JSON"
node lib/launch-service/src/classify-cli.mjs "$LOCAL_REPOSITORY" "$FLUTTER_PATH" "$BASE_SHA" "$TARGET_SHA" "$BASELINE_JSON" "$TARGET_JSON" "$CLASSIFICATION_JSON"
node lib/launch-service/src/approval-cli.mjs "$REVIEWED_APPROVAL_PAYLOAD" "$SIGNED_APPROVAL"
node lib/launch-service/src/provider-cli.mjs patch "$PROVIDER_PROJECT" "$PATCH_INPUT"
node lib/launch-service/src/provider-cli.mjs history "$PROVIDER_PROJECT" "$HISTORY_INPUT"
node lib/launch-service/src/provider-cli.mjs usage "$PROVIDER_PROJECT" "$USAGE_INPUT"
```

Provider config extends the registry with `shorebird_app_id`, `shorebird_public_key_sha256`, local `signing_env`. Patch input: commit, base_commit, release_version `X.Y.Z+N`, workspace (clean Flutter app directory), public_key_path, private_key_path, classification_path, quality_path, approval_path, evidence_dir, persistent operation_state_dir. Patch approval action is `patch.staging`, same project/source/base/version, billing_reviewed true, automatic_overages_allowed false, account_evidence_sha256. Actual dry-run precedes staging publication. Never add native/asset override flags.

Base release uses action `release`, approved `shorebird.release` scope with exact commit/version, billing review and a fresh signed five-gate APK receipt. Promotion/rollback use patch_number and exact release; promotion also track and a signed expiring device-validation receipt under `MOBILE_RELEASE_DEVICE_EVIDENCE_KEY` with action `patch.device-validation`, status PASS, gate `restart_applies_patch`. These receipts must follow real isolated device tests. Signed approval and quality key names are documented in source. Patch publication can use protected local staging policy to mint approved exact-source approvals; Stable always requires its configured operator approval and device evidence.

Persistent provider operation markers prevent blind replay after crashes/timeouts. On unknown outcome, read official patch/release history first. Never delete an uncertain marker and retry without proving the previous operation did not publish. Provider command evidence is observed, not device acceptance. With a project runner key, the CLI writes `provider-receipt.json`; import or retry that receipt (never reexecute publication) via `node lib/launch-service/src/cli.mjs provider PROJECT provider-receipt.json`. The central journal preserves these scoped signed observations idempotently.

## Backup, rollback and retention

```sh
node lib/launch-service/src/backup-cli.mjs "$LIVE_SQLITE_FILE" "$NEW_BACKUP_FILE"
```

Copy immutable artifact directories, public/private trust keys and role config separately with restricted access. Restore into an isolated directory, verify journal hashes, registry and manifests before switching a service. New backups must never overwrite existing backups. Expired upload partials older than 24 hours are cleaned at startup; published artifacts are not deleted automatically. Storage exhaustion blocks uploads. Set reviewed retention and archive historical APKs outside the serving volume before exhausting it.

APK downgrade rollback is forbidden. Publish a corrective higher versionCode with the same certificate and revalidate app data. Patch rollback uses official Shorebird rollback followed by supported lifecycle/readback/device verification; it does not downgrade native versionCode or guarantee instant activation. Withdraw optional native availability through a reviewed corrected manifest policy only; mandatory policy requires an operator-reviewed corrective release.
