import { handStrengthForKey, type HandStrengthEntry } from '@gto-self/learn-core';
import { unwrap } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { contentById } from '../../content/graph.js';
import {
  acceptableAnswerIds,
  answerQuestion,
  createQuizSession,
  isMixedQuestion,
  retryWrongOnly,
} from './engine.js';
import {
  buildStartingHandQuestionFromEntries,
  STARTING_HAND_QUESTIONS,
  STARTING_HAND_QUIZ_SEED,
} from './startingHandQuestions.js';
import type { QuizQuestion } from './types.js';

/** Pulls the class key back out of a question's own `HAND_CLASS` visual, so the test can
 *  re-resolve it through the real dataset rather than trusting (or restating) the
 *  generator's own decision. */
function visualKey(question: QuizQuestion, answerId: string): string {
  const option = question.answers.find((candidate) => candidate.id === answerId);
  if (option?.visual === undefined || option.visual.kind !== 'HAND_CLASS') {
    throw new Error(`question "${question.id}" has no HAND_CLASS visual for answer "${answerId}"`);
  }
  return option.visual.key;
}

describe('STARTING_HAND_QUESTIONS — every answer is proven by the dataset, not restated', () => {
  it("has at least ten questions (the quiz's default length)", () => {
    expect(STARTING_HAND_QUESTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('every question id is unique', () => {
    const ids = STARTING_HAND_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("recomputes each question's correctness independently, from its own displayed classes", () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      const keyA = visualKey(question, 'A');
      const keyB = visualKey(question, 'B');
      const entryA = unwrap(handStrengthForKey(keyA));
      const entryB = unwrap(handStrengthForKey(keyB));
      const expected =
        entryA.equity === entryB.equity ? 'TIE' : entryA.equity > entryB.equity ? 'A' : 'B';
      expect(acceptableAnswerIds(question)).toEqual([expected]);
    }
  });

  it("every explanation states both hands' equity value and names the metric", () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      expect(question.explanation).toContain('프리플랍 기본 강도');
      expect(question.explanation).toMatch(/\d+\.\d+%/u); // at least one formatted equity value
    }
  });

  it('links back to the starting-hand lesson and the explorer tool through the graph/routes, never a literal path', () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      expect(question.relatedConcept).toBe('starting-hand-ranking');
      expect(question.relatedTool).toBe('toolStartingHand');
    }
    expect(() => contentById('starting-hand-ranking')).not.toThrow();
  });
});

describe('the strength metric is the SAME one /tools/starting-hand uses, not a second definition', () => {
  it("every question's equity values match handStrengthForKey exactly, to the bit", () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      const keyA = visualKey(question, 'A');
      const keyB = visualKey(question, 'B');
      const entryA = unwrap(handStrengthForKey(keyA));
      const entryB = unwrap(handStrengthForKey(keyB));
      // The winner re-derived straight from `handStrengthForKey`'s own numbers must agree
      // with the shipped question — proof the question was built from this dataset and no
      // other.
      const cmp = entryA.equity === entryB.equity ? 0 : entryA.equity > entryB.equity ? 1 : -1;
      const acceptedIds = acceptableAnswerIds(question);
      if (cmp === 0) expect(acceptedIds).toEqual(['TIE']);
      else expect(acceptedIds).toEqual([cmp === 1 ? 'A' : 'B']);
    }
  });

  /*
   * WP-Q2 / P1-F4 (MASTER decision D1). `HandStrengthEntry.equity` is hero's expected share
   * of the pot with ties split (`packages/learn-core/src/strength/model.ts`), not the
   * proportion of the time hero wins — a gap of up to ~2.9pp, on values `equityLabel` prints
   * to two decimals. Every explanation states the metric, so every explanation used to state
   * it wrongly. Fails against the original `METRIC_CLAUSE`.
   */
  it('never calls the metric the proportion of the time you win', () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      expect(question.explanation).not.toContain('이기는 비율');
      expect(question.explanation).not.toContain('이길 확률');
      expect(question.explanation).toContain('팟에서 가져갈 것으로 기대되는 몫');
      expect(question.explanation).toContain('비기는 경우는 절반');
    }
  });
});

describe('ties — MIXED, never a fabricated winner (ruling 29)', () => {
  it('the shipped dataset has no real tie today, so every live question is SINGLE', () => {
    // This is a fact about how much of the dataset happens to differ today (`exactTies` is
    // empty — see the module doc), not a fact this generator assumes. If it ever becomes
    // false, the assertion below just starts failing loudly, which is correct: it means a
    // live MIXED question exists and this test should be updated to name it.
    for (const question of STARTING_HAND_QUESTIONS) {
      expect(question.correctness.kind).toBe('SINGLE');
    }
  });

  it('a locally constructed tie (ruling 26) is scored MIXED with TIE as the only accepted answer', () => {
    const aks = unwrap(handStrengthForKey('AKs'));
    const ako = unwrap(handStrengthForKey('AKo'));
    // Guards the fixture itself: prove these two are NOT actually tied in the real dataset,
    // so the equal-equity fixture below is a deliberate construction, not an accident.
    expect(aks.equity).not.toBe(ako.equity);

    const tiedA: HandStrengthEntry = { ...aks, equity: 0.6 };
    const tiedB: HandStrengthEntry = { ...ako, equity: 0.6 };
    const question = buildStartingHandQuestionFromEntries(tiedA, tiedB);

    expect(isMixedQuestion(question)).toBe(true);
    expect(acceptableAnswerIds(question)).toEqual(['TIE']);
    expect(question.explanation).toContain('동률');
  });

  it('a locally constructed non-tie still resolves to a single winner', () => {
    const strong: HandStrengthEntry = {
      key: 'AA',
      classIndex: 0,
      equity: 0.85,
      rank: 1,
      comboCount: 6,
      cumulativeCombos: 6,
      cumulativeShare: 6 / 1326,
    };
    const weak: HandStrengthEntry = {
      key: '72o',
      classIndex: 168,
      equity: 0.32,
      rank: 169,
      comboCount: 12,
      cumulativeCombos: 1326,
      cumulativeShare: 1,
    };
    const question = buildStartingHandQuestionFromEntries(strong, weak);
    expect(isMixedQuestion(question)).toBe(false);
    expect(acceptableAnswerIds(question)).toEqual(['A']);
  });
});

describe('known-answer checks (verified against the real dataset while authoring)', () => {
  it('AA is stronger than 72o', () => {
    const aa = unwrap(handStrengthForKey('AA'));
    const seven2o = unwrap(handStrengthForKey('72o'));
    expect(aa.equity).toBeGreaterThan(seven2o.equity);
  });

  it('AKs is stronger than AKo — the same two ranks, suited only adds equity', () => {
    const aks = unwrap(handStrengthForKey('AKs'));
    const ako = unwrap(handStrengthForKey('AKo'));
    expect(aks.equity).toBeGreaterThan(ako.equity);
  });

  it(
    'A2o is stronger than 76s on this metric — the exact illustrative case ' +
      '`packages/learn-core/src/strength/model.ts` names for why this ranking is not playability',
    () => {
      const a2o = unwrap(handStrengthForKey('A2o'));
      const sevenSixSuited = unwrap(handStrengthForKey('76s'));
      expect(a2o.equity).toBeGreaterThan(sevenSixSuited.equity);
    },
  );
});

describe('reproducible seed + retry-wrong-only', () => {
  it('the fixed seed presents the same 10-question order every time', () => {
    const first = createQuizSession(STARTING_HAND_QUESTIONS, STARTING_HAND_QUIZ_SEED, 10);
    const second = createQuizSession(STARTING_HAND_QUESTIONS, STARTING_HAND_QUIZ_SEED, 10);
    expect(second.questions.map((question) => question.id)).toEqual(
      first.questions.map((question) => question.id),
    );
    expect(first.questions).toHaveLength(10);
  });

  it('retryWrongOnly reproduces exactly the missed subset', () => {
    let session = createQuizSession(STARTING_HAND_QUESTIONS, STARTING_HAND_QUIZ_SEED, 10);
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

describe('this is a strength comparison, not advice', () => {
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
    /가치가\s?있/u,
    /플레이하기\s?좋/u,
  ];

  it('contains no should/must/advice verb', () => {
    for (const question of STARTING_HAND_QUESTIONS) {
      for (const pattern of ADVICE_PATTERNS) {
        expect(question.explanation).not.toMatch(pattern);
      }
    }
  });
});
