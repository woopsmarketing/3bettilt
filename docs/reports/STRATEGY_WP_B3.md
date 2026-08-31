# WP B3 — the postflop REFERENCE policy

`packages/strategy-core/src/postflop/**`

**Status: complete.** 252 new tests, 690 green in `strategy-core` (438 pre-existing + 252),
`pnpm typecheck` clean across all 9 projects, `eslint packages/strategy-core/src` clean at
`--max-warnings=0`.

`recommendPostflop(query, budget?)` answers a FLOP / TURN / RIVER `StrategyQuery` with the same
recommendation shape preflop uses: legal actions with integer-bps frequencies on the 5-point
grid summing to exactly 10000, a primary action under A3's tie-break, a size drawn from a fixed
bucket ladder and converted to a legal integer-milliBB bet-TO / raise-TO, metrics, provenance
under ADR-0056, and a structured (never generated) explanation.

**It is never GTO.** `label` is the constant `'REFERENCE'`; user-facing name 기본전략 · REFERENCE.
Two greps assert it: `policy.test.ts` and `workedExample.test.ts` each serialize a whole
recommendation and assert `not.toMatch(/GTO/i)`.

---

## 0. Read this first — the one edit outside the boundary

### ⚠️ `src/preflop/recommendation.ts` WAS EDITED

The brief permitted "MINIMAL generalizing edits ONLY if the type is preflop-hardcoded". Six such
edits were made. **All are type-level except one**, none change preflop behaviour, and all 438
pre-existing tests remain green.

| # | Edit | Was | Now | Behavioural? |
|---|------|-----|-----|--------------|
| 1 | `ACTION_COMMITMENT_ORDER` | `FOLD, CHECK, CALL, RAISE, ALL_IN` | `FOLD, CHECK, CALL, **BET**, RAISE, ALL_IN` | **The only non-type edit.** `BET` is inserted between `CALL` and `RAISE`. `BET` never occurs preflop, so the *relative* order of the five preflop members — and therefore every preflop tie-break and every preflop sort — is unchanged. A doc comment on the constant says exactly this. |
| 2 | `RecommendedSizing` | concrete `PreflopRuleId` | `<RuleId extends string = PreflopRuleId>` | no |
| 3 | `RecommendedAction` | concrete | `<RuleId extends string = PreflopRuleId>` | no |
| 4 | `RecommendationProvenance` | concrete | `<RuleId extends string = PreflopRuleId>` | no |
| 5 | `ExplanationFeature` / `StrategyExplanation` | concrete `ExplanationFeatureId` | `<Id extends string = ExplanationFeatureId>` | no |
| 6 | `pickPrimaryAction`, `sortActions`, `feature` | concrete parameter types | generic over a structural constraint | no |

Every default type argument is the original concrete type, so every existing preflop call site
and every existing preflop type reads identically.

**Why it was necessary rather than convenient:** there must be exactly ONE frequency
quantizer, ONE primary-action tie-break, ONE clamp convention and ONE provenance algebra in this
package. Copying them into `postflop/` would have created the second system CLAUDE.md §7 forbids,
on a money-adjacent path. Generalizing the types was the smaller change.

### One duplication that should be removed later

`postflop/policy.ts` contains a private `environmentCompatibility(query)` that **mirrors
`preflop/policy.ts`'s private function of the same name**. `preflop/policy.ts` was outside this
work package's edit boundary, so the alternatives were to duplicate it or to leave
`provenance.environmentCompatibility` unpopulated on every postflop answer. A comment at the
function flags this. **Orchestrator action: export the preflop one and delete this copy.**

---

## 1. Files

### Model and engine (created)

| File | Lines | What it is |
|------|------:|------------|
| `postflop/scoreModel.ts` | 1003 | **The entire model, as exported data.** Every weight, threshold, point value, band edge, sizing rung and cap, each with a per-entry rationale. Self-checks at module load (`assertModel`). |
| `postflop/rules.ts` | 467 | The 41-entry provenance registry: `id`, `provenance`, `anchor`, `inputs`, `rationale`. |
| `postflop/spot.ts` | 204 | `classifyPostflopSpot` — family, pot type, initiative, relative position, faced-bet fraction. |
| `postflop/ranges.ts` | 242 | The villain/hero range model over A3's `propagatePreflopRanges`. |
| `postflop/context.ts` | 298 | The measurement layer: three expensive B2 calls and nothing else. |
| `postflop/score.ts` | 663 | Arithmetic on the model. **No constants.** |
| `postflop/sizing.ts` | 253 | Bucket selection, pot-fraction → milliBB, clamp-and-degrade. |
| `postflop/recommendation.ts` | 172 | The answer's shape. |
| `postflop/policy.ts` | 711 | Assembly: buckets → legal kinds, quantize, tie-break, rule ids, explanation. |
| `postflop/index.ts` | 81 | Public surface. `src/index.ts` was **not** touched (equity's precedent). |
| `postflop/testQuery.ts` | 372 | TEST-ONLY query builder with multi-street replay. Not exported from `index.ts`. |

### Tests (created)

| File | Tests |
|------|------:|
| `postflop/scoreModel.test.ts` | 63 |
| `postflop/spot.test.ts` | 30 |
| `postflop/sizing.test.ts` | 25 |
| `postflop/policy.test.ts` | 86 |
| `postflop/workedExample.test.ts` | 39 |
| `postflop/benchmark.test.ts` | 9 |
| **total** | **252** |

### Modified

- `src/preflop/recommendation.ts` — see §0.

Nothing else was touched: not `src/index.ts`, not another package, not a root config, not
`docs/STATE.md`, not `docs/DECISIONS.md`.

---

## 2. The scoring model

`score = round( Σ wᵢ·pointsᵢ / Σ wᵢ )` — a **weighted mean**, so the score lives on the same
−100..+100 scale as its components and adding a component does not silently rescale the bands.

### 2.1 No single-feature advice, structurally

The heaviest aggression component carries **3 of 26** total weight (11.5%). A component spans at
most ~200 points, so no single measurement can move the score by more than ~23 points out of the
~66-point finite band span — never enough to cross from `GIVE_UP` to `DOMINANT` alone. "Top pair
therefore bet" is *unrepresentable*. `MAX_SINGLE_COMPONENT_WEIGHT_SHARE = 0.3` is asserted at
module load and by test.

### 2.2 Aggression components (total weight 26)

| Component | Weight | Measures |
|-----------|-------:|----------|
| `HAND_STRENGTH` | 3 | B1 `madeClass` + nuts / weak-kicker / plays-the-board adjustments |
| `HERO_EQUITY` | 3 | B2 hero's actual two cards vs every live villain range |
| `RANGE_ADVANTAGE` | 2 | B2 hero range vs primary villain range, minus 0.5 |
| `NUT_ADVANTAGE` | 2 | nut-share difference (§5) |
| `RANGE_RANK` | 2 | hero's hand's percentile inside hero's OWN range |
| `DRAW_QUALITY` | 2 | B1 draws, additive, capped |
| `BLOCKER_QUALITY` | 1 | B1 blockers, additive, capped |
| `POSITION` | 2 | IP / OOP |
| `INITIATIVE` | 2 | previous-street aggressor + current-street aggressor |
| `BOARD_TEXTURE` | 1 | B1 STATIC / SEMI_DYNAMIC / DYNAMIC, read as protection value |
| `SPR_PRESSURE` | 1 | SPR |
| `MULTIWAY` | 2 | live opponent count |
| `FACED_BET_SIZE` | 1 | bet faced as a fraction of pot |
| `POT_TYPE` | 1 | LIMPED / SRP / 3-bet / 4-bet+ |
| `STREET_ACTION` | 1 | checks to hero this street |

### 2.3 Continue components (total weight 14) — only when facing a bet

| Component | Weight |
|-----------|-------:|
| `POT_ODDS_MARGIN` | 4 |
| `HAND_STRENGTH` | 2 |
| `DRAW_QUALITY` | 2 |
| `BLOCKER_QUALITY` | 1 |
| `RANGE_RANK` | 1 |
| `POSITION` | 1 |
| `MULTIWAY` | 2 |
| `FACED_BET_SIZE` | 1 |

### 2.4 Component point tables

**`HAND_STRENGTH_POINTS`** (by B1 `MadeHandClass`)

| Class | pts | Class | pts | Class | pts |
|---|--:|---|--:|---|--:|
| STRAIGHT_FLUSH | 100 | TRIPS | 70 | BOTTOM_PAIR | −10 |
| QUADS | 100 | TWO_PAIR | 60 | ACE_HIGH | −30 |
| FULL_HOUSE | 92 | OVERPAIR | 55 | BOARD_PAIR | −35 |
| SET | 88 | TOP_PAIR | 40 | NO_MADE_HAND | −45 |
| FLUSH | 82 | MIDDLE_PAIR | 5 | | |
| STRAIGHT | 76 | UNDERPAIR | −5 | | |

Adjustments: `NUTS_BONUS +12`, `WEAK_KICKER_PENALTY −10` (paired hands only),
`PLAYS_THE_BOARD_PENALTY −25`.

**`HERO_EQUITY_BANDS`** — 0.80 → 80 `CRUSHING` · 0.65 → 55 `STRONG` · 0.55 → 30 `AHEAD` ·
0.45 → 5 `EVEN` · 0.35 → −20 `BEHIND` · 0.25 → −45 `WELL_BEHIND` · else −70 `CRUSHED`

**`RANGE_ADVANTAGE_BANDS`** — 0.10 → 45 · 0.06 → 30 · 0.02 → 15 · −0.02 → 0 · −0.06 → −15 ·
−0.10 → −30 · else −45

**`NUT_ADVANTAGE_BANDS`** — 0.08 → 45 · 0.04 → 30 · 0.01 → 15 · −0.01 → 0 · −0.04 → −15 ·
−0.08 → −30 · else −45

**`RANGE_RANK_BANDS`** — 0.95 → 50 `TOP_5` · 0.85 → 35 `TOP_15` · 0.70 → 18 `TOP_30` ·
0.50 → 0 `UPPER_HALF` · 0.30 → −18 · 0.15 → −32 · else −45

**`DRAW_QUALITY`** (additive, `CAP 70`) — flush draw by nut class NUT 45 / SECOND_NUT 36 /
THIRD_NUT 30 / WEAK 24; straight draw OESD 32 / DOUBLE_GUTSHOT 26 / GUTSHOT 12;
BACKDOOR_FLUSH_DRAW 8; BACKDOOR_STRAIGHT_DRAW 5; OVERCARD_EACH 3 (counted **only** when nothing
is made, otherwise the made-hand term already carries it).

**`BLOCKER_POINTS`** (additive, `BLOCKER_CAP 30`) — NUT_FLUSH 18 · NUT_STRAIGHT 12 ·
SECOND_NUT_FLUSH 10 · NUT_FLUSH_DRAW 8 · TOP_PAIR 8 · BOARD_PAIR 6 · STRAIGHT 5 · FLUSH_DRAW 4

**`POSITION_POINTS`** — aggression IP +20 / OOP −12; continue IP +15 / OOP −5

**`INITIATIVE_POINTS`** — previous street: hero +25, opponent −12, nobody 0. Current street:
hero already aggressed −10, opponent aggressed −8, nobody 0. **Summed.**

**`BOARD_TEXTURE_POINTS`** — STATIC with a range edge (`rangeAdvantage ≥ 0.02`) +10, without −5;
SEMI_DYNAMIC 0; DYNAMIC with protectable equity (top pair+ or draw ≥ 26) +15, without −12

**`SPR_PRESSURE_BANDS`** — 12 → −15 `VERY_DEEP` · 7 → −8 · 4 → 0 · 2 → +5 · 1 → +15 · else +25

**`FACED_BET_SIZE_BANDS`** — 1.10 → −40 `OVERBET` · 0.85 → −25 · 0.60 → −12 · 0.35 → 0 ·
else +10 `TINY`

**`POT_TYPE_POINTS`** — LIMPED −8 · SINGLE_RAISED 0 · THREE_BET +12 · FOUR_BET_PLUS +20

**`STREET_ACTION_POINTS`** — 0 checks 0 · 1 check +12 · 2+ checks +20

**`POT_ODDS_MARGIN_BANDS`** (continue model, margin = heroEquity − requiredEquity) —
0.20 → 90 · 0.10 → 65 · 0.04 → 38 · 0.00 → 12 · −0.04 → −25 · −0.10 → −60 · else −100

---

## 3. Score → frequency (the explicit mapping tables)

### 3.1 `AGGRESSION_BANDS`

| Band | score ≥ | bet / raise-lean frequency |
|------|--------:|---------------------------:|
| `DOMINANT` | 28 | 9500 |
| `STRONG` | 16 | 8000 |
| `MODERATE` | 5 | 6500 |
| `NEUTRAL` | −6 | 5000 |
| `WEAK` | −20 | 3000 |
| `POOR` | −38 | 1500 |
| `GIVE_UP` | −∞ | 0 |

The top band is 9500 rather than 10000 deliberately: the residual 500 is the honest admission
that a reference model is not a solve. A test asserts river nuts land in `DOMINANT` **and** that
the aggressive frequency stays strictly below 10000.

### 3.2 `CONTINUE_BANDS` (facing a bet — total continuing mass)

| Band | score ≥ | continue frequency |
|------|--------:|-------------------:|
| `ALWAYS` | 30 | 10000 |
| `STRONG` | 16 | 9000 |
| `GOOD` | 4 | 7500 |
| `MARGINAL` | −10 | 5500 |
| `THIN` | −25 | 3500 |
| `POOR` | −45 | 1500 |
| `GIVE_UP` | −∞ | 0 |

### 3.3 `RAISE_SHARE_BANDS` (share of the continuing mass that raises; keyed on the AGGRESSION score)

| Band | aggression score ≥ | raise share |
|------|-------------------:|------------:|
| `MOSTLY_RAISE` | 45 | 8000 |
| `MIXED` | 25 | 5000 |
| `SOME_RAISE` | 10 | 2500 |
| `RARE_RAISE` | −5 | 1000 |
| `MINIMAL_RAISE` | −20 | 500 |
| `NO_RAISE` | −∞ | 0 |

### 3.4 The three structural branches

Not judgement calls — shapes:

1. **Facing an all-in.** Nothing to raise into, so the ordinary model is replaced wholesale by
   `ALL_IN_CALL_BANDS` on the pot-odds margin. The aggression model is still computed and
   reported so the explanation is complete; it just does not drive the answer.
2. **Facing a bet.** Continue score fixes the continuing mass; aggression score splits it
   between call and raise.
3. **Not facing a bet.** Aggression score alone splits check and bet. `foldBps` is **0 by
   construction** — a free continue strictly dominates folding, so a fold is never emitted when
   checking is free. Tested.

### 3.5 `ALL_IN_CALL_BANDS` (margin = heroEquity − requiredEquity)

| margin ≥ | call frequency | label |
|---------:|---------------:|-------|
| 0.08 | 10000 | `CLEAR_CALL` |
| 0.02 | 8500 | `CALL` |
| −0.02 | 5000 | `BREAK_EVEN` |
| −0.06 | 1500 | `THIN` |
| −∞ | 0 | `FOLD` |

`ALL_IN_CALL_MARGIN = 0.02` is the documented half-width of the break-even band — the model's
own error bar, not a strategic indifference claim.

---

## 4. Sizing

### 4.1 The ladder — no pseudo-precision

`POT_FRACTION_BUCKETS` = **25, 33, 50, 67, 75, 100, 125, 150 % pot**, each stored as an exact
integer rational (`1/4`, `1/3`, `1/2`, `2/3`, `3/4`, `1/1`, `5/4`, `3/2`), plus `ALL_IN` as a
separate top rung. `47.83% pot` is unrepresentable. This is the sizing analogue of the 5-point
frequency grid.

### 4.2 Base rung by aggression band (index into the ladder)

| Band | index | size | why |
|------|------:|-----:|-----|
| `DOMINANT` | 5 | 100% | |
| `STRONG` | 4 | 75% | |
| `MODERATE` | 3 | 67% | thin value wants to be called |
| `NEUTRAL` | 3 | 67% | |
| `WEAK` | 4 | 75% | **deliberately non-monotone** — a bluff is sized like the value hands it represents |
| `POOR` | 4 | 75% | same |
| `GIVE_UP` | 4 | 75% | unreachable: this band bets at 0 frequency |

The non-monotonicity is the point and is asserted by test: air on a given board is emitted at
the **same** size as the value hand it is representing.

### 4.3 Modifiers (rung offsets, SUMMED, then clamped into the ladder)

| Rule | Condition | Steps |
|------|-----------|------:|
| `SIZING_TEXTURE_MODIFIER` | board STATIC | −1 |
| | board SEMI_DYNAMIC | 0 |
| | board DYNAMIC | +1 |
| `SIZING_NUT_ADVANTAGE_MODIFIER` | nutAdvantage ≥ +0.05 | +1 |
| | nutAdvantage ≤ −0.05 | −1 |
| `SIZING_RANGE_ADVANTAGE_MODIFIER` | STATIC board **and** rangeAdvantage ≥ 0.06 | −1 |
| `SIZING_SPR_MODIFIER` | SPR < 2 | +1 |
| | SPR > 6 | −1 |
| `SIZING_MULTIWAY_MODIFIER` | ≥ 3 live opponents | −1 |
| `SIZING_STREET_MODIFIER` | RIVER | +1 |
| `SIZING_RAISE_MODIFIER` | hero is raising | +1 |

Range advantage on a STATIC board is a *separate* entry from `BY_TENDENCY` on purpose: the
"small and frequent" shape is texture-conditional, and the same edge on a dynamic board does not
want the small size.

### 4.4 The all-in rung — `ALL_IN_GATE`

`ALL_IN` is selectable as a *size* only when **both** hold: `SPR ≤ 1.5` **and** aggression band
is `STRONG` or better. Above the SPR gate a shove is a size no pot fraction would ever produce,
so offering it would be inventing a line. A clamp of an ordinary bucket to the engine maximum
can still land on the whole stack — that path is recorded as a **CLAMP**, never as a chosen shove.
The gate result is reported either way (`SELECTED` / `BLOCKED_BY_SPR` / `BLOCKED_BY_BAND`).

### 4.5 Arithmetic and legality

- BET: `toAmount = heroStreetContribution + round(potBeforeDecision × f)`
- RAISE: `toAmount = callToAmount + round((potBeforeDecision + callAmount) × f)`

Integer milliBB throughout via `Money.*`, one explicit rounding at the single point the fraction
is applied. Then A3's **clamp-and-degrade** (`LEGALITY_CLAMP`), reused unchanged rather than
reinvented: the requested TO is clamped into `[minToAmountMbb, maxToAmountMbb]`, the **original
request is kept beside it** (CLAUDE.md rule 3), the direction is recorded
(`RAISED_TO_MINIMUM` / `LOWERED_TO_MAXIMUM`), and provenance drops a step. An illegal size is
never emitted; tests exercise both clamp directions and three sets of deliberately tight bounds.

The sizing's reported provenance is the **worst** over every contributing sizing rule
(`SIZING_BUCKET_SET`, `SIZING_BASE_BY_BAND`, the arithmetic rule, and every modifier that
fired) → `HEURISTIC`. Reporting the arithmetic rule's `DERIVED` alone would have been
misleading: the arithmetic is derived, the *choice of rung* is authored.

---

## 5. The nut-advantage formula (exact)

1. Build the made-hand strength distribution of the **uniform 1326-combo range** on this board
   (B2 `buildStrengthDistribution`, ~1.3 ms). This is the *board's own* reference distribution
   and depends on nothing but the board.
2. Walk it from the top and read off the strength at `NUT_SHARE_PERCENTILE = 0.05`. That single
   packed strength value is the board's **nut cutoff** — an ABSOLUTE threshold.
3. `nutShare(R) = weightAtOrAbove(R, cutoff) / totalWeight(R)`.
4. `nutAdvantage = nutShare(hero) − nutShare(primary villain)`.

Step 2 is what makes the two shares comparable. **If each range used its own top 5%, every range
would have a nut share of exactly 5% by construction and the difference would be identically
zero.** Everything of equal strength is counted, so a board whose top 5% falls inside a large tie
group yields a share above 5% even for the reference range — correct and deliberate, because the
cutoff is a *strength* and two ranges must be measured against the same strength to be compared
at all.

Made-hand strength rather than equity: ~1.3 ms per range against ~65 ms for an equity
distribution, and on a river — where nut advantage matters most — the two are the same thing.

`STRONG_SHARE_PERCENTILE = 0.2` is computed and reported for the explanation but is **not**
scored.

---

## 6. Multiway

Supported everywhere; never HU-only. Four separate, documented, conservative mechanisms:

### 6.1 Score components

| live opponents | 1 | 2 | 3 | 4 | 5 |
|---|--:|--:|--:|--:|--:|
| `MULTIWAY_AGGRESSION_POINTS` (weight 2) | 0 | −25 | −45 | −55 | −65 |
| `MULTIWAY_CONTINUE_POINTS` (weight 2) | 0 | −20 | −35 | −45 | −50 |

### 6.2 A multiplicative scale on the aggressive frequency

| live opponents | 1 | 2 | 3 | 4 | 5 |
|---|--:|--:|--:|--:|--:|
| `MULTIWAY_AGGRESSION_SCALE_BPS` | 10000 | 7500 | 5500 | 4500 | 3500 |

Applied as `floorToGrid(bps × scale / 10000)`. It is a **scale, not a ceiling**, precisely so the
reduction is *unconditional*: an earlier ceiling formulation did not bind (HU and 3-way both
landed on 6500 in a real fixture) and was replaced. Flooring rather than rounding is deliberate —
rounding back up would sometimes undo the very reduction the scale exists to apply. Tests assert
the reduction is strict for every non-zero band and every opponent count, and that every scaled
value stays on the 5-point grid.

The scale applies to the **raising** frequency too, for the same reason it applies to betting: an
extra live opponent is an extra range that has to fold.

### 6.3 A flat penalty on the continuing mass

| live opponents | 1 | 2 | 3 | 4 | 5 |
|---|--:|--:|--:|--:|--:|
| `MULTIWAY_CONTINUE_PENALTY_BPS` | 0 | 1000 | 2000 | 2500 | 3000 |

### 6.4 Sizing and provenance

- `SIZING_MULTIWAY_MODIFIER`: −1 rung at ≥ 3 live opponents.
- `MULTIWAY_DEGRADE`: one provenance step (B2 note 8 — the equity engine models no correlation
  between villain ranges, and B2 §4 measures multiway flop equity at roughly ±2 points).
- One confidence step.

Comparative tests assert the **same hand in the same spot** bets less often, bluffs less often
and continues less often 3-way than heads-up.

---

## 7. The villain range model — decision and rationale

**Option (b) was chosen: end-of-preflop ranges are carried forward UNCHANGED behind an explicit
typed flag. Postflop actions before hero's decision narrow nothing.** Rule
`VILLAIN_RANGE_NOT_NARROWED`; `PostflopRecommendation.villainRangeNarrowingApplied` is the
literal type `false`.

Three reasons:

1. **It is circular.** This policy's inputs are RANGE-level (range advantage, nut advantage,
   hero's rank inside hero's own range). To narrow villain's range by villain's policy, the
   policy must first be evaluated *for* villain — which needs villain's range advantage, which
   needs villain's range. That is a fixed point, not a computation, with no convergence
   guarantee. Breaking the cycle by evaluating villain's policy against unnarrowed ranges is
   just option (b) with an extra step and a misleading label.
2. **It is unaffordable.** Even the broken-cycle version costs one full policy evaluation per
   prior postflop action, each dominated by a range-vs-range equity pass (~65 ms on a flop,
   measured). A three-action flop would blow the 200 ms budget several times over.
3. **The honest precedent already exists.** A3 settled exactly this shape for preflop actions
   the policy assigns zero frequency: an action the model cannot condition on carries no
   information — leave the range alone and FLAG it. A range narrowed by a model that does not
   really know how villain plays is *worse* than an unnarrowed one, because it looks like a read.

**The flag is not decorative.** `postflopActionCount > 0` emits a
`VILLAIN_RANGE_NARROWING: NOT_APPLIED` explanation feature carrying the count, adds
`VILLAIN_RANGE_NOT_NARROWED` to the rule ids, and — when the un-narrowed actions include a BET or
RAISE — costs a confidence step. The scoring model *does* read the street's action history via
the `STREET_ACTION` component, but that is an authored aggression nudge with weight 1 of 26; it
changes no range weight.

Hero's own range comes from the same machinery, with the board removed from every range
(nobody holds a board card) and folded seats dropped. Hero's actual combo stays in hero's range
so `rangeRank` is measurable.

Preflop lines the reference policy never takes (an SB limp, say) are flagged `offPolicy` by A3
and carried unchanged — hero still gets an answer, and `VILLAIN_RANGE_OFF_POLICY` appears in both
the rule ids and the explanation. Tested.

---

## 8. Provenance

41 rules in `postflop/rules.ts`. **31 HEURISTIC, 10 DERIVED, 0 SOURCE** — and there is no code
path that can produce `SOURCE` on a postflop answer. Asserted by test on every fixture and in the
property sweep.

The 10 `DERIVED` ids are exactly those where a rule maps deterministically from a documented
public principle already cited in `STRATEGY_ANCHORS.md`, or is pure arithmetic/bookkeeping:

`POSTFLOP_SPOT_CLASSIFICATION`, `POSTFLOP_REQUIRED_EQUITY`, `HERO_EQUITY_MEASUREMENT`,
`SIZING_POT_FRACTION_TO_AMOUNT`, `LEGALITY_CLAMP`, `LEGALITY_SUBSTITUTION`,
`FREQUENCY_QUANTIZATION`, `PRIMARY_ACTION_TIE_BREAK`, `STACK_BUCKET_NEARBY`,
`ENVIRONMENT_COMPATIBILITY`.

Everything that expresses a *strategy opinion* — every weight, every band, every sizing rung — is
`HEURISTIC`. Because `worstProvenance` is taken over the whole rule set, a postflop
recommendation's `quality` is in practice always `HEURISTIC`, and a mandatory note is emitted per
contributing rule (`invariant` enforces at least one).

`environmentCompatibility` has **no `EXACT` status to reach for** (ADR-0056 anchor 9) and applies
**no** numeric ante or rake adjustment. An ante present ⇒ `DIVERGENT`.

### Confidence

Because provenance cannot carry gradation postflop, a separate `confidence` counts documented
degradations: 0 → HIGH, 1 → MEDIUM, ≥2 → LOW. Exactly four count:

- `MULTIWAY` — ≥2 live opponents.
- `HERO_EQUITY_SUBSAMPLED` — **hero's own** equity estimated rather than enumerated. Range
  equity being subsampled deliberately does **not** count: it is a range-level aggregate feeding
  two components of combined weight 4/26, and on a flop it is subsampled essentially always, so
  counting it would pin every flop answer to LOW and make the field carry no information. It is
  still reported in `metrics`, in the `EQUITY_METHOD` feature, and as `EQUITY_SUBSAMPLED`.
- `OFF_POLICY_RANGE`.
- `UNNARROWED_AGGRESSION` — a postflop BET or RAISE before hero's decision. Only aggression
  counts, not a check: a check is the least informative action in poker and every range this
  model builds already contains the hands that would check.

---

## 9. Legality substitution — and one strategy bug it exposed

Fixed, documented chains; first legal candidate wins:

| | AGGRESSIVE | PASSIVE | FOLD |
|---|---|---|---|
| **unbet pot** | BET → RAISE → ALL_IN → CHECK → CALL → FOLD | CHECK → CALL → FOLD | CHECK → FOLD → CALL |
| **facing a bet** | RAISE → BET → ALL_IN → CALL → CHECK → FOLD | CALL → CHECK → FOLD | CHECK → FOLD → CALL |

As preflop, the FOLD chain reaches for CHECK **before** FOLD: when continuing costs nothing, a
free continue strictly dominates folding.

**A bug found by the tests and fixed:** `ALL_IN` sits in the AGGRESSIVE chain, and originally it
was reachable whenever the engine offered no *sizable* wager. On a fixture where the engine
offered `wager: null` (or `onlyAllIn`) at SPR 17.7, the policy therefore promoted "the model
wants to bet 50% pot" into "jam 97 BB into a 5.5 BB pot" at 80% frequency — a strategy error
dressed up as legality handling. **Fix:** ALL_IN is now reachable in the AGGRESSIVE chain only
when `ALL_IN_GATE` permits it; otherwise the chain falls through to the passive action and
`ALL_IN_SPR_GATE` is recorded in the rule ids. Three tests pin all three branches (gate blocks →
CHECK; gate permits at SPR ≤ 1.5 → ALL_IN for the full stack; ordinary wager → sized bucket).

---

## 10. Determinism and latency

**Determinism.** Identical `(query, budget)` ⇒ bit-identical recommendation. Nothing in
`postflop/**` reads `Date`, `Math.random` or any machine state; B2's subsampling is a pure
function of `(n, k)`. Every budget field bounds an **enumeration size**, never wall-clock time,
so a slow machine returns the identical answer. Asserted by `JSON.stringify` equality on the
default budget, on a reduced budget, and in the worked example.

**Latency** (`benchmark.test.ts`, Darwin arm64, mean of 3 after a warm-up, B2 default budgets):

| Spot | per call |
|------|---------:|
| HU flop | **87.0 ms** |
| HU turn | 10.9 ms |
| HU river | 2.3 ms |
| 3-way flop | 40.8 ms |
| 3-way turn | 6.1 ms |
| 3-way river | 2.0 ms |

The worst shape is a heads-up FLOP (largest runout enumeration) at ~87 ms — comfortably inside
the ~200 ms interaction budget, so **no reduced default budget was needed**. `PostflopBudget`
(`equity`, `rangeEquityMaxOps`, `rangeEquityMaxRunouts`, `cache`) exists anyway as a caller-owned
option; a reduced budget is tested for structural stability and determinism. 3-way is *faster*
than HU because the multiway equity path enumerates fewer runouts per villain pairing.

The three expensive calls, and why there are exactly three: `equityVsRanges` (hero's actual
equity), one `equityDistribution` pass that yields **both** range equity and hero's rank, and
three `buildStrengthDistribution` passes sharing a single `nutStrengthOnBoard` computation
(B1 risk 3). Running the distribution against every villain instead of the primary one would
multiply the dominant cost by up to five — which is why `primaryVillainOf` exists.

---

## 11. Worked Example B — full derivation

`src/postflop/workedExample.test.ts` (39 tests). Every number below is asserted exactly; the file
is the regression fence around the tuning.

**The spot.** 6-max, 100 BB, no ante. UTG/HJ/CO fold, **BTN opens to 2.5 BB**, SB folds, **BB
calls**. Flop **Ah 7d 2c**. **BB checks.** Hero is **BTN** with **Ac Qs**.

**The query.** pot before decision **5500 mBB**, call **0**, check legal, wager `BET` in
`[1000, 97500]` mBB, SPR **17.727**.

**Classification.** family `CBET` · pot type `SINGLE_RAISED` · hand class `AQo` · relative
position `IP` · board `STATIC` / `UNPAIRED` / `DISCONNECTED` / `RAINBOW` · made class `TOP_PAIR` ·
blocker `TOP_PAIR_BLOCKER` · 1 check to hero · previous-street aggressor `BTN`.

**Measurements.** heroEquity **0.8803814** (`EXACT`) · rangeEquity **0.5306111**
(`SUBSAMPLED`) · rangeAdvantage **+0.0306111** · nutAdvantage **+0.0270692** ·
rangeRank **0.9053254** · no pot odds (not facing a bet).

**The aggression score.**

| Component | measured | band / label | points | weight | weighted |
|-----------|----------|--------------|-------:|-------:|---------:|
| HAND_STRENGTH | TOP_PAIR (base 40) | `TOP_PAIR` | 40 | 3 | 120 |
| HERO_EQUITY | 0.88038 | `CRUSHING` | 80 | 3 | 240 |
| RANGE_ADVANTAGE | +0.03061 | `SLIGHT_EDGE` | 15 | 2 | 30 |
| NUT_ADVANTAGE | +0.02707 | `SLIGHT_EDGE` | 15 | 2 | 30 |
| RANGE_RANK | 0.90533 | `TOP_15` | 35 | 2 | 70 |
| DRAW_QUALITY | 0 | `NONE` | 0 | 2 | 0 |
| BLOCKER_QUALITY | 8 | `BLOCKERS_1` | 8 | 1 | 8 |
| POSITION | IP | `IP` | 20 | 2 | 40 |
| INITIATIVE | 25 | `HERO_PREV/NONE_NOW` | 25 | 2 | 50 |
| BOARD_TEXTURE | 0 | `STATIC_WITH_RANGE_EDGE` | 10 | 1 | 10 |
| SPR_PRESSURE | 17.727 | `VERY_DEEP` | −15 | 1 | −15 |
| MULTIWAY | 1 | `OPPONENTS_1` | 0 | 2 | 0 |
| FACED_BET_SIZE | — | `NOT_FACING_A_BET` | 0 | 1 | 0 |
| POT_TYPE | SRP | `SINGLE_RAISED` | 0 | 1 | 0 |
| STREET_ACTION | 1 check | `CHECKS_TO_HERO_1` | 12 | 1 | 12 |
| | | | | **26** | **595** |

`score = round(595 / 26) = 23` → **`STRONG`** (≥16) → **8000 bps** aggressive.
Heads-up, so the multiway scale is 10000 and does not apply. No continue model (nothing to face).
Raw mix: `fold 0 / passive 2000 / aggressive 8000`.

**The size.** base rung for `STRONG` = index 4 = **75% pot**; `SIZING_TEXTURE_MODIFIER.STATIC`
**−1**; `SIZING_SPR_MODIFIER.HIGH_SPR` **−1** → index **2** = **50% pot**.
`50% × 5500 = 2750 mBB`, inside `[1000, 97500]`, **clamp `NONE`**, sizing provenance `HEURISTIC`.
`ALL_IN_GATE` = `BLOCKED_BY_SPR`.

**The answer.**

| Action | frequency | to (mBB) |
|--------|----------:|---------:|
| CHECK | 2000 | — |
| BET | 8000 | **2750** |

Primary action **BET**. `label` `REFERENCE`. Provenance `HEURISTIC` with 18 rule ids and 18
mandatory notes; environment compatibility `APPROXIMATE`. Confidence **HIGH** (0 degradations).
`villainRangeNarrowingApplied` **false**, with `VILLAIN_RANGE_NARROWING: NOT_APPLIED` carrying
count 1. Explanation: **50 typed features**, no prose, no LLM. Reproducible bit for bit.

### Reference behaviour of neighbouring spots (all asserted somewhere in the suite)

| Spot | Answer |
|------|--------|
| Same spot, 3-way | score 11 → `CHECK 5500 / BET 4500 @ 2500` — structurally lower |
| Same spot, air `6c5c` | `CHECK 7000 / BET 3000 @ 2750` — **same size as the value hand** |
| River nuts (royal flush) | `CHECK 500 / BET 9500` — `DOMINANT`, near-pure, never 100% |
| River air | `CHECK` primary, aggression < 5000, and any bluff is a sized bucket, never the stack |
| Facing a shove with `AcQs` | `CALL 10000`, no raise offered, band `CLEAR_CALL` |
| Facing a pot bet with `6c5c` | fold > 5000, primary `FOLD` |
| Low-SPR 3-bet pot, 40 BB | the `ALL_IN_SPR_GATE` fires: `BET 8000 @ 30000` = the whole stack |

---

## 12. Test coverage map

| Requirement from the brief | Where |
|---|---|
| score → frequency table, every threshold boundary | `policy.test.ts` "score -> frequency tables" (3 tables × every edge, plus totality above/below) |
| sizing bucket selection per feature combination | `sizing.test.ts` (25) |
| multiway adjustments actually reduce aggression, comparative HU vs 3-way | `policy.test.ts` "multiway adjustments" (7) |
| frequencies always multiples of 500 summing to 10000 | 8 named fixtures + an 80-case property sweep |
| sizing always legal under tight bounds, both clamp directions | `policy.test.ts` "legality substitution and clamping" (7) |
| provenance never SOURCE | every fixture + the property sweep |
| never-GTO greps | `policy.test.ts` (4 serialized recommendations) + `workedExample.test.ts` |
| facing-bet pot-odds paths (fold / call / raise mixes) | `policy.test.ts` "facing a bet — the pot-odds paths" (6) |
| all-in branches (facing, and recommending) | "facing an all-in" (4) + "recommending an all-in" (2) + 3 substitution tests |
| river nuts → near-pure; air → never a pure bluff jam | "river extremes" (4) |
| determinism | 3 tests + the worked example |
| the worked-example fixture | `workedExample.test.ts` (39) |
| benchmark | `benchmark.test.ts` (9) |
| refusals | "refusals" (5) |
| structured explanation, no prose | "the structured explanation" (5) |
| metrics passthrough | "metrics" (4) |
| confidence levels | 3 tests |

---

## 13. Risks and known limits

1. **⚠️ `src/preflop/recommendation.ts` was edited.** §0. One non-type change
   (`ACTION_COMMITMENT_ORDER` gains `BET`), provably neutral for preflop, but a reviewer should
   confirm it.
2. **`environmentCompatibility` is duplicated** between `preflop/policy.ts` and
   `postflop/policy.ts`. A second system on a provenance path. Should be collapsed by exporting
   the preflop one — outside this WP's boundary.
3. **Every weight and threshold in `scoreModel.ts` is authored judgement.** They are labelled
   `HEURISTIC`, each carries a rationale, and none is presented as GTO — but they are *opinions*,
   and they were tuned against a small number of hand-checked reference spots (§11), not against
   a solve. Expect them to move.
4. **Villain ranges are never narrowed postflop.** §7. Structural and deliberate, flagged
   everywhere it matters — but a user who bets three streets and gets called should not read the
   resulting range-advantage number as a read.
5. **Range equity on a flop is essentially always `SUBSAMPLED`.** Deliberately excluded from the
   confidence count (§8) so the field stays informative; it is reported in three other places.
6. **Multiway equity models no correlation between villain ranges** (inherited from B2). Costs a
   provenance step and a confidence step, but the number is still roughly ±2 points on a flop.
7. **`rangeRank` falls back to hero's own equity** when hero's combo is not found in hero's own
   range (an off-policy hero line). `heroComboInRange` records it; nothing else flags it loudly.
8. **The 200 ms budget has ~2.3× headroom on the worst shape, single-threaded, on this machine.**
   A slower client or a batch UI (a whole-hand replay recomputing every street) could feel it.
   `PostflopBudget` is the lever; it is untuned because it was not needed.

---

## 14. ADR-worthy items

Recorded here rather than written into `docs/DECISIONS.md`, which is outside this WP's boundary.
All four are decisions a future agent could otherwise reopen.

1. **Postflop villain ranges are NOT narrowed by postflop actions.** Option (b), with the
   circularity / cost / precedent argument of §7, a typed `villainRangeNarrowingApplied: false`
   on the answer, and mandatory surfacing. Falsifying evidence: a cheap non-circular narrowing
   scheme (e.g. a static per-action bucket table that does not depend on the policy's own output).
2. **The nut-advantage cutoff is board-absolute, not per-range** (§5). The per-range alternative
   is not a worse estimate — it is identically zero, i.e. no measurement at all.
3. **`ALL_IN` may never be reached by legality substitution unless `ALL_IN_GATE` permits it**
   (§9). Legality handling must never silently change the strategy; when the wanted size cannot
   be expressed, the honest degrade is not to aggress.
4. **The multiway aggression adjustment is a multiplicative scale floored to the grid, not a
   ceiling** (§6.2). A ceiling does not bind in the common case; the whole point of the
   adjustment is that the reduction is unconditional.

Also worth an ADR if the orchestrator agrees: **postflop provenance can never be `SOURCE`** is
currently enforced by construction and by test, but is not written down as a decision anywhere
outside `rules.ts`.

---

## 15. Verification

| Gate | Command | Result |
|------|---------|--------|
| package tests | `pnpm vitest run --project strategy-core` | **690 passed** (28 files) — 438 pre-existing + 252 new |
| postflop only | `pnpm vitest run --project strategy-core src/postflop/` | **252 passed** (6 files) |
| types | `pnpm typecheck` | clean, all 9 projects |
| lint (incl. layering) | `npx eslint packages/strategy-core/src --max-warnings=0` | clean |
| format | `npx prettier --write` on the files created/edited only | applied |

Per the brief, the repo-wide suite, `pnpm build` and E2E were **not** run — this WP is a pure
domain package with no DB, API, UI or migration surface.

---

## APPENDIX — correction, 2026-09-01 (R1B MAJOR-2)

*Appended, not rewritten: §10 and §13 above are the record of what B3 measured and claimed at
the time. This appendix states what is now known to be wrong in them.*

**The claim that is false.** §10's latency table and the sentence *"The worst shape is a
heads-up FLOP (largest runout enumeration) at ~87 ms"*, and §13 item 8's *"The 200 ms budget
has ~2.3x headroom on the worst shape"*. A heads-up flop is **not** the worst shape, and the
headroom on the real worst shape is smaller.

**Why it was wrong.** `postflop/benchmark.test.ts` defined exactly two lineups — 2-handed and
3-handed. Seeing the 3-way flop come in faster than the heads-up flop, B3 generalised "the
runout enumeration shrinks multiway, so heads-up must be worst" from a two-point sample. It
ignores the other direction: the villain cross-product and the per-runout strength evaluation
both grow with villain count, and a limped multiway pot gives every villain the widest range
the model has.

**Measured now, with 4/5/6-player cases added to the same benchmark** (Darwin arm64,
M-series, 3 runs after a warm-up, `pnpm vitest run --project strategy-core
src/postflop/benchmark.test.ts`):

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
| **6-way flop (limped) — the worst shape** | **106.3 ms** |

Off-table probes on the same run: a 6-way limped **monotone** flop 112.1 ms, a 6-way limped
flop facing a bet 107.5 ms, a 6-way **SRP** flop only 61.9 ms (narrower ranges), a 6-way
limped turn 34.5 ms. So the cost is driven by range WIDTH times villain count on the flop, and
the worst shape is a wide six-way flop at ~106–112 ms — about **1.8x headroom** against the
200 ms interaction budget on this hardware, not 2.3x. A mid-range laptop is routinely 2–4x
slower, which would put that shape at or past the budget; nothing measured here can rule it
out and the benchmark no longer pretends to.

An independent measurement through the real adapter and engine (review R1B) put the same
shape at 130–153 ms, higher than the in-repo fixture. Both numbers are worth quoting; neither
is ~87 ms.

**Secondary correction.** §10's framing (*"3-way is faster than HU"*) implies multiway is the
cheap direction. It is also
the less accurate one: the heads-up flop reports `heroEquityMethod === 'EXACT'` while every
4/5/6-way flop reports `'SUBSAMPLED'`. The benchmark now asserts exactly that, so the
distinction cannot silently drift.

**Budget decision.** The default `PostflopBudget` is left **untuned**. 106 ms is inside the
budget, and every field of that budget bounds an enumeration size rather than wall-clock time
(B2's determinism rule); tightening it would buy headroom the measurement does not say is
needed, at the cost of accuracy the UI reports (`EXACT` vs `SUBSAMPLED`). The measurement, the
worst-shape ordering and the equity-method claim are now asserted in the benchmark rather than
argued in a report.

**Also corrected in this pass.** §1's file table describes `postflop/score.ts` as *"Arithmetic
on the model. No constants."*, which is false (R1B MINOR-8); see `docs/reports/STRATEGY_FIX_R1B.md` §5 for what was and
was not done about it.
