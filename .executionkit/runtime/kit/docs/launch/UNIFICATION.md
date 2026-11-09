# Launch OS global release unification — persisted checkpoint

Canonical backlog: root TODO.md, EK4-LAUNCH-MOBILE-001 through EK4-LAUNCH-ACCEPT-004. This report is evidence/context, never a second task ledger.

## Recovered source (2026-10-12)

| Repository | Recovered main | Role |
|---|---|---|
| Elwazeery/AI-ExcutionKit | 16f601f1c8a57d3ac741492c842a6ff5877346e0 | Launch release authority; current-only web retention preserved |
| Elwazeery/APKrelease | 94f5a48e65cb15f3f70eb392f1fdca40770da94f | Mobile implementation and compatibility distribution service |
| GemiTron88/studio | 3ebe119ef263f260cbf9c3cb81e004e514b2e70b | Authenticated central management projection |
| Elwazeery/FLOW | 2aa01f76657caf27b9af9112161b54d7d34c7c40 | First existing SDK consumer |

Remote heads, all open PRs and branches were inspected. APKrelease, Studio and FLOW currently have only main/no open PRs. Kit has historical side branches/open PRs unrelated to this work; they were preserved. Files were materialized from pinned Git blobs and their Git SHA-1 identity checked. Direct Git transport lacks credentials here; the connected GitHub API supports safe expected-head commits.

## Ownership and migration inventory

| Existing APKrelease component | Decision | Boundary |
|---|---|---|
| SQLite Store, jobs, journal, idempotency | Reuse and extend in place as Launch Mobile service | One database/job queue/journal, additive schema migration; no destructive data rewrite |
| Project/signing/approvals/receipts/tracks | Reuse unchanged contracts with explicit Launch ownership | Enrolled build agents never gain approve/release/signing-attestation authority |
| APK verifier and Range/signed manifests | Retain compatibility endpoints | Existing SDK URLs, trust keys and consumers continue functioning |
| Classifier | Reuse with conservative mapping | Dart candidate never authorizes publication; real Shorebird dry-run mandatory |
| Shorebird provider CLI | Retain protected compatibility implementation, route through Launch | Explicit billing and independent approval/device gates preserved |
| Unix worktree runner | Adapt into portable typed workstation executor | No production-VPS fallback; Windows Job Objects/Linux systemd controls required |
| Mobile updater SDK | Retain repository/package and pinned Git refs | No package/signing identity changes or automatic activation |
| Optional independent dashboard | Superseded by Studio integration | No separate dashboard is introduced |
| Existing service/runtime/key/artifact/history data | Retain; inspect and back up on actual host before cutover | Private runtime state unavailable here; migration/deprecation not accepted |

## Execution constraints

Launch owns source-bound requests and publication decisions. Test/Audit/Visual OS retain their evidence authority. The lightweight service receives outbound HTTPS agents; sleeping/offline computers leave durable jobs queued. Only typed build/test actions execute; no arbitrary commands from HTTP. A production VPS cannot be an Android builder. Agent enrollment, revocation, lease recovery and strict host resource limits must be proved before native acceptance. No production publication, subscription/overage or signing-key rotation is authorized by implementation alone.

## Evidence boundary

Recovery is VERIFIED. New mobile/agent/Studio integration is not yet IMPLEMENTED at this checkpoint. Prior 57 web tests belong to earlier work, not this change. Actual Windows/Linux native builds, installed FLOW signing/device lifecycle, Shorebird account and server deployment require physical host evidence. APKrelease remains operational and is not deprecated or removed.
