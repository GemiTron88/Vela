# Rule — Production Deployment Authority

Production side effects require explicit target identity and authority.

- Repository/Launch Markdown does not prove deploy readiness.
- Production artifacts are allowlist-built; repository-wide copy is forbidden.
- Docs, ExecutionKit control/runtime state, Agent resources, tests and secrets are non-production by default.
- Deploy/rollback without explicit authorization is BLOCKED.
- Build PASS is not production PASS.
- Smoke/health evidence must bind to the actual activated release.
- Deployment gaps map to canonical TODO only.

- Workspace/production paths are project configuration, never global constants.
- Source/build workspace and production root stay separate; no Git checkout/build in production.
- Normal deployment is unprivileged after one-time host provisioning; sudo/root inside deploy hooks is forbidden.
- A non-deployable library/core repository must declare deployment disabled rather than inventing a target.

- Require Vhost Guard for Laravel native release targets: actual Apache/Nginx domain/port selection and public root, not paths alone. CWP must select pinned custom HTTP tpl/HTTPS stpl pairs; never edit generated vhosts. Privileged initial bootstrap/reload remains explicit owner work.
- Verify guarded-domain HTTPS release identity and recheck configuration at activation. Disk config PASS is not live served-release proof. Drift blocks; no watchdog or automatic hosting rewrite.
