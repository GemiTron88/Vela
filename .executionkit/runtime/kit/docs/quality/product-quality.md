# Product quality contract

This is a cross-capability contract, not another OS. Content owns editorial depth;
Test owns checks; Audit owns independent assessment; Launch owns release gates;
Agent OS loads the relevant skills. Execution and TODO still own all work state.

`docs/quality/premium-experience.md` is the canonical cross-cutting construction and evidence contract for premium user-facing surfaces. It does not own task state or replace the project-native design/component authority.

## Select and inventory

For current 3.x, UI-bearing web, Flutter and desktop scope requires the `premium`
profile and schema `1.1.0`. Use `standard` only for genuinely non-UI products with
an explicit evidence-backed NOT_APPLICABLE decision. This applicability decision
is independent of LITE/STANDARD/FULL execution depth. Existing native design and
quality authorities are preserved and reconciled during integration.

Start from `templates/quality.contract.json`. Reconcile it into
`docs/quality/contract.json`, then set `quality.contractPath` in execution config.
Inventory actual public/admin/customer/owner/provider/field surfaces, shared
components, critical journeys, APIs and content domains. Compare this inventory
with route, navigation, widget/component and approved specification inventories.
Register new quality work in TODO before adding its task references; do not
generate fake IDs.

The contract is acceptance criteria, not progress. Its `subjects` define the
coverage denominator; `requirements` map each required dimension to existing TODO
IDs. Criteria must specify observable behavior, environment and thresholds.
`sourcePaths` includes relevant implementation/spec/fixtures/assets/dependency
sources. Premium schema `1.1.0` additionally binds its declared design authorities,
product references and component/design governance contracts into evidence source
hashes. Include shared dependencies, not just the changed page. Review inventory
completeness at phase/RC boundaries.

## Premium experience acceptance

Before implementation, establish the project's visual/product direction: approved
references, real user role/job, surface/shell, brand tokens, Arabic and Latin
typography, spacing/density, icon and imagery language, elevation, motion and
platform behavior. Preserve stronger existing project authorities. Do not copy
another project's brand into the universal kit.

Each surface must express its own job. A dense admin workspace, an owner/provider
workspace, a field app and a consumer discovery screen need different hierarchy,
density and navigation. Richness means useful information, complete actions and
recoverable states. It is not measured by card count, animation count, gradients,
shadows or an identical hero/dashboard layout across products.

For new/reconciled premium UI scope use quality schema `1.1.0`. Each UI subject
must declare its `surface` and intended `role`. Premium web/Flutter/component/
desktop subjects receive the existing visual/interaction/accessibility/responsive/
content/performance bar plus `components` and `design-system`; Flutter/desktop also
receive `native-behavior`.

Required review dimensions include:

| Dimension | Acceptance evidence |
| --- | --- |
| Functional | Real data and working journeys; permission and validation failures |
| Visual | Rendered output compared with approved references/tokens; independent verdict |
| Interaction | Focus, keyboard/touch, navigation, feedback and complete state transitions |
| Accessibility | Semantic labels/roles/states, contrast, focus order, screen-reader checks, reduced motion, text scaling |
| Responsive | Project-required form factors; web includes mobile+desktop; RTL/LTR and long localized copy where supported |
| Content | Complete truthful copy/assets/localization; no final demo/placeholder/fabricated metrics |
| Performance | Production-build measurements and explicit device/network/data budgets |
| Components | Canonical component consumption, extend-before-create and no covered raw-primitive bypass |
| Design system | One canonical semantic authority with delegated/parity-tested compatibility layers |
| Native behavior | Flutter/desktop platform lifecycle/navigation/input/system behavior where applicable |

Offline subjects add offline/reconnect/conflict/retry evidence. Indexable web
subjects add SEO. Other dimensions can be added per subject. Every required
dimension must have a requirement; one happy-path screenshot is insufficient.

The fail-closed `premiumPolicy` records canonical design authority/reference paths,
component/design governance contracts, single-token authority, extend-before-create,
raw-primitive bypass policy, legacy debt policy, rendered-review/production-data/
anti-generic requirements and the real state/form-factor/direction/input-mode
matrix. See `docs/quality/premium-experience.md` for the normative meaning.

## Custom component systems

Maintain one product component authority/registry with stable identities and
explicit platform mappings where useful. Share semantic design tokens and
behavioral contracts; use each platform's native implementation and interaction
conventions. A Blade component is not a Dart widget, and a wrapper with a matching
name does not establish parity.

Inventory the families the product actually needs:

- foundations, typography, icons, spacing, responsive shells and navigation;
- fields, selects, search, autocomplete, pickers, validation, file upload/crop;
- cards/lists, dense data grids where useful, filtering, sorting, bulk actions;
- dialogs, drawers, menus, tooltips, sheets, toasts and notification centers;
- skeletons, progress, empty/error/offline, permissions and recovery;
- rich text/media, charts, maps, timelines, calendars, commerce/domain controls.

For each adopted component define API, variants, interaction states, accessibility,
RTL/LTR, themes, responsive behavior, real-data limits and test/demo route. Test the
composed journeys too. **Extend before create** and measure product consumption;
do not build unused components simply to claim a huge kit. Legacy parallel
families may be governed by a shrink-only ratchet so debt cannot grow while callers
migrate.

## Test completeness

Trace risk -> subject -> requirement -> canonical task -> actual check -> evidence.
Use targeted tests in the task loop, relevant integration at workstream gates,
and the complete applicable matrix at RC. At minimum assess business rules, auth
and tenancy, API contracts, persistence/migrations, queues, concurrency/idempotency,
timeouts/retries, offline sync, localization, visual/accessibility, component/design
conformance, responsive/native behavior, performance, platform compatibility and
deploy/restore. Explicitly justify non-applicable dimensions in the native Test OS.
Never infer adequacy from line coverage alone.

Use production-shaped fixtures, long/empty/large data, timezone boundaries,
expired sessions, permission denial, interrupted writes, slow networks and
duplicate events. Test real integrations in authorized sandboxes where needed;
mocks support a layer, not an end-to-end product claim. Selective mutation testing
can assess important assertions. Quarantined/flaky/skipped required checks remain
visible through canonical tasks and cannot become PASS by rerunning until green.

## Evidence and mechanical limits

Run `node bin/validate-quality.mjs .` to validate declared coverage and task links.
Run `node bin/validate-quality.mjs . --release` to verify evidence. For opted-in
projects, execution integrity includes structural quality validation and
release-readiness includes the stronger evidence gate.

Evidence is a JSON report with schemaVersion `1.0.0` and one `results` entry per
requirement. Each PASS records `requirementId`, `observedAt`, `producer`,
`environment`, the exact declared `verification`, current `sourceHashes` and
retained `artifacts` containing `path` and SHA-256. For schema `1.1.0` premium, the
hash set includes the quality contract, `sourcePaths`, design authorities,
reference paths and component/design governance contracts. A token/governance
change therefore invalidates stale acceptance evidence. Automated results require
`exitCode: 0`; review results require a distinct `reviewer`.

The report is regenerated from checks, not edited into green. Preserve prior
reports in normal evidence history if needed. A later failure replaces a prior
PASS for the current gate. FAIL, NOT_RUN, missing and stale evidence block release.

The JSON schemas are enforced at the quality boundary: contracts and reports must
be objects; boolean flags cannot be strings or numbers; unsupported fields are
rejected, including task state on subjects. Observation times must contain a valid
calendar date, time and timezone. Malformed JSON values never mean an empty or
successful report. Managed paths reject existing and dangling symlinks before
writing. `doctor` includes execution integrity and withholds next-task suggestions
on integrity failure; it does not execute the product suite.

Hash checks detect changed declared inputs and outputs. They do not authenticate
who ran a check, prove a reviewer is a different human/session, judge visual
quality, discover unlisted requirements or render the product. Independent review
must inspect actual artifacts and source coverage. Runtime/production-dependent
observations need current RC/launch checks even when local file hashes still match.
A green contract validator is never a guarantee that every future product defect
is gone or that the rendered UI is objectively premium.

## Apply the bar to a real product

Use one representative vertical slice to establish the working quality pipeline:
an actual web screen and its Flutter counterpart where applicable, backed by real
domain behavior and at least one failure/recovery journey. Preserve existing
production data and stronger native acceptance rules. Do not approve replacement
of an existing client until parity, permissions, data reconciliation, UAT and the
required observation period have evidence. Server-side domain authority remains
primary for tenant scope, permissions, money and state transitions.

For that slice, establish approved visual references and native tokens, enumerate
the needed component states, prove component consumption, run browser/device and
accessibility checks, measure production performance, inspect native/platform
behavior and review the actual artifacts independently. A dense table, a complex
form, an overlay and an interrupted workflow reveal more than a decorative
landing-page sample. Scale the verified pipeline to the inventory after the slice
meets its criteria. This is a product implementation procedure, not a claim that
the central kit contains those screens or has run those checks.

Native acceptance must cover the gaps the generic validator cannot infer:

- reconcile route/component/content discovery with the declared subjects;
- reject required skipped tests, empty suites and mock-only end-to-end claims;
- read actual measurement reports instead of trusting an exit code alone;
- bind observations to candidate/build/environment and a relevant freshness rule;
- independently approve rendered output and changes to visual baselines;
- verify component consumption/design parity and real state matrices;
- verify domain invariants, restore/rollback and production health where relevant.

Use only fields supported by the selected schema version. Schema `1.0.0` remains
compatible; schema `1.1.0` is the versioned home of `premiumPolicy`, surface/role
context and the component/design/native dimensions. Stronger project-native
controls remain in their canonical contracts and retain raw outputs as evidence;
do not invent undeclared JSON fields to simulate them.

## v2.2.1 adapter acceptance

Browser requireAxe consumes a freshly produced axe result object, a non-empty array of result objects, or an object with a non-empty results array. Each scan contains violations, passes and incomplete arrays with at least one checked rule. Unresolved violations or incomplete checks fail; package installation and an empty JSON object cannot prove accessibility. The Playwright output path is reserved by the adapter.

Lighthouse minimumScores uses finite numbers from 0 to 100. Configured budgets require refreshed Lighthouse reports even if requireReports is false; an unchanged recent report is stale. Validate route/device/network coverage and production configuration in the product contract.

A declared component path must match that implementation path; a same-name component elsewhere cannot satisfy it. Missing/null/empty required state/variant/platform declarations require review. Design scans and token paths stay inside the project and reject symlinks. Component/design/content checks remain source/contract heuristics and never replace rendered premium UI review or native component tests.

## AntiFake source and data evidence

The native Surface Integrity guard includes AntiFake at changed-file task integration and full wave/phase/release inspection; v5 Audit independently scans production sources. `executionkit guard antifake . --all` is explicit diagnosis. It detects production faker/mock/fixture imports, named synthetic business collections/responses, Flutter placeholder widgets, unfinished implementations, lorem text and catch-time fake success. Neutral literal business-record collections and invented fallback payloads require blocking provenance review. Test folders remain excluded, but importing their fixtures into production is rejected. Config defaults, empty/error states and input hints are legitimate.

The scanner is bounded source evidence over supported web/PHP/JS/TS/Dart production roots, not a complete semantic proof against every renamed, computed, encoded or external fake. A SOURCE_ONLY PASS must be paired with genuine provider/consumer and trusted backend/API/database oracles, persistence and failure/recovery journeys. Never report all production data authentic from regexes or a polished screenshot. Synthetic data may support explicitly isolated tests, but must never replace production sources or live acceptance evidence.

Visual OS findings and unresolved independently audited image review feed bounded typed Decision quality signals. Signed valid dispositions already resolved by native Visual Audit do not reopen a quality loop; P0/P1 remain non-waivable. Compiled Decision denial protects design/token/component, contrast, responsive, state and AntiFake requirements. Neither advisory KB rules nor an ALLOW grant can override native acceptance evidence.
