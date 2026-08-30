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
 *
 * Copy is Korean; `BTN` / `SB` / `BB` and the position labels are international poker
 * vocabulary and stay Latin (`lib/table/copy.ts`).
 */
import { Money } from '@gto-self/shared';
import type { SeatIndex, SeatView, TableSeat } from '@gto-self/poker-core';
import type { ActionRecord } from '@gto-self/poker-core';
import {
  ACTION_LABEL,
  POSITION_LABEL,
  SEAT_STATUS_LABEL,
  seatLabel,
} from '../../lib/table/copy.js';

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

/**
 * Presentation only: how one `ActionRecord` reads in the seat's footer. The verb comes
 * from the exhaustive `ACTION_LABEL` map, so a new engine event cannot render untranslated.
 */
function lastActionLabel(record: ActionRecord): string {
  const verb = ACTION_LABEL[record.kind];
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

  const statusText = empty
    ? ''
    : status === null
      ? tableSeat.occupancy === 'SITTING_OUT'
        ? '자리 비움'
        : ''
      : SEAT_STATUS_LABEL[status];

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
      className={`flex w-full min-w-0 flex-col gap-0.5 rounded-md border bg-surface-800 px-2 py-1 text-left ${border} ${
        folded ? 'opacity-50' : ''
      } ${empty ? 'cursor-default' : 'cursor-pointer hover:border-ink-500'}`}
    >
      <span className="flex items-center justify-between gap-1 text-[0.6rem] tracking-wide">
        <span className="truncate text-ink-500">{seatLabel(seat)}</span>
        <span className="flex items-center gap-0.5">
          {showPosition && (
            <span className="rounded bg-surface-600 px-1 text-ink-300">
              {POSITION_LABEL[position]}
            </span>
          )}
          {isButton && <span className="rounded bg-ink-100 px-1 text-surface-900">BTN</span>}
          {isSmallBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">SB</span>}
          {isBigBlind && <span className="rounded bg-surface-500 px-1 text-ink-100">BB</span>}
          {isHero && <span className="rounded bg-hero-500 px-1 text-surface-900">나</span>}
        </span>
      </span>

      {/* Name and stack on ONE row: two facts that are always read together, and one row
          of vertical space instead of two. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {empty ? <span className="text-ink-700">빈 좌석</span> : (nickname ?? '이름 없음')}
        </span>
        {!empty && (
          <span className="tabular shrink-0 text-sm text-ink-300">
            {/* maxDecimals 3 = full milliBB: a stack is the user's ACTUAL value and is
                never shown rounded (`CLAUDE.md` rule 3). */}
            {Money.formatBB(stack, { maxDecimals: 3, unit: true })}
          </span>
        )}
      </span>

      <span className="flex items-center justify-between gap-1 text-[0.6rem] text-ink-500">
        <span className="flex min-w-0 items-center gap-1">
          <span data-testid={`seat-${seat}-status`}>{statusText}</span>
          {view?.lastAction !== null && view?.lastAction !== undefined && (
            <span className="truncate text-ink-500" data-testid={`seat-${seat}-last-action`}>
              {lastActionLabel(view.lastAction)}
            </span>
          )}
          {isActor && <span className="shrink-0 font-semibold text-actor-500">액션 차례</span>}
        </span>
        {view !== null && Money.isPositive(view.streetContribution) && (
          <span className="tabular shrink-0 text-ink-300" data-testid={`seat-${seat}-contribution`}>
            {Money.formatBB(view.streetContribution, { maxDecimals: 3, unit: true })}
          </span>
        )}
      </span>
    </button>
  );
}
