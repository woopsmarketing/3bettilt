import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as GraphModule from '../../../content/graph.js';
import type { GlossaryRecord } from '../../../content/types.js';
import { glossaryRecords } from '../../../content/graph.js';
import {
  GLOSSARY_CATEGORIES,
  headwordOf,
  sortByHeadword,
} from '../../../content/registry/glossary/categories.js';
import GlossaryIndexPage from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * Same honesty gate `/learn`'s hub proves: every term visible, only the written ones
 * clickable.
 */

/**
 * A PLANNED glossary fixture this test owns outright. All 58 real terms have shipped, so
 * the registry alone no longer has an unwritten entry to prove the "준비 중, never a link"
 * branch with — the same ruling-26 trap fixed the same way in `graph.test.ts`,
 * `ToolCTA.test.tsx`, `app/tools/page.test.tsx` and `hub.test.ts`. This fixture stays
 * `PLANNED` forever because the test constructs it, so that branch keeps being exercised
 * for real regardless of how much of the glossary is published. It has no category and no
 * headword mapping on purpose: the hub must still list it (in the index, under its tab)
 * rather than fall over.
 */
const { PLANNED_TERM } = vi.hoisted(() => {
  const fixture: GlossaryRecord = {
    kind: 'glossary',
    id: 'term-fixture-unwritten',
    slug: 'fixture-unwritten',
    title: '테스트 픽스처 용어 (Fixture)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 용어 픽스처.',
    level: 'BASIC',
    topic: 'range',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PLANNED',
    indexable: false,
    readMinutes: null,
    term: 'Fixture',
    aliases: ['픽스처'],
    shortDefinition: '테스트에서만 쓰는 짧은 정의.',
  };
  return { PLANNED_TERM: fixture };
});

vi.mock('../../../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  return {
    ...actual,
    glossaryRecords: () => [...actual.glossaryRecords(), PLANNED_TERM],
  };
});

describe('/glossary index', () => {
  const entries = glossaryRecords();

  it('lists every term in the index by its headword, with its one-line definition', () => {
    render(<GlossaryIndexPage />);
    const index = screen.getByRole('region', { name: '전체 용어' });
    for (const entry of entries) {
      const row = index.querySelector(`[data-glossary-row][data-slug="${entry.slug}"]`);
      expect(row, entry.id).not.toBeNull();
      expect(row?.textContent, entry.id).toContain(headwordOf(entry));
      expect(row?.textContent, entry.id).toContain(entry.shortDefinition);
    }
    expect(index.querySelectorAll('[data-glossary-row]')).toHaveLength(entries.length);
  });

  it('links a written term and marks an unwritten one 준비 중 — in the index and the category map', () => {
    render(<GlossaryIndexPage />);
    const index = screen.getByRole('region', { name: '전체 용어' });
    for (const entry of entries) {
      const row = index.querySelector(`[data-glossary-row][data-slug="${entry.slug}"]`);
      if (row === null) throw new Error(`no row for ${entry.slug}`);
      const link = row.querySelector('a');
      if (entry.status === 'PUBLISHED') {
        expect(link, entry.id).toHaveAttribute('href', ko(`/glossary/${entry.slug}`));
        expect(link?.textContent, entry.id).toBe(headwordOf(entry));
        expect(within(row as HTMLElement).queryByText('준비 중')).toBeNull();
      } else {
        expect(link, entry.id).toBeNull();
        expect(within(row as HTMLElement).getByText('준비 중')).toBeInTheDocument();
      }
    }
    // The fixture has no category, so the category map neither links nor names it, and
    // never throws on it.
    const map = screen.getByRole('region', { name: '주제별로 보기' });
    expect(within(map).queryByText('픽스처')).toBeNull();
    expect(within(map).getAllByRole('link')).toHaveLength(
      entries.filter((e) => e.status === 'PUBLISHED').length,
    );
  });

  it('orders the index like a Korean dictionary: ㄱ ㄴ ㄷ tabs, headwords collated inside each', () => {
    render(<GlossaryIndexPage />);
    const index = screen.getByRole('region', { name: '전체 용어' });
    const rendered = Array.from(index.querySelectorAll('[data-glossary-row]')).map(
      (row) => row.getAttribute('data-slug') ?? '',
    );
    expect(rendered).toEqual(sortByHeadword(entries).map((entry) => entry.slug));
    // …and that really is a different order from the old title order, or this asserts nothing.
    const byTitle = [...entries]
      .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
      .map((e) => e.slug);
    expect(rendered).not.toEqual(byTitle);
    // The tab headings appear in ㄱ…ㅎ, A–Z order with the Latin group last.
    const tabs = Array.from(index.querySelectorAll('[data-glossary-group] h3')).map(
      (h) => h.textContent,
    );
    expect(tabs.at(-1)).toBe('A–Z');
    expect(tabs.indexOf('ㄱ')).toBeLessThan(tabs.indexOf('ㅎ'));
  });

  it('offers category, initial and popular navigation, all as same-page anchors', () => {
    render(<GlossaryIndexPage />);
    const byCategory = screen.getByRole('navigation', { name: '분류로 찾기' });
    const categoryLinks = within(byCategory).getAllByRole('link');
    expect(categoryLinks).toHaveLength(GLOSSARY_CATEGORIES.length);
    for (const link of categoryLinks) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('#cat-')).toBe(true);
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }
    const byInitial = screen.getByRole('navigation', { name: '첫 글자로 찾기' });
    for (const link of within(byInitial).getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(document.getElementById(href.slice(1)), href).not.toBeNull();
    }
    const popular = screen.getByRole('region', { name: '가장 많이 연결된 용어' });
    expect(within(popular).getAllByRole('link').length).toBeGreaterThan(0);
    expect(popular.textContent).toContain('검색량이 아닙니다');
  });

  it('has a search form that falls back to the site search, and exactly one h1', () => {
    render(<GlossaryIndexPage />);
    expect(screen.getByRole('search')).toHaveAttribute('action', ko('/search'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('publishes a DefinedTermSet of exactly the linked rows, named by headword', () => {
    const { container } = render(<GlossaryIndexPage />);
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const collection = scripts
      .map((script) => JSON.parse(script.textContent ?? '{}') as Record<string, unknown>)
      .find((block) => block['@type'] === 'CollectionPage');
    const set = collection?.['mainEntity'] as { hasDefinedTerm: readonly { name: string }[] };
    const published = entries.filter((e) => e.status === 'PUBLISHED');
    expect(set.hasDefinedTerm).toHaveLength(published.length);
    expect(set.hasDefinedTerm.map((t) => t.name).toSorted()).toEqual(
      published.map(headwordOf).toSorted(),
    );
  });
});
