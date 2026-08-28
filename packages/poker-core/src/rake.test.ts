import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import type { RakeConfig } from './config.js';
import { CP_NL50_6MAX_ANTE } from './presets.js';
import { allocateRake, computeRake } from './rake.js';
import type { Pot } from './pots.js';
import { BB } from './testing.js';

const RAKE: RakeConfig = CP_NL50_6MAX_ANTE.rake;
const SAW_FLOP = { sawFlop: true, contenderCount: 2 };
const NO_FLOP = { sawFlop: false, contenderCount: 2 };

function pot(index: number, amount: number): Pot {
  return {
    index,
    kind: index === 0 ? 'MAIN' : 'SIDE',
    amount: Money.mbb(amount),
    capLevel: Money.mbb(amount),
    eligibleSeats: [0, 1],
    awarded: false,
  };
}

describe('rake computation is an exact rational, never a float', () => {
  it('takes 5% floored', () => {
    expect(computeRake(BB(20), RAKE, SAW_FLOP)).toEqual({
      gross: BB(20),
      rake: BB(1),
      net: BB(19),
      capped: false,
      waived: false,
    });
    expect(computeRake(BB(19), RAKE, SAW_FLOP).rake).toBe(Money.mbb(950));
  });

  it('floors rather than rounds (ADR-0009)', () => {
    // 5% of 19_999 is 999.95 -> 999.
    expect(computeRake(Money.mbb(19_999), RAKE, SAW_FLOP).rake).toBe(Money.mbb(999));
  });

  it('caps at 8 BB per hand', () => {
    const result = computeRake(BB(200), RAKE, SAW_FLOP);
    expect(result.rake).toBe(BB(8));
    expect(result.net).toBe(BB(192));
    expect(result.capped).toBe(true);
  });

  it('waives the rake entirely under no-flop-no-drop', () => {
    const result = computeRake(BB(20), RAKE, NO_FLOP);
    expect(result).toEqual({
      gross: BB(20),
      rake: Money.ZERO,
      net: BB(20),
      capped: false,
      waived: true,
    });
  });

  it('rakes a preflop-decided hand when no-flop-no-drop is turned off', () => {
    const always: RakeConfig = { ...RAKE, noFlopNoDrop: false };
    expect(computeRake(BB(20), always, NO_FLOP).rake).toBe(BB(1));
  });

  it('rakes nothing from an empty pot', () => {
    expect(computeRake(Money.ZERO, RAKE, SAW_FLOP).rake).toBe(Money.ZERO);
  });

  it('honours a different rounding mode from configuration', () => {
    const ceiling: RakeConfig = { ...RAKE, rounding: 'ceil' };
    expect(computeRake(Money.mbb(19_999), ceiling, SAW_FLOP).rake).toBe(Money.mbb(1000));
  });
});

describe('rake allocation across side pots', () => {
  it('is a no-op for a single pot', () => {
    expect(allocateRake([pot(0, 20_000)], BB(1), 'PROPORTIONAL')).toEqual([BB(1)]);
  });

  it('splits proportionally, with the floor remainder to the main pot', () => {
    const pots = [pot(0, 10_000), pot(1, 5_000)];
    const shares = allocateRake(pots, Money.mbb(751), 'PROPORTIONAL');
    // floor(751 * 10000 / 15000) = 500, floor(751 * 5000 / 15000) = 250, remainder 1.
    expect(shares).toEqual([Money.mbb(501), Money.mbb(250)]);
    expect(Money.sum(shares)).toBe(Money.mbb(751));
  });

  it('drains the main pot first when configured to', () => {
    const pots = [pot(0, 600), pot(1, 5_000)];
    const shares = allocateRake(pots, Money.mbb(1000), 'MAIN_POT_FIRST');
    expect(shares).toEqual([Money.mbb(600), Money.mbb(400)]);
    expect(Money.sum(shares)).toBe(Money.mbb(1000));
  });

  it('always sums EXACTLY to the total rake', () => {
    for (const total of [1, 7, 999, 1001, 8000]) {
      const pots = [pot(0, 3333), pot(1, 3333), pot(2, 3334)];
      const shares = allocateRake(pots, Money.mbb(total), 'PROPORTIONAL');
      expect(Money.sum(shares)).toBe(Money.mbb(total));
      expect(shares).toHaveLength(3);
    }
  });

  it('allocates zero when there is no rake', () => {
    expect(allocateRake([pot(0, 100), pot(1, 100)], Money.ZERO, 'PROPORTIONAL')).toEqual([
      Money.ZERO,
      Money.ZERO,
    ]);
  });

  it('refuses to allocate more rake than the pots hold', () => {
    expect(() => allocateRake([pot(0, 100)], BB(1), 'PROPORTIONAL')).toThrow(/exceeds/);
  });
});
