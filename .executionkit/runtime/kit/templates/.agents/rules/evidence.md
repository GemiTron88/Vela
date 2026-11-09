# Evidence Rule

No agent may convert an implementation claim into acceptance without reproducible evidence appropriate to the task contract.

Evidence must identify what was checked and where the result can be verified. Passing unrelated tests, screenshots without provenance, fabricated command output, or prose-only assertions are insufficient. High-risk work requires stronger independent verification.

For release/production claims, a self-authored evidence file or evidence_origin label is not provenance. Required runtime/black-box proof must come from the configured trusted candidate-bound collector. Evidence for one isolated task must not be generalized into acceptance of a critical journey or phase.

## Durable terminal evidence

Never set a canonical task to `ACCEPTED` or `RELEASED` while its only local Evidence reference lives under `.executionkit/**`. Seal concrete runtime evidence with `executionkit proof seal . --task <id> --apply` (or `executionkit todo complete . --task <id> --verify "<cmd>" --apply`), commit the rewritten task plus `docs/execution/evidence/tasks/<id>/`, then require `executionkit proof status . --task <id>` to pass. Missing/stale Evidence or Code references are correction work, not ignorable documentation drift.

## Executable agentic evidence

Agentic Browsing 3/3 requires the three executed journey classes per required target/role under `contracts/agentic-e2e-contract.md`. Never infer acceptance from static receipts, test counts, screenshots alone, mocks or browser emulation of native Flutter. Preserve backend and stable deterministic contracts. New tests must cover a distinct risk/invariant; consolidate duplicates rather than padding counts.

Visual OS uses CURRENT_STATE: capture -> inspect actual pixels -> fix -> recapture -> reinspect -> independent audit (`executionkit visual capture|inspect|certify|boundary .`). BEFORE/AFTER is optional. Never claim review from file existence, folder names, declared requirements, a report or static code. Never copy after images into before, fabricate images, blindly update baselines, pad screenshot counts, hide P0/P1, or replace functional tests with screenshots. Reconcile canonical surfaces/states against required cells. The reviewer must differ from the capture producer. Use synthetic fixtures, private-field masking, protected secrets and bounded artifact retention. Bind acceptance to the newest source/image; a replaced image invalidates its old review and dispositions. Read `contracts/visual-os-v2-contract.md`.

AntiFake production findings block integration and boundaries. Synthetic fixtures may support isolated tests or explicitly labelled visual capture, but must never enter production paths or serve as live business-data acceptance. Require real backend failure recovery, genuine source records and current rendered states; a clean static scan is SOURCE_ONLY.
