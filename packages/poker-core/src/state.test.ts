import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { betTo, call, check, dealBoard, fold, raiseTo } from './commands.js';
import {
  ZERO_BY_STREET,
  contenders,
  emptySeatHandState,
  isContender,
  seatState,
  seatsAbleToAct,
} from './state.js';
import { BB, buildTable, cards, ids, play, sixHanded, start } from './testing.js';

describe('the empty seat', () => {
  it('holds no player, no chips and no contributions', () => {
    expect(emptySeatHandState(4)).toEqual({
      seat: 4,
      playerId: null,
      status: 'NOT_DEALT_IN',
      startingStack: Money.ZERO,
      stack: Money.ZERO,
      streetContribution: Money.ZERO,
      deadContribution: Money.ZERO,
      totalContribution: Money.ZERO,
      contributionByStreet: ZERO_BY_STREET,
      holeCards: [],
      holeCardsRevealed: false,
      actedAtFullRaiseCount: null,
      lastAction: null,
      returnedUncalled: Money.ZERO,
      wonGross: Money.ZERO,
      rakePaid: Money.ZERO,
    });
    expect(ZERO_BY_STREET).toEqual({
      PREFLOP: Money.ZERO,
      FLOP: Money.ZERO,
      TURN: Money.ZERO,
      RIVER: Money.ZERO,
    });
  });
});

describe('contenders and seats able to act', () => {
  it('lists contenders in ring order starting left of the button', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold(), fold()], factory);
    expect(contenders(hand.state)).toEqual([1, 2, 5, 0]);
    expect(isContender(seatState(hand.state, 3))).toBe(false);
    expect(isContender(seatState(hand.state, 5))).toBe(true);
  });

  it('counts an all-in seat as a contender but not as able to act', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(6) }, buttonSeat: 0 });
    let hand = start(table, factory);
    hand = play(hand, [raiseTo(BB(6)), call(), call()], factory);
    expect(seatState(hand.state, 2).status).toBe('ALL_IN');
    expect(isContender(seatState(hand.state, 2))).toBe(true);
    expect(contenders(hand.state)).toEqual([1, 2, 0]);
    expect(seatsAbleToAct(hand.state)).toEqual([1, 0]);
  });

  it('drops to one contender when everyone else folds', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(contenders(hand.state)).toEqual([2]);
    expect(seatsAbleToAct(hand.state)).toEqual([2]);
  });

  it('keeps street contribution in sync with contributionByStreet across streets', () => {
    const factory = ids();
    let hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), call(), call(), check()],
      factory,
    );
    // Postflop order over the three live seats is SB, BB, BTN.
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), betTo(BB(2))], factory);
    expect(hand.state.phase).toBe('BETTING');
    const bb = seatState(hand.state, 2);
    expect(bb.streetContribution).toBe(BB(2));
    expect(bb.contributionByStreet.FLOP).toBe(BB(2));
    expect(bb.contributionByStreet.PREFLOP).toBe(BB(1));
    expect(bb.totalContribution).toBe(BB(3));
  });
});
