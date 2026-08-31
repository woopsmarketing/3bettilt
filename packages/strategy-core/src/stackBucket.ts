/**
 * Effective-stack buckets for reference lookup.
 *
 * The ACTUAL effective stack is always carried alongside the bucket (CLAUDE.md rule 3 and
 * ADR-0016 item 5): a bucket is a lookup key, never a replacement for what the user has.
 *
 * Boundaries are half-open in integer milliBB — `[min, max)` — so 59.999 BB is `BB_40_59`
 * and exactly 60.000 BB is `BB_60_79`. Comparison happens in milliBB, never in floating
 * point BB.
 *
 * Below 40 BB there is NO bucket. Short-stack play is a different game and this package
 * does not model it; `OUT_OF_RANGE` is a typed member so the UI can say so rather than
 * silently borrowing the 40-59 policy.
 */
import { Money, type MilliBB } from '@gto-self/shared';

export type StackBucketId = 'BB_40_59' | 'BB_60_79' | 'BB_80_119' | 'BB_120_159' | 'BB_160_PLUS';

export interface StackBucketDefinition {
  readonly id: StackBucketId;
  /** Inclusive lower edge, in milliBB. */
  readonly minMbb: MilliBB;
  /** EXCLUSIVE upper edge in milliBB, or `null` for the open-ended top bucket. */
  readonly maxExclusiveMbb: MilliBB | null;
  readonly minBB: number;
  /** Inclusive upper edge as displayed (`59`, `79`, ...), or `null` for `160+`. */
  readonly displayMaxBB: number | null;
  readonly label: string;
  /** The bucket the reference policies are authored against first. */
  readonly isPrimary: boolean;
}

const bb = (value: number): MilliBB => Money.fromBB(value, 'exact');

export const STACK_BUCKETS: readonly StackBucketDefinition[] = [
  {
    id: 'BB_40_59',
    minMbb: bb(40),
    maxExclusiveMbb: bb(60),
    minBB: 40,
    displayMaxBB: 59,
    label: '40-59 BB',
    isPrimary: false,
  },
  {
    id: 'BB_60_79',
    minMbb: bb(60),
    maxExclusiveMbb: bb(80),
    minBB: 60,
    displayMaxBB: 79,
    label: '60-79 BB',
    isPrimary: false,
  },
  {
    id: 'BB_80_119',
    minMbb: bb(80),
    maxExclusiveMbb: bb(120),
    minBB: 80,
    displayMaxBB: 119,
    label: '80-119 BB',
    isPrimary: true,
  },
  {
    id: 'BB_120_159',
    minMbb: bb(120),
    maxExclusiveMbb: bb(160),
    minBB: 120,
    displayMaxBB: 159,
    label: '120-159 BB',
    isPrimary: false,
  },
  {
    id: 'BB_160_PLUS',
    minMbb: bb(160),
    maxExclusiveMbb: null,
    minBB: 160,
    displayMaxBB: null,
    label: '160+ BB',
    isPrimary: false,
  },
];

/** The lowest modelled stack. Anything under this is `OUT_OF_RANGE`, never bucketed. */
export const MIN_BUCKETED_STACK_MBB: MilliBB = bb(40);

/** The bucket the reference policies are authored against first. */
export const PRIMARY_STACK_BUCKET: StackBucketId = 'BB_80_119';

export type StackBucketOutOfRangeReason = 'BELOW_MINIMUM';

export type StackBucketClassification =
  | {
      readonly kind: 'BUCKET';
      readonly bucket: StackBucketDefinition;
      /** The ACTUAL effective stack that was classified. Never dropped. */
      readonly effectiveStackMbb: MilliBB;
    }
  | {
      readonly kind: 'OUT_OF_RANGE';
      readonly reason: StackBucketOutOfRangeReason;
      readonly effectiveStackMbb: MilliBB;
      readonly minimumMbb: MilliBB;
    };

/**
 * Total. Classifies an effective stack (STARTING basis — see `effectiveStackFor` in
 * `poker-core/metrics.ts`) into a bucket, or into a typed `OUT_OF_RANGE`.
 *
 * Never throws and never guesses: a 12 BB stack comes back as `OUT_OF_RANGE`, not as
 * `BB_40_59`.
 */
export function classifyStackBucket(effectiveStackMbb: MilliBB): StackBucketClassification {
  if (effectiveStackMbb < MIN_BUCKETED_STACK_MBB) {
    return {
      kind: 'OUT_OF_RANGE',
      reason: 'BELOW_MINIMUM',
      effectiveStackMbb,
      minimumMbb: MIN_BUCKETED_STACK_MBB,
    };
  }
  for (const bucket of STACK_BUCKETS) {
    const withinTop = bucket.maxExclusiveMbb === null || effectiveStackMbb < bucket.maxExclusiveMbb;
    if (effectiveStackMbb >= bucket.minMbb && withinTop) {
      return { kind: 'BUCKET', bucket, effectiveStackMbb };
    }
  }
  // Unreachable: the buckets tile [40 BB, infinity). Kept total rather than throwing.
  return {
    kind: 'OUT_OF_RANGE',
    reason: 'BELOW_MINIMUM',
    effectiveStackMbb,
    minimumMbb: MIN_BUCKETED_STACK_MBB,
  };
}

/** Total. The definition for an id. */
export function stackBucketById(id: StackBucketId): StackBucketDefinition {
  const found = STACK_BUCKETS.find((bucket) => bucket.id === id);
  // `StackBucketId` is closed over `STACK_BUCKETS`, so this cannot miss.
  if (found === undefined) throw new Error(`unknown stack bucket ${id}`);
  return found;
}
