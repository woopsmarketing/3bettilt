# WP-B/C — Skip Hand + Manual Seat Sync

2026-09-02. Implements items 2 and 3 of `prompt` (repo root).

## Changed files

- `apps/web/src/lib/table/tableStore.ts` — added `dirtySeats: ReadonlySet<SeatIndex>` and
  four new store methods: `skipHand()`, `discardHand()`, `correctSeatStack(seat, stack)`,
  `correctSeatButton(seat)`.
- `apps/web/src/components/table/TableRoot.tsx` — Skip Hand button
  (`data-testid="skip-hand"`), per-seat dirty badge (`seat-{n}-dirty`), seat-correction
  toggle/panel wiring, `logSkippedHand` prop threaded in.
- `apps/web/src/components/table/SeatCorrectionPanel.tsx` (new) — stack correction input,
  "이 좌석을 버튼으로" (make this seat the button) action, and the existing
  `SeatOccupancyToggle` composed together.
- `apps/web/src/lib/table/skip-hand-contract.ts` (new) — client-safe wire contract for the
  best-effort skip-audit action.
- `apps/web/src/server/skip-hand-service.ts` + `apps/web/src/server/actions/skip-hand.ts`
  (new) — validates and calls `insertSkippedHand` (the insert-only audit table added in the
  WP-A/B DB migration).
- `apps/web/src/app/table/[sessionId]/page.tsx` — wires `logSkippedHandAction`.
- Tests: `apps/web/src/lib/table/tableStore.test.ts` (+13), `apps/web/tests/e2e/skip-hand.spec.ts` (new, 2 specs).

## Behavior

- **Skip Hand**: one click, enabled only while a hand is in progress
  (`phase !== 'COMPLETE'`). Discards `hand`/`view` in memory (never persisted, never marked
  COMPLETE — structurally invisible to `insertCompletedHand`/`analysis-core`, so it cannot
  create a player observation), advances the button exactly one hand via `advanceButton`,
  and marks every seat that was dealt in as "확인 필요" (dirty). A best-effort audit row is
  logged unawaited; its failure never blocks the UI.
- **Discard for correction**: `discardHand()` clears the current hand with **no** table
  mutation (no rotation) — used when the lineup itself was mis-entered, not when a hand
  should count as "played and skipped."
- **Seat correction panel**: per-seat stack edit (`setSeatStack`), "make button"
  (`setButtonSeat`), and the existing sit-out/active toggle, reachable at any time. Saving a
  corrected stack clears that seat's dirty badge.

## Known limitation

`poker-core` has no primitive to advance `TableState.handNumber` outside the
`applyHandResult` (completed-hand) path. `skipHand()` increments `handNumber` via a direct
object spread in `tableStore.ts` after `advanceButton()`, documented inline. This is a
pragmatic client-side workaround, not a `poker-core` rule change — if a future phase wants
this to be an engine-owned primitive, add `advanceButtonOnly`/similar to `poker-core` and
swap the call site.

## Tests

- `tableStore.test.ts`: 46/46 pass.
- `web` project (table components + store): 155/155 pass.
- E2E `skip-hand.spec.ts`: 2/2 pass; regression check `seat-occupancy.spec.ts`: 3/3 pass.
- `pnpm --filter web build`: succeeds. Workspace typecheck/lint: clean.
