/**
 * `facts.ts` is the one place an MDX number is allowed to come from, so this suite checks
 * both halves of CLAUDE.md rule 5: every legal (name, arg) pair really does read the
 * packages rather than a literal, and every illegal one breaks loudly instead of rendering
 * something plausible.
 */
import { describe, expect, it } from 'vitest';
import {
  COMBO_COUNT,
  HAND_CATEGORIES,
  handClassByKey,
  RFI_RANGES,
  comboCountOf,
} from '@gto-self/strategy-core';
import {
  categoryFrequencyOf,
  classVsClassMatchupFor,
  exactHeadsUpEquity,
  HAND_STRENGTH_BY_RANK,
  handStrengthOf,
  outsOdds,
  potOdds,
} from '@gto-self/learn-core';
import { Money, parseCards, unwrap } from '@gto-self/shared';
import { factValue, FACT_NAMES, type FactName } from './facts.js';

const KOREAN = 'ko-KR';

/** Reconstructs the rendering rule `facts.ts`'s header documents: two-decimal percent. */
const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

const AA = handClassByKey('AA');
if (AA === undefined) throw new Error('test fixture: AA must be a real hand class');

/**
 * One valid (name, arg) pair per fact — enough to prove every name in `FACT_NAMES` actually
 * resolves. Facts that take no arg map to `undefined`.
 */
const VALID_ARGS: Record<FactName, string | undefined> = {
  COMBO_COUNT: undefined,
  HAND_CLASS_COUNT: undefined,
  CLASSES_OF_KIND: 'PAIR',
  COMBOS_OF_KIND: 'PAIR',
  HAND_COMBOS: 'AA',
  HAND_SHARE: 'AA',
  RFI_COMBOS: 'BTN',
  RFI_PERCENT: 'BTN',
  RFI_POSITIONS_WITH: 'AA',
  HAND_RANK: 'AA',
  HAND_AT_RANK: '1',
  HAND_EQUITY_VS_RANDOM: 'AA',
  HAND_TOP_SHARE: 'AA',
  HAND_ONE_IN_N: 'AA',
  CATEGORY_RANK: 'STRAIGHT_FLUSH',
  CATEGORY_FREQUENCY: 'STRAIGHT_FLUSH',
  CLASS_VS_CLASS_EQUITY: 'QQ|AKs',
  EXACT_EQUITY: 'AsKs|AhKh',
  OUTS_PROB: '9|FLOP|RIVER',
  POT_ODDS_REQUIRED_EQUITY: '3|2',
};

describe('every FACT_NAMES entry resolves for its valid arg', () => {
  it.each(FACT_NAMES)('%s', (name) => {
    const value = factValue(name, VALID_ARGS[name]);
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/NaN|undefined/u);
  });
});

describe('unknown fact name', () => {
  it('throws rather than rendering blank', () => {
    expect(() => factValue('MADE_UP' as never)).toThrow(/unknown fact/u);
  });
});

describe('HAND_RANK', () => {
  it('agrees with handStrengthOf', () => {
    expect(factValue('HAND_RANK', 'AA')).toBe(handStrengthOf(AA).rank.toLocaleString(KOREAN));
  });

  it('AA is rank 1', () => {
    expect(factValue('HAND_RANK', 'AA')).toBe('1');
  });

  it('throws for a hand that is not one of the 169', () => {
    expect(() => factValue('HAND_RANK', 'ZZ')).toThrow(/169/u);
  });

  it('throws for a missing arg', () => {
    expect(() => factValue('HAND_RANK')).toThrow(/needs an arg/u);
  });
});

describe('HAND_AT_RANK', () => {
  it('agrees with HAND_STRENGTH_BY_RANK', () => {
    expect(factValue('HAND_AT_RANK', '1')).toBe(HAND_STRENGTH_BY_RANK[0]?.key);
    expect(factValue('HAND_AT_RANK', '169')).toBe(HAND_STRENGTH_BY_RANK[168]?.key);
  });

  it('rank 1 is AA, the strongest class', () => {
    expect(factValue('HAND_AT_RANK', '1')).toBe('AA');
  });

  it('throws for a rank outside 1..169', () => {
    expect(() => factValue('HAND_AT_RANK', '0')).toThrow(/1\.\.169/u);
    expect(() => factValue('HAND_AT_RANK', '170')).toThrow(/1\.\.169/u);
  });

  it('throws for a non-integer rank', () => {
    expect(() => factValue('HAND_AT_RANK', '1.5')).toThrow(/1\.\.169/u);
  });
});

describe('HAND_EQUITY_VS_RANDOM', () => {
  it('agrees with handStrengthOf, two-decimal percent', () => {
    expect(factValue('HAND_EQUITY_VS_RANDOM', 'AA')).toBe(pct(handStrengthOf(AA).equity));
  });

  it('throws for an unknown class', () => {
    expect(() => factValue('HAND_EQUITY_VS_RANDOM', 'ZZ')).toThrow(/169/u);
  });
});

describe('HAND_TOP_SHARE', () => {
  it('agrees with handStrengthOf.cumulativeShare', () => {
    expect(factValue('HAND_TOP_SHARE', 'AA')).toBe(pct(handStrengthOf(AA).cumulativeShare));
  });

  it('throws for an unknown class', () => {
    expect(() => factValue('HAND_TOP_SHARE', 'ZZ')).toThrow(/169/u);
  });
});

describe('HAND_ONE_IN_N', () => {
  it('is COMBO_COUNT / comboCount, rounded to the nearest integer', () => {
    expect(factValue('HAND_ONE_IN_N', 'AA')).toBe(
      Math.round(COMBO_COUNT / AA.comboCount).toLocaleString(KOREAN),
    );
    expect(factValue('HAND_ONE_IN_N', 'AA')).toBe('221');
  });

  it('rounds a non-integer division rather than truncating or erroring', () => {
    // AKo has 12 combos; 1326 / 12 = 110.5, which does not divide evenly.
    const ako = handClassByKey('AKo');
    if (ako === undefined) throw new Error('AKo must be a real hand class');
    expect(factValue('HAND_ONE_IN_N', 'AKo')).toBe(
      Math.round(COMBO_COUNT / ako.comboCount).toLocaleString(KOREAN),
    );
  });

  it('throws for an unknown class', () => {
    expect(() => factValue('HAND_ONE_IN_N', 'ZZ')).toThrow(/169/u);
  });
});

describe('CATEGORY_RANK', () => {
  it('agrees with categoryFrequencyOf', () => {
    expect(factValue('CATEGORY_RANK', 'FLUSH')).toBe(
      categoryFrequencyOf('FLUSH').rank.toLocaleString(KOREAN),
    );
  });

  it('straight flush is rank 1, high card is rank 9', () => {
    expect(factValue('CATEGORY_RANK', 'STRAIGHT_FLUSH')).toBe('1');
    expect(factValue('CATEGORY_RANK', 'HIGH_CARD')).toBe('9');
  });

  it('throws for a name that is not one of the 9 categories', () => {
    expect(() => factValue('CATEGORY_RANK', 'FULL_FLUSH')).toThrow(/9 hand categories/u);
  });

  it('resolves every real category', () => {
    for (const category of HAND_CATEGORIES) {
      expect(() => factValue('CATEGORY_RANK', category)).not.toThrow();
    }
  });
});

describe('CATEGORY_FREQUENCY', () => {
  it('agrees with categoryFrequencyOf.count, Korean-grouped', () => {
    expect(factValue('CATEGORY_FREQUENCY', 'FLUSH')).toBe(
      categoryFrequencyOf('FLUSH').count.toLocaleString(KOREAN),
    );
  });

  it('matches the cited flush/straight counts', () => {
    expect(factValue('CATEGORY_FREQUENCY', 'FLUSH')).toBe('5,108');
    expect(factValue('CATEGORY_FREQUENCY', 'STRAIGHT')).toBe('10,200');
  });

  it('throws for an unknown category', () => {
    expect(() => factValue('CATEGORY_FREQUENCY', 'NOPE')).toThrow(/9 hand categories/u);
  });
});

describe('CLASS_VS_CLASS_EQUITY', () => {
  it('agrees with classVsClassMatchupFor, two-decimal percent', () => {
    const expected = classVsClassMatchupFor('QQ', 'AKs');
    if (!expected.ok) throw new Error('QQ vs AKs must be frozen');
    expect(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs')).toBe(pct(expected.value.equity));
  });

  it('resolves the other frozen matchup, QQ vs AKo', () => {
    const expected = classVsClassMatchupFor('QQ', 'AKo');
    if (!expected.ok) throw new Error('QQ vs AKo must be frozen');
    expect(factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKo')).toBe(pct(expected.value.equity));
  });

  it('answers the mirrored key order too', () => {
    const forward = factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs');
    const mirrored = factValue('CLASS_VS_CLASS_EQUITY', 'AKs|QQ');
    const forwardFraction = Number(forward.replace('%', '')) / 100;
    const mirroredFraction = Number(mirrored.replace('%', '')) / 100;
    expect(forwardFraction + mirroredFraction).toBeCloseTo(1, 9);
  });

  it('throws UNKNOWN_MATCHUP for a pair that was never frozen, rather than computing live', () => {
    expect(() => factValue('CLASS_VS_CLASS_EQUITY', 'AA|KK')).toThrow(/frozen matchups/u);
  });

  it('throws for an unknown hand class before even checking the matchup', () => {
    expect(() => factValue('CLASS_VS_CLASS_EQUITY', 'ZZ|AKs')).toThrow(/169/u);
  });

  it('throws for the wrong number of parts', () => {
    expect(() => factValue('CLASS_VS_CLASS_EQUITY', 'QQ')).toThrow(/parts/u);
    expect(() => factValue('CLASS_VS_CLASS_EQUITY', 'QQ|AKs|AKo')).toThrow(/parts/u);
  });
});

describe('EXACT_EQUITY', () => {
  it('agrees with exactHeadsUpEquity, two-decimal percent', () => {
    const hero = unwrap(parseCards('AsKs'));
    const villain = unwrap(parseCards('AhKh'));
    const expected = exactHeadsUpEquity(hero, villain, []);
    if (!expected.ok) throw new Error('AsKs vs AhKh must be a legal preflop deal');
    expect(factValue('EXACT_EQUITY', 'AsKs|AhKh')).toBe(pct(expected.value.equity));
  });

  it('accepts an explicit board as the third part', () => {
    const hero = unwrap(parseCards('QsQh'));
    const villain = unwrap(parseCards('AsKh'));
    const board = unwrap(parseCards('2h7d9c'));
    const expected = exactHeadsUpEquity(hero, villain, board);
    if (!expected.ok) throw new Error('QsQh vs AsKh on 2h7d9c must be a legal deal');
    expect(factValue('EXACT_EQUITY', 'QsQh|AsKh|2h7d9c')).toBe(pct(expected.value.equity));
  });

  it('two known hands with no shared card sum to 100% equity between them', () => {
    const ab = factValue('EXACT_EQUITY', 'AsKs|AhKh');
    const ba = factValue('EXACT_EQUITY', 'AhKh|AsKs');
    const abFraction = Number(ab.replace('%', '')) / 100;
    const baFraction = Number(ba.replace('%', '')) / 100;
    expect(abFraction + baFraction).toBeCloseTo(1, 9);
  });

  it('throws for a duplicate card between hero and villain', () => {
    expect(() => factValue('EXACT_EQUITY', 'AsKs|AsKh')).toThrow(/DUPLICATE_CARD/u);
  });

  it('throws for an unparseable card', () => {
    expect(() => factValue('EXACT_EQUITY', 'ZzKs|AhKh')).toThrow(/could not parse/u);
  });

  it('throws for the wrong number of parts', () => {
    expect(() => factValue('EXACT_EQUITY', 'AsKs')).toThrow(/parts/u);
  });
});

describe('OUTS_PROB', () => {
  it('agrees with outsOdds for the exact next-card and by-river targets', () => {
    const expected = outsOdds({ outs: 9, street: 'FLOP' });
    if (!expected.ok) throw new Error('9 outs on the flop must be legal');
    expect(factValue('OUTS_PROB', '9|FLOP|NEXT')).toBe(pct(expected.value.nextCardProb));
    expect(factValue('OUTS_PROB', '9|FLOP|RIVER')).toBe(pct(expected.value.byRiverProb));
  });

  it('agrees with the SAME result for the rule-of-2-and-4 shortcut targets', () => {
    const expected = outsOdds({ outs: 9, street: 'FLOP' });
    if (!expected.ok) throw new Error('9 outs on the flop must be legal');
    expect(factValue('OUTS_PROB', '9|FLOP|SHORTCUT_NEXT')).toBe(
      pct(expected.value.ruleOfTwoAndFour.nextCardProb),
    );
    expect(factValue('OUTS_PROB', '9|FLOP|SHORTCUT_RIVER')).toBe(
      pct(expected.value.ruleOfTwoAndFour.byRiverProb),
    );
  });

  it('the shortcut and the exact answer differ for 9 outs, which is the point of shipping both', () => {
    const exact = factValue('OUTS_PROB', '9|FLOP|RIVER');
    const shortcut = factValue('OUTS_PROB', '9|FLOP|SHORTCUT_RIVER');
    expect(exact).not.toBe(shortcut);
  });

  it('on the turn, RIVER and NEXT are the identical figure', () => {
    expect(factValue('OUTS_PROB', '9|TURN|RIVER')).toBe(factValue('OUTS_PROB', '9|TURN|NEXT'));
  });

  it('throws for a negative outs count', () => {
    expect(() => factValue('OUTS_PROB', '-1|FLOP|NEXT')).toThrow(/non-negative integer/u);
  });

  it('throws when outs exceed the unseen cards', () => {
    expect(() => factValue('OUTS_PROB', '48|FLOP|NEXT')).toThrow(/OUTS_EXCEED_UNSEEN/u);
  });

  it('throws for an invalid street', () => {
    expect(() => factValue('OUTS_PROB', '9|RIVER|NEXT')).toThrow(/FLOP or TURN/u);
  });

  it('throws for an invalid target', () => {
    expect(() => factValue('OUTS_PROB', '9|FLOP|EVENTUALLY')).toThrow(/NEXT.*RIVER/u);
  });

  it('throws for the wrong number of parts', () => {
    expect(() => factValue('OUTS_PROB', '9|FLOP')).toThrow(/parts/u);
  });
});

describe('POT_ODDS_REQUIRED_EQUITY', () => {
  it('agrees with potOdds after BB-to-milliBB conversion, assuming call === bet', () => {
    const potBeforeCallMbb = unwrap(Money.parseBB('3'));
    const villainBetMbb = unwrap(Money.parseBB('2'));
    const expected = potOdds({ potBeforeCallMbb, villainBetMbb, callAmountMbb: villainBetMbb });
    if (!expected.ok) throw new Error('pot=3bb bet=2bb must be a legal call');
    expect(factValue('POT_ODDS_REQUIRED_EQUITY', '3|2')).toBe(pct(expected.value.requiredEquity));
  });

  it('handles fractional BB amounts', () => {
    const potBeforeCallMbb = unwrap(Money.parseBB('7.5'));
    const villainBetMbb = unwrap(Money.parseBB('2.5'));
    const expected = potOdds({ potBeforeCallMbb, villainBetMbb, callAmountMbb: villainBetMbb });
    if (!expected.ok) throw new Error('pot=7.5bb bet=2.5bb must be a legal call');
    expect(factValue('POT_ODDS_REQUIRED_EQUITY', '7.5|2.5')).toBe(
      pct(expected.value.requiredEquity),
    );
  });

  it('throws for an unparseable BB amount', () => {
    expect(() => factValue('POT_ODDS_REQUIRED_EQUITY', 'abc|2')).toThrow(/could not parse/u);
  });

  it('throws for a zero bet, which prices no real call', () => {
    expect(() => factValue('POT_ODDS_REQUIRED_EQUITY', '3|0')).toThrow(/NON_POSITIVE_CALL/u);
  });

  it('throws for a negative pot', () => {
    expect(() => factValue('POT_ODDS_REQUIRED_EQUITY', '-1|2')).toThrow(/NEGATIVE_POT/u);
  });

  it('throws for the wrong number of parts', () => {
    expect(() => factValue('POT_ODDS_REQUIRED_EQUITY', '3')).toThrow(/parts/u);
  });
});

describe('RFI facts sanity (pre-existing behaviour, exercised here for completeness)', () => {
  it('RFI_COMBOS still reads the range facade, not a literal', () => {
    const btn = RFI_RANGES.BTN;
    expect(btn).not.toBeNull();
    if (btn === null) return;
    expect(factValue('RFI_COMBOS', 'BTN')).toBe(comboCountOf(btn).toLocaleString(KOREAN));
  });
});

describe('rounding is stable: repeated calls print identical text', () => {
  const REPEATED_CASES: readonly [FactName, string | undefined][] = [
    ['HAND_EQUITY_VS_RANDOM', 'AKs'],
    ['HAND_TOP_SHARE', 'AKs'],
    ['CLASS_VS_CLASS_EQUITY', 'QQ|AKs'],
    ['EXACT_EQUITY', 'AsKs|AhKh'],
    ['OUTS_PROB', '9|FLOP|RIVER'],
    ['POT_ODDS_REQUIRED_EQUITY', '3|2'],
  ];

  it.each(REPEATED_CASES)('%s %s', (name, arg) => {
    const first = factValue(name, arg);
    const second = factValue(name, arg);
    expect(first).toBe(second);
  });
});
