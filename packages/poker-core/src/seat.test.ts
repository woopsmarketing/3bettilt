import { describe, expect, it } from 'vitest';
import {
  asSeatIndex,
  isSeatIndex,
  makeBySeat,
  nextSeat,
  orderClockwise,
  rotateToSeat,
  seatsClockwiseFrom,
  setBySeat,
  updateBySeat,
  SEAT_INDEXES,
  type SeatIndex,
} from './seat.js';

describe('seat indexes', () => {
  it('accepts 0..5 and rejects everything else', () => {
    for (const seat of SEAT_INDEXES) expect(isSeatIndex(seat)).toBe(true);
    expect(isSeatIndex(-1)).toBe(false);
    expect(isSeatIndex(6)).toBe(false);
    expect(isSeatIndex(1.5)).toBe(false);
    expect(() => asSeatIndex(6)).toThrow(/out of range/);
  });
});

describe('BySeat containers', () => {
  it('builds all six entries', () => {
    const container = makeBySeat((seat) => seat * 2);
    expect(container).toEqual({ 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 });
  });

  it('returns the same reference when the value is unchanged', () => {
    const container = makeBySeat(() => 'x');
    expect(setBySeat(container, 3, 'x')).toBe(container);
    expect(setBySeat(container, 3, 'y')).not.toBe(container);
  });

  it('does not mutate the source on update', () => {
    const container = makeBySeat(() => 1);
    const updated = updateBySeat(container, 2, (v) => v + 1);
    expect(container[2]).toBe(1);
    expect(updated[2]).toBe(2);
  });
});

describe('the clockwise ring', () => {
  it('wraps 5 -> 0', () => {
    expect(nextSeat(5)).toBe(0);
    expect(nextSeat(0)).toBe(1);
  });

  it('lists all six seats whether or not the start is included first', () => {
    expect(seatsClockwiseFrom(4, true)).toEqual([4, 5, 0, 1, 2, 3]);
    expect(seatsClockwiseFrom(4, false)).toEqual([5, 0, 1, 2, 3, 4]);
  });

  it('orders a subset clockwise, keeping `from` last when excluded', () => {
    const winners: readonly SeatIndex[] = [0, 3, 5];
    expect(orderClockwise(winners, 3, true)).toEqual([3, 5, 0]);
    // `from` is not dropped — it moves to the end, which is what odd-chip order needs.
    expect(orderClockwise(winners, 3, false)).toEqual([5, 0, 3]);
    expect(orderClockwise(winners, 1, false)).toEqual([3, 5, 0]);
  });

  it('rotates a ring-ordered subset to a target', () => {
    expect(rotateToSeat([1, 3, 4], 3)).toEqual([3, 4, 1]);
    expect(rotateToSeat([1, 3, 4], 1)).toEqual([1, 3, 4]);
    expect(() => rotateToSeat([1, 3, 4], 2)).toThrow(/not in/);
  });
});
