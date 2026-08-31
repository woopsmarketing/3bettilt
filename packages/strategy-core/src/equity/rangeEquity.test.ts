/**
 * Range-vs-range and the distribution helpers.
 *
 * The load-bearing test here is the EQUIVALENCE one: on a river board (one runout, so both
 * paths are exact) every per-combo equity `rangeVsRangeEquity` reports must equal what
 * `equityVsRange` reports for that same combo. The two take completely different routes —
 * one sorts the villain range once and corrects for card removal by subtraction, the other
 * enumerates the villain range per hero hand — so agreeing on all 1081 combos is a real
 * check of the prefix-sum machinery, not a tautology.
 */
import { parseCards, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { comboCards, comboIndexOf, type ComboIndex } from '../range/combo.js';
import { emptyRange, rangeFromEntries, uniformRange, type RangeWeights } from '../range/weights.js';
import { createEquityCache } from './cache.js';
import { equityVsRange } from './equity.js';
import { equityDistribution, equityQuantile, rangeVsRangeEquity } from './rangeEquity.js';

function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`bad cards "${text}": ${parsed.error}`);
  return parsed.value;
}

function combo(text: string): ComboIndex {
  const [a, b] = cards(text);
  if (a === undefined || b === undefined) throw new Error(`not two cards: ${text}`);
  return comboIndexOf(a, b);
}

function range(entries: readonly (readonly [string, number])[]): RangeWeights {
  const built = rangeFromEntries(entries.map(([text, weight]) => [combo(text), weight] as const));
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe('rangeVsRangeEquity — equivalence with the heads-up engine', () => {
  it('every per-combo equity on a river board matches equityVsRange exactly', () => {
    const board = cards('2c 5d 7s 9h Jc');
    const villain = range([
      ['Kd Kc', 10000],
      ['3d 3c', 6000],
      ['Ad Qd', 4000],
      ['8d 8c', 2500],
      ['Ts 9s', 1000],
    ]);
    const result = rangeVsRangeEquity(uniformRange(), villain, board);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.method).toBe('EXACT');
    expect(result.value.evaluatedRunouts).toBe(1);

    let checked = 0;
    for (const entry of result.value.perCombo) {
      const [low, high] = comboCards(entry.combo);
      const headsUp = equityVsRange([low, high], board, villain);
      if (!headsUp.ok) {
        // The only legitimate refusal is a hero combo that leaves the villain range empty.
        expect(headsUp.error.code).toBe('ZERO_MASS_RANGE');
        continue;
      }
      expect(entry.equity).toBeCloseTo(headsUp.value.equity, 12);
      expect(entry.winProb).toBeCloseTo(headsUp.value.winProb, 12);
      expect(entry.tieProb).toBeCloseTo(headsUp.value.tieProb, 12);
      expect(entry.loseProb).toBeCloseTo(headsUp.value.loseProb, 12);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(1000);
  }, 300_000);

  it('the aggregate is the hero-weighted mean of the per-combo equities', () => {
    const board = cards('Ah Kh 7c 2d 3s');
    const hero = range([
      ['Ad Ac', 10000],
      ['Qh Jh', 5000],
      ['7d 7s', 2500],
      ['5c 4c', 1000],
    ]);
    const villain = range([
      ['Kd Kc', 10000],
      ['Ac Qc', 6000],
      ['9h 8h', 3000],
    ]);
    const result = rangeVsRangeEquity(hero, villain, board);
    if (!result.ok) throw new Error(result.error.message);
    let numerator = 0;
    let denominator = 0;
    for (const entry of result.value.perCombo) {
      numerator += entry.weightBps * entry.equity;
      denominator += entry.weightBps;
    }
    expect(denominator).toBe(result.value.heroWeightBps);
    expect(result.value.equity).toBeCloseTo(numerator / denominator, 12);
  });
});

describe('rangeVsRangeEquity — invariants', () => {
  it('a range against ITSELF on a river is exactly one half', () => {
    // Symmetry: on a single runout every hero combo faces the same live villain weight, and
    // the beat relation is antisymmetric, so the weighted mean must be 0.5. This catches an
    // off-by-one in the card-removal correction immediately, because a mis-subtracted combo
    // breaks the symmetry.
    const board = cards('2c 5d 7s 9h Jc');
    const uniform = uniformRange();
    const result = rangeVsRangeEquity(uniform, uniform, board);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.equity).toBeCloseTo(0.5, 12);
    expect(result.value.winProb).toBeCloseTo(result.value.loseProb, 12);
  });

  it('a lopsided range against itself pools to 0.5, but its MEAN does not — as documented', () => {
    // With unequal weights each hero combo blocks a different slice of villain weight, so
    // the weighted mean of per-combo equities is no longer 0.5. The POOLED ratio still is,
    // exactly, and this test asserts both halves of that statement so the distinction can
    // never be silently lost.
    const board = cards('Qs Jd 4h 4c 2s');
    const skewed = range([
      ['Ad Ac', 10000],
      ['Kd Kc', 8000],
      ['7h 6h', 3000],
      ['9s 8s', 1500],
      ['3d 2d', 500],
    ]);
    const result = rangeVsRangeEquity(skewed, skewed, board);
    if (!result.ok) throw new Error(result.error.message);

    let numerator = 0;
    let denominator = 0;
    for (const entry of result.value.perCombo) {
      numerator += entry.weightBps * entry.equity * entry.villainWeightBps;
      denominator += entry.weightBps * entry.villainWeightBps;
    }
    expect(numerator / denominator).toBeCloseTo(0.5, 12);
    expect(result.value.equity).not.toBeCloseTo(0.5, 3);
  });

  it('the nuts against anything is 1, the worst hand against the nuts is 0', () => {
    const board = cards('Ah Kh Qh 2c 3d');
    const nuts = range([['Jh Th', 10000]]);
    const versusAll = rangeVsRangeEquity(nuts, uniformRange(), board);
    if (!versusAll.ok) throw new Error(versusAll.error.message);
    expect(versusAll.value.equity).toBe(1);

    const versusNuts = rangeVsRangeEquity(uniformRange(), nuts, board);
    if (!versusNuts.ok) throw new Error(versusNuts.error.message);
    expect(versusNuts.value.equity).toBe(0);
  });

  it('bounds a flop and labels it SUBSAMPLED', () => {
    const result = rangeVsRangeEquity(uniformRange(), uniformRange(), cards('2c 5d 7s'));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.method).toBe('SUBSAMPLED');
    expect(result.value.runoutSpaceSize).toBe(1176);
    expect(result.value.evaluatedRunouts).toBeLessThan(1176);
    // Still the symmetric case, so the bounded answer must be near one half.
    expect(Math.abs(result.value.equity - 0.5)).toBeLessThan(0.01);
  }, 120_000);

  it('is deterministic in its bounded mode', () => {
    const run = () => rangeVsRangeEquity(uniformRange(), uniformRange(), cards('2c 5d 7s'));
    const first = run();
    const second = run();
    if (!first.ok || !second.ok) throw new Error('expected both to succeed');
    expect(first.value).toEqual(second.value);
  }, 180_000);

  it('a cache hit returns the identical object', () => {
    const cache = createEquityCache(4);
    const board = cards('2c 5d 7s 9h Jc');
    const first = rangeVsRangeEquity(uniformRange(), uniformRange(), board, { cache });
    const second = rangeVsRangeEquity(uniformRange(), uniformRange(), board, { cache });
    if (!first.ok || !second.ok) throw new Error('expected both to succeed');
    expect(second.value).toBe(first.value);
  });

  it('refuses an empty range on either side', () => {
    const board = cards('2c 5d 7s 9h Jc');
    const heroEmpty = rangeVsRangeEquity(emptyRange(), uniformRange(), board);
    expect(heroEmpty.ok).toBe(false);
    if (heroEmpty.ok) throw new Error('expected a refusal');
    expect(heroEmpty.error.code).toBe('ZERO_MASS_RANGE');

    const villainEmpty = rangeVsRangeEquity(uniformRange(), emptyRange(), board);
    expect(villainEmpty.ok).toBe(false);
    if (villainEmpty.ok) throw new Error('expected a refusal');
    expect(villainEmpty.error.code).toBe('ZERO_MASS_RANGE');
  });

  it('refuses a range made entirely of board cards', () => {
    const board = cards('2c 5d 7s 9h Jc');
    const dead = range([['2c 5d', 10000]]);
    const result = rangeVsRangeEquity(dead, uniformRange(), board);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('ZERO_MASS_RANGE');
  });

  it('refuses a malformed board', () => {
    const result = rangeVsRangeEquity(uniformRange(), uniformRange(), cards('2c 5d'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('INVALID_BOARD');
  });
});

describe('equityDistribution', () => {
  const board = cards('Ah Kh 7c 2d 3s');
  const hero = range([
    ['Ad Ac', 10000],
    ['Qh Jh', 5000],
    ['7d 7s', 5000],
    ['5c 4c', 5000],
  ]);
  const villain = range([
    ['Kd Kc', 10000],
    ['Ac Qc', 6000],
    ['9h 8h', 3000],
  ]);

  it('orders hero combos by equity, descending', () => {
    const dist = equityDistribution(hero, villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    for (let i = 1; i < dist.value.entries.length; i += 1) {
      expect(dist.value.entries[i - 1]?.equity ?? 0).toBeGreaterThanOrEqual(
        dist.value.entries[i]?.equity ?? 0,
      );
    }
    expect(dist.value.entries.length).toBe(dist.value.aggregate.perCombo.length);
    expect(dist.value.cumulativeBps.at(-1)).toBe(dist.value.aggregate.heroWeightBps);
  });

  it('quantiles the range by equity', () => {
    const dist = equityDistribution(hero, villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    // Everything is at or above the worst equity, nothing is above 1.0001.
    const worst = dist.value.entries.at(-1)?.equity ?? 0;
    expect(equityQuantile(dist.value, worst)).toBeCloseTo(1, 12);
    expect(equityQuantile(dist.value, 1.0001)).toBe(0);
  });

  it('carries the aggregate through unchanged rather than recomputing it', () => {
    const direct = rangeVsRangeEquity(hero, villain, board);
    const dist = equityDistribution(hero, villain, board);
    if (!direct.ok || !dist.ok) throw new Error('expected both to succeed');
    expect(dist.value.aggregate.equity).toBe(direct.value.equity);
    expect(dist.value.aggregate.perCombo).toEqual(direct.value.perCombo);
  });
});
