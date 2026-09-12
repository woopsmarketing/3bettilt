# WP-S3-17 — Performance / Accessibility / Visual QA report

Scope: brief `docs/reports/stage3/briefs/WP_S3_17_QA_BRIEF.md`. All numbers below were measured on
this machine against a production `next start` (loopback, no throttling) built from the final source
of this WP. Screenshots and machine-readable evidence live under
`artifacts/3bettilt-stage3-visual-qa/wp17/` (`before/`, `after/`, `after5/`, `crops/`, `evidence/`,
`a11y.jsonl`, `a11y2.jsonl`, `perf.jsonl`, `e2e{,2,3}.log`, `build3.log`).

Final gate (all green on the same build, `build3.log`):

| Gate                                                                               | Result                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @gto-self/fishtilt typecheck`                                       | exit 0                                                                                                 |
| `pnpm vitest run --project fishtilt --project learn-core`                          | 234 files, **2609 passed, 0 failed**                                                                   |
| `pnpm exec eslint apps/fishtilt/src apps/fishtilt/tests apps/fishtilt/.data/tools` | 0 errors in files of this WP (2 pre-existing `no-unused-vars` in WP-16's `seo-audit.mjs`, not touched) |
| `rm -rf .next && pnpm build`                                                       | ok, **0 `ƒ` routes** (41 static rows; 148 static routes incl. SSG params)                              |
| full `pnpm e2e:fishtilt` (build-lock, `e2e3.log`)                                  | **343 passed, 0 failed** (19.9 s test phase)                                                           |

## 1. Visual QA — verdict per page × viewport × theme

Legend: ✓ = looked at, no defect · **F** = defect found and fixed in this WP (see §2) · (n) = remaining
issue number in §7. Screenshots: `after/<slug>-<WxH>-<theme>[-fold].png`; the 320×700 column is the
dark full-page overflow check (`overflowX` 0 = page never scrolls sideways; all 17 pages report 0 and
exactly one `<h1>` in `after/shots*.jsonl`).

| Page                                        | 1440 dark                                       | 1440 light | 390 dark                                     | 390 light  | 320   |
| ------------------------------------------- | ----------------------------------------------- | ---------- | -------------------------------------------- | ---------- | ----- |
| `/ko` (home)                                | **F** hero spade (fix 3), FAQ card wall (fix 1) | **F** same | **F** facts orphan (fix 5), FAQ              | **F** same | ✓     |
| `/ko/blog` (hub)                            | ✓ (7b)                                          | ✓ (7b)     | **F** 44px links/nav (fix 7)                 | ✓          | ✓     |
| `/ko/blog/aks-vs-ako` (guide)               | **F** related-content boxes (fix 2)             | **F**      | ✓                                            | ✓          | ✓     |
| `/ko/blog/qq-vs-72o-flop-227` (story)       | **F** related-content boxes (fix 2)             | **F**      | ✓                                            | ✓          | ✓     |
| `/ko/blog/next-best-after-aa` (5-col table) | ✓                                               | ✓          | **F** DataTable wraps (fix 4)                | **F**      | **F** |
| `/ko/learn` (hub)                           | ✓                                               | ✓          | **F** roadmap links 40px (fix 7)             | ✓          | ✓     |
| `/ko/learn/pot-odds` (lesson)               | **F** related-content boxes (fix 2)             | **F**      | ✓                                            | ✓          | ✓     |
| `/ko/learn/poker-range` (lesson)            | ✓                                               | ✓          | **F** header links 24.5/25.2px (fix 7)       | ✓          | ✓     |
| `/ko/learn/positions-6max` (table)          | ✓                                               | ✓          | **F** caption cut off (fix 4)                | **F**      | **F** |
| `/ko/glossary` (64 terms)                   | ✓                                               | ✓          | **F** chips/tabs/word links < 44px (fix 7)   | ✓          | ✓     |
| `/ko/glossary/three-bet` (term)             | **F** related-content boxes (fix 2)             | **F**      | ✓                                            | ✓          | ✓     |
| `/ko/hands`                                 | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/hands/aks`                             | **F** related-content boxes (fix 2)             | **F**      | ✓                                            | ✓          | ✓     |
| `/ko/tools`                                 | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/tools/range`                           | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/tools/equity`                          | ✓ (7c)                                          | ✓ (7c)     | ✓                                            | ✓          | ✓     |
| `/ko/tools/starting-hand`                   | ✓                                               | ✓          | **F** overflow 391px after fix 4 (fix 4b)    | ✓          | ✓     |
| `/ko/practice/range-quiz`                   | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/practice/hand-ranking-quiz`            | ✓                                               | ✓          | **F** answer options overflow at 360 (fix 8) | ✓          | **F** |
| `/ko/search?q=3벳`                          | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/about`                                 | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |
| `/ko/no-such-page` (404)                    | ✓                                               | ✓          | ✓                                            | ✓          | ✓     |

Cross-cutting, found by the audit scripts rather than by eye and fixed once for every page: keyboard
focus rings never drew (fix 6). Header, footer, breadcrumbs, theme toggle, mobile menu: looked at on
every page above in both themes, no defect.

## 2. Fixes — before / after evidence

Paths are relative to `artifacts/3bettilt-stage3-visual-qa/wp17/`.

| #   | Defect (as seen)                                                                                                                                                                                                                                                      | Fix (files)                                                                                                                                                                                                                                                                                                                                                                                  | Before                                                                                                                                         | After                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home/tools/learn FAQ band: three bordered boxes in a row = card wall (D-S3-17)                                                                                                                                                                                        | `FaqSection.tsx` `open` variant → ruled `<ul divide-y border-y>` list, question as `h3`, answer `max-w-reading`                                                                                                                                                                                                                                                                              | `crops/b-home-faq-1440-dark.png`, `crops/b-home-390-faq.png`                                                                                   | `crops/a-home-faq-1440-dark.png`, `crops/a-home-390-light-faq.png`                                                                                                                                    |
| 2   | Lesson / article / term / hand feet: `RelatedContent` rows were `bg-panel-700` boxes in a 2-col grid = card wall                                                                                                                                                      | `RelatedContent.tsx` `LinkRow` → ruled rows (`border-b`, no surface), whole row is the 44px `<a>`, `→` affordance; labels (`RELATED_LABELS`) untouched                                                                                                                                                                                                                                       | `crops/b-lesson-1440-bottom.png`, `crops/b-aks-1440-light-bottom.png`, `crops/b-term-1440-light.png`, `crops/b-hand-aks-1440-light-bottom.png` | `crops/a-lesson-1440-bottom.png`, `crops/a-aks-1440-light-bottom.png`, `crops/a-term-1440-light-bottom.png`, `crops/a-hand-aks-1440-light-bottom.png`                                                 |
| 3   | Home hero spade: flat single-tone silhouette                                                                                                                                                                                                                          | `HomeHeroVisual.tsx` — fill 8.5 % + 0.6-unit outline at 106 %, CSS `mask-image` vertical fade, `aria-hidden` + `focusable="false"` (carried-over a11y item)                                                                                                                                                                                                                                  | `crops/b-home-hero-1440-dark.png`                                                                                                              | `crops/a-home-hero-1440-dark.png`, `crops/a-home-hero-1440-light.png`                                                                                                                                 |
| 4   | `DataTable` with 5+ columns at 390/320: header words broke mid-syllable ("UT G", "19.15 / %"), caption scrolled away                                                                                                                                                  | `DataTable.tsx` → `.table-scroll` wrapper (`globals.css`): inner `[data-scroller] overflow-x-auto`, `break-keep`, `whitespace-nowrap` on numeric/highlight cells, visible caption outside the scroller (`sr-only` `<caption>` kept), JS-free right-edge fade via CSS scroll-timeline                                                                                                         | `crops/b-nextbest-390-2500.png`, `crops/b-pos-320-a.png`, `crops/b-pos-320-b.png`                                                              | `crops/a-nextbest-390.png`, `crops/a-pos-320.png`, `crops/a-table-fade-320-dark.png`, `evidence/table-scroll-320-{dark,light}.png`                                                                    |
| 4b  | After 4, `/ko/tools/starting-hand` scrolled sideways at 360/390 (table min-content widened a grid parent)                                                                                                                                                             | `.table-scroll { contain: inline-size }`                                                                                                                                                                                                                                                                                                                                                     | (probe: scrollWidth 391 @390)                                                                                                                  | `after/ko_tools_starting-hand-{360x800,390x844}-dark.png`                                                                                                                                             |
| 5   | Home `PageHero` facts at 390: 4th fact orphaned on its own line                                                                                                                                                                                                       | `PageHero.tsx` facts `dl` → `grid-cols-2` below `sm`                                                                                                                                                                                                                                                                                                                                         | `crops/b-home-390-top.png`                                                                                                                     | `crops/a-home-390-top.png`                                                                                                                                                                            |
| 6   | Keyboard focus ring never drew anywhere (39/40 tab stops on every page): Tailwind v4 `outline-none` stores `--tw-outline-style: none`, which `focus-visible:outline-2` then reads back                                                                                | one unlayered rule in `globals.css`: `[class*='focus-visible:outline']:focus-visible, .group:focus-visible [class*='group-focus-visible:outline'] { --tw-outline-style: solid }`                                                                                                                                                                                                             | `a11y.jsonl` (`focus.withoutVisibleRingCount` 39–40 per page)                                                                                  | `a11y2.jsonl` (0 on 12 page×themes), `evidence/focus-*-{dark,light}.png`, `evidence/lesson-chip-focus-390-{dark,light}.png`                                                                           |
| 7   | Touch targets < 44px on phones: glossary word links 18px, letter tabs 36px, category chips 38.5px, popular chips 36px, blog-hub title links 22–30px and type nav 32px, learn roadmap/topic links 40px, lesson header category chip 25px and prerequisite links 24.5px | `inline-block py-3 -my-3` hit boxes (line box unchanged) on `GlossaryCategoryMap/Index/RelatedTerms` LINK, `BlogHubSections` `ArticleTitle`, `LessonHeader` prerequisites, `LearnRoadmap`/`LearnTopics`; `min-h-11` on `GlossaryNav` CHIP/TAB (`min-w-11`), `GlossaryPopular` CHIP, `BlogCategoryNav`; `LessonHeader` category pill wrapped in a 44px anchor with `group-focus-visible` ring | `e2e2.log` (4 failed) , `crops/before-glossary-1440-wordlist.png`                                                                              | `e2e3.log` (343 passed), `crops/after-glossary-1440-wordlist.png` (same rhythm), `crops/after-glossary-390-wordlist.png`, `crops/after-blog-390-rows.png`, `after5/ko_glossary-390x844-dark-fold.png` |
| 8   | `/ko/practice/hand-ranking-quiz` at 360: answer buttons 344px in a 312px column (36px indent + 272px of five md cards) → page scrolled sideways                                                                                                                       | `QuizQuestionCard.tsx` option visual `sm:pl-9` + `min-w-0`; `PokerCards.tsx` card group `flex-wrap` (wraps 4+1 only at 320)                                                                                                                                                                                                                                                                  | `e2e2.log` ("scrollWidth 368")                                                                                                                 | `evidence/quiz-options-{320,360,390}.png`, `crops/after-quiz-320-options.png`                                                                                                                         |

## 3. Accessibility checklist

Audited with `.data/tools/a11y-audit.mjs` (Playwright, no axe) on 18 pages × 2 themes = 36 rows
(`a11y.jsonl`), re-run on 6 pages × 2 themes after the focus fix (`a11y2.jsonl`). Deterministic
versions of every row are now in `tests/e2e/responsive-a11y.spec.ts` (8 new tests; the spec now holds 29 of the 343).

| Check                                            | Result                                                                                                                                                                                        | Evidence / test                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Exactly one `<h1>`                               | 36/36 pages                                                                                                                                                                                   | `a11y.jsonl h1`, shoot facts `h1:1`; e2e "one h1, one main, one header, one footer" |
| Heading order (no skipped level inside `<main>`) | 36/36 `skippedLevels: []`                                                                                                                                                                     | e2e "heading levels inside <main> never skip"                                       |
| Landmarks                                        | `main` 1, `footer` 1, `header` 2 (site header + article `<header>` — valid), 404 page 1                                                                                                       | same test                                                                           |
| Every `<nav>` named                              | 주요 메뉴 / 주요 메뉴 (모바일) / 현재 위치 / 목차 / 다음으로 읽기 / 콘텐츠 타입 / 배우는 방법 / 주제 고르기 / 분류로 찾기 / 첫 글자로 찾기 / 13×13 표에서 고르기 / 많이 찾는 곳 / 바닥글 메뉴 | same test                                                                           |
| Skip link                                        | first Tab = `본문으로 건너뛰기`, visible ≥ 44px, Enter → `#main-content` focused                                                                                                              | e2e "the first Tab stop is the skip link…"                                          |
| Keyboard reachable + visible focus               | 40 Tab stops sampled per page: **0** without a ring after fix 6 (was 39–40) — outline `solid 2px` brand-500 in both themes                                                                    | `a11y2.jsonl`, `evidence/focus-*.png`                                               |
| 44px touch targets (430/390/360)                 | 0 failures on all 22 surfaces after fix 7/8                                                                                                                                                   | e2e "every standalone control is at least 44px tall"                                |
| Form labels / accessible names                   | 0 unnamed controls, 0 duplicate ids                                                                                                                                                           | existing WP-O2 tests (green)                                                        |
| `aria-*` on toggles/menus                        | header menu `aria-expanded`/`aria-controls`, theme toggle labelled, quiz options `aria-pressed`, glossary tabs `aria-disabled` — 177 toggles on home, all with state                          | `a11y.jsonl toggles`                                                                |
| `<img>` alt / decorative SVG                     | 0 `<img>` without alt; 0 top-level `<svg>` that is neither `aria-hidden` nor named (HomeHeroVisual now hidden)                                                                                | e2e "every <img> has alt and every top-level <svg>…"                                |
| `prefers-reduced-motion`                         | 50 transitioned elements sampled per page: 0 slower than 0.01 s                                                                                                                               | e2e "with prefers-reduced-motion every transition collapses…"                       |
| Table semantics                                  | `<caption>` (sr-only) + `scope="col"/"row"`, table scrolls inside `.table-scroll` never the page                                                                                              | e2e "/blog/next-best-after-aa at 320/360px"                                         |
| Language                                         | `<html lang="ko">`; `global-error.tsx` exists with `lang="ko"` and title `문제가 생겼습니다 · 3BetTilt` (carried-over item — already resolved, no change)                                     | read                                                                                |

## 4. Contrast — both themes (alpha-composited, computed from resolved CSS)

Minimum ratio observed per foreground/background pair across all audited pages
(WCAG AA: 4.5:1 normal, 3:1 large ≥ 24px or bold ≥ 18.66px). Full pair lists in `a11y*.jsonl`.

| Role (token)                                     | Dark: fg on bg → ratio              | Light: fg on bg → ratio             | Verdict                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body text `text-100` on `ground-900`             | 245,246,247 on 9,10,13 → **18.29**  | 16,20,26 on 242,244,247 → **16.76** | pass                                                                                                                                                                       |
| `text-100` on `panel-700/600`                    | 15.97 / 15.27                       | 17.36 / 18.47                       | pass                                                                                                                                                                       |
| `text-100` on brand tint (`bg-brand-900`-ish)    | 15.24                               | 15.40                               | pass                                                                                                                                                                       |
| Secondary `text-300` on `ground-900`             | 154,161,172 → **7.60**              | 86,96,112 → **5.77**                | pass                                                                                                                                                                       |
| `text-300` on panels                             | 6.34–7.14                           | 5.30–6.36                           | pass                                                                                                                                                                       |
| Brand link `brand-500` on ground                 | 255,51,77 → **5.50**                | 194,24,58 → **5.47**                | pass                                                                                                                                                                       |
| `brand-500` on panels / brand tint               | 4.80 / 4.58                         | 5.26 / 5.02                         | pass (≥ 4.5)                                                                                                                                                               |
| Primary CTA `ink-on-brand` on `brand-600`        | 255,255,255 on 215,30,54 → **5.09** | on 160,18,48 → **8.00**             | pass                                                                                                                                                                       |
| Matrix cells: ink on action colours (raise/call) | 5.28 / 6.37                         | 5.24 / 5.86                         | pass                                                                                                                                                                       |
| Matrix cell `text-100` on `panel-500`            | 9.50                                | 11.19                               | pass                                                                                                                                                                       |
| Suit red on card face                            | 5.11                                | 5.23                                | pass                                                                                                                                                                       |
| Breadcrumb separator `›` `text-500`              | 107,115,128 → 4.14 (3.89 on panel)  | 118,126,139 → 3.72 (3.58)           | **exempt**: `aria-hidden` punctuation, not text content (WCAG 1.4.3 incidental)                                                                                            |
| `PositionDiagram` SVG `<text>` "UTG"/"D"         | 3.71 / 3.48                         | 3.18 / 3.06                         | **false positive**: the script reads inherited `color`; the glyphs are painted with `fill-text-100` (≥ 15:1). Verified by reading `PositionDiagram.tsx` and the 1440 crops |

No token pair used for readable text falls under 4.5:1 in either theme; no dark-only colour leaks into
light (every pair in the light rows resolves to a light-theme token value).

## 5. Client JavaScript per route (production build, decoded bytes actually loaded)

`perf.jsonl` (`.data/tools/perf.mjs`, sum of `.js` response bodies on a cold load, identical at 1440
and 390). `WP_S3_00_BASELINE.md` records no per-route JS table; the reference points are the
`client-bundle.spec.ts` comments (WP-O3 measurements, in brackets) and its budgets — all green in
`e2e3.log`.

| Route                                                                                         | JS KB (files)          | Budget (spec) | WP-O3 note |
| --------------------------------------------------------------------------------------------- | ---------------------- | ------------- | ---------- |
| `/ko`                                                                                         | 558 (11)               | —             | —          |
| `/ko/about`                                                                                   | 459 (8)                | 560           | [448]      |
| `/ko/learn`, `/ko/hands`, `/ko/tools`                                                         | 459 (8)                | —             | —          |
| `/ko/blog`                                                                                    | 474 (9)                | —             | —          |
| `/ko/blog/aks-vs-ako`, story, `/ko/learn/pot-odds`, `/ko/glossary/three-bet`, `/ko/hands/aks` | 561 (11)               | 660           | [532]      |
| `/ko/glossary`                                                                                | 557 (10)               | —             | —          |
| `/ko/tools/range`                                                                             | 557 (11)               | 670           | [542]      |
| `/ko/tools/equity`                                                                            | 557 (13, incl. worker) | 690           | [552]      |
| `/ko/practice/range-quiz`                                                                     | 651 (11)               | 750           | [607]      |
| `/ko/search`                                                                                  | 566 (10)               | 650           | [521]      |

Growth vs the WP-O3 notes is +11–44 KB per route (Stage 3 content/registry growth, e.g. 64 glossary
terms and 7 related-content labels); nothing crosses a budget and no route regressed because of this WP
(this WP added no client code — CSS only).

Other size facts: largest inline SVG 2 402 B (`/ko/hands/aks` PositionDiagram); 0 `data:` URIs on any
page; `<img>` elements 0 without width/height; largest HTML `/ko/tools/range` 410 KB (prerendered
13×13 matrix — see 7d).

## 6. LCP / CLS — local lab values (not field data)

Chromium `PerformanceObserver` over loopback, cold navigation then full scroll; `perf.jsonl`.

| Route                         | 1440×900 LCP ms (element) | CLS       | 390×844 LCP ms | CLS       |
| ----------------------------- | ------------------------- | --------- | -------------- | --------- |
| `/ko`                         | 52 (h1)                   | 0         | 52 (lead p)    | 0         |
| `/ko/blog`                    | 48 (h1)                   | 0         | 44             | 0         |
| `/ko/blog/aks-vs-ako`         | 48 (h1)                   | 0         | 44             | 0         |
| `/ko/blog/qq-vs-72o-flop-227` | 44 (h1)                   | 0         | 40             | 0         |
| `/ko/learn`                   | 40                        | 0         | 36             | 0         |
| `/ko/learn/pot-odds`          | 40 (prose p)              | 0         | 40             | 0         |
| `/ko/glossary`                | 44                        | 0         | 40             | 0         |
| `/ko/glossary/three-bet`      | 36                        | 0         | 32             | 0         |
| `/ko/hands`                   | 40                        | 0         | 40             | 0         |
| `/ko/hands/aks`               | 48                        | 0         | 44             | 0         |
| `/ko/tools`                   | 36                        | 0         | 32             | 0         |
| `/ko/tools/range`             | 56                        | 0         | 52             | 0         |
| `/ko/tools/equity`            | 48                        | **0.059** | 44             | **0.054** |
| `/ko/practice/range-quiz`     | 36                        | 0         | 36             | 0         |
| `/ko/search`                  | 32                        | 0         | 32             | 0         |
| `/ko/about`                   | 32                        | 0         | 32             | 0         |

FCP equals LCP on every page (text LCP, system font stack, no web font swap). TTFB 2–6 ms. The only
non-zero CLS is the equity calculator: the result panel (`section.rounded-lg.border`) grows when the
worker's first result arrives (< 0.1, "good"; tool logic — see 7c).

## 7. Remaining issues (severity)

| #   | Severity | Issue                                                                                                                                                                                                                                   | Owner / note                                                                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 7a  | low      | `mdx-components.tsx` wraps markdown tables in its own `overflow-x-auto` div, not `.table-scroll` — no fade affordance, caption handling differs from `DataTable`. All shipped wide tables use `DataTable`, so no page is affected today | outside boundary (`src/mdx-components.tsx`); one-line change: `className="table-scroll"` + inner `[data-scroller]`      |
| 7b  | low      | Blog hub 390: consecutive stories share the same generated suit fallback (`EditorialImage`) → visual repetition until real assets exist                                                                                                 | asset-dependent (D-S3 image rule)                                                                                       |
| 7c  | low      | `/ko/tools/equity` CLS 0.059/0.054 and a tall empty result panel at 1440 before the first calculation                                                                                                                                   | tool logic / result-panel min-height — outside "visual only" scope; reserve height in `EquityCalculator` result section |
| 7d  | info     | `/ko/tools/range` HTML 410 KB (prerendered matrix with 169 named cells) — fine over gzip, noted for WP-20                                                                                                                               | —                                                                                                                       |
| 7e  | info     | Scroll-driven fade on `.table-scroll` needs `animation-timeline` (Chromium 115+, Firefox behind flag, Safari 26): unsupported browsers get a scrollable table with no fade — content and scrolling unaffected                           | progressive enhancement                                                                                                 |
| 7f  | info     | `DataTable` caption is now rendered twice (visible `aria-hidden` paragraph + `sr-only` `<caption>`) so screen readers hear it once and sighted users see it outside the scroller                                                        | intentional                                                                                                             |
| 7g  | info     | `.data/tools/seo-audit.mjs` (WP-16) has 2 eslint `no-unused-vars` errors; `.data/tools` is not part of `pnpm lint`                                                                                                                      | WP-16 owner                                                                                                             |
| 7h  | low      | `PokerCards` groups now `flex-wrap`: a 5-card hand wraps 4+1 only when the container is narrower than 272 px (320 px phones inside a quiz option). Everywhere else unchanged                                                            | accepted trade vs page overflow                                                                                         |

## 8. Tooling added (`apps/fishtilt/.data/tools/`, gitignored)

`a11y-audit.mjs` (headings, landmarks, names, contrast, focus rings, skip link, reduced motion →
JSONL), `perf.mjs` (LCP/CLS/FCP/TTFB/JS bytes/SVG/data-URI → JSONL), `focus-probe.mjs` (ring +
table-fade evidence PNGs), `overflow-probe.mjs` (elements past the viewport at any width),
`quiz-probe.mjs` (quiz option widths, lesson chip ring), `crop.py` (native-size crops), `shoot.mjs`
slug sanitising fix. All run only inside `build-lock.sh` against `next start` on :3221.
