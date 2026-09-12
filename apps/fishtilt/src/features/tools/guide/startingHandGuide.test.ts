import { describe, expect, it } from 'vitest';
import { HAND_STRENGTH, HAND_STRENGTH_BY_RANK } from '@gto-self/learn-core';
import { handClassByKey } from '@gto-self/strategy-core';
import {
  STRENGTH_DATASET,
  strongestRows,
  suitedVersusOffsuit,
  weakestRows,
} from './startingHandGuide.js';

describe('startingHandGuide', () => {
  it('reads the strongest and weakest rows from HAND_STRENGTH_BY_RANK', () => {
    const top = strongestRows(5);
    const bottom = weakestRows(5);
    expect(top.map((row) => row.entry)).toEqual(HAND_STRENGTH_BY_RANK.slice(0, 5));
    expect(bottom.map((row) => row.entry)).toEqual(HAND_STRENGTH_BY_RANK.slice(-5));
    expect(top[0]?.entry.rank).toBe(1);
    expect(bottom[bottom.length - 1]?.entry.rank).toBe(HAND_STRENGTH_BY_RANK.length);
    for (const row of [...top, ...bottom]) {
      expect(row.handClass).toBe(handClassByKey(row.entry.key));
      expect(row.reading).toMatch(/[가-힣]/u);
    }
  });

  it('the strongest five are all pairs (the prose says so)', () => {
    for (const row of strongestRows(5)) expect(row.handClass.kind).toBe('PAIR');
  });

  it('the weakest five are all offsuit (the prose says so)', () => {
    for (const row of weakestRows(5)) expect(row.handClass.kind).toBe('OFFSUIT');
  });

  it('AKs vs AKo: suited ranks higher, by a gap the dataset states', () => {
    const pair = suitedVersusOffsuit();
    expect(pair.suited.entry.key).toBe('AKs');
    expect(pair.offsuit.entry.key).toBe('AKo');
    expect(pair.suited.entry.rank).toBeLessThan(pair.offsuit.entry.rank);
    expect(pair.equityGap).toBeCloseTo(pair.suited.entry.equity - pair.offsuit.entry.equity, 12);
    expect(pair.equityGap).toBeGreaterThan(0);
    expect(pair.equityGap).toBeLessThan(0.1);
  });

  it('exposes the exact dataset the tool uses', () => {
    expect(STRENGTH_DATASET).toBe(HAND_STRENGTH);
    expect(STRENGTH_DATASET.method).toBe('EXACT');
  });
});
