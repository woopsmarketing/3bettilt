import { describe, expect, it } from 'vitest';
import { comboCountOf, handClassByKey, hasHandClass } from '@gto-self/strategy-core';
import { HAND_STRENGTH, HAND_STRENGTH_BY_RANK, handStrengthOf } from '@gto-self/learn-core';
import {
  clampTopPercent,
  DEFAULT_TOP_PERCENT,
  handClassSetOfSelection,
  MAX_TOP_PERCENT,
  MIN_TOP_PERCENT,
  percentToShare,
  strengthDetailOf,
  tieInfoFor,
  topSelectionForPercent,
} from './viewModel.js';

describe('clampTopPercent', () => {
  it('passes legal integers through unchanged', () => {
    expect(clampTopPercent(1)).toBe(1);
    expect(clampTopPercent(50)).toBe(50);
    expect(clampTopPercent(100)).toBe(100);
  });

  it('clamps out-of-range values to the nearest bound', () => {
    expect(clampTopPercent(0)).toBe(MIN_TOP_PERCENT);
    expect(clampTopPercent(-5)).toBe(MIN_TOP_PERCENT);
    expect(clampTopPercent(101)).toBe(MAX_TOP_PERCENT);
    expect(clampTopPercent(9999)).toBe(MAX_TOP_PERCENT);
  });

  it('rounds a fractional value rather than truncating or rejecting it', () => {
    expect(clampTopPercent(15.6)).toBe(16);
    expect(clampTopPercent(15.4)).toBe(15);
  });

  it('falls back to the default for a non-finite value, never throwing', () => {
    expect(clampTopPercent(Number.NaN)).toBe(DEFAULT_TOP_PERCENT);
    expect(clampTopPercent(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TOP_PERCENT);
  });
});

describe('percentToShare', () => {
  it('divides by 100', () => {
    expect(percentToShare(15)).toBeCloseTo(0.15, 10);
    expect(percentToShare(100)).toBe(1);
    expect(percentToShare(1)).toBeCloseTo(0.01, 10);
  });
});

describe('topSelectionForPercent', () => {
  it('never throws for any slider position, including the extremes', () => {
    for (let percent = MIN_TOP_PERCENT; percent <= MAX_TOP_PERCENT; percent += 1) {
      expect(() => topSelectionForPercent(percent)).not.toThrow();
    }
  });

  it('the minimum slider position still selects at least one class, never an empty set', () => {
    const selection = topSelectionForPercent(MIN_TOP_PERCENT);
    expect(selection.classCount).toBeGreaterThan(0);
    expect(selection.entries[0]?.key).toBe('AA');
  });

  it('the maximum slider position selects all 169 classes', () => {
    const selection = topSelectionForPercent(MAX_TOP_PERCENT);
    expect(selection.classCount).toBe(HAND_STRENGTH.entries.length);
    expect(selection.comboCount).toBe(1326);
    expect(selection.actualShare).toBe(1);
  });

  it('dragging the slider up only ever adds hands (nesting)', () => {
    const smaller = topSelectionForPercent(10);
    const larger = topSelectionForPercent(20);
    const smallerKeys = new Set(smaller.entries.map((entry) => entry.key));
    for (const entry of larger.entries.slice(0, smaller.classCount)) {
      expect(smallerKeys.has(entry.key)).toBe(true);
    }
    expect(larger.classCount).toBeGreaterThanOrEqual(smaller.classCount);
  });

  it('clamps an out-of-range percent before it ever reaches topHandsByShare', () => {
    expect(() => topSelectionForPercent(1000)).not.toThrow();
    expect(topSelectionForPercent(1000)).toEqual(topSelectionForPercent(MAX_TOP_PERCENT));
  });
});

describe('handClassSetOfSelection', () => {
  it('builds a set whose membership matches the selection exactly', () => {
    const selection = topSelectionForPercent(15);
    const set = handClassSetOfSelection(selection);
    const selectedKeys = new Set(selection.entries.map((entry) => entry.key));

    for (const entry of HAND_STRENGTH.entries) {
      const handClass = handClassByKey(entry.key);
      expect(handClass).toBeDefined();
      if (handClass === undefined) continue;
      expect(hasHandClass(set, handClass.index)).toBe(selectedKeys.has(entry.key));
    }
    expect(comboCountOf(set)).toBe(selection.comboCount);
  });

  it('never throws for the whole slider range', () => {
    for (let percent = MIN_TOP_PERCENT; percent <= MAX_TOP_PERCENT; percent += 5) {
      expect(() => handClassSetOfSelection(topSelectionForPercent(percent))).not.toThrow();
    }
  });
});

describe('tieInfoFor', () => {
  it('the strongest class (AA) has no stronger neighbour to tie with', () => {
    const aa = HAND_STRENGTH_BY_RANK[0];
    expect(aa).toBeDefined();
    if (aa === undefined) return;
    const tie = tieInfoFor(aa);
    expect(tie.tiedWithStronger).toBe(false);
  });

  it('the weakest class (32o) has no weaker neighbour to tie with', () => {
    const weakest = HAND_STRENGTH_BY_RANK[HAND_STRENGTH_BY_RANK.length - 1];
    expect(weakest).toBeDefined();
    if (weakest === undefined) return;
    const tie = tieInfoFor(weakest);
    expect(tie.tiedWithWeaker).toBe(false);
  });

  it('reports no ties anywhere in the shipped dataset (HAND_STRENGTH.exactTies is empty)', () => {
    expect(HAND_STRENGTH.exactTies).toEqual([]);
    for (const entry of HAND_STRENGTH.entries) {
      const tie = tieInfoFor(entry);
      expect(tie.tiedWithStronger).toBe(false);
      expect(tie.tiedWithWeaker).toBe(false);
    }
  });
});

describe('strengthDetailOf', () => {
  it('composes handStrengthOf and tieInfoFor for a HandClass', () => {
    const handClass = handClassByKey('AKs');
    expect(handClass).toBeDefined();
    if (handClass === undefined) return;
    const detail = strengthDetailOf(handClass);
    expect(detail.entry).toEqual(handStrengthOf(handClass));
    expect(detail.tie).toEqual({ tiedWithStronger: false, tiedWithWeaker: false });
  });
});
