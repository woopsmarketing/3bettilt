'use client';

/**
 * `MiniQuiz` — the three-question check at the end of a lesson (build spec §27).
 *
 * A genuinely interactive island, so it is a client component; everything around it in the
 * article stays server-rendered (§48). It stores nothing: no localStorage, no analytics, no
 * account (§50). Answering is a conversation with yourself.
 *
 * ## What it is not allowed to be
 *
 * A quiz is an assertion about the game, so the same rule applies to it as to prose: it must
 * not state a recommendation, a frequency or any figure this repository cannot compute
 * (CLAUDE.md rule 2). In practice a lesson's questions are about what a word MEANS and how
 * the chart is READ — things that follow from the rules of the game — and the numbers a
 * reader needs to answer them are on the page already, rendered by `Fact` and `RangeSummary`
 * from the packages.
 *
 * ## Feedback is never colour alone
 *
 * A wrong answer is marked with a word ("아쉬워요") and a glyph as well as a colour, and the
 * result is announced through `aria-live` so it is not a purely visual change (WCAG 1.4.1,
 * build spec §49). Options are real buttons with 44px touch targets.
 */
import { useState } from 'react';

export interface MiniQuizQuestion {
  readonly question: string;
  readonly options: readonly string[];
  /** Index into `options`. Validated at render — an out-of-range answer throws. */
  readonly answer: number;
  /** Shown after answering, whether right or wrong. This is where the teaching happens. */
  readonly explanation: string;
}

export interface MiniQuizProps {
  readonly questions: readonly MiniQuizQuestion[];
  /**
   * A visible heading for the block. OMITTED by default, and deliberately so: in an article
   * the section already has its own `##` heading immediately above, and rendering a second
   * one would put the same sentence on the page twice and add a phantom level to the
   * document outline. Without it the block still has an accessible name (`aria-label`).
   */
  readonly title?: string;
  readonly className?: string;
}

const OPTION_BASE =
  'flex min-h-11 w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm ' +
  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500';

export function MiniQuiz({ questions, title, className = '' }: MiniQuizProps) {
  for (const [index, question] of questions.entries()) {
    if (question.answer < 0 || question.answer >= question.options.length) {
      throw new Error(`MiniQuiz question ${index} has an answer outside its options`);
    }
  }

  const [chosen, setChosen] = useState<readonly (number | null)[]>(() => questions.map(() => null));

  const answeredCount = chosen.filter((value) => value !== null).length;
  const correctCount = chosen.filter(
    (value, index) => value !== null && value === questions[index]?.answer,
  ).length;

  const choose = (questionIndex: number, optionIndex: number) => {
    setChosen((current) =>
      current.map((value, index) => (index === questionIndex ? optionIndex : value)),
    );
  };

  return (
    <section
      className={`my-10 rounded-lg border border-line-500 bg-panel-700 p-6 ${className}`}
      aria-label={title ?? '확인 문제'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {title ? <h2 className="text-lg font-semibold text-text-100">{title}</h2> : <span />}
        <p className="tabular text-sm text-text-300" aria-live="polite">
          {answeredCount === 0
            ? `${questions.length}문제`
            : `${answeredCount} / ${questions.length}문제 · 맞힌 문제 ${correctCount}개`}
        </p>
      </div>

      <ol className="mt-6 space-y-8">
        {questions.map((question, questionIndex) => {
          const picked = chosen[questionIndex] ?? null;
          const isCorrect = picked !== null && picked === question.answer;
          return (
            <li key={question.question}>
              <p className="font-medium text-text-100">
                <span className="tabular mr-2 text-brand-500">{questionIndex + 1}.</span>
                {question.question}
              </p>

              <ul className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = picked === optionIndex;
                  const revealAsAnswer = picked !== null && optionIndex === question.answer;
                  const revealAsWrong = selected && !isCorrect;
                  const tone = revealAsAnswer
                    ? 'border-act-call-500 bg-panel-600 text-text-100'
                    : revealAsWrong
                      ? 'border-brand-500 bg-panel-600 text-text-100'
                      : 'border-line-500 bg-panel-600 text-text-100 hover:border-brand-500';
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => choose(questionIndex, optionIndex)}
                        className={`${OPTION_BASE} ${tone} cursor-pointer`}
                      >
                        <span aria-hidden="true" className="w-4 shrink-0 text-center">
                          {revealAsAnswer ? '○' : revealAsWrong ? '×' : ''}
                        </span>
                        <span>{option}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {picked !== null ? (
                <p className="mt-3 rounded-md border border-line-500 bg-panel-600 p-4 text-sm leading-[1.85] text-text-300">
                  <strong className="mr-2 font-semibold text-text-100">
                    {isCorrect ? '정답이에요' : '아쉬워요'}
                  </strong>
                  {question.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {answeredCount > 0 ? (
        <button
          type="button"
          onClick={() => setChosen(questions.map(() => null))}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-500 px-4 py-2 text-sm text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          다시 풀기
        </button>
      ) : null}
    </section>
  );
}
