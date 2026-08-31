# STRATEGY_REVIEW_R1B — second independent adversarial review of the REFERENCE strategy milestone

> **Provenance note (orchestrator, 2026-09-01).** This is the SECOND independent review
> (0 BLOCKER / 5 MAJOR / 11 MINOR / 11 NOTE), produced by a fork session's fresh-context
> reviewer concurrently with the first (`STRATEGY_REVIEW_R1.md`) and originally written to
> that same path; it was renamed to R1B to preserve both. Its MAJOR-1 overlaps R1's
> BLOCKER-2/MAJOR-2; its MAJOR-2..5 were unique and were fixed in
> `STRATEGY_FIX_R1B.md`. Where it disagrees with R1 (notably its MINOR-1 asking to
> preserve the VS_ALLIN collapse that R1's BLOCKER-1 condemned), the disagreement was
> settled by reproduction against the live engine — see the fix reports.

Reviewer: fresh-context adversarial reviewer, no stake in the outcome.
Date: 2026-09-01. Mode: **READ-ONLY** — nothing in the repo was changed. Every throwaway
verification script was written to the session scratchpad under `/private/tmp`, never to the
repo, and is listed in §5 so the orchestrator can reproduce any claim.

Scope reviewed: `packages/strategy-core` (adapter, preflop spot/policy/tables/rules/sizing/
propagation, range model, `analysis/{evaluate,board,heroHand}`, equity, postflop), its web
integration (`StrategyPanel.tsx`, `lib/table/strategy.ts`, `TableRoot` wiring, the A1
seat-occupancy toggle and its persistence path), and the claims in
`docs/reports/STRATEGY_WP_{A1,A2,A3,B1,B2,B3,B4}.md` and `docs/reports/STRATEGY_ANCHORS.md`.
Binding: `CLAUDE.md`, ADR-0055 / ADR-0056 / ADR-0057.

**Verdict: no BLOCKER.** Five MAJOR findings, each reproduced with a concrete counterexample
or a measurement. Three are behavioural defects in the shipped decision path (one reachable
from the UI with two keystrokes, two inside the postflop scoring model), one is a
`CLAUDE.md` rule-1 money-discipline violation that also produces a mislabelled user-facing
number, and one is a false performance claim repeated in two reports and two source-file
headers. The engine's *mechanical* guarantees — quantization, legality, determinism, money
units, layering — survived every attack described in §4, which is the more useful half of
this document.

| Severity | Count |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 5 |
| MINOR | 11 |
| NOTE | 11 |

**Two caveats on how to read the citations.**

1. **The working tree moved while this review was being written.** `packages/poker-core/src/table.ts`
   and `apps/web/src/lib/table/tableStore.ts` were modified at 03:56:36 and
   `packages/strategy-core/src/postflop/{scoreModel,score,rules,recommendation,policy}.ts`
   at 03:58–03:59, by another session, while the review was in progress. Every line number
   below was verified against the file *as it stood at 03:59 on 2026-09-01*; where a number
   has since drifted, locate the finding by the quoted symbol name, which is stable. Per
   CLAUDE.md §6 I did not touch, revert, or stash any of it.
2. Consequently **MAJOR-1 already appears to be fixed in the working tree** (see the STATUS
   line under it). It is retained in full because the report claims that motivated it are
   still wrong and because I did not re-verify the fix — that is the orchestrator's gate,
   not a reviewer's.

---

## 1. MAJOR

### MAJOR-1 — Sitting the BUTTON seat out rewinds the button to the lowest-numbered seat, silently changing everyone's position for the next hand

**Where.**
- `packages/poker-core/src/table.ts:143` — `setSeatOccupancy` nulls `buttonSeat` when the
  seat being sat out *is* the button:
  `buttonSeat: occupancy === 'SITTING_OUT' && table.buttonSeat === seat ? null : table.buttonSeat`
- `packages/poker-core/src/table.ts:224` — `advanceButton` treats a null button as
  "no button yet" and returns `eligible[0]`, the **lowest-index** eligible seat:
  `if (table.buttonSeat === null) return ok({ ...table, buttonSeat: first });`
- Reachable from the milestone's own UI: `apps/web/src/components/table/TableRoot.tsx:226-262`
  (`handleToggleSeatOccupancy`, the `자리비움` chip and the `S` hotkey) →
  `apps/web/src/lib/table/tableStore.ts:280-286` → the engine call above; the next
  `startHand()` runs `advanceButton` at `tableStore.ts:226`.

**Reproduction** (run against the real engine, no fixtures):

```
6 seats 0..5 all ACTIVE, buttonSeat = 3.
setSeatOccupancy(3, 'SITTING_OUT')  ->  buttonSeat === null
advanceButton(...)                  ->  buttonSeat === 0        // actual
                                        buttonSeat === 4        // "next eligible clockwise"
control: no sit-out, advanceButton from 3 -> 4                  // confirmed
```

An even cheaper repro, and the one a user will actually hit: **press `S` twice on the button
seat.** That is a user-visible no-op (`occupancy` returns to `ACTIVE`), but `buttonSeat` is
`null` and is never restored, so the next hand's button is seat 0 rather than seat 4.

**Why it matters.** The button determines SB/BB/UTG/HJ/CO/BTN for the next deal. Jumping the
button backwards means seats are dealt the wrong position, some seats post blinds twice in a
row and others skip them, and — the reason this is in scope for a *strategy* review — every
`StrategyQuery.heroPosition`, every RFI table lookup, and every IP/OOP determination for the
next hand is computed from a position assignment the user never asked for. It is not a
strategy-engine bug; it is a bug the strategy engine faithfully propagates.

**Rule violated.** `CLAUDE.md` rule 5 ("no fake implementations… a `TODO` must be explicit,
documented, and listed in `docs/STATE.md`") — this behaviour is documented *nowhere*.
`advanceButton`'s own ASSUMPTION comment (`table.ts:214`) covers dead-button and missed-blind
rules, not "the button teleports to seat 0". ADR-0057 asserts the direct-write pattern is safe
because the live hand cannot observe the write; that argument is sound and holds, but it says
nothing about the *between-hands* effect on `buttonSeat`, which is where the damage is.

**Report-vs-reality (this is also finding #15 for A1).** `docs/reports/STRATEGY_WP_A1.md`
states, under "Store": *"button-seat sit-out clears the button and the next `advanceButton`
picks the next eligible seat"*, and the report's "Files → poker-core" section states
*"unverified change: **none**. `setSeatOccupancy`, `dealtInSeats`, `advanceButton` already did
the right thing (see above); no gap was found or touched."* Both claims are false in general.
The guarding test, `apps/web/src/lib/table/tableStore.test.ts:480-500`, is written with
`buttonSeat: 0` on a three-seat table, which is the one configuration where "lowest eligible"
and "next eligible clockwise" coincide — the test cannot fail on this bug, and its own comment
(`tableStore.test.ts:496-497`) restates the wrong mental model.

**What a fix must preserve.**
- The mid-hand write must stay structurally invisible to the live `Hand` (ADR-0057's two
  conditions: the hand does not read the field, `applyHandResult` does not guard on it). Do
  not reintroduce a pending-occupancy map to solve this.
- `startHand`'s documented sequence must stay `applyHandResult → applySeatAutoTopUps →
  advanceButton` (`tableStore.ts:222-228`); a revived seat must still be eligible before the
  button search runs.
- `advanceButton(null)` must keep meaning "no button has ever been set" for a fresh table
  (`createTable` sets `buttonSeat: null` at `table.ts:65`), so the fix cannot simply change
  that branch. Remembering the departing seat (so the search resumes from it) or refusing to
  null the button at all and letting `advanceButton`'s eligibility scan step past a
  sitting-out button are both compatible with that.
- `vacateSeat` (`table.ts:121`) nulls the button by the same rule and inherits the same
  behaviour; whatever is done here should be decided for both, and only one of them is inside
  this milestone's boundary.
- Add the counterexample above as a test with a **non-zero** button seat; the existing test's
  parameters cannot detect the bug.

**STATUS AT WRITE TIME (2026-09-01 03:59).** The working tree changed under this review:
`packages/poker-core/src/table.ts` was modified at 03:56:36 by another session and
`setSeatOccupancy` no longer nulls `buttonSeat` — it now carries a doc comment naming "the
pre-2026-09 behaviour" and the exact backwards-rotation mechanism described above, and
`vacateSeat` (`table.ts:117-123`) keeps the null-ing, which is correct because there the
player and their chips genuinely leave. `advanceButton`'s comment (`table.ts:217-227`) now
states the eligibility rule explicitly. **I did not re-verify this fix** — no test was run
against it, the persistence path was not re-checked, and `STRATEGY_WP_A1.md`'s claim and its
`buttonSeat: 0` test are (as of this writing) still as described above. Treat the finding as
open until the orchestrator's own gate closes it.

---

### MAJOR-2 — "The worst shape is a heads-up flop at ~87 ms / ~2.3x headroom" is false; a 6-way flop measures 130–153 ms and is never benchmarked

**Where the claim is made.**
- `docs/reports/STRATEGY_WP_B3.md:520-534` — the latency table (HU flop **87.0 ms**, 3-way
  flop 40.8 ms) and the sentence *"The worst shape is a heads-up FLOP (largest runout
  enumeration) at ~87 ms — comfortably inside the ~200 ms interaction budget… 3-way is
  faster."*
- `docs/reports/STRATEGY_WP_B3.md:665` — *"The 200 ms budget has ~2.3× headroom on the worst
  shape."*
- `docs/reports/STRATEGY_WP_B4.md:66-69` — inherits it: *"B3 found ~2.3x headroom against the
  200 ms interaction budget on the worst shape."*
- Propagated into shipped source comments:
  `apps/web/src/lib/table/strategy.ts:350-355` (*"B3 measured the worst shape (a heads-up
  flop) at ~87 ms against a ~200 ms interaction budget, so no reduction was needed"*) and
  `apps/web/src/components/table/StrategyPanel.tsx:22-23`.

**Measured, on the same machine class (Darwin arm64), through the real adapter + engine:**

| shape | measured `recommendPostflop` |
| --- | --- |
| HU flop (B3's "worst shape") | **92 ms** |
| 3-way flop, hero SB first to act | **100 ms** |
| 4-way flop facing a bet | 73 ms |
| **6-way limped flop, hero SB first to act** | **130 – 153 ms** |

The 6-way case is ~1.6× B3's stated worst case and leaves ~1.3× headroom against the 200 ms
budget, not ~2.3×. On a mid-range laptop (routinely 2–4× slower than an M-series Mac) that
shape exceeds the budget.

**Why the benchmark missed it.** `packages/strategy-core/src/postflop/benchmark.test.ts:26-41`
defines exactly two lineups — `HU` (2 players) and `THREE_WAY` (3 players) — and
`CASES` (`benchmark.test.ts:50-129`) covers only those two across flop/turn/river. **Nothing in
the suite exercises 4, 5 or 6 players.** The generalisation from "3-way is faster than HU" to
"HU is the worst shape" is drawn from a two-point sample, and the mechanism behind it (the
runout enumeration shrinks multiway, so HU must be worst) ignores that the villain
cross-product and the per-runout strength evaluation both *grow* with villain count
(`equity/equity.ts:284-345`, `buildAssignments`).

Secondary observation from the same runs: the 3-way and 6-way flops come back
`heroEquityMethod === 'SUBSAMPLED'` where HU is `'EXACT'`. Multiway is therefore both slower
*and* less accurate, which is the opposite of the report's framing.

**Rules violated.** `CLAUDE.md` rule 5 (a report claim presented as measured when the
measurement does not cover the case) and the working agreement's "report instead of guessing".
No money or strategy number is wrong; the risk is a real-user latency regression that the
project believes it has already ruled out, and a `PostflopBudget` lever left untuned on the
strength of an incorrect worst case.

**What a fix must preserve.**
- `PostflopBudget` fields must keep bounding an **enumeration size**, never wall-clock time —
  B2's determinism rule (`equity/model.ts`, `sampling.ts` header) is the reason a slow machine
  returns the same answer, and a time-based budget would destroy it.
- Any budget tightening must keep frequencies quantized to 500 bps summing to 10000 and must
  keep `EXACT` vs `SUBSAMPLED` honestly reported (`copy.ts:288-292` renders the distinction).
- The benchmark should gain 4/5/6-player flop cases before the claim is restated; the fix is
  either a corrected claim or a tuned default budget, not a deleted assertion.

---

### MAJOR-3 — The multiway continue penalty is subtracted from a band whose own contract is "Never folds", so the engine recommends folding a hand with 100 % equity

**Where.** `packages/strategy-core/src/postflop/score.ts:623`

```ts
const continueBps = Math.max(0, continueBand.continueBps - penalty);
```

and the same shape on the all-in path, `score.ts:599`:

```ts
const rawContinue = Math.max(0, allInBand.points - penalty);
```

`penalty` is `multiwayContinuePenaltyBpsFor(opponents)` (`score.ts:569`, `:594`), reading
`MULTIWAY_CONTINUE_PENALTY_BPS = [0, 0, 1000, 2000, 2500, 3000]` (`scoreModel.ts:730`). It is
applied **unconditionally**, including to `CONTINUE_BANDS.ALWAYS` (`scoreModel.ts:598-604`),
whose `continueBps` is `10000` and whose rationale in the same file reads, verbatim:
*"Priced in with room to spare and strong on the other axes too. **Never folds.**"* The band
header two lines above it (`scoreModel.ts:262-264`) is even more explicit: *"10000 IS
reachable here (unlike aggression): a hand that beats the price by a wide margin should never
be shown a fold frequency at all."* Multiway, 10000 is **not** reachable — the top band caps
at 9000 three-handed and 7000 six-handed.

**Hand-worked counterexample (measured, real adapter + engine).**

```
3-way SRP. RIVER 7h 7d 2c 9s 3h. Hero (BTN) holds 7s 7c — quads, unbeatable, no draw left.
BB bets 5 BB, CO calls 5 BB, hero to act. activeOpponentCount = 2.
  heroEquity              = 1.0   (exactly; the board leaves no losing runout)
  continueBand            = ALWAYS (continueBps 10000)
  multiwayContinuePenalty = 1000
  continueBps             = 9000
EMITTED:  FOLD 1000  |  CALL 6000 (to 5000 mbb)  |  RAISE 3000 (to 28000 mbb)
```

The identical board and holding heads-up gives `continueBps = 10000` → `CALL 5000 / RAISE
5000`, **no fold**. Adding a second opponent to a hand that cannot lose makes the engine
recommend folding it 10 % of the time.

The all-in path reproduces it too: 3-way flop `7h 7d 2c`, hero holds `7s 7c`, a short BB
shoves, a deep CO is still live → `ALL_IN_CALL_BANDS.CLEAR_CALL` (`points: 10000`,
`scoreModel.ts:~745`) − 1000 = **`FOLD 1000 / CALL 9000` at `heroEquity = 0.99968`**.

**Why it is wrong, not merely conservative.** The multiway penalty is a defensible *idea* —
`scoreModel.ts:263` justifies it as "continuing against several ranges needs more than
continuing against one" — and it is already expressed once inside the continue score as a
component. Applying it a second time as a flat post-band subtraction has no such
justification, and at the top of the range it is not a strength adjustment at all: no number
of extra opponents makes a hand that wins 100 % of the time a fold. This is a strategy number
that is not just unsourced but *demonstrably false*, shown to the user under 기본전략 ·
REFERENCE — the spirit of `CLAUDE.md` rule 2 — and it contradicts a contract written in the
same file (`CLAUDE.md` rule 5: no implementation that silently returns a plausible-looking
wrong value).

**What a fix must preserve.**
- The penalty must stay on the 500-bps grid and the emitted set must still sum to exactly
  10000 (`assertModel` grid-checks the array at `scoreModel.ts:~982`; §4 explains why the
  sum itself cannot break).
- Whatever floor is chosen must be justified by something the model can *see* — pot odds or
  equity margin — not a second authored constant. Exempting the top band, or flooring the
  post-penalty value at the pot-odds-implied continue frequency, both do that; clamping to an
  arbitrary new literal does not.
- The multiway penalty must remain visible in the explanation
  (`PostflopScoring.multiwayContinuePenaltyBps`) so the UI can still say why a multiway answer
  is tighter than a heads-up one.

---

### MAJOR-4 — `facedBetFractionOfPot` is raw money arithmetic (rule 1) **and** the wrong quantity whenever hero has street money in or another player has called

**Where.** `packages/strategy-core/src/postflop/spot.ts:166-169`

```ts
const call = query.callAmountMbb as number;
const potBefore = query.potBeforeDecisionMbb as number;
const potBeforeBet = potBefore - call;
const facedBetFractionOfPot = facingBet && potBeforeBet > 0 ? call / potBeforeBet : null;
```

**(a) Money-discipline violation.** Two `as number` casts deliberately strip the `MilliBB`
brand, and `potBeforeBet` — itself a money value — is computed with a raw `-`. `CLAUDE.md`
rule 1 permits floats for "non-money ratios"; it does not permit raw subtraction of two money
values to obtain one. `Money.sub` and `Money.ratio` (`shared/src/money.ts:83`, `:216`) exist
for exactly this, and `Money.ratio` already returns `null` on a zero denominator — the very
behaviour hand-rolled on line 169. This is the only raw money arithmetic in the postflop half
of the package (the preflop instances are MINOR-2).

**(b) The formula is wrong outside the simplest case.** `call / (potBefore − call)` equals
"villain's bet as a fraction of the pot before it" only when the call amount *is* the whole
wager and nobody else has contributed. It is documented (`spot.ts:67-72`) and tested
(`spot.test.ts:176`) for that one case only.

Counterexample A — `FACING_RAISE`, hero already has money in (measured):

```
SRP pot 5500. Hero (BTN) bets 3000. BB raises to 9000.
  potBeforeDecision = 17500, callAmountMbb = 6000, hero streetContribution = 3000
  facedBetFractionOfPot = 6000 / 11500 = 0.5217  ->  FACED_BET_SIZE_BANDS: SMALL,  +0 points
  TRUTH: BB put 9000 into a pot of 8500 = 1.06x pot  ->  LARGE/OVERBET,          -25 points
```

Counterexample B — one caller between the bettor and hero (measured):

```
3-way SRP pot 5500. BB bets 4000, CO calls 4000, hero to act.
  potBeforeDecision = 16000, callAmountMbb = 4000
  facedBetFractionOfPot = 4000 / 12000 = 0.3333  ->  TINY,   +10 points
  TRUTH: 4000 into 5500 = 0.727                  ->  MEDIUM, -12 points
```

**Impact.** A 22–25 point error on the `FACED_BET_SIZE` component in **both** models (weight
1/26 of aggression ≈ 1 score point; 1/14 of continue ≈ 1.8 score points) — enough to cross a
band edge in a close spot. Worse, the number is *user-facing*: the `BET_FRACTION_FACED`
explanation feature (`postflop/policy.ts:360-362`) renders `0.5217` and the label `SMALL`
next to the recommendation for what is in fact a larger-than-pot raise. `CLAUDE.md` rule 3's
principle — the user is shown the real numbers — is not served by showing a wrong one.

**What a fix must preserve.**
- Route the whole computation through `Money.sub` / `Money.ratio`; the *output* is a ratio and
  may legitimately be a float, the intermediates may not.
- The correct quantity is the last aggressive wager measured against the pot **immediately
  before that wager**, which needs the aggressor's own street contribution
  (`query.seats[].streetContributionMbb`) and not hero's call amount. Both are already on the
  DTO, so no adapter change is required and ADR-0055's one-way direction is unaffected.
- `spot.test.ts` must gain a `FACING_RAISE` case and a bettor-plus-caller case; the existing
  single-bet case must keep its current value, since the formula is right there.

---

### MAJOR-5 — `FACING_ALL_IN` hard-zeros aggression even when a live opponent with chips remains and the engine offers a legal raise

**Where.** `packages/strategy-core/src/postflop/score.ts:596-617` — the `facingAllIn` branch
returns `aggressionBps: 0` and `mix.aggressiveBps: 0` unconditionally, consulting neither
`spot.activeOpponentCount` nor `query.legalActions.wager`. The registry states the
justification (`postflop/rules.ts:271`, `FACING_ALL_IN_POT_ODDS`): *"Facing an all-in there is
nothing left to raise into, so the decision collapses to call or fold on price."* That
sentence is true heads-up and **false multiway**.

**Measured counterexample.**

```
3-way SRP, flop 7h 7d 2c. Hero (BTN) holds 7s 7c — quads.
Short-stacked BB shoves 22.5 BB. CO (100 BB) is still live and has not acted.
  query.legalActions.wager = { kind: 'RAISE', ... }   <- a raise IS legal
  activeOpponentCount = 2, heroEquity = 0.99968
EMITTED: FOLD 1000 | CALL 9000        <- the isolation raise is structurally unreachable
```

Isolating a short shove with the nuts while a deep player is still to act is not an exotic
line; it is the standard one, and the engine cannot express it in any multiway spot,
regardless of holding, board, or price. The fold shown here is MAJOR-3 compounding on top.

**Why MAJOR and not MINOR.** The emitted mix is legal and sums to 10000, so nothing
*mechanical* breaks, and no rationale text reaches the UI (I checked: neither
`lib/table/strategy.ts` nor `StrategyPanel.tsx` renders `rationale`). But an entire correct
action is unreachable on a reachable, common path, and the in-repo justification for its
absence asserts a fact that is untrue — which is exactly the failure mode `CLAUDE.md` rules 5
and 7 exist to prevent. `postflop/policy.test.ts:386` (*"reduces the decision to call or fold
— never a raise"*) locks the behaviour in, but its fixture (`policy.test.ts:370-384`) is
heads-up only; the multiway shape is untested.

**What a fix must preserve.**
- Heads-up behaviour must not move: with one opponent there genuinely is nothing to raise
  into, and `policy.test.ts:370-386` should keep passing unchanged.
- Any multiway raise must still pass `canDo` (`policy.ts:65-67`) — `wager !== null` **and**
  `!onlyAllIn` — and go through `clampPostflopSizing`, so §4's legality result continues to
  hold.
- If the decision is to keep the simplification, the fix is to correct `rules.ts:271` to say
  so honestly (a documented, deliberate limitation) and to add the multiway test — not to
  leave a false statement standing.

---

## 2. MINOR

### MINOR-1 — A short all-in that is **not** a full raise is counted as a raise, pushing genuine 3-bet spots into the UNSUPPORTED fallback

`packages/strategy-core/src/adapter/fromHandState.ts:147-151` derives `isAggressive` as
`toAmount > currentBetBefore`, and `preflop/spot.ts:148-149` counts every `isAggressive`
action into `raiseCount`. `StrategyActionRecord` carries `isFullRaise`
(`types.ts:66`, populated at `fromHandState.ts:366`) but **nothing reads it**.

Reproduced through the real engine: 6-max, HJ has 3 BB.

```
UTG raises to 2.5 BB
HJ  ALL_IN to 3 BB      // engine reports wager.onlyAllIn, isFullRaise false, effect 'RAISE'
CO  folds
BTN raises to 9 BB      // this is the real 3-bet
SB, BB fold
-> back to UTG
```

`classifyPreflopSpot` reports `raiseCount = 3` and `UNSUPPORTED / COLD_FIVE_BET` (because
`aggressions[1]` is the short shove, not the 3-bettor), and `recommendPreflop` with **AA**
returns `CALL 100%` from `FALLBACK_CONTINUE`. Poker-correct is a 4-bet-or-shove spot; the
engine flat-calls the strongest hand in the deck.

Mitigations that keep this MINOR rather than MAJOR: the spot is labelled
`지원하지 않는 상황: 콜드 5BET 라인입니다` in the UI (`StrategyPanel.tsx:233-241`), the
provenance is forced to `HEURISTIC` with a note, and the *common* case (the shove is the last
aggression) is caught earlier by the `facingAllIn` branch at `spot.ts:231` and answered by
`VS_ALLIN`.

**A fix must preserve** the `VS_ALLIN` precedence at `spot.ts:231` (an all-in in front of hero
still collapses the tree regardless of raise counting), the `spot.ts` contract that
classification "contains no strategy", and the typed-`UNSUPPORTED`-never-a-guess rule. The
natural change is to count `isFullRaise` for the *tree depth* while keeping `isAggressive` for
"who is the aggressor" — those are two different questions and the record already carries both.

### MINOR-2 — Raw arithmetic on milliBB values, bypassing `Money.*`

`CLAUDE.md` rule 1 is explicit: *"Never `+`/`*` raw money numbers; use `Money.add`,
`Money.mulRatio`, etc."* Four non-test sites cast `MilliBB` to `number` and operate on it
directly, re-branding only the result:

- `packages/strategy-core/src/preflop/propagate.ts:169` —
  `Money.mbb(Math.max(...[...state.contributions.values()], 0))` (the max is over raw numbers).
- `packages/strategy-core/src/preflop/propagate.ts:171` —
  `Money.mbb(Math.max(0, currentBet - actorContribution))` (raw subtraction, not `Money.sub`).
- `packages/strategy-core/src/preflop/propagate.ts:232-236` — `potBefore` accumulates
  `total += seat.streetContributionMbb as number` starting from `deadMoneyMbb as number`.
- `packages/strategy-core/src/postflop/spot.ts:166-169` —
  `const potBeforeBet = potBefore - call;` on two `as number` casts.

Also `ReplayState.contributions` is typed `Map<StrategyPosition, number>`
(`propagate.ts:129`), so the money brand is dropped for the whole replay rather than at one
boundary.

None of these produced a wrong number in any test I ran — the values are small integers and
the final consumers are ratios — so this is discipline, not a live defect. But the rule exists
precisely so that a future edit to these lines cannot silently introduce a float or an
overflow, and `Money.sub` / `Money.add` already exist.

**A fix must preserve** the documented output semantics: `potOddsOf` and
`facedBetFractionOfPot` are **ratios** and must stay plain numbers (rule 1 permits that
explicitly); only the money arithmetic feeding them should move onto `Money.*`.

### MINOR-3 — `squeezeSizing` silently ignores the per-caller ratio's denominator

`packages/strategy-core/src/preflop/sizing.ts:89-95`:

```ts
const multiplier = base.numerator + extraCallers * SIZING.SQUEEZE_PER_EXTRA_CALLER.numerator;
return { ruleId: 'SIZE_SQUEEZE',
         toAmountMbb: Money.mulRatio(openToMbb, multiplier, base.denominator, 'round') };
```

`SQUEEZE_PER_EXTRA_CALLER.denominator` is never read. It is `1` today and both squeeze bases
have denominator `1`, so the arithmetic is correct — but the file's own contract says sizings
are "exact integer RATIOS (numerator/denominator)" (`tables.ts:18`), and changing
`SQUEEZE_PER_EXTRA_CALLER` to, say, `{1, 2}` would be silently wrong rather than a type error.
Every other sizing helper goes through `ratio()` (`sizing.ts:31-32`), which honours both parts.

**A fix must preserve** the rule's documented meaning (S8: "+1x the open per cold caller
*beyond the first*", `rules.ts:247`, `sizing.ts:90` `coldCallerCount - 1`) and the
single-rounding discipline in `sizing.ts:8-9` — combine the ratios exactly, then round once.

### MINOR-4 — `provenance.ts`'s module contract contradicts ADR-0056 and is now factually wrong

`packages/strategy-core/src/provenance.ts:6-14` defines `SOURCE` as *"read verbatim out of a
stored dataset. Not computed here."* and closes with *"Nothing in this package produces
strategy numbers, so nothing here tags one."* ADR-0056 defines `SOURCE` as *"directly
represented by an accepted public reference rule/table, verified against the cited page in
`docs/reports/STRATEGY_ANCHORS.md`"* — a different test — and this package now very much does
produce strategy numbers (`preflop/tables.ts`, `postflop/scoreModel.ts`).

This matters more than a stale comment usually would: provenance is the load-bearing honesty
mechanism of the whole milestone, and its own definition file no longer states the rule the
rest of the package is applying. The four `SOURCE`-tagged rules
(`SIZE_RFI`, `SIZE_THREE_BET_OOP`, `SIZE_FOUR_BET_IP`, `SIZE_FOUR_BET_OOP`) were each checked
against the anchor doc and each is legitimately VERIFIED-across-independent-sources, so no tag
is currently overclaiming — the defect is the definition, not an application of it.

**A fix must preserve** the `Provenanced<T>` type-level guarantee that `HEURISTIC` carries a
mandatory `note` (`provenance.ts:32-34`) and the orthogonality to `MOCK`.

### MINOR-5 — The panel's "a keystroke never waits on anything" is stronger than the design delivers

`apps/web/src/components/table/StrategyPanel.tsx:22-47` and `docs/reports/STRATEGY_WP_B4.md`
§1.2 argue that moving the analysis out of the effect body into a `setTimeout(…, 0)` means a
keystroke can never wait on it. Cancellation is real and correct (`StrategyPanel.tsx:117`
clears a superseded timer, proven by a call-counting test) — but once the timer has *fired*,
`computeStrategy` runs to completion on the main thread with no yield point. A keystroke that
arrives inside that window waits for the remainder: up to ~90 ms measured heads-up, up to
~150 ms on the 6-way shape from MAJOR-2. There is no worker and no time-sliced budget.

B4's own measurement table (`STRATEGY_WP_B4.md` §1.3) reports 1–2 ms for "hero's next action
(`c`) while the analysis is in flight", which means that particular run landed outside the
window rather than demonstrating the window does not exist.

**A fix must preserve** the cancellation semantics (a burst of N actions must still analyse
only the last state), the `Hand`-object identity dependency (`StrategyPanel.tsx:118`), and the
rule that nothing is computed during render. Correcting the *claim* is sufficient; a worker was
explicitly out of scope.

### MINOR-6 — `heroVsAggressor` is computed against the last aggressor only, and drives sizing in multiway spots

`packages/strategy-core/src/preflop/spot.ts:177-182` sets `heroVsAggressor` by comparing
hero's `postflopOrder` with the **last aggressor's** alone. `sizingRequestFor`
(`preflop/policy.ts:514`) feeds exactly that value into `threeBetSizing` / `fourBetSizing` /
`squeezeSizing`, where it selects the IP vs OOP multiplier (3x vs 4x; 2.3x vs 2.5x; 4x vs 5x).

The query already carries a stronger, correctly-multiway field — `heroInPosition`
(`types.ts:216-222`, computed at `fromHandState.ts:384-389` against *every* live opponent) —
and the preflop policy never reads it. In a squeeze spot hero can be IP relative to the opener
while still having live players behind, and the sizing rule then takes the smaller IP baseline.
S8's own wording (anchor 5) is about being in position for the hand, not merely relative to one
opponent.

I could not construct a *preflop* lineup where this produces an illegal or absurd size — the
fuzz in §4 covers it and found none — so this is a modelling-fidelity concern, not a bug.

**A fix must preserve** `heroVsAggressor` as a distinct reported field (`PreflopSpot` exposes
both, and the explanation feature `RELATIVE_POSITION` renders it), and must not start deriving
position inside `strategy-core` — every positional fact must keep coming from the adapter
(ADR-0055's seam rule).

### MINOR-7 — B2's "no RNG anywhere" is true of the engine but there *is* a seeded PRNG in the package's tests

`docs/reports/STRATEGY_WP_B2.md:111` (*"Subsampling — a golden-ratio Weyl walk, no RNG
anywhere"*) and `:130` (*"no seed, no clock, no machine entropy"*) are correct for the shipped
path — I verified `equity/sampling.ts` end to end and found a pure `(n, k)` Weyl walk with a
coprime stride, ascending-sorted output, and no entropy source. But
`packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:31-57` defines a mulberry32
PRNG and a shuffler used to sample seven-card hands. It is *seeded* and therefore
deterministic, so nothing is actually non-reproducible; the blanket phrase "no RNG anywhere"
is simply broader than the code. Recorded so a future reader does not grep, find it, and
conclude the report was dishonest.

### MINOR-8 — B3's "`postflop/score.ts` … **No constants.**" is not true, and the constants that are there are undocumented

`docs/reports/STRATEGY_WP_B3.md:67` describes `postflop/score.ts` as *"Arithmetic on the
model. **No constants.**"*, `scoreModel.ts:5-6` makes the same claim more broadly (*"`score.ts`,
`sizing.ts` and `policy.ts` contain control flow and arithmetic; they contain NO constants"*),
and `scoreModel.ts:10` claims to hold *"the entire model, as exported data"*. The claim is
false for `score.ts` specifically and a fortiori for the wider one. Strategy magnitudes living
outside the model file:

- `packages/strategy-core/src/postflop/score.ts:254` and `:394` — `context.spr ?? 4`,
  **twice**, undocumented. The literal `4` is exactly `SPR_PRESSURE_BANDS`'s `MEDIUM` edge
  (`scoreModel.ts:457`), so it silently means "treat an unknown SPR as the neutral band" — but
  nothing says so, and moving that band edge in `scoreModel.ts` would leave the default behind
  without any self-check noticing (`assertModel` only checks band ordering, `scoreModel.ts:964`).
- `packages/strategy-core/src/postflop/context.ts:273` —
  `rangeAdvantage: distribution.value.aggregate.equity - 0.5`. The `0.5` baseline *is*
  documented, but in `rules.ts:164` rather than in `scoreModel.ts`, and B3's own table calls
  `context.ts` *"the measurement layer: three expensive B2 calls and nothing else"*. The `0.5`
  is the zero-point of `RANGE_ADVANTAGE_BANDS`, so it is a model value by any reading.
- `score.ts:312`, `:314` — `checks >= 2` / `checks === 1`. The *points* they select live in
  `STREET_ACTION_POINTS`; the **thresholds** that select them do not.
- `score.ts:515-516` — a second private `FREQUENCY_STEP = 500` / `BPS_TOTAL = 10000`,
  duplicating values already owned by `bps.ts:22` and `preflop/recommendation.ts:31`. Three
  declarations of the same two numbers is three places for them to drift.
- `postflop/policy.ts:184-185` — `lineupSize >= 6` / `>= 4`, the lineup-degradation thresholds;
  `policy.ts:197` and `:226` — `activeOpponentCount <= 1` / `>= 2`, the multiway degradation
  and confidence triggers. `CONFIDENCE_THRESHOLDS` is in the model file; the trigger is not.
- `postflop/sizing.ts:246` — `degradeProvenance(base, 1)`, the clamp degradation step count.

In practice `query.spr` is only `null` on a zero pot (`types.ts:201-202`), which cannot happen
postflop, so no live recommendation currently depends on the `?? 4`. This is a
single-source-of-truth violation and a false report claim, not a wrong number — but the
`?? 4` is the one that matters most, because it is an authored strategy default with neither a
rationale nor a `HEURISTIC` tag.

**A fix must preserve** the module-load self-check (`assertModel`) as the place a bad model
value is caught, and `scoreModel.ts`'s per-entry rationale convention — a constant moved there
needs a rationale, not just a name.

---

### MINOR-9 — `HERO_EQUITY_MEASUREMENT` is tagged `DERIVED` while its own `anchor` field states the inputs are `HEURISTIC`

`packages/strategy-core/src/postflop/rules.ts:152-157`:

```ts
id: 'HERO_EQUITY_MEASUREMENT',
provenance: 'DERIVED',
anchor: 'Mechanical enumeration (B2); the RANGES it runs against are HEURISTIC.',
```

`provenance.ts:9-10` defines `DERIVED` as "computed from **`SOURCE`** values by a documented,
deterministic rule". `STRATEGY_ANCHORS.md` contains no postflop anchor that could source a
villain range — that document's own §4 is explicit that even preflop BB-defence breadth is
`UNVERIFIED → HEURISTIC`. A deterministic function of `HEURISTIC` inputs is `HEURISTIC`; the
anchor string says as much in the same object that claims otherwise.

Output impact is nil today: `worstProvenance` (`policy.ts:639`) lands on `HEURISTIC` regardless
because `VILLAIN_RANGE_FROM_PREFLOP` is unconditionally in the id set (`policy.ts:602`). But
the per-rule tag is surfaced through `provenance.ruleIds`, and this is precisely the
"over-strong provenance tag" class ADR-0056 exists to prevent. **A fix must preserve** the
adjacent, correctly-`DERIVED` `FACING_ALL_IN` price rule (`rules.ts:~145`), which really does
trace to S14 and is the package's one genuine postflop `SOURCE`-backed relationship.

---

### MINOR-10 — `RAISED_TO_MINIMUM` multiplies the intended size without touching the frequency, contradicting B3's own ADR

`packages/strategy-core/src/postflop/sizing.ts:237-250` clamps a wanted amount up to
`minToAmountMbb` and degrades provenance one step (`sizing.ts:246`), but the frequency coming
from `scoring.mix` is unchanged. Measured:

```
flopSpot, 100 BB stacks, engine wagerMinTo = 60 BB
model wants a 50%-pot bet = 2750 mbb  ->  clamped to 60000 mbb (21.8x the wanted size)
frequency: 8000 bps, UNCHANGED
```

`STRATEGY_WP_B3.md` §14 ADR #3 states the opposite principle: *"Legality handling must never
silently change the strategy; when the wanted size cannot be expressed, the honest degrade is
not to aggress."* `ALL_IN_GATE` enforces exactly that in the shove direction (`policy.ts:116`;
I verified `onlyAllIn` and `noWager` both collapse to `CHECK 10000`). The min-clamp direction
has no equivalent guard. In a realistic engine the gap is small — a min-bet into a tiny pot —
which is why this is MINOR and not MAJOR, but the asymmetry is real and undocumented.

**A fix must preserve** the clamp's honesty machinery: `requestedToAmountMbb` must keep
carrying the pre-clamp value (`CLAUDE.md` rule 3 — never destroy the entered/intended number)
and `clamp: 'RAISED_TO_MINIMUM'` must keep reaching the UI.

---

### MINOR-11 — `ALL_IN_CALL_MARGIN` is declared, cited as an input, and never read; its value is hard-coded a second time

`scoreModel.ts:813` declares `export const ALL_IN_CALL_MARGIN = 0.02;` and `rules.ts:270`
lists it in `inputs: ['hero equity', 'required equity', 'ALL_IN_CALL_MARGIN']`. Grep across
`packages/strategy-core/src` (tests excluded) finds **zero** readers: `score.ts:598` uses
`bandFor(ALL_IN_CALL_BANDS, margin)`, and the ±0.02 band edges are written out independently
in the band table just above the constant. Two copies of one number that can silently drift,
plus a registry entry naming an input the code does not consume — a small instance of the
`CLAUDE.md` rule 5 concern (documentation describing an implementation that does not exist).

**A fix must preserve** the exported constant itself: `rules.ts` and the UI both want to state
the tolerance, so the fix is to derive the band edges from it, not to delete it.

---

## 3. NOTE

- **NOTE-1** — `apps/web/src/lib/table/copy.ts:310` renders `NOT_A_DECISION_POINT` as
  *"지원하지 않는 상황입니다"* ("this situation is not supported"). The adapter also emits that
  code when the hand is simply not in a betting phase (`fromHandState.ts:222-226`), e.g. while
  a board card or an award is outstanding — which is a normal state, not an unsupported one.
- **NOTE-2** — `PostflopSpotFamily.PROBE` (`postflop/spot.ts:32-33`, rendered as 프로브 벳) covers
  a donk bet (leading into the previous street's aggressor) as well as a true probe. The
  header documents the definition it uses, so this is naming, not classification.
- **NOTE-3** — `buttonSeat` and the running stacks are never persisted: `updateSessionTable`
  has no caller anywhere in `apps/web`. This bounds MAJOR-1's blast radius to the live session
  (a reload resets to the stored table), and is a pre-existing Phase-8 gap rather than
  something this milestone introduced.
- **NOTE-4** — Every recommendation carries at least three boilerplate notes
  (`FREQUENCY_QUANTIZATION`, `PRIMARY_ACTION_TIE_BREAK`, `ENVIRONMENT_COMPATIBILITY` are all
  `DERIVED`, `preflop/policy.ts:680-685`), so the
  `invariant(quality !== 'HEURISTIC' || notes.length > 0)` guard at `policy.ts:688` is
  satisfied by boilerplate rather than by the heuristic that actually drove the answer. The
  real rule *is* also in the list, so the guarantee holds; it is just weaker than it reads,
  and the UI note list (`StrategyPanel.tsx:338-344`) is noisier than it needs to be.
- **NOTE-5** — `apps/web/src/components/table/StrategyPanel.tsx` is unmounted whenever the
  right panel is `HISTORY` or `PLAYER` (`TableRoot.tsx:512-526`), so its `computed` state is
  discarded and rebuilt on every mount. Selecting a seat and pressing `Esc` re-runs a full
  postflop analysis. Harmless today, worth knowing if MAJOR-2's budget is ever tightened.
- **NOTE-6** — Heads-up, poker-core labels the two seats `BTN` and `BB` (there is no `SB`
  label even though the button posts the small blind), so a heads-up open is answered from
  `RFI_RANGES.BTN` — 42.8% of hands, where heads-up play opens far wider. This is *correctly*
  degraded: `LINEUP_VERY_SHORT_HANDED` forces the provenance to `HEURISTIC` and the environment
  factor to `DIVERGENT` (`preflop/policy.ts:385-391`, `:444-450`), which is exactly what
  ADR-0056 and anchor 8 require of an unmodelled lineup. Recorded so nobody later mistakes the
  number for a heads-up recommendation.
- **NOTE-7** — `ALL_IN_CALL_BANDS` (`scoreModel.ts:~745-751`) stores `points: 10000 / 8500 /
  5000 / 1500 / 0` in a `ScoreBand`, a type whose every sibling table carries −100..100 point
  values and whose ordinary consumer `component()` (`score.ts:112`) clamps to ±100. It works
  only because `score.ts:599` reads `.points` directly and `assertModel` grid-checks it
  (`scoreModel.ts:~980`). Routing this table through `component()` would silently clamp
  10000 → 100. A distinct type would remove a live footgun.
- **NOTE-8** — `postflop/policy.ts:538` reads
  `heroSeat?.streetContributionMbb ?? Money.ZERO`. If no seat carries `isHero`, `buildAction`
  (`policy.ts:275`) emits `amountMbb = toAmountMbb − 0`, i.e. an overstated chips-in figure,
  while `toAmountMbb` stays legal. `buildPostflopRanges` checks hero presence in the
  *propagated* seats, not in `query.seats`, so nothing upstream guarantees the lookup
  succeeds. An `invariant` costs nothing and is the difference between a crash and a wrong
  money number.
- **NOTE-9** — Dead weight in the hot path (relevant to MAJOR-2): `context.ts:251` and
  `:283-284` compute `strongCutoffStrength` / `heroStrongShare` / `villainStrongShare` via
  `STRONG_SHARE_PERCENTILE` (`scoreModel.ts:931`); grep finds no reader anywhere in
  `packages/*/src` or `apps/web`. Two extra `shareAtOrAbove` passes and three unused fields on
  every postflop recommendation. Separately, `postflop/index.ts:60` publicly exports
  `sizingRequestFor`, which returns an **unclamped** `toAmountMbb`; only `clampPostflopSizing`
  makes it legal and nothing in the type system pairs them, so `PostflopSizingRequest` is an
  illegal-amount carrier with a public constructor.
- **NOTE-10** — Two provenance-presentation points, neither a defect. (a) Postflop
  `provenance.quality` is a constant, not a measurement: `VILLAIN_RANGE_FROM_PREFLOP`
  (`HEURISTIC`) is unconditionally in `ruleIds` (`policy.ts:602`), so `worstProvenance`
  (`policy.ts:639`) returns `HEURISTIC` for *every* postflop recommendation and the whole
  `Degradation` machinery (`policy.ts:184-197`) cannot move the field it feeds — `confidence`
  is the only gradated output. `rules.ts:21` says "essentially always HEURISTIC" where the
  truth is "always". (b) `STACK_BUCKET_NEARBY` (`rules.ts:416-418`) and
  `ENVIRONMENT_COMPATIBILITY` (`rules.ts:456-458`) are `DERIVED` citing *ADR-0056* as their
  anchor; the doc-comment contract for that field (`rules.ts:84`) asks for "an anchor doc
  citation, or an explicit statement that no public source covers this", and an internal ADR
  id is neither. Both are mechanical mappings, so the classification is defensible as
  *mechanics* — the citation is what is off. In the registry's favour, and contrary to what an
  adversarial reading would hope for: **no postflop rule claims `SOURCE`.** I checked all 41
  entries, which matches the total absence of postflop anchors in `STRATEGY_ANCHORS.md`.
- **NOTE-11** — `postflop/sizing.ts:180` says the raise formula is *"the only reading under
  which a 100%-pot raise leaves villain facing a pot-sized bet."* With pot 6000 and villain
  betting 4000, `f = 1.0` gives raise-TO 18000; villain then faces 14000 into a pot of 28000 —
  a **half-pot** price, which is standard pot-raise geometry. The arithmetic is right (§4);
  the sentence describing it is not.

---

## 4. What I tried to break and could NOT

This section is the point of the review. Everything below is a *negative* result obtained by
executing the real code, not by reading a comment.

**Frequency and legality invariants — 3,207,408 preflop recommendations, zero violations.**
I exhaustively walked the preflop action tree (fold / check / call / min-raise / 2x-min-raise /
all-in at every decision point, depth 7) across five lineups (6-, 5-, 4-, 3- and 2-handed),
five stack profiles (uniform 100 BB; a 12 BB seat; 25 BB + 8 BB; 200 BB + 45 BB; 3 BB + 6 BB)
and eight hero holdings, asserting on every emitted recommendation that: the frequencies sum
to **exactly 10000**; every frequency is a multiple of 500; every `RAISE` sits inside
`[wager.minToAmountMbb, wager.maxToAmountMbb]` and is never emitted when `wager` is null or
`onlyAllIn`; every `ALL_IN` / `CALL` amount equals the engine's own; `FOLD` / `CHECK` are only
emitted when legal. **Zero violations.** I specifically hunted for the clamp bypasses,
all-in gates, legality substitutions and BB-vs-milliBB slips named in the brief and found none.

**The same fuzz postflop — 6,105 recommendations, zero violations.** Every postflop line
reachable to depth 3 from six preflop skeletons (HU single-raised, 3-way, a 3-bet pot, a 6-way
limped pot, a short-stacked HU pot, a deep 4-handed pot) across four boards
(`Qh 7d 2c`, `Ah Kd Qs`, `9h 8h 2c`, the trips board `5s 5d 5c`) and flop/turn/river,
additionally asserting that a `BET`/`RAISE` matches the engine's own `wager.kind` and that
`amountMbb` lies inside `[minAdditionalMbb, maxAdditionalMbb]`. Nine minutes of compute; not
one frequency set off 10000, not one out-of-bounds size, not one action the engine had not
offered.

**A second, independent postflop sweep reached the same conclusion by a different route — 372
answered cases, each re-evaluated for bit-identity.** It probed specifically for a *bypass* of
the quantizer rather than for a bad value, and every candidate path failed to bypass it:
legality substitution merging two buckets onto one kind (`merged.set(...)`, `policy.ts:~579`)
happens **before** quantization; the zero-frequency filter (`if (frequencyBps <= 0) continue`,
`policy.ts:~589`) drops only post-apportionment zeros,
which contribute nothing to the sum; the all-in gate's fall-through still runs the quantizer;
`onlyAllIn` and `noWager` both collapse to `CHECK 10000`. `scoring.mix` is itself exactly
10000 on all three branches by construction (fold = 10000 − continue; passive = continue −
raise; raise ≤ continue), and the single float in the chain — `rawRaise = (continueBps ×
raiseShareBps) / 10000`, `score.ts:625` — is snapped by `toGrid` before `apportion` ever sees
it, so the integer precondition is never violated. Legality was re-checked against both TO
bounds *and* the additional-amount bounds across `plain` / `tinyMax` (1.5 BB) / `hugeMin`
(60 BB) / `onlyAllIn` / `noWager` wagers and 40 / 55 / 100 / 160 / 200 BB stacks: zero
violations. The only apparent out-of-bounds hits in either harness came from **hand-fabricated
wagers with `min > max`**, which `poker-core/src/betting.ts:280-281` provably never emits
(`const onlyAllIn = rawMin > maxTo; const minTo = onlyAllIn ? maxTo : rawMin;`) and which
`sizing.ts:237` handles anyway by collapsing to the maximum. That branch is unreachable
defensive code, not a live path.

**Raise-BY vs raise-TO confusion — not present.** `sizingRequestFor` (`sizing.ts:200-208`) is
raise-TO throughout: `callTo + f·(potBeforeDecision + call)`. Hand-checked against a textbook
re-raise (pot 6000, hero bets 3000, villain raises to 9000, `f = 1.0` → 33000).
`buildAction` derives `amountMbb = toAmountMbb − heroStreetContribution`, and `poker-core`
defines `maxAdditional = seat.stack`, `minAdditional = minTo − streetContribution` — the two
definitions agree exactly, so the additional-amount bounds hold whenever the TO bounds do.
(The doc comment describing this formula is wrong; the formula is not. See NOTE-11.)

**Postflop determinism — nothing found.** A repo-wide grep for `Math.random` / `Date.now` /
`performance.now` / `new Date` / `crypto` across `packages/strategy-core/src` excluding tests
returns exactly one hit, and it is a doc comment (`postflop/policy.ts:~521`). Every ordered
structure feeding the output is deterministic: `merged` is a `Map` filled in fixed `raw`
order, `new Set(ruleIds)` preserves insertion order, the villain sort keys on `postflopOrder`
under V8's stable sort, and `distributeRemainders` (`bps.ts:65-82`) specifies its tie-break
fully (remainder desc, then index asc). Re-running every case produced byte-identical
`actions`. One nuance worth recording rather than filing: `weylIndices` asserts
`2n <= Number.MAX_SAFE_INTEGER`, and the largest documented space is `1326^5 ≈ 4.10e15`, so
`2n ≈ 8.2e15` against `9.007e15` — it holds, with about 10% headroom, which is tighter than
the surrounding comment implies.

**The SB raise-only trim, recomputed by hand.** S1's SB composite is 826 combos = 62.29% (I
counted it independently: 78 pairs + 268 suited + 480 offsuit). Dropping the offsuit runs
weakest-high-card-first gives 802 → 766 → 730 → 682 → **598**, the first list at or below the
47% band ceiling, = **45.098%**. The engine produces exactly 598 combos / 0.45098039…, and
`STRATEGY_WP_A3.md:56,115` states 45.10%. The trim rule, its stopping condition and the
report's number all agree.

**The RFI percentages.** UTG 17.04%, HJ 21.12%, CO 27.75%, BTN 42.84% — every one inside the
three-source bands in `STRATEGY_ANCHORS.md` anchor 1, and matching `RFI_PERCENT_BANDS`.

**Equity, verified by hand against an independent count.** Hero `Ah Kh`, board
`Qh 7h 2s 3c`, villain exactly `Qs Qd` (a set). Villain's two cards remove themselves from the
46-card runout space, leaving 44 live rivers. Hero wins only by making the nut flush *without*
pairing the board: nine hearts remain, of which `2h` and `3h` fill villain's full house, so
hero wins **7 of 44 = 0.1590909090…**. The engine returns `0.1590909090909091` with
`method: 'EXACT'` over 46 enumerated runouts. Card removal, per-runout conflict skipping, tie
semantics (`1/(t+1)`, `equity.ts:464-470`) and the weight denominator are all correct.

**Card removal in propagation, verified by hand.** Hero `Ah Kd` on the BTN, UTG opens. UTG's
propagated range is exactly `RFI_UTG` at 10000 bps minus every combo containing `Ah` or `Kd`:
226 → **183** combos. Counting the removals by hand: 26 contain `Ah` (3 `AA` + 11 suited aces +
12 `ATo+`), 18 contain `Kd` (3 `KK` + 1 `AdKd` + 5 `K8s+` diamonds + 3 `AKo` + 6 `KJo/KQo`),
minus 1 for `AhKd` counted twice = **43**. 226 − 43 = 183. Exact match. Hero's own range
correctly *keeps* its own blockers (`AhKd` at 10000 in the BTN range) — the documented rule.

**Propagated weights match the policy exactly.** BTN cold-calls a CO open: `TT` → 5000 (the
`THREE_BET_MIXED` 50/50 call mass), `A5s` → 3500 (the `THREE_BET_BLUFF` 35/35/30 call mass),
`76s` → 10000 (plain `DEFEND_WIDE` continue), `QQ` → 0 (pure 3-bet), `72o` → 0 (out of range).
Folded seats land on exactly `1326 − |RFI|` active combos (UTG 1100, HJ 1046, CO 958, BTN 758
against tables of 226 / 280 / 368 / 568). No stray basis point appears anywhere the policy
assigns zero.

**Off-policy handling.** An SB limp — zero-frequency under a raise-or-fold table — leaves the
SB range fully uniform (1326 combos, 13,260,000 bps) and sets `offPolicy: true`, exactly as
`propagate.ts:69-76` documents. It does not produce the empty range.

**Table internal consistency.** The four defend tiers are strictly nested by construction
(PREMIUM 50 ⊂ TIGHT 122 ⊂ MEDIUM 228 ⊂ WIDE 350 ⊂ VERY_WIDE 602 combos), the four
`ALLIN_CALL` tiers likewise (22 ⊂ 50 ⊂ 92 ⊂ 206), and every value / mixed / bluff / call subset
is pairwise disjoint within its spot (3-bet, 4-bet, cold 4-bet, 5-bet, squeeze). I looked
specifically for a wider tier that folds a hand a tighter tier continues, and for a position
whose 3-bet range contains hands no reachable table supports; neither exists.

**Position and short-handed classification, hand-worked.** Folded to SB, SB opens, BB faces it
→ `BLIND_VS_BLIND` with hero IP (BB's `postflopOrder` 1 > SB's 0) ✔. Three-handed
BTN-opens / SB-folds / BB-faces-it → `VS_OPEN`, *not* `BLIND_VS_BLIND`, with hero OOP ✔ (the
`blindVsBlind` flag reads live seats, so a folded SB does not make it a blind battle). SB limp
into BB → `VS_LIMP` with `blindVsBlind` set and `limperCount 1`, routed to the SB raise-only
table at 3.5 BB per anchor 7 ✔. Hero SB three-way on the flop → `heroInPosition: false` ✔.
UTG opens / HJ calls / hero SB → `SQUEEZE` with `coldCallerCount 1`, OOP, sized 5× the open =
12.5 BB, inside the engine's `[4000, 100000]` bounds ✔. The 6 → 5 → 4 → 5 dealt-in ladder
behaves as A1 claims (verified through the store test's own scenario and the engine).

**Determinism.** Byte-identical postflop recommendations across repeated calls on the same
query *and* across an independently rebuilt query object. `equity/sampling.ts` is a pure
function of `(n, k)`. A full sweep found no `Math.random`, no `Date.now`, no `new Date`, no
`performance.now` and no network call in any non-test file in `strategy-core`; the only
`crypto` use in the web layer is `cryptoIdFactory` for entity ids, injected and overridable,
never on the strategy path. Every `Array.sort` in non-test code either carries an explicit
index tie-break or sorts values that are unique by construction, and the one comparator-less
sort (`equity/rangeEquity.ts:307`) is on a `Float64Array`, where the default *is* numeric.
The two `[...map.keys()]` spreads that feed the quantizer (`preflop/policy.ts:643`,
`postflop/policy.ts:551`) are fed from fixed literal arrays, so insertion order is fixed.

**The evaluator.** `analysis/evaluateExhaustive.test.ts:17-27` asserts the nine five-card
category frequencies over all C(52,5) = 2,598,960 hands. I checked all nine against the
published distribution from memory of the combinatorics (40 / 624 / 3,744 / 5,108 / 10,200 /
54,912 / 123,552 / 1,098,240 / 1,302,540) — every one matches. This is a genuinely strong
validation and it is not overstated in B1.

**GTO labelling.** A case-insensitive sweep of `strategy-core/src` and the seven web files for
`GTO`, `solver`, `solved`, `optimal`, `Nash`, `내쉬`, `균형` found **no** user-facing string, no
`data-testid`, no `aria-label` and no identifier claiming solved status. Every hit is a comment
or a test *forbidding* the label. `STRATEGY_ENGINE_LABEL` is `'기본전략 · REFERENCE'`
(`copy.ts:194`) and the primary badge is `'추천'`, never `'정답'` (`copy.ts:198`). The one
"optimal" hit (`analysis/evaluate.ts:314`) is about the best five-card subset, a different
sense of the word. `EnvironmentCompatibilityStatus` genuinely has no `EXACT` member, as
ADR-0056 requires.

**Baseline purity.** No import of, or reference to, `@gto-self/player-core` anywhere in
`strategy-core`. `StrategyPanel` is rendered with **no props** (`TableRoot.tsx:524`) and reads
only `state.hand` and `state.table.heroSeat`; `PlayerProfilePanel` occupies the same slot
mutually exclusively and shares no data path into it. Nothing in `lib/table/strategy.ts`
authors a number — the single arithmetic operator in the file is `frequencyBps / 100`.

**The A1 sit-out work, apart from MAJOR-1.** A mid-hand toggle leaves `hand` and `view`
reference-identical and mutates only `table` (verified). `applyHandResult`
(`poker-core/src/table.ts:239-257`) compares `playerId` only and its settle spread preserves
occupancy, so ADR-0057's two conditions genuinely hold. Persistence writes exactly one column
of exactly one row keyed on `(sessionId, seat)`
(`packages/db/src/repositories/sessions.ts:314-336`); the server action re-parses the shape,
rejects `'EMPTY'`, and refuses on a missing or closed session
(`apps/web/src/server/session-service.ts:365-412`). The per-seat sequence guard
(`TableRoot.tsx:243-250`) drops superseded responses, and the failure banner does not revert
the toggle. The `S` hotkey is gated on `isTypingTarget`, `paletteOwnsKeyboard`, modifier keys
and `event.repeat`, and goes through `resolveTypedKey` for IME safety
(`TableRoot.tsx:301-319`). I could not make a toggle corrupt a live hand, mis-address a seat,
or survive an undo incorrectly.

**Layering.** `@gto-self/poker-core` is imported only under `src/adapter/`; `types.ts` declares
its string unions independently rather than re-exporting, exactly as ADR-0055(c) requires.

---

## 5. Reproduction

Everything above was produced by throwaway vitest files in the session scratchpad
(`/private/tmp/claude-501/…/scratchpad/`), run with a scratchpad-local config that aliases the
workspace packages to their `src` entry points. **No file in the repository was created or
modified by this review** other than this report.

| script | what it establishes |
| --- | --- |
| `verify.test.ts` | preflop legality/frequency fuzz (3,207,408 recommendations); hand-worked BvB / 3-handed / SB / squeeze / short-all-in scenarios; SB trim and RFI percentages; hand-checked equity |
| `verify2.test.ts` | propagation vs policy; card removal counted by hand; off-policy limp |
| `verify3.test.ts` | postflop position, determinism, HU and 3-way flop timing |
| `verify4.test.ts` | 6-way and 4-way flop timing (MAJOR-2) |
| `verify5.test.ts` | the button counterexamples (MAJOR-1) |
| `verify6.test.ts` | postflop legality/frequency fuzz |
| `verify7.test.ts` | tier nesting and subset disjointness |
| `verify8.test.ts` | short-handed position ladders (6/5/4/3/2-handed) and their degradation tags |
| `p1_eval.ts` … `p8_digest.ts`, `probe*.ts` | the second, independent postflop sweep: the quads counterexamples behind MAJOR-3 and MAJOR-5, the `facedBetFractionOfPot` counterexamples behind MAJOR-4, the min-clamp measurement behind MINOR-10, and the 372-case determinism/legality re-check in §4 |

No existing test was run beyond targeted confirmation, no suite was modified, and the full
regression suite was deliberately not re-run (it was green on unchanged source).
