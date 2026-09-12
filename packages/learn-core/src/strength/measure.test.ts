/**
 * The measurement itself: the representative combo, the shape of one measurement, and the
 * suit-symmetry claim the whole 169-instead-of-1326 shortcut rests on.
 *
 * Everything here runs at a deliberately small budget. This file is in `pnpm test`, so it
 * has to stay in the low hundreds of milliseconds; the expensive verification lives in the
 * offline generator and its committed record, not in the default suite.
 */
import { describe, expect, it } from 'vitest';
import { cardToString, sortCardsDesc } from '@gto-self/shared';
import {
  comboCards,
  handClassByKey,
  handClassOfCombo,
  HAND_CLASSES,
} from '@gto-self/strategy-core';
import { HAND_CLASS_FACTS } from '../handClass/facts.js';
import {
  HAND_STRENGTH_REPRESENTATIVES,
  measureHandStrength,
  OPPONENT_HAND_COUNT,
  PREFLOP_RUNOUT_SPACE_SIZE,
  representativeCombo,
} from './measure.js';

/** Small enough to keep the suite fast, large enough that the numbers mean something. */
const CHEAP_BOARDS = 2_000;

const classOf = (key: string) => {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`no such class: ${key}`);
  return handClass;
};

describe('the space being measured', () => {
  it('is 1225 opponent hands against 2,118,760 boards', () => {
    // C(50, 2) and C(50, 5): hero's two cards are the only ones removed before the deal.
    expect(OPPONENT_HAND_COUNT).toBe(1225);
    expect(PREFLOP_RUNOUT_SPACE_SIZE).toBe(2_118_760);
  });
});

describe('the representative combo', () => {
  it('belongs to the class it stands in for, both ways round', () => {
    for (const handClass of HAND_CLASSES) {
      for (const which of HAND_STRENGTH_REPRESENTATIVES) {
        const combo = representativeCombo(handClass, which);
        expect(handClassOfCombo(combo).key).toBe(handClass.key);
      }
    }
  });

  it('reuses the example combo the hand-facts page already prints', () => {
    // One representative for the whole package: a hand page showing `A♠K♠` and the ranking
    // measuring `A♦K♦` would be two answers to the same question.
    for (const facts of HAND_CLASS_FACTS) {
      expect(representativeCombo(facts.handClass, 'LOWEST_COMBO')).toBe(facts.exampleCombo);
    }
  });

  it('picks two genuinely different holdings for a class with more than one combo', () => {
    for (const handClass of HAND_CLASSES) {
      const low = representativeCombo(handClass, 'LOWEST_COMBO');
      const high = representativeCombo(handClass, 'HIGHEST_COMBO');
      expect(low).not.toBe(high);
    }
  });
});

describe('one measurement', () => {
  const measured = measureHandStrength(classOf('AA'), { runoutSamples: CHEAP_BOARDS });

  it('enumerates every opponent hand and samples only the board', () => {
    expect(measured.opponentHands).toBe(OPPONENT_HAND_COUNT);
    expect(measured.runoutSamples).toBe(CHEAP_BOARDS);
    expect(measured.runoutSpaceSize).toBe(PREFLOP_RUNOUT_SPACE_SIZE);
    expect(measured.exhaustive).toBe(false);
  });

  it('scores fewer trials than boards x hands, because card removal is real', () => {
    // A board and an opponent hand that share a card is not a deal; the engine drops it.
    expect(measured.scoredTrials).toBeLessThan(CHEAP_BOARDS * OPPONENT_HAND_COUNT);
    expect(measured.scoredTrials).toBeGreaterThan(0);
  });

  it('reports the cards it actually measured, higher rank first', () => {
    const expected = sortCardsDesc(comboCards(representativeCombo(classOf('AA'), 'LOWEST_COMBO')));
    expect([...measured.heroCards]).toEqual(expected);
    expect(cardToString(measured.heroCards[0])).toMatch(/^A/u);
  });

  it('is deterministic — the same call twice is the same number, bit for bit', () => {
    const again = measureHandStrength(classOf('AA'), { runoutSamples: CHEAP_BOARDS });
    expect(again.equity).toBe(measured.equity);
  });
});

describe('suit symmetry', () => {
  it('gets the same answer from two different combos of the same class', () => {
    // The claim that makes 169 measurements enough: relabelling suits maps one combo of a
    // class onto another and leaves both the uniform opponent and the runout distribution
    // alone, so the TRUE equities are equal.
    //
    // This is the CHEAP version of that check, on the sampled path, and it is deliberately
    // loose: two 2,000-board estimates of the same true value differ by sampling error, and
    // the 0.01 allowance is not a precision claim — it is two orders of magnitude below the
    // 0.53 range the ranking spans, so it catches a representative that measured the WRONG
    // HAND while tolerating that noise. The strict version is in the shipped dataset, where
    // the two combos are enumerated EXHAUSTIVELY and must agree to 1e-9
    // (`HAND_STRENGTH.symmetry`, asserted by `ranking.test.ts`).
    for (const key of ['AA', 'AKs', '72o']) {
      const low = measureHandStrength(classOf(key), {
        runoutSamples: CHEAP_BOARDS,
        representative: 'LOWEST_COMBO',
      });
      const high = measureHandStrength(classOf(key), {
        runoutSamples: CHEAP_BOARDS,
        representative: 'HIGHEST_COMBO',
      });
      expect(low.heroCards).not.toEqual(high.heroCards);
      expect(Math.abs(low.equity - high.equity)).toBeLessThan(0.01);
    }
  });
});
