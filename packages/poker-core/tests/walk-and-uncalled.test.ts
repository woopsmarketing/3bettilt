/**
 * Everyone folds to the big blind, and the uncalled-bet return (§7.7).
 *
 * The rule under test: the uncalled return is computed over ALL dealt-in seats,
 * folded ones included. A walk at NL50 therefore returns 0.5 BB to the big blind and
 * leaves a 1 BB pot (the small blind's 0.5 plus the big blind's matched 0.5) — exactly
 * what a real hand history prints.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { call, check, dealBoard, fold, raiseTo } from '../src/commands.js';
import { NO_ANTE_PRESET, cards, ids, sixHanded, start } from '../src/testing.js';
import { buildTable, BB } from '../src/testing.js';
import { awardAllTo, stacks, step } from './_helpers.js';

describe('everyone folds to the big blind', () => {
  it('returns the uncalled half blind and leaves a 1 BB pot', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);

    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.endReason).toBe('ALL_FOLDED');

    const returned = hand.events.find((e) => e.kind === 'RETURN_UNCALLED');
    expect(returned).toMatchObject({ seat: 2, amount: 500 });

    const award = hand.events.find((e) => e.kind === 'POT_AWARDED');
    expect(award).toMatchObject({
      potIndex: 0,
      winners: [2],
      grossAmount: 1000, // 500 dead SB + 500 matched BB
      rake: 0, // no flop, no drop
      netAmount: 1000,
    });

    expect(hand.state.totalRake).toBe(0);
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99500, // the small blind is the only loser
      2: 100500,
      3: 100000,
      4: 100000,
      5: 100000,
    });
  });

  it('emits fold, return, award and finish inside a single command group', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);

    const last = hand.events[hand.events.length - 1]?.commandSeq;
    const group = hand.events.filter((e) => e.commandSeq === last);
    expect(group.map((e) => e.kind)).toEqual([
      'FOLD',
      'RETURN_UNCALLED',
      'POT_AWARDED',
      'HAND_FINISHED',
    ]);
    expect(group.map((e) => e.origin)).toEqual(['USER', 'ENGINE', 'ENGINE', 'ENGINE']);
  });

  it('rakes a walk when no-flop-no-drop is switched off', () => {
    // Configuration, not code: flipping the flag is the only change.
    const config = { ...NO_ANTE_PRESET, rake: { ...NO_ANTE_PRESET.rake, noFlopNoDrop: false } };
    const f = ids();
    let hand = start(sixHanded(config), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);
    // floor(1000 * 5 / 100) = 50
    expect(hand.state.totalRake).toBe(50);
    expect(hand.state.seats[2].stack).toBe(100450);
  });
});

describe('an open that nobody calls', () => {
  it('returns the excess over the big blind and rakes nothing preflop', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f); // UTG opens to 3 BB
    expect(hand.state.potTotal).toBe(4500);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);

    // top 3000 (UTG), second 1000 (the FOLDED big blind) -> 2000 returned, pot 2500.
    expect(hand.events.find((e) => e.kind === 'RETURN_UNCALLED')).toMatchObject({
      seat: 3,
      amount: 2000,
    });
    expect(hand.events.find((e) => e.kind === 'POT_AWARDED')).toMatchObject({
      grossAmount: 2500, // 500 + 1000 + 1000
      rake: 0,
    });
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99500,
      2: 99000,
      3: 101500,
      4: 100000,
      5: 100000,
    });
  });
});

describe('a limped pot that sees a flop', () => {
  it('is raked at 5% floored of the post-return pot', () => {
    const f = ids();
    // Heads-up-ish: only three seats, so the arithmetic is easy to check by hand.
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    let hand = start(table, f);
    hand = step(hand, call(), f); // BTN limps
    hand = step(hand, call(), f); // SB completes
    hand = step(hand, check(), f); // BB checks its option
    expect(hand.state.potTotal).toBe(3000);

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    for (let i = 0; i < 3; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    for (let i = 0; i < 3; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    for (let i = 0; i < 3; i += 1) hand = step(hand, check(), f);

    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.potTotal).toBe(3000);
    hand = step(hand, awardAllTo(hand.state, 0), f);
    // floor(3000 * 5 / 100) = 150
    expect(hand.state.totalRake).toBe(150);
    expect(hand.state.seats[0].stack).toBe(101850); // 99000 + 3000 - 150
  });
});

describe('the rake basis', () => {
  it('is the pot AFTER the uncalled bet has been returned', () => {
    const f = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(5000)), f); // BTN opens
    hand = step(hand, call(), f); // SB calls
    hand = step(hand, fold(), f); // BB folds
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    expect(hand.state.potTotal).toBe(11000); // 5000 + 5000 + 1000

    hand = step(hand, check(), f); // SB
    hand = step(hand, { kind: 'BET', toAmount: Money.mbb(10_000) }, f); // BTN
    expect(hand.state.potTotal).toBe(21000);
    hand = step(hand, fold(), f); // SB folds and ends the hand

    // The 10000 comes straight back, so the rake basis is 11000, not 21000.
    expect(hand.events.find((e) => e.kind === 'RETURN_UNCALLED')).toMatchObject({
      seat: 0,
      amount: 10000,
    });
    expect(hand.events.find((e) => e.kind === 'POT_AWARDED')).toMatchObject({
      grossAmount: 11000,
      rake: 550, // floor(11000 * 5 / 100)
      netAmount: 10450,
    });
    expect(stacks(hand.state)).toEqual({ 0: 105450, 1: 95000, 2: 99000 });
  });
});
