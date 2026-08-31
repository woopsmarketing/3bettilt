/**
 * The ONE place every tunable number of the derived player model lives.
 *
 * Every constant here is a **PRODUCT HEURISTIC**, not a poker claim and not a statistical
 * guarantee (CLAUDE.md rule 2, ADR-0062e). They decide how a number is displayed and how
 * situations are bucketed; they never assert what a player's strategy is. They are
 * gathered in one module so that changing a bucket boundary is one diff and one review,
 * and so that a stored snapshot can record the values it was computed under.
 *
 * ## Snapshot confidence is a SECOND, separate concept
 *
 * `confidence.ts`'s `ConfidenceLevel` (`INSUFFICIENT | LOW | MEDIUM | HIGH`, ADR-0036) is
 * unchanged and stays authoritative for its existing surfaces. `SnapshotConfidence` here
 * is the model-snapshot concept from ADR-0062e: a continuous integer weight in basis
 * points plus a three-state display label. The two are **separate types and are never
 * implicitly converted into each other** — a caller that wants both computes both.
 *
 * The honesty rule survives the change of shape: below `learningThreshold` the display
 * state is the distinct member `UNKNOWN`, so a UI still cannot render "14% confident"
 * over four observations. The weight exists because a future C2 needs something to blend
 * with, not because a small sample should look like a small amount of knowledge.
 */
import { ok } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import type { BetSizeBucket, PreflopSizeBucket } from './model.js';

/* -------------------------------------------------------------------------- */
/* Snapshot confidence                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Display states for a snapshot statistic. Thresholds, not statistical guarantees.
 *
 * `UNKNOWN` is a distinct member rather than "a low percentage" for exactly the reason
 * ADR-0036 gives: a stat from four observations is not weak knowledge, it is no knowledge.
 */
export type SnapshotConfidenceState = 'UNKNOWN' | 'LEARNING' | 'KNOWN';

export const SNAPSHOT_CONFIDENCE_STATES: readonly SnapshotConfidenceState[] = [
  'UNKNOWN',
  'LEARNING',
  'KNOWN',
];

/**
 * Full weight, in basis points. The exact ratio `n / (n + K)` never reaches 1; the
 * ROUNDED basis-point value does, once `n` is large enough (around 600 000 at K = 30).
 */
export const MAX_CONFIDENCE_WEIGHT_BPS = 10_000;

export interface SnapshotConfidenceConfig {
  /**
   * The `K` in `n / (n + K)`. At `n = K` the weight is exactly half. A PRODUCT HEURISTIC:
   * 30 says "thirty observations of a situation is where we start taking the read
   * seriously", which is a product choice, not a poker fact.
   */
  readonly k: number;
  /** `n >= this` leaves `UNKNOWN` and becomes `LEARNING`. */
  readonly learningThreshold: number;
  /** `n >= this` becomes `KNOWN`. */
  readonly knownThreshold: number;
}

/** ADR-0062e defaults: K = 30, UNKNOWN < 5 <= LEARNING < 30 <= KNOWN. */
export const DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG: SnapshotConfidenceConfig = {
  k: 30,
  learningThreshold: 5,
  knownThreshold: 30,
};

/** The confidence attached to one statistic, carrying the sample it came from. */
export interface SnapshotConfidence {
  /** The opportunity count the weight was computed from. Never an action count. */
  readonly opportunities: number;
  /** `round(10000 * n / (n + K))`, integer basis points. */
  readonly weightBps: number;
  readonly state: SnapshotConfidenceState;
  /** The `K` actually applied, so an old row stays interpretable. */
  readonly k: number;
}

/** Total. Rejects a non-positive `k` or non-increasing / non-integer thresholds. */
export function validateSnapshotConfidenceConfig(
  config: SnapshotConfidenceConfig,
  field = 'snapshotConfidence',
): PlayerResult<SnapshotConfidenceConfig> {
  const entries: readonly (readonly [string, number])[] = [
    ['k', config.k],
    ['learningThreshold', config.learningThreshold],
    ['knownThreshold', config.knownThreshold],
  ];
  for (const [name, value] of entries) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return playerErr('INVALID_CONFIDENCE_CONFIG', `${field}.${name} must be a positive integer`, {
        field: `${field}.${name}`,
        actual: value,
        min: 1,
      });
    }
  }
  if (!(config.learningThreshold < config.knownThreshold)) {
    return playerErr(
      'INVALID_CONFIDENCE_CONFIG',
      `${field} must satisfy learningThreshold < knownThreshold`,
      { field, expected: 'learningThreshold < knownThreshold' },
    );
  }
  return ok(config);
}

/**
 * Total (throws only on a negative / non-integer `n`, which is a programmer error the
 * callers upstream have already validated).
 *
 * `round(10000 * n / (n + K))` computed in INTEGER arithmetic — `floor((2·num + den) /
 * (2·den))` is round-half-up with no float anywhere, so the value is bit-identical on
 * every machine. That matters: a snapshot is compared for equality across runs.
 *
 * ```
 *   n =   0  ->      0 bps
 *   n =   5  ->  1 429 bps   (10000 * 5 / 35  = 1428.57…)
 *   n =  22  ->  4 231 bps   (10000 * 22 / 52 = 4230.76…)
 *   n =  30  ->  5 000 bps   (exactly half, by construction: n = K)
 *   n = 270  ->  9 000 bps
 * ```
 */
export function confidenceWeightBps(
  opportunities: number,
  k: number = DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG.k,
): number {
  if (!Number.isSafeInteger(opportunities) || opportunities < 0) {
    throw new Error(`opportunities must be a non-negative integer, got ${opportunities}`);
  }
  if (!Number.isSafeInteger(k) || k <= 0) {
    throw new Error(`k must be a positive integer, got ${k}`);
  }
  const denominator = opportunities + k;
  const numerator = MAX_CONFIDENCE_WEIGHT_BPS * opportunities;
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Total. The display bucket for an opportunity count. */
export function snapshotConfidenceState(
  opportunities: number,
  config: SnapshotConfidenceConfig = DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
): SnapshotConfidenceState {
  if (opportunities >= config.knownThreshold) return 'KNOWN';
  if (opportunities >= config.learningThreshold) return 'LEARNING';
  return 'UNKNOWN';
}

/** Total. The whole confidence record for one opportunity count. */
export function snapshotConfidence(
  opportunities: number,
  config: SnapshotConfidenceConfig = DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
): SnapshotConfidence {
  return {
    opportunities,
    weightBps: confidenceWeightBps(opportunities, config.k),
    state: snapshotConfidenceState(opportunities, config),
    k: config.k,
  };
}

/* -------------------------------------------------------------------------- */
/* Bucket boundaries                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Postflop bet-size boundaries, as basis points of the pot BEFORE the bet, inclusive
 * upper bounds. A bet above the last boundary is an `OVERBET`.
 *
 * PRODUCT HEURISTIC. These are the sizing families a 6-max NLHE player recognises
 * (a third, a half, three quarters, near-pot, pot, overbet); they are not solver output
 * and are not presented as one.
 */
export interface PostflopSizeBoundaries {
  readonly tinyMaxBps: number;
  readonly smallMaxBps: number;
  readonly mediumMaxBps: number;
  readonly largeMaxBps: number;
  readonly potMaxBps: number;
}

export const DEFAULT_POSTFLOP_SIZE_BOUNDARIES: PostflopSizeBoundaries = {
  tinyMaxBps: 3_300,
  smallMaxBps: 5_000,
  mediumMaxBps: 7_500,
  largeMaxBps: 9_000,
  potMaxBps: 11_000,
};

/**
 * Preflop raise-TO boundaries, in HUNDREDTHS of a big blind, inclusive upper bounds:
 * 220 = 2.2 BB. PRODUCT HEURISTIC, same posture as above.
 */
export interface PreflopSizeBoundaries {
  readonly minMaxBbCenti: number;
  readonly smallMaxBbCenti: number;
  readonly standardMaxBbCenti: number;
  readonly largeMaxBbCenti: number;
}

export const DEFAULT_PREFLOP_SIZE_BOUNDARIES: PreflopSizeBoundaries = {
  minMaxBbCenti: 220,
  smallMaxBbCenti: 260,
  standardMaxBbCenti: 320,
  largeMaxBbCenti: 450,
};

/**
 * Total. Bucket a postflop bet by its size relative to the pot before it.
 *
 * Both amounts are integer milliBB and the comparison is done by cross-multiplication, so
 * no float is created and the boundary is exact. A pot of zero has no meaningful fraction
 * and buckets as `TINY` rather than dividing by zero — it can only arise in a fixture
 * with no blinds and no dead money.
 */
export function postflopSizeBucket(
  amount: number,
  potBefore: number,
  boundaries: PostflopSizeBoundaries = DEFAULT_POSTFLOP_SIZE_BOUNDARIES,
): BetSizeBucket {
  if (amount <= 0) return 'NONE';
  if (potBefore <= 0) return 'TINY';
  const scaled = amount * 10_000;
  if (scaled <= boundaries.tinyMaxBps * potBefore) return 'TINY';
  if (scaled <= boundaries.smallMaxBps * potBefore) return 'SMALL';
  if (scaled <= boundaries.mediumMaxBps * potBefore) return 'MEDIUM';
  if (scaled <= boundaries.largeMaxBps * potBefore) return 'LARGE';
  if (scaled <= boundaries.potMaxBps * potBefore) return 'POT';
  return 'OVERBET';
}

/**
 * Total. Bucket a preflop raise by its raise-TO level in big blinds. A `toAmount` at or
 * below one big blind is a `LIMP`. A zero big blind (impossible in a validated config)
 * buckets as `LIMP` rather than dividing by zero.
 */
export function preflopSizeBucket(
  toAmount: number,
  bigBlind: number,
  boundaries: PreflopSizeBoundaries = DEFAULT_PREFLOP_SIZE_BOUNDARIES,
): PreflopSizeBucket {
  if (bigBlind <= 0 || toAmount <= bigBlind) return 'LIMP';
  const scaled = toAmount * 100;
  if (scaled <= boundaries.minMaxBbCenti * bigBlind) return 'MIN';
  if (scaled <= boundaries.smallMaxBbCenti * bigBlind) return 'SMALL';
  if (scaled <= boundaries.standardMaxBbCenti * bigBlind) return 'STANDARD';
  if (scaled <= boundaries.largeMaxBbCenti * bigBlind) return 'LARGE';
  return 'HUGE';
}

/* -------------------------------------------------------------------------- */
/* The whole model configuration                                               */
/* -------------------------------------------------------------------------- */

/** Everything the analysis engine needs to bucket and score. All heuristics, in one bag. */
export interface PlayerModelConfig {
  readonly snapshotConfidence: SnapshotConfidenceConfig;
  readonly postflopSizes: PostflopSizeBoundaries;
  readonly preflopSizes: PreflopSizeBoundaries;
}

export const DEFAULT_PLAYER_MODEL_CONFIG: PlayerModelConfig = {
  snapshotConfidence: DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
  postflopSizes: DEFAULT_POSTFLOP_SIZE_BOUNDARIES,
  preflopSizes: DEFAULT_PREFLOP_SIZE_BOUNDARIES,
};

/** Total. Validates the parts of the config that can be wrong in a meaningful way. */
export function validatePlayerModelConfig(
  config: PlayerModelConfig,
): PlayerResult<PlayerModelConfig> {
  const confidence = validateSnapshotConfidenceConfig(config.snapshotConfidence);
  if (!confidence.ok) return confidence;

  const postflop = config.postflopSizes;
  const postflopOrdered =
    postflop.tinyMaxBps < postflop.smallMaxBps &&
    postflop.smallMaxBps < postflop.mediumMaxBps &&
    postflop.mediumMaxBps < postflop.largeMaxBps &&
    postflop.largeMaxBps < postflop.potMaxBps;
  if (!postflopOrdered) {
    return playerErr('INVALID_CONFIDENCE_CONFIG', 'postflopSizes boundaries must be increasing', {
      field: 'postflopSizes',
      expected: 'tiny < small < medium < large < pot',
    });
  }

  const preflop = config.preflopSizes;
  const preflopOrdered =
    preflop.minMaxBbCenti < preflop.smallMaxBbCenti &&
    preflop.smallMaxBbCenti < preflop.standardMaxBbCenti &&
    preflop.standardMaxBbCenti < preflop.largeMaxBbCenti;
  if (!preflopOrdered) {
    return playerErr('INVALID_CONFIDENCE_CONFIG', 'preflopSizes boundaries must be increasing', {
      field: 'preflopSizes',
      expected: 'min < small < standard < large',
    });
  }

  return ok(config);
}
