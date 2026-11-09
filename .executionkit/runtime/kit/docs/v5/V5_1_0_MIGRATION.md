# ExecutionKit v5.0.1 → v5.1.0 migration

**Status: canonical migration guide for ExecutionKit v5.1.0.** Published baseline is **5.1.0**. The [v5.1.0 reconciliation record](V5_1_0_RECONCILIATION.md) records the completed verification evidence.

## What changes for existing UI projects

Visual Production is a mandatory boundary obligation for applicable UI-bearing projects, alongside independently reviewed Visual OS V2 evidence. Existing accepted screenshots do not automatically prove media completeness, provenance or current theme coverage.

Before the next wave/phase/release:

1. Discover actual primary/secondary screens, tabs/details, dialogs/sheets/forms, empty/loading/offline/error/permission states, responsive layouts and real theme/palette choices. Incomplete discovery remains blocked; selecting a narrow source scope does not waive other UI.
2. Run `executionkit visual media-plan . --offset=0 --limit=50`, continue every returned page and create the real project-root `executionkit.media.json` inventory defined by [the contract](../../contracts/visual-production-v5-contract.md).
3. Map all seven roles for each discovered screen: hero, banner, background, illustration, icon, empty and dynamic. A role marked not-applicable requires a screen-specific rationale and actual independent image-bound review evidence.
4. Produce real artwork and retain exact source/export files, hashes, variants, rights and review evidence. A prompt or manifest entry is not an exported asset.
5. Run `executionkit visual media-check .` and source `executionkit guard assets . --all`; fix the actual findings. Neither replaces independently signed rendered review/certification or functional tests.
6. Complete applicable Visual/Test/Audit/Decision/Launch gates at the actual candidate. Unresolved mandatory violations do not inherit a PASS from v5.0.1 history.

Non-UI libraries, infrastructure and CLI projects do not need decorative images. Platform-specific server/offline/mobile obligations apply only where the product actually uses them.

## Artwork production and rights

Choose original native SVG/vector/CSS/Canvas/Flutter/procedural drawings first where suitable; keep SVG icons vector. Use host image generation for complex compositions, with planned masters/variants to conserve quota. If generation is unavailable or quota-limited, research closely matched online sources with verified commercial modification rights, then perform actual permitted edits/optimization and independent visual QA.

Keep original source URL, author, license, required attribution and transformation evidence. Reject unclear/noncommercial/no-derivatives/watermarked sources. A similar search result gives no reuse rights; raster wrapped in SVG is not original vector art. If no lawful quality match exists, leave required artwork BLOCKED.

Use project tokens, actual palette IDs, Light/Dark, RTL/LTR, responsive crops and accessible contrast. Meaningful objects must not be arbitrarily inverted/recolored. Theme neutrality needs legitimate review. Server/private/local-first media evidence must represent actual delivery, offline reuse, isolation and invalidation where required; URLs and booleans alone do not prove those behaviors.

## Receipt and binary verification changes

V5.1 hardening uses **artwork-review/v2** and **role-exemption/v2** receipts with the existing Visual signature mechanism, separate producer/reviewer identities and exact source SHA. Required artwork must have real UI bindings. A neutral theme asset requires explicit independently reviewed `neutralThemeApproved` evidence. V1 self-declared JSON is not automatically accepted as V2 review; recreate/review evidence against the actual current source and exports using the authoritative contract.

Generated and owned-original artwork require a signed production receipt. Licensed edits bind the original-file and rights-page snapshot hashes and signature to actual local source evidence. Applicable server publication/cache evidence is loaded and signature/hash-bound; a path string or boolean does not satisfy it. Exact schemas and producer requirements are defined by the current [Visual Production contract](../../contracts/visual-production-v5-contract.md); do not invent signatures or copy examples as approvals.

PNG decoding and conservative static SVG validation use bundled JavaScript. JPEG/WebP/AVIF verification additionally requires **Python 3 with Pillow on the validation host**. The bounded decoder uses no network, caps input at 12 MiB and output at 24 million pixels, and times out after five seconds. Missing decoder fails with `VISUAL_MEDIA_DECODER_UNAVAILABLE`; it does not fall back to trusting file signatures. Provision the real host prerequisite through normal environment administration before release checks, without running mobile builds or installing Android tools on a server. Supported codec availability still depends on the actual Pillow host build.

## CLI and configuration compatibility

The relevant implemented CLI surfaces are `visual media-plan` and `visual media-check`; inspect each with `--help` for current pagination/verification flags. `media-plan` is read-only; it does not create imagery. The executable registry remains `lib/v4-cli-contract.mjs`; `v4` filenames, existing config keys and EK4 integration IDs remain preserved compatibility interfaces.

`executionkit.media.json` uses the contract's explicit schema identifier and evidence paths. Follow the exact current contract rather than copying old free-form media lists. Tightened validation may reject previously accepted incomplete or unsafe evidence. Do not bypass it by changing the schema string, inventing a hash or claiming an unreviewed role is irrelevant.

Root/project `AGENTS.md`, current README/playbooks and routed skills/rules must follow the V5 authority. `STANDARD.md`, `STANDARD_V3.md`, legacy daemon/MCP/fleet/bootstrap guides and historical release evidence remain migration/history only. `STANDARD_V4.md` applies to actual V4 installations.

Decision OS remains deterministic and model/network-free during evaluation. Host tools handle creative generation/research outside the engine. Typed quality/release signals cannot weaken compiled mandatory denial. ALLOW grants no authorization and KB rules may escalate REVIEW only.

## KB schema and snapshot

General knowledge is maintained first in `GemiTron88/KB` main. Schema v2 compatibility, catalog digest/counts and meaningful revision semantics remain mandatory. Update catalog and manifest together, validate canonical source, then synchronize the exact same snapshot into Kit `lib/decision/knowledge/catalog.json` and `manifest.json`. Confirm byte parity and the consumer's reported revision/digest.

Do not bump revision without meaningful approved content, fabricate daily modifications or copy private chats/customer identities/credentials/product source into facts. Installed boundary TTL refresh is distinct from daily source curation and cross-repository synchronization. Private read-only `GEMITRON_KB_TOKEN` belongs outside tracked files; cross-repository publication needs its own actual narrow authority. Failed refresh preserves validated offline knowledge; ordinary task entry/evaluation remains offline.

## Upgrade procedure

Use an exact verified **published** v5.1.0 source commit only after release acceptance. Until then use an isolated test project for candidate verification; do not describe the candidate as a released upgrade.

1. Record current project branch/HEAD, installation identity, runtime VERSION, transaction history and existing evidence. Preserve product/native instruction changes and a tested project-specific recovery path.
2. Preview from the installed project:

```bash
executionkit update . --source /path/to/verified-kit --dry-run
```

3. Inspect actual collisions/invariant changes and source identity. Apply within existing project authority and retain the returned transaction ID:

```bash
executionkit update . --source /path/to/verified-kit --apply
executionkit doctor .
executionkit upgrade-revalidation status .
executionkit upgrade-revalidation plan .
executionkit upgrade-revalidation run .
```

4. Correct discovered gaps, complete relevant Visual Production and rendered evidence, then run focused regression and required boundary gates. Pending historical revalidation, partial scans or unrun tests are not PASS.
5. Verify the runtime VERSION, exact installed source, current commands, KB parity and real release candidate evidence. A changed version string alone is insufficient.

For a V4 installation, self-update preserves the V4 line; use the existing explicit major-upgrade procedure and inspect its plan rather than silently converting a mature project. Preserve native TODO IDs, accepted history and managed compatibility identifiers. No new Docker/service/AI dependency is introduced by this guide.

## Rollback

Keep the pre-upgrade source identity and actual transaction ID. For installation rollback:

```bash
executionkit rollback . --transaction <id>
executionkit doctor .
```

Verify restored runtime/config/rules/receipt against the recorded pre-upgrade state. This is distinct from application deployment/data rollback. Production rollback uses authorized Launch procedures and project-specific data recovery; do not assume code rollback reverses migrations/customer transactions.

Never rewrite the published v5.0.1 tag or delete its recovery artifacts. Retained rollback must be verified, not merely configured. Do not treat restored older evidence as approval for new work that it never covered.

## Windows, VPS and release acceptance

Android remains foreground Launch execution on an owner-enrolled detected physical Windows workstation, with real artifact/device or approved emulator evidence. No mandatory background Build Agent or Shorebird. VPS/server/container hosts must never build APK/AAB/debug APK, run Gradle/mobile Flutter, download Android SDK/build tools/images or run emulators. Missing hardware remains BLOCKED.

The canonical Kit distribution requires no new VPS staging service; real production deployments retain exact-candidate authorization, backups, health and rollback. Consumer CI remains deliberate manual/self-hosted; the canonical source repository's manual hosted exception does not propagate to projects.

The release of ExecutionKit verifies its tooling and enforcement at the recorded candidate. It does not prove that every consumer has produced its imagery, refreshed knowledge or passed platform acceptance. Each project must independently satisfy the gates applicable to its actual release.
