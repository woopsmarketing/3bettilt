/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default: this file touches the filesystem. Same idiom
 * as `src/content/content.test.ts`.
 */
/**
 * The FAQ reader's two failure modes, both of which are silent by design and would
 * therefore never be noticed without a test: an unresolvable content root, and a slug that
 * is not a slug.
 *
 * What this file deliberately does NOT assert is which pages have a FAQ. That is a fact
 * about the content, it changes every time an author edits a heading, and `faq.test.ts`
 * already proves the parsing rules against constructed fixtures (ruling 26).
 */
import { describe, expect, it } from 'vitest';
import { ALL_CONTENT } from '../../content/registry/index.js';
import { MIN_FAQ_ITEMS } from './faq.js';
import { readFaqItems, resolveContentRoot } from './faqSource.js';

describe('resolveContentRoot', () => {
  it('finds the content directory from the working directory the build uses', () => {
    expect(resolveContentRoot()).not.toBeNull();
  });

  it('returns null rather than a guess when there is no content directory below the cwd', () => {
    expect(resolveContentRoot('/nonexistent-root-for-this-test')).toBeNull();
  });
});

describe('readFaqItems', () => {
  it('refuses a slug that is not a registry slug, so a path can never be traversed', () => {
    expect(readFaqItems('learn', '../../../etc/passwd')).toEqual([]);
    expect(readFaqItems('learn', 'Not-A-Slug')).toEqual([]);
    expect(readFaqItems('learn', '')).toEqual([]);
  });

  it('returns nothing for a slug with no file, rather than throwing mid-render', () => {
    expect(readFaqItems('learn', 'no-such-lesson-exists-here')).toEqual([]);
  });
});

/*
 * WP-7a: THE PROPERTY THAT HAS TO SURVIVE WP-7b.
 *
 * WP-7b writes FAQ paragraphs into learn lessons. Nothing in the SEO layer is edited when it
 * does — the extractor re-reads the MDX on every build — so what is asserted here is that the
 * pipeline is a FUNCTION OF THE FILES, quantified over whatever the registry holds, with no
 * count and no slug named. It passes today with zero learn FAQs and must pass unchanged when
 * there are nine.
 */
describe('the live MDX, whatever it currently says', () => {
  const published = ALL_CONTENT.filter((record) => record.status === 'PUBLISHED');

  it('has content to read at all, or the assertions below are vacuous', () => {
    expect(published.length).toBeGreaterThan(0);
    expect(resolveContentRoot()).not.toBeNull();
  });

  it('never yields a FAQ list below the site`s own minimum — it yields none instead', () => {
    for (const record of published) {
      const items = readFaqItems(record.kind, record.slug);
      expect(
        items.length === 0 || items.length >= MIN_FAQ_ITEMS,
        `${record.kind}/${record.slug} yielded ${String(items.length)} item(s)`,
      ).toBe(true);
    }
  });

  it('publishes only questions and answers that are literally in that page`s own file', () => {
    for (const record of published) {
      const items = readFaqItems(record.kind, record.slug);
      for (const item of items) {
        expect(item.question.length, `${record.slug}: empty question`).toBeGreaterThan(0);
        expect(item.answer.length, `${record.slug}: empty answer`).toBeGreaterThan(0);
        // Nothing that reached the markup may still be a component call: the rendered text of
        // one is computed at build time and is not the source text (`faq.ts`'s module doc).
        expect(item.question, `${record.slug}: ${item.question}`).not.toMatch(
          /<\/?[A-Za-z][A-Za-z0-9]*[\s/>]/u,
        );
        expect(item.answer, `${record.slug}: ${item.question}`).not.toMatch(
          /<\/?[A-Za-z][A-Za-z0-9]*[\s/>]/u,
        );
      }
    }
  });

  it('reads each page from its OWN file — no two pages share a question list', () => {
    const owners = new Map<string, string>();
    for (const record of published) {
      for (const item of readFaqItems(record.kind, record.slug)) {
        const key = `${item.question}\u0000${item.answer}`;
        const previous = owners.get(key);
        expect(
          previous,
          `${record.kind}/${record.slug} publishes the same Q&A as ${String(previous)}`,
        ).toBeUndefined();
        owners.set(key, `${record.kind}/${record.slug}`);
      }
    }
  });
});
