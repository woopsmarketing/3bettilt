/**
 * `HomeQuiz` — the practice entry: an invitation, then the quizzes as rows, then the hub.
 *
 * The one band on the page that asks the reader something rather than showing them
 * something, so it is set as a large typographic statement with the three quizzes beside
 * it — not three cards. Every destination arrives resolved; an unbuilt quiz is readable
 * text with the "준비 중" badge and no link semantics (`practiceHubCards` tolerates a route
 * that is not registered yet).
 */
import type { PracticeHubCard } from '../../features/quiz/index.js';

export interface HomeQuizProps {
  readonly quizzes: readonly PracticeHubCard[];
  /** The practice hub, resolved. */
  readonly practiceHref: string | null;
  readonly className?: string;
}

const PRIMARY_LINK =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 font-medium ' +
  'text-ink-on-brand outline-none transition-colors hover:bg-brand-hover focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const ROW_LINK =
  'inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-text-100 outline-none hover:text-brand-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function HomeQuiz({ quizzes, practiceHref, className = '' }: HomeQuizProps) {
  return (
    <div className={`grid gap-10 lg:grid-cols-12 lg:gap-14 ${className}`}>
      <div className="min-w-0 lg:col-span-5">
        <p className="prose-ko text-xl font-semibold text-text-100">
          읽은 것을 문제로 확인하는 가장 빠른 방법입니다.
        </p>
        <p className="mt-3 max-w-lead prose-ko text-base text-text-300">
          로그인도 점수판도 없고, 틀린 문제는 그냥 다시 풀면 됩니다. 정답을 고르면 왜 그런지도 같이
          보여줍니다.
        </p>
        {practiceHref !== null ? (
          <p className="mt-6">
            <a href={practiceHref} className={PRIMARY_LINK}>
              퀴즈 전체 보기
            </a>
          </p>
        ) : null}
      </div>
      <ol className="min-w-0 divide-y divide-line-500 border-y border-line-500 lg:col-span-7">
        {quizzes.map((quiz) => {
          const href = quiz.route?.available === true ? quiz.route.path : null;
          return (
            <li key={quiz.id} data-quiz={quiz.id} className="py-4">
              {href === null ? (
                <span className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-text-300">
                  {quiz.label}
                  <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
                    준비 중
                  </span>
                </span>
              ) : (
                <a href={href} className={ROW_LINK}>
                  {quiz.label}
                  <span aria-hidden="true" className="text-brand-500">
                    →
                  </span>
                </a>
              )}
              <p className="prose-ko text-sm text-text-300">{quiz.description}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
