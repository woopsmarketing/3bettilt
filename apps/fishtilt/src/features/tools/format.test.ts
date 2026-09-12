import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import {
  formatAmountBB,
  formatAmountValue,
  formatMultiplier,
  formatPercent,
  formatSignedPercentagePoints,
  signOfPercentagePoints,
} from './format.js';

describe('formatPercent', () => {
  it('renders a proportion as a percentage with one decimal', () => {
    expect(formatPercent(0.25)).toBe('25.0%');
    expect(formatPercent(0.19148936170212766)).toBe('19.1%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('honours an explicit precision', () => {
    expect(formatPercent(0.541, 2)).toBe('54.10%');
    expect(formatPercent(0.541, 0)).toBe('54%');
  });

  it('refuses to print a non-finite number rather than showing something plausible', () => {
    expect(() => formatPercent(Number.NaN)).toThrow(/non-finite/u);
    expect(() => formatPercent(Number.POSITIVE_INFINITY)).toThrow(/non-finite/u);
  });
});

describe('formatSignedPercentagePoints', () => {
  it('signs an overstatement and an understatement', () => {
    expect(formatSignedPercentagePoints(0.0588)).toBe('+5.9%p');
    expect(formatSignedPercentagePoints(-0.0112)).toBe('-1.1%p');
  });

  it('never prints a signed zero', () => {
    expect(formatSignedPercentagePoints(0)).toBe('0.0%p');
    expect(formatSignedPercentagePoints(-0.00004)).toBe('0.0%p');
    expect(formatSignedPercentagePoints(0.00004)).toBe('0.0%p');
  });
});

describe('signOfPercentagePoints', () => {
  it('agrees with what the formatter actually printed, not with the raw float', () => {
    // A difference too small to survive rounding must read as "the same", so the words
    // beside "0.0%p" cannot claim a direction the digits do not show.
    expect(signOfPercentagePoints(0.00004)).toBe(0);
    expect(signOfPercentagePoints(-0.00004)).toBe(0);
    expect(signOfPercentagePoints(0.0006)).toBe(1);
    expect(signOfPercentagePoints(-0.0006)).toBe(-1);
  });
});

describe('formatMultiplier', () => {
  it('renders a plain ratio, not a percentage', () => {
    expect(formatMultiplier(4)).toBe('4.0');
    expect(formatMultiplier(3)).toBe('3.0');
    expect(formatMultiplier(2.6666666)).toBe('2.7');
  });
});

describe('money formatting', () => {
  it('keeps every milliBB a calculation actually used', () => {
    const oneThirdOfFiveBB = Money.mulRatio(Money.fromBB(5), 1, 3, 'round');
    expect(oneThirdOfFiveBB).toBe(1667);
    expect(formatAmountValue(oneThirdOfFiveBB)).toBe('1.667');
    expect(formatAmountBB(oneThirdOfFiveBB)).toBe('1.667 BB');
  });

  it('does not pad a whole number of BB with decimals', () => {
    expect(formatAmountBB(Money.fromBB(20))).toBe('20 BB');
    expect(formatAmountValue(Money.fromBB(20))).toBe('20');
  });
});
