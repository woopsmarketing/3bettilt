/**
 * The locale contract — the single source of truth for which locales this site serves and
 * how a locale appears in a URL (Stage 3, D-S3-01/02).
 *
 * ## The rule
 *
 * Every page lives under a locale segment: `/ko`, `/ko/learn/pot-odds`. There is no
 * unprefixed page — `/` redirects to `/ko` (`next.config.ts`, the ONE redirect) and
 * `/learn` is a 404. Every href, canonical, breadcrumb, sitemap entry and nav path the app
 * emits is built here, by `localePath`, and nowhere else. `src/lib/locale.test.ts` reads
 * `src/` as text and fails if a `/ko` literal appears anywhere but a test expectation, so
 * the prefix cannot be re-spelt by hand.
 *
 * ## Why one locale is still a list
 *
 * Korean is the only language the site has, and `SUPPORTED_LOCALES` says exactly that —
 * nothing here pretends a second language exists (no switcher, no English hreflang). But
 * the URL layout, the `[locale]` route segment and every path builder take the locale as a
 * parameter rather than assuming Korean, so that adding a locale is a data change here plus
 * translated content, not a second URL scheme.
 */

export const SUPPORTED_LOCALES = ['ko'] as const;

/** The App Router directory every page sits under: `src/app/[locale]/…`. */
export const APP_LOCALE_SEGMENT = '[locale]';

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
 * `localePath('ko', '/learn/pot-odds')` -> `'/ko/learn/pot-odds'`;
 * `localePath('ko', '/')` -> `'/ko'`.
 *
 * Accepts a root-relative SITE path (locale-less) and refuses anything else — a relative
 * path, an absolute URL, or a path that already carries a locale — rather than producing
 * `/ko/ko/learn`. A query string or fragment is kept as-is after the path.
 */
export function localePath(locale: Locale, sitePath: string): string {
  if (!sitePath.startsWith('/')) {
    throw new Error(`localePath expects a root-relative site path, got: ${sitePath}`);
  }
  if (sitePath.startsWith('//')) {
    throw new Error(`localePath refuses a protocol-relative URL: ${sitePath}`);
  }
  if (localeOfPath(sitePath) !== null) {
    throw new Error(`localePath refuses a path that already carries a locale: ${sitePath}`);
  }
  const end = sitePath.search(/[?#]/u);
  const pathname = end === -1 ? sitePath : sitePath.slice(0, end);
  const suffix = end === -1 ? '' : sitePath.slice(end);
  const prefix = `/${locale}`;
  return pathname === '/' ? `${prefix}${suffix}` : `${prefix}${pathname}${suffix}`;
}

/**
 * The locale a path is under, or `null` when it is under none (`/`, `/learn`, `/og.png`).
 * Segment-exact: `/ko-something` is not `ko`.
 */
export function localeOfPath(path: string): Locale | null {
  const first = path.split(/[?#]/u, 1)[0]?.split('/')[1] ?? '';
  return isLocale(first) ? first : null;
}

/**
 * The inverse of `localePath`: `'/ko/learn/pot-odds'` -> `'/learn/pot-odds'`, `'/ko'` ->
 * `'/'`. Throws for a path under no supported locale, because the caller is asserting that
 * it has a localised path and a silently unchanged answer would hide the opposite.
 */
export function sitePathOf(localisedPath: string): string {
  const locale = localeOfPath(localisedPath);
  if (locale === null) {
    throw new Error(`sitePathOf expects a path under a supported locale, got: ${localisedPath}`);
  }
  const rest = localisedPath.slice(`/${locale}`.length);
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest;
}

/**
 * Localises an href that MDX prose wrote by hand (`[레슨](/learn/pot-odds)`), and leaves
 * everything else alone: an external URL, a fragment, a path already under a locale. Prose
 * stays locale-less — `content/**` never spells a locale — and this is the one place a
 * hand-written internal link acquires its prefix (`mdx-components.tsx`).
 */
export function localiseHref(href: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  if (localeOfPath(href) !== null) return href;
  return localePath(locale, href);
}
