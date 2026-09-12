# WP-S3-17 PERFORMANCE / ACCESSIBILITY / VISUAL QA — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000;
never end your turn waiting on a background task; never prettier `.mdx`). Then ORCHESTRATOR DECISIONS in
`docs/3BETTILT_STAGE3_STATE.md`, `3BETTILT_VISUAL_STYLE_GUIDE.md`, `handoff/WP_S3_03_HANDOFF.md` (tokens/primitives),
and grep every handoff in `docs/reports/stage3/handoff/` for `WP-17`, `WP-S3-17`, `card`, `390`, `overflow`, `a11y`
— those leftovers are yours. Known leftovers:
- FAQ band (shared FAQ section used on home/tools/learn) and lesson-bottom `RelatedContent` still render as small
  bordered card grids → card-wall remnant (contract: reduce card walls; use rows/lists/typographic groups).
- Home hero spade silhouette is plain.
- `DataTable` wraps awkwardly at 390px with 5+ columns (needs horizontal scroll container with visible affordance or
  a stacked mobile layout; never page-level horizontal scroll).

## Scope (master §CT + §CU)
1. **Visual QA with real screenshots** (`.data/tools/shoot.mjs`) at 1440×900 and 390×844 (full + `--fold`), dark +
   light, plus 320×700 overflow check, for: `/ko`, `/ko/blog`, a search guide (`/ko/blog/aks-vs-ako` or equivalent),
   a hand story, `/ko/learn`, a lesson, `/ko/glossary`, a term, `/ko/hands`, a hand (`/ko/hands/aks`), `/ko/tools`,
   range tool, equity tool, a quiz, `/ko/search?q=3벳`, `/ko/about`, a 404 → `artifacts/3bettilt-stage3-visual-qa/wp17/`.
   LOOK at every one and judge as a designer: empty space, tiny typography, card wall, visual repetition, awkward
   Korean wrapping (syllable breaks), bad crop, CTA priority, article rhythm, matrix usability, tool result readability,
   mobile layout, theme mismatch (a dark-only color leaking into light or vice versa), header, footer. Fix what you
   find (inside the boundary). Before/after pairs for every fix.
2. **Accessibility**: one `<h1>`, logical heading order (no skipped levels inside main content), landmarks (`header`,
   `nav` labelled, `main` once, `footer`), skip link works, every interactive control keyboard-reachable with visible
   focus, 44px touch targets on mobile, form labels, `aria-*` correct on toggles/menus/tabs, images alt / decorative
   `aria-hidden`, `prefers-reduced-motion` respected, color contrast ≥ 4.5:1 body / 3:1 large text in BOTH themes
   (compute from resolved CSS colors with a script — no new npm dependency; if you think axe is needed, report).
   Extend `tests/e2e/responsive-a11y.spec.ts` with deterministic checks for what you verified.
3. **Performance**: static prerender (no `ƒ`), per-route first-load JS from the build output (report the table; flag
   routes whose client JS grew vs baseline `docs/reports/stage3/WP_S3_00_BASELINE.md` if it records it), no layout
   shift from fonts/images (fixed aspect ratios), images sized, no giant inline SVG/data URIs, `client-bundle.spec.ts`
   green. Lighthouse is not installed — don't add it; a Playwright `PerformanceObserver` LCP/CLS measurement on a
   production `next start` for the representative pages is enough (report numbers as measured on this machine,
   clearly labelled as local lab values).

## File boundary
- Shared presentational components and styles: `src/components/**` (visual/markup only — no data, graph, content
  logic or quiz/tool calculation changes), `src/app/globals.css` (tokens/utilities; keep existing token names),
  page layout JSX under `src/app/[locale]/**` (not metadata/JSON-LD — WP-16 owns those; don't regress them),
  `tests/e2e/responsive-a11y.spec.ts` + visual/a11y assertions in existing specs you must update because markup changed,
  `.data/tools/**`, `docs/reports/stage3/WP_S3_17_QA_REPORT.md`, `docs/reports/stage3/handoff/WP_S3_17_HANDOFF.md`.
- NOT yours: content MDX/registry, SEO lib, tool/quiz logic. Report.

## Done when
- typecheck 0; `pnpm vitest run --project fishtilt --project learn-core` 0 failures; eslint clean; build ok, no `ƒ`;
  full `pnpm e2e:fishtilt` green via build-lock (run it once at the end).
- `docs/reports/stage3/WP_S3_17_QA_REPORT.md`: per page × viewport × theme verdict table, fixes with before/after
  screenshot paths, a11y checklist results, contrast table (both themes), JS-size table, LCP/CLS lab values, remaining
  issues with severity.
- Handoff. Final reply ≤ 25 lines. Stop.
