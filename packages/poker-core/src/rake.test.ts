import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { validateTableConfig, type RakeConfig } from './config.js';
import { CP_NL50_6MAX_ANTE } from './presets.js';
import { allocateRake, computeRake } from './rake.js';
import type { Pot } from './pots.js';
import { BB } from './testing.js';

/** 5 / 100, cap 8000, quantum 20 (one cent at BB = 0.50), rounding 'round'. */
const RAKE: RakeConfig = CP_NL50_6MAX_ANTE.rake;
const SAW_FLOP = { sawFlop: true, contenderCount: 2 };
const NO_FLOP = { sawFlop: false, contenderCount: 2 };

/** ADR-0009's original milliBB floor, still a supported configuration. */
const MILLI_FLOOR: RakeConfig = { ...RAKE, quantum: Money.mbb(1), rounding: 'floor' };

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

describe('the shipped NL50 rake policy', () => {
  it('states its granularity: settlement is quantized to one currency cent', () => {
    expect(RAKE.quantum).toBe(20);
    expect(RAKE.rounding).toBe('round');
    expect(RAKE.triggerPolicy).toBe('NO_FLOP_NO_DROP');
    // The quantum is NOT derived from the display; the two just happen to agree.
    expect(CP_NL50_6MAX_ANTE.display.bigBlindValue).toBe(0.5);
  });
});

describe('rake computation is an exact rational, never a float', () => {
  it('takes 5% when that is already a whole number of quanta', () => {
    // 5% of 20000 is 1000 = 50 cents exactly; nothing to round.
    expect(computeRake(BB(20), RAKE, SAW_FLOP)).toEqual({
      gross: BB(20),
      rake: BB(1),
      net: BB(19),
      capped: false,
      waived: false,
    });
    // 5% of 8000 is 400 = 20 cents exactly.
    expect(computeRake(Money.mbb(8000), RAKE, SAW_FLOP).rake).toBe(400);
  });

  it('quantizes to the nearest cent when 5% is not a whole number of quanta', () => {
    // The two real CoinPoker observations from ADR-0027, in milliBB.
    // 5% of 10740 is 537 -> 540 (0.27), which the hand history records.
    expect(computeRake(Money.mbb(10_740), RAKE, SAW_FLOP).rake).toBe(540);
    // 5% of 13740 is 687 -> 680 (0.34), which the hand history records.
    expect(computeRake(Money.mbb(13_740), RAKE, SAW_FLOP).rake).toBe(680);
    // Neither is reproduced by flooring or ceiling at cent granularity, which is what
    // makes those two hands evidence for "nearest" rather than a preference.
    expect(computeRake(Money.mbb(10_740), { ...RAKE, rounding: 'floor' }, SAW_FLOP).rake).toBe(520);
    expect(computeRake(Money.mbb(13_740), { ...RAKE, rounding: 'ceil' }, SAW_FLOP).rake).toBe(700);
  });

  it('rounds ONCE — quantizing a milliBB rake afterwards would be a cent out', () => {
    // 5% of 4190 is exactly 209.5 milliBB; the nearest cent is 200, not 220.
    expect(computeRake(Money.mbb(4190), RAKE, SAW_FLOP).rake).toBe(200);
    // The two-step form: 209.5 -> 210 -> (210/20 = 10.5, tie away) -> 220.
    expect(Money.quantize(Money.mulRatio(Money.mbb(4190), 5, 100, 'round'), 20, 'round')).toBe(220);
  });

  it('pins the half-way case, which NO observation has distinguished', () => {
    // ASSUMPTION (ADR-0027 / ADR-0033). 5% of 4200 is 210 milliBB — exactly half a
    // 20 milliBB quantum between 200 and 220. `Money`'s 'round' is half-AWAY-FROM-ZERO,
    // so this lands on 220. No real hand in evidence is an exact half-cent tie, so this
    // is a documented default, not a claim about CoinPoker. Correct it with
    // `rake.rounding` — never in code.
    expect(computeRake(Money.mbb(4200), RAKE, SAW_FLOP).rake).toBe(220);
    expect(computeRake(Money.mbb(4200), { ...RAKE, rounding: 'floor' }, SAW_FLOP).rake).toBe(200);
    expect(computeRake(Money.mbb(4200), { ...RAKE, rounding: 'ceil' }, SAW_FLOP).rake).toBe(220);
  });

  it('still floors at milliBB when a configuration asks for it (ADR-0009)', () => {
    expect(computeRake(BB(19), MILLI_FLOOR, SAW_FLOP).rake).toBe(950);
    // 5% of 19_999 is 999.95 -> 999.
    expect(computeRake(Money.mbb(19_999), MILLI_FLOOR, SAW_FLOP).rake).toBe(999);
    // The same pot under the shipped cent policy: 999.95 / 20 = 49.9975 -> 50 -> 1000.
    expect(computeRake(Money.mbb(19_999), RAKE, SAW_FLOP).rake).toBe(1000);
  });

  it('caps at 8 BB per hand, and the cap is itself a whole number of quanta', () => {
    expect(RAKE.cap % RAKE.quantum).toBe(0);
    const result = computeRake(BB(200), RAKE, SAW_FLOP);
    expect(result.rake).toBe(BB(8));
    expect(result.net).toBe(BB(192));
    expect(result.capped).toBe(true);
  });

  it('does not report a raw rake that lands exactly ON the cap as capped', () => {
    // 5% of 160000 is 8000 = the cap, reached without the cap doing anything.
    expect(computeRake(Money.mbb(160_000), RAKE, SAW_FLOP)).toMatchObject({
      rake: 8000,
      capped: false,
    });
    // 5% of 159999 is 7999.95, which quantizes UP to the cap. Still not "capped".
    expect(computeRake(Money.mbb(159_999), RAKE, SAW_FLOP)).toMatchObject({
      rake: 8000,
      capped: false,
    });
    // One cent of pot further and the cap genuinely binds.
    expect(computeRake(Money.mbb(164_000), RAKE, SAW_FLOP)).toMatchObject({
      rake: 8000,
      capped: true,
    });
  });

  it("waives the rake entirely under 'NO_FLOP_NO_DROP'", () => {
    const result = computeRake(BB(20), RAKE, NO_FLOP);
    expect(result).toEqual({
      gross: BB(20),
      rake: Money.ZERO,
      net: BB(20),
      capped: false,
      waived: true,
    });
  });

  it("rakes a preflop-only pot under 'ALWAYS'", () => {
    const always: RakeConfig = { ...RAKE, triggerPolicy: 'ALWAYS' };
    expect(computeRake(BB(20), always, NO_FLOP).rake).toBe(BB(1));
    expect(computeRake(BB(20), always, NO_FLOP).waived).toBe(false);
    // ...and the flop makes no difference to it.
    expect(computeRake(BB(20), always, SAW_FLOP).rake).toBe(BB(1));
  });

  it('rakes nothing from an empty pot', () => {
    expect(computeRake(Money.ZERO, RAKE, SAW_FLOP).rake).toBe(Money.ZERO);
  });

  it('never produces a rake that is not a whole number of quanta', () => {
    for (let gross = 0; gross <= 20_000; gross += 137) {
      const rake = computeRake(Money.mbb(gross), RAKE, SAW_FLOP).rake;
      expect(rake % RAKE.quantum).toBe(0);
      expect(rake).toBeLessThanOrEqual(gross);
    }
  });

  it('carries the whole policy through validateTableConfig', () => {
    expect(validateTableConfig(CP_NL50_6MAX_ANTE).ok).toBe(true);
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
