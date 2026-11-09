# Traceability and Evidence

**Status:** CANONICAL guidance derived from `STANDARD.md`.

## Objective

Make execution resumable and auditable without requiring a giant manually maintained matrix.

Desired chain:

```text
Requirement -> canonical TODO task -> implementation revision/files -> checks -> evidence -> independent ACCEPTED decision -> release gate
```

Not every trivial line of code needs a requirement ID. Traceability depth scales with risk.

## Identity namespaces

Recommended namespaces:

- `REQ-*` product/technical requirement;
- `EX-*` executable task;
- `TST-*` named test requirement/contract;
- `AUD-*` audit finding;
- `CNT-*` content requirement/finding;
- `REL-*` release/launch gate;
- `DEC-*` decision/ADR reference;
- `INC-*` production incident.

See `docs/reference/id-namespaces.md`.

## Task-centered links

Canonical task metadata is the preferred junction point:

```text
Requirements: REQ-AUTH-012, REQ-SEC-004
Contract: docs/execution/P03.md#ex-0142
Tests: TST-AUTH-031, tests/Feature/Auth/DeviceTrustTest.php
Findings: AUD-SEC-019
Evidence: EV-EX-0142
```

Do not maintain the same relationship manually in multiple editable matrices unless an external compliance requirement demands it. Generated matrices/reports are derived evidence, not state owners.

## Evidence record

Evidence should answer:

- what was verified/reviewed;
- against which task/criterion;
- on which implementation revision/candidate;
- by what command/check/procedure;
- what result occurred;
- which environment/platform was observed;
- what artifacts/raw reports support the result;
- what limitations/freshness constraints remain;
- who produced and, where independent review is required, who reviewed it.

Good compact evidence:

```text
Evidence:
- commit: 3f2ab91
- `php artisan test tests/Feature/Auth/DeviceTrustTest.php` -> 12 passed
- `npm run lint` -> pass
- runtime: iOS simulator trusted-device re-login -> pass (artifact: ...)
- reviewer: independent acceptance against EX-0142 contract -> ACCEPTED
```

Poor evidence:

```text
Evidence: done / tested / looks good
```

## Evidence classes

Use the classes required by risk/contract, including automated tests, static/build checks, runtime/browser/device observations, visual/accessibility review, data/migration evidence, performance measurements, CI artifacts and release/production health evidence.

A structural validator PASS proves control-plane integrity only. It does not prove a product requirement, visual quality, performance budget or production behavior unless the relevant evidence was actually collected.

## Evidence placement

For small/standard projects, evidence may live directly in TODO under the task.

For large projects, TODO may contain a deterministic pointer to:

- phase evidence section;
- CI run/artifact ID;
- quality evidence report;
- native test/report output;
- release evidence record.

Evidence storage MUST NOT become a mutable task-status ledger.

## Evidence integrity and freshness

Evidence is bound to revision/context. Re-run or invalidate it when:

- affected implementation changed materially;
- a declared/shared dependency changed;
- environment/configuration changed;
- migration/data shape changed;
- release candidate differs in relevant code/config/assets;
- a time-sensitive external/runtime observation has exceeded its project-defined freshness window;
- the producer/reviewer/environment cannot be reconstructed sufficiently for the risk level.

File hashes are useful but not universal freshness proof. Live services, field performance and device/browser observations may require current candidate-bound evidence even when source files did not change.

## Acceptance

Normal fresh-v2 required implementation work closes at independent `ACCEPTED` (or stronger `RELEASED`) when the current task contract and evidence justify it. `VERIFIED` is a legacy compatibility state only when explicitly normalized to `ACCEPTED` by the project configuration.

An implementer statement, code existence or unrelated green suite is not independent acceptance.

## Audit closure

An audit finding is not closed because a task label appears terminal. `FIXED` requires evidence that the finding's original reproduction/acceptance condition no longer fails. Accepted risk uses the distinct `ACCEPTED_RISK` finding disposition with explicit decision authority/rationale.

## Release traceability

For each release candidate retain at minimum:

- exact candidate commit/tag/build/artifact identity;
- required gates and results;
- current quality/native evidence required by contract;
- unresolved authorized risks;
- environment/platform matrix actually executed;
- deployment result;
- smoke/health/post-launch result where applicable.

A validation run against another commit is not evidence for the candidate merely because it is recent.

## Generated matrices

If stakeholders need a matrix, generate it from canonical relationships whenever practical. Generated output is a report, never a second editable execution authority.
## Bind a native test report to the candidate

Configure an evidence producer in the adapter config selected by execution.config.evidence.adapterConfigPath. For example, a project's committed `scripts/run-tests.mjs` runs its real suite and writes a complete TAP report:

```json
{
  "schemaVersion": "1.0.0",
  "adapters": {
    "test.native": {
      "kind": "evidence",
      "evidenceType": "test",
      "command": "node scripts/run-tests.mjs",
      "reportPath": ".executionkit/evidence/raw/native.tap"
    }
  }
}
```

Set evidence.requireTestAdequacy=true, testFormat="tap" and testReportPath to that reportPath in execution.config.json. Set minimumTests from the approved applicable suite. Commit the producer/config and all candidate changes first, then run:

```sh
node bin/build-candidate.mjs .
node bin/collect-evidence.mjs .
node bin/release-readiness.mjs .
```

Use the project's actual command and JUnit/Playwright format when appropriate. The collector validates candidate integrity before/after running the producer and records artifact SHA-256. Release rechecks process facts, configured command, identity, timestamps and artifact bytes; stale edits or an uncollected report fail. A producer string is not cryptographic attestation, and suite counts do not prove domain/visual coverage.
