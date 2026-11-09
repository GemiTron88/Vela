# ExecutionKit v5 — development authority

**Owner v5 release decision (2026-10-14):** VPS Staging is **not required** to publish standalone ExecutionKit v5. Retain older staging receipts as historical evidence only; never provision a new staging service/VPS or change production CWP permissions merely to release the Kit. Real production deployments still need exact candidate checks, signed authorization, backups, health and rollback; real Android acceptance still needs a physical workstation/device. See `docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md`.

Current published baseline: **5.2.3**. See [the v5.2 Execution Signals plan](docs/v5/V5_2_0_EXECUTION_SIGNALS_PLAN.md), [Unslop & Visual Critic integration](docs/v5/UNSLOP_VISUAL_CRITIC_INTEGRATION_20261107.md), [the v5.1.0 reconciliation record](docs/v5/V5_1_0_RECONCILIATION.md) and [v5.0.1 → v5.1.0 migration guide](docs/v5/V5_1_0_MIGRATION.md). `TODO.md` owns work; live source, root `AGENTS.md` and this standard govern v5. `STANDARD_V4.md` governs preserved v4 compatibility. Existing `v4` config keys, EK4 integration IDs and module names are retained migration interfaces, not the current product version.

## Market voice, mobile presentation and purposeful imagery

v5 reuses Lang Guard, Assets Guard, Visual OS v2 and bundled deterministic Decision OS. For projects serving a declared Saudi audience, specify `surfaceIntegrity.locales: ["ar-SA"]` and `surfaceIntegrity.marketVoice` with `locale: "ar-SA"`, `register: "formal"` and explicit forbidden dialects. No dialect may be inferred from the AI agent's own speech. Egyptian conversational copy in Arabic UI or translations blocks the quality boundary through `LANG_MARKET_DIALECT_MISMATCH` / `APPROVED_MARKET_VOICE_REQUIRED`. Other markets need their own explicit voice profile and reviewed lexicon.

At rendered boundaries Visual OS detects detached fixed contact/WhatsApp action bars, overflow, stylesheet/font failures, image failures and media-thin first folds; it also requires real image-bound critique of header/logo balance, rhythm, safe areas, responsive crops, CTA visibility and media suitability. Full-page source-bound screenshot capture alone is never acceptance: pending review or P0/P1/P2 findings block without valid independent disposition/certification. Reuse the current run and inspected cells rather than recapturing or burning model tokens.

Assets Guard source hints are navigation only. Mandatory Visual Production at applicable wave/phase/release gates covers every discovered screen and all seven media roles through `visual media-plan` / `visual media-check`; twelve hint candidates are never a coverage limit or acceptance waiver. Original vector/native drawing comes first, host image generation handles complex scenes, and quota exhaustion requires rights-cleared online research plus actual permitted edits and independent review. Missing required media or evidence fails the boundary; an advisory source hint never supersedes that gate. No image generation, model or online search occurs in Decision evaluation. See `contracts/visual-production-v5-contract.md` and `docs/v5/MARKET_VISUAL_MEDIA_POLICY.md`.

## Eleven executable systems

| System | Trigger | Canonical surface | Evidence |
|---|---|---|---|
| Execution OS | session/task lifecycle | `executionkit start .` | execution envelope, closure and lifecycle receipt |
| Agent OS | task routing/claims | `executionkit agents status .` | routed resources, isolated claims and integration |
| State OS | entry/integration recovery | `executionkit state status .` | live rehydration, checkpoint and journal |
| Content OS | content impact/boundary | `executionkit content status .` | content source/evidence checks |
| SEO OS | applicable public routes | `executionkit seo status .` | route SEO and measured performance |
| Docs OS | material source change | `executionkit docs status .` | generated documentation registry |
| Audit OS | wave/phase/release | `executionkit audit wave .` | exact-candidate audit gates |
| Test OS | wave/phase/release | `executionkit test wave .` | unit/integration/journey and postconditions |
| Launch OS | release/deploy/rollback | `executionkit launch status .` | candidate, signed gates and deployment state |
| Visual OS | UI impact/boundary | `executionkit visual status .` | rendered review, accessibility and responsive evidence |
| Decision OS | local preflight/postflight/boundary | `executionkit decision status .` | local verdict and reconciliation gate |

Repository Intelligence and Database/Route/Surface Integrity remain supporting fabrics. They do not own a second task backlog. Launch OS retains sole release authority; Studio consumes its typed API. The Kit is independent of APKrelease; repository retirement remains blocked by external consumer/installed-agent migration and physical acceptance, then requires separate owner deletion approval. No legacy Git repository backups are required or created. Live database/artifact recovery and release rollback remain mandatory.

## Decision OS and knowledge delivery

v5 embeds a mandatory deterministic engine under `lib/decision/`. It requires no external DecisionOS checkout, model, AI/LLM/SLM dependency or standalone daemon. Typed schema v2 admits only event/action/observed host/environment and allowlisted abstract signals; private source, identifiers and arbitrary fields are rejected. Host class is derived locally. Compiled DENY blocks; REVIEW is advice; ALLOW grants no authorization and cannot bypass Test/Audit/Visual/Launch. Quality acceptance denies unauthorized remote asset references, missing translations, form 5xx, mobile overflow, component bypass, failed checks, regressions and insufficient/performance evidence.

`GemiTron88/KB` is the canonical reviewed knowledge source. Its manifest records the current exact revision, digest and fact/rule counts across quality, visual, performance, architecture, security, operations and delivery; do not copy those changing counts into prose. Facts are advisory; knowledge rules may only escalate to REVIEW. Only a Kit source update changes compiled denial policy.

A six-hour TTL refresh runs at wave/phase/release boundaries, with at most three GETs, a five-second network deadline and bounded responses. For the private repository, the host needs a read-only `GEMITRON_KB_TOKEN`; this credential is never persisted in knowledge receipts. Resolve `main` once, then fetch manifest/catalog at the same exact SHA. Validate schema, digest, counts and monotonic revision, reject redirects, and replace one project-local cache atomically. A failed/absent credential or rejected refresh retains validated local knowledge. After seven days, cached advice falls back to the bundled snapshot. Task entry/status/postflight do not fetch remote content. There is no daemon or automatic execution on every file edit.

The source KB still needs reviewed commits: automatic delivery does not invent new knowledge or approve it. The existing daily knowledge automation is separate from project runtime; it does not grant publishing rights beyond its authorized task.

At quality acceptance, an explicit unverified-performance signal or an incomplete score/budget pair is a compiled DENY even with empty knowledge. Complete measured values must meet the budget. Omitted performance signals do not invent applicability; planning `performance_review` remains advisory.

## Guards and cadence

Task integration runs changed-file DB/Route/Surface guards plus local Decision postflight and a lightweight State checkpoint. Task entry reuses compact receipts and local knowledge. Full scans, rendering, Lighthouse, Test/Audit and Product Closure belong at wave/phase/release. DB/Route guards compile live metadata; never guess schema or route names. Surface guards check local assets/libraries, literal translations, CSRF/upload/name errors; unused dependency findings require investigation before removal. Static source PASS does not prove form submission, HTTP 500 absence or rendered translations. Agentic E2E and Visual runtime evidence own those checks.

Use `executionkit guard all . --all` or targeted `guard assets|forms|lang`. Premium canonical components, Arabic/RTL, mobile-first layout and actual candidate-bound Lighthouse remain required for applicable products. No fabricated screenshots, scores, device results or PASS.

## CLI, installation and release

CLI help/dispatch derive from one registry. Output is bounded JSON for agents/pipes or concise symbols/colors for terminals; `--human`, `--json`, `--full-output` are deliberate overrides. Run session/task entry once and reuse the envelope. No per-edit broad scan or model-token cost.

The v5 CLI installs/upgrades exact-source immutable project-local runtimes. v4 library installation remains explicitly targetable at 4.1.0 for compatibility; legacy v2/v3 scaffold helpers remain compatibility surfaces and use their tested version. `templates/AGENTS_V5.md` and the generated entry rule install the eleven-system contract while preserving native instructions, TODO, integration IDs and product files. Upgrade invariant changes require scoped historical revalidation. Transaction rollback restores prior config, rules, runtime and receipt. Self-update keeps an installed v4 project on v4 unless a v5 upgrade is explicit.

The manual `.github/workflows/v5-source-release-candidate.yml` checks an exact main commit on GitHub-hosted Linux, runs targeted/full regression, v5 review, disposable CLI audit, Python host guards and a v4-compatible artifact verifier. It emits `SOURCE_RC_PASS` only: **not** staging/mobile/production acceptance and **never** a release/tag/deploy. Preflight enforces consistency between `VERSION`, `package.json`, `package-lock.json` and `tests/test-baseline.json`. Handoff: `docs/v5/ANTIGRAVITY_RELEASE_HANDOFF.md`.

`npm run v5:check` runs the complete regression suite. `npm run v5:review` checks eleven executable source contracts, invariant/helper surfaces, every registered CLI family/subcommand help surface, all source helper syntax, guard references and current documentation. Its report is source evidence, not staging/physical/production acceptance.

Stable v5 publication requires Launch v2 source/web security, canonical convergence, representative consumer install/upgrade/rollback and native physical workstation/Android acceptance plus owner release approval. By final owner decision, Launch OS executes web deployments on VPS and native Android builds directly in the foreground on the owner's physical Windows workstation (`executionkit launch mobile . --mode doctor|build|inspect|handoff|import`) without requiring a background Local Build Agent, remote job polling/leasing, or mandatory Shorebird cloud patching (`mobileUpdateStrategy: SIGNED_APK`, `buildAgentRequired: false`, `shorebirdRequired: false`). No mandatory VPS Staging or production host bootstrap is required for the portable Kit distribution. Never build APK/AAB/Gradle, download Android tools/images, run emulators or perform mobile Flutter workloads on any VPS/server/container. Native work requires an enrolled detected physical workstation; unavailable hardware is BLOCKED.

## Plan alignment and bounded reconciliation

Decision OS compares the current canonical task's explicit `Decision Scope` (or owned surfaces) against changed product files. It records a local goal digest at preflight for task title, the complete Objective (including continuation lines and projected task objectives), dependencies, contract, constraints and scope. A scope breach, ambiguous scope, missing preflight or changed goal requires review and blocks task integration. Missing active task context also blocks reconciliation of changed product files. Status/Evidence changes do not redefine the goal. Native TODO changes stay canonical; local receipts never become a task backlog. Broad semantic alignment still requires a real reviewer: a deterministic engine does not invent an understanding of prose goals.

`executionkit decision align . --task <id>` displays the current digest and findings. After explicitly reviewing a legitimate plan revision, accept only that exact digest with `--accept --authorize --expected-goal <digest>`. Fix unclear scope or outside-file findings; accepting a goal revision does not waive them. `nextCommand` requests inspection, never automatic approval.

Direct CLI and Agent/Boundary reconciliation run in a bounded worker. Default total budgets: task 30 seconds, wave 5 minutes, phase 10 minutes, release 15 minutes. `--timeout-ms` or `v4.reconcile.<boundary>TimeoutMs` makes deliberate overrides, capped at one hour. Stage STARTED/COMPLETED events and a 10-second heartbeat report elapsed/remaining time while stdout remains machine JSON. Deadline expiry produces a FAIL receipt; unfinished checks cannot count as PASS. Task output includes per-stage durations and the slowest stage. Expired inherited deadlines cannot be extended. Any worker exception, output overflow or unsuccessful exit invalidates previous acceptance with a fresh FAIL receipt; cancelled process groups propagate termination into nested detached runners.

`npm run cli:audit` executes every registered command/subcommand against disposable local v5/uninstalled fixtures and records command, channel, real exit/status, output bytes and duration. A test-case PASS means the command contract was exercised; an expected BLOCKED result is never production acceptance. Dedicated regression files own successful installer, upgrade, rollback, claims, gate and release lifecycles. Forwarded finite helpers now have explicit deadlines (normally 2 minutes; Test/Audit/Launch 10 minutes), process progress and a `CLI_HELPER_TIMEOUT` failure. The typed `launch service start` is intentionally a long-lived service and requires separate configured-host verification.

Upgrade revalidation has one 10-minute total budget, overridable through `executionkit upgrade-revalidation run . --timeout-ms <ms>` from 1 second to 1 hour. Stage events and heartbeat remain available during heavy checks, fail-fast leaves unrun checks pending, and timeout never certifies them. Active update owners retain their locks regardless of elapsed age; recovery requires an abandoned local owner. Update writes refuse symbolic-link paths and failed Git inspection cannot count as a clean project.

Visual acceptance requires current full-page rendered coverage, CSS/font/hit-test observations, actual image-bound review and independent certification. Native review requests remain pending until the host supplies real reviewed responses; command retries reuse pending images. P0/P1 and pending Visual reviews cannot pass any acceptance matrix, including v4 compatibility. Visual invariant revision 4 requires historical revalidation/recapture; static reports and staging images cannot certify production delivery.

## Production truth guard contract

AntiFake is part of the existing Surface Integrity fabric: changed production files at task integration, full source at canonical boundaries and independent Audit. Explicit fake/mock/placeholder/failure-success findings and ambiguous literal business payload review block acceptance. SOURCE_ONLY PASS never replaces genuine backend/API/DB and rendered journey evidence. Test fixtures remain isolated.

Launch owns read-only Vhost Guard: mandatory for v4/v5 Laravel local-release targets, native Apache/Nginx effective config, HTTP/HTTPS domain coverage, current/public root or verified declared alias, selected pinned CWP custom template pairs, pre-switch/post-health drift checks and actual-domain HTTPS release marker. No new OS, watchdog, automatic server rewrite or guessed hosting adapter.

Visual OS concrete defects and unresolved review/evidence feed bounded Decision quality signals. Compiled denial remains stronger than advisory knowledge; resolved generic heuristics cannot reopen independently proven rendered acceptance. CLI defaults retain outcome/blockers/next action and bounded heartbeat; `--progress` adds compact stages, `--full-output` adds raw debugging detail.

## External Services & Provider Readiness Gate

Launch requires the source-bound provider inventory and independent target/account/artifact evidence defined in `contracts/provider-readiness-contract.md`. Deployment success never certifies external delivery. Mandatory missing providers deny release, approval and publication; approved feature restrictions permit only a partial launch. No inventory, stale evidence, sandbox-only checks, mock adapters or unsigned acceptance can establish production readiness.

## Required v5 Visual Production — vector-first, image quota, licensed online fallback

At wave/phase/release UI acceptance, Visual OS additionally requires real `executionkit.media.json` scene/role inventory for **every** hero, banner, background, original illustration, icon, empty state and dynamic-category image. See [contracts/visual-production-v5-contract.md](contracts/visual-production-v5-contract.md) and `lib/visual-production.mjs`. No silent exceptions: all seven role slots per discovered screen are covered or explicitly reviewed not-applicable.

**Creative execution order:** (1) hand-author original premium SVG/vector/CSS/Flutter drawings whenever suitable, with **zero raster model calls**; (2) spend limited image-generator quota only on complex high-impact artwork; (3) if quota exhausted, Anti-Gravity **must research carefully matched online sources with verified commercial-use and modification rights**, perform real composition/palette/resizing edits and keep original source/license/attribution evidence; (4) mark unresolved if no lawful high-quality match exists. SVGs must be original safe source with no external references or embedded raster. Never claim an unlicensed edited photo is newly generated art. Use theme-aware variants or reviewed neutral artwork according to real project tokens; WebP for server-hosted raster, app-private local-first cache where relevant.

Compiled deterministic Decision OS denies incomplete/unverified Visual Production quality or release signals; reviewed KB lessons can only trigger REVIEW. The production gate is boundary-scoped (not per edit); no generator/model/network work inside Decision OS. Actual screen screenshots and platform functionality remain independent requirements.


### Practical Anti-Gravity visual inventory commands

`executionkit visual media-plan . --limit=50` creates a **read-only paginated task list** from real UI surfaces covering heroes, banners, backgrounds, icons, illustrations, empty states and dynamic category art. It directs original SVG/native composition first, high-quality raster generation only where needed, licensed online image search/edit if quota is exhausted, or a precise BLOCKED status when unavailable. `executionkit visual media-check .` validates actual media receipts and fails release if incomplete. Neither command creates an image or substitutes for visual screenshots. Details: [contracts/visual-production-v5-contract.md](contracts/visual-production-v5-contract.md).
