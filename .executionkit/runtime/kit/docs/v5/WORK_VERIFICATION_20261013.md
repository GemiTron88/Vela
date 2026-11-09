# ExecutionKit v5 — independent Work verification

Upstream: `08baadf0e1bb4e0e8be59ff742ad9c16fcb4bb40`, exact source tree `5b4d61ae005d51a81348c89744e360bfc4675891`. GitHub authenticated tools supplied current branch/tree/blobs. Direct Git transport was unavailable; a local Git snapshot was reconstructed with every blob and executable mode checked against that exact tree. Local snapshot commit IDs are not remote acceptance SHAs.

Verified code checkpoint: `93a1932bc610f88ff5bffd513e9150ae58476663`, exact tested tree `9d3e6473fd6ae86670ccdd86fd1a93fe1ca68d4c`. First correction checkpoint: `5670ffeb6044cd03b441b1d635667fc60023cf06`. Both were pushed to main with expected-head checks, fast-forward only. Subsequent evidence/TODO updates do not change runtime code.

## Implemented corrections

- Test impact now includes committed changes since the selected base plus staged, unstaged and new non-ignored files. NUL-separated paths preserve spaces/newlines. Invalid Git bases fail closed; the first-commit fallback remains bounded to known repository files.
- Task Test OS defers empty/missing selector values and prevents configuration, bootstrap and report paths from disguising broad suites as focused tests. Valid positional targets and nonempty filters retain compatibility.
- Named package-manager test suites (`test:all`, `test:unit`, `v4:test`) also require task selectors. A named unscoped suite bypass was independently reproduced and corrected.
- Existing boundary/reconcile fixtures now declare scoped wave checks. Their four failures were independently reproduced on unchanged upstream; they no longer assume an automatic full wave suite. Three new negative cases were reproduced before implementation. No test files or historical coverage were deleted.
- Legacy `init-project` distribution now includes the Test OS portfolio dependency. The initial phase run reproduced 18 failures; a four-file focused rerun reproduced all 18, then the installer repair and baseline/help synchronization recovered 56/56 tests. Root AGENTS floor now matches the unchanged 122-file baseline; CLI help expectation includes the existing portfolio command.

## Independent evidence

| Area | Status | Evidence and limit |
| --- | --- | --- |
| Decision OS | TESTED | Mandatory group: 59/59, four files, 9403.945 ms. Includes bundled installation, v4 compatibility, schema, immutable DENY, fallback, TTL, exact-commit refresh, digest/conflict/rollback negatives and Launch service security. No legacy checkout used. |
| APKrelease independence | VERIFIED / TESTED | Legacy main `37cc90b9dfacba529fe3d2b300bb92d3e05fcd40`: all 19 service modules present, 15 identical blob hashes, four modified (`launch-gates`, `server`, `service`, `store`); all 15 updater SDK files identical. Six additional Launch suites: 63/63, 2470.418 ms, including API, roles, enrollment/revocation, leases, fencing, signed gates/inspection, provider and CLI contracts. Real loopback HTTP and disposable SQLite; artifact/device fixtures are not physical acceptance. |
| Canonical KB | VERIFIED / TESTED | `GemiTron88/KB` main `da6c5f35a6a3dbe79fe2c9b42ac35b326adbb7f3`; pinned manifest/catalog independently fetched and digest/schema/count validated. Revision 1, 140 facts, 14 rules, seven domains; bundled catalog byte-identical. Refresh transport regression uses injected fixtures. Actual credentialless runtime returns `KB_PRIVATE_READ_CREDENTIAL_REQUIRED`, `BUNDLED`, zero calls. Authenticated direct-runtime network refresh NOT_AVAILABLE here. |
| Impact/Test/Agent OS | TESTED | Eight impact-selected files: 77/77, 8527.381 ms. Agent tests exercise claims, receipt requirements and sequential fallback using fixtures; no actual host subagent spawned or native delegation acceptance claimed in this session. |
| VPS mobile prohibition | TESTED | Python kernel guards 4/4 (0.082 s) and host policies 4/4. Fixture policy checks only; no operational VPS sandbox acceptance. No mobile toolchain installed or invoked. |
| Source review / CLI | SOURCE_ONLY / TESTED | Source review PASS: 11 systems, 22 invariants, 290 helpers, 150 CLI surfaces (26631 ms); CLI command audit 166/166; native agent instruction validation PASS. |
| Source phase acceptance | TESTED | Final complete regression: 1210 cases, 1206 PASS, zero FAIL, four unavailable-live skips; TAP duration 96915.192 ms, wall duration 97528 ms. All ten policy/distribution stages composing `npm run check` separately executed and passed. Initial complete run: 1188 pass/18 fail/4 live skips (95937.896 ms); focused recovery 56/56 (29062.701 ms). A shell retry exited without remaining-stage evidence and received no PASS credit; explicit stage receipts establish the final pipeline. No stable/physical acceptance. |

Machine-readable command/exit/duration evidence: `docs/v5/evidence/work-20261013/verification.json`. Six historical phase-convergence warnings remain visible; repository context absence is advisory. No full suite is run at ordinary task/edit boundaries. Only the initial phase and failure-justified complete regression recovery were executed; other reruns were targeted.

`DECISIONOS_DELETE_READY`: technical retirement readiness for the Kit's own dependency, independently confirmed. Unknown external consumers remain unverified. No GitHub deletion is authorized by this report.

`APKrelease: KIT_INDEPENDENT`; `ALL_CONSUMERS_INDEPENDENT: BLOCKED`. Known paused external Git consumer, installed external agents and physical workstation/device acceptance remain unresolved. FLOW was not accessed; Studio and other client projects were not inspected or modified. No legacy repository backups created. No deployment, production database operation, CWP/DNS mutation or service restart performed.

## Remaining canonical blockers

`EK4-LAUNCH-ACCEPT-004`, `EK4-LAUNCH-SAFETY-006`, `EK4-LAUNCH-CUTOVER-007` and the physical/provider portions of `EK4-LAUNCH-PARITY-008` require actual authorized hosts/devices or external consumer migration. `EK4-E2E-002`, `EK4-VISUAL-002` and `EK3-046/048` retain authenticated product/native/physical-runner requirements. `EK5-PREP-CANONICAL-GATES` and `EK4-REVIEW-AUDIT-003` retain explicit historical phase convergence. `EK5-GEMITRON-PUBLISH` remains blocked on candidate-bound acceptance and owner release approval. Current source tests do not discharge these blockers.
