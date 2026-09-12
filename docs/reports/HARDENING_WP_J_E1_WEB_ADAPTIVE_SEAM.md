# WP J-E1 — the `apps/web` ADAPTIVE composition seam

2026-09-02. Scope: turn the REFERENCE engine's output into the neutral `AdaptiveBaseline`
`@gto-self/adaptive-core` consumes, and expose one function that produces an ADAPTIVE
recommendation. No React, no UI, no components — WP J-E2 owns those.

Files owned and changed:

| file | status |
| --- | --- |
| `apps/web/src/lib/table/strategy.ts` | extended, additively |
| `apps/web/src/lib/table/adaptive.ts` | new |
| `apps/web/src/lib/table/adaptive.test.ts` | new |

Nothing under `packages/**`, `apps/web/src/server/**`, no `.tsx`, no `tableStore.ts`, no
`copy.ts` was touched. `computeStrategy`'s parameter list is unchanged.

---

## 1. `strategy.ts` — what was added and where each field comes from

### 1.1 `StrategySizingView`

| field | source | why |
| --- | --- | --- |
| `minToAmountMbb` | `action.sizing.minToAmountMbb` (`RecommendedSizing`) | the engine's legal window, so a moved rung can be proven legal without a `PostflopContext` |
| `maxToAmountMbb` | `action.sizing.maxToAmountMbb` | same |
| `kind` | `action.kind` of the row that carried the sizing | **addition beyond the brief — see §6.1** |

### 1.2 `StrategyPanelReady.adaptiveFacts: StrategyAdaptiveFacts`

| field | source | note |
| --- | --- | --- |
| `heroFacingBet` | `Money.isPositive(query.callAmountMbb)` | the engine's own predicate for "hero owes chips" — `preflop/spot.ts` uses it verbatim for `facingAllIn`. Not `!canCheck`. |
| `activeOpponentCount` | `query.activeOpponentCount` | field read |
| `aggressionBand` | `recommendation.scoring.aggressionBand.id` postflop, `null` preflop | READ, never re-derived |
| `heroIsPreflopOpener` | `PREFLOP_OPENER_FAMILIES.includes(family)` preflop, `false` postflop | see §2 |
| `heroStreetContributionMbb` | hero's `StrategySeatProfile.streetContributionMbb` | `Money.mbb(0)` if the adapter ever produced a query with no hero row (unreachable; kept total rather than asserted, since this runs in a render) |
| `bucketIndex` | `SIZING_BUCKET` explanation token -> percent -> index in `POT_FRACTION_BUCKETS` | `-1` for the `ALL_IN` token; `null` when there is no rung at all (no sizing, or preflop) |
| `wager` | `query.legalActions.wager` | field read |
| `opponentOrderings` | `query.seats` + `query.aggressionHistory` | see §3 |

Three internal helpers were added and one existing one was refactored without behaviour
change: `potFractionOf` now reads its token through a new `sizingBucketTokenOf`, and the new
`bucketIndexOf` reads the *same* token, so the displayed percent and the rung index handed to
ADAPTIVE cannot come from two places and disagree. The bucket index is matched against the
engine's own `POT_FRACTION_BUCKETS` array, never re-derived from money, so
`POT_FRACTION_BUCKETS[bucketIndex].percent === sizing.potFractionPercent` holds by
construction (tested).

`adaptiveFacts` is populated on EVERY `READY` model, whether or not anything asks for an
adaptive answer. It is a pure function of the `HandState`, so carrying it cannot make the
REFERENCE model depend on player data.

---

## 2. The preflop-opener family list

```
PREFLOP_OPENER_FAMILIES = ['RFI']
```

`RFI` is the whole list. The omissions carry the meaning, and they are read off
`packages/strategy-core/src/preflop/spot.ts`'s own classification rules:

- **`VS_LIMP` is excluded.** It also has `raiseCount === 0`, but somebody has already
  voluntarily entered the pot, so hero would be *isolating*, not opening. It is also the
  family a BIG BLIND gets when it can simply check behind limpers — exactly the case
  `adaptive-core/src/baseline.ts` names as the reason this fact must be supplied rather than
  inferred from `!heroFacingBet`. Tested directly.
- **`BLIND_VS_BLIND`, `VS_OPEN`, `SQUEEZE`, `OPEN_PLUS_CALLER`, `OPENER_VS_3BET`,
  `COLD_4BET`, `VS_4BET`, `VS_ALLIN` are excluded** because `spot.ts` reaches all of them
  only at `raiseCount >= 1`: a raise already stands in front of hero.
- A folded-to **small blind is `RFI`, not `BLIND_VS_BLIND`** — rule 3 fires before rule 4 —
  so the SB's open is *inside* the list. Tested, because it is the one that looks like an
  exclusion and is not.
- `UNSUPPORTED` and every postflop family are not preflop opens.

The narrowness also keeps the steal rule honest: `analysis-core` scopes the `STEAL` stat to
"RFI from CO/BTN/SB", so `PREFLOP_HERO_STEALING` fires over exactly the line the stat was
observed on. A CO iso-raise over a limper therefore does **not** fire `FOLD_BB_TO_STEAL_HIGH`
— the conservative direction, and the honest one.

---

## 3. How opponent orderings are derived

One row per non-hero dealt-in seat, in `query.seats` order (which the adapter documents as
`preflopOrder` order — deterministic).

| field | derivation |
| --- | --- |
| `seatIndex` | `seat.seatIndex` |
| `isLive` | `seat.status === 'IN_HAND'` (folded and all-in are both not live, per `AdaptiveOpponentOrdering`'s doc) |
| `actionOrderIndex` | `seat.preflopOrder` preflop, `seat.postflopOrder` otherwise |
| `actsAfterHero` | `actionOrderIndex > hero's actionOrderIndex` |
| `isLastAggressorThisStreet` | the last entry of `query.aggressionHistory` filtered to `query.street`, matched by `position` |

**There is no `playerId`.** `StrategyQuery` is deliberately anonymous, so the seat index is
all this model can carry; the seat -> player mapping is applied in `adaptive.ts`.

**Documented limitation on `actsAfterHero`.** The comparison uses the engine's published
first-orbit order. After a re-raise the betting reopens and the true order wraps, which this
does not model. That is the conservative direction for everything downstream: the §9 guard
rail can only ever *refuse* an adjustment, and the PRIMARY-villain choice degrades to
"nobody", which reports `INSUFFICIENT_DATA`. It is stated in the field's doc comment.

---

## 4. `apps/web/src/lib/table/adaptive.ts` — public API

```ts
export function opponentInputFromWire(wire: AdaptiveOpponentInputWire): AdaptiveOpponentInput;

export function buildAdaptiveBaseline(
  ready: StrategyPanelReady,
  seatPlayerIds: ReadonlyMap<number, string>,
): { readonly baseline: AdaptiveBaseline; readonly context: AdaptiveComposeContext } | null;

export function computeAdaptive(
  model: StrategyPanelModel,
  opponentInputs: readonly AdaptiveOpponentInputWire[],
  seatPlayerIds: ReadonlyMap<number, string>,
): AdaptiveRecommendation | null;
```

- `opponentInputFromWire` maps field by field even though the two shapes are structurally
  identical, so a divergence between the wire and the domain type is a compile error here
  rather than a silently dropped field.
- `buildAdaptiveBaseline` returns `{ baseline, context }` together because both are built
  from the same decision; a caller holding one without the other could compose over an
  ordering list belonging to a different spot.
- `computeAdaptive` is **pure and synchronous**: no equity, no ranges, no DB, no clock, no
  RNG, no `await`. It builds profiles with `buildAdjustmentProfile` and calls
  `composeAdaptive`. That is what lets WP J-E2 run it in a `useMemo` on a HUD save (§6 of the
  design contract).

### `null` cases

| case | answer |
| --- | --- |
| `NO_HAND` | `null` — ADAPTIVE has no state of its own to report |
| `REFUSED` | `null` — the panel shows the engine's own code and message; a second, emptier refusal beside it would be noise |
| `READY` with `family === 'UNSUPPORTED'` | `null` — **a decision this seam owns, see §6.2** |

### Seat -> player mapping

`AdaptiveOpponentOrdering` is keyed by `playerId`; the query has only seat indices, so
`seatPlayerIds` supplies the mapping. **A seat with no known player is DROPPED from the
ordering list, and that is documented rather than reported as a note.** Rationale, both in
the code and here: a seat we cannot name can carry no profile, so it could never be read as
PRIMARY and could never trip the §9 guard rail — dropping it is the same answer as keeping it
with an unusable id, and it is the conservative one, because every effect of the ordering list
either names the villain a rule reads or *refuses* an adjustment. It is not emitted as an
`AdaptiveNote` because that union is a closed vocabulary owned by `adaptive-core`, and this
seam only consumes that package.

---

## 5. Tests

`apps/web/src/lib/table/adaptive.test.ts` — **20 tests, all passing.** Every spot is a real
`HandState` played through `poker-core`'s own constructors and evaluated through the real
`computeStrategy`; no `StrategyPanelReady` literal is hand-built for any main case.

Two fixtures, on the standard 6-max seating (button seat 0: BTN 0, SB 1, BB 2, UTG 3, HJ 4,
CO 5):

- **`heroSbFlopSet`** — SB opens, BB calls, flop `Ah Kd 7s`, hero holds `Ac Ad`. Heads-up,
  hero OOP, so the BB is live and behind: the PRIMARY villain. Engine says band `STRONG`,
  rung 3 (67% pot), BET TO 4.000 BB.
- **`heroCoFlopFacingBet`** — CO opens, BTN calls, BB calls, flop `Th 9c 2d`, BB leads 4 BB,
  hero holds `Qh Jh`. Three-handed, hero facing a bet with one live seat (BTN) behind.

| requirement | result |
| --- | --- |
| §1 invariant end to end: same `HandState`, two opponent data sets | REFERENCE deep-equal **and** `JSON.stringify`-equal; ADAPTIVE differs. `VILLAIN_CBET_HIGH` moves FOLD −1000 / CALL +1000; `VILLAIN_CBET_LOW` moves FOLD +1000 / CALL −1000. Echoed baselines are byte-equal. |
| `adaptiveFacts.aggressionBand === recommendation.scoring.aggressionBand.id` | asserted against a fresh `recommendPostflop` on the same query, not against a literal |
| `POT_FRACTION_BUCKETS[bucketIndex].percent === sizing.potFractionPercent` | asserted |
| `heroIsPreflopOpener` true for a real RFI | asserted (UTG first in, and a folded-to SB) |
| `heroIsPreflopOpener` false for a BB checking behind limpers | asserted, with `heroFacingBet === false` asserted alongside it so the test pins exactly the case the naive derivation gets wrong |
| `opponentOrderings` on a 3+-handed postflop hand | exactly `[0]` has `actsAfterHero`; seats 1/3/4 are `isLive: false`; exactly `[2]` carries `isLastAggressorThisStreet`; `actionOrderIndex` values pinned |
| `computeAdaptive` null for `NO_HAND` and `REFUSED` | asserted (`REFUSED` is a real `HERO_NOT_ACTOR` from the engine) |
| adapted sizing inside `[min, max]` | asserted, and the rung genuinely moves: `SIZE_STATION_VALUE_UP` takes bucket 3 -> 4 (67% -> 75%, 4.000 -> 4.500 BB), `clamp: 'NONE'`, `bucketDelta: 1` |

Plus: determinism (two runs deep-equal and byte-equal), no-opponents ->
`INSUFFICIENT_DATA` with the baseline echoed verbatim, the full baseline field mapping,
seat-drop behaviour, `opponentInputFromWire` field-for-field, and the hard invariant that
ADAPTIVE never introduces an action kind REFERENCE did not offer and always sums to 10000 on
the 500 grid.

### Existing test files

No existing `apps/web` strategy test needed changing. `StrategyPanel.test.tsx` and
`analysis-strategy-unaffected.test.ts` both pass unchanged — the latter is the pre-existing
"analysis does not change REFERENCE" pin, and my additions to `StrategyPanelReady` are
serialized into its `JSON.stringify` comparison on both sides, so it still proves the
property.

### Verification run

| command | result |
| --- | --- |
| `npx vitest run --project web` | **29 files passed, 1 skipped — 435 tests passed, 3 skipped** |
| `npx vitest run --project strategy-core --project adaptive-core` | **38 files, 871 tests passed** (untouched, green; includes `strategy-core/tests/layering.test.ts`) |
| `npx tsc --noEmit -p apps/web` | clean |
| `pnpm lint` | clean |

Formatting: `prettier --write` was run on the three files I own only. Two purely cosmetic
reformats it made to *pre-existing* lines in `strategy.ts` (`actualOf`'s filter and the
`StrategyCompute` type) were reverted, so the diff on that file is strictly additive.

---

## 6. Deviations from the brief

**6.1 — `StrategySizingView` gained a third field, `kind`.**
`AdaptiveBaselineSizing.kind` is `'BET' | 'RAISE'`, but the row that carries a sizing can also
be an aggressive `ALL_IN`. Without the engine's own kind on the view, `adaptive.ts` would have
had to *derive* BET-vs-RAISE from money or from `heroFacingBet`. `action.kind` is a pure field
read and mirrors `StrategyActionRow`'s existing `kind` / `name` pairing, so the same fact is
never spelled two ways. `adaptive.ts` maps `'BET' -> 'BET'`, everything else `-> 'RAISE'` (an
ALL_IN that raises the price *is* a raise for the purpose of this label, which
`adaptive-core` only echoes and never branches on).

**6.2 — `buildAdaptiveBaseline` returns `null` for `family === 'UNSUPPORTED'`.**
The brief specifies `null` only for non-`READY` models. On an unsupported preflop line the
engine answers with a documented passive fallback and says so in `unsupportedReason`.
Composing an exploit on top of an answer the engine disclaims would present a player-specific
recommendation derived from a non-answer, which is the plausible-looking default `CLAUDE.md`
rules 2 and 5 forbid. **If the orchestrator wants ADAPTIVE offered on unsupported lines,
this is a one-line removal** — the rest of the seam does not depend on it.

**6.3 — three fields the brief listed for `adaptiveFacts` were deliberately omitted.**
`potBeforeDecisionMbb` and `callAmountMbb` (the brief left this to my judgement) and
`heroPosition` (it did not). All three are already on `StrategyPanelReady` /
`StrategyMetricsView`, and `buildAdaptiveBaseline` reads them from there. Duplicating two
money fields and a position into a second DTO creates two places that can disagree, and the
brief's own instruction was "exactly what §4.1 and `AdaptiveBaseline`'s doc comments require
and nothing more" — `street`, `actions`, `primaryKind` and `sizing` are sourced the same way
for the same reason. **Consumers should read `buildAdaptiveBaseline`'s output, not
`adaptiveFacts`, for those three.**

---

## 7. Remaining risk

1. **`actsAfterHero` after a re-raise.** First-orbit order only; documented in §3 and in the
   field's own doc comment. Fails in the direction of doing less. Fixing it properly needs an
   action-order fact the adapter does not currently publish — a `strategy-core` change, which
   is out of this WP's boundary.
2. **`heroIsPreflopOpener` is `RFI`-only.** A CO/BTN iso-raise over a limper will not fire
   `THREE_BET_HIGH_TIGHTEN` or `FOLD_BB_TO_STEAL_HIGH`. Deliberate (§2) and conservative, but
   it does mean those two rules cover fewer real spots than a reader of the design contract's
   phrase "hero opening" might expect.
3. **`heroStreetContributionMbb` falls back to 0** if the adapter ever produced a query with
   no hero seat profile. Unreachable today (`buildStrategyQuery` refuses first); the fallback
   exists so the seam degrades instead of throwing inside a React render. It is not a silent
   plausible value — a 0 street contribution simply makes the pot-fraction arithmetic treat
   hero as having put nothing in yet, which is what "no hero row" means.
4. **`bucketIndex` collapses `null` to `-1`** when building `AdaptiveBaselineSizing` (preflop,
   or an engine sizing with no rung). `-1` is the ladder's "not a movable rung" sentinel and
   `adaptSizing` gates preflop out before reading it, so this is belt-and-braces — but a
   future preflop sizing pass (design contract §5.1 calls it out of the MVP) must not read
   `-1` as "the engine chose ALL_IN".
5. **Not yet exercised end-to-end with real DB-sourced observations.** Every test here feeds
   `LEARNED_MODEL` wire rows built in the test. The mapping from persisted snapshots is WP
   J-D's `adaptive-service.ts` and has its own tests; the join of the two is WP J-F's.

---

## 8. What WP J-E2 (UI) needs from this

- `computeAdaptive(referenceModel, opponentInputs, seatPlayerIds)` — call it in a `useMemo`
  over `[referenceModel, opponentInputs, version, mode]`. Do **not** touch
  `StrategyPanel`'s existing REFERENCE effect.
- `seatPlayerIds` is `ReadonlyMap<number, string>`: physical seat index -> `playerId`. Build
  it from the store's own seat lineup. Seats missing from it are dropped, silently and safely.
- `null` means "show REFERENCE only, with no ADAPTIVE section at all". It is not an error and
  must not be rendered as one.
- `status === 'INSUFFICIENT_DATA'` means "show the REFERENCE rows plus the reason"; the
  `actions` array is the baseline verbatim and `changedFromBaseline` is `false`.
- `changedFromBaseline` — not `status` — is the flag that decides whether to badge a change.
