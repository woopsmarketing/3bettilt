/**
 * `QuizProgress` — the rail of one segment per question above a `Quiz` session, plus the
 * one sentence a screen reader hears (`3 / 10문제 · 맞힌 문제 2개`).
 *
 * The rail is `aria-hidden`: it repeats what the sentence says, in a form only eyes can
 * read. Each segment carries `data-state` — `correct` / `wrong` / `current` / `todo` — and
 * is coloured AND shaped by it (a current segment is taller; a wrong one carries a short
 * inner mark), so the four states survive colour removal (WCAG 1.4.1). Nothing here is a
 * control: a reader cannot jump between questions, so the segments are plain spans and
 * never a 44px target the responsive audit would have to measure.
 *
 * The sentence is the exact string the quiz has always announced; `hand-ranking-quiz.spec.ts`
 * and `Quiz.test.tsx` pin it, and it is the one live region on the page before an answer
 * is given (the feedback `role="status"` appears after).
 */
export type QuizSegmentState = 'correct' | 'wrong' | 'current' | 'todo';

export interface QuizProgressProps {
  readonly states: readonly QuizSegmentState[];
  /** 0-based index of the question on screen. */
  readonly index: number;
  readonly correctCount: number;
  readonly className?: string;
}

const SEGMENT_CLASS: Readonly<Record<QuizSegmentState, string>> = {
  correct: 'bg-act-call-500',
  wrong: 'bg-brand-600',
  current: 'bg-text-100',
  todo: 'bg-line-500/40',
};

export function QuizProgress({ states, index, correctCount, className = '' }: QuizProgressProps) {
  const total = states.length;
  return (
    <div className={className} data-quiz-progress>
      <div aria-hidden="true" className="flex h-3 items-end gap-1">
        {states.map((state, position) => (
          <span
            // Positional by nature: segment N is question N.
            key={`${position}-${state}`}
            data-state={state}
            className={`relative block flex-1 rounded-sm transition-[height] ${SEGMENT_CLASS[state]} ${
              state === 'current' ? 'h-3' : 'h-1.5'
            }`}
          >
            {state === 'wrong' ? (
              <span className="absolute inset-x-[35%] inset-y-0 rounded-sm bg-ground-900/70" />
            ) : null}
          </span>
        ))}
      </div>
      <p aria-live="polite" className="tabular mt-3 text-sm text-text-300">
        {`${index + 1} / ${total}문제 · 맞힌 문제 ${correctCount}개`}
      </p>
    </div>
  );
}
