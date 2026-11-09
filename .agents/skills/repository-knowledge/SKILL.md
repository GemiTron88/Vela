---
name: repository-knowledge
description: Query freshness-aware native Repository Intelligence without overriding live source.
---

# Skill — Repository Knowledge

1. Check knowledge freshness and provider health with `executionkit knowledge status .` and `executionkit providers status .`.
2. Consume bounded context on demand via `executionkit knowledge auto . --purpose <agent|docs|testing>`, `executionkit knowledge search . --query <q>`, or `executionkit knowledge impact .`.
3. Refresh stale indexes with `executionkit knowledge refresh .`.
4. Derived knowledge is navigation context only; verify exact symbols, schemas, and routes against live files before mutating code.
