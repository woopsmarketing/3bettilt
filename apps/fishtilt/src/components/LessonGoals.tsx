/**
 * `<LessonGoals>` — the learning-objectives block at the top of a lesson (WP-S3-09,
 * contract AS). Prose declares it as `<LessonGoals items={['…', '…']} />`.
 *
 * `items` are STRINGS on purpose. `measureContent` strips JSX attributes and keeps JSX
 * children, so goals written as attributes do not move a lesson's measured length and
 * therefore do not change its pinned `readMinutes` — a content agent can add this block to a
 * shipped lesson without touching the registry. The cost is that an item cannot embed a
 * `<Fact>`, which is the right constraint: a goal describes what the reader will be able to
 * do, never a number (rule 3 — numbers belong in the prose, as `<Fact>`s).
 *
 * No heading element: the lesson's outline belongs to its `##` sections and the page's one
 * `<h1>`. The label is a `<p>` and the region is named through `aria-label`.
 */
export interface LessonGoalsProps {
  readonly items: readonly string[];
  readonly title?: string;
  readonly className?: string;
}

const DEFAULT_TITLE = '이 레슨에서 배우는 것';

export function LessonGoals({ items, title = DEFAULT_TITLE, className = '' }: LessonGoalsProps) {
  if (items.length === 0) return null;
  return (
    <section
      data-lesson="goals"
      aria-label={title}
      className={`my-8 rounded-lg border border-line-500 bg-panel-700 p-6 ${className}`}
    >
      <p className="text-sm font-semibold tracking-[0.06em] text-brand-500">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 prose-ko text-[0.9375rem] leading-[1.75] text-text-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="mt-[0.35rem] h-4 w-4 shrink-0 text-brand-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5l3 3 7-7" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
