/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default: this file reads the app and content trees off
 * disk to prove that every URL it advertises is backed by a real page. Same reasoning, and
 * same idiom, as `src/content/content.test.ts`.
 */
/**
 * The sitemap, asserted as RULES over live data plus fixtures for the states the product
 * is trying to leave behind.
 *
 * The trap this file is written against (`docs/FISHTILT_STATE.md` ruling 26): the sitemap
 * is generated from the live registries, so the tempting test is "find a `PLANNED` record
 * and check it is absent". There are three `PLANNED` records today and WP-E3 is publishing
 * them; such a test would go green-then-red through nobody's fault and would then be
 * deleted, taking the real rule with it.
 *
 * So the exclusions are proved twice, in two different ways, and neither depends on the
 * product being unfinished:
 *
 *  - as an INVARIANT over whatever the registries currently hold — a URL is in the sitemap
 *    if and only if that page's own `robots` meta tag says `index`, whatever those flags
 *    happen to be today (`is exactly the set…`, `agrees with the meta robots directive`);
 *  - as BEHAVIOUR against records and routes this file constructs, which stay `PLANNED`,
 *    unindexable and unavailable forever no matter how finished the site becomes.
 */
import { APP_DEFAULT_LOCALE_GROUP, DEFAULT_LOCALE, HREFLANG, localePath, sitePathOf } from '../locale.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import robots from '../../app/robots.js';
import sitemap from '../../app/sitemap.js';
import { contentPath } from '../../content/graph.js';
import { ALL_CONTENT } from '../../content/registry/index.js';
import type { AnyContentRecord, LearnRecord } from '../../content/types.js';
import { ROUTES, type RouteEntry } from '../routes.js';
import { contentIndexDecision, routeIndexDecision } from './policy.js';
import { sitemapPaths, sitemapUrls } from './sitemapEntries.js';
import { absoluteUrl, SITE_ORIGIN } from './site.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));
const CONTENT_DIR = fileURLToPath(new URL('../../../content', import.meta.url));

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.mdx'];

const paths = sitemapPaths();
const urls = sitemapUrls();
const routePaths = new Set(ROUTES.map((route) => route.path));
const contentByPath = new Map(ALL_CONTENT.map((record) => [contentPath(record), record]));

function routePageExists(path: string): boolean {
  // Every page lives under `src/app/(default-locale)/`; the sitemap lists its localised URL.
  const sitePath = sitePathOf(path);
  const dir = join(APP_DIR, APP_DEFAULT_LOCALE_GROUP, sitePath === '/' ? '' : sitePath.slice(1));
  return PAGE_FILES.some((file) => existsSync(join(dir, file)));
}

function lesson(over: Partial<LearnRecord> = {}): LearnRecord {
  return {
    kind: 'learn',
    id: 'fixture-lesson',
    slug: 'fixture-lesson',
    title: '픽스처 레슨',
    description: '테스트가 직접 만든 레코드입니다.',
    level: 'INTRO',
    topic: 'rules',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
    order: 1,
    ...over,
  };
}

/** A registry-shaped fixture: written in `sitePath` terms, `path` derived exactly as
 *  `src/lib/routes.ts` derives it. */
function route(over: Partial<Omit<RouteEntry, 'path'>> = {}): RouteEntry {
  const sitePath = over.sitePath ?? '/fixture';
  return {
    id: 'fixture',
    label: '픽스처',
    section: 'learn',
    available: true,
    ...over,
    sitePath,
    path: localePath(DEFAULT_LOCALE, sitePath),
  };
}

describe('every URL in the sitemap resolves to a real page', () => {
  it('lists nothing that is neither a registered route nor a registered content page', () => {
    for (const path of paths) {
      expect(routePaths.has(path) || contentByPath.has(path)).toBe(true);
    }
  });

  it('has a page file on disk behind every static route it lists', () => {
    for (const path of paths.filter((candidate) => routePaths.has(candidate))) {
      expect(routePageExists(path), `no page.tsx for ${path}`).toBe(true);
    }
  });

  it('has an MDX file on disk behind every content page it lists', () => {
    for (const path of paths) {
      const record = contentByPath.get(path);
      if (record === undefined) continue; // static routes have no MDX file; checked separately above
      const file = join(CONTENT_DIR, record.kind, `${record.slug}.mdx`);
      expect(existsSync(file), `no MDX for ${path}`).toBe(true);
    }
  });

  it('lists no URL twice', () => {
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('every URL is a canonical URL', () => {
  it('is absolute, on the configured origin, with no query and no fragment', () => {
    for (const value of urls) {
      const url = new URL(value);
      expect(url.origin).toBe(new URL(SITE_ORIGIN).origin);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
      expect(value).toBe(url.origin + (url.pathname === '/' ? '' : url.pathname));
    }
  });

  it('carries no trailing slash on a sub-path', () => {
    for (const path of paths) {
      expect(path === '/' || !path.endsWith('/')).toBe(true);
    }
  });
});

describe('the exclusions — as an invariant over whatever the registries hold today', () => {
  it('is exactly the set of routes and records whose own index decision is `index`', () => {
    const expected = [
      ...ROUTES.filter((entry) => routeIndexDecision(entry).index).map((entry) => entry.path),
      ...ALL_CONTENT.filter((record) => contentIndexDecision(record).index).map(contentPath),
    ];
    expect([...paths].sort()).toEqual([...new Set(expected)].sort());
  });

  it('agrees with the meta robots directive each page emits, record by record', () => {
    const listed = new Set(paths);
    for (const record of ALL_CONTENT) {
      expect(listed.has(contentPath(record))).toBe(contentIndexDecision(record).index);
    }
  });

  it('never lists the search results page — build spec §33', () => {
    expect(paths).not.toContain(ko('/search'));
    expect(urls).not.toContain(absoluteUrl(ko('/search')));
  });

  it('lists no quiz result state, because a quiz result has no URL', () => {
    // Quiz score and answers live in React state (`Quiz`, `RangeQuiz`); nothing is written
    // to the URL. The landing pages are ordinary indexed pages, and there is nothing else.
    expect(
      paths.filter((path) => path.startsWith(ko('/practice'))).every((path) => routePaths.has(path)),
    ).toBe(true);
    expect(paths.some((path) => path.includes('?'))).toBe(false);
  });
});

describe('the exclusions — as behaviour, against fixtures that never ship', () => {
  const records: readonly AnyContentRecord[] = [
    lesson({ id: 'published', slug: 'published' }),
    lesson({ id: 'planned', slug: 'planned', status: 'PLANNED', readMinutes: null }),
    lesson({ id: 'thin', slug: 'thin', indexable: false }),
  ];
  const routes: readonly RouteEntry[] = [
    route({ id: 'built', sitePath: '/built' }),
    route({ id: 'unbuilt', sitePath: '/unbuilt', available: false }),
    route({ id: 'results', sitePath: '/results', section: 'search' }),
  ];

  it('drops a PLANNED record, a thin record, an unbuilt route and a search route', () => {
    expect(sitemapPaths(routes, records)).toEqual([ko('/built'), ko('/learn/published')]);
  });

  it('emits absolute URLs for exactly those', () => {
    expect(sitemapUrls(routes, records)).toEqual([
      absoluteUrl(ko('/built')),
      absoluteUrl(ko('/learn/published')),
    ]);
  });
});

describe('the sitemap route', () => {
  it('emits one entry per URL, its hreflang alternates, and nothing it cannot substantiate', () => {
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([...urls]);
    for (const entry of entries) {
      // No lastModified/changeFrequency/priority — see the module doc. The alternates are the
      // page's own `hreflang` set (D-S3-06): its locale's tag and `x-default`, both the URL.
      expect(Object.keys(entry)).toEqual(['url', 'alternates']);
      expect(entry.alternates?.languages).toEqual({
        [HREFLANG[DEFAULT_LOCALE]]: entry.url,
        'x-default': entry.url,
      });
    }
  });
});

describe('the robots route', () => {
  const value = robots();

  it('points at the sitemap on the same origin as every canonical', () => {
    expect(value.sitemap).toBe(absoluteUrl('/sitemap.xml'));
  });

  it('disallows nothing — `noindex` is what keeps a page out of the index, not a block', () => {
    expect(value.rules).toEqual([{ userAgent: '*', allow: '/' }]);
  });
});
