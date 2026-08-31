/**
 * Raise sizing: from an anchor ratio to a LEGAL raise-TO amount in integer milliBB.
 *
 * Two rules, both documented in `rules.ts` and both enforced here:
 *
 *  - ARITHMETIC. Every step is integer milliBB through `Money.*` with explicit rounding
 *    (CLAUDE.md rule 1). The ratios come from `tables.ts`; the big blind and the opponents'
 *    raise-TO amounts come from the query. Rounding is `'round'` (half away from zero) at the
 *    single point where a ratio is applied — never twice, never implicitly.
 *
 *  - LEGALITY: CLAMP-AND-DEGRADE (rule `LEGALITY_CLAMP`). The requested raise-TO is clamped
 *    into the engine's `[minToAmountMbb, maxToAmountMbb]`. When the clamp actually moved the
 *    number, the ORIGINAL request is kept beside it (CLAUDE.md rule 3) and the sizing's
 *    provenance drops one step, because a clamped size is no longer the size the source
 *    prescribed. An illegal size is never emitted.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type { Provenance } from '../provenance.js';
import type { StrategyPosition, StrategyWagerOption } from '../types.js';
import type { RecommendedSizing, SizingClampKind } from './recommendation.js';
import { preflopRule, type PreflopRuleId } from './rules.js';
import { SIZING, type SizingRatio } from './tables.js';
import type { HeroRelativePosition } from './spot.js';

/** What a sizing rule asked for, before the engine's bounds are consulted. */
export interface SizingRequest {
  readonly ruleId: PreflopRuleId;
  readonly toAmountMbb: MilliBB;
}

const ratio = (amount: MilliBB, r: SizingRatio): MilliBB =>
  Money.mulRatio(amount, r.numerator, r.denominator, 'round');

/** SOURCE. 2.5bb, or 3bb from the small blind (anchor 2). */
export function rfiSizing(bigBlindMbb: MilliBB, heroPosition: StrategyPosition): SizingRequest {
  const table = heroPosition === 'SB' ? SIZING.RFI_SB_BB : SIZING.RFI_STANDARD_BB;
  return { ruleId: 'SIZE_RFI', toAmountMbb: ratio(bigBlindMbb, table) };
}

/** DERIVED. The RFI size plus 1bb per limper (anchor 2, S8's limper term). */
export function isoSizing(
  bigBlindMbb: MilliBB,
  heroPosition: StrategyPosition,
  limperCount: number,
): SizingRequest {
  const base = rfiSizing(bigBlindMbb, heroPosition).toAmountMbb;
  const perLimper = ratio(bigBlindMbb, SIZING.ISO_PER_LIMPER_BB);
  return {
    ruleId: 'SIZE_ISO_VS_LIMP',
    toAmountMbb: Money.add(base, Money.mulInt(perLimper, Math.max(0, limperCount))),
  };
}

/** DERIVED, single-sourced. BB raising an SB limp to 3.5bb (anchor 7; S13's 4bb is the alternative). */
export function bbVsSbLimpSizing(bigBlindMbb: MilliBB): SizingRequest {
  return {
    ruleId: 'SIZE_BB_VS_SB_LIMP',
    toAmountMbb: ratio(bigBlindMbb, SIZING.BB_VS_SB_LIMP_BB),
  };
}

/** 3-bet: DERIVED 3.0x the open in position, SOURCE 4x out of position (anchor 3). */
export function threeBetSizing(openToMbb: MilliBB, relative: HeroRelativePosition): SizingRequest {
  return relative === 'IP'
    ? { ruleId: 'SIZE_THREE_BET_IP', toAmountMbb: ratio(openToMbb, SIZING.THREE_BET_IP) }
    : { ruleId: 'SIZE_THREE_BET_OOP', toAmountMbb: ratio(openToMbb, SIZING.THREE_BET_OOP) };
}

/** 4-bet: SOURCE 2.3x the 3-bet in position, 2.5x out of position (anchor 4). */
export function fourBetSizing(
  threeBetToMbb: MilliBB,
  relative: HeroRelativePosition,
): SizingRequest {
  return relative === 'IP'
    ? { ruleId: 'SIZE_FOUR_BET_IP', toAmountMbb: ratio(threeBetToMbb, SIZING.FOUR_BET_IP) }
    : { ruleId: 'SIZE_FOUR_BET_OOP', toAmountMbb: ratio(threeBetToMbb, SIZING.FOUR_BET_OOP) };
}

/**
 * DERIVED. Squeeze: 4x the open in position, 5x out of position, plus 1x the open for each
 * cold caller BEYOND the first (anchor 5, S8). S7's flat 3x+1x/caller is the alternative
 * recorded in `tables.ts`.
 */
export function squeezeSizing(
  openToMbb: MilliBB,
  relative: HeroRelativePosition,
  coldCallerCount: number,
): SizingRequest {
  const base = relative === 'IP' ? SIZING.SQUEEZE_IP : SIZING.SQUEEZE_OOP;
  const extraCallers = Math.max(0, coldCallerCount - 1);
  const combined = addRatioTimes(base, SIZING.SQUEEZE_PER_EXTRA_CALLER, extraCallers);
  return {
    ruleId: 'SIZE_SQUEEZE',
    toAmountMbb: Money.mulRatio(openToMbb, combined.numerator, combined.denominator, 'round'),
  };
}

/**
 * Total, exact, and pure. `base + times * addend`, as one integer ratio over the common
 * denominator — so the caller can round ONCE at the end (`sizing.ts` header rule 1).
 *
 * MINOR-3: `squeezeSizing` used to read only `SQUEEZE_PER_EXTRA_CALLER.numerator`. That was
 * arithmetically correct while the denominator happened to be 1 and silently wrong the moment
 * it stopped being — a ratio's denominator is not optional. Exported so that is testable
 * rather than latent.
 */
export function addRatioTimes(base: SizingRatio, addend: SizingRatio, times: number): SizingRatio {
  const whole = Math.max(0, Math.trunc(times));
  return {
    numerator: base.numerator * addend.denominator + whole * addend.numerator * base.denominator,
    denominator: base.denominator * addend.denominator,
  };
}

/**
 * HEURISTIC (rule `SIZE_FACING_ALLIN_JAM`). Applied only when hero is raising OVER an all-in
 * inside a tree that has not collapsed.
 *
 * The family's own size is kept while it leaves a real stack behind. Once the requested
 * raise-TO reaches the midpoint between hero's current street contribution and the engine's
 * maximum raise-TO, the request becomes the JAM: past that point the raise cannot fold out a
 * stack that is already all-in, and it leaves hero too short to fold to whoever is behind.
 * A request that simply EXCEEDS the maximum needs nothing from this function — `clampSizing`
 * already lowers it to the maximum and degrades the provenance.
 */
export function jamOverAllInSizing(
  request: SizingRequest,
  wager: StrategyWagerOption,
  heroStreetContributionMbb: MilliBB,
): SizingRequest {
  const behind = Money.sub(wager.maxToAmountMbb, heroStreetContributionMbb);
  if (!Money.isPositive(behind)) return request;
  const midpoint = Money.add(heroStreetContributionMbb, Money.mulRatio(behind, 1, 2, 'round'));
  if (Money.lt(request.toAmountMbb, midpoint)) return request;
  return { ruleId: 'SIZE_FACING_ALLIN_JAM', toAmountMbb: wager.maxToAmountMbb };
}

/** HEURISTIC. The 5-bet is a shove at reference depth: request the engine's maximum. */
export function fiveBetShoveSizing(wager: StrategyWagerOption): SizingRequest {
  return { ruleId: 'SIZE_FIVE_BET_SHOVE', toAmountMbb: wager.maxToAmountMbb };
}

/**
 * Total. Applies `LEGALITY_CLAMP`. The result is always inside the engine's bounds; the
 * request that produced it is always retained.
 */
export function clampSizing(request: SizingRequest, wager: StrategyWagerOption): RecommendedSizing {
  const base: Provenance = preflopRule(request.ruleId).provenance;
  const min = wager.minToAmountMbb;
  const max = wager.maxToAmountMbb;
  // The engine can hand back min > max only if it is inconsistent; `Money.clamp` would throw,
  // so the degenerate case collapses to the maximum, which is always legal.
  const clampedRaw: MilliBB = min > max ? max : Money.clamp(request.toAmountMbb, min, max);
  const clamp: SizingClampKind =
    clampedRaw === request.toAmountMbb
      ? 'NONE'
      : clampedRaw > request.toAmountMbb
        ? 'RAISED_TO_MINIMUM'
        : 'LOWERED_TO_MAXIMUM';
  return {
    ruleId: request.ruleId,
    requestedToAmountMbb: request.toAmountMbb,
    toAmountMbb: clampedRaw,
    clamp,
    provenance: clamp === 'NONE' ? base : degrade(base),
    minToAmountMbb: min,
    maxToAmountMbb: max,
  };
}

function degrade(value: Provenance): Provenance {
  if (value === 'SOURCE') return 'DERIVED';
  return 'HEURISTIC';
}
