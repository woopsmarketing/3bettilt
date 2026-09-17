/**
 * `/search`'s shareable-URL contract — `/search?q=팟%20오즈`. Same split `features/range/url.ts`
 * documents: pure string <-> query parsing here, no browser global read (the component
 * decides WHEN to call these against `window.location` / `window.history`), so the shape of
 * the URL is unit-testable without a DOM.
 */
import { routeById } from '../../lib/routes.js';

/** The one query-string key `/search` reads. Exported so a plain GET form elsewhere (the 404
 *  page's search box) submits to the same key without spelling it a second time. */
export const SEARCH_QUERY_PARAM = 'q';
const QUERY_PARAM = SEARCH_QUERY_PARAM;

/** The query the URL carries, or `''` if the parameter is absent — never `null`/`undefined`,
 *  so a caller can always feed this straight into `<input value>` without an extra branch. */
export function parseSearchUrlQuery(search: string): string {
  const params = new URLSearchParams(search);
  return params.get(QUERY_PARAM) ?? '';
}

/** `''` -> the search route's own path (no bare `?q=` clutter for an empty query);
 *  otherwise `<search path>?q=<encoded>`. The path is the registry's, so it is localised
 *  like every other href (D-S3-02). */
export function buildSearchUrl(query: string): string {
  const { path } = routeById('search');
  if (query === '') return path;
  const params = new URLSearchParams();
  params.set(QUERY_PARAM, query);
  return `${path}?${params.toString()}`;
}
