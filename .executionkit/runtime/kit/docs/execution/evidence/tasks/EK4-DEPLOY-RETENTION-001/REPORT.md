# Production release retention — source implementation

Date: 2026-10-11. Canonical task: root TODO.md, EK4-DEPLOY-RETENTION-001.

The previous canonical deployment path staged/activated releases and wrote a success receipt but never pruned old releases. This affects projects using `local-release-root`; it does not imply every installed project has accumulated releases.

Implemented in Launch OS itself: enabled-by-default retention, current plus three rollback budget, ten-minute grace, successful release history in the production root, process-reference protection, explicit shared-state checks, unknown historical preservation, deployment/rollback serialization and immutable-release overwrite refusal. Cleanup runs only after smoke/health and a durable DEPLOYED receipt. Cleanup outcome is separate from application health and appears in status. Schema/templates/native model defaults and the upgrade invariant include the change.

Validation: `node --test tests/production-deployment.test.mjs` passed 31/31, zero failed or skipped, on Linux / Node 24.19.0. Tests execute real staged directories, atomic pointers, shared links, deletion and rollback. Container process visibility can conservatively skip cleanup; the destructive transaction is separately exercised with explicit completed-worker observation. Full `npm run check`, `npm run v4:check`, physical-host upgrade/doctor and VPS acceptance have not been observed. Source implementation is IMPLEMENTED, not release certification.

Rollout: update project-local Kit from official main through `executionkit self-update apply .`; run doctor and invariant revalidation using the returned commands. Do not copy edited managed runtime files manually. Existing project retention overrides remain intact; absent settings receive the default policy. A raw deployment command outside Launch OS does not acquire this behavior.

For FLOW, use its existing `npm run executionkit:release-deploy` after upgrade and canonical release gates. Verify the returned state contains retention status and the active/rollback release paths. Do not build Flutter on the VPS. No source preparation step here deployed or deleted FLOW production data.

Historical releases remain untracked/preserved for the operator's initial inventory and cleanup. Candidate directories retained by age, worker visibility, or unknown provenance are explicitly reported. Non-Linux targets conservatively preserve candidates until their worker inspection adapter exists. A crashed deployment leaves an exclusive lock; inspect its process ownership before operator removal.
