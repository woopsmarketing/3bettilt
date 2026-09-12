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
 * `'{page} · 3BetTilt'`, one separator for the whole site. Deliberately composed here
 * rather than through Next's `title.template`, because the template is applied to
 * `metadata.title` and NOT reliably to `openGraph.title`, which would leave the tab title
 * and the social card disagreeing about the site's name. One function, one string, both
 * fields.
 */
import type { Metadata } from 'next';
import { contentPath, seoTitleOf } from '../../content/graph.js';
import { HREFLANG, localeOfPath, SUPPORTED_LOCALES } from '../locale.js';
import type { AnyContentRecord } from '../../content/types.js';
import { canonicalUrl } from './canonical.js';
import { contentIndexDecision } from './policy.js';
import {
  absoluteUrl,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_LOCALE,
  SITE_NAME,
} from './site.js';

/** `'팟 오즈 계산기'` -> `'팟 오즈 계산기 · 3BetTilt'`. The site name is never doubled. */
export function formatTitle(title: string): string {
  return title === SITE_NAME || title.endsWith(` · ${SITE_NAME}`)
    ? title
    : `${title} · ${SITE_NAME}`;
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
}

const OG_IMAGE = {
  url: absoluteUrl(OG_IMAGE_PATH),
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  alt: OG_IMAGE_ALT,
} as const;

/**
 * The `hreflang` set for one indexable page (D-S3-06): its own locale's tag and
 * `x-default`, both naming the canonical. There is one language, so both point at the same
 * document; the set exists so that a crawler is told, in the standard vocabulary, that
 * this URL is the Korean edition and the default one. Nothing is emitted for a language the
 * site does not have.
 */
export function hreflangAlternates(canonical: string, path: string): Record<string, string> {
  const locale = localeOfPath(path);
  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    if (supported === locale) languages[HREFLANG[supported]] = canonical;
  }
  languages['x-default'] = canonical;
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
      locale: SITE_LOCALE,
      title,
      description: input.description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: input.description,
      images: [OG_IMAGE.url],
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
 * The one deliberate divergence is a blog record's optional `seoTitle` (WP-S3-06): the
 * `<title>` and the Open Graph title take it, the `<h1>` keeps `title`. A story's heading
 * can be a sentence while its search title names the subject.
 */
export function contentMetadata(record: AnyContentRecord): Metadata {
  return pageMetadata({
    path: contentPath(record),
    // A blog record may carry a search title distinct from its H1 (`seoTitle`); every other
    // kind titles the tab with its heading. `graph.ts` owns the choice.
    title: seoTitleOf(record),
    description: record.description,
    index: contentIndexDecision(record).index,
    // `article` where the page really is an authored article with a body and a
    // `BreadcrumbList`+`Article` pair; `website` for the reference pages (a glossary
    // entry, a hand page) which are documents but not articles. See `jsonLd.ts`.
    ogType: record.kind === 'learn' || record.kind === 'blog' ? 'article' : 'website',
  });
}
