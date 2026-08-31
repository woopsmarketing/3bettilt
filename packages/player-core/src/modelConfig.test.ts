import { describe, expect, it } from 'vitest';
import {
  confidenceWeightBps,
  DEFAULT_PLAYER_MODEL_CONFIG,
  DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
  MAX_CONFIDENCE_WEIGHT_BPS,
  postflopSizeBucket,
  preflopSizeBucket,
  snapshotConfidence,
  snapshotConfidenceState,
  validatePlayerModelConfig,
  validateSnapshotConfidenceConfig,
} from './modelConfig.js';

describe('confidenceWeightBps', () => {
  // Hand-verified against round(10000 * n / (n + 30)):
  //   0/30   = 0            -> 0
  //   5/35   = 0.142857…    -> 1429
  //   22/52  = 0.423076…    -> 4231
  //   30/60  = 0.5          -> 5000  (exactly half at n = K, by construction)
  //   90/120 = 0.75         -> 7500
  //   270/300 = 0.9         -> 9000
  it.each([
    [0, 0],
    [1, 323],
    [5, 1429],
    [22, 4231],
    [30, 5000],
    [90, 7500],
    [270, 9000],
    [2970, 9900],
    [100_000, 9997],
  ])('n=%i -> %i bps', (n, expected) => {
    expect(confidenceWeightBps(n)).toBe(expected);
  });

  it('saturates at full weight only once rounding takes it there', () => {
    // The exact ratio n/(n+K) never reaches 1, but rounding to whole basis points does
    // once n is large enough. Deliberate: the alternative is a value that never equals
    // its own documented maximum.
    expect(confidenceWeightBps(1_000_000)).toBe(MAX_CONFIDENCE_WEIGHT_BPS);
  });

  it('is monotonic in n', () => {
    let previous = -1;
    for (let n = 0; n < 400; n += 1) {
      const value = confidenceWeightBps(n);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('honours a different K', () => {
    // round(10000 * 10 / (10 + 10)) = 5000
    expect(confidenceWeightBps(10, 10)).toBe(5_000);
  });

  it('throws on a negative or fractional sample', () => {
    expect(() => confidenceWeightBps(-1)).toThrow();
    expect(() => confidenceWeightBps(1.5)).toThrow();
    expect(() => confidenceWeightBps(5, 0)).toThrow();
  });
});

describe('snapshotConfidenceState', () => {
  it.each([
    [0, 'UNKNOWN'],
    [4, 'UNKNOWN'],
    [5, 'LEARNING'],
    [29, 'LEARNING'],
    [30, 'KNOWN'],
    [5_000, 'KNOWN'],
  ])('n=%i -> %s', (n, expected) => {
    expect(snapshotConfidenceState(n)).toBe(expected);
  });

  it('carries the sample, the weight, the state and the K it used', () => {
    expect(snapshotConfidence(22)).toEqual({
      opportunities: 22,
      weightBps: 4_231,
      state: 'LEARNING',
      k: 30,
    });
  });
});

describe('validateSnapshotConfidenceConfig', () => {
  it('accepts the documented defaults', () => {
    const result = validateSnapshotConfidenceConfig(DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-positive K', () => {
    const result = validateSnapshotConfidenceConfig({
      k: 0,
      learningThreshold: 5,
      knownThreshold: 30,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CONFIDENCE_CONFIG');
  });

  it('rejects thresholds that are not increasing', () => {
    const result = validateSnapshotConfidenceConfig({
      k: 30,
      learningThreshold: 30,
      knownThreshold: 30,
    });
    expect(result.ok).toBe(false);
  });
});

describe('postflopSizeBucket', () => {
  // pot = 1000 milliBB throughout, so the amount IS the percentage in tenths.
  it.each([
    [0, 'NONE'],
    [100, 'TINY'], // 10%
    [330, 'TINY'], // exactly the inclusive boundary
    [331, 'SMALL'],
    [500, 'SMALL'],
    [501, 'MEDIUM'],
    [750, 'MEDIUM'],
    [751, 'LARGE'],
    [900, 'LARGE'],
    [901, 'POT'],
    [1_100, 'POT'],
    [1_101, 'OVERBET'],
    [3_000, 'OVERBET'],
  ])('amount %i into a 1000 pot -> %s', (amount, expected) => {
    expect(postflopSizeBucket(amount, 1_000)).toBe(expected);
  });

  it('does not divide by zero on an empty pot', () => {
    expect(postflopSizeBucket(500, 0)).toBe('TINY');
  });
});

describe('preflopSizeBucket', () => {
  // bigBlind = 1000 milliBB.
  it.each([
    [1_000, 'LIMP'],
    [500, 'LIMP'],
    [2_000, 'MIN'], // 2.0 BB
    [2_200, 'MIN'], // inclusive boundary
    [2_300, 'SMALL'],
    [2_600, 'SMALL'],
    [3_000, 'STANDARD'],
    [3_200, 'STANDARD'],
    [4_000, 'LARGE'],
    [4_500, 'LARGE'],
    [4_600, 'HUGE'],
    [100_000, 'HUGE'],
  ])('toAmount %i at a 1000 BB -> %s', (toAmount, expected) => {
    expect(preflopSizeBucket(toAmount, 1_000)).toBe(expected);
  });

  it('does not divide by zero on a zero big blind', () => {
    expect(preflopSizeBucket(5_000, 0)).toBe('LIMP');
  });
});

describe('validatePlayerModelConfig', () => {
  it('accepts the defaults', () => {
    expect(validatePlayerModelConfig(DEFAULT_PLAYER_MODEL_CONFIG).ok).toBe(true);
  });

  it('rejects non-increasing postflop boundaries', () => {
    const result = validatePlayerModelConfig({
      ...DEFAULT_PLAYER_MODEL_CONFIG,
      postflopSizes: {
        tinyMaxBps: 5_000,
        smallMaxBps: 3_300,
        mediumMaxBps: 7_500,
        largeMaxBps: 9_000,
        potMaxBps: 11_000,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects non-increasing preflop boundaries', () => {
    const result = validatePlayerModelConfig({
      ...DEFAULT_PLAYER_MODEL_CONFIG,
      preflopSizes: {
        minMaxBbCenti: 400,
        smallMaxBbCenti: 260,
        standardMaxBbCenti: 320,
        largeMaxBbCenti: 450,
      },
    });
    expect(result.ok).toBe(false);
  });
});
