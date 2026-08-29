'use client';

/**
 * The middle of the felt: street, pot, board, and the side pots when there is more than
 * one. Every number is read straight off `HandView`; none is computed here (`prompt` D2).
 */
import { Money } from '@gto-self/shared';
import type { TableConfig } from '@gto-self/poker-core';
import type { HandView } from '@gto-self/poker-core';
import { CardChip, CardSlot } from './CardChip.js';

/** How many board cards the street shows, so an undealt street still has placeholders. */
const BOARD_SLOTS = 5;

function phaseLabel(view: HandView): string {
  switch (view.phase.kind) {
    case 'SETUP':
      return 'setting up';
    case 'AWAITING_ACTION':
      return 'awaiting action';
    case 'AWAITING_BOARD':
      return `awaiting ${view.phase.street.toLowerCase()} (${view.phase.cardsNeeded} card${
        view.phase.cardsNeeded === 1 ? '' : 's'
      })`;
    case 'AWAITING_AWARD':
      return 'awaiting award';
    case 'COMPLETE':
      return 'complete';
  }
}

export interface TableCenterProps {
  readonly view: HandView | null;
  /** Used for the currency conversion when no hand is live. */
  readonly config: TableConfig;
}

export function TableCenter({ view, config }: TableCenterProps) {
  const display = (view?.config ?? config).display;
  const pot = view?.pot ?? null;

  return (
    <div className="col-span-3 row-start-2 flex flex-col items-center justify-center gap-3 rounded-xl border border-felt-600 bg-felt-800 px-4 py-5">
      <div className="flex items-baseline gap-3 text-[0.65rem] uppercase tracking-widest text-ink-500">
        <span data-testid="street">{view?.street ?? 'no hand'}</span>
        <span data-testid="phase">{view === null ? 'idle' : phaseLabel(view)}</span>
        {view !== null && <span>hand #{view.handNumber}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[0.65rem] uppercase tracking-widest text-ink-500">pot</span>
        <span className="tabular text-2xl font-semibold" data-testid="pot">
          {pot === null ? '—' : Money.formatBB(pot, { maxDecimals: 3, unit: true })}
        </span>
        {pot !== null && (
          <span className="tabular text-xs text-ink-500" data-testid="pot-currency">
            {Money.formatCurrency(pot, display.bigBlindValue, { symbol: display.symbol })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2" data-testid="board">
        {Array.from({ length: BOARD_SLOTS }, (_, index) => {
          const card = view?.board[index];
          return card === undefined ? (
            <CardSlot key={`slot-${index}`} />
          ) : (
            <CardChip key={card} card={card} />
          );
        })}
      </div>

      {view !== null && view.pots.length > 1 && (
        <ul className="flex flex-wrap items-center gap-3 text-xs" data-testid="side-pots">
          {view.pots.map((sidePot) => (
            <li key={sidePot.index} className="tabular rounded bg-felt-700 px-2 py-1 text-ink-300">
              <span className="mr-1 uppercase tracking-wide text-ink-500">
                {sidePot.kind === 'MAIN' ? 'main' : `side ${sidePot.index}`}
              </span>
              {Money.formatBB(sidePot.amount, { maxDecimals: 3, unit: true })}
              <span className="ml-1 text-ink-500">
                seats {sidePot.eligibleSeats.map((seat) => seat + 1).join(',')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
