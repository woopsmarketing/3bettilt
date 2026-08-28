import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { allIn, awardPots, betTo, call, check, dealBoard, fold, raiseTo } from './commands.js';
import { applyCommand } from './hand.js';
import {
  autoAwardUncontested,
  handResult,
  oddChipOrder,
  planAwards,
  sawFlop,
  seatResult,
  splitPot,
} from './settlement.js';
import {
  ANTE_PRESET,
  BB,
  NO_ANTE_PRESET,
  buildTable,
  cards,
  errCode,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

function toShowdown(stacks: Record<number, number> = { 0: 100, 1: 100, 2: 100 }) {
  const factory = ids();
  const table = buildTable({
    stacks: Object.fromEntries(Object.entries(stacks).map(([s, v]) => [s, BB(v)])),
    buttonSeat: 0,
  });
  let hand = start(table, factory);
  hand = play(hand, [call(), call(), check()], factory);
  hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), check(), check()], factory);
  hand = play(hand, [dealBoard(cards('2h')), check(), check(), check()], factory);
  hand = play(hand, [dealBoard(cards('9s')), check(), check(), check()], factory);
  return { hand, factory };
}

describe('automatic award when only one contender remains', () => {
  it('awards without asking, with reason ALL_FOLDED', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(hand.state.endReason).toBe('ALL_FOLDED');
    expect(hand.state.awards).toHaveLength(1);
    expect(hand.state.awards[0]?.winners).toEqual([2]);
    expect(hand.state.seats[2].stack).toBe(BB(100.5));
    expect(hand.state.seats[1].stack).toBe(BB(99.5));
  });

  it('refuses to auto-award while more than one contender remains', () => {
    const { hand } = toShowdown();
    expect(errCode(autoAwardUncontested(hand.state))).toBe('NOT_AWAITING_AWARD');
  });
});

describe('user-supplied award at showdown', () => {
  it('pays the winner the pot less the rake', () => {
    const { hand, factory } = toShowdown();
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.potTotal).toBe(BB(3));
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    // 5% of 3 BB = 0.15 BB, floored to 150 milliBB.
    expect(done.state.totalRake).toBe(Money.mbb(150));
    expect(done.state.awards[0]).toMatchObject({
      potIndex: 0,
      winners: [1],
      grossAmount: BB(3),
      rake: Money.mbb(150),
      netAmount: Money.mbb(2850),
    });
    expect(done.state.seats[1].stack).toBe(Money.mbb(100_000 - 1000 + 2850));
    expect(done.state.endReason).toBe('SHOWDOWN');
    expect(done.state.phase).toBe('COMPLETE');
  });

  it('splits a chopped pot evenly and hands the odd milliBB out clockwise from the button', () => {
    const { hand, factory } = toShowdown();
    // Pot 3000, rake 150, net 2850. Split three ways: 950 each, no remainder.
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [0, 1, 2] }])], factory);
    expect(done.state.awards[0]?.shares).toEqual([
      { seat: 1, amount: Money.mbb(950) },
      { seat: 2, amount: Money.mbb(950) },
      { seat: 0, amount: Money.mbb(950) },
    ]);
    expect(Money.sum(done.state.awards[0]?.shares.map((s) => s.amount) ?? [])).toBe(
      Money.mbb(2850),
    );
  });

  it('gives the odd chip to the first winner clockwise from the button', () => {
    const { hand } = toShowdown();
    expect(oddChipOrder(hand.state, [0, 1, 2])).toEqual([1, 2, 0]);
    const shares = splitPot(hand.state, Money.mbb(101), [0, 1, 2]);
    expect(shares).toEqual([
      { seat: 1, amount: Money.mbb(34) },
      { seat: 2, amount: Money.mbb(34) },
      { seat: 0, amount: Money.mbb(33) },
    ]);
    expect(Money.sum(shares.map((s) => s.amount))).toBe(Money.mbb(101));
  });

  it('uses the lowest seat index when the rule says so', () => {
    const factory = ids();
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...NO_ANTE_PRESET.rules, oddChipRule: 'LOWEST_SEAT_INDEX' as const },
    };
    const table = buildTable({
      config,
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100) },
      buttonSeat: 0,
    });
    const hand = start(table, factory);
    expect(oddChipOrder(hand.state, [2, 0, 1])).toEqual([0, 1, 2]);
  });

  it('rejects incomplete, unknown, duplicated and ineligible awards', () => {
    const { hand, factory } = toShowdown();
    expect(errCode(planAwards(hand.state, []))).toBe('AWARDS_INCOMPLETE');
    expect(errCode(planAwards(hand.state, [{ potIndex: 4, winners: [0] }]))).toBe('UNKNOWN_POT');
    expect(
      errCode(
        planAwards(hand.state, [
          { potIndex: 0, winners: [0] },
          { potIndex: 0, winners: [1] },
        ]),
      ),
    ).toBe('POT_ALREADY_AWARDED');
    expect(errCode(planAwards(hand.state, [{ potIndex: 0, winners: [] }]))).toBe('NO_WINNERS');
    expect(errCode(planAwards(hand.state, [{ potIndex: 0, winners: [0, 0] }]))).toBe(
      'DUPLICATE_WINNER',
    );
    expect(errCode(planAwards(hand.state, [{ potIndex: 0, winners: [4] }]))).toBe(
      'WINNER_NOT_ELIGIBLE',
    );
    expect(errCode(applyCommand(hand, awardPots([{ potIndex: 0, winners: [4] }]), factory))).toBe(
      'WINNER_NOT_ELIGIBLE',
    );
  });

  it('refuses an award before the hand is ready for one', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(errCode(applyCommand(hand, awardPots([{ potIndex: 0, winners: [2] }]), factory))).toBe(
      'NOT_AWAITING_AWARD',
    );
  });

  it('refuses a second award once the hand is complete', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    expect(errCode(applyCommand(done, awardPots([{ potIndex: 0, winners: [1] }]), factory))).toBe(
      'HAND_ALREADY_FINISHED',
    );
  });
});

describe('side pots must be awarded together so the cap applies once', () => {
  it('requires every unawarded pot in one command', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(20) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(60)), call(), call()], factory);
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), dealBoard(cards('2h')), check(), check()],
      factory,
    );
    hand = play(hand, [dealBoard(cards('9s')), check(), check()], factory);
    expect(hand.state.pots).toHaveLength(2);
    expect(hand.state.pots[0]).toMatchObject({ amount: BB(60), eligibleSeats: [0, 1, 2] });
    expect(errCode(planAwards(hand.state, [{ potIndex: 0, winners: [2] }]))).toBe(
      'AWARDS_INCOMPLETE',
    );
    const plan = planAwards(hand.state, [
      { potIndex: 0, winners: [2] },
      { potIndex: 1, winners: [1] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('plan failed');
    // Main pot 60 + side pot 80 = 140 BB. The cap applies once to the summed gross:
    // 5% of 140 = 7 BB, still under the 8 BB cap.
    expect(Money.sum(hand.state.pots.map((p) => p.amount))).toBe(BB(140));
    expect(plan.value.totalRake).toBe(BB(7));
    expect(Money.sum(plan.value.records.map((r) => r.rake))).toBe(BB(7));
  });

  it('applies the per-hand cap once across every pot', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(400), 1: BB(400), 2: BB(50) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [allIn(), call(), call()], factory);
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), dealBoard(cards('2h')), dealBoard(cards('9s'))],
      factory,
    );
    const plan = planAwards(hand.state, [
      { potIndex: 0, winners: [2] },
      { potIndex: 1, winners: [1] },
    ]);
    if (!plan.ok) throw new Error('plan failed');
    expect(plan.value.totalRake).toBe(BB(8));
    expect(Money.sum(plan.value.records.map((r) => r.rake))).toBe(BB(8));
  });
});

describe('rake basis and no-flop-no-drop end to end', () => {
  it('takes no rake from a hand that never saw a flop', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(ANTE_PRESET), factory),
      [fold(), fold(), fold(), raiseTo(BB(3)), fold(), fold()],
      factory,
    );
    expect(sawFlop(hand.state)).toBe(false);
    expect(hand.state.totalRake).toBe(Money.ZERO);
  });

  it('rakes the pot AFTER the uncalled bet has been returned', () => {
    const factory = ids();
    let hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), raiseTo(BB(3)), fold(), call()],
      factory,
    );
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), betTo(BB(4)), fold()], factory);
    // BB bet 4 and BTN folded: the 4 is returned, so the raked pot is 6.5, not 10.5.
    expect(hand.state.awards[0]?.grossAmount).toBe(BB(6.5));
    expect(hand.state.totalRake).toBe(Money.mbb(325));
  });
});

describe('hand and seat results', () => {
  it('balances: every seat’s net plus the rake sums to zero', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    const result = handResult(done.state);
    expect(result).not.toBeNull();
    if (result === null) throw new Error('no result');
    expect(Money.add(Money.sum(result.seats.map((s) => s.net)), result.totalRake)).toBe(Money.ZERO);
    expect(result.reason).toBe('SHOWDOWN');
  });

  it('attributes rake to the seats that won the raked pot', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    expect(seatResult(done.state, 1)).toMatchObject({
      startingStack: BB(100),
      contributed: BB(1),
      wonGross: BB(3),
      rakePaid: Money.mbb(150),
      net: Money.mbb(1850),
    });
    expect(seatResult(done.state, 0).rakePaid).toBe(Money.ZERO);
  });

  it('splits the rake attribution across joint winners', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [0, 1, 2] }])], factory);
    const rakes = done.state.dealtInSeats.map((s) => done.state.seats[s].rakePaid);
    expect(Money.sum(rakes)).toBe(Money.mbb(150));
    expect(rakes).toEqual([Money.mbb(50), Money.mbb(50), Money.mbb(50)]);
  });

  it('reports an honest net before the hand is complete', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    const result = handResult(hand.state);
    expect(result?.totalRake).toBe(Money.ZERO);
    expect(result?.seats.find((s) => s.seat === 1)?.net).toBe(BB(-1));
  });
});
