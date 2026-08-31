/**
 * Range-versus-range equity: every combo in hero's range against a weighted villain range,
 * on one board, in ONE pass that shares all the work it can.
 *
 * ## Why this is not a loop over `equityVsRange`
 *
 * Calling the heads-up engine 1326 times would re-evaluate the villain range on every runout
 * 1326 times over. On a flop that is 1326 x 1081 x 1081 evaluations — a billion and a half.
 * The whole point of this module is the shared precomputation B1's report asks for:
 *
 * ```
 * for each RUNOUT r
 *     strength[c] for every villain combo c            <- ~1081 evaluations, shared
 *     sort those (strength, weight) pairs, prefix-sum the weights
 *     for each HERO combo h
 *         heroStrength = eval(board + r + h)           <- 1 evaluation
 *         two binary searches give (weight below, weight equal, weight above) over the
 *         WHOLE villain range in O(log n)
 *         then SUBTRACT the ~101 villain combos that use one of hero's two cards
 * ```
 *
 * The correction step is what makes the prefix-sum legal. Card removal is per hero combo, so
 * the aggregate sums are wrong for each hero combo by exactly the villain combos that share a
 * card with it — and there are at most `51 + 51 - 1 = 101` of those, which is far cheaper than
 * re-summing 1081. The result is IDENTICAL to the naive per-combo enumeration, which is what
 * the test asserting `rangeVsRangeEquity` against `equityVsRange` on a river board checks.
 *
 * ## Bounding
 *
 * Cost is `runouts * (villainCombos + heroCombos * ~110)`. The river needs one runout and is
 * always exact. The flop's 1176 runouts would cost ~170M operations, so the runout count is
 * bounded by an operation budget and the result is labelled `SUBSAMPLED`. The runouts are
 * chosen by the same deterministic Weyl walk as everywhere else, so the answer is stable.
 */
import { ALL_CARDS, CARD_COUNT, hasDuplicates, invariant, ok, type Card } from '@gto-self/shared';
import { evaluateStrength } from '../analysis/evaluate.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import { comboCards, comboIndexOf, COMBO_COUNT, type ComboIndex } from '../range/combo.js';
import { removeConflicts, type RangeWeights } from '../range/weights.js';
import { cardsKey, rangeDigest, type EquityCache } from './cache.js';
import type { EquityMethod } from './model.js';
import { validateBoard } from './equity.js';
import { combinationCount, indexSample, unrankColex } from './sampling.js';
import { COMBO_HIGH, COMBO_LOW } from './tables.js';

/** Per hero-combo cost of the conflict correction, used only to size the runout budget. */
const CORRECTION_COST = 110;

/**
 * Default ceiling on `runouts * (villainCombos + heroCombos * 110)`. Sized so a full
 * 1326-vs-1081 flop lands around a tenth of a second; see the WP report's latency table.
 *
 * WHAT THIS BUDGET IS AND IS NOT ACCURATE FOR (measured, full ranges, `Ah7d2c`, against the
 * same call at `maxOps: MAX_SAFE_INTEGER` — 153 of 1176 runouts survive the budget):
 *
 *  - the AGGREGATE `equity` is accurate to ~0.0006, because the per-combo errors cancel;
 *  - an INDIVIDUAL `perCombo.equity` is not: max error 0.0541;
 *  - a QUANTILE of one combo inside the distribution inherits that: max 0.1207 when the ranked
 *    value comes from this same subsample, 0.0374 when the ranked value is exact.
 *
 * So a caller consuming a single combo or its rank as a policy input is consuming a coarser
 * number than the aggregate, and must carry `method === 'SUBSAMPLED'` through to whatever
 * reports it — `postflop/context.ts` does, via `rangeEquityMethod` and the `EQUITY_METHOD`
 * explanation feature (R1 MINOR-3).
 */
export const DEFAULT_RANGE_EQUITY_MAX_OPS = 20_000_000;

export interface ComboEquity {
  readonly combo: ComboIndex;
  /** Hero's weight for this combo, in basis points. */
  readonly weightBps: number;
  readonly winProb: number;
  readonly tieProb: number;
  readonly loseProb: number;
  /** Hero's expected share holding exactly this combo, ties split. */
  readonly equity: number;
  /**
   * The villain weight this combo was actually scored against, summed over every runout —
   * the denominator behind the three probabilities. It differs between hero combos because
   * each one blocks a different slice of the villain range, which is exactly why the
   * aggregate below is a weighted MEAN of per-combo equities and not a pooled ratio.
   */
  readonly villainWeightBps: number;
}

export interface RangeEquityResult {
  /**
   * Hero's range equity: the per-combo equities averaged by hero's own weights.
   *
   * This is a weighted MEAN of shares, not a pooled ratio of totals. The two differ whenever
   * hero's combos block unequal amounts of villain weight — a range against itself averages
   * to exactly 0.5 only when every combo blocks the same weight (a uniform range). The mean
   * is the right definition here because "my range's equity" is what each of my hands is
   * worth, weighted by how often I hold it.
   */
  readonly equity: number;
  readonly winProb: number;
  readonly tieProb: number;
  readonly loseProb: number;
  /** One entry per hero combo that was actually scored, ASCENDING by combo index. */
  readonly perCombo: readonly ComboEquity[];
  readonly method: EquityMethod;
  readonly evaluatedRunouts: number;
  readonly runoutSpaceSize: number;
  /** `(hero combo, runout)` pairs scored. Each covers the whole villain range. */
  readonly evaluatedTrials: number;
  readonly heroComboCount: number;
  readonly villainComboCount: number;
  /** Sum of hero weights over the scored combos — the denominator of `equity`. */
  readonly heroWeightBps: number;
}

export interface RangeEquityOptions {
  /** Work budget; see `DEFAULT_RANGE_EQUITY_MAX_OPS`. */
  readonly maxOps?: number;
  /** A hard ceiling on runout samples, applied on top of `maxOps`. */
  readonly maxRunouts?: number;
  /** An explicit, caller-owned memo cache. Omit for no caching. */
  readonly cache?: EquityCache;
}

/** First index with `values[i] >= target`, over `values[0..count)` sorted ascending. */
function lowerBound(values: Float64Array, count: number, target: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((values[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index with `values[i] > target`, over `values[0..count)` sorted ascending. */
function upperBound(values: Float64Array, count: number, target: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((values[mid] ?? 0) <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Result. Hero's whole range against villain's whole range on `board`.
 *
 * Both ranges are conflict-filtered against the board; hero combos and villain combos are
 * additionally filtered against each other per pair, and against each runout. Either range
 * being empty after removal is a typed `ZERO_MASS_RANGE` error.
 *
 * Preflop (`board.length === 0`) is accepted and always `SUBSAMPLED`; with 2.6M possible
 * five-card boards the runout budget can only afford a few dozen of them, so treat a preflop
 * range-vs-range number as a coarse indication and prefer `equityVsRange` per combo when the
 * precision matters.
 */
export function rangeVsRangeEquity(
  heroRange: RangeWeights,
  villainRange: RangeWeights,
  board: readonly Card[],
  options: RangeEquityOptions = {},
): StrategyResult<RangeEquityResult> {
  const boardCheck = validateBoard(board);
  if (!boardCheck.ok) return boardCheck;
  if (hasDuplicates(board)) {
    return strategyErr('INVALID_BOARD', 'The board repeats a card', { field: 'board' });
  }
  const maxOps = Math.floor(options.maxOps ?? DEFAULT_RANGE_EQUITY_MAX_OPS);
  const maxRunouts = Math.floor(options.maxRunouts ?? Number.MAX_SAFE_INTEGER);
  invariant(maxOps >= 1, `maxOps must be at least 1, got ${maxOps}`);
  invariant(maxRunouts >= 1, `maxRunouts must be at least 1, got ${maxRunouts}`);

  const cache = options.cache;
  const key =
    cache === undefined
      ? ''
      : [
          'rvr',
          cardsKey(board),
          rangeDigest(heroRange),
          rangeDigest(villainRange),
          maxOps,
          maxRunouts,
        ].join('|');
  if (cache !== undefined) {
    const hit = cache.get(key);
    if (hit !== undefined) return ok(hit as RangeEquityResult);
  }

  const computed = computeRangeEquity(heroRange, villainRange, board, maxOps, maxRunouts);
  if (computed.ok && cache !== undefined) cache.set(key, computed.value);
  return computed;
}

function activeList(
  range: RangeWeights,
  board: readonly Card[],
): { combos: number[]; weights: number[] } {
  const live = removeConflicts(range, board);
  const combos: number[] = [];
  const weights: number[] = [];
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    const weight = live.bps[combo] ?? 0;
    if (weight === 0) continue;
    combos.push(combo);
    weights.push(weight);
  }
  return { combos, weights };
}

function computeRangeEquity(
  heroRange: RangeWeights,
  villainRange: RangeWeights,
  board: readonly Card[],
  maxOps: number,
  maxRunouts: number,
): StrategyResult<RangeEquityResult> {
  const heroSide = activeList(heroRange, board);
  if (heroSide.combos.length === 0) {
    return strategyErr(
      'ZERO_MASS_RANGE',
      'Hero range has no combo left once the board is removed',
      {
        field: 'heroRange',
      },
    );
  }
  const villainSide = activeList(villainRange, board);
  if (villainSide.combos.length === 0) {
    return strategyErr(
      'ZERO_MASS_RANGE',
      'Villain range has no combo left once the board is removed',
      { field: 'villainRange' },
    );
  }

  const nHero = heroSide.combos.length;
  const nVillain = villainSide.combos.length;

  // Per-card index into the villain range: the combos that use that card. This is the
  // correction set, built once instead of once per (hero combo, runout).
  const villainWeightOf = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < nVillain; i += 1) {
    villainWeightOf[villainSide.combos[i] ?? 0] = villainSide.weights[i] ?? 0;
  }
  const villainByCard: number[][] = Array.from({ length: CARD_COUNT }, () => []);
  for (const combo of villainSide.combos) {
    const [low, high] = comboCards(combo as ComboIndex);
    villainByCard[low]?.push(combo);
    villainByCard[high]?.push(combo);
  }

  const boardSet = new Set<Card>(board);
  const deck = ALL_CARDS.filter((card) => !boardSet.has(card));
  const needed = 5 - board.length;
  const runoutSpaceSize = combinationCount(deck.length, needed);
  invariant(runoutSpaceSize > 0, 'the deck cannot produce a complete board');

  const opsPerRunout = nVillain + nHero * CORRECTION_COST;
  let runoutLimit = Math.max(1, Math.floor(maxOps / Math.max(opsPerRunout, 1)));
  if (runoutLimit > maxRunouts) runoutLimit = maxRunouts;
  const runoutRanks = indexSample(runoutSpaceSize, runoutLimit);
  const method: EquityMethod =
    runoutRanks.length === runoutSpaceSize ? ('EXACT' as const) : ('SUBSAMPLED' as const);

  // Packed sort key: strength * 2048 + comboIndex. Strength < 2^24 and combo < 2^11, so the
  // product stays well inside exact double range and the sort is a plain numeric sort.
  const COMBO_BITS = 2048;
  const packed = new Float64Array(nVillain);
  const sortedStrength = new Float64Array(nVillain);
  const cumulative = new Float64Array(nVillain + 1);
  const strengthOf = new Int32Array(COMBO_COUNT);

  const heroNumer = new Float64Array(nHero);
  const heroDenom = new Float64Array(nHero);
  const heroWin = new Float64Array(nHero);
  const heroTie = new Float64Array(nHero);
  const heroLose = new Float64Array(nHero);

  const hand: Card[] = new Array<Card>(7).fill(0 as Card);
  for (let i = 0; i < board.length; i += 1) hand[i] = board[i] ?? (0 as Card);
  const runoutIdx: number[] = new Array<number>(Math.max(needed, 1)).fill(0);
  const inRunout = new Uint8Array(CARD_COUNT);
  let trials = 0;

  for (const runoutRank of runoutRanks) {
    if (needed > 0) {
      unrankColex(runoutRank, deck.length, needed, runoutIdx);
      for (let j = 0; j < needed; j += 1) {
        const card = deck[runoutIdx[j] ?? 0] ?? (0 as Card);
        hand[board.length + j] = card;
        inRunout[card] = 1;
      }
    }

    // Villain strengths for this runout, then sorted with prefix-summed weights.
    let live = 0;
    for (let i = 0; i < nVillain; i += 1) {
      const combo = villainSide.combos[i] ?? 0;
      const low = COMBO_LOW[combo] ?? 0;
      const high = COMBO_HIGH[combo] ?? 0;
      if (inRunout[low] === 1 || inRunout[high] === 1) {
        strengthOf[combo] = -1;
        continue;
      }
      hand[5] = low as Card;
      hand[6] = high as Card;
      const strength = evaluateStrength(hand);
      strengthOf[combo] = strength;
      packed[live] = strength * COMBO_BITS + combo;
      live += 1;
    }
    if (live === 0) {
      if (needed > 0) {
        for (let j = 0; j < needed; j += 1) inRunout[deck[runoutIdx[j] ?? 0] ?? 0] = 0;
      }
      continue;
    }
    packed.subarray(0, live).sort();
    cumulative[0] = 0;
    for (let i = 0; i < live; i += 1) {
      const value = packed[i] ?? 0;
      const combo = value % COMBO_BITS;
      sortedStrength[i] = (value - combo) / COMBO_BITS;
      cumulative[i + 1] = (cumulative[i] ?? 0) + (villainWeightOf[combo] ?? 0);
    }
    const totalVillainWeight = cumulative[live] ?? 0;

    for (let h = 0; h < nHero; h += 1) {
      const heroCombo = heroSide.combos[h] ?? 0;
      const heroLow = COMBO_LOW[heroCombo] ?? 0;
      const heroHigh = COMBO_HIGH[heroCombo] ?? 0;
      if (inRunout[heroLow] === 1 || inRunout[heroHigh] === 1) continue;

      hand[5] = heroLow as Card;
      hand[6] = heroHigh as Card;
      const heroStrength = evaluateStrength(hand);

      const lo = lowerBound(sortedStrength, live, heroStrength);
      const hi = upperBound(sortedStrength, live, heroStrength);
      let below = cumulative[lo] ?? 0;
      let equal = (cumulative[hi] ?? 0) - below;
      let above = totalVillainWeight - (cumulative[hi] ?? 0);

      // Subtract the villain combos hero's own cards make impossible. The only combo in both
      // per-card lists is {heroLow, heroHigh} itself, so it is skipped once.
      const shared = comboIndexOf(heroLow as Card, heroHigh as Card);
      const listLow = villainByCard[heroLow] ?? [];
      for (let i = 0; i < listLow.length; i += 1) {
        const combo = listLow[i] ?? 0;
        const strength = strengthOf[combo] ?? -1;
        if (strength < 0) continue;
        const weight = villainWeightOf[combo] ?? 0;
        if (strength < heroStrength) below -= weight;
        else if (strength === heroStrength) equal -= weight;
        else above -= weight;
      }
      const listHigh = villainByCard[heroHigh] ?? [];
      for (let i = 0; i < listHigh.length; i += 1) {
        const combo = listHigh[i] ?? 0;
        if (combo === shared) continue;
        const strength = strengthOf[combo] ?? -1;
        if (strength < 0) continue;
        const weight = villainWeightOf[combo] ?? 0;
        if (strength < heroStrength) below -= weight;
        else if (strength === heroStrength) equal -= weight;
        else above -= weight;
      }

      const valid = below + equal + above;
      if (valid <= 0) continue;
      heroNumer[h] = (heroNumer[h] ?? 0) + below + equal / 2;
      heroDenom[h] = (heroDenom[h] ?? 0) + valid;
      heroWin[h] = (heroWin[h] ?? 0) + below;
      heroTie[h] = (heroTie[h] ?? 0) + equal;
      heroLose[h] = (heroLose[h] ?? 0) + above;
      trials += 1;
    }

    if (needed > 0) {
      for (let j = 0; j < needed; j += 1) inRunout[deck[runoutIdx[j] ?? 0] ?? 0] = 0;
    }
  }

  const perCombo: ComboEquity[] = [];
  let weightedEquity = 0;
  let weightedWin = 0;
  let weightedTie = 0;
  let weightedLose = 0;
  let heroWeightBps = 0;
  for (let h = 0; h < nHero; h += 1) {
    const denom = heroDenom[h] ?? 0;
    if (denom <= 0) continue;
    const weightBps = heroSide.weights[h] ?? 0;
    const equity = (heroNumer[h] ?? 0) / denom;
    const winProb = (heroWin[h] ?? 0) / denom;
    const tieProb = (heroTie[h] ?? 0) / denom;
    const loseProb = (heroLose[h] ?? 0) / denom;
    perCombo.push({
      combo: (heroSide.combos[h] ?? 0) as ComboIndex,
      weightBps,
      winProb,
      tieProb,
      loseProb,
      equity,
      villainWeightBps: denom,
    });
    weightedEquity += weightBps * equity;
    weightedWin += weightBps * winProb;
    weightedTie += weightBps * tieProb;
    weightedLose += weightBps * loseProb;
    heroWeightBps += weightBps;
  }

  if (heroWeightBps === 0) {
    return strategyErr(
      'ZERO_MASS_RANGE',
      'No hero combo could be scored against the villain range on this board',
      { field: 'heroRange' },
    );
  }

  return ok({
    equity: weightedEquity / heroWeightBps,
    winProb: weightedWin / heroWeightBps,
    tieProb: weightedTie / heroWeightBps,
    loseProb: weightedLose / heroWeightBps,
    perCombo,
    method,
    evaluatedRunouts: runoutRanks.length,
    runoutSpaceSize,
    evaluatedTrials: trials,
    heroComboCount: nHero,
    villainComboCount: nVillain,
    heroWeightBps,
  });
}

export interface EquityDistribution {
  /** Every scored hero combo, DESCENDING by equity, ties broken by ascending combo index. */
  readonly entries: readonly ComboEquity[];
  /** `cumulativeBps[i]` = hero weight of `entries[0 .. i-1]`. Length `entries.length + 1`. */
  readonly cumulativeBps: readonly number[];
  readonly aggregate: RangeEquityResult;
}

/**
 * Result. The same computation as `rangeVsRangeEquity`, presented as a distribution: hero's
 * combos ordered by how much equity they have against this villain range, with a cumulative
 * weight column so a policy can ask "the top 20% of my range by equity" in one binary search.
 *
 * It is a thin re-presentation, not a second computation — the aggregate is carried along
 * unchanged so a caller never has to run the enumeration twice.
 */
export function equityDistribution(
  heroRange: RangeWeights,
  villainRange: RangeWeights,
  board: readonly Card[],
  options: RangeEquityOptions = {},
): StrategyResult<EquityDistribution> {
  const result = rangeVsRangeEquity(heroRange, villainRange, board, options);
  if (!result.ok) return result;
  const entries = [...result.value.perCombo].sort(
    (a, b) => b.equity - a.equity || a.combo - b.combo,
  );
  const cumulativeBps: number[] = new Array<number>(entries.length + 1).fill(0);
  for (let i = 0; i < entries.length; i += 1) {
    cumulativeBps[i + 1] = (cumulativeBps[i] ?? 0) + (entries[i]?.weightBps ?? 0);
  }
  return ok({ entries, cumulativeBps, aggregate: result.value });
}

/**
 * Total. The weighted fraction of hero's range, 0..1, whose equity is at or above `equity`.
 * The "how often am I at the top of my own range here" number, in one call.
 *
 * `equity` MUST be the same kind of number as `dist.entries[].equity`: hero-combo equity
 * against the very villain range this distribution was built against. Passing an equity
 * measured against a different opponent set — a pooled multiway number, say — produces a
 * quantile of one distribution's value inside another's, which means nothing. The distribution
 * carries no opponent identity, so this cannot be checked here; it is the caller's contract.
 */
export function equityQuantile(dist: EquityDistribution, equity: number): number {
  const total = dist.aggregate.heroWeightBps;
  if (total === 0) return 0;
  let lo = 0;
  let hi = dist.entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((dist.entries[mid]?.equity ?? 0) >= equity) lo = mid + 1;
    else hi = mid;
  }
  return (dist.cumulativeBps[lo] ?? 0) / total;
}
