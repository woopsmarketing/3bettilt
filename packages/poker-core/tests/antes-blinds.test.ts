/**
 * Antes and blinds. NL50 ante preset: 0.16 BB = 160 milliBB per dealt-in player,
 * posted in ring order from the small blind, BEFORE the blinds (§7.9).
 *
 * The load-bearing rule: an ante raises deadContribution and totalContribution but NOT
 * streetContribution — you do not call an ante.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { ANTE_PRESET, BB, buildTable, cards, ids, sixHanded, start } from '../src/testing.js';
import { callAmount } from '../src/betting.js';
import { dealBoard, fold } from '../src/commands.js';
import { awardAllTo, seatMoney, stacks, step } from './_helpers.js';
import type { SeatIndex } from '../src/seat.js';

describe('ante mode, six dealt in', () => {
  it('puts 6 x 0.16 BB = 0.96 BB in before the blinds', () => {
    const f = ids();
    const hand = start(sixHanded(ANTE_PRESET), f);
    const st = hand.state;

    // 960 (antes) + 500 (SB) + 1000 (BB) = 2460
    expect(st.potTotal).toBe(2460);

    // Antes are dead money: they never touch streetContribution.
    for (const seat of [0, 3, 4, 5] as const) {
      expect(seatMoney(st, seat)).toEqual({ stack: 99840, street: 0, total: 160 });
      expect(st.seats[seat].deadContribution).toBe(160);
    }
    expect(seatMoney(st, 1)).toEqual({ stack: 99340, street: 500, total: 660 });
    expect(st.seats[1].deadContribution).toBe(160);
    expect(seatMoney(st, 2)).toEqual({ stack: 98840, street: 1000, total: 1160 });
    expect(st.seats[2].deadContribution).toBe(160);

    // The price of entry is still one big blind — the ante is not part of the call.
    expect(st.round.currentBet).toBe(1000);
    expect(callAmount(st, 3)).toBe(1000);
    expect(callAmount(st, 1)).toBe(500);
    expect(callAmount(st, 2)).toBe(0);
  });

  it('posts the antes in ring order from the small blind, before SB and BB', () => {
    const f = ids();
    const hand = start(sixHanded(ANTE_PRESET), f);
    const posts = hand.events.filter(
      (e) => e.kind === 'POST_ANTE' || e.kind === 'POST_SB' || e.kind === 'POST_BB',
    );
    expect(posts.map((e) => `${e.kind}:${'seat' in e ? e.seat : ''}`)).toEqual([
      'POST_ANTE:1',
      'POST_ANTE:2',
      'POST_ANTE:3',
      'POST_ANTE:4',
      'POST_ANTE:5',
      'POST_ANTE:0',
      'POST_SB:1',
      'POST_BB:2',
    ]);
  });
});

describe('ante mode, four dealt in', () => {
  it('puts 4 x 0.16 BB = 0.64 BB in and names CO / BTN / SB / BB', () => {
    const f = ids();
    const table = buildTable({
      config: ANTE_PRESET,
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) },
      buttonSeat: 0,
    });
    const st = start(table, f).state;

    expect(st.potTotal).toBe(640 + 500 + 1000);
    expect(st.dealtInSeats).toEqual([0, 1, 2, 3]);
    expect(st.positions[0]?.position).toBe('BTN');
    expect(st.positions[1]?.position).toBe('SB');
    expect(st.positions[2]?.position).toBe('BB');
    expect(st.positions[3]?.position).toBe('CO');
    expect(st.round.actionOrder).toEqual([3, 0, 1, 2]);
    expect(st.actorSeat).toBe(3);
  });
});

describe('a player all-in from the big blind for less than a full blind', () => {
  // rules.shortBlindSetsFullLevel (default true): the nominal big blind still sets the price.
  it('sets the price at 1 BB and returns the small blind its overcall', () => {
    const f = ids();
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: Money.mbb(400), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);

    // The BB could only post 400 of its 1000.
    expect(seatMoney(hand.state, 2)).toEqual({ stack: 0, street: 400, total: 400 });
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    expect(hand.state.potTotal).toBe(900); // 500 + 400
    // The short blind does NOT lower the price of entry.
    expect(hand.state.round.currentBet).toBe(1000);
    expect(callAmount(hand.state, 3)).toBe(1000);

    hand = step(hand, fold(), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN

    // §7.6: the button's fold closes the round. The SB's 500 already covers the only
    // opponent left — an all-in big blind for 400 — so the SB owes nothing and nobody can
    // raise it. It is NOT put on the clock, and no phantom CALL is recorded.
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.actions.map((a) => a.kind)).toEqual(['FOLD', 'FOLD', 'FOLD', 'FOLD']);

    // §7.7: top 500 (SB alone), second 400 -> 100 returned to the SB. The nominal 1 BB
    // price of entry still applied to everyone who actually faced action.
    expect(hand.state.pendingUncalled).toBeNull();
    expect(seatMoney(hand.state, 1)).toEqual({ stack: 99600, street: 400, total: 400 });
    expect(hand.state.potTotal).toBe(800);
    // Two contenders remain (one all-in), so the board must still run out.
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.pots).toHaveLength(1);
    expect(hand.state.pots[0]?.amount).toBe(800);
    expect(hand.state.pots[0]?.eligibleSeats).toEqual([1, 2]);

    // gross 800, saw a flop -> rake floor(800 * 5 / 100) = 40, net 760.
    hand = step(hand, awardAllTo(hand.state, 2), f);
    expect(hand.state.totalRake).toBe(40);
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99600,
      2: 760,
      3: 100000,
      4: 100000,
      5: 100000,
    });
  });
});

describe('a player all-in from the ante itself', () => {
  it('is eligible for exactly the smallest pot layer', () => {
    const f = ids();
    const table = buildTable({
      config: ANTE_PRESET,
      // seat 4 (HJ) cannot even cover the 160 ante.
      stacks: {
        0: BB(100),
        1: BB(100),
        2: BB(100),
        3: BB(100),
        4: Money.mbb(100),
        5: BB(100),
      },
      buttonSeat: 0,
    });
    let hand = start(table, f);

    expect(seatMoney(hand.state, 4)).toEqual({ stack: 0, street: 0, total: 100 });
    expect(hand.state.seats[4].status).toBe('ALL_IN');
    expect(hand.state.seats[4].deadContribution).toBe(100);
    // 5 x 160 + 100 + 500 + 1000 = 2400
    expect(hand.state.potTotal).toBe(2400);
    // An all-in seat is never put on the clock.
    expect(hand.state.actorSeat).toBe(3);

    hand = step(hand, fold(), f); // UTG (seat 3)
    // HJ (seat 4) is all-in and must be skipped entirely.
    expect(hand.state.actorSeat).toBe(5);
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB

    // BB and the ante-all-in seat are the two contenders. The BB's 1000 is uncalled
    // down to the SB's 500 (antes are dead, not street money).
    expect(seatMoney(hand.state, 2)).toEqual({ stack: 99340, street: 500, total: 660 });
    expect(hand.state.potTotal).toBe(1900);
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');

    // Levels 100 / 160 / 660. The all-in ante seat only reaches the 100 layer:
    // 6 seats x 100 = 600.
    const pots = hand.state.pots;
    expect(pots[0]?.amount).toBe(600);
    expect(pots[0]?.eligibleSeats).toEqual([2, 4]);
    const rest = pots.slice(1);
    expect(Money.sum(rest.map((p) => p.amount))).toBe(1300);
    for (const pot of rest) expect(pot.eligibleSeats).toEqual([2]);

    // Total gross 1900, saw a flop -> rake floor(95) = 95, split proportionally.
    const awards = pots.map((p) => ({
      potIndex: p.index,
      winners: [(p.index === 0 ? 4 : 2) as SeatIndex],
    }));
    hand = step(hand, { kind: 'AWARD_POTS', awards }, f);
    expect(hand.state.totalRake).toBe(95);
    expect(stacks(hand.state)).toEqual({
      0: 99840,
      1: 99340,
      2: 100575,
      3: 99840,
      4: 570, // 600 - 30 proportional rake
      5: 99840,
    });
  });
});
