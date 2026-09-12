import { describe, expect, it } from 'vitest';
import { outsOdds, potOdds } from '@gto-self/learn-core';
import { Money } from '@gto-self/shared';
import { minimumOutsFor } from './requiredOuts.js';
import { unseenCardsOn } from './outsView.js';

describe('minimumOutsFor', () => {
  it('answers the price of the calculator’s own default example', () => {
    // 10 BB pot, a 5 BB bet, a 5 BB call: 25% required.
    const priced = potOdds({
      potBeforeCallMbb: Money.fromBB(10),
      villainBetMbb: Money.fromBB(5),
      callAmountMbb: Money.fromBB(5),
    });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.value.requiredEquity).toBe(0.25);

    const byRiver = minimumOutsFor(priced.value.requiredEquity, 'FLOP', 'BY_RIVER');
    const nextCard = minimumOutsFor(priced.value.requiredEquity, 'FLOP', 'NEXT_CARD');
    // 6 outs by the river is 24.1%, just under the price; 7 is 27.8%. 11 outs on the turn
    // alone is 23.4%; 12 is 25.5%. Both boundaries are checked exhaustively below — these
    // two are pinned by hand so a change to the search is visible as a number a person can
    // recompute, not just as a property that still holds.
    expect(byRiver?.outs).toBe(7);
    expect(nextCard?.outs).toBe(12);
    expect(byRiver?.probability).toBeGreaterThanOrEqual(0.25);
    expect(nextCard?.probability).toBeGreaterThanOrEqual(0.25);
  });

  it('reports the SMALLEST out count that reaches the price, not merely one that does', () => {
    for (const equity of [0.1, 0.2, 0.25, 0.333, 0.5]) {
      for (const street of ['FLOP', 'TURN'] as const) {
        for (const horizon of ['NEXT_CARD', 'BY_RIVER'] as const) {
          const found = minimumOutsFor(equity, street, horizon);
          expect(found, `${equity}/${street}/${horizon}`).not.toBeNull();
          if (found === null) continue;
          expect(found.probability).toBeGreaterThanOrEqual(equity);
          if (found.outs === 0) continue; // 0 outs has no "one fewer" boundary to check below it
          const oneFewer = outsOdds({ outs: found.outs - 1, street });
          expect(oneFewer.ok).toBe(true);
          if (!oneFewer.ok) continue;
          const below =
            horizon === 'NEXT_CARD' ? oneFewer.value.nextCardProb : oneFewer.value.byRiverProb;
          expect(below).toBeLessThan(equity);
        }
      }
    }
  });

  it('reads the probability back from learn-core rather than restating it', () => {
    const found = minimumOutsFor(0.25, 'FLOP', 'BY_RIVER');
    expect(found).not.toBeNull();
    if (found === null) return;
    const odds = outsOdds({ outs: found.outs, street: 'FLOP' });
    expect(odds.ok).toBe(true);
    if (!odds.ok) return;
    expect(found.probability).toBe(odds.value.byRiverProb);
  });

  it('answers zero outs for a price nothing has to beat', () => {
    expect(minimumOutsFor(0, 'FLOP', 'BY_RIVER')?.outs).toBe(0);
  });

  it('reaches certainty one out EARLIER on the flop, because two cards cannot both miss', () => {
    // With 46 of 47 unseen cards live and two cards to come, there is only one blank left in
    // the deck — it cannot arrive twice, so the draw is already certain. On the turn, with a
    // single card to come, certainty really does need every unseen card. This is the deck
    // being counted correctly, not an off-by-one.
    expect(minimumOutsFor(1, 'FLOP', 'BY_RIVER')?.outs).toBe(unseenCardsOn('FLOP') - 1);
    expect(minimumOutsFor(1, 'FLOP', 'NEXT_CARD')?.outs).toBe(unseenCardsOn('FLOP'));
    expect(minimumOutsFor(1, 'TURN', 'BY_RIVER')?.outs).toBe(unseenCardsOn('TURN'));
  });

  it('returns null rather than a plausible number when the price cannot be met', () => {
    expect(minimumOutsFor(1.5, 'FLOP', 'BY_RIVER')).toBeNull();
    expect(minimumOutsFor(Number.NaN, 'FLOP', 'BY_RIVER')).toBeNull();
  });

  it('never needs more outs by the river than for the next card alone', () => {
    for (let n = 1; n <= 20; n += 1) {
      const equity = n / 40;
      const nextCard = minimumOutsFor(equity, 'FLOP', 'NEXT_CARD');
      const byRiver = minimumOutsFor(equity, 'FLOP', 'BY_RIVER');
      expect(byRiver?.outs ?? 0).toBeLessThanOrEqual(nextCard?.outs ?? 0);
    }
  });
});
