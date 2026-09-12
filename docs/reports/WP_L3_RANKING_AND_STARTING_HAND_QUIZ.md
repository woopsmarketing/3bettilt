# WP-L3 — 족보 퀴즈 + 시작 핸드 퀴즈

## 1. Scope

Built both quiz routes on top of WP-L1's engine (`features/quiz/{types,rng,engine,index}.ts`,
`components/Quiz*.tsx`) and WP-E2's shipped `strategy-core`/`learn-core` data. Two new
question-bank modules, two new pages (+ their tests), two e2e specs (written, **not run**).
Did not touch `routes.ts`, `features/quiz/hub.ts`, `src/content/**`, the shared engine, or any
existing test/spec — all confirmed by `git status` before finishing.

## 2. Files changed

| File | Quiz | What |
| --- | --- | --- |
| `src/features/quiz/handRankingQuestions.ts` (+ test) | 족보 | Question bank: 13 hand-authored fixtures, evaluator-verified at generation time |
| `src/app/practice/hand-ranking-quiz/page.tsx` (+ test) | 족보 | The route — `Quiz` + tie-callout + lesson cross-link |
| `src/features/quiz/startingHandQuestions.ts` (+ test) | 시작 핸드 | Question bank: 11 curated class-key pairs, resolved against `HAND_STRENGTH` |
| `src/app/practice/starting-hand-quiz/page.tsx` (+ test) | 시작 핸드 | The route — `Quiz` + "not advice" disclaimer + lesson/tool cross-links |
| `tests/e2e/hand-ranking-quiz.spec.ts` | 족보 | Written, **not run** |
| `tests/e2e/starting-hand-quiz.spec.ts` | 시작 핸드 | Written, **not run** |
| `docs/reports/WP_L3_RANKING_AND_STARTING_HAND_QUIZ.md` | — | This report |

## 3. Question generation → answer provenance

### 족보 퀴즈 (`handRankingQuestions.ts`)

13 fixtures, each a literal pair of card-notation strings covering a named beginner trap
(flush-vs-straight, two-pair-vs-trips, straight-vs-trips, pair/two-pair kicker, the wheel vs
6-high, full-house trips-rank precedence, straight-flush-vs-quads, quads-vs-full-house, a
5-card kicker chain, flush-vs-flush, and two constructed ties). `buildQuestion` parses each
side with `@gto-self/shared`'s `parseCards`, calls `strategy-core`'s `evaluateHand` on both,
and calls `compareHands` on the two `.strength` values — **that comparison, not any authored
label, decides the answer id**. The explanation is assembled from the same two `HandValue`
objects: `HAND_CATEGORY_LABEL`/`handReading` (reused from `features/tools/handRank.ts`, not
re-invented) name each hand's category, and `firstDifferingSlotIndex` + a per-category
`SLOT_LABEL` table name whichever rank slot actually decided it (pair rank, kicker, trips
rank, …) — read out of `HandValue.ranks`' own significance order, never asserted.

`handRankingQuestions.test.ts` independently re-parses each question's own displayed card
notation and re-runs `compareHands`/`evaluateHand`, asserting the result matches
`acceptableAnswerIds(question)` — the generator is never trusted on its own say-so.

### 시작 핸드 퀴즈 (`startingHandQuestions.ts`)

11 curated `(keyA, keyB)` class-key pairs (e.g. `AA` vs `72o`, `AKs` vs `AKo`, `A2o` vs
`76s`). `buildQuestion` calls `@gto-self/learn-core`'s `handStrengthForKey` on each key — an
unknown key returns `null`, dropped by `compactQuestions` (the `UNSUPPORTED`-safe seam, per
the WP-L1 generator contract) rather than becoming a fabricated question. The winner is
`entryA.equity > entryB.equity ? 'A' : 'B'`, read directly off the two resolved
`HandStrengthEntry`s. The explanation states both `equityLabel` values and names the metric
(`STRENGTH_METRIC_LABEL`, reused from `features/strength/copy.ts`).
`startingHandQuestions.test.ts` re-resolves each question's own displayed class keys through
`handStrengthForKey` and re-derives the winner independently.

## 4. Tie decisions

| Quiz | Decision | Proof |
| --- | --- | --- |
| 족보 | **Offer 무승부 as a genuine third answer**, scored via `correctness: { kind: 'MIXED', correctAnswerIds: ['TIE'] }` on every question. Two fixtures are constructed to actually chop: `tie-straight-different-suits` (two different broadway straights, same top rank) and `board-plays-tie` (7-card hands sharing an identical 5-card board that already makes the nuts — the "board plays" trap). | `handRankingQuestions.test.ts`'s "tie handling" describe block asserts both fixtures are `isMixedQuestion === true` with `acceptableAnswerIds === ['TIE']`, and its "known-answer" block calls `evaluateHand`/`compareHands` directly on both fixtures' cards and asserts `compareHands(...) === 0`. `hand-ranking-quiz.spec.ts`'s "a tie (\"무승부\") is a real, scoreable answer" test clicks 무승부 through the real browser flow and asserts at least one is marked correct. |
| 시작 핸드 | The shipped `HAND_STRENGTH` dataset's `exactTies` is empty today (an exact enumeration with no two of the 169 classes bit-identical — confirmed in WP-L1's own report §9), so **no live pairing in this WP is actually tied**. The generator still calls `handStrengthTied` on every pairing and emits `MIXED` if it ever returns true — per ruling 29, the branch must exist, not be exercised by data that doesn't currently contain it. | `startingHandQuestions.test.ts` constructs a `HandStrengthEntry`-shaped fixture with two DIFFERENT real classes (`AKs`, `AKo`) but forced-equal `equity` (ruling 26 — a local fixture, never mined from live data), passes it through the same `questionFromEntries` assembly path production questions use (via the exported `buildStartingHandQuestionFromEntries`), and asserts `isMixedQuestion === true`, `acceptableAnswerIds === ['TIE']`. A second test asserts every live (real-key) question in the shipped bank is `SINGLE`, with a comment stating this is a fact about the dataset today, not an assumption. |

## 5. Quiz 2's strength metric — one definition, reused

Quoted from `packages/learn-core/src/strength/model.ts`:

> "For a starting-hand class `H`: hero holds one combo of `H`, both players are all-in before
> the flop, the opponent holds a hand drawn UNIFORMLY from every legal two-card holding that
> does not use one of hero's cards, and the board runs out. `equity` is hero's expected share
> of that pot, ties split." — `HAND_STRENGTH_RANK_BASIS = 'HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND'`

`startingHandQuestions.ts` reads every number from `handStrengthForKey`/`HandStrengthEntry`
(the exact same accessor `/tools/starting-hand`'s `StartingHandExplorer` uses) and reuses
`STRENGTH_METRIC_LABEL`/`equityLabel` from `features/strength/copy.ts` rather than writing a
second label or a second formatter — the same term and the same number format a reader who
has visited the Explorer already recognises. No second "strength" is computed, sampled or
approximated anywhere in this WP.

## 6. Seeding

Both banks use a fixed, committed integer seed (`HAND_RANKING_QUIZ_SEED = 20260905`,
`STARTING_HAND_QUIZ_SEED = 20260906`), never `Date.now()`/`Math.random()`. `createQuizSession`
(WP-L1) shuffles deterministically via `mulberry32`; the same `(questions, seed)` reproduces
byte-identical order forever, checked by a reproducibility test in each new test file and
exercised live in both e2e specs (the same 10-question order every `page.goto`).

## 7. Explanation copy — claims made and advice refused

Both banks' explanations state: each hand's category (족보) or metric value, and the specific
reason (kicker / higher pair / higher category / equal value) — always read off the
evaluator/dataset output. Neither ever says a hand should be played, raised, folded, or is
"worth" anything; `/practice/starting-hand-quiz`'s own page adds an explicit disclaimer
section (`이 퀴즈는 "잘 플레이하는 법"을 알려주지 않습니다`) stating that what to do with the
number is a separate question this site has no data for. Both test suites assert the
explanation text contains no should/must/advice verb (해야 합니다, 하세요, 추천, 권장,
레이즈하/폴드하/베팅하/콜하, 가치가 있/플레이하기 좋).

## 8. `routes.ts` entries the orchestrator must add

```ts
{ id: 'practiceHandRanking', path: '/practice/hand-ranking-quiz', label: '족보 퀴즈', section: 'practice', available: true },
{ id: 'practiceStartingHand', path: '/practice/starting-hand-quiz', label: '시작 핸드 퀴즈', section: 'practice', available: true },
```

Both pages exist on disk at those exact paths right now, so flipping these two entries is the
only wiring needed — `features/quiz/hub.ts`'s `PRACTICE_QUIZ_ENTRIES` already names both ids
(confirmed still present after WP-L2's concurrent edits) and resolves them by `find`, so
`/practice`'s hub cards turn live automatically with **no edit to this WP's files or to
`hub.ts`**.

## 9. Tests run

| Suite | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` (whole project) | **1094 passed, 0 failed**, 98 files — clean at the time of this report. (One transient failure in `src/lib/routes.test.ts`, over the `/search` route's `available` flag, was observed mid-task while WP-K's search route was landing concurrently; not a file this WP touched, and it resolved itself once that WP flipped its own flag — confirmed gone on the final run.) |
| — of which, files this WP owns | `handRankingQuestions.test.ts` 21, `startingHandQuestions.test.ts` 15, `hand-ranking-quiz/page.test.tsx` 9, `starting-hand-quiz/page.test.tsx` 12 → **57 passed, 0 failed** |
| `pnpm typecheck` (13 workspace projects) | 0 errors |
| `npx eslint apps/fishtilt --max-warnings=0` | 0 errors, 0 warnings |
| `tests/e2e/hand-ranking-quiz.spec.ts`, `tests/e2e/starting-hand-quiz.spec.ts` | Written only, **not run** (orchestrator's gate) |

Known-answer tests actually run against the real evaluator/dataset (not asserted, verified
while authoring): flush > straight, kicker decides identical pairs, wheel < 6-high straight,
two pair < trips, straight > trips, full house decided by trips rank, straight flush > quads,
quads > full house, a 5-card kicker chain, two broadway straights chop, "the board plays"
chop (족보); `AA > 72o`, `AKs > AKo`, and `A2o > 76s` — the exact illustrative case
`learn-core`'s own strength-model module doc names (시작 핸드). No disagreement between
intuition and the evaluator/dataset was hit; nothing needed reporting as a poker-correctness
finding.

## 10. Known limitations

- 시작 핸드 퀴즈 has no LIVE tied pairing today (dataset's `exactTies` is empty) — the `MIXED`
  path is proven with a locally constructed fixture, not exercised by the shipped bank or by
  `starting-hand-quiz.spec.ts`'s browser flow. If a future dataset regeneration ever produces
  a real tie, `KEY_PAIRS` could be extended to surface it live.
- Both banks are hand-authored, fixed lists (13 and 11 pairs respectively) rather than
  procedurally generated from the full 1326-combo / 169-class universe — enough for a
  reproducible 10-question default with headroom, but not exhaustive coverage of every
  possible matchup.
- `board-plays-tie`'s two answer visuals show all 7 raw cards (2 "hole" + 5 shared "board")
  rather than visually separating the two groups; the explanation's `note` field states in
  words which 5 cards are the board, since `QuizVisual`'s two variants (`HAND_CLASS`/`CARDS`)
  have no notion of "these are shared, these are not."
- `hand-ranking-quiz.spec.ts`'s and `starting-hand-quiz.spec.ts`'s full-run tests pin an exact
  score (6/10 and 7/10) against the fixed seed's real shuffle order, checked by hand while
  writing this report — if either question bank or seed is ever edited, those two assertions
  (and the retry-count assertions right after them) need updating alongside.
