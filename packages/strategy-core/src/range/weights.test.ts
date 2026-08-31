import { parseCards, unwrap, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { asBps, BPS_FULL, BPS_TOTAL } from '../bps.js';
import {
  ALL_COMBOS,
  COMBO_COUNT,
  comboContainsCard,
  parseCombo,
  type ComboIndex,
} from './combo.js';
import { handClassByKey, handClassOfCombo } from './handClass.js';
import {
  activeComboCount,
  aggregateToHandClasses,
  applyActionStrategy,
  comboFrequenciesFrom,
  combosOfHandClass,
  emptyRange,
  enumerateCombos,
  normalizeRange,
  normalizeToFullWeight,
  rangeFrom,
  rangeFromEntries,
  rangePercentage,
  rangesEqual,
  removeConflicts,
  toEntries,
  totalWeightBps,
  uniformFrequencies,
  uniformRange,
  universeAfterRemoval,
  weightAt,
  withWeight,
} from './weights.js';

const combo = (text: string): ComboIndex => unwrap(parseCombo(text));
const cards = (text: string): readonly Card[] => unwrap(parseCards(text));

describe('construction and reading', () => {
  it('an empty range has no weight anywhere', () => {
    const range = emptyRange();
    expect(range.bps).toHaveLength(COMBO_COUNT);
    expect(totalWeightBps(range)).toBe(0);
    expect(activeComboCount(range)).toBe(0);
    expect(rangePercentage(range)).toBe(0);
  });

  it('a uniform full range covers 100% of the universe', () => {
    const range = uniformRange();
    expect(totalWeightBps(range)).toBe(COMBO_COUNT * BPS_TOTAL);
    expect(activeComboCount(range)).toBe(COMBO_COUNT);
    expect(rangePercentage(range)).toBe(1);
  });

  it('a uniform half-weight range covers 50%', () => {
    expect(rangePercentage(uniformRange(asBps(5000)))).toBeCloseTo(0.5, 12);
  });

  it('rangeFromEntries refuses a bad index or weight instead of clamping', () => {
    const badIndex = rangeFromEntries([[1326, 100]]);
    expect(badIndex.ok).toBe(false);
    if (!badIndex.ok) expect(badIndex.error.code).toBe('INVALID_COMBO_INDEX');
    const badWeight = rangeFromEntries([[0, 10001]]);
    expect(badWeight.ok).toBe(false);
    if (!badWeight.ok) expect(badWeight.error.code).toBe('INVALID_BPS');
  });

  it('rangeFromEntries lets the last entry for a combo win', () => {
    const range = unwrap(
      rangeFromEntries([
        [5, 1000],
        [5, 2500],
      ]),
    );
    expect(weightAt(range, 5 as ComboIndex)).toBe(2500);
  });

  it('withWeight does not mutate its input', () => {
    const before = uniformRange(asBps(1000));
    const after = withWeight(before, 7 as ComboIndex, asBps(9999));
    expect(weightAt(before, 7 as ComboIndex)).toBe(1000);
    expect(weightAt(after, 7 as ComboIndex)).toBe(9999);
    expect(rangesEqual(before, after)).toBe(false);
  });

  it('enumerates in ascending combo order and skips zero weights by default', () => {
    const range = unwrap(
      rangeFromEntries([
        [900, 5000],
        [3, 10000],
      ]),
    );
    const seen = [...enumerateCombos(range)];
    expect(seen.map((entry) => entry.combo)).toEqual([3, 900]);
    expect(seen[0]?.weightBps).toBe(10000);
    expect([...enumerateCombos(range, { includeZero: true })]).toHaveLength(COMBO_COUNT);
    expect(toEntries(range)).toEqual([
      [3, 10000],
      [900, 5000],
    ]);
  });
});

describe('card removal', () => {
  it('an ace on the board leaves 3 of the 6 AA combos', () => {
    const aces = combosOfHandClass(handClassByKey('AA')!);
    expect(aces).toHaveLength(6);
    const range = rangeFrom((c) => (aces.includes(c) ? BPS_FULL : 0));
    expect(activeComboCount(range)).toBe(6);

    const afterFlop = removeConflicts(range, cards('Ah7c2d'));
    expect(activeComboCount(afterFlop)).toBe(3);
    for (const c of enumerateCombos(afterFlop)) {
      expect(comboContainsCard(c.combo, cards('Ah')[0]!)).toBe(false);
    }
  });

  it('removing all four aces removes every AA combo', () => {
    const aces = combosOfHandClass(handClassByKey('AA')!);
    const range = rangeFrom((c) => (aces.includes(c) ? BPS_FULL : 0));
    expect(activeComboCount(removeConflicts(range, cards('AsAhAdAc')))).toBe(0);
  });

  it('a 3-card board removes 3*51 - 3 = 150 combos from the full universe', () => {
    const removed = removeConflicts(uniformRange(), cards('Ah7c2d'));
    expect(activeComboCount(removed)).toBe(COMBO_COUNT - 150);
    expect(activeComboCount(removed)).toBe(1176);
    expect(universeAfterRemoval(cards('Ah7c2d'))).toBe(1176);
  });

  it('is a no-op for an empty card list, and never mutates', () => {
    const range = uniformRange(asBps(2500));
    const same = removeConflicts(range, []);
    expect(rangesEqual(range, same)).toBe(true);
    expect(same).not.toBe(range);
  });

  it('rangePercentage can be told the shrunken universe', () => {
    const removed = removeConflicts(uniformRange(), cards('Ah7c2d'));
    expect(rangePercentage(removed, universeAfterRemoval(cards('Ah7c2d')))).toBe(1);
    expect(rangePercentage(removed)).toBeCloseTo(1176 / 1326, 12);
  });
});

describe('applyActionStrategy', () => {
  it('multiplies weight by frequency', () => {
    const prior = uniformRange(asBps(8000));
    const next = applyActionStrategy(prior, uniformFrequencies(asBps(2500)));
    // 8000 * 2500 / 10000 = 2000, exact for every combo.
    expect(weightAt(next, 0 as ComboIndex)).toBe(2000);
    expect(totalWeightBps(next)).toBe(COMBO_COUNT * 2000);
  });

  it('leaves a zero-weight combo at zero whatever the frequency', () => {
    const prior = unwrap(rangeFromEntries([[10, 10000]]));
    const next = applyActionStrategy(prior, uniformFrequencies(BPS_FULL));
    expect(weightAt(next, 9 as ComboIndex)).toBe(0);
    expect(weightAt(next, 10 as ComboIndex)).toBe(10000);
    expect(activeComboCount(next)).toBe(1);
  });

  it('an action never taken empties the range rather than renormalizing it', () => {
    const next = applyActionStrategy(uniformRange(), uniformFrequencies(asBps(0)));
    expect(totalWeightBps(next)).toBe(0);
    expect(activeComboCount(next)).toBe(0);
  });

  it('an all-zero prior stays empty', () => {
    const next = applyActionStrategy(emptyRange(), uniformFrequencies(BPS_FULL));
    expect(totalWeightBps(next)).toBe(0);
  });

  it('distributes the sub-basis-point residue instead of flooring it away', () => {
    const prior = unwrap(
      rangeFromEntries([
        [0, 5000],
        [1, 5000],
        [2, 5000],
      ]),
    );
    const next = applyActionStrategy(
      prior,
      comboFrequenciesFrom((c) => (c < 3 ? 3333 : 0)),
    );
    // 5000 * 3333 = 16665000 -> 1666 with 5000 left over, three times.
    expect(toEntries(next)).toEqual([
      [0, 1667],
      [1, 1666],
      [2, 1666],
    ]);
    expect(totalWeightBps(next)).toBe(4999);
  });

  it('conditioning twice equals conditioning on the product, up to the documented residue', () => {
    const prior = uniformRange();
    const once = applyActionStrategy(prior, uniformFrequencies(asBps(5000)));
    const twice = applyActionStrategy(once, uniformFrequencies(asBps(5000)));
    expect(weightAt(twice, 0 as ComboIndex)).toBe(2500);
  });

  it('is deterministic', () => {
    const prior = rangeFrom((c) => ((c * 7) % 10001 > 10000 ? 0 : (c * 7) % 9973));
    const freq = comboFrequenciesFrom((c) => ((c * 13) % 10001 > 10000 ? 0 : (c * 13) % 9973));
    const a = applyActionStrategy(prior, freq);
    const b = applyActionStrategy(prior, freq);
    expect(rangesEqual(a, b)).toBe(true);
  });
});

describe('normalization', () => {
  it('hits the requested total exactly', () => {
    const range = unwrap(
      rangeFromEntries([
        [0, 1],
        [1, 2],
        [2, 3],
      ]),
    );
    const normalized = unwrap(normalizeRange(range, BPS_TOTAL));
    expect(totalWeightBps(normalized)).toBe(BPS_TOTAL);
    expect(toEntries(normalized)).toEqual([
      [0, 1667],
      [1, 3333],
      [2, 5000],
    ]);
  });

  it('keeps zero-weight combos at zero', () => {
    const range = unwrap(
      rangeFromEntries([
        [4, 1000],
        [9, 1000],
      ]),
    );
    const normalized = unwrap(normalizeRange(range, 10000));
    expect(activeComboCount(normalized)).toBe(2);
    expect(weightAt(normalized, 5 as ComboIndex)).toBe(0);
  });

  it('normalizeToFullWeight brings the average included combo back to 100%', () => {
    const conditioned = applyActionStrategy(uniformRange(), uniformFrequencies(asBps(2500)));
    const normalized = unwrap(normalizeToFullWeight(conditioned));
    expect(totalWeightBps(normalized)).toBe(COMBO_COUNT * BPS_TOTAL);
    expect(weightAt(normalized, 0 as ComboIndex)).toBe(BPS_TOTAL);
  });

  it('refuses an empty range', () => {
    const result = normalizeRange(emptyRange(), 10000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NORMALIZATION_UNDEFINED');
  });

  it('normalizing an empty range to zero is a no-op, not an error', () => {
    const result = normalizeRange(emptyRange(), 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(totalWeightBps(result.value)).toBe(0);
  });

  it('refuses a target that would break the 10000-per-combo ceiling', () => {
    const range = unwrap(
      rangeFromEntries([
        [0, 100],
        [1, 100],
      ]),
    );
    const result = normalizeRange(range, 100_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TOTAL');
  });

  it('is deterministic across repeated calls', () => {
    const range = rangeFrom((c) => (c % 97) * 100);
    const a = unwrap(normalizeRange(range, 500_000));
    const b = unwrap(normalizeRange(range, 500_000));
    expect(rangesEqual(a, b)).toBe(true);
    expect(totalWeightBps(a)).toBe(500_000);
  });
});

describe('169-class aggregation', () => {
  it('a full uniform range fills every cell to 100%', () => {
    const matrix = aggregateToHandClasses(uniformRange());
    expect(matrix.cells).toHaveLength(169);
    expect(matrix.activeCombos).toBe(COMBO_COUNT);
    expect(matrix.totalWeightBps).toBe(COMBO_COUNT * BPS_TOTAL);
    for (const cell of matrix.cells) {
      expect(cell.activeCombos).toBe(cell.totalCombos);
      expect(cell.weightSumBps).toBe(cell.totalCombos * BPS_TOTAL);
      expect(cell.fraction).toBe(1);
    }
  });

  it('reports 13 pairs of 6, 78 suited of 4 and 78 offsuit of 12', () => {
    const matrix = aggregateToHandClasses(uniformRange());
    const byKind = { PAIR: 0, SUITED: 0, OFFSUIT: 0 };
    let combos = 0;
    for (const cell of matrix.cells) {
      byKind[cell.handClass.kind] += 1;
      combos += cell.activeCombos;
    }
    expect(byKind).toEqual({ PAIR: 13, SUITED: 78, OFFSUIT: 78 });
    expect(combos).toBe(1326);
  });

  it('separates combo count from weight sum', () => {
    const aces = combosOfHandClass(handClassByKey('AA')!);
    const oneAceCombo = aces[0]!;
    const range = unwrap(rangeFromEntries([[oneAceCombo, 2000]]));
    const matrix = aggregateToHandClasses(range);
    const cell = matrix.cells.find((entry) => entry.handClass.key === 'AA');
    expect(cell?.activeCombos).toBe(1);
    expect(cell?.totalCombos).toBe(6);
    expect(cell?.weightSumBps).toBe(2000);
    expect(cell?.fraction).toBeCloseTo(2000 / 60000, 12);
  });

  it('card removal shows up as a reduced AA cell', () => {
    const removed = removeConflicts(uniformRange(), cards('Ah7c2d'));
    const matrix = aggregateToHandClasses(removed);
    const aa = matrix.cells.find((entry) => entry.handClass.key === 'AA');
    expect(aa?.activeCombos).toBe(3);
    expect(aa?.weightSumBps).toBe(3 * BPS_TOTAL);
  });

  it('every combo lands in exactly one cell', () => {
    const matrix = aggregateToHandClasses(uniformRange());
    for (const c of ALL_COMBOS) {
      const handClass = handClassOfCombo(c);
      expect(matrix.cells[handClass.index]?.handClass.key).toBe(handClass.key);
    }
  });
});

describe('combosOfHandClass', () => {
  it('returns the declared number of combos for each class', () => {
    for (const key of ['AA', 'AKs', 'AKo', '22', '72o', '72s']) {
      const handClass = handClassByKey(key)!;
      expect(combosOfHandClass(handClass)).toHaveLength(handClass.comboCount);
    }
  });

  it('AKs is exactly the four suited ace-kings', () => {
    const combos = combosOfHandClass(handClassByKey('AKs')!);
    expect(combos).toEqual(
      [combo('AsKs'), combo('AhKh'), combo('AdKd'), combo('AcKc')].sort((a, b) => a - b),
    );
  });
});
