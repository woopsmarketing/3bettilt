/**
 * The sizing pass: opponent profile + REFERENCE size -> ADAPTIVE size.
 *
 * CONTROL FLOW ONLY. The rules, the two gates and the rung ceiling come from
 * `sizingModel.ts`; the bucket ladder, the pot-fraction arithmetic and the legality clamp come
 * from `@gto-self/strategy-core`. This file does no money arithmetic of its own — a second copy
 * of the bet-TO formula is exactly what §5.3's extraction of `potFractionToAmount` exists to
 * prevent.
 *
 * ---------------------------------------------------------------------------------------
 * THE PIPELINE (WP-J design contract §5)
 *
 *  1. GATE THE SPOT. Postflop only; the baseline must carry a sizing; an ALL_IN rung
 *     (`bucketIndex === -1`) is NEVER moved; the caller must supply the engine's legal wager
 *     window. Any of those failing echoes the baseline size unchanged with a note saying which.
 *  2. GATE THE EVIDENCE. Each rule needs `confidenceBps >= SIZING_MIN_CONFIDENCE_BPS_*` —
 *     5000 heads-up, 7500 multiway — which is strictly above the frequency gate of 2500. A rule
 *     carrying a `suppressedWhen` SECONDARY signal (WP-K follow-up §2) additionally drops out
 *     when that second stat, at the same gate, sits on the side that withdraws its support.
 *     A suppressor can only ever remove a rung; it can never add one or flip a sign.
 *  3. SUM THE RUNGS and clamp the net to `[-MAX_SIZING_BUCKET_DELTA, +MAX_SIZING_BUCKET_DELTA]`.
 *  4. RESOLVE. `newIndex = clamp(baseIndex + delta, 0, POT_FRACTION_BUCKETS.length - 1)`, then
 *     `potFractionToAmount` -> `clampPostflopSizing`. `requestedToAmountMbb` is retained beside
 *     the clamped amount (CLAUDE.md rule 3), so a size the engine's bounds overrode is still
 *     visible as what the rule actually asked for.
 *
 * The result is, by construction, one of the engine's own eight buckets, inside the engine's
 * own legal window. ADAPTIVE cannot state a size REFERENCE could not have stated.
 *
 * ---------------------------------------------------------------------------------------
 * THE §9 GUARD RAIL APPLIES HERE TOO — a documented extension of the design contract
 *
 * §9 names the frequency pass ("every POSITIVE AGGRESSION contribution is zeroed"). We apply
 * the same refusal to a POSITIVE rung offset. Refusing to bet MORE OFTEN into a known
 * check-raiser while cheerfully betting BIGGER into them would be incoherent, and the guard can
 * only ever reduce movement, so extending it is safe in the one direction that matters.
 * Negative offsets — sizing down — survive, exactly as negative frequency contributions do.
 * ---------------------------------------------------------------------------------------
 */
import {
  POT_FRACTION_BUCKETS,
  clampPostflopSizing,
  potFractionToAmount,
  type PotFractionBucket,
  type SizingSelection,
  type StrategyWagerOption,
} from '@gto-self/strategy-core';
import { isPostflopStreet, strengthCategoryFor, type AdaptiveBaseline } from '../baseline.js';
import type { BehindAggressionFinding } from '../multiway.js';
import type { PlayerAdjustmentProfile } from '../profile.js';
import type { AdaptiveAdjustment, AdaptiveSizing } from '../recommendation.js';
import type { AdaptiveStatKey } from '../stats.js';
import { resolveStat, type AdaptiveRuleDirection } from './frequencyModel.js';
import {
  ADAPTIVE_SIZING_RULES,
  MAX_SIZING_BUCKET_DELTA,
  sizingMinConfidenceBpsFor,
  type AdaptiveSizingRule,
} from './sizingModel.js';
import { adaptiveNote, type AdaptiveCapId, type AdaptiveNote } from './reasons.js';
import { scopeMatches } from './scope.js';

export interface SizingAdaptation {
  /** `null` only when the baseline carried no sizing at all. */
  readonly sizing: AdaptiveSizing | null;
  readonly adjustments: readonly AdaptiveAdjustment[];
  readonly notes: readonly AdaptiveNote[];
}

/** Internal. One sizing rule that fired, with its running rung offset and limiter. */
interface SizingCandidate {
  readonly rule: AdaptiveSizingRule;
  readonly stat: AdaptiveStatKey;
  readonly profile: PlayerAdjustmentProfile;
  steps: number;
  cappedBy: AdaptiveCapId | null;
}

/**
 * Internal. The baseline size echoed as an ADAPTIVE row with nothing moved.
 *
 * Emitted rather than `null` whenever a size exists, so the panel can show "size unchanged"
 * instead of showing an empty slot next to a changed frequency.
 */
function echoSizing(baseline: AdaptiveBaseline): AdaptiveSizing | null {
  const sizing = baseline.sizing;
  if (sizing === null) return null;
  return {
    kind: sizing.kind,
    fromBucketIndex: sizing.bucketIndex,
    toBucketIndex: sizing.bucketIndex,
    fromPotFractionPercent: sizing.potFractionPercent,
    toPotFractionPercent: sizing.potFractionPercent,
    bucketDelta: 0,
    fromToAmountMbb: sizing.toAmountMbb,
    toToAmountMbb: sizing.toAmountMbb,
    requestedToAmountMbb: sizing.toAmountMbb,
    clamp: 'NONE',
    minToAmountMbb: sizing.minToAmountMbb,
    maxToAmountMbb: sizing.maxToAmountMbb,
  };
}

/** Internal. The unchanged result. */
const unchanged = (
  baseline: AdaptiveBaseline,
  notes: readonly AdaptiveNote[],
): SizingAdaptation => ({ sizing: echoSizing(baseline), adjustments: [], notes });

/** Internal. `true` when the deviation is on the given side of the anchor. Zero never matches. */
const onSide = (direction: AdaptiveRuleDirection, deviationBps: number): boolean =>
  direction === 'ABOVE_PRIOR' ? deviationBps > 0 : deviationBps < 0;

/** Internal. `true` when the deviation is on the side the rule fires from. Zero never fires. */
const directionMatches = (rule: AdaptiveSizingRule, deviationBps: number): boolean =>
  onSide(rule.direction, deviationBps);

/**
 * Internal. `true` when the rule's SECONDARY signal has withdrawn its support (WP-K
 * follow-up §2).
 *
 * The secondary stat is held to the SAME confidence gate as the primary one. That is the
 * point: a suppressor is a claim about the opponent too, and a rule may not be held back by
 * evidence we would have refused to act on ourselves. A stat nobody reported has
 * `deviationBps === 0` and `confidenceBps === 0`, so an absent secondary reading never
 * suppresses anything — the rule behaves exactly as it did before this mechanism existed.
 */
function secondarySignalWithdrawn(
  rule: AdaptiveSizingRule,
  profile: PlayerAdjustmentProfile,
  minConfidenceBps: number,
): boolean {
  const suppressor = rule.suppressedWhen;
  if (suppressor === undefined) return false;
  const estimate = profile.stats[suppressor.stat];
  if (estimate.confidenceBps < minConfidenceBps) return false;
  return onSide(suppressor.direction, estimate.deviationBps);
}

/**
 * Total. The sizing pass. Never throws for a data-shaped reason.
 *
 * `target` on every emitted adjustment is `AGGRESSION`: a rung is a statement about how hard
 * hero is pressing, and `contributionBps` is 0 on all of them because a sizing rule moves no
 * frequency mass at all. Both are documented on `AdaptiveAdjustment`.
 */
export function adaptSizing(
  baseline: AdaptiveBaseline,
  primary: PlayerAdjustmentProfile | null,
  wager: StrategyWagerOption | null,
  behindFinding: BehindAggressionFinding,
): SizingAdaptation {
  const sizing = baseline.sizing;
  if (sizing === null) return unchanged(baseline, []);
  if (!isPostflopStreet(baseline.street)) {
    return unchanged(baseline, [adaptiveNote('PREFLOP_SIZING_OUT_OF_SCOPE')]);
  }
  // The top rung is never moved: an all-in is not a pot fraction, and there is no rung above it.
  if (sizing.allIn || sizing.bucketIndex < 0 || sizing.bucketIndex >= POT_FRACTION_BUCKETS.length) {
    return unchanged(baseline, [adaptiveNote('SIZING_ALL_IN_NOT_MOVED')]);
  }
  if (primary === null) return unchanged(baseline, []);
  if (wager === null) {
    return unchanged(baseline, [adaptiveNote('SIZING_WAGER_WINDOW_MISSING')]);
  }

  const minConfidenceBps = sizingMinConfidenceBpsFor(baseline.activeOpponentCount);
  const candidates: SizingCandidate[] = [];
  // Rules whose primary signal fired but whose secondary signal withdrew support. Recorded so
  // "the size did not move" is answerable, never dropped silently.
  const withdrawn: AdaptiveNote[] = [];
  for (const rule of ADAPTIVE_SIZING_RULES) {
    if (!rule.streets.includes(baseline.street)) continue;
    if (!scopeMatches(rule.appliesWhen, baseline)) continue;
    const category = strengthCategoryFor(baseline.aggressionBand);
    if (category === null || !rule.bands.includes(category)) continue;

    const stat = resolveStat(rule.stat, baseline.street);
    if (stat === null) continue;
    const estimate = primary.stats[stat];
    if (estimate.confidenceBps < minConfidenceBps) continue;
    if (!directionMatches(rule, estimate.deviationBps)) continue;
    if (secondarySignalWithdrawn(rule, primary, minConfidenceBps)) {
      withdrawn.push(adaptiveNote('SIZING_SECONDARY_SIGNAL_WITHDRAWN', rule.id));
      continue;
    }

    candidates.push({ rule, stat, profile: primary, steps: rule.steps, cappedBy: null });
  }

  if (candidates.length === 0) {
    return unchanged(baseline, [
      ...withdrawn,
      adaptiveNote('SIZING_CONFIDENCE_GATE_NOT_MET', String(minConfidenceBps)),
    ]);
  }

  const notes: AdaptiveNote[] = [...withdrawn];

  // The §9 guard rail, extended to a positive rung offset. See this file's header.
  if (behindFinding.tripped) {
    let guardFired = false;
    for (const candidate of candidates) {
      if (candidate.steps <= 0) continue;
      candidate.steps = 0;
      candidate.cappedBy = 'AGGRESSIVE_PLAYER_BEHIND';
      guardFired = true;
    }
    if (guardFired)
      notes.push(adaptiveNote('AGGRESSIVE_PLAYER_BEHIND', behindFinding.stat ?? null));
  }

  const requestedSteps = candidates.reduce((sum, candidate) => sum + candidate.steps, 0);
  const clampedSteps = Math.max(
    -MAX_SIZING_BUCKET_DELTA,
    Math.min(MAX_SIZING_BUCKET_DELTA, requestedSteps),
  );
  if (clampedSteps !== requestedSteps) {
    for (const candidate of candidates) {
      if (candidate.steps !== 0 && candidate.cappedBy === null) {
        candidate.cappedBy = 'SIZING_BUCKET_DELTA';
      }
    }
  }

  const fromIndex = sizing.bucketIndex;
  const rawIndex = fromIndex + clampedSteps;
  const toIndex = Math.max(0, Math.min(POT_FRACTION_BUCKETS.length - 1, rawIndex));
  if (toIndex !== rawIndex) {
    for (const candidate of candidates) {
      if (candidate.steps !== 0 && candidate.cappedBy === null) {
        candidate.cappedBy = 'SIZING_LADDER_END';
      }
    }
  }

  const adjustments: AdaptiveAdjustment[] = candidates.map((candidate) => {
    const estimate = candidate.profile.stats[candidate.stat];
    return {
      ruleId: candidate.rule.id,
      ruleKind: 'SIZING',
      stat: candidate.stat,
      priorBps: estimate.priorBps,
      observedBps: estimate.observedBps,
      estimateBps: estimate.estimateBps,
      deviationBps: estimate.deviationBps,
      sampleN: estimate.sampleN,
      confidenceBps: estimate.confidenceBps,
      confidenceState: estimate.confidenceState,
      sources: estimate.sources,
      target: 'AGGRESSION',
      rawContributionBps: 0,
      contributionBps: 0,
      sizingSteps: candidate.steps,
      cappedBy: candidate.cappedBy,
      reasonKey: candidate.rule.reasonKey,
      note: candidate.rule.note,
      opponentPlayerId: candidate.profile.playerId,
    };
  });

  if (toIndex === fromIndex) {
    return { sizing: echoSizing(baseline), adjustments, notes };
  }

  const bucket: PotFractionBucket | undefined = POT_FRACTION_BUCKETS[toIndex];
  // Unreachable: `toIndex` is clamped into the ladder above. The branch exists because
  // `noUncheckedIndexedAccess` is on and a silent `!` would be the wrong way to say so.
  if (bucket === undefined) return { sizing: echoSizing(baseline), adjustments, notes };

  const requestedToAmountMbb = potFractionToAmount(
    {
      potBeforeDecisionMbb: sizing.potBeforeDecisionMbb,
      callAmountMbb: sizing.callAmountMbb,
      heroStreetContributionMbb: sizing.heroStreetContributionMbb,
    },
    bucket,
  );

  // A selection carrying NO engine modifiers, because none produced this rung: ADAPTIVE did.
  // `clampPostflopSizing` reads `modifiers` only to compute a provenance, and this package
  // reports its own `HEURISTIC` provenance on the recommendation regardless.
  const selection: SizingSelection = {
    bucket,
    allIn: false,
    baseIndex: fromIndex,
    finalIndex: toIndex,
    modifiers: [],
    allInGate: 'NOT_CONSIDERED',
  };
  const clamped = clampPostflopSizing(
    { ruleId: 'SIZING_POT_FRACTION_TO_AMOUNT', toAmountMbb: requestedToAmountMbb, selection },
    wager,
  );

  return {
    sizing: {
      kind: sizing.kind,
      fromBucketIndex: fromIndex,
      toBucketIndex: toIndex,
      fromPotFractionPercent: sizing.potFractionPercent,
      toPotFractionPercent: bucket.percent,
      bucketDelta: toIndex - fromIndex,
      fromToAmountMbb: sizing.toAmountMbb,
      toToAmountMbb: clamped.toAmountMbb,
      requestedToAmountMbb: clamped.requestedToAmountMbb,
      clamp: clamped.clamp,
      minToAmountMbb: clamped.minToAmountMbb,
      maxToAmountMbb: clamped.maxToAmountMbb,
    },
    adjustments,
    notes,
  };
}
