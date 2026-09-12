import { describe, expect, it } from 'vitest';
import { createSeededRng, shuffleWithSeed } from './rng.js';

describe('createSeededRng', () => {
  it('is reproducible: the same seed produces the same sequence', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const sequenceA = Array.from({ length: 10 }, () => a());
    const sequenceB = Array.from({ length: 10 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('every draw is in [0, 1)', () => {
    const next = createSeededRng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a()).not.toBe(b());
  });
});

describe('shuffleWithSeed', () => {
  const ITEMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

  it('is reproducible: the same (items, seed) always produces the same order', () => {
    const first = shuffleWithSeed(ITEMS, 123);
    const second = shuffleWithSeed(ITEMS, 123);
    expect(second).toEqual(first);
  });

  it('does not mutate its input', () => {
    const copy = [...ITEMS];
    shuffleWithSeed(ITEMS, 5);
    expect(ITEMS).toEqual(copy);
  });

  it('is a permutation — same elements, same length, none dropped or duplicated', () => {
    const shuffled = shuffleWithSeed(ITEMS, 999);
    expect(shuffled).toHaveLength(ITEMS.length);
    expect([...shuffled].sort()).toEqual([...ITEMS].sort());
  });

  it('a different seed produces a different order (for a non-trivial input)', () => {
    const first = shuffleWithSeed(ITEMS, 1);
    const second = shuffleWithSeed(ITEMS, 2);
    expect(second).not.toEqual(first);
  });

  it('an empty array shuffles to an empty array', () => {
    expect(shuffleWithSeed([], 1)).toEqual([]);
  });

  it('a single-element array is unaffected', () => {
    expect(shuffleWithSeed(['only'], 1)).toEqual(['only']);
  });
});
