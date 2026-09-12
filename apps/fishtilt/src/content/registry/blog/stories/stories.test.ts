/**
 * @vitest-environment node
 *
 * The hand-story registry gate. Every record in `HAND_STORY_RECORDS` (batches S1-S3) goes
 * through `stories/validate.ts`, and every PUBLISHED one has its MDX checked against the
 * record's streets (`stories/mdx.ts`). Runs on an empty registry too — the invariants
 * below hold vacuously, and the fixture story proves the machinery is live.
 *
 * The other direction is checked as well: a blog record of `contentType: 'hand-story'` that
 * is NOT in the stories barrel (or carries no hand) is refused, and a hand on any other
 * type is refused — the story template narrows on both halves (`isHandStory`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLOG_RECORDS } from '../index.js';
import { HAND_STORY_RECORDS } from './index.js';
import { ALL_CONTENT } from '../../index.js';
import { validateStory } from '../../../stories/validate.js';
import { storyMdxIssues } from '../../../stories/mdx.js';
import { FIXTURE_STORY, FIXTURE_STORY_SLUG } from '../../../stories/testing/fixtureStory.js';
import { sitemapPaths } from '../../../../lib/seo/sitemapEntries.js';
import { isHandStory, publishedStories } from '../../../graph.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../../content/blog/', import.meta.url));

describe('hand-story registry (S1-S3)', () => {
  it('every story record passes the validator', () => {
    const failures = HAND_STORY_RECORDS.flatMap((record) => validateStory(record).issues);
    expect(failures).toEqual([]);
  });

  it('every story is a blog record of contentType hand-story, and every hand-story blog record is a story', () => {
    const storyIds = new Set(HAND_STORY_RECORDS.map((record) => record.id));
    for (const record of HAND_STORY_RECORDS) {
      expect(record.contentType, record.id).toBe('hand-story');
      expect(BLOG_RECORDS.includes(record), `${record.id} must reach BLOG_RECORDS`).toBe(true);
    }
    for (const record of BLOG_RECORDS) {
      if (record.contentType === 'hand-story') {
        expect(
          storyIds.has(record.id),
          `${record.id} is typed hand-story but is not in stories/`,
        ).toBe(true);
        expect(record.hand, `${record.id} has no hand`).toBeDefined();
      } else {
        expect(record.hand, `${record.id} carries a hand but is not a hand-story`).toBeUndefined();
      }
    }
  });

  it('every PUBLISHED story has MDX on disk in the shape the template binds to', () => {
    const problems: string[] = [];
    for (const record of HAND_STORY_RECORDS) {
      if (record.status !== 'PUBLISHED') continue;
      const path = `${CONTENT_DIR}${record.slug}.mdx`;
      if (!existsSync(path)) {
        problems.push(`${record.id}: no MDX at content/blog/${record.slug}.mdx`);
        continue;
      }
      for (const issue of storyMdxIssues(readFileSync(path, 'utf8'), record.hand)) {
        problems.push(`${record.id}: ${issue}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('a story never links to itself or to an unpublished story as a related article', () => {
    const byId = new Map(ALL_CONTENT.map((record) => [record.id, record]));
    for (const record of HAND_STORY_RECORDS) {
      for (const id of record.relatedArticles) {
        expect(id, record.id).not.toBe(record.id);
        expect(byId.get(id)?.kind, `${record.id} -> ${id}`).toBe('blog');
      }
    }
  });

  it('publishedStories() is exactly the PUBLISHED subset', () => {
    expect(publishedStories().map((record) => record.id)).toEqual(
      HAND_STORY_RECORDS.filter((record) => record.status === 'PUBLISHED').map(
        (record) => record.id,
      ),
    );
  });
});

describe('the test fixture story', () => {
  it('is a valid story the validator accepts, and isHandStory narrows it', () => {
    expect(validateStory(FIXTURE_STORY).issues).toEqual([]);
    expect(isHandStory(FIXTURE_STORY)).toBe(true);
  });

  it('is NOT registered, routed, on disk, or in the sitemap', () => {
    expect(ALL_CONTENT.some((record) => record.id === FIXTURE_STORY.id)).toBe(false);
    expect(ALL_CONTENT.some((record) => record.slug === FIXTURE_STORY_SLUG)).toBe(false);
    expect(existsSync(`${CONTENT_DIR}${FIXTURE_STORY_SLUG}.mdx`)).toBe(false);
    expect(sitemapPaths().some((path) => path.includes(FIXTURE_STORY_SLUG))).toBe(false);
  });
});
