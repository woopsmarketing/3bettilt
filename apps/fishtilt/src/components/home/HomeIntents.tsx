/**
 * `HomeIntents` — "어디서 시작할까요?": four reasons a person lands here, four destinations.
 *
 * Rows, not a card grid (D-S3-17). Each row is one intent in the reader's own words, what
 * they will find, and where it goes. The row's link is the intent sentence itself
 * (`<h3><a>`), so the accessible name is the thing the reader recognises rather than a
 * generic "바로 가기". Destinations arrive already resolved (`string | null`); `null`
 * renders the site's non-interactive "준비 중" text, never a link.
 */
export interface HomeIntent {
  readonly id: string;
  /** The reader's own sentence — `포커가 완전 처음이에요`. */
  readonly title: string;
  readonly description: string;
  /** Where the row goes, in words — `배우기 · 1편부터`. */
  readonly destination: string;
  readonly href: string | null;
}

export interface HomeIntentsProps {
  readonly intents: readonly HomeIntent[];
  readonly labelledBy: string;
  readonly className?: string;
}

const LINK =
  'group inline-flex min-h-11 items-center gap-2 prose-ko text-xl font-semibold text-text-100 outline-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:text-2xl';

export function HomeIntents({ intents, labelledBy, className = '' }: HomeIntentsProps) {
  return (
    <ol
      aria-labelledby={labelledBy}
      className={`divide-y divide-line-500 border-y border-line-500 ${className}`}
    >
      {intents.map((intent, index) => (
        <li
          key={intent.id}
          data-intent={intent.id}
          className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-baseline lg:py-7"
        >
          <span aria-hidden="true" className="tabular font-mono text-sm text-text-300">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h3>
              {intent.href === null ? (
                <span className="inline-flex min-h-11 items-center gap-2 prose-ko text-xl font-semibold text-text-300 sm:text-2xl">
                  {intent.title}
                  <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
                    준비 중
                  </span>
                </span>
              ) : (
                <a href={intent.href} className={LINK}>
                  {intent.title}
                  <span
                    aria-hidden="true"
                    className="text-brand-500 transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </a>
              )}
            </h3>
            <p className="mt-1 max-w-lead prose-ko text-[0.9375rem] text-text-300">
              {intent.description}
            </p>
          </div>
          <p className="text-sm font-medium text-text-300 sm:text-right">{intent.destination}</p>
        </li>
      ))}
    </ol>
  );
}
