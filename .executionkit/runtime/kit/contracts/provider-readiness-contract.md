# External Services & Provider Readiness Gate

**Authority:** Owned by **Launch OS** (`executionkit launch providers|providers-discover .`). Decision OS consumes deterministic provider readiness signals; KB rules may escalate `REVIEW` only.

## 1. Inventory & Bounded Discovery

- `executionkit.providers.json` (`executionkit-providers/v1`) is the sole project provider inventory (`validateProviderInventory` in `lib/provider-readiness.mjs`). Each provider declares stable `id`, `category`, `driver`, `implementationClass` (`external`, `mock`, `stub`, `disabled`, `incomplete`, `internal`), `capability`, non-empty `features` and `journeys`, `environments`, `policy` (`required`, `optional`, `conditional`), `intendedEnabled`, `discoveryKeys`, credential variable **names** (never values), approvals, callback/delivery requirements, owner, and next action.
- `executionkit launch providers-discover .` performs bounded source discovery (max 60,000 entries, 12,000 files, 2 MiB/file, 32 MiB total), emitting only file paths, provider keys, and variable names. Any runtime source change invalidates prior inventory/evidence digests. Even provider-free products use an explicit empty inventory with signed coverage proof.

## 2. Independent Cryptographic Evidence

- Host trust is configured via `EXECUTIONKIT_PROVIDER_TRUST_FILE` (an absolute JSON file outside the repository with `schemaVersion: "executionkit-provider-trust/v1"` and Ed25519 public PEM `keys[]` enrolled for `verifier`, `owner`, or `vendor` roles).
- Active proof bundles live at `.executionkit/providers/<providerDigest(context)>.json` containing signed `executionkit-provider-proof/v1` envelopes (`keyId`, `payload`, base64 `signature` over `"executionkit-provider-proof/v1\n" + canonical(payload)`).
- **Allowlisted Payload Fields:** `schemaVersion`, `kind` (`coverage`, `verification`, `owner`, `vendor`, `deferral`), `providerId`, `driver`, `context` (`sourceDigest`, `inventoryDigest`, 40-char `commit`, `candidateId`, `artifactSha256`, `environment`, `targetId`), `checkedAt`, `expiresAt` (max 24h TTL), `receiptSha256`, `accountSha256`, `mode`, `checks` (`configuration`, `credentials`, `account`, `connectivity`, `delivery`, `callback`, `endToEnd`, `tests`, `restrictions`), `disabledFeatures`, `conditions`, `approved`. Raw secrets/tokens/PII are rejected.

## 3. Provider States & Release Verdicts

- **Provider States:** `NOT_DISCOVERED`, `NOT_CONFIGURED`, `CONFIGURED_UNVERIFIED`, `SANDBOX_VERIFIED` (blocks production), `PRODUCTION_VERIFIED` (real external driver + full verification + owner/vendor approvals), `OWNER_DEFERRED` (feature-scoped only, `intendedEnabled: false`, signed owner deferral + verifier proof that dependent features are restricted), `BLOCKED`, `NOT_APPLICABLE`. Release-wide mandatory providers cannot be deferred.
- **Release Verdicts:** `OPERATIONAL_READY`, `PARTIAL_LAUNCH_APPROVED` (never becomes `FULLY_OPERATIONAL`), `EXTERNAL_PROVIDER_BLOCKED`, `EXTERNAL_SIGNOFF_PENDING`. Evaluated in final release validation and immediately before deployment activation.
