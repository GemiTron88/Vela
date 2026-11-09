# Production Deployment Fabric Contract

**Authority:** Executable cross-cutting deployment capability under **Launch OS** (`executionkit launch plan|build|verify|host-plan|host-check|storage|backup|release|deploy|rollback .`). Never owns canonical task state.

## 1. Allowlist Production Artifact (`launch build|verify`)

- Production artifacts are built from a strict **allowlist** (`deployment.sourceRoot`, default `.`).
- **Hard-denied:** `.git/`, `.github/`, `.agents/`, `.executionkit/`, docs/Markdown, tests/specs/coverage, `TODO.md`/`AGENTS.md`/`PLAYBOOK.md`, `.env`/secrets, database dumps, design sources, source maps, symlinks, `bootstrap/cache/*.php`, and source `node_modules/` or `vendor/` (Composer production dependencies are installed from `composer.lock` inside the staged release; verified Node standalone runtime dependencies are the only exception).
- Every manifest binds paths, byte sizes, modes, and SHA-256 to the exact Git HEAD and source plan (default budgets: 50,000 files, 1 GiB total, 128 MiB/file). Validation enumerates the complete payload and streams secret scans across all files.

## 2. Host Isolation, Privilege & Atomic Activation (`launch deploy|rollback`)

- **Privilege Model:** `UNPRIVILEGED_AFTER_BOOTSTRAP` (`sudoDuringDeploy=true` is forbidden). Source workspace and production target (`local-release-root`) are separate authorities; never `git pull` or build inside the production root.
- **Deployable vs Non-Deployable:** Repositories with `distributionRepository=true` and `deployment.enabled=false` return `RELEASE_READY_NON_DEPLOYABLE` on `launch release` and reject `launch deploy --authorize`.
- **Exclusive Lock & Staging:** Acquires `.executionkit-deployment.lock` in the production root. Stages immutable releases under `<releaseRoot>/releases/<release-id>`, verifies the manifest before hooks, installs locked `--no-dev` Composer dependencies, links explicit `sharedLinks` (`.env`, `storage`), runs direct-argv (`shell: false`) pre-activation commands while `current` stays on the previous release, and sets generated `bootstrap/cache/config.php` to `0640`.
- **Backup Before Activation (`requireBackupBeforeActivate=true`):** Streams a mode-`0600` gzipped MySQL/MariaDB dump under the deployment lock (`executionkit launch backup . --authorize`), verifies checksum and non-empty decompression, and confirms Laravel's resolved production DB/env (`APP_DEBUG=false`) matches the backup target before migrations and activation.
- **Atomic Switch & Attestation:** Atomically switches the `current` symlink (never destructively converting a real directory), runs post-activate commands, verifies HTTP health and cache-busted `attestationUrl` release marker (`/.well-known/executionkit-release.json` with exact release ID and Git HEAD), and automatically rolls back to the previous release if post-activation checks fail.

## 3. Vhost Guard & CWP Rebuild Safety (`guard vhost` / `launch host-check`)

- For Laravel `local-release-root` targets, `host-check` and `executionkit guard vhost .` require `deployment.vhost` (`enabled: false` cannot bypass).
- Runs native `nginx -T` or Apache `-t -D DUMP_INCLUDES` + `-S` (15s budget) to verify HTTP/HTTPS coverage and prove the document root is `<currentLink>/public` (or `target.publicLink -> current/public`, never the application root).
- When CWP hosting is configured or detected on disk, `panel: "cwp"` requires `cwpBindings` with observed `selectionFile`, custom `.tpl`/`.stpl` template paths, and 64-char SHA-256 hashes selected via CWP WebServers Domain Conf (never editing stock templates or generated vhosts). Host truth is verified before activation and re-verified after health checks.

## 4. Release & Build-Cache Retention (`launch storage`)

- Runs only after healthy activation, HTTP attestation, and receipt persistence (never on failed deploy or rollback).
- Default `deployment.retention`: `enabled=true, keepRollbacks=0, minimumAgeMinutes=0, cleanupLegacyReleases=true`. Zero rollbacks retains only the active release once worker retirement (`retention.workerUsers` process birth-tick and cwd/exe barrier check) is proven; surviving old workers or protected/unknown directories defer cleanup (`DEFERRED`) without failing the deployment.
