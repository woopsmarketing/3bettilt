# WP-S3-17 — Performance / Accessibility / Visual QA

## Objective

Visual sweep (1440/390 × dark/light + 320 overflow) of the 17 named surfaces with real screenshots,
accessibility audit (no axe, scripted) with deterministic e2e checks, performance facts (static
prerender, per-route JS, LCP/CLS lab values), fixes inside the presentational boundary, carried-over
items (global-error, HomeHeroVisual aria-hidden, FAQ + RelatedContent card walls, plain hero spade,
DataTable at 390). Full report: `docs/reports/stage3/WP_S3_17_QA_REPORT.md`.

## Facts verified before work

- `src/app/global-error.tsx` already existed with `lang="ko"` and title `문제가 생겼습니다 · 3BetTilt` → carried-over item closed without change.
- Tailwind v4 compiles `outline-none` to `--tw-outline-style: none; outline-style: none` and `focus-visible:outline-2` to `outline-style: var(--tw-outline-style)` → with the site-wide `outline-none focus-visible:outline-2` idiom NO focus ring ever drew (audit: 39–40 of 40 tab stops without a ring on every page, both themes).
- `DataTable` at 390/320 with 5+ columns broke header words mid-syllable ("UT G", "19.15 / %") and the `<caption>` scrolled out of view with the table.
- `FaqSection` `open` variant and `RelatedContent` `LinkRow` rendered bordered/`bg-panel-700` boxes in grids (card walls, D-S3-17).
- WP-14 had flagged 44px failures on `/ko/learn`; the full e2e showed them also on glossary hub, blog hub and lesson header; `/ko/practice/hand-ranking-quiz` scrolled sideways at 360 (answer button min-content 344 px in a 312 px column).
- `HomeHeroVisual.test.tsx` forbids `id` attributes inside the visual (a `<linearGradient id>` attempt failed; CSS `mask-image` used instead).
- `client-bundle.spec.ts` budgets: about 560, lesson/article/term/hand 660, range 670, equity 690, search 650, quiz 750 KB.

## Decisions made

1. Focus rings: one unlayered rule in `globals.css` (`[class*='focus-visible:outline']:focus-visible, .group:focus-visible [class*='group-focus-visible:outline'] { --tw-outline-style: solid }`) instead of editing 111 call sites. Unlayered beats `@layer utilities`; elements with only `outline-none` stay ring-less (intended for programmatic-focus targets).
2. Wide tables: `.table-scroll` wrapper (`position: relative; timeline-scope; contain: inline-size`) + inner `[data-scroller]` (`overflow-x: auto; scroll-timeline`) + `::after` right-edge fade driven by CSS scroll-timeline (no JS; unsupported browsers simply get no fade). `contain: inline-size` is what stops a table's min-content from widening a flex/grid parent that lacks `min-w-0` (`/ko/tools/starting-hand` regression found and fixed in-WP).
3. Card walls → ruled lists: `FaqSection` open variant is a `divide-y border-y` list; `RelatedContent` rows are `border-b` rows where the whole row is the 44px `<a>` with a `→` affordance. `RELATED_LABELS` (7) untouched.
4. 44px targets without changing line boxes: `inline-block py-3 -my-3` on inline links (glossary word/index/related links, blog `ArticleTitle`, lesson prerequisites, learn roadmap/topic links); `min-h-11` on chips/tabs/type nav; the lesson category pill stays 25px inside a 44px anchor whose ring is drawn on the pill via `group-focus-visible` (covered by decision 1's second selector). `BlogCategoryNav` row height unchanged (li `py-3`→`py-1.5`, a `min-h-8`→`min-h-11`).
5. Quiz answer visuals: indent `pl-9` only from `sm`; `PokerCards` card group `flex-wrap` (wraps only below 272 px of width, i.e. 320 px phones in a quiz option) — page-level overflow is the worse failure.
6. Home hero spade: two-layer SVG (8.5 % fill + faint outline at 106 %) with a CSS mask fade; `aria-hidden` + `focusable="false"`.
7. `PageHero` facts on phones: 2-column grid (no orphaned 4th fact).
8. Contrast findings NOT changed: breadcrumb `›` (`aria-hidden`, 4.14 dark / 3.72 light) and `PositionDiagram` SVG text (script false positive; painted with `fill-text-100`).
9. Not done (outside boundary / logic): `mdx-components.tsx` table wrapper, equity result-panel CLS 0.059, WP-16's `seo-audit.mjs` lint errors.

## Files changed

- `apps/fishtilt/src/app/globals.css` — focus-ring reset rule, `.table-scroll` rules + `@keyframes table-scroll-fade` (token names unchanged).
- `apps/fishtilt/src/components/`: `FaqSection.tsx`, `RelatedContent.tsx`, `DataTable.tsx`, `DataTable.test.tsx` (updated, see Tests), `PageHero.tsx`, `HomeHeroVisual.tsx`, `PokerCards.tsx`, `QuizQuestionCard.tsx`, `blog/BlogHubSections.tsx`, `glossary/{GlossaryCategoryMap,GlossaryIndex,GlossaryRelatedTerms,GlossaryNav,GlossaryPopular}.tsx`, `learn/{LearnRoadmap,LearnTopics,LessonHeader}.tsx`.
- `apps/fishtilt/tests/e2e/responsive-a11y.spec.ts` — +8 WP-S3-17 tests (landmarks/h1/named navs, heading order, skip link, img alt / svg hidden, reduced motion, DataTable at 320/360 incl. no mid-word `<th>` break measured on a text Range, FAQ + related rows have no box surface).
- `apps/fishtilt/.data/tools/`: `shoot.mjs` (slug sanitising), new `a11y-audit.mjs`, `perf.mjs`, `focus-probe.mjs`, `overflow-probe.mjs`, `quiz-probe.mjs`, `crop.py`.
- Docs: `docs/reports/stage3/WP_S3_17_QA_REPORT.md`, this handoff.
- No page files under `src/app/[locale]/**` needed changes; no MDX, registry, SEO lib, tool/quiz logic, `apps/web`, `packages/*` touched.

## Tests run

- `pnpm --filter @gto-self/fishtilt typecheck` → exit 0.
- `pnpm vitest run --project fishtilt --project learn-core` → **234 files, 2609 passed, 0 failed**.
- `pnpm exec eslint apps/fishtilt/src apps/fishtilt/tests apps/fishtilt/.data/tools` → 0 problems in this WP's files (2 pre-existing errors in WP-16's `seo-audit.mjs`; `.data/tools` is outside `pnpm lint`).
- Full `pnpm e2e:fishtilt` via build-lock, three times on fresh builds: run 1 `e2e.log` 336/343 (7 failed: my new table test false positive, starting-hand overflow, 44px, quiz overflow), run 2 `e2e2.log` 339/343, **run 3 `e2e3.log` 343 passed / 0 failed** (final source).
- Updated test (intentional): `DataTable.test.tsx` "scrolls inside its own wrapper" now asserts `table-scroll` on the wrapper and `overflow-x-auto` on `[data-scroller]` — the scroller moved one level down so the caption can sit outside it. No other assertion changed.

## Build/runtime evidence

- `artifacts/3bettilt-stage3-visual-qa/wp17/build3.log`: clean `rm -rf .next && pnpm build`, 0 `ƒ`, all `○/●`.
- Screenshots: `before/` 159 PNG, `after/` 166 PNG (+`shots*.jsonl` facts: every page `h1: 1`, `overflowX: 0` at 1440/390/320), `after5/` 50 PNG (post-44px re-shoot), `crops/` 39 before/after pairs, `evidence/` 15 PNG (focus rings, table fade at 320, quiz options at 320/360/390, lesson chip ring).
- `a11y.jsonl` (36 rows), `a11y2.jsonl` (12 rows after focus fix: `withoutVisibleRingCount` 0), `perf.jsonl` (32 rows: LCP 32–56 ms, CLS 0 except equity 0.059/0.054, JS 459–651 KB, 0 data URIs, largest inline SVG 2 402 B).

## Known limitations

- Perf numbers are loopback lab values (no throttling, no Lighthouse); they prove "no layout shift / text LCP", not field scores.
- Scroll-driven table fade is progressive enhancement (Chromium 115+, Safari 26; Firefox behind a flag).
- `PokerCards` groups may wrap 4+1 below 272 px of available width (only reachable in quiz options on 320 px phones).
- Contrast script reads `color`, not SVG `fill` — SVG `<text>` rows are reported but must be read by eye.

## Open issues

- `src/mdx-components.tsx` table wrapper should become `.table-scroll` + `[data-scroller]` (outside boundary; no shipped MDX table currently needs it).
- `/ko/tools/equity`: reserve the result section's height so the worker's first result does not shift layout (CLS 0.059; tool component logic).
- WP-16 `.data/tools/seo-audit.mjs`: 2 `no-unused-vars` errors (`html`, `ldBlocks` at :364) if `.data/tools` is ever linted.
- Blog hub thumbnails repeat the same suit fallback until real assets land (asset manifest).

## Exact facts next agent may rely on

- Every focusable control with `focus-visible:outline-*` now draws `solid 2px` brand-500 (`rgb(255,51,77)` dark / `rgb(194,24,58)` light); `evidence/focus-*.png`.
- `.table-scroll > [data-scroller]` is the only horizontal scroller a `DataTable` has; the page never scrolls sideways at 320/360/390/430 on any tested surface (e2e + `overflow-probe.mjs`).
- `responsive-a11y.spec.ts` covers 22 surfaces for landmarks/h1/named navs/heading order/skip link/alt/reduced-motion/44px; all 343 e2e green on `build3.log`.
- Per-route client JS (KB): about/learn/hands/tools 459, blog 474, article/story/lesson/term/hand 561, glossary 557, range 557, equity 557, quiz 651, search 566, home 558 — all under `client-bundle.spec.ts` budgets.
- `RELATED_LABELS` still has 7 labels; JSON-LD/metadata untouched (seo.spec 30 tests green in run 3).

## Facts next agent MUST re-check

- If any component adds `outline-none` together with a ring on a _child_ (`group-focus-visible:*`), the parent needs the `group` class or the ring will not draw (the CSS reset keys on `.group:focus-visible`).
- If a new wide table is written in MDX (markdown pipes) rather than `DataTable`, it will scroll but without caption handling/fade until 7a is done.
- Re-run `perf.mjs`/`a11y-audit.mjs` only inside `build-lock.sh` with `next start` on :3221; they wait up to 60 s for the server.
- Glossary hub category chips are now 44 px tall pills (`min-h-11`); if the design review (WP-18) prefers the slimmer look, use the LessonHeader pattern (small pill inside a 44 px anchor) instead of shrinking `min-h`.
