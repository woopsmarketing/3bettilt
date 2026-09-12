/**
 * The index policy, asserted against fixtures this file constructs.
 *
 * `docs/FISHTILT_STATE.md` ruling 26 is the reason for the shape of this file. The three
 * `noindex` outcomes — an unavailable route, an unpublished record, a record below the
 * content threshold — are all states the product is expected to LEAVE as it is finished.
 * A test that found an example of each by searching the live registries would pass today
 * and start failing on the day the last hand page ships, through nobody's fault, and the
 * behaviour it was guarding would then be untested. So each state is built here.
 *
 * The live registries are still checked, but only for properties that must hold in EVERY
 * state of the product: the decision function is total, and it never contradicts itself.
 */
import { DEFAULT_LOCALE, localePath } from '../locale.js';
import { describe, expect, it } from 'vitest';
import { ROUTES, type RouteEntry, type RouteSection } from '../routes.js';
import type { AnyContentRecord, LearnRecord } from '../../content/types.js';
import {
  contentIndexDecision,
  indexableContent,
  indexableRoutes,
  routeIndexDecision,
  SECTION_INDEXABLE,
} from './policy.js';

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

function lesson(over: Partial<LearnRecord> = {}): LearnRecord {
  return {
    kind: 'learn',
    id: 'fixture-lesson',
    slug: 'fixture-lesson',
    title: '픽스처 레슨',
    description: '테스트가 직접 만든 레슨 레코드입니다.',
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

describe('routeIndexDecision', () => {
  it('indexes an available route in an indexable section', () => {
    expect(routeIndexDecision(route({ section: 'tools' }))).toEqual({
      index: true,
      reason: 'INDEXED',
    });
  });

  it('does not index a route that has no page yet', () => {
    expect(routeIndexDecision(route({ available: false }))).toEqual({
      index: false,
      reason: 'ROUTE_NOT_AVAILABLE',
    });
  });

  it('does not index a search results page even when it is fully built — §33', () => {
    expect(routeIndexDecision(route({ section: 'search', available: true }))).toEqual({
      index: false,
      reason: 'SECTION_NOT_INDEXABLE',
    });
  });

  it('decides every section the registry can hold', () => {
    const sections = new Set<RouteSection>(ROUTES.map((entry) => entry.section));
    for (const section of sections) {
      expect(SECTION_INDEXABLE[section]).toBeTypeOf('boolean');
    }
  });
});

describe('contentIndexDecision', () => {
  it('indexes a published record that clears the content threshold', () => {
    expect(contentIndexDecision(lesson())).toEqual({ index: true, reason: 'INDEXED' });
  });

  it('does not index a planned record — it has no page', () => {
    expect(contentIndexDecision(lesson({ status: 'PLANNED', readMinutes: null }))).toEqual({
      index: false,
      reason: 'CONTENT_NOT_PUBLISHED',
    });
  });

  it('does not index a published record the registry marks as thin', () => {
    expect(contentIndexDecision(lesson({ indexable: false }))).toEqual({
      index: false,
      reason: 'CONTENT_BELOW_THRESHOLD',
    });
  });

  it('never reads anything but `status` and `indexable`', () => {
    const noisy = lesson({ title: '다른 제목', level: 'INTERMEDIATE', readMinutes: 99 });
    expect(contentIndexDecision(noisy)).toEqual(contentIndexDecision(lesson()));
  });
});

describe('the filters', () => {
  it('keeps exactly the entries whose own decision is to index', () => {
    const routes = [
      route({ id: 'a', sitePath: '/a' }),
      route({ id: 'b', sitePath: '/b', available: false }),
      route({ id: 'c', sitePath: '/c', section: 'search' }),
    ];
    expect(indexableRoutes(routes).map((entry) => entry.id)).toEqual(['a']);

    const records: readonly AnyContentRecord[] = [
      lesson({ id: 'one', slug: 'one' }),
      lesson({ id: 'two', slug: 'two', status: 'PLANNED', readMinutes: null }),
      lesson({ id: 'three', slug: 'three', indexable: false }),
    ];
    expect(indexableContent(records).map((record) => record.id)).toEqual(['one']);
  });

  it('is consistent with the per-entry decision on the live registry', () => {
    const kept = new Set(indexableRoutes().map((entry) => entry.id));
    for (const entry of ROUTES) {
      expect(kept.has(entry.id)).toBe(routeIndexDecision(entry).index);
    }
  });
});
