# ExecutionKit v4 runtime-first architecture

ExecutionKit v4 moves orchestration authority from optional host behavior into a CLI kernel.

## Host path

```text
AGENTS.md
  ↓
executionkit start --host antigravity --json
  ↓
v4 execution envelope
  ↓
Antigravity executes only the returned bounded lifecycle action/batch
  ↓
lightweight task integration + Product Closure / affected-system impact reconciliation
(no automatic Test OS or Audit OS at task cadence)
  ↓
State checkpoint + orchestrator integration
  ↓
executionkit next --json
```

The host is not expected to remember ten independent manuals.

## System participation

Each task receives explicit system applicability. Execution, Agent and State always participate. Content/SEO/Docs/Visual are triggered by project/task/surface impact. Audit/Test/Launch participate at their lifecycle boundaries. A missing applicable system is a kernel error rather than a silent omission.

## Visual OS and Test OS

Visual OS owns premium product-experience requirements and whether rendered evidence is sufficient. Test OS owns execution and adequacy of Playwright/browser, accessibility, responsive, visual regression, Flutter golden/semantics/device and related evidence producers.

Visual OS source heuristics may fail obvious anti-patterns or require review, but they never manufacture a premium PASS from source structure alone.

## Knowledge providers

Repository Intelligence decides provider use from the operation:

- exact dependency/impact queries prefer current CodeGraph;
- large bounded context packs may use Repomix;
- token-heavy safe read-only Git output may use RTK;
- macro knowledge/docs/search may use Terrain when available;
- native repository source/knowledge remains the fallback and source authority.

Provider use and fallback are observable in the execution envelope/evidence.

## GitHub-native factory/control plane

ExecutionKit v4 removes the legacy per-device ExecutionKit Agent from the active architecture. Elmasna3 observes repository, branch/HEAD, sharded TODO authority, checks/manual workflows and self-hosted runner state through GitHub directly.

When the factory needs a machine-executed operation, the only remote execution surface is a repository-defined, allowlisted manual `workflow_dispatch` workflow. GitHub selects an eligible project runner by labels; Linux, Windows and macOS machines can be added or removed without another ExecutionKit daemon or device protocol. Generic remote shell commands remain forbidden, and local Antigravity/CLI execution never requires Elmasna3 to be online.

## Migration boundary

v4 keeps existing project-native task and agent authorities where stronger/equivalent. The major migration changes the managed runtime and host contract, not historical product truth.

The v3 MCP host path is legacy and must not be required by the v4 execution envelope.
