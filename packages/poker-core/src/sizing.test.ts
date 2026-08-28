import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { call, check, dealBoard, fold } from './commands.js';
import { previewWager, wagerToForPotFraction, POT_FRACTION_SHORTCUTS } from './sizing.js';
import { BB, buildTable, cards, errCode, ids, play, sixHanded, start } from './testing.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

function onFlop() {
  const factory = ids();
  let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
  hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
  return { hand, factory };
}

/** Three seats to a 9 BB flop, so every shortcut clears the 1 BB minimum bet. */
function onBigFlop() {
  const factory = ids();
  let hand = play(
    start(sixHanded(), factory),
    [fold(), fold(), fold(), { kind: 'RAISE', toAmount: BB(3) }, call(), call()],
    factory,
  );
  hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
  return { hand, factory };
}

describe('pot-fraction shortcuts', () => {
  it('facing no bet, degenerates to fraction x pot', () => {
    const { hand } = onBigFlop();
    expect(hand.state.potTotal).toBe(BB(9));
    for (const [fraction, expected] of [
      [0.33, Money.mbb(2970)],
      [0.5, Money.mbb(4500)],
      [0.75, Money.mbb(6750)],
    ] as const) {
      const suggestion = wagerToForPotFraction(hand.state, 1, fraction, 'round');
      expect(suggestion.ok).toBe(true);
      if (!suggestion.ok) throw new Error('no suggestion');
      expect(suggestion.value.toAmount).toBe(expected);
      expect(suggestion.value.additional).toBe(expected);
      expect(suggestion.value.clampedTo).toBeNull();
      expect(suggestion.value.requestedFraction).toBe(fraction);
    }
  });

  it('facing a bet, sizes from the pot AFTER the call', () => {
    const { hand, factory } = onFlop();
    const bet = play(hand, [{ kind: 'BET', toAmount: BB(3) }], factory);
    // Pot is now 6; the BB would call 3, so potAfterCall is 9 and a 75% raise is
    // 3 + round(9 * 0.75) = 3 + 6.75 = 9.75.
    const suggestion = wagerToForPotFraction(bet.state, 2, 0.75, 'round');
    if (!suggestion.ok) throw new Error('no suggestion');
    expect(bet.state.potTotal).toBe(BB(6));
    expect(suggestion.value.toAmount).toBe(Money.mbb(9750));
  });

  it('rounds explicitly rather than implicitly', () => {
    const { hand } = onBigFlop();
    // 0.3333 x 9000 = 2999.7 milliBB.
    expect(unwrapTo(wagerToForPotFraction(hand.state, 1, 0.3333, 'floor'))).toBe(Money.mbb(2999));
    expect(unwrapTo(wagerToForPotFraction(hand.state, 1, 0.3333, 'ceil'))).toBe(Money.mbb(3000));
    expect(unwrapTo(wagerToForPotFraction(hand.state, 1, 0.3333, 'round'))).toBe(Money.mbb(3000));
  });

  it('clamps a shortcut below the minimum bet up to it', () => {
    const { hand } = onFlop();
    expect(hand.state.potTotal).toBe(BB(3));
    const third = wagerToForPotFraction(hand.state, 1, 0.33, 'round');
    if (!third.ok) throw new Error('no suggestion');
    // 0.33 x 3 BB = 0.99 BB, below the 1 BB minimum bet.
    expect(third.value.toAmount).toBe(BB(1));
    expect(third.value.clampedTo).toBe('MIN');
  });

  it('clamps into the legal band and says which way it clamped', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    let hand = play(start(table, factory), [call(), call(), check()], factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    const tiny = wagerToForPotFraction(hand.state, 1, 0.01, 'round');
    if (!tiny.ok) throw new Error('no suggestion');
    expect(tiny.value.toAmount).toBe(BB(1)); // config.minBet
    expect(tiny.value.clampedTo).toBe('MIN');

    const huge = wagerToForPotFraction(hand.state, 1, 100, 'round');
    if (!huge.ok) throw new Error('no suggestion');
    expect(huge.value.toAmount).toBe(BB(99));
    expect(huge.value.clampedTo).toBe('MAX');
  });

  it('refuses when nobody is on the clock or the wrong seat is asked', () => {
    const { hand } = onFlop();
    expect(errCode(wagerToForPotFraction(hand.state, 2, 0.5, 'round'))).toBe('NOT_ACTORS_TURN');
    const start0 = { ...hand.state, phase: 'AWAITING_AWARD' as const };
    expect(errCode(wagerToForPotFraction(start0, 1, 0.5, 'round'))).toBe('NOT_BETTING_PHASE');
    expect(errCode(wagerToForPotFraction(hand.state, 1, -1, 'round'))).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('exposes the UX shortcut set', () => {
    expect(POT_FRACTION_SHORTCUTS).toEqual([0.33, 0.5, 0.75]);
  });
});

function unwrapTo(result: ReturnType<typeof wagerToForPotFraction>): number {
  if (!result.ok) throw new Error(result.error.message);
  return result.value.toAmount;
}

describe('the live raise preview from docs/UX.md', () => {
  it('fills the preview block verbatim', () => {
    const factory = ids();
    // Street contribution 2.5 BB, raise to 9 -> additional 6.5, min 5, max 93.7.
    const table = buildTable({
      stacks: { 0: BB(96.2), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, factory);
    hand = play(hand, [{ kind: 'RAISE', toAmount: BB(2.5) }, fold(), fold()], factory);
    hand = play(hand, [{ kind: 'RAISE', toAmount: BB(4) }, fold(), fold()], factory);
    expect(hand.state.actorSeat).toBe(3);
    const preview = previewWager(hand.state, 3, BB(9));
    expect(preview.toAmount).toBe(BB(9));
    expect(preview.additional).toBe(BB(6.5));
    expect(preview.minToAmount).toBe(BB(5.5));
    expect(preview.legal).toBe(true);
    expect(preview.error).toBeNull();
  });

  it('never refuses: it reports illegality inline so the input stays live', () => {
    const { hand } = onFlop();
    const belowMin = previewWager(hand.state, 1, Money.mbb(500));
    expect(belowMin.legal).toBe(false);
    expect(belowMin.error?.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(belowMin.toAmount).toBe(Money.mbb(500));
    expect(belowMin.additional).toBe(Money.mbb(500));

    const tooBig = previewWager(hand.state, 1, BB(500));
    expect(tooBig.legal).toBe(false);
    expect(tooBig.error?.code).toBe('INSUFFICIENT_STACK');

    const nonsense = previewWager(hand.state, 1, 1.5 as never);
    expect(nonsense.legal).toBe(false);
    expect(nonsense.error?.code).toBe('AMOUNT_OUT_OF_RANGE');
    expect(nonsense.additional).toBe(Money.ZERO);
  });

  it('reports the pot before and after and the fraction of the pot', () => {
    const { hand } = onFlop();
    const preview = previewWager(hand.state, 1, BB(1.5));
    expect(preview.potBefore).toBe(BB(3));
    expect(preview.potAfter).toBe(BB(4.5));
    expect(preview.fractionOfPotBefore).toBeCloseTo(0.5, 10);
    expect(preview.isAllIn).toBe(false);
  });

  it('marks the all-in level', () => {
    const { hand } = onFlop();
    const preview = previewWager(hand.state, 1, BB(99));
    expect(preview.isAllIn).toBe(true);
    expect(preview.legal).toBe(true);
  });

  it('reports NOT_BETTING_PHASE when the hand is not in a betting round', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    const preview = previewWager(hand.state, 2, BB(5));
    expect(preview.legal).toBe(false);
    expect(preview.error?.code).toBe('NOT_BETTING_PHASE');
  });
});
