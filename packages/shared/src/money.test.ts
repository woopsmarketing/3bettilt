import { describe, expect, it } from 'vitest';
import * as M from './money.js';

describe('milliBB conversion', () => {
  it('converts the preset amounts exactly', () => {
    expect(M.fromBB(100)).toBe(100_000);
    expect(M.fromBB(0.5)).toBe(500);
    expect(M.fromBB(0.16)).toBe(160);
    expect(M.fromBB(2.37)).toBe(2370);
    expect(M.fromBB(1)).toBe(M.ONE_BB);
  });

  it('survives float representation error (0.16 * 1000 = 159.999...)', () => {
    expect(M.fromBB(0.07 + 0.09)).toBe(160);
    expect(M.fromBB(0.1 + 0.2)).toBe(300);
  });

  it('rejects non-integer milliBB under exact rounding', () => {
    expect(() => M.fromBB(0.0005, 'exact')).toThrow(/Non-integral/);
  });

  it('round-trips through toBB', () => {
    expect(M.toBB(M.fromBB(93.7))).toBeCloseTo(93.7, 10);
  });

  it('rejects out-of-range and non-integer construction', () => {
    expect(() => M.mbb(1.5)).toThrow();
    expect(() => M.mbb(Number.NaN)).toThrow();
    expect(() => M.mbb(M.MAX_MILLI_BB + 1)).toThrow();
  });
});

describe('arithmetic', () => {
  const bb = (n: number) => M.fromBB(n);

  it('adds, subtracts and sums without drift', () => {
    let acc = M.ZERO;
    for (let i = 0; i < 1000; i++) acc = M.add(acc, bb(0.16));
    expect(acc).toBe(160_000);
    expect(M.sum(Array.from({ length: 1000 }, () => bb(0.16)))).toBe(160_000);
    expect(M.sub(bb(100), bb(2.37))).toBe(97_630);
  });

  it('multiplies by integer counts (ante x 6 players)', () => {
    expect(M.mulInt(bb(0.16), 6)).toBe(960);
    expect(() => M.mulInt(bb(1), 1.5)).toThrow();
  });

  it('applies exact ratios with explicit rounding (5% rake)', () => {
    const pot = bb(13.5); // 13500
    expect(M.mulRatio(pot, 5, 100, 'floor')).toBe(675);
    expect(M.mulRatio(bb(4.13), 5, 100, 'floor')).toBe(206); // 206.5 -> floor
    expect(M.mulRatio(bb(4.13), 5, 100, 'ceil')).toBe(207);
    expect(M.mulRatio(bb(4.13), 5, 100, 'round')).toBe(207);
  });

  it('applies float fractions with explicit rounding (75% pot bet)', () => {
    expect(M.mulFraction(bb(10), 0.75, 'round')).toBe(7500);
    expect(M.mulFraction(bb(10), 0.333, 'floor')).toBe(3330);
    expect(M.mulFraction(bb(7.2), 1 / 3, 'round')).toBe(2400);
  });

  it('rounds half away from zero symmetrically', () => {
    expect(M.mulRatio(M.mbb(5), 1, 2, 'round')).toBe(3);
    expect(M.mulRatio(M.mbb(-5), 1, 2, 'round')).toBe(-3);
  });

  it('splits with an explicit remainder', () => {
    expect(M.splitEvenly(M.mbb(1001), 3)).toEqual({ share: 333, remainder: 2 });
    expect(M.splitEvenly(M.mbb(1000), 2)).toEqual({ share: 500, remainder: 0 });
    expect(() => M.splitEvenly(M.mbb(10), 0)).toThrow();
  });

  it('clamps and compares', () => {
    expect(M.clamp(bb(5), bb(2), bb(4))).toBe(4000);
    expect(M.clamp(bb(1), bb(2), bb(4))).toBe(2000);
    expect(() => M.clamp(bb(1), bb(4), bb(2))).toThrow();
    expect(M.compare(bb(1), bb(2))).toBe(-1);
    expect(M.compare(bb(2), bb(2))).toBe(0);
    expect(M.gte(bb(2), bb(2))).toBe(true);
  });

  it('computes non-money ratios and guards zero denominators', () => {
    expect(M.ratio(bb(7.2), bb(10))).toBeCloseTo(0.72, 12);
    expect(M.ratio(bb(1), M.ZERO)).toBeNull();
  });
});

describe('parseBB', () => {
  it('accepts plain numbers, leading dots and thousands separators', () => {
    expect(M.parseBB('2.37')).toEqual({ ok: true, value: 2370 });
    expect(M.parseBB(' 100 ')).toEqual({ ok: true, value: 100_000 });
    expect(M.parseBB('.5')).toEqual({ ok: true, value: 500 });
    expect(M.parseBB('1,000')).toEqual({ ok: true, value: 1_000_000 });
    expect(M.parseBB('0.160')).toEqual({ ok: true, value: 160 });
  });

  it('rejects junk, over-precision and overflow', () => {
    for (const bad of ['', 'abc', '1.2.3', '1e3', '--1', '5 BB']) {
      expect(M.parseBB(bad).ok).toBe(false);
    }
    expect(M.parseBB('0.1234').ok).toBe(false);
    expect(M.parseBB('999999999').ok).toBe(false);
  });
});

describe('formatBB', () => {
  it('renders compactly by default', () => {
    expect(M.formatBB(M.fromBB(100))).toBe('100');
    expect(M.formatBB(M.fromBB(2.5))).toBe('2.5');
    expect(M.formatBB(M.fromBB(93.7))).toBe('93.7');
    expect(M.formatBB(M.fromBB(0.16), { maxDecimals: 3 })).toBe('0.16');
    expect(M.formatBB(M.mbb(-1500))).toBe('-1.5');
  });

  it('honours min/max decimals and the unit suffix', () => {
    expect(M.formatBB(M.fromBB(100), { minDecimals: 2 })).toBe('100.00');
    expect(M.formatBB(M.fromBB(2.375), { maxDecimals: 2 })).toBe('2.37');
    expect(M.formatBB(M.fromBB(2.375), { maxDecimals: 3 })).toBe('2.375');
    expect(M.formatBB(M.fromBB(6.5), { unit: true })).toBe('6.5 BB');
  });

  it('formats currency for a preset big-blind value', () => {
    expect(M.formatCurrency(M.fromBB(100), 0.5)).toBe('$50.00');
    expect(M.formatCurrency(M.fromBB(2.37), 0.5)).toBe('$1.19');
  });
});
