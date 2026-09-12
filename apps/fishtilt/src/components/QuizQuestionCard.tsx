'use client';

/**
 * `QuizQuestionCard` — one question of a `Quiz` session: prompt, optional visual, answer
 * buttons, and — once answered — immediate feedback with the explanation and any cross-link
 * onward. `Quiz` renders this with `key={question.id}`, so remounting on question change is
 * exactly how focus lands on the new prompt (the mount effect below).
 *
 * ## Stage 3 layout (contract BF)
 *
 * The question is the whole screen, not a paragraph in a page: a numbered eyebrow, the
 * prompt as a large heading, the cards it is about drawn large and centred, and the
 * choices as BIG targets — a 2-column grid when every option carries its own cards (the
 * two-hands quizzes; the cards ARE the choice) and full-width rows otherwise, each at
 * least 56px tall. Feedback is a bordered panel with a verdict badge, then the explanation,
 * then the two compact "이어서 보기" rows, then one primary button.
 *
 * ## Answering is one-shot
 *
 * Once `answer` is defined the buttons disable — a reader cannot change their pick after
 * seeing the feedback. The engine itself does not enforce this (`answerQuestion` is happy
 * to overwrite an existing answer — see its module doc); it is a UI policy, enforced here,
 * not a rule of the data.
 *
 * ## Focus after answering
 *
 * The button the reader just pressed becomes `disabled`, and a disabled element cannot hold
 * focus — the browser drops it to `<body>`, so the next Tab would start again from the top
 * of the document. The effect below moves focus to "다음 문제" the moment an answer lands,
 * which is also where a keyboard reader wants to be.
 *
 * ## Feedback is never colour alone
 *
 * Same discipline as `MiniQuiz`: right/wrong is announced through `aria-live`, marked with
 * words ("정답이에요"/"아쉬워요") and a glyph (`○`/`×`), never colour by itself (WCAG 1.4.1).
 * A `'MIXED'` question (see `features/quiz/types.ts`) reveals every accepted id with `○` —
 * for the usual case that is one id, so this is not a special branch, just
 * `acceptableAnswerIds` returning more than one entry.
 */
import { useEffect, useRef } from 'react';
import { acceptableAnswerIds, isAnswerCorrect } from '../features/quiz/engine.js';
import type { AnsweredQuestion, QuizQuestion } from '../features/quiz/index.js';
import { QuizRelatedLinks } from './QuizRelatedLinks.js';
import { QuizVisualView } from './QuizVisual.js';

export interface QuizQuestionCardProps {
  readonly question: QuizQuestion;
  readonly index: number;
  readonly total: number;
  readonly answer: AnsweredQuestion | undefined;
  readonly onAnswer: (answerId: string) => void;
  readonly onNext: () => void;
  readonly isLast: boolean;
  readonly className?: string;
}

const ANSWER_BUTTON_BASE =
  'flex min-h-14 w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-base font-medium ' +
  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500';

const NEXT_BUTTON =
  'inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-md bg-brand-600 px-6 py-3 ' +
  'text-base font-semibold text-ink-on-brand outline-none transition-colors hover:bg-brand-hover ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto';

export function QuizQuestionCard({
  question,
  index,
  total,
  answer,
  onAnswer,
  onNext,
  isLast,
  className = '',
}: QuizQuestionCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const answered = answer !== undefined;

  useEffect(() => {
    headingRef.current?.focus();
    // Mount-only: this component is remounted per question via `key={question.id}` in
    // `Quiz`, so an empty dependency array is the "runs once when this question appears"
    // trigger, not a missing-dependency bug.
  }, []);

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  const accepted = new Set(acceptableAnswerIds(question));
  const isCorrect = answer !== undefined && isAnswerCorrect(question, answer.answerId);
  // The two-hands quizzes give every "real" option its own cards; only the tie option has
  // none. Those read best as a side-by-side pair with the tie row underneath.
  const visualOptions = question.answers.filter((option) => option.visual !== undefined).length;
  const pairLayout = visualOptions >= 2;

  return (
    <article className={className} data-quiz-question={question.id} data-answered={answered}>
      <p className="tabular text-xs font-semibold tracking-[0.06em] text-brand-500">
        {`문제 ${index + 1} / ${total}`}
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="prose-ko mt-2 text-xl font-semibold text-text-100 outline-none sm:text-2xl"
      >
        {question.prompt}
      </h2>

      {question.visual ? (
        <div className="mt-6 flex justify-center rounded-xl bg-ground-800 px-4 py-6">
          <QuizVisualView visual={question.visual} size="lg" />
        </div>
      ) : null}

      <ul className={`mt-6 grid gap-3 ${pairLayout ? 'sm:grid-cols-2' : ''}`}>
        {question.answers.map((option) => {
          const selected = answer?.answerId === option.id;
          const revealAsAccepted = answered && accepted.has(option.id);
          const revealAsWrong = selected && !revealAsAccepted;
          const tone = revealAsAccepted
            ? 'border-act-call-500 bg-panel-600 text-text-100'
            : revealAsWrong
              ? 'border-brand-500 bg-panel-600 text-text-100'
              : answered
                ? 'border-line-500/50 bg-panel-700 text-text-300'
                : 'border-line-500 bg-panel-700 text-text-100 hover:border-brand-500 hover:bg-panel-600';
          const withVisual = option.visual !== undefined;
          return (
            <li
              key={option.id}
              className={`min-w-0 ${pairLayout && !withVisual ? 'sm:col-span-2' : ''}`}
            >
              <button
                type="button"
                aria-pressed={selected}
                disabled={answered}
                onClick={() => onAnswer(option.id)}
                data-option={option.id}
                className={`${ANSWER_BUTTON_BASE} ${tone} enabled:cursor-pointer disabled:opacity-100 ${
                  withVisual ? 'flex-col items-start' : ''
                }`}
              >
                <span className="flex w-full items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      revealAsAccepted
                        ? 'bg-act-call-500 text-ink-on-action'
                        : revealAsWrong
                          ? 'bg-brand-600 text-ink-on-brand'
                          : 'border border-line-500 text-transparent'
                    }`}
                  >
                    {revealAsAccepted ? '○' : revealAsWrong ? '×' : ''}
                  </span>
                  <span>{option.label}</span>
                </span>
                {option.visual ? (
                  <span className="mt-1 block w-full min-w-0 sm:pl-9">
                    <QuizVisualView visual={option.visual} size="md" showReading={false} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div
          className={`mt-6 rounded-xl border-2 p-5 ${
            isCorrect ? 'border-act-call-500 bg-panel-700' : 'border-brand-500 bg-panel-700'
          }`}
          data-verdict={isCorrect ? 'correct' : 'wrong'}
        >
          <p
            role="status"
            aria-live="polite"
            className="prose-ko text-sm leading-[1.85] text-text-300"
          >
            <strong
              className={`mr-2 inline-flex items-center gap-1.5 text-base font-semibold ${
                isCorrect ? 'text-act-call-500' : 'text-brand-500'
              }`}
            >
              <span aria-hidden="true">{isCorrect ? '○' : '×'}</span>
              {isCorrect ? '정답이에요' : '아쉬워요'}
            </strong>
            {question.explanation}
          </p>

          <QuizRelatedLinks
            relatedTool={question.relatedTool}
            relatedConcept={question.relatedConcept}
            className="mt-4 border-t border-line-500 pt-2"
          />

          <div className="mt-5">
            <button ref={nextRef} type="button" onClick={onNext} className={NEXT_BUTTON}>
              {isLast ? '결과 보기' : '다음 문제'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
