/**
 * Evaluator edge-case verification for WP-F2A.
 *
 * The evaluator itself (`packages/strategy-core/src/analysis/evaluate.ts`) is READ-ONLY for
 * FishTilt and already carries a thorough test suite (`evaluate.test.ts`,
 * `evaluateExhaustive.test.ts`) — most of the beginner-facing edge cases a Hand Checker /
 * Equity Calculator must get right are already pinned there, sometimes framed as a single
 * decomposed hand rather than two players at a table. This file adds ONLY the cases that
 * were not already unambiguously covered as a genuine two-player showdown, exercised through
 * the exact functions FishTilt calls: `exactHeadsUpEquity` (the equity calculator) and
 * `bestFiveOf` (the hand checker's "which five cards played" display, re-exported by
 * `strategy-core` and read here, never modified).
 *
 * Every spot below is a RIVER (5-card board), so `runouts` is always exactly 1 — the result
 * is a deterministic fact about one specific deal, not a probability, which makes the
 * assertion a plain equality rather than a tolerance check.
 *
 * See `docs/reports/WP_F2A_EQUITY_CORE.md` §5 for the full per-case verdict table, including
 * the cases that needed no new test here because `evaluate.test.ts` already covers them.
 */
import { describe, expect, it } from 'vitest';
import { parseCards, unwrap, type Card } from '@gto-self/shared';
import { bestFiveOf } from '@gto-self/strategy-core';
import { exactHeadsUpEquity } from './exact.js';

const cards = (text: string): Card[] => unwrap(parseCards(text));

describe('evaluator edge cases — flush ties', () => {
  it('splits when the board itself deals a 5-card flush and neither hand improves it', () => {
    // 2h 5h 7h 9h Jh is already a made flush on its own; hero and villain hold no hearts at
    // all, so neither can replace a single card of it. Both hands are, card for card, the
    // board's own flush — the strongest possible form of "identical flush, split pot".
    const board = 'Jh9h7h5h2h';
    const hero = 'AsKd';
    const villain = 'AcKc';

    const r = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));
    expect(r.runouts).toBe(1);
    expect([r.wins, r.ties, r.losses]).toEqual([0, 1, 0]);
    expect(r.equity).toBe(0.5);

    const heroBest = bestFiveOf([...cards(board), ...cards(hero)]);
    const villainBest = bestFiveOf([...cards(board), ...cards(villain)]);
    expect(heroBest.value.category).toBe('FLUSH');
    expect(villainBest.value.category).toBe('FLUSH');
    expect(heroBest.value.ranks).toEqual(villainBest.value.ranks);
    // Both hands' best five are literally the board's five cards, in the order it was dealt.
    expect(heroBest.cards).toEqual(cards(board));
    expect(villainBest.cards).toEqual(cards(board));
  });
});

describe('evaluator edge cases — full house vs full house, both from trips', () => {
  it('decides on the higher TRIP rank, even when the loser holds the higher pair rank', () => {
    // Board pairs 9s and 4s. Hero's 9 makes trip nines (pair 4s from the board); villain's 4
    // makes trip fours (pair 9s from the board). Villain's PAIR component (99) outranks
    // hero's (44), but full houses compare the trip rank first — hero's trip nines beats
    // villain's trip fours regardless, which is the exact rule this case exists to pin.
    const board = '9h9d4s4c2h';
    const hero = '9cKd'; // trip nines, pair fours: NINES full of FOURS
    const villain = '4dQc'; // trip fours, pair nines: FOURS full of NINES

    const r = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));
    expect(r.runouts).toBe(1);
    expect([r.wins, r.ties, r.losses]).toEqual([1, 0, 0]);

    const heroBest = bestFiveOf([...cards(board), ...cards(hero)]);
    const villainBest = bestFiveOf([...cards(board), ...cards(villain)]);
    expect(heroBest.value.category).toBe('FULL_HOUSE');
    expect(villainBest.value.category).toBe('FULL_HOUSE');
    expect(heroBest.value.ranks).toEqual([7, 2]); // trips '9' (index 7), pair '4' (index 2)
    expect(villainBest.value.ranks).toEqual([2, 7]); // trips '4', pair '9'
    expect(heroBest.value.strength).toBeGreaterThan(villainBest.value.strength);
  });
});

describe('evaluator edge cases — paired-board interactions', () => {
  it('two pair from a shared board pair: the higher hole-card top pair decides, not the kicker', () => {
    // Board carries one pair (77). Hero's king pairs the board's lone king for K-over-7;
    // villain's pocket queens pair with the board's 77 for Q-over-7. Hero's TOP PAIR rank
    // (K) beats villain's (Q) even though villain's pocket pair (QQ) alone outranks hero's
    // unpaired kicker (A) — the two-pair comparison is decided by the higher pair first.
    const board = 'Ks7h7d3c2s';
    const hero = 'AhKd'; // K (matches board K) + 7 (board pair): KINGS AND SEVENS, kicker ACE
    const villain = 'QhQd'; // pocket queens + 7 (board pair): QUEENS AND SEVENS, kicker KING

    const r = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));
    expect(r.runouts).toBe(1);
    expect([r.wins, r.ties, r.losses]).toEqual([1, 0, 0]);

    const heroBest = bestFiveOf([...cards(board), ...cards(hero)]);
    const villainBest = bestFiveOf([...cards(board), ...cards(villain)]);
    expect(heroBest.value.category).toBe('TWO_PAIR');
    expect(villainBest.value.category).toBe('TWO_PAIR');
    expect(heroBest.value.ranks).toEqual([11, 5, 12]); // K over 7, kicker A
    expect(villainBest.value.ranks).toEqual([10, 5, 11]); // Q over 7, kicker K
  });
});
