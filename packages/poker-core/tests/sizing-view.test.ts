/**
 * Pot-fraction sizing, the live raise preview from docs/UX.md, and the read model.
 *
 * §4.11 fixes one formula for both bets and raises:
 *   toAmount = round.currentBet + mulFraction(potBeforeAction + callAmount, fraction, mode)
 * clamped into [minWagerToAmount, maxWagerToAmount].
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { previewWager, wagerToForPotFraction } from '../src/sizing.js';
import { potAfterCall, potBeforeAction } from '../src/pots.js';
import { call, check, dealBoard, fold } from '../src/commands.js';
import { toView, wagerCommand } from '../src/view.js';
import { cards, ids, sixHanded, start } from '../src/testing.js';
import { awardAllTo, step } from './_helpers.js';

const sized = (
  state: Parameters<typeof wagerToForPotFraction>[0],
  seat: 0 | 1 | 2 | 3 | 4 | 5,
  f: number,
) => {
  const r = wagerToForPotFraction(state, seat, f, 'round');
  if (!r.ok) throw new Error(`sizing failed: ${r.error.code}`);
  return r.value;
};

describe('pot-fraction sizing', () => {
  it('sizes a preflop raise off the pot after the call', () => {
    const hand = start(sixHanded(), ids());
    const st = hand.state;
    expect(potBeforeAction(st)).toBe(1500); // SB 500 + BB 1000
    expect(potAfterCall(st, 3)).toBe(2500); // + UTG's 1000 call

    // 1000 (current bet) + 100% of 2500
    expect(sized(st, 3, 1)).toMatchObject({ toAmount: 3500, additional: 3500, clampedTo: null });
    // 1000 + 50% of 2500
    expect(sized(st, 3, 0.5)).toMatchObject({ toAmount: 2250, additional: 2250, clampedTo: null });
    // 1000 + 33% of 2500 = 1825, below the 2000 minimum raise-TO -> clamped up
    expect(sized(st, 3, 0.33)).toMatchObject({ toAmount: 2000, clampedTo: 'MIN' });
    // Absurdly large -> clamped to the all-in level
    expect(sized(st, 3, 100)).toMatchObject({ toAmount: 100000, clampedTo: 'MAX' });
  });

  it('degenerates to fraction-times-pot when facing no bet', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    const st = hand.state;
    expect(st.potTotal).toBe(6000);
    expect(st.round.currentBet).toBe(0);
    expect(potAfterCall(st, 1)).toBe(6000);

    expect(sized(st, 1, 0.5)).toMatchObject({ toAmount: 3000, clampedTo: null });
    expect(sized(st, 1, 0.75)).toMatchObject({ toAmount: 4500, clampedTo: null });
    expect(sized(st, 1, 0.33)).toMatchObject({ toAmount: 1980, clampedTo: null });
    // 10% of 6000 = 600, below the 1 BB minimum bet.
    expect(sized(st, 1, 0.1)).toMatchObject({ toAmount: 1000, clampedTo: 'MIN' });
  });

  it('refuses to size for a seat that is not on the clock', () => {
    const hand = start(sixHanded(), ids());
    expect(wagerToForPotFraction(hand.state, 4, 0.5, 'round')).toMatchObject({
      ok: false,
      error: { code: 'NOT_ACTORS_TURN' },
    });
  });
});

describe('the live raise preview', () => {
  it('stays live and reports illegality instead of refusing', () => {
    const hand = start(sixHanded(), ids());
    const st = hand.state;

    const tooSmall = previewWager(st, 3, Money.mbb(1500));
    expect(tooSmall).toMatchObject({
      toAmount: 1500,
      additional: 1500,
      minToAmount: 2000,
      maxToAmount: 100000,
      potBefore: 1500,
      potAfter: 3000,
      isAllIn: false,
      legal: false,
    });
    expect(tooSmall.error?.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(tooSmall.fractionOfPotBefore).toBeCloseTo(1, 12);

    const good = previewWager(st, 3, Money.mbb(3000));
    expect(good).toMatchObject({ legal: true, error: null, additional: 3000, potAfter: 4500 });
    expect(good.fractionOfPotBefore).toBeCloseTo(2, 12);

    const shove = previewWager(st, 3, Money.mbb(100000));
    expect(shove).toMatchObject({ legal: true, isAllIn: true, potAfter: 101500 });

    const overStack = previewWager(st, 3, Money.mbb(100001));
    expect(overStack.legal).toBe(false);
    expect(overStack.error?.code).toBe('INSUFFICIENT_STACK');
  });
});

describe('the read model', () => {
  it('nests the actor inside the phase with every UX field populated', () => {
    const view = toView(start(sixHanded(), ids()));
    expect(view.phase.kind).toBe('AWAITING_ACTION');
    if (view.phase.kind !== 'AWAITING_ACTION') return;
    const actor = view.phase.actor;
    expect(actor).toMatchObject({
      seat: 3,
      position: 'UTG',
      stack: 100000,
      streetContribution: 0,
      callAmount: 1000,
      pot: 1500,
      potIfCalls: 2500,
      effectiveStack: 100000,
    });
    expect(actor.potOdds).toBeCloseTo(1000 / 2500, 12);
    expect(actor.spr).toBeCloseTo(100000 / 1500, 12);
    expect(actor.legal.canFold).toBe(true);
    expect(actor.legal.canCheck).toBe(false);
    expect(actor.legal.wager).toMatchObject({ kind: 'RAISE', minToAmount: 2000 });
    expect(view.buttonSeat).toBe(0);
    expect(view.smallBlindSeat).toBe(1);
    expect(view.bigBlindSeat).toBe(2);
    // Ring order from the button is a presentation choice, so compare as a set.
    expect([...view.contenderSeats].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('asks for exactly the cards each street needs', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    let view = toView(hand);
    expect(view.phase).toEqual({ kind: 'AWAITING_BOARD', street: 'FLOP', cardsNeeded: 3 });

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    view = toView(hand);
    expect(view.phase).toEqual({ kind: 'AWAITING_BOARD', street: 'TURN', cardsNeeded: 1 });

    hand = step(hand, dealBoard(cards('2d')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    expect(toView(hand).phase).toEqual({
      kind: 'AWAITING_BOARD',
      street: 'RIVER',
      cardsNeeded: 1,
    });
  });

  it('picks BET or RAISE for the R key without the UI knowing the difference', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    expect(wagerCommand(toView(hand), Money.mbb(3000))).toMatchObject({
      ok: true,
      value: { kind: 'RAISE', toAmount: 3000 },
    });

    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    expect(wagerCommand(toView(hand), Money.mbb(3000))).toMatchObject({
      ok: true,
      value: { kind: 'BET', toAmount: 3000 },
    });
  });

  it('exposes the finished result and disables the actor at COMPLETE', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);
    const view = toView(hand);
    expect(view.phase.kind).toBe('COMPLETE');
    if (view.phase.kind !== 'COMPLETE') return;
    expect(view.phase.result.reason).toBe('ALL_FOLDED');
    expect(view.phase.result.totalRake).toBe(0);
    expect(Money.sum(view.phase.result.seats.map((s) => s.net))).toBe(0);
    expect(view.contenderSeats).toEqual([2]);
  });

  it('marks every dead card the palette must disable', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    hand = step(
      hand,
      { kind: 'SET_HOLE_CARDS', seat: 0, cards: cards('Ac Qh'), revealed: false },
      f,
    );
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    const view = toView(hand);
    expect([...view.deadCards].sort((a, b) => a - b)).toEqual(
      [...cards('Ac Qh Ah Kd 7c')].sort((a, b) => a - b),
    );
  });
});

describe('a settled hand feeds the table back', () => {
  it('leaves chip conservation intact across the whole hand', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f);
    hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    for (let i = 0; i < 6; i += 1) hand = step(hand, check(), f);
    hand = step(hand, awardAllTo(hand.state, 0), f);

    // 6 x 1 BB = 6000, rake floor(300) = 300, net 5700.
    expect(hand.state.totalRake).toBe(300);
    expect(hand.state.seats[0].stack).toBe(104700); // 99000 + 5700
    const total = Money.sum(hand.state.dealtInSeats.map((s) => hand.state.seats[s].stack));
    expect(Money.add(total, hand.state.totalRake)).toBe(600000);
  });
});
