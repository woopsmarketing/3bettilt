import { describe, expect, it } from 'vitest';
import { makeCard, type Card } from '@gto-self/shared';
import type { HandCategory, HandValue } from '@gto-self/strategy-core';
import { bestFiveOf, compareHands, evaluateHand, HAND_CATEGORIES } from '@gto-self/strategy-core';
import {
  categoryLabelList,
  CATEGORIES_WITH_KICKER,
  CATEGORIES_WITHOUT_KICKER,
  categoryRankingLabel,
  evaluateHandRank,
  HAND_CATEGORY_LABEL,
  handExplanation,
  hasKicker,
  handReading,
  rankFromTop,
  TOTAL_HAND_CATEGORIES,
} from './handRank.js';

/** Builds a `HandValue` fixture without hand-crafting real cards — `handReading` and
 *  `handExplanation` only ever read `category` and `ranks`; `strength` is unused here. */
function value(category: HandCategory, ranks: readonly number[]): HandValue {
  return { strength: 0, category, ranks };
}

const A = 12;
const K = 11;
const Q = 10;
const J = 9;
const T = 8;
const NINE = 7;
const FIVE = 3;
const TWO = 0;

describe('handReading', () => {
  it('reads every category with the real ranks involved, not a generic label', () => {
    expect(handReading(value('HIGH_CARD', [K, NINE, FIVE, TWO, 1]))).toBe('킹 하이');
    expect(handReading(value('PAIR', [Q, A, NINE, FIVE]))).toBe('퀸 원페어');
    expect(handReading(value('TWO_PAIR', [K, Q, TWO]))).toBe('킹과 퀸 투페어');
    // "에이스" ends in a vowel (no 받침), so the particle is "와", not "과" — the two-pair
    // reading has to pick the right one for whichever rank happens to be higher.
    expect(handReading(value('TWO_PAIR', [A, K, TWO]))).toBe('에이스와 킹 투페어');
    expect(handReading(value('TRIPS', [A, NINE, FIVE]))).toBe('에이스 트리플');
    expect(handReading(value('STRAIGHT', [NINE]))).toBe('나인 하이 스트레이트');
    expect(handReading(value('FLUSH', [A, K, NINE, FIVE, TWO]))).toBe('에이스 하이 플러시');
    expect(handReading(value('QUADS', [A, K]))).toBe('에이스 포카드');
  });

  it('never renders aces full of kings the same as kings full of aces', () => {
    const acesFullOfKings = handReading(value('FULL_HOUSE', [A, K]));
    const kingsFullOfAces = handReading(value('FULL_HOUSE', [K, A]));
    expect(acesFullOfKings).toBe('에이스 풀하우스, 킹 포함');
    expect(kingsFullOfAces).toBe('킹 풀하우스, 에이스 포함');
    expect(acesFullOfKings).not.toBe(kingsFullOfAces);
  });

  it('names the wheel by its reported top rank (5), never by the ace it also contains', () => {
    expect(handReading(value('STRAIGHT', [FIVE]))).toBe('5 하이 스트레이트 (A-2-3-4-5)');
    expect(handReading(value('STRAIGHT_FLUSH', [FIVE]))).toBe(
      '5 하이 스트레이트 플러시 (A-2-3-4-5)',
    );
  });

  it('gives the ace-high straight flush its own name', () => {
    expect(handReading(value('STRAIGHT_FLUSH', [A]))).toBe('로열 플러시 (Royal Flush)');
  });

  it('never says "GTO"', () => {
    for (const category of Object.keys(HAND_CATEGORY_LABEL) as HandCategory[]) {
      const ranks = [A, K, Q, J, T].slice(0, 5);
      expect(handReading(value(category, ranks)).toUpperCase()).not.toContain('GTO');
    }
  });
});

describe('handExplanation', () => {
  it('glosses "키커" with its English term, the site convention for a first-use gloss', () => {
    expect(handExplanation(value('PAIR', [Q, A, NINE, FIVE]))).toContain('키커 (Kicker)');
    expect(handExplanation(value('TWO_PAIR', [K, Q, TWO]))).toContain('키커 (Kicker)');
    expect(handExplanation(value('TRIPS', [A, NINE, FIVE]))).toContain('키커 (Kicker)');
    expect(handExplanation(value('QUADS', [A, K]))).toContain('키커 (Kicker)');
  });

  it('calls out that the ace plays low in the wheel, the beginner trap the spec names', () => {
    const explanation = handExplanation(value('STRAIGHT', [FIVE]));
    expect(explanation).toContain('가장 낮은');
    expect(explanation).toMatch(/에이스/u);
  });

  it('states full house rank order explicitly, so the two readings cannot be confused', () => {
    const acesFullOfKings = handExplanation(value('FULL_HOUSE', [A, K]));
    expect(acesFullOfKings).toContain('에이스 풀하우스');
    expect(acesFullOfKings).toContain('킹 풀하우스');
  });

  it('is one or two sentences, not a paragraph', () => {
    for (const category of Object.keys(HAND_CATEGORY_LABEL) as HandCategory[]) {
      const sentences = handExplanation(value(category, [A, K, Q, J, T])).split(/(?<=\.)\s+/u);
      expect(sentences.length, category).toBeLessThanOrEqual(2);
    }
  });
});

describe('rankFromTop / categoryRankingLabel', () => {
  it('places straight flush first and high card last, among exactly 9', () => {
    expect(TOTAL_HAND_CATEGORIES).toBe(9);
    expect(rankFromTop('STRAIGHT_FLUSH')).toBe(1);
    expect(rankFromTop('HIGH_CARD')).toBe(9);
  });

  it('is total and strictly ordered by real hand strength', () => {
    const order: HandCategory[] = [
      'HIGH_CARD',
      'PAIR',
      'TWO_PAIR',
      'TRIPS',
      'STRAIGHT',
      'FLUSH',
      'FULL_HOUSE',
      'QUADS',
      'STRAIGHT_FLUSH',
    ];
    const ranks = order.map(rankFromTop);
    expect(new Set(ranks).size).toBe(9);
    expect([...ranks].sort((a, b) => a - b)).toEqual(order.map((_, i) => i + 1));
  });

  it('renders the exact phrasing the spec asks for', () => {
    expect(categoryRankingLabel('FLUSH')).toBe('9개 족보 중 4번째로 강한 족보');
    expect(categoryRankingLabel('FULL_HOUSE')).toBe('9개 족보 중 3번째로 강한 족보');
  });
});

/* --------------------------------------------------------------------------------------- */
/* evaluateHandRank — the real pipeline, through actual cards                              */
/* --------------------------------------------------------------------------------------- */

function hand(cards: string): Card[] {
  return cards.split(' ').map((token) => {
    const rank = token[0] as Parameters<typeof makeCard>[0];
    const suit = token[1] as Parameters<typeof makeCard>[1];
    return makeCard(rank, suit);
  });
}

describe('evaluateHandRank — incomplete selections', () => {
  it('reports how many more cards are needed below 5 total', () => {
    expect(evaluateHandRank([], [])).toEqual({
      status: 'INCOMPLETE',
      totalSelected: 0,
      moreNeeded: 5,
    });
    expect(evaluateHandRank(hand('As'), [])).toEqual({
      status: 'INCOMPLETE',
      totalSelected: 1,
      moreNeeded: 4,
    });
    expect(evaluateHandRank(hand('As Kd'), hand('2h 3c'))).toEqual({
      status: 'INCOMPLETE',
      totalSelected: 4,
      moreNeeded: 1,
    });
  });

  it('evaluates the instant it reaches 5', () => {
    const result = evaluateHandRank(hand('As Kd'), hand('9s 5h 2c'));
    expect(result.status).toBe('EVALUATED');
  });
});

describe('evaluateHandRank — the full pipeline on real cards', () => {
  it('a high-card hand names the actual top card', () => {
    const result = evaluateHandRank(hand('As Kd'), hand('9s 5h 2c'));
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.category).toBe('HIGH_CARD');
    expect(result.categoryLabel).toBe('하이카드');
    expect(result.reading).toBe('에이스 하이');
    expect(result.rankFromTop).toBe(9);
    expect(result.note).toBeNull();
    expect(result.usedCards.size).toBe(5);
  });

  it('aces full of kings and kings full of aces read differently from real cards', () => {
    const acesFullOfKings = evaluateHandRank(hand('Ah Ad'), hand('As Kc Kd'));
    const kingsFullOfAces = evaluateHandRank(hand('Kh Kd'), hand('Ks Ac Ad'));
    if (acesFullOfKings.status !== 'EVALUATED' || kingsFullOfAces.status !== 'EVALUATED') {
      throw new Error('expected both to evaluate');
    }
    expect(acesFullOfKings.reading).toBe('에이스 풀하우스, 킹 포함');
    expect(kingsFullOfAces.reading).toBe('킹 풀하우스, 에이스 포함');
  });

  it('the wheel straight from real cards states the ace plays low', () => {
    const result = evaluateHandRank(hand('Ah 2d'), hand('3s 4c 5d'));
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.category).toBe('STRAIGHT');
    expect(result.reading).toBe('5 하이 스트레이트 (A-2-3-4-5)');
    expect(result.bestFive).toHaveLength(5);
  });

  it('a royal flush from real cards is named, not just categorised', () => {
    const result = evaluateHandRank(hand('Ah Kh'), hand('Qh Jh Th'));
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.category).toBe('STRAIGHT_FLUSH');
    expect(result.reading).toBe('로열 플러시 (Royal Flush)');
    expect(result.rankFromTop).toBe(1);
  });
});

describe('evaluateHandRank — board-plays and one-hole-card edge cases', () => {
  it('a 5-card board that already beats the hand says so explicitly (board plays)', () => {
    // The board alone is a royal flush — unbeatable, so the two junk hole cards cannot
    // possibly be part of the best five, whatever they are.
    const result = evaluateHandRank(hand('2s 3d'), hand('Th Jh Qh Kh Ah'));
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.category).toBe('STRAIGHT_FLUSH');
    expect([...result.usedCards]).toEqual(hand('Th Jh Qh Kh Ah'));
    expect(result.note).toBe(
      '당신이 고른 두 장으로는 보드 다섯 장보다 더 좋은 패를 만들지 못했습니다. 이럴 때는 보드가 그대로 당신의 패가 되고, 상대도 같은 상황이면 팟을 나눠 가집니다.',
    );
    // WP-Q2 / P1-F11. The note may not say the board is STRONGER than the player: when the
    // board plays, the board IS the player's hand. Proven here against the evaluator rather
    // than by reading the sentence — two players with different junk hole cards on this board
    // hold the identical best five, which `compareHands` calls a tie, i.e. a split pot.
    const heroBest = bestFiveOf([...hand('Th Jh Qh Kh Ah'), ...hand('2s 3d')]);
    const villainBest = bestFiveOf([...hand('Th Jh Qh Kh Ah'), ...hand('4c 5c')]);
    expect(compareHands(heroBest.value.strength, villainBest.value.strength)).toBe(0);
    expect(
      compareHands(heroBest.value.strength, evaluateHand(hand('Th Jh Qh Kh Ah')).strength),
    ).toBe(0);
    expect(result.note).not.toContain('당신의 핸드보다 강');
  });

  it('exactly one hole card plays when only one completes the best hand', () => {
    // Board: A K Q J of hearts plus one off-suit card — four to a royal flush. Hero holds
    // Th (completes it) and 9d (irrelevant). The best five must use Th and cannot use 9d.
    const hole = hand('Th 9d');
    const board = hand('Ah Kh Qh Jh 2c');
    const result = evaluateHandRank(hole, board);
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.category).toBe('STRAIGHT_FLUSH');
    expect(result.reading).toBe('로열 플러시 (Royal Flush)');
    const [th] = hand('Th');
    const [nined] = hand('9d');
    expect(result.usedCards.has(th!)).toBe(true);
    expect(result.usedCards.has(nined!)).toBe(false);
    expect(result.note).toBe('핸드 두 장 중 한 장만 이번 족보에 쓰였습니다.');
  });

  it('says so when no hole cards were chosen at all', () => {
    const result = evaluateHandRank([], hand('Ah Kd Qs Jc 2h'));
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.note).toBe('핸드 카드를 아직 고르지 않아서 보드 카드만으로 계산했습니다.');
  });

  it('never reports "board plays" before the board reaches 5 cards — combinatorially impossible', () => {
    // A very strong 4-card board (turn) still cannot make BOTH hole cards useless: dropping
    // 2 of 6 cards to exclude both hole cards would require 6 - 5 = 1 drop to cover 2 cards.
    const hole = hand('2c 3d');
    const board = hand('Ah Kh Qh Jh');
    const result = evaluateHandRank(hole, board);
    if (result.status !== 'EVALUATED') throw new Error('expected an evaluation');
    expect(result.note).not.toBe(
      '당신이 고른 두 장으로는 보드 다섯 장보다 더 좋은 패를 만들지 못했습니다. 이럴 때는 보드가 그대로 당신의 패가 되고, 상대도 같은 상황이면 팟을 나눠 가집니다.',
    );
    const holeUsed = hole.filter((card) => result.usedCards.has(card)).length;
    expect(holeUsed).toBeGreaterThan(0);
  });
});

/*
 * WP-Q2 / P1-F6. `/tools/hand-checker`'s "숫자가 같으면 누가 이기나요?" card used to say a
 * kicker breaks every tie. It does not: four of the nine categories consume all five cards,
 * so with the made ranks equal there is nothing left to compare and the hands split. These
 * lists are what that card renders, so they are checked against the evaluator itself — a real
 * pair of hands per category, not a restatement of the table in `handRank.ts`.
 */
describe('kicker scope — checked against compareHands, not asserted', () => {
  /** Two real 5-card hands of the same category with identical MADE ranks. */
  const SAME_MADE_RANKS: Readonly<Record<string, readonly [string, string]>> = {
    HIGH_CARD: ['Ah Kd 9c 5s 3h', 'As Kc 9d 5h 2s'],
    PAIR: ['Ah Ad 7c Ks Qs', 'Ac As 7d Js Ts'],
    TWO_PAIR: ['Ah Ad Kh Kc Qs', 'As Ac Kd Ks Js'],
    TRIPS: ['9h 9d 9c As Ks', '9s 9c 9d Qh Js'],
    QUADS: ['9h 9d 9c 9s Ah', '9h 9d 9c 9s Kd'],
    STRAIGHT: ['As Kd Qh Jc Ts', 'Ah Kc Qd Js Th'],
    FLUSH: ['Ah Kh Qh Jh 9h', 'As Ks Qs Js 9s'],
    FULL_HOUSE: ['9h 9d 9c Ah As', '9s 9c 9d Ac Ad'],
    STRAIGHT_FLUSH: ['9h 8h 7h 6h 5h', '9s 8s 7s 6s 5s'],
  };

  it('covers all nine categories, split into exactly the two lists the tool renders', () => {
    expect([...CATEGORIES_WITH_KICKER, ...CATEGORIES_WITHOUT_KICKER].toSorted()).toEqual(
      [...HAND_CATEGORIES].toSorted(),
    );
    expect(CATEGORIES_WITH_KICKER.some((c) => CATEGORIES_WITHOUT_KICKER.includes(c))).toBe(false);
  });

  it('a category WITHOUT a kicker ties when the made ranks match — a split pot, not a win', () => {
    for (const category of CATEGORIES_WITHOUT_KICKER) {
      const [left, right] = SAME_MADE_RANKS[category]!;
      const a = evaluateHand(hand(left));
      const b = evaluateHand(hand(right));
      expect(a.category).toBe(category);
      expect(b.category).toBe(category);
      expect(compareHands(a.strength, b.strength)).toBe(0);
    }
  });

  it('a category WITH a kicker is still separated once the made ranks match', () => {
    for (const category of CATEGORIES_WITH_KICKER) {
      const [left, right] = SAME_MADE_RANKS[category]!;
      const a = evaluateHand(hand(left));
      const b = evaluateHand(hand(right));
      expect(a.category).toBe(category);
      expect(b.category).toBe(category);
      expect(compareHands(a.strength, b.strength)).not.toBe(0);
    }
  });

  it('the split matches where handExplanation actually uses the word 키커', () => {
    // HIGH_CARD is the one category that has kickers but names none: its explanation says
    // "가장 높은 카드" instead. Every OTHER kicker category says 키커, and no kicker-less
    // category does.
    for (const category of CATEGORIES_WITHOUT_KICKER) {
      expect(hasKicker(category)).toBe(false);
    }
    expect(handExplanation(value('STRAIGHT', [NINE]))).not.toContain('키커');
    expect(handExplanation(value('FLUSH', [A, K, NINE, FIVE, TWO]))).not.toContain('키커');
    expect(handExplanation(value('FULL_HOUSE', [NINE, A]))).not.toContain('키커');
    expect(handExplanation(value('STRAIGHT_FLUSH', [NINE]))).not.toContain('키커');
  });

  it('renders each list as one readable Korean run, in ranking order', () => {
    expect(categoryLabelList(CATEGORIES_WITHOUT_KICKER)).toBe(
      '스트레이트·플러시·풀하우스·스트레이트 플러시',
    );
    expect(categoryLabelList(CATEGORIES_WITH_KICKER)).toBe('하이카드·원페어·투페어·트리플·포카드');
  });
});
