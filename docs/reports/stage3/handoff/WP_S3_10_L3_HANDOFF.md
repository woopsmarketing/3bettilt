# WP-S3-10 batch L3 — learn content enrichment (flop-turn-river · three-bet · equity · pot-odds · outs)

Resumed work: a previous agent on this brief was cut off mid-task without a handoff. Its on-disk
edits were inspected lesson by lesson against the brief and kept; this handoff covers the combined
result (previous agent's additions + this session's fixes).

## Objective

Turn lessons 11–15 into visual lessons per `3BETTILT_CONTENT_AUDIT.md` §3 / §6.1: `<LessonGoals>`
+ `<LessonSummary>` (WP-S3-09 template), the audit's required deterministic visual per lesson, the
missing concept per lesson, NUMBER-RISK items closed with tests, and registry relationships filled.
Order 11..15 and `nextLessons` unchanged (owner decision).

## Facts verified before work

- Pre-Stage-3 originals live at `.data/stage3-baseline/apps/fishtilt/content/learn/*.mdx` (repo
  root, under `apps/`; the brief's path omitted `apps/`). Diffed all five against current.
- `DataTable` (`src/components/DataTable.tsx`) is `w-full` inside `overflow-x-auto`: at 390px it
  wraps cells rather than scrolling. Only `className` on the wrapper is exposed — no per-cell
  nowrap. So table SHAPE (column count / header length) is the only lever inside my boundary.
- `copy-guards.test.ts` RECOMMENDATION regex bans `콜…해야 한다` unless a refusal marker
  (`아닙니다`, `뜻은`, `않습니다`, …) is in the same sentence; `LessonGoals` strings have no marker.
- `learn-core` constants: `UNSEEN_AFTER_FLOP = 47`, `UNSEEN_AFTER_TURN = 46`; `CARD_COUNT = 52`.
- `lessonsOfCategory('math')` = equity · pot-odds · outs (3 lessons). The baseline `outs.mdx` closed
  with "이 사이트의 다섯 개 수학 레슨" — wrong count, pre-existing.
- Every id used in `h3.ts` exists: glossary (`term-*` list in `registry/glossary`), routes
  (`src/lib/routes.ts`: toolOuts, toolHandChecker, range, toolEquity, toolPotOdds), blog ids,
  hands (`hand-88`, `hand-aks`).
- `outs` is the roadmap end; WP-S3-09's template already renders the CtaBand (quiz / topics)
  for the last lesson, so `nextLessons: []` stays and no fake next lesson is added in-body.

## Decisions made

- **equity goal reworded** (copy guard, not weakened): "에퀴티가 높다는 것과 콜해야 한다는 것이 …"
  → "승률(에퀴티)이 얼마인지와 콜 여부를 어떻게 판단하는지는 서로 다른 질문이라는 것을 구분한다".
  The Callout title "…콜해야 한다는 뜻은 아닙니다" and summary "…답이 아닙니다" already carry markers.
- **outs closing sentence corrected** to "확률과 수학 레슨 세 편" + "이 글이 로드맵의 마지막 레슨"
  (pinned to `lessonsOfCategory('math').length === 3`). readMinutes 5 → 6 as `content.test.ts`
  now computes.
- **Mobile table shapes** (from screenshots at 390px: "9장" broke into "9 / 장", "19.15%" wrapped
  before "%"): outs table 4 → 3 columns (row header "9장 · 플랍→턴", the arrow forms explained in
  the caption); pot-odds table
  5 → 4 columns (dropped the "상황" label column, row header = 콜 전 팟, explicit row keys because
  two rows share "10BB"; caption names which line is which example); flop-turn-river headers
  shortened (열린 카드 / 안 열린 카드 / 못 본 카드). No numbers changed; every value is still a
  `<Fact>` or the deck arithmetic the claims test recomputes.
- Kept the previous agent's choices: BoardCards regroups exactly the five PokerCards shown
  step-by-step; BettingTimeline 1→3→9→27BB labelled "예시 크기" with a FAQ saying sizes are not
  prescribed; two StatsRow in equity (hero/villain shares that sum to 100%; preflop→flop→turn);
  implied odds and dirty outs as concept-only paragraphs with zero digits (tested).
- Added an L3 template-contract test (goals above first `##`, summary immediately before the FAQ
  heading, 2–5 items, no typed `%`/`BB`/`<Fact>` in goals/summary). Deliberately NOT a "no digit"
  rule (L2's version of that is currently failing on "3벳").

## Files changed

- `apps/fishtilt/content/learn/flop-turn-river.mdx` — goals/summary, BoardCards, postflop term,
  47/46-card convention paragraph + DataTable (4 streets), FAQ on why villain cards are not
  subtracted; `<Term id="term-outs">`.
- `apps/fishtilt/content/learn/three-bet.mdx` — goals/summary, BettingTimeline (replaces the
  Callout list), Callout "3-Bet 레인지는 이 사이트에 없습니다 — First In만 지원합니다" with
  `<Term id="term-range">`, FAQ "예시 크기".
- `apps/fishtilt/content/learn/equity.mdx` — goals/summary, `<Term id="term-pot">`, two StatsRow,
  "pot share" paragraph (ties = half, shares sum to 100%).
- `apps/fishtilt/content/learn/pot-odds.mdx` — goals/summary, "지금 걸린 돈만 셉니다" (implied odds,
  concept only), DataTable (10|5, 9|3, 10|10), FAQ on implied odds.
- `apps/fishtilt/content/learn/outs.mdx` — goals/summary, `<Term>` flush/straight, 47/46 link back
  to lesson 11, dirty/clean outs section, DataTable (9 and 4 outs × 3 street targets, exact beside
  shortcut), FAQ on dirty outs, corrected roadmap-end sentence.
- `apps/fishtilt/src/content/registry/learn/h3.ts` — relationships + readMinutes (below).
- `apps/fishtilt/src/content/learn-L3.claims.test.ts` — new (28 tests).
- `apps/fishtilt/src/content/registry/learn/h3.test.ts` — unchanged.

## Per-lesson numbers and their sources

| lesson | visual | number | source |
|---|---|---|---|
| flop-turn-river | DataTable | 50/47/46/45 못 본 카드, 0/3/4/5 열린, 5/2/1/0 남은 | `CARD_COUNT − 2 − opened`; flop/turn cells pinned to `UNSEEN_AFTER_FLOP/TURN` |
| flop-turn-river | BoardCards | 2h 7d 9c / Kc / 3s | same five cards as the PokerCards sequence (parsed + compared) |
| three-bet | BettingTimeline | 1BB → 3BB → 9BB → 27BB | example sizes (audit #21), labelled "예시 크기", order pinned |
| equity | StatsRow ×2 | EXACT_EQUITY 8h8c\|AdKd, AdKd\|8h8c, …\|As2h7c, …\|As2h7c3d | `factValue` → `exactHeadsUpEquity`; sum = 100%, tie = half win, monotone fall pinned |
| pot-odds | PotOddsFigure + DataTable | POT_ODDS_REQUIRED_EQUITY 10\|5, 9\|3, 10\|10; final pots 20/15/30BB | `potOdds().finalPotMbb` and `requiredEquity` ordering pinned |
| outs | OutsFigure + DataTable | OUTS_PROB {9,4} × {FLOP NEXT/RIVER, TURN RIVER} + SHORTCUT_* | `outsOdds()`; 9 = 13 − 4 spades seen (engine `suitOf`), 4 = 1 rank × 4 suits; over/undershoot direction pinned |

## NUMBER-RISK items closed (audit §6.1)

- #16 outs "13장 중 4장 → 9장": suit count computed from the actual cards; OUTS_PROB args all 9.
- #17 outs gutshot "1 × 4 = 4": pinned; all gutshot Facts use 4.
- #19 pot-odds "10+5+5=20, 9+3+3=15": pinned to `potOdds().finalPotMbb`; table rows likewise.
- #21 three-bet "1→3→9→27BB": order + "예시 크기" label pinned.
- §3 "47장 관례" (flop-turn-river): cells pinned to learn-core constants; outs cites the same.
- §3 "pot share" (equity): complement + half-tie relation pinned.
- §3 "3-bet ranges unsupported": "First In" + "지원하지 않습니다" + no `<RangeMatrixMini>` pinned.
- Concept-only guards: implied odds paragraph and dirty outs paragraph contain no digit.

## Relationships (h3.ts, vs baseline)

- flop-turn-river: +`term-outs`; tools `toolOuts, toolHandChecker`; articles +`blog-outs-nine`.
- three-bet: articles +`blog-why-blinds-exist` (8 concepts unchanged; tool `range`).
- equity: +`term-pot`; hands `hand-88, hand-aks`; articles +`blog-why-suited-matters`.
- pot-odds: tools +`toolEquity`; hands `hand-88`; articles +`blog-outs-nine`.
- outs: +`term-flush, term-straight`; tools +`toolPotOdds`; hands `hand-aks`; articles
  +`blog-pot-odds-quick`. `nextLessons: []` (roadmap end, template CtaBand).
- readMinutes (computed by content.test.ts): 6 / 5 / 5 / 6 / 6.

## Tests run

- `pnpm vitest run --project fishtilt src/content src/copy-guards.test.ts`: all files in my
  boundary PASS (`learn-L3.claims.test.ts` 28/28, `registry/learn/h3.test.ts`, `content.test.ts`,
  copy-guards 30/30). See "Build/runtime evidence" for the run-to-run state of others' files.
- Failures outside my boundary at the last run: `learn-L1.claims.test.ts` (AKs/AKo seat count),
  `claims.test.ts` ×2 + `registry/blog/stories/*.test.ts` ×3 + `content.test.ts` load error — all
  ENOENT on `content/blog/full-house-loses.mdx` (hand-stories agent, mid-write).
- `eslint` on `h3.ts` + `learn-L3.claims.test.ts`: 0. Prettier run on every edited file.

## Build/runtime evidence

- Six build-lock cycles. #1 green (pre-restructure shots). #2, #3 failed on the hand-stories
  agent's files (missing `content/blog/{full-house-loses,qq-vs-72o-flop-227,
  qq-three-bet-frustration,river-changes-everything}.mdx`, then `s2.test.ts` `heroEquity` type
  error) — outside my boundary, waited and retried. #5 and #6 green: `rm -rf .next && pnpm build`
  exit 0.
- `artifacts/3bettilt-stage3-visual-qa/wp10-L3/`: 32 PNGs — `ko_learn_{equity,outs,pot-odds,
  flop-turn-river}` × 1440x900/390x844 × dark/light (+ `-fold`). shoot.mjs: h1 = 1 on every
  page (44px / 30px), `<main>` 736 / 390, overflowX 0 on all 16 shots. Page heights: equity
  7030/9717, outs 8067/10770, pot-odds 7762/10621, flop-turn-river 7690/10397.
- Looked at (cropped) the DataTables at 390px: flop-turn-river 4 short columns fit; pot-odds
  4 columns fit ("10BB / 5BB / 20BB / 25.00%" on one line each); outs 3 columns fit after the
  row headers were shortened to arrow form ("9장 · 플랍→턴") — the first 3-column version still
  split "19.15 / %" because `prose-ko` sets `overflow-wrap: anywhere` and the long row header
  starved the numeric columns. StatsRow (equity) and LessonGoals/Summary render correctly in
  both themes at both widths; last-lesson CtaBand present on outs.

## Known limitations

- `DataTable` cannot be told not to wrap; at 390px my tables now fit because they have ≤ 4 short
  columns. A future 5+-column table will wrap again (component-level fix belongs to the owner of
  `src/components/DataTable.tsx`, e.g. `min-w` or `whitespace-nowrap` on numeric cells).
- `relatedHands` for flop-turn-river and three-bet stay empty: no hand page is about streets or
  about 3-bet counting; a fabricated link would be padding.
- IP/OOP terminology is not in these five lessons (audit assigns it to `position`, batch L2).

## Open issues

1. Build currently depends on the hand-stories agent finishing `content/blog/full-house-loses.mdx`
   (referenced by `src/content/blog/s1.ts` / `registry/blog/stories/s1.ts`).
2. `learn-L2.claims.test.ts` "carries a typed digit" was failing on `preflop` ("3벳") at my first
   run and passing later — L2 agent's.
3. `learn-L1.claims.test.ts` AKs/AKo first-in seat assertion (`expected 5 to be greater than 5`) —
   L1 agent's; looks like `>` should be `>=` per its own title ("at least as many").

## Exact facts next agent may rely on

- Goals/summary in all five L3 lessons are `<LessonGoals items=[…]>` right after the lead
  paragraph and `<LessonSummary items=[…]>` immediately before `## 사람들이 자주 헷갈리는 부분`.
- Every number in an L3 visual is a `<Fact>` or deck arithmetic pinned by `learn-L3.claims.test.ts`.
- `outs.mdx` says "확률과 수학 레슨 세 편" and "로드맵의 마지막 레슨" (both pinned).
- pot-odds DataTable row keys: `first`, `second`, `full-pot`; row header column is `pot`.

## Facts next agent MUST re-check

- If `DataTable` gains a nowrap/min-width option, the 3/4-column shapes here could be widened
  back (outs: separate 아웃 / 볼 카드 columns) — re-shoot at 390 before doing so.
- If lesson text in these five files changes, re-run `content.test.ts` and update `readMinutes`.
- If the `math` category changes size, the outs closing sentence and its test must change together.
