/**
 * What the card palette is being asked for, derived from `HandView` alone.
 *
 * Three rules govern this module:
 *
 * 1. **React computes no poker fact.** Which cards are needed, how many, and which cards
 *    are dead are all read off the engine's own projection (`prompt` D2). The functions
 *    here only *route* those facts; they never derive a street, a count or a dead card.
 *    The one input that is not a view field is `revealSeat`: which opponent showed is a
 *    user observation, so it is passed in explicitly and never inferred from the view.
 * 2. **No card is built from a raw integer.** `makeCard(rank, suit)` is the only
 *    constructor, and `PALETTE_RANKS` / `PALETTE_SUITS` are `shared`'s own orderings.
 * 3. **Pure and React-free**, so the lifecycle rules in `docs/UX.md` ("Card input") are
 *    testable without a DOM.
 */
import { RANKS_DESC, SUITS, type Rank, type Suit, type Card } from '@gto-self/shared';
import type { HandCommand, HandView, PostflopStreet, SeatIndex } from '@gto-self/poker-core';

/** Ranks across, `A` first — `docs/UX.md`. */
export const PALETTE_RANKS: readonly Rank[] = RANKS_DESC;
/** Suits down: spades, hearts, diamonds, clubs — `shared`'s own order. */
export const PALETTE_SUITS: readonly Suit[] = SUITS;

export const RED_SUITS: readonly Suit[] = ['h', 'd'];

export type CardEntryRequest =
  | {
      readonly kind: 'HERO';
      /** Stable per hand and target. A new hand re-opens a dismissed palette. */
      readonly key: string;
      readonly seat: SeatIndex;
      readonly count: 2;
      readonly label: string;
    }
  | {
      /** An opponent's SHOWN hand at showdown. Asked for only when the user asks. */
      readonly kind: 'REVEAL';
      readonly key: string;
      readonly seat: SeatIndex;
      readonly count: 2;
      readonly label: string;
    }
  | {
      readonly kind: 'BOARD';
      readonly key: string;
      readonly street: PostflopStreet;
      readonly count: 1 | 3;
      readonly label: string;
    };

/**
 * Total. The palette's open/close rule, expressed once.
 *
 * `AWAITING_BOARD` wins outright: while the engine is asking for a street there is
 * nothing else to enter. Otherwise the hero is asked for hole cards for as long as the
 * hand is live and they are unset — which is exactly `docs/UX.md`'s
 * `NEW HAND -> ... -> Hero hole cards -> PREFLOP`, and is why there is no "deal" button.
 *
 * `revealSeat` is the ONE thing the engine cannot answer: which opponent the user says
 * showed a hand. It is an explicit user choice made in `AwardPanel`, held above both that
 * panel and the palette, and passed in here — it is never inferred from the view, and
 * `null` (the usual case) leaves HERO and BOARD entry exactly as they were. A reveal is
 * asked for only at `AWAITING_AWARD`, only for a seat the engine dealt in, and only while
 * that seat's cards are still unknown.
 *
 * Returning `null` is what closes the palette: the second hole card, or the third flop
 * card, changes engine state, which changes this answer.
 */
export function cardEntryRequest(
  view: HandView | null,
  heroSeat: SeatIndex | null,
  revealSeat: SeatIndex | null = null,
): CardEntryRequest | null {
  if (view === null) return null;

  if (view.phase.kind === 'AWAITING_BOARD') {
    const street = view.phase.street;
    return {
      kind: 'BOARD',
      key: `${view.handNumber}:BOARD:${street}`,
      street,
      count: view.phase.cardsNeeded,
      label: `${street.toLowerCase()} cards`,
    };
  }

  if (
    revealSeat !== null &&
    view.phase.kind === 'AWAITING_AWARD' &&
    view.dealtInSeats.includes(revealSeat) &&
    view.seats[revealSeat].holeCards.length < 2
  ) {
    // `position` is read off the view, never worked out here (`prompt` D2).
    const position = view.seats[revealSeat].position;
    const who =
      position === null ? `seat ${revealSeat + 1}` : `${position} (seat ${revealSeat + 1})`;
    return {
      kind: 'REVEAL',
      key: `${view.handNumber}:REVEAL:${revealSeat}`,
      seat: revealSeat,
      count: 2,
      label: `${who} shown cards`,
    };
  }

  if (heroSeat === null) return null;
  // Only while the hand can still use them. At AWAITING_AWARD/COMPLETE the hero's hand is
  // over; a card entered there is a SHOWDOWN REVEAL, which is the branch above and asks
  // only for the seat the user explicitly nominated.
  if (view.phase.kind !== 'AWAITING_ACTION' && view.phase.kind !== 'SETUP') return null;
  if (!view.dealtInSeats.includes(heroSeat)) return null;
  if (view.seats[heroSeat].holeCards.length >= 2) return null;

  return {
    kind: 'HERO',
    key: `${view.handNumber}:HERO:${heroSeat}`,
    seat: heroSeat,
    count: 2,
    label: 'hero hole cards',
  };
}

/**
 * Total. The command a completed selection dispatches.
 *
 * `revealed` is the difference between the two hole-card requests and nothing else: the
 * hero's own entry is private knowledge (`false`), while a REVEAL is a hand the user saw
 * an opponent table at showdown (`true`) — the flag `HOLE_CARDS_SET` carries in
 * `events.ts`.
 */
export function commandForCards(request: CardEntryRequest, cards: readonly Card[]): HandCommand {
  switch (request.kind) {
    case 'HERO':
      return { kind: 'SET_HOLE_CARDS', seat: request.seat, cards, revealed: false };
    case 'REVEAL':
      return { kind: 'SET_HOLE_CARDS', seat: request.seat, cards, revealed: true };
    case 'BOARD':
      return { kind: 'DEAL_BOARD', cards };
  }
}

const RANK_BY_KEY = new Map<string, Rank>(PALETTE_RANKS.map((rank) => [rank.toLowerCase(), rank]));
const SUIT_BY_KEY = new Map<string, Suit>(PALETTE_SUITS.map((suit) => [suit.toLowerCase(), suit]));

/** Total. `null` when the key is not a rank. The rank and suit key sets are disjoint. */
export function rankForKey(key: string): Rank | null {
  return RANK_BY_KEY.get(key.toLowerCase()) ?? null;
}

/** Total. `null` when the key is not a suit. */
export function suitForKey(key: string): Suit | null {
  return SUIT_BY_KEY.get(key.toLowerCase()) ?? null;
}
