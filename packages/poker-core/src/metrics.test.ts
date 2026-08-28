import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { call, check, dealBoard, fold, raiseTo } from './commands.js';
import {
  committedFraction,
  deadCards,
  effectiveStackBetween,
  effectiveStackFor,
  potOdds,
  remainingStack,
  spr,
} from './metrics.js';
import { setHoleCards } from './commands.js';
import { BB, buildTable, c, cards, ids, play, sixHanded, start } from './testing.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

describe('effective stack', () => {
  it('is the smaller of two stacks on the chosen basis', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(40), 2: BB(70) }, buttonSeat: 0 });
    const hand = start(table, factory);
    expect(effectiveStackBetween(hand.state, 0, 1, 'STARTING')).toBe(BB(40));
    expect(effectiveStackBetween(hand.state, 0, 2, 'STARTING')).toBe(BB(70));
    // REMAINING is chips BEHIND, so the posted blinds already count against it.
    expect(effectiveStackBetween(hand.state, 0, 1, 'REMAINING')).toBe(BB(39.5));
  });

  it('multiway means "versus the deepest live opponent"', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(40), 2: BB(70) }, buttonSeat: 0 });
    const hand = start(table, factory);
    expect(effectiveStackFor(hand.state, 0, 'STARTING')).toBe(BB(70));
    expect(effectiveStackFor(hand.state, 1, 'STARTING')).toBe(BB(40));
    expect(effectiveStackFor(hand.state, 2, 'STARTING')).toBe(BB(70));
  });

  it('shrinks as opponents fold', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(40), 2: BB(70) }, buttonSeat: 0 });
    let hand = start(table, factory);
    expect(effectiveStackFor(hand.state, 0, 'STARTING')).toBe(BB(70));
    hand = play(hand, [call(), fold()], factory); // BTN limps, SB folds
    expect(effectiveStackFor(hand.state, 0, 'STARTING')).toBe(BB(70));
    expect(effectiveStackFor(hand.state, 0, 'REMAINING')).toBe(BB(69));
  });

  it('is ZERO when no other contender remains', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(effectiveStackFor(hand.state, 2, 'REMAINING')).toBe(Money.ZERO);
  });

  it('remainingStack is chips behind', () => {
    const hand = start(sixHanded(), ids());
    expect(remainingStack(hand.state, 2)).toBe(BB(99));
    expect(remainingStack(hand.state, 3)).toBe(BB(100));
  });
});

describe('SPR, pot odds and committed fraction are plain numbers, not money', () => {
  it('computes SPR against the current pot', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    // Pot 3 BB, SB has 99 BB behind, deepest live opponent also 99.
    expect(hand.state.potTotal).toBe(BB(3));
    expect(spr(hand.state, 1)).toBeCloseTo(33, 10);
  });

  it('returns null SPR on an empty pot', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    const empty = { ...hand.state, potTotal: Money.ZERO };
    expect(spr(empty, 3)).toBeNull();
  });

  it('computes pot odds as call / (pot + call)', () => {
    const hand = start(sixHanded(), ids());
    // UTG must call 1 into a pot of 1.5 -> 1 / 2.5.
    expect(potOdds(hand.state, 3)).toBeCloseTo(0.4, 10);
    // The big blind faces nothing.
    expect(potOdds(hand.state, 2)).toBe(0);
  });

  it('computes the committed fraction of the starting stack', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), raiseTo(BB(25))],
      factory,
    );
    expect(committedFraction(hand.state, 0)).toBeCloseTo(0.25, 10);
    expect(committedFraction(hand.state, 4)).toBe(0);
  });
});

describe('dead cards', () => {
  it('is the board plus every known holding', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    hand = play(hand, [setHoleCards(0, cards('As Kd'), false)], factory);
    expect(deadCards(hand.state)).toEqual([c('As'), c('Kd')]);
    hand = play(hand, LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('2h 7c 9s'))], factory);
    expect(deadCards(hand.state)).toHaveLength(5);
    expect(deadCards(hand.state)).toContain(c('7c'));
  });
});
