# Work Package A1 — between-hands ACTIVE ↔ SITTING_OUT seat toggle

Status: **DONE**. All targeted tests pass; `pnpm typecheck`, `pnpm lint`, `pnpm --filter
@gto-self/web build`, and the full Playwright suite (17/17) are green.

## What changed

The user can now toggle an occupied seat between ACTIVE and 자리비움 (SITTING_OUT) from the
running table — a chip under each occupied `SeatCard`, and the `S` hotkey on the selected
seat. The toggle never affects a hand in progress; it takes effect at the next deal. Verified
for a 6 → 5 → 4 → 5 dealt-in sequence.

## Key decision: direct write, no pending map

The audit asked me to determine whether `setSeatOccupancy` could be applied directly to the
store's `table` mid-hand, or whether it needed a `pendingOccupancy` map applied later in
`startHand()`.

**Evidence it is safe to apply directly**, read from the engine before writing anything:

- `startHand` (`packages/poker-core/src/hand.ts`) folds the table's lineup into the hand's own
  event log at `HAND_STARTED`. From that point, `Hand.state` is purely a fold of `Hand.events`
  — nothing in `applyCommand`, `undo`, or view derivation ever re-reads `TableState` again.
- `applyHandResult` (`packages/poker-core/src/table.ts:239`) only compares `playerId` between
  the table seat and the hand seat (`HAND_TABLE_MISMATCH`) — it never reads or compares
  `occupancy`. Flipping `table.seats[seat].occupancy` mid-hand cannot trigger that guard, and
  the settle step's `{ ...tableSeat, stack: handSeat.stack }` spread preserves whatever
  occupancy the seat already has.
- `SeatCard` only falls back to the stored `TableSeat.occupancy` when there is **no** hand
  (`view === null`); while a hand is live, every rendered fact comes from `SeatView`. So a
  direct write is invisible to the current hand's own felt, by construction, not by care.

Given that, `tableStore.setSeatOccupancy` calls the engine's `setSeatOccupancy` and writes
`table` immediately — exactly like `setSeatAutoTopUp`'s "synchronous store write" convention,
no reconciliation step added to `startHand()`. This is simpler than the pending-map fallback
the brief allowed for, and it was justified with evidence rather than assumed.

**UI implication**: since the write is immediate, "takes effect next hand" is purely a
*display* fact, not a state-machine one. The toggle chip (`SeatOccupancyToggle`) computes
`pending = hand is live (phase !== COMPLETE) && this seat is still dealt into it
(view.seats[seat].status !== 'NOT_DEALT_IN')` and shows **다음 핸드부터** instead of 켬/끔 while
that holds. `SeatCard`'s own status line was left alone (`SEAT_STATUS_LABEL` still wins
whenever a hand exists) so a live FOLDED/ALL_IN badge is never overwritten by the pending
note — the pending note lives on the toggle control itself.

## Files

**poker-core** — unverified change: **none**. `setSeatOccupancy`, `dealtInSeats`,
`advanceButton` already did the right thing (see above); no gap was found or touched.

**Store**
- `apps/web/src/lib/table/tableStore.ts` — new `setSeatOccupancy(seat, occupancy)` action:
  calls the engine, writes `table` on success (clears `lastError`), calls `fail()` on
  `SEAT_EMPTY`. Does not touch `hand`/`view`.
- `apps/web/src/lib/table/tableStore.test.ts` — new `describe('tableStore — seat
  occupancy')`: full 6→5→4→5 sequence across `startHand()` calls; a mid-hand toggle changes
  only `table` (reference-equality checked against `hand`/`view`); button-seat sit-out clears
  the button and the next `advanceButton` picks the next eligible seat; toggling an EMPTY seat
  is refused with `SEAT_EMPTY` and the table reference is unchanged. **6 new tests.**

**UI**
- `apps/web/src/components/table/SeatOccupancyToggle.tsx` — new presentational component
  (sibling to `SeatCard`, not nested in it — same reason `SeatAutoTopUp` isn't). Shows
  켬/끔/다음 핸드부터.
- `apps/web/src/components/table/SeatOccupancyToggle.test.tsx` — new unit test (4 tests).
- `apps/web/src/lib/table/copy.ts` — added the exhaustive `SEAT_OCCUPANCY_LABEL: Record<SeatOccupancy,
  string>` (ADR-0053) and `seatOccupancyToggleState(occupancy, pending)`. `SeatCard.tsx`'s ad
  hoc `'자리 비움'` string literal (line ~84 per the audit) now reads from
  `SEAT_OCCUPANCY_LABEL` instead.
- `apps/web/src/lib/table/copy.test.ts` — 4 new tests for the above.
- `apps/web/src/components/table/TableRoot.tsx` —
  - renders `SeatOccupancyToggle` beside `SeatAutoTopUp` under every occupied seat;
  - `handleToggleSeatOccupancy`: synchronous store write first (reads current occupancy via
    `useTableStoreApi().getState()` to avoid a stale closure), then unawaited persistence,
    sequence-guarded per seat exactly like `handleSeatAutoTopUp`, non-reverting failure banner
    (`data-testid="occupancy-save-error"`);
  - the `S` hotkey is added to the table's **existing** single window `keydown` listener (the
    one that already owns `Esc`) — gated by the same `isTypingTarget` / `paletteOwnsKeyboard`
    checks, resolved through `resolveTypedKey` for IME safety. No second listener was added.
- `apps/web/src/components/table/TableRoot.test.tsx` — new `describe('TableRoot — seat
  occupancy')`: renders only for occupied seats; click toggles + persists with the right
  payload; `S` toggles the selected seat and is a no-op with none selected; `S` is inert while
  typing; a mid-hand toggle does not move the pot or the live hand's status and shows the
  pending label; the next hand deals one fewer seat; failed save does not revert the toggle;
  works with no persistence prop at all. **8 new tests.**

**Persistence**
- `packages/db/src/repositories/sessions.ts` — new `updateSessionSeatOccupancy(db, sessionId,
  seat, occupancy)`, modeled exactly on `updateSessionSeatAutoTopUp`: writes only the
  `occupancy` column of one row, `NOT_FOUND` on zero affected rows. **No migration** — the
  `session_seats.occupancy` column and its CHECK constraints already existed.
- `packages/db/tests/sessions.test.ts` — new `describe('seat occupancy
  (updateSessionSeatOccupancy)')`: updates one seat without touching neighbours/stack/
  timestamp, brings a seat back ACTIVE, `NOT_FOUND` for a missing session, `NOT_FOUND` for a
  missing seat row. **4 new tests**, against real in-memory SQLite (ADR-0022).
- `apps/web/src/lib/session-setup/contract.ts` — new `SeatOccupancyValue`,
  `UpdateSeatOccupancyResult`, `UpdateSeatOccupancyAction`, `seatOccupancySchema` (zod: shape
  only — `ACTIVE`/`SITTING_OUT`, never `EMPTY`; moving to `EMPTY` is `vacateSeat`, out of
  scope).
- `apps/web/src/server/session-service.ts` — new `updateSeatOccupancy(db, input)`: re-parses
  the shape, checks the session exists, is not closed (`CONFLICT`), and the seat is not
  `EMPTY` (`SEAT_EMPTY`) — mirrors `updateSeatAutoTopUp` exactly.
- `apps/web/src/server/session-service.test.ts` — new `describe('updateSeatOccupancy')`: 7
  tests (write, restore, malformed shapes incl. rejecting `'EMPTY'`, refuse on EMPTY seat,
  refuse on closed session, `NOT_FOUND`).
- `apps/web/src/server/actions/session.ts` — new `updateSeatOccupancyAction` (`'use server'`
  wrapper, no logic).
- `apps/web/src/app/table/[sessionId]/page.tsx` — wires `updateSeatOccupancyAction` into
  `TableRoot` alongside the existing auto-top-up action; doc comment updated.

**E2E**
- `apps/web/tests/e2e/seat-occupancy.spec.ts` — new spec, 2 tests:
  1. a seat toggled mid-hand shows "다음 핸드부터", the live hand and pot are untouched, and
     the *next* hand deals one fewer seat — plus a `page.on('request')` assertion that the
     toggle's own click path fires no network request;
  2. a player toggled off before a hand, then back on mid-hand (never dealt into that hand,
     so nothing is "pending"), is included in the *following* hand.

## Tests run

| Suite | Command | Result |
| --- | --- | --- |
| Store | `pnpm vitest run --project web apps/web/src/lib/table/tableStore.test.ts` | 30/30 pass (6 new) |
| Copy | `pnpm vitest run --project web apps/web/src/lib/table/copy.test.ts` | pass (4 new) |
| Toggle component | `pnpm vitest run --project web apps/web/src/components/table/SeatOccupancyToggle.test.tsx` | 4/4 pass |
| TableRoot integration | `pnpm vitest run --project web apps/web/src/components/table/TableRoot.test.tsx` | 43/43 pass (8 new) |
| session-service | `pnpm vitest run --project web apps/web/src/server/session-service.test.ts` | 28/28 pass (7 new) |
| DB | `pnpm vitest run --project db packages/db/tests/sessions.test.ts` | 28/28 pass (4 new) |
| Full web+db+poker-core | `pnpm vitest run --project web --project db --project poker-core` | **867/867 pass** |
| Typecheck | `pnpm typecheck` (all 9 packages) | clean |
| Lint | `pnpm lint` (layering rules included) | clean |
| Build | `pnpm --filter @gto-self/web build` | clean |
| E2E (new specs) | `pnpm exec playwright test tests/e2e/seat-occupancy.spec.ts` | 2/2 pass |
| E2E (full suite) | `pnpm exec playwright test` | **17/17 pass** |

## Risks / follow-ups

- **No migration needed**, confirmed rather than assumed: `session_seats.occupancy` and its
  three CHECK constraints (`session_seats_occupancy`,
  `session_seats_empty_player_pair`, `session_seats_empty_stack_zero`) already existed and
  were exercised by the new DB tests.
- The occupancy toggle persists **immediately** on click (not deferred to when a pending
  toggle "actually applies"), because the table-level write is already immediate — documented
  above as the resolved design question. This is consistent with `seatAutoTopUp`'s existing
  persistence timing.
- Did not touch `docs/STATE.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `prompt*`,
  `packages/gto-core`, or the three root config files (`eslint.config.js`,
  `tsconfig.base.json`, `vitest.config.ts`) reserved for the concurrent `packages/strategy-core`
  agent — none of that was necessary for this WP.
- **ADR-worthy note for the orchestrator**: this WP is a concrete instance of a pattern
  `docs/DECISIONS.md` may want to name explicitly — "a between-hands table preference can
  write `TableState` directly and unconditionally, because `Hand` is a closed fold over its
  own event log from `HAND_STARTED` onward, and never re-reads `TableState`." That same
  argument is already implicit in how `setSeatAutoTopUp` behaves; A1 makes it explicit for
  occupancy and could be lifted into a short ADR if a future WP wants to rely on it without
  re-deriving the proof.

---

## Correction appendix (2026-09-01, post-ADR-0058)

Two claims above were falsified by the independent reviews and are superseded:

- **"poker-core change: none" is no longer true.** R1 BLOCKER-2/MAJOR-2 (and R1B MAJOR-1)
  showed the `setSeatOccupancy` button-clearing behaviour this WP relied on was itself the
  defect: sitting the button seat out before the first deal bricked Start Hand
  (`NO_BUTTON_SEAT`), and a nulled button restarted rotation at the lowest seat. The fix
  round changed `packages/poker-core/src/table.ts`: `setSeatOccupancy` now mutates ONLY the
  seat's occupancy and never touches `buttonSeat` (ADR-0058), and the web store advances a
  non-null-but-ineligible button at deal time via `advanceButton`.
- **"advanceButton picks the next eligible seat" needed the qualifier that it did so only
  from a non-null button.** With ADR-0058 the null-button path is no longer reachable via
  sit-out; a null button now surfaces `NO_BUTTON_SEAT` as `lastError` rather than being
  silently repaired.

See `docs/reports/STRATEGY_FIX_BUTTON.md` for the full fix, its failing-test proofs, and
the invariant restatement.
