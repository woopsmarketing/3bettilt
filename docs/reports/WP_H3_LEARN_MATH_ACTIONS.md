# WP-H3 — Learn lessons 11–15 (streets, 3-Bet, the maths)

## 1. Scope

Wrote and published the final five Learn lessons: `flop-turn-river`, `three-bet`, `equity`,
`pot-odds`, `outs`. All five flipped `PLANNED` → `PUBLISHED` in the batch's own registry
file, with a real `readMinutes` and `indexable: true`. No file outside the assigned boundary
was touched.

One correction to the content plan's own briefing, recorded rather than silently applied:
the plan (§7 "H3") tells this batch that `toolEquity` is `available: false` and to fall back
to `toolOuts` in lesson 13's CTA. `src/lib/routes.ts` now shows `toolEquity`,
`toolStartingHand` and `toolHandChecker` all `available: true` (`docs/FISHTILT_STATE.md`
ruling 26 — WP-E2 shipped the last unbuilt tool before this batch started). Lesson 13 links
`toolEquity` directly; no fallback was written. `h3.test.ts` asserts this against the live
route registry so it cannot silently drift back to a fallback that no longer applies.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/learn/flop-turn-river.mdx` | NEW |
| `apps/fishtilt/content/learn/three-bet.mdx` | NEW |
| `apps/fishtilt/content/learn/equity.mdx` | NEW |
| `apps/fishtilt/content/learn/pot-odds.mdx` | NEW |
| `apps/fishtilt/content/learn/outs.mdx` | NEW |
| `apps/fishtilt/src/content/registry/learn/h3.ts` | 5 records flipped `PLANNED`→`PUBLISHED`, `indexable: true`, `readMinutes: 4`. No other field changed — ids, slugs, relations and topics were already correct from WP-G4. |
| `apps/fishtilt/src/content/learn/h3.ts` | MDX map: imports + exports for the five components |
| `apps/fishtilt/src/content/registry/learn/h3.test.ts` | NEW — this batch's own test file (22 tests) |
| `docs/reports/WP_H3_LEARN_MATH_ACTIONS.md` | this report |

Nothing in `src/app/**`, `src/components/**`, `src/features/**`, `facts.ts`, `allowList.ts`,
`content.test.ts`, `graph.ts`, `types.ts` or `routes.ts` was touched. No file belonging to
another batch (H1, H2, blog, glossary) was edited.

## 3. Lesson table

| Slug | Promise | Interactive element | Facts cited | Outbound links |
| --- | --- | --- | --- | --- |
| `flop-turn-river` | How the 5 board cards split 3‑1‑1 and what each street is called | `PokerCards` × 3 (board growing 3→4→5), `ToolCTA(toolOuts)`, `MiniQuiz` | none (structural deck facts only, see §7) | prereq `preflop`; next `three-bet`; article `blog-playing-the-board`; terms `term-preflop, term-flop, term-turn, term-river, term-board, term-community-cards`; tool `toolOuts` |
| `three-bet` | Why the second raise is called a 3-Bet and how the count works | `Callout` (counting steps), `ToolCTA(range)`, `MiniQuiz` | none (counting convention is definitional, ruling 18 — not a computed stat) | prereq `preflop`; next `equity`; article `blog-why-called-3bet`; terms `term-open-raise, term-range, term-three-bet, term-four-bet, term-big-blind`; tool `range` |
| `equity` | What "my win rate right now" means and how it's counted | `PokerCards` × 2, `Fact(EXACT_EQUITY)` × 3, `ToolCTA(toolEquity)`, `MiniQuiz` | `EXACT_EQUITY` (preflop, flop, turn — same two hands) | prereq `flop-turn-river`; next `pot-odds`; article `blog-qq-vs-ak`; terms `term-equity, term-split-pot, term-showdown`; tool `toolEquity` |
| `pot-odds` | The minimum win rate a call needs to break even | `Fact(POT_ODDS_REQUIRED_EQUITY)` × 3 (2 scenarios + 1 cross-reference), `Callout`, `ToolCTA(toolPotOdds)`, `MiniQuiz` | `POT_ODDS_REQUIRED_EQUITY`, `EXACT_EQUITY` (cross-reference to lesson 13's own example) | prereq `equity`; next `outs`; article `blog-pot-odds-quick`; terms `term-pot-odds, term-pot, term-equity`; tool `toolPotOdds` |
| `outs` | Counting outs and turning that count into a real probability | `PokerCards` × 2 (flush-draw board), `Fact(OUTS_PROB)` × 10, `Callout`, `ToolCTA(toolOuts)`, `MiniQuiz` | `OUTS_PROB` (exact + `SHORTCUT_*`, flop and turn, 9-out and 4-out draws) | prereq `pot-odds`; next — (last lesson, no `nextLessons`); article `blog-outs-nine`; terms `term-outs, term-draw, term-pot-odds`; tool `toolOuts` |

## 4. Worked examples — arithmetic checks

Every value below was captured by calling the real domain functions (`exactHeadsUpEquity`,
`potOdds`, `outsOdds`) and separately through `apps/fishtilt/src/content/facts.ts`'s own
`factValue(...)` (the exact function `<Fact>` calls at render time), via a throwaway `npx tsx`
script — never reasoned by hand, never typed into the MDX from memory. Script deleted after
each run (never committed; `git status` confirms only the five listed files plus the two
registry/map edits changed).

**Equity (lesson 13)** — `8h8c` vs `AdKd`, same two hands, three streets:

| Board | `factValue('EXACT_EQUITY', ...)` | Cross-check (`exactHeadsUpEquity` directly) |
| --- | --- | --- |
| preflop (none) | `52.29%` | runouts 1,712,304 · wins 892,317 · ties 6,030 · losses 813,957 → `892317/1712304 + 6030/1712304/2 = 0.522863... → 52.29%` ✓ |
| flop `As2h7c` | `8.79%` | runouts 990 · wins 87 · ties 0 → `87/990 = 0.0879 → 8.79%` ✓ |
| turn `As2h7c3d` | `4.55%` | matched via `factValue`; used only as a third recalculation point, not independently hand-verified beyond the Fact call since the lesson only asserts the printed Fact value, never an intermediate count |

**Pot odds (lesson 14)** — `POT_ODDS_REQUIRED_EQUITY`:

| Scenario | pot / bet (BB) | `finalPot` (plain arithmetic the reader can redo) | `factValue(...)` | Hand check |
| --- | --- | --- | --- | --- |
| Half-pot bet | 10 / 5 | 10 + 5 + 5 = 20 | `25.00%` | `potOdds` returns `finalPotMbb=20000`, `requiredEquity = 5000/20000 = 0.25` → `25.00%` ✓ |
| Third-pot bet | 9 / 3 | 9 + 3 + 3 = 15 | `20.00%` | `finalPotMbb=15000`, `requiredEquity = 3000/15000 = 0.20` → `20.00%` ✓ |

The lesson's "실제로 어떻게 쓰나요" subsection then cross-references lesson 13's own
`EXACT_EQUITY('8h8c|AdKd')` (`52.29%`) against the 10/5 scenario's `25.00%` and states,
correctly, that 52.29% > 25.00% so that call is not a loss arithmetically — no new number was
typed, both come from Facts already cited.

**Outs (lesson 15)** — `OUTS_PROB`, flush draw (9 outs, spades: hero `As Ks`, board `2s 7s
9c` — 4 of 13 spades seen, 9 left):

| Street → target | `factValue('OUTS_PROB', ...)` | Hand check (`outsOdds` directly) |
| --- | --- | --- |
| `9\|FLOP\|RIVER` (exact, 2 cards to come) | `34.97%` | `unseen=47`, `missCount=38`; `byRiverProb = 1 - (38×37)/(47×46) = 1 - 1406/2162 = 0.349676...` → `34.97%` ✓ |
| `9\|FLOP\|SHORTCUT_RIVER` (×4 rule) | `36.00%` | `9 × 4 × 0.01 = 0.36` → `36.00%` ✓ |
| `9\|FLOP\|NEXT` (exact, 1 card) | `19.15%` | `9/47 = 0.191489...` → `19.15%` ✓ |
| `9\|FLOP\|SHORTCUT_NEXT` (×2 rule) | `18.00%` | `9 × 2 × 0.01 = 0.18` → `18.00%` ✓ |
| `9\|TURN\|RIVER` (only 1 card left, so = NEXT) | `19.57%` | `9/46 = 0.195652...` → `19.57%` ✓ |
| `9\|TURN\|SHORTCUT_NEXT` | `18.00%` | `9 × 2 × 0.01 = 0.18` → `18.00%` (identical field to `SHORTCUT_RIVER` on the turn — same one-card event, `outs.ts`'s own documented reason for not rendering it twice) |

Second example, gutshot straight draw (4 outs — 1 completing rank × 4 suits):

| Street → target | `factValue(...)` | Hand check |
| --- | --- | --- |
| `4\|FLOP\|RIVER` | `16.47%` | `1 - (43×42)/(47×46) = 1 - 1806/2162 = 0.164662...` → `16.47%` ✓ |
| `4\|FLOP\|SHORTCUT_RIVER` | `16.00%` | `4 × 4 × 0.01 = 0.16` → `16.00%` ✓ |

Card notation sanity (`parseCards`) was independently confirmed for every card string used in
`<PokerCards cards="...">` before it was placed in prose (`As Ks`, `2s 7s 9c`, `Th 9h`, `2h 7d
9c`, `Kc`, `3s`, `Ad Kd`, `8h 8c`, `As 2h 7c`, `As2h7c3d` all parsed without error; no
duplicate-card collisions across hero/villain/board in any `EXACT_EQUITY` call).

## 5. Lesson 15's shortcut-vs-exact wording

Quoted directly from `outs.mdx`:

> "플랍에서 리버까지, 두 장을 다 보고 이 무늬가 완성될 확률은 `34.97%`입니다. 흔히 쓰는 '아웃
> × 4' 규칙으로 어림잡으면 `36.00%`가 나옵니다."

> "규칙은 어림값이지, 정확한 계산이 아닙니다 — … 이 예에서는 규칙 쪽이 실제보다 살짝 높게
> 나옵니다. 규칙은 암산하기 편하지만, 정확한 계산과 항상 같지는 않습니다."

And, on the second (4-out) example, where the direction flips:

> "이번에는 규칙 쪽이 실제보다 살짝 낮게 나옵니다. 아웃 개수마다 규칙이 높게 나올 수도, 낮게
> 나올 수도 있다는 뜻입니다."

The lesson never states the shortcut result as if it were the true probability — every
`SHORTCUT_*` Fact appears in the same sentence or the immediately adjacent one as its exact
counterpart, and the closing misconception section restates that the rule is an
approximation and points the reader at the calculator for an exact number.

## 6. Strategy claims avoided

| What the lesson could have said (and did not) | What it says instead |
| --- | --- |
| "3-Bet에는 이 패로, 이 정도 빈도로 반응하세요" | `three-bet.mdx`: "이 3-Bet에 어떤 패로, 얼마나 자주 다시 레이즈하거나 콜해야 하는지는 검증된 데이터가 없어 이 사이트에 아직 준비되어 있지 않습니다." No `RangeMatrixMini` in this lesson at all. |
| "에퀴티가 52%면 이 콜은 이득입니다 / 이 패는 수익성이 있습니다" | `equity.mdx`: equity is stated only as "지금 이대로 끝까지 갔을 때 기대되는 몫"; a dedicated `Callout` says "에퀴티가 높다고 콜해야 한다는 뜻은 아닙니다," and a misconception Q explicitly denies "에퀴티가 높으면 좋은 패"라는 뜻인지. |
| "필요 승률보다 높으니 콜하세요" | `pot-odds.mdx` states only the arithmetic relationship ("내 승률이 이 숫자보다 높으면 이 콜은 산술적으로 손해가 아니고, 낮으면 손해입니다") and a `Callout` explicitly disclaims: "실제로 내 패가 그 승률만큼 이길 수 있는지는 이 숫자와는 별개의 문제이고, 이 사이트가 대신 판단해주지 않습니다." |
| "아웃이 많으면 콜하세요 / 드로우를 쫓으세요" | `outs.mdx`: "아웃이 많을수록 그 카드가 나올 확률은 높아집니다. 다만 그것만으로 콜해야 하는지는 알 수 없고, 내가 내야 하는 돈과 비교해야 합니다" — hands off to lesson 14, no verdict given. |
| A competing 3-Bet counting convention presented as equally valid | Not mentioned at all — only ruling 18's convention is stated, matching the glossary's own `term-three-bet.shortDefinition` verbatim in substance. |

The batch's own test file (`h3.test.ts`) mechanically pins three of these: no `RangeMatrixMini`
in `three-bet.mdx`, no unnegated "콜해야/콜하세요/콜하십시오" in `equity.mdx`, and the shared
GTO/무조건-반드시 checks from H1/H2 reused verbatim.

## 7. Facts wanted and could not get

None. All eleven fact names needed (`EXACT_EQUITY`, `POT_ODDS_REQUIRED_EQUITY`, `OUTS_PROB`
with its `SHORTCUT_NEXT`/`SHORTCUT_RIVER` targets) already existed from WP-G3b. Nothing was
reasoned around a missing Fact.

One design choice worth recording rather than a gap: lesson 14 cannot show the intermediate
`finalPotMbb`/`oneInN`/`oddsAgainst` fields through a `<Fact>` (only the required-equity
percentage is exposed by `POT_ODDS_REQUIRED_EQUITY`, and `facts.ts` is outside this batch's
file boundary). The lesson therefore states the pot/bet **inputs** as plain scenario numbers
(matching the precedent already set by `preflop.mdx`'s "1BB"/"3BB" and `poker-range.mdx`'s
"두 장") and states only the **derived** required-equity percentage through the Fact — the
same input/output split the actual `PotOddsCalculator` UI observes, just expressed in prose
instead of a live component.

## 8. Tests run, with real counts

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/learn/h3.test.ts` | **22 / 22 passed** |
| `pnpm vitest run --project fishtilt` (whole app) | **829 / 830 passed, 1 failed** — `src/app/tools/equity/page.test.tsx > /tools/equity page shell > links to the equity lesson honestly — inert, since it is not written yet`. **Not this batch's file** (`src/app/**` is out of boundary). This is ruling 26's pattern recurring: that test (authored by WP-F2B, before any Learn content existed) hard-coded the assumption that the `equity` lesson has no MDX yet and asserted a "준비 중" badge with no link. Publishing `equity` — this batch's *mandated* work — makes that assumption false, exactly as ruling 34 describes for `graph.test.ts` after J1 published `term-position`. Confirmed via `git status` that this batch touched no file under `src/app/`; the failure is a direct, foreseeable consequence of flipping `equity` to `PUBLISHED`, not a bug in this batch's own work. |
| `pnpm typecheck` (all 13 workspace packages) | **PASS**, 0 errors |
| `npx eslint apps/fishtilt --max-warnings=0` | **PASS**, no output |

Baseline before this batch (per `docs/FISHTILT_STATE.md`'s last recorded run) was well above
800 tests with concurrent batches landing; this run's 830 total is consistent with that and
with only one new fixture (this batch's own 22 tests) added on top.

## 9. Known limitations

- The `<ToolCTA tool="toolPotOdds" params={{ pot: '10', bet: '5' }}>` in `pot-odds.mdx` is
  written with `params`, matching the plan's request, but `PotOddsCalculator.tsx` does not
  read URL search params — the CTA opens the calculator with its own hard-coded defaults
  (10 BB / 5 BB, which happen to already match). This is the pre-existing, previously
  recorded gap (`docs/FISHTILT_STATE.md`, "Orchestrator rulings on handed-back items" #2) —
  reported again here per the batch brief, not fixed (`src/components/**` is out of
  boundary).
- `pot-odds.mdx`'s cross-reference to lesson 13's `8h8c` vs `AdKd` example depends on that
  lesson staying published with the same example hands; if a future edit to `equity.mdx`
  changes the worked example, the cross-reference sentence in `pot-odds.mdx` would need a
  matching update (noted so a future editor of either file knows the coupling exists).
- `three-bet.mdx` intentionally carries no computed `<Fact>` at all — every number in it is a
  small, definitional scenario value (1BB/3BB/9BB/27BB) or a counting-position ordinal, never
  a probability or combinatorial figure, so there is nothing in `facts.ts` it could or should
  cite.
- The one test failure in §8 is left for the orchestrator to fix (per this repo's established
  pattern: the running ruling-26 fix agent, or a dedicated pass after all concurrent WPs
  land), not patched by this batch.
