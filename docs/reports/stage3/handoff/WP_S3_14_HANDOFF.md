# WP-S3-14 — TOOLS: tool + complete guide, tools hub, tool UX

## Objective
Turn the six tool pages (`/tools/range`, `/tools/starting-hand`, `/tools/equity`, `/tools/pot-odds`,
`/tools/outs`, `/tools/hand-checker`) into TOOL + COMPLETE GUIDE (tool first, reading-column guide under
it, FAQ, D-S3-16 link groups, next tool), rebuild `/tools` as featured + grouped rows (no card wall), and
fix presentation-only tool UX defects. Engines untouched.

## Facts verified before work
- Engines/data read at render, never typed: `strategy-core` (`RFI_RANGES`, `HAND_CLASSES`, `comboCountOf`,
  `percentageOf`, `differenceHandClassSets`, `parseHandClasses`, `bestFiveOf`, `compareHands`),
  `learn-core` (`exactHeadsUpEquity`, `potOdds`, `outsOdds`+`ruleOfTwoAndFour`, `HAND_STRENGTH[_BY_RANK]`,
  `categoryFrequencyOf`, `FIVE_CARD_HAND_COUNT`, `handClassFacts`), range facade `resolveRange`.
- `handClassesOf(set)` returns matrix INDICES (not `HandClass` objects); `RFI_RANGES.X` is `HandClassSet | null`.
- `RangeCompareMatrix` needs an `onSelectKey` callback → cannot be server-rendered; `RangeMatrix` is a
  client island with 169 buttons (e2e selects cells by name) → a second interactive grid on the page was
  ruled out; the guide draws a static `role="img"` figure instead.
- Existing test contracts kept: tool-before-FAQ ordering, every FAQ question an h3 with exact answer,
  exactly one `/about` link per tool page, ≥2 distinct `/learn/` hrefs incl. `toolLessonIds`, hub
  listitems == entries, hub link per tool at registry path, `WebApplication` name == `<title>` base
  (`src/lib/seo/toolPageJsonLd.test.tsx`), `CollectionPage` rows in rendered order, theme-tokens width
  and `bg-brand-500` rules, copy-guards (`src/copy-guards.test.ts`).

## Decisions made
- Page shape (all six): `ToolPageShell` (breadcrumbs → `WebApplication` JSON-LD → short `PageHero` → tool,
  in `shell`/`matrix` width) → `*Guide` bands (`ToolGuideSection`: `Section` breakout band, prose at
  `max-w-reading`, tables/figures in a `wide` slot, `aria-label`=heading, `scroll-mt-24`) → `ToolPageFooter`
  (FAQ at reading width, `ToolGuideLinks` grouped rows, `ToolCTA` next tool).
- Guide numbers print at TWO decimals (`guidePercent`, Fact convention) so the calculator's one-decimal
  result stays the only "result" on the page and `equity.spec.ts`'s `^\d{1,3}\.\d%$` count (exactly 3) holds.
- `<title>` now carries the keyword-map phrase; `<h1>` stays the tool name; `WebApplication.name` =
  `<title>` base (pinned by `toolPageJsonLd.test.tsx`, outside my boundary, so complied):
  range `13×13 핸드레인지 표 — 포지션별 오픈 레인지 (6-max · 100BB)`, equity `포커 승률 계산기 (에퀴티) — 핸드 vs 핸드`,
  pot-odds `팟 오즈 계산기 — 콜에 필요한 승률 바로 계산`, outs `아웃츠 계산기 — 드로우 완성 확률과 ×2 · ×4 규칙`,
  hand-checker `포커 족보 확인기 (핸드 체커) — 내 패 족보 판정`, starting-hand `시작 핸드 순위표 — 169개 패를 승률순으로 (시작 핸드 탐색기)`.
- Hub: featured = `range` (`FEATURED_TOOL_ID`) with a static BTN chart (`ToolRangeFigure`), then groups
  `계산기` (equity, pot-odds, outs) and `표와 판정` (starting-hand, hand-checker) as rows "label / description /
  question" (`TOOL_QUESTION`, no digits). Lessons section is rows, not cards. `ItemList` order = render order.
- `ToolLessonLinks` is now unused by any page (file kept, its own test still passes).
- Provenance: `RANGE_PROVENANCE_SENTENCE` (facade) printed once in the guide; nothing says GTO/source.

## Files changed
NEW `src/components/tools/`: ToolPageShell, ToolGuideSection (+`GUIDE_PROSE_CLASS`, `GUIDE_TOC_CLASS`),
ToolPageFooter, ToolGuideLinks(+test), ToolRangeFigure(+test), GuideCards, RangeGuide(+test), EquityGuide,
PotOddsGuide, OutsGuide, HandCheckerGuide, StartingHandGuide, guides.test.tsx.
NEW `src/features/tools/guide/`: format, matrixKinds, rangeGuide, equityGuide, potOddsGuide, outsGuide,
handCheckerGuide, startingHandGuide (+ 6 tests); `src/features/tools/guideLinks.ts`(+test).
EDITED: `src/features/tools/{index,hub,hub.test,faq,faq.test}.ts`; `src/app/[locale]/tools/page.tsx` and
the six `tools/*/page.tsx` (+ their `page.test.tsx`); `src/components/StartingHandPanel.tsx` (root is now
`<section aria-label="선택한 패">`); `tests/e2e/starting-hand.spec.ts` (result probes scoped to that region).

## Tests run
- `pnpm exec tsc -p apps/fishtilt/tsconfig.json --noEmit`: 0 errors. eslint on all files above: clean.
- `pnpm vitest run --project fishtilt --project learn-core`: 194 files / 2113 tests; 2106 pass. The 7–8
  failures are ALL in `src/content/**` + `src/copy-guards (content/**)` (learn MDX batches h1/h2/h3,
  `poker-range` readMinutes/Term) — WP-S3-09's in-flight files, not mine. Every test in my boundary passes
  (start of WP: 171 files / 1943).
- e2e via build-lock (build ok, no `ƒ`): `equity, pot-odds, outs, hand-checker, starting-hand,
  range-explorer, tools-hub, client-bundle, seo, responsive-a11y` → 109 passed / 4 failed; the 4 are
  `/ko/learn` only (touch-target 21px links, CollectionPage order) — WP-S3-09. client-bundle: `/tools/range`
  542KB (<670), `/tools/equity` 552KB (<690).

## Build/runtime evidence
Screenshots `artifacts/3bettilt-stage3-visual-qa/wp14/` (`/ko/tools`, `/ko/tools/range`, `/ko/tools/equity`,
`/ko/tools/pot-odds` × 1440x900/390x844 × dark/light, `-fold` variants; range+equity 320x700). shoot.mjs:
h1=1 everywhere, overflowX=0 at every shot, tool inside the first viewport at 1440 and 390 (390 fold shows the
result panel). Viewed and fixed: table cells no longer wrap to one glyph per line on phones
(`[&_td]:whitespace-nowrap` → sideways scroll inside `DataTable`), BB reason moved under the seat table,
TOC links and the walkthrough link are 44px targets.

## Per tool
- range: sections 핸드레인지는 무엇을 그린 표인가 · 13×13 표 읽는 법 (pair/suited/offsuit table from `HAND_CLASSES`) ·
  자리가 중요한 이유 (`PositionDiagram` + seat table from `resolveRange`) · UTG와 BTN 비교 (`compareRanges`, static
  overlay figure) · 패 하나로 따라가기 (A9o: `handClassFacts`, membership per seat, deep link
  `?hero=BTN&spot=RFI&stack=100`) · 이 표가 다루는 조건 · 지원하지 않는 조건 (`unsupportedConditions()` from the
  facade's own refusals). FAQ 7. Links: 3 learn, 6 glossary, 2 blog, range quiz.
- equity: Equity란 · 이김/비김/승률 (AsKs vs AhKh) · 결과 읽는 법 · 대결 예시 4 (table) · 보드 변화 (AsKs vs QhQd,
  4 streets) · 하지 않는 것. All `exactHeadsUpEquity`. FAQ 7. Links: learn 3, glossary 4, blog 2, quiz none.
- pot-odds: 정의 · 공식 · 예시 30/10 (`PotOddsFigure`, `potOdds`) · 베팅 크기별 표 · 팟 오즈 vs 아웃 9 · 헷갈리는 것 ·
  하지 않는 것. FAQ 6. Links: learn 3, glossary 4, blog 1, quiz none.
- outs: 아웃이란 · 47/46 (`OutsFigure`) · 플러시 드로우 walkthrough · ×2/×4 표 (8 counts, `ruleOfTwoAndFour`
  signed errors) · 겹치는 드로우 (preset derivation) · 하지 않는 것. FAQ 6. Links: learn 3, glossary 6, blog 1.
- hand-checker: 일곱 장 중 다섯 장 (QhJd + QsJc9h2c5d) · 9 족보 빈도 (`categoryFrequencyOf`) · 보드가 최고
  (2c3d + 5h6h7h8h9h) · 키커/비김 3 showdowns (`compareHands`: kicker 1, straight-tie 0, same-two-pair 0) ·
  하지 않는 것. FAQ 7. Links: learn 3, glossary 5, blog 5, hand-ranking quiz.
- starting-hand: 순위란 · 순위를 매기는 숫자 · 최강/최약 5 (`HAND_STRENGTH_BY_RANK`) · AKs vs AKo gap · 칸당 조합 ·
  말하지 않는 것. FAQ 7. Links: learn 3, glossary 5, blog 5, starting-hand quiz.

## Known limitations
- No links to hand stories yet (WP-S3-16): `TOOL_GUIDE_LINK_IDS` has no `hands` group; add one under label
  `비슷한 핸드` when `hands/*` records publish. Equity/pot-odds/outs have no quiz (none exists) → group omitted.
- Guide figures are static; the UTG-vs-BTN picture cannot be clicked (by design, see ToolRangeFigure doc).
- Titles > 60 chars for starting-hand/outs; keyword-map wording kept, trim if the SEO owner prefers.

## Open issues (outside my boundary)
- `/ko/learn` (WP-S3-09): responsive-a11y 44px failures, seo CollectionPage order, `content.test.ts`
  readMinutes/Term for `poker-range`, learn batch h1–h3 tests — all pre-existing/in-flight, not from this WP.
- `TableOfContents` (shared) renders 32px links; every guide wraps it with `GUIDE_TOC_CLASS`. Consider moving
  the 44px rule into the primitive so learn pages get it too.
- `PokerCards` names every group `카드`; guides use `GuideCards` instead. Consider a `label` prop on `PokerCards`.

## Exact facts next agent may rely on
Computed by the engines and pinned by tests: UTG 226 combos / 17.04% / 38 classes; HJ 280; CO 368; BTN 568 /
42.84% / 90; SB 622; BB no first-in list. UTG ⊂ BTN (only-BTN 342 combos / 52 classes). A9o: 12 combos, in
CO/BTN/SB. AsAh vs KsKh equity 82.64%; AsKs vs AhKh win 7.16 / tie 85.69 / equity 50.00; 30/10 pot odds
20.00% = 5.0번 중 1번 = 4.0 대 1; 9 outs flop 19.15%/35.02% (×4 = 36.00, +0.98%p). 40 FAQ questions total.

## Facts next agent MUST re-check
- Whether `/ko/learn` failures are fixed before treating the seo/responsive-a11y suites as green.
- E2e text probes on tool pages are collision-sensitive: guide copy deliberately avoids the exact strings
  `4.0번 중 1번`, `3.0 : 1`, `풀하우스`, `×4 규칙`, `리버 한 장`, `리버까지 두 장`, `플러시 드로우 + 양차`, `에이스와 킹 투페어`,
  `로열 플러시 (Royal Flush)`, `에만 있는 조합`, `에이스 킹 수티드` — re-run the tool specs after any copy edit.
