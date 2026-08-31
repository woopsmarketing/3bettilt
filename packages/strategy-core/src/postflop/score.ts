/**
 * The SCORING ENGINE: measurements in, two scores and a frequency mix out.
 *
 * This file holds control flow and arithmetic and NO constants. Every number it uses comes
 * from `scoreModel.ts`, which is why "the model" can be reviewed without reading this file.
 *
 * The pipeline:
 *
 *   components -> aggression score  --band-->  aggression bps  --multiway scale--> final
 *   components -> continue  score   --band-->  continue   bps  --multiway penalty--> final
 *                 aggression score  --band-->  raise share of the continue mass
 *
 * Every component is reported with its measured value, its points and its weight, so a
 * recommendation can show its whole derivation without anything being recomputed.
 */
import { invariant } from '@gto-self/shared';
import { BPS_TOTAL } from '../bps.js';
import { FREQUENCY_STEP_BPS } from '../preflop/recommendation.js';
import type { MadeHandClass } from '../analysis/heroHand.js';
import type { PostflopContext } from './context.js';
import {
  AGGRESSION_BANDS,
  AGGRESSION_TOTAL_WEIGHT,
  AGGRESSION_WEIGHTS,
  ALL_IN_CALL_BANDS,
  BLOCKER_CAP,
  BLOCKER_POINTS,
  BOARD_TEXTURE_POINTS,
  CONTINUE_BANDS,
  CONTINUE_TOTAL_WEIGHT,
  CONTINUE_WEIGHTS,
  DRAW_QUALITY,
  FACED_BET_SIZE_BANDS,
  HAND_STRENGTH_ADJUSTMENTS,
  HAND_STRENGTH_POINTS,
  HERO_EQUITY_BANDS,
  INITIATIVE_POINTS,
  MULTIWAY_AGGRESSION_SCALE_BPS,
  MULTIWAY_AGGRESSION_POINTS,
  MULTIWAY_CONTINUE_PENALTY_BPS,
  MULTIWAY_CONTINUE_POINTS,
  NUT_ADVANTAGE_BANDS,
  POSITION_POINTS,
  POT_ODDS_MARGIN_BANDS,
  POT_TYPE_POINTS,
  RAISE_SHARE_BANDS,
  RANGE_ADVANTAGE_BANDS,
  RANGE_RANK_BANDS,
  SPR_PRESSURE_BANDS,
  STREET_ACTION_POINTS,
  STREET_CHECK_THRESHOLDS,
  UNKNOWN_SPR,
  bandFor,
  normalizeHeroEquity,
  priceImpliedContinueBps,
  type AggressionBand,
  type AggressionComponentId,
  type ContinueBand,
  type ContinueComponentId,
  type RaiseShareBand,
  type ScoreComponentId,
} from './scoreModel.js';

export interface ScoreComponent {
  readonly id: ScoreComponentId;
  readonly weight: number;
  /** The measured value that fed the lookup, in the unit the component's table documents. */
  readonly rawValue: number;
  /** -100..100. */
  readonly points: number;
  readonly weightedPoints: number;
  /** A stable token for the branch or band taken, never a sentence. */
  readonly label: string;
}

export interface ModelScore {
  /** The weighted mean of the components' points, rounded to an integer. -100..100. */
  readonly score: number;
  readonly totalWeight: number;
  readonly components: readonly ScoreComponent[];
}

/** Raw bucket frequencies, all multiples of 500 summing to exactly 10000. */
export interface PostflopMix {
  readonly foldBps: number;
  /** CHECK when hero is not facing a bet; CALL when hero is. */
  readonly passiveBps: number;
  /** BET when hero is not facing a bet; RAISE when hero is. */
  readonly aggressiveBps: number;
}

export interface PostflopScoring {
  readonly aggression: ModelScore;
  readonly aggressionBand: AggressionBand;
  /** Null when hero is not facing a bet: there is nothing to fold to. */
  readonly continueModel: ModelScore | null;
  readonly continueBand: ContinueBand | null;
  readonly raiseShareBand: RaiseShareBand | null;
  /** After the multiway scale. */
  readonly aggressionBps: number;
  readonly multiwayScaleBps: number;
  readonly multiwayScaleApplied: boolean;
  /** After the multiway penalty. Null when hero is not facing a bet. */
  readonly continueBps: number | null;
  readonly multiwayContinuePenaltyBps: number;
  /** Set when the all-in branch replaced the ordinary model. */
  readonly allInBandLabel: string | null;
  readonly mix: PostflopMix;
}

const AGGRESSION_WEIGHT_OF = new Map<AggressionComponentId, number>(
  AGGRESSION_WEIGHTS.map((entry) => [entry.id, entry.weight]),
);
const CONTINUE_WEIGHT_OF = new Map<ContinueComponentId, number>(
  CONTINUE_WEIGHTS.map((entry) => [entry.id, entry.weight]),
);

const clampPoints = (value: number): number => Math.max(-100, Math.min(100, Math.round(value)));

function component(
  id: ScoreComponentId,
  weight: number,
  rawValue: number,
  points: number,
  label: string,
): ScoreComponent {
  const clamped = clampPoints(points);
  return { id, weight, rawValue, points: clamped, weightedPoints: weight * clamped, label };
}

function scoreOf(components: readonly ScoreComponent[], totalWeight: number): ModelScore {
  invariant(totalWeight > 0, 'a score model needs positive total weight');
  const sum = components.reduce((acc, entry) => acc + entry.weightedPoints, 0);
  return { score: Math.round(sum / totalWeight), totalWeight, components };
}

const weightOfAggression = (id: AggressionComponentId): number => {
  const weight = AGGRESSION_WEIGHT_OF.get(id);
  invariant(weight !== undefined, `no aggression weight registered for ${id}`);
  return weight;
};
const weightOfContinue = (id: ContinueComponentId): number => {
  const weight = CONTINUE_WEIGHT_OF.get(id);
  invariant(weight !== undefined, `no continue weight registered for ${id}`);
  return weight;
};

// ---------------------------------------------------------------------------
// Shared measurements (used by both models, with the model's own weight)
// ---------------------------------------------------------------------------

const PAIR_CLASSES: ReadonlySet<MadeHandClass> = new Set<MadeHandClass>([
  'OVERPAIR',
  'TOP_PAIR',
  'MIDDLE_PAIR',
  'BOTTOM_PAIR',
  'UNDERPAIR',
]);

/** The made-hand points and the label, shared by both models. */
export function handStrengthPoints(context: PostflopContext): {
  readonly points: number;
  readonly base: number;
  readonly label: string;
} {
  const hero = context.heroHand;
  const base = HAND_STRENGTH_POINTS[hero.madeClass];
  let points = base;
  if (hero.isNuts) points += HAND_STRENGTH_ADJUSTMENTS.NUTS_BONUS;
  if (
    PAIR_CLASSES.has(hero.madeClass) &&
    hero.kicker !== null &&
    hero.kicker.kickerClass === 'WEAK'
  ) {
    points += HAND_STRENGTH_ADJUSTMENTS.WEAK_KICKER_PENALTY;
  }
  if (hero.playsTheBoard) points += HAND_STRENGTH_ADJUSTMENTS.PLAYS_THE_BOARD_PENALTY;
  return { points, base, label: hero.madeClass };
}

/** Additive draw points, capped. Shared by both models. */
export function drawQualityPoints(context: PostflopContext): {
  readonly points: number;
  readonly uncapped: number;
  readonly label: string;
} {
  const draws = context.heroHand.draws;
  let total = 0;
  const sources: string[] = [];
  if (draws.flushDraw !== null) {
    total += DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS[draws.flushDraw.nutClass];
    sources.push('FLUSH_DRAW');
  }
  if (draws.straightDraw !== null) {
    total += DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND[draws.straightDraw.kind];
    sources.push('STRAIGHT_DRAW');
  }
  if (draws.backdoorFlushDraw !== null) {
    total += DRAW_QUALITY.BACKDOOR_FLUSH_DRAW;
    sources.push('BACKDOOR_FLUSH');
  }
  if (draws.backdoorStraightDraw) {
    total += DRAW_QUALITY.BACKDOOR_STRAIGHT_DRAW;
    sources.push('BACKDOOR_STRAIGHT');
  }
  // Overcards count only for a hand with nothing made — otherwise the made hand already
  // carries the value and this would double-count it.
  const made = context.heroHand.madeClass;
  if (made === 'NO_MADE_HAND' || made === 'ACE_HIGH' || made === 'BOARD_PAIR') {
    const overcards = context.heroHand.overcardCount * DRAW_QUALITY.OVERCARD_EACH;
    if (overcards > 0) {
      total += overcards;
      sources.push('OVERCARDS');
    }
  }
  return {
    points: Math.min(total, DRAW_QUALITY.CAP),
    uncapped: total,
    label: sources.length === 0 ? 'NONE' : sources.join('+'),
  };
}

/** Blocker points, capped. Shared by both models. */
export function blockerPoints(context: PostflopContext): {
  readonly points: number;
  readonly uncapped: number;
  readonly label: string;
} {
  let total = 0;
  for (const blocker of context.heroHand.blockers) total += BLOCKER_POINTS[blocker];
  return {
    points: Math.min(total, BLOCKER_CAP),
    uncapped: total,
    label: `BLOCKERS_${context.heroHand.blockers.length}`,
  };
}

// ---------------------------------------------------------------------------
// The aggression model
// ---------------------------------------------------------------------------

/** Total. Every aggression component, in `AGGRESSION_WEIGHTS` declaration order. */
export function aggressionComponents(context: PostflopContext): readonly ScoreComponent[] {
  const spot = context.spot;
  const hand = handStrengthPoints(context);
  const draws = drawQualityPoints(context);
  const blockers = blockerPoints(context);

  // Rule `HERO_EQUITY_FAIR_SHARE_NORMALIZATION`. The band table is 0.5-centred, so it is fed
  // equity relative to hero's fair share of the pot, never the raw pooled multiway number.
  // Heads-up the mapping is the identity, so nothing about a heads-up answer moves.
  const equityBand = bandFor(
    HERO_EQUITY_BANDS,
    normalizeHeroEquity(context.heroEquity, spot.activeOpponentCount),
  );
  const rangeBand = bandFor(RANGE_ADVANTAGE_BANDS, context.rangeAdvantage);
  const nutBand = bandFor(NUT_ADVANTAGE_BANDS, context.nut.nutAdvantage);
  const rankBand = bandFor(RANGE_RANK_BANDS, context.rangeRank);
  const sprBand = bandFor(SPR_PRESSURE_BANDS, context.spr ?? UNKNOWN_SPR);

  const inPosition = spot.heroRelativePosition === 'IP';

  // Initiative: a previous-street term plus a current-street term.
  const previousPoints = spot.heroHadInitiative
    ? INITIATIVE_POINTS.HERO_HAD_INITIATIVE
    : spot.previousStreetAggressor === null
      ? INITIATIVE_POINTS.NOBODY_HAD_INITIATIVE
      : INITIATIVE_POINTS.OPPONENT_HAD_INITIATIVE;
  const currentPoints = spot.heroIsCurrentStreetAggressor
    ? INITIATIVE_POINTS.HERO_AGGRESSION_RAISED
    : spot.currentStreetAggressor === null
      ? 0
      : INITIATIVE_POINTS.OPPONENT_AGGRESSED_THIS_STREET;
  const initiativeLabel = `${spot.heroHadInitiative ? 'HERO_PREV' : spot.previousStreetAggressor === null ? 'NONE_PREV' : 'OPP_PREV'}/${
    spot.currentStreetAggressor === null
      ? 'NONE_NOW'
      : spot.heroIsCurrentStreetAggressor
        ? 'HERO_NOW'
        : 'OPP_NOW'
  }`;

  // Board texture, read as protection value rather than raw texture.
  const tendency = context.board.tendency.value;
  const hasProtectableEquity =
    HAND_STRENGTH_POINTS[context.heroHand.madeClass] >= HAND_STRENGTH_POINTS.TOP_PAIR ||
    draws.points >= BOARD_TEXTURE_POINTS.DYNAMIC_DRAW_THRESHOLD;
  const texturePoints =
    tendency === 'STATIC'
      ? context.rangeAdvantage >= BOARD_TEXTURE_POINTS.STATIC_RANGE_EDGE_THRESHOLD
        ? BOARD_TEXTURE_POINTS.STATIC_WITH_RANGE_EDGE
        : BOARD_TEXTURE_POINTS.STATIC_WITHOUT_RANGE_EDGE
      : tendency === 'DYNAMIC'
        ? hasProtectableEquity
          ? BOARD_TEXTURE_POINTS.DYNAMIC_WITH_EQUITY
          : BOARD_TEXTURE_POINTS.DYNAMIC_WITHOUT_EQUITY
        : BOARD_TEXTURE_POINTS.SEMI_DYNAMIC;
  const textureLabel =
    tendency === 'SEMI_DYNAMIC'
      ? 'SEMI_DYNAMIC'
      : tendency === 'STATIC'
        ? context.rangeAdvantage >= BOARD_TEXTURE_POINTS.STATIC_RANGE_EDGE_THRESHOLD
          ? 'STATIC_WITH_RANGE_EDGE'
          : 'STATIC_WITHOUT_RANGE_EDGE'
        : hasProtectableEquity
          ? 'DYNAMIC_WITH_EQUITY'
          : 'DYNAMIC_WITHOUT_EQUITY';

  const opponents = Math.min(spot.activeOpponentCount, MULTIWAY_AGGRESSION_POINTS.length - 1);
  const multiwayPoints = MULTIWAY_AGGRESSION_POINTS[opponents] ?? 0;

  const facedFraction = spot.facedBetFractionOfPot;
  const facedBand = facedFraction === null ? null : bandFor(FACED_BET_SIZE_BANDS, facedFraction);

  const checks = spot.facingBet ? 0 : spot.checksBeforeHero;
  const streetActionPoints = spot.facingBet
    ? 0
    : checks >= STREET_CHECK_THRESHOLDS.TWO_OR_MORE
      ? STREET_ACTION_POINTS.TWO_OR_MORE_CHECKS
      : checks === STREET_CHECK_THRESHOLDS.ONE
        ? STREET_ACTION_POINTS.ONE_CHECK
        : STREET_ACTION_POINTS.NO_CHECKS;

  return [
    component(
      'HAND_STRENGTH',
      weightOfAggression('HAND_STRENGTH'),
      hand.base,
      hand.points,
      hand.label,
    ),
    component(
      'HERO_EQUITY',
      weightOfAggression('HERO_EQUITY'),
      context.heroEquity,
      equityBand.points,
      equityBand.label,
    ),
    component(
      'RANGE_ADVANTAGE',
      weightOfAggression('RANGE_ADVANTAGE'),
      context.rangeAdvantage,
      rangeBand.points,
      rangeBand.label,
    ),
    component(
      'NUT_ADVANTAGE',
      weightOfAggression('NUT_ADVANTAGE'),
      context.nut.nutAdvantage,
      nutBand.points,
      nutBand.label,
    ),
    component(
      'RANGE_RANK',
      weightOfAggression('RANGE_RANK'),
      context.rangeRank,
      rankBand.points,
      rankBand.label,
    ),
    component(
      'DRAW_QUALITY',
      weightOfAggression('DRAW_QUALITY'),
      draws.uncapped,
      draws.points,
      draws.label,
    ),
    component(
      'BLOCKER_QUALITY',
      weightOfAggression('BLOCKER_QUALITY'),
      blockers.uncapped,
      blockers.points,
      blockers.label,
    ),
    component(
      'POSITION',
      weightOfAggression('POSITION'),
      inPosition ? 1 : 0,
      inPosition
        ? POSITION_POINTS.AGGRESSION_IN_POSITION
        : POSITION_POINTS.AGGRESSION_OUT_OF_POSITION,
      spot.heroRelativePosition,
    ),
    component(
      'INITIATIVE',
      weightOfAggression('INITIATIVE'),
      previousPoints + currentPoints,
      previousPoints + currentPoints,
      initiativeLabel,
    ),
    component(
      'BOARD_TEXTURE',
      weightOfAggression('BOARD_TEXTURE'),
      context.board.tendencyScore,
      texturePoints,
      textureLabel,
    ),
    component(
      'SPR_PRESSURE',
      weightOfAggression('SPR_PRESSURE'),
      context.spr ?? UNKNOWN_SPR,
      sprBand.points,
      sprBand.label,
    ),
    component(
      'MULTIWAY',
      weightOfAggression('MULTIWAY'),
      spot.activeOpponentCount,
      multiwayPoints,
      `OPPONENTS_${spot.activeOpponentCount}`,
    ),
    component(
      'FACED_BET_SIZE',
      weightOfAggression('FACED_BET_SIZE'),
      facedFraction ?? 0,
      facedBand?.points ?? 0,
      facedBand?.label ?? 'NOT_FACING_A_BET',
    ),
    component(
      'POT_TYPE',
      weightOfAggression('POT_TYPE'),
      POT_TYPE_POINTS[spot.potType],
      POT_TYPE_POINTS[spot.potType],
      spot.potType,
    ),
    component(
      'STREET_ACTION',
      weightOfAggression('STREET_ACTION'),
      checks,
      streetActionPoints,
      `CHECKS_TO_HERO_${checks}`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// The continue model
// ---------------------------------------------------------------------------

/**
 * Total. Every continue component, in `CONTINUE_WEIGHTS` declaration order. Only meaningful
 * when hero faces a bet; `potOddsMargin` is null otherwise and the caller does not call this.
 */
export function continueComponents(context: PostflopContext): readonly ScoreComponent[] {
  const spot = context.spot;
  const hand = handStrengthPoints(context);
  const draws = drawQualityPoints(context);
  const blockers = blockerPoints(context);
  const margin = context.potOddsMargin ?? 0;
  const marginBand = bandFor(POT_ODDS_MARGIN_BANDS, margin);
  const rankBand = bandFor(RANGE_RANK_BANDS, context.rangeRank);
  const inPosition = spot.heroRelativePosition === 'IP';
  const opponents = Math.min(spot.activeOpponentCount, MULTIWAY_CONTINUE_POINTS.length - 1);
  const multiwayPoints = MULTIWAY_CONTINUE_POINTS[opponents] ?? 0;
  const facedFraction = spot.facedBetFractionOfPot;
  const facedBand = facedFraction === null ? null : bandFor(FACED_BET_SIZE_BANDS, facedFraction);

  return [
    component(
      'POT_ODDS_MARGIN',
      weightOfContinue('POT_ODDS_MARGIN'),
      margin,
      marginBand.points,
      marginBand.label,
    ),
    component(
      'HAND_STRENGTH',
      weightOfContinue('HAND_STRENGTH'),
      hand.base,
      hand.points,
      hand.label,
    ),
    component(
      'DRAW_QUALITY',
      weightOfContinue('DRAW_QUALITY'),
      draws.uncapped,
      draws.points,
      draws.label,
    ),
    component(
      'BLOCKER_QUALITY',
      weightOfContinue('BLOCKER_QUALITY'),
      blockers.uncapped,
      blockers.points,
      blockers.label,
    ),
    component(
      'RANGE_RANK',
      weightOfContinue('RANGE_RANK'),
      context.rangeRank,
      rankBand.points,
      rankBand.label,
    ),
    component(
      'POSITION',
      weightOfContinue('POSITION'),
      inPosition ? 1 : 0,
      inPosition ? POSITION_POINTS.CONTINUE_IN_POSITION : POSITION_POINTS.CONTINUE_OUT_OF_POSITION,
      spot.heroRelativePosition,
    ),
    component(
      'MULTIWAY',
      weightOfContinue('MULTIWAY'),
      spot.activeOpponentCount,
      multiwayPoints,
      `OPPONENTS_${spot.activeOpponentCount}`,
    ),
    component(
      'FACED_BET_SIZE',
      weightOfContinue('FACED_BET_SIZE'),
      facedFraction ?? 0,
      facedBand?.points ?? 0,
      facedBand?.label ?? 'NOT_FACING_A_BET',
    ),
  ];
}

// ---------------------------------------------------------------------------
// Score -> mix
// ---------------------------------------------------------------------------

// The 5-point grid and 100%, imported rather than re-declared: they are owned by `bps.ts` and
// by `preflop/recommendation.ts` (ADR-0056), and this file used to hold a third private copy of
// both (R1B MINOR-8) — three places for one pair of numbers to drift.
const FREQUENCY_STEP = FREQUENCY_STEP_BPS;

/** Rounds onto the 5-point grid. Deterministic (Math.round, half away from zero on positives). */
function toGrid(value: number): number {
  return Math.round(value / FREQUENCY_STEP) * FREQUENCY_STEP;
}

/**
 * Rounds DOWN onto the 5-point grid. Used only for the multiway scale, where rounding back up
 * would sometimes undo the very reduction the scale exists to apply.
 */
function floorToGrid(value: number): number {
  return Math.floor(value / FREQUENCY_STEP) * FREQUENCY_STEP;
}

/** Total. Applies the multiway scale to a frequency and floors it onto the grid. */
export function applyMultiwayScale(bps: number, opponents: number): number {
  const scale = multiwayScaleBpsFor(opponents);
  if (scale >= BPS_TOTAL) return bps;
  return Math.max(0, floorToGrid((bps * scale) / BPS_TOTAL));
}

/** Total. The aggression band a score falls in. Exported so the table can be tested directly. */
export function aggressionBandFor(score: number): AggressionBand {
  for (const band of AGGRESSION_BANDS) if (score >= band.atLeast) return band;
  const last = AGGRESSION_BANDS[AGGRESSION_BANDS.length - 1];
  invariant(last !== undefined, 'the aggression band table is empty');
  return last;
}

/** Total. The continue band a score falls in. */
export function continueBandFor(score: number): ContinueBand {
  for (const band of CONTINUE_BANDS) if (score >= band.atLeast) return band;
  const last = CONTINUE_BANDS[CONTINUE_BANDS.length - 1];
  invariant(last !== undefined, 'the continue band table is empty');
  return last;
}

/** Total. The raise-share band an AGGRESSION score falls in. */
export function raiseShareBandFor(score: number): RaiseShareBand {
  for (const band of RAISE_SHARE_BANDS) if (score >= band.atLeast) return band;
  const last = RAISE_SHARE_BANDS[RAISE_SHARE_BANDS.length - 1];
  invariant(last !== undefined, 'the raise-share band table is empty');
  return last;
}

/** Total. The multiway aggression scale, in bps of the heads-up frequency. */
export function multiwayScaleBpsFor(opponents: number): number {
  const index = Math.max(0, Math.min(opponents, MULTIWAY_AGGRESSION_SCALE_BPS.length - 1));
  return MULTIWAY_AGGRESSION_SCALE_BPS[index] ?? BPS_TOTAL;
}

/** Total. The multiway continue penalty for a live-opponent count. */
export function multiwayContinuePenaltyBpsFor(opponents: number): number {
  const index = Math.max(0, Math.min(opponents, MULTIWAY_CONTINUE_PENALTY_BPS.length - 1));
  return MULTIWAY_CONTINUE_PENALTY_BPS[index] ?? 0;
}

/**
 * Total. Applies the multiway continue penalty to a continuing frequency, bounded by the price.
 *
 * The penalty is a REDUCTION with two bounds, and both are things the model can see:
 *
 *   - it never raises the frequency (the result is at most `continueBps`), and
 *   - where the band ALREADY continues at least as often as the price says
 *     (`priceImpliedContinueBps(potOddsMargin)`), the reduction stops at that price-implied
 *     frequency. Hero's equity is measured against every live range and the required equity
 *     counts every chip in the pot, so the margin is already a multiway-correct statement
 *     about the immediate price; a proxy for "there are more ranges to beat" must not argue
 *     a hand out of a call that price has settled.
 *
 * Where the band is BELOW the price line the model has non-price reasons to fold — reverse
 * implied odds, position, a dominated class — and the penalty applies in full, which is where
 * it does most of its work.
 *
 * The floor is the fix for a real defect: subtracted unconditionally, the penalty reached
 * `CONTINUE_BANDS.ALWAYS` ("never folds") and emitted FOLD 1000 for three-handed quads — a hand
 * with 100% equity — and did the same to `ALL_IN_CALL_BANDS.CLEAR_CALL`. It is not an arbitrary
 * clamp: it is read off the model's own price table via `priceImpliedContinueBps`.
 *
 * Heads-up the penalty is 0 and this function is the identity, so no heads-up answer moves.
 */
export function penalizedContinueBps(
  continueBps: number,
  opponents: number,
  potOddsMargin: number | null,
): number {
  const penalty = multiwayContinuePenaltyBpsFor(opponents);
  const priceBps = priceImpliedContinueBps(potOddsMargin);
  const floor = continueBps >= priceBps ? priceBps : 0;
  return Math.max(floor, continueBps - penalty);
}

/**
 * Total. Splits a fixed continuing mass into calling and raising with the RAISE_SHARE band the
 * aggression score selects, then applies the multiway aggression scale to the raising part.
 *
 * One implementation for both facing-a-bet paths — the ordinary one and a live all-in tree —
 * so "how much of the continue mass raises" is answered the same way wherever hero faces
 * chips. The raise share is rounded onto the 5-point grid HERE rather than left to the final
 * quantization, so the numbers this scoring object reports are the numbers emitted.
 */
function splitContinueMass(
  continueBps: number,
  aggressionScore: number,
  opponents: number,
): { readonly shareBand: RaiseShareBand; readonly raiseBps: number; readonly unscaled: number } {
  const shareBand = raiseShareBandFor(aggressionScore);
  const rawRaise = (continueBps * shareBand.raiseShareBps) / BPS_TOTAL;
  const unscaled = Math.max(0, Math.min(continueBps, toGrid(rawRaise)));
  return { shareBand, raiseBps: applyMultiwayScale(unscaled, opponents), unscaled };
}

/**
 * Total. The complete scoring pass.
 *
 * Three shapes, and the branch between them is structural rather than a judgement:
 *
 *  - FACING AN ALL-IN. The continue mass is `ALL_IN_CALL_BANDS` on the pot-odds margin rather
 *    than the continue score (rule FACING_ALL_IN_POT_ODDS): against a committed stack there are
 *    no later streets to win, so the decision is a price question. What happens to that mass
 *    depends on whether the TREE has collapsed (`spot.allInCollapsedTree`). When it has — no
 *    legal aggression, or nobody live behind the shover — there is genuinely nothing to raise
 *    into and the answer is call or fold. When it has not, the mass is split by the same
 *    RAISE_SHARE band the facing-a-bet path uses, because isolating a shove while a live
 *    opponent is still to act is an ordinary line, not an exotic one.
 *  - FACING A BET. Continue score fixes the continuing mass; aggression score splits it
 *    between calling and raising.
 *  - NOT FACING A BET. Aggression score alone splits check and bet; folding is not an option
 *    a rational player takes when checking is free, so `foldBps` is 0 by construction.
 */
export function scorePostflop(context: PostflopContext): PostflopScoring {
  const aggressionModel = scoreOf(aggressionComponents(context), AGGRESSION_TOTAL_WEIGHT);
  const band = aggressionBandFor(aggressionModel.score);
  const opponents = context.spot.activeOpponentCount;
  const scale = multiwayScaleBpsFor(opponents);
  const aggressionBps = applyMultiwayScale(band.aggressionBps, opponents);
  const penalty = multiwayContinuePenaltyBpsFor(opponents);

  if (context.spot.facingAllIn) {
    const margin = context.potOddsMargin ?? 0;
    const allInBand = bandFor(ALL_IN_CALL_BANDS, margin);
    // The price bands ARE the price-implied frequency, so the floor equals the band and the
    // multiway penalty cannot bite here — which is correct rather than incidental: hero's
    // equity is already measured against every live range and the required equity already
    // counts every chip in the pot, so a further flat subtraction would double-count the
    // extra opponents. The penalty is still reported, and it still bites on the ordinary
    // facing-a-bet path below.
    const continueBps = penalizedContinueBps(allInBand.points, opponents, context.potOddsMargin);
    // Rule `FACING_ALL_IN_ISOLATION`. A raise exists only when the tree has NOT collapsed.
    const split = context.spot.allInCollapsedTree
      ? null
      : splitContinueMass(continueBps, aggressionModel.score, opponents);
    const raiseBps = split?.raiseBps ?? 0;
    return {
      aggression: aggressionModel,
      aggressionBand: band,
      continueModel: scoreOf(continueComponents(context), CONTINUE_TOTAL_WEIGHT),
      continueBand: null,
      raiseShareBand: split?.shareBand ?? null,
      aggressionBps: raiseBps,
      multiwayScaleBps: scale,
      multiwayScaleApplied: split !== null && raiseBps < split.unscaled,
      continueBps,
      multiwayContinuePenaltyBps: penalty,
      allInBandLabel: allInBand.label,
      mix: {
        foldBps: BPS_TOTAL - continueBps,
        passiveBps: continueBps - raiseBps,
        aggressiveBps: raiseBps,
      },
    };
  }

  if (context.spot.facingBet) {
    const continueModel = scoreOf(continueComponents(context), CONTINUE_TOTAL_WEIGHT);
    const continueBand = continueBandFor(continueModel.score);
    const continueBps = penalizedContinueBps(
      continueBand.continueBps,
      opponents,
      context.potOddsMargin,
    );
    // The multiway ceiling applies to the raising frequency too, for the same reason it
    // applies to betting: an extra live opponent is an extra range that has to fold.
    const split = splitContinueMass(continueBps, aggressionModel.score, opponents);
    const raiseBps = split.raiseBps;
    return {
      aggression: aggressionModel,
      aggressionBand: band,
      continueModel,
      continueBand,
      raiseShareBand: split.shareBand,
      aggressionBps: raiseBps,
      multiwayScaleBps: scale,
      multiwayScaleApplied: raiseBps < split.unscaled,
      continueBps,
      multiwayContinuePenaltyBps: penalty,
      allInBandLabel: null,
      mix: {
        foldBps: BPS_TOTAL - continueBps,
        passiveBps: continueBps - raiseBps,
        aggressiveBps: raiseBps,
      },
    };
  }

  return {
    aggression: aggressionModel,
    aggressionBand: band,
    continueModel: null,
    continueBand: null,
    raiseShareBand: null,
    aggressionBps,
    multiwayScaleBps: scale,
    multiwayScaleApplied: aggressionBps < band.aggressionBps,
    continueBps: null,
    multiwayContinuePenaltyBps: penalty,
    allInBandLabel: null,
    mix: {
      foldBps: 0,
      passiveBps: BPS_TOTAL - aggressionBps,
      aggressiveBps: aggressionBps,
    },
  };
}
