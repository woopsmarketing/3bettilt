/**
 * The combinatorics under the engine. Every expectation here is derived independently of the
 * implementation: binomials from Pascal's triangle written out by hand, colex ranks from a
 * nested-loop enumeration, and the Weyl walk's properties (distinct, sorted, exhaustive when
 * asked for everything) stated as invariants rather than as a golden array.
 */
import { describe, expect, it } from 'vitest';
import { binomial, combinationCount, indexSample, unrankColex, weylIndices } from './sampling.js';

describe('binomial', () => {
  it('matches hand-written values', () => {
    expect(binomial(0, 0)).toBe(1);
    expect(binomial(5, 0)).toBe(1);
    expect(binomial(5, 5)).toBe(1);
    expect(binomial(5, 2)).toBe(10);
    expect(binomial(52, 2)).toBe(1326);
    expect(binomial(47, 2)).toBe(1081);
    expect(binomial(50, 5)).toBe(2118760);
    expect(binomial(48, 5)).toBe(1712304);
    expect(binomial(52, 5)).toBe(2598960);
  });

  it('is zero outside 0..n and one for the empty subset', () => {
    expect(binomial(5, 6)).toBe(0);
    expect(binomial(5, -1)).toBe(0);
    // The river's "no cards to come" is ONE runout, not zero. The whole engine leans on this.
    expect(combinationCount(45, 0)).toBe(1);
  });

  it('refuses an n it has no table for', () => {
    expect(() => binomial(53, 2)).toThrow();
  });
});

describe('unrankColex', () => {
  it('reproduces the nested-loop enumeration for k = 2', () => {
    const n = 12;
    const expected: number[][] = [];
    for (let high = 1; high < n; high += 1) {
      for (let low = 0; low < high; low += 1) expected.push([low, high]);
    }
    expect(expected.length).toBe(binomial(n, 2));
    const out = [0, 0];
    for (let rank = 0; rank < expected.length; rank += 1) {
      unrankColex(rank, n, 2, out);
      expect(out).toEqual(expected[rank]);
    }
  });

  it('agrees with the combo-index formula, which is the same order', () => {
    const out = [0, 0];
    for (let high = 1; high < 52; high += 1) {
      for (let low = 0; low < high; low += 1) {
        const rank = (high * (high - 1)) / 2 + low;
        unrankColex(rank, 52, 2, out);
        expect(out).toEqual([low, high]);
      }
    }
  });

  it('reproduces the nested-loop enumeration for k = 3', () => {
    const n = 10;
    const expected: number[][] = [];
    for (let c = 2; c < n; c += 1) {
      for (let b = 1; b < c; b += 1) {
        for (let a = 0; a < b; a += 1) expected.push([a, b, c]);
      }
    }
    const out = [0, 0, 0];
    for (let rank = 0; rank < expected.length; rank += 1) {
      unrankColex(rank, n, 3, out);
      expect(out).toEqual(expected[rank]);
    }
  });

  it('is a bijection over the five-card runout space', () => {
    const n = 20;
    const total = binomial(n, 5);
    const seen = new Set<string>();
    const out = [0, 0, 0, 0, 0];
    for (let rank = 0; rank < total; rank += 1) {
      unrankColex(rank, n, 5, out);
      for (let i = 1; i < 5; i += 1) expect((out[i] ?? 0) > (out[i - 1] ?? 0)).toBe(true);
      seen.add(out.join(','));
    }
    expect(seen.size).toBe(total);
  });

  it('refuses a rank outside the space', () => {
    expect(() => unrankColex(binomial(10, 3), 10, 3, [0, 0, 0])).toThrow();
    expect(() => unrankColex(-1, 10, 3, [0, 0, 0])).toThrow();
  });
});

describe('weylIndices', () => {
  it('returns distinct, sorted indices inside the space', () => {
    for (const [n, k] of [
      [1081, 64],
      [1081, 256],
      [46, 8],
      [2118760, 1000],
    ] as const) {
      const indices = weylIndices(n, k);
      expect(indices.length).toBe(k);
      expect(new Set(indices).size).toBe(k);
      for (let i = 1; i < indices.length; i += 1) {
        expect((indices[i] ?? 0) > (indices[i - 1] ?? 0)).toBe(true);
      }
      expect(Math.min(...indices)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...indices)).toBeLessThan(n);
    }
  });

  it('returns the whole space when asked for at least all of it', () => {
    expect(weylIndices(5, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(weylIndices(5, 99)).toEqual([0, 1, 2, 3, 4]);
    expect(weylIndices(0, 3)).toEqual([]);
  });

  it('is deterministic — the same request twice is the same array', () => {
    expect(weylIndices(1081, 200)).toEqual(weylIndices(1081, 200));
    expect(weylIndices(2118760, 5000)).toEqual(weylIndices(2118760, 5000));
  });

  it('spreads samples evenly — no decile gets less than half its share', () => {
    const n = 1081;
    const k = 200;
    const indices = weylIndices(n, k);
    const buckets = new Array<number>(10).fill(0);
    for (const index of indices) {
      const bucket = Math.min(9, Math.floor((index / n) * 10));
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    const fair = k / 10;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(fair * 0.5);
      expect(count).toBeLessThan(fair * 1.5);
    }
  });

  it('never picks a stride that shares a period with the four suits', () => {
    // A plain stride of n/k would; a coprime stride cannot. Sample the two-card runout space
    // and check every suit pair pattern is represented.
    const indices = weylIndices(1081, 128);
    const suitPairs = new Set<string>();
    const out = [0, 0];
    for (const index of indices) {
      unrankColex(index, 47, 2, out);
      suitPairs.add(`${(out[0] ?? 0) % 4}-${(out[1] ?? 0) % 4}`);
    }
    expect(suitPairs.size).toBe(16);
  });
});

describe('indexSample', () => {
  it('is exhaustive below the limit and sampled above it', () => {
    expect(indexSample(46, 100)).toEqual(Array.from({ length: 46 }, (_, i) => i));
    expect(indexSample(1081, 64).length).toBe(64);
    expect(indexSample(1081, 1081).length).toBe(1081);
  });
});
