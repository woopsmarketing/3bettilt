# STRATEGY_FIX_POSTFLOP — R1 fixes for the postflop engine and the strategy panel

**Date:** 2026-09-01 · **Scope:** `packages/strategy-core/src/{postflop,equity,analysis}` +
one new adapter test, `apps/web/src/components/table/StrategyPanel.tsx`,
`apps/web/src/lib/table/{strategy.ts}`, `apps/web/tests/e2e/strategy-panel.spec.ts`,
plus a correction note appended to `docs/reports/STRATEGY_WP_B4.md`.

Every fix below has a test that **fails without it**. Each one was run against the reverted
source and the failure is recorded verbatim.

---

## 0. A note on the finding IDs

The work package named findings **M4, M5, M7, M8**. `docs/reports/STRATEGY_REVIEW_R1.md` as it
stands on disk numbers its findings `MAJOR-1`, `MAJOR-2`, `MINOR-1..7`, `NOTE-1..5`; only **M5**
has a counterpart there (`MINOR-5`). M4, M7 and M8 are not in that file under any numbering.
The work package's own descriptions of them are precise and every one **reproduced exactly as
described**, so they were fixed from those descriptions; this section exists so the mismatch is
recorded rather than silently absorbed.

---

## 1. M7 (MAJOR) — postflop `canDo` ignored `legal.allIn.effect`

### Root cause

`packages/strategy-core/src/postflop/policy.ts`, `canDo`:

```ts
case 'ALL_IN':
  return legal.allIn !== null;          // before
```

`StrategyAllInOption.effect` (`'CALL' | 'BET' | 'RAISE'`, `types.ts:90`) is populated by the
adapter from poker-core's own `classifyWager` (`betting.ts:243` — `toAmount <= currentBet` is a
CALL) and was read by **nothing** in the package. When hero cannot cover the outstanding bet the
engine reports `wager: null`, `wagerBlockedReason: 'INSUFFICIENT_STACK'` and an `allIn` whose
`effect` is `'CALL'` and whose money is identical to `legal.call` to the milliBB. The AGGRESSIVE
substitution chain then skipped `RAISE`/`BET` (no sizable wager), reached `ALL_IN`, and `canDo`
said yes — so the aggressive frequency was emitted as a second row beside the passive one.

### Reproduction (real adapter + real engine, before the fix)

6-max, button seat 0, hero BB with **80 BB** against 100 BB stacks, `7h 7s`.
BTN opens 2.5, hero calls, flop `Ah 7d 2c`, hero checks, BTN bets **90 BB**.

```
legal: wager null (INSUFFICIENT_STACK), call {to 77500, amount 77500, isAllIn true},
       allIn {to 77500, amount 77500, effect "CALL"}
actions: CALL 7500 (to 77500) | ALL_IN 2500 (to 77500)     <- two rows, one decision
ruleIds: … LEGALITY_SUBSTITUTION …                          <- ALL_IN_SPR_GATE absent
```

The true call frequency is 100%; the panel showed 75%. `ALL_IN_SPR_GATE`'s two conditions
(SPR ≤ 1.5 **and** band ≥ STRONG) were satisfied here, so the gate did not catch it — the jam
was reached on a legality artefact, exactly as the finding says.

### Fix

```ts
case 'ALL_IN':
  return legal.allIn !== null && legal.allIn.effect !== 'CALL';
```

`ALL_IN` appears in no substitution chain other than AGGRESSIVE, so one predicate is enough.
The aggressive bucket now falls through to `CALL`, `merged` sums the two frequencies by kind
(the existing merge, unchanged), `aggressionSuppressed` is set, and `ALL_IN_SPR_GATE` is
reported with its note — so the fall-through is visible rather than silent.

Documented in three places, per ADR-0056's "the rule is stated where the number is made":
`canDo`'s doc-comment, the `SUBSTITUTIONS` doc-comment, and the rationales of both
`ALL_IN_SPR_GATE` and `LEGALITY_SUBSTITUTION` in `postflop/rules.ts`.

### Test, and its failure without the fix

New file **`packages/strategy-core/src/adapter/postflopLegality.test.ts`** (4 tests). It lives
under `src/adapter/` because that is the only directory ESLint lets import `@gto-self/poker-core`
— and that placement is the point: `postflop/testQuery.ts` gives every seat the same stack, so
it *cannot express this shape*, which is how the defect survived the postflop suite. The file
adds no edit to any existing adapter file.

It asserts the engine premise (wager null, `effect === 'CALL'`, identical money), that exactly
one CALL row is emitted carrying `10000 - foldBps`, that `isAllIn` is true on it, that
`ALL_IN_SPR_GATE` + `LEGALITY_SUBSTITUTION` are reported with a note, that frequencies are
multiples of 500 summing to **exactly 10000**, and — the control — that an all-in whose
`effect` is `'RAISE'` (same spot, BTN bets 20 BB instead) still produces a real aggressive row.

Reverting `canDo` to `legal.allIn !== null`:

```
× emits ONE call row, not a call beside a same-money ALL_IN
    AssertionError: expected [ 'CALL', 'ALL_IN' ] to not include 'ALL_IN'
× reports the fall-through honestly, and keeps ADR-0056 arithmetic intact
    AssertionError: expected [ …(18) ] to include 'ALL_IN_SPR_GATE'
  Tests  2 failed | 2 passed (4)
```

### Out of boundary, reported not fixed

**`preflop/policy.ts` has the identical defect** (`canDo`, `policy.ts:472`:
`return legal.allIn !== null`, with no `effect` check and no all-in gate on its RAISE chain).
Verified through the real adapter: 6-max, hero BB 80 BB with `AhAs`, BTN raises to 90 BB —
`allIn.effect === 'CALL'`, and `recommendPreflop` emits a single row of kind **`ALL_IN` 100%**
where the engine's own classification of that action is a **call**. No frequency is wrong there
(the whole mass is on one row), but the action KIND is. `src/preflop/**` belongs to another
agent in this milestone, so it is left to them; the postflop fix is a one-line mirror.

---

## 2. M8 (MAJOR) — `HERO_EQUITY_BANDS` fed raw pooled multiway equity

### Root cause

`postflop/scoreModel.ts`'s `HERO_EQUITY_BANDS` is a **0.5-centred** table (`0.45 → EVEN`,
`0.25 → WELL_BEHIND`, below that `CRUSHED`). `postflop/score.ts:243` fed it
`context.heroEquity`, which `context.ts:213` computes as `equityVsRanges(hero, board, EVERY live
villain range)` — hero's **pooled share of the pot**. Five ways an even split is 0.20, so every
multiway hand at or below fair share fell into the bottom band together.

### Reproduction (before the fix; 5-way limped flop `Ah 7d 2c`, hero SB/BB first to act)

| hero | equity | × fair share (0.20) | scored band | points |
| --- | --- | --- | --- | --- |
| `2s3d` | 0.1837 | **0.919** | `CRUSHED` | −70 |
| `Kd9c` | 0.0996 | 0.498 | `CRUSHED` | −70 |
| `Qs8h` | 0.0836 | **0.418** | `CRUSHED` | −70 |
| `Ac2h` | 0.7399 | 3.700 | `STRONG` | 55 |
| `7h7s` | 0.8785 | 4.393 | `CRUSHING` | 80 |

`0.919 ×` and `0.418 ×` fair share scored identically. Control: heads-up `Kd9c` at 0.4875 → `EVEN`.

### Fix

Two exported, documented functions in `scoreModel.ts` (the score model *is* the documented
data), applied at the single call site in `score.ts`:

```ts
fairShareEquity(n)          = 1 / (1 + max(1, floor(n)))
normalizeHeroEquity(e, n)   = e <= s ? 0.5 * e / s
                                     : 0.5 + 0.5 * (e - s) / (1 - s)     // s = fairShareEquity(n)
```

Piecewise-linear rescaling around the fair share, chosen over a bare `e / s` ratio for three
stated reasons: **heads-up is the identity** (with `s = 0.5` every operation is a multiply or
divide by a power of two, so it is bit-exact in IEEE-754, not merely close); the output stays
inside `[0, 1]` so the band edges keep meaning what they say (a bare ratio puts a 5-way nut hand
at 4.4 and saturates the top band); and both directions stay graded, which is the thing the raw
version could not do.

The **raw** equity is untouched everywhere it is reported — `metrics.heroEquity`, the
`HERO_EQUITY` explanation feature, and the score component's `rawValue` (CLAUDE.md rule 3). Two
new explanation features carry the working: `HERO_EQUITY_FAIR_SHARE` (ratio + opponent count)
and `HERO_EQUITY_NORMALIZED`. A new registry rule `HERO_EQUITY_FAIR_SHARE_NORMALIZATION`
(`HEURISTIC`, with the mandatory rationale) is reported whenever `activeOpponentCount >= 2`;
`HERO_EQUITY_MEASUREMENT`'s rationale was extended to say the number it produces is pooled.

**After the fix**, same five-way spots: `2s3d` → `EVEN` (+5), `Qs8h` → `CRUSHED` (−70),
`AcKc` (0.6528, 3.26 ×) → `CRUSHING`. Heads-up: unchanged.

### The same question for the other band tables — checked, and deliberately not changed

| table | input | verdict |
| --- | --- | --- |
| `RANGE_ADVANTAGE_BANDS` | `rangeVsRangeEquity(hero range, **primary villain** range) - 0.5` (`context.ts:273`) | Already pairwise and already centred. Not normalized. |
| `NUT_ADVANTAGE_BANDS` | `nutShare(hero) - nutShare(primary villain)` | Same: a pairwise difference of two shares. Not normalized. |
| `RANGE_RANK_BANDS` | quantile of hero's hand inside **hero's own** range | Not an equity-vs-opponents number at all. |
| `POT_ODDS_MARGIN_BANDS`, `ALL_IN_CALL_BANDS` | `heroEquity - requiredEquity` | The **raw pooled** number is the correct input by definition — hero must beat the whole field to win the pot, and the price hero is laid does not care who set it. Deliberately left raw. |
| `FACED_BET_SIZE_BANDS`, `SPR_PRESSURE_BANDS` | pot fractions / stack ratios | Not equity. |

All six decisions are written into `normalizeHeroEquity`'s doc-comment so the next reader does
not have to re-derive them.

### Tests, and their failure without the fix

- `postflop/scoreModel.test.ts` — **+6 tests** on the mapping itself: the fair-share formula
  (including the floor at one opponent); **bit-identical** heads-up across 1001 points *and*
  every band edge; fair share → `EVEN` at every lineup size 1–5; the review's 0.92 ×/0.34 ×
  counterexample separated; well-above-fair-share scoring positive with no saturation below 1.0;
  monotonicity in equity at every lineup size.
- `postflop/policy.test.ts` — **+6 end-to-end tests** on the scored band in a real 5-way limped
  pot, including the premise (a genuine 4-opponent pot, raw equity < 0.25), `rawValue` still
  being the actual pooled equity, the three-hand ordering, the reported features/rule/note, the
  5%-step/10000-sum invariants, and a heads-up control asserting `CRUSHING`/80 unchanged and the
  normalization rule **absent** from `ruleIds`.
- `postflop/workedExample.test.ts` — feature count 50 → **52** (a count, not a weakened
  assertion), plus a new test that heads-up `HERO_EQUITY_NORMALIZED === HERO_EQUITY` and the
  fair share is exactly `0.5`.

Reverting `score.ts` to `bandFor(HERO_EQUITY_BANDS, context.heroEquity)`:

```
× lands a near-fair-share five-way hand in the NEUTRAL band, not CRUSHED
    AssertionError: expected 'CRUSHED' to be 'EVEN'
× orders three five-way hands by fair-share ratio, which the raw table could not
    AssertionError: expected -70 to be greater than -70
  Tests  2 failed | 90 passed (92)
```

---

## 3. M4 (MAJOR) — `isAllIn` dropped on the way to the panel; a shove rendered as a bet-TO

### Root cause

`apps/web/src/lib/table/strategy.ts`'s `rowsOf` built `StrategyActionRow` without the engine's
`isAllIn`, and `StrategySizingView.allIn` was computed in `sizingOf` and read by nobody.
`StrategyPanel.tsx` therefore rendered `TO 9.5 BB` on the row and `RAISE TO 9.5 BB` /
`50% POT · 9.5 BB` on the sizing line for a recommendation that commits the whole stack.

`RecommendedAction.isAllIn` is set by the engine on an explicit `ALL_IN`, on a `CALL` that takes
hero's last chip, and — the case that matters — on a `BET`/`RAISE` whose sizing landed exactly on
`legal.allIn.toAmountMbb` (`postflop/policy.ts:291`).

### Fix

- `StrategyActionRow` gains `readonly isAllIn: boolean`, carried straight off the engine's action
  (never re-derived here — comparing an amount against a stack would be this file authoring a
  poker fact, which its rule 2 forbids).
- `ALL_IN_NAME = 'ALL IN'` is exported from `strategy.ts`, where the other Latin action names
  already live per `copy.ts`'s own header (ADR-0053: standard poker vocabulary stays
  international, inside a Korean frame). `actionName('ALL_IN')` now returns it too, so the panel
  no longer spells the same fact two ways (`ALL-IN` on the row name, `ALL IN` on the amount).
- `ActionRow` renders `ALL IN · 9.5 BB` instead of `TO 9.5 BB` when the flag is set, with
  `data-all-in` for structured assertions and an emphasis class.
- The sizing line renders `추천 사이즈 ALL IN · 9.5 BB`, keeping the pot rung in parentheses when
  the model chose one (rule 3: the rung is how the size was reached and is not dropped), and
  carries `data-all-in`.

### Tests, and their failure without the fix

`StrategyPanel.test.tsx` — **+2 tests**, both driven through the real store and the real engine.
Fixture: six 12 BB stacks, hero BB with `7h 7s`, flop `Kd 7d 2c` (a set), facing a 3 BB bet with
9.5 behind — SPR 0.76, inside the model's all-in gate, so the engine genuinely recommends the
shove. The second test is the negative control on the existing 100 BB flop spot: `TO …` on the
row, `data-all-in="false"`, no `ALL IN` string.

Two independent reverts, two different failures:

```
render only reverted:   × renders ALL IN on the action row and on the sizing line …
                            (element text still "TO 9.5 BB")
model field reverted:   × renders ALL IN on the action row and on the sizing line …
                            AssertionError: expected undefined to be defined
  Tests  1 failed | 11 passed (12)   (each revert)
```

**E2E:** no change was needed. `strategy-panel.spec.ts`'s three sizing assertions are all on
100 BB spots where no action is all-in; the spec passes unmodified (5 passed). No structured
assertion there was wrong, so none was touched — only a comment (see §4).

---

## 4. M5 (MAJOR) — the scheduling claim overclaimed, and its test was worse than synthetic

### Root cause, restated honestly

`window.setTimeout(…, 0)` + `clearTimeout` in the cleanup supersedes a computation that has been
**scheduled and not started**. It cannot interrupt one that has started: `computeStrategy` is a
single synchronous call with no yield point, no worker and no time-slicing, so once the timer
fires the main thread is busy for the whole call and an input arriving in that window waits for
the remainder. The header called this "cancellable" without that sentence.

**The burst test was not merely synthetic — with respect to cancellation it was vacuous.**
It committed five transitions inside one `act()`; React auto-batches those into a single
re-render, so the effect ran **once**, exactly one timer was ever scheduled, and nothing was
cancelled. Proof: deleting `clearTimeout` left it green (`12 passed`).

### Fix

**Comments corrected** (no behaviour change):

| file | what changed |
| --- | --- |
| `StrategyPanel.tsx` header | New section "What the timer does and does NOT cancel", stating the guarantee (queued-but-not-started work is never started; the user's own action commits before any analysis begins) and its limit in the same breath. Worst case restated as ~130 ms and unbenchmarked at the top end, not ~87 ms. Carries the measurements below. |
| `StrategyPanel.tsx` cleanup | One line saying what `clearTimeout` supersedes and what it cannot. |
| `strategy.ts` `ComputeStrategyOptions.budget` | The "~87 ms worst shape, so no reduction was needed" justification replaced with the corrected worst case and the real reason the lever is untuned (tuning trades `EXACT` for `SUBSAMPLED`; that belongs with the benchmark work). |
| `strategy.ts` `computeStrategy` doc | States it has no yield point. |
| `strategy-panel.spec.ts` header comment | States exactly what the timing spec proves (no synchronous flush ahead of the first keystroke) and what it does not (interruption); drops the 87 ms figure. **No assertion changed.** |
| `docs/reports/STRATEGY_WP_B4.md` | New **§5.4 CORRECTION**, appended rather than rewritten, with a claim-by-claim table and the measurements. |

**Burst test rewritten** so it can fail (`StrategyPanel.test.tsx`):

1. *"never STARTS an analysis for a state superseded before its timer fired"* — fake timers,
   each transition committed in **its own** `act()` so the effect flushes each time and five
   timers are genuinely scheduled. Asserts `compute` has not been called at all before the timers
   run, then that exactly one runs and that its state is **identical** to the one on screen.
2. *"analyses each settled state exactly once, and finishes every analysis it starts"* — the
   realistic multi-tick sequence: two transitions that settle and are analysed, then two inside
   one tick where the middle one is superseded while queued. Counts **starts against
   completions** (`starts === completions === 3`), asserts no state is analysed twice, and pins
   the honest limit — nothing is abandoned mid-flight, because nothing can be.

Failure without the mechanism (`return () => void timer;`):

```
× never STARTS an analysis for a state superseded before its timer fired
    AssertionError: expected "vi.fn()" to be called 1 times, but got 5 times
  Tests  1 failed | 11 passed (12)
```

(The same revert against the **old** test was green — that is the finding.)

### Measurements — the yield-point question, measured rather than guessed

Darwin arm64, `--project strategy-core`, 5 repeats after a warm-up, worst shape = 6-way limped
flop with hero first to act (`Ah 7d 2c`, `Kd9c`). Throwaway test files, deleted after the run.

| phase | min / max |
| --- | --- |
| `recommendPostflop` **total** | **119.0 / 129.6 ms** |
| `buildPostflopContext` (equity phase) | 119.6 / 121.6 ms |
| `scorePostflop` (policy phase) | **0.0 / 0.3 ms — 0.22% of the total** |
| ↳ `buildPostflopRanges` | 1.1 / 1.3 ms |
| ↳ `equityVsRanges` (hero vs 5 villain ranges) | 54.9 / 61.5 ms |
| ↳ `equityDistribution` (hero range vs primary villain) | 63.2 / 64.0 ms |
| ↳ `buildStrengthDistribution` ×3 | 0.8 / 1.4 ms |

Control, HU flop (B3's claimed worst shape): total 85.8 / 88.8 ms, policy phase 0.0 ms (0.03%).

**Conclusions, and what was adopted:**

1. **A second `setTimeout` hop: not adopted.** It does not shorten the synchronous run at all —
   it delays the start by one macrotask, widening the window in which a computation can be
   superseded while doing nothing for worst-case input blocking. There is no measurement to make;
   the mechanism cannot help.
2. **Chunking between the equity phase and the policy phase: measured, not adopted.** The policy
   phase is 0.3 ms of 129.6 ms. Yielding there would shorten the worst-case block by **under a
   millisecond** (0.22%). Not worth a line of code.
3. **Chunking between the two dominant equity calls: measured, would help, out of boundary.**
   `equityVsRanges` (55–62 ms) and `equityDistribution` (63–64 ms) split the block almost evenly,
   so a yield between them would take the worst case from ~130 ms to ~64 ms. It is **not**
   adoptable here: it needs a resumable two-phase `buildPostflopContext` exposed through
   `packages/strategy-core/src/index.ts` (explicitly outside this work package's boundary), and
   doing it in the web layer instead would move the assembly of a recommendation into
   `lib/table/strategy.ts`, which that file's rule 2 forbids by design. **Recorded as a
   follow-up with its number, not done.** No Web Worker was introduced (out of scope).

---

## 5. MINORs

### Fixed

- **MINOR-2 (the postflop half)** — `postflop/spot.ts:166-169` did
  `const potBeforeBet = potBefore - call;` on two `as number` casts, violating CLAUDE.md rule 1.
  Now `Money.sub(query.potBeforeDecisionMbb, query.callAmountMbb)` with `Money.isPositive` as the
  guard; the casts survive only on the operands of the final **division**, which produces a
  RATIO (`facedBetFractionOfPot`) that rule 1 exempts explicitly, and the comment says so.
  Behaviour is identical (`spot.test.ts` + `policy.test.ts` green), so this one carries no
  new failing test — it is a discipline fix with no observable change, which is exactly what
  R1 said it was ("None of these produced a wrong number in any test I ran").
- **MINOR-7** — `analysis/evaluateExhaustive.test.ts`'s mulberry32 PRNG now carries a comment
  explaining that it is test-only and seeded from a literal, that it only chooses *which* sample
  hands to cross-check, and that B2's "no RNG anywhere" is true of the shipped path
  (`equity/sampling.ts`) but broader than the code. A reader who greps for `random` now finds the
  explanation next to it instead of concluding the report was dishonest.

### Deferred, with reasons

- **MINOR-1** (`adapter/fromHandState.ts` + `preflop/spot.ts`: a short all-in counted as a full
  raise) — outside this boundary; another agent is actively working it. Their in-flight
  `src/preflop/allInTree.test.ts` is the reason the strategy-core suite shows 5 unrelated
  failures below (see §6).
- **MINOR-2 (the preflop half)** — `preflop/propagate.ts:169,171,232-236` and
  `ReplayState.contributions: Map<…, number>`. Same file family as MINOR-1; not touched.
- **MINOR-3** (`preflop/sizing.ts`'s ignored `SQUEEZE_PER_EXTRA_CALLER.denominator`) — preflop.
- **MINOR-4** (`src/provenance.ts`'s module contract contradicting ADR-0056) — `src/provenance.ts`
  is not in this boundary and is shared with the preflop work. It is a real defect (the
  definition file no longer states the rule the package applies) and should be fixed by whoever
  owns the shared root next.
- **MINOR-6** (`heroVsAggressor` driving multiway sizing) — preflop.
- **NOTE-1** (`copy.ts` renders `NOT_A_DECISION_POINT` as "지원하지 않는 상황입니다" even when the
  hand is merely between betting phases) — a NOTE rather than a MINOR, and re-wording it is a UX
  copy decision with its own `copy.test.ts` assertions. Left for a deliberate copy pass; the
  engine's own code and message are still rendered verbatim beside it, so nothing is hidden.
- **NOTE-5** (the panel unmounts when the right column shows HISTORY/PLAYER and re-analyses on
  remount) — correct behaviour, and at the measured cost it is not worth caching. Worth revisiting
  only if MAJOR-2's budget work lands.

---

## 6. Verification

| Gate | Command | Result |
| --- | --- | --- |
| strategy-core | `pnpm vitest run --project strategy-core` | **733 passed / 5 failed / 30 files.** All 5 failures are in `src/preflop/allInTree.test.ts`, a file another agent created and is mid-edit for MINOR-1 (one run even failed to import `src/preflop/tables.ts` while it was being written). **Every file in this work package's boundary passes.** |
| touched files only | `… postflopLegality · scoreModel · policy · workedExample · spot · evaluateExhaustive` | **239 passed / 6 files** |
| web | `pnpm vitest run --project web` | **283 passed / 16 files** (was 274 / 16; +2 M4 tests, burst test rewritten, +7 net) |
| types | `pnpm typecheck` | **PASS** (9 projects) |
| lint (incl. layering) | `pnpm lint` | **PASS**, 0 problems |
| E2E (this spec only) | `pnpm exec playwright test tests/e2e/strategy-panel.spec.ts` | **5 passed**, unmodified assertions |
| ADR-0056 greps | case-insensitive `GTO` / `solver` / `solved` / `Nash` / `내쉬` / `균형` over every touched file | **green** — every hit is a `@gto-self/*` import specifier or a sentence forbidding the label |

No assertion was weakened or deleted. The only existing expectation that changed value is the
worked example's explanation-feature **count** (50 → 52), which is a count of a set that
genuinely grew by two documented features.

## 7. Files

### Added

| File | Purpose |
| --- | --- |
| `packages/strategy-core/src/adapter/postflopLegality.test.ts` | 4 engine-backed tests for M7. New file; no existing adapter file was edited. |

### Modified

| File | Change |
| --- | --- |
| `packages/strategy-core/src/postflop/policy.ts` | M7's `canDo` guard + its two doc-comments; M8's two explanation features and the `HERO_EQUITY_FAIR_SHARE_NORMALIZATION` rule id |
| `packages/strategy-core/src/postflop/scoreModel.ts` | `fairShareEquity`, `normalizeHeroEquity`, and the rewritten `HERO_EQUITY_BANDS` contract |
| `packages/strategy-core/src/postflop/score.ts` | the single band call site |
| `packages/strategy-core/src/postflop/rules.ts` | new rule `HERO_EQUITY_FAIR_SHARE_NORMALIZATION`; rationales of `HERO_EQUITY_MEASUREMENT`, `ALL_IN_SPR_GATE`, `LEGALITY_SUBSTITUTION` |
| `packages/strategy-core/src/postflop/recommendation.ts` | two feature ids |
| `packages/strategy-core/src/postflop/spot.ts` | MINOR-2: `Money.sub` |
| `packages/strategy-core/src/postflop/{scoreModel,policy,workedExample}.test.ts` | +13 tests, 1 count updated |
| `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts` | MINOR-7 comment |
| `apps/web/src/lib/table/strategy.ts` | M4: `isAllIn` on the row, `ALL_IN_NAME`; M5: two corrected doc-comments |
| `apps/web/src/components/table/StrategyPanel.tsx` | M4: row + sizing rendering; M5: header rewritten |
| `apps/web/src/components/table/StrategyPanel.test.tsx` | +2 M4 tests, burst test rewritten, +1 accounting test |
| `apps/web/tests/e2e/strategy-panel.spec.ts` | comment only |
| `docs/reports/STRATEGY_WP_B4.md` | §5.4 correction note (appended) |

**Untouched, as required:** `src/preflop/**`, `src/range/**`, `packages/poker-core`,
`apps/web/src/lib/table/tableStore.ts`, `apps/web/tests/e2e/seat-occupancy.spec.ts`,
`packages/strategy-core/src/index.ts`, root configs, `docs/STATE.md`, `docs/DECISIONS.md`.
`apps/web/src/lib/table/copy.ts` was in the boundary but needed no change — the all-in marker is
a Latin poker term and belongs with the other action names in `strategy.ts`, per `copy.ts`'s own
header rule.
