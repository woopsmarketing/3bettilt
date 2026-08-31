import { ALL_CARDS, unwrap, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import {
  ALL_COMBOS,
  asComboIndex,
  COMBO_COUNT,
  comboCards,
  comboContainsCard,
  comboIndexOf,
  combosContainingCard,
  comboToString,
  isComboIndex,
  parseCombo,
} from './combo.js';

describe('the 1326-combo universe', () => {
  it('has exactly C(52,2) = 1326 members', () => {
    expect(COMBO_COUNT).toBe(1326);
    expect(ALL_COMBOS).toHaveLength(1326);
  });

  it('is a bijection: every unordered card pair maps to a distinct index', () => {
    const seen = new Set<number>();
    let pairs = 0;
    for (let i = 0; i < ALL_CARDS.length; i += 1) {
      for (let j = i + 1; j < ALL_CARDS.length; j += 1) {
        const a = ALL_CARDS[i];
        const b = ALL_CARDS[j];
        if (a === undefined || b === undefined) continue;
        const index = comboIndexOf(a, b);
        expect(isComboIndex(index)).toBe(true);
        expect(seen.has(index)).toBe(false);
        seen.add(index);
        pairs += 1;
      }
    }
    expect(pairs).toBe(1326);
    expect(seen.size).toBe(1326);
  });

  it('round-trips index -> cards -> index for all 1326', () => {
    for (const combo of ALL_COMBOS) {
      const [low, high] = comboCards(combo);
      expect(low).toBeLessThan(high);
      expect(comboIndexOf(low, high)).toBe(combo);
      expect(comboIndexOf(high, low)).toBe(combo);
    }
  });

  it('is order-independent in both directions', () => {
    const as = 51 as Card;
    const kd = 46 as Card;
    expect(comboIndexOf(as, kd)).toBe(comboIndexOf(kd, as));
  });

  it('rejects a combo built from one card twice', () => {
    expect(() => comboIndexOf(0 as Card, 0 as Card)).toThrow(/two distinct cards/);
  });

  it('guards the index range', () => {
    expect(isComboIndex(1326)).toBe(false);
    expect(isComboIndex(-1)).toBe(false);
    expect(isComboIndex(3.5)).toBe(false);
    expect(() => asComboIndex(1326)).toThrow(/out of range/);
  });

  it('prints and parses the same combo', () => {
    const combo = unwrap(parseCombo('AsKd'));
    expect(comboToString(combo)).toBe('AsKd');
    expect(unwrap(parseCombo('KdAs'))).toBe(combo);
    expect(unwrap(parseCombo('As Kd'))).toBe(combo);
  });

  it('refuses text that is not exactly two cards', () => {
    expect(parseCombo('As').ok).toBe(false);
    expect(parseCombo('AsKdQh').ok).toBe(false);
    expect(parseCombo('AsAs').ok).toBe(false);
  });

  it('every card belongs to exactly 51 combos', () => {
    for (const card of ALL_CARDS) {
      const combos = combosContainingCard(card);
      expect(combos).toHaveLength(51);
      expect(new Set(combos).size).toBe(51);
      for (const combo of combos) expect(comboContainsCard(combo, card)).toBe(true);
      // Ascending, so enumeration order is deterministic.
      expect([...combos].sort((a, b) => a - b)).toEqual([...combos]);
    }
  });

  it('each combo appears in exactly two per-card lists (52 * 51 / 2 = 1326)', () => {
    let total = 0;
    for (const card of ALL_CARDS) total += combosContainingCard(card).length;
    expect(total).toBe(1326 * 2);
  });
});
