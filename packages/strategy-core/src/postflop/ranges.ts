/**
 * The postflop RANGE MODEL: what every live seat can hold when hero is on the clock.
 *
 * ---------------------------------------------------------------------------------------
 * THE DECISION THIS FILE MAKES, STATED PLAINLY
 *
 * The work package offered two options for postflop actions that have already happened this
 * hand: (a) narrow every range by applying this policy's own frequencies, or (b) carry the
 * end-of-preflop ranges forward unchanged behind an explicit typed flag.
 *
 * **This package chose (b).** Rule `VILLAIN_RANGE_NOT_NARROWED`.
 *
 * Why, in three parts:
 *
 *  1. IT IS CIRCULAR. This policy's inputs are RANGE-level (range advantage, nut advantage,
 *     hero's rank within hero's own range). To narrow villain's range by villain's policy,
 *     the policy must first be evaluated for villain — which needs villain's range advantage,
 *     which needs villain's range. That is a fixed point, not a computation, and nothing here
 *     guarantees it converges. Breaking the cycle by evaluating villain's policy against
 *     UNNARROWED ranges would just be option (b) with an extra step and a misleading label.
 *  2. IT IS UNAFFORDABLE. Even the broken-cycle version costs one full policy evaluation per
 *     prior postflop action, each dominated by a range-vs-range equity pass (B2 measures ~65 ms
 *     on a flop). A three-action flop would blow the work package's own ~200 ms budget several
 *     times over.
 *  3. THE HONEST PRECEDENT ALREADY EXISTS. A3 settled exactly this shape for preflop actions
 *     the policy assigns zero frequency: "an action the model cannot condition on carries no
 *     information; leave the range alone and FLAG it". A range that has been narrowed by a
 *     model that does not really know how villain plays is worse than an unnarrowed one,
 *     because it looks like a read.
 *
 * The flag is not decorative. `postflopActionCount > 0` surfaces a
 * `VILLAIN_RANGE_NARROWING: NOT_APPLIED` explanation feature, adds
 * `VILLAIN_RANGE_NOT_NARROWED` to the recommendation's rule ids, and costs a confidence step.
 * The scoring model does read the street's action history (the `STREET_ACTION` component), but
 * that is an authored aggression nudge with weight 1 of 26 — it changes no range weight.
 * ---------------------------------------------------------------------------------------
 *
 * Everything else here is mechanical: A3's `propagatePreflopRanges` is called on the hand's
 * preflop prefix, the board is removed from every range (nobody holds a board card), and
 * folded seats are dropped.
 */
import { ok, type Card } from '@gto-self/shared';
import { strategyErr, type StrategyResult } from '../errors.js';
import { propagatePreflopRanges } from '../preflop/propagate.js';
import {
  removeConflicts,
  totalWeightBps,
  uniformRange,
  type RangeWeights,
} from '../range/weights.js';
import type { StrategyPosition, StrategyQuery, StrategySeatStatus } from '../types.js';

export interface PostflopSeatRange {
  readonly position: StrategyPosition;
  readonly isHero: boolean;
  readonly status: StrategySeatStatus;
  /** Not renormalized, matching A3's contract: weights are "how much survives the line". */
  readonly range: RangeWeights;
  readonly totalWeightBps: number;
  /** Actions this seat took PREFLOP, in engine order — the audit trail for the range. */
  readonly preflopActionKinds: readonly string[];
  /** A3's flag: this seat took a preflop line the reference policy never takes. */
  readonly offPolicy: boolean;
  /**
   * The propagated range had no live combo once the board was removed, so the UNIFORM range
   * minus the known cards was substituted. Reachable only from an already-degenerate
   * propagation; carried so nothing downstream divides by zero silently.
   */
  readonly degenerate: boolean;
}

export interface PostflopRangeModel {
  readonly hero: PostflopSeatRange;
  /** Live opponents, ordered by postflop order. Never empty (the caller checks first). */
  readonly villains: readonly PostflopSeatRange[];
  /** The villain the range-level measurements are taken against. See `primaryVillainOf`. */
  readonly primaryVillain: PostflopSeatRange;
  /** Always `false`. See the module note — this is the typed flag, not an aspiration. */
  readonly narrowingApplied: false;
  /** Postflop voluntary actions taken before hero's decision that were NOT conditioned on. */
  readonly postflopActionCount: number;
  /**
   * Of those, the BETS and RAISES. Tracked separately because they are the ones that would
   * genuinely have narrowed a range: a check is the least informative action in poker, and
   * every range built here already contains the hands that would check.
   */
  readonly postflopAggressionCount: number;
  readonly anyOffPolicy: boolean;
  /** Cards removed from every non-hero range: hero's holding plus the board. */
  readonly removedCards: readonly Card[];
}

/**
 * The villain the range-vs-range measurements run against, deterministically:
 *   1. the current street's aggressor, if that seat is a live opponent;
 *   2. else the previous street's aggressor, if live;
 *   3. else the live opponent with the lowest postflop order.
 *
 * One villain rather than all of them because range-vs-range equity is the single most
 * expensive call in the policy and running it five times would blow the latency budget. The
 * ordering picks the opponent whose betting the action most constrains.
 */
export function primaryVillainOf(
  villains: readonly PostflopSeatRange[],
  currentStreetAggressor: StrategyPosition | null,
  previousStreetAggressor: StrategyPosition | null,
): PostflopSeatRange {
  const byPosition = (position: StrategyPosition | null): PostflopSeatRange | undefined =>
    position === null ? undefined : villains.find((seat) => seat.position === position);
  const chosen = byPosition(currentStreetAggressor) ?? byPosition(previousStreetAggressor);
  if (chosen !== undefined) return chosen;
  const first = villains[0];
  if (first === undefined) throw new Error('primaryVillainOf needs at least one villain');
  return first;
}

/**
 * Result. Every live seat's range on this board.
 *
 * Refuses a preflop query (that is A3's job) and a hand with no live opponent — both as
 * `NOT_A_DECISION_POINT`, because `errors.ts` is a shared file outside this work package's
 * boundary and its existing vocabulary already covers "there is no decision here". Everything
 * else is answered: an unmodelled preflop line still has A3's documented fallback policy and
 * therefore still has a range.
 */
export function buildPostflopRanges(query: StrategyQuery): StrategyResult<PostflopRangeModel> {
  if (query.street === 'PREFLOP') {
    return strategyErr(
      'NOT_A_DECISION_POINT',
      'The postflop range model was asked about the preflop street',
      { street: query.street },
    );
  }
  if (query.activeOpponentCount === 0) {
    return strategyErr('NOT_A_DECISION_POINT', 'No opponent is left in the hand', {
      street: query.street,
    });
  }

  // A3's propagation is a preflop function, so it is handed the hand's preflop prefix with the
  // street rewound. Nothing else about the query changes: seat ladder, blinds, stacks and
  // hero's identity are all carried through, and `propagatePreflopRanges` recomputes the seat
  // statuses and street contributions it needs from the action list itself.
  const preflopActions = query.actions.filter((action) => action.street === 'PREFLOP');
  const preflopQuery: StrategyQuery = {
    ...query,
    street: 'PREFLOP',
    board: [],
    actions: preflopActions,
  };
  const propagated = propagatePreflopRanges(preflopQuery);
  if (!propagated.ok) return propagated;

  const board = query.board;
  const knownCards: readonly Card[] = [...query.heroCards, ...board];
  const heroPosition = query.heroPosition;

  const statusOf = new Map<StrategyPosition, StrategySeatStatus>(
    query.seats.map((seat) => [seat.position, seat.status]),
  );
  const postflopOrderOf = new Map<StrategyPosition, number>(
    query.seats.map((seat) => [seat.position, seat.postflopOrder]),
  );

  const fallbackRange = (isHero: boolean): RangeWeights =>
    removeConflicts(uniformRange(), isHero ? board : knownCards);

  const build = (
    position: StrategyPosition,
    propagatedRange: RangeWeights,
    offPolicy: boolean,
    preflopActionKinds: readonly string[],
  ): PostflopSeatRange => {
    const isHero = position === heroPosition;
    // The board is removed from EVERY range, hero's included: nobody holds a board card.
    // Hero's own two cards are already absent from the other seats' ranges (A3 removes them
    // during propagation) and must never be removed from hero's own.
    let range = removeConflicts(propagatedRange, board);
    let degenerate = false;
    if (totalWeightBps(range) === 0) {
      range = fallbackRange(isHero);
      degenerate = true;
    }
    return {
      position,
      isHero,
      status: statusOf.get(position) ?? 'IN_HAND',
      range,
      totalWeightBps: totalWeightBps(range),
      preflopActionKinds,
      offPolicy,
      degenerate,
    };
  };

  let hero: PostflopSeatRange | null = null;
  const villains: PostflopSeatRange[] = [];
  for (const seat of propagated.value.seats) {
    const status = statusOf.get(seat.position) ?? 'IN_HAND';
    const built = build(seat.position, seat.range, seat.offPolicy, seat.actionKinds);
    if (seat.position === heroPosition) {
      hero = built;
      continue;
    }
    // A seat that folded at ANY point — preflop or on an earlier postflop street — is out.
    if (status === 'FOLDED') continue;
    villains.push(built);
  }

  if (hero === null) {
    return strategyErr('HERO_NOT_DEALT_IN', 'Hero has no seat in the propagated assignment', {
      field: 'heroPosition',
      value: heroPosition,
    });
  }
  if (villains.length === 0) {
    return strategyErr('NOT_A_DECISION_POINT', 'Every opponent has folded', {
      street: query.street,
    });
  }
  villains.sort(
    (a, b) => (postflopOrderOf.get(a.position) ?? 0) - (postflopOrderOf.get(b.position) ?? 0),
  );

  const currentAggressor = query.lastAggressorByStreet[query.street];
  const previousStreet =
    query.street === 'RIVER' ? 'TURN' : query.street === 'TURN' ? 'FLOP' : 'PREFLOP';
  const previousAggressor = query.lastAggressorByStreet[previousStreet];

  const postflopActions = query.actions.filter((action) => action.street !== 'PREFLOP');

  return ok({
    hero,
    villains,
    primaryVillain: primaryVillainOf(villains, currentAggressor, previousAggressor),
    narrowingApplied: false,
    postflopActionCount: postflopActions.length,
    postflopAggressionCount: postflopActions.filter((action) => action.isAggressive).length,
    anyOffPolicy: hero.offPolicy || villains.some((seat) => seat.offPolicy),
    removedCards: knownCards,
  });
}
