/**
 * The breadcrumb trail. Fixtures again, per ruling 26 — the trail's shape is a property of
 * the KIND of page, not of which pages happen to be published this week.
 */
import { describe, expect, it } from 'vitest';
import type { AnyContentRecord, ContentKind } from '../../content/types.js';
import { ROUTES, routeById } from '../routes.js';
import { contentBreadcrumbs, routeBreadcrumbs } from './breadcrumbs.js';
import { DEFAULT_LOCALE, localePath } from '../locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

function record(kind: ContentKind, over: Record<string, unknown> = {}): AnyContentRecord {
  const base = {
    id: `fixture-${kind}`,
    slug: 'fixture-slug',
    title: '픽스처 제목',
    description: '픽스처 설명입니다.',
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
  };
  const extra =
    kind === 'learn'
      ? { order: 1 }
      : kind === 'glossary'
        ? { term: 'Range', aliases: [], shortDefinition: '한 줄 정의' }
        : kind === 'hands'
          ? { handKey: 'AKs' }
          : {};
  return { ...base, ...extra, kind, ...over } as AnyContentRecord;
}

describe('contentBreadcrumbs', () => {
  it('is 홈 › hub › page for every content kind, using the registry`s own hub labels', () => {
    const cases: readonly [ContentKind, string, string][] = [
      ['learn', 'learn', ko('/learn/fixture-slug')],
      ['blog', 'blog', ko('/blog/fixture-slug')],
      ['glossary', 'glossary', ko('/glossary/fixture-slug')],
      ['hands', 'hands', ko('/hands/fixture-slug')],
    ];
    for (const [kind, hubId, path] of cases) {
      const trail = contentBreadcrumbs(record(kind));
      expect(trail).toEqual([
        { label: routeById('home').label, path: ko('/'), current: false },
        { label: routeById(hubId).label, path: routeById(hubId).path, current: false },
        { label: '픽스처 제목', path, current: true },
      ]);
    }
  });

  it('marks only the last crumb as current', () => {
    const trail = contentBreadcrumbs(record('learn'));
    expect(trail.filter((crumb) => crumb.current)).toHaveLength(1);
    expect(trail.at(-1)?.current).toBe(true);
  });

  it('names the page by its own title, not by its slug', () => {
    const trail = contentBreadcrumbs(record('blog', { title: '보드 그대로 쓰기' }));
    expect(trail.at(-1)?.label).toBe('보드 그대로 쓰기');
  });

  it('gives every crumb a root-relative path with no query string', () => {
    for (const crumb of contentBreadcrumbs(record('hands'))) {
      expect(crumb.path.startsWith('/')).toBe(true);
      expect(crumb.path).not.toContain('?');
    }
  });
});

/*
 * `routeBreadcrumbs` is quantified over the WHOLE route registry rather than spot-checked on
 * the routes that exist today (ruling 26): a route added or renamed tomorrow must satisfy
 * these properties without anyone remembering to add a case here. Only the two SHAPES —
 * "under a hub" and "directly under home" — are pinned with a named example, because those
 * are what the function decides.
 */
describe('routeBreadcrumbs', () => {
  it('gives the home page an empty trail rather than a crumb pointing at itself', () => {
    expect(routeBreadcrumbs('home')).toEqual([]);
  });

  it('is 홈 › hub › page for a route that sits under a hub', () => {
    expect(routeBreadcrumbs('toolEquity')).toEqual([
      { label: routeById('home').label, path: ko('/'), current: false },
      { label: routeById('tools').label, path: ko('/tools'), current: false },
      { label: routeById('toolEquity').label, path: ko('/tools/equity'), current: true },
    ]);
    expect(routeBreadcrumbs('practiceRange')).toEqual([
      { label: routeById('home').label, path: ko('/'), current: false },
      { label: routeById('practice').label, path: ko('/practice'), current: false },
      { label: routeById('practiceRange').label, path: ko('/practice/range-quiz'), current: true },
    ]);
  });

  it('does not put a hub under itself', () => {
    for (const hubId of ['learn', 'blog', 'glossary', 'hands', 'tools', 'practice']) {
      const trail = routeBreadcrumbs(hubId);
      expect(trail, hubId).toHaveLength(2);
      expect(trail.at(-1)?.path, hubId).toBe(routeById(hubId).path);
    }
  });

  it('puts a global page directly under home — /about and /search have no index above them', () => {
    for (const id of ['about', 'search']) {
      expect(routeBreadcrumbs(id), id).toEqual([
        { label: routeById('home').label, path: ko('/'), current: false },
        { label: routeById(id).label, path: routeById(id).path, current: true },
      ]);
    }
  });

  it('starts at home, ends at the route, and marks exactly one crumb current', () => {
    for (const route of ROUTES) {
      const trail = routeBreadcrumbs(route.id);
      if (route.id === 'home') continue; // home's own trail has no separate home crumb before it
      expect(trail.at(0), route.id).toEqual({
        label: routeById('home').label,
        path: ko('/'),
        current: false,
      });
      expect(trail.at(-1)?.path, route.id).toBe(route.path);
      expect(
        trail.filter((crumb) => crumb.current),
        route.id,
      ).toHaveLength(1);
    }
  });

  it('takes every label from the route registry, so a crumb cannot rename a page', () => {
    const labels = new Set(ROUTES.map((route) => route.label));
    for (const route of ROUTES) {
      for (const crumb of routeBreadcrumbs(route.id)) {
        expect(labels.has(crumb.label), `${route.id}: ${crumb.label}`).toBe(true);
      }
    }
  });

  it('gives every crumb a root-relative path with no query string', () => {
    for (const route of ROUTES) {
      for (const crumb of routeBreadcrumbs(route.id)) {
        expect(crumb.path.startsWith('/'), route.id).toBe(true);
        expect(crumb.path, route.id).not.toContain('?');
      }
    }
  });

  it('never links a hub the registry says is not built', () => {
    for (const route of ROUTES) {
      for (const crumb of routeBreadcrumbs(route.id)) {
        const target = ROUTES.find((entry) => entry.path === crumb.path);
        expect(target?.available, `${route.id} -> ${crumb.path}`).toBe(true);
      }
    }
  });
});
