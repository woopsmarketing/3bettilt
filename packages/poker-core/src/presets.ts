/** Shipped game presets. The MVP target is CoinPoker-style 6-max NLHE NL50. */
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS, withAnteEnabled, type TableConfig } from './config.js';

/**
 * CoinPoker-style NL50 6-max with the 0.16 BB per-player ante enabled.
 * SB 0.5 BB / BB 1 BB, minBet 1 BB, rake 5% capped at 8 BB, settled to the nearest
 * 20 milliBB (one currency cent at BB = 0.50), no-flop-no-drop, no fee, reference
 * stack 100 BB.
 *
 * Every rake and fee value here is an honest DEFAULT, not a claim about CoinPoker
 * (ADR-0033). What is observed: a nominal 5% rate; preflop-only hands raked zero;
 * postflop hands raked a percentage; two recorded amounts consistent with rounding to
 * the nearest cent. What is NOT observed and therefore not asserted: the half-way
 * tie-break, the fee trigger, and whether the 8 BB cap varies with the dealt-in count.
 */
export const CP_NL50_6MAX_ANTE: TableConfig = {
  presetId: 'CP_NL50_6MAX_ANTE',
  label: 'CoinPoker NL50 6-max (ante)',
  seatCount: 6,
  blinds: { smallBlind: Money.mbb(500), bigBlind: Money.mbb(1000) },
  minBet: Money.mbb(1000),
  ante: { enabled: true, mode: 'PER_DEALT_IN_PLAYER', amount: Money.mbb(160) },
  rake: {
    numerator: 5,
    denominator: 100,
    cap: Money.mbb(8000),
    // One currency cent at BB = 0.50. Stated here, never derived from `display`.
    quantum: Money.mbb(20),
    // ADR-0027 falsified ADR-0009's milliBB floor for CoinPoker with two real hands.
    rounding: 'round',
    triggerPolicy: 'NO_FLOP_NO_DROP',
    allocation: 'PROPORTIONAL',
  },
  // No automatic splash fee: CoinPoker's trigger is unknown and must not be invented.
  fee: { triggerPolicy: 'NEVER', cap: Money.mbb(8000), allocation: 'PROPORTIONAL' },
  rules: DEFAULT_RULE_OPTIONS,
  referenceStack: Money.mbb(100_000),
  display: { bigBlindValue: 0.5, symbol: '$' },
};

/** Identical to `CP_NL50_6MAX_ANTE` with the ante switched off. */
export const CP_NL50_6MAX_NO_ANTE: TableConfig = {
  ...withAnteEnabled(CP_NL50_6MAX_ANTE, false),
  presetId: 'CP_NL50_6MAX',
  label: 'CoinPoker NL50 6-max',
};

export const PRESETS: readonly TableConfig[] = [CP_NL50_6MAX_ANTE, CP_NL50_6MAX_NO_ANTE];
