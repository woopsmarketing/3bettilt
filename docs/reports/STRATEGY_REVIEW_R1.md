# STRATEGY_REVIEW_R1 — independent adversarial review

> **Provenance note (orchestrator, 2026-09-01).** This file is the FIRST independent review
> (2 BLOCKER / 8 MAJOR / 13 MINOR). It was briefly overwritten on disk by the second,
> independently produced review (a fork session's reviewer — now preserved as
> `STRATEGY_REVIEW_R1B.md`) and was restored verbatim from the reviewing agent's own
> transcript, which is why its file mtime postdates two of the fix packages it drove. The
> fix agents received this review's findings inline in their briefs and reproduced every
> finding against live code before changing anything, so the fixes do not depend on this
> file's on-disk timing. Disposition of every finding: see `STRATEGY_FIX_{BUTTON,PREFLOP,
> POSTFLOP,R1B,RANGERANK}.md` and the Known-issues list in `docs/STATE.md`.


**Date:** 2026-09-01 · **Reviewer:** fresh-context, no stake in the outcome, no conclusion suggested.
**Method:** line-by-line reading plus engine-driven probe sweeps. Probes were written into the
packages, executed, and deleted; no existing file was edited and nothing was fixed.

**Subject.** `packages/strategy-core` in full (adapter seam, preflop spot canonicalization,
policy, tables, sizing, range propagation, board/hero analyzers, 7-card evaluator, equity
engine, postflop policy), its consumption in `apps/web` (`StrategyPanel`,
`lib/table/strategy.ts`, `tableStore` wiring), and the between-hands sit-out transition
(`SeatOccupancyToggle`, `tableStore.setSeatOccupancy`, `updateSessionSeatOccupancy`).

**Baseline.** `pnpm vitest run --project strategy-core` → 28 files / 690 tests pass.
`pnpm vitest run --project web` → 274 tests pass. No pre-existing breakage found. Every defect
below is reproducible against that green suite.

---

## Summary

| Severity | Count |
|---|---|
| BLOCKER | 2 |
| MAJOR | 8 |
| MINOR | 13 |

BLOCKERs and MAJORs, one line each:

- **B1** — `VS_ALLIN` never authors a raise, so hero flats AA/KK/AKs against a *short* all-in while a legal raise and live opponents remain. `preflop/spot.ts:246` + `preflop/policy.ts:319-322`.
- **B2** — Sitting the button seat out before the first deal of a page session nulls `buttonSeat` with no way to restore it; every `Start Hand` afterwards fails `NO_BUTTON_SEAT`. `tableStore.ts:280-286` + `poker-core/table.ts:143` + `tableStore.ts:200-231`.
- **M1** — The SB raise-only trim folds QJo/QTo/JTo/T9o/98o while opening K4o/A2o/43s: a dominated, internally incoherent open range shipped at `DERIVED` provenance. `preflop/tables.ts:74-101`.
- **M2** — Button rotation jumps *backwards* to the lowest eligible seat after the button seat sits out; even a net-zero `S`,`S` round trip changes the next button from 4 to 0. `poker-core/table.ts:143` + `:224`.
- **M3** — The occupancy write persists `occupancy` only, never the `buttonSeat → NULL` it also causes, so the client store and the stored session describe different tables. `db/src/repositories/sessions.ts:314-337`.
- **M4** — A recommendation to shove is never labelled all-in: `isAllIn` is dropped from `StrategyActionRow` and `StrategySizingView.allIn` is computed and never rendered. `lib/table/strategy.ts:60-70,85,270` + `StrategyPanel.tsx`.
- **M5** — `StrategyPanel`'s `setTimeout(…, 0)` does not do what its header claims; a ~90 ms heads-up-flop analysis still blocks the next keystroke. `StrategyPanel.tsx:30-39,107-118`.
- **M6** — Heads-up and 3-handed lineups reuse the 6-max tables and answer confidently-wrongly (HU button folds A2o/K7o) rather than the package declining to answer. `preflop/policy.ts:385-391`.
- **M7** — Postflop, an all-in the engine classifies as a pure CALL is emitted as a *second, aggressive* action alongside CALL, understating the calling frequency and suppressing the `ALL_IN_SPR_GATE` honesty flag. `postflop/policy.ts:69`.
- **M8** — `HERO_EQUITY_BANDS` is a 0.5-centred heads-up table fed pooled multiway equity, so the joint-heaviest score component saturates at `CRUSHED` and stops discriminating in multiway pots. `postflop/scoreModel.ts:320-328` + `postflop/context.ts:213` + `postflop/score.ts:243`.

---

## BLOCKER

### B1 — `VS_ALLIN` collapses the tree even when the tree has not collapsed: hero flats AA against a short shove

**Files.** `packages/strategy-core/src/preflop/spot.ts:246` (`if (facingAllIn) return spot('VS_ALLIN');`),
`packages/strategy-core/src/preflop/policy.ts:319-322`
(`case 'VS_ALLIN': … membershipOnly(tier.set, index, ALL_CALL, …)`), and
`policy.ts:536-539` (`sizingRequestFor` returns `null` for `VS_ALLIN`).

**The premise, and why it is false.** `spot.ts`'s own comment states the rule:

> `// 2. An all-in in front of hero collapses the tree: there is nothing left to raise into.`

That holds only when the shover is hero's *last* live opponent. Whenever a **short** stack
shoves for less than the effective stack and other players are still live — the ordinary
side-pot situation — a raise is legal, players still have to act, and isolating is the point of
the spot. `classifyPreflopSpot` tests neither condition: `facingAllIn` is just
`lastAggression.isAllIn && callAmount > 0`. `classPolicy`'s `VS_ALLIN` branch then offers
exactly CALL or FOLD, and `sizingRequestFor` refuses to produce a size, so `resolveKind` can
never reach RAISE.

**Concrete failing scenario (reproduced).** 6-max, 100 BB stacks except HJ on 4 BB.
`UTG raise-to 2.5bb → HJ all-in 4bb → CO/BTN/SB fold → hero = BB holding A♥A♠.`
The engine offers `wager { kind: RAISE, minToAmount: 5.5bb, maxToAmount: 100bb, onlyAllIn: false }`
and `activeOpponentCount = 2` (UTG is still live and still to act):

```
VS_ALLIN(side-pot live) AhAs [["CALL",10000]]  HEURISTIC
VS_ALLIN(side-pot live) KhKs [["CALL",10000]]  HEURISTIC
VS_ALLIN(side-pot live) AhKs [["CALL",10000]]  HEURISTIC
VS_ALLIN(side-pot live) QhQs [["CALL",10000]]  HEURISTIC
  wager: {"kind":"RAISE","minToAmountMbb":5500,"maxToAmountMbb":100000,...}  activeOpp 2
```

**Scale.** An enumerated sweep over three short-stacked 6-max configurations (depth 5,
720 616 recommendations) found **570 distinct spots** where the family is `VS_ALLIN`, a
non-`onlyAllIn` raise is legal, two or more opponents are still active, and the primary action
for AA/KK/AKs is a flat `CALL`. Samples include `AA hero=BTN activeOpp=5 wagerMin=19000` — an
early short shove with the whole table still to act, and the engine tells hero to call with
aces.

**Why BLOCKER, not a heuristic-quality gripe.** Every other authored range in this package is a
*width* judgement, defensible as a rule of thumb. This is a structural claim about legality —
"there is nothing left to raise into" — that the code never checks and that is false in a
routine spot (a short stack shoving over an open is the commonest way a preflop all-in
happens at a cash table). The recommendation is wrong in *kind*, not degree, and it is wrong
for the strongest hands in the deck.

**Aggravating detail.** The same branch picks its calling tier purely from `potOdds`
(`policy.ts:189-195`). Against a small shove with players behind that yields `ALLIN_CALL_WIDE`
(`22+,A2s+,KTs+,QJs,JTs,ATo+,KQo`) — hero is told to cold-call 22 and A2s for 4 BB with five
players yet to act. The pot-odds relationship the tier encodes (anchor 6 / S14) is a *heads-up*
relationship applied to a multiway spot where it does not hold.

**Fix direction (not applied).** `facingAllIn` should additionally require that the shover is
the only live opponent, or that no legal non-all-in raise remains; otherwise the spot is an
ordinary `VS_OPEN` / `SQUEEZE` / `OPENER_VS_3BET` in which one opponent happens to be all-in.
For any residual case the honest answer is the typed `UNSUPPORTED` channel, not a silent
call-or-fold.

---

### B2 — Sitting the button seat out before the first deal permanently bricks the table

**Files.** `apps/web/src/lib/table/tableStore.ts:280-286` → `packages/poker-core/src/table.ts:143`
→ `apps/web/src/lib/table/tableStore.ts:200-231`.

**Mechanism.** `poker-core`'s `setSeatOccupancy` nulls the button when the seat sitting out is
the button seat:

```ts
buttonSeat: occupancy === 'SITTING_OUT' && table.buttonSeat === seat ? null : table.buttonSeat,
```

`tableStore.startHand()` runs `advanceButton` only inside `if (previous !== null)` — i.e. only
after a hand has completed in *this page session*. Before the first deal `previous` is `null`,
so `engineStartHand` is called with `buttonSeat === null` and refuses. Setting the seat back to
`ACTIVE` does **not** restore the button (the engine only ever nulls it), and the table screen
exposes no control that can: `setButtonSeat` is referenced only from
`lib/session-setup/plan.ts` and `lib/table/testTable.ts`.

**Reproduced** (my own probe against the real store and engine; 6 seats, button on 3, no hand
dealt yet):

```
A startHand error:            {"code":"NO_BUTTON_SEAT","message":"The table has no button seat"}
A hand:                       null
A button after re-activating: null      <- sitting the seat back in does NOT restore it
A startHand error #2:         {"code":"NO_BUTTON_SEAT", ...}
```

**User-visible scenario.** Open a table, decide before dealing to sit one player out, and
happen to pick the seat wearing the BTN badge — the most natural seat to notice. The table can
never deal again for the life of the page, and the message shown is the raw English engine
code. A reload recovers only because of M3 below: the null button was never persisted.

**Coverage gap.** `apps/web/src/lib/table/tableStore.test.ts:480` covers the toggle only *after*
`startHand()` + `foldHandOut(s)`, so `previous !== null` and `advanceButton` runs. The
before-first-deal path has no test.

---

## MAJOR

### M1 — The SB raise-only trim produces an internally incoherent opening range

**File.** `packages/strategy-core/src/preflop/tables.ts:74-101`
(`SB_OFFSUIT_RUNS`, `trimSbCompositeToRaiseOnly`).

The rule drops S1's SB raise-or-limp composite's offsuit runs "weakest high card first" until
the list first falls inside the cross-verified 40-47 % band. Ordering the runs by *high card*
(`86o+, 96o+, T7o+, J7o+, Q5o+, K4o+, A2o+`) deletes the whole `Q5o+` run — which contains
**QJo** — before touching a single `K4o`.

Measured trim (probe):

```
composite            62.29 %
 - 86o+  -> 60.48 %
 - 96o+  -> 57.77 %
 - T7o+  -> 55.05 %
 - J7o+  -> 51.43 %
 - Q5o+  -> 45.10 %   <- stops here, inside the band
```

The resulting `RFI_RANGES.SB` (45.10 %, 101 classes) contains **no** Q-high, J-high, T-high or
9-high offsuit hand at all, while keeping `K4o`, `A2o`, `43s`, `63s`, `74s`. Reproduced end to
end through the engine (6-max, folded to the SB):

```
SB-RFI  QhJc  QJo  [["FOLD",10000]]   DERIVED
SB-RFI  QhTc  QTo  [["FOLD",10000]]   DERIVED
SB-RFI  JhTc  JTo  [["FOLD",10000]]   DERIVED
SB-RFI  Th9c  T9o  [["FOLD",10000]]   DERIVED
SB-RFI  9h8c  98o  [["FOLD",10000]]   DERIVED
SB-RFI  Kh4c  K4o  [["RAISE",10000]]  DERIVED
SB-RFI  Ah2c  A2o  [["RAISE",10000]]  DERIVED
```

QJo is folded 100 % and K4o opened 100 % from the same seat in the same spot. There is no
hand-strength metric under which that ordering survives; the BTN table one seat earlier opens
QJo, JTo, T9o *and* 98o. This is among the most frequent spots in a 6-max cash trainer, it is
presented at `DERIVED` — not `HEURISTIC` — provenance, and `tables.test.ts` asserts only the
*percentage* band, which the incoherent list satisfies.

The rule's comment concedes it needs "a total order on the runs … that requires no invented
hand-strength metric". Ordering by high card is not neutral: it is a strength claim, and it is
the wrong one. Trimming by the *low* card (dropping `X2o`, `X3o`, … across all high cards)
would have been equally mechanical without inverting the ordering. Nothing in
`STRATEGY_ANCHORS.md` supports the chosen direction; the anchor doc supplies only the target
band.

### M2 — Button rotation jumps backwards when the button seat sits out between hands

**Files.** `packages/poker-core/src/table.ts:143` (nulls the button) and `:224`
(`if (table.buttonSeat === null) return ok({ …, buttonSeat: first })`, where `first = eligible[0]`,
the *lowest* dealt-in seat index).

Nulling the button makes the next `advanceButton` take its "no button yet" path, which picks
the lowest eligible seat rather than the next one clockwise. Reproduced (6 seats, button on 3,
one hand folded out):

```
B baseline next button:                     4     (correct)
B button after S,S round trip on seat 3:    null
B next button after round-trip toggle:      0     (expected 4)
```

Seats 4 and 5 are skipped and seats 1 and 2 post the blinds two hands running. The second case
is a **net-zero** user action — `S` then `S` on the button seat, leaving occupancy exactly as it
was — and it still moves the next button from 4 to 0. The transition is not idempotent.

The existing test (`tableStore.test.ts:480`) uses `seats: [0,1,2], buttonSeat: 0`, the one
fixture where "lowest eligible" and "next clockwise" coincide, and its comment records the
"first eligible seat" behaviour as if it were intended.

`advanceButton`'s ASSUMPTION comment says the user corrects with `setButtonSeat`, and ADR-0031
defers dead-button rules — but the table screen exposes no such control, so there is no
correction path in the shipped UI. This is the new sit-out feature making an old documented
assumption reachable for the first time.

### M3 — The occupancy write persists half of the state transition it causes

**Files.** `packages/db/src/repositories/sessions.ts:314-337` (`.set({ occupancy })` and nothing
else), called from `apps/web/src/server/session-service.ts` / `server/actions/session.ts`.

The in-memory transition being persisted mutates **two** fields: `occupancy` and, when the seat
holds the button, `buttonSeat → null`. Only the first is written. Directly observable: after
`S` on the button seat, the next button is `0` in-session (M2) but `4` after a page reload,
because the reloaded table still carries the original button.

ADR-0057 justifies the direct-write pattern with "the live hand neither reads that field nor is
guarded on it by `applyHandResult`". That argument was made about `occupancy` and not re-run for
`buttonSeat`, which `setSeatOccupancy` also writes. The ADR's own closing requirement — "any
future between-hands preference must re-check the two conditions" — applies to this second
field and was not applied to it.

### M4 — A shove recommendation is never labelled as an all-in

**Files.** `apps/web/src/lib/table/strategy.ts:60-70` (`StrategyActionRow` carries no `isAllIn`),
`:85` + `:270` (`StrategySizingView.allIn` is defined and populated),
`apps/web/src/components/table/StrategyPanel.tsx` (neither is read — `grep -n "isAllIn\|allIn"`
over the panel returns nothing).

`postflop/policy.ts` emits a shove as `{ kind: 'BET' | 'RAISE', isAllIn: true }` with a sizing
(the `kind: 'ALL_IN'` path is a different, sizing-less one), and `potFractionOf` returns `null`
for the `ALL_IN` sizing token — the same branch preflop uses. So a reachable heads-up flop spot
at SPR 0.82 renders as

```
추천 사이즈  BET TO 25 BB
BET  80%  TO 25 BB
```

with nothing on screen saying 올인 / ALL-IN. The engine's most consequential recommendation
loses the one fact that distinguishes it from an ordinary large bet, and the read model already
carries that fact one layer down. Same class of information loss CLAUDE.md rule 3 exists to
prevent.

### M5 — `StrategyPanel`'s scheduling claim is not what the code delivers

**File.** `apps/web/src/components/table/StrategyPanel.tsx:107-118`, claim at `:30-39`.

Measured `recommendPostflop` latency (steady state, warm module, mean of 3 after warm-up):

```
HU flop            90.9 ms      3-way flop, checked to hero   43.4 ms
HU turn            11.8 ms      3-way flop, facing a bet      39.6 ms
HU river            2.3 ms      5-way flop, checked to hero   71.8 ms
                                3-way turn / river         5.5 / 1.8 ms
```

(the first, un-JITted heads-up-flop call is ≈120 ms).

A `setTimeout(…, 0)` fires ~0-4 ms after the commit and JavaScript is not preemptible, so the
~90 ms analysis begins essentially immediately and blocks the main thread; a keydown arriving
during it is queued and dispatched only afterwards. The header's worked example — "pressing `f`
and then `c` 30 ms later would make the second keystroke wait … With the analysis in a timer,
the cleanup CANCELS a superseded computation outright" — is false at 30 ms. The
cancel-the-superseded-computation property holds only when several commits land inside one
task, which is what `StrategyPanel.test.tsx:335-345`'s synthetic `act()` burst does and what
human-paced input never does.

The product contract still holds (90 ms is inside the 200 ms budget). The *mechanism the file
claims* does not, and the test that "proves" it exercises a shape users cannot produce. Either
the comment should claim only what a macrotask delivers, or the work should move to
`requestIdleCallback` / scheduler yielding / a worker. Note also there is deliberately no global
equity cache, so a UI that re-renders the same flop spot pays full price unless it threads
`PostflopBudget.cache` — which the web app does not.

### M6 — Heads-up and 3-handed lineups get a confidently wrong answer rather than a refusal

**Files.** `packages/strategy-core/src/preflop/policy.ts:385-391` (`lineupDegradation`),
`preflop/rules.ts` (`LINEUP_VERY_SHORT_HANDED`).

Session setup allows 2 players (only `NOT_ENOUGH_PLAYERS` below 2), so heads-up is a supported
configuration. `poker-core` labels the heads-up button `BTN` (blind role `SB`), so the policy
consults `RFI_RANGES.BTN` — the 6-max, four-players-behind, 42.8 % table — for a seat with one
player behind:

```
HU spot: family RFI, heroPosition BTN, lineupSize 2, blindVsBlind true
HU  Kh7c  [["FOLD",10000]]   HEURISTIC
HU  Qh9c  [["RAISE",10000]]  HEURISTIC
HU  9h8c  [["RAISE",10000]]  HEURISTIC
HU  Ah2c  [["FOLD",10000]]   HEURISTIC
```

Folding A2o and K7o on the heads-up button — where the standard opening range is ~80 %+ — is
not a shading of a heuristic; it is roughly half the range missing. The package does flag it
(`quality: HEURISTIC`, `LINEUP_SIZE: VERY_SHORT_HANDED` → environment `DIVERGENT`), which is why
this is MAJOR and not BLOCKER; but a badge saying "authored rule of thumb" does not warn the
user that the answer is systematically ~40 percentage points too tight. `spot.ts` already has a
typed `UNSUPPORTED` channel with a rendered UI path; declining to answer at 2 and 3 handed
would be more honest, and consistent with the package's own stated design ("Nothing here
guesses").

**Contrast — 5- and 4-handed reuse is sound and I verified it.** `poker-core` anchors the ladder
to the button, so 5-handed HJ and 6-max HJ both have exactly four players behind, and 4-handed
CO and 6-max CO both have three. The one-step provenance degradation there is if anything
conservative. The problem is only at 3-handed and heads-up, where the ladder genuinely no longer
corresponds.

### M7 — Postflop: an all-in the engine classifies as a pure CALL is emitted as a second, aggressive action

**File.** `packages/strategy-core/src/postflop/policy.ts:69`:

```ts
case 'ALL_IN':
  return legal.allIn !== null;          // never consults legal.allIn.effect
```

reached via `resolveKind` (`policy.ts:114-119`) and `policy.ts:526`.

`poker-core/src/betting.ts:272-291`: when hero cannot cover the outstanding bet the engine sets
`wager = null`, `wagerBlockedBy = 'INSUFFICIENT_STACK'`, and **still offers `allIn` with
`effect: 'CALL'`**. `sizing` is then null → `aggressionIsSizable` is false → the AGGRESSIVE
chain skips BET and RAISE and lands on `ALL_IN`, gated only by the SPR gate, which a hero who
cannot cover a bet always passes.

**Reproduced through the REAL `adapter/fromHandState.ts` seam** (the postflop reviewer could
only demonstrate it on a hand-built query; I drove an actual `HandState`). 6-max, hero = BB with
an 8 BB stack, `UTG raise-to 2.5 → folds → BB call`; flop `Ah7d2c`, hero holds `7c7s` (a set);
`BB check → UTG bet-to 20 BB`:

```
legalActions: wager: null, wagerBlockedReason: "INSUFFICIENT_STACK",
              call: {to 5500, isAllIn true}, allIn: {to 5500, effect: "CALL"}
ACTIONS:  [["CALL",7500,5500,true],["ALL_IN",2500,5500,true]]
primary:  CALL
ruleIds:  … LEGALITY_SUBSTITUTION …   (ALL_IN_SPR_GATE absent)
```

Three consequences: (1) two rows for one physical button — both to 5500 — the second reading as
an aggressive shove the engine explicitly blocked; (2) the calling frequency is understated by
exactly the model's raise mass, when the honest answer is CALL 100 %; (3) `aggressionSuppressed`
(`policy.ts:545`) stays false because the emitted kind *is* `ALL_IN`, so the `ALL_IN_SPR_GATE`
honesty flag — whose whole purpose is "the size this spot wants cannot be expressed" — is not
reported. Money is not wrong (both rows are to 5500), which is why this is MAJOR rather than
BLOCKER.

The AGGRESSIVE chain must require `legal.allIn.effect !== 'CALL'`. No test covers
`wager === null` **with** a permitted all-in gate; `policy.test.ts:515` and `:523` exercise the
*blocked*-gate variant only.

### M8 — `HERO_EQUITY_BANDS` is a heads-up table fed multiway equity, and saturates

**Files.** `postflop/context.ts:213` sets
`heroEquity = equityVsRanges(hero, board, ALL live villain ranges)` — hero's share against the
whole field (`equity.ts:179-192`: hero wins only by beating every villain). `postflop/score.ts:243`
looks that number up in `HERO_EQUITY_BANDS` (`postflop/scoreModel.ts:320-328`), whose rows are
0.80 / 0.65 / 0.55 / 0.45 / 0.35 / 0.25 — a table centred on 0.5. The neutral point of an
*n*-opponent pot is `1/(n+1)`, not 0.5.

Measured (BTN, `Ah7d2c`, on-policy preflop lines):

| lineup | hand | equity | × fair share | band |
|---|---|---|---|---|
| HU | 5c4c | 0.3269 | 0.65 | WELL_BEHIND (−45) |
| 4-way | Kh9h | 0.0958 | 0.38 | CRUSHED (−70) |
| 4-way | 5c4c | 0.1876 | 0.75 | CRUSHED (−70) |
| 4-way | 9c9d | 0.0669 | 0.27 | CRUSHED (−70) |
| 4-way | JdTd | 0.0881 | 0.35 | CRUSHED (−70) |
| **5-way** | **5c4c** | **0.1833** | **0.92** | **CRUSHED (−70)** |
| 5-way | Kh9h | 0.0674 | 0.34 | CRUSHED (−70) |

A hand at 0.92× its fair share — essentially break-even five-way — draws the single worst value
in the table, identical to one at 0.34×. Four of five hands tested collapse into one row at both
4- and 5-way, so the **joint-heaviest score component (3 of 26, documented at
`scoreModel.ts:128-131` as "the one number that already accounts for draws, blockers and the
opposition at once") degenerates to a constant in multiway pots.** It is also a *third* multiway
penalty stacked on `MULTIWAY_AGGRESSION_POINTS` (−55 at 4 opponents) and
`MULTIWAY_AGGRESSION_SCALE_BPS` (4500).

The incoherence is specifically *within one number's two consumers*: the same `heroEquity` is
used **correctly** at `context.ts:289` (`potOddsMargin = heroEquity − requiredEquity`; multiway
equity vs pot odds is the right comparison for a call) and **incorrectly** against a
heads-up-calibrated threshold table. `policy.test.ts:266/275/286` assert only that multiway is
*less* aggressive, which this defect trivially satisfies.

Nothing in `scoreModel.ts`, `rules.ts` or `STRATEGY_WP_B3.md` acknowledges that the band table
is 0.5-centred while its input is multiway, so this is reported as an unrecognised incoherence
rather than an accepted trade-off.

---

## MINOR

1. **Raw money arithmetic** (CLAUDE.md rule 1). `preflop/propagate.ts:169-171`
   (`Math.max(...state.contributions.values())`, `currentBet - actorContribution`), `:233-234`
   (`total += seat.streetContributionMbb as number`), and `postflop/spot.ts:166-168`
   (`potBefore - call`) perform `+`/`-` on milliBB by casting the brand away rather than using
   `Money.add`/`Money.sub`. The values are integers so no numeric error results today, and the
   final products are ratios (which rule 1 permits) — but the money *subtractions* feeding them
   are not ratios. `postflop/spot.ts:166-168` is exactly `Money.ratio(call, Money.sub(potBefore, call))`.

2. **`rangeRank` fallback ranks a multiway equity inside a heads-up distribution.**
   `postflop/context.ts:237`: `const rankBasis = heroEntry?.equity ?? heroEquityResult.value.equity;`
   `heroEntry.equity` is hero's combo vs the **primary villain**; the fallback substitutes equity
   vs the **whole field**. They coincide only heads-up. The fallback fires exactly when hero's
   actual combo has zero weight in hero's own propagated range — i.e. when hero played off-policy
   preflop, a path CLAUDE.md rule 3 guarantees is reachable. Measured 3-way (BTN, `Ah7d2c`):
   `2h2s` coherent 0.9882 → `TOP_5 (+50)` vs used 0.9467 → `TOP_15 (+35)`; `8c4d` coherent 0.0730
   vs used 0.0000. Systematic downward bias growing with opponent count; weight 2/26 ⇒ ≤ ~6.5
   score points, enough to cross a band (bands are 11-14 wide), rarely enough to flip fold/call.
   `rules.ts:175-181` documents the measurement and does not mention the fallback.

3. **`rangeRank` is also coarse under the default equity budget.**
   `equity/rangeEquity.ts:53,247`: `DEFAULT_RANGE_EQUITY_MAX_OPS = 20_000_000` with
   `opsPerRunout = nVillain + nHero * 110` gives only **153 of 1176 runouts** on a flop with two
   full ranges. Against the same call at `maxOps: MAX_SAFE_INTEGER`: aggregate equity error
   0.00062 (fine — per-combo errors cancel), but **max per-combo error 0.0559** and **max
   `rangeRank` error 0.1267**. The aggregate is what the doc comment defends;
   `postflop/context.ts:238-241` consumes the *individual* combo and its quantile as policy
   inputs, where a 12.7 pp swing is decision-relevant, and the `SUBSAMPLED` label does not travel
   with `rangeRank`. Compounds with MINOR 2. Cheapest fix: take hero's own equity from the
   already-exact `equityVsRanges` result rather than from the subsampled distribution.

4. **Sizing rules and a bet amount are reported for an answer with no sized action.**
   `postflop/policy.ts:511-517` computes `sizing` whenever `selection !== null && wager !== null`;
   `:596-603` and `:421-443` key rule ids and explanation features off `sizing !== null` rather
   than off whether any *emitted* action carries it. With `wagerOnlyAllIn: true` the actions are
   `[CHECK@10000]` while the rule ids include the whole `SIZING_*` family and the features include
   `SIZING_BUCKET: POT_50`, `SIZING_RULE … mbb=2750`. A UI rendering the structured explanation
   shows "50 % pot → 2.75 BB" beside "check 100 %". The guard should be
   `ordered.some(a => a.sizing !== null)`.

5. **`recommendPostflop` can throw instead of returning a typed error.**
   `postflop/policy.ts:533` `invariant(kind !== null, …)`. `classifyPostflopSpot`
   (`postflop/spot.ts:143`) accepts a query if *any* of canFold/canCheck/call/allIn is present,
   but the FOLD chain is `['CHECK','FOLD','CALL']`. A query with
   `canFold:false, canCheck:false, call:null, allIn:{…}` passes classification and then throws out
   of a `StrategyResult`-returning function whose doc-comment promises it refuses only "for
   reasons that are about the QUESTION". Unreachable from poker-core today
   (`betting.ts:311` hardcodes `canFold: true`), but `StrategyQuery` is a neutral type any
   adapter may build.

6. **A user-visible rationale states the wrong component count.** `postflop/rules.ts:200`:
   `AGGRESSION_SCORE_MODEL.rationale` says "The weighted sum of **thirteen** documented
   components"; `AGGRESSION_WEIGHTS` (`scoreModel.ts:120-211`) has **fifteen** entries.
   `policy.ts:613-616` copies rationale strings verbatim into `provenance.notes`, the mandatory
   honesty text for a HEURISTIC answer, so this is user-facing.

7. **`equityVsRanges` silently shrinks the lineup.** `equity/equity.ts:250-251`:
   `if (range === undefined) continue;` inside `buildVillainLists` means a sparse `villains`
   array yields an answer computed against *fewer* opponents, reported as correct
   (`villainCount` is taken from the filtered list). Every other bad input in that file is a
   typed error; this one is a silent wrong answer. An `invariant` would be consistent.

8. **`rangeDigest` is a hash, so a cache collision returns a wrong equity undetectably.**
   `equity/cache.ts:83`: ~64 hash bits plus total weight and active count. Empirically clean
   (0 collisions in 120 000 random ranges and 40 000 weight-permutation pairs) and `cache.ts`
   documents the trade-off. Noted only because it is the one place in the package where a wrong
   number can be returned without an error.

9. **`squeezeSizing` assumes matching denominators.** `preflop/sizing.ts:88-99` computes
   `base.numerator + extraCallers * SIZING.SQUEEZE_PER_EXTRA_CALLER.numerator` and divides by
   `base.denominator`. Correct only because both ratios have denominator 1; a future
   non-integral squeeze multiplier would silently produce a wrong size.

10. **Heads-up test ladder disagrees with the engine.** `preflop/testQuery.ts:26-32` declares
    `LADDERS[2] = ['SB','BB']`, but `poker-core`'s `derivePositionLabels` produces `BTN`/`BB`
    heads-up (confirmed by probe). A 2-handed query built through `testQuery` would consult
    `RFI_RANGES.SB`, which the live engine never reaches. No current test uses it, so the
    divergence is latent rather than active.

11. **Dead union member.** `StrategyPanelModel`'s `{ kind: 'NO_HAND' }`
    (`apps/web/src/lib/table/strategy.ts:136`) is never produced by `computeStrategy`; the branch
    at `StrategyPanel.tsx:133-141` is unreachable outside an injected test `compute`.

12. **Asymmetric pending label.** `seatOccupancyToggleState` (`apps/web/src/lib/table/copy.ts`)
    returns `'끔'` immediately when a seat is toggled back to ACTIVE mid-hand, while the
    SITTING_OUT direction correctly shows `다음 핸드부터`. Re-activation also only takes effect
    next hand, so the label overstates — the exact thing the function's own doc comment says it
    exists to avoid.

13. **Unreachable defensive branch presented as a spot family.** `preflop/spot.ts:239-241` maps
    "hero is the last aggressor, one raise, a caller behind" to `OPEN_PLUS_CALLER`, which would
    then take `squeezeSizing` off hero's *own* open. An exhaustive engine sweep (depth 6, two
    stack configurations) found **0** reachable instances, so this is dead code rather than a
    live defect — but if it became reachable it would recommend a 4-5× re-raise of hero's own bet.

---

## Checked and found SOUND

Probed or read specifically, with no defect found. Recorded so the negative results are on the
record.

**Preflop frequency invariants (review item 3) — verified by exhaustive sweep, not by reading.**
An enumerated DFS over legal preflop lines (6-handed 100 BB: 2 855 decision nodes; plus three
short-stacked configurations) evaluated `recommendPreflop` for **one representative combo of
each of the 169 hand classes at every node** — **1 203 111 recommendations**. In every one: the
emitted frequencies sum to exactly 10000 bps; every frequency is a positive multiple of 500; no
`BET` is ever emitted preflop; and re-evaluating the identical query is byte-identical. The
class tables are additionally sum-safe *by construction* — every literal goes through
`assertClassFrequencies`, and `quantizeFrequencies` apportions exactly 20 five-point units by
largest remainder, so a merge, substitution or future table cannot leak or invent a basis point.

**Postflop frequency invariants.** Independently fuzzed **1 464** combinations (9 boards × 7
hands × lineups 2-5 × 6 lines, flop/turn/river, tiny/huge/shove/raise): every set summed to
exactly 10000, every frequency a positive multiple of 500; 48 refusals, all typed. The property
is structural: quantize-then-filter is safe because only exact zeros are filtered
(`policy.ts:558`), and `distributeRemainders` can never under-distribute. `scorePostflop`'s mix
sums to 10000 and stays non-negative in all three branches (facing-all-in, facing-a-bet, unbet),
each pinned by an assertion in `scoreModel.ts`.

**Illegal sizes (item 4) — verified against the engine, not just against the bounds.** For every
recommended `RAISE` in the preflop sweep, `toAmountMbb` was inside
`[minToAmountMbb, maxToAmountMbb]`, `amountMbb === Money.sub(toAmount, heroStreetContribution)`
(raise-TO semantics), and — the stronger check — `applyCommands(hand, [raiseTo(toAmount)])` was
**accepted by `poker-core` in every case**. Zero rejections. Postflop: no emitted BET/RAISE fell
outside the bounds anywhere in the fuzz, `kind` always equalled `wager.kind` (BET vs RAISE is
read from the engine, never inferred), `onlyAllIn` is honoured, `clampPostflopSizing` handles
inverted bounds rather than letting `Money.clamp` throw, and sizing is
`callToAmount + f·(pot+call)` with exactly one rounding inside `Money.mulRatio`. `clampSizing`
retains the pre-clamp request (rule 3) and degrades provenance one step when the clamp bites.
The only hole in this area is M7.

**Card removal (item 8) — verified end to end.** Over 6 102 propagated seat-ranges across
enumerated lines: no combo containing a hero card carries non-zero weight in any non-hero range,
and every weight is inside 0..10000. In the postflop range model, no combo containing a board
card or a hero card carries weight in any villain range, and no board card appears in hero's own
range. Independently, `buildVillainLists` drops zero-weight combos *after*
`removeConflicts(range, board+hero)` so a blocked combo can never reach the denominator, and
runout collisions skip the whole (assignment, runout) pair. A villain range consisting only of
hero-blocked combos returns typed `ZERO_MASS_RANGE`, not a silent number.

**The 7-card evaluator is exhaustively correct.** Compared against an independently written
reference evaluator: **2 598 960 five-card hands (all of C(52,5)), 0 mismatches**; **3 818 880
seven-card hands** (120 random 18-card sub-decks × C(18,7)), 0 mismatches; 300 000 random
six-card hands, 0 mismatches. Every named edge case matches, including the wheel as both straight
and straight flush, steel wheel beating quads, a 7-card flush picking the top five, two trips
resolving to the higher full house, three pairs taking the highest remaining card as kicker, and
the board playing (`holeCardsUsed = 0`). `holeCardsUsed` really is the *minimum* over all optimal
subsets (18 000 random cases including 6 000 rank-degenerate boards, 0 mismatches).
`nutStrengthOnBoard` and straight-draw `outRanks` match independent brute force.

**Equity math (item 9).** A chop counts 0.5 (`winProb 0, tieProb 1`); a 3-way board chop is
exactly 1/3; weighted river math matched a hand-written brute force to 1e-16; multiway "win"
really is "beat ALL", verified against an independent runout × assignment enumerator
(0.11261541501632966 vs reference …63). **Subsampling is unbiased, not merely deterministic** —
against exact preflop equities over all C(48,5) runouts, the default budget errs by ≤ 0.0006 and
the error *shrinks* as the budget grows (AsAh vs KcKd: exact 0.812555, default 0.813140,
400k-runout 0.812726), so the Weyl walk is not aliasing. Heads-up flop/turn/river are genuinely
`EXACT` (1081/1081, 46/46, 1/1). The B2 report's admitted weighted-mean-vs-pooled ambiguity was
measured and does **not** materially affect `rangeAdvantage`: a range run against itself on three
textures gave 0.49938-0.50292, bias ≤ 0.0029, well inside the ±0.02 `LEVEL` band. The real
equity problems are M8 and MINOR 2/3, not this.

**BPS invariants (item 2).** `apportion` / `divideByBpsTotal` can never over-distribute;
`normalizeRange` hits its target exactly; `applyActionStrategy` asserts the 10000 ceiling and
cannot push a full-weight combo over (zero remainders are skipped in the +1 pass);
empty-range → positive-total normalization returns typed `NORMALIZATION_UNDEFINED`;
`removeConflicts` leaves exactly C(49,2) = 1176 after a 3-card board and does not mutate its
input. No hand is both opened and folded at 100 % within any single spot: the value/mixed/bluff
sets are applied in fixed precedence and asserted disjoint, and every gated subset member is a
member of the tier that gates it.

**Off-policy handling.** A line the policy assigns zero frequency (an SB limp under a
raise-or-fold table) does not empty the range; the range is carried forward unchanged and the
seat is flagged `offPolicy`. Verified reachable and correct.

**Spot canonicalization (item 7).** `RFI`, `VS_LIMP`, `VS_OPEN`, `SQUEEZE` (cold caller, hero not
yet in) vs `OPEN_PLUS_CALLER` (hero already in), `BLIND_VS_BLIND`, `OPENER_VS_3BET`, `COLD_4BET`
and `VS_4BET` all classify correctly against engine-produced hands. An all-in that raises the
price but is *not* a full raise is correctly counted in `raiseCount` (`isAggressive` is
`toAmount > currentBetBefore`, matching the engine's `classifyWager`), and `isFullRaise`
correctly plays no part in that count. Limp-raise (SB limps, BB raises) classifies as
`BLIND_VS_BLIND` with `limperCount: 1` retained — consistent with `BLIND_VS_BLIND_MIX`'s
documented rule, not a misclassification. Lines the package does not model
(`CALLER_FACING_THREE_BET`, `COLD_FIVE_BET`, `BEYOND_FOUR_BET`) reach the typed `UNSUPPORTED`
channel and a documented passive fallback rather than being force-fitted.

**Position derivation (item 5).** IP/OOP is read from the engine's `postflopOrder`, never
recomputed; blind-vs-blind is `remaining.length === 2 && every seat has a blind role`. Correct in
every case probed, heads-up included.

**Provenance discipline (item 1).** I spot-checked every constant in `preflop/tables.ts` against
`STRATEGY_ANCHORS.md` §3 and every entry in `preflop/rules.ts` against the anchor it cites. The
classifications match the anchor doc's binding verdicts, including the unflattering ones: RFI
hand lists are `DERIVED` (single-sourced) not `SOURCE`; all five defend tiers, all aggression
subsets, the squeeze range, the 4-bet/5-bet ranges and the VS_ALLIN calling ranges are
`HEURISTIC` with mandatory prose rationales; no numeric ante adjustment is applied, matching
anchor 9. Rejected alternatives (`THREE_BET_IP_ALTERNATIVE` 3.5×, `SQUEEZE_FLAT_ALTERNATIVE`
3×+1×) are kept in code so the source disagreement stays visible. Measured RFI percentages land
inside the published bands (UTG 17.04 %, HJ 21.12 %, CO 27.75 %, BTN 42.84 %, SB 45.10 %). No
postflop rule claims `SOURCE`; `worstProvenance` forces every real postflop answer to HEURISTIC
and a note is guaranteed. `grep` for GTO/solved/solver across the package finds only negations
and a doc-path reference. **No invented GTO claim found.** M1 is a defect in a rule's
*construction*, not a mislabelled provenance; MINOR 6 is the only outright wrong statement in a
rationale.

**Free-continue substitution.** The `FOLD` bucket's chain reaches for `CHECK` before `FOLD`, so
"not in the continue range" renders as a check in an unraised pot rather than a fold — verified
reachable (BB facing an SB limp with a trash hand → `CHECK`).

**Layering (CLAUDE.md rule 4).** `eslint.config.js` adds bidirectional bans between
`strategy-core` and `poker-core` / `gto-core` / `player-core` / db / UI / solver-lab, with the
`poker-core` ban lifted **only** under `packages/strategy-core/src/adapter/**` — and the seam
block repeats the full pattern list rather than relying on flat-config merging, which it
correctly documents. `types.ts` re-declares the string unions rather than re-exporting
poker-core's, and the adapter maps them with `assertNever`-terminated switches.

**No baseline mutation, no nondeterminism (item 10).** `computeStrategy` takes only `HandState` +
`heroSeat`; `buildStrategyQuery` never sees session state, UI state or `player-core`. No
`Math.random`, `Date.now`, `new Date`, `performance.now`, `process.env` or `globalThis` anywhere
in `strategy-core/src` outside tests and a measurement-only benchmark. Equity subsampling is a
deterministic golden-ratio Weyl walk. The equity cache is caller-owned rather than global; a cold
run, a first cached run and a second cached run are JSON-identical, and hero-card order and board
order do not change the answer including in the subsampled path. `Float64Array.sort()` without a
comparator is numeric and total. All 1.2 M preflop sweep recommendations were byte-identical on
re-evaluation.

**UI integration (item 12).** Every Korean copy `Record` was checked member-by-member against its
source union and all ten are exhaustive (`STRATEGY_ERROR_LABEL` 16/16, `STRATEGY_FAMILY_LABEL`
17/17, `STRATEGY_UNSUPPORTED_REASON_LABEL` 6/6, `POT_TYPE_LABEL` 4/4, `PROVENANCE_LABEL` 3/3,
`CONFIDENCE_LABEL` 3/3, `ENVIRONMENT_STATUS_LABEL` 2/2, `ENVIRONMENT_FACTOR_LABEL` 5/5,
`EQUITY_METHOD_LABEL` 2/2, `SIZING_CLAMP_LABEL` 3/3) — no `undefined`-rendering path found. No
stale-write race: the timer callback captures its own render's `hand`/`heroSeat`, computes
synchronously with no `await`, and the `fresh` identity check is a genuine epoch guard because
the store commits a new immutable `Hand` per transition. The panel mounts only when hero is the
actor (`rightPanel.ts:54-56`); stale output is greyed and badged `이전 상황 기준`. No effect is
keyed on a per-render object or array identity — a `table` mutation (the occupancy toggle)
re-renders the panel without recomputing. Refusal and `UNSUPPORTED` states render rather than
throw.

**Money discipline (item 13).** No raw arithmetic on milliBB in any new `apps/web` file: the only
arithmetic is `frequencyBps / 100`, `Math.round(ratio * 100)`, `spr.toFixed(1)` (non-money
ratios, explicitly permitted) and `seat + 1` (a display index); all money formatting goes through
`Money.formatBB`. The equity and range modules carry no money at all — everything is integer bps
or a 0..1 ratio. The exceptions are MINOR 1.

**Sit-out vs the live hand.** Confirmed independently of ADR-0057 that a mid-hand occupancy write
is invisible to the live hand: `Hand.state` is a fold over the hand's own event log,
`applyHandResult` compares `playerId` only (`table.ts:244-252`), and `SeatCard` prefers
`view?.isButton` over `table.buttonSeat` (`SeatCard.tsx:64`). Minimum player count is enforced
(`buildStartEvents` → `NOT_ENOUGH_PLAYERS` at `commands.ts:540`, `advanceButton` at
`table.ts:219`), so sitting out down to one seat fails loudly rather than dealing a one-player
hand. The server action re-parses the payload (`seatOccupancySchema`), re-narrows the seat via
`isSeatIndex`, and checks session existence, not-closed and seat-not-EMPTY before writing; the
unawaited client save is sequence-guarded per seat and its failure banner does not revert the
user's choice. The defects are B2/M2/M3, all about `buttonSeat`, not about `occupancy`.

---

## Not confirmed / out of scope

- **Authorization** could not be assessed: the app has no auth layer at all (no cookie, session
  or user concept under `apps/web/src/server` or `src/app`). It is a single-user local SQLite
  tool, so "session ownership" has no meaning today. Nothing to flag; also nothing that would
  survive a future multi-user deployment.
- The M5 latency figures are Node measurements on this machine, not a browser input-delay trace
  (Playwright was deliberately not run). The argument that a macrotask does not shield subsequent
  input follows from JS execution semantics rather than from a measured trace.
- B1's scale figure (570) counts spots in the enumerated configurations I chose; it is evidence
  of reachability and rough frequency, not a population estimate.
- M8's per-band impact was measured on flop fixtures; I did not establish how often it flips a
  primary action as opposed to shifting a frequency band.
- MINOR 2's per-band impact at 4- and 5-way is confounded by those fixtures involving limp /
  cold-call lines the propagation flags off-policy. The 3-way figures quoted are clean.

---

## Working-tree note

All probes were written into the packages, executed, and deleted. `git status` after the review
matches the state at the start — pre-existing modifications to `CLAUDE.md`, `prompt`,
`next-env.d.ts` and the Strategy A+B working set, and the untracked `docs/reports/` and
`packages/strategy-core/` trees — plus this file. No existing file was edited and nothing was
fixed.
