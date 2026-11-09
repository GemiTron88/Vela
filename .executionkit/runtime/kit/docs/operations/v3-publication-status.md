# AI ExecutionKit 3.0.0 — Publication and Device Certification Status

**Distribution version:** `3.0.0`  
**Publication channel:** repository `main` + `VERSION` + `package.json` + release documentation  
**Platform-certification state:** evidence-dependent per physical device; no unexecuted PASS is claimed

## Purpose

ExecutionKit 3.0.0 separates **distribution publication** from **physical-device certification** while the current 3.x authority model may continue to evolve through canonical compatible-evolution tasks.

Publication means the coherent 3.0.0 distribution is the supported repository version on `main` and may be adopted by projects. It does not, by itself, claim that a particular macOS or Windows workstation, self-hosted runner, IDE integration, background service, external control plane, project installation, SEO exact candidate or external search-engine outcome has been exercised successfully.

Physical-device certification is generated where the per-device Agent is actually installed. This is intentionally a local/adoption evidence boundary because the ExecutionKit Agent is one daemon per physical developer device and the central repository cannot truthfully prove an unavailable workstation from static Git state.

## Current 3.x authority overlay

The current 3.x control plane has exactly eight systems:

1. Execution OS
2. Agent OS
3. Content OS
4. SEO OS
5. Audit OS
6. Test OS
7. Launch OS
8. State OS

The first seven are capability authorities. State OS is cross-cutting system #8 and is not capability-leveled. ExecutionKit Agent, fleet telemetry, MCP, Antigravity and Elmasna3 are integrations/subsystems around this model, not additional operating systems.

The original 3.0.0 publication predated the current SEO OS compatible-evolution work. Historical records may therefore describe the pre-SEO system count for that point in time, but such history must not be read as the current 3.x authority model.

## 3.0.0 publication facts

The 3.0.0 publication established:

- the normative `STANDARD_V3.md` overlay over the preserved v2.2.4 semantic base;
- cross-session continuity through State OS, now interpreted under the current eight-system overlay above;
- the deterministic Windows/macOS per-device ExecutionKit Agent;
- repository/worktree identity, host pulse, semantic telemetry, bounded spool/replay, ACK validation and privacy defaults;
- Bootstrap Mode and control-plane optionality so Elmasna3 is never an execution dependency;
- 3.0 bootstrap/migration/project validators, MCP diagnostics and Antigravity integration;
- coherent `3.0.0` version surfaces on `main`.

Current repository history also contains SEO OS implementation bytes on `main`. **Code presence on `main` is not equivalent to canonical SEO acceptance, certification, or compatible-release promotion.** The SEO evolution remains governed by its canonical TODO audit/promotion dependency chain; exact-candidate executable evidence must close before any later release/version-promotion claim is made.

## Repository Intelligence branch evolution

The Repository Intelligence & Knowledge Fabric is a compatible 3.x evolution under development on a feature branch. It does **not** change the published 3.0.0 claim, does not create a ninth OS and is not considered accepted/published merely because implementation bytes exist on a branch.

Its merge/promotion boundary requires the exact feature candidate to pass the canonical full distribution gate and independent audit on the authorized self-hosted runner. Until that evidence exists, its truthful state is implemented-on-branch with exact-candidate acceptance pending.

## Evidence boundary

No document, TODO state, changelog entry, branch location or version number may manufacture physical or exact-candidate execution evidence.

For a physical workstation to be described as **certified for the ExecutionKit Agent**, direct current evidence must exist from that workstation. At minimum, the operator should run the applicable project/distribution validation plus Agent diagnostics on the real device, for example:

```bash
npm run check
node bin/agent-doctor.mjs
node bin/executionkit-agent.mjs status
```

Where the repository self-hosted runner is configured, `workflow_dispatch` remains the preferred exact-SHA evidence path. Missing, unavailable, failed or stale evidence is `NOT_RUN`/`UNVERIFIED`, never PASS.

For SEO compatible-evolution certification, the current exact candidate must satisfy the canonical SEO audit task, including the complete required command/evidence boundary. Static files, declared tests, earlier runs or code already present on `main` do not substitute for that evidence.

For project adoption, the project must additionally execute its normal deep-integration, State/Amnesia, Agent routing, applicable SEO, framework/editor and project Test/Audit/Launch gates. Distribution publication never substitutes for project-specific acceptance.

## macOS and Windows

The distribution contains service/install/runtime paths for both macOS and Windows. Support is a code/distribution claim; **certification of a concrete device is an evidence claim**.

A macOS result does not certify Windows. A Windows result does not certify macOS. Different devices/worktrees remain separately observed and separately certifiable.

## CI policy

The normal repository policy remains:

- self-hosted runners only;
- `workflow_dispatch` only;
- no GitHub-hosted fallback;
- no push autorun;
- at most one runner registration for this project per physical device.

Publication/certification separation must never be used to weaken those CI defaults, bypass candidate-bound SEO S3, or create fake green status.

## Elmasna3 bootstrap

Elmasna3 may adopt and execute with ExecutionKit 3.0.0 before the Elmasna3 ingestion/control-plane endpoint exists. In that state, the per-device Agent truthfully reports `NOT_CONFIGURED` for the external control plane while canonical local execution continues.

When Elmasna3's server ingestion is available, the same Agent can be configured to send sanitized observations. This transition does not change project task authority.

## Release terminology

Use these terms precisely:

- **Published 3.0.0:** the repository version surfaces identify `3.0.0` and the supported repository distribution is on `main`; this term does not imply later compatible-evolution tasks are accepted.
- **SEO implementation present:** SEO OS code/resources exist in repository history; this alone is not an accepted/promoted SEO release.
- **SEO exact-candidate accepted:** the canonical independent SEO audit/evidence task has genuinely closed against the exact candidate.
- **Device certified:** direct current evidence proves the applicable Agent/runtime behavior on that physical workstation.
- **Project adopted:** the target repository completed its applicable ExecutionKit deep-integration and acceptance gates.
- **Fleet connected:** the device Agent is configured against a compatible external control plane and transport compatibility is proven.

These states are intentionally independent. Never infer one from another.
