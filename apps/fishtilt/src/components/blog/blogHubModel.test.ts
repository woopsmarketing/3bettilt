/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { blogRecords } from '../../content/graph.js';
import { BLOG_CONTENT_TYPES, type BlogRecord } from '../../content/types.js';
import { FIXTURE_STORY } from '../../content/stories/testing/fixtureStory.js';
import { buildBlogHub, HUB_SECTION_ORDER, hubListedItems, hubMeta } from './blogHubModel.js';

describe('buildBlogHub', () => {
  const real = blogRecords();
  const hub = buildBlogHub(real);

  it('accounts for every article exactly once across the sections and the index', () => {
    const inSections = hub.sections.flatMap((section) => section.articles);
    expect(inSections).toHaveLength(real.length);
    expect(new Set(inSections.map((article) => article.id)).size).toBe(real.length);
    expect(hub.index).toEqual(inSections);
    expect(hub.total).toBe(real.length);
  });

  it('keeps the hub’s editorial type order and names empty types as coming soon', () => {
    const order = hub.sections.map((section) => section.type);
    const expected = HUB_SECTION_ORDER.filter((type) => real.some((a) => a.contentType === type));
    expect(order).toEqual(expected);
    expect(hub.comingSoon).toEqual(HUB_SECTION_ORDER.filter((type) => !expected.includes(type)));
    expect(hub.nav.map((entry) => entry.type)).toEqual([...HUB_SECTION_ORDER]);
    // The hub order is a permutation of the declared types — nothing dropped, nothing added.
    expect([...HUB_SECTION_ORDER].sort()).toEqual([...BLOG_CONTENT_TYPES].sort());
    for (const entry of hub.nav) {
      expect(entry.href === null, entry.type).toBe(entry.count === 0);
    }
  });

  it('features a search guide when no story is published, and a story when one is', () => {
    expect(hub.storyCount).toBe(
      real.filter((a) => a.contentType === 'hand-story' && a.status === 'PUBLISHED').length,
    );
    // Both states, independent of how many stories the registry holds today: the featured slot is
    // the first published story when there is one, and a search guide when there is none.
    const noStories = buildBlogHub(real.filter((a) => a.contentType !== 'hand-story'));
    expect(noStories.storyCount).toBe(0);
    expect(noStories.featured?.contentType).toBe('search-guide');
    expect(noStories.comingSoon).toContain('hand-story');
    const onlyFixtureStory = buildBlogHub([
      ...real.filter((a) => a.contentType !== 'hand-story'),
      FIXTURE_STORY,
    ]);
    expect(onlyFixtureStory.featured?.id).toBe(FIXTURE_STORY.id);
    expect(onlyFixtureStory.sections.some((section) => section.type === 'hand-story')).toBe(true);
    expect(onlyFixtureStory.comingSoon).not.toContain('hand-story');
  });

  it('fills the secondary list with published articles of other types, never the featured one', () => {
    expect(hub.secondary.length).toBeGreaterThan(0);
    expect(hub.secondary.length).toBeLessThanOrEqual(3);
    for (const article of hub.secondary) {
      expect(article.status).toBe('PUBLISHED');
      expect(article.id).not.toBe(hub.featured?.id);
    }
    expect(new Set(hub.secondary.map((a) => a.id)).size).toBe(hub.secondary.length);
  });

  it('lists every published article once in the ItemList, in first-render order', () => {
    const items = hubListedItems(hub);
    const names = items.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(
      hub.index
        .filter((a) => a.status === 'PUBLISHED')
        .map((a) => a.title)
        .sort(),
    );
    // Featured first, then the 이어서 읽기 rail — the order the page renders them in.
    expect(names.slice(0, 1 + hub.secondary.length)).toEqual(
      [hub.featured, ...hub.secondary].map((a) => a?.title),
    );
    for (const item of items) expect(item.path).toMatch(/^\/blog\/[^/]+$/u);
  });

  it('degrades to nothing featured on an empty registry rather than inventing', () => {
    const empty = buildBlogHub([]);
    expect(empty.featured).toBeNull();
    expect(empty.sections).toEqual([]);
    expect(empty.comingSoon).toEqual([...HUB_SECTION_ORDER]);
    expect(hubListedItems(empty)).toEqual([]);
  });

  it('formats the row meta from the record', () => {
    const article = real[0] as BlogRecord;
    expect(hubMeta(article)).toContain(`약 ${article.readMinutes}분`);
    expect(hubMeta(article, { type: false })).not.toContain('가이드');
  });
});
