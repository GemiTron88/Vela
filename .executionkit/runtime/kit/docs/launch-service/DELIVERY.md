# Global Mobile Release implementation delivery — 2026-10-11

This is a source and isolated-test delivery. It is not production acceptance or a deployed VPS service.

## Publication

- Independent repository: Elwazeery/APKrelease, main. Source implementation commit: 29660c983ec896e6bf9318ca5b752a176633ed96. Follow-up evidence commit is shown by GitHub branch history.
- Pilot repository: Elwazeery/FLOW, codex/global-mobile-release-pilot, commit: 44d6e76949e158d189514ebc6226dbc6890afa17. Parent: 135c65b87e8b85fc3cabaf6d26f1a67c5706eafd. FLOW main and production remained unchanged by this implementation.
- SDK consumer pins the exact first platform source commit. Tests used identical source through a local dependency because Work cannot obtain private Git CLI credentials from the connector. Normal authorized host Git resolution remains untested.

## Delivered functionality

| Requested deliverable | Source and status |
|---|---|
| Global architecture and official feasibility | ARCHITECTURE.md, RESEARCH.md; independent service, multi-project contracts, explicit Shorebird cloud dependency |
| Self-hosted release control plane | lib/launch-service/src/server.mjs, service/store/contracts/migrations; IMPLEMENTED and real HTTP/SQLite tests |
| Flutter updater | packages/global_mobile_updater; headless controller, optional AR/EN themed UI, signed manifest validation, resumable verified native download, Shorebird adapter, quiescence guard |
| Secure APK distribution | Scoped artifacts, checksum/cert/package/ABI/version progression, expiring Ed25519 manifests, authenticated ranged download and project isolation |
| Shorebird provider integration | lib/launch-service/src/provider-cli.mjs and shorebird.mjs; official command adapters, baseline/diff authority, signing and billing review contracts, staging/promote/history/rollback receipts; real provider NOT TESTED |
| VPS provisioning and test runners | scripts/provision.py, diagnose.py, emulator.py and runner.py, deploy service/proxy templates; host diagnostic executed, actual emulator NOT TESTED |
| Multi-project configuration/reuse | config/flow.registry.json and sample.registry.json; independent synthetic sample has no FLOW dependencies and passes real Flutter tests |
| CI/CD and classification | Manual trusted self-hosted submission, exact-source jobs/receipts, conservative content/baseline classifier; failures block promotion |
| FLOW adapter | Opt-in SDK/policy provider/settings/mandatory notice, fail-closed production signing, oldest-first SMS acknowledgment, mutation guard; native activation held |
| Signing and migration | No APK keys created/rotated. Existing package preserved. Registered cert UNKNOWN until trusted read-only installed attestation. Incompatible certificate is a BLOCKER, never uninstall/clear data |
| Automated evidence | VERIFICATION.md and docs/evidence; authentic command output, synthetic provider/APK inspector fixtures explicitly labeled |
| Release/rollback operation | OPERATIONS.md and SECURITY.md; controlled provider rollback, native downgrade prohibited, append-only operations, backup/recovery |
| Future onboarding | ONBOARDING.md, reusable config/SDK/worker workflow; second independent sample validated at Dart level |
| Host execution prompt | ANTIGRAVITY_HANDOFF.md; remaining machine/provider/native work only, preserve concurrent FLOW tasks |

## Tests executed

- Node: 23 tests PASS, actual HTTP/SQLite/crypto/backup/parallel lease operations. APK inspector fixtures do not prove native binaries.
- Python: 2 execution fixtures PASS. A separate real sample verification worker executes Flutter analyze and 2 unit/widget tests in a disposable worktree, PASS.
- Global SDK: Flutter analyze PASS and 8 tests PASS, including actual pinned TLS interrupted download/resume and corrupt/signature cases.
- Independent sample: Flutter analyze PASS and 2 tests PASS.
- FLOW: final synchronized source full Flutter suite 1037 PASS; final adapter/API/SMS suite 19 PASS; analyze PASS. Earlier baseline 1035 PASS is kept as a separate receipt.
- Laravel isolated Testbench: release adapter 4 tests/15 assertions PASS; aggregate current harness 46/238 PASS (release 4/15, FleetBridge 12/73, ProjectReconciliation 30/150); separate reruns are not additional distinct coverage. Full host Laravel/MCP parity/ExecutionKit suites NOT TESTED here.

## Security findings repaired

FLOW production release could silently use debug signing; it now fails closed. SMS cursor advancement could lose/replay partial work; acknowledgment and oldest-first tuple checkpoints now preserve pending batches. Unknown project progress animated forever; static unknown track preserves business/engineering semantics. Financial fixtures now opt into treasury explicitly and never use production records. Test viewport DPR leakage is cleaned up.

Platform scope/auth validation is default deny. Artifacts are independently inspected in production, metadata is signed, downloads verified, source-bound runner receipts gate promotion, later failures invalidate old green gates, project credentials remain isolated and uncertain provider operations require readback before retry. Secrets stay outside Git. These controls do not substitute for native/plugin/device validation.

## Remaining acceptance and limits

BLOCKED: actual APK build (Gradle Java network denied in Work), Kotlin/PackageInstaller compile, installed FLOW production cert/version continuity, native package replacement/data preservation/SMS lifecycle, real Shorebird account/release/patch/restart/rollback, VPS deployment and resource/KVM benchmarking. Work has no /dev/kvm or Android device. No emulator screenshots or Visual OS V2 acceptance are claimed. Production signing identity, Google credentials, financial database and production deployment were not touched.

APPROVAL HOLD: first production APK/Stable publication, production deployment, key migration and account/billing changes. Both FLOW activation flags default off. No provider account overages enabled or paid purchase made. Use the handoff to prove staging first.

Queue worker executes verify/APK jobs. Provider patch operations use the explicit approved CLI path; they are not advertised as completed queued cloud jobs. Native rollback means a higher-version corrective APK, never a downgrade. Single-signer Android continuity is supported; certificate lineage/multi-signer migration and additional platform adapters need separate engineering acceptance. Optional administrative web UI is not implemented: operational management is via the API and CLI.
