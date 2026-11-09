# AI ExecutionKit

ExecutionKit is a CLI-first operating system for AI-executed software delivery. It connects canonical tasks, focused engineering work, deterministic checks, independent evidence and authorized releases in one project-local runtime.

Current published version: **5.2.3**. See the [v5.2 Execution Signals release plan](docs/v5/V5_2_0_EXECUTION_SIGNALS_PLAN.md), [safe-boundary collaboration contract](docs/v5/V5_2_EXECUTION_COLLABORATION.md), [Unslop & Visual Critic integration report](docs/v5/UNSLOP_VISUAL_CRITIC_INTEGRATION_20261107.md), [v5.1.0 reconciliation record](docs/v5/V5_1_0_RECONCILIATION.md), and the [migration guide](docs/v5/V5_1_0_MIGRATION.md). `VERSION` and exact release/tag evidence determine actual runtime identity.

## Current architecture

V5 has **eleven executable systems**:

| System | Responsibility | Operator surface |
|---|---|---|
| Execution OS | Canonical task/lifecycle envelope | `executionkit start . --host antigravity` |
| Agent OS | Routed resources, worker claims and integration | `executionkit agents status .` |
| State OS | Bounded recovery and checkpoints | `executionkit state rehydrate .` |
| Content OS | Content completeness/localization | `executionkit content status .` |
| SEO OS | Applicable public search surfaces | `executionkit seo status .` |
| Docs OS | Source-grounded documentation | `executionkit docs status .` |
| Audit OS | Boundary integrity and evidence | `executionkit audit wave .` |
| Test OS | Impact-selected tests and real journeys | `executionkit test impact .` |
| Launch OS | Exact-candidate release/deploy/rollback | `executionkit launch status .` |
| Visual OS | Screen coverage, media and rendered review | `executionkit visual status .` |
| Decision OS | Local deterministic policy | `executionkit decision status .` |

Database/Route/Surface Integrity and Repository Intelligence support those systems; they add no second backlog or OS. [STANDARD_V5.md](STANDARD_V5.md) is current architecture authority; [AGENTS.md](AGENTS.md) governs contributors. The executable registry [lib/v4-cli-contract.mjs](lib/v4-cli-contract.mjs) owns current commands and flags. Retained `v4` filenames, configuration keys and EK4 integration IDs are compatibility interfaces.

Decision OS is bundled, deterministic, model-free and network-free during evaluation. Compiled mandatory DENY cannot be overridden by knowledge, models or manual metadata. ALLOW grants no release or production authority. Host tools can perform engineering, research and creative generation outside Decision evaluation. No paid AI API, external DecisionOS checkout or daemon is required.

## Installation and safe updates

ExecutionKit supports software projects at any lifecycle stage. Use the [universal adoption protocol](docs/adoption/universal-adoption.md) to inspect the existing system and choose the least destructive compatible mode; healthy native planning/task authorities must be preserved, and migration never manufactures progress. Older protocol references remain compatibility guidance beneath the current V5 runtime contract.

Node **20 or later**, Git and the platform's normal project tools are required. Raster validation for JPEG/WebP/AVIF additionally needs Python 3 with Pillow on the verification host; a missing decoder fails closed with `VISUAL_MEDIA_DECODER_UNAVAILABLE`. PNG and conservative static SVG validation use the bundled JavaScript path. The validator performs no network installation. Linux, Windows and macOS are supported. Obtain an exact verified canonical source checkout; use the source CLI to preview installation into an existing project:

```bash
node bin/executionkit-cli.mjs install /path/to/project --source /path/to/verified-kit --dry-run
node bin/executionkit-cli.mjs install /path/to/project --source /path/to/verified-kit --apply
```

Inspect the generated plan/conflicts before applying. Installation preserves compatible native planning, task IDs and project files; unknown collisions block rather than overwrite. The managed runtime lives inside that project, not a shared user checkout. POSIX wrapper: `./.executionkit/bin/ek`; Windows wrapper: `.\.executionkit\bin\ek.cmd`.

For an installed project, preview and apply a source-bound update:

```bash
executionkit update . --source /path/to/verified-kit --dry-run
executionkit update . --source /path/to/verified-kit --apply
executionkit doctor .
executionkit upgrade-revalidation status .
```

Keep the transaction ID. `executionkit rollback . --transaction <id>` restores a prior installation transaction; it does not roll back application production data. Changed enforcement invariants trigger scoped historical revalidation. Accepted history is not grandfathered through new mandatory checks. V4 self-update stays on its compatibility line until explicit V5 upgrade; see the [migration guide](docs/v5/V5_1_0_MIGRATION.md).

## Normal task workflow

The owner opens `TODO.md` and continues the project task by task. The agent enters once at session/task transition:

```bash
executionkit start . --host antigravity
```

Obey blockers and `nextCommand`; read only the exact task and routed resources. Reuse the compact envelope during ordinary edits. `TODO.md` and declared active shards own mutable task state; chat, State, reports and memory are ADVISORY_ONLY.

Inspect live source/schema/tests, implement the owned change and run the narrowest meaningful regression. Before integration:

```bash
executionkit reconcile task .
```

That runs changed-file DB/Route/Surface/AntiFake checks and local Decision/State reconciliation. Do not run repository-wide scans or full suites per edit. `NEVER_GUESS_DATABASE_TRUTH`: query current compiled table/column/model and route metadata. Reject production mocks, placeholder business data, unfinished handlers and failure-as-success; keep honest empty/error/loading/offline states. Test fixtures remain isolated.

Agent OS prepares worker claims, not actual host workers. Use a real host-native spawn tool for independent owned scopes and record the returned ID through `agents delegated`; if unavailable, `agents decline . --reason HOST_SPAWN_UNAVAILABLE` and continue sequentially. Never invent parallel receipts or wait for unspawned workers.

## Visual Production and Assets Guard

Applicable UI projects must satisfy [Mandatory Visual Production](contracts/visual-production-v5-contract.md) as well as [Visual OS V2](contracts/visual-os-v2-contract.md). Account for primary and secondary screens, tabs/dialogs/forms, loading/empty/offline/error/permission states, responsive layouts and real theme/palette options. An incomplete scan is not a waiver; non-UI projects need no decorative images.

```bash
executionkit visual media-plan . --offset=0 --limit=50
executionkit visual media-check .
```

Continue all pages reported by `media-plan`. It is a read-only plan, not an exported asset. Each screen accounts for hero, banner, background, illustration, icon, empty-state and dynamic imagery. A not-applicable role needs a specific reason and actual screenshot-bound review evidence.

Create artwork in this order:

1. Original safe SVG/native vectors, shapes, CSS/Canvas/Flutter/procedural graphics and licensed icon systems where suitable.
2. Host image generation for complex scenes that need it, with deliberate masters and consistent variants to conserve quota.
3. If generation quota/provider is unavailable, host research of closely matched sources with verified commercial modification rights, followed by actual permitted crop/composition/color/size edits, optimization and independent review.

Keep source URL, author, license, attribution and transformation evidence. Reject unclear/noncommercial/no-derivatives/watermarked assets. Similarity grants no rights; a raster embedded in SVG is not original vector art. Unfulfilled required art remains BLOCKED.

Assets Guard/Visual Production verify real files and UI bindings, hashes, binary decoding/format/size limits, unsafe SVG, provenance and required variants. V5.1 evidence hardening uses artwork-review/v2 and role-exemption/v2 receipts with source digests, signed independent producer/reviewer separation and reviewed theme neutrality. Generated/owned artwork needs a signed production receipt; licensed fallback binds original bytes and rights snapshots, while applicable server/cache receipts are read and signature/hash-bound. Follow the exact current contract fields; older self-declared receipts need revalidation. Use real project tokens, palette IDs, Light/Dark, RTL/LTR and accessible responsive crops. Preserve original SVG icons; optimize responsive raster delivery and prefer WebP where the server pipeline requires it. Authenticated media, tenant isolation and local-first/offline cache evidence apply to the relevant product, not unrelated CLI tools.

A screenshot file is evidence awaiting review. `visual inspect` queues real host review; repeating it does not inspect pixels. Independent signed review/certification, actual UI placement and working behavior remain required. Missing media, invalid proof, unresolved P0/P1 and pending review cannot become acceptance. Current limitations and remaining release work are tracked explicitly; binary hashes and self-declared JSON cannot prove legal rights or human sign-off.

The **Premium Experience Layer** is mandatory for applicable UI-bearing products and is not a ninth OS or an additional V5 OS. Canonical components/tokens, Arabic/RTL, mobile-first layouts, real forms/translations and Render → inspect → correct → re-render remain required; source-only PASS cannot certify browser/device UX. Compatibility quality setup remains in `bin/configure-quality.mjs`.

## Knowledge Base

[GemiTron88/KB](https://github.com/GemiTron88/KB) `main` is canonical general engineering knowledge. Validate catalog/schema v2, manifest digest/counts and meaningful revision changes there first; then synchronize the same catalog/manifest into `lib/decision/knowledge/`. The manifest owns exact counts; no artificial daily changes or revision bumps.

Installed-project boundary refresh resolves one exact canonical commit, validates bounded responses and atomically replaces validated local advice after a six-hour TTL. Supply read-only `GEMITRON_KB_TOKEN` outside tracked files for the private source. Failure preserves validated offline knowledge; task entry/status/evaluation does not need network. Source snapshot synchronization and daily curation are separate workflows with explicit permissions. KB rules may request REVIEW; they never weaken compiled mandatory DENY.

## Testing, auditing and release

During Kit edits:

```bash
npm test -- --target tests/v5-visual-production.test.mjs
```

Inspect `executionkit test portfolio . --base HEAD~1` before adding/pruning tests. Preserve distinct business/security/recovery regressions; no automatic deletion or shallow test proliferation. Agentic E2E uses real critical happy-path, cross-feature and recovery journeys with independent backend/UI oracles; see [the contract](contracts/agentic-e2e-contract.md). Browser/device evidence belongs at the applicable higher-level stage.

```bash
executionkit boundary wave .
executionkit boundary phase .
executionkit launch release .
```

Source release validation deliberately runs `npm run check`, `npm run v5:review` and `npm run cli:audit`, plus applicable installer/update, Python guard and exact-candidate CI checks. [tests/test-baseline.json](tests/test-baseline.json) owns the current regression floor. A disposable command audit can pass an expected refusal; that is command-contract evidence, not production success.

Launch is the sole release/deployment authority. `launch release` is non-deploying; production activation uses separately authorized `executionkit launch deploy . --authorize`, with current candidate, backups, health and rollback. [Provider readiness](contracts/provider-readiness-contract.md) needs independent delivery/signoff; config and health alone are insufficient. No release claim before mandatory gates pass.

Installed-project CI is manual/self-hosted only. The canonical Kit distribution has an explicit manual GitHub-hosted Ubuntu source/release exception; no automatic push/PR full-suite policy is introduced into consumer projects. Old SHA evidence, tags, configured files and source PASS do not certify other platforms or consumers.

VPS/server/container hosts never build Android APK/AAB, execute Gradle/mobile Flutter, install Android SDK/build tools/images or run emulators. Launch Android work runs in the foreground on an enrolled detected physical Windows workstation, without mandatory background Build Agent or Shorebird. Unavailable hardware means BLOCKED. Standalone Kit publication needs no new VPS staging service; see [release policy](docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md).

For operational procedures, rollback, incident recovery and Windows/VPS paths use [PLAYBOOK.md](PLAYBOOK.md). For project-only disk inspection use `executionkit launch storage . --json`; never scan/clean unrelated roots or delete runtime dependencies, customer data, backups or worker-held releases. Full agent control-plane checkouts do not belong in production artifacts.

## Compatibility and historical material

[STANDARD_V4.md](STANDARD_V4.md) applies only to preserved V4 installations: V4 has exactly ten executable systems. Older [STANDARD.md](STANDARD.md), [STANDARD_V3.md](STANDARD_V3.md) and adoption/fleet guides remain migration/history; none overrides current V5 instructions.

The following are historical V3 vocabulary, not V5 setup requirements: **Eight systems, one control plane**; State OS as system #8; `EK00-004S` / `EK00-005S`; **ExecutionKit Agent — 3.0 fleet observability**; one lightweight deterministic Node.js Agent per developer device; `HOST_ACTIVE` versus `EXECUTION_ACTIVE`; Large TODO files are observed through cheap metadata sentinels; Remote control remains disabled. See [historical release validation](docs/operations/v3-release-validation.md), [State architecture](docs/architecture/state-os.md), compatibility helpers `bin/state-amnesia-test.mjs`, `bin/migrate-current.mjs` and `bin/validate-seo.mjs`. These names do not introduce a daemon or MCP dependency into V5.
