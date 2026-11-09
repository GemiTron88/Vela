# ExecutionKit v5 preparation — 2026-10-13

This is source preparation, not a v5 release or production acceptance. Canonical work remains in TODO.md. Historical checkpoint below used runtime/package 4.1.0. Current source is 5.0.0-dev (not stable publication); STANDARD_V5.md and the continuation review supersede its Decision integration frontier.

## Completed main consolidation

All 49 development/history branches were deleted through the owner-authorized GitHub UI after exact tips were compared with the retained inventory. Every original tip is retained by main's history consolidation. A fresh GitHub API read reports one branch, main at a45a420ad70f6dd715f1c37c9757ff9c3f269023, and zero open PRs. Screenshot: [main only](../audits/2026-10-13-main-only.jpg). The original 2026-10-12 receipts remain historical and unchanged.

## Local provider/classifier correction

The canonical mobile CLI can now resolve the consolidated service under lib/launch-service in a clean exact-source Kit checkout. Installed consumers use the immutable project-local upstream source referenced by .executionkit/installation.json, without requiring an external APKrelease checkout. For explicitly supplied --adapter-root and --adapter-sha, both are mandatory; the Git root, official repository identity, exact HEAD, clean tracked/untracked state and real nonsymlink entrypoints are validated. Legacy APKrelease exact pins remain compatible.

Examples:

```bash
# Installed consumer: resolve the source pin from its installation receipt.
executionkit launch mobile . --mode classify --project-file /private/project.json --input-file /private/classify.json

# Explicit consolidated Kit source pin, for standalone/recovery use.
executionkit launch mobile . --mode classify --adapter-root /trusted/AI-ExcutionKit --adapter-sha <exact-kit-sha> --project-file /private/project.json --input-file /private/classify.json
```

The project service origin and scoped token remain required. Provider mode now checks the upstream registry's repository identity before running any child. Heavy actions still fail closed on a VPS/virtual/container/unenrolled host, require explicit authorization and canonical Test/Audit/Visual evidence, and execute the existing typed Python runner under workstation locks/quotas. This correction does not authorize Android/Flutter/SDK downloads or builds on a server.

Focused evidence: 22/22 mobile adapter tests passed, including real local Git diff classification executed through the consolidated classifier, legacy compatibility, automatic project-local source resolution, wrong/dirty/partial/symlink/missing adapters and upstream registry mismatch. No real APK or Shorebird publication was executed.

## DecisionOS source contract correction

The current DecisionOS README was read directly from GemiTron88/DecisionOS: all model code/dependencies/configuration are removed and its standalone VPS2 service is decommissioned. That earlier checkpoint had only an optional adapter plan. The current v5 work embeds Decision OS as mandatory system 11; no daemon/model integration is reintroduced. See STANDARD_V5.md and the current continuation report.

## Release readiness frontier

| Gate | Current status | Required evidence |
|---|---|---|
| Main/PR consolidation | VERIFIED | one branch, zero open PRs, retained original histories |
| Ten systems and CLI source stability | SOURCE-TESTED | current exact-source full check and v4 check; negative regressions |
| Consolidated provider/classifier | SOURCE-TESTED | focused real classification and pin/registry negative checks; full source gates passed (expanded check stages + v4 check) |
| Optional deterministic DecisionOS adapter | PLANNED | local schema/privacy/outage/latency and hard-policy independence |
| Representative Laravel/Flutter upgrade and rollback | BLOCKED/NOT_VERIFIED | actual consumer receipts, not distribution fixtures |
| Physical workstation/Android/signing/provider acceptance | BLOCKED/NOT_VERIFIED | real quotas, identity/data retention, device evidence and approved provider readback |
| Signed v5 publication | BLOCKED | required gates, exact candidate, owner release approval |

Existing Launch parity/cutover and physical acceptance tasks stay open. Fixing source adapter resolution does not mean live end-to-end provider or consumer migration is accepted. No extra OS, mandatory daemon, new task database or second release writer is introduced.

## Final source verification

Tested commit: `429278a4fe602bd07748a90065571ff5c0e27f26`, tree `7367aad87b1b85f69ef9f661b45fb8a2838630fc`. Full runtime suite: 1102 total / 1098 pass / 0 fail / 4 explicit live skips. Targeted v4: 369/369, packaged smoke: 1/1, mobile adapter focused: 22/22. Every check stage was executed separately and passed after the initial aggregate stdout was incomplete; that incomplete attempt is preserved and not used as a PASS. `npm run v4:check` completed with all three expected summaries. [Machine receipt](evidence/20261013/summary.json), [original logs](evidence/20261013/logs.tar.gz). Metadata/evidence-only follow-up commits do not claim new exact-HEAD physical certification.

Six historical phase convergence warnings remain in the compatibility source ledger; EK5-PREP-CANONICAL-GATES owns their independent reconciliation before v5 publication. Historical task acceptance is preserved; warnings are not silently waived.
