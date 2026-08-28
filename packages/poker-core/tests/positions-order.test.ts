/**
 * Blind assignment, position naming and action order for 2..6 dealt in (§7.11).
 *
 * The expected tables come straight from NLHE rules and the §7.11 table:
 *   6  BTN SB BB UTG HJ CO   preflop UTG HJ CO BTN SB BB   postflop SB BB UTG HJ CO BTN
 *   5  BTN SB BB HJ CO       preflop HJ CO BTN SB BB
 *   4  BTN SB BB CO          preflop CO BTN SB BB
 *   3  BTN SB BB             preflop BTN SB BB
 *   2  BTN(+SB) BB           preflop BTN SB  (the button acts first, LAST postflop)
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_OPTIONS } from '../src/config.js';
import { assignBlinds, postflopActionOrder, preflopActionOrder } from '../src/positions.js';
import type { SeatIndex } from '../src/seat.js';
import { call, check, dealBoard, fold } from '../src/commands.js';
import { toView } from '../src/view.js';
import { BB, NO_ANTE_PRESET, buildTable, cards, ids, start } from '../src/testing.js';
import { step } from './_helpers.js';

const table = (seats: readonly SeatIndex[], button: SeatIndex, config = NO_ANTE_PRESET) =>
  buildTable({
    config,
    stacks: Object.fromEntries(seats.map((s) => [s, BB(100)])),
    buttonSeat: button,
  });

const namesOf = (seats: readonly SeatIndex[], button: SeatIndex) => {
  const st = start(table(seats, button), ids()).state;
  return Object.fromEntries(seats.map((s) => [s, st.positions[s]?.position]));
};

describe('position naming', () => {
  it('names six-handed seats BTN SB BB UTG HJ CO clockwise from the button', () => {
    expect(namesOf([0, 1, 2, 3, 4, 5], 0)).toEqual({
      0: 'BTN',
      1: 'SB',
      2: 'BB',
      3: 'UTG',
      4: 'HJ',
      5: 'CO',
    });
  });

  it('drops UTG first five-handed', () => {
    expect(namesOf([0, 1, 2, 3, 4], 0)).toEqual({ 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'HJ', 4: 'CO' });
  });

  it('keeps only CO four-handed', () => {
    expect(namesOf([0, 1, 2, 3], 0)).toEqual({ 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'CO' });
  });

  it('is exactly the three blinds/button three-handed', () => {
    expect(namesOf([0, 1, 2], 0)).toEqual({ 0: 'BTN', 1: 'SB', 2: 'BB' });
  });

  it('anchors the ladder to the button across non-contiguous seats', () => {
    // dealt in 1, 3, 5 with the button on 3: ring order 3, 5, 1.
    expect(namesOf([1, 3, 5], 3)).toEqual({ 3: 'BTN', 5: 'SB', 1: 'BB' });
    // dealt in 0, 2, 4, 5 with the button on 4: ring order 4, 5, 0, 2.
    expect(namesOf([0, 2, 4, 5], 4)).toEqual({ 4: 'BTN', 5: 'SB', 0: 'BB', 2: 'CO' });
  });
});

describe('action order', () => {
  const orders = (seats: readonly SeatIndex[], button: SeatIndex) => {
    const blinds = assignBlinds(seats, button, DEFAULT_RULE_OPTIONS);
    if (!blinds.ok) throw new Error(`assignBlinds failed: ${blinds.error.code}`);
    return {
      blinds: blinds.value,
      preflop: preflopActionOrder(seats, blinds.value),
      postflop: postflopActionOrder(seats, blinds.value),
    };
  };

  it('six-handed', () => {
    const o = orders([0, 1, 2, 3, 4, 5], 0);
    expect(o.blinds).toMatchObject({ smallBlindSeat: 1, bigBlindSeat: 2, headsUp: false });
    expect(o.preflop).toEqual([3, 4, 5, 0, 1, 2]);
    expect(o.postflop).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('five-handed', () => {
    const o = orders([0, 1, 2, 3, 4], 0);
    expect(o.preflop).toEqual([3, 4, 0, 1, 2]);
    expect(o.postflop).toEqual([1, 2, 3, 4, 0]);
  });

  it('four-handed', () => {
    const o = orders([0, 1, 2, 3], 0);
    expect(o.preflop).toEqual([3, 0, 1, 2]);
    expect(o.postflop).toEqual([1, 2, 3, 0]);
  });

  it('three-handed: the button opens preflop and acts last postflop', () => {
    const o = orders([0, 1, 2], 0);
    expect(o.preflop).toEqual([0, 1, 2]);
    expect(o.postflop).toEqual([1, 2, 0]);
  });

  it('non-contiguous four-handed with the button on seat 4', () => {
    const o = orders([0, 2, 4, 5], 4);
    expect(o.blinds).toMatchObject({ smallBlindSeat: 5, bigBlindSeat: 0 });
    expect(o.preflop).toEqual([2, 4, 5, 0]);
    expect(o.postflop).toEqual([5, 0, 2, 4]);
  });
});

describe('heads-up', () => {
  it('puts the small blind on the button and reverses the order after the flop', () => {
    const f = ids();
    let hand = start(table([0, 3], 0), f);
    const st = hand.state;

    expect(st.blinds).toMatchObject({
      buttonSeat: 0,
      smallBlindSeat: 0,
      bigBlindSeat: 3,
      headsUp: true,
    });
    expect(st.seats[0].stack).toBe(99500); // the BUTTON posted the small blind
    expect(st.seats[3].stack).toBe(99000);
    expect(st.potTotal).toBe(1500);
    expect(st.round.actionOrder).toEqual([0, 3]);
    expect(st.actorSeat).toBe(0); // the button acts FIRST preflop

    const view = toView(hand);
    expect(view.seats[0]).toMatchObject({ isButton: true, isSmallBlind: true, position: 'BTN' });
    expect(view.seats[3]).toMatchObject({ isButton: false, isBigBlind: true, position: 'BB' });

    hand = step(hand, call(), f); // the button completes
    expect(hand.state.actorSeat).toBe(3); // the big blind's option
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);

    expect(hand.state.round.actionOrder).toEqual([3, 0]);
    expect(hand.state.actorSeat).toBe(3); // the big blind acts FIRST postflop
  });

  it('lets the heads-up button label be configured to SB without moving the blind', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, headsUpButtonLabel: 'SB' as const },
    };
    const st = start(table([0, 3], 0, config), ids()).state;
    expect(st.positions[0]?.position).toBe('SB');
    expect(st.blinds.smallBlindSeat).toBe(0);
    expect(st.seats[0].streetContribution).toBe(500);
  });

  it('ends a heads-up hand when the button folds its small blind', () => {
    const f = ids();
    let hand = start(table([0, 3], 0), f);
    hand = step(hand, fold(), f);
    expect(hand.state.phase).toBe('COMPLETE');
    // top 1000 (BB), second 500 (folded button) -> 500 returned, pot 1000.
    expect(hand.events.find((e) => e.kind === 'RETURN_UNCALLED')).toMatchObject({
      seat: 3,
      amount: 500,
    });
    expect(hand.state.seats[0].stack).toBe(99500);
    expect(hand.state.seats[3].stack).toBe(100500);
  });
});
