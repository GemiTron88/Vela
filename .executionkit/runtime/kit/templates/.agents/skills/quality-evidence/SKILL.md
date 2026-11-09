---
name: quality-evidence
description: Enforce AntiFake production purity and candidate-bound quality evidence.
---

# Skill — Quality Evidence & AntiFake Purity

1. Run `executionkit guard antifake .` and `executionkit audit quality .` to verify zero production mocks, faker/lorem payloads, hardcoded demo metrics, stub handlers, or silent catch blocks.
2. Validate product quality contracts and rendered evidence bound to the current candidate commit.
3. Ensure every data-bearing view and API uses real persistence, honest empty/loading/error states, and verifiable validation rules.
