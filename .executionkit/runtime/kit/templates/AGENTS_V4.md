# AGENTS.md — AI ExecutionKit Project Authority

Live repository/runtime truth wins; `STANDARD_V4.md` defines current contracts.

<!-- EXECUTIONKIT_BOOT_CONTRACT -->
## ExecutionKit runtime boot contract

At session entry or a canonical task transition run:

```bash
executionkit start . --host antigravity
```

Obey blockers/nextCommand and reuse the task envelope during edits. Use --deep only for a requested boundary or debugging. Context economy is mandatory: read the exact task at runtime.task.sourcePath:startLine, then only routed resources. Never preload README/PLAYBOOK/STANDARD files, full TODO/shards, the Agent manifest or generated knowledge.
<!-- /EXECUTIONKIT_BOOT_CONTRACT -->

`TODO.md` is the sole execution entrypoint; declared active shards own mutable work. Chat, reports and memory are ADVISORY_ONLY. ExecutionKit has ten executable systems on the compatibility profile (eleven with Decision OS); integrity/knowledge fabrics add no OS. Execution, Agent and State always participate. Managed `.executionkit/runtime/kit` is immutable by default; Exception: the agent has the permission to adapt the kit to work with the project, and can edit the project-local kit instead of creating external scripts. No MCP or editor restart step.

Before task integration run `executionkit reconcile task .`: changed-file DB/Route/Surface/AntiFake and State checks. NEVER_GUESS_DATABASE_TRUTH: use targeted db table/column/model and named-route lookups. Reject production mocks, fixture imports, placeholders, invented business records and failure-as-success. Wire real providers and honest empty/error/loading/retry states. Isolated tests and real config defaults are allowed; source PASS cannot certify live data.

Deep Product Closure/Test/Audit/Content/SEO/Docs/Visual runs at wave/phase/release, not after each edit. Run `executionkit boundary wave|phase .`; Launch owns exact-candidate release/deploy/rollback. Keep real evidence and independent review; never fabricate results or expand approved goals. Premium Visual acceptance requires canonical components/tokens, actual responsive/RTL/state pixels and genuine functional evidence.

Laravel Launch requires actual Apache/Nginx public roots, HTTP/HTTPS coverage, pinned custom CWP tpl/stpl selection and guarded-domain HTTPS release identity. Use launch host-plan/host-check and the routed deployment contract. Never edit generated vhosts, guess keys or run routine sudo. Deploy only through `executionkit launch deploy . --authorize` within existing authority; drift blocks.

`PREPARE_NATIVE_SUBAGENTS`: run `executionkit agents run .` (--boost on request). `SPAWN_NATIVE_SUBAGENTS`: one isolated worker per delegation. Workers read `.executionkit/agent-claim.json` and exact taskRef, load resources lazily and edit owned scope. Only the orchestrator integrates, cleans claims and mutates TODO/control state.

CI is manual self-hosted only; no GitHub-hosted minutes or automatic push/PR runs. A version/tag is not release acceptance. Default CLI retains outcome/blockers/next action and bounded heartbeat; --progress adds stages, --full-output adds debug detail.

VPS/server: NEVER build APK/AAB/debug APK, run Gradle/Flutter mobile, or install/download/run Android SDK/build-tools/system images/emulators. No resource/KVM/agent exception. Owner-enrolled physical workstation only; otherwise BLOCKED. See LAUNCH_OS.md.

## Canonical CLI Command Reference (`executionkit` / `./.executionkit/bin/ek`)

Use the portable CLI (`executionkit` or `./.executionkit/bin/ek` on POSIX / `.\.executionkit\bin\ek.cmd` on Windows) and `executionkit help [command]` on demand:

- **Core & Backlog:** `executionkit start|status|next . [--host antigravity] [--boost] [--deep]`, `executionkit reconcile status|task|wave|phase|release .`, `executionkit boundary wave|phase .`, `executionkit todo status|maintain|migrate|complete . [--task <id>] [--verify <cmd>] [--apply]`, `executionkit proof status|seal .`, `executionkit product status|reconcile|discover|components .`, `executionkit activation status|apply .`.
- **Agent OS & State OS:** `executionkit agents status|plan|run|collect|delegated|decline|integrate|reconcile|cleanup|result . [--boost]`, `executionkit state status|rehydrate|checkpoint|amnesia|memory .`, `executionkit decision status|advise|refresh|align . [--task <id>]`.
- **Integrity & Knowledge Fabrics:** `executionkit guard all|assets|forms|lang|antifake|ux|flutter|visuals|perf|vhost . [--all|--files f1;f2]`, `executionkit db status|refresh|guard|table|column|model . [<name>]`, `executionkit route status|refresh|guard|probe .`, `executionkit knowledge status|refresh|search|impact|providers|context|auto|usage .`.
- **Quality Systems:** `executionkit visual status|validate|discover|plan|media-plan|media-check|capture|inspect|compare|remediate|certify|boundary .`, `executionkit content status|discover|validate .`, `executionkit docs status|refresh|build|validate|search .`, `executionkit seo status|validate .`, `executionkit audit task|wave|phase|release|security|data-safety|health|quality|storage .`, `executionkit test impact|portfolio|task|wave|phase|release|journeys|flakes|select . [--target <file>] [--filter <pattern>] [--base <git-ref>]`.
- **Launch & Diagnostics:** `executionkit launch status|plan|build|verify|host-plan|host-check|storage|providers|providers-discover|backup|release|deploy|rollback . [--authorize]`, `executionkit launch mobile . --mode doctor|build|inspect|handoff|import`, `executionkit launch service start|status .`, `executionkit systems status .`, `executionkit control-plane status|verify-head .`, `executionkit platform status|provision|sync-global .`, `executionkit install|update|upgrade|repair|self-update|upgrade-revalidation|doctor|rollback .`.
