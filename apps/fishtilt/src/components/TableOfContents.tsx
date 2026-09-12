/**
 * `TableOfContents` — the in-page navigation for a long article (D-S3-13).
 *
 * Built from a HEADING LIST the page passes in, never by scanning the DOM: this is a server
 * component, it renders into the prerendered HTML, and a list the page derives from the
 * article's own source (`src/lib/seo/faq.ts` already parses MDX headings; the content WP
 * that adopts this will derive `headings` the same way) is the same on the server, in a
 * test and in a screenshot. Each entry links to `#id`, and MDX `h2`s already carry
 * `scroll-mt-24` so the target does not land under the sticky header.
 *
 * `<nav aria-label="목차">` with an `<ol>`, because a table of contents is a navigation
 * landmark and its entries are ordered. `level: 3` entries are indented one step; nothing
 * deeper is accepted, because a TOC that mirrors every `h4` is longer than the article.
 */
export interface TocHeading {
  readonly id: string;
  readonly text: string;
  readonly level?: 2 | 3;
}

export interface TableOfContentsProps {
  readonly headings: readonly TocHeading[];
  readonly title?: string;
  readonly className?: string;
}

const DEFAULT_TITLE = '목차';

export function TableOfContents({
  headings,
  title = DEFAULT_TITLE,
  className = '',
}: TableOfContentsProps) {
  if (headings.length === 0) return null;
  return (
    <nav aria-label={title} className={`my-10 border-l-2 border-line-500 pl-5 ${className}`}>
      <p className="text-sm font-semibold tracking-[0.06em] text-text-300">{title}</p>
      <ol className="mt-3 space-y-2">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? 'pl-4' : ''}>
            <a
              href={`#${heading.id}`}
              className="inline-flex min-h-8 items-center prose-ko text-[0.9375rem] text-text-100 underline-offset-4 outline-none hover:text-brand-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
