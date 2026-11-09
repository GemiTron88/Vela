# Visual OS V2

The kit certifies the **current rendered product state** through the unified lifecycle:
`Discover -> Design Direction -> Implement/Refine -> Capture -> Critique -> Remediate -> Re-capture -> Independent Certification`.
Fixes produce a new source-bound capture and fresh image review; mandatory before/after albums are removed. Historical comparisons remain optional, including detection of copied Entlaqa reference evidence.

| Layer | Executable owner | Evidence |
| --- | --- | --- |
| Census / impact / pairwise matrix | `visual-surface.mjs` | canonical surfaces, states, source hashes, exact cells |
| Design Direction & 9-pass refinement | `skill.design-refinement`, `visual-critic.mjs`, `ux-guard.mjs` | 5-part Design Direction, 3 intervention levels, 9 conceptual passes |
| Web / Android / iOS capture | `visual-capture.mjs`, project hooks | actual PNG, live geometry, sanitized trace, runtime log |
| Image and geometry analysis | `visual-image.mjs`, `visual-geometry.mjs` | decoded pixels, hashes, measured layout findings |
| Vision critique & native submission | `visual-critic.mjs` (`inspectVisualRun`, `submitNativeVisualReview`) | native Antigravity host inspection, image-bound response submission (`--response`), 21 dimensions |
| Independent verification | `visual-audit.mjs` | recomputed coverage, integrity, runtime, current full certificate |
| Native E2E checkpoints | `visual-journeys.mjs` | same agent page, nonce/source/image-bound checkpoint receipts |
| Lifecycle / delivery | `visual-boundary.mjs`, CLI, installer, managed CI | bounded impact/full gates and release rejection |

Read [the normative contract](../../contracts/visual-os-v2-contract.md) for schemas, hooks, operator keys and limitations. The CLI preserves existing static Visual OS requirements, component/design authority, accessibility, responsive and Flutter checks. Declarative rendered review claims now fail closed.

Start with `executionkit visual discover . --init`, bind actual metadata and hooks, commit the clean candidate, then run:

```bash
executionkit visual discover .
executionkit visual plan . --mode impact --base HEAD~1
executionkit visual capture . --mode impact --base HEAD~1
executionkit visual inspect .
# When provider is 'antigravity', submit the independent reviewer's image-bound JSON per cell:
executionkit visual inspect . --run <runId> --cell <cellId> --response <review-json-file>
executionkit visual validate . --human
# At a phase/release boundary:
executionkit visual capture . --mode full
executionkit visual inspect .
executionkit visual certify .
executionkit visual validate . --release
```

Missing authentication/build probes/device instrumentation block their applicable cells. Fixture-based kit infrastructure pilots do not certify an authenticated customer product or a native Flutter build. Self-hosted CI is manual and exact-SHA; no automatic hosted-minute suite is introduced.
