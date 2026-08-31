/**
 * `recommendPostflop(query)` — the postflop reference answer.
 *
 * This file is assembly only. The measurements are `context.ts`, the model is
 * `scoreModel.ts`, the arithmetic on it is `score.ts`, the size is `sizing.ts`, and the
 * quantization / tie-break / provenance algebra is `preflop/recommendation.ts`. What is left
 * here is: reconcile the model's three buckets with what the engine will actually accept,
 * quantize, pick the primary action, collect the rule ids, and emit the structured
 * explanation.
 *
 * NEVER GTO (CLAUDE.md rule 2). The label is `REFERENCE` and there is no other.
 */
import { invariant, Money, ok, type MilliBB } from '@gto-self/shared';
import { asBps, type Bps } from '../bps.js';
import type { StrategyResult } from '../errors.js';
import {
  degradeProvenance,
  feature,
  pickPrimaryAction,
  quantizeFrequencies,
  sortActions,
  worstProvenance,
} from '../preflop/recommendation.js';
import { environmentCompatibility } from '../preflop/policy.js';
import type { Provenance } from '../provenance.js';
import type { StrategyActionKind, StrategyLegalActions, StrategyQuery } from '../types.js';
import { buildPostflopContext, type PostflopBudget, type PostflopContext } from './context.js';
import type {
  PostflopAction,
  PostflopExplanationFeature,
  PostflopExplanationFeatureId,
  PostflopRecommendation,
  PostflopSizing,
} from './recommendation.js';
import { postflopRule, type PostflopRuleId } from './rules.js';
import { scorePostflop, type PostflopScoring } from './score.js';
import {
  CONFIDENCE_THRESHOLDS,
  fairShareEquity,
  normalizeHeroEquity,
  type ConfidenceLevel,
} from './scoreModel.js';
import {
  clampPostflopSizing,
  selectSizing,
  sizingRequestFor,
  type SizingSelection,
} from './sizing.js';

export type { PostflopBudget } from './context.js';

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

/**
 * `wager.kind` is the engine's own word for what an aggressive action IS here: `BET` when no
 * money is outstanding on the street, `RAISE` when there is. The policy never guesses which
 * one applies — it reads it.
 *
 * `allIn.effect` is the same idea for the shove, and it is read for the same reason. When hero
 * cannot cover the outstanding bet, putting the last chip in does not raise the price: the
 * engine classifies it `'CALL'`, and it is the same money as `legal.call` down to the milliBB.
 * Such a shove is therefore NOT an independent aggressive action, and `canDo` refuses it for
 * the AGGRESSIVE chain (`ALL_IN` appears in no other chain, so one predicate is enough).
 *
 * Without that check a short hero facing an over-bet got TWO rows for one decision — `CALL 75%`
 * beside `ALL_IN 25%`, identical amounts — which understates how often the model actually calls
 * and lets the aggressive mass past `ALL_IN_SPR_GATE` on a legality artefact rather than on the
 * gate's own two conditions. With it, the aggressive bucket falls through to `CALL`, the
 * frequencies merge, and `ALL_IN_SPR_GATE` is reported as the rule that suppressed the
 * aggression — which is what actually happened.
 */
function canDo(legal: StrategyLegalActions, kind: StrategyActionKind): boolean {
  switch (kind) {
    case 'FOLD':
      return legal.canFold;
    case 'CHECK':
      return legal.canCheck;
    case 'CALL':
      return legal.call !== null;
    case 'BET':
      return legal.wager !== null && legal.wager.kind === 'BET' && !legal.wager.onlyAllIn;
    case 'RAISE':
      return legal.wager !== null && legal.wager.kind === 'RAISE' && !legal.wager.onlyAllIn;
    case 'ALL_IN':
      return legal.allIn !== null && legal.allIn.effect !== 'CALL';
  }
}

type Bucket = 'FOLD' | 'PASSIVE' | 'AGGRESSIVE';

/**
 * Rule `LEGALITY_SUBSTITUTION`. Fixed, documented chains; first legal candidate wins.
 *
 * As preflop, the FOLD chain reaches for CHECK BEFORE FOLD: when continuing costs nothing a
 * free continue strictly dominates folding, so "this hand has no reason to continue" renders
 * as a check in an unbet pot rather than as a fold.
 *
 * The AGGRESSIVE and PASSIVE chains depend on whether hero faces a bet, because the engine
 * offers BET or RAISE (never both) and CHECK or CALL (never both).
 *
 * ALL_IN sits in the AGGRESSIVE chain but is reachable ONLY when `ALL_IN_GATE` permits it
 * (rule `ALL_IN_SPR_GATE`) AND when the engine says the shove would actually raise the price
 * (`canDo`, above). Without the first guard a legality artefact — the engine offering no
 * sizable wager, or an `onlyAllIn` wager — would silently promote "the model wants to bet half
 * pot" into "jam 97 BB into a 5.5 BB pot", which is a strategy error dressed up as legality
 * handling. Without the second, a shove the engine itself classifies as a CALL would be emitted
 * as a separate aggressive row beside the identical CALL. When either guard blocks the jam the
 * chain falls through to the passive action, which is the honest degrade: the aggression this
 * spot wants cannot be expressed, so it is not aggressed, and the frequencies merge by kind.
 */
const SUBSTITUTIONS: Readonly<
  Record<'FACING' | 'UNBET', Readonly<Record<Bucket, readonly StrategyActionKind[]>>>
> = {
  UNBET: {
    AGGRESSIVE: ['BET', 'RAISE', 'ALL_IN', 'CHECK', 'CALL', 'FOLD'],
    PASSIVE: ['CHECK', 'CALL', 'FOLD'],
    FOLD: ['CHECK', 'FOLD', 'CALL'],
  },
  FACING: {
    AGGRESSIVE: ['RAISE', 'BET', 'ALL_IN', 'CALL', 'CHECK', 'FOLD'],
    PASSIVE: ['CALL', 'CHECK', 'FOLD'],
    FOLD: ['CHECK', 'FOLD', 'CALL'],
  },
};

function resolveKind(
  bucket: Bucket,
  facingBet: boolean,
  legal: StrategyLegalActions,
  aggressionIsSizable: boolean,
  allInPermitted: boolean,
): StrategyActionKind | null {
  for (const candidate of SUBSTITUTIONS[facingBet ? 'FACING' : 'UNBET'][bucket]) {
    if ((candidate === 'BET' || candidate === 'RAISE') && !aggressionIsSizable) continue;
    if (candidate === 'ALL_IN' && bucket === 'AGGRESSIVE' && !allInPermitted) continue;
    if (canDo(legal, candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Degradation — the same triggers preflop uses, plus multiway
// ---------------------------------------------------------------------------

interface Degradation {
  readonly steps: number;
  readonly forceHeuristic: boolean;
  readonly ruleIds: readonly PostflopRuleId[];
  readonly tokens: readonly string[];
}

function stackDegradation(query: StrategyQuery): Degradation {
  const bucket = query.stackBucket;
  if (bucket.kind === 'OUT_OF_RANGE') {
    return {
      steps: 0,
      forceHeuristic: true,
      ruleIds: ['STACK_BUCKET_OUT_OF_RANGE'],
      tokens: ['OUT_OF_RANGE'],
    };
  }
  switch (bucket.bucket.id) {
    case 'BB_80_119':
      return { steps: 0, forceHeuristic: false, ruleIds: [], tokens: ['BB_80_119'] };
    case 'BB_60_79':
    case 'BB_120_159':
      return {
        steps: 1,
        forceHeuristic: false,
        ruleIds: ['STACK_BUCKET_NEARBY'],
        tokens: [bucket.bucket.id],
      };
    case 'BB_40_59':
    case 'BB_160_PLUS':
      return {
        steps: 0,
        forceHeuristic: true,
        ruleIds: ['STACK_BUCKET_DISTANT'],
        tokens: [bucket.bucket.id],
      };
  }
}

function lineupDegradation(lineupSize: number): Degradation {
  if (lineupSize >= 6) return { steps: 0, forceHeuristic: false, ruleIds: [], tokens: [] };
  if (lineupSize >= 4) {
    return { steps: 1, forceHeuristic: false, ruleIds: ['LINEUP_SHORT_HANDED'], tokens: [] };
  }
  return { steps: 0, forceHeuristic: true, ruleIds: ['LINEUP_VERY_SHORT_HANDED'], tokens: [] };
}

/**
 * Rule `MULTIWAY_DEGRADE`. B2 note 8: the equity engine models no correlation between villain
 * ranges, and B2 §4 measures multiway flop equity at roughly plus or minus two points. A
 * multiway answer is materially less trustworthy and says so.
 */
function multiwayDegradation(activeOpponentCount: number): Degradation {
  if (activeOpponentCount <= 1) {
    return { steps: 0, forceHeuristic: false, ruleIds: [], tokens: [] };
  }
  return {
    steps: 1,
    forceHeuristic: false,
    ruleIds: ['MULTIWAY_DEGRADE'],
    tokens: [`OPPONENTS_${activeOpponentCount}`],
  };
}

function applyDegradation(value: Provenance, degradations: readonly Degradation[]): Provenance {
  let result = value;
  for (const degradation of degradations) {
    if (degradation.forceHeuristic) return 'HEURISTIC';
    result = degradeProvenance(result, degradation.steps);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function confidenceOf(context: PostflopContext): {
  readonly level: ConfidenceLevel;
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  if (context.spot.activeOpponentCount >= 2) reasons.push('MULTIWAY');
  if (context.heroEquityMethod === 'SUBSAMPLED') reasons.push('HERO_EQUITY_SUBSAMPLED');
  if (context.ranges.anyOffPolicy) reasons.push('OFF_POLICY_RANGE');
  if (context.ranges.postflopAggressionCount > 0) reasons.push('UNNARROWED_AGGRESSION');
  const level: ConfidenceLevel =
    reasons.length >= CONFIDENCE_THRESHOLDS.LOW_AT
      ? 'LOW'
      : reasons.length >= CONFIDENCE_THRESHOLDS.MEDIUM_AT
        ? 'MEDIUM'
        : 'HIGH';
  return { level, reasons };
}

// ---------------------------------------------------------------------------
// Action construction
// ---------------------------------------------------------------------------

function buildAction(
  kind: StrategyActionKind,
  frequencyBps: Bps,
  legal: StrategyLegalActions,
  sizing: PostflopSizing | null,
  heroStreetContributionMbb: MilliBB,
): PostflopAction {
  switch (kind) {
    case 'FOLD':
    case 'CHECK':
      return {
        kind,
        frequencyBps,
        toAmountMbb: null,
        amountMbb: null,
        isAllIn: false,
        sizing: null,
      };
    case 'CALL': {
      const call = legal.call;
      invariant(call !== null, 'CALL was selected but the engine offers none');
      return {
        kind,
        frequencyBps,
        toAmountMbb: call.toAmountMbb,
        amountMbb: call.amountMbb,
        isAllIn: call.isAllIn,
        sizing: null,
      };
    }
    case 'ALL_IN': {
      const allIn = legal.allIn;
      invariant(allIn !== null, 'ALL_IN was selected but the engine offers none');
      return {
        kind,
        frequencyBps,
        toAmountMbb: allIn.toAmountMbb,
        amountMbb: allIn.amountMbb,
        isAllIn: true,
        sizing: null,
      };
    }
    case 'BET':
    case 'RAISE': {
      invariant(sizing !== null, `${kind} was selected without a sizing`);
      const isAllIn = legal.allIn !== null && legal.allIn.toAmountMbb === sizing.toAmountMbb;
      return {
        kind,
        frequencyBps,
        toAmountMbb: sizing.toAmountMbb,
        amountMbb: Money.sub(sizing.toAmountMbb, heroStreetContributionMbb),
        isAllIn,
        sizing,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Explanation
// ---------------------------------------------------------------------------

const f = (
  id: PostflopExplanationFeatureId,
  parts: Parameters<typeof feature>[1] = {},
): PostflopExplanationFeature => feature<PostflopExplanationFeatureId>(id, parts);

function explanationFeatures(
  context: PostflopContext,
  scoring: PostflopScoring,
  selection: SizingSelection | null,
  sizing: PostflopSizing | null,
  /** Whether any EMITTED action actually carries that sizing. */
  sizedActionEmitted: boolean,
  degradations: readonly Degradation[],
  confidence: { readonly level: ConfidenceLevel; readonly reasons: readonly string[] },
): readonly PostflopExplanationFeature[] {
  const spot = context.spot;
  const hero = context.heroHand;
  const board = context.board;
  const out: PostflopExplanationFeature[] = [
    f('SPOT_FAMILY', { token: spot.family }),
    f('STREET', { token: spot.street }),
    f('POT_TYPE', { token: spot.potType }),
    f('HERO_POSITION', { token: spot.heroPosition }),
    f('RELATIVE_POSITION', { token: spot.heroRelativePosition }),
    f('ACTIVE_OPPONENTS', { countValue: spot.activeOpponentCount }),
    f('LINEUP_SIZE', { countValue: spot.lineupSize }),
    f('HAND_CLASS', { token: context.handClass.key }),
    f('MADE_HAND_CLASS', { token: hero.madeClass }),
    f('BOARD_TENDENCY', { token: board.tendency.value, countValue: board.tendencyScore }),
    f('BOARD_PAIRING', { token: board.pairing }),
    f('BOARD_CONNECTIVITY', { token: board.straightness.connectivity }),
    f('FLOP_SUIT_PATTERN', { token: board.suits.flopPattern }),
    f('HERO_EQUITY', { ratioValue: context.heroEquity }),
    // The ACTUAL pooled equity above, and beside it the fair share it is banded against and
    // the rescaled value the band table actually saw. Both are kept (CLAUDE.md rule 3): a
    // reader can go from `heroEquity` to the band without re-deriving the normalization.
    f('HERO_EQUITY_FAIR_SHARE', {
      ratioValue: fairShareEquity(spot.activeOpponentCount),
      countValue: spot.activeOpponentCount,
    }),
    f('HERO_EQUITY_NORMALIZED', {
      ratioValue: normalizeHeroEquity(context.heroEquity, spot.activeOpponentCount),
    }),
    f('RANGE_EQUITY', { ratioValue: context.rangeEquity }),
    f('RANGE_ADVANTAGE', { ratioValue: context.rangeAdvantage }),
    f('NUT_SHARE_HERO', { ratioValue: context.nut.heroNutShare }),
    f('NUT_SHARE_VILLAIN', { ratioValue: context.nut.villainNutShare }),
    f('NUT_ADVANTAGE', { ratioValue: context.nut.nutAdvantage }),
    f('RANGE_RANK', { ratioValue: context.rangeRank }),
    f('EQUITY_METHOD', { token: `${context.heroEquityMethod}/${context.rangeEquityMethod}` }),
  ];

  // Only when the basis is the unusual one: hero holds a combo his own range gives no weight,
  // so `RANGE_RANK` ranks an exact pairwise probe instead of a distribution entry (R1 MINOR-2).
  if (!context.heroComboInRange) {
    out.push(
      f('RANGE_RANK_BASIS', { token: context.rangeRankBasis, ratioValue: context.rangeRankEquity }),
    );
  }

  if (hero.isNuts) out.push(f('HERO_IS_NUTS', { token: 'TRUE' }));
  if (hero.draws.flushDraw !== null) {
    out.push(f('DRAW', { token: `FLUSH_DRAW_${hero.draws.flushDraw.nutClass}` }));
  }
  if (hero.draws.straightDraw !== null) {
    out.push(
      f('DRAW', {
        token: hero.draws.straightDraw.kind,
        countValue: hero.draws.straightDraw.outRanks.length,
      }),
    );
  }
  if (hero.draws.backdoorFlushDraw !== null) out.push(f('DRAW', { token: 'BACKDOOR_FLUSH_DRAW' }));
  if (hero.draws.backdoorStraightDraw) out.push(f('DRAW', { token: 'BACKDOOR_STRAIGHT_DRAW' }));
  for (const blocker of hero.blockers) out.push(f('BLOCKER', { token: blocker }));

  if (spot.previousStreetAggressor !== null) {
    out.push(f('PREVIOUS_STREET_AGGRESSOR', { token: spot.previousStreetAggressor }));
  }
  if (spot.currentStreetAggressor !== null) {
    out.push(f('CURRENT_STREET_AGGRESSOR', { token: spot.currentStreetAggressor }));
  }
  if (!spot.facingBet && spot.checksBeforeHero > 0) {
    out.push(f('CHECKS_TO_HERO', { countValue: spot.checksBeforeHero }));
  }
  if (spot.facingAllIn) {
    out.push(f('FACING_ALL_IN', { token: 'TRUE' }));
    // Whether anything is left to raise into. Reported so a multiway answer that CAN isolate
    // is distinguishable from a heads-up one that genuinely cannot.
    out.push(f('ALL_IN_TREE', { token: spot.allInCollapsedTree ? 'COLLAPSED' : 'LIVE' }));
  }
  if (context.spr !== null) out.push(f('SPR', { ratioValue: context.spr }));
  if (context.requiredEquity !== null) {
    out.push(f('POT_ODDS', { ratioValue: context.requiredEquity }));
  }
  if (context.potOddsMargin !== null) {
    out.push(f('POT_ODDS_MARGIN', { ratioValue: context.potOddsMargin }));
  }
  if (spot.facedBetFractionOfPot !== null) {
    out.push(f('BET_FRACTION_FACED', { ratioValue: spot.facedBetFractionOfPot }));
  }

  // The model's working: one feature per component, then the bands.
  for (const entry of scoring.aggression.components) {
    out.push(
      f('SCORE_COMPONENT', {
        token: `AGGRESSION.${entry.id}.${entry.label}`,
        ratioValue: entry.rawValue,
        countValue: entry.points,
      }),
    );
  }
  out.push(
    f('AGGRESSION_SCORE', { countValue: scoring.aggression.score }),
    f('AGGRESSION_BAND', {
      token: scoring.aggressionBand.id,
      bpsValue: asBps(scoring.aggressionBand.aggressionBps),
    }),
  );
  if (scoring.continueModel !== null) {
    for (const entry of scoring.continueModel.components) {
      out.push(
        f('SCORE_COMPONENT', {
          token: `CONTINUE.${entry.id}.${entry.label}`,
          ratioValue: entry.rawValue,
          countValue: entry.points,
        }),
      );
    }
    out.push(f('CONTINUE_SCORE', { countValue: scoring.continueModel.score }));
  }
  if (scoring.continueBand !== null) {
    out.push(
      f('CONTINUE_BAND', {
        token: scoring.continueBand.id,
        bpsValue: asBps(scoring.continueBand.continueBps),
      }),
    );
  }
  if (scoring.raiseShareBand !== null) {
    out.push(
      f('RAISE_SHARE_BAND', {
        token: scoring.raiseShareBand.id,
        bpsValue: asBps(scoring.raiseShareBand.raiseShareBps),
      }),
    );
  }
  if (scoring.allInBandLabel !== null) {
    out.push(f('ALL_IN_BAND', { token: scoring.allInBandLabel }));
  }
  if (scoring.multiwayScaleApplied) {
    out.push(f('MULTIWAY_SCALE', { bpsValue: asBps(scoring.multiwayScaleBps) }));
  }
  if (scoring.multiwayContinuePenaltyBps > 0 && scoring.continueBps !== null) {
    out.push(
      f('MULTIWAY_CONTINUE_PENALTY', { bpsValue: asBps(scoring.multiwayContinuePenaltyBps) }),
    );
  }

  // The sizing features describe an action that was actually EMITTED. When legality suppressed
  // the aggression the answer is a check or a call, and reporting "50% pot -> 2.75 BB" beside
  // it would describe a bet nobody is being told to make (R1 MINOR-4). `ALL_IN_GATE` is the
  // exception and stays: it is the explanation OF the suppression.
  if (selection !== null) {
    if (sizedActionEmitted) {
      out.push(
        f('SIZING_BUCKET', {
          token: selection.allIn ? 'ALL_IN' : `POT_${selection.bucket?.percent ?? 0}`,
          countValue: selection.finalIndex,
        }),
      );
      for (const modifier of selection.modifiers) {
        out.push(
          f('SIZING_MODIFIER', {
            token: `${modifier.ruleId}.${modifier.token}`,
            countValue: modifier.steps,
          }),
        );
      }
    }
    out.push(f('ALL_IN_GATE', { token: selection.allInGate }));
  }
  if (sizing !== null && sizedActionEmitted) {
    out.push(f('SIZING_RULE', { token: sizing.ruleId, mbbValue: sizing.toAmountMbb }));
    if (sizing.clamp !== 'NONE') {
      out.push(f('SIZING_CLAMPED', { token: sizing.clamp, mbbValue: sizing.requestedToAmountMbb }));
    }
  }

  out.push(
    f('VILLAIN_RANGE_NARROWING', {
      token: 'NOT_APPLIED',
      countValue: context.ranges.postflopActionCount,
    }),
  );
  if (context.ranges.anyOffPolicy) out.push(f('VILLAIN_RANGE_OFF_POLICY', { token: 'TRUE' }));

  const bucketToken = degradations[0]?.tokens[0];
  if (bucketToken !== undefined) {
    out.push(
      f('STACK_BUCKET', {
        token: bucketToken,
        mbbValue: context.query.stackBucket.effectiveStackMbb,
      }),
    );
    if (bucketToken === 'OUT_OF_RANGE') {
      out.push(
        f('UNMODELLED_STACK_DEPTH', { mbbValue: context.query.stackBucket.effectiveStackMbb }),
      );
    }
  }
  out.push(
    f('CONFIDENCE', {
      token: confidence.level,
      countValue: confidence.reasons.length,
    }),
  );
  for (const reason of confidence.reasons) out.push(f('CONFIDENCE', { token: reason }));
  return out;
}

// ---------------------------------------------------------------------------
// The public entry point
// ---------------------------------------------------------------------------

/**
 * Result. The postflop reference recommendation for hero's actual holding.
 *
 * Refuses only for reasons that are about the QUESTION, never about the spot: a preflop
 * query, a malformed board, a hand with no live opponent, hero's holding not entered as two
 * distinct cards that are not on the board, or an enumeration with nothing to enumerate. Every
 * spot the engine can pose an action in gets an answer.
 *
 * Deterministic: identical query and budget give a bit-identical recommendation. Nothing in
 * this module or anything it calls reads `Date`, `Math.random` or any machine state — B2's
 * subsampling is a pure function of `(n, k)`.
 */
export function recommendPostflop(
  query: StrategyQuery,
  budget: PostflopBudget = {},
): StrategyResult<PostflopRecommendation> {
  const built = buildPostflopContext(query, budget);
  if (!built.ok) return built;
  const context = built.value;
  const spot = context.spot;
  const legal = query.legalActions;

  const scoring = scorePostflop(context);

  // ---- sizing ---------------------------------------------------------------------------
  const wager = legal.wager;
  const selection =
    scoring.mix.aggressiveBps > 0 ? selectSizing(context, scoring.aggressionBand.id) : null;
  const heroSeat = query.seats.find((seat) => seat.isHero);
  const heroStreetContribution: MilliBB = heroSeat?.streetContributionMbb ?? Money.ZERO;
  const sizing: PostflopSizing | null =
    selection !== null && wager !== null
      ? clampPostflopSizing(
          sizingRequestFor(context, selection, heroStreetContribution, wager),
          wager,
        )
      : null;

  // ---- buckets -> legal kinds ------------------------------------------------------------
  const raw: readonly (readonly [Bucket, number])[] = [
    ['FOLD', scoring.mix.foldBps],
    ['PASSIVE', scoring.mix.passiveBps],
    ['AGGRESSIVE', scoring.mix.aggressiveBps],
  ];
  const merged = new Map<StrategyActionKind, number>();
  const allInPermitted = selection !== null && selection.allInGate === 'SELECTED';
  let substituted = false;
  /** True when the model wanted to aggress and legality left no way to express the size. */
  let aggressionSuppressed = false;
  for (const [bucket, bps] of raw) {
    if (bps <= 0) continue;
    const kind = resolveKind(bucket, spot.facingBet, legal, sizing !== null, allInPermitted);
    invariant(kind !== null, 'the engine offered hero no legal action at all');
    const expected: StrategyActionKind =
      bucket === 'FOLD'
        ? 'FOLD'
        : bucket === 'PASSIVE'
          ? spot.facingBet
            ? 'CALL'
            : 'CHECK'
          : spot.facingBet
            ? 'RAISE'
            : 'BET';
    if (kind !== expected) substituted = true;
    if (bucket === 'AGGRESSIVE' && kind !== 'BET' && kind !== 'RAISE' && kind !== 'ALL_IN') {
      aggressionSuppressed = true;
    }
    merged.set(kind, (merged.get(kind) ?? 0) + bps);
  }

  const kinds = [...merged.keys()];
  const quantized = quantizeFrequencies(kinds.map((kind) => merged.get(kind) ?? 0));
  const actions: PostflopAction[] = [];
  for (let i = 0; i < kinds.length; i += 1) {
    const kind = kinds[i];
    const frequencyBps = quantized[i];
    invariant(kind !== undefined && frequencyBps !== undefined, 'quantization changed arity');
    if (frequencyBps <= 0) continue;
    actions.push(buildAction(kind, frequencyBps, legal, sizing, heroStreetContribution));
  }
  invariant(actions.length > 0, 'every action was quantized away');
  const ordered = sortActions(actions);
  const primaryAction = pickPrimaryAction(ordered);
  // A sizing was COMPUTED whenever the model wanted to aggress; it is only REPORTED when an
  // emitted action carries it (R1 MINOR-4).
  const sizedActionEmitted = ordered.some((action) => action.sizing !== null);

  // ---- provenance ------------------------------------------------------------------------
  const degradations = [
    stackDegradation(query),
    lineupDegradation(query.dealtInCount),
    multiwayDegradation(spot.activeOpponentCount),
  ];

  const ruleIds: PostflopRuleId[] = [
    'POSTFLOP_SPOT_CLASSIFICATION',
    'VILLAIN_RANGE_FROM_PREFLOP',
    'HERO_EQUITY_MEASUREMENT',
    'RANGE_ADVANTAGE_MEASUREMENT',
    'NUT_ADVANTAGE_MEASUREMENT',
    'RANGE_PERCENTILE_MEASUREMENT',
    'AGGRESSION_SCORE_MODEL',
    'AGGRESSION_FREQUENCY_BANDS',
  ];
  if (spot.activeOpponentCount >= 2) ruleIds.push('HERO_EQUITY_FAIR_SHARE_NORMALIZATION');
  if (context.ranges.postflopActionCount > 0) ruleIds.push('VILLAIN_RANGE_NOT_NARROWED');
  if (context.ranges.anyOffPolicy) ruleIds.push('VILLAIN_RANGE_OFF_POLICY');
  if (context.ranges.villains.length > 1) ruleIds.push('PRIMARY_VILLAIN_SELECTION');
  if (context.anyEquitySubsampled) ruleIds.push('EQUITY_SUBSAMPLED');
  if (spot.facingBet) ruleIds.push('POSTFLOP_REQUIRED_EQUITY');
  if (spot.facingAllIn) {
    ruleIds.push('FACING_ALL_IN_POT_ODDS', 'FACING_ALL_IN_ISOLATION');
    // The raise-share table only participates when the tree is still live; when it has
    // collapsed there is no split to report and the answer is call or fold.
    if (!spot.allInCollapsedTree) ruleIds.push('RAISE_SHARE_BANDS');
  } else if (spot.facingBet) {
    ruleIds.push('CONTINUE_SCORE_MODEL', 'CONTINUE_FREQUENCY_BANDS', 'RAISE_SHARE_BANDS');
  }
  if (scoring.multiwayScaleApplied) ruleIds.push('MULTIWAY_AGGRESSION_SCALE');
  if (scoring.multiwayContinuePenaltyBps > 0 && scoring.continueBps !== null) {
    ruleIds.push('MULTIWAY_CONTINUE_PENALTY');
  }
  if (sizing !== null && sizedActionEmitted) {
    ruleIds.push('SIZING_BUCKET_SET', 'SIZING_BASE_BY_BAND');
    if (selection !== null) {
      for (const modifier of selection.modifiers) ruleIds.push(modifier.ruleId);
    }
    ruleIds.push(sizing.ruleId);
    if (sizing.clamp !== 'NONE') ruleIds.push('LEGALITY_CLAMP');
  }
  if (substituted) ruleIds.push('LEGALITY_SUBSTITUTION');
  if (aggressionSuppressed) ruleIds.push('ALL_IN_SPR_GATE');
  for (const degradation of degradations) ruleIds.push(...degradation.ruleIds);
  ruleIds.push('FREQUENCY_QUANTIZATION', 'PRIMARY_ACTION_TIE_BREAK', 'ENVIRONMENT_COMPATIBILITY');

  const uniqueRuleIds = [...new Set(ruleIds)];
  const quality = worstProvenance(
    uniqueRuleIds.map((id) => applyDegradation(postflopRule(id).provenance, degradations)),
  );
  const notes = uniqueRuleIds
    .map((id) => postflopRule(id))
    .filter((rule) => rule.provenance === 'HEURISTIC' || rule.provenance === 'DERIVED')
    .map((rule) => `${rule.id}: ${rule.rationale}`);
  invariant(quality !== 'HEURISTIC' || notes.length > 0, 'a HEURISTIC recommendation needs a note');

  const confidence = confidenceOf(context);

  return ok({
    kind: 'PostflopRecommendation',
    label: 'REFERENCE',
    street: spot.street,
    family: spot.family,
    potType: spot.potType,
    heroPosition: spot.heroPosition,
    handClass: context.handClass,
    actions: ordered,
    primaryAction,
    metrics: {
      spr: context.spr,
      potOdds: context.requiredEquity,
      requiredEquity: context.requiredEquity,
      heroEquity: context.heroEquity,
      heroEquityMethod: context.heroEquityMethod,
      rangeEquity: context.rangeEquity,
      rangeEquityMethod: context.rangeEquityMethod,
      rangeAdvantage: context.rangeAdvantage,
      nutAdvantage: context.nut.nutAdvantage,
      rangeRank: context.rangeRank,
      potBeforeDecisionMbb: context.potBeforeDecisionMbb,
      callAmountMbb: context.callAmountMbb,
      effectiveStackMbb: query.effectiveStackMbb,
      stackBucket: query.stackBucket,
      activeOpponentCount: spot.activeOpponentCount,
    },
    provenance: {
      quality,
      ruleIds: uniqueRuleIds,
      environmentCompatibility: environmentCompatibility(query),
      notes,
    },
    explanation: {
      features: explanationFeatures(
        context,
        scoring,
        selection,
        sizing,
        sizedActionEmitted,
        degradations,
        confidence,
      ),
    },
    scoring,
    confidence: confidence.level,
    villainRangeNarrowingApplied: false,
  });
}
