# Launch OS: mobile compatibility adapter

Task: EK4-LAUNCH-MOBILE-001. This adapter reuses APKrelease's existing queue, leases, idempotency, artifact storage and approval boundaries. It does not create a second database or build service. No VPS Android builds, production publication or APKrelease retirement occurs.

Track the following reviewed launch.mobile.json in each mobile consumer repository:

~~~json
{"schemaVersion":"executionkit-launch-mobile/v1","projectId":"flow","repository":"Elwazeery/FLOW","serviceOrigin":"https://release.example.org"}
~~~

Use your genuine HTTPS origin instead of the example. Independently pin EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN to that exact URL on the operator host. Supply EXECUTIONKIT_LAUNCH_MOBILE_TOKEN from a secret manager, scoped to the one APKrelease project with build/read permission. The host pin protects secrets from a malicious repository-controlled origin.

~~~sh
executionkit launch mobile . --mode plan --kind verify
executionkit launch mobile . --mode status
executionkit launch mobile . --mode submit --kind apk --expected-commit <40-char-sha> --authorize
~~~

Plan is offline. Status reads the existing jobs API. Submit requires explicit authorization, exact clean checked-out commit, matching GitHub origin, verified service capabilities and deterministic idempotency. Only verify/apk enqueue is allowed; signing, Shorebird patches, promotions and rollback remain independently gated.

Verification: node --test tests/launch-mobile.test.mjs then full exact-head v4 checks. Tests are source-level/contract fixtures, not workstation/device certification. Real machine enrollment, agent outbound polling, Windows/Linux resource controls, signed builds and production migration remain separate canonical tasks.

## Unified release routing (2026-10-12 correction)

Typed jobs now include `aab` alongside `verify`, `apk` and private `debug_apk`. Use `--mode release|approve|publish` with explicit `--authorize` to route to the retained canonical API. These operations require the actual exact-source Test/Audit/Visual/reconciliation release gates via `validateV4ReleaseGates`; approval/publication also binds the selected server release to the clean local HEAD. Native rollback requires a corrective higher versionCode; `--mode rollback` never silently downgrades Android.

`--mode provider|classify` reuses a clean, exact pinned APKrelease checkout (`--adapter-root`, `--adapter-sha`) and the reviewed project/input files (`--project-file`, `--input-file`). It verifies project identity against the registry. Typed provider actions are patch/release/promote/rollback/history/usage. Mutations require `--authorize`, canonical release gates and the protected existing approvals/billing/readback workflow. Resource-intensive provider operations additionally use the host build lock and kernel supervisor; CWP hosts are refused. Input includes explicit workstation `work_root`, `resource_limits` and protected `evidence_dir`. Classifier input declares repository/base_commit/commit/baseline_path/target_snapshot_path/output_path. A Dart-only result is a candidate only.

AAB artifacts are signature/package/version/checksum inspected and stored privately; they cannot enter the APK updater/PackageInstaller track. Actual AAB/native/provider acceptance remains a workstation/device/account gate.

## Signed canonical publication gate (2026-10-12)

APKrelease schema v4 requires an Ed25519-signed Launch attestation for release creation, approval and promotion. There is no compatibility bypass. Native runner HMAC quality receipts remain separately mandatory; neither key substitutes for the other. Configure only the public key in APKrelease `launchGatePublicKeys[projectId][keyId]`. Keep the independent private key exclusively in Launch's protected environment as `EXECUTIONKIT_LAUNCH_ATTESTATION_PRIVATE_KEY`, with `EXECUTIONKIT_LAUNCH_ATTESTATION_KEY_ID`. Do not reuse the Android signing key or API manifest key. Never commit private keys. Native/provider children do not inherit the Launch private key or scoped API token.

`executionkit launch mobile . --mode attest --artifact <sha256> --expected-commit <full-sha> --authorize` records current candidate-bound Test/Audit/Visual evidence. The release mode also records it before creation. Visual REVIEW_REQUIRED cannot produce a mobile attestation. Proofs expire after 24 hours; all publication paths reread the latest signed evidence and active public-key trust. Revoke a Launch key by removing it from the active protected service configuration. An older proof replay cannot reorder newer evidence.

Deploy the service and Kit source together, back up SQLite before schema v4 startup, and run actual host doctor/revalidation. Existing unsigned releases are retained but cannot be newly approved/promoted until valid exact-source attestation exists. This is intentional fail-closed migration, not production acceptance.
