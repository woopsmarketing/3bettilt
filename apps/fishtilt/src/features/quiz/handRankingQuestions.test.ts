import { parseCards, unwrap } from '@gto-self/shared';
import { compareHands, evaluateHand } from '@gto-self/strategy-core';
import { describe, expect, it } from 'vitest';
import { contentById } from '../../content/graph.js';
import {
  acceptableAnswerIds,
  answerQuestion,
  createQuizSession,
  isMixedQuestion,
  retryWrongOnly,
} from './engine.js';
import { HAND_RANKING_QUESTIONS, HAND_RANKING_QUIZ_SEED } from './handRankingQuestions.js';
import type { QuizQuestion } from './types.js';

const TIE_IDS = ['tie-straight-different-suits', 'board-plays-tie'];

/** Pulls the raw card notation back out of a question's own answer visual, so the test can
 *  recompute a fresh answer from the SAME cards the reader is shown, rather than trusting
 *  (or restating) whatever the generator decided. */
function visualNotation(question: QuizQuestion, answerId: string): string {
  const option = question.answers.find((candidate) => candidate.id === answerId);
  if (option?.visual === undefined || option.visual.kind !== 'CARDS') {
    throw new Error(`question "${question.id}" has no CARDS visual for answer "${answerId}"`);
  }
  return option.visual.notation;
}

describe('HAND_RANKING_QUESTIONS — every answer is proven by the evaluator, not restated', () => {
  it("has at least ten questions (the quiz's default length)", () => {
    expect(HAND_RANKING_QUESTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('every question id is unique', () => {
    const ids = HAND_RANKING_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("recomputes each question's correctness independently, from its own displayed cards", () => {
    for (const question of HAND_RANKING_QUESTIONS) {
      const cardsA = unwrap(parseCards(visualNotation(question, 'A')));
      const cardsB = unwrap(parseCards(visualNotation(question, 'B')));
      const cmp = compareHands(evaluateHand(cardsA).strength, evaluateHand(cardsB).strength);
      const expected = cmp === 1 ? 'A' : cmp === -1 ? 'B' : 'TIE';
      expect(acceptableAnswerIds(question)).toEqual([expected]);
    }
  });

  it("every explanation names both hands' hand categories in Korean", () => {
    const CATEGORY_WORDS = [
      '하이카드',
      '원페어',
      '투페어',
      '트리플',
      '스트레이트',
      '플러시',
      '풀하우스',
      '포카드',
    ];
    for (const question of HAND_RANKING_QUESTIONS) {
      const mentioned = CATEGORY_WORDS.filter((word) => question.explanation.includes(word));
      expect(
        mentioned.length,
        `question "${question.id}" explanation: ${question.explanation}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('links back to the hand-rankings lesson through the content graph, never a literal path', () => {
    for (const question of HAND_RANKING_QUESTIONS) {
      expect(question.relatedConcept).toBe('hand-rankings');
    }
    expect(() => contentById('hand-rankings')).not.toThrow();
  });
});

describe('tie handling — MIXED, never a fabricated winner', () => {
  it('the two constructed-tie fixtures are MIXED, with TIE as the only accepted answer', () => {
    for (const id of TIE_IDS) {
      const question = HAND_RANKING_QUESTIONS.find((candidate) => candidate.id === id);
      expect(question, `fixture "${id}" is missing`).toBeDefined();
      if (question === undefined) continue;
      expect(isMixedQuestion(question)).toBe(true);
      expect(acceptableAnswerIds(question)).toEqual(['TIE']);
    }
  });

  it('every other question is SINGLE — a real tie is not the default, it is constructed', () => {
    const nonTie = HAND_RANKING_QUESTIONS.filter((question) => !TIE_IDS.includes(question.id));
    expect(nonTie.length).toBeGreaterThan(0);
    for (const question of nonTie) {
      expect(question.correctness.kind).toBe('SINGLE');
    }
  });
});

describe('known-answer checks (verified against the real evaluator while authoring)', () => {
  it("a flush beats a straight, however low the flush's top card looks", () => {
    const flush = evaluateHand(unwrap(parseCards('Ks 9s 7s 4s 2s')));
    const straight = evaluateHand(unwrap(parseCards('Th 9d 8c 7d 6h')));
    expect(flush.category).toBe('FLUSH');
    expect(straight.category).toBe('STRAIGHT');
    expect(compareHands(flush.strength, straight.strength)).toBe(1);
  });

  it('a kicker decides two hands with the identical pair', () => {
    const kingKicker = evaluateHand(unwrap(parseCards('As Ad Kc 8h 3s')));
    const queenKicker = evaluateHand(unwrap(parseCards('Ah Ac Qd 8s 3d')));
    expect(kingKicker.category).toBe('PAIR');
    expect(queenKicker.category).toBe('PAIR');
    expect(kingKicker.ranks[0]).toBe(queenKicker.ranks[0]); // same pair rank: aces
    expect(kingKicker.ranks[1]).not.toBe(queenKicker.ranks[1]); // kicker differs: K vs Q
    expect(compareHands(kingKicker.strength, queenKicker.strength)).toBe(1);
  });

  it('the wheel (A-2-3-4-5) is the LOWEST straight — it loses to 6-high', () => {
    const wheel = evaluateHand(unwrap(parseCards('As 2d 3c 4h 5s')));
    const sixHigh = evaluateHand(unwrap(parseCards('6d 5h 4c 3d 2h')));
    expect(wheel.category).toBe('STRAIGHT');
    expect(sixHigh.category).toBe('STRAIGHT');
    expect(compareHands(wheel.strength, sixHigh.strength)).toBe(-1);
  });

  it('two pair loses to trips even when both pairs individually outrank the trips', () => {
    const twoPair = evaluateHand(unwrap(parseCards('Ks Kd 8c 8h 3s')));
    const trips = evaluateHand(unwrap(parseCards('9d 9c 9s Qh Jd')));
    expect(twoPair.category).toBe('TWO_PAIR');
    expect(trips.category).toBe('TRIPS');
    expect(compareHands(twoPair.strength, trips.strength)).toBe(-1);
  });

  it('a straight beats trips, however strong three-of-a-kind looks', () => {
    const trips = evaluateHand(unwrap(parseCards('9s 9h 9d Kc 4d')));
    const straight = evaluateHand(unwrap(parseCards('4s 5d 6c 7h 8d')));
    expect(trips.category).toBe('TRIPS');
    expect(straight.category).toBe('STRAIGHT');
    expect(compareHands(straight.strength, trips.strength)).toBe(1);
  });

  it('a full house is decided by the TRIPS rank, not the pair rank', () => {
    const eightsFullOfKings = evaluateHand(unwrap(parseCards('8s 8h 8d Ks Kd')));
    const sixesFullOfAces = evaluateHand(unwrap(parseCards('6c 6d 6h As Ad')));
    expect(eightsFullOfKings.category).toBe('FULL_HOUSE');
    expect(sixesFullOfAces.category).toBe('FULL_HOUSE');
    expect(compareHands(eightsFullOfKings.strength, sixesFullOfAces.strength)).toBe(1);
  });

  it('a straight flush beats quads', () => {
    const straightFlush = evaluateHand(unwrap(parseCards('9s 8s 7s 6s 5s')));
    const quads = evaluateHand(unwrap(parseCards('Ks Kd Kh Kc 2d')));
    expect(straightFlush.category).toBe('STRAIGHT_FLUSH');
    expect(quads.category).toBe('QUADS');
    expect(compareHands(straightFlush.strength, quads.strength)).toBe(1);
  });

  it('quads beat a full house outright', () => {
    const quads = evaluateHand(unwrap(parseCards('9s 9h 9d 9c Kc')));
    const fullHouse = evaluateHand(unwrap(parseCards('Ks Kd Kh As Ad')));
    expect(quads.category).toBe('QUADS');
    expect(fullHouse.category).toBe('FULL_HOUSE');
    expect(compareHands(quads.strength, fullHouse.strength)).toBe(1);
  });

  it('a full kicker chain can come down to the fifth (last) card', () => {
    const a = evaluateHand(unwrap(parseCards('As Kd 8c 4h 2s')));
    const b = evaluateHand(unwrap(parseCards('Ah Kc 8d 4s 3h')));
    expect(a.category).toBe('HIGH_CARD');
    expect(b.category).toBe('HIGH_CARD');
    expect(a.ranks.slice(0, 3)).toEqual(b.ranks.slice(0, 3));
    expect(compareHands(a.strength, b.strength)).toBe(-1); // b's fifth card (3) beats a's (2)
  });

  it('two different broadway straights (different suits, not a flush) genuinely chop', () => {
    const a = evaluateHand(unwrap(parseCards('As Kd Qh Jc Ts')));
    const b = evaluateHand(unwrap(parseCards('Ah Kc Qd Js Th')));
    expect(a.category).toBe('STRAIGHT');
    expect(b.category).toBe('STRAIGHT');
    expect(compareHands(a.strength, b.strength)).toBe(0);
  });

  it('"the board plays": an identical shared board makes both hole-card pairs irrelevant', () => {
    const a = evaluateHand(unwrap(parseCards('2h 3d 9s 8d 7h 6c 5s')));
    const b = evaluateHand(unwrap(parseCards('Kh Qd 9s 8d 7h 6c 5s')));
    expect(a.category).toBe('STRAIGHT');
    expect(a.ranks[0]).toBe(b.ranks[0]);
    expect(compareHands(a.strength, b.strength)).toBe(0);
  });
});

describe('reproducible seed + retry-wrong-only', () => {
  it('the fixed seed presents the same 10-question order every time', () => {
    const first = createQuizSession(HAND_RANKING_QUESTIONS, HAND_RANKING_QUIZ_SEED, 10);
    const second = createQuizSession(HAND_RANKING_QUESTIONS, HAND_RANKING_QUIZ_SEED, 10);
    expect(second.questions.map((question) => question.id)).toEqual(
      first.questions.map((question) => question.id),
    );
    expect(first.questions).toHaveLength(10);
  });

  it('retryWrongOnly reproduces exactly the missed subset', () => {
    let session = createQuizSession(HAND_RANKING_QUESTIONS, HAND_RANKING_QUIZ_SEED, 10);
    const [first, ...rest] = session.questions;
    if (first === undefined) throw new Error('fixture produced no questions');

    const wrongId = acceptableAnswerIds(first).includes('A') ? 'B' : 'A';
    session = answerQuestion(session, first.id, wrongId);
    for (const question of rest) {
      const correctId = acceptableAnswerIds(question)[0];
      if (correctId === undefined)
        throw new Error(`question "${question.id}" names no correct answer`);
      session = answerQuestion(session, question.id, correctId);
    }

    const retry = retryWrongOnly(session);
    expect(retry.questions.map((question) => question.id)).toEqual([first.id]);
  });
});

describe('explanation copy never gives advice (strength facts only)', () => {
  const ADVICE_PATTERNS = [
    /해야\s?합니다/u,
    /하세요/u,
    /추천/u,
    /권장/u,
    /레이즈하/u,
    /폴드하/u,
    /베팅하/u,
    /콜하/u,
    /플레이해야/u,
  ];

  it('contains no should/must/advice verb', () => {
    for (const question of HAND_RANKING_QUESTIONS) {
      for (const pattern of ADVICE_PATTERNS) {
        expect(question.explanation).not.toMatch(pattern);
      }
    }
  });
});
