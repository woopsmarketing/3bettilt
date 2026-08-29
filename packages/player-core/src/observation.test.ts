import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type ObservationId, type PlayerId } from '@gto-self/shared';
import {
  MAX_OBSERVATION_COUNT,
  OBSERVED_METRICS,
  OBSERVED_POSITIONS,
  contextKey,
  createObservation,
  findObservation,
  isObservedMetric,
  isObservedPosition,
  observedRate,
  observedRatePercent,
  recordObservation,
  sameContext,
  type CreateObservationInput,
  type PlayerObservation,
} from './observation.js';
import { timestamp } from './time.js';

const PLAYER = asId<'Player'>('p1') as PlayerId;
const obsId = (value: string): ObservationId => asId<'Observation'>(value);
const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);

const make = (overrides: Partial<CreateObservationInput> = {}): PlayerObservation =>
  unwrap(
    createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric: 'VPIP',
      position: 'CO',
      opportunities: 40,
      actions: 10,
      observedAt: T0,
      ...overrides,
    }),
  );

describe('createObservation', () => {
  it('stores counts and seeds both timestamps', () => {
    const observation = make();
    expect(observation.opportunities).toBe(40);
    expect(observation.actions).toBe(10);
    expect(observation.firstObservedAt).toBe(T0);
    expect(observation.lastObservedAt).toBe(T0);
  });

  it('accepts a null position as its own bucket', () => {
    expect(make({ position: null }).position).toBeNull();
  });

  it('rejects an unknown metric or position', () => {
    const badMetric = createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric: 'AF' as never,
      position: 'CO',
      opportunities: 1,
      actions: 0,
      observedAt: T0,
    });
    expect(isErr(badMetric) && badMetric.error.code).toBe('UNKNOWN_METRIC');
    const badPosition = createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric: 'VPIP',
      position: 'MP' as never,
      opportunities: 1,
      actions: 0,
      observedAt: T0,
    });
    expect(isErr(badPosition) && badPosition.error.context.field).toBe('position');
  });

  it('rejects negative, fractional and absurd counts', () => {
    for (const opportunities of [-1, 1.5, MAX_OBSERVATION_COUNT + 1]) {
      const result = createObservation({
        id: obsId('o1'),
        playerId: PLAYER,
        metric: 'VPIP',
        position: null,
        opportunities,
        actions: 0,
        observedAt: T0,
      });
      expect(isErr(result) && result.error.code).toBe('INVALID_COUNT');
    }
  });

  it('rejects more actions than opportunities', () => {
    const result = createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric: 'VPIP',
      position: null,
      opportunities: 3,
      actions: 4,
      observedAt: T0,
    });
    expect(isErr(result) && result.error.code).toBe('ACTIONS_EXCEED_OPPORTUNITIES');
    expect(isErr(result) && result.error.context.max).toBe(3);
  });

  it('rejects an invalid timestamp', () => {
    const result = createObservation({
      id: obsId('o1'),
      playerId: PLAYER,
      metric: 'VPIP',
      position: null,
      opportunities: 1,
      actions: 1,
      observedAt: Number.NaN as never,
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
  });

  it('exposes guards for both vocabularies', () => {
    for (const metric of OBSERVED_METRICS) expect(isObservedMetric(metric)).toBe(true);
    for (const position of OBSERVED_POSITIONS) expect(isObservedPosition(position)).toBe(true);
    expect(isObservedMetric('CBET_FLOP')).toBe(false);
    expect(isObservedPosition('MP')).toBe(false);
  });
});

describe('recordObservation', () => {
  it('accumulates counts and advances lastObservedAt only', () => {
    const updated = unwrap(recordObservation(make(), { opportunities: 5, actions: 2 }, T1));
    expect(updated.opportunities).toBe(45);
    expect(updated.actions).toBe(12);
    expect(updated.firstObservedAt).toBe(T0);
    expect(updated.lastObservedAt).toBe(T1);
  });

  it('leaves the previous record untouched', () => {
    const original = make();
    unwrap(recordObservation(original, { opportunities: 5, actions: 2 }, T1));
    expect(original.opportunities).toBe(40);
  });

  it('rejects a delta whose actions exceed its own opportunities', () => {
    const result = recordObservation(make(), { opportunities: 1, actions: 2 }, T1);
    expect(isErr(result) && result.error.code).toBe('ACTIONS_EXCEED_OPPORTUNITIES');
  });

  it('rejects an invalid delta count', () => {
    const result = recordObservation(make(), { opportunities: -1, actions: 0 }, T1);
    expect(isErr(result) && result.error.code).toBe('INVALID_COUNT');
  });

  it('rejects a backwards timestamp', () => {
    const result = recordObservation(make(), { opportunities: 1, actions: 1 }, timestamp(T0 - 1));
    expect(isErr(result) && result.error.code).toBe('TIMESTAMP_OUT_OF_ORDER');
  });

  it('rejects a total that overflows the count limit', () => {
    const large = make({ opportunities: MAX_OBSERVATION_COUNT, actions: 0 });
    const result = recordObservation(large, { opportunities: 1, actions: 0 }, T1);
    expect(isErr(result) && result.error.code).toBe('INVALID_COUNT');
  });

  it('accepts a delta at the same instant', () => {
    expect(recordObservation(make(), { opportunities: 1, actions: 1 }, T0).ok).toBe(true);
  });
});

describe('derived rates', () => {
  it('derives the rate from counts and never stores it', () => {
    expect(observedRate(make({ opportunities: 40, actions: 10 }))).toBe(0.25);
    expect(Object.keys(make())).not.toContain('rate');
  });

  it('returns null rather than zero when nothing has been observed', () => {
    expect(observedRate(make({ opportunities: 0, actions: 0 }))).toBeNull();
    expect(observedRatePercent(make({ opportunities: 0, actions: 0 }), 'round')).toBeNull();
  });

  it('applies the caller-chosen rounding explicitly', () => {
    // 1/3 = 33.333...% -> 3333.33 centipercent
    const third = make({ opportunities: 3, actions: 1 });
    expect(observedRatePercent(third, 'floor')).toBe(3333);
    expect(observedRatePercent(third, 'ceil')).toBe(3334);
    expect(observedRatePercent(third, 'round')).toBe(3333);
    expect(() => observedRatePercent(third, 'exact')).toThrow(/exact/);
  });

  it("accepts 'exact' when the value is integral", () => {
    expect(observedRatePercent(make({ opportunities: 4, actions: 1 }), 'exact')).toBe(2500);
  });

  it('reaches both bounds', () => {
    expect(observedRatePercent(make({ opportunities: 7, actions: 0 }), 'round')).toBe(0);
    expect(observedRatePercent(make({ opportunities: 7, actions: 7 }), 'round')).toBe(10_000);
  });
});

describe('contexts', () => {
  it('keys a context by metric and position, with ANY for the null bucket', () => {
    expect(contextKey({ metric: 'VPIP', position: 'CO' })).toBe('VPIP:CO');
    expect(contextKey({ metric: 'VPIP', position: null })).toBe('VPIP:ANY');
  });

  it('treats the null-position bucket as different from a positional one', () => {
    expect(
      sameContext({ metric: 'VPIP', position: null }, { metric: 'VPIP', position: 'CO' }),
    ).toBe(false);
    expect(sameContext({ metric: 'VPIP', position: 'CO' }, { metric: 'PFR', position: 'CO' })).toBe(
      false,
    );
    expect(
      sameContext({ metric: 'VPIP', position: 'CO' }, { metric: 'VPIP', position: 'CO' }),
    ).toBe(true);
  });

  it('finds the observation for one context only', () => {
    const co = make({ id: obsId('o1'), position: 'CO' });
    const btn = make({ id: obsId('o2'), position: 'BTN' });
    const any = make({ id: obsId('o3'), position: null });
    const all = [co, btn, any];
    expect(findObservation(all, { metric: 'VPIP', position: 'BTN' })?.id).toBe(btn.id);
    expect(findObservation(all, { metric: 'VPIP', position: null })?.id).toBe(any.id);
    expect(findObservation(all, { metric: 'PFR', position: 'CO' })).toBeUndefined();
  });
});
