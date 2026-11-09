---
name: test-adequacy
description: Select impact-driven tests, enforce portfolio adequacy, and run E2E/browser journeys.
---

# Skill — Test Adequacy, Impact Selection & E2E Journeys

1. During task implementation, run only targeted tests via `executionkit test task . --target <file> [--filter <pattern>]` or impact-selected tests via `executionkit test select . --base HEAD~1`.
2. Before adding or pruning test files, inspect portfolio health with `executionkit test portfolio . --base HEAD~1` and flake history with `executionkit test flakes .`.
3. Reject zero-test runs, skipped required assertions, mock-only business logic tests, and rerun-until-green flake masking.
4. At wave/phase/release boundaries, execute `executionkit test wave|phase|release .` and critical user journeys (`executionkit test journeys .`) with real backend and UI postconditions.
