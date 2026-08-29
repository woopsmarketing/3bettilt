import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import type { FeeConfig } from './config.js';
import { allocateFee, resolveFee } from './fee.js';
import type { Pot } from './pots.js';
import { CP_NL50_6MAX_ANTE } from './presets.js';

const NEVER: FeeConfig = CP_NL50_6MAX_ANTE.fee;
const MANUAL: FeeConfig = { ...NEVER, triggerPolicy: 'MANUAL' };
const CTX = { gross: Money.mbb(20_000), rake: Money.mbb(1000) };

function code(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

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

describe('the shipped fee policy charges nothing', () => {
  it("ships 'NEVER' on both presets, because the trigger is unknown (ADR-0032)", () => {
    expect(NEVER).toEqual({ triggerPolicy: 'NEVER', cap: 8000, allocation: 'PROPORTIONAL' });
  });

  it('resolves to ZERO whenever nothing is supplied, under either policy', () => {
    for (const config of [NEVER, MANUAL]) {
      const result = resolveFee(null, config, CTX);
      expect(result.ok && result.value).toBe(Money.ZERO);
    }
  });

  it('accepts an explicit ZERO everywhere: a zero fee is the absence of a fee', () => {
    for (const config of [NEVER, MANUAL]) {
      const result = resolveFee(Money.ZERO, config, CTX);
      expect(result.ok && result.value).toBe(Money.ZERO);
    }
  });
});

describe('a manually supplied fee is observed input, validated but never rewritten', () => {
  it('returns the amount EXACTLY as entered — no quantizing, no clamping', () => {
    // 137 is not a multiple of the rake quantum, and it is kept anyway: this is what the
    // user says the site charged, and CLAUDE.md rule 3 forbids overwriting it.
    const result = resolveFee(Money.mbb(137), MANUAL, CTX);
    expect(result.ok && result.value).toBe(137);
    expect(CP_NL50_6MAX_ANTE.rake.quantum).toBe(20);
  });

  it("rejects a non-zero fee while the policy is 'NEVER'", () => {
    expect(code(resolveFee(Money.mbb(100), NEVER, CTX))).toBe('FEE_NOT_ALLOWED');
  });

  it('rejects a negative fee under every policy', () => {
    expect(code(resolveFee(Money.mbb(-1), MANUAL, CTX))).toBe('FEE_NEGATIVE');
    expect(code(resolveFee(Money.mbb(-1), NEVER, CTX))).toBe('FEE_NEGATIVE');
  });

  it('rejects a fee above the cap, which exists to catch a typo', () => {
    expect(code(resolveFee(Money.mbb(8001), MANUAL, CTX))).toBe('FEE_ABOVE_CAP');
    expect(
      resolveFee(Money.mbb(8000), MANUAL, { gross: Money.mbb(50_000), rake: Money.ZERO }).ok,
    ).toBe(true);
  });

  it('rejects a fee that, with the rake, would exceed the pot', () => {
    // gross 1000, rake 900 -> only 100 is left to take.
    const tight = { gross: Money.mbb(1000), rake: Money.mbb(900) };
    expect(resolveFee(Money.mbb(100), MANUAL, tight).ok).toBe(true);
    expect(code(resolveFee(Money.mbb(101), MANUAL, tight))).toBe('FEE_EXCEEDS_POT');
  });
});

describe('fee allocation reuses the rake allocator with a reduced ceiling', () => {
  it('is a no-op for a single pot', () => {
    expect(
      allocateFee([pot(0, 20_000)], [Money.mbb(1000)], Money.mbb(500), 'PROPORTIONAL'),
    ).toEqual([Money.mbb(500)]);
  });

  it('splits proportionally on the GROSS pot amounts and sums exactly', () => {
    const pots = [pot(0, 10_000), pot(1, 5_000)];
    const rake = [Money.mbb(500), Money.mbb(250)];
    const shares = allocateFee(pots, rake, Money.mbb(751), 'PROPORTIONAL');
    expect(shares).toEqual([Money.mbb(501), Money.mbb(250)]);
    expect(Money.sum(shares)).toBe(Money.mbb(751));
  });

  it('drains from the main pot first when configured to', () => {
    const pots = [pot(0, 600), pot(1, 5_000)];
    const rake = [Money.mbb(100), Money.mbb(0)];
    const shares = allocateFee(pots, rake, Money.mbb(1000), 'MAIN_POT_FIRST');
    // The main pot only has 600 - 100 = 500 left after the rake.
    expect(shares).toEqual([Money.mbb(500), Money.mbb(500)]);
    expect(Money.sum(shares)).toBe(Money.mbb(1000));
  });

  it('never charges a pot more than the rake left in it', () => {
    const pots = [pot(0, 1000), pot(1, 1000)];
    const rake = [Money.mbb(950), Money.mbb(50)];
    const shares = allocateFee(pots, rake, Money.mbb(1000), 'PROPORTIONAL');
    // Proportionally each pot would take 500, but pot 0 has only 50 left; the rest
    // spills into pot 1, which has 950 of room.
    expect(shares).toEqual([Money.mbb(50), Money.mbb(950)]);
    shares.forEach((share, index) => {
      expect(share).toBeLessThanOrEqual(1000 - (rake[index] as number));
    });
  });

  it('allocates zero when there is no fee, which is the shipped case', () => {
    expect(
      allocateFee([pot(0, 100), pot(1, 100)], [Money.ZERO, Money.ZERO], Money.ZERO, 'PROPORTIONAL'),
    ).toEqual([Money.ZERO, Money.ZERO]);
  });

  it('refuses to allocate more fee than the pots have left after the rake', () => {
    expect(() =>
      allocateFee([pot(0, 1000)], [Money.mbb(400)], Money.mbb(601), 'PROPORTIONAL'),
    ).toThrow(/fee 601 exceeds the pot total 600/);
  });
});
