import { describe, expect, it } from 'vitest';
import { isErr, isOk, unwrap } from '@gto-self/shared';
import {
  CENTI_PER_PERCENT,
  MAX_CENTI_PERCENT,
  centiPercent,
  formatPercent,
  isCentiPercent,
  parsePercent,
  toPercentNumber,
} from './percent.js';

describe('parsePercent', () => {
  it('parses whole, one-decimal and two-decimal percentages exactly', () => {
    expect(unwrap(parsePercent('23'))).toBe(2300);
    expect(unwrap(parsePercent('23.5'))).toBe(2350);
    expect(unwrap(parsePercent('23.55'))).toBe(2355);
    expect(unwrap(parsePercent('0'))).toBe(0);
    expect(unwrap(parsePercent('100'))).toBe(MAX_CENTI_PERCENT);
    expect(unwrap(parsePercent('.5'))).toBe(50);
    expect(unwrap(parsePercent('7.'))).toBe(700);
  });

  it('accepts a trailing percent sign and surrounding whitespace', () => {
    expect(unwrap(parsePercent('  23.5 % '))).toBe(2350);
    expect(unwrap(parsePercent('23.5%'))).toBe(2350);
  });

  it('round-trips every hundredth without loss', () => {
    for (let value = 0; value <= MAX_CENTI_PERCENT; value += 7) {
      const text = formatPercent(centiPercent(value));
      expect(unwrap(parsePercent(text))).toBe(value);
    }
  });

  it('parses the float-hostile values exactly', () => {
    // 0.1 * 100 === 10.000000000000002 in IEEE754; the parser must still land on 10.
    expect(unwrap(parsePercent('0.1'))).toBe(10);
    expect(unwrap(parsePercent('29.29'))).toBe(2929);
    expect(unwrap(parsePercent('8.29'))).toBe(829);
  });

  it('rejects a third decimal place rather than rounding it away', () => {
    const result = parsePercent('23.555');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('INVALID_PERCENT');
      expect(result.error.context.value).toBe('23.555');
    }
  });

  it('rejects empty, non-numeric, signed and out-of-range input', () => {
    for (const input of ['', '   ', 'abc', '-1', '+5', '101', '100.01', '1e2', '2,5']) {
      const result = parsePercent(input);
      expect(isOk(result), `expected "${input}" to be rejected`).toBe(false);
      if (isErr(result)) expect(result.error.code).toBe('INVALID_PERCENT');
    }
  });

  it('names the field it failed on', () => {
    const result = parsePercent('nope', 'stats[1].VPIP');
    expect(isErr(result) && result.error.context.field).toBe('stats[1].VPIP');
  });
});

describe('centiPercent', () => {
  it('throws on a non-integer or out-of-range value', () => {
    expect(() => centiPercent(1.5)).toThrow(/CentiPercent/);
    expect(() => centiPercent(-1)).toThrow(/CentiPercent/);
    expect(() => centiPercent(MAX_CENTI_PERCENT + 1)).toThrow(/CentiPercent/);
  });

  it('guards with isCentiPercent', () => {
    expect(isCentiPercent(0)).toBe(true);
    expect(isCentiPercent(MAX_CENTI_PERCENT)).toBe(true);
    expect(isCentiPercent(MAX_CENTI_PERCENT + 1)).toBe(false);
    expect(isCentiPercent('23')).toBe(false);
  });
});

describe('formatPercent', () => {
  it('trims trailing zeroes by default and honours minDecimals', () => {
    expect(formatPercent(centiPercent(2300))).toBe('23');
    expect(formatPercent(centiPercent(2350))).toBe('23.5');
    expect(formatPercent(centiPercent(2355))).toBe('23.55');
    expect(formatPercent(centiPercent(2300), { minDecimals: 2 })).toBe('23.00');
    // 23.55 shown to one decimal ROUNDS to 23.6; see the rounding tests below.
    expect(formatPercent(centiPercent(2355), { maxDecimals: 1 })).toBe('23.6');
    expect(formatPercent(centiPercent(2350), { unit: true })).toBe('23.5%');
  });

  /**
   * The formatter used to TRUNCATE: `2355` at one decimal read back as `23.5`, and `2399`
   * at zero decimals as `23`. A UI asking for one decimal under-reported every value it
   * showed. Display only — nothing stored changes, and `parsePercent` still refuses to
   * round a third decimal away on input.
   */
  it('ROUNDS to maxDecimals rather than truncating', () => {
    expect(formatPercent(centiPercent(2355), { maxDecimals: 1 })).toBe('23.6');
    expect(formatPercent(centiPercent(2399), { maxDecimals: 0 })).toBe('24');
    expect(formatPercent(centiPercent(2350), { maxDecimals: 0 })).toBe('24');
    expect(formatPercent(centiPercent(2340), { maxDecimals: 0 })).toBe('23');
    expect(formatPercent(centiPercent(2344), { maxDecimals: 1 })).toBe('23.4');
  });

  it("rounds a half away from zero, matching Money's round mode", () => {
    // Exactly .5 in the discarded place goes UP, in both the one- and zero-decimal cases.
    expect(formatPercent(centiPercent(2345), { maxDecimals: 1 })).toBe('23.5');
    expect(formatPercent(centiPercent(2335), { maxDecimals: 1 })).toBe('23.4');
    expect(formatPercent(centiPercent(2250), { maxDecimals: 0 })).toBe('23');
    expect(formatPercent(centiPercent(2350), { maxDecimals: 0 })).toBe('24');
  });

  it('carries a rounded value into the next whole percent, and up to the 100 boundary', () => {
    expect(formatPercent(centiPercent(2396), { maxDecimals: 1 })).toBe('24');
    expect(formatPercent(centiPercent(2396), { maxDecimals: 1, minDecimals: 1 })).toBe('24.0');
    expect(formatPercent(centiPercent(9995), { maxDecimals: 1 })).toBe('100');
    expect(formatPercent(centiPercent(9950), { maxDecimals: 0, unit: true })).toBe('100%');
    expect(formatPercent(centiPercent(MAX_CENTI_PERCENT), { maxDecimals: 0 })).toBe('100');
  });

  it('leaves the boundaries and the full-precision default untouched', () => {
    expect(formatPercent(centiPercent(0), { maxDecimals: 0 })).toBe('0');
    expect(formatPercent(centiPercent(49), { maxDecimals: 0 })).toBe('0');
    expect(formatPercent(centiPercent(50), { maxDecimals: 0 })).toBe('1');
    // The default keeps every stored hundredth, so it never rounds at all.
    for (let value = 0; value <= MAX_CENTI_PERCENT; value += 1) {
      expect(unwrap(parsePercent(formatPercent(centiPercent(value))))).toBe(value);
    }
  });

  it('throws when maxDecimals is below minDecimals', () => {
    expect(() => formatPercent(centiPercent(0), { minDecimals: 2, maxDecimals: 1 })).toThrow();
  });
});

describe('toPercentNumber', () => {
  it('divides by the centipercent unit', () => {
    expect(toPercentNumber(centiPercent(2350))).toBe(23.5);
    expect(CENTI_PER_PERCENT).toBe(100);
  });
});
