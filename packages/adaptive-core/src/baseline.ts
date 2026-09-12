/**
 * The NEUTRAL BASELINE: the REFERENCE engine's answer, flattened into a value.
 *
 * This is the other half of the input pair (`inputs.ts` is the opponent half). Everything the
 * policy layer is allowed to know about the SPOT arrives here, already computed by the
 * REFERENCE engine and already legal. Nothing in this package re-derives any of it.
 *
 * ---------------------------------------------------------------------------------------
 * WHY A FLATTENED DTO AND NOT `PostflopRecommendation` ITSELF
 *
 * The invariant the whole WP exists to protect is that `computeStrategy(state, heroSeat)` is
 * byte-identical whatever the player data is. Taking a `HandState` here — or anything that
 * could be used to recompute one — would make that invariant a convention rather than a
 * structural fact. `adaptive-core` cannot import `poker-core` (the layering test enforces it),
 * so a baseline can only ever arrive as data that has already been decided.
 *
 * It also means ADAPTIVE composes over BOTH streets' recommendation shapes without knowing
 * which produced it: preflop's `RecommendedAction[]` and postflop's `PostflopAction[]` both
 * flatten into `AdaptiveBaselineAction[]`, and the caller in `apps/web` owns that mapping.
 *
 * THE AGGRESSION BAND IS READ, NEVER RE-DERIVED. `aggressionBand` is copied verbatim out of
 * the REFERENCE result's own `scoring.aggressionBand.id`. This package holds no board
 * analysis, no equity, no ranges and no scoring model, so it has no way to compute a band and
 * must not acquire one: a second, drifting notion of "how strong is hero here" is exactly the
 * duplicate system CLAUDE.md's working agreement 7 forbids. `null` means "no band was
 * supplied" (preflop, or an unsupported spot), and every band-conditional rule simply does
 * not fire.
 * ---------------------------------------------------------------------------------------
 */
import type { MilliBB } from '@gto-self/shared';
import type {
  AggressionBandId,
  StrategyActionKind,
  StrategyPosition,
} from '@gto-self/strategy-core';

/** The four streets a baseline can describe. `PREFLOP` carries no aggression band. */
export type AdaptiveStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

/** The three streets on which the street-scoped stats (`*_FLOP`/`_TURN`/`_RIVER`) exist. */
export type AdaptivePostflopStreet = Exclude<AdaptiveStreet, 'PREFLOP'>;

/**
 * What a rule is allowed to push mass toward.
 *
 * Three targets rather than six action kinds, because a rule expresses a POKER READ ("this
 * opponent folds too much, so bet more"), and a read is about escalating, continuing or
 * giving up — not about whether the escalation is spelled `BET` or `RAISE`. Which kinds a
 * target owns is `ADAPTIVE_TARGET_BY_ACTION_KIND` below, and it is the only place the two
 * vocabularies meet.
 */
export type AdaptiveTarget = 'AGGRESSION' | 'CONTINUE' | 'FOLD';

/** Every member, in the order targets are summed and applied. Fixes output determinism. */
export const ADAPTIVE_TARGETS: readonly AdaptiveTarget[] = ['AGGRESSION', 'CONTINUE', 'FOLD'];

/**
 * Which target each of `strategy-core`'s six action kinds belongs to. EXHAUSTIVE over
 * `StrategyActionKind`, so a seventh action kind is a compile error here rather than a silent
 * hole in the middle of the frequency arithmetic.
 *
 * `ALL_IN` is AGGRESSION. That is a judgement and it is worth stating: an all-in that merely
 * CALLS a shove is, in the engine's own vocabulary, a `CALL` with `isAllIn` set — the `ALL_IN`
 * kind is only ever emitted for a shove that raises the price (`StrategyActionRecord.
 * isAggressive` uses the same test). So the kind is aggressive by construction and putting it
 * with `CALL` would let a rule that says "bet more against this opponent" quietly shift mass
 * onto a passive line.
 *
 * `CHECK` is CONTINUE rather than a fourth target: checking and calling are both "stay in the
 * hand without escalating", and hero can never legally have both available at once, so a rule
 * that wants to de-escalate has exactly one place to put the mass on any given street.
 */
export const ADAPTIVE_TARGET_BY_ACTION_KIND: Readonly<Record<StrategyActionKind, AdaptiveTarget>> =
  {
    FOLD: 'FOLD',
    CHECK: 'CONTINUE',
    CALL: 'CONTINUE',
    BET: 'AGGRESSION',
    RAISE: 'AGGRESSION',
    ALL_IN: 'AGGRESSION',
  };

/**
 * Hero's hand strength, coarsened from the REFERENCE engine's seven-band scale to the three
 * categories a player-read rule can meaningfully condition on.
 *
 * WHY COARSEN AT ALL. A rule like "this opponent never folds, so stop bluffing" is about
 * whether hero is betting for value, betting thin, or betting with nothing. Conditioning it on
 * seven bands would make the rule table 3x larger and would assert a precision the read does
 * not have: nothing about a `FOLD_TO_CBET` reading distinguishes `WEAK` from `POOR`.
 */
export type AdaptiveStrengthCategory = 'VALUE' | 'MARGINAL' | 'WEAK';

/** Every member, in descending strength. */
export const ADAPTIVE_STRENGTH_CATEGORIES: readonly AdaptiveStrengthCategory[] = [
  'VALUE',
  'MARGINAL',
  'WEAK',
];

/**
 * The REFERENCE engine's own `AggressionBandId` mapped onto the three categories.
 *
 * EXHAUSTIVE over `AggressionBandId`, deliberately: `strategy-core` owns that union, and if it
 * ever gains an eighth band this file must fail to compile rather than silently treat the new
 * band as absent. The mapping is `VALUE = DOMINANT|STRONG`, `MARGINAL = MODERATE|NEUTRAL`,
 * `WEAK = WEAK|POOR|GIVE_UP`, taken verbatim from the WP-J design contract §4.1.
 *
 * Note that the boundaries are the engine's, not ours: `AGGRESSION_BANDS` already places the
 * split between "clear edge on most axes" (STRONG, 8000 bps aggression) and "middling"
 * (MODERATE), and between middling and "bluff or give up" (WEAK). We are grouping the engine's
 * declared bands, not re-cutting them at a threshold of our own.
 */
export const ADAPTIVE_STRENGTH_BY_BAND: Readonly<
  Record<AggressionBandId, AdaptiveStrengthCategory>
> = {
  DOMINANT: 'VALUE',
  STRONG: 'VALUE',
  MODERATE: 'MARGINAL',
  NEUTRAL: 'MARGINAL',
  WEAK: 'WEAK',
  POOR: 'WEAK',
  GIVE_UP: 'WEAK',
};

/**
 * Total. The strength category for a band, or `null` when the caller supplied no band.
 *
 * `null` in, `null` out — never a default category. A missing band means "we were not told",
 * and inventing `MARGINAL` for it would let every band-conditional rule fire preflop, where
 * the engine has no band at all.
 */
export const strengthCategoryFor = (
  band: AggressionBandId | null,
): AdaptiveStrengthCategory | null => (band === null ? null : ADAPTIVE_STRENGTH_BY_BAND[band]);

/**
 * One action row of the REFERENCE answer, stripped to what the composition needs.
 *
 * `frequencyBps` is a multiple of 500 and the set sums to 10000, because the REFERENCE engine
 * guarantees that. This package re-establishes both properties on its OWN output through
 * `quantizeFrequencies`; it does not assert them on the input, because a caller that hands
 * over a malformed set should get a normalized answer rather than an exception (the compose
 * entry point is total).
 */
export interface AdaptiveBaselineAction {
  readonly kind: StrategyActionKind;
  /** A multiple of 500 in the REFERENCE output; the set sums to 10000. */
  readonly frequencyBps: number;
  /** Raise-TO semantics — hero's street contribution AFTER acting. `null` for fold/check. */
  readonly toAmountMbb: MilliBB | null;
  readonly isAllIn: boolean;
}

/**
 * The REFERENCE engine's chosen size, plus every money fact needed to move it one rung and
 * still land on a legal amount.
 *
 * The last four fields are exactly `potFractionToAmount`'s inputs plus the engine's legal
 * window. They are carried on the baseline rather than recomputed for the same reason the
 * band is: this package has no `PostflopContext` and must never grow one.
 */
export interface AdaptiveBaselineSizing {
  readonly kind: 'BET' | 'RAISE';
  /** Index into `POT_FRACTION_BUCKETS`, or `-1` when the engine chose ALL_IN. */
  readonly bucketIndex: number;
  /** The bucket's display percent, or `null` for ALL_IN. Presentation only. */
  readonly potFractionPercent: number | null;
  readonly toAmountMbb: MilliBB;
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
  readonly heroStreetContributionMbb: MilliBB;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  readonly allIn: boolean;
}

/**
 * Everything the ADAPTIVE layer is allowed to know about the SPOT.
 *
 * ---------------------------------------------------------------------------------------
 * CALLER-SUPPLIED FACTS, NEVER DERIVED HERE
 *
 * `heroIsPreflopOpener` and `heroPosition` are additions to the WP-J design contract §4.1
 * shape, and they exist for the same reason §9 requires the multiway ordering to be supplied:
 * three of the twelve frequency rules are scoped to a PREFLOP spot family ("hero opening",
 * "hero opening from CO/BTN/SB"), and this package cannot compute a spot family without
 * poker-order knowledge it is forbidden from holding. Deriving "opening" as
 * `street === 'PREFLOP' && !heroFacingBet` would be inventing poker behaviour (CLAUDE.md rule
 * 7): a big blind checking behind limpers satisfies that expression and is not an open.
 *
 * The caller — `apps/web`, which already has the REFERENCE engine's `PreflopSpotFamily` and
 * `heroPosition` in hand — states both facts explicitly. A caller that does not know supplies
 * `false` / `null`, and the three rules simply never fire.
 * ---------------------------------------------------------------------------------------
 */
export interface AdaptiveBaseline {
  readonly street: AdaptiveStreet;
  /** Hero has a live bet to call. Drives both the rule scope and the PRIMARY villain choice. */
  readonly heroFacingBet: boolean;
  /** Opponents still live in the hand. `<= 1` is heads-up for every cap and gate below. */
  readonly activeOpponentCount: number;
  /** POSTFLOP ONLY: the REFERENCE engine's OWN band, read from its `scoring.aggressionBand.id`. */
  readonly aggressionBand: AggressionBandId | null;
  readonly actions: readonly AdaptiveBaselineAction[];
  readonly primaryKind: StrategyActionKind;
  readonly sizing: AdaptiveBaselineSizing | null;
  /** Caller-supplied: hero's decision is a preflop raise-first-in. See the block comment. */
  readonly heroIsPreflopOpener: boolean;
  /** Caller-supplied: hero's position, or `null` when the caller has none. */
  readonly heroPosition: StrategyPosition | null;
}

/**
 * Total. The target a baseline action belongs to. Total because the record above is exhaustive
 * over the action-kind union, so the lookup cannot miss.
 */
export const targetForKind = (kind: StrategyActionKind): AdaptiveTarget =>
  ADAPTIVE_TARGET_BY_ACTION_KIND[kind];

/**
 * Total. `true` when the baseline offers hero at least one AGGRESSION-target action.
 *
 * "Hero may bet or raise" is a property of the ACTION SET the engine emitted, not something
 * re-derived from legality: if REFERENCE gave no aggressive row, ADAPTIVE must not conjure
 * one, so a rule that pushes mass toward aggression has nowhere to put it and must not fire.
 */
export const heroMayAggress = (baseline: AdaptiveBaseline): boolean =>
  baseline.actions.some((action) => targetForKind(action.kind) === 'AGGRESSION');

/**
 * Total. `true` when hero is the one who would be BETTING into the opponent — an aggressive
 * action is available and hero is not facing a bet.
 *
 * This is the scope of every rule about how the opponent responds to hero's bet
 * (`CHECK_RAISE_*`, and the `WTSD` bluff/value rules). Facing a bet, hero's aggression is a
 * RAISE and the opponent has already acted, so "how often does this player check-raise" is no
 * longer the question in front of hero.
 */
export const heroMayBet = (baseline: AdaptiveBaseline): boolean =>
  !baseline.heroFacingBet && heroMayAggress(baseline);

/** Total. `true` when the spot is one of the three postflop streets. */
export const isPostflopStreet = (street: AdaptiveStreet): street is AdaptivePostflopStreet =>
  street !== 'PREFLOP';
