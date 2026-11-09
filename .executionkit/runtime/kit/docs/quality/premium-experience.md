# Premium Experience — cross-cutting construction contract

Premium Experience is a **construction invariant**, not a ninth OS, not a capability level, not a separate backlog and not a late visual-polish phase. It applies to user-facing product work across the current ExecutionKit systems while preserving their ownership boundaries:

- **Execution OS** owns lifecycle/dependencies and the canonical TODO/native task authority.
- **Agent OS** routes the design/component/premium skills into applicable UI work.
- **Content OS** owns complete, truthful, localized product content and media.
- **SEO OS** owns organic-search applicability and search-surface policy; premium presentation never substitutes for search value or crawl/index correctness.
- **Audit OS** independently challenges product quality and records findings.
- **Test OS** owns executable verification policy and evidence requirements.
- **Launch OS** blocks release when required current evidence is absent or stale.
- **State OS** preserves reconstructable continuity but never owns acceptance/task state.

The product's native design and component authorities remain primary. This contract defines the minimum governance and evidence shape required to call a user-facing candidate premium; it never copies another project's brand or forces one visual style.

## 1. Applicability

Premium Experience applies when the repository contains a user-facing web, Flutter/mobile, desktop or reusable UI-component surface whose project contract uses the `premium` quality profile. API-only, worker-only and infrastructure-only scopes do not become UI work merely to satisfy this contract. Mixed products apply it to the relevant subjects rather than pretending the entire repository has one surface type.

For quality schema `1.1.0`, every premium UI subject declares its concrete `surface`/shell and intended `role`/audience. Generic names such as `app` or `user` are acceptable only when they are genuinely the project's concrete scope; they must not hide materially different admin/owner/customer/field/provider experiences.

A project may keep schema `1.0.0` for compatibility. New/reconciled premium UI work should use `1.1.0` so the stronger governance dimensions are structurally enforced.

## 2. Product truth before pixels

Before implementation or review, reconstruct the actual product context:

1. user role/job/decision and critical journey;
2. current surface/shell/navigation model and information-density needs;
3. approved brand/product references and existing production behavior;
4. canonical semantic design authority;
5. canonical reusable component/widget/custom-element registry or contract;
6. real data shapes/cardinality, long values, permissions and failure modes;
7. supported themes, languages/directions, form factors and input modes;
8. browser/native/desktop platform behavior;
9. applicable accessibility, performance, offline and content contracts.

Do not infer the direction from a framework starter, a single mockup, an isolated screenshot or remembered chat context. If authorities are missing/contradictory, the gap is canonical work; do not paper over it with page-local constants and one-off components.

## 3. Single design authority

A premium product has one canonical semantic authority per design concern. As applicable this includes:

- brand/semantic color roles and state colors;
- typography families, weights, scale, numeric/Arabic/Latin behavior;
- spacing, sizing and density scales;
- radii, borders, elevation/shadows and surfaces;
- motion durations/curves and reduced-motion behavior;
- interaction target geometry;
- responsive breakpoints/layout primitives;
- iconography/media grammar;
- light/dark/system theme roles.

Surface-specific projections may vary density/layout/role accents without becoming competing token authorities. Compatibility aliases are allowed only when they **delegate** to the canonical authority and have parity/drift protection. Copying token values into multiple apps/pages and keeping them “in sync by convention” is not a governed design system.

For schema `1.1.0`, `premiumPolicy.designAuthorityPaths` identifies the real authority files and `singleTokenAuthority` must be true. These files participate in evidence hashing so a material authority change invalidates stale release evidence.

## 4. Component-system governance

Premium UI is **component-first** but not component-count-driven.

- **Extend before create.** If the canonical registry already owns the semantic capability, extend its props/variants/states rather than fork a parallel component.
- **Create only when absent.** A new canonical component needs an actual reusable product capability, documented ownership/API and tests.
- **Deprecate deliberately.** Record replacement direction, stop new consumption, migrate callers and remove the old family under an owned task/wave.
- **Consumption is the gate.** A beautiful component catalog does not help if product screens still duplicate raw controls and page-local styling.
- Raw HTML/Flutter/platform primitives are expected *inside* canonical component implementations. `rawPrimitiveBypass=forbid-when-covered` applies to product surfaces bypassing an owned abstraction whose capability already exists.
- Cross-platform parity means shared semantics/contracts/tokens where useful plus native implementation behavior; a Blade component is not a Dart widget merely because names match.

Existing legacy families may use `legacyDebtPolicy=shrink-only`: the baseline can shrink but may not grow. Projects with no accepted legacy bypass use `none`.

## 5. Surface and role specificity

Premium does not mean one visual recipe everywhere. Evaluate each shell against its actual job:

- public/discovery surfaces optimize comprehension, trust, content and conversion;
- customer workspaces optimize task continuity and decision clarity;
- dense admin/operations surfaces optimize scanability, filtering, bulk action and risk visibility;
- owner/provider workspaces optimize business context and actionable metrics;
- field/driver/representative surfaces optimize one-handed action, location/connectivity realities and fast state recognition;
- immersive/media/learning surfaces may require a materially different hierarchy and motion model.

Do not clone the same hero/stat-card/rounded-grid shell across unrelated roles just to look consistent. Consistency belongs in semantic design language, not identical information architecture.

## 6. State completeness

The happy path is only one state. Schema `1.1.0` premium contracts define `requiredStates` and must include at least:

- loading;
- empty;
- error;
- success;
- disabled.

Use additional states whenever the product can actually enter them, including skeleton/optimistic, permission/auth denial, degraded dependency, offline, retry/reconnect, queued sync, stale/conflict, destructive confirmation, irreversible warning, partial progress and background completion.

A state is not accepted merely because an alert exists. It must preserve context, explain what happened at the right level, expose the next safe action and avoid accidental duplicate/destructive behavior.

Offline subjects must include at least `offline` and `retry`; richer offline-first products usually need queue/sync/conflict/reconnect evidence too.

## 7. Responsive and adaptive behavior

Premium web schema `1.1.0` requires at minimum mobile and desktop evidence; add narrow/tablet/wide where the actual product needs them. Do not equate a CSS breakpoint with acceptance. Inspect hierarchy, density, overflow, sticky/fixed UI, tables/lists, filters, overlays, touch targets, navigation and content wrapping with production-shaped data.

Flutter/mobile should exercise supported phone/tablet/orientation boundaries, text scaling, safe areas, keyboard/insets and system overlays. Desktop surfaces should exercise resizable windows, density and keyboard/mouse behavior where applicable.

Layout should adapt to job and available space, not merely stack every desktop card vertically on mobile.

## 8. RTL/LTR and localization

Declare only directions the product actually supports, then render them. For bilingual products inspect:

- logical start/end spacing and alignment;
- mixed Arabic/Latin/numbers/units/date/currency content;
- long localized labels and validation messages;
- correct directional-icon mirroring and non-mirrored brand/media assets;
- table/list ordering and pagination semantics;
- focus/read order;
- truncation/wrapping/line-height;
- typography fallback and packaged font ownership.

`dir="rtl"` or a locale switch alone is not bidirectional acceptance.

## 9. Accessibility and input modes

Premium web `1.1.0` requires touch, keyboard and screen-reader semantics. Flutter requires touch and screen-reader/semantics coverage. Desktop UI requires mouse, keyboard and screen-reader coverage.

Assess as applicable:

- semantic role/name/value/state;
- heading/landmark/dialog/menu relationships;
- keyboard traversal and visible focus;
- focus trapping/restoration for overlays;
- target size and gesture alternatives;
- contrast across themes/states;
- error association/instructions;
- zoom/text scaling;
- reduced motion;
- accessible charts/media/maps/custom controls;
- disabled/read-only semantics.

Accessibility is part of interaction correctness, not a later compliance skin.

## 10. Native/platform behavior

### Web/browser

Inspect browser history/back-forward, deep links, scroll/focus restoration, overlays, route/loading transitions, keyboard/pointer/touch parity, file/media flows, runtime console errors and actual browser support required by the project.

### Flutter/mobile

Inspect safe areas/system bars, navigation/back semantics, keyboard/insets, permissions, app lifecycle/background/foreground, deep links, connectivity/offline, notifications, camera/file/share/location flows, haptics where useful and Android/iOS conventions. A Flutter screen that behaves like a resized web mockup is not native acceptance.

### Desktop

Inspect window resizing/state, density, keyboard accelerators/focus, filesystem/clipboard/native dialogs, multi-window/system integration and lifecycle behavior where applicable.

`native-behavior` is a required quality dimension for premium `flutter` and `desktop` subjects under schema `1.1.0`.

## 11. Production-shaped data and content

Final premium acceptance must use data shaped like production, not a conveniently empty demo. Include relevant stress cases such as:

- realistic list/table density and pagination;
- long names/descriptions/addresses;
- missing/large/odd media;
- zero/high money values and precision;
- dates/timezones/status mixtures;
- permission differences;
- no results and large result sets;
- delayed/failed integrations;
- localized long copy.

Placeholder/lorem copy, demo/mock residue, fake testimonials/metrics, generic AI prose and unowned low-quality media are content findings, not harmless visual details.

## 12. Anti-generic review & intelligent design refinement

Before substantial UI construction, redesign, or visual remediation, establish a product-specific **Five-Part Design Direction** via `skill.design-refinement` (adapted from Unslop by Damir Sokolovsky `@heydamir`, CC BY 4.0, reconciled with ExecutionKit Visual OS v2 and AntiFake invariants):

1. **Product** — actual purpose and target audience in one plain sentence.
2. **Character** — 2-3 specific personality adjectives (banning generic filler words like `modern`, `clean`, `sleek`, `minimal`, `innovative`, `seamless`, `cutting-edge`).
3. **World** — authentic visual environment and materials informing neutral surface tints and contrast.
4. **Moments** — 1-2 focal areas per screen carrying visual richness and accent color while navigation chrome stays quiet.
5. **Signature** — one recognizable product-specific detail applied consistently across screens.

Select the warranted intervention level based on observed findings:
- **No Change**: Preserve cohesive, brand-aligned design; at most note 2-3 optional exact-value refinements.
- **Light Polish**: Correct observed defects only while preserving approved brand identity, layout, and component structure.
- **Full Refinement**: Execute a systematic redesign when pervasive generic AI-generated patterns are observed.

Evaluate and refine across **Nine Conceptual Refinement Passes** in a single coherent pass (never 9 separate agent calls or 9 render loops):
`Spacing -> Color -> Icons -> Copy -> Typography -> Layout -> Details -> Visuals -> Motion`.

Actively challenge these signals without turning them into simplistic automatic failures:

- framework-default/starter-kit appearance;
- identical rounded-card/shadow/grid recipes across unrelated products/roles;
- every content group wrapped in a card because hierarchy is unresolved;
- huge empty whitespace in operational surfaces where scan density matters;
- decorative dashboards with metrics but weak decisions/actions;
- duplicated raw buttons/inputs/modals/cards despite an owned component family;
- hardcoded token drift and inconsistent typography/iconography/motion;
- decorative emoji in navigation chrome, buttons, table headers, or badges;
- AI marketing hype copy (`Supercharge`, `Unlock the power of`, `!!`) or bare KPI deltas without comparison windows;
- layout-shifting `transition-all` or gratuitous `animate-pulse` / `hover:scale` motion;
- generic hero/stat/testimonial structures unrelated to the product job;
- mobile screens that are sparse web ports and omit native navigation/actions/states;
- demo/placeholder/fabricated content presented as finished product;
- visual polish masking broken workflow, permission, responsiveness, accessibility or native behavior.

The reviewer must explain the product-specific reason for a finding. “Looks modern,” “looks AI-generated,” or “doesn't look premium” without observable criteria is not sufficient audit evidence.

## 13. Rendered evidence loop

The required Visual OS v2 and Premium Experience lifecycle is:

`Discover -> Design Direction -> Implement/Refine -> Capture -> Critique -> Remediate -> Re-capture -> Independent Certification`

```text
inspect authority + current product (Discover + 5-Part Design Direction)
→ implement/refine through canonical tokens/components (No Change | Light Polish | Full Refinement across 9 passes)
→ targeted automated verification (UX, AntiFake, Assets, Visuals, Perf, Flutter guards)
→ render with production-shaped data (Capture)
→ inspect required states/form factors/themes/directions/input modes/platform behavior (Critique across 21 dimensions)
→ record findings in canonical TODO
→ correct through canonical work (Remediate)
→ re-render corrected candidate (Re-capture)
→ independent review and certification where required (reviewer != producer)
```

Source review and static heuristics are useful but cannot certify visual/interaction quality. Screenshot diffs detect pixel changes but do not judge product fitness. Component existence does not prove consumption. Automated accessibility tools do not replace keyboard/screen-reader/manual semantics review. A build succeeding does not prove native behavior.

Evidence identifies the current candidate/source hashes, verification procedure, environment/browser/device/build and retained artifacts. Visual review uses a reviewer distinct from the implementation producer. A material change to declared implementation, design authority, references or component/design contract invalidates stale evidence through source hashing.

## 14. Quality schema `1.1.0`

A premium `1.1.0` contract adds structural dimensions and policy fields on top of the compatible `1.0.0` model.

UI subjects require the existing premium dimensions plus:

- `components`;
- `design-system`;
- `native-behavior` for Flutter/desktop.

The `premiumPolicy` fail-closed fields are:

- `designAuthorityPaths`;
- `referencePaths` (may be empty when the product truth genuinely has no external/reference artifact);
- `componentContractPath`;
- `designContractPath`;
- `singleTokenAuthority: true`;
- `extendBeforeCreate: true`;
- `rawPrimitiveBypass: "forbid-when-covered"`;
- `legacyDebtPolicy: "shrink-only" | "none"`;
- `renderedReviewRequired: true`;
- `productionShapedDataRequired: true`;
- `antiGenericReviewRequired: true`;
- `requiredStates`;
- `requiredFormFactors`;
- `requiredDirections`;
- `requiredInputModes`;
- optional `supportedThemes` and `platformNotes`.

The distributed starter intentionally does not pass unchanged: the adopter must replace empty design-authority/source inventories and reconcile applicability to the real repository.

## 15. Audit/Test/Launch boundaries

**Audit:** reconstructs the denominator, independently inspects rendered output/component consumption/design drift/state completeness/anti-generic signals, maps executable findings to canonical TODO and never owns remediation state.

**Test:** executes the required task/phase/RC browser/device/widget/E2E/accessibility/performance/native checks and preserves environment/candidate evidence. The expensive full self-hosted suite remains a phase-boundary/default RC action, not a per-task reflex.

**Launch:** release blocks when required premium quality results are missing, failed, stale or bound to the wrong candidate/environment. Launch consumes accepted evidence; it does not declare a design premium merely because the release checklist is green.

**State:** may checkpoint the authority paths, rendered evidence references and next safe action, but a checkpoint never converts prior evidence into current PASS.

## 16. Mechanical limits

`node bin/validate-quality.mjs .` validates declared structure, source presence, task linkage and policy consistency. `--release` validates declared evidence integrity/current hashes. Neither command renders the product, runs browser/device checks, authenticates the human identity of a reviewer, discovers every missing surface or guarantees the subjective quality of design.

A structural validator PASS therefore means **the declared contract is internally coherent**, not “the UI is definitely premium.” The final claim remains evidence-bound and independently reviewable.
