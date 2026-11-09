# Launch OS — AI ExecutionKit repository

**Capability level:** `STANDARD`

Release is gated by canonical `TODO.md` and exact-candidate evidence. The safe 3.0 sequence is: finish/review the RC implementation -> make canonical docs coherent -> run the complete pre-promotion gate -> atomically promote version surfaces to 3.0.0 -> run the complete gate on the promoted SHA on physical macOS and Windows -> perform independent release audit -> merge the accepted lineage to `main` -> publish `v3.0.0`.

Changing version text is not a release by itself. PR merge/tag/release must never bypass fresh candidate-bound Test/Audit evidence. Telemetry/control-plane availability is not a release authority; normal Launch OS evidence remains authoritative for release decisions.

## V35 strict release truth

Launch/release now fails closed on unresolved critical journeys, non-convergent phase gates, missing exact-candidate identity, absent required trusted evidence producers, inadequate current test evidence or change-impact revalidation still required. Before promotion run `node bin/validate-integration.mjs . --release`, build the exact candidate, collect configured evidence, run `node bin/analyze-revalidation.mjs . --require-clear`, then execute the normal release-readiness/audit gates.
