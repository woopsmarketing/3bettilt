# STRATEGY_FIX_R1B — residual findings from the second independent review

Date: 2026-09-01. Input: `docs/reports/STRATEGY_REVIEW_R1B.md` (MAJOR-2, MAJOR-3, MAJOR-4(b),
MAJOR-5 and the MINOR list), plus `STRATEGY_REVIEW_R1.md` MINOR-4. Everything was reproduced
against the tree as it stands **after** the three earlier fix agents landed; R1B's line numbers
had drifted, so every finding was located by symbol name and re-measured before being touched.

Boundary honoured: `packages/strategy-core/**`, comment-only edits in
`apps/web/src/lib/table/strategy.ts` and `apps/web/src/components/table/StrategyPanel.tsx`, and
appended (never rewritten) correction notes in `STRATEGY_WP_B3.md`, `STRATEGY_WP_B4.md` and
`STRATEGY_WP_A3.md`. `docs/STATE.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `prompt*`, root configs,
`packages/poker-core` and `packages/db` were not touched.

---

## 0. Summary

| finding | status | proof |
| --- | --- | --- |
| MAJOR-3 — multiway penalty subtracted from a "never folds" band | **fixed** | 3 tests fail on revert |
| MAJOR-5 — aggression hard-zeroed facing an all-in in a live tree | **fixed** | 1 test fails on revert |
| MAJOR-4(b) — `facedBetFractionOfPot` was the wrong quantity | **fixed** | 2 tests fail on revert (reproduced R1B's 0.5217 and 0.40 exactly) |
| MAJOR-2 — false "worst shape" claim, 4+ players never benchmarked | **fixed** | benchmark now measures 2–6 players and asserts the ordering; claims corrected in 4 places |
| MINOR-4 (R1B) — `provenance.ts` contract contradicted ADR-0056 | fixed | doc-only |
| MINOR-4 (R1) — sizing reported for an answer with no sized action | fixed | new test |
| MINOR-8 — strategy magnitudes outside the model file | partly fixed | new tests; remainder deferred with reasons (§5) |
| MINOR-9 — `HERO_EQUITY_MEASUREMENT` over-tagged `DERIVED` | fixed | registry test updated |
| MINOR-11 — `ALL_IN_CALL_MARGIN` unread and duplicated | fixed | new test |
| MINOR-1, -2, -3, -5 | already fixed by the earlier agents; verified, not re-done | — |
| MINOR-6, -7, -10, NOTE-1..11 | deferred, with reasons (§5) | — |
| cleanup — `PreflopPolicyContext.facingAllIn` now required | done | typecheck |
| cleanup — `STRATEGY_WP_A3.md` SB-range correction | done | appended |

Tests: `strategy-core` **748 → 766** (31 files, all passing). `web` 283 passing, unchanged.
`pnpm typecheck` clean (9 projects), `pnpm lint` clean, `next build` green (it runs as the E2E
web server), Playwright `strategy-panel` + `seat-occupancy` **8/8 passing**.

---

## 1. MAJOR-3 — the multiway continue penalty could fold a hand with 100% equity

### Reproduced, on the current tree

`postflop/score.ts` subtracted `multiwayContinuePenaltyBpsFor(opponents)` from the band value
AFTER the band lookup, on both the facing-a-bet path and the all-in path, unconditionally. Two
counterexamples, both rebuilt on the package's own fixtures and both failing before the fix:

```
3-way SRP, RIVER 7h 7d 2c 9s 3h, hero (BTN) 7s 7c — quads, unbeatable.
SB bets 5 BB, BB calls, hero to act.  continueBand = ALWAYS (10000), penalty 1000
  -> continueBps 9000, FOLD 1000        // a hand that cannot lose folds 10% of the time
3-way FLOP 7h 7d 2c, hero (BTN) 7s 7c, a 25 BB SB shoves, a 100 BB BB is still live.
  ALL_IN_CALL_BANDS.CLEAR_CALL (10000) - 1000 -> FOLD 1000 at heroEquity 0.9997
```

`CONTINUE_BANDS.ALWAYS`'s own rationale in `scoreModel.ts` reads *"Never folds"*, and the band
header says 10000 is reachable *"unlike aggression"*. Multiway it was not reachable at all.

### Fix

New model data, in `scoreModel.ts` with its rationale, and new arithmetic in `score.ts`:

- `priceImpliedContinueBps(potOddsMargin)` — the continuing frequency the PRICE alone justifies
  at hero's equity margin. It is **not a new table**: it reads `ALL_IN_CALL_BANDS`, which
  already states exactly that mapping for the all-in path. Null margin (hero is not facing a
  bet) means no floor.
- `penalizedContinueBps(continueBps, opponents, potOddsMargin)` in `score.ts`:

  ```ts
  const priceBps = priceImpliedContinueBps(potOddsMargin);
  const floor = continueBps >= priceBps ? priceBps : 0;
  return Math.max(floor, continueBps - penalty);
  ```

  The penalty stays a REDUCTION (the result is never above the band). Where the band already
  continues at least as often as the price says, the reduction stops at the price-implied
  frequency. Where the band is BELOW the price line — the model has non-price reasons to fold —
  the penalty applies in full, which is where it does most of its work.

Why the floor is legitimate rather than an authored clamp: hero's equity is measured against
every live villain range and the required equity counts every chip in the pot, so the margin is
already a multiway-correct statement about the immediate price. A flat proxy for "there are
more ranges to beat" must not argue a hand out of a call that price has settled. R1B's own
preservation note names this route ("flooring the post-penalty value at the pot-odds-implied
continue frequency").

What did **not** change: the penalty table, its 500-bps grid, `assertModel`'s grid check,
`PostflopScoring.multiwayContinuePenaltyBps` (still reported, still drives the
`MULTIWAY_CONTINUE_PENALTY` rule id and explanation feature), and every heads-up answer (the
penalty is 0 for one opponent and the function is the identity).

A graded floor with no band guard was tried first and rejected: at a break-even margin the
price table says 5000, which would have nullified the penalty for every band at or below 5000 —
gutting the feature R1B explicitly asked to keep.

### Failing-test proof

Reverting the floor to `0` (`const floor = 0 * priceBps;`) fails **3** tests in
`postflop/policy.test.ts`:

```
× never folds 100%-equity quads three-way facing a bet and a call
× never folds quads facing a shove with a deep opponent still live, and can isolate
× floors the penalty at the price-implied frequency and never above the band
```

The penalty still bites, asserted comparatively:

```
penalizedContinueBps(5500, 1, -0.5) === 5500   // heads-up: identity
penalizedContinueBps(5500, 2, -0.5) === 4500   // three-handed: strictly tighter
penalizedContinueBps(10000, 2, 0.05) === 9000  // model likes it, price does not settle it
penalizedContinueBps(3500, 5, 0.5) ===  500    // band below the price line: full penalty
```

plus a loop over every `CONTINUE_BAND` × {2,3,4,5} opponents below the price line.

---

## 2. MAJOR-5 — the isolation raise was structurally unreachable multiway

### Reproduced

`scorePostflop`'s `facingAllIn` branch returned `aggressionBps: 0` and `mix.aggressiveBps: 0`
unconditionally, consulting neither the legal actions nor the lineup. On the 3-way shove
fixture above — `legalActions.wager = {kind:'RAISE', onlyAllIn:false}`, a 100 BB opponent still
to act — the emitted set was `FOLD 1000 / CALL 9000`. No holding, board or price could produce
a raise. `rules.ts`'s `FACING_ALL_IN_POT_ODDS` justified this with *"there is nothing left to
raise into"*, which is true heads-up and false multiway.

### Fix — the same principle as the preflop B1 fix

`PostflopSpot` gains an additive `allInCollapsedTree: boolean`, computed in
`classifyPostflopSpot` from the query and never inferred:

> `facingAllIn` **AND** ( hero has no aggressive option **OR** no live opponent besides the
> shover ),

where "aggressive option" is `legalActions.wager !== null || legalActions.allIn?.effect ===
'RAISE'` and "live opponent besides the shover" is a dealt-in seat that is not hero, is
`IN_HAND` (neither folded nor already all-in) and is not the shover. The FAMILY is unchanged —
`FACING_ALL_IN` still describes what hero faces; the new field describes whether anything is
left to raise into.

`score.ts`'s all-in branch now:

- takes the continuing mass from `ALL_IN_CALL_BANDS` as before (through
  `penalizedContinueBps`, §1), and
- when the tree is NOT collapsed, splits it with `splitContinueMass` — the *same*
  `RAISE_SHARE_BANDS` + multiway-scale arithmetic the facing-a-bet path uses, now extracted
  into one helper so both paths answer "how much of the continue mass raises" identically.
  Collapsed, the raising share is structurally zero and nothing moves.

Reporting: new rule `FACING_ALL_IN_ISOLATION` (HEURISTIC, `NO_ANCHOR` — no public source covers
a postflop spot with a shove and live players behind it), `RAISE_SHARE_BANDS` added to the rule
ids only when the tree is live, and a new explanation feature `ALL_IN_TREE`
(`COLLAPSED` / `LIVE`). `FACING_ALL_IN_POT_ODDS`'s rationale was rewritten: it now says it
fixes the continuing MASS only and points at the new rule for the raise question.

Legality is untouched: a raise still has to pass `canDo` (`wager !== null && !onlyAllIn`) and
`clampPostflopSizing`, so §4 of R1B's legality result still holds.

### Measured after the fix

```
3-way FLOP 7h 7d 2c, hero (BTN, 100 BB) 7s 7c, 25 BB SB shoves, 100 BB BB live:
  FOLD 0 | CALL 8500 | RAISE 1500      (ALL_IN_TREE = LIVE, FACING_ALL_IN_ISOLATION reported)
```

1500 bps, not more, because the aggression score is damped by the overbet shove it faces
(`FACED_BET_SIZE` = OVERBET) and by the multiway aggression scale — both the model working as
documented. The raise is now reachable and mixes at a real frequency; retuning the aggression
model for isolation spots was out of scope and is **not** claimed here.

Weak hand, same fixture (`6c5c`): `FOLD 10000`, no aggressive row — the collapse still happens
when the hand does not support a raise. Heads-up (the existing fixture at
`policy.test.ts` "reduces the decision to call or fold — never a raise"): unchanged, still
passing, `aggressionBps === 0`, `RAISE_SHARE_BANDS` still absent.

### Failing-test proof

Forcing `split = null` (the old behaviour) fails:

```
× never folds quads facing a shove with a deep opponent still live, and can isolate
```

### MAJOR-3 and MAJOR-5 compose

That one test asserts both halves on R1B's overlapping counterexample: `FOLD` frequency is
exactly 0 (MAJOR-3) **and** an aggressive action exists (MAJOR-5), with `ALL_IN_TREE = LIVE`.
Reverting either fix alone fails it.

---

## 3. MAJOR-4(b) — `facedBetFractionOfPot` measured hero's price, not villain's bet

### Reproduced (exactly R1B's numbers)

```
FACING_RAISE — hero bets 3000 into 5500, BB raises to 9000:
  old: call 6000 / (17500 - 6000) = 0.5217  -> SMALL   (+0 points)
  truth: 9000 into 8500            = 1.0588 -> OVERBET (-40 points)
bet-plus-caller — 3-way pot 7500, SB bets 5000, BB calls, hero to act:
  old: 5000 / (17500 - 5000)       = 0.40   -> SMALL
  truth: 5000 into 7500            = 0.667  -> MEDIUM  (-12 points)
```

(The second case uses this package's 3-way fixture, so the pot is 7500 rather than R1B's 5500;
the shape and the band error are the same, and the old value 0.40 vs the truth 0.667 is the
same defect as R1B's 0.3333 vs 0.727.)

### Fix

`postflop/spot.ts` now reads the last aggression's own record:

```ts
Money.ratio(lastAggression.amountMbb, lastAggression.potBeforeMbb)
```

`amountMbb` is the chips that wager put in and `potBeforeMbb` is the pot immediately before it,
both already on the neutral `StrategyActionRecord` — so no adapter change and ADR-0055's
one-way seam is unaffected. `Money.ratio` is the single point where money becomes a plain
number (the OUTPUT is a ratio, which rule 1 exempts); there is no `as number` cast and no raw
`-` left in the postflop package. The doc comment on the field, the `FACED_BET_SIZE_BANDS`
header and the `FACED_BET_SIZE` component rationale in both weight tables now state the correct
quantity.

MAJOR-4(a) (the money discipline) had already been fixed via `Money.sub`; that intermediate is
now gone entirely.

### Failing-test proof

The two new cases in `postflop/spot.test.ts` failed before the change with **exactly** 0.5217
and 0.40. The pre-existing single-bet case (`0.5` for a 2.75 BB bet into 5500) asserts
unchanged and still passes — the old formula was right there and still is.

---

## 4. MAJOR-2 — the worst shape, measured

### What was false

`STRATEGY_WP_B3.md` §10: *"The worst shape is a heads-up FLOP … at ~87 ms"* and §13 item 8:
*"~2.3× headroom on the worst shape"*, inherited by `STRATEGY_WP_B4.md` and propagated into two
shipped source comments. `benchmark.test.ts` defined two lineups (2- and 3-handed); the
generalisation came from a two-point sample.

### The benchmark now

`postflop/benchmark.test.ts` gains three cases — a 4-way SRP flop facing a bet, a 5-way limped
flop and a 6-way limped flop — plus two assertions that pin the corrected claim: that the 6-way
flop is slower than the HU flop (compared in-process, using the minimum of five runs so the
comparison is not a stopwatch), and that hero equity is `EXACT` heads-up and `SUBSAMPLED`
six-way.

Measured on this machine (Darwin arm64, M-series; 3 runs after a warm-up):

| shape | measured |
| --- | --- |
| HU flop | 89.6 ms |
| HU turn | 11.5 ms |
| HU river | 2.5 ms |
| 3-way flop | 42.2 ms |
| 3-way turn | 6.3 ms |
| 3-way river | 1.8 ms |
| 4-way flop (SRP, facing a bet) | 90.5 ms |
| 5-way flop (limped) | 101.1 ms |
| **6-way flop (limped)** | **106.3 ms** |

Off-table probes taken while measuring (not committed as cases): 6-way limped **monotone** flop
112.1 ms, 6-way limped flop facing a bet 107.5 ms, 6-way **SRP** flop 61.9 ms, 6-way limped turn
34.5 ms. The cost is range WIDTH × villain count on the flop, so a limped six-way pot is the
worst shape, not a heads-up one.

### Budget decision: leave the default UNTUNED

- 106–112 ms against a 200 ms interaction budget is ~1.8× headroom on this hardware — smaller
  than the claimed 2.3×, and inside the budget.
- Every `PostflopBudget` field bounds an ENUMERATION SIZE, never wall-clock time (B2's
  determinism rule). A tightened default would be deterministic and quantization-preserving, so
  tuning was available — but it would trade real accuracy (`EXACT` → `SUBSAMPLED`, a
  distinction the panel renders) for headroom the measurement does not say is needed.
- Honest caveat, stated in the code and the reports rather than papered over: a mid-range laptop
  runs 2–4× slower, which would put this shape at or past the budget. Nothing measured here can
  rule that out.
- R1B measured the same shape at 130–153 ms through the real adapter. Both numbers are recorded;
  neither is 87 ms.

### Assertions: why the new cases use a different ceiling

The existing cases keep `expect(each).toBeLessThan(200)`. The three multiway cases assert a
1000 ms smoke ceiling instead. Asserting the interaction budget on the true worst shape would
encode "this machine is fast" as a correctness property — the exact overclaim this finding is
about — while a 10× ceiling still catches a real regression. No existing assertion was weakened.

### Claims corrected

- `apps/web/src/lib/table/strategy.ts` — `ComputeStrategyOptions.budget` comment: now cites the
  in-repo measurement, the ~1.8× headroom, the laptop caveat, and why the lever stays untuned.
- `apps/web/src/components/table/StrategyPanel.tsx` — the scheduling rationale: worst case is
  now stated as ~110–150 ms on this machine class and 2–4× that on a mid-range laptop.
- `docs/reports/STRATEGY_WP_B3.md` — **appended** an `APPENDIX — correction, 2026-09-01`.
- `docs/reports/STRATEGY_WP_B4.md` — **appended** §5.5, which closes the "unbenchmarked at the
  top end" caveat §5.4 had to leave open.

Neither report was rewritten; both keep their original claims readable beside the correction.

---

## 5. MINORs — fixed, and deferred with reasons

### Fixed here

- **R1B MINOR-4** — `provenance.ts`'s module contract now states ADR-0056's definitions
  verbatim (`SOURCE` = represented by a verified public anchor, not "read out of a dataset"),
  says explicitly that a deterministic function of `HEURISTIC` inputs is `HEURISTIC`, and
  retracts the sentence claiming this package produces no strategy numbers. The
  `Provenanced<T>` type-level guarantee (mandatory note on `HEURISTIC`) is untouched.
- **R1 MINOR-4** — sizing rules and amounts are no longer reported for an answer that emits no
  sized action. `recommendPostflop` computes `sizedActionEmitted = ordered.some(a => a.sizing
  !== null)` and gates the `SIZING_*` rule ids and the `SIZING_BUCKET` / `SIZING_MODIFIER` /
  `SIZING_RULE` / `SIZING_CLAMPED` features on it. `ALL_IN_GATE` deliberately stays: it is the
  explanation OF the suppression. New test pins it.
- **R1B MINOR-9** — `HERO_EQUITY_MEASUREMENT` is now `HEURISTIC`, with the anchor line saying
  why (exact arithmetic over `HEURISTIC` ranges; no postflop anchor can source a villain range).
  The registry test's DERIVED list was updated with a comment. No output changed:
  `worstProvenance` already landed on `HEURISTIC` for every postflop answer.
- **R1B MINOR-11** — `ALL_IN_CALL_MARGIN` is declared before the band table and every edge is
  written as a multiple of it (`4×, 1×, −1×, −3×`; all exact in binary floating point, asserted).
  The number now exists once. It is also genuinely read now, via `priceImpliedContinueBps`
  consuming the table it defines.
- **R1B MINOR-8, partly** — the three items with real strategy content moved into
  `scoreModel.ts` as documented data: `UNKNOWN_SPR` (derived at module load from
  `SPR_PRESSURE_BANDS`'s own `MEDIUM` edge, so it cannot drift from the band it means) replaces
  the two undocumented `context.spr ?? 4` literals; `STREET_CHECK_THRESHOLDS` replaces the
  inline `checks >= 2` / `=== 1`; and `score.ts`'s private `FREQUENCY_STEP` / `BPS_TOTAL` copies
  are gone — it imports `BPS_TOTAL` from `bps.ts` and `FREQUENCY_STEP_BPS` from
  `preflop/recommendation.ts`, so one pair of numbers has one home. Tests pin `UNKNOWN_SPR` to
  the band edge.

### Already fixed by the earlier agents — verified, not re-done

- **MINOR-1** (short all-in counted as tree depth) — `preflop/spot.ts` now counts `isFullRaise`
  for depth and keeps `isAggressive` for "who is the aggressor".
- **MINOR-2** (raw money arithmetic) — `preflop/propagate.ts` is on `Money.max` / `Money.sub`;
  `postflop/spot.ts` was the last site and §3 removed it. A grep for `as number` in non-test
  preflop/postflop sources now returns only a comment.
- **MINOR-3** (`squeezeSizing` denominator) — `addRatioTimes` combines both parts exactly and
  rounds once.
- **MINOR-5** (the panel's cancellation claim) — the header already states the no-yield-point
  caveat; §4 only updated the latency number inside it.

### Deferred, with reasons

- **MINOR-6** (`heroVsAggressor` drives sizing multiway) — a modelling-fidelity change to
  preflop SIZING behaviour with no reproduced defect (R1B could not construct an illegal or
  absurd size, and the fuzz found none). Changing which multiplier a squeeze takes is a
  strategy decision, not a cleanup, and it belongs with whoever owns the preflop sizing rules.
- **MINOR-7** (B2's "no RNG anywhere" vs a seeded PRNG in a test) — the claim lives in
  `STRATEGY_WP_B2.md`, which is outside this work package's document boundary. Recorded here so
  the orchestrator can append a one-line note there: the shipped path has no RNG, the seeded
  mulberry32 is confined to `analysis/evaluateExhaustive.test.ts` and is deterministic.
- **MINOR-8, the remainder** — `policy.ts`'s `lineupSize >= 6 / >= 4` and
  `activeOpponentCount <= 1 / >= 2` triggers, and `sizing.ts`'s `degradeProvenance(base, 1)`.
  These select *degradation and confidence mechanics*, not strategy magnitudes, and moving them
  would touch the provenance machinery for presentation reasons alone. B3's "no constants" claim
  is corrected in its appendix rather than made true by a partial move.
- **MINOR-10** (`RAISED_TO_MINIMUM` clamps the size without touching the frequency) — the
  honest degrade B3's ADR names ("when the wanted size cannot be expressed, do not aggress")
  is a behavioural change to the aggression frequency in every min-clamped spot. It needs its
  own analysis of when a min-bet clamp should suppress rather than resize, and R1B's own
  measurement says the live gap is small. Left as a documented known limit.
- **NOTE-1 … NOTE-11** — observations, naming, and two out-of-boundary items
  (`copy.ts`'s `NOT_A_DECISION_POINT` wording, `updateSessionTable` having no caller). NOTE-9's
  dead `strongCutoffStrength` / `heroStrongShare` / `villainStrongShare` fields are the only
  ones with a latency angle; removing public fields from `NutShares` is an API change and the
  measured worst shape is inside budget without it (§4), so it was not done.

---

## 6. Cleanups

- **`PreflopPolicyContext.facingAllIn` is now required.** It was optional only so that adding it
  mid-milestone could not break a constructor outside `src/preflop/**`. Both real constructors
  always set it; the two test literals (`preflop/propagate.test.ts`,
  `postflop/spot.test.ts`) now state it, and the three `=== true` / `!== true` comparisons are
  plain boolean tests. `pnpm typecheck` is clean across all nine projects.
- **`STRATEGY_WP_A3.md`** gained a dated appendix: the SB open range is 622 combos / 46.91%
  after M1's per-class trim, not 45.10%; it is 23 offsuit classes rather than 21 and still
  inside the cross-verified 40–47% band.
- **`postflop/testQuery.ts`** gained an optional `stacksBB` per-position override, needed to
  build an honest short-shove-with-a-deep-player-behind fixture (previously every seat had the
  same stack, which cannot express that spot at all). Absent, every existing fixture is
  bit-identical: the effective stack it now derives equals the old single stack when all stacks
  are equal, and 766 tests confirm it.

---

## 7. ADR-0056 discipline

- Every emitted frequency is a multiple of 500 summing to exactly 10000 — asserted by the
  existing per-shape contract tests, which now also cover the new all-in-with-a-raise path.
- The new model values are on the grid: `priceImpliedContinueBps` returns `ALL_IN_CALL_BANDS`
  points, which `assertModel` already grid-checks; `penalizedContinueBps` only ever returns one
  of its two grid-valued inputs or their difference.
- Provenance moved in the honest direction only: one rule downgraded (`DERIVED` → `HEURISTIC`),
  one new rule added as `HEURISTIC` with `NO_ANCHOR`. No postflop rule claims `SOURCE`; the
  registry test still asserts that.
- No GTO string was introduced. The registry's "never names the reference engine GTO" test
  covers the new rule automatically.
- Public types changed additively only: `PostflopSpot.allInCollapsedTree` (a type only
  `classifyPostflopSpot` constructs), one `PostflopRuleId` member, one
  `PostflopExplanationFeatureId` member, one optional `PostflopQuerySpec` field in a test-only
  builder. The one non-additive change is `PreflopPolicyContext.facingAllIn` becoming required,
  which is the cleanup the work package asked for.

---

## 8. Files changed

| file | change |
| --- | --- |
| `src/postflop/score.ts` | `penalizedContinueBps` (MAJOR-3), `splitContinueMass`, live-tree all-in branch (MAJOR-5), `UNKNOWN_SPR` / `STREET_CHECK_THRESHOLDS` / shared bps constants (MINOR-8) |
| `src/postflop/scoreModel.ts` | `priceImpliedContinueBps`, penalty and price-table documentation, `UNKNOWN_SPR`, `STREET_CHECK_THRESHOLDS`, `ALL_IN_CALL_MARGIN`-derived band edges, `FACED_BET_SIZE` docs |
| `src/postflop/spot.ts` | `facedBetFractionOfPot` corrected (MAJOR-4b), `allInCollapsedTree` (MAJOR-5) |
| `src/postflop/rules.ts` | `FACING_ALL_IN_ISOLATION` added; `FACING_ALL_IN_POT_ODDS` and `MULTIWAY_CONTINUE_PENALTY` rationales corrected; `HERO_EQUITY_MEASUREMENT` → HEURISTIC |
| `src/postflop/policy.ts` | new rule ids and `ALL_IN_TREE` feature; sizing reported only for an emitted sized action (R1 MINOR-4) |
| `src/postflop/recommendation.ts` | `ALL_IN_TREE` feature id |
| `src/postflop/benchmark.test.ts` | 4/5/6-player cases, corrected header, worst-shape and equity-method assertions |
| `src/postflop/policy.test.ts` | the R1B counterexamples, the comparative penalty tests, the R1 MINOR-4 test |
| `src/postflop/spot.test.ts` | the two `facedBetFractionOfPot` counterexamples; `facingAllIn` in a context literal |
| `src/postflop/scoreModel.test.ts` | `UNKNOWN_SPR`, `priceImpliedContinueBps`, `ALL_IN_CALL_MARGIN` multiples; DERIVED list updated |
| `src/postflop/testQuery.ts` | optional per-position `stacksBB` |
| `src/preflop/policy.ts` | `facingAllIn` required |
| `src/preflop/propagate.test.ts` | context literal states `facingAllIn` |
| `src/provenance.ts` | contract restated per ADR-0056 |
| `apps/web/src/lib/table/strategy.ts` | comment only — corrected latency claim |
| `apps/web/src/components/table/StrategyPanel.tsx` | comment only — corrected latency claim |
| `docs/reports/STRATEGY_WP_B3.md` | appended correction appendix |
| `docs/reports/STRATEGY_WP_B4.md` | appended §5.5 |
| `docs/reports/STRATEGY_WP_A3.md` | appended SB-range correction |

---

## 9. Verification

| gate | command | result |
| --- | --- | --- |
| package tests | `pnpm vitest run --project strategy-core` | **766 passed** (31 files); baseline before this work package was 748 |
| web tests | `pnpm vitest run --project web` | **283 passed** (16 files), unchanged |
| types | `pnpm typecheck` | clean, 9 projects |
| lint (incl. layering) | `pnpm lint` | clean |
| build | `next build` (via the Playwright web server) | green |
| E2E (targeted) | `playwright test tests/e2e/strategy-panel.spec.ts tests/e2e/seat-occupancy.spec.ts` | **8 passed** |
| format | `prettier --write` on the three strategy-core files this work package left unformatted | applied (the two `apps/web` files carry pre-existing drift and were left alone — comment-only edits there are already prettier-clean) |

Per the brief, the full repo suite was not run.

---

## 10. Residual risk

1. **The multiway continue penalty is now weaker in break-even and better-than-break-even
   spots** than it was, by design. Anything at or above the price line keeps at least the
   price-implied continuing frequency. If a later review decides multiway should tighten even a
   priced-in call, the argument has to be made about the *equity model* (which already sees
   every villain range), not restored as a flat post-band subtraction.
2. **The isolation raise's frequency is the aggression model's, unexamined.** 1500 bps on the
   quads fixture is low for what is textbook a near-pure isolation, because `FACED_BET_SIZE`
   reads a shove as an overbet to raise INTO. Making the aggression model treat a raise over a
   short all-in differently is a real modelling question and was deliberately not attempted.
3. **The 200 ms budget is not proven on mid-range hardware.** §4 states the measured headroom
   and the caveat rather than asserting a ceiling that would only pass on a fast machine.
4. **MINOR-10 stands open** — a min-raise clamp still resizes without touching the frequency,
   which contradicts B3's own ADR in the small.
