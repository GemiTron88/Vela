# Agent Contract — Production Deployment Fabric

When routed, the agent MUST use the canonical `executionkit launch` surfaces (`contracts/production-deployment-contract.md`). Launch OS retains release authority; `TODO.md` retains mutable task authority.

## Required Sequence
1. Verify exact candidate identity and authority (`executionkit launch status|readiness .`).
2. Build and validate the production artifact (`executionkit launch plan|build|verify .`).
3. Verify project-specific host plan/check and provider readiness (`executionkit launch host-plan|host-check|providers .`).
4. Run authorized deployment (`executionkit launch deploy . --authorize`) only after one-time provisioning is complete.
5. Verify post-deploy smoke/health probes; trigger `executionkit launch rollback .` on failure.

## Core Invariants
- Never hardcode `/home/<user>`, hosting account, domain, or service user; read from project configuration.
- Preserve compiled runtime assets/views/translations; exclude dev/control trees, source maps, and stale caches.
- Install locked no-dev dependencies at the immutable release path and validate before switching `current`.
- Create the declared DB/env backup under the deployment lock before migrations.
- Retain rollback state during deployment and clean up prior releases only after healthy activation and verified worker retirement (`executionkit launch storage . --json`).
- Require Vhost Guard (`executionkit guard vhost .`), CWP custom HTTP `.tpl` / HTTPS `.stpl` templates, and guarded-domain HTTPS release identity where applicable.
