# ExecutionKit v4 publication

`TODO.md` is the only task authority. Publication is manual and exact-candidate bound. The canonical AI ExecutionKit repository has a narrow GitHub-hosted Linux x64 exception for this release workflow only; installed projects remain self-hosted-only. A version string, source commit, tag name, local test or queued workflow is never release proof.

## Physical exact-candidate workflow

Use **Actions → ExecutionKit v4 release candidate → Run workflow** on `main`.

Inputs:

- `candidate_sha`: the full 40-character final `main` SHA.
- `target`: fixed to the GitHub-hosted canonical Kit target, `linux-x64`.
- `publish_release`: keep false for verification-only runs; set true only when the same passing run should publish the accepted candidate.

The canonical Kit release workflow runs manually on `ubuntu-24.04` and verifies `linux-x64`. This exception applies only to `.github/workflows/v4-release-candidate.yml` in this repository. Installed projects remain self-hosted-only; automatic push/PR/scheduled execution and generic remote shell dispatch remain forbidden.

The `release-target` job has read-only repository permission. It checks the exact source/physical target, installs exact dependencies, runs `npm run v4:check`, verifies the packaged artifact/CLI dispatch and uploads target evidence.

## Publication

When `publish_release=true`, the separate `publish-release` job runs only after `release-target` succeeds and receives `contents: write` permission. `scripts/publish-v4-release.mjs` then:

1. verifies checked-out HEAD equals `candidate_sha`;
2. verifies `VERSION` and root package version agree;
3. creates an annotated `v<version>` tag if absent, or fails if an existing tag targets another commit;
4. resolves the annotated tag back to the exact candidate;
5. creates the GitHub Release object if absent;
6. re-fetches the Release by tag and emits the durable release identity.

Publication is idempotent for the same candidate and fails closed for a conflicting tag. The workflow is manual-only; no push or schedule trigger exists.

## Certification truth

Each advertised target needs physical evidence. A target with no physical passing run remains NOT_RUN/uncertified. Do not infer Windows/macOS/ARM results from Linux or from source portability. Exact evidence stays in the workflow artifact and release claims must identify the tested target.

## v4.1.0

v4.1.0 introduces first-class Agentic E2E (`tester-army/e2e`) integration in Test OS (3/3 journey classes, replay/live-agent fallback, independent oracles) and Visual OS V2 (`CURRENT_STATE` visual QA, canonical surface/state census, bounded pairwise coverage, geometry/vision critic, standalone Ajv schema validation without ambient npm packages). Exact candidate verification and release publication follow the canonical Kit-only GitHub-hosted Linux x64 manual workflow.

## v4.0.4

v4.0.4 removes the blocking synchronous Antigravity hook. It is a source candidate only until the exact-candidate workflow passes on the canonical GitHub-hosted Linux x64 target and the GitHub Release object is re-read successfully.

## v4.0.3

v4.0.3 introduces Context Economy for the normal model hot path: compact/minified envelopes, exact task pointers, lazy resource loading, worker micro-context and a 12 KiB fast-context budget. Source promotion alone does not certify the release. The official release exists only after the exact-candidate workflow passes and the GitHub Release object is re-read successfully.
