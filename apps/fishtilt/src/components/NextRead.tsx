/**
 * `NextRead` — the previous/next pair at the foot of an article (D-S3-13).
 *
 * The one relation `RelatedContent` cannot express: a linear order. A lesson has a next
 * lesson and a story has the one after it, and a reader who finished this one wants exactly
 * that, not a grid. Two links at most, in a `<nav>` named by its label (default "다음으로
 * 읽기", which is also one of `RelatedContent`'s label set, D-S3-16, so the two blocks use
 * the same words for the same idea).
 *
 * `href: null` renders the site's "준비 중" treatment — the next piece is planned, not
 * written — as `LinkCard` and `ToolCTA` do. A plain `<a>`, not `next/link` (`RouteNavItem`).
 *
 * ## `emphasis="next"` (WP-S3-19, review B-M4)
 *
 * The default is the symmetric prev/next pair, and at the foot of a lesson it was the LAST
 * and SMALLEST thing after five relation groups — the one action the product wants after a
 * lesson (다음 레슨) set quieter than a glossary cross-link. With `emphasis="next"` the next
 * piece becomes one full-width step — a raised panel with the title at heading size and an
 * arrow, the model the home CTA band already uses — and the previous piece drops to one
 * line under it. Same landmark, same `data-direction` hooks, same 준비 중 rule; only the
 * weight changes, so the templates can place it ABOVE the related groups.
 */
export interface NextReadLink {
  readonly href: string | null;
  readonly title: string;
  /** Small print under the title — "레슨 4", "약 3분". */
  readonly meta?: string;
}

export interface NextReadProps {
  readonly prev?: NextReadLink;
  readonly next?: NextReadLink;
  readonly label?: string;
  /** `next`: the next piece as one prominent step, the previous one as a line under it. */
  readonly emphasis?: 'next';
  readonly className?: string;
}

const DEFAULT_LABEL = '다음으로 읽기';

function Entry({
  link,
  direction,
}: {
  readonly link: NextReadLink;
  readonly direction: 'prev' | 'next';
}) {
  const eyebrow = direction === 'prev' ? '이전' : '다음';
  const body = (
    <>
      <span className="block text-xs font-medium tracking-[0.06em] text-text-300">{eyebrow}</span>
      <span className="mt-1.5 block prose-ko font-semibold text-text-100">{link.title}</span>
      {link.meta ? <span className="mt-1 block text-xs text-text-300">{link.meta}</span> : null}
    </>
  );
  const alignment = direction === 'next' ? 'sm:text-right' : '';

  if (link.href === null) {
    return (
      <div data-direction={direction} className={`min-w-0 py-5 ${alignment}`}>
        {body}
        <span className="mt-2 inline-block rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
          준비 중
        </span>
      </div>
    );
  }

  return (
    <a
      href={link.href}
      data-direction={direction}
      className={`block min-w-0 rounded-md py-5 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${alignment}`}
    >
      {body}
    </a>
  );
}

const PLANNED_BADGE =
  'rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300';

function NextStep({ link }: { readonly link: NextReadLink }) {
  const body = (
    <>
      <span className="block text-xs font-medium tracking-[0.06em] text-text-300">다음</span>
      <span className="mt-2 flex items-start justify-between gap-4">
        <span className="prose-ko block text-xl font-semibold text-text-100 transition-colors group-hover:text-brand-500 sm:text-2xl">
          {link.title}
        </span>
        {link.href === null ? (
          <span className={`mt-1.5 shrink-0 ${PLANNED_BADGE}`}>준비 중</span>
        ) : (
          <span
            aria-hidden="true"
            className="shrink-0 text-2xl leading-none text-brand-500 transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        )}
      </span>
      {link.meta ? <span className="mt-2 block text-sm text-text-300">{link.meta}</span> : null}
    </>
  );
  const frame = 'block min-w-0 rounded-xl bg-ground-800 px-6 py-6 sm:px-8 sm:py-7';
  if (link.href === null) {
    return (
      <div data-direction="next" className={frame}>
        {body}
      </div>
    );
  }
  return (
    <a
      href={link.href}
      data-direction="next"
      className={`group ${frame} outline-none transition-colors hover:bg-panel-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
    >
      {body}
    </a>
  );
}

function PrevLine({ link }: { readonly link: NextReadLink }) {
  const title =
    link.href === null ? (
      <span data-direction="prev" className="inline-flex items-center gap-2 text-text-100">
        {link.title}
        <span className={PLANNED_BADGE}>준비 중</span>
      </span>
    ) : (
      <a
        href={link.href}
        data-direction="prev"
        className="rounded-sm font-medium text-text-100 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {link.title}
      </a>
    );
  return (
    <p className="prose-ko mt-4 px-1 text-sm text-text-300">
      <span className="text-xs font-medium tracking-[0.06em]">이전</span>
      <span aria-hidden="true"> · </span>
      {title}
      {link.meta ? <span className="text-xs"> · {link.meta}</span> : null}
    </p>
  );
}

export function NextRead({
  prev,
  next,
  label = DEFAULT_LABEL,
  emphasis,
  className = '',
}: NextReadProps) {
  if (prev === undefined && next === undefined) return null;
  if (emphasis === 'next') {
    return (
      <nav aria-label={label} data-emphasis="next" className={`my-12 ${className}`}>
        {next !== undefined ? <NextStep link={next} /> : null}
        {prev !== undefined ? <PrevLine link={prev} /> : null}
      </nav>
    );
  }
  return (
    <nav aria-label={label} className={`my-12 border-y border-line-500 ${className}`}>
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div>{prev !== undefined ? <Entry link={prev} direction="prev" /> : null}</div>
        <div>{next !== undefined ? <Entry link={next} direction="next" /> : null}</div>
      </div>
    </nav>
  );
}
