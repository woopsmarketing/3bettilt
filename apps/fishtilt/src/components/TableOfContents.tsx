/**
 * `TableOfContents` — the in-page navigation for a long article (D-S3-13; editorial upgrade).
 *
 * Built from a HEADING LIST the page passes in, never by scanning the DOM: this is a server
 * component, it renders into the prerendered HTML, and the list is derived from the article's
 * own MDX source (`articleHeadings.ts`), so it is the same on the server, in a test and in a
 * screenshot. Each entry links to `#id`; the editorial `h2` derives the same id from the same
 * text (`EditorialHeadings.tsx`) and carries a scroll margin for the sticky header.
 *
 * ## One list, two widths
 *
 * A quiet box at the head of the article — numbered when the article's chapters are
 * (`numbered`), in two columns once there are more than five on a wide screen. With
 * `collapsible` (article pages) the same single list sits in a native `<details>`: closed on a
 * phone ("목차 · N개 섹션"), so the article starts on the first screen, and forced open from
 * `lg` up by `.toc-collapsible::details-content` in `globals.css`. A browser without
 * `::details-content` keeps the working closed disclosure on desktop too. Never two copies of
 * the list, so assistive technology and the tests meet one set of links.
 *
 * `level: 3` entries are indented one step and never numbered; nothing deeper is accepted.
 */
export interface TocHeading {
  readonly id: string;
  readonly text: string;
  readonly level?: 2 | 3;
}

export interface TableOfContentsProps {
  readonly headings: readonly TocHeading[];
  readonly title?: string;
  /** Prefix level-2 entries with `01`, `02`… — pass it when the article numbers its chapters. */
  readonly numbered?: boolean;
  /** Fold into a `<details>` below `lg` (long articles); always open from `lg` up. */
  readonly collapsible?: boolean;
  readonly className?: string;
}

const DEFAULT_TITLE = '목차';

const LINK =
  'group inline-flex min-h-11 items-center lg:min-h-9 lg:items-baseline gap-3 prose-ko text-[0.9375rem] text-text-100 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function Entries({
  headings,
  numbered,
  columns,
}: {
  readonly headings: readonly TocHeading[];
  readonly numbered: boolean;
  readonly columns: boolean;
}) {
  let chapter = 0;
  return (
    <ol className={`mt-3 ${columns ? 'lg:columns-2 lg:gap-x-10' : ''}`}>
      {headings.map((heading) => {
        const isChapter = heading.level !== 3;
        if (isChapter) chapter += 1;
        return (
          <li
            key={heading.id}
            className={`break-inside-avoid py-0.5 ${heading.level === 3 ? 'pl-4' : ''}`}
          >
            <a href={`#${heading.id}`} className={LINK}>
              {numbered && isChapter ? (
                <span
                  aria-hidden="true"
                  className="tabular shrink-0 font-mono text-xs font-semibold text-brand-500"
                >
                  {String(chapter).padStart(2, '0')}
                </span>
              ) : null}
              <span className="underline-offset-4 group-hover:underline">{heading.text}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function TableOfContents({
  headings,
  title = DEFAULT_TITLE,
  numbered = false,
  collapsible = false,
  className = '',
}: TableOfContentsProps) {
  if (headings.length === 0) return null;
  const columns = headings.length > 5;
  const box = 'rounded-lg border-t-2 border-brand-500 bg-ground-800';

  if (!collapsible) {
    return (
      <nav aria-label={title} data-toc className={`my-10 px-6 py-5 ${box} ${className}`}>
        <p className="text-xs font-semibold tracking-[0.1em] text-text-300">{title}</p>
        <Entries headings={headings} numbered={numbered} columns={columns} />
      </nav>
    );
  }

  return (
    <nav aria-label={title} data-toc data-toc-collapsible className={`my-10 ${className}`}>
      <details className={`toc-collapsible group/toc ${box}`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-text-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:min-h-0 lg:px-6 lg:pt-5 lg:text-xs lg:tracking-[0.1em] lg:text-text-300 [&::-webkit-details-marker]:hidden">
          <span>
            {title}
            <span className="tabular ml-2 font-mono text-xs text-text-300 lg:text-text-500">
              {headings.length}개 섹션
            </span>
          </span>
          <span
            aria-hidden="true"
            className="text-brand-500 transition-transform group-open/toc:rotate-180 lg:hidden"
          >
            ▾
          </span>
        </summary>
        <div className="px-5 pb-4 lg:px-6 lg:pb-5">
          <Entries headings={headings} numbered={numbered} columns={columns} />
        </div>
      </details>
    </nav>
  );
}
