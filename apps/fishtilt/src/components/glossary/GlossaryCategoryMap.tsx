/**
 * "주제별로 보기" — the six categories, each with its terms as an inline run of headwords
 * (contract AU). A topical map over the same rows the dictionary below files by initial:
 * this is where a reader who does not know the word finds it by subject, then reads the
 * definition in the index. Headwords only, no definitions — the definition is printed once,
 * in the index row.
 */
import type { CategoryGroup } from './hubModel.js';

export interface GlossaryCategoryMapProps {
  readonly groups: readonly CategoryGroup[];
  readonly className?: string;
}

const LINK =
  'prose-ko inline-block py-3 -my-3 font-medium text-text-100 underline decoration-line-500 underline-offset-4 outline-none hover:decoration-brand-500 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const BADGE =
  'ml-1 inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300';

export function GlossaryCategoryMap({ groups, className = '' }: GlossaryCategoryMapProps) {
  return (
    <div
      data-glossary="categories"
      className={`divide-y divide-line-500 border-t border-line-500 ${className}`}
    >
      {groups.map(({ category, anchor, entries }) => {
        const headingId = `${anchor}-heading`;
        return (
          <section
            key={category.id}
            id={anchor}
            aria-labelledby={headingId}
            className="grid scroll-mt-24 gap-x-12 gap-y-3 py-7 lg:grid-cols-12"
          >
            <div className="min-w-0 lg:col-span-4">
              <h3 id={headingId} className="prose-ko text-lg font-semibold text-text-100">
                {category.label}
                <span className="tabular ml-2 text-sm font-normal text-text-300">
                  {entries.length}
                </span>
              </h3>
              <p className="mt-1 prose-ko text-sm text-text-300">{category.description}</p>
            </div>
            <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-[0.9375rem] lg:col-span-8">
              {entries.map(({ record, href, headword }) => (
                <li key={record.id}>
                  {href === null ? (
                    <span className="prose-ko font-medium text-text-100">
                      {headword}
                      <span className={BADGE}>준비 중</span>
                    </span>
                  ) : (
                    <a href={href} className={LINK}>
                      {headword}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
