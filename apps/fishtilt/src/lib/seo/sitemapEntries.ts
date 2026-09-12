/**
 * What goes in `sitemap.xml`, as a pure function over the two registries.
 *
 * ## Why there is no URL list anywhere in this file
 *
 * A hand-maintained sitemap is wrong the day after it is written, and wrong silently: it
 * keeps listing a page that was renamed, and stops listing the twenty that shipped last
 * week. Both failures look like a working sitemap.
 *
 * So the list is exactly `indexableRoutes(ROUTES)` ++ `indexableContent(ALL_CONTENT)` —
 * the same two predicates `policy.ts` uses for the pages' own `robots` meta tags, applied
 * to the same two registries the site navigates and renders from. That makes three
 * properties true by construction rather than by vigilance:
 *
 * - **Every URL in the sitemap resolves.** A route is only listed if `available` is true,
 *   which `routes.test.ts` checks against the filesystem in both directions; a content
 *   page is only listed if `status === 'PUBLISHED'`, which `content.test.ts` checks
 *   against the MDX on disk.
 * - **The sitemap and the meta robots tag can never disagree.** They are the same
 *   function. A page that says `noindex` cannot be advertised in the sitemap, which is
 *   one of the most common and least visible SEO defects.
 * - **Nothing has to be updated when content ships.** The day WP-E3 publishes its last
 *   hand page, that page is in the sitemap, with no edit here.
 *
 * ## What is deliberately NOT emitted
 *
 * `lastModified`, `changeFrequency` and `priority` are all optional, and this project can
 * substantiate none of them. Content records carry no modification date; using the build
 * time would tell a crawler that all 110 pages changed simultaneously, every build, which
 * is both false and exactly the signal that makes a crawler ignore the field. A guessed
 * `changeFrequency` is the same lie with a coarser unit. `priority` is documented by
 * Google as ignored. An entry is therefore a URL, which is the part that is true.
 */
import { ALL_CONTENT } from '../../content/registry/index.js';
import { contentPath } from '../../content/graph.js';
import type { AnyContentRecord } from '../../content/types.js';
import { ROUTES, type RouteEntry } from '../routes.js';
import { hreflangAlternates } from './metadata.js';
import { indexableContent, indexableRoutes } from './policy.js';
import { absoluteUrl } from './site.js';

/** Localised root-relative paths (`/ko/…`), routes first (registry order), then content
 *  (registry order). */
export function sitemapPaths(
  routes: readonly RouteEntry[] = ROUTES,
  records: readonly AnyContentRecord[] = ALL_CONTENT,
): readonly string[] {
  const paths = [
    ...indexableRoutes(routes).map((route) => route.path),
    ...indexableContent(records).map(contentPath),
  ];
  // Defensive rather than expected: the two registries address disjoint URL spaces
  // (`routes.ts` holds no `[slug]` template). A duplicate would be a real bug, and a
  // sitemap listing one URL twice is a bug a crawler reports back at you.
  return [...new Set(paths)];
}

/** The same list as absolute URLs, which is the only form `sitemap.xml` accepts. */
export function sitemapUrls(
  routes: readonly RouteEntry[] = ROUTES,
  records: readonly AnyContentRecord[] = ALL_CONTENT,
): readonly string[] {
  return sitemapPaths(routes, records).map((path) => absoluteUrl(path));
}

/** One `sitemap.xml` entry: the URL, plus the same `hreflang` set the page's `<head>` emits. */
export interface SitemapEntry {
  readonly url: string;
  readonly alternates: { readonly languages: Readonly<Record<string, string>> };
}

/**
 * The entries `src/app/sitemap.ts` returns. The `hreflang` alternates are the page's own
 * (`hreflangAlternates`, the function `pageMetadata` uses), so the sitemap and the `<head>`
 * cannot describe a page's editions differently.
 */
export function sitemapEntries(
  routes: readonly RouteEntry[] = ROUTES,
  records: readonly AnyContentRecord[] = ALL_CONTENT,
): readonly SitemapEntry[] {
  return sitemapPaths(routes, records).map((path) => {
    const url = absoluteUrl(path);
    return { url, alternates: { languages: hreflangAlternates(url, path) } };
  });
}
