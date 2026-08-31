/**
 * `StrategyQuery` — the NEUTRAL description of "hero is on the clock here", and the only
 * input every reference policy in this package is allowed to see.
 *
 * Neutral means: nothing in this file imports `@gto-self/poker-core`. The string unions
 * below LOOK like poker-core's (`Street`, `Position`, ...) and are deliberately declared
 * independently — a re-export would make every consumer of this package a consumer of the
 * poker engine's type graph and would quietly reverse the seam. `src/adapter/` maps one to
 * the other with exhaustive switches, so a change on either side fails to compile there
 * rather than drifting silently.
 *
 * `docs/GTO_DESIGN_NOTES.md` note F names exactly one seam where poker state becomes a
 * strategy query. That seam is `src/adapter/fromHandState.ts`, and this is its output type.
 *
 * Every money field is integer milliBB (CLAUDE.md rule 1) and carries the `Mbb` suffix.
 * Ratios (SPR, pot odds) are plain numbers, as rule 1 permits for non-money ratios.
 */
import type { Card, MilliBB } from '@gto-self/shared';
import type { StackBucketClassification } from './stackBucket.js';

export type StrategyStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

export const STRATEGY_STREETS: readonly StrategyStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

export type StrategyPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const STRATEGY_POSITIONS: readonly StrategyPosition[] = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
];

/** The six voluntary actions. Blind and ante posts are NOT actions and never appear here. */
export type StrategyActionKind = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export type StrategySeatStatus = 'IN_HAND' | 'FOLDED' | 'ALL_IN';

export type StrategyBlindRole = 'SB' | 'BB';

/**
 * One voluntary action, mirroring poker-core's `ActionRecord` without its types.
 *
 * `isAggressive` is DERIVED at the seam, not stored: an `ALL_IN` is aggressive exactly when
 * its `toAmountMbb` exceeds the current bet it faced, which is the same test poker-core
 * uses to decide whether a shove functions as a raise. Storing the derivation keeps every
 * consumer from re-deriving it differently.
 */
export interface StrategyActionRecord {
  /** poker-core's event sequence number. Strictly increasing across the hand. */
  readonly seq: number;
  readonly street: StrategyStreet;
  readonly position: StrategyPosition;
  readonly kind: StrategyActionKind;
  /** Raise-TO semantics: street contribution AFTER the action. `null` for fold/check. */
  readonly toAmountMbb: MilliBB | null;
  /** Chips this action actually put in. */
  readonly amountMbb: MilliBB;
  readonly potBeforeMbb: MilliBB;
  readonly potAfterMbb: MilliBB;
  readonly currentBetBeforeMbb: MilliBB;
  readonly effectiveStackBeforeMbb: MilliBB;
  readonly isAllIn: boolean;
  readonly isFullRaise: boolean;
  /** BET / RAISE, or an ALL_IN that raised the price. */
  readonly isAggressive: boolean;
}

export interface StrategyCallOption {
  readonly toAmountMbb: MilliBB;
  readonly amountMbb: MilliBB;
  readonly isAllIn: boolean;
}

export interface StrategyWagerOption {
  readonly kind: 'BET' | 'RAISE';
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
  readonly minAdditionalMbb: MilliBB;
  readonly maxAdditionalMbb: MilliBB;
  /** The only legal aggression is a short all-in. */
  readonly onlyAllIn: boolean;
}

export interface StrategyAllInOption {
  readonly toAmountMbb: MilliBB;
  readonly amountMbb: MilliBB;
  readonly effect: 'CALL' | 'BET' | 'RAISE';
}

/** A neutral mirror of poker-core's `LegalActions`. Raise-TO semantics throughout. */
export interface StrategyLegalActions {
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly call: StrategyCallOption | null;
  readonly wager: StrategyWagerOption | null;
  readonly allIn: StrategyAllInOption | null;
  /** Why `wager` is null, verbatim from the engine, so the UI can say so honestly. */
  readonly wagerBlockedReason: string | null;
}

/** One dealt-in seat's ACTUAL profile. Actual values only — bucketing happens elsewhere. */
export interface StrategySeatProfile {
  readonly position: StrategyPosition;
  /** poker-core's physical seat index 0..5. Carried so the caller can map back. */
  readonly seatIndex: number;
  readonly isHero: boolean;
  readonly status: StrategySeatStatus;
  /** ACTUAL stack when the hand was dealt. */
  readonly startingStackMbb: MilliBB;
  readonly remainingStackMbb: MilliBB;
  readonly totalContributionMbb: MilliBB;
  readonly streetContributionMbb: MilliBB;
  /** Antes and dead blinds. Dead money: never counts toward a call. */
  readonly deadContributionMbb: MilliBB;
  /** 0 = first to act preflop. */
  readonly preflopOrder: number;
  /** 0 = first to act on every postflop street. */
  readonly postflopOrder: number;
  readonly isButton: boolean;
  readonly blindRole: StrategyBlindRole | null;
}

export interface StrategyRakeEnvironment {
  readonly numerator: number;
  readonly denominator: number;
  readonly capMbb: MilliBB;
  readonly quantumMbb: MilliBB;
  readonly triggerPolicy: string;
  readonly allocation: string;
}

/**
 * The money environment the decision happens in. Rake and fees are POLICY, not site
 * knowledge (CLAUDE.md rule 10): this is a descriptor copied from the table config, and no
 * CoinPoker constant is baked in anywhere in this package.
 */
export interface StrategyEnvironment {
  readonly smallBlindMbb: MilliBB;
  readonly bigBlindMbb: MilliBB;
  readonly minBetMbb: MilliBB;
  readonly anteEnabled: boolean;
  readonly anteAmountMbb: MilliBB;
  /** Total antes and dead blinds in the pot. */
  readonly deadMoneyMbb: MilliBB;
  readonly rake: StrategyRakeEnvironment;
  readonly feeTriggerPolicy: string;
  readonly feeCapMbb: MilliBB;
}

export interface StrategyAggression {
  readonly street: StrategyStreet;
  readonly position: StrategyPosition;
  readonly seq: number;
  readonly toAmountMbb: MilliBB | null;
  readonly isAllIn: boolean;
}

/**
 * Everything a reference policy is allowed to know. Built ONLY by
 * `src/adapter/fromHandState.ts`.
 */
export interface StrategyQuery {
  readonly street: StrategyStreet;
  readonly board: readonly Card[];
  /** How many players were dealt into the hand: 2..6. */
  readonly dealtInCount: number;
  /** Positions dealt in, ordered by `preflopOrder`. */
  readonly positionsInHand: readonly StrategyPosition[];

  readonly heroPosition: StrategyPosition;
  readonly heroSeatIndex: number;
  /** Empty when the user has not entered hero's holding yet; otherwise exactly two cards. */
  readonly heroCards: readonly Card[];

  /** One entry per dealt-in seat, ordered by `preflopOrder`. Hero included. */
  readonly seats: readonly StrategySeatProfile[];

  /**
   * `min(hero, deepest live opponent)` on the STARTING basis — poker-core's documented
   * multiway convention. The ACTUAL number; `stackBucket` is the normalized lookup key and
   * both are carried (CLAUDE.md rule 3).
   */
  readonly effectiveStackMbb: MilliBB;
  /** REMAINING basis, for SPR-shaped questions about what is still behind. */
  readonly effectiveStackRemainingMbb: MilliBB;
  readonly stackBucket: StackBucketClassification;

  /** Pot before hero's decision, INCLUDING live street contributions. */
  readonly potBeforeDecisionMbb: MilliBB;
  /** Every chip committed to the hand so far. */
  readonly potTotalMbb: MilliBB;
  readonly currentBetMbb: MilliBB;
  /** What hero must add to continue. ZERO when hero can check. */
  readonly callAmountMbb: MilliBB;
  /** Hero's street contribution after calling. */
  readonly callToAmountMbb: MilliBB;

  /** `remainingEffective / potTotal`, or null on a zero pot. A ratio, never money. */
  readonly spr: number | null;
  /** `call / (potBeforeDecision + call)`, or null on a zero denominator. */
  readonly potOdds: number | null;

  readonly legalActions: StrategyLegalActions;

  /** Every voluntary action so far, in engine order, across all streets. */
  readonly actions: readonly StrategyActionRecord[];
  /** Aggressive actions only, in engine order. */
  readonly aggressionHistory: readonly StrategyAggression[];
  /** The last aggressor on each street, or null where nobody has raised or bet. */
  readonly lastAggressorByStreet: Readonly<Record<StrategyStreet, StrategyPosition | null>>;

  /** Contenders other than hero who are not folded. */
  readonly activeOpponentCount: number;
  /**
   * Hero acts LAST postflop among the still-active opponents (`postflopOrder` strictly
   * greater than every active opponent's). Computed from postflop order even preflop,
   * because "in position" is a statement about the streets to come.
   */
  readonly heroInPosition: boolean;

  readonly environment: StrategyEnvironment;
}
