---
name: design-refinement
description: Establish product-specific 5-part design direction, classify intervention level, and execute 9-pass anti-generic UI refinement across Web and Flutter surfaces.
---

# Skill — Intelligent Design Refinement & Anti-Slop Governance

## Purpose & Authority Order
Apply systematic design direction and anti-generic ("unslop") refinement to new UI construction, explicit redesigns, and Visual OS remediation.
Authority order: **Approved Product Brand & Design Tokens -> Governed Component System (`GemiUI`/project components) -> Visual OS v2 & AntiFake Contracts -> Design Refinement Principles**. Never override approved brand palettes, typography, or intentional visual languages (approved Liquid Glass, Material 3, immersive media, pixel-art) with a generic monochrome style.

## 1. Five-Part Design Direction (Before Substantial UI Work)
Establish five decisions before building or redesigning a surface:
1. **Product**: State what the product does and who uses it in one plain sentence.
2. **Character**: Choose 2-3 specific adjectives (`editorial, calm, high-density` or `tactile, field-ready`). Ban generic filler (`modern`, `clean`, `sleek`, `minimal`, `innovative`, `seamless`, `cutting-edge`, `next-gen`).
3. **World**: Name the real-world material or environment informing neutral surface tint, contrast, and texture.
4. **Moments**: Select 1-2 focal areas per screen (primary KPI chart, active order timeline, hero composition) carrying visual richness while navigation and chrome stay quiet.
5. **Signature**: Define one recognizable product-specific detail (monospace tabular audit badges, directional timeline connectors, custom SVG status glyphs) applied consistently across screens.

## 2. Three Intervention Levels
Inspect rendered or source surfaces first and choose the minimum warranted intervention:
- **No Change**: Hierarchy, token discipline, typography, spacing, and product character are cohesive. Preserve the design; at most note 2-3 optional exact-value refinements.
- **Light Polish**: Direction is sound but specific defects exist (inconsistent spacing, raw hex literals, decorative emoji in chrome, noisy borders, missing focus/touch states). Fix only observed defects while preserving layout and brand identity.
- **Full Refinement**: Pervasive generic AI-generated patterns exist (purple-to-blue glowing gradients, 3-4 identical icon-in-circle cards, uniform 4-stat KPI rows with bare deltas, hype copy, arbitrary spacing). Establish a 5-part Design Direction and apply all 9 passes in one coherent implementation pass.

## 3. Nine Conceptual Refinement Passes (Single Coherent Pass)
Evaluate and refine in order during one implementation/review pass (never spawn 9 separate agent runs or 9 render loops):
1. **Spacing**: Enforce `4px`/`8px` rhythm, tighter internal group spacing than outer section gaps, shared alignment edges, and `>= 44x44px` touch targets on mobile/Flutter.
2. **Color**: Use tinted neutrals from project tokens, 3 text hierarchy roles (`primary`, `secondary`, `muted`), quiet chrome, 1 primary brand accent (`>= 4.5:1` contrast), and semantic status colors (`success`, `warning`, `danger`, `info`) reserved for real state.
3. **Icons**: Remove decorative emoji from navigation, buttons, headers, and badges. Use one vector icon set with uniform stroke width and accessible labels on icon-only controls.
4. **Copy**: Write product-specific headlines and labels. Remove AI hype (`Supercharge`, `Unlock the power of`, `AI-powered magic`), exclamation marks in UI chrome/alerts, and trailing periods on buttons. Pair metrics with real baselines (`+12.4% vs prior 30d`). Never invent fake testimonials, claims, or placeholder business data (`AntiFake Guard`).
5. **Typography**: Use approved Latin and Arabic/RTL fonts (`Cairo`, `Tajawal`, `IBM Plex Sans Arabic`, `Noto Kufi Arabic`). Build hierarchy via size and contrast rather than `800-900` weight overuse; keep body copy `45-70ch`; apply `tabular-nums` to numeric columns/KPIs; never use negative `letter-spacing` on small text or Arabic script (`letter-spacing: 0` mandatory in RTL).
6. **Layout**: Preserve functional user journeys, routes, and section order unless authorized. Break uniform card grids by giving the primary workflow/chart dominant width; limit heroes to 1 primary + 1 secondary CTA; ensure responsive mobile stacking and logical RTL/LTR flow (`ms-/me-/ps-/pe-`, `EdgeInsetsDirectional`).
7. **Details**: Compute concentric nested border radii (`inner = max(4px, outer - padding)`), replace glowing gradient pills with quiet token badges, and give charts 1 clear lead series with direct axis/unit labels.
8. **Visuals**: Eliminate generic 3D blobs, neon orbs, and unverified stock photos. Required media roles (`hero`, `banner`, `background`, `illustration`, `icon`, `empty`, `dynamic`) follow Visual Production v5 priority (safe SVG/code -> host image generation -> licensed commercial-derivative research).
9. **Motion**: Remove gratuitous `animate-pulse`, `animate-ping`, `hover:scale-*`, and layout-shifting `transition-all`. Animate only `transform`, `opacity`, `color`, `background-color`, and `border-color` with `prefers-reduced-motion` / `disableAnimations` support.

## Extended Reference & Attribution
- Read `.agents/skills/design-refinement/references/unslop-refinement-matrix.md` on demand for diagnostic signs, token fallback scales, and 21-dimension Visual Critic mappings.
- Adapted design-refinement concepts incorporate material from **Unslop** by Damir Sokolovsky (`@heydamir`, `https://github.com/heydamir/unslop`), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), reconciled with ExecutionKit Visual OS v2 and AntiFake invariants.
