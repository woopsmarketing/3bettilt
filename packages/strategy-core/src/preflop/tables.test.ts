/**
 * The constants themselves, checked against the anchor doc's published bands.
 *
 * These are the tests that fail if a table drifts away from its source: every RFI list's
 * share of the 1326-combo universe must stay inside the percentage band section 3 of
 * `docs/reports/STRATEGY_ANCHORS.md` records for that seat.
 */
import { describe, expect, it } from 'vitest';
import { handClassAt, handClassByKey, type HandClassIndex } from '../range/handClass.js';
import {
  handClassesOf,
  handClassSet,
  hasHandClass,
  percentageOf,
  type HandClassSet,
} from './notation.js';
import { PREFLOP_RULES, preflopRule } from './rules.js';
import {
  COLD_FOUR_BET_MIXED,
  COLD_FOUR_BET_VALUE,
  DEFEND_MEDIUM,
  DEFEND_PREMIUM,
  DEFEND_TIGHT,
  DEFEND_VERY_WIDE,
  DEFEND_WIDE,
  FIVE_BET_CALL,
  FIVE_BET_VALUE,
  FOUR_BET_BLUFF,
  FOUR_BET_CALL,
  FOUR_BET_VALUE,
  RFI_HEADS_UP_BUTTON,
  RFI_NOTATION,
  RFI_PERCENT_BANDS,
  RFI_RANGES,
  RFI_SB_COMPOSITE_NOTATION,
  SB_RAISE_ONLY_BAND,
  SIZING,
  SQUEEZE_BLUFF,
  SQUEEZE_CALL,
  SQUEEZE_VALUE,
  THREE_BET_BLUFF,
  THREE_BET_MIXED,
  THREE_BET_VALUE,
} from './tables.js';

const classIndex = (key: string): HandClassIndex => {
  const found = handClassByKey(key);
  if (found === undefined) throw new Error(`no class ${key}`);
  return found.index;
};

const disjoint = (a: HandClassSet, b: HandClassSet): boolean =>
  handClassesOf(a).every((index) => !hasHandClass(b, index));

describe('RFI tables trace to the anchor bands', () => {
  const positions = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const;

  it.each(positions)('%s sits inside its published percentage band', (position) => {
    const table = RFI_RANGES[position];
    expect(table).not.toBeNull();
    if (table === null) return;
    const band = RFI_PERCENT_BANDS[position];
    const pct = percentageOf(table);
    expect(pct).toBeGreaterThanOrEqual(band.min);
    expect(pct).toBeLessThanOrEqual(band.max);
  });

  it('widens monotonically from UTG to BTN (anchor 1, S11 mechanism)', () => {
    const pct = (position: 'UTG' | 'HJ' | 'CO' | 'BTN'): number => {
      const table = RFI_RANGES[position];
      if (table === null) throw new Error('missing table');
      return percentageOf(table);
    };
    expect(pct('UTG')).toBeLessThan(pct('HJ'));
    expect(pct('HJ')).toBeLessThan(pct('CO'));
    expect(pct('CO')).toBeLessThan(pct('BTN'));
  });

  it('has no first-in range for the big blind', () => {
    expect(RFI_RANGES.BB).toBeNull();
  });

  /**
   * REPLACES an assertion that PINNED R1 MAJOR M1. The old test asserted
   * `K4o` IN and `Q5o` OUT, which is exactly the defect: the run-at-a-time trim deleted
   * `Q5o+` as a unit — QJo and QTo with it — while keeping K4o. The old expectations are not
   * weakened here, they are inverted, because they described the bug.
   */
  it('trims the SB composite into the raise-only band, one CLASS at a time', () => {
    const sb = RFI_RANGES.SB;
    expect(sb).not.toBeNull();
    if (sb === null) return;
    const pct = percentageOf(sb);
    expect(pct).toBeGreaterThanOrEqual(SB_RAISE_ONLY_BAND.minPct);
    expect(pct).toBeLessThanOrEqual(SB_RAISE_ONLY_BAND.maxPct);
    // Suited and paired parts are untouched by an offsuit-only trim.
    expect(hasHandClass(sb, classIndex('43s'))).toBe(true);
    expect(hasHandClass(sb, classIndex('22'))).toBe(true);
  });

  it('keeps the broadway offsuit hands and drops the weakest kickers (M1)', () => {
    const sb = RFI_RANGES.SB;
    if (sb === null) throw new Error('missing table');
    // A range that folds QJo while opening K4o is not a sane SB range at any width.
    for (const key of ['QJo', 'QTo', 'JTo', 'T9o', '98o', 'K7o', 'A7o']) {
      expect([key, hasHandClass(sb, classIndex(key))]).toEqual([key, true]);
    }
    for (const key of ['A2o', 'A3o', 'K4o', 'K5o', 'Q5o', 'Q6o', '86o']) {
      expect([key, hasHandClass(sb, classIndex(key))]).toEqual([key, false]);
    }
    // Q4o was never in S1's composite (`Q5o+`), so the trim cannot have kept it.
    expect(hasHandClass(sb, classIndex('Q4o'))).toBe(false);
  });

  it('drops a prefix of the documented weakest-first order, so no kept class is dominated', () => {
    const sb = RFI_RANGES.SB;
    if (sb === null) throw new Error('missing table');
    // The order is: ascending kicker rank, ties broken by ascending high card. `row`/`col`
    // are descending-rank indices, so LARGER means WEAKER on both axes.
    const strength = (key: string): readonly [number, number] => {
      const handClass = handClassByKey(key);
      if (handClass === undefined) throw new Error(`no class ${key}`);
      return [
        Math.max(handClass.row, handClass.col),
        Math.min(handClass.row, handClass.col),
      ] as const;
    };
    const offsuit = handClassesOf(handClassSet(RFI_SB_COMPOSITE_NOTATION))
      .map((index) => handClassAt(index))
      .filter((handClass) => handClass.kind === 'OFFSUIT');
    const kept = offsuit.filter((c) => hasHandClass(sb, c.index)).map((c) => strength(c.key));
    const dropped = offsuit.filter((c) => !hasHandClass(sb, c.index)).map((c) => strength(c.key));
    expect(kept.length).toBeGreaterThan(0);
    expect(dropped.length).toBeGreaterThan(0);
    // Every dropped class is strictly weaker under the documented order than every kept one.
    for (const [dropKicker, dropHigh] of dropped) {
      for (const [keepKicker, keepHigh] of kept) {
        const dropIsWeaker =
          dropKicker > keepKicker || (dropKicker === keepKicker && dropHigh > keepHigh);
        expect(dropIsWeaker).toBe(true);
      }
    }
  });

  it('keeps the SB list strictly tighter than the composite it came from', () => {
    const sb = RFI_RANGES.SB;
    if (sb === null) throw new Error('missing table');
    expect(percentageOf(sb)).toBeLessThan(0.623);
  });
});

describe('the heads-up button table (M6)', () => {
  it('is strictly wider than BOTH 6-max tables it is built from', () => {
    const btn = RFI_RANGES.BTN;
    const sb = RFI_RANGES.SB;
    if (btn === null || sb === null) throw new Error('missing table');
    // The defect was reusing a 6-max seat's list for a seat with nobody behind it.
    expect(percentageOf(RFI_HEADS_UP_BUTTON)).toBeGreaterThan(percentageOf(btn));
    expect(percentageOf(RFI_HEADS_UP_BUTTON)).toBeGreaterThan(percentageOf(sb));
  });

  it('is exactly the union of the BTN and SB raise-only lists — nothing is authored', () => {
    const btn = RFI_RANGES.BTN;
    const sb = RFI_RANGES.SB;
    if (btn === null || sb === null) throw new Error('missing table');
    const union = new Set([...handClassesOf(btn), ...handClassesOf(sb)]);
    expect(new Set(handClassesOf(RFI_HEADS_UP_BUTTON))).toEqual(union);
    // Every member traces back to one of the two sourced lists; none is new.
    for (const index of handClassesOf(RFI_HEADS_UP_BUTTON)) {
      expect(hasHandClass(btn, index) || hasHandClass(sb, index)).toBe(true);
    }
  });

  it('opens every hand the 6-max BTN list opens', () => {
    const btn = RFI_RANGES.BTN;
    if (btn === null) throw new Error('missing table');
    for (const index of handClassesOf(handClassSet(RFI_NOTATION.BTN))) {
      expect(hasHandClass(RFI_HEADS_UP_BUTTON, index)).toBe(true);
    }
  });
});

describe('continue tiers are ordered', () => {
  it('widens premium -> tight -> medium -> wide -> very wide', () => {
    const widths = [DEFEND_PREMIUM, DEFEND_TIGHT, DEFEND_MEDIUM, DEFEND_WIDE, DEFEND_VERY_WIDE].map(
      percentageOf,
    );
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1] ?? 0);
    }
  });

  it('contains the 3-bet value core in every tier, so a premium hand is never folded', () => {
    for (const index of handClassesOf(THREE_BET_VALUE)) {
      expect(hasHandClass(DEFEND_TIGHT, index)).toBe(true);
      expect(hasHandClass(DEFEND_MEDIUM, index)).toBe(true);
      expect(hasHandClass(DEFEND_WIDE, index)).toBe(true);
      expect(hasHandClass(DEFEND_VERY_WIDE, index)).toBe(true);
    }
  });
});

describe('aggression subsets are disjoint where precedence assumes it', () => {
  it('separates the 3-bet value, mixed and bluff cores', () => {
    expect(disjoint(THREE_BET_VALUE, THREE_BET_MIXED)).toBe(true);
    expect(disjoint(THREE_BET_VALUE, THREE_BET_BLUFF)).toBe(true);
    expect(disjoint(THREE_BET_MIXED, THREE_BET_BLUFF)).toBe(true);
  });

  it('separates the 4-bet, cold-4-bet and 5-bet cores', () => {
    expect(disjoint(FOUR_BET_VALUE, FOUR_BET_BLUFF)).toBe(true);
    expect(disjoint(FOUR_BET_VALUE, FOUR_BET_CALL)).toBe(true);
    expect(disjoint(COLD_FOUR_BET_VALUE, COLD_FOUR_BET_MIXED)).toBe(true);
    expect(disjoint(FIVE_BET_VALUE, FIVE_BET_CALL)).toBe(true);
  });

  it('separates the squeeze cores', () => {
    expect(disjoint(SQUEEZE_VALUE, SQUEEZE_BLUFF)).toBe(true);
    expect(disjoint(SQUEEZE_VALUE, SQUEEZE_CALL)).toBe(true);
    expect(disjoint(SQUEEZE_BLUFF, SQUEEZE_CALL)).toBe(true);
  });
});

describe('sizing ratios match the anchor figures', () => {
  it('encodes 2.5bb / 3bb opens', () => {
    expect(SIZING.RFI_STANDARD_BB).toEqual({ numerator: 5, denominator: 2 });
    expect(SIZING.RFI_SB_BB).toEqual({ numerator: 3, denominator: 1 });
  });

  it('encodes the chosen 3-bet figures and keeps the rejected alternative visible', () => {
    expect(SIZING.THREE_BET_IP).toEqual({ numerator: 3, denominator: 1 });
    expect(SIZING.THREE_BET_IP_ALTERNATIVE).toEqual({ numerator: 7, denominator: 2 });
    expect(SIZING.THREE_BET_OOP).toEqual({ numerator: 4, denominator: 1 });
  });

  it('encodes 2.3x / 2.5x four-bets and the position-aware squeeze', () => {
    expect(SIZING.FOUR_BET_IP).toEqual({ numerator: 23, denominator: 10 });
    expect(SIZING.FOUR_BET_OOP).toEqual({ numerator: 5, denominator: 2 });
    expect(SIZING.SQUEEZE_IP).toEqual({ numerator: 4, denominator: 1 });
    expect(SIZING.SQUEEZE_OOP).toEqual({ numerator: 5, denominator: 1 });
    expect(SIZING.SQUEEZE_FLAT_ALTERNATIVE).toEqual({ numerator: 3, denominator: 1 });
  });
});

describe('the rule registry', () => {
  it('has a unique id, an anchor and a rationale for every rule', () => {
    const ids = new Set(PREFLOP_RULES.map((rule) => rule.id));
    expect(ids.size).toBe(PREFLOP_RULES.length);
    for (const rule of PREFLOP_RULES) {
      expect(rule.anchor.length).toBeGreaterThan(0);
      expect(rule.rationale.length).toBeGreaterThan(0);
      expect(preflopRule(rule.id)).toBe(rule);
    }
  });

  it('never names the reference engine GTO', () => {
    for (const rule of PREFLOP_RULES) {
      const text = `${rule.id} ${rule.anchor} ${rule.rationale} ${rule.inputs.join(' ')}`;
      expect(text).not.toMatch(/\bGTO\b/);
    }
  });

  it('classifies the anchor verdicts the anchor doc is binding on', () => {
    expect(preflopRule('SIZE_RFI').provenance).toBe('SOURCE');
    expect(preflopRule('SIZE_THREE_BET_OOP').provenance).toBe('SOURCE');
    expect(preflopRule('SIZE_FOUR_BET_IP').provenance).toBe('SOURCE');
    expect(preflopRule('SIZE_THREE_BET_IP').provenance).toBe('DERIVED');
    expect(preflopRule('SIZE_SQUEEZE').provenance).toBe('DERIVED');
    expect(preflopRule('RFI_TABLE').provenance).toBe('DERIVED');
    expect(preflopRule('VS_OPEN_MIX').provenance).toBe('HEURISTIC');
    expect(preflopRule('UNSUPPORTED_SPOT_FALLBACK').provenance).toBe('HEURISTIC');
    // Nothing added for R1 may claim more than HEURISTIC: no public source covers a
    // heads-up chart, a raise over a preflop shove, or the range that clears it.
    expect(preflopRule('RFI_HEADS_UP_BUTTON').provenance).toBe('HEURISTIC');
    expect(preflopRule('FACING_ALLIN_IN_TREE').provenance).toBe('HEURISTIC');
    expect(preflopRule('SIZE_FACING_ALLIN_JAM').provenance).toBe('HEURISTIC');
    // The SB trim rule stays DERIVED: the BAND is verified, the trim is ours.
    expect(preflopRule('RFI_SB_RAISE_ONLY_TRIM').provenance).toBe('DERIVED');
  });

  it('states an honest anchor on every HEURISTIC rule, never a citation it lacks', () => {
    for (const rule of PREFLOP_RULES) {
      if (rule.provenance !== 'HEURISTIC') continue;
      // A HEURISTIC rule must say WHY it is authored — either "no public source" or the
      // partial relationship it does lean on.
      expect([rule.id, rule.rationale.length > 80]).toEqual([rule.id, true]);
    }
  });
});
