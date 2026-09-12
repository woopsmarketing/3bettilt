/**
 * The quiz engine itself: turning a bank of `QuizQuestion`s into a session, scoring it, and
 * building the retry-wrong-only follow-up. Every function here is pure and total except
 * where a malformed `QuizQuestion` makes that impossible (CLAUDE.md rule 5: fail loudly on
 * corrupt input rather than silently producing a broken quiz — the same discipline
 * `learn-core`'s `ranking.ts` applies to its own dataset at load time).
 *
 * ## `compactQuestions` — the seam that keeps `UNSUPPORTED` honest
 *
 * A generator built against `resolveRange` (or any other facade with an honest failure
 * state) cannot always produce a question — `resolveRange` returning `'UNSUPPORTED'` must
 * never be turned into a fabricated question (WP-L1 brief). The contract this engine
 * expects from such a generator is simply: return `QuizQuestion | null`, and call
 * `compactQuestions` before handing the array to `createQuizSession`. Nothing here invents
 * a placeholder for a `null` — it is dropped, in order, and that is the whole function.
 */
import { shuffleWithSeed } from './rng.js';
import type {
  AnsweredQuestion,
  QuizQuestion,
  QuizScore,
  QuizSession,
} from './types.js';

/** Total. Every answer id this question would accept as correct — one for `'SINGLE'`, one
 *  or more for `'MIXED'`. The single place both branches of `QuizCorrectness` are read. */
export function acceptableAnswerIds(question: QuizQuestion): readonly string[] {
  return question.correctness.kind === 'SINGLE'
    ? [question.correctness.correctAnswerId]
    : question.correctness.correctAnswerIds;
}

/** Total. Whether `answerId` is one of this question's accepted answers. Scores a
 *  `'MIXED'` question exactly the same way as a `'SINGLE'` one — see the module doc on
 *  `types.ts` for why that is the honest way to "score it accordingly" rather than a special
 *  case. */
export function isAnswerCorrect(question: QuizQuestion, answerId: string): boolean {
  return acceptableAnswerIds(question).includes(answerId);
}

/** Total. Whether this question's honest answer is a "genuinely mixed" one rather than a
 *  clean single pick. */
export function isMixedQuestion(question: QuizQuestion): boolean {
  return question.correctness.kind === 'MIXED';
}

/** Total. Drops every `'MIXED'` question — the "or be excluded" half of the WP-L1 brief's
 *  mixed-frequency requirement, for a quiz that would rather not ask about a tie at all.
 *  Order-preserving. */
export function excludeMixedQuestions(questions: readonly QuizQuestion[]): readonly QuizQuestion[] {
  return questions.filter((question) => !isMixedQuestion(question));
}

/** Total. Drops `null`/`undefined` entries — the one-line idiom a generator built on an
 *  honest facade (`resolveRange`, or any other `Result`-shaped lookup) uses to turn "this
 *  query has no honest answer" into "this query contributes no question", never a fabricated
 *  one. Order-preserving. */
export function compactQuestions(
  candidates: readonly (QuizQuestion | null | undefined)[],
): readonly QuizQuestion[] {
  return candidates.filter(
    (candidate): candidate is QuizQuestion => candidate !== null && candidate !== undefined,
  );
}

function assertValidQuestion(question: QuizQuestion): void {
  if (question.answers.length < 2) {
    throw new Error(`quiz question "${question.id}" has fewer than two answers`);
  }
  const answerIds = new Set(question.answers.map((answer) => answer.id));
  if (answerIds.size !== question.answers.length) {
    throw new Error(`quiz question "${question.id}" has duplicate answer ids`);
  }
  const accepted = acceptableAnswerIds(question);
  if (accepted.length === 0) {
    throw new Error(`quiz question "${question.id}" names no correct answer`);
  }
  for (const id of accepted) {
    if (!answerIds.has(id)) {
      throw new Error(
        `quiz question "${question.id}" names correct answer "${id}", which is not one of its options`,
      );
    }
  }
}

/**
 * Total (throws only for malformed input, never for a legal one). Builds a fresh session:
 * validates every question, shuffles the whole bank with `seed` (`rng.ts` — deterministic,
 * reproducible), then takes the first `limit` (or every question, if `limit` is omitted).
 *
 * Duplicate question ids across `questions` are rejected — `answerQuestion`/`wrongAnswers`
 * key on `question.id`, and a duplicate would let one answer silently stand in for two
 * different questions.
 */
export function createQuizSession(
  questions: readonly QuizQuestion[],
  seed: number,
  limit?: number,
): QuizSession {
  for (const question of questions) assertValidQuestion(question);

  const ids = new Set(questions.map((question) => question.id));
  if (ids.size !== questions.length) {
    throw new Error('createQuizSession received questions with duplicate ids');
  }

  const shuffled = shuffleWithSeed(questions, seed);
  const selected = limit === undefined ? shuffled : shuffled.slice(0, Math.max(0, limit));
  return { seed, questions: selected, answered: new Map() };
}

/**
 * Records (or overwrites) the reader's answer to one question in this session. Answering
 * an already-answered question again is allowed — the engine does not enforce "answer
 * once"; a UI that wants that (this WP's `Quiz` component does — see its module doc) simply
 * disables the buttons once `session.answered.has(question.id)`.
 *
 * Throws for a question id not in this session, or an answer id not one of that question's
 * options — both are programming errors (a stale reference, a typo), never a state a real
 * reader can reach through the UI this WP ships.
 */
export function answerQuestion(
  session: QuizSession,
  questionId: string,
  answerId: string,
): QuizSession {
  const question = session.questions.find((candidate) => candidate.id === questionId);
  if (question === undefined) {
    throw new Error(`question "${questionId}" is not part of this session`);
  }
  if (!question.answers.some((answer) => answer.id === answerId)) {
    throw new Error(`"${answerId}" is not one of question "${questionId}"'s answers`);
  }

  const answered = new Map(session.answered);
  answered.set(questionId, { question, answerId, isCorrect: isAnswerCorrect(question, answerId) });
  return { ...session, answered };
}

export function isAnswered(session: QuizSession, questionId: string): boolean {
  return session.answered.has(questionId);
}

/** Total. Every question in the session has an answer. `true` for a zero-question session —
 *  vacuously "done", and it is the caller's job (this WP's `Quiz` component does it) to
 *  render an honest "no questions" state instead of a result screen for that case. */
export function isComplete(session: QuizSession): boolean {
  return session.answered.size === session.questions.length;
}

/** Total. Tallies only what has been answered so far — a mid-quiz score, not just a final
 *  one, so a caller can show a running "N / total문제" line the way `MiniQuiz` does. */
export function currentScore(session: QuizSession): QuizScore {
  let correct = 0;
  for (const answer of session.answered.values()) {
    if (answer.isCorrect) correct += 1;
  }
  return {
    totalQuestions: session.questions.length,
    answeredCount: session.answered.size,
    correctCount: correct,
    incorrectCount: session.answered.size - correct,
  };
}

/** Total. Every answered-and-wrong question, in the session's presented order (not answer
 *  order) — the order `retryWrongOnly` and a results list should both read off. */
export function wrongAnswers(session: QuizSession): readonly AnsweredQuestion[] {
  const wrong: AnsweredQuestion[] = [];
  for (const question of session.questions) {
    const answer = session.answered.get(question.id);
    if (answer !== undefined && !answer.isCorrect) wrong.push(answer);
  }
  return wrong;
}

/**
 * The retry-wrong-only flow the build spec requires: a brand-new, unanswered session over
 * exactly the questions the reader missed last time, reshuffled with the SAME seed (so this
 * is reproducible too — the same wrong set always retries in the same order). Returns a
 * session with zero questions, correctly, when nothing was missed; a caller only offers this
 * action when `wrongAnswers(session).length > 0`.
 */
export function retryWrongOnly(session: QuizSession): QuizSession {
  const missed = wrongAnswers(session).map((answer) => answer.question);
  return createQuizSession(missed, session.seed);
}
