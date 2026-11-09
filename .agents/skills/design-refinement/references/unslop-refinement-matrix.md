# Reference — Unslop Diagnostic Signs, Token Scales & Visual OS Mapping

> **Context Economy Note**: Load this reference on demand when diagnosing generic AI UI patterns, establishing fallback design tokens, or mapping refinement findings to ExecutionKit's 21 Visual OS review dimensions.

## 1. Diagnostic Signs of Generic AI UI ("Slop") & Required Remedies

| Pass | Observable Slop Sign | Concrete Remedy & ExecutionKit Enforcement | Visual OS Dimension |
| :--- | :--- | :--- | :--- |
| **1. Spacing** | Uniform padding everywhere (`p-6 gap-6` on all layers); arbitrary off-grid values (`13px`, `37px`); cramped touch controls (`< 44px`). | Use `4px`/`8px` rhythm (`4, 8, 12, 16, 24, 32, 48, 64px`). Keep inner group gaps tighter than outer container padding. Enforce `>= 44x44px` (`48x48dp` Android) touch targets. | `spacing`, `alignment`, `density`, `touch` |
| **2. Color** | Pure `#000000` or `#ffffff` with flat `#808080` gray; purple-to-blue glowing gradients (`from-purple-500 to-blue-500`, `from-indigo-500 via-purple-500 to-pink-500`); colored left-border accent strips on every card; neon dark mode. | Tint neutrals toward the product's **World** hue (`0.005-0.015` OKLCH chroma). Reserve 1 primary brand accent (`>= 4.5:1` contrast) for primary actions/active states. Use semantic status colors (`success`, `warning`, `danger`, `info`) only for real data state. | `contrast`, `theme-parity`, `identity`, `generic-risk` |
| **3. Icons** | Decorative emoji (`🚀`, `✨`, `🔥`, `💡`, `⚡`) inside navigation items, buttons, table headers, or KPI badges; each icon trapped in a tinted circular badge; mixed stroke weights (`1.25px` next to `2.5px`). | Strip decorative emoji from UI chrome (`UX_SLOP_DECORATIVE_CHROME_EMOJI`). Use one vector icon library with consistent `1.5px-2px` stroke, optical alignment, and `aria-label` on icon-only controls (`UX_A11Y_ICON_BUTTON_UNLABELED`). | `hierarchy`, `identity`, `focus`, `generic-risk` |
| **4. Copy** | AI hype verbs (`Supercharge`, `Unlock the power of`, `Revolutionize`, `Seamless`, `Next-gen`); multiple exclamation marks (`!!`); bare KPI deltas (`+12.5%` without baseline); fabricated customer testimonials or `John Doe` / `acme@example.com` data. | Write plain, domain-accurate copy (`UX_SLOP_HYPE_EXCLAMATION_COPY`). Always state comparison windows (`+12.5% vs prior 30d`). Bind real product data and honest empty/loading/error states (`AntiFake Guard`). | `cta`, `states`, `identity`, `generic-risk` |
| **5. Typography** | System-default Inter/Arial with no product character; `font-black` (`800-900`) everywhere; wide-tracked uppercase labels everywhere; negative tracking (`-0.03em`) on small body text or Arabic script; misaligned numeric columns. | Pair characterful display/UI fonts with approved Arabic fonts (`Cairo`, `Tajawal`, `IBM Plex Sans Arabic`, `Noto Kufi Arabic`). Use `tabular-nums` for numbers, `45-70ch` line width, and `letter-spacing: 0` on Arabic (`RTL`). | `typography`, `truncation`, `rtl-ltr`, `hierarchy` |
| **6. Layout** | Centered marketing hero with 3 stacked pills and 4 competing CTAs; 3-4 identical icon-title-paragraph cards in a uniform grid; fixed-width containers (`w-[600px]`) overflowing mobile viewports; physical `ml-/mr-/pl-/pr-` breaking RTL. | Use scene or asymmetric split heroes with at most 1 primary + 1 secondary CTA. Give primary dashboard workflows dominant width (`2fr 1fr` or full-bleed workspace). Use logical properties (`ms-/me-/ps-/pe-`, `EdgeInsetsDirectional`) and responsive stacking. | `hierarchy`, `responsiveness`, `overflow`, `cta`, `rtl-ltr` |
| **7. Details** | Identical `rounded-xl` on both outer card and inner image (`inner` should be `max(4px, outer - padding)`); heavy drop shadows combined with thick borders; rainbow multi-axis charts with floating legends. | Concentric radii (`outer 16px - padding 8px = inner 8px`). Quiet `1px` structural borders or subtle elevation (not competing glow + border). Charts highlight 1 primary series with direct axis/unit labels. | `alignment`, `density`, `hierarchy`, `generic-risk` |
| **8. Visuals** | Abstract 3D blobs, neon meshes, floating glass spheres, broken `<img>` tags, raster images wrapped in `<svg>`, or unlicensed web images. | Dashboards rely on real data components rather than decorative filler. Required media roles follow Visual Production v5: (1) original authored SVG/code, (2) host image generation, (3) licensed commercial-derivative web research with provenance. | `media`, `identity`, `states`, `generic-risk` |
| **9. Motion** | Continuous `animate-pulse` / `animate-ping` on non-loading elements; `transition-all` animating layout (`width`, `height`, `top`, `left`); `hover:scale-105` jitter on cards/rows; missing `prefers-reduced-motion`. | Use `transition-colors`, `transition-opacity`, or `transition-transform` (`150-220ms ease-out`). Honor `prefers-reduced-motion: reduce` (`UX_MOTION_REDUCED_MOTION_MISSING`, `UX_MOTION_TRANSITION_ALL_FORBIDDEN`). | `focus`, `states`, `generic-risk` |

## 2. Fallback Design Token Scales (When Project Tokens Are Not Yet Defined)

Always inspect existing project tokens (`theme.css`, `tailwind.config.*`, `design-tokens.json`, Flutter `ThemeData` / `ColorScheme`) first. When bootstrapping a new UI surface without pre-existing tokens:
- **Spacing & Sizing Scale (`px`)**: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`
- **Radius Scale (`px`)**: `sm: 6`, `md: 8`, `lg: 12`, `xl: 16` (Concentric rule: `r_inner = max(4, r_outer - padding)`)
- **Type Scale (`rem` / `px`)**:
  - `xs`: `0.75rem` (`12px`, line-height `1.4`) — metadata, timestamps, quiet badges
  - `sm`: `0.875rem` (`14px`, line-height `1.5`) — dense table cells, secondary controls, form labels
  - `base`: `1rem` (`16px`, line-height `1.6` Latin / `1.7` Arabic) — primary body copy
  - `lg`: `1.125rem` (`18px`, line-height `1.45`) — card titles, section intros
  - `xl`: `1.25rem` (`20px`, line-height `1.35`) — panel headers
  - `2xl`: `1.5rem` (`24px`, line-height `1.25`) — page titles
  - `3xl+`: `2rem-3rem` (`32px-48px`, line-height `1.1-1.2`) — hero display headlines (tracking `-0.02em` Latin only; `0` in Arabic)
- **Surface & Text Roles**:
  - `bg-canvas` (base page), `bg-surface` (cards/panels), `bg-elevated` (modals/popovers), `bg-subtle` (quiet groupings/table headers)
  - `text-primary` (`>= 7:1` preferred), `text-secondary` (`>= 4.5:1`), `text-muted` (`>= 4.5:1` for functional text)
  - `border-subtle` (hairline dividers), `border-strong` (interactive input/control boundaries)

## 3. Reconciliation With ExecutionKit Visual OS v2 & AntiFake Guard

1. **No Plausible Mock Data in Production**: Unlike standalone design prototypes, ExecutionKit production surfaces must never ship hardcoded sample rows, fake testimonials, or placeholder metrics (`lib/anti-fake-guard.mjs`). Use real backend/store bindings and explicit `empty`, `loading`, `error`, and `offline/retry` states.
2. **No Artificial Render Cap**: Complete the full Visual OS loop (`Discover -> Design Direction -> Implement/Refine -> Capture -> Critique -> Remediate -> Re-capture -> Independent Certification`) until all 21 dimensions pass independent review.
3. **Preserve Intentional Visual Languages**: Do not flatten approved Liquid Glass, Material 3, rich media portals, or domain-specific themes into austere grayscale.

## Attribution
Adapted from **Unslop** by Damir Sokolovsky (`@heydamir`, `https://github.com/heydamir/unslop`, commit `a6f121eee5f29c2f74976b75456feae8b66afb3a`, `https://heydamir.design/unslop`), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified to integrate with ExecutionKit Visual OS v2, Arabic/RTL bidirectional layout rules, Flutter Android ergonomics, and AntiFake production guards.
