/**
 * The "no third branch" test the WP-C brief requires: every combination the UI can produce
 * (`heroPosition` x `spot` x `stackDepth` x `tableSize`) resolves to real data or to
 * `UNSUPPORTED` — nothing else, and never a fabricated/interpolated range.
 */
import { describe, expect, it } from 'vitest';
import {
  comboCountOf,
  COMBO_COUNT,
  percentageOf,
  RFI_RANGES,
  STRATEGY_POSITIONS,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import { resolveRange } from './resolve.js';
import { RANGE_SPOTS, RANGE_STACK_DEPTHS, RANGE_TABLE_SIZES, type RangeQuery } from './types.js';

const SUPPORTED_POSITIONS: readonly StrategyPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function allQueries(): readonly RangeQuery[] {
  const out: RangeQuery[] = [];
  for (const heroPosition of STRATEGY_POSITIONS) {
    for (const spot of RANGE_SPOTS) {
      for (const stackDepth of RANGE_STACK_DEPTHS) {
        for (const tableSize of RANGE_TABLE_SIZES) {
          out.push({ heroPosition, spot, stackDepth, tableSize });
        }
      }
    }
  }
  return out;
}

describe('resolveRange — the whole query space', () => {
  const queries = allQueries();

  it('enumerates the documented 216-point space (6 positions x 3 spots x 4 stacks x 3 tables)', () => {
    expect(STRATEGY_POSITIONS).toHaveLength(6);
    expect(RANGE_SPOTS).toHaveLength(3);
    expect(RANGE_STACK_DEPTHS).toHaveLength(4);
    expect(RANGE_TABLE_SIZES).toHaveLength(3);
    expect(queries).toHaveLength(216);
  });

  it('never throws, and every result is exactly RANGE or UNSUPPORTED — no third branch', () => {
    for (const query of queries) {
      const resolution = resolveRange(query);
      expect(['RANGE', 'UNSUPPORTED']).toContain(resolution.kind);
      expect(resolution.query).toEqual(query);
    }
  });

  it('resolves to RANGE for exactly the 5 shipped positions at RFI/100bb/6-max, and nothing else', () => {
    const rangeQueries = queries.filter((q) => resolveRange(q).kind === 'RANGE');
    expect(rangeQueries).toHaveLength(5);
    for (const query of rangeQueries) {
      expect(query.spot).toBe('RFI');
      expect(query.stackDepth).toBe(100);
      expect(query.tableSize).toBe(6);
      expect(SUPPORTED_POSITIONS).toContain(query.heroPosition);
    }
    const positionsCovered = new Set(rangeQueries.map((q) => q.heroPosition));
    expect(positionsCovered).toEqual(new Set(SUPPORTED_POSITIONS));
  });

  it('every RANGE result reproduces strategy-core numbers verbatim, never an invented one', () => {
    for (const query of queries) {
      const resolution = resolveRange(query);
      if (resolution.kind !== 'RANGE') continue;
      const source = RFI_RANGES[query.heroPosition];
      expect(source).not.toBeNull();
      if (!source) continue;
      expect(resolution.range).toBe(source);
      expect(resolution.comboCount).toBe(comboCountOf(source));
      expect(resolution.totalCombos).toBe(COMBO_COUNT);
      expect(resolution.percentage).toBe(percentageOf(source));
      expect(resolution.notation.length).toBeGreaterThan(0);
    }
  });

  it('BB with RFI is UNSUPPORTED for the specific "no first-in range" reason, with no supported alternative offered', () => {
    for (const spot of ['RFI'] as const) {
      const resolution = resolveRange({ heroPosition: 'BB', spot, stackDepth: 100, tableSize: 6 });
      expect(resolution.kind).toBe('UNSUPPORTED');
      if (resolution.kind !== 'UNSUPPORTED') return;
      expect(resolution.reasons).toEqual(['BB_HAS_NO_RFI_RANGE']);
      expect(resolution.nearestSupportedQuery).toBeNull();
    }
  });

  it('BB with a not-yet-shipped spot is UNSUPPORTED for the spot, not the BB rule', () => {
    const resolution = resolveRange({
      heroPosition: 'BB',
      spot: 'FACING_OPEN',
      stackDepth: 100,
      tableSize: 6,
    });
    expect(resolution.kind).toBe('UNSUPPORTED');
    if (resolution.kind !== 'UNSUPPORTED') return;
    expect(resolution.reasons).toEqual(['SPOT_NOT_SHIPPED']);
  });

  it('every UNSUPPORTED result carries at least one reason', () => {
    for (const query of queries) {
      const resolution = resolveRange(query);
      if (resolution.kind !== 'UNSUPPORTED') continue;
      expect(resolution.reasons.length).toBeGreaterThan(0);
    }
  });

  it('reports every failing axis at once, not just the first', () => {
    const resolution = resolveRange({
      heroPosition: 'CO',
      spot: 'FACING_3BET',
      stackDepth: 60,
      tableSize: 9,
    });
    expect(resolution.kind).toBe('UNSUPPORTED');
    if (resolution.kind !== 'UNSUPPORTED') return;
    expect(resolution.reasons).toEqual([
      'SPOT_NOT_SHIPPED',
      'STACK_DEPTH_NOT_SHIPPED',
      'TABLE_SIZE_NOT_SHIPPED',
    ]);
  });

  it('the nearest supported query, when offered, actually resolves to RANGE', () => {
    for (const query of queries) {
      const resolution = resolveRange(query);
      if (resolution.kind !== 'UNSUPPORTED') continue;
      const { nearestSupportedQuery } = resolution;
      if (nearestSupportedQuery === null) {
        expect(query.heroPosition).toBe('BB');
        continue;
      }
      expect(nearestSupportedQuery.heroPosition).toBe(query.heroPosition);
      const nearestResolution = resolveRange(nearestSupportedQuery);
      expect(nearestResolution.kind).toBe('RANGE');
    }
  });

  it('never fabricates a range: an UNSUPPORTED result never carries range fields', () => {
    for (const query of queries) {
      const resolution = resolveRange(query);
      if (resolution.kind !== 'UNSUPPORTED') continue;
      expect(resolution).not.toHaveProperty('range');
      expect(resolution).not.toHaveProperty('notation');
      expect(resolution).not.toHaveProperty('comboCount');
    }
  });
});
