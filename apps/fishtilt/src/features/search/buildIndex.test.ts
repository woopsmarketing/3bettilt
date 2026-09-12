import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { describe, expect, it } from 'vitest';
import type { RouteEntry } from '../../lib/routes.js';
import { findContent } from '../../content/graph.js';
import type {
  AnyContentRecord,
  GlossaryRecord,
  HandRecord,
  LearnRecord,
} from '../../content/types.js';
import { CONTENT_KINDS } from '../../content/types.js';
import { buildSearchIndex, SEARCH_INDEX } from './buildIndex.js';

/*
 * Every fixture here is constructed by this test, never read out of the real content
 * registry, route table, or `TOOL_DESCRIPTION` map (ruling 26) — `buildSearchIndex` is a
 * pure function of exactly the arguments it takes, so its inclusion/exclusion rules are
 * provable without depending on how much of the site has shipped.
 */

const PUBLISHED_LESSON: LearnRecord = {
  kind: 'learn',
  id: 'lesson-fixture-published',
  slug: 'fixture-published',
  title: '발행된 레슨',
  description: '이 레슨은 발행되었습니다.',
  level: 'INTRO',
  topic: 'rules',
  concepts: ['fixture'],
  prerequisites: [],
  relatedConcepts: [],
  relatedTools: [],
  relatedHands: [],
  nextLessons: [],
  relatedArticles: [],
  status: 'PUBLISHED',
  indexable: true,
  readMinutes: 2,
  order: 1,
};

const PLANNED_LESSON: LearnRecord = {
  ...PUBLISHED_LESSON,
  id: 'lesson-fixture-planned',
  slug: 'fixture-planned',
  title: '계획만 된 레슨',
  status: 'PLANNED',
  indexable: false,
  readMinutes: null,
  order: 2,
};

/** Published, but deliberately `indexable: false` — the exact case the module doc's
 *  `indexable` decision is about: real, linkable, just thin. */
const PUBLISHED_BUT_NOT_INDEXABLE: GlossaryRecord = {
  kind: 'glossary',
  id: 'term-fixture-thin',
  slug: 'fixture-thin',
  title: '얇은 용어',
  description: '아주 짧은 설명입니다.',
  level: 'BASIC',
  topic: 'range',
  concepts: [],
  prerequisites: [],
  relatedConcepts: [],
  relatedTools: [],
  relatedHands: [],
  nextLessons: [],
  relatedArticles: [],
  status: 'PUBLISHED',
  indexable: false,
  readMinutes: 2,
  term: 'Thin',
  aliases: ['씬텀'],
  shortDefinition: '짧은 정의.',
};

const PUBLISHED_HAND: HandRecord = {
  kind: 'hands',
  id: 'hand-fixture-aks',
  slug: 'fixture-aks',
  title: '픽스처 핸드 · AKs',
  description: '픽스처 핸드 설명.',
  level: 'INTRO',
  topic: 'starting-hands',
  concepts: [],
  prerequisites: [],
  relatedConcepts: [],
  relatedTools: [],
  relatedHands: [],
  nextLessons: [],
  relatedArticles: [],
  status: 'PUBLISHED',
  indexable: true,
  readMinutes: 2,
  handKey: 'AKs',
};

const CONTENT_FIXTURES: readonly AnyContentRecord[] = [
  PUBLISHED_LESSON,
  PLANNED_LESSON,
  PUBLISHED_BUT_NOT_INDEXABLE,
  PUBLISHED_HAND,
];

const AVAILABLE_TOOL: RouteEntry = {
  id: 'toolFixture',
  sitePath: '/tools/fixture',
  path: localePath(DEFAULT_LOCALE, '/tools/fixture'),
  label: '픽스처 도구',
  section: 'tools',
  available: true,
};

const PLANNED_TOOL: RouteEntry = {
  id: 'toolFixturePlanned',
  sitePath: '/tools/fixture-planned',
  path: localePath(DEFAULT_LOCALE, '/tools/fixture-planned'),
  label: '준비 중인 픽스처 도구',
  section: 'tools',
  available: false,
};

const TOOLS_HUB: RouteEntry = {
  id: 'tools',
  sitePath: '/tools',
  path: localePath(DEFAULT_LOCALE, '/tools'),
  label: '무료 도구',
  section: 'tools',
  available: true,
};

const OTHER_SECTION_ROUTE: RouteEntry = {
  id: 'home',
  sitePath: '/',
  path: localePath(DEFAULT_LOCALE, '/'),
  label: '홈',
  section: 'home',
  available: true,
};

const ROUTE_FIXTURES: readonly RouteEntry[] = [
  AVAILABLE_TOOL,
  PLANNED_TOOL,
  TOOLS_HUB,
  OTHER_SECTION_ROUTE,
];

/** Only `AVAILABLE_TOOL`'s id needs an entry: `PLANNED_TOOL` is dropped for `available:
 *  false` before a description is ever looked up, and the hub/other-section routes are
 *  dropped before that by section/id alone. */
const FIXTURE_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  toolFixture: '픽스처 도구에 대한 설명입니다.',
};

describe('buildSearchIndex — content inclusion', () => {
  it('includes a PUBLISHED record', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    expect(index.some((record) => record.id === 'lesson-fixture-published')).toBe(true);
  });

  it('never includes a PLANNED record', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    expect(index.some((record) => record.id === 'lesson-fixture-planned')).toBe(false);
  });

  it('includes a PUBLISHED record even when indexable is false — see buildIndex.ts module doc', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    expect(index.some((record) => record.id === 'term-fixture-thin')).toBe(true);
  });

  it('carries handKey through for a hands record', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    const hand = index.find((record) => record.id === 'hand-fixture-aks');
    expect(hand?.handKey).toBe('AKs');
  });

  it('carries term/aliases/shortDefinition through for a glossary record', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    const term = index.find((record) => record.id === 'term-fixture-thin');
    expect(term?.term).toBe('Thin');
    expect(term?.aliases).toEqual(['씬텀']);
    expect(term?.shortDefinition).toBe('짧은 정의.');
  });

  it('every included record carries a non-null href', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, []);
    for (const record of index) {
      expect(record.href, record.id).toEqual(expect.any(String));
      expect(record.href.length, record.id).toBeGreaterThan(0);
    }
  });
});

describe('buildSearchIndex — tool inclusion', () => {
  it('includes an available tool route', () => {
    const index = buildSearchIndex([], ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    expect(index.some((record) => record.id === 'tool:toolFixture')).toBe(true);
  });

  it('never includes an unavailable tool route', () => {
    const index = buildSearchIndex([], ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    expect(index.some((record) => record.id === 'tool:toolFixturePlanned')).toBe(false);
  });

  it('never includes the tools hub itself', () => {
    const index = buildSearchIndex([], ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    expect(index.some((record) => record.id === 'tool:tools')).toBe(false);
  });

  it('never includes a route outside the tools section', () => {
    const index = buildSearchIndex([], ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    expect(index.some((record) => record.id === 'tool:home')).toBe(false);
  });

  it('labels a tool with kind "tool"', () => {
    const index = buildSearchIndex([], ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    const tool = index.find((record) => record.id === 'tool:toolFixture');
    expect(tool?.kind).toBe('tool');
    expect(tool?.href).toBe(AVAILABLE_TOOL.path);
  });

  it('throws rather than silently indexing a tool with no description', () => {
    const undescribedTool: RouteEntry = {
      id: 'toolFixtureNoDescription',
      sitePath: '/tools/no-description',
      path: localePath(DEFAULT_LOCALE, '/tools/no-description'),
      label: '설명 없는 도구',
      section: 'tools',
      available: true,
    };
    expect(() => buildSearchIndex([], [undescribedTool])).toThrow();
  });
});

describe('buildSearchIndex — combined', () => {
  it('concatenates content and tool results', () => {
    const index = buildSearchIndex(CONTENT_FIXTURES, ROUTE_FIXTURES, FIXTURE_TOOL_DESCRIPTIONS);
    const ids = new Set(index.map((record) => record.id));
    expect(ids.has('lesson-fixture-published')).toBe(true);
    expect(ids.has('tool:toolFixture')).toBe(true);
  });
});

/*
 * `SEARCH_INDEX` is built from the REAL content registry and route table, which other
 * agents are actively publishing to as this WP is written (ruling 26). So unlike every
 * `describe` above, nothing here may assert a count, a specific id, or "record X is/isn't in
 * the index" — only properties that stay true no matter what has shipped by the time this
 * runs.
 */
describe('SEARCH_INDEX — invariants against the real registry', () => {
  it('is non-empty', () => {
    expect(SEARCH_INDEX.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty href', () => {
    for (const record of SEARCH_INDEX) {
      expect(record.href, record.id).toEqual(expect.any(String));
      expect(record.href.length, record.id).toBeGreaterThan(0);
    }
  });

  it('every entry has a title and a description', () => {
    for (const record of SEARCH_INDEX) {
      expect(record.title.length, record.id).toBeGreaterThan(0);
      expect(record.description.length, record.id).toBeGreaterThan(0);
    }
  });

  it('every entry is one of the known kinds', () => {
    const knownKinds = new Set([...CONTENT_KINDS, 'tool']);
    for (const record of SEARCH_INDEX) {
      expect(knownKinds.has(record.kind), record.id).toBe(true);
    }
  });

  it('never contains a PLANNED record — every content id traces back to a PUBLISHED source', () => {
    for (const record of SEARCH_INDEX) {
      if (record.kind === 'tool') continue; // tools have no PUBLISHED content record to trace back to
      const source = findContent(record.id);
      expect(source, record.id).toBeDefined();
      expect(source?.status, record.id).toBe('PUBLISHED');
    }
  });
});
