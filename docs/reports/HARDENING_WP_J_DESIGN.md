# WP-J — ADAPTIVE player-specific strategy: orchestrator design contract

2026-09-02. Written by the orchestrator BEFORE implementation. Every WP-J agent builds
against this file. If an agent needs to deviate, it reports the deviation instead of
silently changing the contract.

Source requirement: `prompt` (repo root), sections J1..J11.

---

## 0. Baseline established before work started

`pnpm test` at HEAD-of-worktree: **125 test files / 2115 tests passing, exit 0.**
Any red after this point is ours.

---

## 1. Architecture (J1)

```
shared
  ^
  +-- poker-core  <-  coinpoker-parser
  |       ^
  |       +-- strategy-core            (REFERENCE. never player data.)
  |
  +-- player-core                      (player facts: manual HUD + learned model types)
  |       ^
  |       +-- analysis-core            (event log -> observations; apps/web only, ADR-0061)
  |
  +-- adaptive-core   <-- NEW          (composition: REFERENCE + profile -> ADAPTIVE)
              ^
           apps/web
```

`packages/adaptive-core` MAY import: `@gto-self/shared`, `@gto-self/strategy-core`,
`@gto-self/player-core`.

`packages/adaptive-core` MUST NOT import: `@gto-self/analysis-core` (ADR-0061 stands —
nothing but `apps/web` imports it), `@gto-self/db`, `@gto-self/poker-core`,
`@gto-self/gto-core`, React/Next, solver-lab.

Learned-model numbers reach `adaptive-core` as the neutral `AdaptiveStatObservation[]`
DTO built by `apps/web/src/server/adaptive-service.ts`. That keeps ADR-0061 intact and
keeps `adaptive-core` free of any persistence or event-log knowledge.

`strategy-core` is NOT modified except for ONE additive, behaviour-preserving extraction
(§5.3). Its `tests/layering.test.ts` keeps passing unchanged. `adaptive-core` gets its own
`tests/layering.test.ts` copied from strategy-core's, guarding the ban list above.

**Invariant, tested (J10.1):** for one `HandState`, `computeStrategy(state, heroSeat)` is
byte-identical whatever the player data is. `computeStrategy`'s signature does not change.
ADAPTIVE is produced by a SECOND, separate call that takes the REFERENCE result as a value.

---

## 2. Stats and sources (J2)

### 2.1 `AdaptiveStatKey` — exactly the 17 stats the prompt lists

```
VPIP  PFR  THREE_BET  FOLD_TO_THREE_BET
STEAL  FOLD_BB_TO_STEAL
CBET_FLOP  CBET_TURN  CBET_RIVER
FOLD_TO_CBET_FLOP  FOLD_TO_CBET_TURN  FOLD_TO_CBET_RIVER
CHECK_RAISE_FLOP  CHECK_RAISE_TURN  CHECK_RAISE_RIVER
WTSD  WSD
```

### 2.2 Neutral input DTO

```ts
export type AdaptiveStatSource = 'MANUAL_HUD' | 'LEARNED_MODEL';

export interface AdaptiveStatObservation {
  readonly key: AdaptiveStatKey;
  readonly source: AdaptiveStatSource;
  /** 0..10000. CentiPercent and Bps share this unit exactly; no conversion. */
  readonly valueBps: number;
  /** The DENOMINATOR this value was observed over. Never invented. */
  readonly sampleN: number;
  /** A scope caveat the UI must be able to show verbatim, or null. */
  readonly note: string | null;
}

export interface AdaptiveOpponentInput {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
  readonly observations: readonly AdaptiveStatObservation[];
  readonly manualHudSnapshotId: string | null;
  readonly manualHudRecordedAt: number | null;
  readonly learnedSnapshotId: string | null;
  readonly learnedModelVersion: number | null;
}
```

### 2.3 Source mapping — done in `apps/web/src/server/adaptive-service.ts`

**MANUAL_HUD** from `latestHudSnapshotForPlayer` (`PlayerHudSnapshot`):

| `HudStatKey`         | `AdaptiveStatKey`   |
| -------------------- | ------------------- |
| `VPIP`               | `VPIP`              |
| `PFR`                | `PFR`               |
| `THREE_BET`          | `THREE_BET`         |
| `FOLD_TO_THREE_BET`  | `FOLD_TO_THREE_BET` |
| `CBET_FLOP`          | `CBET_FLOP`         |
| `FOLD_TO_CBET_FLOP`  | `FOLD_TO_CBET_FLOP` |
| `WTSD`               | `WTSD`              |
| `WON_AT_SHOWDOWN`    | `WSD`               |

`valueBps = reading.value` (CentiPercent is already 0..10000 hundredths-of-a-percent).

`sampleN = min(snapshot.handSample ?? 0, MANUAL_HUD_MAX_EFFECTIVE_N)`.

- `handSample === null` -> `sampleN = 0` -> the reading carries ZERO weight, and the note
  is `'HUD 표본 수 미입력'`. We do not invent a sample size (CLAUDE.md rule 2/5).
- `MANUAL_HUD_MAX_EFFECTIVE_N = 1000`, tagged HEURISTIC with a mandatory note: a HUD's
  *hand* count overstates the *opportunity* count for street-scoped stats, so it is capped
  before it is used as a denominator.

The manual HUD has NO key for the other 9 stats. `HudStatKey` is deliberately NOT extended:
`player_hud_snapshot_stats.stat_key` carries a `CHECK ... in (HUD_STAT_KEYS)`, and SQLite
cannot ALTER a CHECK — widening it means a 12-step table rebuild of an insert-only table,
which ADR-0046 rules out. Recorded as a limitation with its path forward in the report.

**LEARNED_MODEL** from `getLatestSnapshot` (`PlayerModelSnapshot.globalStats`,
`ModelStatCount[]`):

| `ModelStatKey`             | position filter | `AdaptiveStatKey`      |
| -------------------------- | --------------- | ---------------------- |
| `VPIP`                     | `null`          | `VPIP`                 |
| `PFR`                      | `null`          | `PFR`                  |
| `THREE_BET`                | `null`          | `THREE_BET`            |
| `FOLD_TO_THREE_BET`        | `null`          | `FOLD_TO_THREE_BET`    |
| `STEAL_ATTEMPT`            | `null`          | `STEAL`                |
| `FOLD_TO_STEAL`            | **`'BB'`**      | `FOLD_BB_TO_STEAL`     |
| `CBET_{FLOP,TURN,RIVER}`   | `null`          | same                   |
| `FOLD_TO_CBET_{F,T,R}`     | `null`          | same                   |
| `CHECK_RAISE_{F,T,R}`      | `null`          | same                   |
| `WTSD`                     | `null`          | `WTSD`                 |
| `WSD`                      | `null`          | `WSD`                  |

`valueBps = round(10000 * actions / opportunities)`; `sampleN = opportunities`;
`opportunities === 0` -> the row is DROPPED, never emitted as 0%.

`FOLD_TO_STEAL` is read from the **BB positional row**, not the `null` aggregate, because
`analysis-core` scopes `FOLD_TO_STEAL` to SB *or* BB and only the BB row means
"fold BB to steal". Note on the observation: `'BB 포지션 행에서 읽음'`. No aliasing of a
differently-scoped stat.

`STEAL` carries the note `'RFI from CO/BTN/SB'` — it is `STEAL_ATTEMPT`'s scope verbatim.

Manual and learned rows are NEVER merged in the database and never overwrite each other.
They are two rows in `AdaptiveOpponentInput.observations`, merged only inside
`buildAdjustmentProfile`, with both retained in the output's `sources`.

---

## 3. Confidence and shrinkage (J3)

### 3.1 Priors are the ZERO-ADJUSTMENT ANCHOR, not a claim about a population

`ADAPTIVE_PRIORS[key]` is the value at which a stat produces **no adjustment at all**.
Every rule fires on `estimate - prior`. When confidence is 0, `estimate === prior`, so every
contribution is exactly 0 and ADAPTIVE equals REFERENCE. The prior therefore never has to be
"true" — it has to be neutral, and it is documented as such. All entries are `HEURISTIC`
with a mandatory note. They are **not** GTO numbers and are never labelled as such
(CLAUDE.md rule 2).

```
VPIP 2400   PFR 1900   THREE_BET 700   FOLD_TO_THREE_BET 5500
STEAL 3000  FOLD_BB_TO_STEAL 6500
CBET_FLOP 5500  CBET_TURN 4500  CBET_RIVER 4000
FOLD_TO_CBET_FLOP 4500  FOLD_TO_CBET_TURN 4500  FOLD_TO_CBET_RIVER 4500
CHECK_RAISE_FLOP 800  CHECK_RAISE_TURN 600  CHECK_RAISE_RIVER 400
WTSD 2700   WSD 5000
```

### 3.2 Per-stat `K` (opportunities at which confidence = 50%)

```
VPIP 50  PFR 50  WTSD 50
THREE_BET 40  FOLD_TO_THREE_BET 40  STEAL 40  FOLD_BB_TO_STEAL 40  WSD 40
CBET_FLOP 40  CBET_TURN 30  CBET_RIVER 25
FOLD_TO_CBET_FLOP 40  FOLD_TO_CBET_TURN 30  FOLD_TO_CBET_RIVER 25
CHECK_RAISE_FLOP 40  CHECK_RAISE_TURN 30  CHECK_RAISE_RIVER 25
```

### 3.3 The formula — integer bps end to end

```
nM, vM = manual sample / value      (0 if absent)
nL, vL = learned sample / value     (0 if absent)
n         = nM + nL
observed  = n === 0 ? prior : round((vM*nM + vL*nL) / n)
confBps   = confidenceWeightBps(n, K)          // player-core: round(10000*n/(n+K))
estimate  = round((prior*(10000-confBps) + observed*confBps) / 10000)
state     = snapshotConfidenceState(n, {k:K, learningThreshold:5, knownThreshold:30})
```

`confidenceWeightBps` and `snapshotConfidenceState` are **imported from
`@gto-self/player-core`'s `modelConfig.ts`** — the C1 framework is reused and extended
per-stat, never re-implemented (working agreement 7).

Worked check the tests must pin (J10.2):
`FOLD_TO_CBET_FLOP` prior 4500, K 40.
- observed 10000, n 2   -> conf 476  -> estimate 4762  -> deviation +262
- observed 7500,  n 100 -> conf 7143 -> estimate 6643  -> deviation +2143
The n=100 profile moves the strategy strictly more. Asserted, not asserted-by-eyeball.

### 3.4 Every adjustment carries its evidence

```ts
export interface AdaptiveAdjustment {
  readonly ruleId: AdaptiveRuleId;
  readonly stat: AdaptiveStatKey;
  readonly priorBps: number;
  readonly observedBps: number;
  readonly estimateBps: number;
  readonly deviationBps: number;
  readonly sampleN: number;
  readonly confidenceBps: number;
  readonly confidenceState: SnapshotConfidenceState;
  readonly sources: readonly AdaptiveStatSourceRef[];  // {source, valueBps, sampleN, note}
  readonly target: AdaptiveTarget;
  readonly rawContributionBps: number;
  readonly contributionBps: number;   // after per-rule cap + multiway scaling
  readonly cappedBy: AdaptiveCapId | null;
  readonly reasonKey: AdaptiveReasonKey;
  readonly note: string;
  readonly opponentPlayerId: string;
}
```
J3's "sample n / confidence / source / reason" is satisfied field-by-field.

---

## 4. Frequency adaptation (J4)

### 4.1 Baseline DTO — what `apps/web` hands to `adaptive-core`

```ts
export type AdaptiveTarget = 'AGGRESSION' | 'CONTINUE' | 'FOLD';

export interface AdaptiveBaselineAction {
  readonly kind: StrategyActionKind;       // strategy-core's own union
  readonly frequencyBps: number;           // multiple of 500, set sums to 10000
  readonly toAmountMbb: MilliBB | null;
  readonly isAllIn: boolean;
}

export interface AdaptiveBaselineSizing {
  readonly kind: 'BET' | 'RAISE';
  readonly bucketIndex: number;            // index into POT_FRACTION_BUCKETS, or -1 for ALL_IN
  readonly potFractionPercent: number | null;
  readonly toAmountMbb: MilliBB;
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
  readonly heroStreetContributionMbb: MilliBB;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  readonly allIn: boolean;
}

export interface AdaptiveBaseline {
  readonly street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
  readonly heroFacingBet: boolean;
  readonly activeOpponentCount: number;
  /** postflop only: the REFERENCE engine's OWN aggression band. Read, never re-derived. */
  readonly aggressionBand: AggressionBandId | null;
  readonly actions: readonly AdaptiveBaselineAction[];
  readonly primaryKind: StrategyActionKind;
  readonly sizing: AdaptiveBaselineSizing | null;
}
```

Strength categories, from the engine's own band (no new authoring):
- `VALUE`    = `DOMINANT`, `STRONG`
- `MARGINAL` = `MODERATE`, `NEUTRAL`
- `WEAK`     = `WEAK`, `POOR`, `GIVE_UP`

### 4.2 Rule table — `packages/adaptive-core/src/policy/frequencyModel.ts`

Data only, zero constants in logic code (the `scoreModel.ts` convention). Every entry:
`{ id, stat, streets, appliesWhen, bands, direction, target, gainBps, maxBps, provenance:'HEURISTIC', note, reasonKey }`.

MVP rule set (conservative, per J4's closing instruction):

| id | stat | when | direction | target | gain | cap |
|---|---|---|---|---|---|---|
| `FOLD_TO_CBET_HIGH` | `FOLD_TO_CBET_{street}` | hero may bet/raise | above prior | +AGGRESSION | 4000 | 1000 |
| `FOLD_TO_CBET_LOW` | `FOLD_TO_CBET_{street}` | hero may bet/raise | below prior | −AGGRESSION | 4000 | 1000 |
| `CHECK_RAISE_HIGH` | `CHECK_RAISE_{street}` | hero may bet, bands VALUE∪MARGINAL∪WEAK | above prior | −AGGRESSION | 6000 | 1000 |
| `WTSD_HIGH_BLUFF_DOWN` | `WTSD` | hero may bet, bands MARGINAL∪WEAK | above prior | −AGGRESSION | 3000 | 800 |
| `WTSD_LOW_BLUFF_UP` | `WTSD` | hero may bet, bands MARGINAL∪WEAK | below prior | +AGGRESSION | 3000 | 600 |
| `WTSD_HIGH_VALUE_UP` | `WTSD` | hero may bet, bands VALUE | above prior | +AGGRESSION | 2500 | 600 |
| `VILLAIN_CBET_HIGH` | `CBET_{street}` | hero facing a bet | above prior | +CONTINUE | 3000 | 800 |
| `VILLAIN_CBET_LOW` | `CBET_{street}` | hero facing a bet | below prior | +FOLD | 3000 | 800 |
| `THREE_BET_HIGH_TIGHTEN` | `THREE_BET` | preflop, hero opening | above prior | +FOLD | 2500 | 800 |
| `FOLD_TO_3BET_HIGH` | `FOLD_TO_THREE_BET` | preflop, hero facing an open | above prior | +AGGRESSION | 4000 | 1000 |
| `FOLD_TO_3BET_LOW` | `FOLD_TO_THREE_BET` | preflop, hero facing an open | below prior | −AGGRESSION | 4000 | 800 |
| `FOLD_BB_TO_STEAL_HIGH` | `FOLD_BB_TO_STEAL` | preflop, hero opening from CO/BTN/SB | above prior | +AGGRESSION | 3000 | 800 |

Contribution:
```
dev = estimate - prior
if sign(dev) does not match `direction` -> contribution 0, rule not recorded
raw     = floor(abs(dev) * gainBps / 10000)
scaled  = floor(raw * confBps / 10000)
capped  = min(scaled, maxBps)
```
Rules whose `capped === 0` are dropped (no empty reason lines in the UI).

### 4.3 Applying, capping, requantizing

1. Sum contributions per target. `AGGRESSION` moves mass onto the aggressive kinds present
   in the baseline (`BET`,`RAISE`,`ALL_IN`), `CONTINUE` onto `CALL`/`CHECK`, `FOLD` onto
   `FOLD`. Mass is taken pro-rata from the other targets' actions.
2. **Global cap.** `totalShiftBps = sum(|adjusted - baseline|) / 2`, capped at
   `MAX_TOTAL_SHIFT_BPS`: `2000` heads-up (`activeOpponentCount <= 1`), `1000` multiway.
   If exceeded, every contribution is scaled by the same integer ratio (documented, so the
   mix stays proportional) and `capApplied` is set.
3. Floor every action at 0; renormalize to exactly 10000 with `apportion`.
4. Quantize with **`quantizeFrequencies` imported from `@gto-self/strategy-core`** — the
   500bps grid and the sum-to-10000 guarantee are the REFERENCE engine's own function, not
   a copy.
5. Re-pick the primary with **`pickPrimaryAction`** from `@gto-self/strategy-core`.

**Hard invariants, tested (J10.9):**
- ADAPTIVE never introduces an action kind the baseline set does not contain. An action
  REFERENCE gave no row at all stays absent. (MVP limitation, documented in the report.)
- Every frequency is a non-negative multiple of 500; the set sums to exactly 10000.
- No amount is ever produced for an action kind that had none.

**Gate.** A rule only fires when `confBps >= FREQUENCY_MIN_CONFIDENCE_BPS = 2500`.
When nothing fires, `status = 'INSUFFICIENT_DATA'` and `actions` is the baseline verbatim.

---

## 5. Sizing adaptation (J5)

### 5.1 Separate pass, separate gate, POSTFLOP ONLY in the MVP

Preflop sizing is a raise-TO rule, not a pot fraction; moving it is deliberately out of the
MVP and recorded as a limitation. Postflop moves along `POT_FRACTION_BUCKETS` only.

Gate: `SIZING_MIN_CONFIDENCE_BPS = 5000` heads-up, `7500` multiway — strictly higher than
the frequency gate, exactly as J5 requires. Net bucket delta is clamped to `[-1, +1]`.

| id | stat | band | direction | steps |
|---|---|---|---|---|
| `SIZE_STATION_VALUE_UP` | `WTSD` | VALUE | above prior | +1 |
| `SIZE_STATION_VALUE_UP_FOLD` | `FOLD_TO_CBET_{street}` | VALUE | below prior | +1 |
| `SIZE_FOLDY_BLUFF_DOWN` | `FOLD_TO_CBET_{street}` | WEAK | above prior | −1 |
| `SIZE_CHECK_RAISE_DOWN` | `CHECK_RAISE_{street}` | MARGINAL ∪ WEAK | above prior | −1 |

### 5.2 Resolving a moved bucket to a legal amount

`newIndex = clamp(baselineIndex + delta, 0, POT_FRACTION_BUCKETS.length - 1)`. ALL_IN
(`bucketIndex === -1`) is never moved. Then:

```
toAmount = potFractionToAmount({potBeforeDecisionMbb, callAmountMbb,
                                heroStreetContributionMbb}, bucket)
sizing   = clampPostflopSizing({ruleId:'SIZING_POT_FRACTION_TO_AMOUNT',
                                toAmountMbb: toAmount, selection}, wager)
```
Both functions come from `@gto-self/strategy-core`. `requestedToAmountMbb` is retained and
shown (CLAUDE.md rule 3). An adaptive size is therefore, by construction, one of the eight
buckets, clamped into the engine's own legal window.

### 5.3 The ONE additive change to `strategy-core`

`packages/strategy-core/src/postflop/sizing.ts` currently computes the bucket→milliBB
arithmetic inline inside `sizingRequestFor`, which needs a whole `PostflopContext`.
Extract, with NO behaviour change:

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
`sizingRequestFor` then calls it. Exported from `postflop/index.ts`. This is the alternative
to `adaptive-core` re-implementing the formula, which would be a second, drifting copy of
the sizing arithmetic. Existing postflop sizing tests must pass UNCHANGED — that is the
proof the extraction is behaviour-preserving.

---

## 6. Live edit inside the session (J6)

- `apps/web/src/lib/table/adaptiveStore.ts` — a small zustand store (mirroring
  `tableStore`'s idiom) holding `Record<playerId, AdaptiveOpponentInput>` plus an integer
  `version`. It holds NO poker state and writes nothing.
- Loaded by `loadAdaptiveInputsAction(playerIds)` when the seat lineup changes.
- `PlayerProfilePanel`'s HUD save already returns the updated `PlayerProfileView`; the
  `TableRoot` handler pushes the remapped inputs into the store and bumps `version`.
- `StrategyPanel` keeps its existing REFERENCE effect **untouched** (the `setTimeout(0)`
  scheduling and the `hand`-identity dependency do not change). ADAPTIVE is a `useMemo`
  over `[referenceModel, opponentInputs, version, mode]`. Composition is pure integer math
  on a handful of arrays — no equity, no ranges — so it runs in render.

Consequences, which the tests pin (J10.6/7/8):
- a HUD save recomputes ADAPTIVE and does NOT recompute REFERENCE;
- a HUD save writes a NEW `player_hud_snapshots` row and mutates no learned model;
- an analysis run writes a NEW `player_model_snapshots` row and mutates no HUD row;
- no hand event and no already-written trace is rewritten (DB triggers make this
  structural, not a convention).

---

## 7. Trace (J7)

New table `adaptive_strategy_traces`, migration `0007_adaptive_strategy_traces.sql`,
INSERT-ONLY with the standard two triggers. It is a SEPARATE table from
`strategy_decision_traces` — that table's `strategy_mode` CHECK is `in ('REFERENCE')` and
stays that way, so a REFERENCE trace can never be confused with a derived ADAPTIVE one.

| column | type | note |
|---|---|---|
| `id` | TEXT PK | `${handId}:${commandSeq}:ADAPTIVE` |
| `hand_id` | TEXT FK hands | restrict/restrict |
| `command_seq` | INTEGER | |
| `reference_trace_id` | TEXT FK strategy_decision_traces, NULL | the baseline it derives from |
| `street` | TEXT | CHECK vocabulary |
| `hero_seat` | INTEGER | seatRange |
| `status` | TEXT | CHECK `in ('ADAPTED','INSUFFICIENT_DATA')` |
| `adaptive_policy_version` | TEXT | |
| `primary_villain_player_id` | TEXT FK players, NULL | |
| `opponent_count` | INTEGER | countRange |
| `baseline_actions_json` | TEXT | |
| `adaptive_actions_json` | TEXT | |
| `frequency_delta_json` | TEXT | per-kind signed bps |
| `baseline_primary_action` | TEXT | CHECK action vocabulary |
| `adaptive_primary_action` | TEXT | CHECK action vocabulary |
| `baseline_to_amount_mbb` | INTEGER NULL | moneyRange |
| `adaptive_to_amount_mbb` | INTEGER NULL | moneyRange |
| `baseline_sizing_bucket` | INTEGER NULL | −1..7 |
| `adaptive_sizing_bucket` | INTEGER NULL | −1..7 |
| `total_shift_bps` | INTEGER | bpsRange |
| `cap_applied` | INTEGER | 0/1 |
| `adjustments_json` | TEXT | full `AdaptiveAdjustment[]`: stat, n, confidence, source, reason |
| `manual_hud_snapshot_ids_json` | TEXT | per-opponent, provenance kept |
| `player_model_snapshot_ids_json` | TEXT | per-opponent |
| `player_model_version` | INTEGER NULL | primary villain's snapshot `modelVersion` |
| `computed_at` | INTEGER | timeWindow |
| `source` | TEXT | CHECK `in ('LIVE','BACKFILL')` |

`uniqueIndex(hand_id, command_seq)`. Repository `packages/db/src/repositories/adaptive-traces.ts`
copies `strategy-traces.ts`'s idiom exactly, including the `PERSISTED | ALREADY_PERSISTED`
outcome so a re-run is a no-op.

**Required companion edits (they are tripwires, not optional):**
- `packages/db/tests/insert-only.test.ts` — add
  `adaptive_strategy_traces_no_delete` / `_no_update` in alphabetical position.
- `packages/db/tests/migrations.test.ts` — add the table to `TABLES` and every integer
  column to `INTEGRAL_COLUMNS`.
- `packages/db/src/index.ts` — export the new repository.
- `packages/db/drizzle/meta/_journal.json` + `meta/0007_snapshot.json`.

---

## 8. UI (J8)

`StrategyPanel` gains a two-button mode selector:
`[ 기본전략 · REFERENCE ] [ 상대 적응 · ADAPTIVE ]` (local component state, default REFERENCE).

ADAPTIVE, when `status === 'ADAPTED'`:
```
상대 적응 · ADAPTIVE            (상대: <nickname>)
BET 75%   ·  67% POT

기본전략      BET 55%  ·  50% POT
상대 반영     BET +20%  ·  사이즈 +1 단계

이유
 • Fold to CBet 71% (n=42, 신뢰도 51%)
 • Check/Raise 4% (n=25, 신뢰도 38%)
 • WTSD 낮음 22% (n=61, 신뢰도 60%)
전체 이동 1,850bps / 상한 2,000bps
```
When `status === 'INSUFFICIENT_DATA'`:
```
상대 적응 · ADAPTIVE
데이터 부족 — REFERENCE 사용 중
(사유: 표본이 신뢰도 기준 25%에 못 미침)
```
No adaptive number is ever fabricated in that state; the panel shows the REFERENCE rows.

All copy goes through `apps/web/src/lib/table/copy.ts` as exhaustive
`Readonly<Record<Enum, string>>` maps — one for `AdaptiveReasonKey`, one for
`AdaptiveStatKey`, one for `AdaptiveRuleId`, one for status. A new enum member must be a
compile error, matching the file's existing convention.

Additionally: `PlayerProfilePanel`'s `EDITABLE_HUD_KEYS` grows from 4 to all **8**
`HudStatKey` members (no schema change, the keys already validate), and the hand-sample
field gets a note that it is what gives a HUD reading its weight.

---

## 9. Multi-opponent (J9)

```ts
export interface AdaptiveOpponentRole {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly role: 'PRIMARY' | 'BEHIND' | 'OTHER';
}
```
- `PRIMARY` — the villain hero's decision most directly faces: the last aggressor on this
  street when hero faces a bet, otherwise the first live opponent still to act after hero.
  Only the PRIMARY opponent's profile drives the rule table.
- `BEHIND` — live opponents who act after hero this street.
- Multiway (`activeOpponentCount >= 2`) global cap is `1000` bps, half the heads-up `2000`.
- **The J9 guard rail, tested (J10.11):** if ANY `BEHIND` opponent has
  `CHECK_RAISE_{street}` or `THREE_BET` above prior at `confBps >= BEHIND_AGGRESSION_GATE_BPS
  = 2500`, every POSITIVE `AGGRESSION` contribution is zeroed (`cappedBy =
  'AGGRESSIVE_PLAYER_BEHIND'`). Negative (de-escalating) contributions are kept. Increasing a
  bluff because the current actor folds a lot, while a known check-raiser is still to act, is
  exactly the mistake the prompt names.
- Sizing adaptation multiway needs `confBps >= 7500` and is still clamped to ±1.

---

## 10. Tests (J10) — all twelve, deterministic, no RNG, no clock

| # | assertion | home |
|---|---|---|
| 1 | same HandState, tight A vs loose B: REFERENCE byte-identical, ADAPTIVE different | `adaptive-core` + `apps/web` |
| 2 | Fold-to-CBet 75% n=100 moves strictly more than 100% n=2 | `adaptive-core` |
| 3 | calling station: value sizing larger AND weak-band aggression lower | `adaptive-core` |
| 4 | nit / high fold: bluff frequency up, size may go smaller | `adaptive-core` |
| 5 | high check-raise: marginal-band aggression down | `adaptive-core` |
| 6 | HUD changed mid-session: ADAPTIVE recomputes, REFERENCE unchanged | `apps/web` component test |
| 7 | manual HUD write does not mutate the learned model | `apps/web` server test (real DB) |
| 8 | learned model write does not mutate the manual HUD | `apps/web` server test (real DB) |
| 9 | frequencies: sum 10000, 500 grid, legal kinds only, legal sizing only | `adaptive-core` property-style sweep |
| 10 | low confidence -> `INSUFFICIENT_DATA`, output === baseline | `adaptive-core` |
| 11 | multiway bounded + aggressive-player-behind zeroes positive aggression | `adaptive-core` |
| 12 | same inputs -> bit-identical output (deep equal over two runs, and a JSON digest) | `adaptive-core` |

Plus: `adaptive-core/tests/layering.test.ts`, the db migration/trigger tripwires, and an
E2E that switches the panel to ADAPTIVE and back.

---

## 11. Work packages and ownership

| WP | scope | owns these files | depends on |
|---|---|---|---|
| **J-A** | `adaptive-core` foundation: package scaffold, stats, priors, profile, confidence, layering test | `packages/adaptive-core/**` (§2,§3) | — |
| **J-B** | db: migration 0007, schema, rows decoder, repository, tripwire updates | `packages/db/**` | — |
| **J-C** | `adaptive-core` policy: frequency, sizing, multiway, compose; the strategy-core extraction | `packages/adaptive-core/src/policy/**`, `compose.ts`, `strategy-core/src/postflop/sizing.ts` + `index.ts` | J-A |
| **J-D** | web server: `adaptive-service.ts`, source mapping, actions, adaptive trace generation | `apps/web/src/server/**`, `apps/web/src/lib/table/contract.ts` | J-A, J-B, J-C |
| **J-E** | web UI: baseline DTO builder, adaptiveStore, StrategyPanel mode, copy, PlayerProfilePanel 8 keys | `apps/web/src/lib/table/{strategy,adaptive,adaptiveStore,copy}.ts`, `components/table/{StrategyPanel,PlayerProfilePanel,TableRoot}.tsx` | J-C, J-D |
| **J-F** | integration + E2E + report | `docs/reports/HARDENING_WP_J_*`, e2e spec | all |

J-A and J-B run in parallel (different packages, no shared file). J-C follows J-A.
J-D and J-E are serialized on `contract.ts`. Nobody but J-C touches `strategy-core`,
and only for §5.3.
