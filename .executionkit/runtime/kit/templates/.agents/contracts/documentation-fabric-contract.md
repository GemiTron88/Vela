# Agent Contract — Documentation Fabric

When Documentation Fabric is routed, the selected agent MUST use the executable project-local Documentation Fabric surfaces, not merely read `CONTENT_OS.md` or `LAUNCH_OS.md`.

Required behavior:
- status/refresh/validate the generated knowledge base;
- preserve manual docs;
- expose coverage/freshness/source references;
- keep live source authoritative;
- map executable gaps to canonical TODO only.

The runtime contract is `contracts/documentation-fabric-contract.md`.
