/**
 * Postflop sizing: from board/range features to a legal bet-TO or raise-TO in integer milliBB.
 *
 * Two rules, both registered in `rules.ts` and both enforced here:
 *
 *  - ARITHMETIC (`SIZING_POT_FRACTION_TO_AMOUNT`). Every step is integer milliBB through
 *    `Money.*` with explicit rounding (CLAUDE.md rule 1). The pot fractions are exact integer
 *    rationals in `scoreModel.ts`; the pot and the price come from the query. Rounding is
 *    `'round'` at the single point a fraction is applied — never twice, never implicitly.
 *
 *  - LEGALITY: CLAMP-AND-DEGRADE (`LEGALITY_CLAMP`). Identical to A3's documented policy, and
 *    identical for a reason: a money-adjacent convention that differs by street would be a
 *    second system. The requested TO amount is clamped into the engine's
 *    `[minToAmountMbb, maxToAmountMbb]`; when the clamp moves the number, the ORIGINAL request
 *    is kept beside it (CLAUDE.md rule 3), the direction is recorded, and the provenance drops
 *    one step. An illegal size is never emitted.
 *
 * NO PSEUDO-PRECISION. A size is always one of the eight `POT_FRACTION_BUCKETS` or an all-in;
 * `47.83% pot` is unrepresentable. What the ENGINE's bounds do to that choice is recorded as a
 * clamp, never smuggled in as a new size.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import {
  degradeProvenance,
  worstProvenance,
  type RecommendedSizing,
  type SizingClampKind,
} from '../preflop/recommendation.js';
import type { Provenance } from '../provenance.js';
import type { StrategyWagerOption } from '../types.js';
import { postflopRule, type PostflopRuleId } from './rules.js';
import {
  ALL_IN_GATE,
  AGGRESSION_BAND_IDS,
  POT_FRACTION_BUCKETS,
  SIZING_BASE_INDEX_BY_BAND,
  SIZING_MODIFIERS,
  type AggressionBandId,
  type PotFractionBucket,
} from './scoreModel.js';
import type { PostflopContext } from './context.js';

/** One rung offset, with the rule that produced it — the sizing decision's audit trail. */
export interface SizingModifier {
  readonly ruleId: PostflopRuleId;
  readonly steps: number;
  /** A stable token naming the branch taken. */
  readonly token: string;
}

export interface SizingSelection {
  /** The chosen bucket, or null when ALL_IN was selected instead. */
  readonly bucket: PotFractionBucket | null;
  readonly allIn: boolean;
  readonly baseIndex: number;
  readonly finalIndex: number;
  readonly modifiers: readonly SizingModifier[];
  /** Why ALL_IN was or was not available. */
  readonly allInGate: 'SELECTED' | 'BLOCKED_BY_SPR' | 'BLOCKED_BY_BAND' | 'NOT_CONSIDERED';
}

const bandRank = (band: AggressionBandId): number => AGGRESSION_BAND_IDS.indexOf(band);

/**
 * Total. Which size this spot wants, before legality is consulted.
 *
 * The base rung comes from the aggression band; every modifier is a documented rung offset,
 * they are SUMMED, and the sum is clamped into the ladder. No modifier can push a size off
 * the ladder and no combination can produce a size that is not a listed bucket.
 */
export function selectSizing(context: PostflopContext, band: AggressionBandId): SizingSelection {
  const baseIndex = SIZING_BASE_INDEX_BY_BAND[band];
  const modifiers: SizingModifier[] = [];

  const tendency = context.board.tendency.value;
  const tendencySteps = SIZING_MODIFIERS.BY_TENDENCY[tendency];
  if (tendencySteps !== 0) {
    modifiers.push({ ruleId: 'SIZING_TEXTURE_MODIFIER', steps: tendencySteps, token: tendency });
  }

  const nut = context.nut.nutAdvantage;
  if (nut >= SIZING_MODIFIERS.NUT_ADVANTAGE_MARGIN) {
    modifiers.push({
      ruleId: 'SIZING_NUT_ADVANTAGE_MODIFIER',
      steps: SIZING_MODIFIERS.NUT_ADVANTAGE_STEP,
      token: 'HERO_NUT_ADVANTAGE',
    });
  } else if (nut <= -SIZING_MODIFIERS.NUT_ADVANTAGE_MARGIN) {
    modifiers.push({
      ruleId: 'SIZING_NUT_ADVANTAGE_MODIFIER',
      steps: -SIZING_MODIFIERS.NUT_ADVANTAGE_STEP,
      token: 'VILLAIN_NUT_ADVANTAGE',
    });
  }

  if (tendency === 'STATIC' && context.rangeAdvantage >= SIZING_MODIFIERS.RANGE_ADVANTAGE_MARGIN) {
    modifiers.push({
      ruleId: 'SIZING_RANGE_ADVANTAGE_MODIFIER',
      steps: SIZING_MODIFIERS.RANGE_ADVANTAGE_STATIC_STEP,
      token: 'STATIC_RANGE_EDGE',
    });
  }

  const spr = context.spr;
  if (spr !== null && spr < SIZING_MODIFIERS.LOW_SPR) {
    modifiers.push({
      ruleId: 'SIZING_SPR_MODIFIER',
      steps: SIZING_MODIFIERS.SPR_STEP,
      token: 'LOW_SPR',
    });
  } else if (spr !== null && spr > SIZING_MODIFIERS.HIGH_SPR) {
    modifiers.push({
      ruleId: 'SIZING_SPR_MODIFIER',
      steps: -SIZING_MODIFIERS.SPR_STEP,
      token: 'HIGH_SPR',
    });
  }

  if (context.spot.activeOpponentCount >= SIZING_MODIFIERS.MULTIWAY_OPPONENT_THRESHOLD) {
    modifiers.push({
      ruleId: 'SIZING_MULTIWAY_MODIFIER',
      steps: SIZING_MODIFIERS.MULTIWAY_STEP,
      token: `OPPONENTS_${context.spot.activeOpponentCount}`,
    });
  }

  if (context.spot.street === 'RIVER') {
    modifiers.push({
      ruleId: 'SIZING_STREET_MODIFIER',
      steps: SIZING_MODIFIERS.RIVER_STEP,
      token: 'RIVER',
    });
  }

  if (context.spot.facingBet) {
    modifiers.push({
      ruleId: 'SIZING_RAISE_MODIFIER',
      steps: SIZING_MODIFIERS.RAISE_STEP,
      token: 'RAISE',
    });
  }

  const offset = modifiers.reduce((sum, entry) => sum + entry.steps, 0);
  const finalIndex = Math.max(0, Math.min(POT_FRACTION_BUCKETS.length - 1, baseIndex + offset));

  // The ALL_IN rung. Gated on BOTH conditions, and reported either way so the explanation can
  // say why the top rung was or was not available.
  const bandOk = bandRank(band) <= bandRank(ALL_IN_GATE.MIN_BAND);
  const sprOk = spr !== null && spr <= ALL_IN_GATE.MAX_SPR;
  const allInGate: SizingSelection['allInGate'] = !bandOk
    ? 'BLOCKED_BY_BAND'
    : !sprOk
      ? 'BLOCKED_BY_SPR'
      : 'SELECTED';

  if (allInGate === 'SELECTED') {
    return { bucket: null, allIn: true, baseIndex, finalIndex, modifiers, allInGate };
  }
  const bucket = POT_FRACTION_BUCKETS[finalIndex];
  if (bucket === undefined) {
    throw new Error(`sizing index ${finalIndex} is outside the bucket ladder`);
  }
  return { bucket, allIn: false, baseIndex, finalIndex, modifiers, allInGate };
}

export interface PostflopSizingRequest {
  readonly ruleId: PostflopRuleId;
  readonly toAmountMbb: MilliBB;
  readonly selection: SizingSelection;
}

/**
 * Total. The pot-fraction bucket as a raise-TO / bet-TO amount in integer milliBB.
 *
 * BET (nothing to call): `heroStreetContribution + round(potBeforeDecision * f)`.
 * RAISE (facing a bet):  `callToAmount + round((potBeforeDecision + callAmount) * f)`.
 *
 * The raise formula applies the fraction to the pot AS IT WOULD BE after hero calls, which is
 * the standard reading of "raise to X% of the pot" and the only reading under which a
 * 100%-pot raise leaves villain facing a pot-sized bet. Exactly one rounding, in `mulRatio`.
 */
export function sizingRequestFor(
  context: PostflopContext,
  selection: SizingSelection,
  heroStreetContributionMbb: MilliBB,
  wager: StrategyWagerOption,
): PostflopSizingRequest {
  if (selection.allIn) {
    return {
      ruleId: 'ALL_IN_SPR_GATE',
      toAmountMbb: wager.maxToAmountMbb,
      selection,
    };
  }
  const bucket = selection.bucket;
  if (bucket === null) throw new Error('a non-all-in selection must carry a bucket');

  const pot = context.potBeforeDecisionMbb;
  const call = context.callAmountMbb;
  const toAmountMbb: MilliBB = Money.isPositive(call)
    ? Money.add(
        Money.add(heroStreetContributionMbb, call),
        Money.mulRatio(Money.add(pot, call), bucket.numerator, bucket.denominator, 'round'),
      )
    : Money.add(
        heroStreetContributionMbb,
        Money.mulRatio(pot, bucket.numerator, bucket.denominator, 'round'),
      );

  return { ruleId: 'SIZING_POT_FRACTION_TO_AMOUNT', toAmountMbb, selection };
}

/**
 * Total. Applies `LEGALITY_CLAMP`, exactly as `preflop/sizing.ts` does. The result is always
 * inside the engine's bounds; the request that produced it is always retained.
 *
 * The base provenance is the WORST of every rule that contributed to the size — the ladder,
 * the base rung, each modifier that fired, and the arithmetic. Reporting only the arithmetic
 * rule's `DERIVED` would be a claim about the CHOICE that the choice does not support: the
 * milliBB conversion is mechanical, but which rung to convert is entirely authored.
 */
export function clampPostflopSizing(
  request: PostflopSizingRequest,
  wager: StrategyWagerOption,
): RecommendedSizing<PostflopRuleId> {
  const contributing: PostflopRuleId[] = [
    'SIZING_BUCKET_SET',
    'SIZING_BASE_BY_BAND',
    request.ruleId,
    ...request.selection.modifiers.map((modifier) => modifier.ruleId),
  ];
  const base: Provenance = worstProvenance(contributing.map((id) => postflopRule(id).provenance));
  const min = wager.minToAmountMbb;
  const max = wager.maxToAmountMbb;
  // The engine can hand back min > max only if it is inconsistent; `Money.clamp` would throw,
  // so the degenerate case collapses to the maximum, which is always legal.
  const clamped: MilliBB = min > max ? max : Money.clamp(request.toAmountMbb, min, max);
  const clamp: SizingClampKind =
    clamped === request.toAmountMbb
      ? 'NONE'
      : clamped > request.toAmountMbb
        ? 'RAISED_TO_MINIMUM'
        : 'LOWERED_TO_MAXIMUM';
  return {
    ruleId: request.ruleId,
    requestedToAmountMbb: request.toAmountMbb,
    toAmountMbb: clamped,
    clamp,
    provenance: clamp === 'NONE' ? base : degradeProvenance(base, 1),
    minToAmountMbb: min,
    maxToAmountMbb: max,
  };
}
