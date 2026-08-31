# WP B1 — hand evaluator, board analyzer, hero-hand analyzer

**Status:** complete · **Date:** 2026-09-01 · **Package:** `packages/strategy-core/src/analysis/`

Deterministic, pure, neutral building blocks for postflop analysis. **No strategy in this
WP**: no frequency, no sizing, no range, no advice — features and classifications only, all
machine-readable typed unions and numbers. Nothing here imports `poker-core` (that is
allowed only in `src/adapter/`, which was not touched); the only dependency is
`@gto-self/shared` plus this package's own `provenance.ts`.

---

## 1. Files

| File                                      | Lines | Contents                                                    |
| ----------------------------------------- | ----: | ----------------------------------------------------------- |
| `src/analysis/evaluate.ts`                |   353 | 5/6/7-card evaluator, packed strength, `bestFiveOf`         |
| `src/analysis/board.ts`                   |   449 | `BoardFeatures`, straight windows, tendency, transitions    |
| `src/analysis/heroHand.ts`                |   651 | `HeroHandFeatures`, draws, blockers, nuts                   |
| `src/analysis/evaluate.test.ts`           |   264 | 30 tests — known vectors, ordering, guards                  |
| `src/analysis/evaluateExhaustive.test.ts` |   150 | 4 tests — the 2.6M frequency table, cross-checks, benchmark |
| `src/analysis/board.test.ts`              |   273 | 30 tests                                                    |
| `src/analysis/heroHand.test.ts`           |   442 | 43 tests                                                    |

**Untouched, as required:** `src/index.ts` (the orchestrator exports these later; tests use
relative imports), `src/adapter/**`, `src/preflop/**` (another agent is working there),
`src/range/**`, `src/types.ts`, every other package, all root configs, `docs/STATE.md`,
`docs/DECISIONS.md`.

---

## 2. The evaluator — algorithm

### 2.1 Technique

Cards fold into five 13-bit rank masks in ONE pass, with no per-rank counter array:

- `seen1/seen2/seen3/seen4` — "this rank appears at least 1/2/3/4 times". Quads, trips,
  pairs and singles then fall out as mask differences (`trips = seen3 & ~seen4`, ...).
- `s0..s3` — the rank mask of each suit, so a flush is `popcount(suitMask) >= 5`.

Three independent candidates are formed and the MAXIMUM is the answer:

1. the flush candidate (straight flush, else flush) from the suit with >= 5 cards — with at
   most 7 cards only one suit can qualify, and a straight flush returns immediately because
   nothing outranks it;
2. the best rank-only candidate (quads / full house / trips / two pair / pair / high card);
3. the straight candidate from `seen1`.

Taking the max is correct because the packed strength value orders categories and every
5-card hand belongs to exactly one of the three families. **The 7-card path never expands
the 21 five-card subsets** — it costs the same single pass as the 5-card path. (The
well-known "a 7-card flush excludes a full house" shortcut is _not_ relied on; the max over
all three candidates is taken unconditionally, so correctness does not depend on that
argument.)

Three tables are precomputed at module load over all 8192 rank masks and are DERIVED from
the definitions in the file, never hand-entered: `BIT_COUNT` (popcount), `STRAIGHT_TOP`
(highest straight's top rank, `-1` for none) and `TOP_FIVE` (the five highest set ranks,
pre-packed).

Straights use the ace-low-aware trick: shift the 13-bit mask up one bit and re-insert the
ace at bit 0, giving `A 2 3 4 5 6 7 8 9 T J Q K A`; five consecutive bits at position `p`
mean a straight topped at rank `p + 3`. The wheel therefore answers `'5'` and broadway
answers `'A'` with no special case.

### 2.2 The strength value

One non-negative integer, totally ordered, comparable with `<` / `>`:

```
bits 20-23  category index (0 = HIGH_CARD .. 8 = STRAIGHT_FLUSH)
bits 16-19  first significant rank   (0 = '2' .. 12 = 'A')
bits 12-15  second   bits 8-11  third   bits 4-7  fourth   bits 0-3  fifth
```

Every category uses a FIXED number of slots (`CATEGORY_RANK_SLOTS`) with the unused low
slots zeroed, so padding can never make two same-category hands compare wrongly. Equality of
strength values IS the definition of a split pot. `decodeStrength` unpacks to
`{ strength, category, ranks }`.

### 2.3 Public surface

```
HAND_CATEGORIES, HandCategory, CATEGORY_RANK_SLOTS, HAND_CATEGORY_INDEX, HandValue
evaluateStrength(cards)   the hot path; length-checked, trusts distinctness
evaluateHand(cards)       validating wrapper -> HandValue
decodeStrength(strength)  total unpack
compareHands(a, b)        -1 | 0 | 1
bestFiveOf(cards)         the five cards, by C(n,5) enumeration (NOT the hot path)
straightTopOfRankMask(mask), rankMaskOf(cards), rankCountOfMask(mask)
```

`bestFiveOf`'s tie-break is documented and load-bearing: subsets are visited in ascending
index order and replace the incumbent only on a STRICTLY greater strength, so the winner is
the lexicographically FIRST optimal subset. `heroHand` exploits this by passing the board
before the hole cards, which makes `holeCardsUsed` the number of hole cards that are
genuinely _necessary_ rather than merely present.

### 2.4 The 2.6M-hand frequency validation — **PASS**

All `C(52,5) = 2,598,960` five-card hands enumerated once; the observed category histogram
matched the published table **exactly**:

| category       |  expected |  observed |
| -------------- | --------: | --------: |
| HIGH_CARD      | 1,302,540 | 1,302,540 |
| PAIR           | 1,098,240 | 1,098,240 |
| TWO_PAIR       |   123,552 |   123,552 |
| TRIPS          |    54,912 |    54,912 |
| STRAIGHT       |    10,200 |    10,200 |
| FLUSH          |     5,108 |     5,108 |
| FULL_HOUSE     |     3,744 |     3,744 |
| QUADS          |       624 |       624 |
| STRAIGHT_FLUSH |        40 |        40 |
| **total**      | 2,598,960 | 2,598,960 |

This is asserted as a whole-object equality, so any single misclassification anywhere in the
rank/suit machinery fails the test.

Additionally: 5,000 seeded random seven-card hands and 2,000 seeded six-card hands agree
exactly with the naive best-of-`C(n,5)` reference (`bestFiveOf`). The PRNG is a fixed-seed
mulberry32 — no machine entropy enters the suite.

### 2.5 Benchmark (informational, logged, never asserted)

Machine: Darwin 25.2.0 (arm64), Node under vitest, three consecutive runs.

| path                        | work            | time      | throughput                |
| --------------------------- | --------------- | --------- | ------------------------- |
| 5-card (exhaustive sweep)   | 2,598,960 evals | 97–168 ms | **15.5M – 26.8M evals/s** |
| **7-card** (20k hands × 50) | 1,000,000 evals | 72–84 ms  | **11.9M – 13.9M evals/s** |

A 1M-hand seven-card equity enumeration therefore costs roughly **75–85 ms**, i.e.
comfortably interactive with an order of magnitude of headroom. The 7-card benchmark warms
up before timing so the number is steady-state rather than JIT tiering.

---

## 3. The board analyzer — criteria table

`analyzeBoard(cards)` is total (throws only on a malformed board: length not 3/4/5, or a
duplicate card — programmer errors, handled by `invariant` exactly as `range/combo.ts` does).

### 3.1 Rank texture

| feature             | definition                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| `highCardClass`     | `DEUCE_HIGH` .. `ACE_HIGH`, indexed by the top rank                       |
| `broadwayCount`     | board **cards** with rank >= `'T'` (a paired board contributes twice)     |
| `composition`       | board **cards** per band: `LOW` = 2-6, `MID` = 7-9, `HIGH` = T-A          |
| `distinctRanksDesc` | distinct rank indices, descending — the index basis for hero pair classes |
| `pairing`           | `UNPAIRED / PAIRED / TWO_PAIR / TRIPS / FULL_HOUSE / QUADS`               |
| `rankSpan`          | highest minus lowest distinct rank                                        |

### 3.2 Suit texture

`flopPattern` (`MONOTONE / TWO_TONE / RAINBOW`) is **always computed from the first three
cards, on every street** — the flop's shape stays a fact about the hand after the turn
arrives. Later-street facts are counts: `flushPossible` (>= 3 of a suit: a two-card holding
has a flush), `fourFlush` (exactly 4: one suited hole card does it), `flushOnBoard` (>= 5).
`dominantSuit` is reported once two cards share a suit.

### 3.3 Straight connectivity — the ten windows

There are exactly ten five-rank windows that can be a straight, index 0 = `A2345` (top `'5'`)
through index 9 = `TJQKA`. `windowCoverage[i]` is how many of window `i`'s ranks the board
shows:

| coverage | meaning                                    |
| -------- | ------------------------------------------ |
| 3        | a two-card holding completes that straight |
| 4        | a single card completes it                 |
| 5        | the straight is on the board               |

Everything called "connectivity" is derived from those ten numbers, so the measure never
depends on an eyeballed notion of "connected":

| `straightWindowCount` (coverage >= 3) | `connectivity`     |
| ------------------------------------- | ------------------ |
| 0                                     | `DISCONNECTED`     |
| 1                                     | `LOW_CONNECTED`    |
| 2                                     | `CONNECTED`        |
| >= 3                                  | `HIGHLY_CONNECTED` |

`bestPossibleStraightTop` is the highest top rank among windows at coverage >= 3 — the nut
straight available on this board — and `straightOnBoardTop` is the board's own straight.

### 3.4 STATIC / SEMI_DYNAMIC / DYNAMIC — the exact rule

This is the WP's one judgement call, so it is carried as
**`Provenanced<BoardTendency>` with provenance `HEURISTIC` and a mandatory note**, reusing
the axis A2 defined. It is an authored rule of thumb and can never be presented as solved
output (CLAUDE.md rule 2). Points are summed into `tendencyScore`:

| component                                              |  points |
| ------------------------------------------------------ | ------: |
| three or more cards of one suit (a flush is possible)  |      +2 |
| exactly two cards of one suit                          |      +1 |
| connectivity `DISCONNECTED / LOW / CONNECTED / HIGHLY` | 0/1/2/3 |
| the board carries any pair or better                   |      −1 |

`score <= 1` -> `STATIC`, `2..3` -> `SEMI_DYNAMIC`, `>= 4` -> `DYNAMIC`. The exact criteria
string is exported as `BOARD_TENDENCY_CRITERIA` and repeated in every value's note.

Worked results (all asserted in tests):

| board      | suit | conn. | pair | score | tendency       |
| ---------- | ---: | ----- | ---: | ----: | -------------- |
| `Kd Kc 2s` |    0 | 0     |   −1 |    −1 | `STATIC`       |
| `Ah 7d 2c` |    0 | 0     |    0 |     0 | `STATIC`       |
| `As Ks Qs` |   +2 | +1    |    0 |     3 | `SEMI_DYNAMIC` |
| `7h 8h 9c` |   +1 | +3    |    0 |     4 | `DYNAMIC`      |
| `Jh Th 9s` |   +1 | +3    |    0 |     4 | `DYNAMIC`      |

`SEMI_DYNAMIC` exists precisely so a genuinely borderline board (a monotone broadway flop) is
not forced into one of the two extremes.

### 3.5 Transitions

`analyzeBoardTransition(before, after)` requires `after` to be `before` plus exactly one card
in that order (otherwise it throws — the caller is describing a turn or a river, not two
arbitrary boards). Everything is computed by **diffing the two `BoardFeatures`**, so a
transition can never disagree with the features it is derived from:

| field                                                                          | definition                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `overcard`                                                                     | new rank > the previous top rank                               |
| `boardPaired`                                                                  | the new card matched a rank already out                        |
| `flushDrawCompleted`                                                           | max suit count crossed 2 -> 3: a two-card flush draw got there |
| `fourFlushArrived`                                                             | crossed to 4                                                   |
| `flushOnBoardArrived`                                                          | crossed to 5                                                   |
| `straightsNowPossible`                                                         | increase in windows at coverage >= 3                           |
| `straightDrawCompleted`                                                        | that increase is positive                                      |
| `straightOnBoardArrived`                                                       | a window reached coverage 5                                    |
| `connectivityIncreased`, `pairingChanged`, `topRankChanged`, `tendencyChanged` | as named                                                       |

---

## 4. The hero-hand analyzer — feature definitions

`analyzeHeroHand(hole, board, options?)`. The made-hand CATEGORY always comes from the
evaluator; this module only adds what the evaluator cannot know, namely which cards are
hero's.

### 4.1 Made-hand classes

`MadeHandClass` = `STRAIGHT_FLUSH | QUADS | FULL_HOUSE | FLUSH | STRAIGHT | SET | TRIPS |
TWO_PAIR | OVERPAIR | TOP_PAIR | MIDDLE_PAIR | BOTTOM_PAIR | UNDERPAIR | BOARD_PAIR |
ACE_HIGH | NO_MADE_HAND`.

Companion fields: `pairRank`, `boardRanksBeaten`, `pairedBoardRankIndex`, `pocketPair`,
`twoPairKind`, `tripsKind`, `holeCardsUsed`, `playsTheBoard`, `bestFive`.

`TwoPairKind` = `BOTH_HOLE_CARDS | ONE_HOLE_PLUS_BOARD_PAIR | POCKET_PAIR_PLUS_BOARD_PAIR |
BOARD_TWO_PAIR`. `TripsKind` = `SET | TRIPS | BOARD_TRIPS`.

### 4.2 Every documented edge choice

1. **UNDERPAIR is a pocket pair below the HIGHEST board card**, not below the lowest. `77` on
   `9 5 2` is `UNDERPAIR`; `boardRanksBeaten` (2 here, 0 on `A K Q`) preserves the
   distinction as a number rather than a second label.
2. **A pocket pair is never TOP/MIDDLE/BOTTOM pair.** Those describe hero pairing a board
   card with one hole card, positioned by index into the board's DISTINCT ranks descending:
   index 0 = `TOP_PAIR`, the last index = `BOTTOM_PAIR`, anything between = `MIDDLE_PAIR`.
   (On a three-card board with two distinct ranks the board is paired, so those classes are
   unreachable there and the case is exercised on a four-card board instead.)
3. **BOARD_PAIR** when the hand's only pair is entirely on the board. `A Q` on `K K 5` is
   `BOARD_PAIR`, not a pair.
4. **SET vs TRIPS.** `SET` = hero's pocket pair matched a board rank. `TRIPS` = the board was
   paired and hero holds the third. `BOARD_TRIPS` = all three on the board. `tripsKind` is
   also reported for a FULL HOUSE, describing the source of its three-of-a-kind — so
   `5c 5d` on `5h 8s 8d` is `FULL_HOUSE` + `tripsKind: 'SET'`, and the evaluator confirms
   **fives full of eights**, ranks `[5, 8]`, not eights full of fives.
5. **Kicker significance is a count, not an opinion.** `betterKickerCount` = ranks strictly
   above hero's kicker that are neither the paired rank nor already on the board — i.e. how
   many better kickers an opponent could actually hold. `0 -> TOP`, `1 -> SECOND`,
   `2 -> THIRD`, `>= 3 -> WEAK`. A kicker is reported even when it does not play
   (`plays: false`): hero's actual card is never discarded (CLAUDE.md rule 3).
6. **DOUBLE_GUTSHOT is its own member**, not folded into OESD, though both have the same
   number of completing RANKS. `OESD` requires a run of four consecutive ranks whose two
   flanking ranks are BOTH outs; two outs without such a run is `DOUBLE_GUTSHOT`. The run
   test uses the ace-low-aware mask, so `2 3 4 5` is open-ended (ace and six) while `A K Q J`
   and `A 2 3 4` have one flank and come out as `GUTSHOT` — which is correct.
7. **A straight out only counts if it beats the board.** A rank must give hero a STRICTLY
   higher straight than the board alone would make with it, so a card that merely puts a
   straight on the board for everybody is not hero's out.
8. **Draws are reported only below the category they draw to.** A made flush has no flush
   draw; a made straight has no straight draw. Anything weaker still reports its draws (top
   pair with an open-ender reports both).
9. **Backdoor draws are flop-only** — after the turn one card remains, so a three-card suit
   or a three-covered rank window is no longer a draw.
10. **A four-flush board with no hole card of that suit is not a hero flush draw.** Hero has
    nothing to draw with; the fact belongs to `BoardFeatures`.
11. **`overcardCount` counts hole CARDS above the board's top card**, so an overpair counts 2.
12. **The nuts ignore card removal.** `nutStrengthOnBoard(board)` is the best hand ANY two
    cards could make, hero's blockers included, so it is a property of the board and can be
    computed once and reused. `isNuts` and `flush.isNut` answer different questions: `Ah 5h`
    on `Kh 7h 2h` holds the NUT FLUSH (no higher flush card exists) yet is not THE NUTS,
    because `Ah Qh` makes a better flush. Both are asserted.
13. **A straight flush is not reported through `flush`.** "How many better flushes exist" is
    meaningless once no plain flush can beat the hand, so `flush` stays null and the hand is
    described by `straight` + `madeClass`. (This was found by a test and fixed in the code,
    not papered over in the test.)

### 4.3 Draws

| field                  | definition                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `flushDraw`            | exactly 4 of a suit among hole+board, hero holding >= 1; carries `holeCardsInSuit`, `highRank`, `betterFlushCards`, `nutClass` |
| `nutClass`             | UNSEEN cards of the suit above hero's best one: `0 -> NUT`, `1 -> SECOND_NUT`, `2 -> THIRD_NUT`, else `WEAK`                   |
| `straightDraw`         | `OESD / DOUBLE_GUTSHOT / GUTSHOT` plus the exact `outRanks` (ascending)                                                        |
| `backdoorFlushDraw`    | flop only: exactly 3 of a suit, hero holding >= 1                                                                              |
| `backdoorStraightDraw` | flop only: a window three-covered with hero contributing, and no live out                                                      |

Note `betterFlushCards` counts only cards an opponent could still hold: a suited board card
above hero's is part of hero's own flush, so `5h 4h` on `Kh Qh 7c` has 7 better cards, not 9.

### 4.4 Blockers

Returned as a readonly array in `HERO_BLOCKERS` declaration order. Each member is a purely
mechanical statement about cards hero holds that an opponent therefore cannot — none is a
strategy claim.

| member                     | condition                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `NUT_FLUSH_BLOCKER`        | a suit has >= 3 board cards, hero holds its highest card not on the board                  |
| `SECOND_NUT_FLUSH_BLOCKER` | as above, the second-highest                                                               |
| `NUT_FLUSH_DRAW_BLOCKER`   | a suit has exactly 2 board cards (cards still to come), hero holds its highest unseen card |
| `FLUSH_DRAW_BLOCKER`       | a suit has exactly 2 board cards (cards still to come), hero holds >= 1                    |
| `NUT_STRAIGHT_BLOCKER`     | hero holds a rank the best currently-possible straight needs                               |
| `STRAIGHT_BLOCKER`         | hero holds a rank some currently-possible straight needs                                   |
| `TOP_PAIR_BLOCKER`         | hero holds a card of the board's highest rank                                              |
| `BOARD_PAIR_BLOCKER`       | the board shows a rank exactly twice and hero holds the third                              |

The two flush-draw members are not emitted on the river, where a two-card suit is dead.

### 4.5 The spec's worked examples, as asserted

| holding / board       | result                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ah Kh` on `Qh Jh 2c` | `ACE_HIGH`; NUT flush draw (2 hole hearts); `GUTSHOT`, outs `[T]`; 2 overcards; no backdoor; blocks `NUT_FLUSH_DRAW_BLOCKER` + `FLUSH_DRAW_BLOCKER` |
| `5c 5d` on `5h 8s 8d` | `FULL_HOUSE` ranks `[5, 8]` = **fives full of eights**, `tripsKind: SET`                                                                            |
| `Tc 9c` on `8c 7d 2h` | `NO_MADE_HAND`; `OESD` outs `[6, J]`; backdoor flush draw in clubs (2 hole cards); 2 overcards                                                      |
| `7c 7d` on `9h 5s 2c` | `UNDERPAIR`, `boardRanksBeaten: 2` (0 on `A K Q`)                                                                                                   |

---

## 5. Verification

| Gate                                                 | Result                             |
| ---------------------------------------------------- | ---------------------------------- |
| `pnpm vitest run --project strategy-core`            | **PASS** — 17 files, **356 tests** |
| ... of which `src/analysis/**`                       | **PASS** — 4 files, **107 tests**  |
| `pnpm typecheck` (all 9 projects)                    | **PASS**                           |
| `npx eslint packages/strategy-core --max-warnings=0` | **PASS** — 0 errors, 0 warnings    |
| `prettier --write` on the seven files I created      | applied (repo-wide format NOT run) |

Per-file test counts: `evaluate.test.ts` 30, `evaluateExhaustive.test.ts` 4 (one of which is
the 2.6M sweep), `board.test.ts` 30, `heroHand.test.ts` 43.

Not run, per the WP's instruction: the repo-wide suite and E2E.

---

## 6. Risks / notes for the orchestrator

1. **`src/index.ts` was not touched.** None of `evaluate.ts` / `board.ts` / `heroHand.ts` is
   exported from the package barrel yet — the tests import relatively. The orchestrator has
   to add the exports when it integrates. The names that should go out are listed in §2.3 and
   the type names in §3 and §4.
2. **The tendency heuristic is authored, not solved.** It is tagged `HEURISTIC` with a
   mandatory note, but the UI must still label it as ours. It is the one place in this WP a
   downstream consumer could mistake a judgement for a fact. If the policy WP wants different
   thresholds, change `BOARD_TENDENCY_CRITERIA` and the table together — never one of them.
3. **`nutStrengthOnBoard` costs ~1,100 evaluations per board** and `analyzeHeroHand` calls it
   by default. That is microseconds for one hand but ~1.5M evaluations if a caller loops all
   1326 combos on one board. `AnalyzeHeroHandOptions.nutStrength` exists exactly for that;
   batch consumers MUST pass it. This is documented on the option but is the most likely
   performance misuse.
4. **`evaluateStrength` trusts distinctness.** It checks length only, because it is the entry
   point equity enumeration calls millions of times. `evaluateHand` and `bestFiveOf` validate.
   A caller that hands it a duplicated card gets a silently wrong answer — the precondition is
   documented at the function, but it is a real sharp edge.
5. **`analyzeHeroHand` is a _hand_ analyzer, not a _range_ analyzer.** It answers about one
   holding. Range-vs-board work (equity, made-hand distribution over a range) belongs to a
   later WP and should build on `evaluateStrength`, not on `analyzeHeroHand`.
6. **`straightWindowCount` counts windows, not combinations.** Two windows do not mean twice
   the straight combos. Anything wanting combinatorics must count them itself.
7. **A concurrent agent is working in `src/preflop/`.** During this WP its
   `src/preflop/propagate.test.ts` was transiently red (1 failure) on one run and green on the
   next; I did not touch that directory. The final full-package run above is green.
8. **No ADR is needed for this WP** as far as I can see — nothing here reopens a settled
   decision, and every poker rule encoded is a standard showdown rule rather than an
   assumption. The one authored rule (§3.4) is carried on the existing provenance axis rather
   than needing a new one. If the orchestrator disagrees, the tendency criteria are the only
   ADR-worthy item.
