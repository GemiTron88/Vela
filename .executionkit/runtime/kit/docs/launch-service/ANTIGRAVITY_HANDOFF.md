# Current Launch mobile continuation — 2026-10-12

This is the active APKrelease handoff. It supersedes earlier VPS/KVM build research instructions and `ANTIGRAVITY_CONTINUE_NATIVE.md`. Work from live main in APKrelease, ExecutionKit, Studio and FLOW. Root TODO files and existing canonical tasks own status; chat/reports do not.

## Non-negotiable host boundary

The owner strictly prohibits APK/AAB/debug APK compilation, Gradle/Flutter mobile workloads, Android SDK/build-tools/system-image installation/downloads, emulator installation/execution and Shorebird compilation on EVERY VPS/server. No exception for KVM, free memory, another VPS, an isolated account/VM, missing tools, test needs or an Antigravity decision. Do not provision mobile libraries to unblock the server. If a physical workstation is unavailable, leave the job queued/BLOCKED.

VPS: web/API deployment, approved queue/lease service, read-only monitor and typed job submission only. Native work: an owner-enrolled, detected physical Windows/Linux/macOS workstation. `host_policy.py` plus native entrypoints reject virtual/cloud/container/CWP hosts and missing/mismatched local owner enrollment before downloads/builds. `/etc/gemitron-mobile-disabled` is an additional deny marker, never an allow marker. Source guards do not prove live OS enforcement; inspect actual service state and permissions without launching mobile tools.

## Continue source and installed runtime safely

1. Resolve exact main SHAs. Preserve unrelated work, main-only/expected-head writes, no force push. Use canonical existing task owner: EK4-LAUNCH-REVALIDATE-005, SAFETY-006, CUTOVER-007, PARITY-008; FLOW-MOBILE-001/003; Studio GT-P07-LAUNCH-VIEW.
2. Update installed Kit only through its official self-update check/apply and doctor/start flow. Review/commit managed changes; never hand-edit installed runtime or installation receipts. A Studio source target pin is not installed acceptance.
3. Verify server service/queue/registry/auth/storage with lightweight applicable tests. Do not resolve Flutter dependencies or execute mobile quality workloads on production VPS.
4. On the physical workstation only, run `python scripts/host_policy.py inspect`; have the owner create matching private local schema-1 physical-workstation enrollment at the reported path. Enrollment never overrides a denied host. Establish actual kernel CPU/memory/process controls and bounded Gradle/scratch/cache budgets. Windows Job Objects and physical cgroup readback remain unaccepted until real receipts exist.
5. Install/enroll distinct project-scoped worker identities/receipt keys through trusted configuration and registry authority. Studio's separate registry token can enroll/revoke existing principals; it cannot mint secrets, start a workstation or grant release/signing authority. Keep credentials off Git/HTML/logs.
6. FLOW has an exact project/repository profile with independently host-pinned HTTPS origin and manual self-hosted typed submission. Run source tests/dependency resolution and actual Kotlin/Gradle/device checks on the physical workstation. Preserve com.elwazeery.flow, signing identity, version ordering, installed data and SMS lineage. Keep activation flags disabled until native/device acceptance.
7. Native jobs remain fixed typed verify/debug_apk/apk/aab. AAB upload/storage is private and cannot become a PackageInstaller APK release. Native build/signature/AAB metadata verification needs actual approved tools; source contract tests never substitute for it.
8. Release/approve/publish and provider mutations enter through Launch with exact-candidate Test/Audit/Visual/reconciliation evidence, scoped authority and independent approvals. Shorebird uses a pinned trusted APKrelease checkout, physical host and native resource supervision. Unknown provider result requires official history readback before retry. Billing/account/signing credentials and first production publication remain separately authorized.

## Actual acceptance still required

Physical Windows/cgroup controls; native Kotlin/APK/AAB compile/signature; installed certificate continuity; Android user confirmation, package replacement, preserved data/SMS interrupted recovery; real Shorebird account/billing/base/staging patch/restart/rollback; official Studio/FLOW Kit installed update and gates; actual CWP vhost/worker inspection and safe cleanup. Do not guess domains/paths/users, publish production, rotate keys, uninstall the existing FLOW app or mutate production finance/data.

Record real SHA-bound logs/statuses in each repo. Evidence classifications: source IMPLEMENTED/TESTED versus host/device/provider BLOCKED/NOT_TESTED. The old VPS sample debug-build logs are retained history, not current permission. Current source correction evidence: `docs/evidence/launch-correction-20261012/`.
