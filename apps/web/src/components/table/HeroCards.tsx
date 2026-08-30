'use client';

/**
 * The hero's hole-card rail. It lives in the entry tray, on the left of whatever the tray
 * is currently holding, and it is ALWAYS mounted — the card palette that fills it comes
 * and goes, so the thing it fills must not.
 *
 * Display only. Entry belongs to `CardPalette`, which opens itself whenever
 * `view.seats[heroSeat].holeCards` is short and dispatches `SET_HOLE_CARDS` through
 * `store.apply`. An unset hole card renders as an unset hole card — never as fake data,
 * and never as a block of dead height either: with nothing entered this is one short line.
 */
import type { HandView, SeatIndex } from '@gto-self/poker-core';
import { CardChip } from './CardChip.js';

export interface HeroCardsProps {
  readonly view: HandView | null;
  readonly heroSeat: SeatIndex | null;
}

export function HeroCards({ view, heroSeat }: HeroCardsProps) {
  const cards = view !== null && heroSeat !== null ? view.seats[heroSeat].holeCards : [];

  return (
    <div
      className="flex shrink-0 flex-col justify-center gap-1 border-r border-surface-700 pr-3"
      data-testid="hero-cards"
    >
      <span className="text-[0.6rem] uppercase tracking-widest text-ink-500">내 카드</span>
      {cards.length === 0 ? (
        <span className="text-[0.65rem] text-ink-700">미입력</span>
      ) : (
        <span className="flex items-center gap-1">
          {cards.map((card) => (
            <CardChip key={card} card={card} size="sm" />
          ))}
        </span>
      )}
    </div>
  );
}
