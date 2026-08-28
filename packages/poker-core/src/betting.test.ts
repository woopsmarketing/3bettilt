import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import {
  callAmount,
  callToAmount,
  classifyWager,
  fullCallAmount,
  isBettingRoundClosed,
  legalActions,
  maxWagerToAmount,
  mayAggress,
  mayReopen,
  minWagerToAmount,
  mustAct,
  nextActor,
  seatsThatMustAct,
  validateWagerTo,
} from './betting.js';
import { allIn, betTo, call, check, dealBoard, fold, raiseTo } from './commands.js';
import { applyCommand } from './hand.js';
import {
  BB,
  NO_ANTE_PRESET,
  buildTable,
  cards,
  errCode,
  errOf,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

describe('call amounts', () => {
  it('is the unmatched part of the current bet, and zero when facing none', () => {
    const hand = start(sixHanded(), ids());
    expect(callAmount(hand.state, 3)).toBe(BB(1)); // UTG faces the big blind
    expect(callAmount(hand.state, 1)).toBe(BB(0.5)); // SB has 0.5 in already
    expect(callAmount(hand.state, 2)).toBe(Money.ZERO); // BB has matched itself
    expect(callToAmount(hand.state, 1)).toBe(BB(1));
  });

  it('accounts for chips already in when the price goes up', () => {
    const factory = ids();
    // Four dealt in: BTN 0, SB 1, BB 2, CO 3. Preflop order is CO, BTN, SB, BB.
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [fold(), fold(), raiseTo(BB(10))], factory); // CO folds, BTN folds, SB raises
    expect(hand.state.actorSeat).toBe(2);
    expect(callAmount(hand.state, 2)).toBe(BB(9)); // the BB already has 1 in
    expect(callToAmount(hand.state, 2)).toBe(BB(10));
  });

  it('a short stack calls for all it has, and the verb stays CALL', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(4) }, buttonSeat: 0 });
    let hand = start(table, factory); // BTN 0, SB 1, BB 2 (4 BB)
    hand = play(hand, [raiseTo(BB(10)), fold()], factory);
    expect(hand.state.actorSeat).toBe(2);
    expect(fullCallAmount(hand.state, 2)).toBe(BB(9));
    expect(callAmount(hand.state, 2)).toBe(BB(3));
    hand = play(hand, [call()], factory);
    const called = hand.events.find((e) => e.kind === 'CALL');
    expect(called?.kind).toBe('CALL');
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    expect(hand.state.seats[2].stack).toBe(Money.ZERO);
    expect(hand.state.actions.at(-1)?.kind).toBe('CALL');
    expect(hand.state.actions.at(-1)?.isAllIn).toBe(true);
  });
});

describe('minimum raise-TO under raise-TO semantics', () => {
  it('matches the spec worked-example table', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    // Preflop, blinds posted: currentBet 1000, lastFullRaiseSize 1000 -> min raise-to 2000.
    expect(hand.state.round.currentBet).toBe(BB(1));
    expect(minWagerToAmount(hand.state, 3)).toBe(BB(2));

    hand = play(hand, [raiseTo(BB(3))], factory);
    // After an open to 3: currentBet 3000, lastFullRaiseSize 2000 -> min raise-to 5000.
    expect(hand.state.round.currentBet).toBe(BB(3));
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(2));
    expect(minWagerToAmount(hand.state, 4)).toBe(BB(5));

    hand = play(hand, [raiseTo(BB(9))], factory);
    // After a 3bet to 9: currentBet 9000, lastFullRaiseSize 6000 -> min raise-to 15000.
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(6));
    expect(minWagerToAmount(hand.state, 5)).toBe(BB(15));
  });

  it('postflop the minimum bet is config.minBet and a raise doubles the bet', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(hand.state.round.currentBet).toBe(Money.ZERO);
    expect(minWagerToAmount(hand.state, 1)).toBe(BB(1));
    hand = play(hand, [betTo(BB(5))], factory);
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(5));
    expect(minWagerToAmount(hand.state, 2)).toBe(BB(10));
  });

  it('is never clamped to the stack; the option is reported as all-in-only instead', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(4) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3)), fold()], factory);
    // The big blind can exceed the current bet of 3 but cannot reach the minimum of 5.
    expect(minWagerToAmount(hand.state, 2)).toBe(BB(5));
    expect(maxWagerToAmount(hand.state, 2)).toBe(BB(4));
    const legal = legalActions(hand.state, 2);
    expect(legal.wager).not.toBeNull();
    expect(legal.wager?.onlyAllIn).toBe(true);
    expect(legal.wager?.minToAmount).toBe(BB(4));
    expect(legal.wager?.maxToAmount).toBe(BB(4));
    expect(legal.allIn?.effect).toBe('RAISE');
    expect(legal.allIn?.isFullRaise).toBe(false);
  });

  it('uses the LAST_FULL_RAISE basis when configured to', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...NO_ANTE_PRESET.rules, shortAllInMinRaiseBasis: 'LAST_FULL_RAISE' as const },
    };
    const factory = ids();
    const table = buildTable({
      config,
      stacks: { 0: BB(4), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    // UTG opens to 3; the button shoves 4 (short: +1 < 2); the small blind must raise
    // from the LAST FULL level 3 + 2 = 5, not from the new current bet 4 + 2 = 6.
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3)), fold(), fold(), allIn()], factory);
    expect(hand.state.round.currentBet).toBe(BB(4));
    expect(hand.state.round.lastFullRaiseTo).toBe(BB(3));
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(2));
    expect(hand.state.actorSeat).toBe(1);
    expect(minWagerToAmount(hand.state, 1)).toBe(BB(5));
  });

  it('the default CURRENT_BET basis measures from the new current bet', () => {
    const factory = ids();
    const table = buildTable({
      stacks: { 0: BB(4), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3)), fold(), fold(), allIn()], factory);
    expect(minWagerToAmount(hand.state, 1)).toBe(BB(6));
  });
});

describe('a short all-in does not reopen the betting', () => {
  it('reproduces the spec worked example exactly', () => {
    const factory = ids();
    // Seats: 0 BTN, 1 SB, 2 BB, 3 UTG, 4 HJ, 5 CO. Give the button a 4 BB stack.
    const table = buildTable({
      stacks: { 0: BB(4), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3))], factory); // UTG (seat 3) raises to 3, a full raise
    expect(hand.state.round.fullRaiseCount).toBe(2);
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(2));
    expect(hand.state.seats[3].actedAtFullRaiseCount).toBe(2);

    hand = play(hand, [fold(), call()], factory); // HJ folds, CO calls 3
    expect(hand.state.seats[5].actedAtFullRaiseCount).toBe(2);

    hand = play(hand, [allIn()], factory); // BTN all-in to 4 — short (+1 < 2)
    expect(hand.state.round.currentBet).toBe(BB(4));
    expect(hand.state.round.fullRaiseCount).toBe(2);
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(2));
    expect(hand.state.seats[0].actedAtFullRaiseCount).toBe(2);

    // SB and BB never acted: they may still raise.
    expect(mayReopen(hand.state, 1)).toBe(true);
    expect(mayReopen(hand.state, 2)).toBe(true);
    // UTG and CO already acted at count 2: call or fold only.
    expect(mayReopen(hand.state, 3)).toBe(false);
    expect(mayReopen(hand.state, 5)).toBe(false);
    expect(minWagerToAmount(hand.state, 1)).toBe(BB(6));
  });

  it('refuses a raise from a seat betting was not reopened to', () => {
    const factory = ids();
    const table = buildTable({
      stacks: { 0: BB(4), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3)), fold(), call(), allIn(), fold(), fold()], factory);
    expect(hand.state.actorSeat).toBe(3); // back to UTG
    expect(errCode(applyCommand(hand, raiseTo(BB(10)), factory))).toBe('RAISE_NOT_REOPENED');
    expect(errCode(applyCommand(hand, allIn(), factory))).toBe('RAISE_NOT_REOPENED');
    const legal = legalActions(hand.state, 3);
    expect(legal.wager).toBeNull();
    expect(legal.wagerBlockedBy).toBe('RAISE_NOT_REOPENED');
    expect(legal.allIn).toBeNull();
    expect(legal.call?.amount).toBe(BB(1));
    // Calling is still fine.
    expect(applyCommand(hand, call(), factory).ok).toBe(true);
  });

  it('a FULL all-in raise does reopen the betting', () => {
    const factory = ids();
    const table = buildTable({
      stacks: { 0: BB(8), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(3)), fold(), call(), allIn()], factory);
    expect(hand.state.round.currentBet).toBe(BB(8));
    expect(hand.state.round.fullRaiseCount).toBe(3);
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(5));
    expect(mayReopen(hand.state, 3)).toBe(true);
    expect(mayReopen(hand.state, 5)).toBe(true);
  });
});

describe('betting round completion', () => {
  it('the big blind gets its option after limps', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), call(), call()],
      factory,
    );
    expect(hand.state.phase).toBe('BETTING');
    expect(hand.state.actorSeat).toBe(2);
    expect(hand.state.seats[2].actedAtFullRaiseCount).toBeNull();
    expect(mustAct(hand.state, 2)).toBe(true);
    expect(legalActions(hand.state, 2).canCheck).toBe(true);
    expect(legalActions(hand.state, 2).wager?.kind).toBe('RAISE');
    const checked = play(hand, [check()], factory);
    expect(checked.state.phase).toBe('AWAITING_BOARD');
  });

  it('the big blind may raise its option', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), call(), call()],
      factory,
    );
    const raised = play(hand, [raiseTo(BB(4))], factory);
    expect(raised.state.phase).toBe('BETTING');
    expect(raised.state.actorSeat).toBe(0);
    expect(raised.state.round.fullRaiseCount).toBe(2);
  });

  it('closes without the option when bigBlindHasOption is false', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...NO_ANTE_PRESET.rules, bigBlindHasOption: false },
    };
    const factory = ids();
    const hand = play(
      start(sixHanded(config), factory),
      [fold(), fold(), fold(), call(), call()],
      factory,
    );
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('FLOP');
  });

  it('closes when everyone but one has folded', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.endReason).toBe('ALL_FOLDED');
  });

  it('keeps a lone chipped player off the clock once everyone else is all-in', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(5), 2: BB(5) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(5)), call(), call()], factory);
    expect(hand.state.seats[1].status).toBe('ALL_IN');
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    expect(isBettingRoundClosed(hand.state)).toBe(true);
    expect(seatsThatMustAct(hand.state)).toEqual([]);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
  });

  it('makes a lone chipped player call or fold when they still owe chips', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(5), 2: BB(5) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [call(), allIn()], factory); // BTN limps 1, SB shoves 5
    expect(hand.state.actorSeat).toBe(2);
    hand = play(hand, [allIn()], factory); // BB shoves 5 too
    expect(hand.state.actorSeat).toBe(0);
    expect(mustAct(hand.state, 0)).toBe(true);
    expect(mayAggress(hand.state, 0)).toBe(false);
    expect(legalActions(hand.state, 0).wagerBlockedBy).toBe('NO_OPPONENT_CAN_RESPOND');
    expect(errCode(applyCommand(hand, raiseTo(BB(20)), factory))).toBe('NO_OPPONENT_CAN_RESPOND');
    expect(applyCommand(hand, call(), factory).ok).toBe(true);
  });

  it('nextActor walks the action order and returns null when the round is closed', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(hand.state.round.actionOrder).toEqual([3, 4, 5, 0, 1, 2]);
    expect(nextActor(hand.state)).toBe(3);
    const afterUtg = play(hand, [fold()], factory);
    expect(nextActor(afterUtg.state)).toBe(4);
    const closed = play(hand, [fold(), fold(), fold(), fold(), fold()], factory);
    expect(closed.state.phase).toBe('COMPLETE');
    // The uncalled return lowered `currentBet` too, so the winning blind does not
    // reappear on the clock.
    expect(closed.state.round.currentBet).toBe(BB(0.5));
    expect(nextActor(closed.state)).toBeNull();
  });
});

describe('verb legality and validation order', () => {
  it('refuses to check facing a bet and to call facing none', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(errCode(applyCommand(hand, check(), factory))).toBe('CHECK_NOT_ALLOWED');
    const limped = play(hand, [fold(), fold(), fold(), call(), call()], factory);
    expect(errCode(applyCommand(limped, call(), factory))).toBe('CALL_NOT_ALLOWED');
    expect(applyCommand(limped, check(), factory).ok).toBe(true);
  });

  it('refuses BET when there is a bet and RAISE when there is none', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    expect(errCode(applyCommand(hand, betTo(BB(3)), factory))).toBe('BET_NOT_ALLOWED');
    hand = play(hand, [fold(), fold(), fold(), call(), call(), check()], factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(errCode(applyCommand(hand, raiseTo(BB(3)), factory))).toBe('RAISE_NOT_ALLOWED');
    expect(applyCommand(hand, betTo(BB(3)), factory).ok).toBe(true);
  });

  it('reports NOT_ACTORS_TURN when a seat is named that is not on the clock', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(errCode(applyCommand(hand, fold(4), factory))).toBe('NOT_ACTORS_TURN');
    expect(applyCommand(hand, fold(3), factory).ok).toBe(true);
  });

  it('reports SEAT_NOT_DEALT_IN before NOT_ACTORS_TURN', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const hand = start(table, factory);
    expect(errCode(applyCommand(hand, fold(5), factory))).toBe('SEAT_NOT_DEALT_IN');
  });

  it('checks the amount range before any Money call, then increasing, max, min', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(errCode(validateWagerTo(hand.state, 3, 1.5 as never))).toBe('AMOUNT_OUT_OF_RANGE');
    expect(errCode(validateWagerTo(hand.state, 3, 2e9 as never))).toBe('AMOUNT_OUT_OF_RANGE');
    expect(errCode(validateWagerTo(hand.state, 3, BB(1)))).toBe('AMOUNT_NOT_INCREASING');
    expect(errCode(validateWagerTo(hand.state, 3, BB(200)))).toBe('INSUFFICIENT_STACK');
    expect(errCode(validateWagerTo(hand.state, 3, BB(1.5)))).toBe('AMOUNT_BELOW_MINIMUM');
  });

  it('populates the error context so the UI can render "Min: 2 BB"', () => {
    const hand = start(sixHanded(), ids());
    const error = errOf(validateWagerTo(hand.state, 3, BB(1.5)));
    expect(error.context).toMatchObject({ seat: 3, min: BB(2), max: BB(100), actual: BB(1.5) });
  });

  it('allows a below-minimum wager only when it is the seat’s whole stack', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(1.5) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [fold()], factory);
    expect(hand.state.actorSeat).toBe(1);
    hand = play(hand, [call()], factory);
    expect(hand.state.actorSeat).toBe(2);
    // BB has 0.5 BB behind: min raise-to is 2 but the all-in level is 1.5.
    expect(minWagerToAmount(hand.state, 2)).toBe(BB(2));
    expect(errCode(validateWagerTo(hand.state, 2, BB(1.2)))).toBe('AMOUNT_BELOW_MINIMUM');
    expect(validateWagerTo(hand.state, 2, BB(1.5)).ok).toBe(true);
  });
});

describe('wager classification and legal actions', () => {
  it('classifies an all-in below the current bet as a call', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(4) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(10)), fold()], factory);
    const classified = classifyWager(hand.state, 2, maxWagerToAmount(hand.state, 2));
    expect(classified.effect).toBe('CALL');
    expect(classified.isAllIn).toBe(true);
    expect(classified.isFullRaise).toBe(false);
    const legal = legalActions(hand.state, 2);
    expect(legal.allIn?.effect).toBe('CALL');
    expect(legal.wager).toBeNull();
    expect(legal.wagerBlockedBy).toBe('INSUFFICIENT_STACK');
  });

  it('returns an empty struct when no seat is on the clock', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    const legal = legalActions(hand.state);
    expect(legal).toEqual({
      seat: null,
      canFold: false,
      canCheck: false,
      call: null,
      wager: null,
      allIn: null,
      wagerBlockedBy: null,
    });
  });

  it('exposes bet bounds as both raise-TO and additional chips', () => {
    const factory = ids();
    let hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), call(), call(), check()],
      factory,
    );
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    const legal = legalActions(hand.state, 1);
    expect(legal.wager).toEqual({
      kind: 'BET',
      minToAmount: BB(1),
      maxToAmount: BB(99),
      minAdditional: BB(1),
      maxAdditional: BB(99),
      onlyAllIn: false,
    });
  });
});

describe('raise-TO semantics are the only semantics', () => {
  it('stores toAmount as the street contribution AFTER the action, and amount as the delta', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), [fold(), fold(), fold(), raiseTo(BB(3))], factory);
    const open = hand.events.at(-1);
    expect(open).toMatchObject({ kind: 'RAISE', seat: 0, toAmount: BB(3), amount: BB(3) });
    expect(hand.state.seats[0].streetContribution).toBe(BB(3));

    // The small blind already has 0.5 in, so raising TO 9 moves only 8.5.
    hand = play(hand, [raiseTo(BB(9))], factory);
    const threeBet = hand.events.at(-1);
    expect(threeBet).toMatchObject({ kind: 'RAISE', seat: 1, toAmount: BB(9), amount: BB(8.5) });
    expect(hand.state.seats[1].streetContribution).toBe(BB(9));
    expect(hand.state.seats[1].stack).toBe(BB(91));

    // A call is also recorded raise-TO.
    hand = play(hand, [fold(), call()], factory);
    const called = hand.events.at(-1);
    expect(called).toMatchObject({ kind: 'CALL', seat: 0, toAmount: BB(9), amount: BB(6) });
  });

  it('an ALL_IN records toAmount at the seat’s all-in level and the whole stack as amount', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(20) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(5)), fold(), allIn()], factory);
    const shove = hand.events.find((e) => e.kind === 'ALL_IN');
    expect(shove).toMatchObject({ kind: 'ALL_IN', seat: 2, toAmount: BB(20), amount: BB(19) });
  });
});

describe('call amount and minimum raise after each action type', () => {
  it('tracks both through check, bet, raise, call and a short all-in', () => {
    const factory = ids();
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(12) },
      buttonSeat: 0,
    });
    // Dealt in: 0 BTN, 1 SB, 2 BB, 3 HJ, 4 CO. Preflop order HJ, CO, BTN, SB, BB.
    let hand = start(table, factory);
    expect(callAmount(hand.state, 3)).toBe(BB(1));
    expect(minWagerToAmount(hand.state, 3)).toBe(BB(2));

    hand = play(hand, [call()], factory); // HJ calls 1
    expect(hand.state.actorSeat).toBe(4);
    expect(callAmount(hand.state, 4)).toBe(BB(1));
    expect(minWagerToAmount(hand.state, 4)).toBe(BB(2));

    hand = play(hand, [raiseTo(BB(4))], factory); // CO raises to 4, a full raise of 3
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(3));
    expect(callAmount(hand.state, 0)).toBe(BB(4));
    expect(minWagerToAmount(hand.state, 0)).toBe(BB(7));

    hand = play(hand, [call(), fold(), fold(), call()], factory); // BTN calls, blinds fold, HJ calls
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(hand.state.actorSeat).toBe(3); // first live seat left of the button
    expect(callAmount(hand.state, 3)).toBe(Money.ZERO);
    expect(minWagerToAmount(hand.state, 3)).toBe(BB(1)); // config.minBet

    hand = play(hand, [check()], factory);
    expect(hand.state.actorSeat).toBe(4);
    expect(callAmount(hand.state, 4)).toBe(Money.ZERO);
    expect(minWagerToAmount(hand.state, 4)).toBe(BB(1));

    hand = play(hand, [allIn()], factory); // CO shoves its remaining 8
    expect(hand.state.round.currentBet).toBe(BB(8));
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(8));
    expect(callAmount(hand.state, 0)).toBe(BB(8));
    expect(minWagerToAmount(hand.state, 0)).toBe(BB(16));
  });
});
