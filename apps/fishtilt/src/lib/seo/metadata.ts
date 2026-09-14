/**
 * The metadata builders. Every `export const metadata` and `generateMetadata` in
 * `src/app/**` goes through one of these, so no page states its canonical, its Open Graph
 * block or its robots directive by hand.
 *
 * ## Why a builder rather than a hundred literal objects
 *
 * Three of the four things a page's `<head>` needs are DERIVED — the canonical from the
 * path, the robots directive from the registry's flags, the Open Graph block from the
 * title, description and canonical. Only the Korean title and the Korean description are
 * editorial, and for the 110 content pages even those already exist as registry fields
 * written by the person who wrote the page. Hand-typing the rest is how a canonical ends
 * up pointing at the wrong route, and it is not checkable by reading.
 *
 * So: a page supplies its path, its title and its description; `contentMetadata` supplies
 * even those from the record. Everything else is computed here, once.
 *
 * ## The title shape
 *
 * `'{page} - 3BetTilt'`, one separator for the whole site. Inside `{page}` a hub, tool or
 * glossary title may use ` | ` between its search phrase and its qualifier
 * (`홀덤 팟오즈 계산기 | 무료 포커 계산기`); the brand is always last, after ` - `, so a
 * search result that truncates the title loses the brand rather than the query.
 *
 * Deliberately composed here rather than through Next's `title.template`, because the
 * template is applied to `metadata.title` and NOT reliably to `openGraph.title`, which would
 * leave the tab title and the social card disagreeing about the site's name. One function,
 * one string, all three fields (`<title>`, `og:title`, `twitter:title`). `og:site_name`
 * carries the bare `3BetTilt`, which is what a search engine reads for the site name — the
 * domain is never spelt into a title.
 *
 * ## Titles and H1s
 *
 * The title is written for the search result, the H1 for the reader who already arrived.
 * They share one meaning, not one string: `seoTitleOf` (content) and each static route's
 * `SEO.title` choose the words; the H1 stays the page's own sentence.
 *
 * ## Locales
 *
 * Nothing here assumes Korean. The canonical, `og:locale` and the hreflang set are all read
 * off the page's localised path, and `hreflangAlternates` takes the list of editions a
 * document exists in. Today that list is always the page's own locale — see
 * `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md` for what changes when `/en` has real pages.
 */
import type { Metadata } from 'next';
import { contentPath, seoTitleOf } from '../../content/graph.js';
import {
  DEFAULT_LOCALE,
  HREFLANG,
  localeOfPath,
  localePath,
  OPEN_GRAPH_LOCALE,
  sitePathOf,
  type Locale,
} from '../locale.js';
import type { AnyContentRecord } from '../../content/types.js';
import { OG_CARD_HEIGHT, OG_CARD_WIDTH, ogCardPath } from '../og/ogCard.js';
import { canonicalUrl } from './canonical.js';
import { seoDescriptionOf } from './contentSeo.js';
import { contentIndexDecision } from './policy.js';
import {
  absoluteUrl,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  TITLE_BRAND_SEPARATOR,
} from './site.js';

/** `'홀덤 팟오즈 계산기'` -> `'홀덤 팟오즈 계산기 - 3BetTilt'`. The site name is never doubled. */
export function formatTitle(title: string): string {
  const suffix = `${TITLE_BRAND_SEPARATOR}${SITE_NAME}`;
  return title === SITE_NAME || title.endsWith(suffix) ? title : `${title}${suffix}`;
}

export interface PageMetadataInput {
  /** Localised root-relative path of the page (`'/ko/learn'` — a `RouteEntry.path` or a
   *  `contentPath`). The canonical and the hreflang set are derived from it. */
  readonly path: string;
  /** Korean page title WITHOUT the site suffix — `formatTitle` adds it. */
  readonly title: string;
  /** Korean meta description, written for a beginner (build spec §65). */
  readonly description: string;
  /** May a search engine index this page? See `policy.ts` — never a free choice. */
  readonly index: boolean;
  /** `'article'` for an authored piece with a body; `'website'` for a hub or a tool. */
  readonly ogType?: 'article' | 'website';
  /** A page-specific social card (content pages); omitted = the shared `/og.png`. */
  readonly image?: { readonly path: string; readonly alt: string };
}

const OG_IMAGE = {
  url: absoluteUrl(OG_IMAGE_PATH),
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  alt: OG_IMAGE_ALT,
} as const;

/**
 * The `hreflang` set for one indexable page (D-S3-06): one entry per EDITION of the document,
 * each naming that edition's canonical, plus `x-default`.
 *
 * `editions` is the list of locales the document really exists in, and it defaults to the
 * page's own locale alone — which is the whole truth today: there is one language, so the set
 * is `ko-KR` + `x-default`, both naming the canonical. Nothing is emitted for a language the
 * site does not have, and nothing may be: a translation exists when its record exists, and
 * the caller that knows that passes it here. Because every edition computes the same set from
 * the same list, the annotations are reciprocal by construction.
 *
 * `x-default` names the default locale's edition while `/` redirects to it (D-S3-03). When a
 * real language selector replaces that redirect, this is the one line that points `x-default`
 * at `/` instead (`docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md`).
 */
export function hreflangAlternates(
  canonical: string,
  path: string,
  editions?: readonly Locale[],
): Record<string, string> {
  const locale = localeOfPath(path);
  if (locale === null) {
    throw new Error(`hreflangAlternates expects a localised path, got: ${path}`);
  }
  const available = editions ?? [locale];
  if (!available.includes(locale)) {
    throw new Error(`hreflangAlternates: ${path} is not listed among its own editions`);
  }
  const sitePath = sitePathOf(path);
  const urlOf = (edition: Locale): string =>
    edition === locale ? canonical : canonicalUrl(localePath(edition, sitePath));
  const languages: Record<string, string> = {};
  for (const edition of available) languages[HREFLANG[edition]] = urlOf(edition);
  languages['x-default'] = urlOf(available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locale);
  return languages;
}

/**
 * The metadata every route on this site emits.
 *
 * `follow` is `true` even on a `noindex` page: `/search` is not a document worth a search
 * result, but every link on it points at one that is, and telling a crawler to ignore
 * those links would be a different — and wrong — instruction.
 *
 * `hreflang` links are emitted for indexable pages only: a `noindex` page is not an edition
 * of anything, and a 404 has no address (see `not-found.tsx`).
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const url = canonicalUrl(input.path);
  const title = formatTitle(input.title);
  const image =
    input.image === undefined
      ? OG_IMAGE
      : {
          url: absoluteUrl(input.image.path),
          width: OG_CARD_WIDTH,
          height: OG_CARD_HEIGHT,
          alt: input.image.alt,
        };
  return {
    title,
    description: input.description,
    alternates: input.index
      ? { canonical: url, languages: hreflangAlternates(url, input.path) }
      : { canonical: url },
    robots: { index: input.index, follow: true },
    openGraph: {
      type: input.ogType ?? 'website',
      url,
      siteName: SITE_NAME,
      locale: OPEN_GRAPH_LOCALE[localeOfPath(input.path) ?? DEFAULT_LOCALE],
      title,
      description: input.description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
      images: [image.url],
    },
  };
}

/**
 * The metadata for one content page, derived entirely from its registry record: its own
 * `title` and `description` (the fields the author wrote), its path from `contentPath`,
 * and its robots directive from `status` + `indexable`.
 *
 * This is why WP-N did not have to type a hundred Korean strings, and why it cannot type
 * one that disagrees with the page.
 *
 * The `<title>` and the description are the two places a content page deliberately diverges
 * from its on-page copy: `seoTitleOf` (an explicit `seoTitle`, or the kind's template) while
 * the `<h1>` keeps `title`, and `seoDescriptionOf` (an explicit `seoDescription`, or the
 * kind's default) while the deck keeps `description`.
 */
export function contentMetadata(record: AnyContentRecord): Metadata {
  return pageMetadata({
    path: contentPath(record),
    title: seoTitleOf(record),
    description: seoDescriptionOf(record),
    index: contentIndexDecision(record).index,
    // `article` where the page really is an authored article with a body and a
    // `BreadcrumbList`+`Article` pair; `website` for the reference pages (a glossary
    // entry, a hand page) which are documents but not articles. See `jsonLd.ts`.
    ogType: record.kind === 'learn' || record.kind === 'blog' ? 'article' : 'website',
    image: { path: ogCardPath(record), alt: record.title },
  });
}
