import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LEARN_ROADMAP } from '../../../content/graph.js';
import {
  LEARN_CATEGORIES,
  LEARN_HUB_ANCHORS,
  LEARN_STAGES,
  lessonsOfCategory,
} from '../../../content/registry/learn/categories.js';
import { DEFAULT_LOCALE, localePath } from '../../../lib/locale.js';
import LearnHubPage from './page.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

// Titles can contain regex-special characters (e.g. "자리(포지션)가 왜 그렇게 중요할까요?"), so
// build the matcher from an escaped pattern rather than a raw string — the same guard
// `/blog`, `/glossary` and `/hands`' index tests already apply for the same reason.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/*
 * The hub's job is to be the whole curriculum, honestly, twice over: every lesson in the
 * ordered roadmap (mode A) and every lesson under exactly one category (mode B), only the
 * written ones clickable. The "written as a plan → 준비 중, never a link" branch is proved
 * against fixtures in `LearnRoadmap.test.tsx` / `LearnTopics.test.tsx` (ruling 26); this file
 * checks the page assembles the REAL registry into both modes without losing or duplicating
 * a lesson.
 */
function roadmapRegion(): HTMLElement {
  return screen.getByRole('region', { name: '학습 순서' });
}
function topicsRegion(): HTMLElement {
  return screen.getByRole('region', { name: '주제별로 배우기' });
}

describe('/learn hub', () => {
  it('has exactly one h1', () => {
    render(<LearnHubPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('offers both modes as same-page anchors whose targets exist', () => {
    const { container } = render(<LearnHubPage />);
    const nav = screen.getByRole('navigation', { name: '배우는 방법' });
    expect(within(nav).getByRole('link', { name: /처음부터 배우기/u })).toHaveAttribute(
      'href',
      `#${LEARN_HUB_ANCHORS.roadmap}`,
    );
    expect(within(nav).getByRole('link', { name: /특정 주제 배우기/u })).toHaveAttribute(
      'href',
      `#${LEARN_HUB_ANCHORS.topics}`,
    );
    expect(container.querySelector(`#${LEARN_HUB_ANCHORS.roadmap}`)).toBe(roadmapRegion());
    expect(container.querySelector(`#${LEARN_HUB_ANCHORS.topics}`)).toBe(topicsRegion());
  });

  it('roadmap: lists every lesson once, numbered in curriculum order, grouped into the stages', () => {
    render(<LearnHubPage />);
    const region = roadmapRegion();
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(LEARN_ROADMAP.length);
    expect(items.map((li) => li.dataset['order'])).toEqual(
      LEARN_ROADMAP.map((lesson) => String(lesson.order)),
    );
    for (const lesson of LEARN_ROADMAP) {
      expect(within(region).getByText(lesson.title), lesson.id).toBeInTheDocument();
    }
    for (const stage of LEARN_STAGES) {
      expect(within(region).getByRole('region', { name: stage.label })).toBeInTheDocument();
    }
  });

  it('roadmap: links a written lesson to its page and never links an unwritten one', () => {
    render(<LearnHubPage />);
    const region = roadmapRegion();
    for (const lesson of LEARN_ROADMAP) {
      const link = within(region).queryByRole('link', {
        name: new RegExp(escapeRegExp(lesson.title), 'u'),
      });
      if (lesson.status === 'PUBLISHED') {
        expect(link, lesson.id).toHaveAttribute('href', ko(`/learn/${lesson.slug}`));
      } else {
        expect(link, lesson.id).toBeNull();
      }
    }
    const planned = LEARN_ROADMAP.filter((lesson) => lesson.status === 'PLANNED').length;
    expect(within(region).queryAllByText('준비 중')).toHaveLength(planned);
  });

  it('says how much of the course is readable rather than implying all of it is', () => {
    render(<LearnHubPage />);
    const published = LEARN_ROADMAP.filter((lesson) => lesson.status === 'PUBLISHED').length;
    expect(
      screen.getByText(
        new RegExp(`^전체 ${LEARN_ROADMAP.length}편 중 ${published}편을 읽을 수 있습니다\\.`, 'u'),
      ),
    ).toBeInTheDocument();
  });

  it('topics: one section per category, each lesson under exactly one, in curriculum order', () => {
    render(<LearnHubPage />);
    const region = topicsRegion();
    const sections = LEARN_CATEGORIES.map((category) => {
      const section = within(region).getByRole('region', { name: category.label });
      expect(section.id, category.id).toBe(LEARN_HUB_ANCHORS.category(category.id));
      return section;
    });
    // Every lesson appears exactly once across the category sections…
    const seen = sections.flatMap((section) =>
      [...section.querySelectorAll('li[data-order]')].map(
        (li) => (li as HTMLElement).dataset['order'],
      ),
    );
    expect([...seen].toSorted((a, b) => Number(a) - Number(b))).toEqual(
      LEARN_ROADMAP.map((lesson) => String(lesson.order)),
    );
    // …and each section lists its category's lessons in curriculum order, by the mapping.
    for (const [index, category] of LEARN_CATEGORIES.entries()) {
      const section = sections[index] as HTMLElement;
      const orders = [...section.querySelectorAll('li[data-order]')].map((li) =>
        Number((li as HTMLElement).dataset['order']),
      );
      expect(orders, category.id).toEqual(lessonsOfCategory(category.id).map((l) => l.order));
    }
  });

  it('topics: the chip row jumps to each category section, and links only written lessons', () => {
    render(<LearnHubPage />);
    const region = topicsRegion();
    const chips = within(
      within(region).getByRole('navigation', { name: '주제 고르기' }),
    ).getAllByRole('link');
    expect(chips.map((a) => a.getAttribute('href'))).toEqual(
      LEARN_CATEGORIES.map((category) => `#${LEARN_HUB_ANCHORS.category(category.id)}`),
    );
    for (const lesson of LEARN_ROADMAP) {
      const links = within(region).queryAllByRole('link', {
        name: new RegExp(escapeRegExp(lesson.title), 'u'),
      });
      expect(links, lesson.id).toHaveLength(lesson.status === 'PUBLISHED' ? 1 : 0);
    }
  });

  it('emits an ItemList of exactly the lessons the page links, in roadmap order', () => {
    const { container } = render(<LearnHubPage />);
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    const blocks = scripts.flatMap((script) => {
      const parsed: unknown = JSON.parse(script.textContent ?? 'null');
      return Array.isArray(parsed) ? parsed : [parsed];
    }) as { '@type'?: string; mainEntity?: { itemListElement?: { name: string }[] } }[];
    const collection = blocks.find((block) => block['@type'] === 'CollectionPage');
    expect(collection).toBeDefined();
    const names = collection?.mainEntity?.itemListElement?.map((item) => item.name) ?? [];
    expect(names).toEqual(
      LEARN_ROADMAP.filter((lesson) => lesson.status === 'PUBLISHED').map((lesson) => lesson.title),
    );
  });
});
