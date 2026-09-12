# WP-F2A — Poker Evaluator + Equity Core

Verification-plus-one-gap pass over the existing evaluator (`strategy-core`, read-only) and
exact heads-up equity engine (`learn-core`). No second evaluator, no second equity engine
was built — per the baseline audit, both already existed and worked.

## 1. Scope

- `packages/learn-core/src/equity/exact.ts` — extended with integer basis-point fields.
- `packages/learn-core/src/equity/exact.test.ts` — extended with basis-point tests.
- `packages/learn-core/src/equity/evaluatorEdgeCases.test.ts` — new file, 3 tests for the
  edge cases not already unambiguously covered as a two-player showdown.
- `packages/strategy-core/**` — read only. Not edited (`bestFiveOf`, `evaluateHand`,
  `evaluateStrength`, `apportion` were read and reused, never modified).
- `packages/learn-core/src/index.ts` — not touched. `ExactEquity` and `exactHeadsUpEquity`
  were already exported via `export * from './equity/exact.js'`; adding fields to an
  already-exported interface needs no barrel change.
- Independent cross-check scripts and timing scripts: scratchpad only, not part of the repo.

## 2. Files changed

| File | Change |
| --- | --- |
| `packages/learn-core/src/equity/exact.ts` | Added `heroWinBps`/`tieBps`/`villainWinBps` to `ExactEquity`; computed via `strategy-core`'s existing `apportion` (largest-remainder/Hamilton). Added a "Basis points" doc section. |
| `packages/learn-core/src/equity/exact.test.ts` | Added a `basis points` describe block: sum-to-10000 + within-1-bps checks on real enumerated spots, the AA-vs-KK figure in bps, decided-river bps, and an adversarial-triple property-test suite (exhaustive for river/turn, seeded deterministic sampling for flop/preflop, plus explicit all-tie/all-win/all-lose, near-50/50, and smallest-nonzero-remainder cases). |
| `packages/learn-core/src/equity/evaluatorEdgeCases.test.ts` | New. 3 tests: flush tie, full-house-vs-full-house (both trips), paired-board two-pair — each a genuine two-player river spot through `exactHeadsUpEquity` + `bestFiveOf`. |

Test count: **82 → 94** (`pnpm vitest run --project learn-core`), 7 files → 8 files.

## 3. Decisions

**Reused `strategy-core`'s `apportion`, did not write a new apportionment function.**
`packages/strategy-core/src/bps.ts` already implements exactly this problem shape ("N
non-negative integers, share a fixed integer total proportionally, shares must sum to the
total") as the largest-remainder / Hamilton method, tie-broken by larger remainder then lower
index, and it is already unit-tested (`bps.test.ts`) and exported from the package barrel.
Reimplementing it in `learn-core` would have been a second implementation of a solved
problem — exactly what CLAUDE.md rule 8 and this task's brief ("verification plus one real
gap, not a rewrite") warn against. `exact.ts` now calls `apportion([wins, ties, losses],
BPS_TOTAL)` once, after the enumeration loop.

**Why this rounding rule, specifically.** Largest-remainder apportionment floors each
category's exact share (`floor(count * 10000 / runouts)`) then hands the (at most 2) leftover
units to the categories with the largest fractional remainder, ties broken by lower index
(hero win, then tie, then villain win). Two properties fall out of the construction, not a
separate proof: (1) the three integers always sum to exactly 10000 — the floors are `<=`
their exact shares by definition and the leftover is by construction exactly enough units to
close the gap; (2) each result is its exact value's floor or ceiling, so each is within 1 bps
of the exact rational value. No float is ever compared: the remainders `apportion` compares
share a common denominator (`runouts`), so comparing them as integers is exact, and the
tie-break is a fixed index order, not RNG.

**Derived from integer counts (`wins`/`ties`/`losses`), never from `winProb`/`tieProb`.** The
existing floats are already a rounded view; multiplying an already-rounded float by 10000
could disagree with the count-derived integer by more than intended. `exact.ts`'s call site
passes the raw counts straight into `apportion`.

**`apportion` cannot fail here, and that is asserted, not silently trusted.** `apportion`
returns a `StrategyResult` that can only be an `Err` for an all-zero input against a positive
total, or a non-integer/negative total. `runouts = wins + ties + losses >= 1` always (the
smallest legal board is the river, `C(43,0) = 1`), so at least one of the three inputs is
positive, and `BPS_TOTAL` is a fixed positive integer literal — this path is unreachable, and
`invariant(apportioned.ok, ...)` documents that in code rather than leaving an unexplained
`unwrap`.

**One new test file (`evaluatorEdgeCases.test.ts`), not an edit to `strategy-core`.** Per the
brief and CLAUDE.md, `strategy-core` is read-only. The 3 new tests exercise `strategy-core`'s
`bestFiveOf` and `learn-core`'s own `exactHeadsUpEquity` — i.e. exactly the calls FishTilt's
Hand Checker and Equity Calculator will make — rather than adding coverage inside the
evaluator's own package.

## 4. Behavior / new public API

`exactHeadsUpEquity(heroCards, villainCards, board): Result<ExactEquity, ExactEquityError>` —
**signature unchanged**. `ExactEquity` gained three fields:

```ts
export interface ExactEquity {
  // ...unchanged: heroCards, villainCards, board, wins, ties, losses, runouts,
  // unseenCards, winProb, tieProb, loseProb, equity, method: 'EXACT' ...

  /** `wins` as integer basis points of `runouts` (10000 = 100%). */
  readonly heroWinBps: number;
  /** `ties` as integer basis points of `runouts`. */
  readonly tieBps: number;
  /** `losses` as integer basis points of `runouts`. */
  readonly villainWinBps: number;
}
```

Invariant, always true: `heroWinBps + tieBps + villainWinBps === 10000`. `method` and
`runouts` were already on `ExactEquity` before this work (confirmed by reading the baseline
code) — no separate surfacing was needed for those two fields.

## 5. Edge-case verification table

| # | Case | Verdict | Citation |
| --- | --- | --- | --- |
| 1 | Wheel straight A2345, loses to 23456 | COVERED-EXISTING | `packages/strategy-core/src/analysis/evaluate.test.ts:141` `'puts the wheel below the six-high straight'` |
| 2 | Board plays (all 5 community cards are the best five for both → tie) | COVERED-EXISTING | `evaluate.test.ts:223` `'breaks ties towards the earliest cards, so a board given first wins the attribution'` (bestFiveOf returns the board's own cards) + `packages/learn-core/src/equity/exact.test.ts:128` `'is a decided 1 / 0 / chop on a river, and strategy-core agrees'` (chop case: `AsKd`/`AhKc` on `2s3h4d5c6s`, both play the board's straight) and reinforced by `exact.test.ts:313` in bps |
| 3 | Flush kicker decides | COVERED-EXISTING | `evaluate.test.ts:123` `'separates flushes by every card in turn'` |
| 4 | Full house vs full house, both have trips, higher trips wins | COVERED-NEW (related existing: `evaluate.test.ts:189` `'picks the higher trips when the board offers two of them'`, single-hand) | `evaluatorEdgeCases.test.ts` `'decides on the higher TRIP rank, even when the loser holds the higher pair rank'` — genuine two-player river spot, hero 9-over-4 boat beats villain's 4-over-9 boat |
| 5 | Quads with kicker decides | COVERED-EXISTING | `evaluate.test.ts:94` `'separates quads by kicker'` |
| 6 | Straight ties (identical straights split) | COVERED-EXISTING | `evaluate.test.ts:72` `'compares equal hands as a split pot'` (`Ah Kd Qc Js Th` vs `As Kh Qd Jc Ts`, `compareHands` → 0) |
| 7 | Flush ties (identical flushes split) | COVERED-NEW | `evaluatorEdgeCases.test.ts` `'splits when the board itself deals a 5-card flush and neither hand improves it'` — monotone river board, both hands' best-five equal the board's own 5 cards |
| 8 | Paired board interactions | COVERED-NEW | `evaluatorEdgeCases.test.ts` `'two pair from a shared board pair: the higher hole-card top pair decides, not the kicker'` — board pairs 77, hero's K-over-7 beats villain's Q-over-7 despite villain's pocket pair outranking hero's kicker |
| 9 | 7-card best-five selection returns the actual 5 cards, not just a score | COVERED-EXISTING | `evaluate.test.ts:215` `'returns the five cards of the winning hand'`, `:223`, `:232` `'agrees with evaluateStrength on the same cards'` |

## 6. Independent cross-check table

`exactHeadsUpEquity` (production) vs `naiveHeadsUpEquity` (from-scratch brute-force, written
in the scratchpad, importing only `parseCards` from `@gto-self/shared` — no evaluator,
apportion or equity code from this repo). The naive path: independent category+tiebreak-tuple
5-card evaluator, tries all `C(7,5)=21` subsets per 7-card hand (no bitmasks, no packed
integer, no precomputed tables), independent recursive combination generator for runouts.
Self-tested against 6 known vectors (wheel-vs-six-high, royal-vs-wheel, quad kickers, boat
trips-first, flush-vs-straight, straight tie) before use.

| # | Street | Spot | `exactHeadsUpEquity` (W/T/L/runouts) | naive oracle (W/T/L/runouts) | Agree |
| --- | --- | --- | --- | --- | --- |
| 1 | PREFLOP | AA vs KK | 1410336 / 9308 / 292660 / 1712304 | 1410336 / 9308 / 292660 / 1712304 | **YES** |
| 2 | PREFLOP | AKs vs QQ | 787966 / 6732 / 917606 / 1712304 | 787966 / 6732 / 917606 / 1712304 | **YES** |
| 3 | FLOP | flush draw (`Th9h`) vs overpair (`AsAd`), board `Kh7h2c` | 389 / 0 / 601 / 990 | 389 / 0 / 601 / 990 | **YES** |
| 4 | FLOP | set (`7c7s`) vs flush draw (`AhKh`), board `7h2h9d` | 746 / 0 / 244 / 990 | 746 / 0 / 244 / 990 | **YES** |
| 5 | TURN | OESD (`JsTs`) vs overpair (`QhQd`), board `9s8h2c3d` | 6 / 0 / 38 / 44 | 6 / 0 / 38 / 44 | **YES** |
| 6 | RIVER | known certain outcome (`AsKd` vs `7h2c`, board `AdKh9s3c4d`) | 1 / 0 / 0 / 1 | 1 / 0 / 0 / 1 | **YES** |

**All 6 spots agree exactly on every integer count** (not merely close). Sanity remark (not
authority, our own enumeration above is): AA vs KK's ~82.4/0.5/17.1 split is the commonly
published figure — consistent with row 1 here.

## 7. Measured cost table

Measured on this machine (Apple M4 Pro, 14 cores) just now; `uptime` showed load average
~4.0–4.5 at measurement time (a concurrent agent session was active elsewhere in this repo
per `git status`, so this is a shared, not idle, machine). 10 warm-up calls, then 15 measured
calls per shape, `performance.now()`, cards pre-parsed outside the timed region.

| Board length | Runouts | Measured (this run) | Baseline audit's earlier figure |
| --- | --- | --- | --- |
| 0 (preflop) | `C(48,5)` = 1,712,304 | **median 199.9ms, range 193.3–206.3ms** | 80–93ms |
| 3 (flop) | `C(45,2)` = 990 | ~0.1ms | not separately reported |
| 4 (turn) | `C(44,1)` = 44 | ~0.0ms | not separately reported |
| 5 (river) | `C(43,0)` = 1 | ~0.0ms | not separately reported |

**Correction, not a confirmation.** The baseline audit's 80–93ms figure does not reproduce on
this run — measured preflop cost here is consistently ~2x that, 193–206ms across 15 runs
after 10 warm-up calls (tight spread, not a fluke). This is **not attributable to this
work's code change**: the one addition to the hot path's function is a single `apportion`
call on 3 integers *after* the enumeration loop completes, independently measured at 0.263
microseconds/call — six orders of magnitude too small to explain a ~110–120ms difference. The
most plausible explanation is machine load at measurement time (`uptime` load average ~4–4.5
on a 14-core machine, with another agent's work also touching this repo concurrently per
`git status`) rather than a code regression; this was not re-verified on an idle machine, so
it is reported as an open discrepancy rather than resolved. Flop, turn and river are
unaffected either way — all three stayed at "instant" (<1ms), consistent with their much
smaller runout counts.

**Exact enumeration is viable for every shape the UI will offer.** Even at the slower,
corrected figure, ~200ms is within a single click-to-result budget, though — as the baseline
audit's own risk #5 already flagged — a number in the 100–200ms range still blocks the main
thread for a perceptible instant on lower-end hardware than this measurement machine, so a
Web Worker remains the right call for WP-F2B's preflop path. Flop/turn/river need no such
precaution.

## 8. Tests run (real counts)

| Gate | Command | Result |
| --- | --- | --- |
| Unit tests | `pnpm vitest run --project learn-core` | **8 files / 94 tests passed, 0 failed** (was 7 files / 82 tests before this work) |
| Typecheck | `pnpm --filter @gto-self/learn-core typecheck` | clean, 0 errors |
| Lint | `npx eslint packages/learn-core --max-warnings=0` | clean, exit 0 |

## 9. Known limitations

- The measured preflop cost (§7) is a live discrepancy against the prior baseline report,
  reported honestly rather than silently reconciled — it should be re-measured on an idle
  machine before being treated as a hard budget number for WP-F2B's UI/Worker design.
- The largest-remainder apportionment's adversarial property test sweeps river (1) and turn
  (44) runouts exhaustively, but flop (990) and preflop (1,712,304) are covered by a large
  (4000-sample) seeded-deterministic sweep, not full exhaustion — exhaustive coverage of
  1,712,304 x 1,712,304 splits is not tractable and was not attempted. The named adversarial
  categories (all-tie/all-win/all-lose, near-50/50, smallest-nonzero-remainder) are each
  covered by an explicit, separately-asserted case for every one of the four real runout
  values, on top of the sweep.
- `evaluatorEdgeCases.test.ts`'s three new cases are all RIVER spots (single deterministic
  runout) by design — the point was to pin an exact hand-vs-hand outcome, not to re-test the
  enumeration loop (already covered by `exact.test.ts`'s own structural tests across all four
  board lengths).

## 10. What WP-F2B needs to know

- **Call `exactHeadsUpEquity(heroCards: readonly Card[], villainCards: readonly Card[], board: readonly Card[]): Result<ExactEquity, ExactEquityError>`** from `@gto-self/learn-core` (re-exported at the package root). Unchanged signature.
- **`ExactEquity` now carries `heroWinBps`, `tieBps`, `villainWinBps` (integers, sum to exactly 10000)** alongside the pre-existing `winProb`/`tieProb`/`loseProb`/`equity` floats, `wins`/`ties`/`losses`/`runouts` integer counts, and `method: 'EXACT'`. Use the bps fields for on-screen percentages so three displayed numbers always sum to 100%; use the floats only for anything that needs a continuous ratio (e.g. a chart).
- **`method` and `runouts` were already present** on `ExactEquity` before this work — the calculator page can say "정확 계산" unconditionally (method is always the literal `'EXACT'`) and show `runouts` as the enumeration count directly.
- **For the Hand Checker, call `bestFiveOf` from `@gto-self/strategy-core`** (not something new) — it returns `{ value: HandValue, cards: readonly Card[] }`, where `cards` is the actual winning 5-card subset in input order. Pass the board cards before the hole cards so ties attribute to the board first (see `evaluate.test.ts:223`'s documented tie-break).
- **Preflop (0-board) calls cost ~200ms on a loaded dev machine (§7)** — budget for a Web Worker on that path per the baseline audit's risk #5; flop/turn/river are sub-millisecond and need no such precaution.
