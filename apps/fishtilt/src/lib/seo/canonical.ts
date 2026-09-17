/**
 * The canonical URL policy (build spec §34).
 *
 * ## The rule
 *
 * **A canonical URL is the page's path and nothing else.** No query string, no fragment,
 * no trailing slash (except at the root). One document, one URL.
 *
 * ## Why that is the whole rule here, and why it still has to be stated
 *
 * `/tools/range?hero=BTN&stack=100&spot=RFI` is not a different document from
 * `/tools/range`. It is the same prerendered HTML with a client-side selection applied:
 * `RangeExplorer` parses `window.location.search` in an effect and writes it back with
 * `history.replaceState`, and the route itself takes no `searchParams` prop and stays
 * statically prerendered. The same is true of `/tools/starting-hand` (top-X% slider) and
 * `/search` (the query box).
 *
 * So the site cannot serve a filtered variant even if a crawler asks for one — but a
 * crawler that *finds* one (a shared link, a `RangeShareLink` copy, a referrer) will
 * otherwise treat every combination as its own URL. `hero` x `spot` x `stack` alone is a
 * few hundred addresses for one document, which is §33's "index explosion" arriving
 * without anyone generating a single page. The canonical is what closes that, and it costs
 * one line per route because it is derived, not written.
 *
 * ## Consequence for every caller
 *
 * A page never states its canonical as a literal string. It states its PATH — which it
 * already has, from `src/lib/routes.ts` or from `contentPath(record)` — and the metadata
 * builder derives the canonical from it. A canonical and the URL it sits on therefore
 * cannot drift apart.
 */
import { localeOfPath } from '../locale.js';
import { absoluteUrl, SITE_ORIGIN } from './site.js';

/** Only used to give `new URL` a base; never appears in any output. */
const PARSE_BASE = 'https://canonical.invalid';

/**
 * Reduces anything that addresses a page on this site — a bare path, a path with a query
 * string, a path with a fragment, an absolute URL on this origin — to its canonical PATH.
 *
 * Throws for an input that names a different origin, rather than quietly emitting a
 * canonical that points off-site — and for a path that spells the default locale as a prefix
 * (`/ko/learn`, D-S3-23): the default locale is prefixless, so such a canonical would name a
 * legacy address that only redirects. The root reduces to `/`.
 */
export function canonicalPath(input: string): string {
  const url = new URL(input, PARSE_BASE);
  const origin = new URL(SITE_ORIGIN);
  if (url.origin !== PARSE_BASE && url.origin !== origin.origin) {
    throw new Error(`canonicalPath refuses a foreign origin: ${input}`);
  }
  const { pathname } = url;
  const path = pathname.endsWith('/') ? pathname.replace(/\/+$/u, '') || '/' : pathname;
  // Throws for a legacy default-locale prefix; the answer itself is not needed here.
  localeOfPath(path);
  return path;
}

/** The absolute canonical URL for anything `canonicalPath` accepts. */
export function canonicalUrl(input: string): string {
  return absoluteUrl(canonicalPath(input));
}
