# WP-S3-07 — batch i3 (blog migration) handoff

## Objective

Migrate the i3 blog batch (`btn-why-wide`, `same-pair-who-wins`, `what-is-kicker`, `playing-the-board`,
`a2345-wheel`) to search-intent guides per `3BETTILT_CONTENT_AUDIT.md` §2 B11–B15, applying the B12 → B13
MERGE, and repoint every inbound reference to the removed slug.

## Facts verified before work

- Audit B12: MERGE `same-pair-who-wins` → `what-is-kicker`. Keyword map rows 84/85 both "SG (merge 후보)",
  C13 CHANGED; cannibalization map §1.10 + line 165 "의도 중복 → 병합 후보". Both old MDX had `Fact` 0 and a
  single thesis ("키커로 승부 결정") with different example cards. → Merge holds.
- D-S3-03: site never deployed → no redirect, no canonical.
- Inbound references to the removed id/slug (grep before): `guideLinks.ts:81`, `learn/h1.ts:80`,
  `stories/s1.ts:119`, `glossary/j2.ts:546`, `content/blog/full-house-loses.mdx:66`, plus i3 registry/map/test.
- Baseline first-in ranges (`resolveRange` RFI · 6-max · 100BB): UTG 226 (17.0%), HJ 280 (21.1%), CO 368
  (27.8%), BTN 568 (42.8%), **SB 622 (46.9%)** — SB is WIDER than BTN. The audit/keyword-map FAQ "SB는 왜
  BTN보다 좁나요?" is false for this dataset; written as "SB는 BTN보다 좁나요? → 아니요" instead.
- UTG ⊆ HJ ⊆ CO ⊆ BTN holds class-for-class (pinned). 65s → BTN · SB. A5s → all five. 72o → none.
- Evaluator (`bestFiveOf`/`compareHands`) results for every printed showdown — see i3.test.ts; two of my
  first-draft claims were WRONG and were caught by the exhaustive tests before publish: on K-K-K-7-7 board,
  pocket 7s make quads and any pocket pair 88+ makes a higher full house (prose corrected).
- `extractFaqItems` drops any FAQ answer containing a component → FAQ answers are plain prose, no `<Fact>`.
- `prettier` on `.mdx` breaks inline components (orchestrator note) — no MDX was formatted by prettier.

## Decisions made

| Article | Decision | Old H1 → New H1 | seoTitle |
|---|---|---|---|
| btn-why-wide | LIGHT EXPAND | "BTN에서는 왜 더 많은 패를 사용할까?" → "버튼(BTN)에서 왜 더 많은 패로 참여할까? 자리별 레인지 비교" | "버튼(BTN) 오픈 레인지가 넓은 이유 — 자리별 첫 레이즈 조합 비교" |
| same-pair-who-wins | MERGED into what-is-kicker; MDX + record + map entry deleted | — | — |
| what-is-kicker | DEEP EXPAND (absorbs B12) | "kicker란?" → "키커(Kicker)란? 같은 원페어·투페어에서 승부를 가르는 법" | "키커란? 같은 원페어면 누가 이길까 — 승부를 가르는 옆 카드, 실제 패로 보기" |
| playing-the-board | LIGHT EXPAND | "보드만으로 족보가 완성되면?" → "보드 플레이(Playing the Board): 공용 카드만으로 족보가 되면 누가 이기나" | "보드만으로 족보가 완성되면? 스플릿 팟이 되는 경우와 아닌 경우" |
| a2345-wheel | LIGHT EXPAND | "A2345는 스트레이트인가?" → "A2345(휠)는 스트레이트인가? 에이스가 낮게 쓰이는 경우와 아닌 경우" | "A2345는 스트레이트인가? 휠 스트레이트의 순위와 스틸 휠" |

All four stay `contentType: 'search-guide'`; `readMinutes` measured (7 / 8 / 7 / 6).

### Per article

**btn-why-wide** (intent: 버튼 레인지 넓은 이유) — QuickAnswer(RFI_COMBOS/PERCENT UTG·BTN) · 눈으로 먼저 보면
(RangeMatrixMini) · 여섯 자리의 행동 순서 (PositionDiagram highlight BTN) · 자리별 학습용 기본 레인지 비교 (DataTable
5 rows, all cells `<Fact RFI_*>`; COMBO_COUNT; RFI_POSITIONS_WITH 65s/A5s; StatsRow) · 마지막에 행동한다는 것이
뜻하는 것 · "버튼이면 아무 패나"는 아닙니다 (RFI_POSITIONS_WITH 72o, Callout disclaimer kept) · FAQ 3. Numbers:
every one a `<Fact>`; narrative claims (monotonic UTG→BTN, SB>BTN, BTN<50%, subset chain, 65s/A5s/72o
membership) pinned in i3.test.ts. In-body links: blog/why-use-range, learn/position, learn/positions-6max,
blog/why-72o-is-weak. Relations: +hand-a5s, +positions-6max, +why-use-range, +why-72o-is-weak. Strategy
discipline: ruling-28 guard (no 이득/정답/맞는 방식 outside denial) still passes; 절대 no profitability claim.

**what-is-kicker** (intent: 키커란 / 같은 원페어 누가 이기나) — QuickAnswer · 키커란 무엇인가요 (DataTable of
made-cards vs kicker-cards per category, rule arithmetic, pinned via evaluator `ranks.length`) · 같은 원페어면 누가
이기나요 (absorbed B12 example K-K-7-4-2 AQ vs AJ verbatim + ComparisonTable; A-T-6-3-2 AK vs AQ) · 투페어와
트리플에서도 키커가 있나요 (K-K-9-9-4 A2 vs Q3; 7-7-7-2-3 AK vs AQ) · 키커가 끼어들 자리가 없는 경우 (K-Q-J-T-9
split; flush explanation) · 키커까지 같으면 스플릿 팟 (A-K-9-5-2 AQ vs AQ split; A-K-Q-J-4 A3 vs A2 split —
counterfeited kicker) · 왜 이렇게 비교하나요 · KeyPoint · FAQ 4. All 8 showdowns evaluator-pinned. Links:
blog/playing-the-board, learn/poker-hand-rankings, blog/full-house-loses. Terms: kicker, one-pair, two-pair,
three-of-a-kind, flush, board, split-pot. Relations: +full-house-loses, +full-house-vs-flush.

**playing-the-board** (intent: 보드로 족보 완성 / 스플릿) — QuickAnswer · 실제로 스플릿이 되는 보드 (5-9 straight,
23 vs AK split) · 같은 보드인데 스플릿이 아닌 경우 (T extends; JT = nuts, exhaustive 1081-holding check) · 보드가
원페어일 때 (9-9-7-4-2: A9 trips vs KQ; exhaustive: NO holding ties the board) · 보드가 플러시나 풀하우스일 때
(A-K-9-5-2♥: Q♥ > T♥ > board; K-K-K-7-7: AQ/23/7x split, only quads or 88+ pocket pair beat it — exhaustive)
· 왜 이런 차이가 생기나요 · KeyPoint · FAQ 3 (odd-chip rule explicitly NOT decided — CLAUDE.md rule 7). Terms:
board, split-pot, community-cards, kicker, nuts (orphan resolved), flush, full-house. Old prose error fixed:
KQ on 9-9-7-4-2 does not "use the board pair only" — it plays K·Q kickers (pinned `ranks` [7,11,10,5]).

**a2345-wheel** (intent: A2345 스트레이트 / 휠) — QuickAnswer · 카드로 보면 (+A5 on 2-3-4-K-9 board) · 반대로
인정되지 않는 경우 (QKA23, KA234 both HIGH_CARD) · 휠은 얼마나 강한가요 (DataTable of the 10 straights, pinned
strictly ordered; StatsRow verdicts pinned) · 스틸 휠 (STRAIGHT_FLUSH; < 23456sf; > A-high flush) · 무늬는 상관없나요
(wheel vs wheel split) · Callout · KeyPoint · FAQ 3. Links: hands/a5s (keyword-map gap closed), learn/
poker-hand-rankings. Relations: +hand-a5s, +blog-flush-vs-straight, +blog-playing-the-board.

NUMBER-RISK §6.1: no rows name i3 files. Audit "Fact 0" on B12/B13/B14/B15 closed: kicker/board/wheel articles
now carry no typed computed number (only card ranks and rule counts, each pinned); btn carries 13 `<Fact>`s.

## Files changed

- `apps/fishtilt/content/blog/{btn-why-wide,what-is-kicker,playing-the-board,a2345-wheel}.mdx` (rewritten)
- `apps/fishtilt/content/blog/same-pair-who-wins.mdx` (DELETED)
- `apps/fishtilt/src/content/registry/blog/i3.ts` (4 records, seoTitle, relations, readMinutes)
- `apps/fishtilt/src/content/registry/blog/i3.test.ts` (rewritten: 51 tests; shape checks + exhaustive
  evaluator pins; COMBO_COUNT added to the btn fact allow-list — a deck constant, not a strength claim)
- `apps/fishtilt/src/content/blog/i3.ts` (map: 4 entries)
- Repoints (authorized): `src/features/tools/guideLinks.ts`, `src/content/registry/learn/h1.ts`,
  `src/content/registry/blog/stories/s1.ts` (+prettier reflow of the now-shorter array),
  `src/content/registry/glossary/j2.ts`, `content/blog/full-house-loses.mdx` (link text + href →
  `/blog/what-is-kicker`).
- `docs/reports/stage3/handoff/WP_S3_07_I3_HANDOFF.md` (this file)

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/i3.test.ts` — 51/51 PASS.
- `pnpm vitest run --project fishtilt src/content` (final run) — 28 files / 647 tests PASS (an earlier run showed
  i2 FAQ-question failures that i2 has since fixed).
- `pnpm vitest run --project fishtilt` (full app) — 2215 pass / 8 fail; NONE name i3 ids. Failures are other
  batches' in-flight work: copy-guards (`hands/batchGate.ts` «수익성», `small-pocket-pairs.mdx` «유리합니»),
  content.test.ts FAQ-question form (i2 slugs), blogHubModel fixture, `/hands` index ×2, `hands/[hand]/faq.test`,
  `blog/[slug]/page.test` TOC (expects outs-nine "왜 하필 9장인가요?" — i4).
- `pnpm --filter @gto-self/fishtilt typecheck` — 0 errors. ESLint on my TS files — clean. Prettier — TS files
  only (never MDX).
- `grep -rn same-pair-who-wins apps/fishtilt/src apps/fishtilt/content apps/fishtilt/tests` → only doc comments
  and the merge-guard constant in i3.ts / blog/i3.ts / i3.test.ts. No stray reference elsewhere.

## Build/runtime evidence

- `build-lock.sh 'rm -rf .next && pnpm build && next start … shoot.mjs'` — build OK (142 static pages).
- Screenshots: `artifacts/3bettilt-stage3-visual-qa/wp07-i3/` — what-is-kicker + btn-why-wide × 1440x900 ×
  390x844 × dark/light × full+fold (16 PNG) + a second pass (btn-why-wide, playing-the-board, a2345-wheel ×
  390 dark) after shortening the BTN DataTable headers, which at 390 had wrapped "UTG"→"UT G" and "17.0%"→
  "17.0 %". All `h1:1`, `overflowX:0`. Inspected: QuickAnswer first, TOC present, DataTable/ComparisonTable
  readable at 390 (numeric right-aligned, highlight column, no cell wrapping after the fix), BoardCards with
  플랍/턴/리버 labels, PositionDiagram highlights BTN, StatsRow, the 10-straights table, in-body links
  red/underlined, both themes OK.

## Known limitations

- FAQ answers cannot carry `<Fact>` (extractor drops them) so the SB/BTN FAQ says "위 표" instead of numbers.
- `btn-why-wide` DataTable is 4 columns; at 390 it relies on the breakout/overflow container (no page overflow).

## Open issues

- `tests/e2e/blog.spec.ts` "sets the search title" targets aks-vs-ako (i1) — not affected by i3; no change
  requested from me. If e2e ever asserts i3 titles, the new H1/seoTitle above are the values.
- Audit/keyword-map FAQ "SB는 왜 BTN보다 좁나요?" contradicts the shipped baseline (SB 622 > BTN 568). Written
  honestly; orchestrator may want to correct the audit row.
- Other batches' failing tests listed above are outside my boundary.

## Exact facts next agent may rely on

- Blog registry now has 19 legacy + 4 story records; `blog-same-pair-who-wins` does not exist anywhere.
- i3 ids: `blog-btn-why-wide`, `blog-what-is-kicker`, `blog-playing-the-board`, `blog-a2345-wheel`; all
  `search-guide`, all with `seoTitle`, readMinutes 7/8/7/6.
- i3.test.ts pins: RFI subset chain, SB>BTN, 10 straights ordering, all printed showdowns, exhaustive nuts/board
  checks on three boards.

## Facts next agent MUST re-check

- If the baseline range dataset changes, `btn-why-wide` prose ("한 번도 줄지 않고", SB FAQ, 65s/A5s/72o) is pinned
  by tests and will fail loudly — rewrite prose, don't weaken tests.
- `readMinutes` if any i3 MDX is edited (content.test.ts + i3.test.ts assert the measured value).
