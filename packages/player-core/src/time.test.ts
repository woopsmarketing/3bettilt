import { describe, expect, it } from 'vitest';
import { isErr, unwrap } from '@gto-self/shared';
import {
  MAX_TIMESTAMP,
  compareTimestamps,
  fromDate,
  isTimestamp,
  timestamp,
  validateTimestamp,
} from './time.js';

describe('timestamp', () => {
  it('accepts an integer millisecond instant within range', () => {
    expect(timestamp(0)).toBe(0);
    expect(timestamp(MAX_TIMESTAMP)).toBe(MAX_TIMESTAMP);
  });

  it('throws on a fractional, negative, out-of-range or non-finite value', () => {
    for (const value of [1.5, -1, MAX_TIMESTAMP + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timestamp(value)).toThrow(/Timestamp/);
    }
  });

  it('guards with isTimestamp', () => {
    expect(isTimestamp(0)).toBe(true);
    expect(isTimestamp(-1)).toBe(false);
    expect(isTimestamp('0')).toBe(false);
  });
});

describe('validateTimestamp', () => {
  it('returns a Result rather than throwing, and names the field', () => {
    expect(unwrap(validateTimestamp(10, 'createdAt'))).toBe(10);
    const result = validateTimestamp(-1, 'createdAt');
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
    expect(isErr(result) && result.error.context.field).toBe('createdAt');
  });
});

describe('boundary helpers', () => {
  it('converts a Date at the application boundary', () => {
    expect(fromDate(new Date(1_700_000_000_000))).toBe(1_700_000_000_000);
  });

  it('orders timestamps', () => {
    expect(compareTimestamps(timestamp(1), timestamp(2))).toBe(-1);
    expect(compareTimestamps(timestamp(2), timestamp(1))).toBe(1);
    expect(compareTimestamps(timestamp(2), timestamp(2))).toBe(0);
  });
});
