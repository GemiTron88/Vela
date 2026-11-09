---
name: production-deployment
description: Build, verify, deploy, or roll back exact release candidates through Launch OS.
---

# Skill — Production Deployment & Hosting Authority (Launch OS)

1. Inspect release and hosting readiness via `executionkit launch status .`, `executionkit launch readiness .`, `executionkit launch host-plan .`, and `executionkit launch host-check .`.
2. Build and verify the release candidate artifact with `executionkit launch build .`, `executionkit launch verify .`, `executionkit launch providers .`, `executionkit launch backup .`, and `executionkit launch storage . --json`.
3. `executionkit launch release .` seals non-deploying release approval; only separately authorized `executionkit launch deploy . --authorize` activates production and runs post-deploy health probes (with automatic rollback via `executionkit launch rollback .` on failure).
4. For Laravel/CWP hosts, verify vhost roots and HTTPS templates with `executionkit guard vhost .`. For native Android, use `executionkit launch mobile . --mode doctor|build|inspect|handoff|import` on an enrolled physical workstation (never build APK/AAB or run emulators on a headless VPS).
