/**
 * "가장 많이 연결된 용어" — the terms the rest of the site points at most, counted from the
 * content graph (`registry/glossary/popular.ts`). NOT "인기 용어": 3BetTilt has no traffic
 * data and says so in the strip's own sentence. Each chip prints the inbound count, so the
 * ordering is visibly a count and not an editorial ranking.
 */
import type { PopularTerm } from '../../content/registry/glossary/popular.js';
import { hrefOfContent } from '../../content/graph.js';
import { headwordOf } from '../../content/registry/glossary/categories.js';

export interface GlossaryPopularProps {
  readonly terms: readonly PopularTerm[];
  readonly className?: string;
}

const CHIP =
  'inline-flex min-h-11 items-center gap-2 rounded-md border border-line-500 bg-panel-700 px-3 text-sm font-medium text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function GlossaryPopular({ terms, className = '' }: GlossaryPopularProps) {
  const linked = terms.flatMap(({ term, inbound }) => {
    const href = hrefOfContent(term);
    return href === null ? [] : [{ term, inbound, href }];
  });
  if (linked.length === 0) return null;
  return (
    <ul data-glossary="popular" className={`flex flex-wrap gap-2 ${className}`}>
      {linked.map(({ term, inbound, href }) => (
        <li key={term.id}>
          <a href={href} className={CHIP}>
            <span className="prose-ko">{headwordOf(term)}</span>
            <span className="tabular text-xs text-text-300" aria-label={`연결 ${inbound}곳`}>
              {inbound}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
