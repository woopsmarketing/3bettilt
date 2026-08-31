/** The chart-notation parser the anchor lists are transcribed through. */
import { describe, expect, it } from 'vitest';
import { COMBO_COUNT } from '../range/combo.js';
import { totalWeightBps } from '../range/weights.js';
import {
  comboCountOf,
  differenceHandClassSets,
  handClassesOf,
  handClassSet,
  hasHandClass,
  parseHandClasses,
  percentageOf,
  rangeOf,
  unionHandClassSets,
} from './notation.js';
import { handClassByKey } from '../range/handClass.js';

const keys = (notation: string): readonly string[] =>
  parseHandClasses(notation).map((handClass) => handClass.key);

describe('single classes', () => {
  it('parses a pair, a suited class and an offsuit class', () => {
    expect(keys('AA')).toEqual(['AA']);
    expect(keys('AKs')).toEqual(['AKs']);
    expect(keys('72o')).toEqual(['72o']);
  });

  it('accepts either rank order for a non-pair', () => {
    expect(keys('KAs')).toEqual(['AKs']);
  });

  it('ignores whitespace and empty entries', () => {
    expect(keys(' AA , , KK ')).toEqual(['AA', 'KK']);
  });
});

describe('plus runs', () => {
  it('walks pairs up to aces', () => {
    expect(keys('QQ+')).toEqual(['QQ', 'KK', 'AA']);
  });

  it('walks a kicker up to one below the high card', () => {
    expect(keys('AJs+')).toEqual(['AJs', 'AQs', 'AKs']);
    expect(keys('KJo+')).toEqual(['KJo', 'KQo']);
  });

  it('gives the 12 suited aces for A2s+', () => {
    expect(keys('A2s+')).toHaveLength(12);
  });
});

describe('dashed runs', () => {
  it('walks downward between two classes of the same shape', () => {
    expect(keys('A5s-A2s')).toEqual(['A5s', 'A4s', 'A3s', 'A2s']);
    expect(keys('TT-88')).toEqual(['TT', '99', '88']);
  });
});

describe('refusals', () => {
  it('throws on garbage, a mismatched shape and a wrong-way run', () => {
    expect(() => handClassSet('XX')).toThrow();
    expect(() => handClassSet('AKz')).toThrow();
    expect(() => handClassSet('AAs')).toThrow();
    expect(() => handClassSet('AKs-QJs')).toThrow();
    expect(() => handClassSet('A2s-A5s')).toThrow();
  });
});

describe('set algebra and expansion', () => {
  it('counts combos as 6 / 4 / 12 per class', () => {
    expect(comboCountOf(handClassSet('AA'))).toBe(6);
    expect(comboCountOf(handClassSet('AKs'))).toBe(4);
    expect(comboCountOf(handClassSet('AKo'))).toBe(12);
  });

  it('covers the whole universe when every class is present', () => {
    const everything = handClassSet(
      '22+,A2s+,K2s+,Q2s+,J2s+,T2s+,92s+,82s+,72s+,62s+,52s+,42s+,32s,A2o+,K2o+,Q2o+,J2o+,T2o+,92o+,82o+,72o+,62o+,52o+,42o+,32o',
    );
    expect(handClassesOf(everything)).toHaveLength(169);
    expect(comboCountOf(everything)).toBe(COMBO_COUNT);
    expect(percentageOf(everything)).toBe(1);
  });

  it('unions and differences behave like sets', () => {
    const union = unionHandClassSets([handClassSet('AA'), handClassSet('KK')]);
    expect(handClassesOf(union)).toHaveLength(2);
    const minus = differenceHandClassSets(union, handClassSet('KK'));
    expect(handClassesOf(minus)).toHaveLength(1);
    const aces = handClassByKey('AA');
    expect(aces).toBeDefined();
    if (aces !== undefined) expect(hasHandClass(minus, aces.index)).toBe(true);
  });

  it('expands to concrete combos at full weight', () => {
    const range = rangeOf(handClassSet('AA,AKs'));
    // 6 combos of AA + 4 of AKs, each at 10000 bps.
    expect(totalWeightBps(range)).toBe(10 * 10000);
  });

  it('is deterministic', () => {
    expect(handClassesOf(handClassSet('66+,A3s+'))).toEqual(
      handClassesOf(handClassSet('66+,A3s+')),
    );
  });
});
