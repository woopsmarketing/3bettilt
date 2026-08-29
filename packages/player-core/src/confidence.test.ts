import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type ObservationId, type PlayerId } from '@gto-self/shared';
import {
  CONFIDENCE_LEVELS,
  DEFAULT_CONFIDENCE_CONFIG,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  assessConfidence,
  assessObservationConfidence,
  confidenceRank,
  meetsConfidence,
  thresholdsFor,
  validateConfidenceConfig,
  validateConfidenceThresholds,
  type ConfidenceThresholds,
} from './confidence.js';
import { createObservation, type PlayerObservation } from './observation.js';
import { timestamp } from './time.js';

const T0 = timestamp(1_700_000_000_000);
const PLAYER = asId<'Player'>('p1') as PlayerId;
const obsId = (value: string): ObservationId => asId<'Observation'>(value);

const level = (sample: number | null, thresholds?: ConfidenceThresholds) =>
  unwrap(assessConfidence(sample, thresholds)).level;

const observation = (
  opportunities: number,
  metric: 'VPIP' | 'THREE_BET' = 'VPIP',
): PlayerObservation =>
  unwrap(
    createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric,
      position: 'CO',
      opportunities,
      actions: 0,
      observedAt: T0,
    }),
  );

describe('assessConfidence thresholds', () => {
  const { low, medium, high } = DEFAULT_CONFIDENCE_THRESHOLDS;

  it('is INSUFFICIENT below the low threshold, at every boundary below it', () => {
    expect(level(0)).toBe('INSUFFICIENT');
    expect(level(1)).toBe('INSUFFICIENT');
    expect(level(low - 1)).toBe('INSUFFICIENT');
  });

  it('reaches each level exactly at its threshold', () => {
    expect(level(low)).toBe('LOW');
    expect(level(medium - 1)).toBe('LOW');
    expect(level(medium)).toBe('MEDIUM');
    expect(level(high - 1)).toBe('MEDIUM');
    expect(level(high)).toBe('HIGH');
    expect(level(high + 1)).toBe('HIGH');
  });

  it('treats an unknown sample as INSUFFICIENT, never as an estimate', () => {
    const assessment = unwrap(assessConfidence(null));
    expect(assessment.level).toBe('INSUFFICIENT');
    expect(assessment.sample).toBeNull();
  });

  it('reports the thresholds it applied and the context it was scoped to', () => {
    const assessment = unwrap(assessConfidence(50, DEFAULT_CONFIDENCE_THRESHOLDS, 'VPIP:CO'));
    expect(assessment.thresholds).toEqual(DEFAULT_CONFIDENCE_THRESHOLDS);
    expect(assessment.context).toBe('VPIP:CO');
    expect(unwrap(assessConfidence(50)).context).toBeNull();
  });

  it('honours custom thresholds at their own boundaries', () => {
    const custom: ConfidenceThresholds = { low: 5, medium: 10, high: 20 };
    expect(level(4, custom)).toBe('INSUFFICIENT');
    expect(level(5, custom)).toBe('LOW');
    expect(level(9, custom)).toBe('LOW');
    expect(level(10, custom)).toBe('MEDIUM');
    expect(level(19, custom)).toBe('MEDIUM');
    expect(level(20, custom)).toBe('HIGH');
  });

  it('rejects a negative or fractional sample rather than clamping it', () => {
    expect(isErr(assessConfidence(-1))).toBe(true);
    const fractional = assessConfidence(1.5);
    expect(isErr(fractional) && fractional.error.code).toBe('INVALID_COUNT');
  });

  it('rejects invalid thresholds', () => {
    const result = assessConfidence(100, { low: 100, medium: 10, high: 500 });
    expect(isErr(result) && result.error.code).toBe('INVALID_CONFIDENCE_CONFIG');
  });
});

describe('threshold and config validation', () => {
  it('accepts the shipped defaults', () => {
    expect(validateConfidenceThresholds(DEFAULT_CONFIDENCE_THRESHOLDS).ok).toBe(true);
    expect(validateConfidenceConfig(DEFAULT_CONFIDENCE_CONFIG).ok).toBe(true);
  });

  it('rejects non-positive, fractional and non-increasing thresholds', () => {
    for (const thresholds of [
      { low: 0, medium: 10, high: 20 },
      { low: 1.5, medium: 10, high: 20 },
      { low: 10, medium: 10, high: 20 },
      { low: 10, medium: 20, high: 20 },
      { low: 30, medium: 20, high: 10 },
    ]) {
      const result = validateConfidenceThresholds(thresholds);
      expect(isErr(result) && result.error.code).toBe('INVALID_CONFIDENCE_CONFIG');
    }
  });

  it('validates every per-metric override and names the offender', () => {
    const result = validateConfidenceConfig({
      defaults: DEFAULT_CONFIDENCE_THRESHOLDS,
      byMetric: { THREE_BET: { low: 50, medium: 20, high: 300 } },
    });
    expect(isErr(result) && result.error.context.field).toBe('byMetric.THREE_BET');
  });

  it('falls back to the defaults for a metric with no override', () => {
    const config = {
      defaults: DEFAULT_CONFIDENCE_THRESHOLDS,
      byMetric: { THREE_BET: { low: 50, medium: 200, high: 800 } },
    };
    expect(thresholdsFor(config, 'THREE_BET').low).toBe(50);
    expect(thresholdsFor(config, 'VPIP')).toEqual(DEFAULT_CONFIDENCE_THRESHOLDS);
  });
});

describe('assessObservationConfidence', () => {
  it('uses opportunities as the sample and scopes the assessment to the context', () => {
    const assessment = unwrap(assessObservationConfidence(observation(120)));
    expect(assessment.sample).toBe(120);
    expect(assessment.level).toBe('MEDIUM');
    expect(assessment.context).toBe('VPIP:CO');
  });

  it('applies the per-metric override', () => {
    const config = {
      defaults: DEFAULT_CONFIDENCE_THRESHOLDS,
      byMetric: { THREE_BET: { low: 200, medium: 400, high: 800 } },
    };
    const assessment = unwrap(assessObservationConfidence(observation(120, 'THREE_BET'), config));
    expect(assessment.level).toBe('INSUFFICIENT');
    expect(assessment.thresholds.low).toBe(200);
  });

  it('is INSUFFICIENT for a fresh observation', () => {
    expect(unwrap(assessObservationConfidence(observation(0))).level).toBe('INSUFFICIENT');
  });
});

describe('level ordering', () => {
  it('ranks levels in increasing order', () => {
    expect(CONFIDENCE_LEVELS.map(confidenceRank)).toEqual([0, 1, 2, 3]);
  });

  it('compares against a minimum', () => {
    expect(meetsConfidence('MEDIUM', 'LOW')).toBe(true);
    expect(meetsConfidence('LOW', 'MEDIUM')).toBe(false);
    expect(meetsConfidence('INSUFFICIENT', 'INSUFFICIENT')).toBe(true);
  });
});
