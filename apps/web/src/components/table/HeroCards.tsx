'use client';

/**
 * The hero's hole-card area.
 *
 * Display only. Entry belongs to `CardPalette`, which opens itself whenever
 * `view.seats[heroSeat].holeCards` is short and dispatches `SET_HOLE_CARDS` through
 * `store.apply`. An unset hole card renders as an unset hole card — never as fake data.
 */
import type { HandView, SeatIndex } from '@gto-self/poker-core';
import { CardChip, CardSlot } from './CardChip.js';

export interface HeroCardsProps {
  readonly view: HandView | null;
  readonly heroSeat: SeatIndex | null;
}

export function HeroCards({ view, heroSeat }: HeroCardsProps) {
  const cards = view !== null && heroSeat !== null ? view.seats[heroSeat].holeCards : [];

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2"
      data-testid="hero-cards"
    >
      <span className="text-[0.65rem] uppercase tracking-widest text-ink-500">hero cards</span>
      <span className="flex items-center gap-1">
        {cards[0] === undefined ? <CardSlot size="sm" /> : <CardChip card={cards[0]} size="sm" />}
        {cards[1] === undefined ? <CardSlot size="sm" /> : <CardChip card={cards[1]} size="sm" />}
      </span>
    </div>
  );
}
