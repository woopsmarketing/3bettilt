/**
 * Deterministic mini visuals for the term template (WP-S3-11, contract AW): which terms
 * get a picture in the header, and which cards it shows.
 *
 * Only terms whose subject IS cards are listed; a betting or position term gets no visual
 * rather than a decorative one. Every entry is checked by `visuals.test.ts` with the same
 * evaluator the Hand Checker tool runs (`evaluateHandRank`) — a "플러시" illustration has to
 * actually be a flush — and every hand key against the 169 real classes, so the picture on
 * the page is the product's own answer, not a card list typed from memory.
 *
 * The board terms share ONE example board so 플랍 → 턴 → 리버 read as the same hand
 * progressing; `flop`/`turn`/`river` show the street they name and the ones before it.
 */
import type { HandCategory } from '@gto-self/strategy-core';

export type GlossaryVisual =
  /** Five explicit cards that make the named category. */
  | { readonly kind: 'made-hand'; readonly cards: string; readonly category: HandCategory }
  /** One of the 169 starting-hand classes, drawn by its representative combo. */
  | { readonly kind: 'hand-class'; readonly hand: string }
  /** A board, by street. */
  | {
      readonly kind: 'board';
      readonly flop: string;
      readonly turn?: string;
      readonly river?: string;
    };

const EXAMPLE_FLOP = 'Kd 7s 2h';
const EXAMPLE_TURN = '9c';
const EXAMPLE_RIVER = '4d';

export const GLOSSARY_VISUALS: Readonly<Record<string, GlossaryVisual>> = {
  // 카드·족보 — the nine categories, weakest to strongest.
  'high-card': { kind: 'made-hand', cards: 'Ah 5c 9d Jc 2s', category: 'HIGH_CARD' },
  'one-pair': { kind: 'made-hand', cards: 'Ah Ac 9d Jc 2s', category: 'PAIR' },
  'two-pair': { kind: 'made-hand', cards: 'Ah Ac 9d 9c 2s', category: 'TWO_PAIR' },
  'three-of-a-kind': { kind: 'made-hand', cards: 'Ah Ac Ad 9c 2s', category: 'TRIPS' },
  straight: { kind: 'made-hand', cards: '5h 6c 7d 8c 9s', category: 'STRAIGHT' },
  flush: { kind: 'made-hand', cards: 'Ah 5h 9h Jh 2h', category: 'FLUSH' },
  'full-house': { kind: 'made-hand', cards: 'Ah Ac Ad 9c 9s', category: 'FULL_HOUSE' },
  'four-of-a-kind': { kind: 'made-hand', cards: 'Ah Ac Ad As 9c', category: 'QUADS' },
  'straight-flush': { kind: 'made-hand', cards: '5h 6h 7h 8h 9h', category: 'STRAIGHT_FLUSH' },
  // 시작 핸드 — the class the entry's own prose uses as its example.
  suited: { kind: 'hand-class', hand: 'AKs' },
  offsuit: { kind: 'hand-class', hand: 'AKo' },
  'pocket-pair': { kind: 'hand-class', hand: 'AA' },
  // 게임 구조 — the streets, one board.
  flop: { kind: 'board', flop: EXAMPLE_FLOP },
  turn: { kind: 'board', flop: EXAMPLE_FLOP, turn: EXAMPLE_TURN },
  river: { kind: 'board', flop: EXAMPLE_FLOP, turn: EXAMPLE_TURN, river: EXAMPLE_RIVER },
  board: { kind: 'board', flop: EXAMPLE_FLOP, turn: EXAMPLE_TURN, river: EXAMPLE_RIVER },
  'community-cards': {
    kind: 'board',
    flop: EXAMPLE_FLOP,
    turn: EXAMPLE_TURN,
    river: EXAMPLE_RIVER,
  },
};

export function visualOf(slug: string): GlossaryVisual | undefined {
  return GLOSSARY_VISUALS[slug];
}
