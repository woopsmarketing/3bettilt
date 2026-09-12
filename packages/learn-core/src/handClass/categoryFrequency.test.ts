/**
 * Pins this package's independent enumeration against `strategy-core`'s own gold-standard
 * expectation table, `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:17-27`.
 * That test enumerates the identical `C(52,5) = 2,598,960` space with the same evaluator and
 * asserts these same nine numbers against ITS run. Two independent derivations agreeing is
 * the evidence CLAUDE.md rule 5 asks for — this file does not import that test, it re-types
 * the published numbers from the cited lines and checks this module's own enumeration against
 * them.
 */
import { describe, expect, it } from 'vitest';
import { HAND_CATEGORIES } from '@gto-self/strategy-core';
import {
  CATEGORY_FREQUENCIES,
  categoryFrequencyOf,
  computeCategoryFrequencies,
  FIVE_CARD_HAND_COUNT,
} from './categoryFrequency.js';

/**
 * Re-typed from `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:17-27`
 * (`EXPECTED_FIVE_CARD_FREQUENCIES`). Not imported — a second, independently-authored copy is
 * what makes the agreement below meaningful.
 */
const STRATEGY_CORE_PUBLISHED_TABLE: Readonly<Record<string, number>> = {
  HIGH_CARD: 1302540,
  PAIR: 1098240,
  TWO_PAIR: 123552,
  TRIPS: 54912,
  STRAIGHT: 10200,
  FLUSH: 5108,
  FULL_HOUSE: 3744,
  QUADS: 624,
  STRAIGHT_FLUSH: 40,
};

describe('categoryFrequency', () => {
  it('agrees with the published table in evaluateExhaustive.test.ts:17-27', () => {
    const observed: Record<string, number> = {};
    for (const entry of CATEGORY_FREQUENCIES) observed[entry.category] = entry.count;
    expect(observed).toEqual(STRATEGY_CORE_PUBLISHED_TABLE);
  });

  it('covers every one of the nine categories exactly once', () => {
    expect(CATEGORY_FREQUENCIES).toHaveLength(HAND_CATEGORIES.length);
    const seen = new Set(CATEGORY_FREQUENCIES.map((e) => e.category));
    expect(seen.size).toBe(HAND_CATEGORIES.length);
  });

  it('sums to exactly C(52,5) = 2,598,960', () => {
    const total = CATEGORY_FREQUENCIES.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(2598960);
    expect(total).toBe(FIVE_CARD_HAND_COUNT);
  });

  it('ranks 1 = STRAIGHT_FLUSH (strongest) through 9 = HIGH_CARD (weakest, most common)', () => {
    expect(CATEGORY_FREQUENCIES[0]?.category).toBe('STRAIGHT_FLUSH');
    expect(CATEGORY_FREQUENCIES[0]?.rank).toBe(1);
    expect(CATEGORY_FREQUENCIES.at(-1)?.category).toBe('HIGH_CARD');
    expect(CATEGORY_FREQUENCIES.at(-1)?.rank).toBe(9);
    // Rank must be a total order over 1..9 with no gaps or repeats.
    const ranks = CATEGORY_FREQUENCIES.map((e) => e.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('probability is count / total for every category', () => {
    for (const entry of CATEGORY_FREQUENCIES) {
      expect(entry.probability).toBeCloseTo(entry.count / FIVE_CARD_HAND_COUNT, 15);
    }
  });

  it('categoryFrequencyOf looks up the same frozen entry objects', () => {
    for (const entry of CATEGORY_FREQUENCIES) {
      expect(categoryFrequencyOf(entry.category)).toBe(entry);
    }
  });

  it('recomputing from scratch reproduces the frozen array (determinism, no RNG)', () => {
    const recomputed = computeCategoryFrequencies();
    expect(recomputed).toEqual(CATEGORY_FREQUENCIES);
  }, 20_000);
});
