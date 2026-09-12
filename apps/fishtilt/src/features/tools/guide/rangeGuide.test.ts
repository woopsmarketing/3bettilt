import { describe, expect, it } from 'vitest';
import {
  COMBO_COUNT,
  comboCountOf,
  HAND_CLASS_COUNT,
  handClassByKey,
  handClassesOf,
  hasHandClass,
  RFI_RANGES,
  STRATEGY_POSITIONS,
} from '@gto-self/strategy-core';
import {
  resolveRange,
  RANGE_SPOTS,
  RANGE_STACK_DEPTHS,
  RANGE_TABLE_SIZES,
} from '../../range/index.js';
import { MATRIX_KIND_ROWS, MATRIX_KIND_TOTALS } from './matrixKinds.js';
import {
  COMPARE_A,
  COMPARE_B,
  compareRanges,
  GUIDE_SPOT,
  GUIDE_STACK_DEPTH,
  GUIDE_TABLE_SIZE,
  positionRangeRows,
  shippedRangeFor,
  supportedConditionLabel,
  unsupportedConditions,
  WALKTHROUGH_HAND_KEY,
  walkthrough,
} from './rangeGuide.js';

/*
 * The guide under `/tools/range` states facts about the shipped data in prose ("UTG's list is
 * inside BTN's", "A9o is opened from the button but not first in"). Those sentences are
 * conditional in the component, but a sentence written for the current data can still go
 * stale in a way a conditional cannot catch — so the properties the copy leans on are pinned
 * here against `strategy-core` directly, not against the guide module's own output.
 */
describe('rangeGuide — seat rows', () => {
  it('reads one row per seat, in table order, straight from the facade', () => {
    const rows = positionRangeRows();
    expect(rows.map((row) => row.position)).toEqual([...STRATEGY_POSITIONS]);
    for (const row of rows) {
      const resolution = resolveRange({
        heroPosition: row.position,
        spot: GUIDE_SPOT,
        stackDepth: GUIDE_STACK_DEPTH,
        tableSize: GUIDE_TABLE_SIZE,
      });
      if (resolution.kind === 'RANGE') {
        expect(row.comboCount).toBe(resolution.comboCount);
        expect(row.share).toBe(resolution.percentage);
        expect(row.classCount).toBe(handClassesOf(resolution.range).length);
        expect(row.unsupportedReason).toBeNull();
      } else {
        expect(row.comboCount).toBeNull();
        expect(row.unsupportedReason).toBeTruthy();
      }
    }
  });

  it('grows from the first seat to the button — the claim the prose makes', () => {
    const combos = positionRangeRows()
      .filter((row) => ['UTG', 'HJ', 'CO', 'BTN'].includes(row.position))
      .map((row) => row.comboCount ?? -1);
    for (let i = 1; i < combos.length; i += 1)
      expect(combos[i]).toBeGreaterThan(combos[i - 1] ?? 0);
  });

  it('has exactly one seat without a first-in list, and it is the big blind', () => {
    const missing = positionRangeRows().filter((row) => row.comboCount === null);
    expect(missing.map((row) => row.position)).toEqual(['BB']);
    expect(shippedRangeFor('BB')).toBeNull();
  });
});

describe('rangeGuide — UTG vs BTN', () => {
  const comparison = compareRanges();

  it('compares the two seats the tool opens Compare mode on', () => {
    expect([COMPARE_A, COMPARE_B]).toEqual(['UTG', 'BTN']);
    expect(comparison.a.position).toBe('UTG');
    expect(comparison.b.position).toBe('BTN');
  });

  it('is set arithmetic over the shipped RFI ranges', () => {
    const utg = RFI_RANGES.UTG;
    const btn = RFI_RANGES.BTN;
    expect(utg).not.toBeNull();
    expect(btn).not.toBeNull();
    if (utg === null || btn === null) return;
    expect(comparison.a.combos).toBe(comboCountOf(utg));
    expect(comparison.b.combos).toBe(comboCountOf(btn));
    expect(comparison.sharedCombos + comparison.onlyACombos).toBe(comparison.a.combos);
    expect(comparison.sharedCombos + comparison.onlyBCombos).toBe(comparison.b.combos);
    expect(comparison.a.share).toBeCloseTo(comparison.a.combos / COMBO_COUNT, 12);
  });

  it('the first seat opens strictly fewer combos than the button', () => {
    expect(comparison.a.combos).toBeLessThan(comparison.b.combos);
    expect(comparison.onlyBCombos).toBeGreaterThan(0);
  });

  it('reports subset-ness from the data (the guide branches on it)', () => {
    const utg = RFI_RANGES.UTG;
    const btn = RFI_RANGES.BTN;
    if (utg === null || btn === null) throw new Error('ranges missing');
    // `handClassesOf` yields matrix INDICES, which is what `hasHandClass` takes.
    const everyUtgInBtn = handClassesOf(utg).every((index) => hasHandClass(btn, index));
    expect(comparison.aIsSubsetOfB).toBe(everyUtgInBtn);
    expect(comparison.onlyACombos === 0).toBe(everyUtgInBtn);
  });
});

describe('rangeGuide — walkthrough hand', () => {
  const walk = walkthrough();

  it('is an offsuit class the button opens and the first seat does not', () => {
    const handClass = handClassByKey(WALKTHROUGH_HAND_KEY);
    expect(handClass?.kind).toBe('OFFSUIT');
    const utg = RFI_RANGES.UTG;
    const btn = RFI_RANGES.BTN;
    if (handClass === undefined || utg === null || btn === null) throw new Error('missing');
    expect(hasHandClass(btn, handClass.index)).toBe(true);
    expect(hasHandClass(utg, handClass.index)).toBe(false);
    expect(walk.openedFrom).toContain('BTN');
    expect(walk.openedFrom).not.toContain('UTG');
  });

  it('reports every seat, with the big blind as "no list" rather than "not in list"', () => {
    expect(walk.seats.map((seat) => seat.position)).toEqual([...STRATEGY_POSITIONS]);
    expect(walk.seats.find((seat) => seat.position === 'BB')?.inRange).toBeNull();
  });

  it('counts combos and universe share from the class facts', () => {
    expect(walk.comboCount).toBe(12);
    expect(walk.universeShare).toBeCloseTo(12 / COMBO_COUNT, 12);
  });
});

describe('rangeGuide — conditions', () => {
  it('names the one supported condition in the facade vocabulary', () => {
    expect(supportedConditionLabel()).toContain('6인');
    expect(supportedConditionLabel()).toContain('100BB');
    expect(supportedConditionLabel()).toContain('First In');
  });

  it('lists every filter option the facade refuses, and nothing it accepts', () => {
    const listed = unsupportedConditions();
    const refusedSpots = RANGE_SPOTS.filter((spot) => spot !== GUIDE_SPOT).length;
    const refusedStacks = RANGE_STACK_DEPTHS.filter((depth) => depth !== GUIDE_STACK_DEPTH).length;
    const refusedTables = RANGE_TABLE_SIZES.filter((size) => size !== GUIDE_TABLE_SIZE).length;
    // + the big blind's own reason
    expect(listed.length).toBe(refusedSpots + refusedStacks + refusedTables + 1);
    for (const condition of listed) {
      expect(condition.label).toBeTruthy();
      expect(condition.reason).toBeTruthy();
    }
    expect(listed.map((c) => c.label)).not.toContain(supportedConditionLabel());
  });

  it('never says GTO or names a source', () => {
    const text = [
      supportedConditionLabel(),
      ...unsupportedConditions().flatMap((c) => [c.label, c.reason]),
    ].join(' ');
    expect(text.toUpperCase()).not.toContain('GTO');
    expect(text).not.toContain('교차');
  });
});

describe('matrixKinds', () => {
  it('partitions the 169 classes and 1326 combos into pair / suited / offsuit', () => {
    expect(MATRIX_KIND_ROWS.map((row) => row.kind)).toEqual(['PAIR', 'SUITED', 'OFFSUIT']);
    expect(MATRIX_KIND_TOTALS.classCount).toBe(HAND_CLASS_COUNT);
    expect(MATRIX_KIND_TOTALS.comboTotal).toBe(COMBO_COUNT);
    expect(MATRIX_KIND_ROWS.reduce((sum, row) => sum + row.classCount, 0)).toBe(HAND_CLASS_COUNT);
    expect(MATRIX_KIND_ROWS.reduce((sum, row) => sum + row.comboTotal, 0)).toBe(COMBO_COUNT);
    for (const row of MATRIX_KIND_ROWS) {
      expect(row.comboTotal).toBe(row.classCount * row.combosPerClass);
      expect(handClassByKey(row.example)?.kind).toBe(row.kind);
    }
  });
});
