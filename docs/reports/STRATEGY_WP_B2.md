# WP B2 — deterministic equity engine

**Status:** complete · **Date:** 2026-09-01 · **Package:** `packages/strategy-core/src/equity/`

Pure, deterministic equity for strategy analysis. Hero's two cards (or hero's whole range)
against one or more weighted opponent ranges, on any board from preflop to a river. **This is
analysis, never settlement** — nothing here divides a pot; `poker-core`'s settlement is
untouched and not imported.

Dependencies are `@gto-self/shared` plus this package's own `analysis/evaluate.ts`,
`analysis/heroHand.ts`, `range/combo.ts`, `range/weights.ts`, `errors.ts`. No React, no DB, no
`poker-core`.

---

## 1. Files

| File                              | Lines | Contents                                                          |
| --------------------------------- | ----: | ----------------------------------------------------------------- |
| `src/equity/model.ts`             |   121 | `EquityResult`, `EquityMethod`, `EquityBudget`, tie semantics doc  |
| `src/equity/sampling.ts`          |   172 | binomials, colex unranking, the golden-ratio Weyl sampler          |
| `src/equity/tables.ts`            |    20 | flat `COMBO_LOW`/`COMBO_HIGH` int views of `range/combo.ts`        |
| `src/equity/cache.ts`             |   104 | bounded LRU, range digest, canonical card key                      |
| `src/equity/equity.ts`            |   486 | validation + the heads-up / multiway engine                        |
| `src/equity/rangeEquity.ts`       |   476 | `rangeVsRangeEquity`, `equityDistribution`, `equityQuantile`       |
| `src/equity/strength.ts`          |   188 | made-hand strength distribution, percentiles, nut density          |
| `src/equity/index.ts`             |    61 | the subdirectory barrel (NOT wired into `src/index.ts`)            |
| `src/equity/sampling.test.ts`     |   161 | 14 tests                                                          |
| `src/equity/equity.test.ts`       |   681 | 36 tests                                                          |
| `src/equity/rangeEquity.test.ts`  |   247 | 14 tests                                                          |
| `src/equity/strength.test.ts`     |   200 | 12 tests                                                          |
| `src/equity/benchmark.test.ts`    |   145 | 6 tests (informational latency, logged not asserted)              |

**Untouched, as required:** `src/index.ts`, `src/adapter/**`, `src/preflop/**`, `src/range/**`,
`src/analysis/**`, `src/types.ts`, every other package, all root configs, `docs/STATE.md`,
`docs/DECISIONS.md`.

### ⚠ One file outside the stated boundary was edited

`packages/strategy-core/src/errors.ts` — **three lines**, adding one member to the
`StrategyErrorCode` union:

```ts
  | 'INVALID_TOTAL'
  // equity: the enumeration has nothing to enumerate
  | 'ZERO_MASS_RANGE';
```

`errors.ts` is not in the WP's forbidden list, but it IS a shared file, so it is flagged here.
The alternative was a second error vocabulary local to `equity/`, which would have contradicted
that file's own header ("the SINGLE error vocabulary for this package") and left B3 handling two
`Result` shapes. Nothing else in `errors.ts` changed; no existing code path can produce the new
code.

---

## 2. The algorithm

### 2.1 Enumeration order — runout-outer

```
for each RUNOUT r                       (cards still to come, from deck minus hero minus board)
    heroStrength = evaluateStrength(board + r + hero)                       1 evaluation
    for each villain COMBO c in the UNION of the villain ranges
        strength[c] = evaluateStrength(board + r + c)                       shared by all villains
    for each ASSIGNMENT (c_1 .. c_V), one combo per villain
        score hero against strength[c_1] .. strength[c_V]                   comparisons only
```

Runout-outer is the load-bearing choice. A villain combo's strength on a given runout does not
depend on which villain holds it or on what the others hold, so it is evaluated ONCE per runout
and reused by every assignment. Heads-up that halves the evaluation count; three-handed it turns
a cubic evaluation count into a quadratic comparison count over a linear evaluation count.

Runouts are enumerated in COLEXICOGRAPHIC order of `k`-subsets of the live deck. For `k = 2` the
colex rank is `high*(high-1)/2 + low`, which is byte-for-byte the combo-index formula already in
`range/combo.ts` — the two enumerations agree by construction, and a test asserts it over all
1326 pairs. `k = 0` (the river) has exactly ONE runout, the empty one; every count in the engine
depends on `C(n,0) = 1` rather than on a river special case.

### 2.2 Card removal, in three places

1. every villain range is `removeConflicts`ed against hero's cards and the board before
   anything is counted;
2. any assignment in which two villains hold the same card is discarded;
3. a runout colliding with an assignment's cards is skipped for that assignment.

The denominator is the weight of what was actually scored, so removal appears as a changed
weighting, never as a correction factor. A range with no live combo, or a lineup with no
conflict-free assignment, or a sample in which nothing survived, is a typed `ZERO_MASS_RANGE`
error. **There is no code path that returns NaN or a plausible-looking 0.5.**

### 2.3 Tie semantics (one rule, heads-up and multiway)

Hero's share of a showdown is

```
0                        if any villain's strength is greater than hero's
1 / (1 + tiedVillains)   otherwise
```

`winProb` is a CLEAN win (hero strictly best), `tieProb` is "hero shares the best hand with at
least one villain", `loseProb` is the rest; the three sum to 1. `equity` is the expected SHARE,
so it lies strictly between `winProb` and `winProb + tieProb` whenever `tieProb > 0`. Asserted
cases: a royal flush on the board heads-up = exactly `0.5`; the same board three-handed =
exactly `1/3`; a hero tying one of two villains = exactly `0.5`.

Weights accumulate as integers (`bps`, or the product of `bps` across villains) and become a
float only at the final division. `0.25`, `0.4`, `0.5`, `1/3` come out exact or to 12 decimals.

### 2.4 Subsampling — a golden-ratio Weyl walk, no RNG anywhere

To pick `k` of `n` items:

```
s = round(n * 0.6180339887498949), nudged up until gcd(s, n) = 1
i-th index = (i * s) mod n           accumulated as cur += s; if (cur >= n) cur -= n
indices returned SORTED ASCENDING
```

`gcd(s, n) = 1` makes the `k` indices distinct; the golden ratio makes it a low-discrepancy Weyl
sequence, so every region of the space gets its share.

**A plain stride (`floor(i*n/k)`) was rejected on purpose.** Card indices are `rank*4 + suit`, so
the two-card runout enumeration has a strong period-4 structure in the suits; a stride sharing a
factor with that period would systematically over-sample some suit patterns and quietly bias
every flush equity. A coprime, irrational-ratio stride cannot line up with any such period. A
test asserts that a 128-runout sample of the flop space still contains all 16 suit-pair patterns.

The scheme is a pure function of `(n, k)` — no seed, no clock, no machine entropy. Identical
inputs give bit-identical outputs, which is asserted for the exact, subsampled, multiway and
preflop paths.

### 2.5 Bounding rule

`EquityBudget`, all of them ceilings on ENUMERATION SIZE, never on wall-clock time (so a slow
machine returns the same answer as a fast one, just later):

| field               | default   | what it bounds                                              |
| ------------------- | --------: | ----------------------------------------------------------- |
| `maxTrials`         | 2,000,000 | `assignments x runouts`                                     |
| `maxAssignments`    |    20,000 | villain cross-product entries carried                       |
| `minRunoutSamples`  |       192 | FLOOR on runouts — spends over budget rather than estimating a flop from four runouts |
| `maxRunoutSamples`  |   100,000 | CEILING on runouts regardless of `maxTrials`                |

Applied as:

```
assignmentSpace = product of each villain's active combo count
assignments     = whole cross-product if it fits maxAssignments, else a Weyl sample of
                  maxAssignments indices decoded mixed-radix, then mutual conflicts dropped
runoutLimit     = clamp(floor(maxTrials / assignments), minRunoutSamples, maxRunoutSamples)
runouts         = whole space if it fits runoutLimit, else a Weyl sample
method          = EXACT  iff  assignments were exhaustive AND runouts were exhaustive
```

`maxRunoutSamples` exists because `maxTrials` is the wrong measure when the villain range is
tiny: a ONE-combo villain preflop makes `assignments x runouts` small while the runout space is
still 2.1M, and each runout costs an unranking plus two evaluations regardless. Without the
second ceiling, "AA against exactly KK preflop" was the slowest call in the package (4.5 s).

`minRunoutSamples` is 192, not 64, because runout subsampling is the dominant error term
(§4) while assignment subsampling is an order of magnitude smaller — when the budget must be
split, runouts are worth more than assignments.

Multiway is capped at 5 villain ranges (six-max). At 5, the cross-product index space is at most
`1225^5 ≈ 2.8e15`, which the Weyl walk handles exactly in a double (asserted by an `invariant`).

### 2.6 Range-vs-range — the shared precomputation

Looping `equityVsRange` over 1326 hero combos would re-evaluate the villain range per hero hand:
`1326 x 1081 x 1081 ≈ 1.5 billion` evaluations on a flop. Instead, per runout:

1. evaluate every villain combo once (~1081 evaluations);
2. sort those `(strength, weight)` pairs (packed as `strength * 2048 + comboIndex` into a
   `Float64Array`, so the sort is a plain numeric sort) and prefix-sum the weights;
3. per hero combo: one evaluation, then two binary searches give
   `(weight below, weight equal, weight above)` over the WHOLE villain range in `O(log n)`;
4. **subtract** the villain combos that use one of hero's two cards — at most `51 + 51 - 1 = 101`
   of them, looked up from a per-card index built once.

Step 4 is what makes the prefix sum legal: card removal is per hero combo, so the aggregate sums
are wrong by exactly the blocked combos, and subtracting 101 is far cheaper than re-summing 1081.
The result is IDENTICAL to the naive per-combo enumeration — the equivalence test asserts every
one of 1081 per-combo equities equals what `equityVsRange` reports for that combo on a river
board (agreement to 12 decimals; the measured difference was 0).

Cost is `runouts * (villainCombos + heroCombos * ~110)`, bounded by `maxOps`
(default 20,000,000) and optionally `maxRunouts`.

### 2.7 `equity` is a weighted MEAN, not a pooled ratio

`RangeEquityResult.equity` is the hero-weight-weighted mean of the per-combo equities. That is
NOT the same as the pooled `total numerator / total denominator`, because hero combos block
unequal amounts of villain weight. A uniform range against itself averages to exactly 0.5; a
lopsided range against itself does not (measured 0.564 on one fixture) even though its POOLED
ratio is exactly 0.5. Both halves of that statement are asserted in a test, and `ComboEquity`
exposes `villainWeightBps` (the per-combo denominator) so a consumer can compute the pooled
figure if it wants it. The mean is the right default: "my range's equity" is what each hand is
worth, weighted by how often I hold it.

### 2.8 Cache design

`createEquityCache(capacity = 256)` — an explicit, caller-owned, bounded LRU (`Map` insertion
order IS the recency order). **There is no default instance and no module-level cache**: a global
would be shared mutable state across callers and test files. Omit the option and no caching
happens at all.

A hit returns the exact frozen result object a miss produced — no re-derivation, no partial
storage — so a cache can change how long an answer takes and never what it is (asserted:
cached value `toBe` the first value, and `toEqual` an uncached computation).

Key = `"eq" | heroCards | boardCards | rangeDigest(s) | budget`, with cards sorted ascending
(neither hero's card order nor the board's order can change any equity — the evaluator is
order-independent and the runout deck is "all cards not already used"). Villain digests are NOT
sorted, because the mixed-radix decoding makes the SAMPLE depend on villain order once the
cross-product is sampled.

A range enters the key as a digest: two independent 32-bit FNV-1a lanes (different offset bases
and primes, one lane mixing in the index so a permutation digests differently) plus the range's
total weight and active-combo count as exact integers. ~64 hash bits plus two structural
counters, against a few hundred entries. It is still a hash and is documented as such in
`cache.ts`.

---

## 3. Latency (measured, this machine)

Darwin 25.2.0 arm64, Node under vitest, warmed up. Logged by `benchmark.test.ts`, never asserted.
Villain ranges are the full 1326-combo uniform range unless stated.

| call                              |     time | method     | runouts | trials     |
| --------------------------------- | -------: | ---------- | ------: | ---------- |
| HU river (exact)                  |   0.6 ms | EXACT      |       1 | 990        |
| HU turn (exact)                   |   7.6 ms | EXACT      |      46 | 45,540     |
| **HU flop (exact)**               |  84.7 ms | EXACT      |    1081 | 1,070,190  |
| HU flop (subsampled 128)          |   9.8 ms | SUBSAMPLED |     128 | 126,720    |
| HU flop (subsampled 256)          |  22.4 ms | SUBSAMPLED |     256 | 253,440    |
| HU flop (subsampled 512)          |  33.8 ms | SUBSAMPLED |     512 | 506,880    |
| **3-way flop (bounded, default)** |  43.4 ms | SUBSAMPLED |     192 | 2,957,538  |
| preflop HU (bounded, default)     | 113.3 ms | SUBSAMPLED |    1632 | 1,615,680  |
| preflop HU vs ONE combo, EXACT    | ~1500 ms | EXACT      | 2118760 | 1,712,304  |
| range-vs-range river (exact)      |   4.3 ms | EXACT      |       1 | 1,081      |
| range-vs-range turn (exact)       |  41.1 ms | EXACT      |      48 | 51,888     |
| **range-vs-range flop (bounded)** |  65.1 ms | SUBSAMPLED |     153 | 165,393    |
| strength distribution (flop)      |   1.3 ms | —          |       — | 1176 combos |

**The flop heads-up exact enumeration is 84.7 ms, below the WP's 120 ms threshold**, so the
default for every heads-up postflop street is EXACT and the subsampled mode is not needed there.
It is implemented and tested anyway, because multiway, preflop and range-vs-range all use the
same machinery.

The exact preflop row is what you get by raising `maxRunoutSamples` past 2.1M; it is not a
default and is only exercised by the AA-vs-KK test.

---

## 4. Measured accuracy of the subsampling

Swept over 96 (board, hero) pairs across four flops (`2c5d7s`, `AhKh7c`, `JdTd4s`, `9s9h2d`),
uniform villain range, each compared against the exact 1081-runout answer:

| runouts sampled (of 1081) | max abs error | RMS error | mean error |
| ------------------------: | ------------: | --------: | ---------: |
|                        64 |       0.06080 |   0.02480 |   −0.00003 |
|                       128 |       0.06197 |   0.01519 |   −0.00220 |
|                       256 |       0.02284 |   0.00821 |   −0.00178 |
|                       512 |       0.01947 |   0.00481 |    0.00023 |

Turn (of 46 runouts, 40 hero/board pairs): 8 → max 0.101 / RMS 0.035; 16 → 0.072 / 0.027;
24 → 0.052 / 0.016.

Preflop, AA vs exactly KK, against the exact 2,118,760-runout answer: 1,000 samples → 0.00405;
10,000 → 0.00048; 100,000 (the default) → **0.00055**.

Assignment (villain-combo) subsampling, measured on a river so the runout space is 1 and any
error is purely from sampling the range: 200 of 1081 combos → max 0.0062; 1000 of 1081 → 0.00000.
**Assignment subsampling is roughly an order of magnitude more accurate than runout subsampling
at the same sample fraction**, which is why `minRunoutSamples` was raised to 192 and
`maxAssignments` lowered to 20,000.

Two properties worth stating plainly:

- the error is UNBIASED (mean ≈ 0 across the sweep) but it is not small for an individual
  high-variance holding at low runout counts — a gutshot on a dry flop can be 5 points off at 64
  runouts;
- errors at 64 / 128 / 256 are strongly correlated, because a Weyl sample of `k` is a prefix of
  the sample of `2k`. Do not read "the 128 answer agrees with the 64 answer" as convergence.

The tests assert `|error| < 0.05` at 256 runouts and `< 0.04` at 512 for four fixed hero hands —
roughly 2x the measured maxima, so they are regression guards rather than restatements of today's
output.

---

## 5. Verification of correctness — how each expectation was derived

| test | independent source of the expected value |
| ---- | ----------------------------------------- |
| AA vs exactly KK on a river | trivially by hand: aces beat kings, one runout, one combo |
| 75/25 two-combo river range | arithmetic on paper: `0.25 * 1 + 0.75 * 0` |
| three-combo river range with a chop | `0.30 + 0.20/2 = 0.40` exactly |
| hero holds the nuts on a river | must be exactly 1 against ANY range |
| board is a royal flush | everyone plays the board: exactly `0.5` heads-up, exactly `1/3` three-handed |
| hero ties one of two villains | exactly `0.5` |
| card removal | a villain range half made of hero's own combo scores only the other half; a range entirely blocked is `ZERO_MASS_RANGE` |
| **turn, full uniform range** | a naive reference written IN the test: every river card x every combo, best five of seven by `bestFiveOf`'s explicit `C(7,5)` enumeration. Agrees to 12 decimals |
| turn, weighted range, paired board | same naive reference |
| **preflop AA vs KK** | a five-deep nested loop over all `C(48,5) = 1,712,304` boards written IN the test. Agrees to 12 decimals; also 1,712,304 = the engine's own trial count, which cross-checks the runout-skipping |
| multiway 3-way river | enumerated by hand in the test comment, two legal assignments |
| villain-vs-villain conflicts | `{KdKc, 3h3s} x {KdQd, 3d3c}` → the Kd clash drops one of four; hero wins 2 of the surviving 3 |
| range-vs-range per-combo | must equal `equityVsRange` for the same combo — 1081 combos checked, all to 12 decimals |
| uniform range against itself | must be exactly 0.5 by antisymmetry |
| colex unranking | compared against nested-loop enumerations for `k = 2, 3` and against `range/combo.ts`'s index formula for all 1326 pairs |

One expectation I wrote was wrong and the test caught it (`KdQd` is only king-high on
`2c 5d 7s 9h Jc`, so hero's eights beat it) — the comment and the number were corrected together
rather than the assertion weakened.

---

## 6. API summary for B3

```ts
// heads-up and multiway, hero's two cards vs weighted ranges
equityVsRange(heroCards, board, villain, options?)   -> StrategyResult<EquityResult>
equityVsRanges(heroCards, board, villains[], options?) -> StrategyResult<EquityResult>

EquityResult {
  winProb, tieProb, loseProb, equity,        // 0..1 floats; win+tie+lose = 1
  method: 'EXACT' | 'SUBSAMPLED',
  evaluatedRunouts, runoutSpaceSize,
  evaluatedTrials, assignmentCount, assignmentSpaceSize,
  villainCount, scoredWeight
}
EquityOptions = Partial<EquityBudget> & { cache?: EquityCache }
EquityBudget  = { maxTrials, maxAssignments, minRunoutSamples, maxRunoutSamples }
DEFAULT_EQUITY_BUDGET, MAX_VILLAIN_RANGES (5)

// hero's whole range vs a villain range, one shared pass
rangeVsRangeEquity(heroRange, villainRange, board, options?) -> StrategyResult<RangeEquityResult>
RangeEquityResult { equity, winProb, tieProb, loseProb, perCombo[], method,
                    evaluatedRunouts, runoutSpaceSize, evaluatedTrials,
                    heroComboCount, villainComboCount, heroWeightBps }
ComboEquity      { combo, weightBps, winProb, tieProb, loseProb, equity, villainWeightBps }
RangeEquityOptions { maxOps?, maxRunouts?, cache? }

// the same computation re-presented as a distribution + a quantile lookup
equityDistribution(heroRange, villainRange, board, options?) -> StrategyResult<EquityDistribution>
EquityDistribution { entries[] (desc by equity), cumulativeBps[], aggregate }
equityQuantile(dist, equity) -> number    // weighted share of hero's range at or above `equity`

// the CHEAP one: current made-hand strength, ~1326 evaluations, no runouts
buildStrengthDistribution(range, board, { nutStrength? }) -> StrategyResult<StrengthDistribution>
StrengthDistribution { board, nutStrength, totalWeightBps, entries[] (desc), cumulativeBps[] }
strengthPercentile(dist, strength)      // fraction of the range this strength beats, ties half
comboStrengthPercentile(dist, combo)    // undefined when the combo is not in the range
weightAtOrAboveBps(dist, strength) / weightAtBps(dist, strength)
nutDensity(dist)                        // share of the range holding THE NUTS

// caching (explicit, bounded, caller-owned — there is no global)
createEquityCache(capacity = 256) -> EquityCache   // .get/.set/.size()/.clear()/.stats()
rangeDigest(range), cardsKey(cards)

// combinatorics, exported because they are the sampling contract
binomial, combinationCount, unrankColex, weylIndices, indexSample, WEYL_RATIO
```

**Guidance for the postflop policy WP:**

1. **Use `buildStrengthDistribution` for anything you need per-combo in bulk.** It is 1.3 ms for
   a full range on a flop; `rangeVsRangeEquity` is 65 ms. Nut density, "where does this hand sit
   in my range", value/bluff thresholds — all of those are strength questions, not equity
   questions.
2. **Pass `nutStrength` when you build more than one distribution on the same board.** B1's
   warning applies: `nutStrengthOnBoard` costs ~1100 evaluations and depends only on the board.
3. **Never loop `equityVsRange` over a range** — `rangeVsRangeEquity` exists precisely for that
   and is ~20x faster; the two are proven identical on the river.
4. **Always read `method`.** A `SUBSAMPLED` number must be labelled in the UI. Do not present it
   the same way as an `EXACT` one.
5. **Create ONE `EquityCache` per analysis session and thread it through.** It is a plain object;
   it holds nothing global.

---

## 7. Verification

| Gate                                                 | Result                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `pnpm vitest run --project strategy-core`            | **PASS** — 22 files, **438 tests** (356 pre-existing + 82) |
| ... of which `src/equity/**`                         | **PASS** — 5 files, **82 tests**                          |
| `pnpm typecheck` (all 9 projects)                    | **PASS**                                                  |
| `npx eslint packages/strategy-core --max-warnings=0` | **PASS** — 0 errors, 0 warnings                           |
| `prettier --write` on my 13 files + `errors.ts`      | applied (repo-wide format NOT run)                        |

Per file: `equity.test.ts` 36, `sampling.test.ts` 14, `rangeEquity.test.ts` 14,
`strength.test.ts` 12, `benchmark.test.ts` 6.

Not run, per the WP's instruction: the repo-wide suite and E2E.

---

## 8. Risks and notes for the orchestrator

1. **`src/index.ts` was not touched.** Nothing in `equity/` is exported from the package barrel.
   The names to add are in §6; `src/equity/index.ts` already groups them.
2. **`errors.ts` gained one code.** See the flag in §1. If the orchestrator would rather this
   lived elsewhere, the change is three lines to revert plus a local error type in `equity/`.
3. **Preflop is supported and ALWAYS `SUBSAMPLED` by default.** I chose a bounded deterministic
   estimate over a typed `UNSUPPORTED`, because "no number" is worse for the user than "a
   reproducible estimate, labelled". Measured default error is 0.00055 for a single-combo villain
   at 100k of 2.1M runouts. **The UI must show the `SUBSAMPLED` label.** If the orchestrator
   prefers the WP's other option, deleting preflop support is a validation change, not an
   algorithm change.
4. **A single high-variance holding at a low runout count can be several points off.** §4 has the
   numbers. This is only reachable on a flop when the caller lowers the budget, and multiway,
   where 192 runouts is the default floor. Multiway flop equity should be read as "±2 points",
   not as a solved number.
5. **Determinism is defined as "same inputs, same enumeration order, same floating-point
   operations".** It holds across runs and processes on the same platform (asserted). It is not a
   claim of bit-identity across architectures with different FP behaviour, though IEEE-754 double
   arithmetic in the order used here should give that too.
6. **The cache key uses a hash for the range.** Two 32-bit FNV lanes plus exact total weight and
   active count. A collision would return a wrong (but well-formed) answer. The probability is
   negligible at a few-hundred-entry capacity, but it IS the one place in this WP where a wrong
   number is theoretically reachable, so it is called out rather than buried.
7. **`equity` on `RangeEquityResult` is a weighted mean, not a pooled ratio** (§2.7). A consumer
   that wants the pooled figure must compute it from `perCombo[].villainWeightBps`. Getting this
   backwards would produce plausible-looking but wrong range equities.
8. **The engine does not model correlation between villain ranges.** Multiway treats the ranges
   as independent priors and only enforces card removal between them. That is the honest limit of
   what this layer knows; anything more belongs to whatever builds the ranges.
9. **No ADR seems needed.** Every poker rule encoded is a standard showdown rule. The two
   judgement calls — supporting preflop as a labelled estimate (note 3) and defining range equity
   as a weighted mean (note 7) — are documented at their definitions and in this report. If the
   orchestrator disagrees with either, those are the ADR-worthy items.
