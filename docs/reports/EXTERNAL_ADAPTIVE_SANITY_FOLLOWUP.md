# WP-K follow-up — ADAPTIVE sanity calibration

Audit and minimal correction of three things WP-K left wrong or under-specified. No
structural change: REFERENCE untouched, `strategy-core` still knows nothing about player
data, the 1% ADAPTIVE grid stands, every existing safety cap stands, and no existing
assertion was deleted or weakened.

Scope: `prompt`'s three numbered items. Everything else in WP-K is out of scope, including
the `EXTERNAL_HUD` 90% confidence policy (ADR-0067), which this pass did not touch.

---

## 1. Strong-value direction — root cause and fix

### 1.1 The reported symptom

| Spot | REFERENCE | Shadow7 (FCB 26%) | acn1977 (FCB 24%) |
| --- | --- | --- | --- |
| flop, STRONG hand | CHECK 40 / BET 60 | CHECK 46 / BET 54 | CHECK 51 / BET 49 |

Both opponents fold to a c-bet well BELOW the 45% anchor, and hero's strong hand was being
bet LESS often as a result. That is not a claim this project holds.

### 1.2 Numeric trace of the old behaviour

`EXTERNAL_HUD` uses a fixed 9000 bps confidence, so
`estimate = round((prior·1000 + value·9000) / 10000)`.

**Shadow7, flop, STRONG:**

| Stat | value | prior | estimate | deviation | rule | raw | ×0.9 | applied |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FOLD_TO_CBET_FLOP` | 2600 | 4500 | 2790 | **−1710** | `FOLD_TO_CBET_LOW` (gain 4000) | 684 | 615 | **−615** |
| `WTSD` | 3000 | 2700 | 2970 | **+270** | `WTSD_HIGH_VALUE_UP` (gain 2500) | 67 | 60 | **0** |

The +60 was zeroed. Net −615 on a 6000 bps BET → 5385 → **BET 54 / CHECK 46**. Exactly the
reported number.

**acn1977, flop, STRONG:** `FOLD_TO_CBET_LOW` −680, `CHECK_RAISE_HIGH` −437
(`CHECK_RAISE_FLOP` estimate 1610 vs an 800 anchor, gain 6000), `WTSD_HIGH_VALUE_UP` +222
zeroed. Net −895 → **BET 49 / CHECK 51**.

### 1.3 Root cause — two faults, compounding

**(a) Band scope.** `FOLD_TO_CBET_LOW` carried `bands: null` and `CHECK_RAISE_HIGH` carried
all three bands, so both aggression-DECREASING rules read a VALUE hand. "They never fold"
and "they check-raise" are reasons to stop BLUFFING, not reasons to stop value betting.

The check-raise half of this was an outright internal contradiction: the sizing table's
`SIZE_CHECK_RAISE_DOWN` has been scoped to `['MARGINAL','WEAK']` since WP-J, and its own
authored note reads *"a VALUE hand facing a check-raiser wants the opposite treatment —
being raised is the good outcome"*. The frequency pass was doing the opposite of what the
sizing pass documented for the same stat.

**(b) The §9 guard rail turns a symmetric table into a one-way ratchet.** ADR-0065(e) zeroes
every POSITIVE `AGGRESSION` contribution while a live opponent with an above-anchor
`THREE_BET` or street `CHECK_RAISE` is still to act. Shadow7's `THREE_BET` is 10% against a
7% anchor; acn1977's flop `CHECK_RAISE` is 17% against 8%. So in every "hero may bet,
villain behind" spot — the most common postflop spot at this table — the value-UP rule was
refused while the value-DOWN rules applied in full. There was no configuration in which the
value band could go up, and several in which it could only go down.

### 1.4 The fix (generalized, not fixture-specific)

`packages/adaptive-core/src/policy/frequencyModel.ts`:

| Rule | Before | After |
| --- | --- | --- |
| `FOLD_TO_CBET_LOW` | `bands: null` | `['MARGINAL','WEAK']`, gain/cap unchanged (4000 / 1000) |
| `FOLD_TO_CBET_LOW_VALUE_UP` | — | **NEW**: `['VALUE']`, `BELOW_PRIOR`, `INCREASE` `AGGRESSION`, gain 3000, cap 800 |
| `CHECK_RAISE_HIGH` | `['VALUE','MARGINAL','WEAK']` | `['MARGINAL','WEAK']`, gain/cap unchanged (6000 / 1000) |

The new rule is the exact shape WTSD has had since WP-J
(`WTSD_HIGH_BLUFF_DOWN` / `WTSD_HIGH_VALUE_UP`), applied to the more direct of the two
station reads. Its gain and ceiling sit one notch under its bluff twin for the reason
`WTSD_HIGH_VALUE_UP` already gives: against a station the interesting change is the SIZE,
and `SIZE_STATION_VALUE_UP_FOLD` already carries that read with a full rung.

**The §9 guard rail was NOT modified.** It is a safety cap and `prompt` says to keep the
existing caps. Its interaction is now benign rather than perverse: the engine will HOLD a
value bet at REFERENCE when a known aggressor is behind, and it will no longer CUT one.

### 1.5 After — the same spots

| Spot | REFERENCE | Shadow7 | acn1977 |
| --- | --- | --- | --- |
| 4 flop STRONG value (villain behind) | CHECK 40 / BET 60 | **CHECK 40 / BET 60** | **CHECK 40 / BET 60** |
| 7 turn STRONG value (villain behind) | CHECK 40 / BET 60 | **CHECK 40 / BET 60** | **CHECK 40 / BET 60** |
| 5 flop WEAK bluff | CHECK 40 / BET 60 | CHECK 47 / BET 53 | CHECK 54 / BET 46, size −1 |
| **9 flop STRONG value, villain already bet** (new) | FOLD 10 / CALL 40 / RAISE 50 | **FOLD 9 / CALL 39 / RAISE 52** | **FOLD 8 / CALL 42 / RAISE 50** |

Spots 4 and 7 land exactly on REFERENCE: all three surviving rules fire and are then held by
the guard (`cappedBy: 'AGGRESSIVE_PLAYER_BEHIND'`), which the panel still explains. Spot 9
is new, added precisely so the corrected direction is visible with the real fixtures —
Shadow7's `RAISE 50% → 52%` is `FOLD_TO_CBET_LOW_VALUE_UP` contributing +461 bps.

Away from the guard, the direction split is unambiguous. Against a villain reading only
`FOLD_TO_CBET_FLOP 20%` over 100 opportunities:

| Hero's band | BET frequency | Size | Rules |
| --- | --- | --- | --- |
| STRONG (VALUE) | 60% → **64%** | **+1 rung** | `FOLD_TO_CBET_LOW_VALUE_UP`, `SIZE_STATION_VALUE_UP_FOLD` |
| WEAK (bluff) | 60% → **55%** | 0 | `FOLD_TO_CBET_LOW` |

and against a villain reading only `CHECK_RAISE_FLOP 30%`:

| Hero's band | BET frequency | Size | Rules |
| --- | --- | --- | --- |
| STRONG (VALUE) | 60% → **60%** (untouched) | 0 | none |
| MARGINAL | 60% → **53%** | **−1 rung** | `CHECK_RAISE_HIGH`, `SIZE_CHECK_RAISE_DOWN` |

`prompt` §1's question — "should bluff aggression down and value aggression up/hold move in
different directions?" — is answered yes, and it is now a permanent test rather than an
observation.

---

## 2. WSD sizing rule — removed as a primary signal, kept as a secondary one

### 2.1 The judgement, with its evidence

`SIZE_WINNER_VALUE_UP` (WP-K §7) sized a VALUE bet up one rung whenever `WSD` sat above its
anchor. The claim behind it does not hold:

- **The poker.** `WSD` is measured only among hands that ALREADY reached a showdown. A high
  `WSD` says the opponent's showdown range is strong, not that they call more. The player
  who reaches showdown often and WINS is closer to a good player than to a station; if
  anything they are harder to extract from, not easier. The genuine station combination is
  high `WTSD` with LOW `WSD`.
- **The codebase already said so.** `WSD`'s anchor note in `priors.ts` has read since WP-J:
  *"unlike every other stat here we have no directional opinion at all about this one: it is
  carried for display and for future rules"*. WP-K then authored a directional rule on it.
  The rule and the anchor contradicted each other, and the anchor is the reviewed one.
- **The fixtures.** Shadow7 (`WSD 53%`) triggered `SIZE_WINNER_VALUE_UP` in golden spots 4
  and 7; acn1977 (`WSD 43%`) did not. So the rule's effect was to charge the TIGHTER of the
  two profiles more — the opposite of the intent.

Full deletion was considered and rejected. `prompt` §2 names the better option and the
stats support it: `WTSD` and `FOLD_TO_CBET` are the primary sizing signals, and `WSD`'s real
job is to DISAMBIGUATE the first of them.

### 2.2 The mechanism

New optional field on `AdaptiveSizingRule`:

```ts
readonly suppressedWhen?: {
  readonly stat: AdaptiveStatKey;
  readonly direction: AdaptiveRuleDirection;
  readonly note: string;      // MANDATORY, same as every other model number
};
```

One instance, on `SIZE_STATION_VALUE_UP` (the `WTSD` station size-up):
`{ stat: 'WSD', direction: 'ABOVE_PRIOR' }`. A high `WTSD` has two readings — the station
who calls too wide and loses, and the strong player who gets there with hands that win —
and `WSD` separates them. An opponent above BOTH anchors is not evidently the player the
rule was written about, so the extra rung is withheld.

Three safety properties, stated in the type and pinned by tests:

1. **A suppressor can only ever REMOVE a rung.** It never adds one, never flips a sign, and
   never fires a rule. The whole mechanism can only make ADAPTIVE move less.
2. **It is held to the same confidence gate as the primary signal** (5000 heads-up / 7500
   multiway). A rule may not be held back by evidence we would have refused to act on.
3. **An absent secondary reading suppresses nothing.** `deviationBps === 0` matches no
   direction, so every pre-existing fixture behaves exactly as before.

`SIZE_STATION_VALUE_UP_FOLD` is deliberately NOT suppressed: fold-to-c-bet is measured
directly against the bet hero is making and needs no disambiguating, so a genuine station
still gets sized up through the more direct signal.

### 2.3 Verified behaviour

Villain reading `WTSD` / `WSD` over 200 / 100 real observations, hero holding STRONG:

| `WTSD` | `WSD` | BET freq | Size | Note emitted |
| --- | --- | --- | --- | --- |
| 15% (low) | 60% (high) | 60% (unchanged) | 0 | — (nothing fires; `WSD` alone drives nothing) |
| 45% (high) | 50% (average) | 63% | **+1** | — |
| 45% (high) | 60% (high) | 63% | **0** | `SIZING_SECONDARY_SIGNAL_WITHDRAWN(SIZE_STATION_VALUE_UP)` |
| 45% (high) | 60% over n=3 | 63% | **+1** | — (secondary below its own gate) |

Note the frequency read is untouched in every row: a player who reaches showdown is still
bet at more often for value. Only the extra RUNG, which assumed they were a station, is
withheld.

Golden fixtures: Shadow7 (`WSD 53%`) now loses `SIZE_STATION_VALUE_UP` with the reason
recorded; acn1977 (`WSD 43%`) keeps it.

---

## 3. Generic external-HUD street fan-out

### 3.1 The bug the two WP-K rules composed into

ADR-0067(e) fans one street-blind `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE` reading out to all
three per-street keys, because no rule selects on `*_ANY_STREET`. ADR-0067(c) gives
`EXTERNAL_HUD` per-stat precedence over every other source. Together: a single lifetime
"Check/Raise 17%" would silently override a `CHECK_RAISE_RIVER` this app measured itself
over real river opportunities. A proxy beating direct evidence inverts the reason the
precedence rule exists.

### 3.2 The fix

`apps/web/src/server/adaptive-service.ts` collects the two directly-measured sources first,
then writes a fanned-out per-street observation only for keys NOT already covered by a
`MANUAL_HUD`/`LEARNED_MODEL` reading with `sampleN > 0`. The losing reading is never
written at all, rather than written and outranked — a reading that did not contribute must
not appear in the trace as if it had.

`sampleN > 0` is the test, not mere presence of a key: a HUD snapshot with no hand count, or
a learned stat with zero opportunities, is present but weightless, and letting it take a key
away from the stand-in would replace a usable proxy with nothing at all.

Unchanged on purpose: the `*_ANY_STREET` key is ALWAYS written (that is the reading as
reported, and the profile panel shows it), and precedence for the stats the source genuinely
reports per-stat (`VPIP`, `WTSD`, `FOLD_TO_THREE_BET`…) is exactly ADR-0067(c).

### 3.3 Provenance kept, and made explicit in Korean

Every fanned-out observation carries, verbatim to the UI:

```
외부 HUD 전체 통계 · 스트리트 구분 없음 (모든 스트리트에 동일 적용)
```

(previously "외부 HUD · 전체 기간, 스트리트 구분 없음(...)" — reworded to `prompt` §3's own
phrasing.) `StrategyPanel`'s `ReasonRow` already renders every source note verbatim beneath
the reason line, so this reaches the screen with no further wiring; the reading AS REPORTED
keeps the plain `EXTERNAL_HUD_SCOPE_NOTE` under its own `*_ANY_STREET` key. A river
check-raise number can no longer read on screen as a river-specific measurement.

---

## 4. Tests added or changed

Every test in `prompt`'s required list, and where it lives:

| Required case | Location |
| --- | --- |
| low Fold-to-CBet + strong value | `adaptive-core/src/policy/bandDirection.test.ts` |
| low Fold-to-CBet + weak bluff | same |
| high Check/Raise + strong value | same |
| high Check/Raise + marginal | same |
| high WSD but low WTSD | same |
| high WTSD but average WSD | same (plus high+high, and a below-gate case) |
| generic HUD only | `apps/web/src/server/adaptive-service.test.ts` |
| generic HUD + real street-specific stat | same (plus a zero-denominator case, and a non-fan-out stat) |
| Shadow7 | `adaptive-core/src/externalProfile.golden.test.ts` |
| acn1977 | same |

Changed rather than added, all of them contract migrations with the reason recorded in the
test itself:

- `invariants.test.ts` — the rule-order lists (12 → 13 frequency, 5 → 4 sizing) and the
  SIZING note-scope list. A new test asserts every suppressor explains itself and reads a
  stat no rule fires on primarily.
- `compose.test.ts` — "produces different ADAPTIVE mixes for a nit and a station" kept
  as-is; its second assertion ("the nit is bet at MORE often than the station"), which held
  only because `FOLD_TO_CBET_LOW` was band-blind, is replaced by a strictly STRONGER test
  that checks BOTH sides of the band split and pins the sign flip.
- `externalProfile.golden.test.ts` — spots 4 and 7 re-pinned from live runs, spot 9 added,
  and two permanent floors added: neither fixture may push a VALUE hand's aggression below
  REFERENCE in either spot.

**No assertion was deleted or weakened.** Every changed expectation is a value read from a
live `composeAdaptive` run against the same fixture, never a hand-guess, and every one is
accompanied by a comment saying what changed and why.

---

## 5. Verification

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | pass, 11 projects |
| `pnpm lint` (incl. layering) | pass |
| `pnpm vitest run --project adaptive-core` | 143 passed (was 128) |
| `pnpm vitest run --project web` | 483 passed, 3 skipped (pre-existing) |
| `pnpm verify` | see §7 |
| `pnpm e2e` | see §7 |

---

## 6. Remaining limitations

1. **The §9 guard rail still zeroes VALUE-band escalation.** This is the reason golden spots
   4 and 7 return ADAPTIVE ≡ REFERENCE rather than a value increase. It is defensible —
   betting bigger and more often while a known aggressor holds cards behind is the mistake
   the guard exists to prevent — but the guard makes no distinction between escalating a
   bluff and escalating a value bet, and a case can be made that a VALUE hand WANTS the
   check-raise. `prompt` says to keep the existing safety caps, so this pass did not touch
   it. It is the single highest-value open question left in the ADAPTIVE layer and is
   recorded as falsifying evidence on ADR-0070.
2. **`THREE_BET` is used as a postflop guard stat.** A preflop 3-bet frequency above 7%
   trips the guard on every postflop street, which is most players. Inherited from
   ADR-0065; not touched.
3. **`STEAL` and `VPIP`/`PFR` still drive no rule**, and `FOLD_BB_TO_STEAL_HIGH` remains
   unreachable from external-only data. Unchanged WP-K findings, already recorded.
4. **One suppressor, one stat.** `suppressedWhen` is a general mechanism but is used exactly
   once. That is deliberate — a second one needs its own stated read and its own review —
   and `invariants.test.ts` pins the count so a third does not appear unnoticed.
5. **Band granularity is still three.** `prompt` §1 asks to consider STRONG / DOMINANT
   separately from other value hands; `AdaptiveStrengthCategory` coarsens the engine's seven
   bands to three, and splitting VALUE into DOMINANT and STRONG would be the structural
   change this pass was told not to make. `DOMINANT` and `STRONG` therefore behave
   identically here.

---

## 7. Files changed

| File | Change |
| --- | --- |
| `packages/adaptive-core/src/policy/frequencyModel.ts` | band scopes; `FOLD_TO_CBET_LOW_VALUE_UP` |
| `packages/adaptive-core/src/policy/sizingModel.ts` | `SIZE_WINNER_VALUE_UP` removed; `AdaptiveSizingSuppressor` |
| `packages/adaptive-core/src/policy/sizing.ts` | secondary-signal evaluation and its note |
| `packages/adaptive-core/src/policy/reasons.ts` | `SIZING_SECONDARY_SIGNAL_WITHDRAWN` |
| `packages/adaptive-core/src/policy/bandDirection.test.ts` | NEW |
| `packages/adaptive-core/src/policy/invariants.test.ts` | contract lists; suppressor invariants |
| `packages/adaptive-core/src/compose.test.ts` | nit-vs-station strengthened to both bands |
| `packages/adaptive-core/src/externalProfile.golden.test.ts` | spots 4/7 re-pinned; spot 9 added |
| `packages/adaptive-core/src/externalProfileFixtures.ts` | doc comment only |
| `apps/web/src/server/adaptive-service.ts` | fan-out precedence; note wording |
| `apps/web/src/server/adaptive-service.test.ts` | precedence and provenance tests |
| `apps/web/src/lib/table/copy.ts` | rule/note labels for the new vocabulary |
| `docs/DECISIONS.md` | ADR-0070, ADR-0071, ADR-0072 |
| `docs/STATE.md` | follow-up entry |

`CLAUDE.md` and `prompt` untouched. No commit made.
