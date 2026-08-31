/** Sizing arithmetic in integer milliBB, and the clamp-and-degrade legality policy. */
import { Money, type MilliBB } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import type { StrategyWagerOption } from '../types.js';
import {
  addRatioTimes,
  bbVsSbLimpSizing,
  clampSizing,
  fiveBetShoveSizing,
  fourBetSizing,
  isoSizing,
  rfiSizing,
  squeezeSizing,
  threeBetSizing,
} from './sizing.js';

const BB = (bb: number): MilliBB => Money.fromBB(bb);

const wager = (minToBB: number, maxToBB: number): StrategyWagerOption => ({
  kind: 'RAISE',
  minToAmountMbb: BB(minToBB),
  maxToAmountMbb: BB(maxToBB),
  minAdditionalMbb: BB(minToBB),
  maxAdditionalMbb: BB(maxToBB),
  onlyAllIn: false,
});

describe('open sizing', () => {
  it('raises to 2.5bb first in, 3bb from the small blind', () => {
    expect(rfiSizing(BB(1), 'CO').toAmountMbb).toBe(2500);
    expect(rfiSizing(BB(1), 'SB').toAmountMbb).toBe(3000);
    expect(rfiSizing(BB(1), 'CO').ruleId).toBe('SIZE_RFI');
  });

  it('adds one big blind per limper', () => {
    expect(isoSizing(BB(1), 'CO', 0).toAmountMbb).toBe(2500);
    expect(isoSizing(BB(1), 'CO', 1).toAmountMbb).toBe(3500);
    expect(isoSizing(BB(1), 'CO', 3).toAmountMbb).toBe(5500);
    expect(isoSizing(BB(1), 'SB', 2).toAmountMbb).toBe(5000);
  });

  it('raises an SB limp to 3.5bb from the big blind', () => {
    expect(bbVsSbLimpSizing(BB(1)).toAmountMbb).toBe(3500);
  });
});

describe('re-raise sizing', () => {
  it('3-bets to 3x the open in position and 4x out of position', () => {
    expect(threeBetSizing(BB(2.5), 'IP').toAmountMbb).toBe(7500);
    expect(threeBetSizing(BB(2.5), 'OOP').toAmountMbb).toBe(10000);
    expect(threeBetSizing(BB(2.5), 'IP').ruleId).toBe('SIZE_THREE_BET_IP');
    expect(threeBetSizing(BB(2.5), 'OOP').ruleId).toBe('SIZE_THREE_BET_OOP');
  });

  it('4-bets to 2.3x the 3-bet in position and 2.5x out of position', () => {
    expect(fourBetSizing(BB(7.5), 'IP').toAmountMbb).toBe(17250);
    expect(fourBetSizing(BB(7.5), 'OOP').toAmountMbb).toBe(18750);
  });

  it('rounds a fractional 2.3x product once, explicitly', () => {
    // 2.3 * 9.999bb = 22997.7 mbb -> 22998 under half-away-from-zero rounding.
    expect(fourBetSizing(Money.mbb(9999), 'IP').toAmountMbb).toBe(22998);
  });

  it('squeezes to 4x in position, 5x out, plus 1x per extra cold caller', () => {
    expect(squeezeSizing(BB(2.5), 'IP', 1).toAmountMbb).toBe(10000);
    expect(squeezeSizing(BB(2.5), 'OOP', 1).toAmountMbb).toBe(12500);
    expect(squeezeSizing(BB(2.5), 'IP', 2).toAmountMbb).toBe(12500);
    expect(squeezeSizing(BB(2.5), 'OOP', 3).toAmountMbb).toBe(17500);
    // A squeeze with no cold caller behind still gets the base multiplier, never less.
    expect(squeezeSizing(BB(2.5), 'IP', 0).toAmountMbb).toBe(10000);
  });

  it('shoves for the 5-bet', () => {
    expect(fiveBetShoveSizing(wager(20, 100)).toAmountMbb).toBe(100000);
    expect(fiveBetShoveSizing(wager(20, 100)).ruleId).toBe('SIZE_FIVE_BET_SHOVE');
  });
});

describe('clamp-and-degrade', () => {
  it('leaves a legal size alone and keeps its provenance', () => {
    const sizing = clampSizing(rfiSizing(BB(1), 'CO'), wager(2, 100));
    expect(sizing.toAmountMbb).toBe(2500);
    expect(sizing.clamp).toBe('NONE');
    expect(sizing.provenance).toBe('SOURCE');
    expect(sizing.requestedToAmountMbb).toBe(2500);
  });

  it('raises a too-small request to the minimum and degrades one step', () => {
    const sizing = clampSizing(rfiSizing(BB(1), 'CO'), wager(6, 100));
    expect(sizing.toAmountMbb).toBe(6000);
    expect(sizing.clamp).toBe('RAISED_TO_MINIMUM');
    expect(sizing.provenance).toBe('DERIVED');
    // The request is never destroyed (CLAUDE.md rule 3).
    expect(sizing.requestedToAmountMbb).toBe(2500);
  });

  it('lowers a too-large request to the maximum and degrades one step', () => {
    const sizing = clampSizing(threeBetSizing(BB(2.5), 'OOP'), wager(5, 8));
    expect(sizing.toAmountMbb).toBe(8000);
    expect(sizing.clamp).toBe('LOWERED_TO_MAXIMUM');
    expect(sizing.provenance).toBe('DERIVED');
    expect(sizing.requestedToAmountMbb).toBe(10000);
  });

  it('degrades a DERIVED rule to HEURISTIC when clamped, and never below', () => {
    const sizing = clampSizing(threeBetSizing(BB(2.5), 'IP'), wager(20, 100));
    expect(sizing.provenance).toBe('HEURISTIC');
    const shove = clampSizing(fiveBetShoveSizing(wager(20, 100)), wager(20, 40));
    expect(shove.provenance).toBe('HEURISTIC');
  });

  it('never emits a size outside the engine bounds', () => {
    for (const [min, max] of [
      [2, 100],
      [6, 100],
      [2, 3],
      [40, 40],
    ] as const) {
      const sizing = clampSizing(rfiSizing(BB(1), 'SB'), wager(min, max));
      expect(sizing.toAmountMbb).toBeGreaterThanOrEqual(BB(min));
      expect(sizing.toAmountMbb).toBeLessThanOrEqual(BB(max));
    }
  });
});

describe('ratio combination honours BOTH parts of every ratio (MINOR-3)', () => {
  it('adds a whole-number multiple of a unit-denominator ratio', () => {
    // 4x + 2 * 1x = 6x, over denominator 1.
    expect(
      addRatioTimes({ numerator: 4, denominator: 1 }, { numerator: 1, denominator: 1 }, 2),
    ).toEqual({ numerator: 6, denominator: 1 });
  });

  it('does not silently drop the addend denominator', () => {
    // 4x + 3 * (1/2)x = 5.5x. Reading only the addend's NUMERATOR gives 7x — the defect.
    const combined = addRatioTimes(
      { numerator: 4, denominator: 1 },
      { numerator: 1, denominator: 2 },
      3,
    );
    expect(combined.numerator / combined.denominator).toBe(5.5);
    expect(Money.mulRatio(BB(3), combined.numerator, combined.denominator, 'round')).toBe(BB(16.5));
  });

  it('does not silently drop the base denominator either', () => {
    // (7/2)x + 1 * 1x = 4.5x.
    const combined = addRatioTimes(
      { numerator: 7, denominator: 2 },
      { numerator: 1, denominator: 1 },
      1,
    );
    expect(combined.numerator / combined.denominator).toBe(4.5);
  });

  it('leaves the shipped squeeze numbers unchanged', () => {
    // S8: 4x IP / 5x OOP, +1x per cold caller BEYOND the first.
    expect(squeezeSizing(BB(3), 'IP', 1).toAmountMbb).toBe(BB(12));
    expect(squeezeSizing(BB(3), 'OOP', 1).toAmountMbb).toBe(BB(15));
    expect(squeezeSizing(BB(3), 'IP', 3).toAmountMbb).toBe(BB(18));
  });
});
