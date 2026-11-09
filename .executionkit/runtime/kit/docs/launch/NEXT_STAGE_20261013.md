# Launch OS — next real-host acceptance stage

Continue the existing consolidation; do not create a second release product, queue or dashboard. Read current canonical `main` and `TODO.md`, resolve an exact Kit SHA and checkpoint host findings there. Source preparation remains 4.1.0; this is not v5 publication.

## Verified source boundary

APKrelease capabilities are consolidated in `lib/launch-service/`, `packages/global_mobile_updater/` and canonical `executionkit launch` commands. Local provider/classifier resolution uses the Kit itself; legacy exact pins are compatibility only. Runtime economy/source quality changes were published at `48745c85cd83b39b7af94055ca33a1ea781d6ca2`. Full regression on recovery commit `cc92f974873e87a443cbd98b8a52e7092e7dcf5b` passed 1118/1122 with zero failures and four optional live skips. Its complete Git tree `008d3401baabdc9ffa60bcf4605d7f6b5e5ede4e` is byte-identical to published 48745c8; no physical acceptance is implied.

GitHub readback confirms the old `Elwazeery/APKrelease` repository still exists and is not archived. Retirement is not complete. The canonical tasks EK4-LAUNCH-CUTOVER-007, EK4-LAUNCH-PARITY-008 and EK4-LAUNCH-SAFETY-006 own remaining acceptance. The owner has authorized Kit source updates on main; repository deletion and production activation remain separate actions governed by their actual acceptance and owner authorization.

## VPS / web operator

1. Inspect actual service/user/path/vhost/config ownership and current database before changes. Use the consolidated Kit source and existing configuration; never clone APKrelease as a new required runtime. Use `executionkit launch service help` for the current typed interface. Never invent host paths, ports, principals, keys or database state.
2. Verify a restorable database/artifact/config backup before an approved service cutover. Check schema migration and immutable journal/leases, signed Test/Audit/Visual gates, workstation artifact inspection and scoped principals. Use isolated fixtures for negative API tests; do not mutate live queues through a test suite.
3. Verify Studio and FLOW use their project-local Kit runtime and the same canonical Launch API. Current FLOW is `app.elwazeery.com`; the legacy `flow.elwazeery.com` is not a deployment target. Preserve app identity, users/data, signing continuity and existing web production.
4. Check actual current-host doctor/control-plane/upgrade revalidation, API authentication, release create/approve/promote readback and idempotent timeout recovery. Record inaccessible permissions, missing credentials or unavailable hosts as BLOCKED.
5. VPS is web/API/control plane only: no Flutter dependency resolution/mobile tests, APK/AAB/Gradle/Shorebird compilation, SDK downloads or Android emulator. Dispatch native work only to an owner-enrolled physical workstation.

## Physical workstation / Android operator

1. Use a real owner-enrolled workstation and the existing bounded native agent. Verify actual Windows resource isolation/cancellation and crash recovery; source fixtures are not proof of physical Job Objects or quotas.
2. Build/inspect/upload the real signed artifact using the current accepted source and signed Launch gates. Verify inspection receipt/job/lease/fence/worker/commit/signing identity. Keep existing application identity, signing key and data.
3. Verify Android installation/update and the real provider/Shorebird path where credentials and entitlement exist. Read back installed version, signing identity, rollback/versionCode limitations and updater manifests. Do not claim unperformed device/provider tests as PASS.

## Retirement and next phase

Keep APKrelease temporarily until complete source parity, consumer cutover and necessary physical acceptance are verified. Check every active Git/SDK pin before removal. Owner instruction (2026-10-13): no legacy Git-repository backup is requested or required for deletion; never confuse that choice with required live release database/artifact recovery controls. Delete the GitHub repository only after independent operational-dependency checks and separate explicit owner approval.

The SaaS-first Studio organization/subscription model is owned by Studio. Launch keeps release authority; the planned EK5-SAAS-TENANT-LAUNCH-001 gate must prove tenant/project isolation before public SaaS activation. Do not replace it with a billing claim or weaken mandatory local policy.

Report only observed facts, exact SHAs, commands, evidence locations and remaining blockers. Update canonical tasks, not a shadow backlog. Publish v5 only through the existing publication gate after all required acceptance.
