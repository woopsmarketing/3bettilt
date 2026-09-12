/**
 * `HomeGlossaryStrip` — "모르는 말이 나오면": the words a reader meets in their first hand,
 * as an inline index strip (term, then the ways people actually say it, from the record's
 * own `aliases`), plus the three lookup routes — the glossary, the hand list and search.
 *
 * The picks are `homeModel.HOME_GLOSSARY_PICKS`: chosen, not sliced from the registry.
 */
import { hrefOfContent } from '../../content/graph.js';
import type { GlossaryRecord } from '../../content/types.js';

export interface HomeGlossaryStripProps {
  readonly terms: readonly GlossaryRecord[];
  readonly glossaryHref: string | null;
  readonly searchHref: string | null;
  /** The hand list (`/hands`) — the other lookup: one page per starting hand. */
  readonly handsHref: string | null;
  readonly className?: string;
}

/** How many of a term's aliases the strip prints under it. */
const ALIASES_SHOWN = 3;

const TERM_LINK =
  'inline-flex min-h-11 items-center prose-ko text-base font-semibold text-text-100 outline-none ' +
  'hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const ROUTE_LINK =
  'inline-flex min-h-11 items-center gap-1.5 font-medium text-brand-500 underline underline-offset-4 outline-none ' +
  'hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function HomeGlossaryStrip({
  terms,
  glossaryHref,
  searchHref,
  handsHref,
  className = '',
}: HomeGlossaryStripProps) {
  return (
    <div className={className}>
      {terms.length > 0 ? (
        <ul aria-label="첫 판에 자주 나오는 말" className="flex flex-wrap gap-x-10 gap-y-5">
          {terms.map((term) => {
            const href = hrefOfContent(term);
            const aliases = term.aliases.slice(0, ALIASES_SHOWN).join(' · ');
            return (
              <li key={term.id} className="min-w-0 border-l border-line-500 pl-4">
                {href === null ? (
                  <span className="inline-flex min-h-11 items-center text-base font-semibold text-text-300">
                    {term.title}
                  </span>
                ) : (
                  <a href={href} className={TERM_LINK}>
                    {term.title}
                  </a>
                )}
                {aliases !== '' ? (
                  <span className="block text-xs text-text-300">{aliases}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
        {glossaryHref !== null ? (
          <a href={glossaryHref} className={ROUTE_LINK}>
            용어 사전 전체
            <span aria-hidden="true">→</span>
          </a>
        ) : null}
        {handsHref !== null ? (
          <a href={handsHref} className={ROUTE_LINK}>
            패 하나씩 찾아보기
            <span aria-hidden="true">→</span>
          </a>
        ) : null}
        {searchHref !== null ? (
          <a href={searchHref} className={ROUTE_LINK}>
            강의·글·용어·핸드에서 한 번에 검색
            <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
