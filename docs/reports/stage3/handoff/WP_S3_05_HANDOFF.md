# WP-S3-05 HOMEPAGE REDESIGN — handoff

## Objective

Rebuild `/ko` as an editorial homepage per contract AD: eleven bands that each look
different (no card walls), premium dark charcoal + brand red with an equally polished
light mode, one H1, JSON-LD WebSite + Organization kept, every count and number on the
page derived from records or engines. Also improve the fallback art in
`ContentThumbnail` so `/ko/blog` no longer shows blank boxes.

## Facts verified before work

- `publishedStories()` returned 0 stories when work began; by the final shoot other
  agents had published 6 (`home-stories` band shows a featured story + 5 rows).
- `LEARN_STAGES` has 3 stages (`first`/`last` lesson orders), `LEARN_ROADMAP` 15 lessons,
  all published; `LEARN_HUB_ANCHORS = { roadmap, topics, category(id) }`.
- `toolHubEntries()` yields 6 tools with `question`; hub `FEATURED_TOOL_ID = 'range'`.
- `exactHeadsUpEquity(hero, villain, board)` (learn-core) needs `board = []` for
  preflop; ~300 ms, result `.equity`, `.runouts`. `bestFiveOf` (strategy-core) on
  A♠K♠Q♠J♠10♠ → STRAIGHT_FLUSH; `handReading` → '로열 플러시 (Royal Flush)'.
- `PokerCard` has no `style` prop; `EditorialImage` falls back to
  `ContentThumbnail size="fill"` and its test pins the first `<svg>` viewBox `0 0 240 50`.
- e2e guards: no duplicate element ids (→ no SVG gradient ids), 44 px standalone
  controls, no off-token `max-w-*`, no `bg-brand-500` fills, no literal colours.

## Decisions made

1. Section order and data source (all in `apps/fishtilt/src/app/[locale]/page.tsx`):
   | # | Band (region name) | Data source |
   |---|---|---|
   | 01 | HERO — H1 `HOME_HEADLINE`, CTAs, 4 micro-facts | `PUBLISHED_LESSONS.length`, `routeById`, `startHref()` (first lesson of first stage) |
   | 02 | 어디서 시작할까요? (intent rows) | static intents → start lesson, `learn#topics`, tools, blog |
   | 03 | 레슨 N편, M단계 (roadmap) | `LEARN_STAGES`, `lessonsOfStage`, `categoryOfLessonOrNull`, `readMinutes` sums |
   | 04 | 자리를 바꾸면 표가 달라집니다 | existing `HomeRangePreview`, chip `RANGE_LABEL · RANGE_CONDITIONS` |
   | 05 | 궁금한 숫자를 그 자리에서 | `homeFeaturedTools()` (`toolHubEntries`), `homeEquityExample()` (`exactHeadsUpEquity`) |
   | 06 | 3BetTilt 스토리 | `homeStories(publishedStories())` |
   | 07 | 검색창에 치는 질문, 바로 답합니다 | `blogOfType('search-guide')` |
   | 08 | 읽었으면, 한 번 풀어보세요. | `practiceHubCards()` |
   | 09 | 모르는 말이 나오면 | `HOME_GLOSSARY_PICKS` (12 ids) via `glossaryById`, aliases |
   | 10 | 자주 묻는 질문 | existing `FaqSection` + same 6 site-FAQ items (FAQPage JSON-LD) |
   | 11 | 지금 시작하기 | `CtaBand` |
2. **Stories auto-appear**: `homeStories()` takes `publishedStories()`; featured = first
   published record (own cards via `GuideCards`, board via `BoardCards`, EditorialImage
   16/9 fallback, `HAND_STORY_DISCLOSURE` always printed), the rest are rows with
   `${heroPosition} 대 ${villainPosition}` meta. At 0 stories the band renders
   `[data-stories="coming-soon"]` with a promise sentence and only the real blog link —
   no fake titles. Both states are unit-tested with `FIXTURE_STORY` (0/1/2).
3. **VA-01 photo slot**: `HomeHeroVisual` accepts `photo?: { src }`. Without it the
   frame is a token-only CSS scene (`data-hero-visual="scene"`); with it the same frame
   renders `<EditorialImage src decorative aspect="4/5" priority>` under the overlay
   (`data-hero-visual="photo"`). The five-card overlay band is fixed at
   `inset-x-[8%] top-[64%] bottom-[6%]` — the manifest's reserved band (x 8–92 %,
   y 64–94 %) — so the photo drops in with no layout change: `<HomeHeroVisual photo={{ src: '/…' }} />`.
4. Featured tool is `toolEquity`, not the hub's `range`: the range is already shown live
   one band above (04). The example (A♠K♠ vs Q♥Q♦, 46.2 %) is computed at render time by
   `exactHeadsUpEquity`, never typed.
5. Hero cards are an exact Royal Flush (A♠K♠Q♠J♠10♠) drawn with `PokerCard` in a fanned
   `<span style={{transform}}>` wrapper (no `style` on PokerCard); reading comes from
   `bestFiveOf` + `handReading`, so the `role="img"` label is engine-derived.
6. Quiz band: one heading only ("읽었으면, 한 번 풀어보세요.") — the earlier layout had a
   second competing statement; merged after screenshot review.
7. `ContentThumbnail` keeps its API and every pinned assertion (card `0 0 160 50`, hero
   `translate(40 0)`, ≤ 40 nodes, no `<text>`, `currentColor`); it now composes a token
   gradient frame, a warm radial glow, a dot lattice and a large suit motif behind the
   line art. Suit paths are exported as `SUIT_PATH` for the hero scene.

## Files changed

- `apps/fishtilt/src/app/[locale]/page.tsx`, `page.test.tsx` (rewritten)
- `apps/fishtilt/src/components/HomeHeroVisual.tsx`, `.test.tsx` (rewritten)
- `apps/fishtilt/src/components/ContentThumbnail.tsx`, `.test.tsx` (rewritten / +1 test)
- `apps/fishtilt/src/components/home/` (new): `homeModel.ts`, `HomeSectionHeader.tsx`,
  `HomeIntents.tsx`, `HomeRoadmap.tsx`, `HomeFeaturedTools.tsx`, `HomeStories.tsx`,
  `HomeSearchGuides.tsx`, `HomeQuiz.tsx`, `HomeGlossaryStrip.tsx` + 6 `*.test.tsx`
- `apps/fishtilt/tests/e2e/home.spec.ts` (rewritten)
- No changes outside the boundary.

## Tests run

- `tsc -p apps/fishtilt/tsconfig.json --noEmit` → 0 errors.
- `pnpm vitest run --project fishtilt src/app/\[locale\]/page src/components/Home
  src/components/home src/components/ContentThumbnail src/components/EditorialImage`
  → 11 files, 49 tests PASS. Earlier wider run incl. theme-tokens, copy-guards,
  lib/seo → 25 files / 338 tests PASS.
- eslint on every changed file → 0; prettier applied to changed files only.
- Build-lock (foreground): `rm -rf .next && pnpm build` exit 0, `ƒ` marks 0;
  `playwright test tests/e2e/home.spec.ts tests/e2e/client-bundle.spec.ts` → 43 passed.

## Build/runtime evidence

`artifacts/3bettilt-stage3-visual-qa/wp05/`: `build.log`, `e2e.log`, `shots.jsonl`
(all status 200, h1 = 1, overflowX = 0 at 1440/390/320), `ko-1440x900-{dark,light}[-fold].png`,
`ko-390x844-{dark,light}[-fold].png`, `ko-320x700-dark.png`, `ko_blog-1440x900-dark.png`.
Reviewed critically: hero fold shows eyebrow/H1/lead/CTAs/facts on phone with the visual
below; bands alternate rows / 3-column roadmap / matrix / featured+rows / story split /
2-column index / statement+rows / term strip; light mode matches.

## Known limitations

- Band 10 (FAQ) still renders as 6 bordered `panel-700` cards — that is the shared
  `FaqSection` (outside boundary). Owner may want a flatter open-answer variant.
- The hero visual is CSS/SVG only until VA-01 delivers the photo (slot ready, see D3).
- `homeEquityExample()` costs ~300 ms once per server process (module-memoized).

## Open issues

- Header/footer (WP-15) are untouched; home has no dependency on them beyond the
  shell width (1248 px). Nothing in `src/lib/seo/**` needed changing.
- Region/heading names changed; any external test or doc quoting the old home copy
  (H1, "무료 도구 보기" secondary CTA, section titles) must use the new ones.

## Exact facts next agent may rely on

- Section ids: `home-intents, home-roadmap, home-preview, home-tools, home-stories,
  home-guides, home-quiz, home-glossary`; 11 `region`s inside `main`.
- `HOME_HEADLINE` lives in `src/components/home/homeModel.ts` (not exported from the page).
- Data attributes: `[data-hero-visual]`, `[data-stage]`, `[data-order]`, `[data-tool]`,
  `[data-featured-tool]`, `[data-featured-story]`, `[data-story]`,
  `[data-stories="coming-soon"]`, `[data-quiz]`.
- No `"/ko/…"` literals; every href resolves through `routeById`/`hrefOfContent`.

## Facts next agent MUST re-check

- Story/blog/lesson counts on the page change as other agents publish — tests derive
  them from the registry, so re-run the page test rather than trusting numbers here.
- If `FEATURED_TOOL_ID` semantics change in the hub, `HOME_FEATURED_TOOL_ID` is a
  separate, documented choice in `homeModel.ts`.
- Re-shoot after VA-01 lands: verify the overlay band still sits on the photo's felt.
