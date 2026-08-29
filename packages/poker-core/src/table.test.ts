import { describe, expect, it } from 'vitest';
import { asId, Money, unwrap, type PlayerId } from '@gto-self/shared';
import {
  advanceButton,
  applyAutoTopUp,
  applyHandResult,
  createTable,
  dealtInSeats,
  defaultAutoTopUpPolicy,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  setSeatOccupancy,
  setSeatStack,
  tableSeatAt,
  topUpPlan,
  vacateSeat,
  type AutoTopUpPolicy,
} from './table.js';
import { NO_ANTE_PRESET, BB, buildTable, errCode, ids, play, start } from './testing.js';
import { fold } from './commands.js';

const player = (name: string): PlayerId => asId<'Player'>(name) as PlayerId;

describe('table setup', () => {
  it('starts with six empty seats, no button and no hero', () => {
    const table = unwrap(createTable(NO_ANTE_PRESET));
    expect(table.buttonSeat).toBeNull();
    expect(table.heroSeat).toBeNull();
    expect(table.handNumber).toBe(0);
    expect(dealtInSeats(table)).toEqual([]);
    expect(tableSeatAt(table, 3)).toEqual({
      seat: 3,
      occupancy: 'EMPTY',
      playerId: null,
      stack: Money.ZERO,
    });
  });

  it('refuses an invalid config', () => {
    expect(errCode(createTable({ ...NO_ANTE_PRESET, minBet: Money.ZERO }))).toBe('INVALID_CONFIG');
  });

  it('seats players and refuses to double-seat or seat a zero stack', () => {
    let table = unwrap(createTable(NO_ANTE_PRESET));
    table = unwrap(seatPlayer(table, 2, player('a'), BB(100)));
    expect(errCode(seatPlayer(table, 2, player('b'), BB(100)))).toBe('SEAT_OCCUPIED');
    expect(errCode(seatPlayer(table, 3, player('b'), Money.ZERO))).toBe('STACK_NOT_POSITIVE');
    expect(errCode(seatPlayer(table, 3, player('b'), 1.5 as never))).toBe('AMOUNT_OUT_OF_RANGE');
  });
});

describe('seat mutation', () => {
  const seated = buildTable({ stacks: { 0: BB(100), 2: BB(50), 4: BB(75) }, buttonSeat: 0 });

  it('excludes SITTING_OUT and EMPTY seats from the deal', () => {
    const out = unwrap(setSeatOccupancy(seated, 2, 'SITTING_OUT'));
    expect(dealtInSeats(out)).toEqual([0, 4]);
    const back = unwrap(setSeatOccupancy(out, 2, 'ACTIVE'));
    expect(dealtInSeats(back)).toEqual([0, 2, 4]);
  });

  it('excludes a zero stack from the deal without emptying the seat', () => {
    const busted = unwrap(setSeatStack(seated, 2, Money.ZERO));
    expect(dealtInSeats(busted)).toEqual([0, 4]);
    expect(tableSeatAt(busted, 2).playerId).not.toBeNull();
  });

  it('allows a zero stack but not a negative or out-of-range one', () => {
    expect(unwrap(setSeatStack(seated, 2, Money.ZERO)).seats[2].stack).toBe(0);
    expect(errCode(setSeatStack(seated, 2, Money.mbb(-1)))).toBe('STACK_NEGATIVE');
    expect(errCode(setSeatStack(seated, 2, 2.5 as never))).toBe('AMOUNT_OUT_OF_RANGE');
    expect(errCode(setSeatStack(seated, 1, BB(10)))).toBe('SEAT_EMPTY');
  });

  it('vacating clears hero and the button', () => {
    const withHero = unwrap(setHeroSeat(seated, 0));
    const vacated = vacateSeat(withHero, 0);
    expect(vacated.heroSeat).toBeNull();
    expect(vacated.buttonSeat).toBeNull();
    expect(tableSeatAt(vacated, 0).occupancy).toBe('EMPTY');
  });

  it('refuses hero or button on a seat with nobody in it', () => {
    expect(errCode(setHeroSeat(seated, 1))).toBe('SEAT_EMPTY');
    expect(errCode(setButtonSeat(seated, 1))).toBe('SEAT_EMPTY');
  });

  it('sitting the button out clears the button', () => {
    const out = unwrap(setSeatOccupancy(seated, 0, 'SITTING_OUT'));
    expect(out.buttonSeat).toBeNull();
  });
});

describe('button movement', () => {
  it('takes the lowest eligible seat when there is no button yet', () => {
    const table = buildTable({ stacks: { 2: BB(100), 4: BB(100) }, buttonSeat: 2 });
    const noButton = vacateSeat(table, 2);
    const reseated = unwrap(seatPlayer(noButton, 2, player('x'), BB(100)));
    expect(unwrap(advanceButton(reseated)).buttonSeat).toBe(2);
  });

  it('moves clockwise, skipping seats that are not dealt in', () => {
    const table = buildTable({ stacks: { 0: BB(100), 3: BB(100), 5: BB(100) }, buttonSeat: 0 });
    expect(unwrap(advanceButton(table)).buttonSeat).toBe(3);
    const sittingOut = unwrap(setSeatOccupancy(table, 3, 'SITTING_OUT'));
    const withButton = unwrap(setButtonSeat(sittingOut, 0));
    expect(unwrap(advanceButton(withButton)).buttonSeat).toBe(5);
  });

  it('wraps past seat 5 back to the lowest', () => {
    const table = buildTable({ stacks: { 1: BB(100), 5: BB(100) }, buttonSeat: 5 });
    expect(unwrap(advanceButton(table)).buttonSeat).toBe(1);
  });

  it('refuses to move with fewer than two dealt-in seats', () => {
    const table = buildTable({ stacks: { 1: BB(100) }, buttonSeat: 1 });
    expect(errCode(advanceButton(table))).toBe('NOT_ENOUGH_PLAYERS');
  });
});

describe('writing a finished hand back to the table', () => {
  it('copies ending stacks and bumps the hand number, without moving the button', () => {
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const factory = ids();
    const hand = play(start(table, factory), [fold(), fold()], factory);
    expect(hand.state.phase).toBe('COMPLETE');
    const after = unwrap(applyHandResult(table, hand));
    expect(after.handNumber).toBe(1);
    expect(after.buttonSeat).toBe(0);
    expect(after.seats[1].stack).toBe(hand.state.seats[1].stack);
    expect(after.seats[2].stack).toBe(hand.state.seats[2].stack);
    expect(Money.sum([after.seats[0].stack, after.seats[1].stack, after.seats[2].stack])).toBe(
      BB(300),
    );
  });

  it('refuses an unfinished hand and a table whose players changed', () => {
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const factory = ids();
    const live = start(table, factory);
    expect(errCode(applyHandResult(table, live))).toBe('HAND_NOT_COMPLETE');

    const finished = play(live, [fold(), fold()], factory);
    const swapped = unwrap(seatPlayer(vacateSeat(table, 1), 1, player('other'), BB(100)));
    const rebuttoned = unwrap(setButtonSeat(swapped, 0));
    expect(errCode(applyHandResult(rebuttoned, finished))).toBe('HAND_TABLE_MISMATCH');
  });
});

describe('auto top-up', () => {
  const policy = (overrides: Partial<AutoTopUpPolicy> = {}): AutoTopUpPolicy => ({
    enabled: true,
    targetStack: BB(100),
    threshold: BB(100),
    ...overrides,
  });

  it('defaults to disabled, topping any seat below the buy-in back up to it', () => {
    expect(defaultAutoTopUpPolicy(NO_ANTE_PRESET)).toEqual({
      enabled: false,
      targetStack: NO_ANTE_PRESET.referenceStack,
      threshold: NO_ANTE_PRESET.referenceStack,
    });
  });

  it('enabled: false is an identity no-op and inspects no seat', () => {
    const table = buildTable({ stacks: { 0: BB(20), 1: BB(100) }, buttonSeat: 1 });
    const off = policy({ enabled: false });
    expect(topUpPlan(table, off)).toEqual([]);
    expect(unwrap(applyAutoTopUp(table, off))).toBe(table);
  });

  it('a disabled policy is inert even with invalid target/threshold values', () => {
    const table = buildTable({ stacks: { 0: BB(20), 1: BB(100) }, buttonSeat: 1 });
    const off = policy({ enabled: false, targetStack: Money.ZERO, threshold: Money.mbb(-5) });
    expect(unwrap(applyAutoTopUp(table, off))).toBe(table);
  });

  it('leaves a stack at or above the threshold untouched', () => {
    const table = buildTable({ stacks: { 0: BB(150), 1: BB(150) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(100), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([]);
    expect(unwrap(applyAutoTopUp(table, p))).toBe(table);
  });

  it('never reduces a stack at or above targetStack, even when threshold is higher', () => {
    // threshold(150) > targetStack(100): a stack of 120 is below threshold but already
    // at/above target, so the effective rule is "top up only seats below targetStack".
    const table = buildTable({ stacks: { 0: BB(120), 1: BB(200) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(100), threshold: BB(150) });
    expect(topUpPlan(table, p)).toEqual([]);
    expect(unwrap(applyAutoTopUp(table, p)).seats[0].stack).toBe(BB(120));
  });

  it('tops up a stack below both threshold and target when threshold is higher', () => {
    const table = buildTable({ stacks: { 0: BB(80), 1: BB(200) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(100), threshold: BB(150) });
    expect(topUpPlan(table, p)).toEqual([{ seat: 0, from: BB(80), to: BB(100) }]);
    expect(unwrap(applyAutoTopUp(table, p)).seats[0].stack).toBe(BB(100));
  });

  it('a stack exactly at the threshold is untouched (strictly below only)', () => {
    // targetStack(200) alone would not exclude 100; only the threshold check does.
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(250) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(200), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([]);
  });

  it('a stack exactly at targetStack is untouched', () => {
    // threshold(200) alone would not exclude 100; only the targetStack check does.
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(250) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(100), threshold: BB(200) });
    expect(topUpPlan(table, p)).toEqual([]);
  });

  it('tops up a busted (zero-stack) seat like any other short stack', () => {
    const seated = buildTable({ stacks: { 0: BB(1), 1: BB(150) }, buttonSeat: 1 });
    const table = unwrap(setSeatStack(seated, 0, Money.ZERO));
    const p = policy({ targetStack: BB(100), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([{ seat: 0, from: Money.ZERO, to: BB(100) }]);
    expect(unwrap(applyAutoTopUp(table, p)).seats[0].stack).toBe(BB(100));
  });

  it('does not top up a SITTING_OUT seat even though its stack qualifies', () => {
    const seated = buildTable({ stacks: { 0: BB(20), 1: BB(150) }, buttonSeat: 1 });
    const table = unwrap(setSeatOccupancy(seated, 0, 'SITTING_OUT'));
    const p = policy({ targetStack: BB(100), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([]);
    expect(unwrap(applyAutoTopUp(table, p)).seats[0].stack).toBe(BB(20));
  });

  it('never touches an EMPTY seat', () => {
    const table = buildTable({ stacks: { 1: BB(150) }, buttonSeat: 1 });
    const p = policy({ targetStack: BB(100), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([]);
    expect(tableSeatAt(unwrap(applyAutoTopUp(table, p)), 0)).toEqual({
      seat: 0,
      occupancy: 'EMPTY',
      playerId: null,
      stack: Money.ZERO,
    });
  });

  it('routes the resulting table total through the same range check as setSeatStack', () => {
    let table = buildTable({
      stacks: { 0: BB(1), 1: BB(400_000), 2: BB(400_000) },
      buttonSeat: 1,
    });
    table = unwrap(setSeatStack(table, 0, Money.ZERO));
    const p = policy({ targetStack: BB(400_000), threshold: BB(400_000) });
    expect(errCode(applyAutoTopUp(table, p))).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('refuses an invalid policy instead of throwing', () => {
    const table = buildTable({ stacks: { 0: BB(20), 1: BB(150) }, buttonSeat: 1 });
    expect(errCode(applyAutoTopUp(table, policy({ targetStack: Money.ZERO })))).toBe(
      'STACK_NOT_POSITIVE',
    );
    expect(errCode(applyAutoTopUp(table, policy({ targetStack: Money.mbb(-100) })))).toBe(
      'STACK_NOT_POSITIVE',
    );
    expect(errCode(applyAutoTopUp(table, policy({ threshold: Money.mbb(-1) })))).toBe(
      'STACK_NEGATIVE',
    );
    expect(errCode(applyAutoTopUp(table, policy({ targetStack: 2.5 as never })))).toBe(
      'AMOUNT_OUT_OF_RANGE',
    );
    expect(errCode(applyAutoTopUp(table, policy({ threshold: 2.5 as never })))).toBe(
      'AMOUNT_OUT_OF_RANGE',
    );
  });

  it('tops up multiple qualifying seats in one call', () => {
    const table = buildTable({
      stacks: { 0: BB(20), 1: BB(150), 2: BB(40) },
      buttonSeat: 1,
    });
    const p = policy({ targetStack: BB(100), threshold: BB(100) });
    expect(topUpPlan(table, p)).toEqual([
      { seat: 0, from: BB(20), to: BB(100) },
      { seat: 2, from: BB(40), to: BB(100) },
    ]);
    const after = unwrap(applyAutoTopUp(table, p));
    expect(after.seats[0].stack).toBe(BB(100));
    expect(after.seats[1].stack).toBe(BB(150));
    expect(after.seats[2].stack).toBe(BB(100));
  });
});
