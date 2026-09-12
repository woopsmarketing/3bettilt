import { unwrap } from '@gto-self/shared';
import { parseCards } from '@gto-self/shared';
import { compareHands, evaluateStrength, handClassByKey, hasHandClass } from '@gto-self/strategy-core';
import { describe, expect, it } from 'vitest';
import { resolveRange, type RangeQuery } from '../range/index.js';
import {
  acceptableAnswerIds,
  answerQuestion,
  compactQuestions,
  createQuizSession,
  currentScore,
  excludeMixedQuestions,
  isAnswerCorrect,
  isAnswered,
  isComplete,
  isMixedQuestion,
  retryWrongOnly,
  wrongAnswers,
} from './engine.js';
import type { QuizQuestion } from './types.js';

function fixtureQuestion(id: string, correctAnswerId: 'A' | 'B' = 'A'): QuizQuestion {
  return {
    id,
    type: 'FIXTURE',
    prompt: `fixture prompt ${id}`,
    answers: [
      { id: 'A', label: 'Answer A' },
      { id: 'B', label: 'Answer B' },
    ],
    correctness: { kind: 'SINGLE', correctAnswerId },
    explanation: `fixture explanation ${id}`,
  };
}

/*
 * A real, evaluator-derived tie: the board itself is a royal flush, so BOTH hole-card hands
 * play the board and the pot chops regardless of what either player holds. This is the
 * "mixed-frequency" case in this app's own domain — `compareHands` returning a genuine `0`,
 * never a coin flip the engine invents. `evaluateStrength`/`compareHands` are the real
 * strategy-core evaluator, not a literal typed into the test (CLAUDE.md rule 2).
 */
const BOARD = unwrap(parseCards('As Ks Qs Js Ts'));
const HERO_HOLE = unwrap(parseCards('2h 3h'));
const VILLAIN_HOLE = unwrap(parseCards('4d 5d'));
const HERO_STRENGTH = evaluateStrength([...BOARD, ...HERO_HOLE]);
const VILLAIN_STRENGTH = evaluateStrength([...BOARD, ...VILLAIN_HOLE]);

if (compareHands(HERO_STRENGTH, VILLAIN_STRENGTH) !== 0) {
  // Guards the fixture itself, not the engine: if this ever fires, the board above no
  // longer produces a real chop and the "mixed" fixture below would be lying.
  throw new Error('fixture assumption broken: the board no longer plays for both hands');
}

const TIE_QUESTION: QuizQuestion = {
  id: 'hand-comparison-tie',
  type: 'HAND_COMPARISON_FIXTURE',
  prompt: '보드가 로열 플러시일 때, 히어로와 빌런 중 누가 이길까요?',
  visual: { kind: 'CARDS', notation: 'As Ks Qs Js Ts' },
  answers: [
    { id: 'HERO', label: '히어로', visual: { kind: 'CARDS', notation: '2h 3h' } },
    { id: 'VILLAIN', label: '빌런', visual: { kind: 'CARDS', notation: '4d 5d' } },
    { id: 'TIE', label: '무승부' },
  ],
  correctness: { kind: 'MIXED', correctAnswerIds: ['TIE'] },
  explanation: '보드 다섯 장이 이미 로열 플러시라서 두 핸드 모두 보드로만 승부하며 팟을 나눠 갖습니다.',
};

/*
 * A minimal illustration of the contract a real range-quiz generator (WP-L2) follows:
 * return `null` for a query `resolveRange` cannot answer, never a fabricated question. This
 * is test-local wiring, not production code — WP-L2 owns the shipped generator.
 */
function fixtureRangeMembershipQuestion(query: RangeQuery, handKey: string): QuizQuestion | null {
  const resolution = resolveRange(query);
  if (resolution.kind !== 'RANGE') return null;
  const handClass = handClassByKey(handKey);
  if (handClass === undefined) return null;
  const included = hasHandClass(resolution.range, handClass.index);
  return {
    id: `range-${query.heroPosition}-${handKey}`,
    type: 'RANGE_MEMBERSHIP_FIXTURE',
    prompt: `${handKey}는 이 포지션의 레인지에 포함될까요?`,
    visual: { kind: 'HAND_CLASS', key: handKey },
    answers: [
      { id: 'INCLUDE', label: '포함' },
      { id: 'EXCLUDE', label: '제외' },
    ],
    correctness: { kind: 'SINGLE', correctAnswerId: included ? 'INCLUDE' : 'EXCLUDE' },
    explanation: '실제 레인지 데이터로 확인한 결과입니다.',
  };
}

describe('acceptableAnswerIds / isAnswerCorrect', () => {
  it('a SINGLE question accepts exactly its one correct id', () => {
    const question = fixtureQuestion('q1', 'A');
    expect(acceptableAnswerIds(question)).toEqual(['A']);
    expect(isAnswerCorrect(question, 'A')).toBe(true);
    expect(isAnswerCorrect(question, 'B')).toBe(false);
  });

  it('a MIXED question accepts every id it names, scored the same way as SINGLE', () => {
    expect(acceptableAnswerIds(TIE_QUESTION)).toEqual(['TIE']);
    expect(isAnswerCorrect(TIE_QUESTION, 'TIE')).toBe(true);
    expect(isAnswerCorrect(TIE_QUESTION, 'HERO')).toBe(false);
    expect(isAnswerCorrect(TIE_QUESTION, 'VILLAIN')).toBe(false);
  });

  it('isMixedQuestion distinguishes the two kinds', () => {
    expect(isMixedQuestion(TIE_QUESTION)).toBe(true);
    expect(isMixedQuestion(fixtureQuestion('q1'))).toBe(false);
  });
});

describe('excludeMixedQuestions', () => {
  it('drops MIXED questions and keeps everything else, in order', () => {
    const q1 = fixtureQuestion('q1');
    const q2 = fixtureQuestion('q2');
    expect(excludeMixedQuestions([q1, TIE_QUESTION, q2])).toEqual([q1, q2]);
  });
});

describe('compactQuestions — the UNSUPPORTED-safe seam', () => {
  it('never turns an UNSUPPORTED range query into a fabricated question', () => {
    const unsupported = fixtureRangeMembershipQuestion(
      { heroPosition: 'BTN', spot: 'FACING_OPEN', stackDepth: 100, tableSize: 6 },
      'AKs',
    );
    expect(unsupported).toBeNull();
  });

  it('builds a real question from a query resolveRange can actually answer', () => {
    const supported = fixtureRangeMembershipQuestion(
      { heroPosition: 'BTN', spot: 'RFI', stackDepth: 100, tableSize: 6 },
      'AKs',
    );
    expect(supported).not.toBeNull();
    expect(supported?.correctness.kind).toBe('SINGLE');
  });

  it('drops null/undefined entries, in order, leaving only real questions', () => {
    const supported = fixtureRangeMembershipQuestion(
      { heroPosition: 'BTN', spot: 'RFI', stackDepth: 100, tableSize: 6 },
      'AKs',
    );
    const unsupported = fixtureRangeMembershipQuestion(
      { heroPosition: 'BTN', spot: 'FACING_3BET', stackDepth: 100, tableSize: 6 },
      'AKs',
    );
    const compacted = compactQuestions([unsupported, supported, null, undefined]);
    expect(compacted).toEqual(supported === null ? [] : [supported]);
  });
});

describe('createQuizSession', () => {
  it('is reproducible: the same questions and seed always present the same order', () => {
    const questions = [fixtureQuestion('a'), fixtureQuestion('b'), fixtureQuestion('c'), fixtureQuestion('d')];
    const first = createQuizSession(questions, 2024);
    const second = createQuizSession(questions, 2024);
    expect(second.questions.map((q) => q.id)).toEqual(first.questions.map((q) => q.id));
  });

  it('limits the session to the requested count after shuffling', () => {
    const questions = [fixtureQuestion('a'), fixtureQuestion('b'), fixtureQuestion('c'), fixtureQuestion('d')];
    const session = createQuizSession(questions, 1, 2);
    expect(session.questions).toHaveLength(2);
  });

  it('throws for a question with fewer than two answers', () => {
    const broken: QuizQuestion = { ...fixtureQuestion('bad'), answers: [{ id: 'A', label: 'A' }] };
    expect(() => createQuizSession([broken], 1)).toThrow(/fewer than two answers/u);
  });

  it('throws for duplicate answer ids within a question', () => {
    const broken: QuizQuestion = {
      ...fixtureQuestion('bad'),
      answers: [
        { id: 'A', label: 'A' },
        { id: 'A', label: 'A again' },
      ],
    };
    expect(() => createQuizSession([broken], 1)).toThrow(/duplicate answer ids/u);
  });

  it('throws when the correct answer id names an option that does not exist', () => {
    const broken = fixtureQuestion('bad', 'A');
    const withBadCorrectness: QuizQuestion = {
      ...broken,
      correctness: { kind: 'SINGLE', correctAnswerId: 'Z' },
    };
    expect(() => createQuizSession([withBadCorrectness], 1)).toThrow(/not one of its options/u);
  });

  it('throws for duplicate question ids in the same bank', () => {
    expect(() => createQuizSession([fixtureQuestion('dup'), fixtureQuestion('dup')], 1)).toThrow(
      /duplicate ids/u,
    );
  });
});

describe('answerQuestion / scoring', () => {
  it('scores a full run: some right, some wrong', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'B'), fixtureQuestion('c', 'A')];
    let session = createQuizSession(questions, 5);
    for (const question of session.questions) {
      // Always answer 'A' — right for two of the three fixtures, wrong for the one whose
      // correct id is 'B'.
      session = answerQuestion(session, question.id, 'A');
    }
    expect(isComplete(session)).toBe(true);
    const score = currentScore(session);
    expect(score.totalQuestions).toBe(3);
    expect(score.answeredCount).toBe(3);
    expect(score.correctCount).toBe(2);
    expect(score.incorrectCount).toBe(1);
  });

  it('currentScore reports partial progress before the session is complete', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'A')];
    const session = createQuizSession(questions, 1);
    const firstId = session.questions[0]?.id;
    if (firstId === undefined) throw new Error('fixture produced no questions');
    const partial = answerQuestion(session, firstId, 'A');
    expect(isComplete(partial)).toBe(false);
    expect(currentScore(partial).answeredCount).toBe(1);
    expect(isAnswered(partial, firstId)).toBe(true);
  });

  it('a MIXED question is scored correct only for an accepted id', () => {
    let session = createQuizSession([TIE_QUESTION], 1);
    session = answerQuestion(session, TIE_QUESTION.id, 'HERO');
    expect(currentScore(session).correctCount).toBe(0);

    let correctSession = createQuizSession([TIE_QUESTION], 1);
    correctSession = answerQuestion(correctSession, TIE_QUESTION.id, 'TIE');
    expect(currentScore(correctSession).correctCount).toBe(1);
  });

  it('throws for a question id not in the session', () => {
    const session = createQuizSession([fixtureQuestion('a')], 1);
    expect(() => answerQuestion(session, 'not-in-session', 'A')).toThrow(/not part of this session/u);
  });

  it('throws for an answer id not one of the question\'s options', () => {
    const session = createQuizSession([fixtureQuestion('a')], 1);
    expect(() => answerQuestion(session, 'a', 'not-an-option')).toThrow(/not one of question/u);
  });
});

describe('wrongAnswers / retryWrongOnly — the retry-wrong-only flow', () => {
  it('wrongAnswers lists only the missed questions, in the session\'s presented order', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'B'), fixtureQuestion('c', 'A')];
    let session = createQuizSession(questions, 3);
    for (const question of session.questions) session = answerQuestion(session, question.id, 'A');

    const wrong = wrongAnswers(session);
    const presentedIds = session.questions.map((q) => q.id);
    const wrongIds = wrong.map((a) => a.question.id);
    expect(wrongIds).toEqual(presentedIds.filter((id) => id === 'b'));
  });

  it('retrying a perfect run produces an empty session', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'A')];
    let session = createQuizSession(questions, 9);
    for (const question of session.questions) session = answerQuestion(session, question.id, 'A');
    expect(wrongAnswers(session)).toHaveLength(0);

    const retry = retryWrongOnly(session);
    expect(retry.questions).toHaveLength(0);
    expect(isComplete(retry)).toBe(true);
  });

  it('retrying a mixed run produces a fresh, unanswered session over only the wrong questions', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'B'), fixtureQuestion('c', 'B')];
    let session = createQuizSession(questions, 4);
    for (const question of session.questions) session = answerQuestion(session, question.id, 'A');

    const wrongIds = wrongAnswers(session).map((a) => a.question.id).sort();
    expect(wrongIds).toEqual(['b', 'c']);

    const retry = retryWrongOnly(session);
    expect(retry.questions.map((q) => q.id).sort()).toEqual(['b', 'c']);
    expect(isComplete(retry)).toBe(false);
    expect(currentScore(retry).answeredCount).toBe(0);
  });

  it('retryWrongOnly is itself reproducible for the same session', () => {
    const questions = [fixtureQuestion('a', 'A'), fixtureQuestion('b', 'B'), fixtureQuestion('c', 'B')];
    let session = createQuizSession(questions, 4);
    for (const question of session.questions) session = answerQuestion(session, question.id, 'A');

    const retryOnce = retryWrongOnly(session);
    const retryTwice = retryWrongOnly(session);
    expect(retryTwice.questions.map((q) => q.id)).toEqual(retryOnce.questions.map((q) => q.id));
  });
});
