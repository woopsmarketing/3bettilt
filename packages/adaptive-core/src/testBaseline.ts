/**
 * TEST FIXTURE BUILDERS. Not exported from the package barrel, mirroring
 * `strategy-core/src/preflop/testQuery.ts`: a fixture builder that ships in the public surface
 * becomes a second, undocumented way to construct a domain value.
 *
 * Everything here is a plain constructor over the real DTOs. Nothing mocks a function of this
 * package, and nothing computes a strategy number — the tests assert against literals worked
 * out from the formulas by hand, so a wrong formula cannot make its own test pass.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type { StrategyWagerOption } from '@gto-self/strategy-core';
import type {
  AdaptiveBaseline,
  AdaptiveBaselineAction,
  AdaptiveBaselineSizing,
} from './baseline.js';
import type { AdaptiveOpponentOrdering } from './multiway.js';
import type { AdaptiveStatObservation, AdaptiveOpponentInput } from './inputs.js';
import { buildAdjustmentProfile, type PlayerAdjustmentProfile } from './profile.js';
import type { AdaptiveStatKey } from './stats.js';

/** A 10 BB pot, in milliBB. Every sizing fixture is built against it. */
export const FIXTURE_POT_MBB: MilliBB = Money.mbb(10_000);

/** The engine's legal window in the fixtures: wide enough that a clamp only bites on purpose. */
export const FIXTURE_MIN_TO_MBB: MilliBB = Money.mbb(1_000);
export const FIXTURE_MAX_TO_MBB: MilliBB = Money.mbb(200_000);

/** One learned-model observation. */
export const learned = (
  key: AdaptiveStatKey,
  valueBps: number,
  sampleN: number,
): AdaptiveStatObservation => ({ key, source: 'LEARNED_MODEL', valueBps, sampleN, note: null });

/** One opponent input carrying exactly the observations a test cares about. */
export function opponentInput(
  playerId: string,
  observations: readonly AdaptiveStatObservation[],
  seatIndex = 3,
): AdaptiveOpponentInput {
  return {
    playerId,
    seatIndex,
    nickname: `nick-${playerId}`,
    observations,
    manualHudSnapshotId: null,
    manualHudRecordedAt: null,
    learnedSnapshotId: `model-${playerId}`,
    learnedModelVersion: 1,
    externalHudSnapshotId: null,
    externalHudRecordedAt: null,
  };
}

/** One opponent adjustment profile built from learned observations. */
export const profileOf = (
  playerId: string,
  observations: readonly AdaptiveStatObservation[],
  seatIndex = 3,
): PlayerAdjustmentProfile =>
  buildAdjustmentProfile(opponentInput(playerId, observations, seatIndex));

/** One action row. */
export const action = (
  kind: AdaptiveBaselineAction['kind'],
  frequencyBps: number,
  toAmountMbb: MilliBB | null = null,
  isAllIn = false,
): AdaptiveBaselineAction => ({ kind, frequencyBps, toAmountMbb, isAllIn });

/** A BET sizing on a 10 BB pot, at the given rung of `POT_FRACTION_BUCKETS`. */
export function betSizing(
  bucketIndex: number,
  potFractionPercent: number | null,
  toAmountMbb: number,
): AdaptiveBaselineSizing {
  return {
    kind: 'BET',
    bucketIndex,
    potFractionPercent,
    toAmountMbb: Money.mbb(toAmountMbb),
    minToAmountMbb: FIXTURE_MIN_TO_MBB,
    maxToAmountMbb: FIXTURE_MAX_TO_MBB,
    heroStreetContributionMbb: Money.mbb(0),
    potBeforeDecisionMbb: FIXTURE_POT_MBB,
    callAmountMbb: Money.mbb(0),
    allIn: false,
  };
}

/** The engine's legal wager window matching `betSizing`'s bounds. */
export const FIXTURE_WAGER: StrategyWagerOption = {
  kind: 'BET',
  minToAmountMbb: FIXTURE_MIN_TO_MBB,
  maxToAmountMbb: FIXTURE_MAX_TO_MBB,
  minAdditionalMbb: FIXTURE_MIN_TO_MBB,
  maxAdditionalMbb: FIXTURE_MAX_TO_MBB,
  onlyAllIn: false,
};

/**
 * The default spot: hero on the flop, not facing a bet, heads-up, holding a STRONG hand, with a
 * `CHECK 40% / BET 60%` mix and the engine's 75%-pot rung selected.
 *
 * 4000/6000 is deliberately NOT 5000/5000: a symmetric mix hides sign errors, because moving
 * mass the wrong way produces a set that looks equally plausible.
 */
export function baselineOf(overrides: Partial<AdaptiveBaseline> = {}): AdaptiveBaseline {
  return {
    street: 'FLOP',
    heroFacingBet: false,
    activeOpponentCount: 1,
    aggressionBand: 'STRONG',
    actions: [action('CHECK', 4000), action('BET', 6000, Money.mbb(7_500))],
    primaryKind: 'BET',
    sizing: betSizing(4, 75, 7_500),
    heroIsPreflopOpener: false,
    heroPosition: 'BTN',
    ...overrides,
  };
}

/** One opponent's ordering facts. Defaults to a live opponent acting right after hero. */
export function ordering(
  playerId: string,
  overrides: Partial<AdaptiveOpponentOrdering> = {},
): AdaptiveOpponentOrdering {
  return {
    playerId,
    seatIndex: 3,
    isLive: true,
    actsAfterHero: true,
    isLastAggressorThisStreet: false,
    actionOrderIndex: 0,
    ...overrides,
  };
}
