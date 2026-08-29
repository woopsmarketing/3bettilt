/**
 * `TableConfig` — the game preset. Every genuinely ambiguous poker rule lives here as
 * DATA (`CLAUDE.md` rule 7), so correcting a rule is a configuration change, never a
 * code change. Rake in particular is configuration per ADR-0009.
 */
import { Money, ok, type MilliBB, type RoundingMode } from '@gto-self/shared';
import { engineErr, type EngineResult } from './errors.js';

export interface BlindConfig {
  readonly smallBlind: MilliBB; // NL50 preset: 500
  readonly bigBlind: MilliBB; // NL50 preset: 1000
}

export type AnteMode = 'PER_DEALT_IN_PLAYER';

export interface AnteConfig {
  readonly enabled: boolean;
  /**
   * Single member today. `BIG_BLIND_ANTE` is additive later; `validateTableConfig`
   * rejects any mode it cannot implement rather than half-implementing it.
   */
  readonly mode: AnteMode;
  /** Per dealt-in player. NL50 preset: 160 milliBB (0.16 BB). */
  readonly amount: MilliBB;
}

export type RakeAllocation = 'PROPORTIONAL' | 'MAIN_POT_FIRST';

/**
 * When a pot is raked at all.
 * `'ALWAYS'`          — every awarded pot is raked.
 * `'NO_FLOP_NO_DROP'` — the rake is waived when the board never reached three cards.
 *
 * A union rather than a boolean (ADR-0018) so a further real trigger is additive and
 * never touches rake arithmetic. `validateTableConfig` REJECTS a member this version
 * cannot implement rather than defaulting to one.
 */
export type RakeTriggerPolicy = 'ALWAYS' | 'NO_FLOP_NO_DROP';

export interface RakeConfig {
  /** Exact rational so no float percentage ever touches money. 5% => 5 / 100. */
  readonly numerator: number;
  readonly denominator: number;
  /** Absolute per-hand cap in milliBB. NL50 preset: 8000 (8 BB). Must be a multiple of `quantum`. */
  readonly cap: MilliBB;
  /**
   * Settlement granularity in milliBB, and the granularity `rounding` is applied AT.
   * `1` means pure milliBB. The NL50 preset uses `20` because CoinPoker settles in whole
   * currency cents and BB = 0.50 there, so one cent is 20 milliBB (ADR-0027).
   *
   * This is NEVER derived from `DisplayConfig`: that field is presentation, and money
   * must not move when a formatting choice does.
   */
  readonly quantum: MilliBB;
  /**
   * Applied once, at `quantum` granularity. `'round'` is the NL50 default (ADR-0027
   * superseded ADR-0009's milliBB floor for CoinPoker); its half-way behaviour is an
   * ASSUMPTION no observation has distinguished (ADR-0033).
   */
  readonly rounding: RoundingMode;
  /** When a pot is raked at all. ASSUMPTION for CoinPoker (ADR-0018). */
  readonly triggerPolicy: RakeTriggerPolicy;
  /** How one capped total rake is split across side pots. ASSUMPTION. */
  readonly allocation: RakeAllocation;
}

/**
 * When a fee (CoinPoker's "Splash Fee") is deducted.
 * `'NEVER'`  — no fee is ever deducted. The shipped default.
 * `'MANUAL'` — the amount is supplied at award time by the user or, later, the parser.
 *
 * There is deliberately NO automatic trigger: CoinPoker's is unknown (ADR-0032), and
 * CLAUDE.md rule 7 forbids inventing one.
 */
export type FeeTriggerPolicy = 'NEVER' | 'MANUAL';

/**
 * Separate from `RakeConfig` and never collapsed into it (ADR-0018, confirmed by
 * ADR-0032): the splash fee is its own deduction from the pot payout, recorded as its
 * own amount all the way through settlement.
 */
export interface FeeConfig {
  readonly triggerPolicy: FeeTriggerPolicy;
  /**
   * Ceiling on a MANUALLY supplied fee. This rejects a typo; it is not a site rule, and
   * a fee within it is never re-quantized or otherwise rewritten (CLAUDE.md rule 3).
   */
  readonly cap: MilliBB;
  /** How one hand's total fee is split across side pots. Same policy type as rake. */
  readonly allocation: RakeAllocation;
}

export type ShortAllInMinRaiseBasis = 'CURRENT_BET' | 'LAST_FULL_RAISE';
export type HeadsUpButtonLabel = 'BTN' | 'SB';
export type OddChipRule = 'FIRST_LEFT_OF_BUTTON' | 'LOWEST_SEAT_INDEX';

/** Every genuinely ambiguous poker rule lives here as data (CLAUDE.md rule 7). */
export interface RuleOptions {
  /**
   * Minimum legal raise-TO after a SHORT (non-full) all-in raise.
   * 'CURRENT_BET'     => round.currentBet + round.lastFullRaiseSize            (default)
   * 'LAST_FULL_RAISE' => round.lastFullRaiseTo + round.lastFullRaiseSize,
   *                      falling back to the 'CURRENT_BET' formula when that
   *                      value would not exceed round.currentBet.
   */
  readonly shortAllInMinRaiseBasis: ShortAllInMinRaiseBasis;
  /** true => a big blind all-in for less than 1 BB still sets currentBet to the nominal BB. */
  readonly shortBlindSetsFullLevel: boolean;
  /** true => the big blind may check or raise when nobody raised. */
  readonly bigBlindHasOption: boolean;
  /** true => heads-up, the button posts the small blind and acts first preflop. */
  readonly headsUpButtonPostsSmallBlind: boolean;
  /**
   * Position label given to the heads-up button seat. `blinds.smallBlindSeat` is
   * always exposed separately, so this is a labelling choice only.
   */
  readonly headsUpButtonLabel: HeadsUpButtonLabel;
  /** true => a bet/raise is legal even when no opponent has chips behind to respond. */
  readonly allowRaiseWithNoCaller: boolean;
  /** Recipient of the remainder milliBB when a pot splits unevenly. */
  readonly oddChipRule: OddChipRule;
}

/** Presentation only. Feeds `Money.formatCurrency`; the engine never reads it. */
export interface DisplayConfig {
  /** Currency value of one big blind. NL50 => 0.5. */
  readonly bigBlindValue: number;
  readonly symbol: string;
}

export interface TableConfig {
  readonly presetId: string;
  readonly label: string;
  /** Literal 6, kept in sync with `SeatIndex`. */
  readonly seatCount: 6;
  readonly blinds: BlindConfig;
  /** Minimum postflop opening bet. Stated, not assumed equal to the big blind. */
  readonly minBet: MilliBB;
  readonly ante: AnteConfig;
  readonly rake: RakeConfig;
  /** Splash-fee policy. Separate from `rake` and never folded into it (ADR-0018/0032). */
  readonly fee: FeeConfig;
  readonly rules: RuleOptions;
  /** Reference buy-in; consumed by session setup and gto-core stack bucketing. */
  readonly referenceStack: MilliBB;
  readonly display: DisplayConfig;
}

export const DEFAULT_RULE_OPTIONS: RuleOptions = {
  shortAllInMinRaiseBasis: 'CURRENT_BET',
  shortBlindSetsFullLevel: true,
  bigBlindHasOption: true,
  headsUpButtonPostsSmallBlind: true,
  headsUpButtonLabel: 'BTN',
  allowRaiseWithNoCaller: false,
  oddChipRule: 'FIRST_LEFT_OF_BUTTON',
};

const ANTE_MODES: readonly AnteMode[] = ['PER_DEALT_IN_PLAYER'];
const RAKE_TRIGGER_POLICIES: readonly RakeTriggerPolicy[] = ['ALWAYS', 'NO_FLOP_NO_DROP'];
const FEE_TRIGGER_POLICIES: readonly FeeTriggerPolicy[] = ['NEVER', 'MANUAL'];
const RAKE_ALLOCATIONS: readonly RakeAllocation[] = ['PROPORTIONAL', 'MAIN_POT_FIRST'];

function isMoney(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= Money.MAX_MILLI_BB;
}

/**
 * Result. A bad preset is user data, not a programmer error, so it is `INVALID_CONFIG`
 * rather than a throw. Called by `createTable`, `startHand` and `decode`.
 *
 * Rejects: non-money amounts, non-positive blinds, smallBlind > bigBlind, minBet <= 0,
 * negative ante, rake denominator 0, numerator outside 0..denominator, negative rake cap,
 * a rake `quantum` that is not a positive integer milliBB, a rake `cap` that is not an
 * exact multiple of that quantum (a capped rake would otherwise not be quantized and the
 * settlement would be internally inconsistent), a negative fee cap, referenceStack <= 0,
 * seatCount !== 6, and any `AnteMode`, `RakeTriggerPolicy`, `FeeTriggerPolicy` or
 * `RakeAllocation` this version cannot implement.
 */
export function validateTableConfig(config: TableConfig): EngineResult<TableConfig> {
  const bad = (message: string): EngineResult<TableConfig> => engineErr('INVALID_CONFIG', message);

  if (config.seatCount !== 6) return bad('seatCount must be 6 in this version');

  const amounts: readonly (readonly [string, number])[] = [
    ['blinds.smallBlind', config.blinds.smallBlind],
    ['blinds.bigBlind', config.blinds.bigBlind],
    ['minBet', config.minBet],
    ['ante.amount', config.ante.amount],
    ['rake.cap', config.rake.cap],
    ['rake.quantum', config.rake.quantum],
    ['fee.cap', config.fee.cap],
    ['referenceStack', config.referenceStack],
  ];
  for (const [name, value] of amounts) {
    if (!isMoney(value)) {
      return bad(
        `${name} must be an integer milliBB within +/-${Money.MAX_MILLI_BB}, got ${value}`,
      );
    }
  }

  if (config.blinds.smallBlind <= 0) return bad('blinds.smallBlind must be positive');
  if (config.blinds.bigBlind <= 0) return bad('blinds.bigBlind must be positive');
  if (config.blinds.smallBlind > config.blinds.bigBlind) {
    return bad('blinds.smallBlind must not exceed blinds.bigBlind');
  }
  if (config.minBet <= 0) return bad('minBet must be positive');
  if (config.ante.amount < 0) return bad('ante.amount must not be negative');
  if (config.ante.enabled && config.ante.amount === 0) {
    return bad('ante.enabled is true but ante.amount is zero');
  }
  if (!ANTE_MODES.includes(config.ante.mode)) {
    return bad(`ante.mode "${config.ante.mode}" is not implemented in this version`);
  }
  if (!Number.isInteger(config.rake.numerator) || !Number.isInteger(config.rake.denominator)) {
    return bad('rake.numerator and rake.denominator must be integers');
  }
  if (config.rake.denominator <= 0) return bad('rake.denominator must be positive');
  if (config.rake.numerator < 0 || config.rake.numerator > config.rake.denominator) {
    return bad('rake.numerator must be within 0..rake.denominator');
  }
  if (config.rake.cap < 0) return bad('rake.cap must not be negative');
  if (config.rake.quantum <= 0) {
    return bad(`rake.quantum must be a positive integer milliBB, got ${config.rake.quantum}`);
  }
  if (config.rake.cap % config.rake.quantum !== 0) {
    return bad(
      `rake.cap ${config.rake.cap} must be an exact multiple of rake.quantum ${config.rake.quantum}, otherwise a capped rake is not quantized`,
    );
  }
  if (!RAKE_TRIGGER_POLICIES.includes(config.rake.triggerPolicy)) {
    return bad(
      `rake.triggerPolicy "${config.rake.triggerPolicy}" is not implemented in this version`,
    );
  }
  if (!RAKE_ALLOCATIONS.includes(config.rake.allocation)) {
    return bad(`rake.allocation "${config.rake.allocation}" is not implemented in this version`);
  }
  if (config.fee.cap < 0) return bad('fee.cap must not be negative');
  if (!FEE_TRIGGER_POLICIES.includes(config.fee.triggerPolicy)) {
    return bad(
      `fee.triggerPolicy "${config.fee.triggerPolicy}" is not implemented in this version`,
    );
  }
  if (!RAKE_ALLOCATIONS.includes(config.fee.allocation)) {
    return bad(`fee.allocation "${config.fee.allocation}" is not implemented in this version`);
  }
  if (config.referenceStack <= 0) return bad('referenceStack must be positive');
  if (!Number.isFinite(config.display.bigBlindValue) || config.display.bigBlindValue <= 0) {
    return bad('display.bigBlindValue must be a positive number');
  }
  return ok(config);
}

/** Total. Same preset with the ante switched on or off. */
export function withAnteEnabled(config: TableConfig, enabled: boolean): TableConfig {
  return { ...config, ante: { ...config.ante, enabled } };
}

/**
 * Total. Re-stake a preset: `docs/GTO_BASELINE.md` requires NL100 to be reachable by
 * changing only configuration, never the blind structure.
 *
 * `rakeQuantum` is part of the patch because a different stake has a different
 * settlement granularity: at BB = 0.50 one cent is 20 milliBB, at BB = 1.00 it is 10.
 * It is stated here rather than derived from `bigBlindValue` — `DisplayConfig` is
 * presentation and must never determine money (ADR-0027).
 */
export function withStakeDisplay(
  config: TableConfig,
  patch: {
    readonly presetId: string;
    readonly label: string;
    readonly rakeCap: MilliBB;
    readonly rakeQuantum: MilliBB;
    readonly bigBlindValue: number;
  },
): TableConfig {
  return {
    ...config,
    presetId: patch.presetId,
    label: patch.label,
    rake: { ...config.rake, cap: patch.rakeCap, quantum: patch.rakeQuantum },
    display: { ...config.display, bigBlindValue: patch.bigBlindValue },
  };
}
