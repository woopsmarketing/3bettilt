/**
 * A tiny seeded PRNG and the one shuffle built on it. This is the entire reason a quiz
 * session can be reproduced: `createQuizSession` never calls `Math.random`, so the same
 * `(questions, seed)` pair always produces the same presented order, and a test — or a bug
 * report — can pin an exact seed and get back the exact quiz a reader saw (WP-L1 brief:
 * "a quiz that cannot be replayed cannot be debugged").
 *
 * `mulberry32` is a standard small-state PRNG (32-bit, single `Uint32` of state). It is not
 * cryptographic and must never be used where that matters — nothing here is; this seam
 * exists purely to make question ORDER reproducible, not to keep anything secret.
 */

/** A `() => number` in `[0, 1)`, advancing one step per call. Same `seed` -> same sequence,
 *  forever — the whole reproducibility guarantee rests on this function never changing. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A Fisher-Yates shuffle over `items`, deterministic in `seed`. Does not mutate `items`.
 * Same `(items, seed)` -> byte-identical order, every time, on every machine — the sequence
 * is pure integer/float arithmetic with no source of nondeterminism.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): readonly T[] {
  const rng = createSeededRng(seed);
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue; // unreachable: i, j are in range
    result[i] = b;
    result[j] = a;
  }
  return result;
}
