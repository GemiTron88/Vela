---
name: blocker-analysis
description: Investigate and resolve or document bounded canonical task blockers.
---

# Skill — Blocker Investigation

1. Inspect the blocked task and envelope blockers via `executionkit status .` and `executionkit decision status .`.
2. Distinguish environment/tooling blockers (repairable via `executionkit doctor .`, `executionkit repair .`, or config fixes) from true external blockers (missing owner credentials, unavailable physical mobile workstation, or third-party outage).
3. If actionable locally, resolve the root cause, verify with targeted checks, and resume task execution.
4. If genuinely blocked by external dependencies, record exact reproduction evidence and required owner action in the task block without fabricating completion.
