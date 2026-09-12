import { describe, expect, it } from 'vitest';
import {
  outsOdds,
  UNSEEN_AFTER_FLOP,
  UNSEEN_AFTER_TURN,
  type OutsOdds,
} from '@gto-self/learn-core';
import { shortcutComparisons, unseenCardsOn } from './outsView.js';

function oddsFor(outs: number, street: 'FLOP' | 'TURN'): OutsOdds {
  const result = outsOdds({ outs, street });
  if (!result.ok) throw new Error(`fixture is not a legal draw: ${result.error}`);
  return result.value;
}

describe('unseenCardsOn', () => {
  it('reads the counts from learn-core rather than restating them', () => {
    expect(unseenCardsOn('FLOP')).toBe(UNSEEN_AFTER_FLOP);
    expect(unseenCardsOn('TURN')).toBe(UNSEEN_AFTER_TURN);
  });
});

describe('shortcutComparisons', () => {
  it('shows two genuinely different horizons on the flop', () => {
    const rows = shortcutComparisons(oddsFor(9, 'FLOP'));
    expect(rows.map((row) => row.id)).toEqual(['NEXT_CARD', 'BY_RIVER']);
    expect(rows[0]?.multiplier).toBe(2);
    expect(rows[1]?.multiplier).toBe(4);
  });

  it('shows ONE row on the turn, because the two horizons are the same event', () => {
    const odds = oddsFor(9, 'TURN');
    expect(odds.nextCardProb).toBe(odds.byRiverProb);
    const rows = shortcutComparisons(odds);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('BY_RIVER');
    expect(rows[0]?.multiplier).toBe(2);
    expect(rows[0]?.label).toBe('리버 한 장');
  });

  it('passes the exact answer and the shortcut through unchanged from the domain', () => {
    const odds = oddsFor(15, 'FLOP');
    const [nextCard, byRiver] = shortcutComparisons(odds);
    expect(nextCard?.exactProb).toBe(odds.nextCardProb);
    expect(nextCard?.shortcutProb).toBe(odds.ruleOfTwoAndFour.nextCardProb);
    expect(nextCard?.error).toBe(odds.ruleOfTwoAndFour.nextCardError);
    expect(byRiver?.exactProb).toBe(odds.byRiverProb);
    expect(byRiver?.shortcutProb).toBe(odds.ruleOfTwoAndFour.byRiverProb);
    expect(byRiver?.error).toBe(odds.ruleOfTwoAndFour.byRiverError);
  });

  it('reports the ×4 rule as an overstatement at 15 outs — the case the module doc names', () => {
    const [, byRiver] = shortcutComparisons(oddsFor(15, 'FLOP'));
    expect(byRiver?.shortcutProb).toBeCloseTo(0.6, 10);
    expect(byRiver?.exactProb).toBeLessThan(0.55);
    expect(byRiver?.direction).toBe('OVER');
  });

  it('reports the ×2 rule as an understatement at a small out count', () => {
    // 4 * 0.02 = 8.0%, but 4/47 is 8.51% — the shortcut is low here, the opposite of the
    // direction it takes at high out counts, which is exactly why the sign is shown.
    const [nextCard] = shortcutComparisons(oddsFor(4, 'FLOP'));
    expect(nextCard?.direction).toBe('UNDER');
  });

  it('reports no direction at all when the two agree', () => {
    for (const row of shortcutComparisons(oddsFor(0, 'FLOP'))) {
      expect(row.exactProb).toBe(0);
      expect(row.shortcutProb).toBe(0);
      expect(row.direction).toBe('SAME');
    }
  });

  it('never claims a direction the rounded difference does not show', () => {
    for (const street of ['FLOP', 'TURN'] as const) {
      for (let outs = 0; outs <= unseenCardsOn(street); outs += 1) {
        for (const row of shortcutComparisons(oddsFor(outs, street))) {
          const rounded = Number((row.error * 100).toFixed(1));
          const claimed = row.direction === 'OVER' ? 1 : row.direction === 'UNDER' ? -1 : 0;
          expect(Math.sign(rounded), `${street}/${outs}/${row.id}`).toBe(claimed);
        }
      }
    }
  });
});
