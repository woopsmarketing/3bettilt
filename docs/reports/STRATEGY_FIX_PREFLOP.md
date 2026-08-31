# STRATEGY_FIX_PREFLOP — R1 preflop fix work package

Scope: `packages/strategy-core/src/preflop/**`, `src/range/**` and their tests, plus one
engine-backed regression under `src/adapter/` that the coordinator added mid-package (M7).
Nothing under `src/postflop/**`, `apps/web`, `packages/poker-core`, `src/index.ts`,
`docs/STATE.md` or `docs/DECISIONS.md` was touched.

Date: 2026-09-01.

---

## 0. A discrepancy the orchestrator should know about, stated first

The work package named findings **B1 / M1 / M6** from `docs/reports/STRATEGY_REVIEW_R1.md`.
The R1 report **on disk** (31,655 bytes, mtime 03:51) does not contain those labels. It opens
with *"Verdict: no BLOCKER"*, its two MAJORs are the sit-out button rewind (poker-core) and the
postflop latency claim, and its §4 lists the SB raise-only trim under **things the reviewer
tried and could NOT break**. Its MINOR-1 explicitly says a fix *"must preserve the `VS_ALLIN`
precedence at `spot.ts:231` (an all-in in front of hero still collapses the tree regardless of
raise counting)"* — the opposite of what B1 asks for.

So the finding descriptions in the work package come from a review pass that is not the file
on disk. **I did not treat that as a reason to stop.** Every finding as described in the brief
was independently reproduced against the real code before anything was changed (§1–§3 each
record the reproduction), so the fixes rest on observed behaviour, not on a report I could not
locate. Two consequences the orchestrator should decide on:

- `STRATEGY_REVIEW_R1.md` on disk still asserts the old `VS_ALLIN` precedence as a thing to
  preserve. It now describes behaviour that no longer exists.
- I did **not** edit `STRATEGY_WP_A3.md`, which states the SB range is 45.10%. It is now
  46.91% (§2). A3 is a historical record of that work package; updating it is the
  orchestrator's call.

---

## 1. B1 (BLOCKER) — `VS_ALLIN` swallowed every spot with an all-in in front of hero

### Reproduction (before any change)

6-max, 100 BB stacks, hero HJ with `As Ad`, UTG open-shoves 3 BB. Nothing else has happened,
so CO, BTN, SB and BB are all still to act.

```
family:            VS_ALLIN
legalActions.wager {kind:RAISE, minTo:6000, maxTo:100000, onlyAllIn:false}
activeOpponents:   5
recommendation:    CALL 10000        <- AA flats a 3 BB shove with four players behind
```

### Root cause

`preflop/spot.ts` rule 2 was unconditional:

```ts
const facingAllIn = lastAggression !== null && lastAggression.isAllIn
                    && Money.isPositive(query.callAmountMbb);
if (facingAllIn) return spot('VS_ALLIN');
```

`VS_ALLIN` routes to `VS_ALLIN_POT_ODDS`, a pure call/fold table (`policy.ts`
`allInCallTier`), and `sizingRequestFor` returns `null` for that family — so the raise bucket
could not exist. The classification asserted "there is nothing left to raise into" as a fact
about *the last action*, when it is a fact about *the whole table*.

### The classification rule now, stated precisely

`facingAllIn` is unchanged: the last aggression was an `ALL_IN` and hero owes chips.

`VS_ALLIN` is applied **only when the tree has genuinely collapsed**:

> `facingAllIn` **AND** ( hero has no aggressive option **OR** no live opponent besides the
> shover remains ).

where the two clauses are defined against the query, not inferred:

- **hero has an aggressive option** — `legalActions.wager !== null` (the engine offers a
  wager for a full raise *and* for a short all-in raise, flagged `onlyAllIn`), **or**
  `legalActions.allIn !== null && legalActions.allIn.effect === 'RAISE'`. An `allIn` whose
  `effect` is `'CALL'` is not an aggressive option — it is hero calling with the last chip,
  the same money as `legalActions.call` (this is also M7, §5).
- **a live opponent besides the shover** — a dealt-in seat that is not hero, is not `FOLDED`,
  is not already `ALL_IN`, and is not the shover's own seat.

Anything else keeps its underlying family (`VS_OPEN`, `SQUEEZE`, `OPENER_VS_3BET`,
`COLD_4BET`, `VS_4BET`, `OPEN_PLUS_CALLER`) and reports `facingAllIn: true`.
`BLIND_VS_BLIND` cannot survive the fall-through by construction: it requires exactly two live
seats, which means zero live opponents besides the shover, which collapses.

A new **additive** field `PreflopSpot.allInCollapsedTree: boolean` reports the condition, so a
consumer can distinguish a collapsed shove from one hero can still raise over. No field was
renamed or removed.

### The policy inside a live tree — rule `FACING_ALLIN_IN_TREE` (HEURISTIC)

The family's own answer is **adjusted, never replaced**:

| bucket | rule |
| --- | --- |
| RAISE | kept **exactly** as the family assigned it. This is the half that stops AA flatting. |
| CALL | kept only if the class also clears the pot-odds tier the price selects (`allInCallTier`). Continuing against a committed stack is a pure equity question — there are no later streets to win — and S14's pot-odds relationship is the one sourced input available. |
| FOLD | receives whatever left CALL. |

Every family mix is already a multiple of 500 bps, and moving one whole bucket into another
preserves that, so `assertClassFrequencies` still holds (ADR-0056: 5%-step BPS summing to
10000). Provenance: HEURISTIC with a mandatory note — honest, because **no public source
covers a preflop spot with a short shove and live players behind it**, and `STRATEGY_ANCHORS.md`
has no anchor for it. The rule is reported in `provenance.ruleIds` beside the family rule via
a new **optional** `ClassPolicyOutcome.adjustRuleId`.

### Sizing over a shove — rule `SIZE_FACING_ALLIN_JAM` (HEURISTIC)

The family's formula is used unchanged while it leaves a real stack behind. It becomes the
**jam** once the requested raise-TO reaches the midpoint between hero's current street
contribution and the engine's maximum raise-TO — past that point the raise cannot fold out a
stack that is already all-in and leaves hero too short to fold to the players behind. A
request that simply *exceeds* the maximum still goes through `LEGALITY_CLAMP` exactly as
before. All arithmetic is `Money.*` (`Money.sub` / `Money.mulRatio(behind, 1, 2, 'round')` /
`Money.add`). The midpoint is authored and the rule says so.

### Failing-test proof

The pre-fix classification and policy were re-created in place (`allInCollapsedTree` → `facingAllIn`,
the adjustment and jam disabled, the HU route disabled) and `src/preflop/allInTree.test.ts` was
run: **17 of its 26 tests failed.** Restoring the fix: 26/26 pass. The B1 ones:

| test | pre-fix failure |
| --- | --- |
| keeps the underlying family and reports facingAllIn | `expected 'VS_ALLIN' to be 'VS_OPEN'` |
| AA never pure-flats a short open-shove with live players behind | CALL was 10000 |
| KK raises too, and the raise is a legal size | no aggressive action emitted |
| reports both the family rule and the all-in adjustment | `FACING_ALLIN_IN_TREE` absent |
| does NOT collapse while a legal raise and a live opponent both remain | classified `VS_ALLIN` |
| keeps the 3-bet family when hero opened and faces an all-in 3-bet with seats behind | classified `VS_ALLIN` |
| keeps the squeeze family when the open was a shove and a caller is in | classified `VS_ALLIN` |
| uses the family formula while it leaves a stack behind | no sizing at all |
| jams once the family formula reaches the commitment midpoint | no sizing at all |
| never emits a raise the engine does not offer | no aggressive action emitted |
| sweeps every reachable short-shove spot | premium hands at 0% aggression |
| AA never pure-flats a short shove with two or more live opponents behind | CALL was 10000 |

### The sweep, as a standing test

`B1 sweep — no premium hand ever pure-flats a beatable shove` walks 3 lineups × 4 shovers ×
5 hero seats × 7 shove sizes × {AA, KK} × {engine offers a raise, engine offers none} =
**1344 classified spots — 672 with a live tree, 672 collapsed**, both branches asserted:

- every recommendation's frequencies sum to exactly 10000 and every one is a multiple of 500;
- **live tree**: aggression is 10000 bps for AA/KK and the family is never `VS_ALLIN`;
- **collapsed**: the family *is* `VS_ALLIN` and no `RAISE` is emitted (unchanged behaviour).

Two narrower tests back it: AA is asserted never to pure-flat a short open-shove across five
sizes with 2+ live opponents behind, and all 169 hand classes are asserted to land on a legal,
quantized answer facing an in-tree shove.

---

## 2. M1 (MAJOR) — the SB trim deleted whole offsuit runs, killing QJo before K4o

### Reproduction (before any change)

```
SB raise-only table: 45.098%  (598 combos)
offsuit KEPT:  AKo AQo KQo AJo KJo ATo KTo A9o K9o A8o K8o A7o K7o A6o K6o A5o K5o A4o K4o A3o A2o
```

`QJo`, `QTo`, `JTo`, `T9o`, `98o`, `T8o`, `J8o`, `Q8o` are all **gone**, while `K4o`, `A3o`
and `A2o` survive. The old rule dropped whole runs ordered by high card
(`['86o+','96o+','T7o+','J7o+','Q5o+','K4o+','A2o+']`), so `Q5o+` died as a unit and took the
Queen-broadways with it. A range that folds QJo and opens K4o is not a sane SB range at any
width.

### The trim now (rule `RFI_SB_RAISE_ONLY_TRIM`, still DERIVED)

Drop the composite's OFFSUIT classes **one at a time**, weakest first under a stated total
order, stopping at the first list at or below the band ceiling. Pairs and suited classes are
never touched — the raise-or-limp surplus is entirely in the offsuit block.

**The order:**

1. ascending **kicker** rank (the lower card) — the weakest kicker anywhere in the offsuit
   block goes first;
2. ties broken by ascending **high card** rank.

**Why the kicker is the key, and why this is not an invented metric:** every published offsuit
chart boundary is *written as* a kicker — `K4o+`, `Q5o+`, `J7o+` are S1's own notation. Walking
the kicker down is the same mechanical operation the source's notation performs, applied across
the whole offsuit block at once instead of one run at a time. The **band** stays verified three
ways (S10 40-50%, S3 39-47%, S4 39-47% → 40-47%); the **trim** is ours. Provenance therefore
stays DERIVED, unchanged.

### The new SB range

| | before | after |
| --- | --- | --- |
| combos | 598 | **622** |
| share of 1326 | 45.098% | **46.908%** |
| offsuit classes kept | 21 | 23 |

Trimmed, in order: `A2o A3o K4o A4o Q5o K5o A5o 86o 96o Q6o K6o A6o 87o 97o T7o J7o Q7o` (17
classes, 204 combos). Kept: `K7o A7o 98o T8o J8o Q8o K8o A8o T9o J9o Q9o K9o A9o JTo QTo KTo
ATo QJo KJo AJo KQo AQo AKo`. Inside the verified 40-47% band, as `tables.test.ts` asserts.

### Documentation / provenance follow-through

- `tables.ts` — the rule's docstring now states the per-class order, its rationale, and why it
  changed.
- `rules.ts` `RFI_SB_RAISE_ONLY_TRIM` — rationale rewritten to match; provenance stays DERIVED.
- `rules.ts` `VS_LIMP_BB_VS_SB` — **a divergence is now recorded rather than hidden.** That rule
  reuses the SB list against S13's "around 40-45%". At 46.9% the list is just above S13's
  window. Retuning the trim to land inside S13's narrower window would have pushed the RFI table
  off the 40-47% band three sources agree on, so the better-corroborated band wins and the
  divergence is stated in the rule's own rationale.

### Failing-test proof

The pre-fix run-based trim was restored in place and `tables.test.ts` run: **2 tests failed.**

| test | pre-fix failure |
| --- | --- |
| keeps the broadway offsuit hands and drops the weakest kickers (M1) | `expected [ 'QJo', false ] to deeply equal [ 'QJo', true ]` |
| drops a prefix of the documented weakest-first order, so no kept class is dominated | dropped `Q5o` while keeping strictly-weaker `K4o` |

The second test is the general form the brief asked for: it recomputes the documented
`(kicker, high)` key for every offsuit class of the composite and asserts **every dropped class
is strictly weaker than every kept class** — i.e. the kept set is a suffix of the order, so no
kept class can be dominated by a dropped one.

### One assertion was replaced, and it pinned the bug

`tables.test.ts` previously contained
`it('trims the SB composite into the raise-only band, keeping K4o+ and dropping Q5o+')`, whose
body asserted `hasHandClass(sb, 'K4o') === true` and `hasHandClass(sb, 'Q5o') === false`. That
is precisely the defect, written down as an expectation. Those two lines were **inverted, not
weakened** — the surrounding band and untouched-suited/paired assertions were kept verbatim, and
the replacement carries a docstring saying so. No other existing assertion in this package was
weakened.

---

## 3. M6 (MAJOR) — the heads-up button borrowed a 6-max table

### Reproduction (before any change)

poker-core labels the heads-up button seat by `rules.headsUpButtonLabel`, default `'BTN'`
(`config.ts:154`, `positions.ts:299`); that seat posts the small blind and acts first preflop.
`RFI_RANGES.BTN` is **42.836%** and `RFI_RANGES.SB` was 45.098% — both authored for a seat with
four or one players behind it. The heads-up button has **zero**. Every published heads-up
strategy opens far wider.

(The finding was masked in this package's own tests because `preflop/testQuery.ts` modelled the
2-handed ladder as `['SB','BB']`, which disagrees with the engine. That is fixed too — see §4.)

### Decision: option (a), a documented deterministic widening. Rationale.

`RFI_HEADS_UP_BUTTON` = **union of the BTN RFI list and the SB raise-only list** = 658 combos =
**49.623%**. Nothing is authored: the widening is the set union of two lists that already exist
and already carry their own provenance, so the resulting percentage is a *consequence of the
construction* rather than a figure chosen to look right. `tables.test.ts` asserts the set is
exactly that union and that every member traces to one of the two lists.

**Why not option (b), routing heads-up to `UNSUPPORTED_SPOT_FALLBACK`:**

1. That fallback never authors a raise. It would have the heads-up button FOLD roughly 90% of
   buttons — *further* from any real heads-up strategy than a 49.6% open is, so the "honest"
   option is the one that gives worse advice.
2. It needs a new `PreflopSpotUnsupportedReason` member, and `apps/web/src/lib/table/copy.ts:244`
   holds an exhaustive `Record<PreflopSpotUnsupportedReason, string>`. That is another agent's
   file and outside my boundary — a type change I was told to stop on rather than make.
3. The honesty machinery already fires for heads-up without it: `LINEUP_VERY_SHORT_HANDED`
   forces every heads-up recommendation to HEURISTIC, and `environmentCompatibility` reports
   `LINEUP_SIZE: DIVERGENT / VERY_SHORT_HANDED`. What was missing was not a warning, it was a
   number that is not 40 points off.

**The limitation is stated, not implied.** The rule is HEURISTIC with a mandatory note that says
in as many words that this is a **FLOOR, not a heads-up range**, that no public source publishes
a heads-up chart (`STRATEGY_ANCHORS.md` anchor 8 stops at 5- and 4-handed, and even that is
HEURISTIC), and that real heads-up button ranges are substantially wider. A new **additive**
explanation feature `HEADS_UP_BUTTON_APPROXIMATION` carries it into the structured explanation.
A test asserts the note actually contains the word FLOOR, so the limitation cannot be quietly
edited out while the tag survives.

Routing: `classPolicy`'s `RFI` branch uses the heads-up table whenever `lineupSize === 2`, for
**either** button label — heads-up the only seat that can be first-in *is* the button.

**Deliberately left alone, and named here rather than silently:** heads-up BB *defence* against
a button open still runs `BLIND_VS_BLIND_MIX` / `DEFEND_VERY_WIDE`, which is tight for the spot
by the same argument. The finding named the button RFI; widening the defence tier is a separate
change with its own provenance question.

### Failing-test proof

Same pre-fix run as B1 (HU route disabled):

| test | pre-fix failure |
| --- | --- |
| does not reuse the 6-max BTN list when the button is labelled BTN | `RFI_HEADS_UP_BUTTON` absent from ruleIds; `K7o` folded |
| does the same under the other heads-up button label | same |
| states its limitation in the structured explanation and stays HEURISTIC | `HEADS_UP_BUTTON_APPROXIMATION` absent |

Plus three table-level tests in `tables.test.ts` (wider than both inputs; exactly the union;
opens every hand the 6-max BTN list opens) and one guard that six-handed RFI still uses
`RFI_TABLE`.

---

## 4. MINORs

### Fixed

**MINOR-1 — a short all-in was counted as a betting round** (`preflop/spot.ts`).
`StrategyActionRecord.isFullRaise` existed and nothing read it. Reproduced: 6-max, UTG raises
2.5, HJ all-ins 3 (not a full raise), CO folds, BTN raises to 9, folds back to UTG →
`raiseCount 3`, `UNSUPPORTED / COLD_FIVE_BET`, and **AA got `CALL 10000`** from the passive
fallback in what is really a 4-bet spot.

The two questions are now answered by two filters, as the reviewer's note suggested:
`isAggressive` for *who the aggressor is, how big, was it a shove*; `isAggressive && isFullRaise`
for *tree depth*. Degenerate case handled explicitly: when every aggression is a short all-in
there is no full raise to count but a raise IS standing in front of hero, so the first
aggression counts as the open — the line can never be mistaken for RFI. `openerPosition`,
`openSizeMbb` and the rule-6 3-bettor read the structural list; `aggressorPosition`,
`lastAggressionToMbb`, `heroVsAggressor` and `facingAllIn` keep reading the true last
aggression, because that is the bet hero faces.

Proof: 3 tests, 2 of which failed pre-fix (`expected 'UNSUPPORTED' to be 'SPOT'`;
`expected 'UNSUPPORTED' to be 'OPENER_VS_3BET'`). The third asserts a full-raise all-in *is*
still counted, so the fix cannot over-correct.

**MINOR-2 — raw arithmetic on milliBB** (`preflop/propagate.ts`).
All four sites fixed: `Math.max(...contributions)` → a `Money.max` fold; `Math.max(0, a - b)` →
`Money.max(ZERO, Money.sub(...))`; `potBefore`'s `total += x as number` → `Money.add` over
`Money.sum`; and `ReplayState.contributions` is now `Map<StrategyPosition, MilliBB>` so the
brand survives the whole replay rather than being dropped at the top. `potOddsOf` still returns
a plain number — it is a **ratio**, which CLAUDE.md rule 1 permits, and only the money feeding it
moved onto `Money.*`.
Verification: `grep "as number"` and `grep "Math.max(.*Mbb"` over `src/preflop` and `src/range`
both return nothing. **No failing test is recorded for this one, and I am not going to pretend
otherwise:** the change is behaviour-preserving by construction (same integers, same results),
so the honest proof is the unchanged propagation suite plus the greps. Fabricating a "failing"
test here would have meant changing behaviour to justify a discipline fix.

**MINOR-3 — `squeezeSizing` ignored the per-caller denominator** (`preflop/sizing.ts`).
The combination is now an exported pure function `addRatioTimes(base, addend, times)` that
combines both ratios exactly over the common denominator, rounded once at the call site.
Proof: 2 of the 4 new tests fail against a numerator-only implementation
(`expected 7 to be 5.5` for `4/1 + 3 × 1/2`). A fourth test pins the shipped squeeze numbers
(3 BB open → 12 / 15 / 18 BB) so the refactor is provably behaviour-preserving today.

**Test-fidelity fix, not in R1 but found while reproducing M6** (`preflop/testQuery.ts`).
The 2-handed ladder was `['SB','BB']`; poker-core's default is a button labelled `BTN` that
posts the small blind. It is now `['BTN','BB']` with a `headsUpButtonLabel` spec option for the
other setting, `blindRole` derived from the seat's actual blind rather than its name, `isButton`
correct heads-up, and postflop order derived from the blind roles. No existing test used
`dealtInCount: 2`, which is why the disagreement went unnoticed. An `ActionSpec.fullRaise`
option was also added so a synthetic query can model a short all-in (MINOR-1's shape).

**Consistency fix required by B1** (`preflop/propagate.ts`).
`classifyPreflopSpot` now reads `legalActions`, and `queryBefore` documented itself as
recomputing "only the fields `classifyPreflopSpot` reads" while carrying `legalActions` through
unchanged from the *current* decision point. A reconstructed historical point would have been
classified with the wrong hero's legality. `legalActionsBefore` now derives the one fact that
matters — could this actor put in more than a call — from the actor's own stack, which is what
the engine's own bound is computed from, and says in its docstring that the remaining fields are
carried through because nothing on the propagation path reads them.

### Deliberately left, with the reason

| finding | why not fixed here |
| --- | --- |
| **MINOR-4** — `provenance.ts`'s module contract contradicts ADR-0056 | `src/provenance.ts` is outside my boundary (`src/preflop/**`, `src/range/**`). The fix is a comment rewrite; it should go to whoever owns that file. No tag is currently overclaiming — the defect is the definition, not an application. |
| **MINOR-5** — the panel's "a keystroke never waits" claim | `apps/web`, another agent's boundary. |
| **MINOR-6** — `heroVsAggressor` drives sizing where `heroInPosition` is the better field | In boundary and cheap, but it **changes emitted sizes** in multiway squeeze spots on a modelling-fidelity argument for which R1 itself records *no* counterexample ("I could not construct a preflop lineup where this produces an illegal or absurd size"). Changing a sourced sizing multiplier's *selection rule* is an anchor-doc question (S8's wording), not a bug fix, and CLAUDE.md rule 8 says do the phase you were given. It wants its own change with its own provenance note. |
| **MINOR-7** — B2's "no RNG anywhere" vs a seeded PRNG in `analysis/evaluateExhaustive.test.ts` | Outside my boundary, and it is a report-wording issue: the shipped path genuinely has no RNG. |

---

## 5. M7 (coordinator addition) — an all-in the engine calls a CALL was emitted as aggression

Added to this package mid-flight after the postflop agent found the same defect on their side.

**Root cause.** `preflop/policy.ts` `canDo` answered `'ALL_IN'` with `legal.allIn !== null`,
ignoring `allIn.effect`. When hero cannot cover the outstanding bet the engine reports the
shove as `effect: 'CALL'` — the same money as `legal.call` down to the milliBB. The
`LEGALITY_SUBSTITUTION` chain `RAISE → ALL_IN → CALL` therefore stopped at `ALL_IN`, and a short
hero facing an over-raise got `ALL_IN 100%` for a decision that is a call.

**Fix.** `case 'ALL_IN': return legal.allIn !== null && legal.allIn.effect !== 'CALL';` —
matching `postflop/policy.ts:87` exactly. `ALL_IN` appears in no chain but `RAISE`, so one
predicate is enough. The mass falls through to `CALL`, whose own `isAllIn` flag already says the
call commits hero's whole stack, and a new **additive** explanation feature
`CALL_COMMITS_STACK` (carrying the amount in milliBB) states it in the structured explanation.

**Failing-test proof.** `src/adapter/preflopLegality.test.ts` — a new file, engine-backed, built
with `testHands.ts` because `preflop/testQuery.ts` gives every seat the same stack and cannot
express a short hero. (I did not touch the postflop agent's `postflopLegality.test.ts`.) The
spot: 6-max, button seat 0, hero BB with 8 BB against 100 BB, folded to the BTN who opens to
20 BB, hero holds `As Ad` — a hand the policy 3-bets at 100%, so the substitution is genuinely
what decides. Five tests; reverting the one-line fix gives:

```
× emits ONE call row, never a same-money ALL_IN
  AssertionError: expected [ 'ALL_IN' ] to not include 'ALL_IN'
```

The file also asserts the engine premise itself (no wager, `effect: 'CALL'`, `call.isAllIn`,
identical `toAmountMbb`/`amountMbb`) so it fails loudly rather than silently if poker-core stops
producing the shape, and a control case where the same short hero's shove genuinely **raises**
the price still emits 10000 bps of aggression.

---

## 6. ADR-0056 discipline, checked

- Every emitted frequency stays a multiple of 500 bps summing to exactly 10000. The
  `FACING_ALLIN_IN_TREE` adjustment only moves one whole bucket into another, so
  `assertClassFrequencies` holds by construction; the sweep asserts it over 1344 spots and
  every one of the 169 classes.
- Provenance is honest and nothing was upgraded. New rules: `RFI_HEADS_UP_BUTTON` HEURISTIC,
  `FACING_ALLIN_IN_TREE` HEURISTIC, `SIZE_FACING_ALLIN_JAM` HEURISTIC — all three genuinely have
  no anchor, and their `anchor` fields say "None — ..." rather than borrowing a citation.
  `RFI_SB_RAISE_ONLY_TRIM` stays DERIVED. `tables.test.ts` asserts all four.
- Anchor citations intact: no existing `anchor` string was changed except
  `RFI_SB_RAISE_ONLY_TRIM`'s rationale (same anchors) and `VS_LIMP_BB_VS_SB`'s rationale (same
  anchor, divergence added).
- No GTO labelling. `grep -niE '\bgto\b|solver|solved|nash|내쉬|균형'` over `src/preflop` and
  `src/range` returns only the pre-existing "not solver precision" disclaimers and the test that
  forbids the label. The rule-registry test `never names the reference engine GTO` covers the
  three new rules automatically.
- No public type shape was removed or renamed. Additions only, and all optional where a
  constructor outside `src/preflop/**` existed: `PreflopSpot.allInCollapsedTree` (new required
  field on a type only this file constructs), `PreflopPolicyContext.facingAllIn?`
  (**optional on purpose** — `src/postflop/spot.test.ts` constructs one and is another agent's
  file), `ClassPolicyOutcome.adjustRuleId?`, three `PreflopRuleId` members, three
  `ExplanationFeatureId` members. `apps/web` typechecks unchanged.

---

## 7. Files changed

| file | change |
| --- | --- |
| `src/preflop/spot.ts` | B1 collapse rule + `allInCollapsedTree`; MINOR-1 full-raise tree depth |
| `src/preflop/tables.ts` | M1 per-class trim; M6 `RFI_HEADS_UP_BUTTON` |
| `src/preflop/rules.ts` | 3 new rules; M1 and `VS_LIMP_BB_VS_SB` rationales; `LINEUP_VERY_SHORT_HANDED` note |
| `src/preflop/policy.ts` | `facingAllIn` context; `FACING_ALLIN_IN_TREE`; HU RFI route; jam sizing; M7 `canDo`; explanation features |
| `src/preflop/sizing.ts` | `jamOverAllInSizing`; MINOR-3 `addRatioTimes` |
| `src/preflop/recommendation.ts` | 2 new `ExplanationFeatureId` members |
| `src/preflop/propagate.ts` | MINOR-2 money discipline; `facingAllIn` in both contexts; `legalActionsBefore` |
| `src/preflop/testQuery.ts` | heads-up ladder fidelity; `headsUpButtonLabel`; `ActionSpec.fullRaise` |
| `src/preflop/allInTree.test.ts` | **new** — B1, M6, MINOR-1 (26 tests) |
| `src/preflop/tables.test.ts` | M1 + M6 table tests; 1 bug-pinning assertion replaced; new-rule provenance |
| `src/preflop/sizing.test.ts` | MINOR-3 (4 tests) |
| `src/adapter/preflopLegality.test.ts` | **new** — M7, engine-backed (5 tests) |

Nothing outside `src/preflop/**` and the one new `src/adapter/` test file was modified.
`src/range/**` needed no change: its only R1 exposure was through `tables.ts`'s use of it.

---

## 8. Verification

| gate | result |
| --- | --- |
| `pnpm vitest run --project strategy-core` | **31 files, 748 tests, all pass** (baseline before this work package: 709, of which 1 failed — the M1 bug-pinning assertion) |
| `pnpm typecheck` (all 9 workspace projects, incl. `apps/web`) | pass |
| `npx eslint packages/strategy-core/src` | clean (layering rules included) |
| `npx prettier --check` on the files I edited | clean (only files I edited were formatted) |

Test count: **+39** (26 `allInTree`, 5 `preflopLegality`, 4 `sizing`, 4 net in `tables`).

Not run, deliberately, per the brief and the verification cadence: the repo-wide suite,
`pnpm build`, and E2E. Two other agents were editing `src/postflop/**`, `apps/web` and
`packages/poker-core` concurrently, so a full run would not have been attributable.

## 9. Residual risk

- **`PreflopPolicyContext.facingAllIn` is optional.** A future constructor that forgets it gets
  "no all-in in front of hero" silently. Both real constructors set it; `src/postflop/spot.test.ts`
  is the only other one and does not need it. It should become required once the postflop
  boundary is free.
- **The heads-up button range is still much tighter than real heads-up play** (49.6% vs the
  ~80%+ published heads-up buttons open). This is stated in the rule note and in the
  explanation feature, and it is the deliberate price of not inventing a percentage. If
  heads-up ever becomes a supported mode it needs its own anchor pass, not a wider union.
- **The `SIZE_FACING_ALLIN_JAM` midpoint is authored.** Half a stack is the conventional
  commitment line, not a sourced figure; the rule says so.
- **`STRATEGY_WP_A3.md` still says 45.10%** for the SB range, and `STRATEGY_REVIEW_R1.md` on
  disk still describes the old `VS_ALLIN` precedence as something to preserve. Both are
  orchestrator-owned documents (§0).
