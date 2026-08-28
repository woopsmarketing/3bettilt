import { describe, expect, it } from 'vitest';
import {
  boardCardsForStreet,
  nextStreet,
  streetForBoardSize,
  streetIndex,
  STREETS,
  totalBoardCardsThrough,
} from './street.js';

describe('streets', () => {
  it('orders preflop through river', () => {
    expect(STREETS.map(streetIndex)).toEqual([0, 1, 2, 3]);
  });

  it('advances and terminates after the river', () => {
    expect(nextStreet('PREFLOP')).toBe('FLOP');
    expect(nextStreet('FLOP')).toBe('TURN');
    expect(nextStreet('TURN')).toBe('RIVER');
    expect(nextStreet('RIVER')).toBeNull();
  });

  it('knows the board arity of each street', () => {
    expect(STREETS.map(boardCardsForStreet)).toEqual([0, 3, 1, 1]);
    expect(STREETS.map(totalBoardCardsThrough)).toEqual([0, 3, 4, 5]);
  });

  it('maps a legal board size back to its street and throws on an impossible one', () => {
    expect(streetForBoardSize(0)).toBe('PREFLOP');
    expect(streetForBoardSize(3)).toBe('FLOP');
    expect(streetForBoardSize(4)).toBe('TURN');
    expect(streetForBoardSize(5)).toBe('RIVER');
    expect(() => streetForBoardSize(2)).toThrow();
    expect(() => streetForBoardSize(6)).toThrow();
  });
});
