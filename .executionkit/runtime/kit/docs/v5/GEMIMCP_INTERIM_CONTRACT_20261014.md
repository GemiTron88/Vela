# GemiTron + GemiMCP Interim Stdio MCP Contract (2026-10-14)

## 1. Architecture & Honest Scope

- **GemiTron** is the owner-operated engineering platform.
- **GemiMCP** is the planned unified control interface for ChatGPT to inspect and operate GemiTron and connected engineering systems.
- Because the GemiTron production domain is not yet registered and GemiMCP v1 is not yet remotely deployed:
  - ExecutionKit v5 requires **no domain or public MCP endpoint** for release acceptance.
  - ExecutionKit exposes an **interim local `stdio` MCP bridge** via `bin/mcp-server.mjs` and `lib/gemitron-mcp-bridge.mjs`.
  - The interim bridge always reports `remoteGemiMcpConnected: false`, `transport: "stdio"`, `platform: "GEMITRON_MCP_INTERIM"`, `authority: "EXECUTIONKIT_LAUNCH_OS_ONLY"`, `executionModel: "LOCAL_WORKSTATION_DIRECT"`, `mobileUpdateStrategy: "SIGNED_APK"`, `buildAgentRequired: false`, `shorebirdRequired: false`, and `remoteToLocalBuildDelegation: "DISABLED"`.
  - No second release controller, background Build Agent, or remote-to-local build delegation is created; all release and mobile actions delegate strictly to Launch OS.

## 2. Interim MCP Tool Catalog for GemiTron / Launch OS

| Tool Name | Mode | Input Schema | Security & Authority Boundary |
|---|---|---|---|
| `executionkit_gemitron_link_status` | Read-only | `{}` | Inspects local `launch.mobile.json`, reports `executionModel: "LOCAL_WORKSTATION_DIRECT"` and `mobileUpdateStrategy: "SIGNED_APK"`, and checks boolean presence of `EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN`, `EXECUTIONKIT_LAUNCH_MOBILE_TOKEN`, and `SHOREBIRD_TOKEN` without exposing token values or claiming remote connectivity. |
| `executionkit_mobile_plan` | Read-only | `{ kind: "verify" \| "apk" \| "debug_apk" \| "aab", expectedCommit?: "<40-hex>" }` | Computes deterministic native mobile build plan bound to current clean Git HEAD. |
| `executionkit_mobile_doctor` | Read-only | `{}` | Inspects physical workstation enrollment, Flutter project identity (`packageId`, `versionName`, `versionCode`), and Android SDK tools (`apksigner`, `apkanalyzer`, `JAVA_HOME`) locally on the workstation. |
| `executionkit_mobile_status` | Read-only | `{}` | Queries authenticated project-scoped Launch mobile status without mutation. |
| `executionkit_shorebird_provider` | Read / Mutating (Optional) | `{ action: "history" \| "usage" \| "patch" \| "release" \| "promote" \| "rollback", projectFile: string, inputFile: string, authorize?: boolean }` | Optional adapter path (`SHOREBIRD_OPTIONAL`); enforces `resolveProjectPathSafe` containment on `projectFile` and `inputFile` and rejects `patch`, `release`, `promote`, and `rollback` unless `authorize === true` (`GEMITRON_MCP_PROVIDER_APPROVAL_REQUIRED`). |
| `executionkit_deployment_status` | Read-only | `{}` | Reports Launch OS v2 artifact, target, retention, and production purity status. |
| `executionkit_deployment_storage` | Read-only | `{ maxEntries?: number }` | Bounded read-only Launch OS disk footprint report (`CURRENT`, `ROLLBACK`, producer artifact cache, and `OPERATOR_MANAGED_NOT_AUTODELETED` backups). |
| `executionkit_deployment_plan_artifact` | Read-only | `{}` | Computes allowlisted production artifact plan without writing bytes. |
| `executionkit_deployment_build_artifact` | Idempotent build | `{ runBuild?: boolean }` | Builds allowlisted production artifact atomically under `.executionkit/deployment/artifacts`. |
| `executionkit_deployment_validate_artifact` | Read-only | `{ releaseId?: string }` | Validates artifact manifest, SHA-256 inventory, and hard-denied path policy. |
| `executionkit_deployment_readiness` | Read-only | `{}` | Validates target, vhost guard, retention policy, and artifact readiness. |
| `executionkit_deployment_apply` | Mutating (Guarded) | `{ releaseId?: string, authorized: true }` | Requires literal `authorized: true` plus exact-candidate release gates, backup/vhost checks, smoke commands, and health attestation. |
| `executionkit_deployment_rollback` | Mutating (Guarded) | `{ authorized: true }` | Requires literal `authorized: true` and rolls back `current` to the verified `previousReleaseDir`. |

## 3. Forward Compatibility for GemiMCP v1

When GemiMCP v1 is deployed in the future, it can either:
1. Spawn `node bin/mcp-server.mjs <projectRoot>` over local `stdio` on the enrolled host; or
2. Proxy the exact tool names and JSON schemas above over authenticated HTTPS without modifying ExecutionKit's Launch OS or project configuration contracts.
