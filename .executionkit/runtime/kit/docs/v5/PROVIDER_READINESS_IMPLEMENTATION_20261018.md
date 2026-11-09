# External provider readiness implementation — 2026-10-18

Starting canonical source: `fcc7caf05f996d3f04f95a636817b47dd09cfb24` (v5.0.1). Owner authorized this source change; no production deployment, native build, application distribution or provider activation was performed.

Implemented the reusable `executionkit-providers/v1` inventory, bounded secret-excluding discovery/cache, independent Ed25519 verifier/owner/vendor envelopes, exact source/inventory/commit/candidate/artifact/environment/target binding and 24-hour validity. Unknown fields and secret-bearing probe payloads are rejected. Actual observed driver must match the reviewed selected driver. Complete coverage, including truly empty inventories, requires a host-trusted independent reviewer; a null discovery digest remains an explicit blocked draft.

Decision OS derives compiled provider signals at deploy/approval/publication instead of trusting project-supplied zeros. Launch final gates and preactivation require operational readiness. An independent activation recheck rejects stale markers. Existing healthy deployment status stays separate from operational readiness; no automatic rollback is introduced. Lifecycle cannot finish as operational while providers fail. Signed mobile gates now include mandatory provider evidence; service release/approval/promotion reject old missing-provider proofs. Existing signed exact-candidate, workstation and artifact inspection policies remain.

Owner deferrals require nonempty dependencies, intended disabled state, independently verified restrictions and the latest signed owner decision. Release-wide mandatory services cannot be deferred. Optional unused services need no activation. Sandbox proofs cannot enable production features. Newer rejection supersedes older approval; conflicting same-time verifier observations fail closed. Inventory completeness and actual account/delivery remain independent observations, not AI self-certification.

Canonical KB revision 4 was validated and published atomically with expected-head protection: `GemiTron88/KB@af293e153548b3fc1d390ca917a391755c277c0b`, 164 reviewed facts, 15 REVIEW-only rules. Exact catalog and manifest bytes are bundled in this source change. Seven domains, schema v2, compiled hard denials, Launch authority and existing scheduled refresh protocol remain unchanged.

## Executed validation

`node tools/prepare-release.mjs` and `npm test` in KB: PASS, revision 4, 164 facts / 15 rules, 65,916 catalog bytes. SHA-256 recorded by canonical manifest; exact bundled-byte comparison is required before publication.

`npm test -- --target tests/provider-readiness.test.mjs --target tests/v4-release-gates.test.mjs --target tests/v5-decision-os.test.mjs --target tests/launch-service/control-plane.test.mjs --target tests/launch-mobile.test.mjs --target tests/production-deployment.test.mjs --target tests/launch-service/consolidation-integrity.test.mjs --target tests/launch-service/workstation-inspection.test.mjs --target tests/v4-release-publication.test.mjs`: **188/188 PASS**, 9 files, 18.998 seconds; 47 dedicated new provider tests. These execute real deterministic policy/signature/filesystem/HTTP-service fixture checks; synthetic test provider observations are not real provider/device acceptance. The full regression suite was not run or claimed.

Independent read-only review caught and resolved target/artifact context drift, empty-feature deferrals, sandbox promotion, unsupported-source blind spots, metadata false positives, native candidate mismatch and obsolete approval reuse. Additional tests cover each repaired boundary. Broader validation also exposed a pre-existing missing v5 CLI reference; the v5 project template now documents the canonical registry, mobile and provider commands. KB cache tests use relative revisions so canonical knowledge maintenance cannot invalidate their fixtures.

Initial failures during materialization involved missing source fixture files; complete Kit text sources were restored before final affected regression. Two final protection-order failures were corrected by checking vhost readiness before provider readiness, with both checks still before hooks or activation. No failed run was called PASS.

## Adoption and limitations

This is a canonical source implementation, not an automatic upgrade or release of all installed consumers. The Launch invariant revision changes (7 → 8), requiring scoped historical revalidation on upgrade. No production host enforcement is claimed until its project-local runtime is upgraded and verified. Existing consumers must regenerate signed native Launch gates with the provider field. No application secret, external account credential, delivery callback, payment, ERP mutation or native physical-device acceptance was verified here.

Entlaqa source pilot registers 15 dependencies and a compatibility preactivation bridge to the generic project-local Launch gate. Its current-source provider inventory deliberately has a null discovery digest rather than falsely certifying a partial source checkout. Actual credentials, effective DB overrides, delivery and external approval remain separately blocked; the website must not be labeled FULLY_OPERATIONAL on this evidence.
