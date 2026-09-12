/**
 * `graph.ts`'s own behaviour, as opposed to `content.test.ts`, which checks that the DATA in
 * the registry is legal. The two properties worth pinning here are the ones every component
 * leans on: a planned piece never yields a link, and a tool link is assembled from the route
 * registry rather than from a string in an article.
 */
import { describe, expect, it, vi } from 'vitest';
import { routeById } from '../lib/routes.js';
import type * as RoutesModule from '../lib/routes.js';
import {
  CONTENT_PREFIX,
  LEARN_ROADMAP,
  PUBLISHED_LESSONS,
  RELATION_HEADING,
  contentById,
  contentBySlug,
  contentMeta,
  contentOfKind,
  contentPath,
  findContent,
  glossaryById,
  hrefOfContent,
  relationsOf,
  toolHref,
} from './graph.js';
import { DEFAULT_LOCALE, localePath } from '../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/**
 * Every tool route has shipped, so the live registry has no unbuilt `tools`-section route
 * left to exercise `toolHref`'s "not built yet" branch with. That branch is permanent
 * behaviour — CLAUDE.md rule 3's cousin, "never silently drop a still-real case" — not a
 * fact about how much of the product happens to exist today, so the fixture it needs is one
 * this test controls rather than one it goes hunting for in production data (the same trap
 * `routes.test.ts` documents for `available` itself). This forces `toolOuts` unavailable
 * while leaving every other route — including `range`, which the tests below still deep-link
 * through for real — exactly as the registry defines it.
 */
vi.mock('../lib/routes.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RoutesModule>();
  const ROUTES = actual.ROUTES.map((route) =>
    route.id === 'toolOuts' ? { ...route, available: false } : route,
  );
  const BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
  return {
    ...actual,
    ROUTES,
    routeById: (id: string) => {
      const route = BY_ID.get(id);
      if (!route) throw new Error(`No such route id: "${id}"`);
      return route;
    },
  };
});

describe('lookup', () => {
  it('finds a record by id and refuses an unknown one loudly', () => {
    expect(contentById('poker-range').slug).toBe('poker-range');
    expect(findContent('nope')).toBeUndefined();
    expect(() => contentById('nope')).toThrow(/No such content id/u);
  });

  it('finds a record by kind and slug', () => {
    expect(contentBySlug('learn', 'poker-range')?.id).toBe('poker-range');
    expect(contentBySlug('blog', 'poker-range')).toBeUndefined();
  });

  it('glossaryById answers only for glossary entries', () => {
    expect(glossaryById('term-range')?.term).toBe('Range');
    expect(glossaryById('poker-range')).toBeUndefined();
  });

  it('the roadmap is every lesson, in order, and the published subset is a subset', () => {
    expect(LEARN_ROADMAP.length).toBe(contentOfKind('learn').length);
    expect(LEARN_ROADMAP.map((lesson) => lesson.order)).toEqual(
      [...LEARN_ROADMAP.map((lesson) => lesson.order)].sort((a, b) => a - b),
    );
    for (const lesson of PUBLISHED_LESSONS) expect(lesson.status).toBe('PUBLISHED');
  });
});

describe('URLs', () => {
  it('builds a path under the kind prefix', () => {
    expect(contentPath(contentById('poker-range'))).toBe(ko(`${CONTENT_PREFIX.learn}/poker-range`));
    expect(contentPath(contentById('term-range'))).toBe(ko(`${CONTENT_PREFIX.glossary}/range`));
  });

  it('offers a link only for a published piece', () => {
    expect(hrefOfContent(contentById('poker-range'))).toBe(ko('/learn/poker-range'));
    // This used to FIND a still-`PLANNED` record in `ALL_CONTENT` rather than naming one —
    // guarding against the shallow version of ruling 26 (docs/FISHTILT_STATE.md), but ruling
    // 21 names exactly this as the real trap: searching instead of naming only delays the
    // failure to the day every record ships, it does not prevent it. `hrefOfContent` is a
    // pure function of the record it's given — it never looks anything up in the registry —
    // so there is no need to find a real one at all: a local clone with `status: 'PLANNED'`
    // proves the same branch and stays true forever, however much of the site is published.
    const planned = { ...contentById('poker-range'), status: 'PLANNED' as const };
    expect(hrefOfContent(planned)).toBeNull();
  });
});

describe('toolHref', () => {
  it('returns null for a tool the route registry says is not built', () => {
    // `toolOuts` is forced unavailable by the module mock above, not found by searching the
    // live registry — every tool has shipped, so that search would come up empty, and the
    // property under test is permanent `toolHref` behaviour, not a fact about today's build
    // state.
    const unbuilt = routeById('toolOuts');
    expect(unbuilt.available).toBe(false);
    expect(toolHref(unbuilt.id, { a: 'b' })).toBeNull();
  });

  it('appends the parameters as a query string, encoded', () => {
    const route = routeById('range');
    expect(route.available, 'range route is expected to be shipped').toBe(true);
    if (!route.available) return;
    expect(toolHref('range')).toBe(route.path);
    expect(toolHref('range', { hero: 'BTN', spot: 'RFI' })).toBe(`${route.path}?hero=BTN&spot=RFI`);
    expect(toolHref('range', { q: 'a b&c=d' })).toBe(`${route.path}?q=a+b%26c%3Dd`);
  });

  it('throws for a route id that does not exist', () => {
    expect(() => toolHref('nope')).toThrow(/No such route/u);
  });
});

describe('relations', () => {
  it('omits a relation that has no entries rather than rendering an empty heading', () => {
    const record = { ...contentById('poker-range'), relatedHands: [] };
    const relations = relationsOf(record, ['relatedHands']);
    expect(relations).toEqual([]);
  });

  it('carries the relation’s contextual heading with it', () => {
    const [relation] = relationsOf(contentById('poker-range'), ['nextLessons']);
    expect(relation?.heading).toBe(RELATION_HEADING.nextLessons);
  });

  it('resolves a tool relation through the route registry', () => {
    const [relation] = relationsOf(contentById('poker-range'), ['relatedTools']);
    expect(relation?.links.map((link) => link.label)).toContain(routeById('range').label);
  });

  it('returns relations in a stable order regardless of the order asked for', () => {
    const asked = relationsOf(contentById('poker-range'), ['nextLessons', 'prerequisites']);
    expect(asked.map((relation) => relation.relation)).toEqual(['prerequisites', 'nextLessons']);
  });
});

describe('labels', () => {
  it('states level and reading time for a published lesson', () => {
    expect(contentMeta(contentById('poker-range'))).toMatch(/^초급 · 약 \d+분$/u);
  });

  it('states only the level when there is no text to time yet', () => {
    // A local clone with `readMinutes` forced back to `null`, not a lookup of a real
    // still-unpublished record — 'position' cited a still-planned lesson until it shipped
    // (ruling 26 again: "no text yet formats without a time" is permanent `contentMeta`
    // behaviour, not a fact about which lesson happens to be unwritten today).
    const unread = { ...contentById('poker-range'), level: 'BASIC' as const, readMinutes: null };
    expect(contentMeta(unread)).toBe('초급');
  });
});
