/**
 * Deterministic equity: hero's expected share of a showdown against one or more weighted
 * opponent ranges, on any board from an empty one to a river.
 *
 * This is ANALYSIS, not settlement. Nothing here divides a pot; `poker-core` owns that and
 * is untouched. The output is a set of probabilities and a share, all plain `0..1` numbers
 * (see `model.ts` on why floats are correct here and money still is not).
 *
 * ## The enumeration, in one picture
 *
 * ```
 * for each RUNOUT r          (the cards still to come, from the deck minus hero minus board)
 *     heroStrength = eval(board + r + hero)                            <- 1 evaluation
 *     for each villain COMBO c in the union of the villain ranges
 *         strength[c] = eval(board + r + c)                            <- shared by all villains
 *     for each ASSIGNMENT (c_1, ..., c_V), one combo per villain
 *         score hero against strength[c_1] .. strength[c_V]            <- comparisons only
 * ```
 *
 * Runout-outer is the load-bearing choice. Each villain combo's strength on a given runout
 * does not depend on which villain holds it or on what the others hold, so it is computed
 * ONCE per runout and then reused by every assignment. Heads-up that halves the work; three
 * ways it turns a cubic evaluation count into a quadratic comparison count.
 *
 * ## Card removal
 *
 * Applied in three places, all of them before any arithmetic:
 *
 * 1. every villain range is `removeConflicts`ed against hero's cards and the board, so a
 *    villain can never hold a card that is already visible;
 * 2. an assignment in which two villains hold the same card is discarded;
 * 3. a runout that collides with an assignment's cards is skipped for that assignment.
 *
 * The denominator is the weight of what was actually scored, so removal shows up as a
 * changed weighting rather than as a fudge factor. A range with no live combo left, or a
 * lineup with no conflict-free assignment, is a typed `ZERO_MASS_RANGE` error — never a NaN
 * and never a silent 0.5.
 *
 * ## Exactness
 *
 * | board  | runouts   | heads-up trials | method with the default budget |
 * | ------ | --------- | --------------- | ------------------------------ |
 * | river  | 1         | ~1.1k           | EXACT                          |
 * | turn   | 46        | ~50k            | EXACT                          |
 * | flop   | 1081      | ~1.17M          | EXACT                          |
 * | preflop| 2,118,760 | ~2.6G           | SUBSAMPLED (always)            |
 *
 * Preflop is supported rather than refused, because "no number" is worse for the user than
 * "a reproducible estimate, labelled as one". It is ALWAYS reported as `SUBSAMPLED`, whatever
 * the budget, and the measured accuracy is in the WP report.
 */
import { ALL_CARDS, hasDuplicates, invariant, isCard, ok, type Card } from '@gto-self/shared';
import { strategyErr, type StrategyResult } from '../errors.js';
import { evaluateStrength } from '../analysis/evaluate.js';
import { COMBO_COUNT } from '../range/combo.js';
import { removeConflicts, type RangeWeights } from '../range/weights.js';
import { cardsKey, rangeDigest, type EquityCache } from './cache.js';
import { COMBO_HIGH, COMBO_LOW } from './tables.js';
import {
  DEFAULT_EQUITY_BUDGET,
  MAX_VILLAIN_RANGES,
  type EquityBudget,
  type EquityMethod,
  type EquityResult,
} from './model.js';
import { combinationCount, indexSample, unrankColex } from './sampling.js';

/** A board is a legal poker board only at these lengths. */
const LEGAL_BOARD_LENGTHS = new Set([0, 3, 4, 5]);
const FULL_BOARD = 5;

// ---------------------------------------------------------------------------
// Input validation — the door for data this package did not produce
// ---------------------------------------------------------------------------

/** Result. A board is 0, 3, 4 or 5 distinct real cards. */
export function validateBoard(board: readonly Card[]): StrategyResult<readonly Card[]> {
  if (!LEGAL_BOARD_LENGTHS.has(board.length)) {
    return strategyErr('INVALID_BOARD', `A board has 0, 3, 4 or 5 cards, got ${board.length}`, {
      field: 'board',
      actual: board.length,
    });
  }
  for (const card of board) {
    if (!isCard(card)) {
      return strategyErr('INVALID_BOARD', `Not a card: ${String(card)}`, {
        field: 'board',
        value: String(card),
      });
    }
  }
  if (hasDuplicates(board)) {
    return strategyErr('INVALID_BOARD', 'The board repeats a card', { field: 'board' });
  }
  return ok(board);
}

/** Result. Hero holds exactly two distinct real cards, neither of them on the board. */
export function validateHeroCards(
  hero: readonly Card[],
  board: readonly Card[],
): StrategyResult<readonly [Card, Card]> {
  if (hero.length !== 2) {
    return strategyErr('INVALID_HERO_CARDS', `Hero holds two cards, got ${hero.length}`, {
      field: 'heroCards',
      actual: hero.length,
    });
  }
  const [a, b] = hero;
  if (a === undefined || b === undefined || !isCard(a) || !isCard(b)) {
    return strategyErr('INVALID_HERO_CARDS', 'Hero cards are not both cards', {
      field: 'heroCards',
    });
  }
  if (a === b) {
    return strategyErr('INVALID_HERO_CARDS', 'Hero cards are the same card', {
      field: 'heroCards',
    });
  }
  for (const card of board) {
    if (card === a || card === b) {
      return strategyErr('INVALID_HERO_CARDS', 'A hero card is already on the board', {
        field: 'heroCards',
        value: String(card),
      });
    }
  }
  return ok([a, b]);
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EquityOptions extends Partial<EquityBudget> {
  /**
   * An explicit, caller-owned memo cache (`createEquityCache()`). Omit it and no caching
   * happens at all. A hit returns the identical result object a miss would have produced.
   */
  readonly cache?: EquityCache;
}

function resolveBudget(options: EquityOptions | undefined): EquityBudget {
  const maxTrials = options?.maxTrials ?? DEFAULT_EQUITY_BUDGET.maxTrials;
  const maxAssignments = options?.maxAssignments ?? DEFAULT_EQUITY_BUDGET.maxAssignments;
  const minRunoutSamples = options?.minRunoutSamples ?? DEFAULT_EQUITY_BUDGET.minRunoutSamples;
  const maxRunoutSamples = options?.maxRunoutSamples ?? DEFAULT_EQUITY_BUDGET.maxRunoutSamples;
  invariant(maxTrials >= 1, `maxTrials must be at least 1, got ${maxTrials}`);
  invariant(maxAssignments >= 1, `maxAssignments must be at least 1, got ${maxAssignments}`);
  invariant(minRunoutSamples >= 1, `minRunoutSamples must be at least 1, got ${minRunoutSamples}`);
  invariant(maxRunoutSamples >= 1, `maxRunoutSamples must be at least 1, got ${maxRunoutSamples}`);
  return {
    maxTrials: Math.floor(maxTrials),
    maxAssignments: Math.floor(maxAssignments),
    minRunoutSamples: Math.floor(minRunoutSamples),
    maxRunoutSamples: Math.floor(maxRunoutSamples),
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Heads-up equity: hero's two cards against ONE weighted villain range on `board`.
 *
 * Exact on the flop, turn and river with the default budget; an explicitly labelled
 * `SUBSAMPLED` estimate preflop. See the table at the top of this file.
 */
export function equityVsRange(
  heroCards: readonly Card[],
  board: readonly Card[],
  villain: RangeWeights,
  options?: EquityOptions,
): StrategyResult<EquityResult> {
  return equityVsRanges(heroCards, board, [villain], options);
}

/**
 * Multiway equity: hero against `villains.length` independent weighted ranges, all in the
 * pot to showdown simultaneously. Hero WINS only by beating every villain; a tie with `t`
 * villains pays hero `1 / (1 + t)`.
 *
 * The villain ranges are treated as independent priors and then made mutually consistent by
 * discarding every assignment in which two villains hold the same card. That is card removal,
 * not a correlation model: this engine does not know why a villain's range is what it is.
 *
 * ORDER MATTERS ONLY WHEN SAMPLING. With an exhaustive cross-product the answer is
 * independent of the order the ranges are passed in; once the cross-product is sampled, the
 * mixed-radix decoding makes the SAMPLE depend on that order, so reordering can move the
 * estimate within its error bound. The order is part of the cache key for that reason.
 */
export function equityVsRanges(
  heroCards: readonly Card[],
  board: readonly Card[],
  villains: readonly RangeWeights[],
  options?: EquityOptions,
): StrategyResult<EquityResult> {
  const boardCheck = validateBoard(board);
  if (!boardCheck.ok) return boardCheck;
  const heroCheck = validateHeroCards(heroCards, board);
  if (!heroCheck.ok) return heroCheck;
  invariant(villains.length >= 1, 'equity needs at least one villain range');
  invariant(
    villains.length <= MAX_VILLAIN_RANGES,
    `at most ${MAX_VILLAIN_RANGES} villain ranges (six-max), got ${villains.length}`,
  );
  const budget = resolveBudget(options);
  const hero = heroCheck.value;

  const cache = options?.cache;
  const key =
    cache === undefined
      ? ''
      : [
          'eq',
          cardsKey(hero),
          cardsKey(board),
          villains.map((range) => rangeDigest(range)).join('&'),
          `${budget.maxTrials},${budget.maxAssignments},${budget.minRunoutSamples},${budget.maxRunoutSamples}`,
        ].join('|');
  if (cache !== undefined) {
    const hit = cache.get(key);
    if (hit !== undefined) return ok(hit as EquityResult);
  }

  const computed = computeEquity(hero, board, villains, budget);
  if (computed.ok && cache !== undefined) cache.set(key, computed.value);
  return computed;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

interface VillainList {
  /** Active combo indices, ASCENDING. */
  readonly combos: number[];
  /** Parallel to `combos`: the combo's weight in basis points. */
  readonly weights: number[];
}

function buildVillainLists(
  villains: readonly RangeWeights[],
  dead: readonly Card[],
): StrategyResult<VillainList[]> {
  const lists: VillainList[] = [];
  for (let v = 0; v < villains.length; v += 1) {
    const range = villains[v];
    if (range === undefined) continue;
    const live = removeConflicts(range, dead);
    const combos: number[] = [];
    const weights: number[] = [];
    for (let combo = 0; combo < COMBO_COUNT; combo += 1) {
      const weight = live.bps[combo] ?? 0;
      if (weight === 0) continue;
      combos.push(combo);
      weights.push(weight);
    }
    if (combos.length === 0) {
      return strategyErr(
        'ZERO_MASS_RANGE',
        `Villain range ${v} has no combo left once hero's cards and the board are removed`,
        { field: `villains[${v}]`, index: v },
      );
    }
    lists.push({ combos, weights });
  }
  return ok(lists);
}

/** The villain cross-product, sampled if need be, with mutual card conflicts discarded. */
interface AssignmentTable {
  /** `assignments[a * villainCount + v]` = the combo villain `v` holds in assignment `a`. */
  readonly assignments: Int32Array;
  /** `weight[a]` = the product of the per-villain basis-point weights. */
  readonly weight: Float64Array;
  readonly count: number;
  readonly spaceSize: number;
  readonly exhaustive: boolean;
  /** Every combo that appears anywhere in the table, ascending. */
  readonly unionCombos: Int32Array;
}

function buildAssignments(lists: readonly VillainList[], maxAssignments: number): AssignmentTable {
  const villainCount = lists.length;
  const sizes = lists.map((list) => list.combos.length);
  let spaceSize = 1;
  for (const size of sizes) spaceSize *= size;
  invariant(
    2 * spaceSize <= Number.MAX_SAFE_INTEGER,
    `villain cross-product ${spaceSize} exceeds exact integer arithmetic`,
  );

  const ranks = indexSample(spaceSize, maxAssignments);
  const exhaustive = ranks.length === spaceSize;

  const assignments = new Int32Array(ranks.length * villainCount);
  const weight = new Float64Array(ranks.length);
  const inUnion = new Uint8Array(COMBO_COUNT);
  const cards: number[] = new Array<number>(villainCount * 2).fill(-1);
  let count = 0;

  for (const rank of ranks) {
    let rest = rank;
    let product = 1;
    let conflict = false;
    for (let v = 0; v < villainCount; v += 1) {
      const size = sizes[v] ?? 1;
      const digit = rest % size;
      rest = Math.floor(rest / size);
      const list = lists[v];
      const combo = list?.combos[digit] ?? 0;
      const low = COMBO_LOW[combo] ?? 0;
      const high = COMBO_HIGH[combo] ?? 0;
      for (let k = 0; k < v * 2; k += 1) {
        const used = cards[k] ?? -1;
        if (used === low || used === high) {
          conflict = true;
          break;
        }
      }
      if (conflict) break;
      cards[v * 2] = low;
      cards[v * 2 + 1] = high;
      assignments[count * villainCount + v] = combo;
      product *= list?.weights[digit] ?? 0;
    }
    if (conflict) continue;
    weight[count] = product;
    for (let v = 0; v < villainCount; v += 1) {
      const combo = assignments[count * villainCount + v] ?? 0;
      inUnion[combo] = 1;
    }
    count += 1;
  }

  const union: number[] = [];
  for (let combo = 0; combo < COMBO_COUNT; combo += 1) if (inUnion[combo] === 1) union.push(combo);

  return {
    assignments,
    weight,
    count,
    spaceSize,
    exhaustive,
    unionCombos: Int32Array.from(union),
  };
}

function computeEquity(
  hero: readonly [Card, Card],
  board: readonly Card[],
  villains: readonly RangeWeights[],
  budget: EquityBudget,
): StrategyResult<EquityResult> {
  const dead: Card[] = [...board, hero[0], hero[1]];
  const lists = buildVillainLists(villains, dead);
  if (!lists.ok) return lists;
  const villainCount = lists.value.length;

  const table = buildAssignments(lists.value, budget.maxAssignments);
  if (table.count === 0) {
    return strategyErr(
      'ZERO_MASS_RANGE',
      'No villain combination is free of card conflicts — every combination has two villains sharing a card',
      { field: 'villains' },
    );
  }

  // The runout space: the cards still to come, drawn from what neither hero nor the board
  // holds. `needed === 0` on the river gives exactly one runout, the empty one.
  const deadSet = new Set<Card>(dead);
  const deck = ALL_CARDS.filter((card) => !deadSet.has(card));
  const needed = FULL_BOARD - board.length;
  const runoutSpaceSize = combinationCount(deck.length, needed);
  invariant(runoutSpaceSize > 0, 'the deck cannot produce a complete board');

  let runoutLimit = Math.floor(budget.maxTrials / table.count);
  if (runoutLimit < budget.minRunoutSamples) runoutLimit = budget.minRunoutSamples;
  if (runoutLimit > budget.maxRunoutSamples) runoutLimit = budget.maxRunoutSamples;
  const runoutRanks = indexSample(runoutSpaceSize, runoutLimit);
  const runoutsExhaustive = runoutRanks.length === runoutSpaceSize;
  const method: EquityMethod =
    table.exhaustive && runoutsExhaustive ? ('EXACT' as const) : ('SUBSAMPLED' as const);

  // --- the hot loop ------------------------------------------------------------------
  const hand: Card[] = new Array<Card>(7).fill(0 as Card);
  for (let i = 0; i < board.length; i += 1) hand[i] = board[i] ?? (0 as Card);
  const runoutIdx: number[] = new Array<number>(Math.max(needed, 1)).fill(0);
  const strengthOf = new Int32Array(COMBO_COUNT);
  const inRunout = new Uint8Array(52);
  const union = table.unionCombos;

  let winWeight = 0;
  let loseWeight = 0;
  const tieWeight = new Float64Array(villainCount + 1);
  let scoredWeight = 0;
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

    hand[5] = hero[0];
    hand[6] = hero[1];
    const heroStrength = evaluateStrength(hand);

    for (let u = 0; u < union.length; u += 1) {
      const combo = union[u] ?? 0;
      const low = COMBO_LOW[combo] ?? 0;
      const high = COMBO_HIGH[combo] ?? 0;
      if (inRunout[low] === 1 || inRunout[high] === 1) {
        strengthOf[combo] = -1;
        continue;
      }
      hand[5] = low as Card;
      hand[6] = high as Card;
      strengthOf[combo] = evaluateStrength(hand);
    }

    for (let a = 0; a < table.count; a += 1) {
      const base = a * villainCount;
      let live = true;
      let tied = 0;
      let beaten = false;
      for (let v = 0; v < villainCount; v += 1) {
        const strength = strengthOf[table.assignments[base + v] ?? 0] ?? -1;
        if (strength < 0) {
          live = false;
          break;
        }
        if (strength > heroStrength) beaten = true;
        else if (strength === heroStrength) tied += 1;
      }
      if (!live) continue;
      const weight = table.weight[a] ?? 0;
      scoredWeight += weight;
      trials += 1;
      if (beaten) loseWeight += weight;
      else if (tied === 0) winWeight += weight;
      else tieWeight[tied] = (tieWeight[tied] ?? 0) + weight;
    }

    if (needed > 0) {
      for (let j = 0; j < needed; j += 1) inRunout[deck[runoutIdx[j] ?? 0] ?? 0] = 0;
    }
  }

  if (scoredWeight === 0) {
    return strategyErr(
      'ZERO_MASS_RANGE',
      'No (villain combination, runout) pair survived card removal, so equity is undefined',
      { field: 'villains' },
    );
  }

  let tieTotal = 0;
  let tieShare = 0;
  for (let t = 1; t <= villainCount; t += 1) {
    const weight = tieWeight[t] ?? 0;
    tieTotal += weight;
    tieShare += weight / (t + 1);
  }

  return ok({
    winProb: winWeight / scoredWeight,
    tieProb: tieTotal / scoredWeight,
    loseProb: loseWeight / scoredWeight,
    equity: (winWeight + tieShare) / scoredWeight,
    method,
    evaluatedRunouts: runoutRanks.length,
    runoutSpaceSize,
    evaluatedTrials: trials,
    assignmentCount: table.count,
    assignmentSpaceSize: table.spaceSize,
    villainCount,
    scoredWeight,
  });
}
