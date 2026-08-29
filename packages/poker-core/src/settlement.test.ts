import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { allIn, awardPots, betTo, call, check, dealBoard, fold, raiseTo } from './commands.js';
import { applyCommand, replayHand } from './hand.js';
import type { TableConfig } from './config.js';
import type { HandEvent } from './events.js';
import { assertChipConservation, assertSeatLedgers, foldEvents } from './reduce.js';
import { jsonRoundTrip } from './serialization.js';
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
    // 5% of 3 BB is 150 milliBB, quantized to the nearest 20: 150 / 20 = 7.5, a tie,
    // which rounds AWAY from zero to 8 cents = 160. Fee ZERO under the shipped policy.
    expect(done.state.totalRake).toBe(Money.mbb(160));
    expect(done.state.totalFees).toBe(Money.ZERO);
    expect(done.state.awards[0]).toMatchObject({
      potIndex: 0,
      winners: [1],
      grossAmount: BB(3),
      rake: Money.mbb(160),
      fee: Money.ZERO,
      netAmount: Money.mbb(2840),
    });
    expect(done.state.seats[1].stack).toBe(Money.mbb(100_000 - 1000 + 2840));
    expect(done.state.endReason).toBe('SHOWDOWN');
    expect(done.state.phase).toBe('COMPLETE');
  });

  it('splits a chopped pot evenly and hands the odd milliBB out clockwise from the button', () => {
    const { hand, factory } = toShowdown();
    // Pot 3000, rake 160, net 2840. Split three ways: 946 each with 2 milliBB over,
    // handed out one each clockwise from the button.
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [0, 1, 2] }])], factory);
    expect(done.state.awards[0]?.shares).toEqual([
      { seat: 1, amount: Money.mbb(947) },
      { seat: 2, amount: Money.mbb(947) },
      { seat: 0, amount: Money.mbb(946) },
    ]);
    expect(Money.sum(done.state.awards[0]?.shares.map((s) => s.amount) ?? [])).toBe(
      Money.mbb(2840),
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
    // 5% of 6500 is 325 milliBB; 325 / 20 = 16.25 -> 16 cents = 320.
    expect(hand.state.totalRake).toBe(Money.mbb(320));
  });
});

describe('hand and seat results', () => {
  it('balances: every seat’s net plus the rake sums to zero', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    const result = handResult(done.state);
    expect(result).not.toBeNull();
    if (result === null) throw new Error('no result');
    const deducted = Money.add(result.totalRake, result.totalFees);
    expect(Money.add(Money.sum(result.seats.map((s) => s.net)), deducted)).toBe(Money.ZERO);
    expect(result.reason).toBe('SHOWDOWN');
  });

  it('attributes rake to the seats that won the raked pot', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    expect(seatResult(done.state, 1)).toMatchObject({
      startingStack: BB(100),
      contributed: BB(1),
      wonGross: BB(3),
      rakePaid: Money.mbb(160),
      feePaid: Money.ZERO,
      net: Money.mbb(1840),
    });
    expect(seatResult(done.state, 0).rakePaid).toBe(Money.ZERO);
    expect(seatResult(done.state, 0).feePaid).toBe(Money.ZERO);
  });

  it('splits the rake attribution across joint winners', () => {
    const { hand, factory } = toShowdown();
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [0, 1, 2] }])], factory);
    const rakes = done.state.dealtInSeats.map((s) => done.state.seats[s].rakePaid);
    // 160 across three winners is 53 each with 1 over; the odd milliBB follows the same
    // clockwise order as the pot shares, so seat 1 carries it.
    expect(Money.sum(rakes)).toBe(Money.mbb(160));
    expect(rakes).toEqual([Money.mbb(53), Money.mbb(54), Money.mbb(53)]);
  });

  it('reports an honest net before the hand is complete', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    const result = handResult(hand.state);
    expect(result?.totalRake).toBe(Money.ZERO);
    expect(result?.seats.find((s) => s.seat === 1)?.net).toBe(BB(-1));
  });
});

// ---------------------------------------------------------------------------
// Splash fee. A SEPARATE deduction from the pot payout, never folded into the rake
// (ADR-0018, confirmed by ADR-0032). There is no automatic trigger, so every fee below
// is supplied by the caller exactly as the user observed it.
// ---------------------------------------------------------------------------

const MANUAL_FEE: TableConfig = {
  ...NO_ANTE_PRESET,
  fee: { ...NO_ANTE_PRESET.fee, triggerPolicy: 'MANUAL' },
};

/** Three limped stacks to a checked-down river: one 3 BB pot, flop seen. */
function limpedShowdown(config: TableConfig) {
  const factory = ids();
  const table = buildTable({
    config,
    stacks: { 0: BB(100), 1: BB(100), 2: BB(100) },
    buttonSeat: 0,
  });
  let hand = start(table, factory);
  hand = play(hand, [call(), call(), check()], factory);
  hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), check(), check()], factory);
  hand = play(hand, [dealBoard(cards('2h')), check(), check(), check()], factory);
  hand = play(hand, [dealBoard(cards('9s')), check(), check(), check()], factory);
  return { hand, factory };
}

/** Every prefix of the log must satisfy both standing money identities. */
function assertEveryPrefixBalances(events: readonly HandEvent[]): void {
  for (let length = 1; length <= events.length; length += 1) {
    const state = foldEvents(events.slice(0, length));
    assertSeatLedgers(state);
    assertChipConservation(state);
  }
}

describe('a hand settled with a manually supplied fee', () => {
  it('records the fee separately from the rake and pays the difference', () => {
    const { hand, factory } = limpedShowdown(MANUAL_FEE);
    expect(hand.state.potTotal).toBe(BB(3));
    // 5% of 3000 is 150 -> 8 cents = 160 rake. The user then reports a 250 milliBB fee.
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(250))], factory);

    expect(done.state.totalRake).toBe(Money.mbb(160));
    expect(done.state.totalFees).toBe(Money.mbb(250));
    expect(done.state.awards[0]).toMatchObject({
      grossAmount: BB(3),
      rake: Money.mbb(160),
      fee: Money.mbb(250),
      netAmount: Money.mbb(3000 - 160 - 250),
    });
    // The fee is kept EXACTLY as entered even though it is not a whole cent.
    expect(Money.mbb(250) % MANUAL_FEE.rake.quantum).not.toBe(0);
  });

  it('keeps the seat ledger and chip conservation after EVERY event', () => {
    const { hand, factory } = limpedShowdown(MANUAL_FEE);
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(250))], factory);
    expect(() => assertEveryPrefixBalances(done.events)).not.toThrow();

    const winner = seatResult(done.state, 1);
    expect(winner).toMatchObject({
      contributed: BB(1),
      wonGross: BB(3),
      rakePaid: Money.mbb(160),
      feePaid: Money.mbb(250),
      net: Money.mbb(3000 - 1000 - 160 - 250),
    });
    // stack === startingStack - contributed + wonGross - rakePaid - feePaid
    expect(done.state.seats[1].stack).toBe(Money.mbb(100_000 - 1000 + 3000 - 160 - 250));
  });

  it('balances: seat nets plus rake plus fees sum to zero', () => {
    const { hand, factory } = limpedShowdown(MANUAL_FEE);
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(250))], factory);
    const result = handResult(done.state);
    if (result === null) throw new Error('no result');
    const nets = Money.sum(result.seats.map((seat) => seat.net));
    expect(Money.add(nets, Money.add(result.totalRake, result.totalFees))).toBe(Money.ZERO);
    // Dropping the fee from the identity would NOT balance — the two are distinct money.
    expect(Money.add(nets, result.totalRake)).not.toBe(Money.ZERO);
  });

  it('survives STRICT replay: the fee is recovered from the recorded per-pot amounts', () => {
    const { hand, factory } = limpedShowdown(MANUAL_FEE);
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(250))], factory);
    // `replayHand` re-derives the AWARD_POTS command from the log and re-validates it.
    // If the reconstructed command dropped the fee, the re-emitted events would differ.
    const replayed = replayHand(done.events);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.value.state.totalFees).toBe(Money.mbb(250));
    expect(replayed.value.state.totalRake).toBe(Money.mbb(160));

    // A hand with NO fee replays too, even though 'NEVER' would reject a supplied one.
    const plainSetup = limpedShowdown(NO_ANTE_PRESET);
    const plain = play(
      plainSetup.hand,
      [awardPots([{ potIndex: 0, winners: [1] }])],
      plainSetup.factory,
    );
    const replayedPlain = replayHand(plain.events);
    expect(replayedPlain.ok).toBe(true);
    if (!replayedPlain.ok) throw new Error(replayedPlain.error.message);
    expect(replayedPlain.value.state.totalFees).toBe(Money.ZERO);
  });

  it('records the fee in HAND_FINISHED and survives a JSON round trip', () => {
    const { hand, factory } = limpedShowdown(MANUAL_FEE);
    const done = play(hand, [awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(250))], factory);
    expect(done.events.find((event) => event.kind === 'HAND_FINISHED')).toMatchObject({
      totalRake: Money.mbb(160),
      totalFees: Money.mbb(250),
    });
    const round = jsonRoundTrip(done.events);
    expect(round.ok).toBe(true);
    if (!round.ok) throw new Error(round.error.message);
    expect(foldEvents(round.value).totalFees).toBe(Money.mbb(250));
  });

  it('splits one hand fee across side pots without over-charging any of them', () => {
    const factory = ids();
    // BTN 100 BB covers everyone; the SB is all-in for 20 and the BB for 60, so the
    // BTN's excess over 60 comes back and two pots form.
    const table = buildTable({
      config: MANUAL_FEE,
      stacks: { 0: BB(100), 1: BB(20), 2: BB(60) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [allIn(), allIn(), allIn()], factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c')), dealBoard(cards('2h'))], factory);
    hand = play(hand, [dealBoard(cards('9s'))], factory);

    // main 3 x 20000 = 60000 (all three eligible); side 2 x 40000 = 80000 ({0, 2}).
    expect(hand.state.pots.map((pot) => pot.amount)).toEqual([BB(60), BB(80)]);
    expect(hand.state.potTotal).toBe(BB(140));

    const done = play(
      hand,
      [
        awardPots(
          [
            { potIndex: 0, winners: [1] },
            { potIndex: 1, winners: [0] },
          ],
          Money.mbb(5000),
        ),
      ],
      factory,
    );

    // 5% of 140000 is 7000 = 350 cents exactly; proportional 3000 / 4000.
    expect(done.state.totalRake).toBe(Money.mbb(7000));
    // Fee 5000 proportional on the GROSS amounts: floor(5000 * 60000 / 140000) = 2142 and
    // floor(5000 * 80000 / 140000) = 2857 sum to 4999, so the 1 milliBB floor remainder
    // lands on the main pot -> 2143.
    expect(done.state.totalFees).toBe(Money.mbb(5000));
    expect(done.state.awards.map((award) => [award.rake, award.fee])).toEqual([
      [Money.mbb(3000), Money.mbb(2143)],
      [Money.mbb(4000), Money.mbb(2857)],
    ]);
    // No pot is charged more than it holds, so no net award is ever negative.
    for (const award of done.state.awards) {
      expect(Money.add(award.rake, award.fee)).toBeLessThanOrEqual(award.grossAmount);
      expect(award.netAmount).toBe(Money.sub(award.grossAmount, Money.add(award.rake, award.fee)));
      expect(award.netAmount).toBeGreaterThan(0);
    }
    expect(done.state.seats[1].stack).toBe(Money.mbb(60_000 - 3000 - 2143));
    expect(done.state.seats[0].stack).toBe(Money.mbb(40_000 + 80_000 - 4000 - 2857));
    expect(() => assertEveryPrefixBalances(done.events)).not.toThrow();
  });
});

describe('every fee rejection path is a Result, and the hand is left untouched', () => {
  const supplyFee = (config: TableConfig, fee: number) => {
    const { hand, factory } = limpedShowdown(config);
    const result = applyCommand(
      hand,
      awardPots([{ potIndex: 0, winners: [1] }], Money.mbb(fee)),
      factory,
    );
    return { hand, result };
  };

  it("refuses a fee while the policy is 'NEVER'", () => {
    const { hand, result } = supplyFee(NO_ANTE_PRESET, 250);
    expect(errCode(result)).toBe('FEE_NOT_ALLOWED');
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.totalFees).toBe(Money.ZERO);
  });

  it('refuses a negative fee', () => {
    expect(errCode(supplyFee(MANUAL_FEE, -1).result)).toBe('FEE_NEGATIVE');
    expect(errCode(supplyFee(NO_ANTE_PRESET, -1).result)).toBe('FEE_NEGATIVE');
  });

  it('refuses a fee above the configured cap', () => {
    expect(MANUAL_FEE.fee.cap).toBe(Money.mbb(8000));
    expect(errCode(supplyFee(MANUAL_FEE, 8001).result)).toBe('FEE_ABOVE_CAP');
  });

  it('refuses a fee that, with the rake, would exceed the pot', () => {
    // Pot 3000, rake 160 -> 2840 is all that is left to take.
    expect(errCode(supplyFee(MANUAL_FEE, 2841).result)).toBe('FEE_EXCEEDS_POT');
    expect(supplyFee(MANUAL_FEE, 2840).result.ok).toBe(true);
  });

  it('accepts an explicit zero fee under every policy, because zero is not a fee', () => {
    expect(supplyFee(MANUAL_FEE, 0).result.ok).toBe(true);
    expect(supplyFee(NO_ANTE_PRESET, 0).result.ok).toBe(true);
  });

  it('records no fee when an uncontested pot is auto-awarded, and says so', () => {
    // The engine cascade has no user command to carry an observed fee, so an all-folded
    // hand under 'MANUAL' settles with totalFees ZERO. Stated limitation, not a rule.
    const factory = ids();
    const done = play(
      start(sixHanded(MANUAL_FEE), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(done.state.phase).toBe('COMPLETE');
    expect(done.state.totalFees).toBe(Money.ZERO);

    // ...and the planner itself does accept one, so a caller that HAS observed a fee
    // (Phase 11) needs no new signature. Replaying the log up to the point just before
    // the automatic award reproduces exactly the state the cascade planned from.
    const awardIndex = done.events.findIndex((event) => event.kind === 'POT_AWARDED');
    expect(awardIndex).toBeGreaterThan(0);
    const beforeAward = foldEvents(done.events.slice(0, awardIndex));
    const plan = autoAwardUncontested(beforeAward, Money.mbb(100));
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error(plan.error.message);
    expect(plan.value.totalFees).toBe(Money.mbb(100));
    expect(plan.value.records[0]?.fee).toBe(Money.mbb(100));
  });
});
