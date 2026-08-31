import { unwrap } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { ALL_COMBOS, parseCombo } from './combo.js';
import {
  HAND_CLASS_COUNT,
  HAND_CLASSES,
  handClassByKey,
  handClassOfCombo,
  RANK_GRID_SIZE,
} from './handClass.js';

describe('the 169 hand classes', () => {
  it('is a 13x13 matrix', () => {
    expect(RANK_GRID_SIZE).toBe(13);
    expect(HAND_CLASS_COUNT).toBe(169);
    expect(HAND_CLASSES).toHaveLength(169);
  });

  it('splits 13 pairs / 78 suited / 78 offsuit', () => {
    const kinds = { PAIR: 0, SUITED: 0, OFFSUIT: 0 };
    for (const handClass of HAND_CLASSES) kinds[handClass.kind] += 1;
    expect(kinds).toEqual({ PAIR: 13, SUITED: 78, OFFSUIT: 78 });
  });

  it('declared combo counts add up to the 1326-combo universe', () => {
    const total = HAND_CLASSES.reduce((sum, handClass) => sum + handClass.comboCount, 0);
    expect(total).toBe(1326);
    expect(13 * 6 + 78 * 4 + 78 * 12).toBe(1326);
  });

  it('every key is unique and matches its index', () => {
    const keys = new Set(HAND_CLASSES.map((handClass) => handClass.key));
    expect(keys.size).toBe(169);
    for (const handClass of HAND_CLASSES) {
      expect(handClassByKey(handClass.key)).toBe(handClass);
      expect(handClass.index).toBe(handClass.row * RANK_GRID_SIZE + handClass.col);
    }
  });

  it('places pairs on the diagonal, suited above it, offsuit below it', () => {
    for (const handClass of HAND_CLASSES) {
      if (handClass.kind === 'PAIR') expect(handClass.row).toBe(handClass.col);
      if (handClass.kind === 'SUITED') expect(handClass.row).toBeLessThan(handClass.col);
      if (handClass.kind === 'OFFSUIT') expect(handClass.row).toBeGreaterThan(handClass.col);
    }
  });

  it('classifies concrete combos correctly', () => {
    expect(handClassOfCombo(unwrap(parseCombo('AsAh'))).key).toBe('AA');
    expect(handClassOfCombo(unwrap(parseCombo('AsKs'))).key).toBe('AKs');
    expect(handClassOfCombo(unwrap(parseCombo('KdAd'))).key).toBe('AKs');
    expect(handClassOfCombo(unwrap(parseCombo('AsKd'))).key).toBe('AKo');
    expect(handClassOfCombo(unwrap(parseCombo('2s2h'))).key).toBe('22');
    expect(handClassOfCombo(unwrap(parseCombo('7c2d'))).key).toBe('72o');
    expect(handClassOfCombo(unwrap(parseCombo('7d2d'))).key).toBe('72s');
  });

  it('the real combos of the universe land in the declared counts', () => {
    const counts = new Map<string, number>();
    for (const combo of ALL_COMBOS) {
      const key = handClassOfCombo(combo).key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(169);
    for (const handClass of HAND_CLASSES) {
      expect(counts.get(handClass.key)).toBe(handClass.comboCount);
    }
  });
});
