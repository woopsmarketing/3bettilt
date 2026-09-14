/**
 * JSON-LD builders. Pure functions from data the page already has to a plain object.
 *
 * ## The rule these are written to (build spec §35: "Schema spam 금지")
 *
 * **Every field emitted must be true of the rendered page.** Not "true of the site", not
 * "true once we add it" — true of the document a crawler will fetch at that URL. That has
 * three consequences visible throughout this file:
 *
 * - Fields this repository cannot substantiate are ABSENT, not guessed. There is no
 *   `datePublished`/`dateModified` on `Article`: content records carry no date (see
 *   `src/content/types.ts`), and a build timestamp would say the article was written the
 *   day the site was compiled. Missing a recommended field costs a rich-result eligibility
 *   check; inventing one is a false statement about the page.
 * - Each type is emitted only where its subject exists: `Article` on the two kinds that
 *   really are articles, `FAQPage` only where `faq.ts` found visible questions on that
 *   page, `WebApplication` only on a page that hosts a working tool.
 * - The `BreadcrumbList` is built from the same trail the visible `<nav>` renders
 *   (`Breadcrumbs.tsx`), so it cannot describe a different path.
 *
 * ## Why the objects are `unknown`-valued records rather than a typed schema.org model
 *
 * A hand-written interface per type would be a second, partial copy of schema.org that
 * adds no checking the tests do not already do — the tests parse the emitted string and
 * assert the fields. `JsonLdObject` keeps the builders honest about being data.
 */
import type { BreadcrumbItem } from './breadcrumbs.js';
import type { FaqItem } from './faq.js';
import { absoluteUrl, OG_IMAGE_PATH, SITE_NAME, titleHead } from './site.js';
import { canonicalUrl } from './canonical.js';
import type { BlogRecord, LearnRecord } from '../../content/types.js';
import { BLOG_CONTENT_TYPE_LABEL, contentPath } from '../../content/graph.js';
import { routeById } from '../routes.js';

export type JsonLdObject = Readonly<Record<string, unknown>>;

const CONTEXT = 'https://schema.org';

/**
 * 3BetTilt itself. The site has no named human author and does not claim one.
 *
 * Embedded (no `@context`) inside `Article`, `WebApplication` and `WebSite`; the same object
 * is published as a top-level block by `organizationJsonLd` below. One definition, so the
 * publisher a crawler reads on a lesson page and the organisation it reads on the home page
 * are the same entity rather than two that happen to share a name.
 */
/**
 * The site's front door as an absolute URL — `https://…/ko`, not the bare origin. The bare
 * origin answers with a redirect, and a `WebSite`/`Organization` `url` is meant to name the
 * page a crawler can fetch (D-S3-01/04).
 */
const SITE_HOME_URL = canonicalUrl(routeById('home').path);

const PUBLISHER: JsonLdObject = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_HOME_URL,
};

/**
 * `Organization` as a page-level block. Emitted ONCE, on the home page.
 *
 * Nothing is added to the embedded object above — no logo, no `sameAs`, no address, no
 * contact point. 3BetTilt has no social profiles to point `sameAs` at, no postal address and
 * no support channel, and `og.png` is a shared social card rather than a square brand mark of
 * the kind `logo` is specified to be. A field guessed here would be the first false statement
 * in the whole file (CLAUDE.md rule 5).
 */
export function organizationJsonLd(): JsonLdObject {
  return { '@context': CONTEXT, ...PUBLISHER };
}

/**
 * `WebSite` — the site's own name and address, declared once, on the home page.
 *
 * ## Why there is no `potentialAction` / `SearchAction`
 *
 * The `SearchAction` pattern advertises a URL TEMPLATE a search engine may fill in and
 * request, so that a query typed into a result page reaches the site's own search. 3BetTilt
 * cannot honour that: `/search` takes no `searchParams`, renders one prerendered document and
 * parses `?q=` in the browser after hydration (`SearchClient`), so there is no server endpoint
 * behind the template — and `/search` is `noindex` besides. Declaring one would be a promise
 * the site cannot keep, which is the exact failure `jsonLd.ts` exists to avoid.
 */
export function webSiteJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_HOME_URL,
    inLanguage: 'ko',
    isAccessibleForFree: true,
    publisher: PUBLISHER,
  };
}

/**
 * `BreadcrumbList` for a content route. Positions are 1-based and contiguous, and every
 * `item` is the absolute URL of a page that exists — including the last, which is the page
 * the reader is on.
 */
export function breadcrumbListJsonLd(trail: readonly BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * `Article` for a Learn lesson or a Blog article — the two kinds that are authored prose
 * with a body, a lead and a reading time.
 *
 * Not emitted for a glossary entry (a definition, not an article) or a hand page (a
 * reference page whose body is mostly this site's own computed figures). Those get their
 * `BreadcrumbList` and nothing else, which is the honest amount.
 */
export function articleJsonLd(record: LearnRecord | BlogRecord): JsonLdObject {
  const url = canonicalUrl(contentPath(record));
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    headline: record.title,
    description: record.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ko',
    image: absoluteUrl(OG_IMAGE_PATH),
    isAccessibleForFree: true,
    author: PUBLISHER,
    publisher: PUBLISHER,
    // The blog's content type is a section the hub really renders under that name
    // (D-S3-19), so it is a true `articleSection`. A lesson has no such section.
    ...(record.kind === 'blog'
      ? { articleSection: BLOG_CONTENT_TYPE_LABEL[record.contentType] }
      : {}),
  };
}

/**
 * `FAQPage` for a page that visibly shows these exact questions and answers.
 *
 * `null` for an empty list rather than an empty `mainEntity`, so a caller cannot emit a
 * `FAQPage` that declares no questions. `faq.ts` is what decides whether the list is
 * empty; this function never second-guesses it.
 */
export function faqPageJsonLd(items: readonly FaqItem[]): JsonLdObject | null {
  if (items.length === 0) return null;
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    inLanguage: 'ko',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface ToolAppInput {
  readonly path: string;
  readonly name: string;
  readonly description: string;
}

/**
 * `WebApplication` for one tool page.
 *
 * `WebApplication` rather than `SoftwareApplication`: these are not downloadable programs,
 * they are calculators that run in the page — `operatingSystem: 'Web'` and the zero-price
 * `offers` are both literally true (build spec §50: no login, no payment, no account
 * anywhere on this site). `applicationCategory` is `EducationalApplication` because that is
 * what the tools are for; nothing here claims a game or a gambling product.
 */
export function webApplicationJsonLd(input: ToolAppInput): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebApplication',
    name: titleHead(input.name),
    description: input.description,
    url: canonicalUrl(input.path),
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    inLanguage: 'ko',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    publisher: PUBLISHER,
  };
}

/* ---------------------------------------------------------------- hub pages: what a hub IS */

/**
 * One row a hub renders as a link. `path` is the RESOLVED destination — the same
 * `string | null` the card was given, already narrowed to a real page by the caller.
 *
 * A row the hub renders as inert "준비 중" text has no `path` and therefore never reaches
 * here: a `ListItem` carrying a `url` that 404s would be the list equivalent of a dead link,
 * and a `ListItem` carrying no `url` at all is a name with nowhere to go. Either way the
 * honest list is the list of destinations, which is also what the reader can act on.
 */
export interface ListedItem {
  readonly name: string;
  /** Root-relative path of a page that exists. */
  readonly path: string;
}

/**
 * `ItemList` — the ordered contents of a hub, in the order the hub renders them.
 *
 * `null` for an empty list, so a caller cannot publish a `CollectionPage` that collects
 * nothing. Positions are 1-based and contiguous over the items that are actually links.
 *
 * `itemListOrder` is deliberately absent. The four content hubs each sort by something real
 * (curriculum order, group size, Korean collation, hand strength) and none of those is
 * schema.org's `Ascending`/`Descending`/`Unordered`; naming one would be a claim about the
 * sort key that the enumeration itself already carries correctly.
 */
export function itemListJsonLd(items: readonly ListedItem[]): JsonLdObject | null {
  if (items.length === 0) return null;
  return {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

/** One glossary row: the heading and the one-line definition `/glossary` prints under it. */
export interface DefinedTermItem extends ListedItem {
  readonly description: string;
}

/**
 * `DefinedTermSet` — `/glossary`'s contents, in the more precise type.
 *
 * WP-N recorded `DefinedTerm` as "arguably the best-fitting type on the site" and declined to
 * add it unilaterally. It is added here as the glossary hub's `mainEntity` INSTEAD of the
 * generic `ItemList`, not in addition to one: a `CollectionPage` carrying both would describe
 * the same 58 rows twice, and duplication is the cheapest kind of schema spam.
 *
 * Both fields are on the page. `name` is the row's Korean heading and `description` is
 * `shortDefinition`, which `/glossary` renders as that card's own body text — so a term whose
 * definition changes changes here on the same build. `url` is the term's page.
 *
 * `inDefinedTermSet` is not written on each term: they are nested inside the set's
 * `hasDefinedTerm`, which states the same relation without needing an `@id` to point at.
 */
/**
 * The glossary's `DefinedTermSet` name — the dictionary's own name, as its hub `<h1>` prints
 * it. One constant because the hub's set and every term page's `inDefinedTermSet` must name
 * the same set; the hub's `<title>` is a search line and is deliberately not used here.
 */
export const GLOSSARY_TERM_SET_NAME = '포커 용어 사전';

export function definedTermSetJsonLd(
  name: string,
  path: string,
  terms: readonly DefinedTermItem[],
): JsonLdObject | null {
  if (terms.length === 0) return null;
  return {
    '@type': 'DefinedTermSet',
    name,
    url: canonicalUrl(path),
    hasDefinedTerm: terms.map((term) => ({
      '@type': 'DefinedTerm',
      name: term.name,
      description: term.description,
      url: absoluteUrl(term.path),
    })),
  };
}

export interface DefinedTermInput {
  /** The headword the term page prints in `data-glossary-headword`. */
  readonly name: string;
  /** The `shortDefinition` the page prints as its lead. */
  readonly description: string;
  /** The other names the header prints (Latin term, aliases) — never the headword itself. */
  readonly alternateNames: readonly string[];
  /** The term page's site path (locale-prefixed). */
  readonly path: string;
  /** The hub the term belongs to — its name and path, so the two blocks describe one set. */
  readonly set: { readonly name: string; readonly path: string };
}

/**
 * `DefinedTerm` for one glossary page (WP-S3-11, contract AW; moved beside the set builder
 * by WP-S3-16).
 *
 * The hub publishes the whole glossary as a `DefinedTermSet` (`definedTermSetJsonLd`); a
 * term page states its own entry and points back at that set via `inDefinedTermSet`, so
 * the two blocks describe one thing from two pages. Kept truthful the same way: `name` is
 * the headword the header prints, `description` is the `shortDefinition` the header prints
 * as the lead, `alternateName` are the other names the header prints — every field is on
 * screen.
 *
 * This is a TOP-LEVEL block on the term page (not nested inside a `CollectionPage` like the
 * set is on the hub), so it carries `@context` like every other top-level block here. The
 * first version shipped without one, which a validator reads as a bare object rather than
 * schema.org data.
 */
export function definedTermJsonLd(input: DefinedTermInput): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'DefinedTerm',
    name: input.name,
    description: input.description,
    ...(input.alternateNames.length > 0 ? { alternateName: [...input.alternateNames] } : {}),
    url: canonicalUrl(input.path),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: input.set.name,
      url: absoluteUrl(input.set.path),
    },
  };
}

export interface CollectionPageInput {
  readonly path: string;
  /**
   * The page's own `<title>` text, WITHOUT the site suffix. The block's `name` is its search
   * phrase (`titleHead` — the part before ` | `), so the structured data names the page and
   * the `<title>` carries the qualifier.
   *
   * Named `title` rather than `name` so that a page's single `SEO = { path, title,
   * description }` constant — the shape the six tool pages already use — spreads straight
   * into both `pageMetadata` and this builder. The `<head>` and the structured data therefore
   * read one literal, and cannot come to name the page differently.
   */
  readonly title: string;
  /** The page's own meta description, for the same reason. */
  readonly description: string;
  /** What the page is a page OF: an `ItemList`, or `/glossary`'s `DefinedTermSet`. */
  readonly mainEntity: JsonLdObject | null;
}

/**
 * `CollectionPage` for one of the six hubs.
 *
 * A hub genuinely is this: a page whose subject is the list it renders. The claim is kept
 * true by where the list comes from — the caller passes the SAME array it maps into cards,
 * with the same destinations already resolved, so the enumeration is a serialisation of the
 * visible list rather than a second description of it.
 *
 * `null` when there is nothing to collect. A hub that lists no links is not a collection, and
 * an empty `CollectionPage` would be an assertion about a page that is not there yet.
 */
export function collectionPageJsonLd(input: CollectionPageInput): JsonLdObject | null {
  if (input.mainEntity === null) return null;
  const url = canonicalUrl(input.path);
  return {
    '@context': CONTEXT,
    '@type': 'CollectionPage',
    name: titleHead(input.title),
    description: input.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_HOME_URL },
    mainEntity: input.mainEntity,
  };
}

/**
 * Serialises one or more blocks for a `<script type="application/ld+json">` body.
 *
 * `<` is escaped to its `\\u003c` form, which is still the same JSON string but can never close the
 * surrounding `<script>` element. The content here is the site's own Korean prose, so this
 * is defence in depth rather than a live injection path — but a JSON-LD emitter that gets
 * this wrong is an XSS primitive, and it costs one `replace` to not be one.
 */
export function serializeJsonLd(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</gu, '\\u003c');
}
