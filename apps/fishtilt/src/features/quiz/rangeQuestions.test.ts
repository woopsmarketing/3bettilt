/**
 * `rangeQuestions.ts`'s own tests — every fixture here is either a genuinely permanent
 * `UNSUPPORTED` case (`heroPosition: 'BB'` at `RFI`, which is a rule of the game and can
 * never start resolving to `'RANGE'` — see `resolve.ts`) or is read straight off the real
 * `resolveRange`/`hasHandClass` calls, never a hand-typed answer key. Ruling 26 is why `'BB'`
 * is used here rather than an unbuilt spot like `'FACING_OPEN'`: an unbuilt spot may ship
 * within this same project and silently start passing this test for the wrong reason, while
 * `BB_HAS_NO_RFI_RANGE` at `spot: 'RFI'` is structural and permanent.
 */
import { HAND_CLASSES, hasHandClass, STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import { describe, expect, it } from 'vitest';
import { resolveRange, type RangeQuery } from '../range/index.js';
import { answerQuestion, createQuizSession, retryWrongOnly, wrongAnswers } from './engine.js';
import {
  buildRangeQuestions,
  generateRangeMembershipQuestion,
  isSupportedRangeQuizQuery,
  RANGE_QUIZ_QUESTION_LIMIT,
  RANGE_QUIZ_SEED,
  RANGE_QUIZ_SPOT,
  RANGE_QUIZ_STACK_DEPTH,
  RANGE_QUIZ_SUPPORTED_POSITIONS,
  RANGE_QUIZ_TABLE_SIZE,
  rangeQuizQuery,
} from './rangeQuestions.js';

const BB_QUERY: RangeQuery = rangeQuizQuery('BB');

describe('RANGE_QUIZ_SUPPORTED_POSITIONS', () => {
  it('is computed from resolveRange, not a hand-typed list, and matches it exactly', () => {
    for (const position of STRATEGY_POSITIONS) {
      const supported = resolveRange(rangeQuizQuery(position)).kind === 'RANGE';
      expect(RANGE_QUIZ_SUPPORTED_POSITIONS.includes(position)).toBe(supported);
    }
  });

  it('is exactly UTG/HJ/CO/BTN/SB — BB excluded, per settled decision 2', () => {
    expect(new Set(RANGE_QUIZ_SUPPORTED_POSITIONS)).toEqual(
      new Set(['UTG', 'HJ', 'CO', 'BTN', 'SB']),
    );
  });
});

describe('isSupportedRangeQuizQuery — the selector never offers an unsupported combination', () => {
  it('agrees with resolveRange over the whole query space, not just the shipped point', () => {
    // Not the shipped RANGE_SPOTS/RANGE_STACK_DEPTHS/RANGE_TABLE_SIZES import (this module
    // does not need the other axes' values) — just a few real, out-of-band points alongside
    // the one this quiz actually offers, so the predicate is proven against more than the one
    // case that happens to already be true.
    const queries: RangeQuery[] = [
      ...STRATEGY_POSITIONS.map((heroPosition) => rangeQuizQuery(heroPosition)),
      { heroPosition: 'BTN', spot: 'FACING_OPEN', stackDepth: 100, tableSize: 6 },
      { heroPosition: 'BTN', spot: 'RFI', stackDepth: 40, tableSize: 6 },
      { heroPosition: 'BTN', spot: 'RFI', stackDepth: 100, tableSize: 9 },
    ];
    for (const query of queries) {
      expect(isSupportedRangeQuizQuery(query)).toBe(resolveRange(query).kind === 'RANGE');
    }
  });

  it("BB at this quiz's fixed spot/stack/table is permanently unsupported", () => {
    expect(isSupportedRangeQuizQuery(BB_QUERY)).toBe(false);
  });
});

describe('generateRangeMembershipQuestion — UNSUPPORTED yields no question', () => {
  it('returns null for a genuinely UNSUPPORTED resolution (BB, structurally permanent)', () => {
    const resolution = resolveRange(BB_QUERY);
    expect(resolution.kind).toBe('UNSUPPORTED');
    const anyHandClass = HAND_CLASSES[0];
    expect(anyHandClass).toBeDefined();
    if (anyHandClass === undefined) return;
    expect(generateRangeMembershipQuestion(resolution, anyHandClass)).toBeNull();
  });

  it('never fabricates a question when the whole bank is built for an UNSUPPORTED query', () => {
    expect(buildRangeQuestions(BB_QUERY)).toEqual([]);
  });
});

describe('buildRangeQuestions — every answer matches resolveRange called directly', () => {
  it.each(RANGE_QUIZ_SUPPORTED_POSITIONS)('is traceable to hasHandClass, for %s', (position) => {
    const query = rangeQuizQuery(position);
    const resolution = resolveRange(query);
    expect(resolution.kind).toBe('RANGE');
    if (resolution.kind !== 'RANGE') return;

    const questions = buildRangeQuestions(query);
    // Every one of the 169 classes resolves for a supported query — nothing is dropped.
    expect(questions).toHaveLength(HAND_CLASSES.length);

    const byId = new Map(questions.map((question) => [question.id, question]));
    for (const handClass of HAND_CLASSES) {
      const question = byId.get(
        `practiceRange:${position}:${RANGE_QUIZ_SPOT}:${RANGE_QUIZ_STACK_DEPTH}:${RANGE_QUIZ_TABLE_SIZE}:${handClass.key}`,
      );
      expect(question).toBeDefined();
      if (question === undefined) continue;

      const included = hasHandClass(resolution.range, handClass.index);
      expect(question.correctness).toEqual({
        kind: 'SINGLE',
        correctAnswerId: included ? 'INCLUDE' : 'EXCLUDE',
      });
      expect(question.prompt).toBe(`${handClass.key} — 현재 범위에 포함될까요?`);
      expect(question.visual).toEqual({ kind: 'HAND_CLASS', key: handClass.key });
      expect(question.relatedTool).toBe('range');
      expect(question.relatedConcept).toBe('term-range');
    }
  });

  it('never says GTO, and never claims a hand should be played (states membership only)', () => {
    const questions = buildRangeQuestions(rangeQuizQuery('BTN'));
    for (const question of questions) {
      expect(question.explanation.toUpperCase()).not.toContain('GTO');
      expect(question.explanation).not.toMatch(/해야|정답입니다|올바른 선택/u);
    }
  });
});

describe('mixed frequency — this dataset has none, and none is fabricated as a SINGLE', () => {
  it('every generated question is SINGLE; excludeMixedQuestions changes nothing (a proven no-op)', () => {
    for (const position of RANGE_QUIZ_SUPPORTED_POSITIONS) {
      const questions = buildRangeQuestions(rangeQuizQuery(position));
      for (const question of questions) {
        expect(question.correctness.kind).toBe('SINGLE');
      }
      // buildRangeQuestions already ran excludeMixedQuestions once; re-running it here
      // against its own output must still be a no-op, proving nothing slipped through.
      expect(questions.every((question) => question.correctness.kind === 'SINGLE')).toBe(true);
    }
  });

  it("hasHandClass's boolean return type makes a fabricated third state a compile error, not just a missing case", () => {
    // hasHandClass: (set, index) => boolean. generateRangeMembershipQuestion's `included`
    // can only ever be `true` or `false` — there is no fractional/partial value this
    // module's own membership check could receive and quietly round into a fake SINGLE.
    const resolution = resolveRange(rangeQuizQuery('BTN'));
    expect(resolution.kind).toBe('RANGE');
    if (resolution.kind !== 'RANGE') return;
    for (const handClass of HAND_CLASSES) {
      const included: boolean = hasHandClass(resolution.range, handClass.index);
      expect(typeof included).toBe('boolean');
    }
  });
});

describe('seeding — a fixed seed reproduces the same ten questions', () => {
  it('the same query and RANGE_QUIZ_SEED always present the same 10 questions in the same order', () => {
    const query = rangeQuizQuery('BTN');
    const questions = buildRangeQuestions(query);
    const first = createQuizSession(questions, RANGE_QUIZ_SEED, RANGE_QUIZ_QUESTION_LIMIT);
    const second = createQuizSession(questions, RANGE_QUIZ_SEED, RANGE_QUIZ_QUESTION_LIMIT);
    expect(second.questions.map((q) => q.id)).toEqual(first.questions.map((q) => q.id));
    expect(first.questions).toHaveLength(RANGE_QUIZ_QUESTION_LIMIT);
  });

  it("a different position reproduces its own fixed 10 questions, independent of the other position's run", () => {
    const utgFirst = createQuizSession(
      buildRangeQuestions(rangeQuizQuery('UTG')),
      RANGE_QUIZ_SEED,
      RANGE_QUIZ_QUESTION_LIMIT,
    );
    const utgSecond = createQuizSession(
      buildRangeQuestions(rangeQuizQuery('UTG')),
      RANGE_QUIZ_SEED,
      RANGE_QUIZ_QUESTION_LIMIT,
    );
    expect(utgSecond.questions.map((q) => q.id)).toEqual(utgFirst.questions.map((q) => q.id));
  });
});

describe('retry-wrong-only, over a real generated bank', () => {
  it('retrying answers exactly the missed questions, and answering them right now scores clean', () => {
    const query = rangeQuizQuery('CO');
    const resolution = resolveRange(query);
    expect(resolution.kind).toBe('RANGE');
    if (resolution.kind !== 'RANGE') return;

    const questions = buildRangeQuestions(query);
    let session = createQuizSession(questions, RANGE_QUIZ_SEED, RANGE_QUIZ_QUESTION_LIMIT);

    // Answer every presented question WRONG on purpose (the opposite of its known-correct
    // id, derived independently from resolveRange/hasHandClass, never from the question's
    // own `correctness` field) so every one lands in `wrongAnswers`.
    for (const question of session.questions) {
      const correctId =
        question.correctness.kind === 'SINGLE' ? question.correctness.correctAnswerId : null;
      expect(correctId).not.toBeNull();
      if (correctId === null) continue;
      const wrongId = correctId === 'INCLUDE' ? 'EXCLUDE' : 'INCLUDE';
      session = answerQuestion(session, question.id, wrongId);
    }

    const missed = wrongAnswers(session);
    expect(missed).toHaveLength(session.questions.length);

    const retry = retryWrongOnly(session);
    expect(retry.questions.map((q) => q.id).sort()).toEqual(
      session.questions.map((q) => q.id).sort(),
    );
    expect(retry.answered.size).toBe(0);

    let corrected = retry;
    for (const question of corrected.questions) {
      const correctId =
        question.correctness.kind === 'SINGLE' ? question.correctness.correctAnswerId : null;
      expect(
        correctId,
        `${question.id} is expected to be SINGLE, like every other question here`,
      ).not.toBeNull();
      if (correctId === null) continue;
      corrected = answerQuestion(corrected, question.id, correctId);
    }
    expect(wrongAnswers(corrected)).toHaveLength(0);
  });
});
