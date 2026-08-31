# STRATEGY_FIX_BUTTON — R1 findings B2 / M2 / M3

**Date:** 2026-09-01 · **Scope:** the `buttonSeat` half of the between-hands sit-out
transition. Source review: `docs/reports/STRATEGY_REVIEW_R1.md` (B2 BLOCKER, M2 MAJOR,
M3 MAJOR).

**Orchestrator decision implemented (settled, not relitigated):** `setSeatOccupancy` STOPS
clearing `buttonSeat`. The button is rotation state, not occupancy state; `advanceButton`
owns eligibility.

---

## Summary

| Finding | Verdict | Where the fix lives |
|---|---|---|
| B2 | FIXED | `poker-core/src/table.ts` + `apps/web/src/lib/table/tableStore.ts` |
| M2 | FIXED | `poker-core/src/table.ts` (the single nulling expression) |
| M3 | DISSOLVED — no code change needed | confirmed below |

All three share one root cause, which is why one deletion closes two of them.

---

## B2 — sitting the button seat out before the first deal bricks the table

### Root cause

Two facts had to be true together:

1. `poker-core/src/table.ts:143` nulled the button whenever the seat holding it went
   `SITTING_OUT`, and nothing in the engine or the shipped UI could ever put it back
   (`setButtonSeat` is reachable only from `session-setup/plan.ts` and the test fixture).
2. `tableStore.startHand()` runs the between-hands sequence — settle, top up,
   `advanceButton` — only inside `if (previous !== null)`, i.e. only after a hand has
   COMPLETED in this page session. Before the first deal there is nothing to advance from,
   so `engineStartHand` was handed `buttonSeat === null` and refused `NO_BUTTON_SEAT`,
   forever.

### Reproduced before fixing

Written as the store test `deals after the button seat sits out before the FIRST hand of
the session` and run against unmodified source:

```
× deals after the button seat sits out before the FIRST hand of the session
  AssertionError: expected { code: 'NO_BUTTON_SEAT', ... } to be null
```

Re-activating the seat did not clear it: the `net-zero sit-out/sit-in before the first
hand` test failed the same way.

### The second half nobody had seen

Removing the nulling is **necessary but not sufficient**. With the button preserved, the
same scenario stops failing `NO_BUTTON_SEAT` and starts failing
`BUTTON_SEAT_NOT_DEALT_IN` — `buildStartEvents` (`commands.ts:582-586`) refuses to deal
when the button is not among the dealt-in seats, because `assignBlinds` counts off it.
Measured, with the poker-core fix already applied and the store untouched:

```
× deals after the button seat sits out before the FIRST hand of the session
  AssertionError: expected
  { code: 'BUTTON_SEAT_NOT_DEALT_IN', message: 'Seat 3 holds the button but is not dealt in',
    context: { seat: 3 } } to be null
```

This is a materially better failure than the original — it is recoverable, because sitting
the seat back in makes the button valid again — but it is still a refusal where the
orchestrator's design requires a deal.

### Fix

**`packages/poker-core/src/table.ts` — `setSeatOccupancy`.** The `buttonSeat:` line is
gone; the function now writes the seat and nothing else. `vacateSeat` still clears the
button (there the player and their chips genuinely leave the table). Doc comment records
why, and what the old behaviour cost.

**`apps/web/src/lib/table/tableStore.ts` — `startHand`.** After the (unchanged)
previous-hand branch, one guard:

```ts
if (table.buttonSeat !== null && !dealtInSeats(table).includes(table.buttonSeat)) {
  const moved = advanceButton(table);
  if (!moved.ok) return fail(moved.error);
  table = moved.value;
}
```

Deliberate properties:

- It runs the SAME rule the engine already owns (`advanceButton`: clockwise to the next
  dealt-in seat). It does not invent a button; it moves one that exists.
- It is a no-op on the normal path — the branch above always leaves an eligible button,
  because `advanceButton` can only return one.
- It covers **two** reachable paths, not one: the first deal of a page session (B2), and a
  session reloaded whose PERSISTED button sits on a seat whose persisted occupancy is
  `SITTING_OUT` (reachable today, because occupancy is persisted and the button is not).
- It is visible, not hidden: the BTN badge moves on screen at the moment of the deal, and
  the E2E test asserts exactly that.
- `buttonSeat === null` is explicitly EXCLUDED. A table with no button at all is a
  different, degenerate fact and gets no auto-repair — see the next section.

### `NO_BUTTON_SEAT` is surfaced, not swallowed

Checked, not assumed. `startHand` ends with `if (!started.ok) return fail(started.error)`,
and `fail` sets `lastError`, which `TableRoot` renders as `engine-error`. Pinned by a new
store test: a hand-built table with `buttonSeat: null` produces
`lastError.code === 'NO_BUTTON_SEAT'`, leaves `hand` null and leaves the table untouched.
No new auto-repair was added for it.

---

## M2 — the button rotates backwards after a net-zero toggle

### Root cause

Exactly the nulling expression above. `advanceButton`'s `buttonSeat === null` branch means
"there is no button yet", and correctly picks the lowest eligible seat. Nulling on sit-out
made a table that HAD a button take that branch, so rotation restarted at seat 0 instead of
continuing clockwise. `S` then `S` on the button seat — a net-zero user action — moved the
next button from 4 to 0.

### `advanceButton` itself was NOT at fault — verified, then pinned

Read and confirmed: the search starts at `nextSeat(table.buttonSeat)` and steps clockwise
up to six times, so the current button seat being ineligible (SITTING_OUT, busted, vacated)
changes nothing about the answer. **No change was made to `advanceButton`'s logic**; only
its doc comment now states this property. Four fixtures pin it (see below), including the
two the review called out as blind spots.

### Fix

The nulling is gone, so `advanceButton` sees the real button and continues clockwise. Both
store scenarios now hold:

- `S`,`S` round trip after one hand → next button 4, byte-identical to the no-toggle
  baseline (the test computes both and compares).
- Button seat sits out and stays out → next button 4 (clockwise from 3), not 0.

---

## M3 — the occupancy write persisted half the transition

### Verdict: dissolved by the B2/M2 fix. No `packages/db` change. Confirmed, not assumed.

The review's argument was that `setSeatOccupancy` mutates two fields (`occupancy` and
`buttonSeat`) while `updateSessionSeatOccupancy`
(`packages/db/src/repositories/sessions.ts:314-337`) writes one. After this change
`setSeatOccupancy` mutates exactly ONE field, so the one-column write is now the complete
and faithful persistence of that transition. ADR-0057's closing requirement ("any future
between-hands preference must re-check the two conditions") is satisfied for the only field
that remains.

What is left is the **pre-existing, already-documented** Phase-8 gap, not a new defect:

- `docs/STATE.md` "Known issues": *"Nothing entered at the table is persisted"* and
  *"`updateSessionTable` is never called"*.
- Verified by grep: `updateSessionTable` has **no caller anywhere in `apps/web`**. The
  button advance, the settled stacks and the auto top-up all live in memory only.

So a reload still returns the session to its configured button and stacks. That is the
known issue, unchanged in kind or severity by this work, and it is the reason the store's
new guard covers the reload path defensively rather than the db repository being touched.

**`packages/db` was not modified. `packages/db` tests: 92 passed.**

---

## Spec changes made under the orchestrator's decision

These are deliberate specification changes, not weakened assertions. Every one of them
asserts the NEW behaviour at least as tightly as the old assertion did.

| File | Test | Was | Now | Why |
|---|---|---|---|---|
| `packages/poker-core/src/table.test.ts` | `sitting the button out clears the button` → `sitting the button seat out LEAVES the button where it is` | `expect(out.buttonSeat).toBeNull()` | `toBe(0)`, plus `dealtInSeats(out)` still excludes the seat | The behaviour under test was deleted by decision; the replacement pins the new invariant AND that eligibility still changed. |
| `apps/web/src/lib/table/tableStore.test.ts` | `clears the button when the button seat sits out…` → `keeps the button where it is when the button seat sits out, and the next deal moves it on` | `expect(table.buttonSeat).toBeNull()` mid-test; comment claimed "first eligible seat" was intended | `toBe(0)` mid-test; final expectation `toBe(1)` UNCHANGED | This is the exact fixture the review named as misleading: `seats [0,1,2] buttonSeat 0` is the one lineup where "lowest eligible" and "next clockwise" coincide. The end state is the same; the reason it is 1 is now the right reason, and the comment says so. |
| `apps/web/src/lib/session-setup/plan.ts` | (comment, `buildTableState`) | "the button must be placed after any seat has been moved to SITTING_OUT (that move clears the button)" | The sit-out loop still runs before `setButtonSeat`, but now for the STRICTER reason: `setButtonSeat` refuses a non-ACTIVE seat, so this ordering is what makes "the button must sit on an active seat" an engine rejection rather than a form-only rule. | The stated justification no longer exists. The ordering does still matter and `plan.test.ts:280` ("refuses a button on a seat that is sitting out") still passes unchanged, which is the proof. |

Nothing else in the repo asserted the old clearing behaviour. Checked:
`commands.test.ts:44` (`NO_BUTTON_SEAT`) reaches a null button through `vacateSeat`, which
is unchanged; `commands.test.ts:50` (`BUTTON_SEAT_NOT_DEALT_IN`) hand-writes
`buttonSeat: 2` onto a sitting-out seat and is now reachable through the ordinary API too —
it passes unchanged and documents exactly the engine refusal the store's new guard exists
to avoid.

---

## Tests added

### `packages/poker-core/src/table.test.ts` (+6)

1. `sitting the button seat out LEAVES the button where it is` — **RED before fix.**
2. `sitting the button seat out and back in is net-zero for the button` — **RED.**
3. `advances clockwise from a SITTING_OUT button seat — mid-table` (6 seats, button 4 → 5)
   — **RED.** This is M2's exact shape.
4. `advances clockwise from a SITTING_OUT button seat — wrapping past seat 5` (seats 0,1,4,
   button 4 → 0) — green before AND after. Kept deliberately: it is a *coincidence* fixture
   (lowest-eligible and next-clockwise both answer 0), and it is here to stop a future
   change from re-introducing the lowest-eligible path undetected.
5. `advances clockwise from a SITTING_OUT button seat — three-seat lineup` (button 0 → 1;
   button 2 wrapping → 0) — same: green both ways by coincidence, kept as a pin. Together
   with (3) these are the "multiple fixtures, not just the one M2 calls out as blind".
6. `a sit-out / sit-in round trip on the button seat does not move the next button`
   (6 seats, button 3; baseline and round-trip compared, both 4) — **RED.**

### `apps/web/src/lib/table/tableStore.test.ts` (+6, 1 rewritten)

1. `deals after the button seat sits out before the FIRST hand of the session` — the exact
   B2 scenario. **RED** twice over: `NO_BUTTON_SEAT` against original source,
   `BUTTON_SEAT_NOT_DEALT_IN` against the poker-core fix alone.
2. `deals after the button seat sits out before the first hand — wrapping past seat 5`
   — **RED.**
3. `a net-zero sit-out/sit-in before the first hand leaves the chosen button untouched`
   — **RED.**
4. `a net-zero sit-out/sit-in on the button seat does not move the next button` — the M2
   scenario, comparing a no-toggle baseline hand against a `S`,`S` hand in the same
   fixture. **RED.**
5. `runs a 6 -> 5 -> 4 -> 5 sequence with the button seat among the sit-outs` — the full
   lineup walk the review said existed only for non-button seats; button 2 → 3 → 4 → 5
   across four hands while three different seats come and go. **RED.**
6. `surfaces NO_BUTTON_SEAT rather than picking a button for a table that has none` — the
   honesty guard. Green both ways by construction (it asserts that nothing was repaired);
   it exists so a future "just advance whatever we have" shortcut fails loudly.
7. Rewritten: `keeps the button where it is when the button seat sits out, and the next
   deal moves it on` — **RED** against original source.

### `apps/web/tests/e2e/seat-occupancy.spec.ts` (+1)

`sitting the BUTTON seat out before the first deal still deals, with the button moved on` —
4-handed session with the button on seat 1, toggled out before any deal. Asserts the BTN
badge stays on seat 1 through the toggle, then that Start Hand produces no `engine-error`,
seat 1 is `NOT_DEALT_IN` and the badge has moved to seat 2. **RED against original
source:**

```
× sitting the BUTTON seat out before the first deal still deals, with the button moved on
  expect(seat-1).toHaveAttribute('data-button', 'true')
  Received: "false"     (the button had been nulled by the toggle)
  2 passed
```

The two existing A1 specs pass unchanged.

---

## Verification (ADR-0022 — poker-core rules-adjacent, verified immediately)

| Gate | Result |
|---|---|
| `pnpm vitest run --project poker-core` | **519 passed** / 40 files |
| `pnpm vitest run --project web` | **280 passed** / 16 files |
| `pnpm vitest run --project db` | **92 passed** / 7 files |
| `pnpm typecheck` | all 9 projects Done |
| `pnpm exec playwright test tests/e2e/seat-occupancy.spec.ts` | **3 passed** |
| `eslint` on the six touched files | clean (layering included) |
| `prettier --check` on the six touched files | clean |

Baselines for comparison: poker-core was 513 before (+6 new), web 274 (+6 new), db 92
(unchanged). The full suite was NOT run — this is a scoped fix, per the verification
cadence.

The red proofs above were produced by temporarily restoring the old `setSeatOccupancy`
expression and removing the store guard, running the three suites, then restoring the fix
from a byte-for-byte copy. `git diff --stat` after restoring shows only the intended files.

---

## Files changed

| File | Change |
|---|---|
| `packages/poker-core/src/table.ts` | `setSeatOccupancy` no longer writes `buttonSeat`; doc comments on it and on `advanceButton` |
| `packages/poker-core/src/table.test.ts` | 1 test rewritten, 5 added |
| `apps/web/src/lib/table/tableStore.ts` | `dealtInSeats` import; the ineligible-button guard in `startHand`; doc comment on `setSeatOccupancy` |
| `apps/web/src/lib/table/tableStore.test.ts` | 1 test rewritten, 6 added |
| `apps/web/src/lib/session-setup/plan.ts` | comment only — the ordering justification |
| `apps/web/tests/e2e/seat-occupancy.spec.ts` | 1 spec added |

**Not touched:** `packages/db` (M3 needed nothing), `packages/strategy-core`, root configs,
`docs/STATE.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `prompt`.

---

## Material for the ADR (orchestrator writes it)

**Proposed subject: occupancy is not rotation state.**

1. **The rule.** `SITTING_OUT` records that a seat receives no cards this hand. It does not
   record where the button is. `buttonSeat` is moved by exactly three things:
   `setButtonSeat` (explicit user/setup choice), `advanceButton` (rotation), and
   `vacateSeat` (the seat and its chips are gone, so the button it held cannot survive).
   Occupancy changes are not one of them.

2. **The invariant that replaces the old one.** Old: "the button is always on an ACTIVE
   seat." New: **"the button is always on a seat that still holds a player; it must be on a
   DEALT-IN seat only at the moment a hand is dealt."** The gap between those two is
   deliberate and is where the sit-out lives — and it is what makes a net-zero `S`,`S`
   toggle net-zero.

3. **Who enforces the deal-time half.** `advanceButton`, called by `tableStore.startHand`.
   The engine refuses `BUTTON_SEAT_NOT_DEALT_IN` if it is ever violated, so the invariant is
   enforced, not merely intended.

4. **Where the deal-time advance belongs, and why it is in the web store rather than
   `poker-core`.** `buildStartEvents` must keep refusing an ineligible button — an engine
   that silently relocates the button would make `startHand` non-deterministic with respect
   to its input, and `HAND_STARTED` embeds the button it dealt. The store is the between-
   hands sequencer (it already owns settle → top-up → advance), so it is the layer that may
   run rotation before dealing. Anyone building a second such sequencer (Phase 8's
   persistence path, a replay tool) must run the same guard.

5. **What is explicitly NOT auto-repaired.** `buttonSeat === null`. The store advances an
   ineligible button but never invents an absent one: `NO_BUTTON_SEAT` reaches `lastError`.
   A dead-button/missed-blind model (ADR-0031, deferred) would be the honest way to do
   better, and this change does not pre-empt it — it only stops a plain sit-out from
   producing a state that needs one.

6. **Reachability note for ADR-0057.** The persisted-vs-memory divergence it was written
   against is now confined to the documented Phase-8 gap. The concrete consequence today:
   a stored button can point at a stored `SITTING_OUT` seat, and the load path must not
   assume otherwise — the store's guard is the thing that makes that state dealable.
