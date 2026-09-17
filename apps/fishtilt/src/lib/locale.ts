/**
 * The locale contract — the single source of truth for which locales this site serves and
 * how a locale appears in a URL (Stage 3, D-S3-01/02; prefixless default locale, D-S3-23).
 *
 * ## The rule
 *
 * The DEFAULT locale has no URL prefix; every other locale is prefixed by its code.
 *
 *   Korean (default): `/`, `/learn`, `/learn/pot-odds`
 *   future English:   `/en`, `/en/learn`, `/en/learn/pot-odds`
 *
 * The default locale's pages live in the route group `src/app/(default-locale)/…`, so the
 * directory IS the public URL: what is prerendered at `/learn/pot-odds` is what the canonical
 * names, with no rewrite and no middleware in between. The default locale is never spelt as
 * a prefix — `/ko/…` is not a page, only a legacy address that `next.config.ts` redirects
 * 1:1 to its prefixless page (`legacyLocaleRedirects.ts`). Every href, canonical, breadcrumb,
 * sitemap entry and nav path the app emits is built here, by `localePath`, and nowhere else.
 * `src/lib/locale.test.ts` reads `src/` as text and fails if a `/ko` literal appears anywhere
 * but a test expectation, so the legacy prefix cannot come back by hand.
 *
 * ## Why one locale is still a list
 *
 * Korean is the only language the site has, and `SUPPORTED_LOCALES` says exactly that —
 * nothing here pretends a second language exists (no switcher, no English hreflang, no `/en`
 * page). But every path builder takes the locale as a parameter rather than assuming Korean,
 * so a second locale gets `/<code>/…` URLs from the same helpers
 * (`docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md`).
 */

export const SUPPORTED_LOCALES = ['ko'] as const;

/** The App Router route group the default locale's pages sit in: `src/app/(default-locale)/…`.
 *  A route group adds no URL segment, which is what makes the default locale prefixless. */
export const APP_DEFAULT_LOCALE_GROUP = '(default-locale)';

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

/** `hreflang` / BCP 47 tag per locale (D-S3-06). */
export const HREFLANG: Readonly<Record<Locale, string>> = { ko: 'ko-KR' };

/** Open Graph `og:locale` per locale (underscore form, as the protocol spells it). */
export const OPEN_GRAPH_LOCALE: Readonly<Record<Locale, string>> = { ko: 'ko_KR' };

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * The locale literally spelt as a path's first segment, or `null` (`/`, `/learn`, `/og.png`).
 * Segment-exact: `/ko-something` is not `ko`. For the default locale a non-null answer means
 * the path is a legacy prefixed address, not a page.
 */
export function localePrefixOf(path: string): Locale | null {
  const first = path.split(/[?#]/u, 1)[0]?.split('/')[1] ?? '';
  return isLocale(first) ? first : null;
}

/**
 * `localePath('ko', '/learn/pot-odds')` -> `'/learn/pot-odds'`; `localePath('ko', '/')` ->
 * `'/'`. A non-default locale is prefixed: `localePath('en', '/learn')` would be `'/en/learn'`.
 *
 * Accepts a root-relative SITE path (locale-less) and refuses anything else — a relative
 * path, an absolute URL, or a path that already carries a locale prefix (including the
 * legacy default-locale prefix) — rather than producing `/en/en/learn` or a `/ko/…` link.
 * A query string or fragment is kept as-is after the path.
 */
export function localePath(locale: Locale, sitePath: string): string {
  if (!sitePath.startsWith('/')) {
    throw new Error(`localePath expects a root-relative site path, got: ${sitePath}`);
  }
  if (sitePath.startsWith('//')) {
    throw new Error(`localePath refuses a protocol-relative URL: ${sitePath}`);
  }
  if (localePrefixOf(sitePath) !== null) {
    throw new Error(`localePath refuses a path that already carries a locale: ${sitePath}`);
  }
  if (locale === DEFAULT_LOCALE) return sitePath;
  const end = sitePath.search(/[?#]/u);
  const pathname = end === -1 ? sitePath : sitePath.slice(0, end);
  const suffix = end === -1 ? '' : sitePath.slice(end);
  const prefix = `/${locale}`;
  return pathname === '/' ? `${prefix}${suffix}` : `${prefix}${pathname}${suffix}`;
}

/**
 * The locale a public path belongs to: a non-default locale when the path carries that
 * locale's prefix, the default locale otherwise (`/`, `/learn`). Throws for a path that
 * spells the DEFAULT locale as a prefix (`/ko/learn`): that is a legacy redirect source, not
 * an address of any page, and answering "Korean" for it would let one slip into a canonical.
 */
export function localeOfPath(path: string): Locale {
  const prefix = localePrefixOf(path);
  if (prefix === DEFAULT_LOCALE) {
    throw new Error(`the default locale is never a URL prefix, got: ${path}`);
  }
  return prefix ?? DEFAULT_LOCALE;
}

/**
 * The inverse of `localePath`: the locale-less site path of a public path. `'/learn'` ->
 * `'/learn'`; a prefixed non-default path loses its prefix (`'/en/learn'` -> `'/learn'`,
 * `'/en'` -> `'/'`). Throws for a legacy default-locale-prefixed path, like `localeOfPath`.
 */
export function sitePathOf(localisedPath: string): string {
  const locale = localeOfPath(localisedPath);
  if (locale === DEFAULT_LOCALE) return localisedPath;
  const rest = localisedPath.slice(`/${locale}`.length);
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest;
}

/**
 * Localises an href that MDX prose wrote by hand (`[레슨](/learn/pot-odds)`), and leaves
 * everything else alone: an external URL, a fragment, a path already under a non-default
 * locale. Prose stays locale-less — `content/**` never spells a locale — and this is the one
 * place a hand-written internal link acquires its locale (`mdx-components.tsx`). A legacy
 * default-locale prefix in prose throws (through `localePath`) instead of shipping a link
 * that only redirects.
 */
export function localiseHref(href: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const prefix = localePrefixOf(href);
  if (prefix !== null && prefix !== DEFAULT_LOCALE) return href;
  return localePath(locale, href);
}
