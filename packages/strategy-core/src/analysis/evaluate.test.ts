import { parseCards, unwrap, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import {
  bestFiveOf,
  CATEGORY_RANK_SLOTS,
  compareHands,
  decodeStrength,
  evaluateHand,
  evaluateStrength,
  HAND_CATEGORIES,
  HAND_CATEGORY_INDEX,
  rankCountOfMask,
  rankMaskOf,
  straightTopOfRankMask,
} from './evaluate.js';

const hand = (text: string): Card[] => unwrap(parseCards(text));
const strengthOf = (text: string): number => evaluateStrength(hand(text));
const valueOf = (text: string) => evaluateHand(hand(text));

/** Rank indices, so the expectations below read like poker rather than like arithmetic. */
const R = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  T: 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
} as const;

describe('the strength encoding', () => {
  it('orders the nine categories', () => {
    const ladder = [
      'Ah Kd 9c 5s 2h', // high card
      'Ah Ad 9c 5s 2h', // pair
      'Ah Ad 9c 9s 2h', // two pair
      'Ah Ad Ac 9s 2h', // trips
      '9h 8d 7c 6s 5h', // straight
      'Ah Kh 9h 5h 2h', // flush
      'Ah Ad Ac 9s 9h', // full house
      'Ah Ad Ac As 9h', // quads
      '9h 8h 7h 6h 5h', // straight flush
    ].map(strengthOf);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1] ?? -1);
    }
  });

  it('round-trips through decodeStrength with the declared slot count', () => {
    for (const category of HAND_CATEGORIES) {
      expect(CATEGORY_RANK_SLOTS[category]).toBeGreaterThan(0);
    }
    const value = valueOf('Ah Ad 9c 5s 2h');
    expect(value.category).toBe('PAIR');
    expect(value.ranks).toHaveLength(CATEGORY_RANK_SLOTS.PAIR);
    expect(decodeStrength(value.strength)).toEqual(value);
  });

  it('agrees with HAND_CATEGORY_INDEX', () => {
    for (const [index, category] of HAND_CATEGORIES.entries()) {
      expect(HAND_CATEGORY_INDEX[category]).toBe(index);
    }
  });

  it('compares equal hands as a split pot', () => {
    expect(compareHands(strengthOf('Ah Kd Qc Js Th'), strengthOf('As Kh Qd Jc Ts'))).toBe(0);
    expect(compareHands(strengthOf('Ah Kd Qc Js Th'), strengthOf('9h 8d 7c 6s 5h'))).toBe(1);
    expect(compareHands(strengthOf('9h 8d 7c 6s 5h'), strengthOf('Ah Kd Qc Js Th'))).toBe(-1);
  });
});

describe('known five-card vectors', () => {
  it('reads a royal flush as the ace-high straight flush', () => {
    const value = valueOf('As Ks Qs Js Ts');
    expect(value.category).toBe('STRAIGHT_FLUSH');
    expect(value.ranks).toEqual([R.A]);
  });

  it('reads the steel wheel as the FIVE-high straight flush, below every other one', () => {
    const wheel = valueOf('5s 4s 3s 2s As');
    expect(wheel.category).toBe('STRAIGHT_FLUSH');
    expect(wheel.ranks).toEqual([R['5']]);
    expect(wheel.strength).toBeLessThan(strengthOf('6s 5s 4s 3s 2s'));
    expect(wheel.strength).toBeLessThan(strengthOf('As Ks Qs Js Ts'));
  });

  it('separates quads by kicker', () => {
    const withKing = valueOf('Ah Ad Ac As Kh');
    const withQueen = valueOf('Ah Ad Ac As Qh');
    expect(withKing.category).toBe('QUADS');
    expect(withKing.ranks).toEqual([R.A, R.K]);
    expect(withQueen.ranks).toEqual([R.A, R.Q]);
    expect(withKing.strength).toBeGreaterThan(withQueen.strength);
    expect(strengthOf('2h 2d 2c 2s 3h')).toBeLessThan(withQueen.strength);
  });

  it('reads a full house trips-first, not pair-first', () => {
    const fivesFullOfEights = valueOf('5c 5d 5h 8s 8d');
    expect(fivesFullOfEights.category).toBe('FULL_HOUSE');
    expect(fivesFullOfEights.ranks).toEqual([R['5'], R['8']]);
    const eightsFullOfFives = valueOf('8c 8d 8h 5s 5d');
    expect(eightsFullOfFives.ranks).toEqual([R['8'], R['5']]);
    expect(eightsFullOfFives.strength).toBeGreaterThan(fivesFullOfEights.strength);
  });

  it('ranks a flush above a straight and a full house above a flush', () => {
    const straight = valueOf('Ah Kd Qc Js Th');
    const flush = valueOf('2h 5h 7h 9h Jh');
    const boat = valueOf('2h 2d 2c 3s 3h');
    expect(straight.category).toBe('STRAIGHT');
    expect(flush.category).toBe('FLUSH');
    expect(flush.strength).toBeGreaterThan(straight.strength);
    expect(boat.strength).toBeGreaterThan(flush.strength);
  });

  it('separates flushes by every card in turn', () => {
    expect(strengthOf('Ah Kh Qh Jh 9h')).toBeGreaterThan(strengthOf('Ah Kh Qh Th 9h'));
    expect(strengthOf('Ah Kh Qh Jh 9h')).toBeGreaterThan(strengthOf('Kh Qh Jh Th 8h'));
    expect(valueOf('Ah Kh Qh Jh 9h').ranks).toEqual([R.A, R.K, R.Q, R.J, R['9']]);
  });

  it('settles two-pair kicker battles', () => {
    expect(strengthOf('Ah Ad Kh Kd 3c')).toBeGreaterThan(strengthOf('Ah Ad Kh Kd 2c'));
    expect(strengthOf('Ah Ad 2h 2d 3c')).toBeGreaterThan(strengthOf('Kh Kd Qh Qd Ac'));
    expect(valueOf('Ah Ad Kh Kd 3c').ranks).toEqual([R.A, R.K, R['3']]);
  });

  it('settles pair kicker battles down to the third kicker', () => {
    expect(strengthOf('Ah Ad Kh Qd 3c')).toBeGreaterThan(strengthOf('Ah Ad Kh Qd 2c'));
    expect(strengthOf('Ah Ad Kh Qd 2c')).toBeGreaterThan(strengthOf('Ah Ad Kh Jd Tc'));
    expect(valueOf('Ah Ad Kh Qd 3c').ranks).toEqual([R.A, R.K, R.Q, R['3']]);
  });

  it('puts the wheel below the six-high straight', () => {
    const wheel = valueOf('Ah 2d 3c 4s 5h');
    const six = valueOf('2d 3c 4s 5h 6c');
    expect(wheel.category).toBe('STRAIGHT');
    expect(wheel.ranks).toEqual([R['5']]);
    expect(six.ranks).toEqual([R['6']]);
    expect(six.strength).toBeGreaterThan(wheel.strength);
    expect(wheel.strength).toBeGreaterThan(strengthOf('Ah Ad Ac 9s 2h'));
  });

  it('never reads A K Q J as a straight', () => {
    expect(valueOf('Ah Kd Qc Js 9h').category).toBe('HIGH_CARD');
    expect(valueOf('Ah 2d 3c 4s 9h').category).toBe('HIGH_CARD');
  });

  it('reads trips with two kickers', () => {
    const value = valueOf('9h 9d 9c As 2h');
    expect(value.category).toBe('TRIPS');
    expect(value.ranks).toEqual([R['9'], R.A, R['2']]);
  });
});

describe('six- and seven-card hands', () => {
  it('finds a royal flush a player cannot improve on', () => {
    const value = evaluateHand(hand('2c 3d As Ks Qs Js Ts'));
    expect(value.category).toBe('STRAIGHT_FLUSH');
    expect(value.ranks).toEqual([R.A]);
  });

  it('prefers quads over a flush drawn from the same seven cards', () => {
    // Four nines plus three hearts: the flush is unreachable, quads are not.
    const value = evaluateHand(hand('9h 9d 9c 9s Ah Kh 2h'));
    expect(value.category).toBe('QUADS');
    expect(value.ranks).toEqual([R['9'], R.A]);
  });

  it('prefers a flush over a straight available in the same seven cards', () => {
    const value = evaluateHand(hand('9h 8h 7h 6d 5c 2h Kh'));
    expect(value.category).toBe('FLUSH');
    expect(value.ranks).toEqual([R.K, R['9'], R['8'], R['7'], R['2']]);
  });

  it('picks the best full house out of trips plus two pairs', () => {
    const value = evaluateHand(hand('7h 7d 7c 4s 4d 9s 9h'));
    expect(value.category).toBe('FULL_HOUSE');
    expect(value.ranks).toEqual([R['7'], R['9']]);
  });

  it('picks the higher trips when the board offers two of them', () => {
    const value = evaluateHand(hand('7h 7d 7c 9s 9h 9d 2c'));
    expect(value.category).toBe('FULL_HOUSE');
    expect(value.ranks).toEqual([R['9'], R['7']]);
  });

  it('picks the top two of three pairs, kicker from the third', () => {
    const value = evaluateHand(hand('Ah Ad Kh Kd Qh Qd 2c'));
    expect(value.category).toBe('TWO_PAIR');
    expect(value.ranks).toEqual([R.A, R.K, R.Q]);
  });

  it('finds the highest straight inside seven cards', () => {
    const value = evaluateHand(hand('5h 6d 7c 8s 9h Td 2c'));
    expect(value.category).toBe('STRAIGHT');
    expect(value.ranks).toEqual([R.T]);
  });

  it('evaluates six cards', () => {
    const value = evaluateHand(hand('Ah Ad Ac As Kh Kd'));
    expect(value.category).toBe('QUADS');
    expect(value.ranks).toEqual([R.A, R.K]);
  });
});

describe('bestFiveOf', () => {
  it('returns the five cards of the winning hand', () => {
    const best = bestFiveOf(hand('2c 3d As Ks Qs Js Ts'));
    expect(best.value.category).toBe('STRAIGHT_FLUSH');
    expect(best.cards).toHaveLength(5);
    expect(new Set(best.cards).size).toBe(5);
    expect(best.value.strength).toBe(strengthOf('As Ks Qs Js Ts'));
  });

  it('breaks ties towards the earliest cards, so a board given first wins the attribution', () => {
    // Board first: the five board cards already make the straight flush, so neither hole
    // card is necessary and none is attributed.
    const board = hand('As Ks Qs Js Ts');
    const hole = hand('2c 3d');
    const best = bestFiveOf([...board, ...hole]);
    expect(best.cards).toEqual(board);
  });

  it('agrees with evaluateStrength on the same cards', () => {
    const cards = hand('Ah Kh 9c 9d 9s 2h 3h');
    expect(bestFiveOf(cards).value.strength).toBe(evaluateStrength(cards));
  });
});

describe('rank-mask helpers', () => {
  it('reports the top straight rank, wheel aware', () => {
    expect(straightTopOfRankMask(rankMaskOf(hand('Ah 2d 3c 4s 5h')))).toBe(R['5']);
    expect(straightTopOfRankMask(rankMaskOf(hand('Ah Kd Qc Js Th')))).toBe(R.A);
    expect(straightTopOfRankMask(rankMaskOf(hand('Ah Kd Qc Js 9h')))).toBe(-1);
    // The highest of two straights inside one mask.
    expect(straightTopOfRankMask(rankMaskOf(hand('5h 6d 7c 8s 9h Td')))).toBe(R.T);
  });

  it('counts distinct ranks', () => {
    expect(rankCountOfMask(rankMaskOf(hand('Ah Ad Ac As Kh')))).toBe(2);
    expect(rankCountOfMask(rankMaskOf(hand('Ah Kd Qc Js Th')))).toBe(5);
  });
});

describe('input guards', () => {
  it('refuses a hand that is not 5 to 7 cards', () => {
    expect(() => evaluateHand(hand('Ah Kd Qc Js'))).toThrow(/5 to 7 cards/);
    expect(() => evaluateStrength(hand('Ah Kd Qc Js Th 9h 8h 7h'))).toThrow(/5 to 7 cards/);
  });

  it('refuses duplicate cards at the validating entry points', () => {
    const duplicated = [...hand('Ah Kd Qc Js'), ...hand('Ah')] as Card[];
    expect(() => evaluateHand(duplicated)).toThrow(/distinct/);
    expect(() => bestFiveOf(duplicated)).toThrow(/distinct/);
  });
});
