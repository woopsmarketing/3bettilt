/** Street ordering and board-card arity. Standalone so nothing imports a cycle for it. */
import { invariant } from '@gto-self/shared';

export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
export type PostflopStreet = Exclude<Street, 'PREFLOP'>;

export const STREETS: readonly ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] = [
  'PREFLOP',
  'FLOP',
  'TURN',
  'RIVER',
];

/** Total. PREFLOP 0, FLOP 1, TURN 2, RIVER 3. */
export function streetIndex(street: Street): number {
  switch (street) {
    case 'PREFLOP':
      return 0;
    case 'FLOP':
      return 1;
    case 'TURN':
      return 2;
    case 'RIVER':
      return 3;
  }
}

/** Total. The street that follows `street`, or null after the river. */
export function nextStreet(street: Street): PostflopStreet | null {
  switch (street) {
    case 'PREFLOP':
      return 'FLOP';
    case 'FLOP':
      return 'TURN';
    case 'TURN':
      return 'RIVER';
    case 'RIVER':
      return null;
  }
}

/** Total. Board cards this street itself deals: 0 / 3 / 1 / 1. */
export function boardCardsForStreet(street: Street): number {
  switch (street) {
    case 'PREFLOP':
      return 0;
    case 'FLOP':
      return 3;
    case 'TURN':
    case 'RIVER':
      return 1;
  }
}

/** Total. Board size once `street` has been dealt: 0 / 3 / 4 / 5. */
export function totalBoardCardsThrough(street: Street): number {
  switch (street) {
    case 'PREFLOP':
      return 0;
    case 'FLOP':
      return 3;
    case 'TURN':
      return 4;
    case 'RIVER':
      return 5;
  }
}

/** Throws on 1, 2 or > 5 — `board.length` is invariantly one of 0, 3, 4, 5. */
export function streetForBoardSize(size: number): Street {
  switch (size) {
    case 0:
      return 'PREFLOP';
    case 3:
      return 'FLOP';
    case 4:
      return 'TURN';
    case 5:
      return 'RIVER';
    default:
      invariant(false, `board size ${size} does not correspond to a street`);
  }
}
