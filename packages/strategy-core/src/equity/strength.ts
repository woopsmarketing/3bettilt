/**
 * The cheap half of "how good is this hand here": the CURRENT made-hand strength of every
 * combo in a range on one board, as a weighted distribution.
 *
 * This is deliberately NOT equity. Equity costs a runout enumeration; a strength distribution
 * costs one evaluation per combo (at most 1326) and answers the questions a policy actually
 * asks in bulk — "what fraction of this range has the nuts here", "where in its own range
 * does this holding sit". Use it for nut-density and percentile approximations; use
 * `equityVsRange` when you need the real number.
 *
 * It reuses `nutStrengthOnBoard` from `../analysis/heroHand.js` rather than re-deriving what
 * the nuts are, and computes it ONCE per distribution (B1 warns that it costs ~1100
 * evaluations and must never be paid per combo).
 *
 * Postflop only: a strength needs five cards, and hero's two plus a 0-card board is three.
 * A preflop board is refused with `INVALID_BOARD`.
 */
import { hasDuplicates, ok, type Card } from '@gto-self/shared';
import { evaluateStrength } from '../analysis/evaluate.js';
import { nutStrengthOnBoard } from '../analysis/heroHand.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import { comboCards, COMBO_COUNT, type ComboIndex } from '../range/combo.js';
import { removeConflicts, type RangeWeights } from '../range/weights.js';

export interface StrengthEntry {
  readonly combo: ComboIndex;
  /** The combo's weight in the range, in basis points. Always > 0. */
  readonly weightBps: number;
  /** The packed `evaluateStrength` value of this combo plus the board. Totally ordered. */
  readonly strength: number;
}

export interface StrengthDistribution {
  readonly board: readonly Card[];
  /** `nutStrengthOnBoard(board)` — the best hand ANY two cards make here. Computed once. */
  readonly nutStrength: number;
  /** Sum of the weights of every combo listed. */
  readonly totalWeightBps: number;
  /** DESCENDING by strength, ties broken by ascending combo index. Zero-weight combos absent. */
  readonly entries: readonly StrengthEntry[];
  /**
   * `cumulativeBps[i]` = the weight of `entries[0 .. i-1]`, i.e. everything STRICTLY earlier
   * in the descending order. Length is `entries.length + 1`; the last element is the total.
   */
  readonly cumulativeBps: readonly number[];
}

export interface StrengthDistributionOptions {
  /**
   * A precomputed `nutStrengthOnBoard(board)`. Pass it when building several distributions
   * on the same board — it is a property of the board alone.
   */
  readonly nutStrength?: number;
}

/**
 * Result. The weighted made-hand strength distribution of `range` on `board`.
 *
 * The range is conflict-filtered against the board first, so a combo using a board card
 * contributes nothing. An empty result is a typed `ZERO_MASS_RANGE` error, never an entry
 * list of length zero with a 0/0 percentile waiting to happen.
 */
export function buildStrengthDistribution(
  range: RangeWeights,
  board: readonly Card[],
  options: StrengthDistributionOptions = {},
): StrategyResult<StrengthDistribution> {
  if (board.length < 3 || board.length > 5) {
    return strategyErr(
      'INVALID_BOARD',
      `A strength distribution needs a postflop board of 3, 4 or 5 cards, got ${board.length}`,
      { field: 'board', actual: board.length },
    );
  }
  if (hasDuplicates(board)) {
    return strategyErr('INVALID_BOARD', 'The board repeats a card', { field: 'board' });
  }

  const live = removeConflicts(range, board);
  const hand: Card[] = [...board, 0 as Card, 0 as Card];
  const holeA = board.length;
  const holeB = board.length + 1;

  const entries: StrengthEntry[] = [];
  let totalWeightBps = 0;
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    const weightBps = live.bps[combo] ?? 0;
    if (weightBps === 0) continue;
    const [low, high] = comboCards(combo as ComboIndex);
    hand[holeA] = low;
    hand[holeB] = high;
    entries.push({ combo: combo as ComboIndex, weightBps, strength: evaluateStrength(hand) });
    totalWeightBps += weightBps;
  }

  if (entries.length === 0) {
    return strategyErr('ZERO_MASS_RANGE', 'The range has no combo left once the board is removed', {
      field: 'range',
    });
  }

  // Descending strength, ascending combo on a tie — a total order, so the output is stable.
  entries.sort((a, b) => b.strength - a.strength || a.combo - b.combo);
  const cumulativeBps: number[] = new Array<number>(entries.length + 1).fill(0);
  for (let i = 0; i < entries.length; i += 1) {
    cumulativeBps[i + 1] = (cumulativeBps[i] ?? 0) + (entries[i]?.weightBps ?? 0);
  }

  return ok({
    board: [...board],
    nutStrength: options.nutStrength ?? nutStrengthOnBoard(board),
    totalWeightBps,
    entries,
    cumulativeBps,
  });
}

/** First index whose strength is STRICTLY below `strength`, in the descending entry order. */
function firstBelow(dist: StrengthDistribution, strength: number): number {
  let lo = 0;
  let hi = dist.entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((dist.entries[mid]?.strength ?? 0) >= strength) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose strength is at or below `strength`. */
function firstAtOrBelow(dist: StrengthDistribution, strength: number): number {
  let lo = 0;
  let hi = dist.entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((dist.entries[mid]?.strength ?? 0) > strength) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Total. Weight of the range at or above `strength`, in basis points. */
export function weightAtOrAboveBps(dist: StrengthDistribution, strength: number): number {
  return dist.cumulativeBps[firstBelow(dist, strength)] ?? 0;
}

/** Total. Weight of the range EXACTLY at `strength`, in basis points. */
export function weightAtBps(dist: StrengthDistribution, strength: number): number {
  const start = firstAtOrBelow(dist, strength);
  const end = firstBelow(dist, strength);
  return (dist.cumulativeBps[end] ?? 0) - (dist.cumulativeBps[start] ?? 0);
}

/**
 * Total. Where `strength` sits inside the range, 0..1: the weighted fraction of the range it
 * BEATS, with the mass it exactly ties counted half. 1 means it beats the whole range, 0
 * means it loses to all of it, and a hand tying the entire range scores exactly 0.5 — the
 * same convention the equity engine uses for a chop, so the two agree at the extremes.
 */
export function strengthPercentile(dist: StrengthDistribution, strength: number): number {
  const total = dist.totalWeightBps;
  if (total === 0) return 0;
  const atOrAbove = weightAtOrAboveBps(dist, strength);
  const equal = weightAtBps(dist, strength);
  const below = total - atOrAbove;
  return (below + equal / 2) / total;
}

/** Total. The percentile of one combo, or `undefined` when it is not in the distribution. */
export function comboStrengthPercentile(
  dist: StrengthDistribution,
  combo: ComboIndex,
): number | undefined {
  for (const entry of dist.entries) {
    if (entry.combo === combo) return strengthPercentile(dist, entry.strength);
  }
  return undefined;
}

/**
 * Total. The share of the range, 0..1, that holds THE NUTS on this board — the classic
 * nut-density input to a bluff/value decision. `nutStrength` ignores card removal by
 * construction (B1 edge choice 12), so this answers "of my range, how much is unbeatable".
 */
export function nutDensity(dist: StrengthDistribution): number {
  if (dist.totalWeightBps === 0) return 0;
  return weightAtOrAboveBps(dist, dist.nutStrength) / dist.totalWeightBps;
}
