/**
 * Settling a hand in which a contender is all-in.
 *
 * An all-in player winning the pot is the single most ordinary showdown in NLHE, so
 * these are minimal reproductions rather than exotic edge cases.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { BB, buildTable, cards, ids, start } from '../src/testing.js';
import { allIn, call, dealBoard, fold } from '../src/commands.js';
import { awardAllTo, stacks, step } from './_helpers.js';

describe('an all-in contender who wins the pot', () => {
  it('is credited the net pot and ends the hand with chips behind', () => {
    const f = ids();
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: Money.mbb(20000), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);

    hand = step(hand, allIn(), f); // UTG (seat 3) shoves its whole 20 BB
    expect(hand.state.seats[3].status).toBe('ALL_IN');
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB
    hand = step(hand, call(), f); // BB calls the shove

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    // 500 (folded SB) + 20000 + 20000 = 40500
    expect(hand.state.potTotal).toBe(40500);

    // rake = floor(40500 * 5 / 100) = 2025, net 38475.
    hand = step(hand, awardAllTo(hand.state, 3), f);
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.totalRake).toBe(2025);
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99500,
      2: 80000,
      3: 38475,
      4: 100000,
      5: 100000,
    });
  });

  it('a shove only partly called by a shorter stack has the excess returned', () => {
    const f = ids();
    const table = buildTable({
      // The big blind can only cover 40 BB of a 100 BB shove.
      stacks: { 0: BB(100), 1: BB(100), 2: BB(40), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);

    hand = step(hand, allIn(), f); // UTG shoves 100 BB
    expect(hand.state.potTotal).toBe(101500); // 500 + 1000 + 100000
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB
    hand = step(hand, call(), f); // BB calls all-in for its remaining 39000

    // §7.7: top 100000 (UTG alone), second 40000 -> 60000 returned.
    expect(hand.state.seats[3].stack).toBe(60000);
    expect(hand.state.seats[3].totalContribution).toBe(40000);
    expect(hand.state.potTotal).toBe(80500); // 500 + 40000 + 40000
    expect(hand.state.pendingUncalled).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    // rake = floor(80500 * 5 / 100) = 4025, net 76475 to the all-in big blind.
    hand = step(hand, awardAllTo(hand.state, 2), f);
    expect(hand.state.totalRake).toBe(4025);
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99500,
      2: 76475,
      3: 60000,
      4: 100000,
      5: 100000,
    });
  });
});
