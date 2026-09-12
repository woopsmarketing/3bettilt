/**
 * The worked examples under `/tools/hand-checker` (WP-S3-14). Every verdict — which five of
 * seven cards play, which of two hands wins, when two hands split — comes from
 * `strategy-core`'s evaluator (`bestFiveOf`, `evaluateStrength`, `compareHands`), the same
 * code the tool above runs through `features/tools/handRank.ts`. The Korean readings come
 * from that module too, so a hand is named the same way in the guide and in the readout.
 *
 * The category frequency table reads `learn-core`'s `categoryFrequencyOf`, an exhaustive
 * count over all `C(52,5)` five-card hands — the honest answer to "왜 이 순서인가": the
 * order of the nine categories is the order of how rarely they occur.
 */
import {
  bestFiveOf,
  compareHands,
  evaluateHand,
  evaluateStrength,
  HAND_CATEGORIES,
  type HandCategory,
} from '@gto-self/strategy-core';
import { categoryFrequencyOf, FIVE_CARD_HAND_COUNT } from '@gto-self/learn-core';
import { parseCards, type Card } from '@gto-self/shared';
import {
  evaluateHandRank,
  HAND_CATEGORY_LABEL,
  handReading,
  rankFromTop,
  type HandRankEvaluated,
} from '../handRank.js';

function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`hand checker guide: cannot parse "${text}": ${parsed.error}`);
  return parsed.value;
}

function evaluated(hole: string, board: string): HandRankEvaluated {
  const result = evaluateHandRank(cards(hole), cards(board));
  if (result.status !== 'EVALUATED') {
    throw new Error(`hand checker guide: "${hole}" + "${board}" is fewer than five cards`);
  }
  return result;
}

export interface BestFiveExample {
  readonly hole: string;
  readonly board: string;
  readonly holeCards: readonly Card[];
  readonly boardCards: readonly Card[];
  readonly result: HandRankEvaluated;
  /** Cards the reader picked that the evaluator left out. */
  readonly unusedCards: readonly Card[];
}

/** Seven cards on the river, two of which do not play: "다섯 장만 센다". */
export function bestFiveExample(): BestFiveExample {
  const hole = 'QhJd';
  const board = 'QsJc9h2c5d';
  const holeCards = cards(hole);
  const boardCards = cards(board);
  const result = evaluated(hole, board);
  return {
    hole,
    board,
    holeCards,
    boardCards,
    result,
    unusedCards: [...holeCards, ...boardCards].filter((card) => !result.usedCards.has(card)),
  };
}

/** The board is the best five on its own: the evaluator's own teaching note fires. */
export function boardPlaysExample(): BestFiveExample {
  const hole = '2s3d';
  const board = '5h6h7h8h9h';
  const holeCards = cards(hole);
  const boardCards = cards(board);
  const result = evaluated(hole, board);
  return {
    hole,
    board,
    holeCards,
    boardCards,
    result,
    unusedCards: [...holeCards, ...boardCards].filter((card) => !result.usedCards.has(card)),
  };
}

export interface ShowdownExample {
  readonly id: string;
  readonly title: string;
  readonly board: string;
  readonly a: {
    readonly hole: string;
    readonly reading: string;
    readonly category: HandCategory;
    readonly bestFive: readonly Card[];
  };
  readonly b: {
    readonly hole: string;
    readonly reading: string;
    readonly category: HandCategory;
    readonly bestFive: readonly Card[];
  };
  /** `1` A wins, `-1` B wins, `0` split — straight from `compareHands`. */
  readonly verdict: -1 | 0 | 1;
}

function showdown(
  id: string,
  title: string,
  board: string,
  holeA: string,
  holeB: string,
): ShowdownExample {
  const boardCards = cards(board);
  const bestA = bestFiveOf([...cards(holeA), ...boardCards]);
  const bestB = bestFiveOf([...cards(holeB), ...boardCards]);
  const valueA = evaluateHand(bestA.cards);
  const valueB = evaluateHand(bestB.cards);
  return {
    id,
    title,
    board,
    a: {
      hole: holeA,
      reading: handReading(valueA),
      category: valueA.category,
      bestFive: bestA.cards,
    },
    b: {
      hole: holeB,
      reading: handReading(valueB),
      category: valueB.category,
      bestFive: bestB.cards,
    },
    verdict: compareHands(evaluateStrength(bestA.cards), evaluateStrength(bestB.cards)),
  };
}

/**
 * Two hands against each other, judged by `compareHands`. The kicker case, and the two
 * genuine ties — a straight that both players make, and a two pair that differs only by suit.
 */
export function showdownExamples(): readonly ShowdownExample[] {
  return [
    showdown('kicker', '같은 원페어, 키커가 다를 때', 'Ah9c4s2h7d', 'AsKh', 'AcQh'),
    showdown('straight-tie', '같은 스트레이트를 둘 다 만들었을 때', '7h6dTc2c2d', '9s8s', '9c8c'),
    showdown('same-two-pair', '무늬만 다른 같은 투페어', 'QhJd9c4s2h', 'QcJc', 'QsJs'),
  ];
}

export interface CategoryFrequencyRow {
  readonly category: HandCategory;
  readonly label: string;
  /** 1 = strongest. */
  readonly rankFromTop: number;
  readonly count: number;
  /** `0..1` of all five-card hands. */
  readonly probability: number;
}

/** The nine categories, strongest first, each with how many five-card hands make it. */
export function categoryFrequencyRows(): readonly CategoryFrequencyRow[] {
  return [...HAND_CATEGORIES]
    .map((category) => {
      const frequency = categoryFrequencyOf(category);
      return {
        category,
        label: HAND_CATEGORY_LABEL[category],
        rankFromTop: rankFromTop(category),
        count: frequency.count,
        probability: frequency.probability,
      };
    })
    .sort((a, b) => a.rankFromTop - b.rankFromTop);
}

/** `C(52,5)`, from `learn-core` — the denominator of every row above. */
export const FIVE_CARD_HANDS_TOTAL = FIVE_CARD_HAND_COUNT;
