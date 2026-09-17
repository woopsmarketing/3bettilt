/**
 * @vitest-environment node
 *
 * The prefixless default-locale URL contract, site-wide (D-S3-23). Every one of the 141
 * indexable pages is addressed without `/ko` — sitemap, canonical, og:url, hreflang — and the
 * migration changed URLs only: each page's title and description equal the pre-migration
 * build's, frozen in `seoMetadataContract.fixture.json` (read from that build's HTML).
 */
import { describe, expect, it } from 'vitest';
import type { Metadata } from 'next';
import { ALL_CONTENT } from '../../content/registry/index.js';
import { contentPath } from '../../content/graph.js';
import { metadata as homeMeta } from '../../app/(default-locale)/page.js';
import { metadata as learnMeta } from '../../app/(default-locale)/learn/page.js';
import { metadata as toolsMeta } from '../../app/(default-locale)/tools/page.js';
import { metadata as rangeMeta } from '../../app/(default-locale)/tools/range/page.js';
import { metadata as startingHandMeta } from '../../app/(default-locale)/tools/starting-hand/page.js';
import { metadata as equityMeta } from '../../app/(default-locale)/tools/equity/page.js';
import { metadata as potOddsMeta } from '../../app/(default-locale)/tools/pot-odds/page.js';
import { metadata as handCheckerMeta } from '../../app/(default-locale)/tools/hand-checker/page.js';
import { metadata as outsMeta } from '../../app/(default-locale)/tools/outs/page.js';
import { metadata as practiceMeta } from '../../app/(default-locale)/practice/page.js';
import { metadata as rangeQuizMeta } from '../../app/(default-locale)/practice/range-quiz/page.js';
import { metadata as handRankingQuizMeta } from '../../app/(default-locale)/practice/hand-ranking-quiz/page.js';
import { metadata as startingHandQuizMeta } from '../../app/(default-locale)/practice/starting-hand-quiz/page.js';
import { metadata as glossaryMeta } from '../../app/(default-locale)/glossary/page.js';
import { metadata as blogMeta } from '../../app/(default-locale)/blog/page.js';
import { metadata as handsMeta } from '../../app/(default-locale)/hands/page.js';
import { metadata as aboutMeta } from '../../app/(default-locale)/about/page.js';
import { metadata as searchMeta } from '../../app/(default-locale)/search/page.js';
import { ROUTES } from '../routes.js';
import CONTRACT from './seoMetadataContract.fixture.json' with { type: 'json' };
import { contentMetadata } from './metadata.js';
import { indexableContent, indexableRoutes } from './policy.js';
import { SITE_ORIGIN } from './site.js';
import { sitemapEntries, sitemapPaths } from './sitemapEntries.js';

const STATIC_METADATA: Readonly<Record<string, Metadata>> = {
  home: homeMeta,
  learn: learnMeta,
  tools: toolsMeta,
  range: rangeMeta,
  toolStartingHand: startingHandMeta,
  toolEquity: equityMeta,
  toolPotOdds: potOddsMeta,
  toolHandChecker: handCheckerMeta,
  toolOuts: outsMeta,
  practice: practiceMeta,
  practiceRange: rangeQuizMeta,
  practiceHandRanking: handRankingQuizMeta,
  practiceStartingHand: startingHandQuizMeta,
  glossary: glossaryMeta,
  blog: blogMeta,
  hands: handsMeta,
  about: aboutMeta,
};

const PAGES: readonly { readonly path: string; readonly meta: Metadata }[] = [
  ...indexableRoutes().map((route) => {
    const meta = STATIC_METADATA[route.id];
    if (meta === undefined) throw new Error(`no metadata export mapped for route ${route.id}`);
    return { path: route.path, meta };
  }),
  ...indexableContent(ALL_CONTENT).map((record) => ({
    path: contentPath(record),
    meta: contentMetadata(record),
  })),
];

/** A legacy `/ko` address: a root-relative `/ko…` path, or an absolute URL whose path is. */
const hasLegacy = (value: unknown): boolean =>
  typeof value === 'string' &&
  (value === '/ko' || value.startsWith('/ko/') || /^https?:\/\/[^/]+\/ko(?:[/?#]|$)/u.test(value));

describe('URL migration — 141 prefixless indexable pages', () => {
  it('the guard catches a legacy URL and nothing else', () => {
    expect(hasLegacy('/ko')).toBe(true);
    expect(hasLegacy('/ko/learn')).toBe(true);
    expect(hasLegacy('https://3bettilt.com/ko/learn')).toBe(true);
    expect(hasLegacy('https://3bettilt.com/ko')).toBe(true);
    expect(hasLegacy('https://3bettilt.com/korean')).toBe(false);
    expect(hasLegacy('/tools/ko')).toBe(false);
    expect(hasLegacy('/learn')).toBe(false);
  });

  it('the sitemap still lists exactly 141 unique URLs, none under /ko', () => {
    const paths = sitemapPaths();
    expect(paths).toHaveLength(141);
    expect(new Set(paths).size).toBe(141);
    expect(paths.filter(hasLegacy)).toEqual([]);
    const entries = sitemapEntries();
    expect(entries).toHaveLength(141);
    for (const entry of entries) {
      expect(hasLegacy(entry.url), entry.url).toBe(false);
      for (const url of Object.values(entry.alternates.languages)) {
        expect(hasLegacy(url), url).toBe(false);
      }
    }
    expect(entries[0]?.url).toBe(SITE_ORIGIN);
  });

  it('no route path or content path carries /ko', () => {
    expect(ROUTES.map((r) => r.path).filter(hasLegacy)).toEqual([]);
    expect(ALL_CONTENT.map(contentPath).filter(hasLegacy)).toEqual([]);
  });

  it('covers every sitemap page with metadata', () => {
    expect(PAGES).toHaveLength(141);
    expect(new Set(PAGES.map((p) => p.path))).toEqual(new Set(sitemapPaths()));
  });

  it('canonical, og:url and hreflang are prefixless, self-referencing and unique', () => {
    const canonicals: string[] = [];
    for (const { path, meta } of PAGES) {
      const expected = path === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
      const canonical = meta.alternates?.canonical;
      expect(canonical, path).toBe(expected);
      expect((meta.openGraph as { url?: string } | undefined)?.url, path).toBe(expected);
      expect(meta.alternates?.languages, path).toEqual({ 'ko-KR': expected, 'x-default': expected });
      canonicals.push(String(canonical));
    }
    expect(canonicals.filter(hasLegacy)).toEqual([]);
    expect(new Set(canonicals).size).toBe(141);
    expect(canonicals).toContain(SITE_ORIGIN);
  });

  it('emits no English (or any second-language) alternate yet', () => {
    for (const { path, meta } of PAGES) {
      expect(Object.keys(meta.alternates?.languages ?? {}).sort(), path).toEqual([
        'ko-KR',
        'x-default',
      ]);
    }
  });

  it('keeps every title and description exactly as the pre-migration build shipped them', () => {
    const contract = CONTRACT as Readonly<Record<string, { title: string; description: string }>>;
    expect(Object.keys(contract)).toHaveLength(141);
    const actual = Object.fromEntries(
      PAGES.map(({ path, meta }) => [
        path,
        { title: String(meta.title), description: String(meta.description) },
      ]),
    );
    expect(actual).toEqual(contract);
  });

  it('keeps /search noindex, on its prefixless canonical', () => {
    expect(searchMeta.robots).toEqual({ index: false, follow: true });
    expect(searchMeta.alternates?.canonical).toBe(`${SITE_ORIGIN}/search`);
  });
});
