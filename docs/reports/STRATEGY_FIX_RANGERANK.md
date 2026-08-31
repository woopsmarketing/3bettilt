# STRATEGY_FIX_RANGERANK — R1 MINOR-2, MINOR-3, MINOR-12

Small final fix package. Two independent defects, both from `docs/reports/STRATEGY_REVIEW_R1.md`:

- **FIX 1** — `rangeRank` ranked two different kinds of equity inside one distribution
  (MINOR-2), and the distribution's per-combo precision was defended by a doc comment that
  only covers the aggregate (MINOR-3).
- **FIX 2** — the seat occupancy toggle claimed a re-activation had already taken effect
  (MINOR-12).

Nothing else was touched. No public type was removed; two fields and one explanation feature
were added.

---

## FIX 1 — the `rangeRank` basis

### The defect, reproduced

`postflop/context.ts:237` (pre-fix):

```ts
const rankBasis = heroEntry?.equity ?? heroEquityResult.value.equity;
const rangeRank = 1 - equityQuantile(distribution.value, rankBasis);
```

`distribution` is hero's whole range against the **primary villain** alone. Every number in it
is a pairwise equity. `heroEntry.equity` is one of those numbers; `heroEquityResult.value.equity`
is hero's **pooled equity against the whole field**, a different quantity that is systematically
lower multiway. The fallback fires exactly when hero's actual combo carries no weight in hero's
own propagated range — reachable whenever the user enters a hand the reference policy would not
have played, which `CLAUDE.md` rule 3 guarantees stays reachable.

Measured before the fix (BTN, `Ah7d2c`, three-way, BTN opens and both blinds call):

| hero  | in own range | pooled vs field | pairwise vs primary | rank ranked as pooled (defect) | rank ranked as pairwise (coherent) |
| ----- | ------------ | --------------- | ------------------- | ------------------------------ | ---------------------------------- |
| `2h2s` | no          | 0.8874          | 0.9551              | **0.9467**                     | **0.9882**                         |
| `8c4d` | no          | 0.0504          | 0.1104              | **0.0000**                     | **0.0730**                         |
| `AcQs` | yes         | 0.7710          | 0.8682              | 0.9191                         | 0.9191 (same path)                 |

R1's own numbers, recomputed from the engine. `RANGE_RANK_BANDS` bands are 11-14 points wide
and the component carries weight 2 of 26, so a 0.04 rank error is worth up to ~6.5 score points —
enough to cross a band, which is what R1 reported.

### The basis that was chosen

> **`rangeRank` ranks hero's actual combo's equity against the PRIMARY VILLAIN's range, inside
> the distribution of hero's own range against that same villain. Pairwise on both sides, in
> every case, with no exceptions.**

Why pairwise rather than whole-field on both sides: the distribution is what makes a quantile
possible at all, and building a *field* distribution would mean running the multiway engine
once per hero combo — the single most expensive thing in the package, times 1326. It is also
the same choice `RANGE_ADVANTAGE_MEASUREMENT` and `NUT_ADVANTAGE_MEASUREMENT` already make
(`primaryVillainOf` exists for exactly this reason), so the three range-level measurements now
agree about who the opponent is. `HERO_EQUITY` is the one measurement that is deliberately
pooled, and it has its own documented multiway rescaling.

There is now **no fallback that substitutes a different quantity**. When hero's combo is absent
from the distribution, the same quantity is computed directly:

| situation                                   | how the ranked value is obtained                          | extra cost |
| ------------------------------------------- | --------------------------------------------------------- | ---------- |
| hero's combo has weight in hero's range      | its entry in the distribution (`RANGE_DISTRIBUTION`)       | none       |
| it does not, and the lineup is heads-up      | `equityVsRanges` already computed it (`EXACT_PAIRWISE_PROBE`) | none    |
| it does not, multiway                        | one `equityVsRange` vs the primary villain (`EXACT_PAIRWISE_PROBE`) | measured below |

The heads-up branch is why the old code was *accidentally* correct heads-up: with one villain
the field IS the primary villain, so the substituted number was already the right one. That is
now stated rather than relied on, and heads-up output is bit-identical to before.

`PostflopContext` gained `rangeRankEquity` (the value that was ranked) and `rangeRankBasis`
(`'RANGE_DISTRIBUTION' | 'EXACT_PAIRWISE_PROBE'`). `heroComboInRange` is unchanged.

### Latency (Darwin arm64, M-series, mean of 3 after a warm-up)

`buildPostflopContext` end to end, so the number includes everything:

| shape                          | hero    | in range | basis                 | total    |
| ------------------------------ | ------- | -------- | --------------------- | -------- |
| 3-way flop `Ah7d2c`            | `AcQs`  | yes      | RANGE_DISTRIBUTION    | 42.4 ms  |
| 3-way flop `Ah7d2c`            | `2h2s`  | no       | EXACT_PAIRWISE_PROBE  | 48.5 ms  |
| 3-way flop `Ah7d2c`            | `8c4d`  | no       | EXACT_PAIRWISE_PROBE  | 47.8 ms  |
| 6-way limped flop (worst shape) | `AcQs` | yes      | RANGE_DISTRIBUTION    | 106.0 ms |
| 6-way limped flop              | `8c4d`  | yes      | RANGE_DISTRIBUTION    | 108.8 ms |
| 6-way limped flop              | `9d4h`  | yes      | RANGE_DISTRIBUTION    | 108.3 ms |
| 6-way limped flop              | `Jc3d`  | yes      | RANGE_DISTRIBUTION    | 112.0 ms |

**The probe costs ~6 ms and never fires on the worst shape.** The two costs are
anti-correlated by construction: the shape that is expensive to enumerate is expensive
*because* every villain range is the widest the model has, and a lineup that wide reaches the
flop through limps — which means hero's own range is wide too and contains whatever hero
actually holds, so the probe never runs. The probe only fires on a narrow range (an RFI or a
3-bet), where the villain range it enumerates against is narrow and the call is cheap. The
isolated call was measured separately at 4.5 ms three-way, 26.9 ms heads-up (a branch that
cannot execute) and 69.2 ms against a six-way limp range (a branch that cannot execute either).

Worst observed total is 112.0 ms, unchanged from the pre-fix 106-112 ms band for that shape;
the benchmark's ~200 ms interaction budget is not approached by anything this fix adds.

### MINOR-3 — precision, made visible instead of hidden

The distribution's per-combo equities are coarse under `DEFAULT_RANGE_EQUITY_MAX_OPS`
(153 of 1176 flop runouts). Measured on a full-range flop (`Ah7d2c`, uniform vs uniform)
against the same call at `maxOps: MAX_SAFE_INTEGER`:

- max per-combo equity error **0.0541** (R1 measured 0.0559 — same measurement, and the
  aggregate error stays at ~0.0006, which is what the doc comment used to defend);
- max rank error **0.1207** when the ranked value comes from the same subsample (R1: 0.1267);
- max rank error **0.0374** when the ranked value is exact.

Two things follow, and both are now written down rather than left to the reader:

1. The budget's doc comment on `DEFAULT_RANGE_EQUITY_MAX_OPS` now states what the budget is
   and is *not* accurate for — aggregate versus a single combo versus a quantile — with these
   numbers, and says that a caller consuming a single combo must carry `SUBSAMPLED` through.
2. `equityQuantile`'s doc states the contract the old fallback broke: the value passed in must
   be the same kind of equity as the distribution's entries, and the distribution carries no
   opponent identity so it cannot check.

The budget itself was **not** raised. Making the flop distribution exact costs ~490 ms for one
call, which is the whole interaction budget twice over; and the third measurement above shows
the coarse *distribution* contributes far less rank error than a coarse *ranked value* did, so
the exact probe already removes the larger half of the error on the path where it mattered.

Visibility, per the R1 note that `SUBSAMPLED` does not travel with `rangeRank`: the ranking
distribution's method is already reported unconditionally through the `EQUITY_METHOD`
explanation feature (`HERO/RANGE`, e.g. `EXACT/SUBSAMPLED`) and through the `EQUITY_SUBSAMPLED`
rule id whenever either equity is subsampled. No new UI was invented; instead
`RANGE_PERCENTILE_MEASUREMENT`'s rationale — which `policy.ts` copies verbatim into
`provenance.notes`, so it is user-facing honesty text — now says that the rank is a quantile
inside a distribution that is subsampled on the flop and turn, and where to read that off. A
test pins that pairing.

### Rule documentation

`RANGE_PERCENTILE_MEASUREMENT` (`postflop/rules.ts`) now states, in the rationale the UI
shows: the pairwise-on-both-sides basis and the measured cost of getting it wrong; the
fallback **explicitly** (R1 noted its absence), including that it is exact and that heads-up
it changes nothing; and the subsampled-distribution precision with its numbers.

### Confidence was deliberately not degraded

R1's requirement is to degrade honestly *if the consistent quantity cannot be computed*. It
can be, exactly, on every postflop street, so there is nothing to apologise for and no
confidence step was added — inventing one would have made the fixed path look worse than the
broken one. What the situation does get is a report: `RANGE_RANK_BASIS` is pushed into the
explanation with the probe's value, and only when the unusual basis was used. Note also that
`ranges.anyOffPolicy` does **not** fire in this case (measured: `heroOffPolicy=false` for
`2h2s` three-way) — hero's LINE is on-policy, it is his HOLDING that his own range gives no
weight — so no existing flag covered it and the new feature is the only signal.

---

## FIX 2 — the asymmetric pending label (MINOR-12)

`seatOccupancyToggleState('ACTIVE', true)` returned `'끔'`: a seat toggled back ACTIVE mid-hand
read as already in effect. It is not — `setSeatOccupancy` writes the table, and a live hand is
a fold over its own event log that never re-reads it, so re-activation lands on the next deal
exactly as sitting out does. Both directions now say `'다음 핸드부터'`.

Two halves, because the label alone would have been dead code:

1. **Copy** (`apps/web/src/lib/table/copy.ts`). The inline ternaries are gone; the strings live
   in `SEAT_OCCUPANCY_TOGGLE_STATE`, an exhaustive
   `Record<SeatOccupancy, Record<SeatOccupancyToggleTiming, string>>` over both occupancies and
   both timings (`IN_EFFECT` / `NEXT_HAND`), so a new occupancy member is a compile error.
   `EMPTY` is carried for exhaustiveness and never renders. No other Record was touched.
2. **The flag** (`apps/web/src/components/table/TableRoot.tsx`). `pending` used to be
   `view.seats[seat].status !== 'NOT_DEALT_IN'` — "is this seat still dealt in", which is only
   the sit-out direction. A re-activated seat is *not* dealt in, so the flag was false and the
   label had no chance. It is now a named helper, `seatOccupancyPending`, which asks whether the
   live hand's lineup **disagrees** with the stored occupancy in either direction:

   ```ts
   if (view === null || view.phase.kind === 'COMPLETE') return false;
   const dealtInThisHand = view.seats[seat].status !== 'NOT_DEALT_IN';
   const wantsToBeDealtIn = occupancy === 'ACTIVE';
   return dealtInThisHand !== wantsToBeDealtIn;
   ```

A COMPLETE hand still holds nothing up: the next `startHand()` reads the new occupancy.

---

## Tests

### New / changed

| file                                                         | added | what it pins |
| ------------------------------------------------------------ | ----- | ------------ |
| `packages/strategy-core/src/postflop/rangeRank.test.ts` (new) | 11    | R1's three-way counterexample in both directions, the ordinary path, heads-up unchanged, determinism, the explanation feature, the SUBSAMPLED pairing |
| `apps/web/src/lib/table/copy.test.ts`                         | +1, 1 rewritten | both timings for both occupancies; every state label non-empty |
| `apps/web/src/components/table/SeatOccupancyToggle.test.tsx`  | +1    | a re-activated seat renders 다음 핸드부터, and still reads as not-sitting-out |
| `apps/web/src/components/table/TableRoot.test.tsx`            | +2    | the real store/engine round trip: sit out → next hand → re-activate mid-hand; and the settled case |

The strategy-core tests assert the counterexample against values **recomputed from the equity
engine in the test** (`equityVsRange` vs the primary villain, `equityVsRanges` vs the field),
not pasted constants, so they fail if the ranges or the engine move rather than drifting
silently. Two of them also assert `heroComboInRange === false` up front, so if a future range
edit puts `2h2s` or `8c4d` into BTN's opening range the suite says the fallback is no longer
under test instead of passing vacuously.

### Failing-on-revert proof

Each behavioural change was reverted in place and the tests re-run.

**Revert A — `rangeBasis = heroEntry?.equity ?? heroEquityResult.value.equity`** (the R1 line):
4 failed / 7 passed.

```
× 2h2s ranks the pairwise equity, not the pooled one
    AssertionError: expected 0.8873746545426487 to be 0.9550974864928353
× 8c4d ranks the pairwise equity, not the pooled one
    AssertionError: expected 0.05042756460172858 to be 0.11041490075580984
× reports the direction of the correction: the defect ranked hero too low
    AssertionError: expected 0.9467455621301775 to be less than 0.9467455621301775
× names the unusual basis in the explanation, and stays quiet on the ordinary one
    AssertionError: expected 0.8873746545426487 to be 0.9550974864928353
```

**Revert B — the old `seatOccupancyToggleState` body** (`if (occupancy !== 'SITTING_OUT') return '끔'`):
3 failed / 62 passed.

```
× copy.test.ts        > says "next hand" in BOTH directions while a live hand disagrees with the seat
× SeatOccupancyToggle > says "다음 핸드부터" for a re-activated seat the current hand skipped
× TableRoot           > says "다음 핸드부터" for a RE-ACTIVATION mid-hand too, not "끔"
```

**Revert C — the old `pending` expression** (`view.seats[seat].status !== 'NOT_DEALT_IN'`, label
fix kept): 2 failed / 43 passed.

```
× TableRoot > says "다음 핸드부터" for a RE-ACTIVATION mid-hand too, not "끔"
× TableRoot > drops the pending label once a seat and the live hand agree again
```

All three reverts were restored from a byte-for-byte backup afterwards.

### Verification

| gate                                   | result                          |
| -------------------------------------- | ------------------------------- |
| `pnpm vitest run --project strategy-core` | **777 passed** / 32 files    |
| `pnpm vitest run --project web`        | **287 passed** / 16 files       |
| `pnpm typecheck`                       | clean, all 9 projects           |
| `pnpm lint`                            | clean (layering rules included) |

No existing fixture needed its expected values changed: every multiway fixture in the suite
holds a combo that is in hero's own range, and heads-up is bit-identical by construction. The
worked example (`workedExample.test.ts`, `rangeRank` 0.90532544) is heads-up and unmoved.

Prettier: only the lines this change introduced were formatted. Four of the touched files carry
pre-existing formatting drift (`copy.ts`, `TableRoot.test.tsx`, `SeatOccupancyToggle.tsx`,
`SeatOccupancyToggle.test.tsx`); it was left alone rather than swept into this diff.

---

## Files changed

| file | change |
| ---- | ------ |
| `packages/strategy-core/src/postflop/context.ts` | the basis; `RangeRankBasis`, `rangeRankEquity`, `rangeRankBasis`; module note on the conditional fourth call |
| `packages/strategy-core/src/postflop/rules.ts` | `RANGE_PERCENTILE_MEASUREMENT` rationale: basis, fallback, precision |
| `packages/strategy-core/src/postflop/recommendation.ts` | `RANGE_RANK_BASIS` feature id |
| `packages/strategy-core/src/postflop/policy.ts` | emits it, only on the unusual basis |
| `packages/strategy-core/src/equity/rangeEquity.ts` | doc only: budget accuracy per-combo/quantile, `equityQuantile`'s same-kind contract |
| `packages/strategy-core/src/postflop/rangeRank.test.ts` | new |
| `apps/web/src/lib/table/copy.ts` | `SEAT_OCCUPANCY_TOGGLE_STATE`, `SeatOccupancyToggleTiming`, symmetric label |
| `apps/web/src/components/table/TableRoot.tsx` | `seatOccupancyPending` helper, wired at the call site |
| `apps/web/src/components/table/SeatOccupancyToggle.tsx` | doc only |
| `apps/web/src/lib/table/copy.test.ts`, `SeatOccupancyToggle.test.tsx`, `TableRoot.test.tsx` | tests |

## Remaining risk

- The rank is still a quantile inside a **subsampled** distribution on the flop and turn
  (max 0.0374 with an exact ranked value). Reported, not fixed: making it exact costs ~490 ms.
- `EXACT_PAIRWISE_PROBE` is exercised by tests only on a three-way flop. Its cost on a turn or
  river is strictly lower (fewer runouts), and heads-up it does not run at all, so the flop
  measurement is the ceiling.
- `RANGE_RANK_BASIS` is emitted but nothing in the web UI renders it yet; it reaches a reader
  through the structured explanation only.
