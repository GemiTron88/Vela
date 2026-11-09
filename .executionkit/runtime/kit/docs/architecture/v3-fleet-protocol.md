# ExecutionKit 3.0 Fleet Protocol

Status: 3.0 development contract. This document defines the deterministic transport boundary between the shared per-device ExecutionKit Agent and a compatible control plane such as Elmasna3. It is not task authority and does not make Elmasna3 an ExecutionKit dependency.

## Authority boundary

`TODO.md` or the configured native canonical projection remains the sole mutable execution authority. State OS, the Agent spool, server event rows, project snapshots and dashboards are observations/evidence caches. Server silence, stale telemetry or an offline device must render `UNKNOWN`/`STALE`, never inferred success/failure.

## Control-plane optionality

Fleet transport is optional to local ExecutionKit operation.

- No configured server URL or credential means `NOT_CONFIGURED` for fleet observability. Local Execution/Agent/Content/Audit/Test/Launch/State behavior remains valid.
- A network outage, timeout, `401/403`, `426`, `429`, `5xx`, malformed ACK or server restart may degrade telemetry but MUST NOT block or roll back canonical local execution.
- Local semantic events and State/lifecycle authority continue normally while telemetry is unavailable.
- Offline telemetry may spool/replay within bounded policy, but replay MUST NOT mutate canonical task state.
- Elmasna3 can bootstrap under ExecutionKit before Elmasna3's own telemetry endpoint exists. Once that endpoint is implemented, the same local Agent may be configured and begin reporting later execution without changing canonical project state.
- The Agent exposes transport state separately from execution state. `transportConfigured=false`, `lastServerError`, or `PROTOCOL_UPGRADE_REQUIRED` are observability states, not execution failures.
- Events produced before transport is configured are not promised as historical replay. Control-plane history begins from enrollment/transport availability unless another explicit evidence import path proves older history.

## Transport

The Agent opens outbound HTTPS only. The server never requires an inbound port on the developer machine. Default endpoint:

`POST /api/agent/v1/telemetry/batch`

Headers:

- `Authorization: Bearer <device credential>`
- `Content-Type: application/json`
- `Content-Encoding: gzip` when compressed
- `X-ExecutionKit-Agent-Protocol: 1.0.0`
- `X-ExecutionKit-Batch-Id: <sha256>`

The device credential is provisioned outside repositories and may be rotated/revoked server-side. Do not store it in project files, State snapshots or telemetry events.

The configured request timeout covers the complete HTTP exchange, including receipt and parsing of the ACK body. Receiving response headers does not end the timeout. The Agent bounds the ACK body to 64 KiB and aborts larger responses before spool acknowledgement.

## Batch identity and ACK semantics

`batchId = SHA-256(eventId[0] + "\n" + ... + eventId[n])` in spool order.

The server transaction is all-or-nothing for structurally valid batches. Every event is idempotent by `eventId`; `(deviceId, sessionId, sequence)` is a secondary ordering/integrity key. A successful response means every submitted event is durably stored or already existed as the same idempotent event.

The Agent removes submitted events from its spool only after a JSON ACK satisfying all of:

- HTTP 2xx;
- `protocolVersion` exactly equals the Agent protocol version;
- response `batchId` equals request `batchId`;
- `status == ACK`;
- `acceptedCount + duplicateCount == submitted event count`;
- `serverTime` is a valid timestamp;
- the compatibility object is structurally valid;
- `minProtocol <= localProtocol <= maxProtocol`;
- `upgradeRequired` is not `true`.

A structurally valid ACK whose advertised compatibility range excludes the local protocol is still incompatible and MUST NOT acknowledge the local spool. It produces `PROTOCOL_UPGRADE_REQUIRED`, just like an explicit upgrade-required response.

ACK application is event-ID based against a fresh reread of the local spool. Events appended while an HTTP request is in flight are never removed merely because an older snapshot of the spool was acknowledged. A missing, malformed, oversized, timed-out or incompatible ACK retains the submitted batch for retry. Duplicate replay is therefore normal and must be cheap.

## Failure codes

Recommended server behavior:

- `401/403`: invalid/revoked device credential;
- `413`: body/batch exceeds server limit;
- `422`: schema or semantic validation failure; reject whole batch;
- `426`: protocol version unsupported/upgrade required;
- `429`: rate limited;
- `5xx`: transient server failure.

The Agent uses exponential backoff with jitter and never blocks canonical project execution on telemetry availability.

## Resource budget

Defaults are deliberately conservative:

- one daemon per device/user, never one daemon per project;
- the single-instance lease is owned by both process ID and Agent session ID, so a second runtime object in the same process cannot steal or release another runtime's lock;
- 5s scheduler tick only; it does not scan every repo each tick;
- active worktree scan around 15s;
- idle worktree scan around 180s with jitter;
- active Agent heartbeat around 90s;
- idle Agent heartbeat around 300s;
- registered project scans staggered across startup instead of bursting;
- State snapshot JSON is read only when its mtime changes;
- TODO high-frequency observation uses stat metadata only;
- no routine TODO/source-content upload;
- batch count maximum 50 by default and 100 by protocol v1;
- the configured `maxBatchBytes` bounds the complete uncompressed serialized request envelope, not only the sum of NDJSON event sizes;
- gzip from about 1 KiB using a CPU-conscious compression level;
- ACK response body capped at 64 KiB;
- offline spool bounded to 8 MiB by default;
- one outbound request in flight;
- exponential retry up to about 10 minutes.

Semantic events are preferred over polling. Do not emit per-token, transcript, file-read or generic tool-call events.

## Repository and worktree identity

The control plane must not assume a raw Git remote string is a stable repository identity. The per-device Agent canonicalizes common Git transport forms before hashing repository identity. For GitHub, SSH, `ssh://` and HTTPS forms of the same owner/repository normalize to the same case-insensitive `github.com/owner/repository` identity before hashing.

`repositoryKey` identifies the canonical repository without uploading the raw remote URL. `worktreeId` is device-local/worktree-local and may legitimately differ across devices or clones. Server identity MUST therefore scope a worktree by `(deviceId, worktreeId)` rather than treating `worktreeId` as a globally unique fleet identity. Elmasna3 must model repository, device and worktree separately and must never merge simultaneous worktree states into a fabricated single active session.

## Activity truth

`HOST_ACTIVE` and `EXECUTION_ACTIVE` are different projections:

- `HOST_ACTIVE`: a supported host integration, initially Antigravity, recently touched an unambiguous workspace;
- `EXECUTION_ACTIVE`: current ExecutionKit runtime/System evidence indicates actual lifecycle work.

Opening a repo does not prove execution. A State OS snapshot with `runtime.status=RUNNING` is accepted as execution activity only while the snapshot timestamp is fresh within the Agent's execution-activity TTL and not implausibly in the future. A stale RUNNING snapshot must not resurrect an inactive project. Execution activity TTL expiry means `execution observation stale/inactive`, not that an AI process crashed.

A failure while observing one registered project is isolated to that project and reported as Agent diagnostics; it must not abort observation of the remaining projects on the device.

## Offline spool and telemetry loss

The Agent stores unsent events in a bounded append-only local spool. Replaceable presence observations may be coalesced first. If the hard spool budget still forces event loss, the Agent records a telemetry-gap summary in local status/heartbeats. The server must surface such a gap instead of presenting the surrounding timeline as complete.

## Clock, order and freshness

Server receipt time and event `occurredAt` are both retained. UI freshness uses server receipt plus source-specific TTLs. Device clocks are not trusted for authorization. Out-of-order events are accepted idempotently and projected using `(deviceId, sessionId, sequence)` plus semantic precedence; late history must not roll a newer project projection backward.

## Privacy

Local absolute paths, machine hostname and machine-wide resource metrics are not sent by default. `hostname` is `null` unless local `privacy.shareHostname=true` is explicitly configured. The Agent process RSS may be reported as a daemon-health metric and is not equivalent to machine-wide memory telemetry. Prompt/transcript text, source contents, TODO contents, credentials, cookies, authorization headers and raw command stdout/stderr are prohibited routine telemetry. Project identity uses canonical hashed repository/worktree identifiers rather than private local paths or raw Git remotes.

## Compatibility

Agent protocol version is independent from ExecutionKit package version. The ACK returns the server's supported protocol range and recommended Agent version. An ACK cannot acknowledge events unless the local protocol falls inside the advertised range and `upgradeRequired` is not true. Unsupported protocols fail closed with `426` or `PROTOCOL_UPGRADE_REQUIRED`; the Agent keeps the spool.

## Future command channel

Protocol v1 is read-only observability. Remote commands/decisions/approvals require a separately versioned typed command contract with allowlists, expected-state preconditions, TTL, idempotency, explicit local control enablement and audit logging. Arbitrary remote shell is permanently out of scope.
