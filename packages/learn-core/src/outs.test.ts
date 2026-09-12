import { describe, expect, it } from 'vitest';
import { isOk, unwrap } from '@gto-self/shared';
import { binomial } from '@gto-self/strategy-core';
import {
  outsOdds,
  UNSEEN_AFTER_FLOP,
  UNSEEN_AFTER_TURN,
  type DrawStreet,
  type OutsError,
} from './outs.js';

const onFlop = (outs: number) => outsOdds({ outs, street: 'FLOP' });
const onTurn = (outs: number) => outsOdds({ outs, street: 'TURN' });

const errorOf = (outs: number, street: DrawStreet): OutsError => {
  const result = outsOdds({ outs, street });
  if (isOk(result)) throw new Error('expected an error, got a result');
  return result.error;
};

describe('outsOdds', () => {
  it('gives the flush draw its exact numbers, not the shortcut', () => {
    // 9 outs after the flop. 9/47 on the turn; by the river 1 - C(38,2)/C(47,2).
    const odds = unwrap(onFlop(9));

    expect(odds.unseenCards).toBe(47);
    expect(odds.cardsToCome).toBe(2);
    expect(odds.nextCardProb).toBeCloseTo(9 / 47, 12);
    expect(odds.byRiverProb).toBeCloseTo(1 - (38 * 37) / (47 * 46), 12);
    // The two figures a person actually quotes: 19.1% and 35.0%.
    expect(odds.nextCardProb).toBeCloseTo(0.191489, 6);
    expect(odds.byRiverProb).toBeCloseTo(0.349676, 6);
  });

  it('gives the open-ended straight draw its exact numbers', () => {
    // 8 outs after the flop: 17.0% on the turn, 31.5% by the river.
    const odds = unwrap(onFlop(8));

    expect(odds.nextCardProb).toBeCloseTo(8 / 47, 12);
    expect(odds.byRiverProb).toBeCloseTo(1 - (39 * 38) / (47 * 46), 12);
    expect(odds.nextCardProb).toBeCloseTo(0.170213, 6);
    expect(odds.byRiverProb).toBeCloseTo(0.314524, 6);
  });

  it('sees 46 unseen cards and one card to come on the turn', () => {
    const odds = unwrap(onTurn(9));

    expect(odds.unseenCards).toBe(46);
    expect(odds.cardsToCome).toBe(1);
    expect(odds.nextCardProb).toBeCloseTo(9 / 46, 12);
    // The river IS the next card, so there is no second chance to model.
    expect(odds.missThenHitProb).toBe(0);
    expect(odds.byRiverProb).toBe(odds.nextCardProb);
  });

  it('agrees with the hypergeometric complement computed independently', () => {
    // `binomial` comes from strategy-core, so this is a genuine second route to the same
    // number: 1 - C(unseen - outs, cardsToCome) / C(unseen, cardsToCome), for every legal
    // out count on both streets.
    for (const street of ['FLOP', 'TURN'] as const) {
      const unseen = street === 'FLOP' ? UNSEEN_AFTER_FLOP : UNSEEN_AFTER_TURN;
      const toCome = street === 'FLOP' ? 2 : 1;
      for (let outs = 0; outs <= unseen; outs += 1) {
        const odds = unwrap(outsOdds({ outs, street }));
        const missAll = binomial(unseen - outs, toCome) / binomial(unseen, toCome);
        expect(odds.byRiverProb).toBeCloseTo(1 - missAll, 12);
      }
    }
  });

  it('decomposes "by the river" into hit-now plus miss-then-hit', () => {
    // The whole teaching point: the two disjoint events add up to the answer.
    for (let outs = 0; outs <= UNSEEN_AFTER_FLOP; outs += 1) {
      const odds = unwrap(onFlop(outs));
      expect(odds.nextCardProb + odds.missThenHitProb).toBeCloseTo(odds.byRiverProb, 12);
    }
  });

  it('is monotone in the out count and stays inside 0..1', () => {
    let previous = -1;
    for (let outs = 0; outs <= UNSEEN_AFTER_FLOP; outs += 1) {
      const odds = unwrap(onFlop(outs));
      expect(odds.byRiverProb).toBeGreaterThanOrEqual(previous);
      expect(odds.byRiverProb).toBeLessThanOrEqual(1);
      expect(odds.nextCardProb).toBeGreaterThanOrEqual(0);
      previous = odds.byRiverProb;
    }
  });

  it('answers zero for a dead draw', () => {
    const flop = unwrap(onFlop(0));
    expect(flop.nextCardProb).toBe(0);
    expect(flop.missThenHitProb).toBe(0);
    expect(flop.byRiverProb).toBe(0);
    expect(flop.ruleOfTwoAndFour.byRiverError).toBe(0);

    const turn = unwrap(onTurn(0));
    expect(turn.nextCardProb).toBe(0);
    expect(turn.byRiverProb).toBe(0);
  });

  it('answers one when every unseen card is an out', () => {
    const flop = unwrap(onFlop(UNSEEN_AFTER_FLOP));
    expect(flop.nextCardProb).toBe(1);
    expect(flop.byRiverProb).toBe(1);

    const turn = unwrap(onTurn(UNSEEN_AFTER_TURN));
    expect(turn.nextCardProb).toBe(1);
    expect(turn.byRiverProb).toBe(1);

    // One card short of everything: the turn can miss, but then the river cannot.
    const almost = unwrap(onFlop(UNSEEN_AFTER_FLOP - 1));
    expect(almost.nextCardProb).toBeCloseTo(46 / 47, 12);
    expect(almost.byRiverProb).toBe(1);
  });

  it('reports the rule of 2 and 4 beside the exact answer, never as it', () => {
    const odds = unwrap(onFlop(9));

    expect(odds.ruleOfTwoAndFour.nextCardProb).toBeCloseTo(0.18, 12);
    expect(odds.ruleOfTwoAndFour.byRiverProb).toBeCloseTo(0.36, 12);
    expect(odds.ruleOfTwoAndFour.nextCardMultiplier).toBe(2);
    expect(odds.ruleOfTwoAndFour.byRiverMultiplier).toBe(4);
    // The shortcut is not the answer, and the object says so by keeping them apart.
    expect(odds.ruleOfTwoAndFour.byRiverProb).not.toBe(odds.byRiverProb);
    expect(odds.ruleOfTwoAndFour.byRiverError).toBeCloseTo(0.36 - odds.byRiverProb, 12);
    expect(odds.ruleOfTwoAndFour.nextCardError).toBeCloseTo(0.18 - odds.nextCardProb, 12);
  });

  it('shows the shortcut drifting badly at high out counts', () => {
    // 15 outs (flush draw plus an open-ender) is the textbook case where x4 breaks: the
    // shortcut claims 60% and the truth is 54.1%. Showing only the shortcut teaches this
    // 5.9-point error as fact, which is why both fields exist.
    const odds = unwrap(onFlop(15));

    expect(odds.byRiverProb).toBeCloseTo(1 - (32 * 31) / (47 * 46), 12);
    expect(odds.byRiverProb).toBeCloseTo(0.541166, 6);
    expect(odds.ruleOfTwoAndFour.byRiverProb).toBeCloseTo(0.6, 12);
    expect(odds.ruleOfTwoAndFour.byRiverError).toBeGreaterThan(0.05);
  });

  it('uses x2 rather than x4 for the single card that follows the turn', () => {
    const odds = unwrap(onTurn(9));
    expect(odds.ruleOfTwoAndFour.byRiverMultiplier).toBe(2);
    expect(odds.ruleOfTwoAndFour.byRiverProb).toBeCloseTo(0.18, 12);
    expect(odds.ruleOfTwoAndFour.byRiverProb).toBe(odds.ruleOfTwoAndFour.nextCardProb);
  });

  it('rejects out counts that cannot describe a draw, with a typed reason', () => {
    expect(errorOf(-1, 'FLOP')).toBe('NEGATIVE_OUTS');
    expect(errorOf(-1, 'TURN')).toBe('NEGATIVE_OUTS');
    expect(errorOf(9.5, 'FLOP')).toBe('NON_INTEGER_OUTS');
    expect(errorOf(Number.NaN, 'FLOP')).toBe('NON_INTEGER_OUTS');
    expect(errorOf(Number.POSITIVE_INFINITY, 'FLOP')).toBe('NON_INTEGER_OUTS');
    expect(errorOf(UNSEEN_AFTER_FLOP + 1, 'FLOP')).toBe('OUTS_EXCEED_UNSEEN');
    // 47 outs is legal after the flop and impossible after the turn — only 46 are unseen.
    expect(isOk(onFlop(47))).toBe(true);
    expect(errorOf(47, 'TURN')).toBe('OUTS_EXCEED_UNSEEN');
  });
});
