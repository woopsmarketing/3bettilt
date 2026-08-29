'use client';

/**
 * One playing card. Rank and suit come from `@gto-self/shared` — a card is a branded
 * integer, and only the shared module knows how to decode one.
 *
 * Red suits (hearts, diamonds) are rendered in the danger red and black suits in the
 * surface near-black, so the two are distinguishable at a glance and not only by glyph.
 */
import { cardToString, rankOf, suitOf, type Card, type Suit } from '@gto-self/shared';

const SUIT_GLYPH: Readonly<Record<Suit, string>> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

const RED_SUITS: readonly Suit[] = ['h', 'd'];

export interface CardChipProps {
  readonly card: Card;
  readonly size?: 'sm' | 'md';
}

export function CardChip({ card, size = 'md' }: CardChipProps) {
  const suit = suitOf(card);
  const red = RED_SUITS.includes(suit);
  const box =
    size === 'sm' ? 'h-8 w-6 text-[0.7rem] leading-tight' : 'h-14 w-10 text-base leading-tight';
  return (
    <span
      data-testid={`card-${cardToString(card)}`}
      data-suit={suit}
      data-colour={red ? 'red' : 'black'}
      className={`tabular inline-flex flex-col items-center justify-center rounded border border-surface-500 bg-ink-100 font-semibold ${box} ${
        red ? 'text-danger-500' : 'text-surface-900'
      }`}
      title={cardToString(card)}
    >
      <span>{rankOf(card)}</span>
      <span aria-hidden>{SUIT_GLYPH[suit]}</span>
      <span className="sr-only">{cardToString(card)}</span>
    </span>
  );
}

/** An unfilled card slot. Phase 7's palette is what fills these. */
export function CardSlot({ size = 'md' }: { readonly size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-6' : 'h-14 w-10';
  return (
    <span
      aria-hidden
      className={`inline-block rounded border border-dashed border-surface-500 bg-surface-800 ${box}`}
    />
  );
}
