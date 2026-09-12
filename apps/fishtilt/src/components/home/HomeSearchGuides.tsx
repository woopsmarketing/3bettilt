/**
 * `HomeSearchGuides` — the evergreen answers (`blogOfType('search-guide')`), as a compact,
 * typographic, two-column index: number, the question the article's title IS, and its
 * reading time. No cards, no thumbnails — a table of contents for the questions people
 * actually type.
 */
import { contentMeta, hrefOfContent } from '../../content/graph.js';
import type { BlogRecord } from '../../content/types.js';

export interface HomeSearchGuidesProps {
  readonly guides: readonly BlogRecord[];
  readonly labelledBy: string;
  readonly className?: string;
}

const LINK =
  'inline-flex min-h-11 items-center prose-ko text-lg font-semibold text-text-100 outline-none ' +
  'hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function HomeSearchGuides({ guides, labelledBy, className = '' }: HomeSearchGuidesProps) {
  if (guides.length === 0) {
    return (
      <p className={`text-sm text-text-300 ${className}`}>아직 공개된 검색 가이드가 없습니다.</p>
    );
  }
  return (
    <ol aria-labelledby={labelledBy} className={`grid gap-x-12 sm:grid-cols-2 ${className}`}>
      {guides.map((guide, index) => {
        const href = hrefOfContent(guide);
        return (
          <li
            key={guide.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-2 border-t border-line-500 py-3"
          >
            <span aria-hidden="true" className="tabular pt-3 font-mono text-xs text-text-300">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              {href === null ? (
                <span className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-text-300">
                  {guide.title}
                  <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
                    준비 중
                  </span>
                </span>
              ) : (
                <a href={href} className={LINK}>
                  {guide.title}
                </a>
              )}
              <span className="block text-xs text-text-300">{contentMeta(guide)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
