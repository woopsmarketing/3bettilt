import { Money } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import {
  classifyStackBucket,
  MIN_BUCKETED_STACK_MBB,
  PRIMARY_STACK_BUCKET,
  STACK_BUCKETS,
  stackBucketById,
  type StackBucketId,
} from './stackBucket.js';

const at = (bb: number): ReturnType<typeof classifyStackBucket> =>
  classifyStackBucket(Money.fromBB(bb));

const bucketIdAt = (bb: number): StackBucketId | 'OUT_OF_RANGE' => {
  const result = at(bb);
  return result.kind === 'BUCKET' ? result.bucket.id : 'OUT_OF_RANGE';
};

describe('stack bucket boundaries', () => {
  const cases: readonly (readonly [number, StackBucketId | 'OUT_OF_RANGE'])[] = [
    [0, 'OUT_OF_RANGE'],
    [12, 'OUT_OF_RANGE'],
    [39.999, 'OUT_OF_RANGE'],
    [40, 'BB_40_59'],
    [59.999, 'BB_40_59'],
    [60, 'BB_60_79'],
    [79.999, 'BB_60_79'],
    [80, 'BB_80_119'],
    [100, 'BB_80_119'],
    [119.999, 'BB_80_119'],
    [120, 'BB_120_159'],
    [159.999, 'BB_120_159'],
    [160, 'BB_160_PLUS'],
    [1000, 'BB_160_PLUS'],
  ];

  for (const [bb, expected] of cases) {
    it(`${bb} BB -> ${expected}`, () => {
      expect(bucketIdAt(bb)).toBe(expected);
    });
  }

  it('carries the ACTUAL stack alongside the bucket (CLAUDE.md rule 3)', () => {
    const result = at(93.7);
    expect(result.kind).toBe('BUCKET');
    expect(result.effectiveStackMbb).toBe(Money.fromBB(93.7));
    if (result.kind === 'BUCKET') expect(result.bucket.id).toBe('BB_80_119');
  });

  it('a short stack is typed OUT_OF_RANGE, never bucketed into 40-59', () => {
    const result = at(25);
    expect(result.kind).toBe('OUT_OF_RANGE');
    if (result.kind === 'OUT_OF_RANGE') {
      expect(result.reason).toBe('BELOW_MINIMUM');
      expect(result.minimumMbb).toBe(MIN_BUCKETED_STACK_MBB);
      expect(result.effectiveStackMbb).toBe(Money.fromBB(25));
    }
  });

  it('the buckets tile [40 BB, infinity) with no gap and no overlap', () => {
    for (let i = 0; i < STACK_BUCKETS.length - 1; i += 1) {
      const current = STACK_BUCKETS[i];
      const next = STACK_BUCKETS[i + 1];
      expect(current?.maxExclusiveMbb).toBe(next?.minMbb);
    }
    expect(STACK_BUCKETS[0]?.minMbb).toBe(MIN_BUCKETED_STACK_MBB);
    expect(STACK_BUCKETS.at(-1)?.maxExclusiveMbb).toBeNull();
  });

  it('exactly one bucket is primary, and it is 80-119', () => {
    const primary = STACK_BUCKETS.filter((bucket) => bucket.isPrimary);
    expect(primary).toHaveLength(1);
    expect(primary[0]?.id).toBe(PRIMARY_STACK_BUCKET);
    expect(stackBucketById(PRIMARY_STACK_BUCKET).label).toBe('80-119 BB');
  });
});
