# Security review and trust model

Implemented: default-deny project/permission scopes; SHA256 bearer-token storage; strict runtime request fields; HTTPS metadata/artifact origin; loopback bind; Host/Origin allowlists; bounded request/upload concurrency and disk budgets; immutable content-addressed artifact paths; checksum + actual Android SDK signature/package inspection in production; Ed25519 manifests with client-pinned keys, expiration and generation replay checks; HMAC project-specific runner receipts; exact source/toolchain/artifact binding; independent approval; freshness and latest failure precedence; transactional idempotency; actor-bound leases; recovery; journal hash chain and update/delete triggers.

No arbitrary shell/MCP endpoint exists. Operator configs map approved local repositories. Git input is exact SHA, subprocesses use fixed argument vectors. Quality children do not receive runner/provider/control-plane/signing credentials. Signing code still requires reviewed trusted source and an isolated runner: a build script holding its app's keystore can misuse it. Never run pull-request code with signing or Shorebird cloud credentials. Provider logs redact tokens and configured signing values; redact financial data before collecting device evidence. No financial/SMS records from production are used for test fixtures.

The hash journal is tamper-evident against normal application mutations, not tamper-proof against a privileged host administrator replacing SQLite/files/triggers. Restrict filesystem permissions, back up journal/artifacts and anchor periodic journal heads outside the host. SQLite backup restores were tested; actual disaster recovery of production secrets/artifacts remains host acceptance.

Approval keys and test-attestation keys represent trusted operators/runners. An HMAC signature verifies that source, not independent truth of a fabricated claim. Native production promotion requires actual external device evidence. Do not mint PASS receipts from dry runs or configuration checks.

Native cert lineage/multiple signers and signing-key migration are fail-closed unsupported in this initial adapter. Debug-signed production artifacts are rejected. Read-only installed-app diagnostics can identify a debug base but cannot establish it as a production release identity. No key rotation, uninstall, downgrade or data wipe was executed.

No automatic Stable publication, paid API fallback, Google credential access or account pooling is implemented. New platform manifests are unrelated to Antigravity/Google authentication.
