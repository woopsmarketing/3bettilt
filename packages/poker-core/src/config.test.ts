import { describe, expect, it } from 'vitest';
import { Money, unwrap } from '@gto-self/shared';
import {
  DEFAULT_RULE_OPTIONS,
  validateTableConfig,
  withAnteEnabled,
  withStakeDisplay,
  type TableConfig,
} from './config.js';
import { CP_NL50_6MAX_ANTE, CP_NL50_6MAX_NO_ANTE } from './presets.js';

function codeOf(config: TableConfig): string | undefined {
  const result = validateTableConfig(config);
  return result.ok ? undefined : result.error.code;
}

describe('the shipped NL50 presets', () => {
  it('encodes the CoinPoker MVP preset exactly', () => {
    expect(CP_NL50_6MAX_ANTE.blinds).toEqual({ smallBlind: 500, bigBlind: 1000 });
    expect(CP_NL50_6MAX_ANTE.minBet).toBe(1000);
    expect(CP_NL50_6MAX_ANTE.ante).toEqual({
      enabled: true,
      mode: 'PER_DEALT_IN_PLAYER',
      amount: 160,
    });
    expect(CP_NL50_6MAX_ANTE.rake).toEqual({
      numerator: 5,
      denominator: 100,
      cap: 8000,
      quantum: 20, // one currency cent at BB = 0.50 (ADR-0027)
      rounding: 'round',
      triggerPolicy: 'NO_FLOP_NO_DROP',
      allocation: 'PROPORTIONAL',
    });
    expect(CP_NL50_6MAX_ANTE.fee).toEqual({
      triggerPolicy: 'NEVER',
      cap: 8000,
      allocation: 'PROPORTIONAL',
    });
    expect(CP_NL50_6MAX_NO_ANTE.fee).toEqual(CP_NL50_6MAX_ANTE.fee);
    expect(CP_NL50_6MAX_ANTE.referenceStack).toBe(100_000);
    expect(CP_NL50_6MAX_ANTE.display).toEqual({ bigBlindValue: 0.5, symbol: '$' });
    expect(CP_NL50_6MAX_ANTE.rules).toEqual(DEFAULT_RULE_OPTIONS);
  });

  it('ships a no-ante twin with a distinct preset id', () => {
    expect(CP_NL50_6MAX_NO_ANTE.ante.enabled).toBe(false);
    expect(CP_NL50_6MAX_NO_ANTE.presetId).toBe('CP_NL50_6MAX');
    expect(CP_NL50_6MAX_NO_ANTE.blinds).toEqual(CP_NL50_6MAX_ANTE.blinds);
  });

  it('validates both presets', () => {
    expect(unwrap(validateTableConfig(CP_NL50_6MAX_ANTE))).toBe(CP_NL50_6MAX_ANTE);
    expect(unwrap(validateTableConfig(CP_NL50_6MAX_NO_ANTE))).toBe(CP_NL50_6MAX_NO_ANTE);
  });
});

describe('preset derivation', () => {
  it('toggles the ante without touching anything else', () => {
    const off = withAnteEnabled(CP_NL50_6MAX_ANTE, false);
    expect(off.ante).toEqual({ ...CP_NL50_6MAX_ANTE.ante, enabled: false });
    expect(off.blinds).toBe(CP_NL50_6MAX_ANTE.blinds);
  });

  it('re-stakes to NL100 by changing only configuration', () => {
    const nl100 = withStakeDisplay(CP_NL50_6MAX_ANTE, {
      presetId: 'CP_NL100_6MAX_ANTE',
      label: 'CoinPoker NL100 6-max (ante)',
      rakeCap: Money.mbb(8000),
      rakeQuantum: Money.mbb(10), // one cent at BB = 1.00
      bigBlindValue: 1,
    });
    expect(nl100.blinds).toEqual(CP_NL50_6MAX_ANTE.blinds);
    expect(nl100.rake.numerator).toBe(5);
    expect(nl100.display.bigBlindValue).toBe(1);
    expect(nl100.presetId).toBe('CP_NL100_6MAX_ANTE');
    // The stake's own settlement granularity moved with it, and stayed valid.
    expect(nl100.rake.quantum).toBe(10);
    expect(validateTableConfig(nl100).ok).toBe(true);
  });

  it('re-stakes without ever reading the display to decide a money value', () => {
    // Same quantum, different display: money must not move because formatting did.
    const relabelled = withStakeDisplay(CP_NL50_6MAX_ANTE, {
      presetId: 'X',
      label: 'X',
      rakeCap: CP_NL50_6MAX_ANTE.rake.cap,
      rakeQuantum: CP_NL50_6MAX_ANTE.rake.quantum,
      bigBlindValue: 25,
    });
    expect(relabelled.rake).toEqual(CP_NL50_6MAX_ANTE.rake);
  });
});

describe('validateTableConfig rejects bad data as user input, not a crash', () => {
  const base = CP_NL50_6MAX_ANTE;

  it('rejects non-positive or inverted blinds', () => {
    expect(codeOf({ ...base, blinds: { smallBlind: Money.ZERO, bigBlind: Money.mbb(1000) } })).toBe(
      'INVALID_CONFIG',
    );
    expect(
      codeOf({ ...base, blinds: { smallBlind: Money.mbb(2000), bigBlind: Money.mbb(1000) } }),
    ).toBe('INVALID_CONFIG');
  });

  it('rejects a non-positive minBet and a negative ante', () => {
    expect(codeOf({ ...base, minBet: Money.ZERO })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, ante: { ...base.ante, amount: Money.mbb(-1) } })).toBe(
      'INVALID_CONFIG',
    );
  });

  it('rejects an enabled ante of zero', () => {
    expect(codeOf({ ...base, ante: { ...base.ante, amount: Money.ZERO } })).toBe('INVALID_CONFIG');
  });

  it('rejects an ante mode it cannot implement rather than half-implementing it', () => {
    const future = {
      ...base,
      ante: { ...base.ante, mode: 'BIG_BLIND_ANTE' },
    } as unknown as TableConfig;
    expect(codeOf(future)).toBe('INVALID_CONFIG');
  });

  it('rejects impossible rake rationals and a negative cap', () => {
    expect(codeOf({ ...base, rake: { ...base.rake, denominator: 0 } })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, rake: { ...base.rake, numerator: 101 } })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, rake: { ...base.rake, numerator: -1 } })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, rake: { ...base.rake, cap: Money.mbb(-1) } })).toBe('INVALID_CONFIG');
  });

  it('rejects a rake quantum that is not a positive integer milliBB', () => {
    expect(codeOf({ ...base, rake: { ...base.rake, quantum: Money.ZERO } })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, rake: { ...base.rake, quantum: Money.mbb(-20) } })).toBe(
      'INVALID_CONFIG',
    );
    const fractional = { ...base, rake: { ...base.rake, quantum: 2.5 as never } };
    expect(codeOf(fractional as unknown as TableConfig)).toBe('INVALID_CONFIG');
  });

  it('rejects a cap that is not an exact multiple of the quantum', () => {
    // A capped rake would otherwise not be quantized, so the settlement would be
    // internally inconsistent: most pots settle in cents and the biggest ones do not.
    expect(codeOf({ ...base, rake: { ...base.rake, cap: Money.mbb(8010) } })).toBe(
      'INVALID_CONFIG',
    );
    // The same cap is fine at milliBB granularity.
    expect(
      codeOf({ ...base, rake: { ...base.rake, cap: Money.mbb(8010), quantum: Money.mbb(1) } }),
    ).toBeUndefined();
  });

  it('rejects an unknown trigger policy on either config rather than defaulting', () => {
    const rake = { ...base, rake: { ...base.rake, triggerPolicy: 'FLOP_SEEN' } };
    expect(codeOf(rake as unknown as TableConfig)).toBe('INVALID_CONFIG');
    const fee = { ...base, fee: { ...base.fee, triggerPolicy: 'EVERY_HAND' } };
    expect(codeOf(fee as unknown as TableConfig)).toBe('INVALID_CONFIG');
  });

  it('rejects an unknown allocation policy on either config', () => {
    const rake = { ...base, rake: { ...base.rake, allocation: 'SIDE_POT_FIRST' } };
    expect(codeOf(rake as unknown as TableConfig)).toBe('INVALID_CONFIG');
    const fee = { ...base, fee: { ...base.fee, allocation: 'SIDE_POT_FIRST' } };
    expect(codeOf(fee as unknown as TableConfig)).toBe('INVALID_CONFIG');
  });

  it('rejects a negative fee cap', () => {
    expect(codeOf({ ...base, fee: { ...base.fee, cap: Money.mbb(-1) } })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, fee: { ...base.fee, cap: Money.ZERO } })).toBeUndefined();
  });

  it('rejects a non-positive reference stack and a non-six seat count', () => {
    expect(codeOf({ ...base, referenceStack: Money.ZERO })).toBe('INVALID_CONFIG');
    expect(codeOf({ ...base, seatCount: 9 } as unknown as TableConfig)).toBe('INVALID_CONFIG');
  });

  it('rejects amounts outside the milliBB range before any Money call', () => {
    const huge = { ...base, minBet: (Money.MAX_MILLI_BB + 1) as never };
    expect(codeOf(huge as unknown as TableConfig)).toBe('INVALID_CONFIG');
    const fractional = { ...base, minBet: 1.5 as never };
    expect(codeOf(fractional as unknown as TableConfig)).toBe('INVALID_CONFIG');
  });
});
