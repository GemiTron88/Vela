# VPS1 Host Evidence Provenance

Date: 2026-10-11
Host: Linux x86_64 (Rocky Linux 9.8 / Kernel 5.14.0-687.51.1.el9_8.x86_64)
Hardware: 16 Cores, 66.8 GB RAM, ~36.6 GB Disk Free
Execution Mode: CLI-First, MCP-Free, Host-Native Intelligence
Platform Checkout: `/home/antigravity/projects/APKrelease` (main)
FLOW Pilot Checkout: `/home/antigravity/projects/flow-test-isolated` (branch `codex/global-mobile-release-pilot` at `44d6e76949e158d189514ebc6226dbc6890afa17`)

## Verified Host Toolchain
- **Flutter / Dart:** Flutter 3.47.7 • channel stable • Dart 3.13.5 (installed under `/home/antigravity/tools/mobile-runner/flutter-3.47.7`)
- **Java:** OpenJDK 17.0.20.1 (Temurin-17.0.20.1+1)
- **Android SDK:** Command-line Tools latest (v22.0) under `/home/antigravity/tools/mobile-runner/android-sdk`
  - `build-tools;35.0.0` (apksigner, aapt2, d8, r8)
  - `platforms;android-35`
  - `platform-tools` (adb version 1.0.41, bridge version 37.0.1-15733141)
  - SDK licenses accepted via `sdkmanager --licenses`
- **KVM Status:** `/dev/kvm` absent, hardware virtualization flags absent. Emulator benchmark status: `NOT_TESTED`.
- **Node.js:** Node v24.21.0

## Evidence Files Summary

| File | Origin | Summary |
|---|---|---|
| `vps1-diagnostics.json` | `python3 scripts/diagnose.py` | Discovered OS, RAM, disk, OpenJDK 17, Android tools, Flutter, and truthful KVM fallback. |
| `vps1-node-tests.log` | `npm test` | 23 passed, 0 failed (757ms). Real HTTP, crypto, SQLite transactions, lease contention, journal immutability. |
| `vps1-python-tests.log` | `python3 -m unittest ...` | 2 passed, 0 failed. Runner recovery, worktree isolation, signed receipts. |
| `vps1-sdk-analyze.log` | `flutter analyze` | `packages/global_mobile_updater`: No issues found (13.4s). |
| `vps1-sdk-tests.log` | `flutter test --reporter expanded` | `packages/global_mobile_updater`: 8 passed, 0 failed. |
| `vps1-sample-analyze.log` | `flutter analyze` | `examples/sample_app`: No issues found (14.1s). |
| `vps1-sample-tests.log` | `flutter test --reporter expanded` | `examples/sample_app`: 2 passed, 0 failed. |
| `vps1-worker-verify-receipt.json` | Worker verify job | Signed HMAC-SHA256 receipt for sample at commit `c24e50a7ca49909df6d86db2d8a7abf67f9a74fa`. |
| `vps1-control-plane-journal.json` | Central SQLite journal | 10 append-only chained hash records from `project.register` through job execution. |
| `vps1-security-negative-probes.log` | HTTP negative tests | Verification of 403 Forbidden for bad Host, bad Origin, bad Auth, and cross-project credentials. |
| `vps1-php-fleet-harness.log` | PHPUnit in fleet-harness | 46 tests / 238 assertions across 3 suites: GlobalMobileReleaseTest (4/15), FleetBridgeTest (12/73), ProjectReconciliationTest (30/150). |
| `vps1-flow-pilot-analyze.log` | `flutter analyze` | FLOW pilot `flutter_app`: No issues found (32.4s). |
| `vps1-flow-pilot-focused-tests.log` | `flutter test` | SMS checkpoint suite (4 passed) + finance/auth/cutover suite (28 passed). Total 32 passed. |
| `vps1-flow-pilot-full-regression.log` | `flutter test --concurrency=2` | Full FLOW Flutter test suite: 1,037 passed, 0 failed (7m 48s). |

All logs are sanitized. No private configuration, tokens, HMAC keys, keystores, environment dumps, or banking messages are included.
