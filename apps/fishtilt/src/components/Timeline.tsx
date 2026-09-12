/**
 * `Timeline` — vertical, numbered steps with a rail down the left (D-S3-12).
 *
 * For "how a hand proceeds", "what to do at the table in order", "the three things to
 * check before you call" — sequences the layout brief wants shown as a sequence rather than
 * as a bullet list. It is an `<ol>` first and a drawing second: the numbers are real list
 * numbers, the rail is a border on the item, and nothing here needs JavaScript.
 *
 * `HandTimeline` (the action list of one street in a hand story) reuses `TIMELINE_RAIL`
 * so an article's step list and a story's action list share one rail, and
 * `BettingTimeline` is the horizontal cousin for a bet sequence. Three consumers, one line.
 */
export interface TimelineStep {
  readonly title: string;
  readonly body?: React.ReactNode;
  /** Small print beside the title — a street, a time, a position. */
  readonly meta?: string;
}

export interface TimelineProps {
  readonly steps: readonly TimelineStep[];
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/** The rail and the marker, shared with `HandTimeline`. */
export const TIMELINE_RAIL = {
  list: 'relative space-y-0',
  item: 'relative border-l border-line-500 pb-8 pl-8 last:pb-0',
  marker:
    'tabular absolute -left-[0.8125rem] top-0 inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full border border-line-500 bg-ground-900 text-xs font-semibold text-text-100',
} as const;

export function Timeline({ steps, 'aria-label': ariaLabel, className = '' }: TimelineProps) {
  if (steps.length === 0) return null;
  return (
    <ol aria-label={ariaLabel} className={`${TIMELINE_RAIL.list} ${className}`}>
      {steps.map((step, index) => (
        <li key={step.title} className={TIMELINE_RAIL.item}>
          <span aria-hidden="true" className={TIMELINE_RAIL.marker}>
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="prose-ko text-base font-semibold text-text-100">{step.title}</span>
              {step.meta ? <span className="text-xs text-text-300">{step.meta}</span> : null}
            </p>
            {step.body ? (
              <div className="mt-1.5 prose-ko text-[0.9375rem] text-text-300">{step.body}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
