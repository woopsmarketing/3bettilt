import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as GraphModule from '../../../content/graph.js';
import type { BlogRecord } from '../../../content/types.js';
import { BLOG_CONTENT_TYPE_LABEL, blogRecords } from '../../../content/graph.js';
import { BLOG_CONTENT_TYPES } from '../../../content/types.js';
import { buildBlogHub } from '../../../components/blog/blogHubModel.js';
import BlogIndexPage from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/**
 * A PLANNED blog fixture this test owns outright (all 20 real articles are published, so
 * the registry alone cannot prove the "준비 중, never a link" branch). It is typed as a
 * search guide so it lands in a section that exists.
 */
const { PLANNED_ARTICLE } = vi.hoisted(() => {
  const fixture: BlogRecord = {
    kind: 'blog',
    id: 'blog-fixture-unwritten',
    slug: 'fixture-unwritten',
    title: '테스트 픽스처 글 (Fixture)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 글 픽스처.',
    level: 'BASIC',
    topic: 'range',
    contentType: 'search-guide',
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
  };
  return { PLANNED_ARTICLE: fixture };
});

vi.mock('../../../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  return {
    ...actual,
    blogRecords: () => [...actual.blogRecords(), PLANNED_ARTICLE],
  };
});

describe('/blog hub', () => {
  const articles = blogRecords();
  const hub = buildBlogHub(articles);

  it('lists every article in the 전체 글 index, and links only the written ones', () => {
    render(<BlogIndexPage />);
    const index = screen.getByRole('region', { name: '전체 글' });
    const rows = index.querySelectorAll('li');
    expect(rows).toHaveLength(articles.length);
    for (const row of rows) {
      const links = row.querySelectorAll('a').length;
      const badges = [...row.querySelectorAll('span')].filter(
        (node) => node.textContent === '준비 중',
      ).length;
      expect(links + badges, row.textContent ?? '').toBe(1);
    }
    for (const article of articles) {
      const link = index.querySelector(`a[href="${ko(`/blog/${article.slug}`)}"]`);
      if (article.status === 'PUBLISHED') expect(link, article.id).not.toBeNull();
      else expect(link, article.id).toBeNull();
    }
    expect(index.textContent).toContain(
      `전체 ${articles.length}편 중 ${articles.filter((a) => a.status === 'PUBLISHED').length}편을 읽을 수 있습니다.`,
    );
  });

  it('has exactly one h1', () => {
    render(<BlogIndexPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('offers an anchor per content type that has articles, and 준비 중 for the rest — never a link to nothing', () => {
    const { container } = render(<BlogIndexPage />);
    const nav = screen.getByRole('navigation', { name: '콘텐츠 타입' });
    for (const type of BLOG_CONTENT_TYPES) {
      const entry = nav.querySelector(`[data-type="${type}"]`);
      expect(entry, type).not.toBeNull();
      expect(entry?.textContent).toContain(BLOG_CONTENT_TYPE_LABEL[type]);
      const count = articles.filter((article) => article.contentType === type).length;
      const anchor = entry?.querySelector('a');
      if (count > 0) {
        const href = anchor?.getAttribute('href') ?? '';
        expect(href.startsWith('#'), type).toBe(true);
        expect(
          container.querySelector(`[id="${href.slice(1)}"]`),
          `${type}: anchor target`,
        ).not.toBeNull();
      } else {
        expect(anchor, type).toBeNull();
        expect(entry?.textContent).toContain('준비 중');
      }
    }
  });

  it('renders one section per content type with articles, in declared order, each holding only its own type', () => {
    const { container } = render(<BlogIndexPage />);
    const sections = [...container.querySelectorAll('[data-section]')];
    expect(sections.map((node) => node.getAttribute('data-section'))).toEqual(
      hub.sections.map((section) => section.type),
    );
    for (const node of sections) {
      const type = node.getAttribute('data-section');
      const expected = articles.filter((article) => article.contentType === type);
      expect(node.querySelectorAll('li'), type ?? '').toHaveLength(expected.length);
      for (const article of expected) {
        expect(node.textContent, `${type} holds ${article.id}`).toContain(article.title);
      }
    }
  });

  it('varies the section layouts rather than repeating one card grid', () => {
    expect(new Set(hub.sections.map((section) => section.layout)).size).toBeGreaterThan(1);
    const { container } = render(<BlogIndexPage />);
    // No card surfaces in the sections at all — rows, strips and typographic lists.
    for (const node of container.querySelectorAll('[data-section] li')) {
      expect(node.className).not.toContain('bg-panel-700');
    }
  });

  it('features a real published article — a story when one exists, else a search guide — and never invents a story', () => {
    const { container } = render(<BlogIndexPage />);
    const featured = container.querySelector('[data-featured]');
    expect(featured).not.toBeNull();
    const id = featured?.getAttribute('data-featured');
    const record = articles.find((article) => article.id === id);
    expect(record?.status).toBe('PUBLISHED');
    const stories = articles.filter(
      (a) => a.contentType === 'hand-story' && a.status === 'PUBLISHED',
    );
    if (stories.length === 0) {
      expect(record?.contentType).toBe('search-guide');
      expect(container.querySelector('[data-section="hand-story"]')).toBeNull();
      expect(screen.getByRole('region', { name: '준비 중인 시리즈' }).textContent).toContain(
        '핸드 스토리',
      );
    } else {
      expect(record?.contentType).toBe('hand-story');
    }
    // The secondary list beside it never repeats the featured article.
    expect(hub.secondary.some((article) => article.id === id)).toBe(false);
    expect(hub.secondary.length).toBeGreaterThan(0);
  });

  it('shows every content type label somewhere on the page', () => {
    const { container } = render(<BlogIndexPage />);
    for (const type of BLOG_CONTENT_TYPES) {
      expect(container.textContent, type).toContain(BLOG_CONTENT_TYPE_LABEL[type]);
    }
  });

  it('claims no ordering this site cannot support', () => {
    const { container } = render(<BlogIndexPage />);
    const text = container.textContent ?? '';
    for (const claim of ['최신순', '인기순', '인기 글', '많이 읽은', '새 글', '신규', '트렌딩']) {
      expect(text, claim).not.toContain(claim);
    }
    expect(text).toContain('순서는 순위가 아닙니다');
  });

  it('draws no image files', () => {
    const { container } = render(<BlogIndexPage />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('url(');
  });
});
