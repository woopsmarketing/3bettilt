/**
 * Range propagation: what every seat's range looks like at the end of preflop.
 *
 * The postflop work needs, for each player still in the hand, the set of holdings consistent
 * with the line they took. This module produces exactly that by REPLAYING the preflop action
 * list through the same `classPolicy` the recommendation uses — there is no second copy of
 * the strategy, so a table edit moves both at once.
 *
 * Method, per action in engine order:
 *
 *   1. Rebuild the query AS IT WAS at that decision point (prefix of the action list, seat
 *      statuses and street contributions recomputed) with the acting seat as hero, and run it
 *      through the SAME `classifyPreflopSpot` the rest of the package uses. Re-deriving the
 *      family locally would be a second classifier that could drift.
 *   2. Ask `classPolicy` for that spot's fold/call/raise mix for all 169 classes.
 *   3. Expand the bucket the action actually falls into to per-combo frequencies and apply it
 *      with `applyActionStrategy` (`range/weights.ts`).
 *
 * A CHECK is the complement of the raise bucket (`10000 - raiseBps`): checking is what the
 * policy's fold AND call mass both do when continuing is free, so conditioning on a check
 * must not throw the call mass away.
 *
 * NOT RENORMALIZED, deliberately, matching `applyActionStrategy`'s documented contract: the
 * weights are "how much of this combo survives the line", and rescaling them would hide how
 * much of a starting range a line actually represents. Call `normalizeRange` explicitly if a
 * consumer wants relative frequencies.
 *
 * OFF-POLICY ACTIONS: a player may take a line the reference policy assigns zero frequency
 * (an SB limp, when the policy is raise-or-fold). Conditioning on it would produce the empty
 * range, which asserts the player can hold nothing — false. The honest update is no update:
 * the range is carried forward unchanged and the seat is flagged `offPolicy`, so a consumer
 * can see that this seat's range is uninformative rather than narrow.
 *
 * CARD REMOVAL: hero's known cards are removed from every OTHER seat's range (nobody else can
 * hold them) and never from hero's own. The board is empty preflop by definition.
 */
import { Money, ok, type Card, type MilliBB } from '@gto-self/shared';
import { asBps, BPS_TOTAL, type Bps } from '../bps.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import { type ComboIndex } from '../range/combo.js';
import { handClassIndexOfCombo, type HandClassIndex } from '../range/handClass.js';
import {
  applyActionStrategy,
  comboFrequenciesFrom,
  removeConflicts,
  totalWeightBps,
  uniformRange,
  type RangeWeights,
} from '../range/weights.js';
import type {
  StrategyActionRecord,
  StrategyPosition,
  StrategyQuery,
  StrategySeatProfile,
} from '../types.js';
import { classPolicy, type PreflopPolicyContext } from './policy.js';
import { classifyPreflopSpot } from './spot.js';

export type PropagatedSeatStatus = 'IN_HAND' | 'FOLDED' | 'ALL_IN';

export interface PropagatedRange {
  readonly position: StrategyPosition;
  readonly status: PropagatedSeatStatus;
  readonly isHero: boolean;
  /** Weights in basis points, one per combo. Not renormalized (see the module note). */
  readonly range: RangeWeights;
  /** Actions this seat took preflop, in engine order — the audit trail for the range. */
  readonly actionKinds: readonly string[];
  /**
   * True when at least one of this seat's actions is one the reference policy assigns zero
   * frequency to in that spot (an SB limp, say, in a raise-or-fold policy). Conditioning on
   * such an action would empty the range, which is not "this player has no hands" but "this
   * model cannot narrow them" — so the range is left UNCHANGED at that step and this flag is
   * raised. A consumer must treat a flagged range as uninformative, not as a read.
   */
  readonly offPolicy: boolean;
}

export interface PreflopRangeAssignment {
  readonly kind: 'PreflopRangeAssignment';
  /** One entry per dealt-in seat, ordered by preflop order. */
  readonly seats: readonly PropagatedRange[];
  /** Cards removed from every non-hero range. Empty when hero's holding is unknown. */
  readonly removedCards: readonly Card[];
}

export interface PropagateOptions {
  /**
   * Remove hero's known cards from every other seat's range. Default true. Turn it off to
   * inspect the policy's ranges in a vacuum (that is what the table tests do).
   */
  readonly applyHeroCardRemoval?: boolean;
}

/** Which of the policy's three buckets an action conditions on. */
type Bucket = 'FOLD' | 'CALL' | 'RAISE' | 'NOT_RAISE';

function bucketOf(action: StrategyActionRecord): Bucket {
  switch (action.kind) {
    case 'FOLD':
      return 'FOLD';
    case 'CHECK':
      return 'NOT_RAISE';
    case 'CALL':
      return 'CALL';
    case 'BET':
    case 'RAISE':
      return 'RAISE';
    case 'ALL_IN':
      return action.isAggressive ? 'RAISE' : 'CALL';
  }
}

function frequencyFor(ctx: PreflopPolicyContext, index: HandClassIndex, bucket: Bucket): number {
  const outcome = classPolicy(ctx, index);
  switch (bucket) {
    case 'FOLD':
      return outcome.frequencies.foldBps;
    case 'CALL':
      return outcome.frequencies.callBps;
    case 'RAISE':
      return outcome.frequencies.raiseBps;
    case 'NOT_RAISE':
      return BPS_TOTAL - outcome.frequencies.raiseBps;
  }
}

interface ReplayState {
  /** Street contributions in integer milliBB — the money brand is kept for the whole replay. */
  readonly contributions: Map<StrategyPosition, MilliBB>;
  readonly folded: Set<StrategyPosition>;
  readonly allIn: Set<StrategyPosition>;
}

function initialState(query: StrategyQuery): ReplayState {
  const contributions = new Map<StrategyPosition, MilliBB>();
  for (const seat of query.seats) {
    const blind: MilliBB =
      seat.blindRole === 'SB'
        ? query.environment.smallBlindMbb
        : seat.blindRole === 'BB'
          ? query.environment.bigBlindMbb
          : Money.ZERO;
    contributions.set(seat.position, blind);
  }
  return { contributions, folded: new Set(), allIn: new Set() };
}

/**
 * The query as it stood before `actor` acted, with `actor` as hero. Only the fields
 * `classifyPreflopSpot` reads are recomputed; everything else is carried through unchanged,
 * because a spot classification never looks at them.
 */
function queryBefore(
  query: StrategyQuery,
  prefix: readonly StrategyActionRecord[],
  actor: StrategyPosition,
  state: ReplayState,
): StrategyQuery {
  const seats: StrategySeatProfile[] = query.seats.map((seat) => ({
    ...seat,
    isHero: seat.position === actor,
    status: state.folded.has(seat.position)
      ? 'FOLDED'
      : state.allIn.has(seat.position)
        ? 'ALL_IN'
        : 'IN_HAND',
    streetContributionMbb: state.contributions.get(seat.position) ?? Money.ZERO,
  }));
  // Integer milliBB through `Money.*`, never raw arithmetic on branded values (MINOR-2).
  const currentBet: MilliBB = [...state.contributions.values()].reduce<MilliBB>(
    (highest, value) => Money.max(highest, value),
    Money.ZERO,
  );
  const actorContribution = state.contributions.get(actor) ?? Money.ZERO;
  const callAmount: MilliBB = Money.max(Money.ZERO, Money.sub(currentBet, actorContribution));
  const activeOpponents = seats.filter(
    (seat) => seat.position !== actor && seat.status !== 'FOLDED',
  ).length;
  const actorSeat = seats.find((seat) => seat.position === actor);
  return {
    ...query,
    heroPosition: actor,
    heroSeatIndex: actorSeat?.seatIndex ?? query.heroSeatIndex,
    seats,
    actions: prefix,
    currentBetMbb: currentBet,
    callAmountMbb: callAmount,
    callToAmountMbb: currentBet,
    activeOpponentCount: activeOpponents,
    legalActions: legalActionsBefore(query, actorSeat, callAmount, currentBet),
  };
}

/**
 * The one legality fact `classifyPreflopSpot` reads: could this actor put in MORE than a
 * call? The live query carries the engine's own answer, but a RECONSTRUCTED decision point
 * cannot — the engine was never asked about it — so the availability is derived from the
 * actor's own stack, which is the same thing the engine's wager bound is computed from.
 *
 * Everything else in `StrategyLegalActions` is carried through unchanged: nothing on the
 * propagation path reads it, and inventing bounds the engine never stated would be worse
 * than reusing the shape. Only `wager`/`allIn` presence is corrected.
 */
function legalActionsBefore(
  query: StrategyQuery,
  actorSeat: StrategySeatProfile | undefined,
  callAmountMbb: MilliBB,
  currentBetMbb: MilliBB,
): StrategyQuery['legalActions'] {
  if (actorSeat === undefined) return query.legalActions;
  // Preflop there is no earlier street, so this IS the actor's remaining stack.
  const remaining = Money.sub(actorSeat.startingStackMbb, actorSeat.streetContributionMbb);
  const canRaise = Money.gt(remaining, callAmountMbb);
  const allInTo = Money.add(actorSeat.streetContributionMbb, remaining);
  return {
    ...query.legalActions,
    canCheck: !Money.isPositive(callAmountMbb),
    call: Money.isPositive(callAmountMbb)
      ? {
          toAmountMbb: currentBetMbb,
          amountMbb: Money.min(callAmountMbb, remaining),
          isAllIn: Money.gte(callAmountMbb, remaining),
        }
      : null,
    wager: canRaise
      ? {
          kind: 'RAISE',
          minToAmountMbb: Money.min(allInTo, Money.add(currentBetMbb, currentBetMbb)),
          maxToAmountMbb: allInTo,
          minAdditionalMbb: Money.sub(
            Money.min(allInTo, Money.add(currentBetMbb, currentBetMbb)),
            actorSeat.streetContributionMbb,
          ),
          maxAdditionalMbb: remaining,
          onlyAllIn: Money.lt(allInTo, Money.add(currentBetMbb, currentBetMbb)),
        }
      : null,
    allIn: Money.isPositive(remaining)
      ? { toAmountMbb: allInTo, amountMbb: remaining, effect: canRaise ? 'RAISE' : 'CALL' }
      : null,
  };
}

function contextFor(reduced: StrategyQuery): PreflopPolicyContext {
  const spot = classifyPreflopSpot(reduced);
  if (spot.kind === 'SPOT') {
    return {
      family: spot.family,
      unsupportedReason: null,
      heroPosition: spot.heroPosition,
      openerPosition: spot.openerPosition,
      heroVsAggressor: spot.heroVsAggressor,
      blindVsBlind: spot.blindVsBlind,
      limperCount: spot.limperCount,
      coldCallerCount: spot.coldCallerCount,
      lineupSize: spot.lineupSize,
      potOdds: potOddsOf(reduced),
      facingAllIn: spot.facingAllIn,
    };
  }
  return {
    family: 'UNSUPPORTED',
    unsupportedReason: spot.reason,
    heroPosition: spot.heroPosition,
    openerPosition: null,
    heroVsAggressor: null,
    blindVsBlind: false,
    limperCount: 0,
    coldCallerCount: 0,
    lineupSize: reduced.dealtInCount,
    potOdds: potOddsOf(reduced),
    facingAllIn: false,
  };
}

/**
 * `call / (pot + call)` recomputed for the reconstructed decision point, because the query's
 * own `potOdds` describes the CURRENT point, not the historical one. A ratio, never money.
 */
function potOddsOf(reduced: StrategyQuery): number | null {
  const call = reduced.callAmountMbb;
  if (!Money.isPositive(call)) return null;
  // The DIVISION is the ratio (CLAUDE.md rule 1 permits a plain number there); everything
  // above it stays integer milliBB through `Money.*` (R1 MINOR-2).
  const denominator = Money.add(potBefore(reduced), call);
  if (!Money.isPositive(denominator)) return null;
  return call / denominator;
}

function potBefore(reduced: StrategyQuery): MilliBB {
  return Money.add(
    reduced.environment.deadMoneyMbb,
    Money.sum(reduced.seats.map((seat) => seat.streetContributionMbb)),
  );
}

/**
 * Result. Every dealt-in seat's range at the point the query describes.
 *
 * Refuses a non-preflop query (`NOT_A_DECISION_POINT`); everything else is answered, because
 * an unmodelled line still has a documented fallback policy and therefore still has a range.
 */
export function propagatePreflopRanges(
  query: StrategyQuery,
  options: PropagateOptions = {},
): StrategyResult<PreflopRangeAssignment> {
  if (query.street !== 'PREFLOP') {
    return strategyErr(
      'NOT_A_DECISION_POINT',
      'Preflop range propagation was asked about a later street',
      { street: query.street },
    );
  }
  const removeHeroCards = options.applyHeroCardRemoval !== false && query.heroCards.length === 2;
  const removedCards: readonly Card[] = removeHeroCards ? [...query.heroCards] : [];
  const heroPosition = query.heroPosition;

  const ranges = new Map<StrategyPosition, RangeWeights>();
  const takenKinds = new Map<StrategyPosition, string[]>();
  for (const seat of query.seats) {
    const start = uniformRange();
    ranges.set(
      seat.position,
      seat.position === heroPosition || removedCards.length === 0
        ? start
        : removeConflicts(start, removedCards),
    );
    takenKinds.set(seat.position, []);
  }

  const state = initialState(query);
  const offPolicy = new Set<StrategyPosition>();
  const acts = query.actions.filter((action) => action.street === 'PREFLOP');
  for (let i = 0; i < acts.length; i += 1) {
    const action = acts[i];
    if (action === undefined) continue;
    const reduced = queryBefore(query, acts.slice(0, i), action.position, state);
    const ctx = contextFor(reduced);
    const bucket = bucketOf(action);

    const byClass = new Int32Array(169);
    for (let index = 0; index < 169; index += 1) {
      byClass[index] = frequencyFor(ctx, index as HandClassIndex, bucket);
    }
    const frequencies = comboFrequenciesFrom((combo: ComboIndex) =>
      Math.max(0, byClass[handClassIndexOfCombo(combo)] ?? 0),
    );
    const prior = ranges.get(action.position);
    if (prior !== undefined) {
      const next = applyActionStrategy(prior, frequencies);
      if (totalWeightBps(next) === 0 && totalWeightBps(prior) > 0) {
        // The action is outside the policy's support. Conditioning would claim the player
        // cannot hold anything, which is false; the honest update is no update at all.
        offPolicy.add(action.position);
      } else {
        ranges.set(action.position, next);
      }
    }
    takenKinds.get(action.position)?.push(action.kind);

    // Advance the replay state AFTER the decision it describes.
    if (action.kind === 'FOLD') state.folded.add(action.position);
    if (action.isAllIn) state.allIn.add(action.position);
    if (action.toAmountMbb !== null) {
      state.contributions.set(action.position, action.toAmountMbb);
    }
  }

  const seats: PropagatedRange[] = query.seats.map((seat) => {
    const range = ranges.get(seat.position);
    return {
      position: seat.position,
      status: state.folded.has(seat.position)
        ? 'FOLDED'
        : state.allIn.has(seat.position)
          ? 'ALL_IN'
          : 'IN_HAND',
      isHero: seat.position === heroPosition,
      range: range ?? uniformRange(),
      actionKinds: takenKinds.get(seat.position) ?? [],
      offPolicy: offPolicy.has(seat.position),
    };
  });

  return ok({ kind: 'PreflopRangeAssignment', seats, removedCards });
}

/**
 * Total. The range a single canonical spot's policy assigns to one action bucket, in a
 * vacuum (no card removal, uniform prior). Useful for charting a table and for asserting a
 * propagation invariant without replaying a hand.
 */
export function policyRangeFor(
  ctx: PreflopPolicyContext,
  bucket: 'FOLD' | 'CALL' | 'RAISE',
): RangeWeights {
  const byClass = new Int32Array(169);
  for (let index = 0; index < 169; index += 1) {
    byClass[index] = frequencyFor(ctx, index as HandClassIndex, bucket);
  }
  const frequencies = comboFrequenciesFrom((combo: ComboIndex) =>
    Math.max(0, byClass[handClassIndexOfCombo(combo)] ?? 0),
  );
  return applyActionStrategy(uniformRange(), frequencies);
}

/** Total. The policy's frequency, in bps, for one class and one bucket. */
export function policyFrequencyBps(
  ctx: PreflopPolicyContext,
  index: HandClassIndex,
  bucket: 'FOLD' | 'CALL' | 'RAISE',
): Bps {
  return asBps(frequencyFor(ctx, index, bucket));
}
