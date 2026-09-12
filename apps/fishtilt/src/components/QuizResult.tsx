'use client';

/**
 * `QuizResult` — the end-of-quiz screen `Quiz` shows once every question is answered:
 * the score as the one big number on the page, the missed items (each with what the
 * reader picked, the accepted answer, and the explanation again — a reader reviewing
 * mistakes should not have to remember what the explanation said), the two ways to go
 * again — `틀린 패 다시 풀기` (retry-wrong-only, the build spec's required flow) and start
 * over — and, once, the lesson and tool the bank points at (`related`), so the result is a
 * door onward rather than a dead end (Stage 3 contract BF).
 *
 * The score bar is `aria-hidden` and `role="status"` carries the sentence; the number is
 * never the only carrier of the outcome.
 */
import { useEffect, useRef } from 'react';
import { acceptableAnswerIds } from '../features/quiz/engine.js';
import type { AnsweredQuestion, QuizScore } from '../features/quiz/index.js';
import { QuizRelatedLinks } from './QuizRelatedLinks.js';
import { QuizVisualView } from './QuizVisual.js';

export interface QuizResultRelated {
  readonly relatedTool?: string;
  readonly relatedConcept?: string;
}

export interface QuizResultProps {
  readonly score: QuizScore;
  readonly wrong: readonly AnsweredQuestion[];
  readonly onRetryWrongOnly: () => void;
  readonly onRestart: () => void;
  /** The bank's own lesson/tool — shown once under the score. */
  readonly related?: QuizResultRelated;
  readonly className?: string;
}

const BUTTON_BASE =
  'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md px-5 py-2.5 font-semibold ' +
  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function labelsOf(answer: AnsweredQuestion, ids: ReadonlySet<string>): string {
  return answer.question.answers
    .filter((option) => ids.has(option.id))
    .map((option) => option.label)
    .join(', ');
}

export function QuizResult({
  score,
  wrong,
  onRetryWrongOnly,
  onRestart,
  related,
  className = '',
}: QuizResultProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const perfect = wrong.length === 0;
  const share = score.totalQuestions === 0 ? 0 : score.correctCount / score.totalQuestions;

  return (
    <section aria-labelledby="quiz-result-heading" className={className} data-quiz-result>
      <h2
        id="quiz-result-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-xs font-semibold tracking-[0.06em] text-brand-500 outline-none"
      >
        퀴즈 결과
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p
          className="tabular text-5xl font-bold leading-none text-text-100 sm:text-6xl"
          aria-hidden="true"
        >
          {score.correctCount}
          <span className="text-2xl font-semibold text-text-300 sm:text-3xl">{` / ${score.totalQuestions}`}</span>
        </p>
        <p role="status" aria-live="polite" className="pb-1 text-base text-text-300">
          {`총 ${score.totalQuestions}문제 중 ${score.correctCount}개 정답`}
        </p>
      </div>
      <div
        aria-hidden="true"
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line-500/30"
      >
        <div
          className="h-full rounded-full bg-act-call-500"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>

      <p className="prose-ko mt-4 text-base text-text-100">
        {perfect ? '모든 문제를 맞혔습니다!' : `${wrong.length}문제는 아래에서 다시 확인해보세요.`}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {!perfect ? (
          <button
            type="button"
            onClick={onRetryWrongOnly}
            className={`${BUTTON_BASE} bg-brand-600 text-ink-on-brand hover:bg-brand-hover`}
          >
            틀린 패 다시 풀기
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRestart}
          className={`${BUTTON_BASE} border border-line-500 bg-panel-700 text-text-100 hover:border-brand-500`}
        >
          처음부터 다시 풀기
        </button>
      </div>

      {!perfect ? (
        <div className="mt-10">
          <h3 className="text-base font-semibold text-text-100">다시 봐야 할 문제</h3>
          <ol className="mt-4 space-y-4">
            {wrong.map((answer) => {
              const accepted = new Set(acceptableAnswerIds(answer.question));
              const picked = answer.question.answers.find(
                (option) => option.id === answer.answerId,
              );
              return (
                <li
                  key={answer.question.id}
                  className="rounded-xl border border-line-500 bg-panel-700 p-5"
                  data-review={answer.question.id}
                >
                  <p className="prose-ko font-semibold text-text-100">{answer.question.prompt}</p>
                  {answer.question.visual ? (
                    <div className="mt-3">
                      <QuizVisualView visual={answer.question.visual} size="sm" />
                    </div>
                  ) : null}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-text-300">내 답</dt>
                    <dd className="flex items-center gap-1.5 text-text-100">
                      <span aria-hidden="true" className="text-brand-500">
                        ×
                      </span>
                      {picked?.label ?? answer.answerId}
                    </dd>
                    <dt className="text-text-300">정답</dt>
                    <dd className="flex items-center gap-1.5 text-text-100">
                      <span aria-hidden="true" className="text-act-call-500">
                        ○
                      </span>
                      {labelsOf(answer, accepted)}
                    </dd>
                  </dl>
                  <p className="prose-ko mt-3 text-sm leading-[1.85] text-text-300">
                    {answer.question.explanation}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {related !== undefined &&
      (related.relatedConcept !== undefined || related.relatedTool !== undefined) ? (
        <div className="mt-10 border-t border-line-500 pt-6">
          <p className="text-sm font-semibold text-text-100">이어서 보기</p>
          <QuizRelatedLinks
            relatedTool={related.relatedTool}
            relatedConcept={related.relatedConcept}
            className="mt-2"
          />
        </div>
      ) : null}
    </section>
  );
}
