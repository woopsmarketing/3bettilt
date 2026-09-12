/**
 * ONE measurement: a starting-hand class's all-in preflop equity against a uniformly random
 * legal opponent hand.
 *
 * This is the whole methodology in one function, and it is exported rather than buried in
 * the generator on purpose. The dataset's claim is "run it yourself and you get this", so
 * the thing that produced the numbers has to be reachable — by the offline generator, by
 * the fast test that recomputes a couple of classes cheaply, and by anyone who doubts a
 * number. There is no second implementation anywhere.
 *
 * ## It measures ONE combo per class, and that is exact reasoning, not a shortcut
 *
 * Poker has no suit order: relabelling the four suits by any permutation `sigma` leaves
 * every hand ranking unchanged. `sigma` is a bijection on the 52 cards, so it is also a
 * bijection on the 1326 two-card combos and on the 5-card boards. Apply it to hero, to the
 * opponent and to the runout at once and the showdown result is identical.
 *
 * Now take two combos `c` and `c'` of the same class — say `A♠K♠` and `A♦K♦`. Some suit
 * permutation maps one to the other. The opponent's distribution is UNIFORM over every
 * legal hand and the runout is uniform over the remaining deck, and both of those
 * distributions are invariant under `sigma`. So the whole experiment for `c'` is the image
 * under `sigma` of the experiment for `c`, and the two true equities are EQUAL. Measuring
 * all 4 / 6 / 12 combos of a class would be measuring the same number several times:
 * 169 measurements, not 1326.
 *
 * The shipped dataset enumerates exhaustively, which turns that equality from an argument
 * into a TEST: the generator re-measures a spread of classes from a DIFFERENT combo of the
 * same class and requires the two to agree to within `HAND_STRENGTH_SYMMETRY_TOLERANCE`,
 * since two exhaustive runs cover the same showdowns and can differ only in the order they
 * add them up. On the SAMPLED path the two agree only approximately, because the sampler
 * walks deck POSITIONS and `sigma` moves cards between positions.
 *
 * ## What is enumerated and what can be sampled
 *
 * The opponent side is ALWAYS EXHAUSTIVE: all `C(50, 2) = 1225` hands that do not use one
 * of hero's cards, each at equal weight. The board side is whatever `runoutSamples` asks
 * for — pass `PREFLOP_RUNOUT_SPACE_SIZE` and every one of the `C(50, 5) = 2,118,760` boards
 * is walked, which is what the shipped dataset does and what makes it EXACT; pass less and
 * `strategy-core`'s deterministic golden-ratio Weyl walk picks that many. Either way there
 * is no RNG, no seed and no wall-clock budget, so the same `runoutSamples` gives the same
 * answer on every machine, forever.
 *
 * Card removal is the engine's, not a re-implementation: it drops any (board, opponent hand)
 * pair that shares a card, so the denominator is the set of deals that can actually happen.
 */

import { invariant, sortCardsDesc, unwrap, type Card } from '@gto-self/shared';
import {
  ALL_COMBOS,
  COMBO_COUNT,
  combinationCount,
  comboCards,
  equityVsRange,
  HAND_CLASS_COUNT,
  handClassIndexOfCombo,
  uniformRange,
  type ComboIndex,
  type HandClass,
  type RangeWeights,
} from '@gto-self/strategy-core';

/** Cards left once hero's two are removed. */
const LIVE_DECK = 50;

/** Cards a complete board holds. */
const BOARD_CARDS = 5;

/** `C(50, 2) = 1225` — every opponent hand, and all of them are always scored. */
export const OPPONENT_HAND_COUNT = combinationCount(LIVE_DECK, 2);

/** `C(50, 5) = 2,118,760` — the boards that exist behind one starting hand. */
export const PREFLOP_RUNOUT_SPACE_SIZE = combinationCount(LIVE_DECK, BOARD_CARDS);

/**
 * Which combo of a class stands in for it. Both are valid by the symmetry argument above;
 * having two named choices is what lets the symmetry pass re-measure a class from a
 * different set of physical cards.
 */
export const HAND_STRENGTH_REPRESENTATIVES = ['LOWEST_COMBO', 'HIGHEST_COMBO'] as const;

export type HandStrengthRepresentative = (typeof HAND_STRENGTH_REPRESENTATIVES)[number];

/**
 * The lowest and highest `ComboIndex` of every class, found in one pass over the 1326
 * combos. Combo indices are a fixed bijection, so both are deterministic on every machine.
 * `LOWEST_COMBO` is the same representative `handClass/facts.ts` prints as `exampleCombo`.
 */
const REPRESENTATIVES: readonly (readonly [ComboIndex, ComboIndex])[] = (() => {
  const lowest = new Map<number, ComboIndex>();
  const highest = new Map<number, ComboIndex>();
  for (const combo of ALL_COMBOS) {
    const classIndex = handClassIndexOfCombo(combo);
    if (!lowest.has(classIndex)) lowest.set(classIndex, combo);
    highest.set(classIndex, combo);
  }
  return Array.from({ length: HAND_CLASS_COUNT }, (_, index) => {
    const low = lowest.get(index);
    const high = highest.get(index);
    invariant(low !== undefined && high !== undefined, `hand class ${index} has no combo`);
    return [low, high] as const;
  });
})();

/** Total. The combo that stands in for `handClass` under the given choice. */
export function representativeCombo(
  handClass: HandClass,
  which: HandStrengthRepresentative,
): ComboIndex {
  const pair = REPRESENTATIVES[handClass.index];
  invariant(pair !== undefined, `hand class index out of range: ${handClass.index}`);
  return which === 'LOWEST_COMBO' ? pair[0] : pair[1];
}

/**
 * The opponent: every one of the 1326 combos at full weight. Not a strategy claim — it is
 * the "any two cards" universe, and `equityVsRange` removes hero's two cards from it before
 * scoring, leaving the 1225 hands that can actually be dealt.
 *
 * Built once. `uniformRange` returns a fresh array each call and nothing here mutates it.
 */
const RANDOM_OPPONENT: RangeWeights = uniformRange();

export interface HandStrengthMeasurementOptions {
  /**
   * Boards walked. `PREFLOP_RUNOUT_SPACE_SIZE` or more makes the measurement EXHAUSTIVE —
   * 2,097,572,400 showdowns and roughly 75 seconds of one core per class. That is what the
   * shipped dataset uses; a smaller budget is for previews and for the cheap path a unit
   * test can afford to re-run.
   */
  readonly runoutSamples: number;
  /** Default `'LOWEST_COMBO'`. */
  readonly representative?: HandStrengthRepresentative;
}

export interface HandStrengthMeasurement {
  readonly key: string;
  /** The physical cards measured, higher rank first. */
  readonly heroCards: readonly [Card, Card];
  readonly representative: HandStrengthRepresentative;
  /** Hero's share of the pot, ties split. `0..1`, a ratio and never money. */
  readonly equity: number;
  /** Boards actually walked. */
  readonly runoutSamples: number;
  readonly runoutSpaceSize: number;
  /** Opponent hands carried. Always `OPPONENT_HAND_COUNT`; nothing on this side is sampled. */
  readonly opponentHands: number;
  /** `(board, opponent hand)` pairs scored, after pairs sharing a card were dropped. */
  readonly scoredTrials: number;
  /**
   * `true` only when every board AND every opponent hand was enumerated — `strategy-core`
   * reporting `method: 'EXACT'`. The shipped dataset is built entirely from measurements
   * with this set, and the generator refuses to write a dataset labelled `EXACT` unless
   * every one of the 169 classes reported it.
   */
  readonly exhaustive: boolean;
}

/**
 * Total. Measures one class. Throws only on a programmer error — the inputs are two cards
 * this module chose itself and a range it built itself, so an engine refusal here is a bug
 * in this file, not a condition a caller can hit.
 *
 * `maxTrials` is deliberately given more headroom than `runoutSamples * OPPONENT_HAND_COUNT`
 * so that `runoutSamples` — and nothing else — decides how much work happens; the engine
 * derives its runout limit from `maxTrials / opponentHands` and then clamps it to
 * `maxRunoutSamples`, and the clamp is what we want to bind. `maxAssignments` is stated
 * rather than left to the default so a future change to that default cannot silently start
 * sampling the opponent side.
 */
export function measureHandStrength(
  handClass: HandClass,
  options: HandStrengthMeasurementOptions,
): HandStrengthMeasurement {
  const { runoutSamples } = options;
  invariant(
    Number.isInteger(runoutSamples) && runoutSamples >= 1,
    `runoutSamples must be a positive integer, got ${runoutSamples}`,
  );
  const representative = options.representative ?? 'LOWEST_COMBO';
  const combo = representativeCombo(handClass, representative);
  const [high, low] = sortCardsDesc(comboCards(combo));
  invariant(high !== undefined && low !== undefined, `combo ${combo} did not yield two cards`);

  const result = unwrap(
    equityVsRange([high, low], [], RANDOM_OPPONENT, {
      maxTrials: runoutSamples * COMBO_COUNT,
      maxAssignments: COMBO_COUNT,
      minRunoutSamples: 1,
      maxRunoutSamples: runoutSamples,
    }),
  );
  invariant(
    result.assignmentCount === OPPONENT_HAND_COUNT,
    `expected all ${OPPONENT_HAND_COUNT} opponent hands, scored ${result.assignmentCount}`,
  );
  invariant(
    result.runoutSpaceSize === PREFLOP_RUNOUT_SPACE_SIZE,
    `expected ${PREFLOP_RUNOUT_SPACE_SIZE} boards, engine reported ${result.runoutSpaceSize}`,
  );

  return {
    key: handClass.key,
    heroCards: [high, low],
    representative,
    equity: result.equity,
    runoutSamples: result.evaluatedRunouts,
    runoutSpaceSize: result.runoutSpaceSize,
    opponentHands: result.assignmentCount,
    scoredTrials: result.evaluatedTrials,
    exhaustive: result.method === 'EXACT',
  };
}
