import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { allIn, betTo, call, check, dealBoard, fold, raiseTo } from './commands.js';
import {
  computePots,
  computeUncalledReturn,
  potAfterCall,
  potBeforeAction,
  potTotal,
  potsEligibleFor,
  unawardedPots,
} from './pots.js';
import { emptySeatHandState, type SeatHandState } from './state.js';
import { makeBySeat, type SeatIndex } from './seat.js';
import { ANTE_PRESET, BB, buildTable, cards, ids, play, sixHanded, start } from './testing.js';

function seatsWith(entries: readonly (readonly [SeatIndex, number, SeatHandState['status']])[]) {
  const byIndex = new Map(entries.map(([seat, total, status]) => [seat, { total, status }]));
  return makeBySeat<SeatHandState>((seat) => {
    const entry = byIndex.get(seat);
    if (entry === undefined) return emptySeatHandState(seat);
    return {
      ...emptySeatHandState(seat),
      status: entry.status,
      startingStack: BB(100),
      stack: Money.sub(BB(100), Money.mbb(entry.total)),
      totalContribution: Money.mbb(entry.total),
    };
  });
}

describe('layered pot derivation', () => {
  it('collapses to a single main pot when everyone matched', () => {
    const seats = seatsWith([
      [0, 3000, 'IN_HAND'],
      [1, 3000, 'IN_HAND'],
    ]);
    const pots = computePots(seats, [0, 1]);
    expect(pots).toEqual([
      {
        index: 0,
        kind: 'MAIN',
        amount: 6000,
        capLevel: 3000,
        eligibleSeats: [0, 1],
        awarded: false,
      },
    ]);
  });

  it('folds a folded blind into the main pot without giving it eligibility', () => {
    const seats = seatsWith([
      [0, 3000, 'IN_HAND'],
      [1, 500, 'FOLDED'],
      [2, 3000, 'IN_HAND'],
    ]);
    const pots = computePots(seats, [0, 1, 2]);
    expect(pots).toHaveLength(1);
    expect(pots[0]?.amount).toBe(6500);
    expect(pots[0]?.eligibleSeats).toEqual([0, 2]);
  });

  it('builds a side pot when a contender is capped below the others', () => {
    const seats = seatsWith([
      [0, 10000, 'IN_HAND'],
      [1, 4000, 'ALL_IN'],
      [2, 10000, 'IN_HAND'],
    ]);
    const pots = computePots(seats, [0, 1, 2]);
    expect(pots).toEqual([
      {
        index: 0,
        kind: 'MAIN',
        amount: 12000,
        capLevel: 4000,
        eligibleSeats: [0, 1, 2],
        awarded: false,
      },
      {
        index: 1,
        kind: 'SIDE',
        amount: 12000,
        capLevel: 10000,
        eligibleSeats: [0, 2],
        awarded: false,
      },
    ]);
    expect(potTotal(pots)).toBe(24000);
    expect(potsEligibleFor(pots, 1)).toHaveLength(1);
    expect(potsEligibleFor(pots, 0)).toHaveLength(2);
  });

  it('merges a top layer only folded seats reached down into the pot below', () => {
    const seats = seatsWith([
      [0, 5000, 'FOLDED'],
      [1, 3000, 'ALL_IN'],
      [2, 3000, 'IN_HAND'],
    ]);
    const pots = computePots(seats, [0, 1, 2]);
    expect(pots).toHaveLength(1);
    expect(pots[0]?.amount).toBe(11000);
    expect(pots[0]?.eligibleSeats).toEqual([1, 2]);
  });

  it('keeps an ante-sized short stack eligible for exactly the smallest layer', () => {
    const seats = seatsWith([
      [0, 160, 'ALL_IN'],
      [1, 5000, 'IN_HAND'],
      [2, 5000, 'IN_HAND'],
    ]);
    const pots = computePots(seats, [0, 1, 2]);
    expect(pots).toHaveLength(2);
    expect(pots[0]).toMatchObject({ amount: 480, capLevel: 160, eligibleSeats: [0, 1, 2] });
    expect(pots[1]).toMatchObject({ amount: 9680, eligibleSeats: [1, 2] });
  });

  it('drops zero-contribution seats and yields no pot before any money goes in', () => {
    const seats = seatsWith([
      [0, 0, 'IN_HAND'],
      [1, 0, 'IN_HAND'],
    ]);
    expect(computePots(seats, [0, 1])).toEqual([]);
    expect(potTotal([])).toBe(Money.ZERO);
  });
});

describe('uncalled-bet return', () => {
  it('is computed over ALL dealt-in seats, folded included', () => {
    const factory = ids();
    // BTN raises to 3, everyone folds. top = 3 (BTN), second = 1 (the folded BB's post).
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), raiseTo(BB(3)), fold(), fold()],
      factory,
    );
    const returned = hand.events.find((e) => e.kind === 'RETURN_UNCALLED');
    expect(returned).toMatchObject({ kind: 'RETURN_UNCALLED', seat: 0, amount: BB(2) });
    // Pot is 0.5 + 1 + 1 = 2.5, not 1.5 — that is the correct rake basis.
    const awarded = hand.events.find((e) => e.kind === 'POT_AWARDED');
    expect(awarded && 'grossAmount' in awarded ? awarded.grossAmount : null).toBe(BB(2.5));
  });

  it('returns nothing when the top is tied', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), call(), call(), check()],
      factory,
    );
    expect(hand.events.some((e) => e.kind === 'RETURN_UNCALLED')).toBe(false);
    expect(computeUncalledReturn(hand.state)).toBeNull();
  });

  it('returns the excess when a shove is called by a shorter stack', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(40) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [allIn(), fold(), call()], factory); // BTN shoves 100, BB calls all-in 40
    const returned = hand.events.find((e) => e.kind === 'RETURN_UNCALLED');
    expect(returned).toMatchObject({ seat: 0, amount: BB(60) });
    expect(hand.state.seats[0].stack).toBe(BB(60));
    expect(hand.state.seats[0].status).toBe('IN_HAND');
    expect(hand.state.seats[0].totalContribution).toBe(BB(40));
    expect(hand.state.potTotal).toBe(BB(80.5));
    // No phantom side pot: the uncalled money never entered the pot.
    expect(hand.state.pots).toHaveLength(1);
  });

  it('returns the excess to the small blind when a short big blind folds around', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(0.4) }, buttonSeat: 0 });
    let hand = start(table, factory);
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    // The button's fold closes the round on its own: the small blind's 0.5 already covers
    // the all-in big blind's 0.4, so the SB owes nothing and never reaches the clock
    // (spec 7.6). It used to be asked for a phantom `CALL` to 1 BB that was immediately
    // handed back; the money was always the same, the action was not.
    hand = play(hand, [fold()], factory);
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.actions.map((a) => a.kind)).toEqual(['FOLD']);
    const returned = hand.events.find((e) => e.kind === 'RETURN_UNCALLED');
    expect(returned).toMatchObject({ seat: 1, amount: BB(0.1) });
    expect(hand.state.potTotal).toBe(BB(0.8));
  });

  it('never leaves uncalled money in the pot', () => {
    const factory = ids();
    let hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), raiseTo(BB(3)), fold(), call()],
      factory,
    );
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), betTo(BB(4)), fold()], factory);
    expect(hand.state.phase).toBe('COMPLETE');
    const returns = hand.events.filter((e) => e.kind === 'RETURN_UNCALLED');
    expect(returns).toHaveLength(1);
    expect(returns[0]).toMatchObject({ seat: 0, amount: BB(4) });
  });
});

describe('pot denominators', () => {
  it('potBeforeAction is everything committed before the seat on the clock acts', () => {
    const hand = start(sixHanded(ANTE_PRESET), ids());
    expect(potBeforeAction(hand.state)).toBe(Money.mbb(160 * 6 + 1500));
    expect(potBeforeAction(hand.state)).toBe(hand.state.potTotal);
  });

  it('potAfterCall adds exactly the actor’s clamped call', () => {
    const hand = start(sixHanded(), ids());
    expect(potAfterCall(hand.state, 3)).toBe(BB(2.5));
    expect(potAfterCall(hand.state, 2)).toBe(BB(1.5));
  });

  it('unawardedPots shrinks as pots are settled', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(hand.state.pots).toHaveLength(1);
    expect(unawardedPots(hand.state)).toHaveLength(0);
    expect(hand.state.pots[0]?.awarded).toBe(true);
  });
});
