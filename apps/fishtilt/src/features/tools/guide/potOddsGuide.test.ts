import { describe, expect, it } from 'vitest';
import { outsOdds, potOdds } from '@gto-self/learn-core';
import { Money } from '@gto-self/shared';
import {
  POT_ODDS_EXAMPLE_SPECS,
  potOddsExamples,
  potOddsVsOuts,
  potOddsWalkthrough,
} from './potOddsGuide.js';

describe('potOddsGuide', () => {
  it('computes every example with potOdds() on milliBB, calling the full bet', () => {
    const examples = potOddsExamples();
    expect(examples.length).toBe(POT_ODDS_EXAMPLE_SPECS.length);
    for (const example of examples) {
      const pot = Money.parseBB(example.potBB);
      const bet = Money.parseBB(example.betBB);
      expect(pot.ok && bet.ok).toBe(true);
      if (!pot.ok || !bet.ok) continue;
      const outcome = potOdds({
        potBeforeCallMbb: pot.value,
        villainBetMbb: bet.value,
        callAmountMbb: bet.value,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(example.odds).toEqual(outcome.value);
      expect(example.odds.uncalledReturnMbb).toBe(0);
    }
  });

  it('the three sizes are ordered so the required equity rises with the bet', () => {
    const required = potOddsExamples().map((e) => e.odds.requiredEquity);
    for (let i = 1; i < required.length; i += 1)
      expect(required[i]).toBeGreaterThan(required[i - 1] ?? 1);
  });

  it('the percent and the ratio are the same fact: 1 / (oddsAgainst + 1) === requiredEquity', () => {
    for (const example of potOddsExamples()) {
      expect(1 / (example.odds.oddsAgainst + 1)).toBeCloseTo(example.odds.requiredEquity, 12);
      expect(1 / example.odds.oneInN).toBeCloseTo(example.odds.requiredEquity, 12);
    }
  });

  it('walkthrough is the first example and its final pot is pot + bet + call', () => {
    const walk = potOddsWalkthrough();
    expect(walk.id).toBe(POT_ODDS_EXAMPLE_SPECS[0]?.id);
    const { potBeforeCallMbb, calledBetMbb, callAmountMbb, finalPotMbb } = walk.odds;
    expect(Money.add(Money.add(potBeforeCallMbb, calledBetMbb), callAmountMbb)).toBe(finalPotMbb);
  });

  it('pairs the price with a flush draw straight from outsOdds', () => {
    const pair = potOddsVsOuts(9, 'FLOP');
    const odds = outsOdds({ outs: 9, street: 'FLOP' });
    expect(odds.ok).toBe(true);
    if (!odds.ok) return;
    expect(pair.nextCardProb).toBe(odds.value.nextCardProb);
    expect(pair.byRiverProb).toBe(odds.value.byRiverProb);
    expect(pair.requiredEquity).toBe(potOddsWalkthrough().odds.requiredEquity);
    expect(pair.nextCardClears).toBe(pair.nextCardProb >= pair.requiredEquity);
    expect(pair.byRiverClears).toBe(pair.byRiverProb >= pair.requiredEquity);
  });
});
