# WP-Q2 — tools & data description fixes

Agent: WP-Q2 (interrupted by a session rate limit) + WP-Q2b (verification, completion, this
report). Boundary: `apps/fishtilt/src/features/**`, `src/app/tools/**`, `src/app/about/page.tsx`,
`src/app/practice/**`, `src/components/Range*.tsx`, `src/components/PotOddsCalculator.tsx`, and
the tests colocated with those.

## Headline

**All 16 findings assigned to Q2 are fixed.** WP-Q2 got through the entire worklist — including
the four MASTER believed were still open (M2, M10, M1 tool half, m9) — before it was killed. It
never wrote this report, which is the only thing that was missing.

WP-Q2b verified every one of the 16 in source, added nothing and changed nothing. The suite is
green and unchanged at the stated baseline.

```
pnpm vitest run --project fishtilt
Test Files  117 passed (117)
Tests      1344 passed (1344)          exit 0
```

Gates NOT run, per instruction (another agent is writing concurrently and `.next` is shared):
`build:fishtilt`, `e2e:fishtilt`, `typecheck`, `lint`, `verify`. **No claim is made about them.**

## 1. Disposition of every finding

| # | Status | File(s) |
| --- | --- | --- |
| **F2** (blocker) — profitability claim + wrong RFI mechanism in 왜 넓이가 다를까요? | **fixed** | `src/components/RangeExplorer.tsx:422-434` |
| **F4** (features half) — equity described as 이기는 비율 / 이길 확률 | **fixed** | `src/features/strength/copy.ts:52`, `src/features/quiz/startingHandQuestions.ts` |
| **F5** — ×2/×4 error direction stated backwards | **fixed** | `src/app/tools/outs/page.tsx:125-149` |
| **F6** — kicker as universal tiebreaker | **fixed** | `src/app/tools/hand-checker/page.tsx:139-160`, `src/features/tools/handRank.ts` |
| **F7** — range provenance on 3 surfaces | **fixed**, unified in one constant | `src/features/range/copy.ts:58`; consumed by `src/app/about/page.tsx:62`, `src/app/tools/range/page.tsx:139`, `src/app/practice/range-quiz/page.tsx:89`, `src/components/RangeExplorer.tsx:94` |
| **F10** — wrong cause for the top-X% overshoot | **fixed** | `src/features/strength/copy.ts:124-126` |
| **F11** — "보드가 당신의 핸드보다 강합니다" | **fixed** | `src/features/tools/handRank.ts:306-317` |
| **F12** — `/tools/starting-hand` CTA dropped `RANGE_LABEL` | **fixed** | `src/app/tools/starting-hand/page.tsx:179,184` |
| **M1** (tool half) — `/tools/range` had no link into the curriculum | **fixed** | `src/app/tools/range/page.tsx:41-80,145`; pot-odds and outs already carried theirs (`pot-odds/page.tsx:42`, `outs/page.tsx:41`) |
| **M2** — unexplained notation wall on `/tools/range` | **fixed by adding the syntax key**, not by turning `showNotation` off | `src/components/RangeSummary.tsx:48-70` (`NotationKey`, rendered *with* the notation so a future opt-in cannot ship the wall without the key) |
| **M5** (labels half) — 플롭 / 수트드 in tool labels | **fixed, with one residual — see §4** | `src/features/tools/copy.ts`, `src/features/strength/copy.ts:88`, `src/app/tools/equity/page.tsx:129` |
| **M7** — dangling 그래서 + unbacked strategy inside the caveat | **fixed** | `src/features/strength/copy.ts:88` (`PLAYABILITY_CAVEAT_SENTENCE`) |
| **M10** — `/tools/pot-odds` ignored `?pot=&bet=` | **fixed** | new `src/features/tools/potOddsUrl.ts`; wired in `src/components/PotOddsCalculator.tsx:232-245` |
| **m1** — `레인지이란` | **fixed via a helper so it cannot regress** | `josaIran()` in `src/features/range/copy.ts:75-87` |
| **m9** — `/practice/range-quiz` had no lesson link, `학습용 기본 레인지` undefined | **fixed** | `src/app/practice/range-quiz/page.tsx:32-66,84-93` |
| **m10** — 것샷 → 거트샷 | **fixed** | `src/features/tools/draws.ts` |

Notes on the four MASTER listed as open:

- **M2** — solved the way `RangeSummary`'s doc demanded. The key travels with the notation
  (`showNotation` renders `<NotationKey/>` under it), so it is a property of the component, not
  of the one page that opts in. It glosses exactly the four tokens `formatHandClassSet` can
  emit — `s`, `o`, `+`, `-` — so it is complete rather than illustrative.
- **M10** — matches `features/range/url.ts` rather than inventing a second pattern: pure string
  parsing in a React-free module, called from a mount-only effect (not a `useState`
  initializer, which would be a hydration mismatch). Parsing goes through `parseAmountBB` →
  `Money.parseBB`, so a malformed, over-precise, or over-large param falls back to the default.
  Each axis is independent — `?pot=abc&bet=6` still seeds the bet. Negative pots and zero bets
  are deliberately *not* rejected here: `potOdds` already refuses them with a typed error the
  calculator renders in Korean, and re-deciding them in the parser would give the app two
  rulebooks.
- **M1 / m9** — both reuse the content-graph block the other tool pages already use, so a
  `PLANNED` lesson renders the inert 준비 중 card instead of a link that would 404. The
  deliberate 준비 중 options inside the quiz itself were left alone, per the disposition.

## 2. Tests

19 test files carry Q2 assertions. New file: `src/features/tools/potOddsUrl.test.ts` (9 cases —
the published URL, `?`-optional, empty query, per-axis independence, money-boundary
normalisation, sub-milliBB rejection, the over-large fallback read from `Money.MAX_MILLI_BB`
rather than restated, the domain-owns-poker-rules case, and a mangled-query no-throw loop).

Fallback paths are covered at both levels, not just the happy path:
`PotOddsCalculator.test.tsx:50-75` mounts the component at `?pot=9&bet=6`, at `?bet=6` (one
axis only), and at `?pot=abc&bet=1e999` (both malformed → both defaults, no throw).

Other assertions added: F2's two-paragraph card (`RangeExplorer.test.tsx:183`), the M2 key
present-with-notation / absent-without (`RangeSummary.test.tsx:53`), F4/D1's absence of
이기는 비율 / 이길 확률 in three places, F6's kicker scope checked **against `compareHands`
itself** for all nine categories rather than restating the table (`handRank.test.ts:271-300`),
F7's provenance properties including "must not name the source" (`copy.test.ts:74-97`), and the
M1/m9 lesson-link blocks.

**No test was deleted, weakened, or skipped.** One assertion was *narrowed* by WP-Q2 and is
flagged here because it lives outside Q2's boundary: `src/components/HandChecker.test.tsx:95-110`
used to transcribe `handRank.ts`'s note verbatim, so F11's correction broke it; it now derives
the expected string from the same `evaluateHandRank` call the component makes. That is a
strictly stronger assertion (it pins that the component renders the engine's note, and cannot go
stale), not a weakened one.

## 3. The exact wording F7 settled on

One constant, `RANGE_PROVENANCE_SENTENCE` (`src/features/range/copy.ts:58`), read by all four
surfaces:

> 이 표는 공개된 무료 포커 교육 자료 한 곳의 6인 테이블·100BB 차트를 그대로 옮긴 학습용 기본
> 레인지입니다. SB만은 그 자료의 목록이 레이즈와 림프를 합친 형태여서, 레이즈 부분만 남도록 이
> 사이트가 다시 계산했습니다. 이렇게 만들어진 목록이 차지하는 비율은 다른 두 자료가 말하는
> 범위와도 맞습니다.

Per D2 the source site is **not named**; `copy.test.ts:92` pins that it stays unnamed
(`not.toMatch(/PokerCoaching|\.com/iu)`). The three-way corroboration survives, stated as being
about the percentages — which is what it is about. `/about`'s "특정 사이트의 데이터를 베낀 것이
아니라 … 계산한 값" is gone and pinned gone.

## 4. The one residual, and it needs another agent's file

`src/features/tools/equity.ts:143` — the equity calculator's illegal-board-length error still
says:

```
보드는 0장(프리플롭), 3장(플롭), 4장(턴), 5장(리버) 중 하나여야 합니다. …
```

This is the last user-visible 플롭 / 프리플롭 in `src/**` outside the deliberate search aliases
in `registry/glossary/j2.ts` (Q1's file, correctly left alone). Site canon is 플랍 / 프리플랍
(131–0 and 94–0 in `content/**`). It contradicts its own page: `/tools/equity`'s explanation
card two sections down already reads `프리플랍(0장), 플랍(3장), 턴(4장), 리버(5장)` — WP-Q2 fixed
the card and missed the runtime string.

**Not fixed here, deliberately.** The string is asserted verbatim in
`src/components/EquityCalculator.test.tsx:148` and `:163`, which sits with `EquityCalculator.tsx`
— WP-Q3b's boundary, and Q3b is demonstrably writing in that directory right now (its M8
DOM-order test has already landed in `HandChecker.test.tsx:116`). Changing the source without
that file goes red; changing that file risks a lost update on a file another writer holds.
Reporting instead, per the brief.

The whole fix, for whoever owns both files at integration:

1. `src/features/tools/equity.ts:143` — `프리플롭`→`프리플랍`, `플롭`→`플랍`.
2. `src/features/tools/equity.test.ts:114` — same two words in the `toContain`.
3. `src/components/EquityCalculator.test.tsx:148,163` — same two words in the two regexes.

Severity: low. It surfaces only when a reader selects a 1-, 2-, 6- or 7-card board.

## 5. Residual risk

- **Unrun gates.** `typecheck`, `lint`, `build:fishtilt` and `e2e:fishtilt` were not run.
  `RangeExplorer`'s F2 card is compare-mode copy and `RangeSummary`'s key is new DOM under the
  notation — if any e2e locator pinned that text or that subtree, it will need updating.
  `tests/e2e/**` is Q3b's boundary and was not inspected.
- **D4, borderline.** `RANGE_PROVENANCE_SENTENCE` contains the literals `6인 테이블` and `100BB`.
  They are true of the shipped data and match what `describeRangeConditions` renders from the
  typed unions, but they are typed digits in prose rather than derived from
  `TABLE_SIZE_LABEL`/`STACK_DEPTH_LABEL`. Left as MASTER accepted it (F7 was spot-checked
  complete); flagged, not changed, to avoid a drive-by refactor of settled copy.
- **Naming the source.** D2 defers "should the chart's source site be named on a public page?"
  to the user. The constant is written so naming it later is a one-line change in one file.
- **Advice sweep.** An independent grep over Q2's whole boundary for profitability and
  imperative-advice patterns (`이득`, `손해를 보지`, `유리합니다`, `…하세요`, `추천`, `권장`)
  returns only refusals (`뜻은 아닙니다`, `범위 밖`, `콜이 이득인지 알 수 없습니다`) and the
  breakeven definition on the pot-odds calculator. No D5 caveat was deleted or softened.
