/**
 * Our own observations.
 *
 * An observation is a COUNT WE RECORDED: how many times a situation arose, and how many
 * times the player took the action. A rate is DERIVED from those counts on demand and is
 * never stored, because a stored rate cannot be corrected, combined, or checked against
 * its own sample.
 *
 * Observations are a permanently separate record type from `PlayerHudSnapshot`. A typed-in
 * HUD percentage never becomes an observation: it has no counts behind it that we saw.
 *
 * The recorded dimensions are deliberately small. They cover exactly the preflop
 * situations our own table entry can already count without guessing; postflop metrics are
 * absent until the flow that would populate them exists (Phase 8), because a stat we
 * cannot populate is a column of zeroes pretending to be data.
 */
import { ok, type ObservationId, type PlayerId, type RoundingMode } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import { centiPercent, MAX_CENTI_PERCENT, type CentiPercent } from './percent.js';
import { validateTimestamp, type Timestamp } from './time.js';

/**
 * What we count. Each member names an OPPORTUNITY and an ACTION:
 *
 * - `VPIP`              — opportunity: dealt in with a preflop decision to make.
 *                         action: voluntarily put money in the pot.
 * - `PFR`               — opportunity: the same preflop decision.
 *                         action: raised.
 * - `THREE_BET`         — opportunity: faced exactly one preflop raise.
 *                         action: raised over it.
 * - `FOLD_TO_THREE_BET` — opportunity: our raise faced a 3-bet.
 *                         action: folded.
 */
export type ObservedMetric = 'VPIP' | 'PFR' | 'THREE_BET' | 'FOLD_TO_THREE_BET';

export const OBSERVED_METRICS: readonly ObservedMetric[] = [
  'VPIP',
  'PFR',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
];

export const isObservedMetric = (value: string): value is ObservedMetric =>
  (OBSERVED_METRICS as readonly string[]).includes(value);

/**
 * Position labels, structurally identical to `poker-core`'s `Position` and duplicated on
 * purpose: `player-core` must not import `poker-core` (ADR-0021). The application maps
 * one to the other at its own boundary.
 */
export type ObservedPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const OBSERVED_POSITIONS: readonly ObservedPosition[] = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
];

export const isObservedPosition = (value: string): value is ObservedPosition =>
  (OBSERVED_POSITIONS as readonly string[]).includes(value);

/**
 * The scope a count was recorded in. `position: null` is its OWN bucket meaning
 * "recorded without a position dimension" — it is not the sum of the six positional
 * buckets, and adding the two together would double-count the same hands.
 */
export interface ObservationContext {
  readonly metric: ObservedMetric;
  readonly position: ObservedPosition | null;
}

/** Stable string form of a context — a natural DB unique key alongside `player_id`. */
export const contextKey = (context: ObservationContext): string =>
  `${context.metric}:${context.position ?? 'ANY'}`;

export const sameContext = (a: ObservationContext, b: ObservationContext): boolean =>
  a.metric === b.metric && a.position === b.position;

export interface PlayerObservation {
  readonly id: ObservationId;
  readonly playerId: PlayerId;
  readonly metric: ObservedMetric;
  /** `null` means the count was recorded without a position dimension. */
  readonly position: ObservedPosition | null;
  /** How many times the situation arose. The denominator, and the sample size. */
  readonly opportunities: number;
  /** How many times the player took the action. Never greater than `opportunities`. */
  readonly actions: number;
  readonly firstObservedAt: Timestamp;
  readonly lastObservedAt: Timestamp;
}

/** Largest accepted count. Beyond this a figure is a bug, not a hand history. */
export const MAX_OBSERVATION_COUNT = 100_000_000;

function validateCount(value: number, field: string): PlayerResult<number> {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_OBSERVATION_COUNT) {
    return playerErr('INVALID_COUNT', `${field} must be an integer 0..${MAX_OBSERVATION_COUNT}`, {
      field,
      actual: value,
      min: 0,
      max: MAX_OBSERVATION_COUNT,
    });
  }
  return ok(value);
}

export interface CreateObservationInput {
  /** Injected by the caller (ADR-0007). */
  readonly id: ObservationId;
  readonly playerId: PlayerId;
  readonly metric: ObservedMetric;
  readonly position: ObservedPosition | null;
  readonly opportunities: number;
  readonly actions: number;
  readonly observedAt: Timestamp;
}

/**
 * Total. Rejects an unknown metric or position, a non-integer/negative/absurd count,
 * more actions than opportunities, and an invalid timestamp.
 */
export function createObservation(input: CreateObservationInput): PlayerResult<PlayerObservation> {
  if (!isObservedMetric(input.metric)) {
    return playerErr('UNKNOWN_METRIC', `unknown metric "${input.metric}"`, {
      field: 'metric',
      metric: input.metric,
      expected: OBSERVED_METRICS.join(', '),
    });
  }
  if (input.position !== null && !isObservedPosition(input.position)) {
    return playerErr('UNKNOWN_METRIC', `unknown position "${input.position}"`, {
      field: 'position',
      value: input.position,
      expected: OBSERVED_POSITIONS.join(', '),
    });
  }
  const opportunities = validateCount(input.opportunities, 'opportunities');
  if (!opportunities.ok) return opportunities;
  const actions = validateCount(input.actions, 'actions');
  if (!actions.ok) return actions;
  if (actions.value > opportunities.value) {
    return playerErr(
      'ACTIONS_EXCEED_OPPORTUNITIES',
      `actions ${actions.value} exceeds opportunities ${opportunities.value}`,
      { field: 'actions', actual: actions.value, max: opportunities.value },
    );
  }
  const observedAt = validateTimestamp(input.observedAt, 'observedAt');
  if (!observedAt.ok) return observedAt;

  return ok({
    id: input.id,
    playerId: input.playerId,
    metric: input.metric,
    position: input.position,
    opportunities: opportunities.value,
    actions: actions.value,
    firstObservedAt: observedAt.value,
    lastObservedAt: observedAt.value,
  });
}

export interface ObservationDelta {
  readonly opportunities: number;
  readonly actions: number;
}

/**
 * Total. Adds newly counted opportunities and actions, returning a NEW record.
 *
 * `at` must not move backwards, and the delta's actions must not exceed its own
 * opportunities — a delta that violates that would be a miscount, and letting it through
 * would silently corrupt the running totals.
 */
export function recordObservation(
  observation: PlayerObservation,
  delta: ObservationDelta,
  at: Timestamp,
): PlayerResult<PlayerObservation> {
  const opportunities = validateCount(delta.opportunities, 'delta.opportunities');
  if (!opportunities.ok) return opportunities;
  const actions = validateCount(delta.actions, 'delta.actions');
  if (!actions.ok) return actions;
  if (actions.value > opportunities.value) {
    return playerErr(
      'ACTIONS_EXCEED_OPPORTUNITIES',
      `delta actions ${actions.value} exceeds delta opportunities ${opportunities.value}`,
      { field: 'delta.actions', actual: actions.value, max: opportunities.value },
    );
  }
  const observedAt = validateTimestamp(at, 'observedAt');
  if (!observedAt.ok) return observedAt;
  if (observedAt.value < observation.lastObservedAt) {
    return playerErr('TIMESTAMP_OUT_OF_ORDER', 'observedAt must not move backwards', {
      field: 'observedAt',
      playerId: observation.playerId,
      actual: observedAt.value,
      min: observation.lastObservedAt,
    });
  }

  const totalOpportunities = validateCount(
    observation.opportunities + opportunities.value,
    'opportunities',
  );
  if (!totalOpportunities.ok) return totalOpportunities;
  const totalActions = validateCount(observation.actions + actions.value, 'actions');
  if (!totalActions.ok) return totalActions;

  return ok({
    ...observation,
    opportunities: totalOpportunities.value,
    actions: totalActions.value,
    lastObservedAt: observedAt.value,
  });
}

/**
 * Total. The derived rate as a plain ratio in `0..1` — NOT money, and never stored.
 * `null` when nothing has been observed, so a caller can never divide by zero and can
 * never mistake "no data" for 0%.
 */
export const observedRate = (observation: PlayerObservation): number | null =>
  observation.opportunities === 0 ? null : observation.actions / observation.opportunities;

function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case 'floor':
      return Math.floor(value);
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      return Math.round(value);
    case 'exact': {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) > 1e-9) {
        throw new Error(`Non-integral centipercent value ${value} under 'exact' rounding`);
      }
      return rounded;
    }
  }
}

/**
 * Total except for `'exact'`, which throws on a non-integral value exactly as `Money`
 * does. The derived rate expressed in the same unit a HUD reading uses, so the two can
 * be DISPLAYED side by side — they are still never averaged together.
 *
 * Rounding is explicit for the same reason money rounding is: the caller decides.
 */
export function observedRatePercent(
  observation: PlayerObservation,
  mode: RoundingMode,
): CentiPercent | null {
  const rate = observedRate(observation);
  if (rate === null) return null;
  const value = applyRounding(rate * MAX_CENTI_PERCENT, mode);
  return centiPercent(value);
}

/** Total. The observation for one context, or `undefined` when we have never seen it. */
export const findObservation = (
  observations: readonly PlayerObservation[],
  context: ObservationContext,
): PlayerObservation | undefined =>
  observations.find((observation) => sameContext(observation, context));
