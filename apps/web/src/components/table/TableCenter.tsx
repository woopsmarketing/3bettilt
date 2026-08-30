'use client';

/**
 * The middle of the felt: street, pot, board, and the side pots when there is more than
 * one. Every number is read straight off `HandView`; none is computed here (`prompt` D2).
 *
 * The board renders the cards that EXIST, plus the empty slots of a street already in
 * progress. A board with nothing on it renders one short line instead of five large
 * dashed boxes — an empty card area should not cost the felt a block of dead height.
 */
import { Money } from '@gto-self/shared';
import type { TableConfig } from '@gto-self/poker-core';
import type { HandView } from '@gto-self/poker-core';
import { CardChip, CardSlot } from './CardChip.js';
import { STREET_LABEL, phaseLabel } from '../../lib/table/copy.js';

/** How many board cards a complete board holds, so a dealt street shows its gaps. */
const BOARD_SLOTS = 5;

export interface TableCenterProps {
  readonly view: HandView | null;
  /** Used for the currency conversion when no hand is live. */
  readonly config: TableConfig;
}

export function TableCenter({ view, config }: TableCenterProps) {
  const display = (view?.config ?? config).display;
  const pot = view?.pot ?? null;
  const board = view?.board ?? [];

  return (
    <div className="col-span-3 row-start-2 flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-felt-600 bg-felt-800 px-3 py-2">
      <div className="flex items-baseline gap-2 text-[0.6rem] uppercase tracking-widest text-ink-500">
        <span data-testid="street">{view === null ? '핸드 없음' : STREET_LABEL[view.street]}</span>
        <span data-testid="phase">{view === null ? '대기' : phaseLabel(view)}</span>
        {view !== null && <span>핸드 #{view.handNumber}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[0.6rem] uppercase tracking-widest text-ink-500">팟</span>
        <span className="tabular text-xl font-semibold" data-testid="pot">
          {pot === null ? '—' : Money.formatBB(pot, { maxDecimals: 3, unit: true })}
        </span>
        {pot !== null && (
          <span className="tabular text-xs text-ink-500" data-testid="pot-currency">
            {Money.formatCurrency(pot, display.bigBlindValue, { symbol: display.symbol })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5" data-testid="board">
        {board.length === 0 ? (
          <span className="text-[0.65rem] text-ink-700">보드 없음</span>
        ) : (
          Array.from({ length: BOARD_SLOTS }, (_, index) => {
            const card = board[index];
            return card === undefined ? (
              <CardSlot key={`slot-${index}`} size="sm" />
            ) : (
              <CardChip key={card} card={card} size="sm" />
            );
          })
        )}
      </div>

      {view !== null && view.pots.length > 1 && (
        <ul className="flex flex-wrap items-center gap-2 text-[0.65rem]" data-testid="side-pots">
          {view.pots.map((sidePot) => (
            <li
              key={sidePot.index}
              className="tabular rounded bg-felt-700 px-2 py-0.5 text-ink-300"
            >
              <span className="mr-1 tracking-wide text-ink-500">
                {sidePot.kind === 'MAIN' ? '메인' : `사이드 ${sidePot.index}`}
              </span>
              {Money.formatBB(sidePot.amount, { maxDecimals: 3, unit: true })}
              <span className="ml-1 text-ink-500">
                좌석 {sidePot.eligibleSeats.map((seat) => seat + 1).join(',')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
