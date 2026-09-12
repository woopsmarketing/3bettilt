'use client';

/**
 * `SearchClient` — `/search`'s whole interactive island (WP-K). Owns the query, the URL sync
 * and the matching; everything it renders underneath (`SearchResultList`, `SearchEmptyState`)
 * is a plain controlled component with no directive of its own — the same split
 * `RangeExplorer` establishes for `/tools/range`.
 *
 * URL SYNC, same shape and same reason as `RangeExplorer`'s (see that component's module doc
 * for the full argument): reading `window.location` during the initial render would make the
 * client's first render diverge from the server's — a hydration mismatch — so the query
 * starts at `''` (matching the static server render) and is corrected from `?q=` in a
 * mount-only effect. The write-effect is gated on that same read having landed first
 * (`hydrated`), so it can never stomp a real shared link's query back to `''` before the read
 * had a chance to apply it. `replaceState`, not `pushState`: every keystroke updating the URL
 * is what makes a search linkable and survivable across a back-navigation TO this page, but a
 * history entry PER KEYSTROKE would make the back button step through every character typed
 * rather than back to wherever the visitor came from — `buildRangeUrl`'s filters make the
 * same choice for the same reason.
 *
 * `records` defaults to the real `SEARCH_INDEX` (built from the live content graph + route
 * registry) but can be overridden — `SearchClient.test.tsx` passes small constructed fixtures
 * so its tests never depend on how much of the site has shipped (ruling 26).
 *
 * Stage 3 (contract BG): the box is a `role="search"` landmark with a clear button, results
 * come grouped with headings and counts (`SearchResultList`), the matched words are
 * highlighted from the same `expandQuery` variants the matcher used, and the live region
 * still says exactly `N개 결과` — the sentence `search.spec.ts` listens for.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSearchUrl,
  expandQuery,
  groupResults,
  matchQuery,
  parseSearchUrlQuery,
  SEARCH_INDEX,
  type SearchRecord,
} from '../features/search/index.js';
import { SearchEmptyState } from './SearchEmptyState.js';
import { SearchResultList } from './SearchResultList.js';

export interface SearchClientProps {
  readonly records?: readonly SearchRecord[];
  readonly className?: string;
}

const SEARCH_INPUT_ID = 'fishtilt-search-input';

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 13.5 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SearchClient({ records = SEARCH_INDEX, className = '' }: SearchClientProps) {
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mount-only read of the URL the page loaded with — see the module doc.
  useEffect(() => {
    setQuery(parseSearchUrlQuery(window.location.search));
    setHydrated(true);
    // Mount-only: `useState` setters are React-guaranteed stable, so an empty dependency
    // array is correct here, not a suppressed lint violation (same reasoning as
    // `RangeExplorer`'s own mount effect).
  }, []);

  // Keep the URL in sync with the query, without a full navigation. Gated on `hydrated` so
  // this never fires with the pre-hydration default and overwrites a real shared URL.
  useEffect(() => {
    if (!hydrated) return;
    window.history.replaceState(null, '', buildSearchUrl(query));
  }, [hydrated, query]);

  const results = useMemo(() => matchQuery(records, query), [records, query]);
  const variants = useMemo(() => expandQuery(records, query), [records, query]);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery !== '';
  const groups = useMemo(() => groupResults(results), [results]);

  return (
    <div className={className}>
      {/* A `search` landmark: the one place on the page a screen-reader user jumps to for
          the box. `onSubmit` is prevented because matching is already live per keystroke —
          Enter should not reload the page and lose focus. */}
      <form
        role="search"
        aria-label="사이트 검색"
        onSubmit={(event) => event.preventDefault()}
        className="rounded-xl bg-ground-800 p-4 sm:p-5"
      >
        <label htmlFor={SEARCH_INPUT_ID} className="block text-sm font-semibold text-text-100">
          검색어
        </label>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-300">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            id={SEARCH_INPUT_ID}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 팟 오즈, AKs, 3벳"
            autoComplete="off"
            enterKeyHint="search"
            // Escape empties the box (Chromium does this natively for `type="search"`; Firefox
            // does not), so the keyboard has the same clear affordance as the pointer.
            onKeyDown={(event) => {
              if (event.key === 'Escape' && hasQuery) {
                event.preventDefault();
                setQuery('');
              }
            }}
            className="h-14 w-full rounded-lg border border-line-500 bg-panel-700 pl-12 pr-14 text-lg text-text-100 outline-none placeholder:text-text-500 focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-search-cancel-button]:hidden"
          />
          {hasQuery ? (
            <button
              type="button"
              // Not "검색어 지우기": Playwright's `getByLabel('검색어')` is a substring match,
              // and the input must stay the only element that label resolves to.
              aria-label="입력 지우기"
              // Out of the Tab order on purpose: one Tab from the box must land on the first
              // result (`search.spec.ts`), not on a control the keyboard already has as Escape.
              // Pointer and touch still reach it; assistive tech still sees a named button.
              tabIndex={-1}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-1.5 my-auto flex h-11 w-11 items-center justify-center rounded-md text-text-300 outline-none hover:text-text-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p role="status" aria-live="polite" className="tabular text-sm text-text-300">
            {hasQuery ? `${results.length}개 결과` : '검색어를 입력해보세요'}
          </p>
          {groups.length > 1 ? (
            <p className="tabular text-xs text-text-300" aria-hidden="true">
              {groups.map((group) => `${group.label} ${group.results.length}`).join(' · ')}
            </p>
          ) : null}
        </div>
      </form>

      {results.length > 0 ? (
        <SearchResultList results={results} variants={variants} className="mt-8" />
      ) : (
        <SearchEmptyState query={hasQuery ? trimmedQuery : ''} className="mt-8" />
      )}
    </div>
  );
}
