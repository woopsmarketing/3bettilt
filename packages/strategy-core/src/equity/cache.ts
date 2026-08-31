/**
 * An explicit, bounded, caller-owned memo cache for equity answers.
 *
 * ## Why it is not global
 *
 * A module-level cache is global mutable state, and global mutable state is exactly what
 * makes a "deterministic" engine stop being one: two runs of the same test file would share
 * it, and an eviction ordering would leak between callers. So there is no default instance.
 * A caller that wants memoization creates one with `createEquityCache()` and passes it in
 * through the options; a caller that does not pass one gets no cache at all.
 *
 * ## Why a hit is identical to a miss
 *
 * The cached value is the exact frozen result object the computation returned. There is no
 * re-derivation, no re-rounding, no partial storage — a hit returns the same object a miss
 * would have produced, so a cache can never change a number, only the time it takes to get
 * it. The key includes the budget, because the budget changes the answer.
 *
 * ## The key
 *
 * A range is 1326 uint16s; putting that in a string key would cost more than the lookup
 * saves, so ranges enter the key as a digest: two independent 32-bit FNV-1a lanes (different
 * offset bases and primes, and one lane mixes the index in so a permutation of the same
 * weights digests differently), plus the range's total weight and active-combo count as
 * plain integers. That is ~64 hash bits plus two exact structural counters, against a cache
 * holding a few hundred entries — the collision probability is far below the probability of
 * a hardware fault. It is still a hash, so it is documented here rather than hidden.
 */
import { activeComboCount, totalWeightBps, type RangeWeights } from '../range/weights.js';
import type { Card } from '@gto-self/shared';

/** A bounded least-recently-used store. Insertion order in a `Map` IS the LRU order. */
export interface EquityCache {
  readonly capacity: number;
  size(): number;
  clear(): void;
  /** The stored value, or `undefined`. A hit refreshes recency. */
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  /** Hits and misses since creation. Diagnostics only — never affects a result. */
  stats(): { readonly hits: number; readonly misses: number };
}

export const DEFAULT_EQUITY_CACHE_CAPACITY = 256;

export function createEquityCache(capacity: number = DEFAULT_EQUITY_CACHE_CAPACITY): EquityCache {
  const limit = Math.max(1, Math.floor(capacity));
  const entries = new Map<string, unknown>();
  let hits = 0;
  let misses = 0;
  return {
    capacity: limit,
    size: () => entries.size,
    clear: () => {
      entries.clear();
    },
    get: (key) => {
      if (!entries.has(key)) {
        misses += 1;
        return undefined;
      }
      hits += 1;
      const value = entries.get(key);
      // Re-insert so this key becomes the most recently used.
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set: (key, value) => {
      if (entries.has(key)) entries.delete(key);
      entries.set(key, value);
      while (entries.size > limit) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
      }
    },
    stats: () => ({ hits, misses }),
  };
}

/** Two independent FNV-1a lanes over the weight array, base-36 encoded. */
export function rangeDigest(range: RangeWeights): string {
  let lane1 = 0x811c9dc5;
  let lane2 = 0x9dc5811c;
  const bps = range.bps;
  for (let i = 0; i < bps.length; i += 1) {
    const value = bps[i] ?? 0;
    lane1 = Math.imul(lane1 ^ value, 16777619);
    lane2 = Math.imul(lane2 ^ (value + i), 2166136261);
  }
  const total = totalWeightBps(range);
  const active = activeComboCount(range);
  return `${(lane1 >>> 0).toString(36)}${(lane2 >>> 0).toString(36)}-${total.toString(36)}-${active.toString(36)}`;
}

/**
 * Cards as a canonical key fragment. Sorted ascending, because neither the board's order nor
 * hero's card order can change any equity: the evaluator is order-independent and the runout
 * deck is "all cards not already used".
 */
export function cardsKey(cards: readonly Card[]): string {
  return [...cards].sort((a, b) => a - b).join('.');
}
