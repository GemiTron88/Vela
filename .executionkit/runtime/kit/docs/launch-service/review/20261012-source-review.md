# Signed bridge source review — 2026-10-12

Reproduced a real recovery defect: after a cancelled job uploaded an artifact, a newly verified job uploading the same immutable bytes succeeded but release creation failed INSPECTION_RECEIPT_MISMATCH because the artifact kept the first job provenance. Release creation now selects an append-only signed inspection bound to the chosen quality receipt's current job/worker/fence/source. It rereads current runner HMAC trust and enrolled principal, preserves immutable byte metadata, rejects conflicting metadata and cannot bypass enrollment. The release projection carries its own inspection while the stored content address remains immutable.

69 full Node tests passed in the isolated source workspace. The newest server-safe suite passes 55 Node tests; Python guard and host-policy suites each pass four tests. Native artifacts in fixtures are synthetic: these are HTTP/SQLite/security/recovery policy checks, not native build or device evidence.

On the CWP VPS use `npm run test:control-plane` and `npm run test:python-control-plane`. Do not disable CWP/physical-host guards to make agent fixtures pass. `npm run test:agent-fixtures` and Python runner fixtures belong in the isolated development/workstation verification scope. A full suite with guard failures is PARTIAL, never aggregate PASS. Physical signed upload, device/signing/quotas/provider acceptance remains pending.

Canonical owner: ExecutionKit EK4-LAUNCH-PARITY-008 and SAFETY-006. Existing queue, updater, signing identity and production data are preserved. No SDK installation, build, emulator, deployment, signing-key change or OTA publication occurred in this review.
