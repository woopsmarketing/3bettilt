'use client';

/**
 * Quick manual seat sync (feature B). A small, always-reachable correction surface for one
 * occupied seat: fix its displayed stack, make it the button, and reach the ALREADY-EXISTING
 * `SeatOccupancyToggle` from the same place — this component does not reimplement that
 * toggle, it only renders it (per spec: "do not rebuild it, just make sure it's reachable").
 *
 * Both controls here are LINEUP CORRECTIONS, not display tweaks. Between hands they change the
 * table and nothing else; while a hand is live they REBASE it — the hand is discarded whole and
 * re-dealt from the corrected lineup at the same hand number, with no button rotation
 * (`correctSeatButton`, ADR-0073; `correctSeatStack`, ADR-0078a). The store does that by itself,
 * so neither handler needs the caller to discard anything first, and the old `discardHand()` in
 * front of `onMakeButton` — which became a double discard that stopped the re-deal happening at
 * all — is gone.
 *
 * That is also why this panel refuses nothing on its own account: when the store declines a
 * correction (a COMPLETE hand still waiting to be settled dealt this seat in), the refusal is
 * the engine's and reaches the user through the table's error banner, verbatim.
 *
 * The stack field refuses exactly what `tableStore.correctSeatStack` and the server refuse:
 * unparseable text, and a value that is not strictly positive.
 */
import { useState } from 'react';
import { Money } from '@gto-self/shared';
import type { SeatIndex, TableSeat } from '@gto-self/poker-core';
import type { MilliBB } from '@gto-self/shared';
import {
  SEAT_BUTTON_SEAT_LABEL,
  SEAT_CORRECTION_CLOSE_LABEL,
  SEAT_CORRECTION_LABEL,
  SEAT_CORRECTION_SAVE_LABEL,
  SEAT_CORRECTION_STACK_LABEL,
  SEAT_DIRTY_BADGE,
  STACK_EDIT_REJECTION_LABEL,
  seatLabel,
} from '../../lib/table/copy.js';
import { SeatOccupancyToggle } from './SeatOccupancyToggle.js';

export interface SeatCorrectionPanelProps {
  readonly seat: SeatIndex;
  readonly tableSeat: TableSeat;
  /** Whether this seat still needs the user's eyes (`tableStore.dirtySeats`). */
  readonly dirty: boolean;
  readonly onCorrectStack: (seat: SeatIndex, stack: MilliBB) => void;
  readonly onMakeButton: (seat: SeatIndex) => void;
  readonly onToggleOccupancy: (seat: SeatIndex) => void;
  readonly isButton: boolean;
  readonly onClose: () => void;
}

export function SeatCorrectionPanel({
  seat,
  tableSeat,
  dirty,
  onCorrectStack,
  onMakeButton,
  onToggleOccupancy,
  isButton,
  onClose,
}: SeatCorrectionPanelProps) {
  // Verbatim entered text, never replaced by the parse (`CLAUDE.md` rule 3) — mirrors
  // `SessionSetupForm`'s stack field, which is the same UI/parse boundary Money.parseBB
  // exists for.
  const [stackText, setStackText] = useState(() => Money.formatBB(tableSeat.stack));
  const parsed = Money.parseBB(stackText);
  // The SAME two refusals the inline editor and the store make. `0` is a mistyped or empty
  // field here, not an observation of a busted seat.
  const rejection = !parsed.ok
    ? ('NOT_A_NUMBER' as const)
    : !Money.isPositive(parsed.value)
      ? ('NOT_POSITIVE' as const)
      : null;

  const handleSave = () => {
    if (!parsed.ok || rejection !== null) return;
    onCorrectStack(seat, parsed.value);
  };

  return (
    <section
      data-testid={`seat-correction-${seat}`}
      aria-label={`${seatLabel(seat)} ${SEAT_CORRECTION_LABEL}`}
      className="flex flex-col gap-2 rounded-md border border-surface-600 bg-surface-800 p-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">
          {seatLabel(seat)} {SEAT_CORRECTION_LABEL}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[0.65rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
        >
          {SEAT_CORRECTION_CLOSE_LABEL}
        </button>
      </header>

      {dirty && (
        <p
          data-testid={`seat-${seat}-dirty-badge`}
          className="w-fit rounded bg-dirty-500 px-1 text-[0.6rem] font-semibold text-surface-900"
        >
          {SEAT_DIRTY_BADGE}
        </p>
      )}

      <label className="flex flex-col gap-1 text-[0.65rem] text-ink-500">
        {SEAT_CORRECTION_STACK_LABEL}
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            data-testid={`seat-${seat}-correction-stack`}
            value={stackText}
            onChange={(event) => setStackText(event.target.value)}
            className="w-24 rounded border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-ink-100"
          />
          <button
            type="button"
            data-testid={`seat-${seat}-correction-save`}
            disabled={rejection !== null}
            onClick={handleSave}
            className="rounded border border-good-500 px-1.5 py-0.5 text-[0.65rem] font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
          >
            {SEAT_CORRECTION_SAVE_LABEL}
          </button>
        </div>
        {rejection !== null && (
          <span data-testid={`seat-${seat}-correction-error`} className="text-danger-500">
            {STACK_EDIT_REJECTION_LABEL[rejection]}
          </span>
        )}
      </label>

      <button
        type="button"
        data-testid={`seat-${seat}-correction-button-seat`}
        disabled={isButton}
        onClick={() => onMakeButton(seat)}
        className="w-fit rounded border border-surface-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-ink-300 disabled:text-ink-700"
      >
        {SEAT_BUTTON_SEAT_LABEL[isButton ? 'CURRENT' : 'MAKE']}
      </button>

      <SeatOccupancyToggle
        seat={seat}
        occupancy={tableSeat.occupancy}
        onToggle={onToggleOccupancy}
      />
    </section>
  );
}
