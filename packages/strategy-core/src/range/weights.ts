/**
 * `RangeWeights` — an integer weight in basis points for every one of the 1326 combos.
 *
 * Representation: a `Uint16Array` of length 1326, index = `ComboIndex`. Uint16 exactly
 * holds 0..10000 and keeps a range at 2.6 KB, which matters because a hand's analysis
 * carries one range per player per street.
 *
 * IMMUTABILITY IS BY CONVENTION, ENFORCED BY THE API: every operation returns a NEW
 * `RangeWeights`; nothing here mutates its input, and the backing array is never handed out
 * except through `copyWeights()`. Do not write into `.bps` — TypeScript cannot make a typed
 * array readonly at the element level, so this is the one rule the compiler will not keep
 * for you.
 *
 * Every operation is pure and deterministic: iteration is always ascending combo index and
 * every rounding goes through the largest-remainder schemes in `../bps.ts`.
 */
import { invariant, ok, type Card } from '@gto-self/shared';
import { apportion, BPS_FULL, BPS_TOTAL, divideByBpsTotal, isBps, type Bps } from '../bps.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import { ALL_COMBOS, comboCards, COMBO_COUNT, isComboIndex, type ComboIndex } from './combo.js';
import {
  HAND_CLASS_COUNT,
  HAND_CLASSES,
  handClassIndexOfCombo,
  type HandClass,
  type HandClassIndex,
} from './handClass.js';

/**
 * A weight per combo. `kind` exists so a range can never be passed where per-combo action
 * frequencies are expected, and vice versa — they have identical backing but opposite
 * meanings.
 */
export interface RangeWeights {
  readonly kind: 'RangeWeights';
  /** Length 1326. Never mutate. */
  readonly bps: Uint16Array;
}

/** `P(action | combo)` for one action, per combo. Not a range: it does not sum to anything. */
export interface ComboFrequencies {
  readonly kind: 'ComboFrequencies';
  /** Length 1326. Never mutate. */
  readonly bps: Uint16Array;
}

function wrapRange(bps: Uint16Array): RangeWeights {
  return { kind: 'RangeWeights', bps };
}

function wrapFrequencies(bps: Uint16Array): ComboFrequencies {
  return { kind: 'ComboFrequencies', bps };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/** Total. Every combo at weight 0. */
export function emptyRange(): RangeWeights {
  return wrapRange(new Uint16Array(COMBO_COUNT));
}

/**
 * Total. Every combo at the same weight (default 100%). This is the "any two cards"
 * universe, NOT a strategy claim — no combo is preferred over another.
 */
export function uniformRange(weight: Bps = BPS_FULL): RangeWeights {
  const bps = new Uint16Array(COMBO_COUNT);
  bps.fill(weight);
  return wrapRange(bps);
}

/** Throws on an out-of-range weight (programmer error). Builds a range from a function. */
export function rangeFrom(weightOf: (combo: ComboIndex) => number): RangeWeights {
  const bps = new Uint16Array(COMBO_COUNT);
  for (const combo of ALL_COMBOS) {
    const weight = weightOf(combo);
    invariant(isBps(weight), `weight for combo ${combo} out of range: ${weight}`);
    bps[combo] = weight;
  }
  return wrapRange(bps);
}

/**
 * Result. Builds a range from explicit `(combo, weight)` pairs; every other combo is 0.
 * The door for data this package did not produce: a bad index or weight is refused, never
 * clamped silently. A repeated combo index OVERWRITES — last entry wins, documented so the
 * behaviour is not an accident of iteration order.
 */
export function rangeFromEntries(
  entries: readonly (readonly [number, number])[],
): StrategyResult<RangeWeights> {
  const bps = new Uint16Array(COMBO_COUNT);
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined) continue;
    const [combo, weight] = entry;
    if (!isComboIndex(combo)) {
      return strategyErr('INVALID_COMBO_INDEX', `Combo index out of range: ${combo}`, {
        index: i,
        value: String(combo),
        min: 0,
        max: COMBO_COUNT - 1,
      });
    }
    if (!isBps(weight)) {
      return strategyErr('INVALID_BPS', `Weight out of range: ${weight}`, {
        index: i,
        value: String(weight),
        min: 0,
        max: BPS_TOTAL,
      });
    }
    bps[combo] = weight;
  }
  return ok(wrapRange(bps));
}

/** Throws on an out-of-range value. Builds per-combo action frequencies from a function. */
export function comboFrequenciesFrom(frequencyOf: (combo: ComboIndex) => number): ComboFrequencies {
  const bps = new Uint16Array(COMBO_COUNT);
  for (const combo of ALL_COMBOS) {
    const value = frequencyOf(combo);
    invariant(isBps(value), `frequency for combo ${combo} out of range: ${value}`);
    bps[combo] = value;
  }
  return wrapFrequencies(bps);
}

/** Total. A uniform action frequency for every combo. Useful for tests and for "always". */
export function uniformFrequencies(value: Bps): ComboFrequencies {
  const bps = new Uint16Array(COMBO_COUNT);
  bps.fill(value);
  return wrapFrequencies(bps);
}

/** Total. A defensive copy of the backing array, safe to mutate. */
export function copyWeights(range: RangeWeights): Uint16Array {
  return Uint16Array.from(range.bps);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Total. The weight of one combo. */
export function weightAt(range: RangeWeights, combo: ComboIndex): Bps {
  return (range.bps[combo] ?? 0) as Bps;
}

/** Total. A copy with one combo's weight replaced. */
export function withWeight(range: RangeWeights, combo: ComboIndex, weight: Bps): RangeWeights {
  const bps = copyWeights(range);
  bps[combo] = weight;
  return wrapRange(bps);
}

/** Total. Sum of every weight, in basis points. Up to 1326 * 10000. */
export function totalWeightBps(range: RangeWeights): number {
  let total = 0;
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) total += range.bps[combo] ?? 0;
  return total;
}

/** Total. How many combos carry a non-zero weight. */
export function activeComboCount(range: RangeWeights): number {
  let count = 0;
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) if ((range.bps[combo] ?? 0) > 0) count += 1;
  return count;
}

/**
 * Total. The fraction of the universe this range covers, 0..1, as a plain number (a ratio,
 * never money — CLAUDE.md rule 1).
 *
 * Denominator is the number of combos in the universe, times full weight. Pass
 * `universeCombos` when card removal has shrunk the universe (e.g. after `removeConflicts`
 * with a 3-card board the honest denominator is 1176, not 1326) so the percentage answers
 * "of the hands still possible", not "of the hands dealt in a vacuum".
 */
export function rangePercentage(range: RangeWeights, universeCombos = COMBO_COUNT): number {
  if (universeCombos <= 0) return 0;
  return totalWeightBps(range) / (universeCombos * BPS_TOTAL);
}

/** Total. `(combo, weight)` pairs, ascending by combo, zero weights omitted by default. */
export function toEntries(
  range: RangeWeights,
  options: { readonly includeZero?: boolean } = {},
): readonly (readonly [ComboIndex, Bps])[] {
  const out: (readonly [ComboIndex, Bps])[] = [];
  for (const combo of ALL_COMBOS) {
    const weight = range.bps[combo] ?? 0;
    if (weight === 0 && options.includeZero !== true) continue;
    out.push([combo, weight as Bps]);
  }
  return out;
}

export interface WeightedCombo {
  readonly combo: ComboIndex;
  readonly cards: readonly [Card, Card];
  readonly weightBps: Bps;
}

/**
 * Total. Iterates the range in ascending combo order. Zero-weight combos are skipped
 * unless `includeZero` is set, so the common case walks only what is actually in the range.
 */
export function* enumerateCombos(
  range: RangeWeights,
  options: { readonly includeZero?: boolean } = {},
): Generator<WeightedCombo> {
  for (const combo of ALL_COMBOS) {
    const weight = range.bps[combo] ?? 0;
    if (weight === 0 && options.includeZero !== true) continue;
    yield { combo, cards: comboCards(combo), weightBps: weight as Bps };
  }
}

/** Total. Element-wise equality. */
export function rangesEqual(a: RangeWeights, b: RangeWeights): boolean {
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    if ((a.bps[combo] ?? 0) !== (b.bps[combo] ?? 0)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Total. Zeroes every combo that uses one of `cards` — the board, another player's known
 * holding, anything already accounted for. Card removal is a fact about the deck, so it is
 * applied by zeroing, never by rescaling: the caller decides whether to renormalize after.
 */
export function removeConflicts(range: RangeWeights, cards: readonly Card[]): RangeWeights {
  if (cards.length === 0) return wrapRange(copyWeights(range));
  const blocked = new Set<Card>(cards);
  const bps = copyWeights(range);
  for (const combo of ALL_COMBOS) {
    if ((bps[combo] ?? 0) === 0) continue;
    const [low, high] = comboCards(combo);
    if (blocked.has(low) || blocked.has(high)) bps[combo] = 0;
  }
  return wrapRange(bps);
}

/** Total. The number of combos that survive removal of `cards` — the honest denominator. */
export function universeAfterRemoval(cards: readonly Card[]): number {
  const distinct = new Set<Card>(cards).size;
  const remaining = 52 - distinct;
  if (remaining < 2) return 0;
  return (remaining * (remaining - 1)) / 2;
}

/**
 * Total. Bayesian update of a range by one action:
 *
 *     nextWeight[c] = priorWeight[c] * P(action | c)
 *
 * Both factors are basis points, so the product is in bps-squared and one division by
 * 10000 brings it back. The division is the largest-remainder scheme in
 * `divideByBpsTotal`: the sub-basis-point residue is redistributed rather than discarded,
 * so a range of 200 combos at 5000 bps each does not silently lose mass to floors.
 *
 * Edge cases, all exercised by the tests:
 * - a combo the prior gives weight 0 stays 0 (0 * anything = 0);
 * - an action with frequency 0 for every combo yields the empty range — that is the honest
 *   answer ("this action never happens with this range"), and it is NOT renormalized here;
 * - the result is never renormalized at all. Conditioning shrinks a range; use
 *   `normalizeRange` explicitly if you want relative frequencies back.
 */
export function applyActionStrategy(
  prior: RangeWeights,
  strategyPerCombo: ComboFrequencies,
): RangeWeights {
  const products: number[] = new Array<number>(COMBO_COUNT);
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    products[combo] = (prior.bps[combo] ?? 0) * (strategyPerCombo.bps[combo] ?? 0);
  }
  const divided = divideByBpsTotal(products);
  const bps = new Uint16Array(COMBO_COUNT);
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    const value = divided[combo] ?? 0;
    invariant(value <= BPS_TOTAL, `propagated weight overflowed basis points: ${value}`);
    bps[combo] = value;
  }
  return wrapRange(bps);
}

/**
 * Result. Rescales the range so that its weights sum to EXACTLY `targetTotalBps`, using the
 * largest-remainder apportionment in `../bps.ts`. Zero-weight combos stay zero.
 *
 * Refuses rather than guessing when:
 * - the range is empty and the target is positive (`NORMALIZATION_UNDEFINED`) — there is no
 *   proportion to spread;
 * - the target cannot fit under the 10000-bps-per-combo ceiling (`INVALID_TOTAL`), e.g.
 *   normalizing a 3-combo range to 100000.
 */
export function normalizeRange(
  range: RangeWeights,
  targetTotalBps: number,
): StrategyResult<RangeWeights> {
  const values: number[] = new Array<number>(COMBO_COUNT);
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) values[combo] = range.bps[combo] ?? 0;
  const apportioned = apportion(values, targetTotalBps);
  if (!apportioned.ok) return apportioned;
  const bps = new Uint16Array(COMBO_COUNT);
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
    const value = apportioned.value[combo] ?? 0;
    if (value > BPS_TOTAL) {
      return strategyErr(
        'INVALID_TOTAL',
        `Normalizing to ${targetTotalBps} bps needs ${value} bps on combo ${combo}, above the ${BPS_TOTAL} ceiling`,
        { index: combo, actual: value, max: BPS_TOTAL },
      );
    }
    bps[combo] = value;
  }
  return ok(wrapRange(bps));
}

/**
 * Result. Normalizes so the range's total weight equals `activeCombos * 10000` — i.e. the
 * average weight of an included combo becomes 100%. The usual "renormalize after
 * conditioning" convenience.
 */
export function normalizeToFullWeight(range: RangeWeights): StrategyResult<RangeWeights> {
  return normalizeRange(range, activeComboCount(range) * BPS_TOTAL);
}

// ---------------------------------------------------------------------------
// 169-class aggregation
// ---------------------------------------------------------------------------

export interface HandClassAggregate {
  readonly handClass: HandClass;
  /** Combos of this class that exist at all (6 / 4 / 12). Constant per class. */
  readonly totalCombos: number;
  /** Combos of this class carrying a non-zero weight. */
  readonly activeCombos: number;
  /** Sum of the class's combo weights, in basis points. 0..totalCombos*10000. */
  readonly weightSumBps: number;
  /**
   * `weightSumBps / (totalCombos * 10000)`, 0..1 — the share of this cell that is in the
   * range. A ratio, never money. Float division of two integers, so it is deterministic.
   */
  readonly fraction: number;
}

export interface HandClassMatrix {
  /** 169 entries in matrix order (`row * 13 + col`). */
  readonly cells: readonly HandClassAggregate[];
  readonly totalWeightBps: number;
  readonly activeCombos: number;
}

/**
 * Total. Folds the 1326 combos into the 13x13 matrix. Combo counts and weight sums are both
 * reported: a cell at 2000 bps could be one combo at 20% or four combos at 5%, and a chart
 * that shows only the fraction hides that difference.
 */
export function aggregateToHandClasses(range: RangeWeights): HandClassMatrix {
  const weightSums = new Float64Array(HAND_CLASS_COUNT);
  const activeCounts = new Uint16Array(HAND_CLASS_COUNT);
  let totalWeight = 0;
  let totalActive = 0;
  for (const combo of ALL_COMBOS) {
    const weight = range.bps[combo] ?? 0;
    if (weight === 0) continue;
    const classIndex: HandClassIndex = handClassIndexOfCombo(combo);
    weightSums[classIndex] = (weightSums[classIndex] ?? 0) + weight;
    activeCounts[classIndex] = (activeCounts[classIndex] ?? 0) + 1;
    totalWeight += weight;
    totalActive += 1;
  }
  const cells = HAND_CLASSES.map<HandClassAggregate>((handClass) => {
    const weightSumBps = weightSums[handClass.index] ?? 0;
    return {
      handClass,
      totalCombos: handClass.comboCount,
      activeCombos: activeCounts[handClass.index] ?? 0,
      weightSumBps,
      fraction: weightSumBps / (handClass.comboCount * BPS_TOTAL),
    };
  });
  return { cells, totalWeightBps: totalWeight, activeCombos: totalActive };
}

/**
 * Total. Every concrete combo of a hand class, ascending by combo index. Used to expand a
 * class-level weight into the concrete combos the range model works in.
 */
export function combosOfHandClass(handClass: HandClass): readonly ComboIndex[] {
  const out: ComboIndex[] = [];
  for (const combo of ALL_COMBOS) {
    if (handClassIndexOfCombo(combo) === handClass.index) out.push(combo);
  }
  return out;
}
