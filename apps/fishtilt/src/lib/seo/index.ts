/**
 * The SEO barrel. Pages import from here; nothing else in the app reaches into the
 * individual modules, so the surface a route can use is the surface listed below.
 */
export { canonicalPath, canonicalUrl } from './canonical.js';
export { contentBreadcrumbs, routeBreadcrumbs, type BreadcrumbItem } from './breadcrumbs.js';
export { extractFaqItems, MIN_FAQ_ITEMS, type FaqItem } from './faq.js';
// `readFaqItems` is deliberately NOT re-exported: it imports `node:fs`, and the barrel is
// imported by every route. Keeping the filesystem read behind its own module path means a
// client component can never pull it in by touching the barrel. The two templates that
// need it import `./seo/faqSource.js` directly.
export { JsonLd } from './JsonLdScript.js';
export {
  articleJsonLd,
  breadcrumbListJsonLd,
  collectionPageJsonLd,
  definedTermJsonLd,
  definedTermSetJsonLd,
  GLOSSARY_TERM_SET_NAME,
  faqPageJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  webApplicationJsonLd,
  webSiteJsonLd,
  type CollectionPageInput,
  type DefinedTermInput,
  type DefinedTermItem,
  type JsonLdObject,
  type ListedItem,
  type ToolAppInput,
} from './jsonLd.js';
export {
  contentMetadata,
  formatTitle,
  hreflangAlternates,
  pageMetadata,
  type PageMetadataInput,
} from './metadata.js';
export {
  contentIndexDecision,
  indexableContent,
  indexableRoutes,
  routeIndexDecision,
  SECTION_INDEXABLE,
  type IndexDecision,
  type IndexReason,
} from './policy.js';
export { sitemapEntries, sitemapPaths, sitemapUrls, type SitemapEntry } from './sitemapEntries.js';
export { seoDescriptionOf } from './contentSeo.js';
export {
  absoluteUrl,
  HOME_SEO_DESCRIPTION,
  HOME_SEO_TITLE,
  normaliseOrigin,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  PRODUCTION_ORIGIN,
  SITE_LOCALE,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_ORIGIN_IS_DEFAULT,
  TITLE_BRAND_SEPARATOR,
  TITLE_QUALIFIER_SEPARATOR,
  titleHead,
} from './site.js';
