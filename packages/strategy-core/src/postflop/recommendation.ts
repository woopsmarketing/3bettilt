/**
 * The shape of a POSTFLOP reference answer.
 *
 * USER-FACING NAME: 기본전략 · REFERENCE. Never GTO — not in a type name, an id, a note or a
 * rendered string (CLAUDE.md rule 2). `policy.test.ts` serializes a whole recommendation and
 * greps it, exactly as A3's suite does for preflop.
 *
 * The shape MIRRORS `preflop/recommendation.ts`'s `StrategyRecommendation` field for field —
 * `kind` / `label` / `street` / `family` / `heroPosition` / `handClass` / `actions` /
 * `primaryAction` / `metrics` / `provenance` / `explanation` — and reuses that module's
 * `RecommendedAction`, `RecommendedSizing`, `RecommendationProvenance`, `ExplanationFeature`
 * and `EnvironmentCompatibility` types, parameterized by `PostflopRuleId`. There is exactly
 * one frequency-quantization rule, one primary-action tie-break and one clamp policy in this
 * package, and they live in the preflop module because that is where they were first written.
 *
 * Two fields exist here that preflop has no use for:
 *  - `scoring`, the complete derivation (every component, its measurement, its points and its
 *    weight; the bands; the caps). A postflop answer is a model output rather than a table
 *    lookup, so the model's working is part of the answer.
 *  - `confidence`, because postflop provenance is always HEURISTIC (every rule in the postflop registry is authored, none is anchor-backed) and therefore
 *    cannot carry gradation (see `rules.ts`).
 */
import type { MilliBB } from '@gto-self/shared';
import type { Bps } from '../bps.js';
import type {
  EnvironmentCompatibility,
  ExplanationFeature,
  RecommendationProvenance,
  RecommendedAction,
  RecommendedSizing,
} from '../preflop/recommendation.js';
import type { HandClass } from '../range/handClass.js';
import type { StackBucketClassification } from '../stackBucket.js';
import type { EquityMethod } from '../equity/model.js';
import type { StrategyPosition } from '../types.js';
import type { PostflopRuleId } from './rules.js';
import type { PostflopSpotFamily } from './spot.js';
import type { ConfidenceLevel, PostflopPotType } from './scoreModel.js';
import type { PostflopScoring } from './score.js';

export type PostflopAction = RecommendedAction<PostflopRuleId>;
export type PostflopSizing = RecommendedSizing<PostflopRuleId>;
export type PostflopProvenance = RecommendationProvenance<PostflopRuleId>;

export interface PostflopMetrics {
  /** Passed through from the query, never recomputed. */
  readonly spr: number | null;
  /** `call / (pot + call)`. Null when hero is not facing a bet. */
  readonly potOdds: number | null;
  /** The same number read as "equity hero needs to break even on a call". */
  readonly requiredEquity: number | null;
  /** Hero's actual two cards against every live villain range. */
  readonly heroEquity: number;
  readonly heroEquityMethod: EquityMethod;
  /** Hero's whole range against the primary villain's range on this board. */
  readonly rangeEquity: number;
  readonly rangeEquityMethod: EquityMethod;
  /** `rangeEquity - 0.5`. */
  readonly rangeAdvantage: number;
  /** `nutShare(hero) - nutShare(primary villain)`; see `NUT_SHARE_PERCENTILE`. */
  readonly nutAdvantage: number;
  /** Weighted share of hero's own range hero's hand is at least as good as. 1.0 is the top. */
  readonly rangeRank: number;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  readonly effectiveStackMbb: MilliBB;
  readonly stackBucket: StackBucketClassification;
  readonly activeOpponentCount: number;
}

export type PostflopExplanationFeatureId =
  // the spot
  | 'SPOT_FAMILY'
  | 'STREET'
  | 'POT_TYPE'
  | 'HERO_POSITION'
  | 'RELATIVE_POSITION'
  | 'ACTIVE_OPPONENTS'
  | 'LINEUP_SIZE'
  | 'PREVIOUS_STREET_AGGRESSOR'
  | 'CURRENT_STREET_AGGRESSOR'
  | 'CHECKS_TO_HERO'
  | 'FACING_ALL_IN'
  /** `COLLAPSED` / `LIVE` — whether the shove left hero anything to raise into. */
  | 'ALL_IN_TREE'
  // the hand and the board
  | 'HAND_CLASS'
  | 'MADE_HAND_CLASS'
  | 'HERO_IS_NUTS'
  | 'DRAW'
  | 'BLOCKER'
  | 'BOARD_TENDENCY'
  | 'BOARD_PAIRING'
  | 'BOARD_CONNECTIVITY'
  | 'FLOP_SUIT_PATTERN'
  // the measurements
  | 'HERO_EQUITY'
  /** `1 / (1 + activeOpponentCount)` — hero's break-even share of the pot. */
  | 'HERO_EQUITY_FAIR_SHARE'
  /** `HERO_EQUITY` rescaled onto the 0.5-centred scale `HERO_EQUITY_BANDS` is authored on. */
  | 'HERO_EQUITY_NORMALIZED'
  | 'RANGE_EQUITY'
  | 'RANGE_ADVANTAGE'
  | 'NUT_SHARE_HERO'
  | 'NUT_SHARE_VILLAIN'
  | 'NUT_ADVANTAGE'
  | 'RANGE_RANK'
  /**
   * Reported ONLY when hero's combo carries no weight in hero's own propagated range, so
   * `RANGE_RANK` ranks an exact pairwise probe rather than an entry of the distribution
   * itself. Absent means the ordinary basis. Never a different KIND of equity either way.
   */
  | 'RANGE_RANK_BASIS'
  | 'EQUITY_METHOD'
  | 'SPR'
  | 'POT_ODDS'
  | 'POT_ODDS_MARGIN'
  | 'BET_FRACTION_FACED'
  // the model's working
  | 'SCORE_COMPONENT'
  | 'AGGRESSION_SCORE'
  | 'AGGRESSION_BAND'
  | 'CONTINUE_SCORE'
  | 'CONTINUE_BAND'
  | 'RAISE_SHARE_BAND'
  | 'ALL_IN_BAND'
  | 'MULTIWAY_SCALE'
  | 'MULTIWAY_CONTINUE_PENALTY'
  // sizing
  | 'SIZING_BUCKET'
  | 'SIZING_MODIFIER'
  | 'SIZING_RULE'
  | 'SIZING_CLAMPED'
  | 'ALL_IN_GATE'
  // honesty
  | 'VILLAIN_RANGE_NARROWING'
  | 'VILLAIN_RANGE_OFF_POLICY'
  | 'STACK_BUCKET'
  | 'UNMODELLED_STACK_DEPTH'
  | 'CONFIDENCE';

export type PostflopExplanationFeature = ExplanationFeature<PostflopExplanationFeatureId>;

export interface PostflopExplanation {
  readonly features: readonly PostflopExplanationFeature[];
}

/**
 * A postflop reference recommendation. `label` is the user-facing badge and is a constant:
 * this engine has exactly one label and it is not GTO.
 */
export interface PostflopRecommendation {
  readonly kind: 'PostflopRecommendation';
  readonly label: 'REFERENCE';
  readonly street: 'FLOP' | 'TURN' | 'RIVER';
  readonly family: PostflopSpotFamily;
  readonly potType: PostflopPotType;
  readonly heroPosition: StrategyPosition;
  /** Hero's preflop hand class, carried so the UI can key a chart off it as preflop does. */
  readonly handClass: HandClass;
  readonly actions: readonly PostflopAction[];
  readonly primaryAction: PostflopAction;
  readonly metrics: PostflopMetrics;
  readonly provenance: PostflopProvenance;
  readonly explanation: PostflopExplanation;
  /** The complete derivation: every component, band, cap and sizing modifier. */
  readonly scoring: PostflopScoring;
  readonly confidence: ConfidenceLevel;
  /**
   * Always `false`, and always shown. Postflop actions taken before hero's decision were NOT
   * used to narrow any range — see `ranges.ts` for why, and never present a range-level number
   * from this engine as if villain's flop check had been read.
   */
  readonly villainRangeNarrowingApplied: false;
}

/** Re-exported so a consumer can build a badge without importing the whole policy module. */
export const POSTFLOP_REFERENCE_LABEL = 'REFERENCE' as const;

/** The environment compatibility shape is shared with preflop, unchanged. */
export type PostflopEnvironmentCompatibility = EnvironmentCompatibility;

/** Convenience: the frequency type every emitted action carries. */
export type PostflopFrequencyBps = Bps;
