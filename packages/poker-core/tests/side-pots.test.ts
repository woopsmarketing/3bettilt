/**
 * Multiway all-ins: side-pot layering, the all-in run-out, and the "no opponent can
 * respond" rule (§7.12, §7.8, §7.2).
 *
 * Board run-out: a street with fewer than two seats able to act is dealt with NOBODY
 * on the clock.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS } from '../src/config.js';
import { allIn, call, dealBoard, fold, raiseTo } from '../src/commands.js';
import { applyCommand } from '../src/hand.js';
import { legalActions } from '../src/betting.js';
import { potsEligibleFor } from '../src/pots.js';
import { seatsAbleToAct } from '../src/state.js';
import { BB, NO_ANTE_PRESET, buildTable, cards, ids, start } from '../src/testing.js';
import { awardAllTo, stacks, step } from './_helpers.js';
import type { SeatIndex } from '../src/seat.js';

/**
 * UTG is all-in for 20 BB, the button covers, the big blind jams 60 BB and the button
 * calls. Contributions end at SB 0.5 (folded), UTG 20, BB 60, BTN 60.
 */
function threeWayAllIn() {
  const f = ids();
  const table = buildTable({
    stacks: {
      0: BB(100),
      1: BB(100),
      2: Money.mbb(60_000),
      3: Money.mbb(20_000),
      4: BB(100),
      5: BB(100),
    },
    buttonSeat: 0,
  });
  let hand = start(table, f);
  hand = step(hand, allIn(), f); // UTG (3) jams 20 BB
  hand = step(hand, fold(), f); // HJ
  hand = step(hand, fold(), f); // CO
  hand = step(hand, call(), f); // BTN (0) calls 20 BB
  hand = step(hand, fold(), f); // SB
  hand = step(hand, allIn(), f); // BB (2) jams its 60 BB
  hand = step(hand, call(), f); // BTN calls the extra 40 BB
  return { hand, f };
}

describe('a three-way all-in', () => {
  it('layers the pot so the short stack is only eligible for what it could cover', () => {
    const { hand } = threeWayAllIn();
    const st = hand.state;

    expect(st.potTotal).toBe(140500); // 500 + 20000 + 60000 + 60000
    expect(st.pendingUncalled).toBeNull(); // BTN and BB matched exactly
    expect(st.seats[3].totalContribution).toBe(20000);
    expect(st.seats[0].stack).toBe(40000);

    // The 20 BB stack can win 0.5 (dead SB) + 3 x 20 = 60.5 BB and no more.
    expect(Money.sum(potsEligibleFor(st.pots, 3).map((p) => p.amount))).toBe(60500);
    for (const pot of potsEligibleFor(st.pots, 3)) {
      expect(pot.eligibleSeats).toEqual([0, 2, 3]);
    }
    // The rest is contested only by the two deep stacks.
    const side = st.pots.filter((p) => !p.eligibleSeats.includes(3));
    expect(Money.sum(side.map((p) => p.amount))).toBe(80000); // 2 x 40 BB
    for (const pot of side) expect(pot.eligibleSeats).toEqual([0, 2]);
    expect(Money.sum(st.pots.map((p) => p.amount))).toBe(140500);
    // The folded small blind funds the main pot but is eligible for nothing.
    expect(potsEligibleFor(st.pots, 1)).toHaveLength(0);
  });

  it('runs the board out with nobody on the clock', () => {
    const { hand: base, f } = threeWayAllIn();
    let hand = base;
    expect(seatsAbleToAct(hand.state)).toEqual([0]); // one lone chipped seat
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('FLOP');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.pendingStreet).toBe('TURN');
    hand = step(hand, dealBoard(cards('2d')), f);
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.pendingStreet).toBe('RIVER');
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.potTotal).toBe(140500);
  });

  it('settles the whole pot to the covering stack', () => {
    const { hand: base, f } = threeWayAllIn();
    let hand = base;
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    // gross 140500 -> 5% = 7025 milliBB -> 7025 / 20 = 351.25 -> 351 cents = 7020,
    // under the 8000 cap.
    hand = step(hand, awardAllTo(hand.state, 0), f);
    expect(hand.state.totalRake).toBe(7020);
    expect(stacks(hand.state)).toEqual({
      0: 173480, // 40000 + 140500 - 7020
      1: 99500,
      2: 0,
      3: 0,
      4: 100000,
      5: 100000,
    });
  });

  it('settles the classic split: short stack takes the main pot, cover takes the side', () => {
    const { hand: base, f } = threeWayAllIn();
    let hand = base;
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    const awards = hand.state.pots.map((p) => ({
      potIndex: p.index,
      winners: [(p.eligibleSeats.includes(3) ? 3 : 0) as SeatIndex],
    }));
    hand = step(hand, { kind: 'AWARD_POTS', awards }, f);

    // Total rake 7020 allocated proportionally:
    //   floor(7020 * 60500 / 140500) = 3022, floor(7020 * 80000 / 140500) = 3997,
    // which sums to 7019; the 1 milliBB floor remainder goes to the main pot -> 3023.
    expect(hand.state.totalRake).toBe(7020);
    expect(stacks(hand.state)).toEqual({
      0: 116003, // 40000 + 80000 - 3997
      1: 99500,
      2: 0,
      3: 57477, // 60500 - 3023
      4: 100000,
      5: 100000,
    });
  });
});

describe('a bet or raise with no opponent left to respond', () => {
  const facingALoneShove = (config = NO_ANTE_PRESET) => {
    const f = ids();
    const table = buildTable({
      config,
      stacks: {
        0: BB(100),
        1: BB(100),
        2: BB(100),
        3: Money.mbb(20_000),
        4: BB(100),
        5: BB(100),
      },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, allIn(), f); // UTG jams 20 BB
    for (let i = 0; i < 4; i += 1) hand = step(hand, fold(), f); // HJ CO BTN SB
    return { hand, f };
  };

  it('is refused by default: the big blind may only call or fold', () => {
    const { hand, f } = facingALoneShove();
    expect(hand.state.actorSeat).toBe(2);
    const legal = legalActions(hand.state, 2);
    expect(legal.canFold).toBe(true);
    expect(legal.call).toMatchObject({ toAmount: 20000, amount: 19000 });
    expect(legal.wager).toBeNull();
    expect(legal.wagerBlockedBy).toBe('NO_OPPONENT_CAN_RESPOND');
    expect(applyCommand(hand, raiseTo(Money.mbb(40_000)), f)).toMatchObject({
      ok: false,
      error: { code: 'NO_OPPONENT_CAN_RESPOND' },
    });
  });

  it('is allowed and refunded when allowRaiseWithNoCaller is on', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, allowRaiseWithNoCaller: true },
    };
    const { hand: base, f } = facingALoneShove(config);
    expect(legalActions(base.state, 2).wager).not.toBeNull();
    const hand = step(base, raiseTo(Money.mbb(40_000)), f);
    // The unmatched 20 BB comes straight back at round close.
    expect(hand.events.find((e) => e.kind === 'RETURN_UNCALLED')).toMatchObject({
      seat: 2,
      amount: 20000,
    });
    expect(hand.state.potTotal).toBe(40500); // 500 + 20000 + 20000
    expect(hand.state.phase).toBe('AWAITING_BOARD');
  });
});

describe('a call for more than the stack', () => {
  it('is stored as CALL with a clamped amount, never rewritten to ALL_IN', () => {
    const f = ids();
    const table = buildTable({
      stacks: {
        0: Money.mbb(20_000),
        1: BB(100),
        2: BB(100),
        3: BB(100),
        4: BB(100),
        5: BB(100),
      },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(50_000)), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    expect(hand.state.actorSeat).toBe(0);
    expect(legalActions(hand.state, 0).call).toMatchObject({
      toAmount: 20000,
      amount: 20000,
      isAllIn: true,
    });

    hand = step(hand, call(), f); // the 20 BB button calls a 50 BB raise
    const event = hand.events[hand.events.length - 1];
    expect(event?.kind).toBe('CALL'); // the verb the user pressed survives
    expect(event).toMatchObject({ seat: 0, toAmount: 20000, amount: 20000 });
    expect(hand.state.seats[0]).toMatchObject({
      stack: 0,
      status: 'ALL_IN',
      streetContribution: 20000,
      lastAction: 'CALL',
    });
  });
});
