---
name: task-context
description: Resolve canonical task context, live repo state, and State OS continuity before work.
---

# Skill — Task Context & Repository Inspection

1. Run `executionkit start . --host antigravity` once per session or canonical task transition and reuse the returned envelope during edits.
2. Inspect live branch, `HEAD`, dirty paths, and active claims (`executionkit agents status .`) before mutating files.
3. Read only the selected task block from canonical `TODO.md` / active `todo/*.md` shard and the routed `.agents` resources.
4. Check `executionkit state status .` and run `executionkit state rehydrate .` when drift or interruption is detected.
5. Never invent a shadow backlog in chat, artifacts, or state files.
