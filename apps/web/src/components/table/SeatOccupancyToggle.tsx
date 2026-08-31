'use client';

/**
 * One occupied seat's ACTIVE <-> SITTING_OUT toggle, rendered under its `SeatCard` (whose
 * root is a `<button>`, so this cannot live inside it — same reason `SeatAutoTopUp` sits
 * beside it rather than in it).
 *
 * Both this button and the `S` hotkey (`TableRoot.tsx`) call the SAME `onToggle`, so a
 * keystroke and a click can never disagree about what "toggle this seat" means.
 *
 * The toggle is immediate at the TABLE level (`packages/poker-core/src/table.ts` —
 * `setSeatOccupancy`, wired through `tableStore.ts`): a hand already in progress is a pure
 * fold over its own event log and never re-reads the table, so flipping this can never
 * touch a live hand. Only the NEXT `startHand()` sees the new occupancy (`dealtInSeats`
 * excludes SITTING_OUT structurally). That cuts BOTH ways — sitting a dealt-in seat out and
 * re-activating a seat the current hand skipped are equally "next hand" — so whenever the
 * live lineup disagrees with the stored occupancy, `pending` says so plainly ("다음 핸드부터")
 * rather than implying an effect that has not happened yet (`CLAUDE.md` rule 3, R1 MINOR-12).
 */
import type { SeatIndex, SeatOccupancy } from '@gto-self/poker-core';
import { seatOccupancyToggleState } from '../../lib/table/copy.js';

export interface SeatOccupancyToggleProps {
  readonly seat: SeatIndex;
  /** The seat's CURRENT stored occupancy. Never `EMPTY` — the caller only renders this
   * for an occupied seat, mirroring `SeatAutoTopUp`. */
  readonly occupancy: SeatOccupancy;
  /**
   * True while the hand in progress DISAGREES with `occupancy` — it still has a
   * now-SITTING_OUT seat dealt in, or does not have a now-ACTIVE one. See the module doc.
   */
  readonly pending: boolean;
  readonly onToggle: (seat: SeatIndex) => void;
}

export function SeatOccupancyToggle({ seat, occupancy, pending, onToggle }: SeatOccupancyToggleProps) {
  const sittingOut = occupancy === 'SITTING_OUT';
  return (
    <div
      data-testid={`seat-${seat}-occupancy`}
      data-sitting-out={sittingOut ? 'true' : 'false'}
      className="mt-1 flex w-full min-w-0 items-center gap-1 text-[0.6rem] uppercase tracking-wide"
    >
      <button
        type="button"
        data-testid={`seat-${seat}-occupancy-toggle`}
        aria-pressed={sittingOut}
        aria-label={`좌석 ${seat + 1} 자리비움 전환`}
        onClick={() => onToggle(seat)}
        className={`rounded px-1 font-semibold ${
          sittingOut ? 'bg-dirty-500 text-surface-900' : 'bg-surface-600 text-ink-500'
        }`}
      >
        자리비움
      </button>
      <span
        data-testid={`seat-${seat}-occupancy-state`}
        className={sittingOut ? 'text-dirty-500' : 'text-ink-700'}
      >
        {seatOccupancyToggleState(occupancy, pending)}
      </span>
    </div>
  );
}
