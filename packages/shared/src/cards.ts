/**
 * Card primitives. A card is a branded integer 0..51 so decks, dead-card sets
 * and serialized hand events stay compact and comparable.
 *
 *   index = rankIndex * 4 + suitIndex
 *   rankIndex: 0 = '2' ... 12 = 'A'
 *   suitIndex: 0 = 's', 1 = 'h', 2 = 'd', 3 = 'c'
 */
import { err, ok, type Result } from './result.js';

declare const CARD: unique symbol;
export type Card = number & { readonly [CARD]: true };

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['s', 'h', 'd', 'c'] as const;
export type Suit = (typeof SUITS)[number];

/** Ranks high-to-low, the order the 52-card palette renders columns in. */
export const RANKS_DESC = [...RANKS].reverse() as readonly Rank[];

export const CARD_COUNT = 52;

const RANK_INDEX = new Map<string, number>(RANKS.map((r, i) => [r, i]));
const SUIT_INDEX = new Map<string, number>(SUITS.map((s, i) => [s, i]));

export function makeCard(rank: Rank, suit: Suit): Card {
  const r = RANK_INDEX.get(rank);
  const s = SUIT_INDEX.get(suit);
  if (r === undefined || s === undefined) throw new Error(`Bad card ${rank}${suit}`);
  return (r * 4 + s) as Card;
}

export const isCard = (value: unknown): value is Card =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CARD_COUNT;

export function asCard(value: number): Card {
  if (!isCard(value)) throw new Error(`Card index out of range: ${value}`);
  return value;
}

export function rankOf(card: Card): Rank {
  const rank = RANKS[Math.floor(card / 4)];
  if (rank === undefined) throw new Error(`Card index out of range: ${card}`);
  return rank;
}

export function suitOf(card: Card): Suit {
  const suit = SUITS[card % 4];
  if (suit === undefined) throw new Error(`Card index out of range: ${card}`);
  return suit;
}

/** 0 = deuce ... 12 = ace. Useful for hand evaluation and ordering. */
export const rankValue = (card: Card): number => Math.floor(card / 4);

export const cardToString = (card: Card): string => `${rankOf(card)}${suitOf(card)}`;

export const ALL_CARDS: readonly Card[] = Array.from({ length: CARD_COUNT }, (_, i) => i as Card);

/** Parse a single card such as "As", "td", "7C". Rank is case-insensitive. */
export function parseCard(text: string): Result<Card, string> {
  const trimmed = text.trim();
  if (trimmed.length !== 2) return err(`"${text}" is not a 2-character card`);
  const rank = trimmed[0]!.toUpperCase() as Rank;
  const suit = trimmed[1]!.toLowerCase() as Suit;
  if (!RANK_INDEX.has(rank)) return err(`unknown rank "${trimmed[0]}"`);
  if (!SUIT_INDEX.has(suit)) return err(`unknown suit "${trimmed[1]}"`);
  return ok(makeCard(rank, suit));
}

/** Parse "As Kd" / "Ah7c2s" / "As,Kd" into distinct cards. */
export function parseCards(text: string): Result<Card[], string> {
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const flat = tokens.join('');
  if (flat.length % 2 !== 0) return err(`"${text}" does not split into 2-character cards`);
  const cards: Card[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < flat.length; i += 2) {
    const parsed = parseCard(flat.slice(i, i + 2));
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value)) return err(`duplicate card ${cardToString(parsed.value)}`);
    seen.add(parsed.value);
    cards.push(parsed.value);
  }
  return ok(cards);
}

export const cardsToString = (cards: readonly Card[]): string => cards.map(cardToString).join(' ');

/** Descending by rank, then by suit order (s,h,d,c). Returns a new array. */
export const sortCardsDesc = (cards: readonly Card[]): Card[] =>
  [...cards].sort((a, b) => rankValue(b) - rankValue(a) || (a % 4) - (b % 4));

/** True when the same physical card appears more than once. */
export function hasDuplicates(cards: readonly Card[]): boolean {
  return new Set(cards).size !== cards.length;
}
