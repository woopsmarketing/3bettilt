/** Shipped game presets. The MVP target is CoinPoker-style 6-max NLHE NL50. */
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS, withAnteEnabled, type TableConfig } from './config.js';

/**
 * CoinPoker-style NL50 6-max with the 0.16 BB per-player ante enabled.
 * SB 0.5 BB / BB 1 BB, minBet 1 BB, rake 5% capped at 8 BB (floored, no-flop-no-drop),
 * reference stack 100 BB.
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
    rounding: 'floor',
    noFlopNoDrop: true,
    allocation: 'PROPORTIONAL',
  },
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
