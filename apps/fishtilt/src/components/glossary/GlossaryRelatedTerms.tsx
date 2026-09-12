/**
 * "같이 알아둘 용어" — a term page's related terms as a dense inline run, dictionary-style,
 * rather than `RelatedContent`'s card grid: headword, then the Latin term muted. Same
 * honesty gate: a term without prose is text plus 준비 중, never an anchor.
 */
import { glossaryById, hrefOfContent } from '../../content/graph.js';
import { headwordOf } from '../../content/registry/glossary/categories.js';
import { SectionHeading } from '../SectionHeading.js';

export interface GlossaryRelatedTermsProps {
  /** Glossary content ids (`relatedConcepts`). Unknown ids throw — a registry bug. */
  readonly ids: readonly string[];
  readonly className?: string;
}

const LINK =
  'inline-block py-3 -my-3 font-medium text-text-100 underline decoration-line-500 underline-offset-4 outline-none hover:decoration-brand-500 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const BADGE =
  'ml-1 inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300';

export function GlossaryRelatedTerms({ ids, className = '' }: GlossaryRelatedTermsProps) {
  if (ids.length === 0) return null;
  const terms = ids.map((id) => {
    const entry = glossaryById(id);
    if (entry === undefined) throw new Error(`related term "${id}" is not a glossary entry`);
    return { entry, href: hrefOfContent(entry), headword: headwordOf(entry) };
  });
  return (
    <section aria-label="같이 알아둘 용어" data-glossary="related-terms" className={className}>
      <SectionHeading title="같이 알아둘 용어" />
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
        {terms.map(({ entry, href, headword }) => (
          <li key={entry.id} className="prose-ko">
            {href === null ? (
              <span className="font-medium text-text-100">
                {headword}
                <span className={BADGE}>준비 중</span>
              </span>
            ) : (
              <a href={href} className={LINK}>
                {headword}
              </a>
            )}
            <span className="ml-1.5 text-sm text-text-300">{entry.term}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
