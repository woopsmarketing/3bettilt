/**
 * Illegal commands must return Err with the code §7.2 fixes, and must leave the hand
 * object byte-identical. Nothing here may throw.
 */
import { describe, expect, it } from 'vitest';
import { Money, type MilliBB } from '@gto-self/shared';
import {
  allIn,
  betTo,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  validateCommand,
  type HandCommand,
} from '../src/commands.js';
import { applyCommand, type Hand } from '../src/hand.js';
import { BB, buildTable, cards, ids, sixHanded, start } from '../src/testing.js';
import { awardAllTo, snapshot, step } from './_helpers.js';

/** Asserts the code AND that the rejection changed nothing at all. */
function rejects(hand: Hand, command: HandCommand, code: string): void {
  const before = snapshot(hand);
  const result = applyCommand(hand, command, ids('reject'));
  expect(result.ok, `expected ${command.kind} to be rejected with ${code}`).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
  expect(hand).toEqual(before);
  // validateCommand must agree without dry-running the reducer.
  const pre = validateCommand(hand.state, command);
  expect(pre.ok).toBe(false);
  if (!pre.ok) expect(pre.error.code).toBe(code);
}

describe('illegal actions', () => {
  it('rejects acting out of turn', () => {
    const hand = start(sixHanded(), ids());
    expect(hand.state.actorSeat).toBe(3);
    rejects(hand, fold(4), 'NOT_ACTORS_TURN');
    rejects(hand, call(2), 'NOT_ACTORS_TURN');
    rejects(hand, raiseTo(Money.mbb(3000), 0), 'NOT_ACTORS_TURN');
  });

  it('rejects a seat that is not dealt in at all', () => {
    const hand = start(
      buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) }, buttonSeat: 0 }),
      ids(),
    );
    rejects(hand, fold(5), 'SEAT_NOT_DEALT_IN');
  });

  it('rejects a check facing a bet', () => {
    const hand = start(sixHanded(), ids());
    // UTG faces the 1 BB blind.
    rejects(hand, check(), 'CHECK_NOT_ALLOWED');
  });

  it('rejects a call when there is nothing to call', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f); // limps
    hand = step(hand, call(), f); // SB completes
    expect(hand.state.actorSeat).toBe(2); // the BB's option, 0 to call
    rejects(hand, call(), 'CALL_NOT_ALLOWED');
  });

  it('rejects a bet when a bet already exists', () => {
    const hand = start(sixHanded(), ids()); // preflop, currentBet is the 1 BB
    rejects(hand, betTo(Money.mbb(3000)), 'BET_NOT_ALLOWED');
  });

  it('rejects a raise when no bet exists', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f); // BB checks its option
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    expect(hand.state.round.currentBet).toBe(0);
    rejects(hand, raiseTo(Money.mbb(3000)), 'RAISE_NOT_ALLOWED');
  });

  it('rejects a raise below the minimum', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f); // minimum next raise-TO is 5000
    rejects(hand, raiseTo(Money.mbb(4999)), 'AMOUNT_BELOW_MINIMUM');
    const err = applyCommand(hand, raiseTo(Money.mbb(4999)), f);
    if (!err.ok) expect(err.error.context.min).toBe(5000);
  });

  it('rejects a raise that is not increasing', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f);
    rejects(hand, raiseTo(Money.mbb(3000)), 'AMOUNT_NOT_INCREASING');
    rejects(hand, raiseTo(Money.mbb(2000)), 'AMOUNT_NOT_INCREASING');
  });

  it('rejects a raise above the stack', () => {
    const f = ids();
    const hand = start(sixHanded(), f);
    rejects(hand, raiseTo(Money.mbb(100_001)), 'INSUFFICIENT_STACK');
    const err = applyCommand(hand, raiseTo(Money.mbb(100_001)), f);
    if (!err.ok) expect(err.error.context.max).toBe(100_000);
  });

  it('rejects an amount outside the milliBB range before Money can throw', () => {
    const hand = start(sixHanded(), ids());
    // Deliberately bypassing Money.mbb: this is what a corrupt parser row looks like.
    const huge = 5_000_000_000 as MilliBB;
    const result = applyCommand(hand, raiseTo(huge), ids('x'));
    expect(result).toMatchObject({ ok: false, error: { code: 'AMOUNT_OUT_OF_RANGE' } });
    const nonInteger = 3000.5 as MilliBB;
    expect(applyCommand(hand, raiseTo(nonInteger), ids('y'))).toMatchObject({
      ok: false,
      error: { code: 'AMOUNT_OUT_OF_RANGE' },
    });
  });

  it('rejects a player acting again after folding', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(hand, fold(), f); // UTG folds
    expect(hand.state.seats[3].status).toBe('FOLDED');
    rejects(hand, fold(3), 'NOT_ACTORS_TURN');
    rejects(hand, call(3), 'NOT_ACTORS_TURN');
  });

  it('rejects a raise from a seat that is already all-in', () => {
    const f = ids();
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: Money.mbb(20000), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, allIn(), f); // UTG is all-in
    expect(hand.state.seats[3].status).toBe('ALL_IN');
    rejects(hand, allIn(3), 'NOT_ACTORS_TURN');
  });

  it('rejects every action once the hand is finished', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);
    expect(hand.state.phase).toBe('COMPLETE');
    rejects(hand, fold(), 'HAND_ALREADY_FINISHED');
    rejects(hand, check(), 'HAND_ALREADY_FINISHED');
    rejects(hand, call(), 'HAND_ALREADY_FINISHED');
    rejects(hand, betTo(Money.mbb(1000)), 'HAND_ALREADY_FINISHED');
    rejects(hand, dealBoard(cards('Ah Kd 7c')), 'HAND_ALREADY_FINISHED');
  });

  it('rejects an action while the engine is waiting for board cards', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    rejects(hand, check(), 'NOT_BETTING_PHASE');
    rejects(hand, betTo(Money.mbb(1000)), 'NOT_BETTING_PHASE');
  });

  it('rejects a board deal with the wrong card count or a duplicate card', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    rejects(hand, dealBoard(cards('Ah Kd')), 'WRONG_CARD_COUNT');
    rejects(hand, dealBoard(cards('Ah Kd 7c 2d')), 'WRONG_CARD_COUNT');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    expect(hand.state.pendingStreet).toBe('TURN');
    rejects(hand, dealBoard(cards('Kd')), 'DUPLICATE_CARD');
  });

  it('rejects awarding a pot to a seat that is not eligible, and awarding twice', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(hand, fold(), f); // UTG folds and is not eligible
    for (let i = 0; i < 3; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, check(), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');

    rejects(
      hand,
      { kind: 'AWARD_POTS', awards: [{ potIndex: 0, winners: [3] }] },
      'WINNER_NOT_ELIGIBLE',
    );
    rejects(hand, { kind: 'AWARD_POTS', awards: [{ potIndex: 0, winners: [] }] }, 'NO_WINNERS');
    rejects(
      hand,
      { kind: 'AWARD_POTS', awards: [{ potIndex: 0, winners: [0, 0] }] },
      'DUPLICATE_WINNER',
    );
    rejects(hand, { kind: 'AWARD_POTS', awards: [{ potIndex: 7, winners: [0] }] }, 'UNKNOWN_POT');

    const done = step(hand, awardAllTo(hand.state, 0), f);
    rejects(
      done,
      { kind: 'AWARD_POTS', awards: [{ potIndex: 0, winners: [0] }] },
      'HAND_ALREADY_FINISHED',
    );
  });
});
