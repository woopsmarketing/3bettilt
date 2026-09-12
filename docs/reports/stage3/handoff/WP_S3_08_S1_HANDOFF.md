# WP-S3-08 S1 — hand stories batch S1 (2 stories)

## Objective

Write two published 3BetTilt hand stories (batch S1): `qq-vs-72o-flop-227` and `full-house-loses`,
as typed `HandStoryRecord`s + MDX, with the showdown verified by the evaluator and every number from
`<Fact>`. First build of real story pages (WP-06 asked for a browser check of `<StreetSection>`).

## Facts verified before work

- Story record shape/validator: `src/content/stories/{types,resolve,validate,mdx}.ts`; worked example
  `src/content/stories/testing/fixtureStory.ts`. Heads-up showdown only, blinds 0.5/1, 6-max, integer
  milliBB via `bb()`, `winner` is checked against `strategy-core` evaluator, pots are summed.
- `seoTitleOf(record)` returns `seoTitle` as-is — the "| 3BetTilt" suffix is appended by the page
  metadata, so `seoTitle` must NOT include it.
- Threshold for `indexable: true` (blog): ≥900 prose chars, ≥3 `##` sections, ≥1 component, ≥1 tool,
  ≥1 next step, ≥1 concept. `readMinutes = max(2, ceil(prose/400))`.
- Fact args: `EXACT_EQUITY "<hero>|<villain>|<board 0/3/4/5 cards>"`, `POT_ODDS_REQUIRED_EQUITY
  "<pot BB before the bet>|<bet BB>"`, `CLASS_VS_CLASS_EQUITY` only supports the two frozen QQ/AK pairs.
- Learn slug for the rankings lesson is `poker-hand-rankings` (`/learn/hand-rankings` does not exist).
- One `<Term>` per term per article (`Term.tsx`); MDX links are locale-less (`/tools/equity`).
- The fixture story's villain `7c 2c` is SUITED although titled "72o" — S1 uses `7c 2d` (offsuit).

## Decisions made

- Story 1 hero = BTN 3-bettor, villain = CO opener/caller (fixture has hero as BTN caller vs BB
  3-bettor, S2's QQ story uses a different villain/board). Villain slow-plays flop+turn, leads river.
- Story 2 is full house vs BIGGER full house from the SAME five ranks (9-9-9-T-T vs T-T-T-9-9), hero
  drawing dead on the flop (EXACT_EQUITY 0.00%) — no river-card premise (S2 owns that).
- Each MDX has an extra `## 숫자로 돌아보면` section between the showdown and `## 흥미로운 지점` so the
  story clears `minSections: 3` (StreetSection h2s are not `##` in the source) and holds every `<Fact>`.
- No paragraph starts with `<rank>. ` — Markdown parsed "3. 아무 의미…" as an ordered list (seen in the
  first screenshot); reworded to "턴은 3. …", "리버는 4/6. …".
- Facing-3-bet calling ranges: explicitly written as not covered by the site; no "correct call" claim.

## Files changed

- `apps/fishtilt/src/content/registry/blog/stories/s1.ts` — 2 `HandStoryRecord`s.
- `apps/fishtilt/src/content/registry/blog/stories/s1.test.ts` — NEW: pins showdown categories/winner
  (TWO_PAIR vs FULL_HOUSE; FULL_HOUSE vs FULL_HOUSE), offsuit villain hand, and that every `<Fact>`
  in both MDX files computes (prints the values).
- `apps/fishtilt/src/content/blog/s1.ts` — slug → MDX map (2 entries).
- `apps/fishtilt/content/blog/qq-vs-72o-flop-227.mdx` — NEW.
- `apps/fishtilt/content/blog/full-house-loses.mdx` — NEW.
- `docs/reports/stage3/handoff/WP_S3_08_S1_HANDOFF.md` — this file.

## The stories

### 1. `blog-qq-vs-72o-flop-227` (`/blog/qq-vs-72o-flop-227`)

- title: `72o로 3벳을 콜한다고? 그런데 플랍이 2-2-7이었다`
- seoTitle: `홀덤 핸드 리뷰: QQ vs 72o, 플랍 227에서 벌어진 상황`
- level BASIC · topic hand-strength · readMinutes 6 (measured 2107 chars) · indexable true
- Hand: 100BB eff, hero BTN `Qs Qh`, villain CO. Preflop UTG/HJ fold, CO raise 2.5 (오픈), BTN raise
  8 (3벳), SB/BB fold, CO call → pot 17.5. Flop `2s 2h 7d`: CO check, BTN bet 6, CO call → 29.5.
  Turn `Kc`: CO check, BTN bet 18, CO call → 65.5. River `4s`: CO bet 40, BTN call → 145.5.
- Computed showdown (evaluator): hero TWO_PAIR (퀸과 투 투페어) vs villain `7c 2d` FULL_HOUSE (투
  풀하우스, 세븐 포함) → villain takes 145.5BB.
- Facts (all `<Fact>`, values printed by `s1.test.ts`): HAND_RANK QQ = 3; EXACT_EQUITY QsQh|7c2d =
  87.57%; …|2s2h7d = 8.59%; …|2s2h7dKc = 4.55%; …|2s2h7dKc4s = 0.00%; POT_ODDS_REQUIRED_EQUITY
  65.5|40 = 27.49%; HAND_RANK 72o = 165; HAND_EQUITY_VS_RANDOM 72o = 34.58%; RFI_POSITIONS_WITH 72o
  = "한 자리도 없습니다".
- Links: relatedConcepts term-three-bet/full-house/two-pair/offsuit/equity; relatedTools toolEquity,
  toolHandChecker, toolPotOdds; relatedHands hand-qq; nextLessons hand-rankings, three-bet;
  relatedArticles blog-full-house-loses, blog-why-72o-is-weak, blog-why-called-3bet, blog-qq-vs-ak.
  In-body: `<Term>` ×5, `/tools/hand-checker`, `/tools/equity`, `/learn/three-bet`, `/blog/why-72o-is-weak`.
- Reader learns: an overpair is one pair; equity is recomputed per street; a check is not only weakness.

### 2. `blog-full-house-loses` (`/blog/full-house-loses`)

- title: `풀하우스를 만들었는데 내가 진다고?`
- seoTitle: `홀덤 핸드 리뷰: 99 vs T9o, 플랍 TT9에서 풀하우스가 풀하우스에게 진 이유`
- level BASIC · topic hand-strength · readMinutes 5 (measured 1959 chars) · indexable true
- Hand: 100BB eff, hero BTN `9h 9c`, villain BB. Preflop UTG/HJ/CO fold, BTN raise 2.5, SB fold, BB
  call → 5.5. Flop `Ts Th 9d`: BB check, BTN bet 3, BB raise 10 (체크 레이즈), BTN call → 25.5.
  Turn `3c`: BB bet 15, BTN raise 45, BB call → 115.5. River `6h`: BB all-in 42.5 (총 100), BTN
  call → 200.5.
- Computed showdown: hero FULL_HOUSE (나인 풀하우스, 텐 포함) vs villain `Td 9s` FULL_HOUSE (텐
  풀하우스, 나인 포함) → villain takes 200.5BB.
- Facts: HAND_RANK 99 = 6; EXACT_EQUITY 9h9c|Td9s = 64.89%; …|TsTh9d = 0.00%;
  POT_ODDS_REQUIRED_EQUITY 115.5|42.5 = 21.20%; CATEGORY_FREQUENCY FULL_HOUSE = 3,744;
  CATEGORY_RANK FULL_HOUSE = 3.
- Links: relatedConcepts term-full-house/pocket-pair/hand-ranking/equity; relatedTools
  toolHandChecker, toolEquity, toolPotOdds; relatedHands hand-99, hand-tt; nextLessons
  hand-rankings, equity; relatedArticles blog-qq-vs-72o-flop-227, blog-full-house-vs-flush,
  blog-same-pair-who-wins, blog-what-is-kicker. In-body: `<Term>` ×4, `/tools/hand-checker`,
  `/tools/equity`, `/blog/full-house-vs-flush`, `/learn/poker-hand-rankings`, `/blog/same-pair-who-wins`.
- Reader learns: full houses rank by the trips first; a paired board opens full houses for both
  players; some hands are already at 0% on the flop — review compares felt vs computed strength.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/stories src/content` → 23 files,
  518 tests PASS (includes S2's records now present). Earlier runs: 3 FAIL from S2's missing MDX (not
  mine, since resolved) and 1 FAIL mine (`/learn/hand-rankings` dangling link → fixed).
- `s1.test.ts`: 5 tests PASS. `pnpm --filter @gto-self/fishtilt typecheck` PASS. ESLint on my 3 TS
  files: clean. Prettier run on my 5 files only.

## Build/runtime evidence

- Build 1 (`rm -rf .next && pnpm build`) PASS; `next start` + shoot.mjs: 12 shots, all status 200,
  `overflowX: 0`, h1 count 1. Output: `artifacts/3bettilt-stage3-visual-qa/wp08-s1/`
  (`ko_blog_qq-vs-72o-flop-227-*`, `ko_blog_full-house-loses-*`, `ko_blog-*`, 1440x900 + 390x844,
  dark + light, `-fold` variants).
- Looked at: story 1 1440 dark full + light fold; story 2 390 light full + dark fold; hub 1440 dark;
  native-size crops of flop/turn/river/showdown. Confirmed: disclosure badge + sentence directly under
  the meta line; StatStrip (NLHE 6인 / 100BB / BTN / CO|BB); hero cards; per-street BoardCards
  (flop→turn→river accumulate) and numbered timelines with amounts/notes/pot; showdown card renders
  both hands, Korean category + reading, "상대가 팟 145.5BB/200.5BB를 가져갑니다", evaluator note;
  `<Fact>` values inline (87.57% …); hub shows "핸드 스토리 4편", story 1 as featured and both S1
  stories in the 핸드 스토리 section.
- Defect found in shot 1 and fixed: "3. …"/"4. …"/"6. …" paragraphs rendered as ordered lists.
- Build 2 (re-shoot after fixes) FAILED outside my boundary: `src/components/HomeHeroVisual.tsx:35`
  imports `SUIT_PATH` from `./ContentThumbnail.js`, which does not export it (homepage agent's WIP).
  See "Open issues". The first-build screenshots therefore predate the three wording fixes and the
  `/learn/poker-hand-rankings` link fix; neither changes layout.

## Known limitations

- Story pages are long (9.5k px at 1440); no TOC is rendered by `StoryArticleLayout` (by design).
- `readMinutes` counts MDX prose only, not the record's boards/timelines (WP-06 note) — 6 and 5 min.

## Open issues

- BUILD BLOCKER (not S1): `apps/fishtilt/src/components/HomeHeroVisual.tsx` imports `SUIT_PATH` from
  `ContentThumbnail.tsx`, which has no such export. Owner: homepage WP. Until fixed, `pnpm build`
  fails for everyone. After it is fixed, re-run the shoot for `/ko/blog/qq-vs-72o-flop-227` and
  `/ko/blog/full-house-loses` at 390 to confirm no ordered-list artifacts remain (grep of the MDX
  already shows no `^\s*\d+\. ` lines).
- Fixture story (`fixtureStory.ts`, outside my boundary) says "72o" but deals `7c 2c` (suited).
  Cosmetic in a test-only fixture; worth one-line fix by the stories owner.

## Exact facts next agent may rely on

- Both S1 records validate; ids `blog-qq-vs-72o-flop-227`, `blog-full-house-loses`; slugs same
  without `blog-`. Both PUBLISHED, indexable, `hand.showdown.winner: 'villain'`.
- `s1.test.ts` prints every cited fact value on each run — quote from there, never retype.
- MDX section order used: lead → StreetSection preflop/flop/turn/river/showdown → `## 숫자로 돌아보면`
  → `## 흥미로운 지점` → `## 무엇을 배울 수 있나`. `storyMdxIssues` accepts the extra `##`.

## Facts next agent MUST re-check

- Re-shoot after the homepage build blocker is fixed (see Open issues); verify 390 light story 2
  turn/river paragraphs are plain paragraphs.
- If S2/S3 add a story whose `relatedArticles` should include S1, they must reference the ids above.
