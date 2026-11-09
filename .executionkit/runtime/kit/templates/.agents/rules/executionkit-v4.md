# ExecutionKit Antigravity entry
Decision OS is system 11: bundled deterministic engine, local KB snapshot, TTL refresh only at boundaries. ALLOW grants no authority; compiled DENY blocks. No model or hot-path network.

At session start or a canonical task transition run:

~~~bash
executionkit start . --host antigravity
~~~

The default envelope is the compact hot-path authority. Reuse it for the current task; never rerun start/status/reconcile after ordinary edits. Use --deep only when nextCommand, an explicit boundary/release operation, or debugging requires it.
Use the project-local ek entry above for all canonical commands (replace executionkit in nextCommand/help with this entry). Do not spell out Node or the managed runtime path. Direct Node helper scripts are explicit recovery primitives only. Exception: the agent has the permission to adapt the kit to work with the project, and can edit the project-local kit instead of creating external scripts.
Before integrating a task run the same entry with reconcile task .; applicable Database, Route and Surface/AntiFake guards must pass. Production mock/fixture imports, invented data and fake success block integration; use real providers and honest error/empty states. Never guess schema or named routes. A phase/release checks all references; a Kit upgrade revalidates accepted history.

For native Laravel deployment require Launch Vhost Guard, actual HTTP/HTTPS roots, selected pinned CWP custom tpl/stpl pairs and real HTTPS release identity. Never edit generated vhosts or guess hosting keys. For UI work load `skill.design-refinement` (`design-system -> component-system -> design-refinement -> premium-experience`), establish 5-part Design Direction, choose intervention level (`No Change`, `Light Polish`, `Full Refinement`), apply 9 anti-slop checks in one pass, and submit native image-bound visual reviews via `executionkit visual inspect . --run <runId> --cell <cellId> --response <file>`. Premium Visual defects and unresolved rendered evidence feed Decision quality blockers. --progress adds compact stages; --full-output is debug detail.
Context economy is mandatory: do not preload README, PLAYBOOK, STANDARD*, the full TODO/shard set, the full Agent manifest, generated knowledge, or unrelated rules/skills/contracts. Read the exact task block at runtime.task.sourcePath:startLine, then load only routed resource files needed for that task. Prefer targeted db/route/knowledge lookups over broad scans.

Heavy Product Closure, Repository Intelligence, Test, Audit, Content, SEO, Docs and Visual work belongs at wave/phase/release boundaries. MCP and restart/reopen are not part of the ExecutionKit lifecycle.

If hostAction is PREPARE_NATIVE_SUBAGENTS run executionkit agents run . (add --boost when requested). If hostAction is SPAWN_NATIVE_SUBAGENTS, spawn one worker per hostDelegation in its worktree. Each worker opens .executionkit/agent-claim.json, reads the exact taskRef and loads resources lazily; never duplicate the orchestrator context. Collect, integrate and cleanup claims after workers finish.
