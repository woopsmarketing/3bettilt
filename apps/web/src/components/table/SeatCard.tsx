'use client';

/**
 * One physical seat. It never moves: `docs/UX.md` pins hero bottom-centre and rotates the
 * MARKERS instead.
 *
 * Every poker fact on this card is a field read off `SeatView`, which came from
 * `toView(hand)`. Nothing here decides who the button is, what a position is called, who
 * is on the clock, or what anything costs (`prompt` D2). With no hand in progress there
 * is no `SeatView`, and the card falls back to the stored `TableSeat` — occupancy, stack
 * and the table's own hero/button fields, which are stored values, not derived ones.
 */
import { Money } from '@gto-self/shared';
import type { SeatIndex, SeatView, TableSeat } from '@gto-self/poker-core';
import type { ActionRecord } from '@gto-self/poker-core';

export interface SeatCardProps {
  readonly seat: SeatIndex;
  readonly tableSeat: TableSeat;
  /** `null` while no hand is live. */
  readonly view: SeatView | null;
  readonly nickname: string | null;
  /** From `table.heroSeat`; used only when there is no hand to read `isHero` from. */
  readonly heroSeat: SeatIndex | null;
  /** From `table.buttonSeat`; used only when there is no hand. */
  readonly tableButtonSeat: SeatIndex | null;
  readonly selected: boolean;
  readonly onSelect: (seat: SeatIndex) => void;
}

const STATUS_LABEL: Readonly<Record<SeatView['status'], string>> = {
  NOT_DEALT_IN: 'not dealt in',
  IN_HAND: '',
  FOLDED: 'folded',
  ALL_IN: 'all in',
};

/** Presentation only: how one `ActionRecord` reads in the seat's footer. */
function lastActionLabel(record: ActionRecord): string {
  const verb = record.kind.toLowerCase().replace('_', ' ');
  if (record.toAmount === null) return verb;
  return `${verb} ${Money.formatBB(record.toAmount, { maxDecimals: 3 })}`;
}

export function SeatCard({
  seat,
  tableSeat,
  view,
  nickname,
  heroSeat,
  tableButtonSeat,
  selected,
  onSelect,
}: SeatCardProps) {
  const empty = tableSeat.occupancy === 'EMPTY';
  const isActor = view?.isActor ?? false;
  const isHero = view?.isHero ?? heroSeat === seat;
  const isButton = view?.isButton ?? tableButtonSeat === seat;
  const isSmallBlind = view?.isSmallBlind ?? false;
  const isBigBlind = view?.isBigBlind ?? false;
  const status = view?.status ?? null;
  const stack = view?.stack ?? tableSeat.stack;
  const folded = status === 'FOLDED';

  // The dealer/blind markers and the position label are two different facts that usually
  // COINCIDE (the BTN seat's position is "BTN"). Rendering both would read as "BTN BTN",
  // so the position chip is dropped when a marker already says the same word. Nothing is
  // derived here — both values still come from `SeatView`.
  const markers: string[] = [];
  if (isButton) markers.push('BTN');
  if (isSmallBlind) markers.push('SB');
  if (isBigBlind) markers.push('BB');
  const position = view?.position ?? null;
  const showPosition = position !== null && !markers.includes(position);

  const border = isActor
    ? 'border-actor-500 ring-2 ring-actor-500'
    : isHero
      ? 'border-hero-500'
      : selected
        ? 'border-ink-300'
        : 'border-surface-600';

  return (
    <button
      type="button"
      data-testid={`seat-${seat}`}
      data-actor={isActor ? 'true' : 'false'}
      data-hero={isHero ? 'true' : 'false'}
      data-button={isButton ? 'true' : 'false'}
      data-sb={isSmallBlind ? 'true' : 'false'}
      data-bb={isBigBlind ? 'true' : 'false'}
      data-status={status ?? tableSeat.occupancy}
      disabled={empty}
      onClick={() => onSelect(seat)}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-lg border bg-surface-800 px-3 py-2 text-left ${border} ${
        folded ? 'opacity-50' : ''
      } ${empty ? 'cursor-default' : 'cursor-pointer hover:border-ink-500'}`}
    >
      <span className="flex items-center justify-between gap-2 text-[0.65rem] uppercase tracking-wide">
        <span className="text-ink-500">seat {seat + 1}</span>
        <span className="flex items-center gap-1">
          {showPosition && (
            <span className="rounded bg-surface-600 px-1 text-ink-300">{position}</span>
          )}
          {isButton && <span className="rounded bg-ink-100 px-1 text-surface-900">BTN</span>}
          {isSmallBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">SB</span>}
          {isBigBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">BB</span>}
          {isHero && <span className="rounded bg-hero-500 px-1 text-surface-900">HERO</span>}
        </span>
      </span>

      <span className="truncate text-sm font-medium">
        {empty ? <span className="text-ink-700">empty</span> : (nickname ?? 'unknown player')}
      </span>

      {!empty && (
        <span className="tabular text-sm text-ink-300">
          {/* maxDecimals 3 = full milliBB: a stack is the user's ACTUAL value and is
              never shown rounded (`CLAUDE.md` rule 3). */}
          {Money.formatBB(stack, { maxDecimals: 3, unit: true })}
        </span>
      )}

      <span className="flex items-center justify-between gap-2 text-[0.65rem] text-ink-500">
        <span data-testid={`seat-${seat}-status`}>
          {empty
            ? ''
            : status === null
              ? tableSeat.occupancy === 'SITTING_OUT'
                ? 'sitting out'
                : ''
              : STATUS_LABEL[status]}
        </span>
        {view !== null && Money.isPositive(view.streetContribution) && (
          <span className="tabular text-ink-300" data-testid={`seat-${seat}-contribution`}>
            {Money.formatBB(view.streetContribution, { maxDecimals: 3, unit: true })}
          </span>
        )}
      </span>

      {view?.lastAction !== null && view?.lastAction !== undefined && (
        <span
          className="truncate text-[0.65rem] uppercase tracking-wide text-ink-500"
          data-testid={`seat-${seat}-last-action`}
        >
          {lastActionLabel(view.lastAction)}
        </span>
      )}

      {isActor && (
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-actor-500">
          to act
        </span>
      )}
    </button>
  );
}
