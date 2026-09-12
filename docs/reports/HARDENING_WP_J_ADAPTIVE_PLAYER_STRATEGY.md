# WP-J — Player-specific ADAPTIVE strategy (Strategy C2)

2026-09-02. Orchestrator's consolidated report for `prompt` §J1..J11.

Per-work-package detail lives beside this file:
`HARDENING_WP_J_DESIGN.md` (the contract written before implementation),
`_J_A_ADAPTIVE_CORE`, `_J_B_ADAPTIVE_TRACE_DB`, `_J_C_ADAPTIVE_POLICY`,
`_J_D1_ADAPTIVE_SERVICE`, `_J_D2_ADAPTIVE_TRACE_SERVICE`, `_J_E1_WEB_ADAPTIVE_SEAM`,
`_J_E2_ADAPTIVE_UI`, `_J_F_E2E`, `_J_REVIEW_R1`.

Decisions: **ADR-0063** (the package boundary), **ADR-0064** (the prior as a
zero-adjustment anchor), **ADR-0065** (bounded adaptation on the REFERENCE quantizer),
**ADR-0066** (separate derived traces; live edit recomputes ADAPTIVE only).

---

## 1. Architecture (J1)

```
shared
  ^
  +-- poker-core  <-  coinpoker-parser
  |       ^
  |       +-- strategy-core          REFERENCE. Never sees player data.
  |
  +-- player-core                    manual HUD + learned model types
  |       ^
  |       +-- analysis-core          event log -> observations (apps/web only, ADR-0061)
  |
  +-- adaptive-core   <-- NEW        REFERENCE + profile -> ADAPTIVE
              ^
           apps/web
```

`adaptive-core` imports `shared`, `strategy-core`, `player-core` and nothing else.
It never imports `analysis-core` (ADR-0061 stands unamended), `db`, `poker-core`,
`gto-core` or React. Learned-model numbers reach it as a neutral DTO built by
`apps/web/src/server/adaptive-service.ts`.

**The invariant.** `computeStrategy(state, heroSeat, options)` did not change. ADAPTIVE is
a SECOND call that takes the REFERENCE result AS A VALUE. Player data has no path into a
REFERENCE number — enforced four ways, all live:

1. ESLint per-package `no-restricted-imports` blocks (flat config is last-match-wins, so
   every block restates its full list).
2. `packages/strategy-core/tests/layering.test.ts` — a raw-text specifier scan that catches
   even `import type`, with two self-tests so it cannot pass vacuously.
3. `packages/adaptive-core/tests/layering.test.ts` — the same technique, retargeted.
4. Behavioural pins: `adaptive-core` asserts the echoed baseline is deep-equal across two
   opponent sets; `apps/web` asserts `computeStrategy`'s output is deep-equal AND
   `JSON.stringify`-equal across two opponent sets; the E2E captures the rendered REFERENCE
   recommendation before a HUD save and asserts it identical after.

The lint bans were probed with throwaway files during J-A: all six `adaptive-core` bans
fire, and the upward ban fires from all seven lower blocks.

---

## 2. The stats and where they come from (J2)

17 keys, exactly the brief's list, as a closed union
(`packages/adaptive-core/src/stats.ts`). A new opponent fact is a reviewed addition plus an
exhaustive-map compile error everywhere it is displayed — never an untyped string.

| stat | manual HUD | learned model |
|---|---|---|
| VPIP, PFR, THREE_BET, FOLD_TO_THREE_BET | yes | yes |
| CBET_FLOP, FOLD_TO_CBET_FLOP, WTSD, WSD | yes | yes |
| STEAL | — | `STEAL_ATTEMPT` |
| FOLD_BB_TO_STEAL | — | `FOLD_TO_STEAL`, **BB positional row** |
| CBET_TURN/RIVER, FOLD_TO_CBET_TURN/RIVER, CHECK_RAISE_FLOP/TURN/RIVER | — | yes |

Two scope honesty notes, carried verbatim to the UI on the observation itself:

- `analysis-core` scopes `FOLD_TO_STEAL` to SB **or** BB. The `position: null` aggregate is
  therefore NOT fold-BB-to-steal. We read the **BB positional row**, note
  `'BB 포지션 행에서 읽음'`, and alias nothing. A test gives the two rows different numbers
  and asserts the BB row's numbers are the ones used.
- `STEAL` is `STEAL_ATTEMPT` (RFI from CO/BTN/SB), noted as such.

`opportunities === 0` drops the row entirely — "never had the chance" is never rendered
as 0%.

**The manual HUD reaches 8 of 17 stats, and `HudStatKey` was deliberately NOT widened.**
`player_hud_snapshot_stats.stat_key` carries `CHECK ... in (HUD_STAT_KEYS)`, and SQLite
cannot ALTER a CHECK — widening it means a 12-step rebuild of an INSERT-ONLY table, which
ADR-0046 rules out. What was done instead is free and real: the profile panel's edit form
went from 4 exposed keys to all 8 that already validate. See §13.

---

## 3. Confidence and the formula (J3)

```
nM, vM  manual sample / value      (0 when absent)
nL, vL  learned sample / value     (0 when absent)
n        = nM + nL
observed = n === 0 ? prior : round((vM*nM + vL*nL) / n)
confBps  = confidenceWeightBps(n, K)        // round(10000*n/(n+K))
estimate = round((prior*(10000-confBps) + observed*confBps) / 10000)
state    = snapshotConfidenceState(n, {k: K, learningThreshold: 5, knownThreshold: 30})
```

`confidenceWeightBps` and `snapshotConfidenceState` are **imported from `player-core`** —
ADR-0062's C1 framework reused and extended per-stat, not re-implemented. Integer basis
points end to end; division is `floor((2a+b)/2b)` so no float enters the path and
`JSON.stringify` equality is a meaningful determinism check.

`K` is per-stat rather than a single 30, because a river check-raise and a VPIP do not
accumulate opportunities at the same rate: 50 for VPIP/PFR/WTSD, 40 for the preflop
aggression stats and the flop-scoped ones, 30 turn, 25 river.

**The prior is the zero-adjustment anchor (ADR-0064).** Every rule fires on
`estimate - prior`. At zero confidence the estimate IS the prior, every contribution is
exactly 0, and ADAPTIVE equals REFERENCE by construction rather than by a special case. The
priors are `Provenanced<number>` at `HEURISTIC` with mandatory notes, are never labelled
GTO, and are never displayed as an opponent's expected frequency.

### Pinned arithmetic — `FOLD_TO_CBET_FLOP`, prior 4500, K 40

| observed | n | confBps | estimate | deviation |
|---|---|---|---|---|
| 10000 (100%) | 2 | 476 | 4762 | **+262** |
| 7500 (75%) | 100 | 7143 | 6643 | **+2143** |

That is J10.2: the 75%-over-100 read moves the strategy ~8x further than the
100%-over-2 read. Pooling is pinned too — MANUAL 6000/n=40 + LEARNED 8000/n=60 → observed
7200, estimate 6429, with **both source refs retained** in `sources`.

Every adjustment carries `stat`, `priorBps`, `observedBps`, `estimateBps`, `deviationBps`,
`sampleN`, `confidenceBps`, `confidenceState`, `sources[]`, `target`, `rawContributionBps`,
`contributionBps`, `cappedBy`, `reasonKey`, `note`, `opponentPlayerId` — J3's
"sample n / confidence / source / reason" satisfied field by field.

---

## 4. Frequency adaptation (J4)

12 rules, exported as DATA (`policy/frequencyModel.ts`), zero policy literals in logic
code — the `scoreModel.ts` convention. Street-relative stats are one documented `BY_STREET`
selector rather than three near-duplicate rules, so there is one rule id per UI copy line
and per trace token.

| id | stat | scope | dir | target | gain | cap |
|---|---|---|---|---|---|---|
| `FOLD_TO_CBET_HIGH` / `_LOW` | `FOLD_TO_CBET_{street}` | hero may bet/raise | ± | ∓AGGRESSION | 4000 | 1000 |
| `CHECK_RAISE_HIGH` | `CHECK_RAISE_{street}` | hero may bet | above | −AGGRESSION | 6000 | 1000 |
| `WTSD_HIGH_BLUFF_DOWN` / `WTSD_LOW_BLUFF_UP` | `WTSD` | bet, MARGINAL∪WEAK | ± | ∓AGGRESSION | 3000 | 800/600 |
| `WTSD_HIGH_VALUE_UP` | `WTSD` | bet, VALUE | above | +AGGRESSION | 2500 | 600 |
| `VILLAIN_CBET_HIGH` / `_LOW` | `CBET_{street}` | hero facing a bet | ± | +CONTINUE / +FOLD | 3000 | 800 |
| `THREE_BET_HIGH_TIGHTEN` | `THREE_BET` | preflop, hero opening | above | +FOLD | 2500 | 800 |
| `FOLD_TO_3BET_HIGH` / `_LOW` | `FOLD_TO_THREE_BET` | preflop, facing an open | ± | ±AGGRESSION | 4000 | 1000/800 |
| `FOLD_BB_TO_STEAL_HIGH` | `FOLD_BB_TO_STEAL` | preflop, opening CO/BTN/SB | above | +AGGRESSION | 3000 | 800 |

Strength categories are read from the REFERENCE engine's OWN
`scoring.aggressionBand.id`, never re-derived: `VALUE` = DOMINANT|STRONG,
`MARGINAL` = MODERATE|NEUTRAL, `WEAK` = WEAK|POOR|GIVE_UP.

```
dev    = estimate - prior;  wrong direction -> 0
raw    = floor(|dev| * gain / 10000)
scaled = floor(raw * confBps / 10000)
capped = min(scaled, ruleCap)
```
Gate: `confBps >= 2500`. Global cap on total absolute movement: **2000 bps heads-up,
1000 multiway**; over-cap contributions are scaled by one shared integer ratio so the mix
stays proportional. Then: floor at 0, renormalize with `apportion`, quantize with
**`quantizeFrequencies` imported from `strategy-core`**, re-pick the primary with
**`pickPrimaryAction`**. A post-quantization grid trim makes `totalShiftBps <= cap` an
actual guarantee — proportional pre-quantize scaling alone does not survive rounding
across rows.

**ADAPTIVE never introduces an action kind the baseline set does not contain** (ADR-0065).
An action REFERENCE excluded stays excluded. That is an accepted MVP limitation, §13.

---

## 5. Sizing adaptation (J5)

A separate pass with a strictly higher gate, exactly as the brief requires:
`confBps >= 5000` heads-up, `7500` multiway, against frequency's 2500. Net bucket delta is
clamped to ±1. **Postflop only** — preflop sizing is a raise-TO rule, not a pot fraction.

| id | stat | band | dir | steps |
|---|---|---|---|---|
| `SIZE_STATION_VALUE_UP` | `WTSD` | VALUE | above | +1 |
| `SIZE_STATION_VALUE_UP_FOLD` | `FOLD_TO_CBET_{street}` | VALUE | below | +1 |
| `SIZE_FOLDY_BLUFF_DOWN` | `FOLD_TO_CBET_{street}` | WEAK | above | −1 |
| `SIZE_CHECK_RAISE_DOWN` | `CHECK_RAISE_{street}` | MARGINAL∪WEAK | above | −1 |

A moved rung resolves to milliBB through **`potFractionToAmount` + `clampPostflopSizing`
from `strategy-core`** — the engine's own arithmetic and its own legality clamp, with
`requestedToAmountMbb` retained per CLAUDE.md rule 3. ALL_IN (`bucketIndex === -1`) is never
moved. To make that reuse possible without a second copy of the formula, the bucket→milliBB
arithmetic was extracted out of `sizingRequestFor` into an exported pure function. That is
the ONLY change to `strategy-core` this phase; **783 strategy-core tests pass with no test
file edited**, which is the proof it was behaviour-preserving.

---

## 6. Multiway (J9)

Only the PRIMARY opponent's profile drives the rule table. PRIMARY is the live opponent who
made the bet hero faces, otherwise the first live opponent still to act after hero. Ties
break on `actionOrderIndex`, then `seatIndex`, then `playerId` — three levels, because the
output is a stored trace and a tie resolving differently between runs would make it
irreproducible.

**The guard rail.** If any BEHIND opponent has `CHECK_RAISE_{street}` or `THREE_BET` above
prior at `confBps >= 2500`, every POSITIVE AGGRESSION contribution is zeroed with
`cappedBy: 'AGGRESSIVE_PLAYER_BEHIND'`, and the guard was extended to positive sizing rungs
too. Negative (de-escalating) contributions survive. Raising a bluff because the current
actor folds a lot while a known check-raiser is still to act is the exact mistake the brief
names, and it is now structurally prevented, not merely discouraged.

Guard-zeroed rules are **recorded with `contributionBps: 0`, not dropped**, so `cappedBy`
stays observable and the user can see we read the opponent and deliberately did not move.

---

## 7. `status` vs `changedFromBaseline`

Because a rule can fire, be recorded, and then be held at the baseline by the guard, by the
cap, or by quantization rounding its contribution away, `status: 'ADAPTED'` alone would let
the panel badge an adaptation while showing REFERENCE's numbers. The recommendation
therefore also carries **`changedFromBaseline`, computed from the OUTPUT** (some
`deltaBps !== 0`, or the sizing rung moved) rather than from the presence of adjustments.
The UI keys its badge on that flag, never on `status`.

One case pinned by test and worth knowing: a +208 bps contribution is below half a 500-bps
rung, so it quantizes away entirely **while the sizing rung still moves**. Frequency and
size can legitimately disagree about whether anything happened.

---

## 8. Worked before/after examples, from real tests

**A nit who folds to 75% of flop c-bets over 100 opportunities.**
prior 4500 → conf 7143 → estimate 6643 → deviation +2143 → raw
`floor(2143*4000/10000)=857` → scaled `floor(857*7143/10000)=612` → under the 1000 ceiling.
`BET 60% → 65%`, total shift 500 bps.

**A calling station, hero holding a value hand (STRONG band).**
Sizing rung 4 → 5: **7,500 → 10,000 milliBB**, clamp `NONE`, inside the engine's window.

**The same nit, hero holding a weak hand (WEAK band).**
`BET 65%` *and* size **75% → 67% pot** (6,667 mbb) — frequency and sizing moving in opposite
directions, which is precisely why the two passes are separate.

**Multiway.** The same contributions that produce a 1500 bps shift heads-up produce 1000
multiway, with both contributions scaled by one shared ratio (6578) rather than truncating
one of them.

**End to end in a real browser.** 6-handed, hero BB with A5s facing a 2.5 BB button open.
Enter `FOLD_TO_THREE_BET = 90` over `500` hands for the button; ADAPTIVE moves to
`3BET 40% (+1000 bps)` / FOLD 30 / CALL 30, shift `1,000 bps / 상한 2,000 bps`, reason line
`Fold to 3Bet` with `n=500`. REFERENCE, captured before the save, is identical after.

---

## 9. Live edit (J6)

`adaptiveStore` (zustand) holds the per-player neutral inputs plus an integer `version`. A
HUD save refreshes that one player and bumps `version`. `StrategyPanel`'s REFERENCE effect
is **untouched** — same `setTimeout(0)` scheduling, same `[hand, heroSeat, compute]`
dependency; ADAPTIVE is a `useMemo` over `[computed, opponentInputs, adaptiveVersion]`, and
`mode` is in neither. So switching mode or saving a HUD **cannot** re-run `computeStrategy`.
That is structural, and it is also pinned by counting the injected `compute` prop: 1 call
before a mid-hand HUD upsert, 1 after, while every ADAPTIVE number changes.

Nothing rewrites a hand event, a completed hand, or an existing trace — the insert-only
triggers make that structural rather than a convention.

---

## 10. Trace (J7)

`adaptive_strategy_traces`, migration `0007`, 27 columns, INSERT-ONLY with
`_no_update` / `_no_delete` triggers, `uniqueIndex(hand_id, command_seq)`, three
restrict/restrict FKs. It is a SEPARATE table: `strategy_decision_traces`'s
`strategy_mode CHECK in ('REFERENCE')` is untouched, and the migration's upgrade test
asserts an `'ADAPTIVE'` row is still rejected there.

It records the baseline, the adapted mix, the per-action frequency delta, both sizing
buckets and both amounts, the policy version, the primary villain, the manual-HUD and
learned-model snapshot ids per opponent, the model version, and the full per-rule
adjustment audit (stat, n, confidence, source, reason). The authored rule prose is NOT
persisted — `ruleId` reconstructs it exactly, and duplicating prose into every row would
make it the schema's problem to version.

Generation reuses `loadAdaptiveOpponentInputs` and the SAME `computeAdaptive` the live
panel uses, so a trace cannot drift from what the user saw. Hands where nothing was known
still get a row, as `INSUFFICIENT_DATA` with the baseline echoed: skipping would make "we
knew nothing" indistinguishable from "generation never ran", which is what the backfill's
skip-check reads.

---

## 11. UI (J8)

Four states, all keyed on `changedFromBaseline`:

- **adapted** — adapted primary + size, the `기본전략` baseline row beneath it, the
  `상대 반영` delta row, the 이유 list (stat, opponent's estimate, `n=`, 신뢰도 %), and
  `전체 이동 … / 상한 …`, with the opponent named.
- **`데이터 부족 — REFERENCE 사용 중`** — the gate that was not met is named; **no adaptive
  number is fabricated** (asserted by `toHaveCount(0)` on six testids).
- **`조정 없음 — 뒤에 공격적인 상대가 남아 있음 (플랍 체크레이즈)`** — reasoning shown, no
  badge, no `+0%` rendered as a change.
- **`이 상황에는 상대 적응을 적용하지 않습니다`** — for a null answer (no hand, refused, or a
  spot the engine disclaims as UNSUPPORTED).

`근거 휴리스틱 (HEURISTIC)` is always shown. Three tests assert the word GTO never appears.
Six exhaustive Korean `Record` maps mean a new enum member is a compile error.

---

## 12. Tests and gates

Final figures, after the R1 review fixes (`HARDENING_WP_J_REVIEW_R1_RESOLUTION.md`):

| suite | result |
|---|---|
| workspace unit (`pnpm test`) | **136 files passed / 1 skipped; 2307 passed / 3 skipped** |
| `adaptive-core` | 6 files / 106 |
| `db` | 151 |
| `web` | 467 passed / 3 skipped |
| `strategy-core` | 783, no test file edited |
| E2E (`playwright`) | **30 passed**, incl. 2 adaptive specs |
| typecheck · lint · licences · `next build` | clean (`pnpm verify` exit 0) |

All twelve J10 fixtures are implemented; row 9 is a **4,608-composition enumerated sweep**
asserting on every output that frequencies are non-negative multiples of 500 summing to
exactly 10000, that every emitted kind was present in the baseline, that any sizing amount
is inside `[min, max]`, and that `totalShiftBps` is within the applicable cap.

**Performance.** `composeAdaptive` on a 6-way spot: **3.3 µs**. `buildAdjustmentProfile`:
**2.6 µs**. A full five-opponent refresh is ~17 µs against the REFERENCE postflop engine's
~106–152 ms — roughly four orders of magnitude cheaper, which is what makes running the
composition in render on a HUD save safe.

**One flaky pre-existing test.** `strategy-core/src/postflop/benchmark.test.ts` asserts a
6-way limped flop is measurably slower than a heads-up flop. Under load the two came within
0.4% (152.32 vs 152.88 ms) and the comparison inverted. The file is unmodified by this
phase, our only `strategy-core` change is the sizing extraction, and it passes in isolation
— but it is a wall-clock comparison of two nearly-equal measurements and will keep doing
this on a loaded machine. Listed in §13.

**One regression found and fixed.** `action-dock.spec.ts` and `card-palette.spec.ts` assert
`requests === []` on the action path (ADR-0043). `TableRoot`'s mount-time adaptive load
landed inside their recording window. The fix was NOT to weaken the assertion to an
allowlist — it was to make the shared `startSession` helper return only once the table is
on screen and mount activity has settled, so the specs' `toEqual([])` stays at full
strength and a genuine request on the key → `poker-core` → render path still fails them.

---

## 13. Limitations — all deliberate, none silent

1. **ADAPTIVE cannot exploit an action REFERENCE assigns no row.** It re-weights the kinds
   REFERENCE emitted (ADR-0065). A spot where a legal action gets 0% is unreachable this
   milestone.
2. **The manual HUD reaches 8 of the 17 stats.** Widening `HudStatKey` needs a CHECK
   rebuild of an insert-only table, which ADR-0046 rules out. Path forward: a migration
   that drops the CHECK in favour of decoder validation, or a documented rebuild ADR.
3. **Preflop sizing is not adapted.** Pot-fraction rungs are a postflop concept.
4. **The 12 rules and 4 sizing rules are authored heuristics, unbacktested.** They are
   tagged `HEURISTIC` with mandatory notes and are never labelled GTO. Any table change
   must bump `ADAPTIVE_POLICY_VERSION`.
5. **The priors are anchors, not population truth.** A stat whose real population value is
   far from our anchor produces an adjustment at high sample even for an unremarkable
   player — bounded by the caps, but real.
6. **`actsAfterHero` uses first-orbit action order**, so after a re-raise it under-reports
   who is still to act. This can only make the multiway guard fire LESS often than it
   should — wrong in the permissive direction, which is worth knowing.
7. **The manual-HUD sample cap is applied only at the server mapping boundary.** Any
   future builder of an `AdaptiveOpponentInput` must apply `manualHudSampleCap` too, or an
   uncapped HUD hand count reaches the confidence curve unearned.
8. **A manual HUD reading alone cannot move a preflop mix** (review R1, MAJOR 3). Capping the
   effective sample at `floor(K/2)` holds manual confidence at 3333 bps, and confidence is
   applied twice — once shrinking the estimate, once scaling the contribution — so the single
   applicable preflop rule tops out around 155 bps, under half a grid step. The panel is
   honest about it (`ADAPTED`, `changed=false`, both samples shown); the learned model is what
   moves a recommendation. Worked arithmetic in the resolution report. This is the one
   calibration decision most worth revisiting if HUD readings feel inert in use.
9. **`trimToCap`'s no-progress branch is unreachable and untested, and is labelled as such.**
   It needs about `cap / 250` action rows per side; a baseline has at most six.
10. **`reference_trace_id` can be `null` and both tables are insert-only**, so a missing link
   can never be repaired. Backfill order matters: `strategy:backfill` before
   `adaptive:backfill`.
11. **A HUD upsert can lose a race with a lineup load already in flight** (J-E2 §risks).
12. **`learnedSnapshotId` costs a second read**, matched by `modelVersion`, because
    `PlayerModelSnapshot` is a content document with no row id (ADR-0040).
13. The pre-existing wall-clock benchmark comparison in §12.

## 14. Future improvements

- Revisit the double application of confidence (§13.8) — the single change most likely to
  make manual HUD entry feel responsive. It bumps `ADAPTIVE_POLICY_VERSION`.
- Backtest the rule table against recorded hands and replace authored gains with measured
  ones; that is the change that would let any of §13.4 rise above `HEURISTIC`.
- Let ADAPTIVE introduce a legal action REFERENCE gave 0%, behind a much higher confidence
  gate (lifts §13.1).
- A `getLatestSnapshotId` in `packages/db` (removes §13.10).
- Preflop sizing adaptation once there is an anchor for it.
- Widen the manual HUD to the full 17 stats behind the migration in §13.2.
- Read `player_model_bet_sizes` for opponent-specific sizing response, which J5 allows and
  the MVP does not use.
