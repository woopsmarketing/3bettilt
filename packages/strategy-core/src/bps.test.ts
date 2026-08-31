import { describe, expect, it } from 'vitest';
import {
  apportion,
  asBps,
  BPS_FULL,
  BPS_TOTAL,
  bpsToFraction,
  clampBps,
  divideByBpsTotal,
  isBps,
  parseBps,
} from './bps.js';

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('bps guards', () => {
  it('accepts integers 0..10000 and nothing else', () => {
    expect(isBps(0)).toBe(true);
    expect(isBps(10000)).toBe(true);
    expect(isBps(10001)).toBe(false);
    expect(isBps(-1)).toBe(false);
    expect(isBps(50.5)).toBe(false);
    expect(isBps('5000')).toBe(false);
  });

  it('asBps throws on an out-of-range value', () => {
    expect(() => asBps(10001)).toThrow(/out of range/);
    expect(asBps(10000)).toBe(BPS_FULL);
  });

  it('parseBps returns a typed error instead of throwing', () => {
    const bad = parseBps(-5);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_BPS');
    expect(parseBps(1234)).toEqual({ ok: true, value: 1234 });
  });

  it('clamps and converts', () => {
    expect(clampBps(-3)).toBe(0);
    expect(clampBps(99999)).toBe(BPS_TOTAL);
    expect(clampBps(2500.4)).toBe(2500);
    expect(clampBps(Number.NaN)).toBe(0);
    expect(bpsToFraction(asBps(2500))).toBeCloseTo(0.25, 12);
  });
});

describe('apportion — largest remainder', () => {
  it('hits the total exactly for a three-way split of 10000', () => {
    const result = apportion([1, 1, 1], BPS_TOTAL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sum(result.value)).toBe(BPS_TOTAL);
    // 3333 each leaves 1 unit; the tie-break hands it to the LOWEST index.
    expect(result.value).toEqual([3334, 3333, 3333]);
  });

  it('is deterministic: the same input always yields the same output', () => {
    const a = apportion([7, 11, 13, 29], 10000);
    const b = apportion([7, 11, 13, 29], 10000);
    expect(a).toEqual(b);
  });

  it('gives the remainder to the larger remainder first, then the lower index', () => {
    // values 1,2,3 -> exact shares 1666.67, 3333.33, 5000. Remainders 4/6, 2/6, 0.
    const result = apportion([1, 2, 3], 10000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([1667, 3333, 5000]);
    expect(sum(result.value)).toBe(10000);
  });

  it('scales a total larger than the inputs exactly', () => {
    const result = apportion([1, 1, 1, 1, 1, 1, 1], 10000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sum(result.value)).toBe(10000);
    // 1428 each = 9996; four units go to the four lowest indexes (all remainders equal).
    expect(result.value).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });

  it('a zero total produces all zeros', () => {
    const result = apportion([5, 5], 0);
    expect(result).toEqual({ ok: true, value: [0, 0] });
  });

  it('refuses an all-zero input with a positive total', () => {
    const result = apportion([0, 0, 0], 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NORMALIZATION_UNDEFINED');
  });

  it('refuses a negative or fractional total', () => {
    expect(apportion([1], -1).ok).toBe(false);
    const fractional = apportion([1], 1.5);
    expect(fractional.ok).toBe(false);
    if (!fractional.ok) expect(fractional.error.code).toBe('INVALID_TOTAL');
  });

  it('refuses a negative input value', () => {
    const result = apportion([1, -2], 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_BPS');
      expect(result.error.context.index).toBe(1);
    }
  });
});

describe('divideByBpsTotal', () => {
  it('is exact when every product divides evenly', () => {
    expect(divideByBpsTotal([10000 * 10000, 5000 * 10000])).toEqual([10000, 5000]);
  });

  it('sums to the floor of the exact total, redistributing the residue', () => {
    // three combos at 5000 bps taking an action at 3333 bps: 5000*3333 = 16665000 each.
    const products = [16_665_000, 16_665_000, 16_665_000];
    const divided = divideByBpsTotal(products);
    expect(sum(divided)).toBe(Math.floor(sum(products) / BPS_TOTAL));
    // 1666 each (remainder 5000 each) plus one redistributed unit at the lowest index.
    expect(divided).toEqual([1667, 1666, 1666]);
  });

  it('never loses more than one basis point in total', () => {
    const products = Array.from({ length: 50 }, (_, i) => (i + 1) * 9_999);
    const divided = divideByBpsTotal(products);
    expect(sum(divided)).toBe(Math.floor(sum(products) / BPS_TOTAL));
  });

  it('handles an all-zero input', () => {
    expect(divideByBpsTotal([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('throws on a negative product (programmer error)', () => {
    expect(() => divideByBpsTotal([-1])).toThrow(/non-negative integer/);
  });
});
