# ExecutionKit v5 Operator Playbook

Published baseline: **5.2.3**. See [v5.2 Execution Signals plan](docs/v5/V5_2_0_EXECUTION_SIGNALS_PLAN.md), [v5.2 collaboration](docs/v5/V5_2_EXECUTION_COLLABORATION.md), [Unslop & Visual Critic integration](docs/v5/UNSLOP_VISUAL_CRITIC_INTEGRATION_20261107.md), [v5.1.0 reconciliation](docs/v5/V5_1_0_RECONCILIATION.md) and [v5.0.1 → v5.1.0 migration](docs/v5/V5_1_0_MIGRATION.md). Current authority: [AGENTS.md](AGENTS.md), [STANDARD_V5.md](STANDARD_V5.md), live runtime and canonical `TODO.md`. [STANDARD_V4.md](STANDARD_V4.md) governs retained V4 compatibility only.

## TODO-first owner entrypoint

`TODO_FIRST_ENTRY_INVARIANT`: the owner opens `TODO.md` and continues task by task. The agent must enter through the project-local runtime once per session or canonical task transition:

```bash
executionkit start . --host antigravity
```

Obey blockers/`nextCommand`, read the exact task and routed `.agents` resources, and reuse the envelope. Do not preload full TODO/README/playbooks/knowledge or repeat deep scans after every edit. Antigravity `/goal` and host checklists are derived mirrors only (`HOST_CHECKLIST_DERIVED_MIRROR`); canonical TODO remains authoritative.

V5 uses all eleven ExecutionKit systems. V4 compatibility used all ten ExecutionKit systems and exactly ten executable systems; do not select that count for a V5 runtime. State recovery follows **BOOT → REHYDRATE → VERIFY → RESUME**. Context is disposable; live repository state is reconstructable. Memory, reports and derived State are ADVISORY_ONLY.

## Onboard or update a project

Use an exact verified canonical Kit source. From that source, preview before applying:

```bash
executionkit install /path/to/project --source /path/to/verified-kit --dry-run
executionkit install /path/to/project --source /path/to/verified-kit --apply
```

Inspect collisions and preserve native instructions/task IDs/project files. In an installed project use `executionkit update . --source /path/to/verified-kit --dry-run`, then `--apply` after reviewing its actual plan. Keep transaction IDs and verify:

```bash
executionkit doctor .
executionkit upgrade-revalidation status .
executionkit upgrade-revalidation plan .
executionkit upgrade-revalidation run .
```

New enforcement invariants revalidate applicable accepted history; skipped/unrun/pending checks do not pass. `executionkit rollback . --transaction <id>` restores a prior installation transaction, distinct from production application rollback. See [V5.0.1 → V5.1.0 migration](docs/v5/V5_1_0_MIGRATION.md).

## Implement and integrate one task

Inspect live source/schema/tests/evidence, respect owned scope, implement real functionality and use focused checks. No production demo/mock/fixture imports, placeholder business data, unfinished handlers or failure-as-success. Use actual providers and honest empty/error/loading/offline/retry states. Test fixtures remain isolated.

`NEVER_GUESS_DATABASE_TRUTH`: consult `executionkit db table|column|model` and current route metadata before related changes. A source PASS cannot prove live database rows, form success or rendered translations.

During Kit edits run the narrowest relevant regression, for example:

```bash
npm test -- --target tests/v5-visual-production.test.mjs
```

For Laravel use `php artisan test --filter <TestName>`. Before integration:

```bash
executionkit reconcile task .
```

That runs changed-file DB/Route/Surface/AntiFake plus local Decision/State reconciliation. Do not run Product Closure/full Test/Audit/Docs/Visual on every task. Update canonical tasks and retain exact evidence. A timeout, exception, deferred check or expected refusal is never feature acceptance.

Before creating or pruning tests use `executionkit test portfolio . --base HEAD~1`; preserve unique security/business/recovery invariants. Full expensive CI is phase/release work (`PHASE_BOUNDARY_FULL_CI`), not per edit. Agentic E2E needs real critical happy-path, cross-feature and adversarial recovery journeys with backend/UI oracles, not one shallow generated file per route.

## Delegate safely

`executionkit agents run .` prepares claims but does not spawn workers. Use a real host-native spawn tool for independent scopes; record its real returned worker ID:

```bash
executionkit agents delegated . --claim <id> --spawn-tool <tool> --worker-id <id>
```

If the host has no spawn tool, decline untouched claims with `executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE` and continue sequentially. Workers do not own TODO or final integration. Reconcile integration seams and rerun affected verification. During long Visual/Lighthouse/Test work advance safe independent preparation; never race shared state or evidence.

## Plan premium visual production

The **Premium Experience Layer** is mandatory for UI-bearing products. Render → inspect → correct → re-render. Start from actual project tokens, canonical components, palette IDs, Light/Dark, language/RTL and mobile-first constraints. Non-UI projects need no decorative imagery.

```bash
executionkit visual discover .
executionkit visual media-plan . --offset=0 --limit=50
executionkit visual media-check .
```

Follow every returned page of `media-plan` and all legitimate discovery scopes. A partial scan cannot establish complete coverage. Inventory screens, tabs, details, dialogs, sheets/forms, empty/loading/offline/error/permission states and responsive/theme/palette cells. Every discovered screen accounts for hero, banner, background, illustration, icon, empty-state and dynamic imagery. A role exception needs a specific reason and independently reviewed screenshot-bound evidence, not generic prose.

Production sequence:

1. Author original safe SVG/vector/native shapes, CSS/Canvas/Flutter/procedural art or use an appropriate licensed icon system. Do not rasterize SVG icons without need or embed raster inside SVG and call it original vector.
2. Use host image generation for genuinely complex compositions; plan identity-consistent masters/variants to conserve quota.
3. If quota/provider is unavailable, research closely matched online sources in the authorized host. Verify original source and commercial modification rights before download. Reject unclear, noncommercial, no-derivatives and watermarked sources.
4. Perform actual permitted crop/resize/composition/color/theme edits; record source URL, author, license, attribution, transformations and exact exported variants. Review real UI placement and match to the approved scene.
5. If no lawful quality match exists, keep the required artwork BLOCKED. A prompt, manifest row or matching-looking search thumbnail is not a delivered asset.

## Verify assets and review actual screens

`visual media-check` validates Visual Production mapping/artifact evidence. `executionkit guard assets . --all` checks source asset integrity; use the actual reports together, not as interchangeable claims. Verify actual files/UI bindings, hashes, binary decoding/MIME/format/size limits, safe SVG, provenance and all required variants. JPEG/WebP/AVIF verification needs Python 3 with Pillow on the host; missing decoder is `VISUAL_MEDIA_DECODER_UNAVAILABLE`, never PASS. PNG and conservative static SVG use bundled JavaScript; no network installs run during validation. Use current signed artwork-review/v2 and role-exemption/v2 receipts with source hashes and separate producer/reviewer identity. Retain signed production/ownership receipts or exact original/rights snapshot proof for licensed edits, plus real applicable signed server/cache receipts. Theme-neutral artwork needs legitimate review, not a convenient missing variant.

Use responsive optimized raster delivery and WebP where the server pipeline requires it. Preserve original vector sources. Server-hosted/private media needs actual serving, cache/integrity and access-scope evidence; persistent local-first/offline cache requirements apply where relevant. Do not impose APK caching on a CLI project or bundle an unbounded image catalog into a mobile APK. Never represent booleans/URLs as live delivery or legal proof.

Capture and inspect with the current Visual V2 run:

```bash
executionkit visual plan . --mode full
executionkit visual capture . --mode full
executionkit visual inspect .
executionkit visual certify .
```

Inspect each command's actual pending run/next action before continuing. Native `inspect` queues real host image review and waits for signed responses; retries do not review pixels. Reuse the pending run rather than recapturing blindly. Independent certification, CSS/font/action/state observations and actual responsive/RTL/theme screenshots remain required. Pending review, P0/P1, obstructed controls or incomplete coverage cannot pass. See [Visual V2](contracts/visual-os-v2-contract.md) and [Visual Production](contracts/visual-production-v5-contract.md).

## Decision troubleshooting and KB maintenance

Decision is local/deterministic/model-free; ALLOW is not authority. Inspect typed signals and evidence rather than changing compiled mandatory denials or adding a permissive KB rule:

```bash
executionkit decision status .
executionkit decision align . --task <id>
```

Clarify actual task scope or fix evidence/source defects. A legitimate goal revision needs explicit review and exact digest acceptance; it does not waive outside-scope findings. Unknown/malformed inputs must fail deterministically. Host creative generation/research never runs inside policy evaluation.

Maintain general knowledge in `GemiTron88/KB` main first. Read its AGENTS, validate source catalog/schema/manifest with `node tools/prepare-release.mjs` then `npm test`, and commit catalog/manifest together only for meaningful approved knowledge. No private chats, identities, credentials or product source; no artificial daily revision bumps. Synchronize the exact validated catalog and manifest into Kit `lib/decision/knowledge/`, verify byte parity and consumer revision, then run relevant Decision/KB regressions.

Installed private KB refresh uses read-only `GEMITRON_KB_TOKEN` outside tracked files. `executionkit decision refresh .` is explicit recovery; normal refresh is six-hour boundary TTL. Failed refresh retains validated local advice. Daily canonical curation, source snapshot synchronization and runtime refresh are distinct; a workflow configuration is not evidence it ran or has cross-repository credentials.

## Boundary audit and release

```bash
executionkit boundary wave .
executionkit boundary phase .
executionkit launch release .
```

Wave is impact-focused; phase/release deliberately runs the full applicable portfolio. Audit must retain exact candidate and real blockers. Source distribution gates include `npm run check`, `npm run v5:review`, `npm run cli:audit`, applicable Python host guards and actual installer/update/rollback verification. A source command audit may record a valid refusal but cannot certify production functionality.

Launch owns release/deploy/rollback. `launch release` is non-deploying. Only separately authorized activation uses:

```bash
executionkit launch deploy . --authorize
```

It requires exact candidate, mandatory quality/visual/asset/provider gates, backup, target health and rollback. [Provider readiness](contracts/provider-readiness-contract.md) needs independent delivery/signoff; code/config/health alone is insufficient. Never send messages, charge accounts or mutate customer data as probes.

### Windows Android path

On the enrolled detected physical Windows workstation use `executionkit launch mobile . --mode doctor|build|inspect|handoff|import` with command-specific help. Foreground builds and signed APK strategy require no background Local Build Agent or mandatory Shorebird. Build success is not distribution approval. Test actual signed artifacts/production connectivity and retain real device/emulator acceptance evidence according to the project contract.

### VPS deployment path

Servers host web/API/control-plane workloads only. NEVER build APK/AAB/debug APK, run Gradle/mobile Flutter, install/download Android SDK/build-tools/images or run emulators on VPS/server/container hosts. No KVM/resource/agent exception; missing physical hardware means BLOCKED.

For Laravel local hosting:

```bash
executionkit launch host-plan .
executionkit launch host-check .
```

Verify actual Apache/Nginx HTTP/HTTPS public roots, selected CWP custom `.tpl`/`.stpl` pair and guarded-domain HTTPS release identity. Do not guess selection keys, edit generated vhosts or perform unrelated panel/server changes. Standalone Kit publication needs no new VPS staging service; [release policy](docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md) preserves real deployment safeguards.

### Self-hosted CI and exact-candidate evidence

Consumer projects use deliberate manual self-hosted CI, project-scoped runner labels and exact current SHA. No automatic push/PR full-suite policy or hosted fallback. The canonical Kit source has an explicitly manual GitHub-hosted Ubuntu exception; source RC PASS is not production/device acceptance or a tag/release.

## Rollback, storage and incident recovery

Inspect current Launch state before choosing the actual approved recovery path:

```bash
executionkit launch status .
executionkit launch rollback . --authorize
```

Use only with existing site rollback authority, verified retained release and project-specific data recovery plan. Do not assume code rollback reverses migrations or customer transactions. Preserve customer data, backups, live rollback and worker-held releases; verify real health/identity after recovery.

For read-only project storage diagnosis use `executionkit launch storage . --json`. Never copy full agent checkouts into production, scan/clean unrelated directories or blindly delete runtime vendor/standalone dependencies. `DEFERRED` cleanup is not successful deletion. Cleanup needs separate actual site authorization; [release policy](docs/v5/V5_RELEASE_NO_STAGING_POLICY_20261014.md) defines retention.

After interruption run `executionkit state rehydrate .`, inspect live Git/runtime/evidence and resume from canonical TODO. `executionkit state amnesia .` (source compatibility helper `bin/state-amnesia-test.mjs`) tests recovery. Never restore an old PASS over newer failure or manufacture missing receipts. Record the exact unresolved blocker and keep its acceptance unsatisfied.

## Historical migration references

These labels preserve migration vocabulary from `STANDARD_V3.md`; none is the V5 onboarding procedure:

- **SEO OS — conditional search authority**: classify applicability; the compatibility helper is `bin/migrate-seo-os.mjs`.
- **ExecutionKit Agent — optional fleet observability**: old 3.x fleet path with one Agent per physical developer device, not a V5 runtime dependency. `HOST_ACTIVE` and `EXECUTION_ACTIVE` remain distinct historical observations.
- **Control-plane bootstrap mode**: legacy `NOT_CONFIGURED` behavior did not permit replacing canonical task authority.
- **Project migration to current 3.x**: historical helpers/guides remain for actual old projects; current V5 install/update uses the procedures above.

The current command registry is `lib/v4-cli-contract.mjs`. Use command-specific help on demand, bounded JSON/human output and explicit `--progress` / `--full-output`; do not preload every command or reinterpret compatibility names as current version claims.
