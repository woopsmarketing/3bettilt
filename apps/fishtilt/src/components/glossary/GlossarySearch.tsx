'use client';

/**
 * The glossary hub's search field (WP-S3-11, contract AV) — the one client island on the
 * page, and a small one.
 *
 * ## No-JS first
 *
 * The full index is already in the HTML; this field only narrows it. So the markup is a
 * real `<form>` pointing at the site search (`/search?q=…`): with JavaScript off, or before
 * hydration, pressing Enter still finds the term through the site-wide index. With
 * JavaScript, typing filters the rows in place and submitting keeps the reader here — unless
 * nothing matched, in which case the submit is allowed through to the site search, which
 * also looks inside lesson and article prose.
 *
 * ## How it filters
 *
 * The rows are server-rendered `<li data-glossary-row data-search="…">` elements; this
 * component never re-renders them. It reads the query, compares it against each row's
 * `data-search` key (headword, term, aliases, title — lower-cased, spaces removed, the same
 * normalisation `hubModel.ts` used to write the attribute), and toggles the native `hidden`
 * attribute. A tab (`[data-glossary-group]`) with no visible row hides too, and the sections
 * that are not the index (`[data-glossary-hide-on-search]`) step aside while a query is
 * active so the reader sees results, not a category map. A live region reports the count.
 */
import { useEffect, useState } from 'react';
import { buildSearchUrl } from '../../features/search/url.js';
import { routeById } from '../../lib/routes.js';
import { searchNormalize } from './hubModel.js';

export interface GlossarySearchProps {
  readonly total: number;
  readonly className?: string;
}

/** Applies `query` to the rows in the document. Exported for the unit test; the component
 *  is the only production caller. Returns how many rows stayed visible. */
export function applyGlossaryFilter(root: ParentNode, query: string): number {
  const needle = searchNormalize(query);
  const active = needle.length > 0;
  let visible = 0;
  for (const row of root.querySelectorAll<HTMLElement>('[data-glossary-row]')) {
    const key = row.dataset['search'] ?? '';
    const match = !active || key.split('|').some((name) => name.includes(needle));
    row.hidden = !match;
    if (match) visible += 1;
  }
  for (const group of root.querySelectorAll<HTMLElement>('[data-glossary-group]')) {
    const anyVisible = Array.from(group.querySelectorAll<HTMLElement>('[data-glossary-row]')).some(
      (row) => !row.hidden,
    );
    group.hidden = !anyVisible;
  }
  for (const section of root.querySelectorAll<HTMLElement>('[data-glossary-hide-on-search]')) {
    section.hidden = active;
  }
  return visible;
}

export function GlossarySearch({ total, className = '' }: GlossarySearchProps) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(total);
  // One field per page, so a fixed id is safe — and, unlike `useId`, identical across
  // renders, which the both-themes markup test relies on.
  const inputId = 'glossary-search-input';
  const active = query.trim().length > 0;

  useEffect(() => {
    setVisible(applyGlossaryFilter(document, query));
  }, [query]);

  return (
    <form
      role="search"
      action={routeById('search').path}
      method="get"
      data-glossary="search"
      className={className}
      onSubmit={(event) => {
        // Matches on this page: stay. No match: fall through to the site search.
        if (!active || visible > 0) event.preventDefault();
      }}
    >
      <label htmlFor={inputId} className="block text-sm font-medium text-text-100">
        용어 찾기
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          placeholder="쓰리벳, 3bet, 키커…"
          className="min-h-11 w-full max-w-lead rounded-md border border-line-500 bg-ground-800 px-3.5 text-base text-text-100 outline-none placeholder:text-text-500 focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-text-300" data-glossary="count">
        {active ? (
          visible > 0 ? (
            `${visible}개 용어가 맞습니다.`
          ) : (
            <>
              이 사전에는 없는 말입니다.{' '}
              <a
                href={buildSearchUrl(query)}
                className="text-brand-500 underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                사이트 전체에서 찾기
              </a>
            </>
          )
        ) : (
          '한국어, 영어, 줄임말 어느 쪽으로 쳐도 됩니다. 입력하는 대로 목록이 줄어듭니다.'
        )}
      </p>
    </form>
  );
}
