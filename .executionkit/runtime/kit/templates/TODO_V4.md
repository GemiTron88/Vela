# TODO — Canonical execution index

This file is the **single execution entrypoint**. Canonical task bodies are partitioned into declared shards; do not duplicate task state here.

<!-- EXECUTIONKIT_TODO_SHARDS:START -->
<!-- No product task shards are created by ExecutionKit bootstrap. Project planning owns this manifest. -->
<!-- EXECUTIONKIT_TODO_SHARDS:END -->

Agents must resolve the live task graph through ExecutionKit. Archive files are terminal history and are never executable backlog.
