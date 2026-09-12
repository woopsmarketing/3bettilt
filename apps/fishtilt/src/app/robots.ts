/**
 * `/robots.txt` (Next App Router file convention).
 *
 * ## Why nothing is disallowed, including `/search`
 *
 * `Disallow` and `noindex` are not two ways of saying the same thing, and using the wrong
 * one is the classic way to make a page harder to remove from an index rather than easier.
 * `Disallow` stops a crawler FETCHING the URL — so it never reads the `noindex` the page
 * itself sends, and a URL it has seen linked from elsewhere can stay in the index, listed
 * with no description. `noindex` requires the fetch and is what actually removes a page.
 *
 * 3BetTilt has one route it does not want indexed (`/search`, build spec §33) and it
 * already sends `noindex` from its own metadata via `src/lib/seo/policy.ts`. So robots.txt
 * grants full crawl access and points at the sitemap, which is exactly its job. Nothing on
 * this site is private: there is no login, no account and no user data of any kind
 * (§50) — there is no URL here whose CONTENT needs withholding, only URLs that do not
 * deserve their own search result.
 *
 * The sitemap URL is built from the same origin constant as every canonical, so the two
 * cannot name different hosts.
 */
import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo/index.js';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
