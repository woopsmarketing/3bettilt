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

describe('quantize — settlement granularity', () => {
  // NL50: BB = 0.50 currency units, so one cent is 20 milliBB (ADR-0027).
  const CENT = 20;

  it('is the identity at quantum 1 under every mode', () => {
    for (const mode of ['floor', 'ceil', 'round', 'exact'] as const) {
      for (const value of [0, 1, 537, -537, 999_999]) {
        expect(M.quantize(M.mbb(value), 1, mode)).toBe(value);
      }
    }
  });

  it('rounds to the nearest cent under each mode', () => {
    expect(M.quantize(M.mbb(537), CENT, 'floor')).toBe(520);
    expect(M.quantize(M.mbb(537), CENT, 'ceil')).toBe(540);
    expect(M.quantize(M.mbb(537), CENT, 'round')).toBe(540);
    expect(M.quantize(M.mbb(687), CENT, 'floor')).toBe(680);
    expect(M.quantize(M.mbb(687), CENT, 'ceil')).toBe(700);
    expect(M.quantize(M.mbb(687), CENT, 'round')).toBe(680);
    expect(M.quantize(M.mbb(540), CENT, 'exact')).toBe(540);
    expect(() => M.quantize(M.mbb(537), CENT, 'exact')).toThrow(/Non-integral/);
  });

  it('pins the half-way case: ties go AWAY FROM ZERO, symmetrically', () => {
    // 10 is exactly half of the 20 milliBB quantum. `applyRounding('round')` is
    // half-away-from-zero, so 10 -> 20 and -10 -> -20 (not banker's rounding).
    expect(M.quantize(M.mbb(10), CENT, 'round')).toBe(20);
    expect(M.quantize(M.mbb(-10), CENT, 'round')).toBe(-20);
    expect(M.quantize(M.mbb(30), CENT, 'round')).toBe(40);
    expect(M.quantize(M.mbb(-30), CENT, 'round')).toBe(-40);
  });

  it('takes floor/ceil toward -Infinity / +Infinity, not toward zero', () => {
    expect(M.quantize(M.mbb(-30), CENT, 'floor')).toBe(-40);
    expect(M.quantize(M.mbb(-30), CENT, 'ceil')).toBe(-20);
  });

  it('rejects a quantum that is not a positive integer', () => {
    for (const bad of [0, -20, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => M.quantize(M.mbb(100), bad, 'round')).toThrow(/quantum/);
    }
  });
});

describe('mulRatioQuantized — one rounding step, never two', () => {
  const CENT = 20;

  it('is exactly mulRatio at quantum 1', () => {
    for (const mode of ['floor', 'ceil', 'round'] as const) {
      for (const value of [13_500, 4130, 19_999, 6003, 1]) {
        expect(M.mulRatioQuantized(M.mbb(value), 5, 100, 1, mode)).toBe(
          M.mulRatio(M.mbb(value), 5, 100, mode),
        );
      }
    }
  });

  it('rounds ONCE — the naive quantize(mulRatio(x)) is a whole quantum wrong here', () => {
    // 5% of 4190 is exactly 209.5 milliBB. The nearest multiple of 20 is 200
    // (distance 9.5) rather than 220 (distance 10.5).
    const once = M.mulRatioQuantized(M.mbb(4190), 5, 100, CENT, 'round');
    expect(once).toBe(200);

    // Two-step: 209.5 rounds to 210, and 210 / 20 = 10.5 rounds AWAY from zero to 11,
    // giving 220 — one full cent above the correct answer. This assertion is the
    // regression guard: if `mulRatioQuantized` is ever reimplemented as two steps it
    // starts returning `twoStep` and the line above fails.
    const twoStep = M.quantize(M.mulRatio(M.mbb(4190), 5, 100, 'round'), CENT, 'round');
    expect(twoStep).toBe(220);
    expect(once).not.toBe(twoStep);
  });

  it('reproduces both real CoinPoker rake observations (ADR-0027)', () => {
    // Pot 5.37 -> 5% = 537 milliBB -> hand history records 0.27 = 540 milliBB.
    expect(M.mulRatioQuantized(M.mbb(10_740), 5, 100, CENT, 'round')).toBe(540);
    // Pot 6.87 -> 5% = 687 milliBB -> hand history records 0.34 = 680 milliBB.
    expect(M.mulRatioQuantized(M.mbb(13_740), 5, 100, CENT, 'round')).toBe(680);
    // Neither is reproduced by flooring or ceiling at cent granularity.
    expect(M.mulRatioQuantized(M.mbb(10_740), 5, 100, CENT, 'floor')).toBe(520);
    expect(M.mulRatioQuantized(M.mbb(13_740), 5, 100, CENT, 'ceil')).toBe(700);
  });

  it('is symmetric about zero under round', () => {
    expect(M.mulRatioQuantized(M.mbb(-4190), 5, 100, CENT, 'round')).toBe(-200);
    expect(M.mulRatioQuantized(M.mbb(4200), 5, 100, CENT, 'round')).toBe(220); // 210 -> tie -> away
    expect(M.mulRatioQuantized(M.mbb(-4200), 5, 100, CENT, 'round')).toBe(-220);
  });

  it("throws under 'exact' when the product is not a whole number of quanta", () => {
    expect(M.mulRatioQuantized(M.mbb(4000), 5, 100, CENT, 'exact')).toBe(200);
    expect(() => M.mulRatioQuantized(M.mbb(4190), 5, 100, CENT, 'exact')).toThrow(/Non-integral/);
  });

  it('rejects a zero denominator and a bad quantum, and guards the product', () => {
    expect(() => M.mulRatioQuantized(M.mbb(100), 5, 0, CENT, 'round')).toThrow(/denominator/);
    expect(() => M.mulRatioQuantized(M.mbb(100), 5, 100, 0, 'round')).toThrow(/quantum/);
    expect(() => M.mulRatioQuantized(M.mbb(100), 5, 100, 2.5, 'round')).toThrow(/quantum/);
    // The exact product must stay representable, and the RESULT must stay in money range.
    expect(() =>
      M.mulRatioQuantized(M.mbb(M.MAX_MILLI_BB), Number.MAX_SAFE_INTEGER, 1, CENT, 'round'),
    ).toThrow(/not exactly representable/);
    expect(() => M.mulRatioQuantized(M.mbb(M.MAX_MILLI_BB), 3, 1, CENT, 'round')).toThrow(
      /out of range/,
    );
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
