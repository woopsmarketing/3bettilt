# WP J-C — ADAPTIVE policy engine (frequency, sizing, multiway, compose)

2026-09-02. Implements WP-J design contract §4, §5, §9 and §10 rows 1–5, 9–12.
Depends on WP J-A (`adaptive-core` foundation: stats, priors, shrinkage profile), which is
merged and green. §6/§7/§8 belong to WP J-D/J-E/J-B and are untouched here.

---

## 0. Result

| gate | result |
| --- | --- |
| `pnpm vitest run --project adaptive-core` | **5 files / 83 tests, exit 0** |
| `pnpm vitest run --project strategy-core` | **33 files / 783 tests, exit 0 — identical to before, no test edited** |
| `npx tsc --noEmit -p packages/adaptive-core` | clean |
| `npx tsc --noEmit -p packages/strategy-core` | clean |
| `pnpm lint` | clean (includes the layering rules) |
| `npx prettier --check` on every edited file | clean |

`git status` over `packages/strategy-core` shows exactly two modified files, both source, no test:

```
 M packages/strategy-core/src/postflop/index.ts
 M packages/strategy-core/src/postflop/sizing.ts
```

---

## 1. Deliverable 1 — the one additive change to `strategy-core`

`packages/strategy-core/src/postflop/sizing.ts` now exports:

```ts
export interface PotFractionAmountInput {
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  readonly heroStreetContributionMbb: MilliBB;
}
export function potFractionToAmount(
  input: PotFractionAmountInput,
  bucket: PotFractionBucket,
): MilliBB;
```

The body is the arithmetic that was inline in `sizingRequestFor`, **moved verbatim** — the same
`Money.isPositive(call)` branch, the same `Money.add` / `Money.mulRatio(..., 'round')` calls in
the same order, the same single rounding point. `sizingRequestFor` now calls it and does nothing
else it did not do before. The BET/RAISE doc-comment moved onto the new function (it explains the
arithmetic, which is what moved); `sizingRequestFor` kept a one-paragraph comment about the
all-in branch and the delegation.

Re-exported from `postflop/index.ts` (function plus type), which is how it reaches the package
barrel. Proof of behaviour preservation: **783 strategy-core tests pass unchanged**, including
the postflop sizing suites, with no test file touched.

Why it was needed: `adaptive-core` moves a bucket index and must turn the new bucket into
milliBB. Without the extraction it would have needed a whole `PostflopContext` (board analysis,
ranges, equity — everything it is forbidden from holding) or a second copy of the bet-TO formula
that would drift from the engine's.

---

## 2. The frequency rule table, as implemented

`packages/adaptive-core/src/policy/frequencyModel.ts`. **All twelve rules, all ids, all gains and
all ceilings are exactly as the design contract §4.2 tabulates them. No value was changed.**

| # | id | stat | streets | scope | bands | direction | target | effect | gain | max |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `FOLD_TO_CBET_HIGH` | `FOLD_TO_CBET_{street}` | F/T/R | `HERO_MAY_AGGRESS` | any | above | AGGRESSION | + | 4000 | 1000 |
| 2 | `FOLD_TO_CBET_LOW` | `FOLD_TO_CBET_{street}` | F/T/R | `HERO_MAY_AGGRESS` | any | below | AGGRESSION | − | 4000 | 1000 |
| 3 | `CHECK_RAISE_HIGH` | `CHECK_RAISE_{street}` | F/T/R | `HERO_MAY_BET` | VALUE∪MARGINAL∪WEAK | above | AGGRESSION | − | 6000 | 1000 |
| 4 | `WTSD_HIGH_BLUFF_DOWN` | `WTSD` | F/T/R | `HERO_MAY_BET` | MARGINAL∪WEAK | above | AGGRESSION | − | 3000 | 800 |
| 5 | `WTSD_LOW_BLUFF_UP` | `WTSD` | F/T/R | `HERO_MAY_BET` | MARGINAL∪WEAK | below | AGGRESSION | + | 3000 | 600 |
| 6 | `WTSD_HIGH_VALUE_UP` | `WTSD` | F/T/R | `HERO_MAY_BET` | VALUE | above | AGGRESSION | + | 2500 | 600 |
| 7 | `VILLAIN_CBET_HIGH` | `CBET_{street}` | F/T/R | `HERO_FACING_BET` | any | above | CONTINUE | + | 3000 | 800 |
| 8 | `VILLAIN_CBET_LOW` | `CBET_{street}` | F/T/R | `HERO_FACING_BET` | any | below | FOLD | + | 3000 | 800 |
| 9 | `THREE_BET_HIGH_TIGHTEN` | `THREE_BET` | PRE | `PREFLOP_HERO_OPENING` | any | above | FOLD | + | 2500 | 800 |
| 10 | `FOLD_TO_3BET_HIGH` | `FOLD_TO_THREE_BET` | PRE | `PREFLOP_HERO_FACING_OPEN` | any | above | AGGRESSION | + | 4000 | 1000 |
| 11 | `FOLD_TO_3BET_LOW` | `FOLD_TO_THREE_BET` | PRE | `PREFLOP_HERO_FACING_OPEN` | any | below | AGGRESSION | − | 4000 | 800 |
| 12 | `FOLD_BB_TO_STEAL_HIGH` | `FOLD_BB_TO_STEAL` | PRE | `PREFLOP_HERO_STEALING` | any | above | AGGRESSION | + | 3000 | 800 |

Every rule carries `provenance: 'HEURISTIC'` and a mandatory multi-sentence `note` written as
our own product judgement (asserted by test: >120 characters, and the words "GTO"/"solver" appear
in none of them).

The design contract's single "direction" column carried two independent facts — which SIDE of the
anchor activates the rule, and whether the contribution ADDS to or SUBTRACTS from the target.
They are two fields here (`direction: ABOVE_PRIOR|BELOW_PRIOR`, `effect: INCREASE|DECREASE`)
because they genuinely vary independently: rules 2 and 11 both fire below their anchor and both
decrease aggression, while rule 5 fires below its anchor and increases it.

### Street-relative stats: one `BY_STREET` resolver, not three rules

Chosen: a documented `AdaptiveStatSelector` with a `FIXED` and a `BY_STREET` variant, resolved by
`resolveStat(selector, street)`. **Why**: three rules each for `FOLD_TO_CBET_*`, `CBET_*` and
`CHECK_RAISE_*` would turn a twelve-row table into eighteen rows, nine of which differ only in a
suffix, and would fork one rule id — and therefore one line of UI copy and one stored trace token
— into three. The design contract names exactly twelve ids; the resolver is what keeps that true.
`BY_STREET` resolves to `null` on PREFLOP, which is what structurally prevents a postflop rule
from firing preflop.

### Gates and caps (named exports, each with its own note)

| constant | value |
| --- | --- |
| `FREQUENCY_MIN_CONFIDENCE_BPS` | 2500 |
| `MAX_TOTAL_SHIFT_BPS_HEADS_UP` | 2000 |
| `MAX_TOTAL_SHIFT_BPS_MULTIWAY` | 1000 |
| `BEHIND_AGGRESSION_GATE_BPS` | 2500 |

---

## 3. The sizing rule table, as implemented

`packages/adaptive-core/src/policy/sizingModel.ts`. All four rules exactly as §5.1 tabulates.

| id | stat | scope | bands | direction | steps |
| --- | --- | --- | --- | --- | --- |
| `SIZE_STATION_VALUE_UP` | `WTSD` | `HERO_MAY_AGGRESS` | VALUE | above | +1 |
| `SIZE_STATION_VALUE_UP_FOLD` | `FOLD_TO_CBET_{street}` | `HERO_MAY_AGGRESS` | VALUE | below | +1 |
| `SIZE_FOLDY_BLUFF_DOWN` | `FOLD_TO_CBET_{street}` | `HERO_MAY_AGGRESS` | WEAK | above | −1 |
| `SIZE_CHECK_RAISE_DOWN` | `CHECK_RAISE_{street}` | `HERO_MAY_BET` | MARGINAL∪WEAK | above | −1 |

| constant | value |
| --- | --- |
| `SIZING_MIN_CONFIDENCE_BPS_HEADS_UP` | 5000 |
| `SIZING_MIN_CONFIDENCE_BPS_MULTIWAY` | 7500 |
| `MAX_SIZING_BUCKET_DELTA` | 1 |

The `scope` column is an addition (see §7 deviation 6). It only ever makes a rule fire less often.

---

## 4. The algorithm, exactly

### 4.1 Per-rule contribution (§4.2)

```
dev    = estimate - prior                            // from J-A's shrinkage, signed
skip unless sign(dev) matches rule.direction         // zero never fires
raw    = floor(|dev| * gainBps  / 10000)
scaled = floor(raw  * confBps   / 10000)
capped = min(scaled, rule.maxBps)                    // cappedBy 'RULE_MAX' if it bit
drop the rule entirely when capped === 0
signed = capped * (effect === 'INCREASE' ? +1 : -1)
```

Gate: the rule is not even evaluated unless `confBps >= FREQUENCY_MIN_CONFIDENCE_BPS`, the
street matches, the spot scope matches, the band matches, and the stat resolves on this street.

### 4.2 Limiters, in this fixed order, each recorded in `cappedBy`

1. `RULE_MAX` — applied above.
2. `TARGET_ABSENT` — the target has no baseline row, or is the *only* baseline row, so there is
   nothing on one side of the transfer. Contribution zeroed, rule **kept**.
3. `AGGRESSIVE_PLAYER_BEHIND` — the §9 guard. Every **positive AGGRESSION** contribution zeroed,
   rule **kept**. Negative aggression, CONTINUE and FOLD untouched.
4. `TOTAL_SHIFT` — the global cap, below.

A rule zeroed by a limiter is kept (unlike one dropped at step 1 for `capped === 0`), because
"we wanted to bet more and refused because of the player behind you" is the most useful sentence
this layer can produce and it is unsayable if the rule vanishes.

### 4.3 Apply / cap / requantize (§4.3)

```
1. nets[target] = Σ signed contributions for that target
2. for target in (AGGRESSION, CONTINUE, FOLD):        // fixed order
       gainers = rows of that target, givers = the rest      (swapped when net < 0)
       added = apportion(baselineFreq[gainers], |net|)
       taken = apportion(baselineFreq[givers],  |net|)
       working[gainers] += added ;  working[givers] -= taken
   Each transfer is zero-sum, so the vector still totals 10000 for any number of targets.
   All-zero weights on one side -> EQUAL split (a legal kind REFERENCE gives 0% is still legal).
3. floor every row at 0; apportion(_, 10000)
4. shift = Σ|adjusted - baseline| / 2
   if shift > cap:  ratioBps = floor(cap * 10000 / shift)
                    every contribution *= ratioBps (trunc toward zero), re-run 1-3
                    capApplied = true, cappedBy = 'TOTAL_SHIFT'
5. quantizeFrequencies(...)          <- imported from @gto-self/strategy-core
6. grid trim (see below) while shift > cap
7. pickPrimaryAction(...)            <- imported from @gto-self/strategy-core
   totalShiftBps = shift measured on the FINAL quantized vector
```

`cap = 2000` when `activeOpponentCount <= 1`, `1000` otherwise.

**The grid trim (step 6) is an addition and it is load-bearing.** Quantization moves each row by
under 500 bps, but those roundings accumulate across rows, so a mix that was inside the cap
before quantization can land outside it after. The trim moves whole 500-bps units from the
most-increased row to the most-decreased row (ties to the lower index, matching `apportion`'s own
tie-break and the least-committing-first action order). Each move reduces the shift by exactly
500 and preserves both the 500-grid and the 10000 total, so it terminates; it is additionally
bounded by the 20 grid units in a whole mix. It can only move mass between rows that already
moved, so it cannot introduce a kind. Without it, `totalShiftBps <= cap` would be a claim the
code does not actually guarantee.

### 4.4 Sizing (§5)

```
postflop only; baseline.sizing != null; bucketIndex in [0, 7] (ALL_IN -1 never moved);
context.wager != null
per rule: gate confBps >= 5000 (HU) / 7500 (multiway), band match, direction match
guard: positive steps zeroed when the §9 finding tripped
net    = clamp(Σ steps, -1, +1)                      // cappedBy 'SIZING_BUCKET_DELTA'
toIdx  = clamp(fromIdx + net, 0, 7)                  // cappedBy 'SIZING_LADDER_END'
amount = potFractionToAmount({pot, call, heroStreetContribution}, POT_FRACTION_BUCKETS[toIdx])
sizing = clampPostflopSizing({ruleId:'SIZING_POT_FRACTION_TO_AMOUNT', amount, selection}, wager)
```

`requestedToAmountMbb` is retained beside the clamped amount (CLAUDE.md rule 3). Both functions
come from `strategy-core`; this package does no money arithmetic of its own.

### 4.5 Multiway (§9)

`classifyOpponents(orderings, heroFacingBet)`:

- **PRIMARY** — hero facing a bet: the live opponent with `isLastAggressorThisStreet`. Otherwise:
  the first live opponent with `actsAfterHero`, by `actionOrderIndex`. Ties break by
  `actionOrderIndex`, then `seatIndex`, then `playerId` as a string — three levels, because a tie
  that resolved differently between runs would make a stored trace irreproducible.
- **BEHIND** — every *other* live opponent with `actsAfterHero`.
- **OTHER** — folded, all-in, or already acted.

Only the PRIMARY's profile drives either rule table. Every ordering fact is a caller-supplied
field on `AdaptiveOpponentOrdering`; this package computes no poker order and cannot import
`poker-core` (guarded by ESLint *and* by `tests/layering.test.ts`).

`findAggressivePlayerBehind(roles, profiles, street)` scans BEHIND opponents in the caller's
order, and per opponent scans `CHECK_RAISE_{street}` then `THREE_BET` (preflop: `THREE_BET`
only). It trips on the first stat with `deviationBps > 0` **and**
`confidenceBps >= BEHIND_AGGRESSION_GATE_BPS`.

The PRIMARY is deliberately excluded from BEHIND even when it is behind hero: its own aggression
is already fully represented by `CHECK_RAISE_HIGH` reading its profile, and double-counting it
would silence the whole positive half of the table against any known check-raiser.

---

## 5. Worked examples, with real numbers from the tests

### 5.1 Frequency — the nit (test `J10.2`)

Baseline: FLOP, heads-up, band STRONG, `CHECK 40% / BET 60%`, 75%-pot rung.
Opponent: `FOLD_TO_CBET_FLOP = 75%` over **n = 100** (prior 4500, K 40).

```
conf     = round(10000 * 100 / 140)                        = 7143
estimate = round((4500*2857 + 7500*7143) / 10000)          = 6643
dev      = 6643 - 4500                                     = +2143
raw      = floor(2143 * 4000 / 10000)                      = 857
scaled   = floor(857 * 7143 / 10000)                       = 612     (under the 1000 ceiling)

transfer +612 to AGGRESSION:  [4000, 6000] -> [3388, 6612]
quantize:                     [3388, 6612] -> [3500, 6500]
totalShiftBps                                              = 500
```

**BET 60% -> 65%.** The same opponent read at `FOLD_TO_CBET_FLOP = 100%` over **n = 2** gives
`conf = 476`, below the 2500 gate: the rule never fires, `status = INSUFFICIENT_DATA`, output
identical to the baseline. The 75%/n=100 read moves the strategy strictly more than the
100%/n=2 read — asserted, not eyeballed.

### 5.2 Sizing — the calling station (test `J10.3`)

Baseline: FLOP, heads-up, band **STRONG (VALUE)**, 10 BB pot, nothing to call, hero has nothing
in, engine rung index 4 (75% pot) = 7,500 milliBB.
Opponent: `WTSD = 45%` over n = 200 (prior 2700, K 50) and `FOLD_TO_CBET_FLOP = 20%` over n = 100.

```
WTSD               conf 8000, estimate 4140, dev +1440  -> SIZE_STATION_VALUE_UP       +1 rung
FOLD_TO_CBET_FLOP  conf 7143, estimate 2714, dev -1786  -> SIZE_STATION_VALUE_UP_FOLD  +1 rung
Σ steps = +2  ->  clamped to +1 by MAX_SIZING_BUCKET_DELTA (cappedBy SIZING_BUCKET_DELTA)
rung 4 (75%) -> rung 5 (100%)
potFractionToAmount({pot 10000, call 0, heroContribution 0}, 100%) = 10,000 milliBB
clampPostflopSizing against [1,000 , 200,000]  ->  clamp NONE
```

**75% pot / 7,500 milliBB -> 100% pot / 10,000 milliBB**, `requestedToAmountMbb = 10,000`.

The same station with a **WEAK** band instead: no sizing rule applies (both up-rules are VALUE-
scoped), and the frequency pass runs `FOLD_TO_CBET_LOW` (−510) + `WTSD_HIGH_BLUFF_DOWN` (−345) =
−855, giving `[4855, 5145] -> [5000, 5000]`: **BET 60% -> 50%**, shift 1000.

### 5.3 The nit again, with a WEAK band (test `J10.4`)

`FOLD_TO_CBET_HIGH` raises the frequency to **BET 65%** while `SIZE_FOLDY_BLUFF_DOWN` drops the
rung to 67% pot = **6,667 milliBB** (`round(10,000 * 2/3)`). Bluff more often, for less — the
exploit needs both passes to express, which is why they are separate.

### 5.4 Multiway cap (test `J10.11`)

Opponent: `FOLD_TO_CBET_FLOP = 100%` over n=400 (dev +5000, raw 2000, scaled 1818, **clipped to
1000 by RULE_MAX**) and `WTSD = 5%` over n=400 (dev −1956, `WTSD_LOW_BLUFF_UP` +520). Band
MODERATE.

| | contributions | projected | quantized | shift | capApplied |
| --- | --- | --- | --- | --- | --- |
| heads-up (cap 2000) | +1000, +520 | `[2480, 7520]` | `[2500, 7500]` | **1500** | false |
| multiway, 3 opponents (cap 1000) | ratio `floor(1000*10000/1520)=6578` -> +657, +342 | `[3001, 6999]` | `[3000, 7000]` | **1000** | true |

Both contributions are scaled by the same ratio, so the mix stays proportional rather than one
rule being truncated to make room for the other.

### 5.5 The guard rail (test `J10.11`)

PRIMARY folds to 75% of flop c-bets (`FOLD_TO_CBET_HIGH`, +612) **and** check-raises 30%
(`CHECK_RAISE_HIGH`, −672). A BEHIND opponent also check-raises 30% at `conf 7143 >= 2500`.

```
FOLD_TO_CBET_HIGH   contributionBps 0    cappedBy AGGRESSIVE_PLAYER_BEHIND   (kept, explained)
CHECK_RAISE_HIGH    contributionBps -672 cappedBy null                       (survives)
```

Aggression therefore goes **down**, where without the guard the two rules would net out to
roughly nothing. With the lurker's profile emptied, the same call gives +612 and −672 as normal.

---

## 6. Public API

`packages/adaptive-core/src/index.ts` now also exports:

```
baseline.ts        AdaptiveStreet, AdaptivePostflopStreet, AdaptiveTarget, ADAPTIVE_TARGETS,
                   ADAPTIVE_TARGET_BY_ACTION_KIND, AdaptiveStrengthCategory,
                   ADAPTIVE_STRENGTH_CATEGORIES, ADAPTIVE_STRENGTH_BY_BAND, strengthCategoryFor,
                   AdaptiveBaselineAction, AdaptiveBaselineSizing, AdaptiveBaseline,
                   targetForKind, heroMayAggress, heroMayBet, isPostflopStreet
multiway.ts        AdaptiveOpponentOrdering, AdaptiveOpponentRoleKind, AdaptiveOpponentRole,
                   classifyOpponents, primaryOpponentIdOf, BehindAggressionFinding,
                   findAggressivePlayerBehind
recommendation.ts  AdaptiveRuleId, AdaptiveRuleKind, AdaptiveAdjustment, AdaptiveAction,
                   AdaptiveSizing, AdaptiveOpponentSummary, AdaptiveStatus,
                   AdaptiveRecommendation
compose.ts         AdaptiveComposeContext, composeAdaptive
policy/reasons.ts  AdaptiveReasonKey + ADAPTIVE_REASON_KEYS, AdaptiveCapId + ADAPTIVE_CAP_IDS,
                   AdaptiveNoteCode + ADAPTIVE_NOTE_CODES, AdaptiveNote, adaptiveNote
policy/frequencyModel.ts  the rule table, the four gate/cap constants, resolveStat,
                   maxTotalShiftBpsFor, STEAL_POSITIONS, AdaptiveRuleScope/Direction/Effect,
                   AdaptiveStatSelector, AdaptiveFrequencyRule(Id)
policy/sizingModel.ts     the rule table, three constants, sizingMinConfidenceBpsFor,
                   AdaptiveSizingRule(Id)
policy/scope.ts    ADAPTIVE_SCOPE_PREDICATES, scopeMatches
policy/frequency.ts FrequencyAdaptation, adaptFrequencies
policy/sizing.ts   SizingAdaptation, adaptSizing
```

The three `ADAPTIVE_*_KEYS` / `_IDS` / `_CODES` arrays exist so WP J-E's `copy.ts` can build
exhaustive `Readonly<Record<Enum, string>>` maps (§8) without re-listing the members.

`packages/adaptive-core/package.json` gained `"@gto-self/shared": "workspace:*"`. The workspace
symlink already existed; no `pnpm install` was needed.

`src/testBaseline.ts` holds the fixture builders. It is **not** exported from the barrel,
mirroring `strategy-core/src/preflop/testQuery.ts`.

### The one function a caller needs

```ts
composeAdaptive(
  baseline: AdaptiveBaseline,
  opponents: readonly PlayerAdjustmentProfile[],
  context: AdaptiveComposeContext,   // { opponents: AdaptiveOpponentOrdering[]; wager: StrategyWagerOption | null }
): AdaptiveRecommendation
```

Total. Never throws for a data-shaped reason: no opponents, no nameable PRIMARY, a zero-sample
profile, an empty action set, and a malformed mix all have documented answers. It reads no clock,
no random source, and generates no id.

---

## 7. Deviations from the design contract

Every one of these is either explicitly authorised by §9's "the caller supplies the ordering
facts... take them as explicit fields and say so", or a tightening that can only make the layer
move less.

1. **`AdaptiveBaseline` gains two caller-supplied fields**: `heroIsPreflopOpener: boolean` and
   `heroPosition: StrategyPosition | null`. Three of the twelve rules are scoped to a preflop spot
   family ("hero opening", "hero opening from CO/BTN/SB") and this package cannot derive a spot
   family without poker-order knowledge it is forbidden to hold. Deriving "opening" as
   `street === 'PREFLOP' && !heroFacingBet` would be inventing poker behaviour (CLAUDE.md rule 7):
   a big blind checking behind limpers satisfies that expression and is not an open. A caller that
   does not know supplies `false` / `null` and the three rules never fire.
2. **`AdaptiveOpponentOrdering`** is the explicit ordering-facts DTO §9 requires:
   `isLive`, `actsAfterHero`, `isLastAggressorThisStreet`, `actionOrderIndex`.
3. **`AdaptiveComposeContext.wager`** — the engine's legal window is supplied, not synthesized
   from the baseline sizing's min/max. Synthesizing a `StrategyWagerOption` would have meant
   asserting `onlyAllIn` and the additional-amount fields we were not told. `null` skips the
   sizing pass with a note rather than producing an amount we cannot prove is legal.
4. **`AdaptiveAdjustment` gains `ruleKind: 'FREQUENCY'|'SIZING'` and `sizingSteps: number|null`.**
   A sizing rule contributes RUNGS, not basis points. Its `rawContributionBps`/`contributionBps`
   are `0`, and that is the literal truth rather than a placeholder — a sizing rule moves no
   frequency mass at all, which is what keeps `totalShiftBps` meaning exactly "how far the mix
   moved". §3.4's other fields are present unchanged, plus the rule's authored `note` verbatim.
5. **Street-relative stats use a `BY_STREET` selector**, not three near-duplicate rules. Rationale
   in §2 above.
6. **Sizing rules gained an `appliesWhen` column** (§5.1's table has none).
   `SIZE_CHECK_RAISE_DOWN` is scoped to `HERO_MAY_BET`: how often villain CHECK-raises is only a
   fact about the decision in front of hero when hero is the one betting. Applying it to a raise
   size would be reading a stat outside the spot it describes. Tightening only.
7. **The §9 guard is extended to positive sizing rung offsets.** §9 names the frequency pass.
   Refusing to bet more OFTEN into a known check-raiser while cheerfully betting BIGGER into them
   would be incoherent. Negative offsets survive, exactly as negative frequency contributions do.
   Conservative direction only.
8. **A post-quantization grid trim was added** to the cap pipeline (§4.3 above). §4.3's
   proportional pre-quantization scaling is implemented exactly as specified; the trim is the
   backstop that makes `totalShiftBps <= cap` an actual guarantee rather than an approximation.
9. **Rules zeroed by `TARGET_ABSENT` or the §9 guard are recorded, not dropped.** §4.2's
   "rules whose `capped === 0` are dropped" is applied at the per-rule-cap stage only. §9 asks for
   `cappedBy: 'AGGRESSIVE_PLAYER_BEHIND'` to be observable, which requires the adjustment to exist.
10. **An `AdaptiveNoteCode` vocabulary was introduced** (11 members) so `INSUFFICIENT_DATA` can
    name the gate it did not meet, as the WP brief requires, without emitting prose from a
    copy-free package. `NO_RULE_APPLIED_TO_SPOT` is distinguished from
    `FREQUENCY_CONFIDENCE_GATE_NOT_MET`: telling a user their sample was too small when no rule is
    about their spot would send them collecting hands that can never help.
11. **`AdaptiveCapId` gained `TARGET_ABSENT` and `SIZING_LADDER_END`** beyond the ids §3.4/§9
    imply, for the two limiter cases that otherwise had no way to explain themselves.
12. **`AdaptiveRecommendation.primaryAction` is nullable.** The REFERENCE engine always emits at
    least one action, but `pickPrimaryAction` throws on an empty list and the entry point must be
    total. `null` only when `baseline.actions` is empty.
13. **`status: 'ADAPTED'` means "at least one rule was recorded"**, not "the numbers changed". A
    rule that fired and was then zeroed by the guard, or rounded away by the 500-bps grid, still
    produces the most useful explanation this layer can give.

---

## 8. Tests

`packages/adaptive-core`: **5 files, 83 tests, all passing.** (J-A's `priors.test.ts`,
`profile.test.ts`, `tests/layering.test.ts` were already there and are untouched.)

### `src/compose.test.ts` — 24 new tests

| design contract row | what it pins |
| --- | --- |
| 1 | nit vs station over one baseline: mixes differ, nit is bet at more often, both echo a deep-equal *and* `JSON.stringify`-equal baseline |
| 2 | 75%/n=100 -> contribution 612 with every intermediate asserted; 100%/n=2 -> `INSUFFICIENT_DATA`; strictly larger shift on the larger sample |
| 3 | station + VALUE band -> rung 4 -> 5, 7,500 -> 10,000 milliBB, both station rules clipped to one rung; station + WEAK band -> BET 60% -> 50%, no size-up |
| 4 | nit -> BET 60% -> 65% in both bands; WEAK band additionally sizes 75% -> 67% pot (6,667 milliBB); VALUE band leaves the size alone |
| 5 | check-raiser + MARGINAL band -> BET 60% -> 55%, contribution −672 |
| 10 | empty profile and an all-zero-sample profile -> `INSUFFICIENT_DATA`, frequencies deep-equal the baseline, sizing unchanged, gate named with its value `2500`; plus the no-PRIMARY path and the out-of-scope path |
| 11 | HU shift 1500 / multiway shift 1000, `capApplied` false/true, both contributions scaled by the same ratio, `RULE_MAX` recorded on the rule that hit it; guard zeroes `FOLD_TO_CBET_HIGH` to 0 with `AGGRESSIVE_PLAYER_BEHIND` while `CHECK_RAISE_HIGH` keeps −672 |
| 12 | two calls on separately-constructed equal inputs are deep-equal and `JSON.stringify`-equal; opponent list order does not matter; provenance is `HEURISTIC` |

### `src/policy/invariants.test.ts` — 8 tests

Row 9's **structural sweep**: 4 streets x 8 band states (7 engine bands + `null`) x 3 lineup sizes
x facing-a-bet-or-not x 6 action sets x 4 opponent profiles, with the sizing rung rotating over
`{ALL_IN, bottom, middle, top}` = **4,608 compositions**. The action sets deliberately include a
zero-frequency-but-legal row, a single-row set (no target has anything to trade with), and a set
containing `ALL_IN`. Every composition is checked for:

- every frequency is a non-negative multiple of 500;
- they sum to exactly 10000;
- the emitted kinds are exactly the baseline's kinds, in order;
- no amount appears on a row that had none;
- any sizing amount is inside `[minToAmountMbb, maxToAmountMbb]`, the rung moved by at most one
  step, an ALL_IN rung never moved, a preflop rung never moved;
- `totalShiftBps <= maxTotalShiftBpsFor(activeOpponentCount)`, and the reported shift equals the
  shift actually present in the output;
- `INSUFFICIENT_DATA` implies the baseline verbatim and no adjustments.

The sweep also asserts it *did* something: more than a tenth of the cases adapted, the global cap
engaged at least once, and the sizing pass moved a rung at least once. (An earlier revision of
this test silently pinned every case to the ALL_IN rung; those two counters are what caught it.)

The remaining 7 tests pin the model tables as data: exactly the twelve frequency ids in order,
exactly the four sizing ids in order, every rule `HEURISTIC` with a >120-character note free of
"GTO"/"solver", every ceiling inside the multiway cap, every sizing step exactly one rung, and
all seven gate/cap constants at their design-contract values with the sizing gate strictly above
the frequency gate.

### Regression

`strategy-core`: **783 tests, unchanged and green**, which is the proof the §5.3 extraction is
behaviour-preserving. No strategy-core test file was edited.

One caveat, recorded because it will be seen again: on one run of the combined
`adaptive-core + strategy-core` suite (executed while `pnpm lint` was competing for the machine —
transform time 11.8 s against a normal 4 s) a single test failed. Four subsequent clean runs of
the same command passed 866/866. `strategy-core` carries two pre-existing WALL-CLOCK budget
suites — `src/postflop/benchmark.test.ts` and `src/equity/benchmark.test.ts` — which is the
expected shape of a load-sensitive flake. It is not caused by anything in this WP: the extraction
is a pure code move with no allocation or call-count change, and `adaptive-core` has no timing
assertion anywhere. Worth a separate look at making those two suites load-insensitive.

---

## 9. Remaining risk and known limitations

1. **ADAPTIVE cannot introduce an action kind REFERENCE omitted entirely.** If the engine gave no
   `FOLD` row at all, no rule targeting FOLD can do anything — the contribution is recorded with
   `cappedBy: 'TARGET_ABSENT'` and zero effect. This is the design contract's stated MVP
   limitation and is now visible in the output rather than silent, but it does mean a genuinely
   correct "start folding here against this player" is unreachable in those spots.
2. **Preflop sizing is untouched.** Preflop is a raise-TO rule in big blinds, not a pot fraction;
   there is no rung ladder to move along. Every preflop size echoes the baseline with a
   `PREFLOP_SIZING_OUT_OF_SCOPE` note.
3. **`AdaptiveAdjustment.note` carries the rule's full authored note verbatim** (200–600
   characters each). That is right for a self-explaining in-memory value, but WP J-B/J-D should
   decide whether `adjustments_json` persists it: `ruleId` reconstructs it exactly from
   `ADAPTIVE_FREQUENCY_RULES`, so storing it inflates every trace row for no recoverable
   information. **Flagging this for J-D rather than deciding it here.**
4. **The manual HUD can only supply 8 of the 17 stats** (J-A's `inputs.ts` records why:
   `HudStatKey`'s CHECK constraint cannot be widened without a table rebuild ADR-0046 rules out).
   So a player with HUD data only can never fire `CHECK_RAISE_*`, `CBET_TURN/RIVER`, `STEAL` or
   `FOLD_BB_TO_STEAL` rules. Not this WP's to fix; it bounds how much of the table is reachable in
   practice today.
5. **The rule table is twelve heuristics with no backtest.** Nothing here has been validated
   against results, and it cannot be until the trace table (WP J-B) has accumulated hands. Every
   number is labelled `HEURISTIC` with its reasoning, the global cap bounds the damage of a wrong
   one to 20 points of frequency heads-up, and `ADAPTIVE_POLICY_VERSION` must be bumped when any
   of them changes (J-A's `version.ts` already lists rule changes as a bump trigger — **that bump
   is now live and applies to this file's tables**).
6. **The §9 guard reads only two stats** (`CHECK_RAISE_{street}`, `THREE_BET`). A player who
   punishes bets by floating and taking the pot away on a later street is invisible to it. Adding
   a stat means adding it to `AdaptiveStatKey`, which is a reviewed change by construction.
7. **`activeOpponentCount` and the ordering facts are the caller's to get right.** If WP J-D/J-E
   pass a stale or wrong `isLastAggressorThisStreet`, ADAPTIVE will confidently exploit the wrong
   player. There is no way for this package to detect that, which is the price of not letting it
   see a `HandState`. The `opponents` array in the output names every role it assigned, so the UI
   can show which villain drove the recommendation — WP J-E should render it.
