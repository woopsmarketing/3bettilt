/**
 * The between-hands sequence auto top-up is built for: a hand completes, its result is
 * written back to the table, short/busted stacks are topped up, then the button
 * advances. Order matters — top-up must run BEFORE the button search, or a seat it
 * would have revived is wrongly skipped as not dealt in.
 */
import { describe, expect, it } from 'vitest';
import { unwrap } from '@gto-self/shared';
import { allIn, call, dealBoard, fold } from '../src/commands.js';
import {
  advanceButton,
  applyAutoTopUp,
  applyHandResult,
  dealtInSeats,
  type AutoTopUpPolicy,
} from '../src/table.js';
import { BB, buildTable, cards, ids, start } from '../src/testing.js';
import { awardAllTo, step } from './_helpers.js';

/**
 * 3-handed: seat 2 is the button, so preflop order is BTN(2), SB(0), BB(1)
 * (`positions.ts`: `preflopActionOrder` puts the button first for n >= 3). Seat 0 (SB)
 * is a 5 BB short stack that shoves and loses, busting to zero. Physically, seat 0 is
 * also the first occupied seat clockwise from the button (seats 3-5 are empty), so
 * whether it is dealt back in for the button search depends entirely on whether
 * top-up already revived it.
 */
function playBustingHand() {
  const f = ids();
  const table0 = buildTable({ stacks: { 0: BB(5), 1: BB(100), 2: BB(100) }, buttonSeat: 2 });
  let hand = start(table0, f);

  hand = step(hand, fold(), f); // BTN (seat 2) folds
  hand = step(hand, allIn(), f); // SB (seat 0) shoves its whole 5 BB
  hand = step(hand, call(), f); // BB (seat 1) calls
  expect(hand.state.phase).toBe('AWAITING_BOARD');

  hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
  hand = step(hand, dealBoard(cards('2d')), f);
  hand = step(hand, dealBoard(cards('Js')), f);
  expect(hand.state.phase).toBe('AWAITING_AWARD');

  hand = step(hand, awardAllTo(hand.state, 1), f); // BB wins; SB busts
  expect(hand.state.phase).toBe('COMPLETE');
  expect(hand.state.seats[0].stack).toBe(0);

  return { table0, hand, f };
}

describe('applyHandResult -> applyAutoTopUp -> advanceButton', () => {
  it('revives a busted seat in time for it to be eligible for the button', () => {
    const { table0, hand, f } = playBustingHand();

    let table = unwrap(applyHandResult(table0, hand));
    expect(table.seats[0].stack).toBe(0); // written back from the hand, busted
    expect(table.handNumber).toBe(1);
    expect(table.buttonSeat).toBe(2); // applyHandResult never moves the button

    const policy: AutoTopUpPolicy = { enabled: true, targetStack: BB(100), threshold: BB(100) };
    table = unwrap(applyAutoTopUp(table, policy));
    expect(table.seats[0].stack).toBe(BB(100)); // revived before the button search runs

    table = unwrap(advanceButton(table));
    expect(table.buttonSeat).toBe(0); // eligible again, and first clockwise from seat 2

    // The table is ready to deal again.
    expect(dealtInSeats(table)).toEqual([0, 1, 2]);
    const nextHand = start(table, f, 'h2');
    expect(nextHand.state.phase).not.toBe('COMPLETE');
  });

  it('skips the same seat when top-up is not run before the button advances', () => {
    const { table0, hand } = playBustingHand();

    let table = unwrap(applyHandResult(table0, hand));
    table = unwrap(advanceButton(table)); // no top-up in between
    expect(table.buttonSeat).toBe(1); // seat 0 still busted, so it is skipped
  });
});
