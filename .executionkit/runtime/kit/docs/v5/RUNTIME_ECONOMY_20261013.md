# Runtime economy and strict quality continuation — 2026-10-13

Recovered baseline: `c61e539494f34d4da83749be64670423318f1bc7` on canonical main, plus the unfinished previous-session source changes. Runtime remains 4.1.0; this is preparation, not a v5 publication or production deployment.

## Behavior

- Canonical CLI emits compact machine JSON with status, blockers, next command, counts and a bounded detail cache. Use `--full-output` for complete payloads, `--human` for summaries and `--json` to force JSON on a terminal. Help keeps the complete command list and trims repeated optional flags; full output retains all flags. Discovery loads no execution/installer/visual/test modules. One-time credential responses are never cached/truncated. Retain at most two detail files per command. Node and launcher use the same emitter.
- Installed projects receive tracked `ek` / `ek.cmd` entries before standalone binary provisioning. Commands use the verified project-local runtime. Doctor verifies entry bytes and executable modes; install/update/rollback keeps transactional ownership.
- Upgrade revalidation checks cheap policy/schema/routes/surfaces first. Default failure stops expensive work and records pending checks; `--all-checks` explicitly requests exhaustive diagnostics. No unexecuted check becomes PASS.
- DB/route guards resolve safe project-relative paths, handle Unicode Git paths, fail closed on unavailable compiled route truth and reject scan overflow. Route signatures distinguish domains. The changed-file path includes committed changes even when another file is dirty.
- Surface guard integrates source assets, native forms and translation checks at task/boundary/release/upgrade transitions. External app asset/font/library references are forbidden; literal Laravel asset paths must exist. Native HTML submission requires field names and upload encoding, POST Blade forms require CSRF; Livewire/client-managed submission needs runtime validation. JSON/ARB/literal PHP translation catalogs must supply configured locales and referenced keys. Unproven library usage is an explicit review finding, never permission to remove a dependency blindly.
- Unrelated changed CSS/assets do not compile language catalogs. Full scans occur at explicit deep/phase/release boundaries.
- Web boundary Test OS requires fresh successful mobile Lighthouse measurements with four 100 scores for every declared URL. Release proof validates report hashes, measured source fingerprint and exact release commit. The project must enumerate its complete URL inventory; no static check certifies unseen/authenticated pages.
- Visual evidence cannot manufacture premium PASS from geometry. Native image review is explicit and bound to signed request/image/geometry evidence. Missing genuine review stays REVIEW_REQUIRED/BLOCKED; fixture geometry is not image inspection.
- Optional deterministic Decision advice stays local, exact-source pinned, typed and isolated in a bounded subprocess. It never grants release or overrides mandatory guards. Signed knowledge refresh occurs only at boundaries. No local model, daemon or per-edit model call was added.

## Test hygiene and cost

Permanent regression sources currently occupy about 1.5 MiB, not thousands of generated test files. Keep their important safety/compatibility coverage and the 600-pass floor. Explore in owned temporary folders and remove generated scratch after success/failure. The source runner gives all child tests an isolated TMPDIR/TEMP/TMP and deletes its owned tree in finally, unlocking only owned temporary directories (without following symlinks) when fixture runtimes are sealed. Cleanup refusal stays visible and fails the run rather than hiding test failures. Test OS does the same for each bounded command and removes inherited NODE_TEST_CONTEXT so nested Node failure cannot become false PASS. Source files and active gate reports/screenshots remain intact. Abrupt process/host termination can bypass finally; this does not claim recovery from SIGKILL.

Passing per-case TAP chatter is omitted by default; counts and failed-case diagnostics remain. Full runner output is explicit (`npm test -- --full-output` or `EXECUTIONKIT_TEST_OUTPUT=full`). The v4 source gate runs the full discovered baseline once; that already includes the v4 and packaged smoke suites. Separate focused commands remain available for development.

## Verification

Focused source checks and real pinned local Decision advice ran during recovery. Final exact-source acceptance is recorded below after execution. Windows/macOS host behavior, live browser/site quality, physical Android, provider credentials and v5 consumer upgrade/rollback remain separate acceptance frontiers; source tests do not certify them. No APK build, SDK/emulator download, production deployment or v5 release occurred.


## Executed source acceptance

Tested code: `2ea58eb39ccf0f000f5e2c8d72cafe14ffb4d87f` (clean worktree). `npm run v4:check`: 1122 discovered / 1118 passed / 0 failed / 4 optional live skipped, 86.75 seconds, 118 required files and the 600-pass floor retained. All ten non-test stages from `npm run check` were executed individually and passed on that same source. See `evidence/20261013/runtime-economy.json`. This does not count skipped live checks as acceptance.

Five local help invocations per entry under regression load: Node CLI median 183.5 → 83.5 ms; its output 4601 → 3429 bytes. Launcher output 5056 → 3429 bytes; its observed median 77.9 → 92.2 ms, so no launcher latency improvement is claimed. Full discovery retains all 53 usage lines. Measurements are diagnostic, not cross-platform/general workload certification.

Real pinned local deterministic advice at DecisionOS `67984edab934f1d60e70e9826dd3ca304589941d` returned AVAILABLE for valid typed requests; remote assets, missing translations and failed checks returned mandatory DENY, while an empty signal set granted no execution authority. No model/service/native Android workload ran.

Only source preparation is verified. The prospective v5 release, historical source convergence, consumer upgrade/rollback, physical workstation/device and real-site/browser/provider acceptance remain governed by their existing canonical tasks. No production activation occurred.
