'use client';

/**
 * One occupied seat's ACTIVE <-> SITTING_OUT toggle, rendered under its `SeatCard`.
 *
 * Both this button and the `S` hotkey (`TableRoot.tsx`) call the SAME `onToggle`, so a
 * keystroke and a click can never disagree about what "toggle this seat" means.
 *
 * **THERE IS NO "다음 핸드부터" STATE ANY MORE (ADR-0073).** Sitting a seat out used to reach
 * the table at once and the felt only on the next deal, because a hand is a fold over its own
 * event log and never re-reads the table — so this component carried a `pending` flag saying
 * the two disagreed. The rebase removed the disagreement rather than papering over it: a
 * change made while a hand is live discards that hand and re-deals the corrected lineup at the
 * same hand number, so the felt agrees with the toggle in the same commit. `copy.ts` dropped
 * the timing union with it, and `seatOccupancyToggleState` now takes only the occupancy.
 */
import type { SeatIndex, SeatOccupancy } from '@gto-self/poker-core';
import { seatOccupancyToggleState } from '../../lib/table/copy.js';

export interface SeatOccupancyToggleProps {
  readonly seat: SeatIndex;
  /** The seat's CURRENT stored occupancy. Never `EMPTY` — the caller only renders this
   * for an occupied seat, mirroring `SeatAutoTopUp`. */
  readonly occupancy: SeatOccupancy;
  readonly onToggle: (seat: SeatIndex) => void;
}

export function SeatOccupancyToggle({ seat, occupancy, onToggle }: SeatOccupancyToggleProps) {
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
        {seatOccupancyToggleState(occupancy)}
      </span>
    </div>
  );
}
