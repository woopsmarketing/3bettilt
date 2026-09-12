import { describe, expect, it } from 'vitest';
import { parseCards, type Card } from '@gto-self/shared';
import { exactHeadsUpEquity, type ExactEquity } from '@gto-self/learn-core';
import {
  computeExactEquityAsync,
  equityCountSentence,
  equityMethodLabel,
  equityMethodSentence,
  equityPendingMessages,
  equityPercentages,
  equitySelectionStatus,
  EQUITY_HAND_SIZE,
  type EquityPending,
} from './equity.js';

/** Text -> `Card[]`, throwing on anything malformed — every fixture below is hand-picked to
 *  be legal, so a throw here would mean a typo in this file, not a real-world input. */
function hand(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`bad test fixture "${text}": ${parsed.error}`);
  return parsed.value;
}

/**
 * Calls the REAL engine and unwraps it. Every "known-matchup" expectation in this file is
 * asserted against a number this function actually returned at test run time — never a
 * figure written from memory (CLAUDE.md rule 2, WP-F2B brief).
 */
function realEquity(heroText: string, villainText: string, boardText: string): ExactEquity {
  const board = boardText.length === 0 ? [] : hand(boardText);
  const outcome = exactHeadsUpEquity(hand(heroText), hand(villainText), board);
  if (!outcome.ok) throw new Error(`fixture did not evaluate: ${outcome.error}`);
  return outcome.value;
}

/** Parses `"42.3%"` back to the integer number of tenths-of-a-percent it represents (423),
 *  so "do the three displayed strings sum to exactly 100.0%" can be asserted as exact
 *  integer arithmetic rather than by re-parsing floats. */
function tenthsOf(percentText: string): number {
  const match = /^(\d+)\.(\d)%$/u.exec(percentText);
  if (match === null) throw new Error(`not a percent string: "${percentText}"`);
  const [, whole, fraction] = match;
  return Number(whole) * 10 + Number(fraction);
}

describe('equitySelectionStatus', () => {
  it('is PENDING and asks for both hands when nothing is picked yet', () => {
    const status = equitySelectionStatus([], [], []);
    expect(status.status).toBe('PENDING');
    const pending = status as EquityPending;
    expect(pending.heroNeeded).toBe(EQUITY_HAND_SIZE);
    expect(pending.villainNeeded).toBe(EQUITY_HAND_SIZE);
    expect(pending.boardInvalid).toBe(false);
  });

  it('counts down as hero cards are added, one at a time', () => {
    const oneCard = equitySelectionStatus(hand('As'), [], []) as EquityPending;
    expect(oneCard.heroNeeded).toBe(1);
    const twoCards = equitySelectionStatus(hand('As Ah'), [], []) as EquityPending;
    expect(twoCards.heroNeeded).toBe(0);
    // Villain is still short two, so the overall selection is not READY yet.
    expect(twoCards.status).toBe('PENDING');
  });

  it('is READY only once hero and villain each hold exactly two cards and the board is legal', () => {
    for (const boardText of ['', 'Kd Qc 2s', '2h 3h 4h 5h', '2h 3h 4h 5h 6h']) {
      const status = equitySelectionStatus(hand('As Ah'), hand('Kh Kc'), hand(boardText));
      expect(status.status, `board "${boardText}"`).toBe('READY');
    }
  });

  it('blocks a 1-card board and a 2-card board, even with both hands complete', () => {
    const oneCardBoard = equitySelectionStatus(
      hand('As Ah'),
      hand('Kh Kc'),
      hand('2s'),
    ) as EquityPending;
    expect(oneCardBoard.status).toBe('PENDING');
    expect(oneCardBoard.boardInvalid).toBe(true);
    expect(oneCardBoard.boardCount).toBe(1);
    expect(oneCardBoard.heroNeeded).toBe(0);
    expect(oneCardBoard.villainNeeded).toBe(0);

    const twoCardBoard = equitySelectionStatus(
      hand('As Ah'),
      hand('Kh Kc'),
      hand('2s 3d'),
    ) as EquityPending;
    expect(twoCardBoard.status).toBe('PENDING');
    expect(twoCardBoard.boardInvalid).toBe(true);
    expect(twoCardBoard.boardCount).toBe(2);
  });

  it('reports every outstanding issue at once, not just the first one found', () => {
    const status = equitySelectionStatus(hand('As'), [], hand('2s 3d')) as EquityPending;
    expect(status.status).toBe('PENDING');
    expect(status.heroNeeded).toBe(1);
    expect(status.villainNeeded).toBe(2);
    expect(status.boardInvalid).toBe(true);
  });
});

describe('equityPendingMessages', () => {
  it('says exactly what is missing for hero alone', () => {
    const status = equitySelectionStatus(hand('As'), hand('Kh Kc'), []) as EquityPending;
    expect(equityPendingMessages(status)).toEqual(['내 핸드 카드를 1장 더 선택해주세요.']);
  });

  it('says exactly what is missing for the opponent alone', () => {
    const status = equitySelectionStatus(hand('As Ah'), hand('Kh'), []) as EquityPending;
    expect(equityPendingMessages(status)).toEqual(['상대 핸드 카드를 1장 더 선택해주세요.']);
  });

  it('explains a blocked in-between board length, and only that, once both hands are complete', () => {
    const status = equitySelectionStatus(
      hand('As Ah'),
      hand('Kh Kc'),
      hand('2s 3d'),
    ) as EquityPending;
    const messages = equityPendingMessages(status);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('0장(프리플랍), 3장(플랍), 4장(턴), 5장(리버)');
    expect(messages[0]).toContain('2장');
  });

  it('lists hero, then villain, then the board — in fill-in order, all at once', () => {
    const status = equitySelectionStatus(hand('As'), [], hand('2s 3d')) as EquityPending;
    const messages = equityPendingMessages(status);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain('내 핸드');
    expect(messages[1]).toContain('상대 핸드');
    expect(messages[2]).toContain('보드는');
  });
});

describe('computeExactEquityAsync — the async seam', () => {
  it('resolves (does not throw, does not need a worker) for a real, legal selection', async () => {
    const equity = await computeExactEquityAsync(hand('As Ah'), hand('Kh Kc'), []);
    expect(equity.method).toBe('EXACT');
    expect(equity.heroWinBps + equity.tieBps + equity.villainWinBps).toBe(10000);
  });

  it('rejects rather than silently computing something when handed an impossible selection', async () => {
    // Bypasses `equitySelectionStatus` on purpose — this proves the defensive check inside
    // `computeExactEquityAsync` itself actually fires, since the UI can never construct this
    // input (a duplicate `Ah` on both sides) through the cross-referenced `CardPicker`s.
    await expect(computeExactEquityAsync(hand('As Ah'), hand('Ah Kc'), [])).rejects.toThrow(
      /impossible selection/u,
    );
  });

  /*
   * WP-O3 moved the enumeration into a Web Worker (`equityWorker.ts`). This environment has
   * no `Worker`, so every assertion in this describe already runs the FALLBACK path — which
   * is the property worth pinning as a rule: where there is no worker, the seam must return
   * the real engine's numbers, not an approximation, a cached value or a placeholder
   * (CLAUDE.md rule 5). The comparison below is against `exactHeadsUpEquity` itself, so it
   * cannot pass by agreeing with a number typed into this file.
   */
  it('without a worker, returns exactly what the engine returns — never an estimate', async () => {
    expect(typeof globalThis.Worker).toBe('undefined');

    for (const [heroText, villainText, boardText] of [
      ['As Ah', 'Ks Kh', ''],
      ['As Ks', 'Qd Qc', '2h 7d Ts'],
      ['9c 9d', 'Ah Kh', '2s 5c 8d Jh'],
    ] as const) {
      const board = boardText.length === 0 ? [] : hand(boardText);
      const viaSeam = await computeExactEquityAsync(hand(heroText), hand(villainText), board);
      const direct = realEquity(heroText, villainText, boardText);
      expect(viaSeam).toStrictEqual(direct);
    }
  });
});

describe('equityPercentages — known-matchup fixtures', () => {
  // Fixture 1: AA vs KK preflop. The three counts and the runout total below are read
  // straight off `exactHeadsUpEquity`'s own return value at test run time — never typed in
  // from memory. `runouts === C(48, 5)` is a combinatorial fact (a fixed pair removed from
  // each side, both hole-card pairs removed from the deck), not a poker claim.
  it('AA vs KK preflop: hero is the favourite, and the three percentages sum to exactly 100.0%', () => {
    const equity = realEquity('As Ah', 'Ks Kh', '');
    expect(equity.method).toBe('EXACT');
    expect(equity.runouts).toBe(1712304); // C(48, 5)
    expect(equity.heroWinBps + equity.tieBps + equity.villainWinBps).toBe(10000);

    const percentages = equityPercentages(equity);
    expect(
      tenthsOf(percentages.heroPercent) +
        tenthsOf(percentages.tiePercent) +
        tenthsOf(percentages.villainPercent),
    ).toBe(1000);
    // AA holds a strict card-for-card advantage over KK — a mathematical fact about which
    // hand is ahead, not a strategy claim, and true regardless of the exact magnitude.
    expect(equity.heroWinBps).toBeGreaterThan(equity.villainWinBps);
  });

  // Fixture 2: a decided river, reusing the exact spot WP-F2A's own report independently
  // cross-checked against a from-scratch oracle (`docs/reports/WP_F2A_EQUITY_CORE.md` §6,
  // row 6): hero's two pair (aces and kings) already beats villain's 7-high on this board,
  // and a complete board always enumerates exactly one runout, so this is decided by
  // construction — no ambiguity for this test to get wrong.
  it('a decided river always shows exactly 100.0% / 0.0% / 0.0%', () => {
    const equity = realEquity('As Kd', '7h 2c', 'Ad Kh 9s 3c 4d');
    expect(equity.runouts).toBe(1);
    expect(equity.wins).toBe(1);
    expect(equity.ties).toBe(0);
    expect(equity.losses).toBe(0);

    const percentages = equityPercentages(equity);
    expect(percentages).toEqual({
      heroPercent: '100.0%',
      tiePercent: '0.0%',
      villainPercent: '0.0%',
    });
  });

  it('always sums to exactly 100.0% across every street length, not just the two fixtures above', () => {
    const spots: readonly [string, string, string][] = [
      ['Th 9h', 'As Ad', 'Kh 7h 2c'], // flop
      ['Js Ts', 'Qh Qd', '9s 8h 2c 3d'], // turn
      ['As Kd', '7h 2c', 'Ad Kh 9s 3c 4d'], // river (decided)
      ['Ah Kd', 'Qc Qd', ''], // preflop, undecided
    ];
    for (const [heroText, villainText, boardText] of spots) {
      const equity = realEquity(heroText, villainText, boardText);
      const percentages = equityPercentages(equity);
      const total =
        tenthsOf(percentages.heroPercent) +
        tenthsOf(percentages.tiePercent) +
        tenthsOf(percentages.villainPercent);
      expect(total, `${heroText} vs ${villainText} on "${boardText}"`).toBe(1000);
    }
  });

  it('re-apportions at display resolution rather than rounding each bps field alone', () => {
    // A constructed adversarial case, not a poker fixture: three bps values that sum to
    // 10000 but each independently round-to-nearest-tenth to 33.3%, which would sum to
    // 99.9% — the exact failure mode the module doc's "Percentages" section describes.
    // `equityPercentages` must still land on exactly 100.0%.
    const fakeEquity = {
      heroWinBps: 3334,
      tieBps: 3333,
      villainWinBps: 3333,
      method: 'EXACT',
      runouts: 10000,
    } as ExactEquity;
    const percentages = equityPercentages(fakeEquity);
    const total =
      tenthsOf(percentages.heroPercent) +
      tenthsOf(percentages.tiePercent) +
      tenthsOf(percentages.villainPercent);
    expect(total).toBe(1000);
  });
});

describe('equity method copy — data-driven off `method`, not hard-coded', () => {
  const equity = realEquity('As Ah', 'Ks Kh', '');

  it('labels the method and states the beginner sentence for EXACT', () => {
    expect(equityMethodLabel(equity)).toBe('정확 계산');
    expect(equityMethodSentence(equity)).toContain('가능한 카드 조합으로 모두 계산');
  });

  it('states the enumeration count, grouped for readability, without a hard-coded number', () => {
    expect(equityCountSentence(equity)).toContain(equity.runouts.toLocaleString('ko-KR'));
    expect(equityCountSentence({ ...equity, runouts: 990 } as ExactEquity)).toContain('990');
  });

  it('never mentions GTO', () => {
    expect(equityMethodLabel(equity).toUpperCase()).not.toContain('GTO');
    expect(equityMethodSentence(equity).toUpperCase()).not.toContain('GTO');
    expect(equityCountSentence(equity).toUpperCase()).not.toContain('GTO');
  });
});
