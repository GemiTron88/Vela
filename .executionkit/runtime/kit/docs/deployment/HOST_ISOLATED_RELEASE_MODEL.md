# Host-Isolated Production Deployment

This is the canonical v4 host model derived from the proven release approach used by WazzAI, generalized for all projects.

## Separation

ExecutionKit never assumes a universal production path.

Each deployable project declares:
- its source/build workspace policy;
- its production release root;
- its atomic current link;
- explicit shared persistent paths;
- its health endpoint and smoke commands.

The common safe shape is:

```text
declared build workspace
  └─ source checkout / tests / artifact build

project-specific production root
  ├─ releases/
  │   ├─ <release-a>/
  │   └─ <release-b>/
  ├─ current -> releases/<active-release>
  └─ shared state (explicit links/config)
```

The build workspace may be under `/home/antigravity` on a host where that is the declared execution area, but that path is not a Kit constant. The production root may be under any hosting account/path declared by the project.

## Privilege

Normal deployments run without sudo/root.

One-time host provisioning may require an administrator to:
- create the production directories;
- grant the deployment identity owner/group/ACL write+traverse rights only where required;
- install/update service-manager units;
- configure reverse proxy/TLS;
- configure rootless/container runtime access when applicable.

Those privileged actions are not repeated inside deploy hooks.

## Commands

```bash
executionkit launch host-plan .
executionkit launch host-check .
executionkit launch release .
executionkit launch deploy . --authorize
executionkit launch rollback . --authorize
```

`host-check` must pass before release readiness/deploy. A permission problem is `NEEDS_PROVISIONING`, not an instruction to inject sudo into project scripts.

## Non-deployable repositories

Libraries, reusable cores and templates may set:

```json
{"deployment":{"enabled":false,"requiredForRelease":false}}
```

Their derived applications own the actual deployment profile.
