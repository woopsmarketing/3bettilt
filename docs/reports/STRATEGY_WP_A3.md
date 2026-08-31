# WP A3 — preflop REFERENCE policy, sizing and range propagation

**Status:** complete · **Date:** 2026-09-01 · **Package:** `packages/strategy-core`
**Scope:** `src/preflop/**` only. Nothing outside that directory was created or edited.

User-facing name is **기본전략 · REFERENCE**. The word GTO appears nowhere in the code,
comments, rule ids, tokens or emitted strings, and a test asserts it (`tables.test.ts`
"never names the reference engine GTO", `policy.test.ts` "is labelled REFERENCE and never
GTO" — the second serializes a whole recommendation and greps it).

---

## 1. What was built

| File                            | Lines |  Purpose                                                                       |
| ------------------------------- | ----: | ------------------------------------------------------------------------------ |
| `src/preflop/notation.ts`       |   ~215 | 13x13 chart-notation parser (`66+`, `A3s+`, `A5s-A2s`) onto A2's 169 classes    |
| `src/preflop/tables.ts`         |   ~245 | **Every encoded number**, each with its anchor citation                        |
| `src/preflop/rules.ts`          |   ~330 | The rule registry: 30 rules, each with id, provenance, anchor, inputs, rationale |
| `src/preflop/recommendation.ts` |   ~290 | Output types + quantization, primary-action tie-break, provenance algebra       |
| `src/preflop/sizing.ts`         |   ~150 | Anchor ratio -> integer-milliBB raise-TO, and the clamp policy                  |
| `src/preflop/policy.ts`         |   ~640 | `classPolicy` (the table lookup) and `recommendPreflop` (the user-facing answer)|
| `src/preflop/propagate.ts`      |   ~300 | Per-seat range assignment by replaying the preflop line through `classPolicy`   |
| `src/preflop/testQuery.ts`      |   ~275 | TEST-ONLY synthetic `StrategyQuery` builder (not exported from the barrel)      |

Tests (alongside the source, matching A2's placement):
`notation.test.ts`, `tables.test.ts`, `sizing.test.ts`, `policy.test.ts`, `propagate.test.ts`.

**Not touched, as required:** `src/index.ts`, `src/adapter/**`, `src/range/**`,
`src/types.ts`, `src/errors.ts`, `src/provenance.ts`, `src/bps.ts`, `src/stackBucket.ts`,
`src/analysis/**` (the concurrent agent's directory), any other package, all root configs,
`docs/STATE.md`, `docs/DECISIONS.md`.

**No `src/range/**` helper was needed.** The chart-notation parser lives in
`src/preflop/notation.ts` deliberately: it is a notation for TABLE AUTHORING, not a range
operation, and putting it there kept the file boundary intact. It uses only A2's existing
public surface (`handClassByKey`, `handClassIndexOfCombo`, `rangeFrom`, `RANK_GRID_SIZE`).

**The barrel is NOT wired up.** `src/index.ts` was off-limits, so nothing from
`src/preflop/policy.ts` / `propagate.ts` / `recommendation.ts` / `tables.ts` / `rules.ts` is
exported from `@gto-self/strategy-core` yet. Tests import by relative path. The orchestrator
needs to add these exports when integrating.

---

## 2. Rule inventory

30 rules, all in `src/preflop/rules.ts`, each reachable by id from a recommendation's
`provenance.ruleIds`. Provenance follows the anchor doc's binding verdicts.

### 2.1 Range selection (per spot family)

| Rule id                     | Prov.     | Anchor                                                | What it does                                                                     |
| --------------------------- | --------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `RFI_TABLE`                 | DERIVED   | Anchor 1 (S1 lists; % from S1/S3/S4)                  | Position's opening range; raise 100% inside it, fold 100% outside                |
| `RFI_SB_RAISE_ONLY_TRIM`    | DERIVED   | Anchor 1 + 6 (S1 composite, band S10/S3/S4)           | Turns S1's 62.3% raise-or-limp SB composite into a 45.10% raise-only list        |
| `VS_LIMP_ISO`               | HEURISTIC | none (sizing half is S8)                              | Iso-raise the seat's own opening range, give up the rest; never limp behind      |
| `VS_LIMP_BB_VS_SB`          | DERIVED   | Anchor 7 (S13, single-sourced)                        | BB raises an SB limp with the derived SB raise-only list (45.1%, S13 says 40-45%)|
| `VS_OPEN_MIX`               | HEURISTIC | Anchor 6 UNVERIFIED + Anchor 3 shape (S5)             | Continue tier by seat/relative position, then value / mixed / bluff / call       |
| `BLIND_VS_BLIND_MIX`        | HEURISTIC | Anchor 7 (S10 qualitative) + Anchor 6                 | Same machinery; BB gets the widest tier, SB the medium tier                      |
| `SQUEEZE_MIX`               | HEURISTIC | none (sizing half is Anchor 5)                        | Value core 100%, bluff core 30%, cold-call only in position or from the BB       |
| `OPEN_PLUS_CALLER_CONTINUE` | HEURISTIC | none                                                  | Hero already invested and faces a raise + caller: value re-raise, tight call     |
| `OPENER_VS_3BET_MIX`        | HEURISTIC | none (sizing half is Anchor 4)                        | 4-bet value 100%, 4-bet bluff 50%, flat the middle                               |
| `COLD_4BET_MIX`             | HEURISTIC | none                                                  | Tightest table: KK+ 100%, QQ/AKs 50%, everything else folds; no cold call        |
| `VS_4BET_MIX`               | HEURISTIC | none                                                  | Shove core, call core, fold. 100/0 only — a mixed 5-bet % would be fake precision|
| `VS_ALLIN_POT_ODDS`         | HEURISTIC | Anchor 6 (S14 relationship is SOURCE; ranges are not) | Pot odds pick one of four calling tiers; call 100% or fold 100%                  |
| `UNSUPPORTED_SPOT_FALLBACK` | HEURISTIC | none — the spot is outside the modelled tree          | Narrow, passive catch-all; widens one tier when pot odds are at or under 20%     |

### 2.2 Sizing

| Rule id               | Prov.     | Anchor                                            | Value                                            |
| --------------------- | --------- | ------------------------------------------------- | ------------------------------------------------ |
| `SIZE_RFI`            | SOURCE    | Anchor 2 (S1, S3, S4 identical)                   | 2.5bb; 3bb from the SB                           |
| `SIZE_ISO_VS_LIMP`    | DERIVED   | Anchor 2 (S8 single-sourced for the limper term)  | RFI size + 1bb per limper                        |
| `SIZE_BB_VS_SB_LIMP`  | DERIVED   | Anchor 7 (S13 single-sourced)                     | 3.5bb (S13's "3.5-4bb", low end; 4bb noted)      |
| `SIZE_THREE_BET_IP`   | DERIVED   | Anchor 3 (S5+S8 say 3x, S1 says 3.5x)             | **3.0x the open** (majority); 3.5x kept in code  |
| `SIZE_THREE_BET_OOP`  | SOURCE    | Anchor 3 (S1, S5, S8 all ~4x)                     | 4.0x the open                                    |
| `SIZE_FOUR_BET_IP`    | SOURCE    | Anchor 4 (S1 + S6 cash)                           | 2.3x the 3-bet                                   |
| `SIZE_FOUR_BET_OOP`   | SOURCE    | Anchor 4 (S1 2.5x; S6 2.5-2.6x)                   | 2.5x the 3-bet                                   |
| `SIZE_SQUEEZE`        | DERIVED   | Anchor 5 (S8 chosen; S7 flat 3x+1x is alternative)| 4x IP / 5x OOP + 1x per cold caller beyond first |
| `SIZE_FIVE_BET_SHOVE` | HEURISTIC | none                                              | All-in (the engine's `maxToAmountMbb`)           |

### 2.3 Policy mechanics

| Rule id                    | Prov.   | What it does                                                                 |
| -------------------------- | ------- | ---------------------------------------------------------------------------- |
| `LEGALITY_CLAMP`           | DERIVED | Clamp-and-degrade (section 4)                                                |
| `LEGALITY_SUBSTITUTION`    | DERIVED | Fixed substitution chains for an action the engine does not offer            |
| `FREQUENCY_QUANTIZATION`   | DERIVED | 500-bps grid, exact 10000 total, via A2's largest-remainder `apportion`      |
| `PRIMARY_ACTION_TIE_BREAK` | DERIVED | Highest frequency; ties to the LEAST committing action                       |

### 2.4 Degradation and environment

| Rule id                      | Prov.     | Trigger                                     |
| ---------------------------- | --------- | ------------------------------------------- |
| `STACK_BUCKET_NEARBY`        | DERIVED   | `BB_60_79`, `BB_120_159`                    |
| `STACK_BUCKET_DISTANT`       | HEURISTIC | `BB_40_59`, `BB_160_PLUS`                   |
| `STACK_BUCKET_OUT_OF_RANGE`  | HEURISTIC | below 40bb (A2's typed `OUT_OF_RANGE`)      |
| `LINEUP_SHORT_HANDED`        | DERIVED   | 5 or 4 dealt in                             |
| `LINEUP_VERY_SHORT_HANDED`   | HEURISTIC | 3 dealt in or heads-up                      |
| `ENVIRONMENT_COMPATIBILITY`  | DERIVED   | always                                      |

---

## 3. Encoded constants and their anchors

### 3.1 RFI lists (all in `tables.ts`, transcribed verbatim from S1)

| Seat | Notation                                                                       | Computed % | Published band | Verdict                 |
| ---- | ------------------------------------------------------------------------------ | ---------- | -------------- | ----------------------- |
| UTG  | `66+,A3s+,K8s+,Q9s+,J9s+,T9s,ATo+,KJo+,QJo`                                    | 17.04%     | 15-17.6%       | list DERIVED, % SOURCE  |
| HJ   | `55+,A2s+,K6s+,Q9s+,J9s+,T9s,98s,87s,76s,ATo+,KTo+,QTo+`                       | 21.12%     | 19-22%         | list DERIVED, % SOURCE  |
| CO   | `33+,A2s+,K3s+,Q6s+,J8s+,T7s+,97s+,87s,76s,A8o+,KTo+,QTo+,JTo`                 | 27.75%     | 25-30%         | list DERIVED, % SOURCE  |
| BTN  | `33+,A2s+,K2s+,Q3s+,J4s+,T6s+,96s+,85s+,75s+,64s+,53s+,A4o+,K8o+,Q9o+,J9o+,T8o+,98o` | 42.84% | 40-48%       | list DERIVED, % SOURCE  |
| SB   | derived trim of S1's composite (below)                                         | 45.10%     | 40-47%         | DERIVED                 |
| BB   | **none** — folded to the BB the hand is over                                   | —          | —              | —                       |

`tables.test.ts` asserts every one of these against its band, and asserts the monotonic
widening UTG < HJ < CO < BTN (anchor 1 + S11's mechanism).

**The SB trim (`RFI_SB_RAISE_ONLY_TRIM`), stated in full because it is the one range this WP
computed rather than transcribed:** S1's SB figure (62.3%) is a raise-or-limp composite the
anchor doc explicitly forbids feeding to a raise-or-fold engine. The rule drops the
composite's OFFSUIT runs one at a time, **lowest high card first** (`86o+`, `96o+`, `T7o+`,
`J7o+`, `Q5o+`, `K4o+`, `A2o+`), and STOPS at the first list at or under the band's 47% top.
It stops after dropping five runs, at 45.10% — inside the 40-47% band all three of S10/S3/S4
support. The ordering needs no invented strength metric: S1's own list groups the offsuit
part by high card, and "drop the weakest high card first" is the single mechanical reading of
"make this list tighter". Rejected alternative, recorded in the code: reuse the BTN list
(43.5%, also inside the band) — right by percentage, wrong by composition.

### 3.2 Authored (HEURISTIC) sets

Every set below is this project's rule of thumb. Anchor 6 is explicit that no public source
publishes a defend-percentage table, so these are labelled HEURISTIC everywhere they surface
and a recommendation that uses one carries a mandatory note.

| Set                 | Notation                                                                              | %      |
| ------------------- | ------------------------------------------------------------------------------------- | ------ |
| `DEFEND_PREMIUM`    | `TT+,AQs+,AKo`                                                                        | 3.77%  |
| `DEFEND_TIGHT`      | `88+,ATs+,KJs+,QJs,JTs,AJo+,KQo`                                                      | 9.20%  |
| `DEFEND_MEDIUM`     | `55+,A8s+,A5s-A2s,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo`                               | 17.19% |
| `DEFEND_WIDE`       | `22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,87s,76s,65s,A8o+,KTo+,QTo+,JTo`                    | 26.40% |
| `DEFEND_VERY_WIDE`  | `22+,A2s+,K2s+,Q4s+,J6s+,T6s+,95s+,85s+,74s+,64s+,54s,A2o+,K7o+,Q9o+,J9o+,T8o+,98o`   | 45.40% |

Aggression cores: `THREE_BET_VALUE QQ+,AKs,AKo` · `THREE_BET_MIXED TT,JJ,AQs,AJs,KQs` (50/50)
· `THREE_BET_BLUFF A5s-A2s,KJs,QJs,JTs` (30 raise / 35 call / 35 fold) ·
`FOUR_BET_VALUE QQ+,AKs` · `FOUR_BET_BLUFF A5s-A4s` (50/50) ·
`FOUR_BET_CALL TT,JJ,AQs,AJs,KQs,AKo` · `COLD_FOUR_BET_VALUE KK+` ·
`COLD_FOUR_BET_MIXED QQ,AKs` (50/50) · `FIVE_BET_VALUE KK+` · `FIVE_BET_CALL QQ,AKs,AKo` ·
`SQUEEZE_VALUE QQ+,AKs,AKo` · `SQUEEZE_BLUFF A5s,A4s,KQs` (30/70) · `SQUEEZE_CALL TT,JJ,AQs,AJs`
· `ALLIN_CALL_{PREMIUM,TIGHT,MEDIUM,WIDE}` · `FALLBACK_CONTINUE 99+,AJs+,KQs,AQo+`.

Tier selection for a single open (`VS_OPEN_MIX` / `BLIND_VS_BLIND_MIX`): BB →
`DEFEND_VERY_WIDE`; SB → `DEFEND_MEDIUM` blind-vs-blind else `DEFEND_TIGHT`; IP vs a late
opener (CO/BTN/SB) → `DEFEND_WIDE`; IP vs an early opener → `DEFEND_MEDIUM`; OOP →
`DEFEND_TIGHT`. Only the DIRECTION is sourced (S14: the cheapest continue defends widest).

**No fake precision anywhere.** Every authored frequency is 10000, 7000, 5000, 3500 or 3000 —
multiples of 500 — and `assertClassFrequencies` throws at module load on anything else.

---

## 4. Sizing, legality and the clamping policy

All sizing arithmetic is integer milliBB through `Money.mulRatio` / `Money.mulInt` /
`Money.add` with an explicit `'round'` mode applied exactly ONCE per sizing (never
rounding twice). Ratios are exact integer rationals in `tables.ts`; no milliBB constant is
hard-coded (the big blind comes from the query's environment — CLAUDE.md rule 10).

| Family                            | Rule                  | Formula                                    | Example (1bb blinds) |
| --------------------------------- | --------------------- | ------------------------------------------ | -------------------- |
| RFI                               | `SIZE_RFI`            | 2.5bb; SB 3bb                              | 2500 / 3000          |
| VS_LIMP (iso)                     | `SIZE_ISO_VS_LIMP`    | RFI + 1bb x limpers                        | 1 limper -> 3500     |
| VS_LIMP (BB vs SB limp)           | `SIZE_BB_VS_SB_LIMP`  | 3.5bb                                      | 3500                 |
| VS_OPEN / BLIND_VS_BLIND, IP      | `SIZE_THREE_BET_IP`   | 3.0x open                                  | 2.5bb -> 7500        |
| VS_OPEN / BLIND_VS_BLIND, OOP     | `SIZE_THREE_BET_OOP`  | 4.0x open                                  | 2.5bb -> 10000       |
| SQUEEZE / OPEN_PLUS_CALLER        | `SIZE_SQUEEZE`        | (4 IP / 5 OOP + max(0, coldCallers-1)) x open | 2.5bb, 1 caller, IP -> 10000 |
| OPENER_VS_3BET / COLD_4BET, IP    | `SIZE_FOUR_BET_IP`    | 2.3x the 3-bet                             | 7.5bb -> 17250       |
| OPENER_VS_3BET / COLD_4BET, OOP   | `SIZE_FOUR_BET_OOP`   | 2.5x the 3-bet                             | 7.5bb -> 18750       |
| VS_4BET                           | `SIZE_FIVE_BET_SHOVE` | the engine's max (all-in)                  | 100000               |
| VS_ALLIN, UNSUPPORTED fallback    | —                     | never sizes a raise                        | —                    |

### 4.1 Clamping policy: **CLAMP-AND-DEGRADE** (`LEGALITY_CLAMP`)

The requested raise-TO is clamped into the query's `[wager.minToAmountMbb,
wager.maxToAmountMbb]`. When the clamp moves the number:

1. the ORIGINAL request is retained in `sizing.requestedToAmountMbb` (CLAUDE.md rule 3 — a
   normalized value never replaces what the rule actually said);
2. `sizing.clamp` records the direction (`RAISED_TO_MINIMUM` / `LOWERED_TO_MAXIMUM`);
3. the sizing's provenance drops ONE step (SOURCE→DERIVED, DERIVED→HEURISTIC, HEURISTIC
   stays), because a clamped size is no longer the size the source prescribed;
4. `LEGALITY_CLAMP` joins `ruleIds` and a `SIZING_CLAMPED` explanation feature is emitted.

An illegal size is never emitted. Both directions are tested (`sizing.test.ts` and
`policy.test.ts` "raises a too-small open…", "lowers a too-large open…"), and the property
sweep re-runs a whole hand-class sample against deliberately tight bounds (min 6bb, max 6.5bb).

### 4.2 Illegal-action substitution (`LEGALITY_SUBSTITUTION`)

First legal candidate wins:

- RAISE → ALL_IN → CALL → CHECK → FOLD
- CALL → CHECK → FOLD
- FOLD → **CHECK** → FOLD → CALL

The fold bucket reaches for CHECK *before* FOLD: when continuing is free a check strictly
dominates a fold, so "not in the continue range" renders as a check in an unraised pot (the
BB facing an SB limp, for instance). Frequencies are then merged by kind, so the total is
preserved exactly; the merged set is re-quantized regardless.

### 4.3 Frequencies and the primary action

`quantizeFrequencies` apportions 20 whole five-point units by A2's largest-remainder
`apportion` (tie-break: larger remainder first, then LOWER index) and multiplies back by 500.
Output is always multiples of 500 summing to exactly 10000, and the function is idempotent on
input that is already valid. Because the action list is ordered least-committing first, the
index tie-break is also the conservative one.

**Primary action** = highest frequency; on a tie the LEAST committing action wins
(FOLD < CHECK < CALL < RAISE < ALL_IN). Tested on a real 50/50 (KQs on the BTN vs a CO open →
primary CALL) and on a three-way 35/35/30 split (JTs → primary FOLD).

---

## 5. Degradation rules

### 5.1 Stack bucket

| Bucket                    | Rule                        | Effect on every contributing provenance |
| ------------------------- | --------------------------- | --------------------------------------- |
| `BB_80_119` (reference)   | —                           | unchanged                               |
| `BB_60_79`, `BB_120_159`  | `STACK_BUCKET_NEARBY`       | one step toward HEURISTIC               |
| `BB_40_59`, `BB_160_PLUS` | `STACK_BUCKET_DISTANT`      | forced HEURISTIC                        |
| `OUT_OF_RANGE` (<40bb)    | `STACK_BUCKET_OUT_OF_RANGE` | forced HEURISTIC + `UNMODELLED_STACK_DEPTH` feature |

The tables themselves are NOT altered per bucket — this package has exactly one set of tables
and pretending otherwise would be inventing data. What changes is the honesty label, plus the
clamp, which naturally turns an out-of-reach size into an all-in at a short stack.

### 5.2 Lineup size

6 dealt in → unchanged. 5 or 4 → `LINEUP_SHORT_HANDED`, one step (positions present in the
lineup keep their 6-max tables). 3 or heads-up → `LINEUP_VERY_SHORT_HANDED`, forced HEURISTIC.

### 5.3 Environment compatibility

`EnvironmentCompatibilityStatus` has exactly two members, `APPROXIMATE` and `DIVERGENT`.
**There is deliberately no `EXACT`.** The public charts never state the rake or ante structure
they assume, so an exact-match claim is unsupportable. Factors reported: `GAME_FORMAT`,
`ANTE` (DIVERGENT whenever an ante is enabled), `RAKE`, `STACK_DEPTH`, `LINEUP_SIZE`.
**No numeric ante adjustment is applied** — anchor 9 found no cash-applicable numeric factor
in public sources, and inventing one is exactly what CLAUDE.md rule 2 forbids.

---

## 6. Range propagation

`propagatePreflopRanges(query, options?)` returns one `PropagatedRange` per dealt-in seat:
position, status, `isHero`, the `RangeWeights`, the action kinds taken, and an `offPolicy`
flag.

Method, per action in engine order: rebuild the query as it stood at that decision point
(action prefix, recomputed seat statuses and street contributions) with the acting seat as
hero, run it through the SAME `classifyPreflopSpot` the rest of the package uses, ask
`classPolicy` for all 169 classes, expand the bucket the action falls into to per-combo
frequencies, and apply it with A2's `applyActionStrategy`. There is no second copy of the
strategy: a table edit moves the recommendation and the propagated ranges together.

Documented behaviours:

- **CHECK conditions on the complement of the raise bucket** (`10000 - raiseBps`), because a
  check is what the fold AND call mass both do when continuing is free.
- **Not renormalized**, matching `applyActionStrategy`'s contract. Weights answer "how much of
  this combo survives the line".
- **Off-policy actions.** If a player takes a line the policy assigns zero frequency (an SB
  limp against a raise-or-fold SB policy), conditioning would empty the range — an assertion
  that the player can hold nothing, which is false. The range is instead carried forward
  UNCHANGED and the seat is flagged `offPolicy: true`. Consumers must treat a flagged range as
  uninformative, not as a read.
- **Card removal**: hero's known cards are removed from every other seat's range and never
  from hero's own. Switchable via `applyHeroCardRemoval: false`.
- `policyRangeFor(ctx, bucket)` gives a spot's bucket range in a vacuum; a test asserts the
  RFI raise range's percentage equals the CO table's percentage exactly.

Tested invariants include: the caller's range contains none of the hands the policy 3-bets at
100% (QQ+, AKs, AKo weight 0), a pure call keeps 10000 and a 50/50 mix keeps 5000, a blocked
combo is 0 while its unblocked sibling is not, folded seats get their folding branch (UTG's
fold range holds no aces), no weight exceeds 10000, and the whole assignment is deterministic.

---

## 7. Verification

| Gate                                                | Result                                   |
| --------------------------------------------------- | ---------------------------------------- |
| `pnpm vitest run --project strategy-core`           | **PASS** — 17 files, **356 tests**       |
| ... of which `src/preflop/**`                       | 6 files, 133 tests (97 new in this WP)   |
| `pnpm typecheck` (all 9 projects)                   | **PASS**                                 |
| `npx eslint packages/strategy-core --max-warnings=0`| **PASS** — 0 errors, 0 warnings          |
| `prettier --write` on the 13 files created          | applied (repo-wide format NOT run)       |

New-test coverage by area:

- **notation (13)**: single classes either rank order, `+` runs, dashed runs, whitespace,
  five malformed-token refusals, 6/4/12 combo counts, full-universe = 1326, union/difference,
  expansion to concrete combos, determinism.
- **tables (13)**: every RFI list inside its published band, monotonic widening, no BB
  first-in range, the SB trim's landing point and its exact boundary classes, continue-tier
  ordering, value core present in every tier, four disjointness groups, every sizing ratio,
  rule-registry uniqueness/completeness, the anchor verdict classifications, and the no-GTO
  assertion.
- **sizing (12)**: 2.5/3bb opens, per-limper term, BB-vs-SB-limp, 3-bet IP/OOP, 4-bet IP/OOP,
  single-rounding of a fractional 2.3x, squeeze with 0/1/2/3 cold callers, shove, clamp NONE /
  up / down with provenance degradation and request retention, and a bounds sweep.
- **policy (59)**: RFI from all five opening seats and a junk UTG fold; VS_LIMP iso and the BB
  check-not-fold path; BLIND_VS_BLIND; VS_OPEN pure-3-bet, 50/50 mix, three-way bluff split,
  outright fold, SB-vs-BB tier asymmetry and OOP sizing; SQUEEZE value/bluff/position-gated
  call; OPEN_PLUS_CALLER; OPENER_VS_3BET; COLD_4BET; VS_4BET shove; VS_ALLIN at two prices
  plus the never-raise guarantee; the UNSUPPORTED fallback and its never-raise guarantee; both
  clamp directions, all-in substitution, no-aggression substitution; provenance at the
  reference bucket, nearby, distant, out-of-range, 5-handed and 3-handed; environment
  compatibility with and without an ante; the mandatory HEURISTIC note; the REFERENCE label;
  both refusals; determinism; and a 10-spot x 25-hand-class property sweep asserting legality
  and normalization, re-run against tight engine bounds.
- **propagate (15)**: opener range, hero's own cards kept, 100%-3-bet hands absent from the
  caller's range, pure vs mixed weights, card removal, folded branches, action audit trail,
  bps ceiling, determinism, the limped-pot off-policy flag, a 3-bet pot, the later-street
  refusal, the vacuum range identity, and card-removal opt-out.

---

## 8. Risks and open items

1. **The barrel is not wired.** `src/index.ts` was off-limits. Nothing from this WP is exported
   from the package yet. The orchestrator must add
   `export * from './preflop/policy.js' | './preflop/propagate.js' | './preflop/recommendation.js' | './preflop/rules.ts' | './preflop/tables.js' | './preflop/notation.js'`.
   Note `testQuery.ts` must NOT be exported (mirrors `adapter/testHands.ts`).
2. **`spot.ts`'s family list was not extended.** `CALLER_FACING_THREE_BET`, `COLD_FIVE_BET`,
   `BEYOND_FOUR_BET` and the other UNSUPPORTED reasons all route to the documented
   `UNSUPPORTED_SPOT_FALLBACK`. No family was added. If the product wants
   `CALLER_FACING_THREE_BET` modelled properly it is a deliberate, tested extension of
   `spot.ts` — a separate decision, not a loosening of the current rules.
3. **`RFI_TABLE` is DERIVED, so almost every recommendation is DERIVED or worse.** Combined
   with the bucket/lineup degradation, a short-handed or non-reference-bucket answer is
   HEURISTIC even for the most sourced spot in the file. That is the honest reading of the
   anchor doc, but the UI must be prepared for HEURISTIC to be common rather than exceptional.
4. **`LINEUP_SHORT_HANDED` is DERIVED per this WP's brief, while anchor 8's own verdict on the
   mechanical reuse rule is "UNVERIFIED → HEURISTIC".** The brief was followed (5/4-handed
   DERIVED, 3-handed and heads-up HEURISTIC). Flagging the divergence explicitly: if the
   anchor doc is treated as strictly binding here, `LINEUP_SHORT_HANDED` should also be
   HEURISTIC. One-line change in `rules.ts`; the orchestrator's call.
5. **The SB raise-only trim lands at 45.10%, just above S13's 40-45% band** for the separate
   BB-vs-SB-limp use of that same list (it is comfortably inside S10/S3/S4's 40-47% for its
   primary RFI use). A second, narrower list was not authored, because that would be an
   invented range where a derived one already exists.
6. **UTG's transcribed list computes to 17.04% while S1 states 17.6%** (~7 combos). The other
   seats match S1 closely (CO is exact at 27.75% vs 27.8%). The likeliest cause is a rounding
   or presentation difference in S1's own chart. The computed value is inside the
   cross-verified 15-17% band, and the band — not S1's headline number — is what the test
   asserts.
7. **`heroVsAggressor` drives sizing IP/OOP.** It comes from `spot.ts` (postflop order), so a
   BB facing an SB open is IP and gets the 3.0x 3-bet, not 4x. That is correct for the streets
   to come but reads oddly if someone expects "the blinds are always out of position".
8. **Off-policy ranges are uninformative, not narrow.** Anything downstream that consumes a
   propagated range must check `offPolicy` before treating the range as a read. This will
   matter as soon as real hands with limps are replayed.

---

## 9. ADR-worthy items

1. **The clamp-and-degrade legality policy.** A recommendation's size is always legal, the
   requested size is always retained, and provenance drops one step when the two differ. This
   is a money-adjacent convention every later policy (postflop, exploit layer) must follow
   identically rather than re-invent.
2. **The 5-percentage-point frequency grid.** The reference engine will never state a
   frequency finer than 5 points, in any street or family, because it has no solver behind it.
   Worth recording as a product-level honesty commitment, not just an implementation detail.
3. **`EnvironmentCompatibility` has no EXACT member.** The type itself forbids claiming the
   live table matches the source solve. Pairs with the standing decision (anchor 9) not to
   encode a numeric ante adjustment.
4. **Off-policy range propagation.** "An action the policy never takes carries no information;
   leave the range alone and flag it" is a modelling decision with real downstream consequences
   for postflop range work.
5. **The SB raise-only derivation.** A computed range, not a transcribed one, produced by a
   documented mechanical trim of a source list to fit a cross-verified percentage band. If more
   ranges ever need this treatment, the method should be settled once.
6. *(Secondary)* **The primary-action tie-break toward the least committing action.** A
   presentation rule with a behavioural effect on the user; cheap to record, awkward to
   discover by accident.

---

## APPENDIX — correction, 2026-09-01 (the SB range moved)

*Appended, not rewritten. The percentages above describe the SB open range as this work
package built it; they are no longer the shipped numbers.*

Review R1's finding M1 showed that the SB raise-only trim deleted whole offsuit runs in table
order — killing `QJo` while keeping `K4o` — and the fix (`docs/reports/STRATEGY_FIX_PREFLOP.md`
§2) replaced it with a per-class trim. The rule id (`RFI_SB_RAISE_ONLY_TRIM`) and its `DERIVED`
provenance are unchanged; the derivation is not.

**The SB open range is now 622 combos / 46.91% of the deck**, where this report states 45.10%.
It is 23 offsuit classes rather than 21, and it still sits inside the cross-verified 40-47%
band this report cites (`tables.test.ts` asserts that). Any note or comparison quoting 45.10%
— including the rows above for `RFI_SB_RAISE_ONLY_TRIM` and `VS_LIMP_BB_VS_SB`, and the
40-45% S13 comparison in the risks list — should use 46.91%; the S13 divergence it creates is
recorded in `preflop/rules.ts` rather than hidden. Nothing else in this report's range work
moved.
