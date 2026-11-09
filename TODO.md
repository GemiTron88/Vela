# Vela — GemiTron Navigation Foundation Fork Backlog

- **Upstream Repository**: `https://github.com/PimpinPumpkin/Vela` (`upstream` remote)
- **GemiTron Fork**: `https://github.com/GemiTron88/Vela` (`origin` remote)
- **Role**: Navigation algorithm and architecture foundation for **MapTron** (`GemiTron88/MapTron`)

<!-- TASK:VELA-FORK-01 -->
### VELA-FORK-01 — Fork Vela into GemiTron88 with preserved history and extract MapTron navigation foundation
- Status: ACCEPTED
- Phase: VELA
- Priority: P0
- Depends: NONE
- Parallel Safe: NO
- Ownership: .
- Decision Scope: .
- Branch: main
- Contract: docs/MAPTRON_NAVIGATION_FOUNDATION_20261109.md
- Verification: python3 scripts/test_road_features_tsv.py
- Evidence: docs/execution/evidence/tasks/VELA-FORK-01/receipt.json

Objective: Preserve original upstream commit history, remotes (`origin` + `upstream`), license and attribution; extract and document OSRM routing adapter, polyline5/6/7 codec, maneuver parsing, geodesy/bearing/step-advancement, accuracy-scaled off-route corridor & rerouting, voice guidance scheduling, offline region manifests, and MapLibre follow-camera framing in `docs/MAPTRON_NAVIGATION_FOUNDATION_20261109.md`.
<!-- /TASK -->

<!-- TASK:VELA-BRIDGE-02 -->
### VELA-BRIDGE-02 — Implement MapTron Android MethodChannel bridge and verify real Vela navigation state evaluation
- Status: ACCEPTED
- Phase: VELA
- Priority: P1
- Depends: VELA-FORK-01
- Parallel Safe: NO
- Ownership: core/src/main/java/app/vela/core/bridge/MapTronVelaBridge.kt, scripts/test_road_features_tsv.py, docs/MAPTRON_NAVIGATION_FOUNDATION_20261109.md
- Decision Scope: .
- Branch: main
- Contract: docs/MAPTRON_NAVIGATION_FOUNDATION_20261109.md
- Verification: python3 scripts/test_road_features_tsv.py
- Evidence: docs/execution/evidence/tasks/VELA-BRIDGE-02/receipt.json

Objective: Provide the native Kotlin `MapTronVelaBridge` (`net.gemitron.maptron/vela_navigation`) implementation in `Vela` core connecting `ObfRouteEngine`, `RouteGeometry`, `ManeuverParser`, and `VoiceGuidanceManager` to `maptron_flutter` with explicit `navigation_source: "vela_native"` provenance and unit verification.
<!-- /TASK -->

