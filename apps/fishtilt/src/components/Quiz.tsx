'use client';

/**
 * `Quiz` — the whole interactive island a `/practice/*` page drops its question bank into.
 * Owns the session state (`useState`, seeded once at construction — see the module doc on
 * `features/quiz/rng.ts` for why that makes the whole run reproducible) and which question
 * is currently showing; every actual poker fact and every scoring/retry rule lives in
 * `features/quiz/engine.ts`, which this component only calls.
 *
 * ## Why the current index is component state, not engine state
 *
 * The engine's `QuizSession` only tracks WHICH questions are answered, not which one the
 * reader is currently looking at — after answering, they stay on that question reading the
 * feedback until they press "다음 문제". That is a UI concern (what is on screen right now),
 * not a fact about the quiz's data, so it stays local `useState` here rather than growing
 * the pure session type for a concern the engine has no use for.
 *
 * ## Not reading `questions`/`seed`/`limit` again after mount
 *
 * Same idiom as `StartingHandExplorer`'s one-time URL read: the initial `useState` call
 * builds the session once, from whatever `questions`/`seed`/`limit` this component mounted
 * with. A `/practice/*` page hands this a fixed question bank and a fixed seed for the
 * page's lifetime, so there is no live prop this needs to react to after that.
 *
 * ## Stage 3 (contract BF)
 *
 * The session is framed as one focused surface: a progress rail (`QuizProgress`) whose
 * segments show every answered question's outcome, then the question card. The result
 * screen receives the bank's own lesson/tool (`related`, read off the first question — every
 * generator stamps the same pair on every question of a bank) so the score is a door onward.
 * Presentation only: the engine calls are the same four as before.
 */
import { useState } from 'react';
import {
  answerQuestion,
  createQuizSession,
  currentScore,
  retryWrongOnly,
  wrongAnswers,
  type QuizQuestion,
  type QuizSession,
} from '../features/quiz/index.js';
import { QuizProgress, type QuizSegmentState } from './QuizProgress.js';
import { QuizQuestionCard } from './QuizQuestionCard.js';
import { QuizResult } from './QuizResult.js';

export interface QuizProps {
  readonly questions: readonly QuizQuestion[];
  /** Seed for the reproducible shuffle — see `features/quiz/rng.ts`. Pin this in a test or a
   *  bug report to get back the exact quiz a reader saw. */
  readonly seed: number;
  /** Caps how many questions this session presents, after shuffling. Omit to use the whole
   *  bank. */
  readonly limit?: number;
  /** Accessible name for the quiz region. */
  readonly title?: string;
  readonly className?: string;
}

/** One rail segment per question in presented order — what `QuizProgress` draws. */
export function segmentStates(session: QuizSession, index: number): readonly QuizSegmentState[] {
  return session.questions.map((question, position) => {
    const answer = session.answered.get(question.id);
    if (answer !== undefined) return answer.isCorrect ? 'correct' : 'wrong';
    return position === index ? 'current' : 'todo';
  });
}

export function Quiz({ questions, seed, limit, title, className = '' }: QuizProps) {
  const [session, setSession] = useState<QuizSession>(() =>
    createQuizSession(questions, seed, limit),
  );
  const [index, setIndex] = useState(0);

  const restart = () => {
    setSession(createQuizSession(questions, seed, limit));
    setIndex(0);
  };

  if (session.questions.length === 0) {
    return (
      <div className={className} role="status">
        <p className="text-sm text-text-300">아직 풀 수 있는 문제가 없습니다.</p>
      </div>
    );
  }

  const total = session.questions.length;
  const first = session.questions[0];
  const related =
    first === undefined
      ? undefined
      : { relatedTool: first.relatedTool, relatedConcept: first.relatedConcept };

  if (index >= total) {
    return (
      <QuizResult
        className={className}
        score={currentScore(session)}
        wrong={wrongAnswers(session)}
        related={related}
        onRetryWrongOnly={() => {
          setSession(retryWrongOnly(session));
          setIndex(0);
        }}
        onRestart={restart}
      />
    );
  }

  const question = session.questions[index];
  if (question === undefined) {
    // Unreachable: `index < total === session.questions.length` above.
    throw new Error('quiz index out of range');
  }
  const answer = session.answered.get(question.id);

  return (
    <section aria-label={title ?? '퀴즈'} className={className} data-quiz-session>
      <QuizProgress
        states={segmentStates(session, index)}
        index={index}
        correctCount={currentScore(session).correctCount}
      />
      <QuizQuestionCard
        key={question.id}
        className="mt-6"
        question={question}
        index={index}
        total={total}
        answer={answer}
        onAnswer={(answerId) =>
          setSession((current) => answerQuestion(current, question.id, answerId))
        }
        onNext={() => setIndex((current) => current + 1)}
        isLast={index === total - 1}
      />
    </section>
  );
}
