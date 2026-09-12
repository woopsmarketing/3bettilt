import { describe, expect, it } from 'vitest';
import { Money, isErr, isOk, unwrap, type MilliBB } from '@gto-self/shared';
import { potOdds, type PotOddsError } from './potOdds.js';

const bb = (value: number): MilliBB => Money.fromBB(value);

const compute = (pot: number, bet: number, call: number) =>
  potOdds({
    potBeforeCallMbb: bb(pot),
    villainBetMbb: bb(bet),
    callAmountMbb: bb(call),
  });

const errorOf = (pot: number, bet: number, call: number): PotOddsError => {
  const result = compute(pot, bet, call);
  if (isOk(result)) throw new Error('expected an error, got a result');
  return result.error;
};

describe('potOdds', () => {
  it('reproduces the worked example the UI teaches', () => {
    // 현재 팟 20BB, 상대가 10BB 베팅, 콜 10BB -> 최종 팟 40BB, 필요 승률 25%.
    const odds = unwrap(compute(20, 10, 10));

    expect(odds.finalPotMbb).toBe(bb(40));
    expect(odds.requiredEquity).toBeCloseTo(0.25, 10);
    expect(odds.oneInN).toBeCloseTo(4, 10);
    expect(odds.oddsAgainst).toBeCloseTo(3, 10);
  });

  it('agrees with the published formula whenever the call covers the bet', () => {
    // call / (potBeforeCall + bet + call), checked across a spread of ordinary spots.
    const spots: ReadonlyArray<readonly [number, number]> = [
      [1.5, 3],
      [6, 4],
      [20, 10],
      [37.5, 25],
      [100, 100],
      [0, 1],
    ];

    for (const [pot, bet] of spots) {
      const odds = unwrap(compute(pot, bet, bet));
      const expected = bet / (pot + bet + bet);

      expect(odds.uncalledReturnMbb).toBe(Money.ZERO);
      expect(odds.calledBetMbb).toBe(bb(bet));
      expect(odds.requiredEquity).toBeCloseTo(expected, 10);
    }
  });

  it('returns the uncalled remainder when hero is all-in for less than the bet', () => {
    // Villain bets 10 but hero can only call 6. The 4BB nobody matched goes back, so the
    // pot being contested is 20 + 6 + 6 = 32, NOT 20 + 10 + 6 = 36.
    const odds = unwrap(compute(20, 10, 6));

    expect(odds.calledBetMbb).toBe(bb(6));
    expect(odds.uncalledReturnMbb).toBe(bb(4));
    expect(odds.finalPotMbb).toBe(bb(32));
    expect(odds.requiredEquity).toBeCloseTo(6 / 32, 10);

    // The naive formula would have quoted a cheaper price than the game actually offers.
    expect(odds.requiredEquity).toBeGreaterThan(6 / 36);
  });

  it('keeps every money value an exact integer milliBB, including fractional BB input', () => {
    const odds = unwrap(compute(2.5, 1.25, 1.25));

    expect(odds.potBeforeCallMbb).toBe(2500);
    expect(odds.villainBetMbb).toBe(1250);
    expect(odds.finalPotMbb).toBe(5000);
    for (const amount of [
      odds.potBeforeCallMbb,
      odds.villainBetMbb,
      odds.callAmountMbb,
      odds.calledBetMbb,
      odds.uncalledReturnMbb,
      odds.finalPotMbb,
    ]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('prices a call into an empty pot', () => {
    // Not a real hold'em spot, but the arithmetic must not special-case it: 1 into 0+1+1.
    const odds = unwrap(compute(0, 1, 1));
    expect(odds.requiredEquity).toBeCloseTo(0.5, 10);
  });

  it('rejects inputs that do not describe a call, with a typed reason', () => {
    expect(errorOf(-1, 10, 10)).toBe('NEGATIVE_POT');
    expect(errorOf(20, -1, 10)).toBe('NEGATIVE_BET');
    expect(errorOf(20, 10, 0)).toBe('NON_POSITIVE_CALL');
    expect(errorOf(20, 10, -5)).toBe('NON_POSITIVE_CALL');
    expect(errorOf(20, 10, 11)).toBe('CALL_EXCEEDS_BET');
  });

  it('never answers a zero call with "0% needed"', () => {
    // Facing no bet there is nothing to price. Silently returning 0 would read as
    // "you need 0% to call", which is a different and false statement.
    const result = compute(20, 0, 0);
    expect(isErr(result)).toBe(true);
  });
});
