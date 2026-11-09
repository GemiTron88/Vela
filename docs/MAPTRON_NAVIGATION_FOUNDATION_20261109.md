# Vela Navigation Foundation Audit & Extraction Specification for MapTron (2026-11-09)

- **Upstream Repository**: `https://github.com/PimpinPumpkin/Vela` (`upstream` remote preserved)
- **GemiTron Fork**: `https://github.com/GemiTron88/Vela` (`origin` remote)
- **Upstream Baseline Commit**: `HEAD` on `upstream/main` (full 59,422-object Git history preserved)
- **License & Attribution**: Original upstream `LICENSE` and `tools/licenses/` notices preserved intact.
- **Role in GemiTron Geospatial Platform**: Upstream navigation algorithm and architecture reference foundation for **MapTron** (`127.0.0.1:18329`, `@gemitron/maptron-web`, `gemitron/maptron-laravel`, `maptron_flutter`). Vela is **never** deployed as a standalone SaaS application and its mobile UI is not copied blindly; instead, its pure algorithmic modules in `:core` and `:app/offline` / `:app/ui/map` inform MapTron's Go engine, TypeScript Web SDK, and Flutter SDK.

---

## 1. Extracted & Studied Navigation Modules

### 1.1 OSRM Routing Adapter (`core/src/main/java/app/vela/core/data/RouteGeometry.kt`)
- **Mode-Specific Backends**: Separate routing profiles for `DRIVE` (`routed-car`), `BICYCLE` (`routed-bike`), and `WALK` (`routed-foot`).
- **Precision-6 Geometry (`geometries=polyline6`)**: Requests `polyline6` (1e-6 degree resolution, ~0.11 m grid) instead of default `polyline` (1e-5, ~1.11 m grid) to eliminate quantization kinks on straight roads while preserving vertex counts.
- **Multi-Waypoint & Alternatives**: Supports `route(origin, dest, mode, alternatives=true, avoidTolls, avoidHighways, avoidFerries, departBearingDeg)` and `routeVia(waypoints, ...)` with bounded timeouts (`RouteBudget`).
- **Exit Complex Consolidation & Traffic-Light Landmark Enrichment**: Consolidates ramp + fork/merge pairs within `EXIT_COMPLEX_GAP_M = 500.0` m and enriches turn instructions with intersection-clustered traffic light landmarks within `LIGHT_APPROACH_M = 400.0` m (`LIGHT_SNAP_M = 25.0` m, `LIGHT_CLUSTER_M = 30.0` m).

### 1.2 Route Geometry Decoding & Polyline Utilities (`core/src/main/java/app/vela/core/data/google/PolylineCodec.kt`)
- **64-bit Zigzag Polyline5 / Polyline6 / Polyline7 Codec**: Uses 64-bit `Long` accumulators in `decode(encoded, precision)` and `encode(path, precision)` so precision-6 (OSRM/Valhalla) and precision-7 (transit) coordinates beyond ±107° longitude never overflow 32-bit signed integers.
- **Cumulative Distance & Binary-Searched Segment Interpolation (`RouteProjection.kt`)**:
  - `cumulative(poly)`: Single-pass cumulative meter array `DoubleArray(poly.size)`.
  - `segmentEnd(cum, m)`: $O(\log N)$ binary search for segment index at distance `m`.
  - `pointAt(poly, cum, m)`: Linear interpolation along segment `i` at cumulative meter offset `m`.
  - `alongMeters(poly, cum, p, maxOffRouteM)`: Local flat-frame segment projection (`cos(lat)` computed once per query point) returning along-route distance when perpendicular distance $\le \text{maxOffRouteM}$.

### 1.3 Maneuver & Turn-by-Turn Parsing (`core/src/main/java/app/vela/core/model/Route.kt`, `core/src/main/java/app/vela/core/nav/NavModels.kt`)
- **Canonical Maneuver Taxonomy**: `DEPART`, `STRAIGHT`, `SLIGHT_LEFT`, `LEFT`, `SHARP_LEFT`, `SLIGHT_RIGHT`, `RIGHT`, `SHARP_RIGHT`, `U_TURN`, `MERGE`, `ON_RAMP`, `OFF_RAMP`, `FORK_LEFT`, `FORK_RIGHT`, `ROUNDABOUT`, `ARRIVE`.
- **Start-of-Step Placement Invariant**: Each maneuver's `location` sits at the **start** of its step (`cum` before adding `m.distanceMeters`), while `distanceMeters` and `durationSeconds` represent the travel **after** the maneuver, with the final `ARRIVE` pinned to `1.0`.

### 1.4 Geodesy, Bearing, Distance & Step Advancement (`core/src/main/java/app/vela/core/model/Geo.kt`, `core/src/main/java/app/vela/core/nav/NavEngine.kt`)
- **WGS84 Geodesy (`Geo.kt`)**:
  - `LatLng.distanceTo(o)`: Great-circle Haversine distance in meters ($R = 6,371,000\text{ m}$).
  - `LatLng.bearingTo(o)`: Initial forward azimuth in degrees $[0, 360)$.
  - `LatLng.destinationPoint(meters, bearingDeg)`: Great-circle forward projection used to position the look-ahead camera target ahead of the navigation puck.
  - `LatLngBounds.around(center, radiusMeters)`: Fast latitude-corrected bounding box generator.
- **Pure Functional Step Advancement (`NavEngine.kt`)**:
  - `NavEngine.update(route, prevState, fix)` is pure and side-effect-free, returning `(NavState, List<NavEvent>)`.
  - Advances steps when approaching within speed-scaled lead distance (floor `ADVANCE_MIN_M = 5.0` m) or silently advances past maneuvers missed during GPS gaps (`PASSED_SLACK_M = 75.0` m).
  - Computes remaining duration by pro-rating the active approach leg and summing downstream step durations scaled by live traffic ratio.

### 1.5 Off-Route Detection & Rerouting (`core/src/main/java/app/vela/core/nav/NavEngine.kt`)
- **Accuracy-Scaled Off-Route Corridor (`offRouteCorridor`)**:
  - Instead of a brittle fixed threshold, scales tolerance by GPS horizontal accuracy $a \in [3, 40]\text{ m}$:
    - `WALK`: $\text{clamp}(8.0 + 1.8a, 15.0, 50.0)\text{ m}$
    - `BICYCLE`: $\text{clamp}(12.0 + 1.9a, 18.0, 55.0)\text{ m}$
    - `DRIVE`: $\text{clamp}(18.0 + 2.0a, 24.0, 70.0)\text{ m}$
- **Dual Distance + Heading Counter-Flow Trigger**:
  - Debounces `OFF_ROUTE_HITS = 3` consecutive off-route fixes before emitting `RerouteRequest`.
  - Unambiguously far fixes (`farOffDistance = min(2 * offRouteM, cap)`) count at any speed and count **double** while moving so clear wrong turns trigger rerouting in 2 fixes.
  - Counter-flow heading deviation $> 60^\circ$ (`HEADING_OFF_DEG = 60.0`) at speeds $\ge 5.0\text{ m/s}$ (`HEADING_MIN_MPS`) and accuracy $\le 30\text{ m}$ counts as an off-route hit even inside the distance corridor (catching wrong turns onto parallel service roads).
  - Suppresses rerouting within `DEST_ZONE_M = 150.0` m of the destination.

### 1.6 Voice Guidance Scheduling (`core/src/main/java/app/vela/core/nav/NavEngine.kt`, `core/src/main/java/app/vela/core/voice/VoiceGuide.kt`)
- **3-Slot Distance/Time Band Scheduler**:
  - Far preparation band, near confirmation band, and `TURN_NOW_SLOT = 2` execution prompt.
  - Estimates utterance duration from character count (`SPEECH_CPS = 13.0` chars/sec + `SPEECH_LEAD_S = 0.6` s audio focus lead-in, floor pace `MIN_PACE_MPS = 1.5` m/s).
  - Merges adjacent prompt bands when travel time between bands is $< 8.0\text{ s}$ (`BAND_MERGE_S = 8.0`) to prevent back-to-back speech collisions.
- **Continuous Audio Ducking & Synthesized Earcons**:
  - Ref-counted audio focus burst with delayed release so background audio stays smoothly ducked across multi-part prompts.
  - In-process PCM sine-wave earcons with 12 ms fade envelopes (`reroutingChime`: descending 659.25 Hz $\to$ 440 Hz; `fasterRouteChime`: ascending 587.33 Hz $\to$ 880 Hz).

### 1.7 Offline Region Manifest & Package Planning (`app/src/main/java/app/vela/offline/RegionCatalog.kt`, `RegionPacks.kt`, `PmtilesReader.kt`)
- **Region Manifest Schema (`RoutingRegion`)**:
  - `id`, `name`, `url`, `sizeMb`, `bbox: [s, w, n, e]`, `installedMb`, `rev`, `counts`, `deltaUrl`, `deltaFromRev`, `deltaSizeMb`.
  - Polygon-first point containment (`RegionPolys.covers(id, lat, lng)`) with bounding-box fallback and smallest-area tie-breaking (`boxArea()`) at borders.
- **Hierarchical Parent Pack Resolution (`RegionPacks.kt`)**:
  - Resolves sub-regional slices to shared parent packs when appropriate (`AUTO_PARENT_MAX_MB = 600`), avoiding duplicate downloads.

### 1.8 MapLibre View State, Follow Mode & Camera Orchestration (`app/src/main/java/app/vela/ui/map/FollowEstimator.kt`, `NavFraming.kt`)
- **Residual-Spread Dead-Reckoning Camera Filter (`FollowEstimator.kt`)**:
  - Continuously integrates camera position along `course` at `speed` between 1 Hz GPS fixes (up to `FRESH_MS = 2500` ms).
  - Applies `GAIN_MOVING = 0.5` of each new GPS fix's residual spread smoothly over `CORR_S = 0.9` s so lagged or noisy GPS fixes never cause sawtooth camera reversals.
- **Chrome-Aware Viewport Framing (`NavFraming.kt`)**:
  - Places the navigation puck at `DEFAULT_PAD = 0.45` (72.5% down the viewport) in heading-up mode (clamped to `MIN_PUCK_FRAC = 0.55` when bottom chrome expands) and dynamically computes `zoomOffset` (up to `MAX_ZOOM_OUT = 1.5`, floor `ZOOM_FLOOR = 15.5`, next-turn zoom floor `ZOOM_TURN_MIN = 12.0`).

---

## 2. Direct Mapping into MapTron Architecture

| Vela Module | MapTron Target Component |
| :--- | :--- |
| `Geo.kt` + `PolylineCodec.kt` + `RouteProjection.kt` | `MapTron/internal/geo/` (Go engine), `@gemitron/maptron-web` (`src/geo.ts`), `maptron_flutter` (`lib/src/geo.dart`) |
| `RouteGeometry.kt` (OSRM + polyline6 + maneuver normalization) | `MapTron/internal/routing/` (`/api/v1/maps/route`, `/api/v1/maps/matrix`, `/api/v1/maps/isochrone`, `/api/v1/maps/snap`) |
| `NavEngine.kt` (step advancement, accuracy corridor, off-route, voice bands) | `MapTron/internal/routing/navigation.go` (`/api/v1/maps/navigation/session`), `@gemitron/maptron-web` (`src/navigation.ts`), `maptron_flutter` (`lib/src/navigation.dart`) |
| `RegionCatalog.kt` + `RegionPacks.kt` | `MapTron/internal/regions/` (`/api/v1/maps/regions`, Egypt + governorate offline region manifests) |
| `FollowEstimator.kt` + `NavFraming.kt` + `MapStyle.kt` | `MapTron/internal/styles/`, `@gemitron/maptron-web` (`src/camera.ts`), `maptron_flutter` (`lib/src/camera.dart`) |
