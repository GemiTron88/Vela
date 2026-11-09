---
name: seo-gate
description: Implement and evaluate S0-S5 SEO gates, technical SEO, structured data, and sitemaps.
---

# Skill — SEO OS Architecture, Implementation & Gates (S0–S5)

1. Check SEO applicability and gate status via `executionkit seo status .` and `executionkit seo validate .`.
2. Cover the full SEO lifecycle across public indexable surfaces:
   - **Discovery & Architecture (S0–S1):** URL canonicalization, crawl/index policy (`robots.txt`, meta robots), internal linking, taxonomy/commerce/local/programmatic page families, and international `hreflang` parity.
   - **Implementation & Structured Data (S2):** unique title/meta descriptions, OpenGraph/Twitter cards, semantic headings, and truthful JSON-LD structured data matching visible page facts.
   - **Release, Production & Operations (S3–S5):** candidate-bound release validation, sitemap/canonical live host alignment, and Core Web Vitals / performance budgets (`executionkit guard perf .`).
3. Private/authenticated-only surfaces must be explicitly excluded from indexable sitemaps and marked non-indexable.
