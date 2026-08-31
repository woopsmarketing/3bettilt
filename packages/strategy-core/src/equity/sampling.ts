/**
 * Deterministic combinatorics for the equity engine: binomials, colexicographic
 * unranking of a k-subset, and the ONE sampling scheme this package is allowed to use.
 *
 * ## Why there is no RNG here
 *
 * Equity numbers are shown to a user next to their own hand history and are compared
 * across sessions. A Monte-Carlo estimate that moves when you reload the page is not a
 * measurement, it is noise. Everything in this file is a pure function of its integer
 * arguments, so the same inputs always produce the same sample, on every machine, forever.
 *
 * ## The sampling scheme — a golden-ratio Weyl walk
 *
 * To pick `k` of `n` items:
 *
 *     s  = the integer nearest n * 0.6180339887498949, nudged up until gcd(s, n) = 1
 *     i-th index = (i * s) mod n,  accumulated incrementally so nothing overflows
 *
 * Because `gcd(s, n) = 1` the walk visits `n` distinct residues before repeating, so the
 * `k` indices are DISTINCT. Because `s / n` is close to the golden ratio the walk is a Weyl
 * sequence, which has low discrepancy: any interval of the index space receives its fair
 * share of samples, with no clustering.
 *
 * A plain stride (`floor(i * n / k)`) was rejected deliberately. Card indices are
 * `rank * 4 + suit`, so the enumeration of two-card runouts has a strong period-4 structure
 * in the suits; a stride that happens to share a factor with that period would systematically
 * over-sample some suit patterns and quietly bias every flush-draw equity. A coprime,
 * irrational-ratio stride cannot line up with any such period.
 *
 * The returned indices are SORTED ASCENDING, so that a sampled run visits the space in the
 * same direction as an exhaustive one and the floating-point accumulation order in the
 * caller is a function of the sample alone.
 */
import { invariant } from '@gto-self/shared';

/** The largest `n` any binomial in this package is asked for (52 cards + 1). */
const BINOMIAL_MAX = 53;

/** `BINOMIAL[n][k] = C(n, k)`, built by Pascal's rule — derived, never hand-entered. */
const BINOMIAL: readonly (readonly number[])[] = (() => {
  const table: number[][] = [];
  for (let n = 0; n < BINOMIAL_MAX; n += 1) {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = 1;
    for (let k = 1; k <= n; k += 1) {
      const above = table[n - 1];
      row[k] = (above?.[k - 1] ?? 0) + (above?.[k] ?? 0);
    }
    table.push(row);
  }
  return table;
})();

/** Total. `C(n, k)`, and `0` when `k` is out of `0..n`. Throws above 52. */
export function binomial(n: number, k: number): number {
  invariant(n >= 0 && n < BINOMIAL_MAX, `binomial n out of range: ${n}`);
  if (k < 0 || k > n) return 0;
  return BINOMIAL[n]?.[k] ?? 0;
}

/**
 * Total. How many `k`-subsets an `n`-element set has. `C(n, 0) = 1` — the empty runout on
 * the river is ONE runout, not zero, and every count in this package depends on that.
 */
export function combinationCount(n: number, k: number): number {
  return binomial(n, k);
}

/**
 * Writes the `rank`-th `k`-subset of `0..n-1` into `out[0..k-1]`, ASCENDING.
 *
 * The order is COLEXICOGRAPHIC: subsets are ordered by their largest element first, then by
 * the next largest, and so on. Its rank has a closed form,
 *
 *     rank({c_0 < c_1 < ... < c_{k-1}}) = sum_i C(c_i, i + 1)
 *
 * which is what makes unranking a `k`-step greedy descent with no table of subsets. For
 * `k = 2` this is exactly the combo-index formula in `../range/combo.ts`
 * (`high * (high - 1) / 2 + low`), so the two enumerations agree by construction.
 *
 * Throws on an out-of-range rank — a programmer error, like every other `invariant` here.
 */
export function unrankColex(rank: number, n: number, k: number, out: number[]): void {
  invariant(k >= 0 && k <= n, `cannot take ${k} of ${n}`);
  invariant(
    rank >= 0 && rank < combinationCount(n, k),
    `combination rank ${rank} out of range for C(${n}, ${k})`,
  );
  let remaining = rank;
  let hi = n - 1;
  for (let slot = k; slot >= 1; slot -= 1) {
    // The largest `c <= hi` with C(c, slot) <= remaining. `C(., slot)` is non-decreasing, so
    // this is a binary search — a linear scan costs ~50 steps per slot here, and preflop
    // unranks two million runouts, which made the scan the single hottest thing in the engine.
    let lo = slot - 1;
    let top = hi;
    while (lo < top) {
      const mid = (lo + top + 1) >>> 1;
      if (binomial(mid, slot) <= remaining) lo = mid;
      else top = mid - 1;
    }
    out[slot - 1] = lo;
    remaining -= binomial(lo, slot);
    // The next (smaller) element is strictly below this one.
    hi = lo - 1;
  }
}

/** Greatest common divisor of two non-negative integers. */
function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** The golden ratio's fractional part — the low-discrepancy stride constant. */
export const WEYL_RATIO = 0.6180339887498949;

/**
 * Total. `k` DISTINCT indices from `0..n-1`, sorted ascending, chosen by the golden-ratio
 * Weyl walk documented at the top of this file. When `k >= n` every index is returned, so a
 * caller can always ask for "up to k" and find out afterwards whether it got the whole space.
 *
 * `n` may be as large as `1326^5` (the five-villain assignment space); the walk is
 * accumulated with `cur += s; if (cur >= n) cur -= n`, so no product is ever formed and the
 * arithmetic stays exact in a double as long as `2n` is below `Number.MAX_SAFE_INTEGER`,
 * which is asserted.
 */
export function weylIndices(n: number, k: number): number[] {
  invariant(Number.isInteger(n) && n >= 0, `weyl n must be a non-negative integer, got ${n}`);
  invariant(
    2 * n <= Number.MAX_SAFE_INTEGER,
    `weyl index space ${n} is too large for exact integer arithmetic`,
  );
  invariant(Number.isInteger(k) && k >= 0, `weyl k must be a non-negative integer, got ${k}`);
  if (n === 0) return [];
  if (k >= n) return Array.from({ length: n }, (_, i) => i);

  let stride = Math.round(n * WEYL_RATIO);
  if (stride < 1) stride = 1;
  if (stride >= n) stride = n - 1;
  // gcd(1, n) = 1 always, so wrapping to 1 terminates the search.
  while (gcd(stride, n) !== 1) {
    stride += 1;
    if (stride >= n) stride = 1;
  }

  const out = new Array<number>(k);
  let cur = 0;
  for (let i = 0; i < k; i += 1) {
    out[i] = cur;
    cur += stride;
    if (cur >= n) cur -= n;
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Total. `0..n-1` when the whole space fits in `limit`, otherwise a Weyl sample of `limit`
 * of them. The single place the engine decides "exhaustive or sampled"; the caller reads
 * `result.length === n` to learn which it got.
 */
export function indexSample(n: number, limit: number): number[] {
  if (limit >= n) return Array.from({ length: n }, (_, i) => i);
  return weylIndices(n, Math.max(0, Math.floor(limit)));
}
