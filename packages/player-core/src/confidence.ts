/**
 * Context-scoped confidence.
 *
 * A read is only as good as the sample behind it. This turns an observation count into a
 * typed level, and the honesty rule is structural: below the smallest threshold the
 * answer is `INSUFFICIENT` — a distinct member, not a low percentage — so a UI cannot
 * render "we are 12% confident" over eight hands. An unknown sample (`null`) is also
 * `INSUFFICIENT`, never an estimate.
 *
 * Thresholds are CONFIGURATION with documented defaults, not constants buried in the
 * function. They are scoped per metric because "faced a 3-bet" arises far less often
 * than "was dealt in", so one global number would be wrong for one of them.
 */
import { ok } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import {
  contextKey,
  type ObservationContext,
  type ObservedMetric,
  type PlayerObservation,
} from './observation.js';

export type ConfidenceLevel = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';

export const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = [
  'INSUFFICIENT',
  'LOW',
  'MEDIUM',
  'HIGH',
];

/** Ordering only. Not a score, and never rendered as one. */
export const confidenceRank = (level: ConfidenceLevel): number => CONFIDENCE_LEVELS.indexOf(level);

export const meetsConfidence = (level: ConfidenceLevel, minimum: ConfidenceLevel): boolean =>
  confidenceRank(level) >= confidenceRank(minimum);

/** Minimum sample size at which each level is reached. Strictly increasing. */
export interface ConfidenceThresholds {
  /** `sample >= low` -> LOW. Below it -> INSUFFICIENT. */
  readonly low: number;
  readonly medium: number;
  readonly high: number;
}

/**
 * Defaults.
 *
 * These are DISPLAY thresholds, not a statistical claim about poker. They are anchored to
 * the 95% margin of error of a binomial proportion at its widest (p = 0.5),
 * `1.96 * sqrt(0.25 / n)`, which is arithmetic rather than an invented poker number:
 *
 * ```
 *   n =  30  ->  +/- 18 percentage points   (LOW      — a direction, not a number)
 *   n = 100  ->  +/- 10 percentage points   (MEDIUM)
 *   n = 500  ->  +/-  4.4 percentage points (HIGH)
 * ```
 *
 * Below 30 the interval is wider than most of the range being estimated, which is what
 * `INSUFFICIENT` means. Override per metric when a real reason to appears.
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  low: 30,
  medium: 100,
  high: 500,
};

export interface ConfidenceConfig {
  readonly defaults: ConfidenceThresholds;
  /** Per-metric overrides. Empty by default — no metric has an evidenced reason yet. */
  readonly byMetric: Partial<Record<ObservedMetric, ConfidenceThresholds>>;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  defaults: DEFAULT_CONFIDENCE_THRESHOLDS,
  byMetric: {},
};

/** Total. Rejects non-integer, non-positive, or non-increasing thresholds. */
export function validateConfidenceThresholds(
  thresholds: ConfidenceThresholds,
  field = 'thresholds',
): PlayerResult<ConfidenceThresholds> {
  const entries: readonly (readonly [string, number])[] = [
    ['low', thresholds.low],
    ['medium', thresholds.medium],
    ['high', thresholds.high],
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
  if (!(thresholds.low < thresholds.medium && thresholds.medium < thresholds.high)) {
    return playerErr(
      'INVALID_CONFIDENCE_CONFIG',
      `${field} must be strictly increasing: low < medium < high`,
      { field, expected: 'low < medium < high' },
    );
  }
  return ok(thresholds);
}

/** Total. Validates the defaults and every per-metric override. */
export function validateConfidenceConfig(config: ConfidenceConfig): PlayerResult<ConfidenceConfig> {
  const defaults = validateConfidenceThresholds(config.defaults, 'defaults');
  if (!defaults.ok) return defaults;
  for (const [metric, thresholds] of Object.entries(config.byMetric)) {
    if (thresholds === undefined) continue;
    const validated = validateConfidenceThresholds(thresholds, `byMetric.${metric}`);
    if (!validated.ok) return validated;
  }
  return ok(config);
}

/** Total. The thresholds that apply to one metric. */
export const thresholdsFor = (
  config: ConfidenceConfig,
  metric: ObservedMetric,
): ConfidenceThresholds => config.byMetric[metric] ?? config.defaults;

export interface ConfidenceAssessment {
  readonly level: ConfidenceLevel;
  /** The sample the level was derived from. `null` means the sample is unknown. */
  readonly sample: number | null;
  /** The thresholds actually applied, so the UI can explain the level it shows. */
  readonly thresholds: ConfidenceThresholds;
  /** `contextKey` of the context this assessment is scoped to, when there is one. */
  readonly context: string | null;
}

/**
 * Total. Sample -> level, with the thresholds it used.
 *
 * `null` or a sample below `thresholds.low` is `INSUFFICIENT`. Rejects a negative or
 * non-integer sample and invalid thresholds rather than clamping them.
 */
export function assessConfidence(
  sample: number | null,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
  context: string | null = null,
): PlayerResult<ConfidenceAssessment> {
  const validated = validateConfidenceThresholds(thresholds);
  if (!validated.ok) return validated;
  if (sample !== null && (!Number.isSafeInteger(sample) || sample < 0)) {
    return playerErr('INVALID_COUNT', 'sample must be null or a non-negative integer', {
      field: 'sample',
      actual: sample,
      min: 0,
    });
  }
  const level: ConfidenceLevel =
    sample === null || sample < thresholds.low
      ? 'INSUFFICIENT'
      : sample >= thresholds.high
        ? 'HIGH'
        : sample >= thresholds.medium
          ? 'MEDIUM'
          : 'LOW';
  return ok({ level, sample, thresholds, context });
}

/**
 * Total. Confidence in one of OUR OWN observations. The sample is `opportunities` — the
 * number of times the situation arose — never `actions`, and never a hand count from
 * somewhere else.
 */
export function assessObservationConfidence(
  observation: PlayerObservation,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): PlayerResult<ConfidenceAssessment> {
  const context: ObservationContext = {
    metric: observation.metric,
    position: observation.position,
  };
  return assessConfidence(
    observation.opportunities,
    thresholdsFor(config, observation.metric),
    contextKey(context),
  );
}
