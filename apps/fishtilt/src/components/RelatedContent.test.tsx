import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as RegistryModule from '../content/registry/index.js';
import { RELATION_HEADING, contentById, relationsOf } from '../content/graph.js';
import type { AnyContentRecord, LearnRecord } from '../content/types.js';
import { GUIDES_LABEL, STORIES_LABEL } from './hands/HandOnward.js';
import { RELATED_LABELS, RelatedContent } from './RelatedContent.js';

const LESSON = contentById('poker-range');

/**
 * A PLANNED lesson fixture this test owns outright. `relationsOf` resolves a relation's ids
 * through `graph.ts`'s own internal `contentById`, which is built from `ALL_CONTENT` — so
 * proving "never links an unwritten piece" needs a still-unwritten record actually IN the
 * registry, not just a status flipped on a prop. Every lesson `poker-range` could plausibly
 * point at as "next" will eventually publish, and this test used to lean on whichever one
 * hadn't yet — the same trap ruling 26 names and `toolHref`'s test already fixed one module
 * over, so the fixture is injected here the same way: one level below `graph.js`, into the
 * registry it reads from.
 */
const { PLANNED_NEXT_LESSON } = vi.hoisted(() => {
  const fixture: LearnRecord = {
    kind: 'learn',
    id: 'learn-fixture-unwritten',
    slug: 'fixture-unwritten',
    order: 9999,
    title: '테스트 픽스처 레슨 (Fixture)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 레슨 픽스처.',
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
  };
  return { PLANNED_NEXT_LESSON: fixture };
});

vi.mock('../content/registry/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RegistryModule>();
  return {
    ...actual,
    ALL_CONTENT: [...actual.ALL_CONTENT, PLANNED_NEXT_LESSON],
  };
});

describe('RelatedContent', () => {
  it('heads each relation with its own contextual sentence, never "관련 글" (§76)', () => {
    render(<RelatedContent record={LESSON} only={['nextLessons']} />);
    expect(
      screen.getByRole('heading', { level: 2, name: RELATION_HEADING.nextLessons }),
    ).toBeInTheDocument();
    expect(screen.queryByText('관련 글')).not.toBeInTheDocument();
  });

  it('renders only the relations it was asked for', () => {
    render(<RelatedContent record={LESSON} only={['prerequisites']} />);
    expect(
      screen.getByRole('heading', { name: RELATION_HEADING.prerequisites }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: RELATION_HEADING.nextLessons }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing at all when every requested relation is empty', () => {
    const empty: AnyContentRecord = { ...LESSON, prerequisites: [] };
    const { container } = render(<RelatedContent record={empty} only={['prerequisites']} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never links a piece that is not written yet — it shows 준비 중 instead', () => {
    const withPlannedNext: AnyContentRecord = {
      ...LESSON,
      nextLessons: [PLANNED_NEXT_LESSON.id],
    };
    render(<RelatedContent record={withPlannedNext} only={['nextLessons']} />);
    expect(screen.getByText(PLANNED_NEXT_LESSON.title)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: new RegExp(PLANNED_NEXT_LESSON.title, 'u') }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
  });

  it('resolves a tool relation through the route registry, showing the route’s label', () => {
    render(<RelatedContent record={LESSON} only={['relatedTools']} />);
    expect(
      screen.getByRole('heading', { name: RELATION_HEADING.relatedTools }),
    ).toBeInTheDocument();
    expect(screen.getByText('핸드레인지')).toBeInTheDocument();
  });

  it('separates the relation groups only when asked to, so the other hubs do not move', () => {
    /*
     * WP-5 turns the blog article's footer into five distinguishable groups. `/learn`,
     * `/glossary` and `/hands` are outside that work package's boundary, so `plain` has to
     * keep rendering the exact wrapper it rendered before — this asserts the default rather
     * than trusting the prop's default value to stay put.
     */
    const { container: plain } = render(
      <RelatedContent record={LESSON} only={['relatedTools', 'nextLessons']} />,
    );
    expect(plain.firstElementChild?.className).toContain('space-y-10');
    expect(plain.firstElementChild?.className).not.toContain('divide-y');

    const { container: sectioned } = render(
      <RelatedContent record={LESSON} only={['relatedTools', 'nextLessons']} variant="sectioned" />,
    );
    expect(sectioned.firstElementChild?.className).toContain('divide-y');
    // The separator is the site's ONE border colour, not a new line token.
    expect(sectioned.firstElementChild?.className).toContain('divide-line-500');
    expect(sectioned.firstElementChild?.className).not.toContain('space-y-10');
  });

  it('renders the same relations and the same links in either variant', () => {
    // The variant is presentation. If it ever changed WHICH relations render, the article
    // footer and the lesson footer would be showing different graphs.
    const headings = (variant: 'plain' | 'sectioned') => {
      const { container } = render(<RelatedContent record={LESSON} variant={variant} />);
      return [...container.querySelectorAll('h2')].map((node) => node.textContent);
    };
    expect(headings('sectioned')).toEqual(headings('plain'));
  });

  it('sets a one-entry group in one column, so no row renders half-empty (WP-S3-19, B-M4)', () => {
    const one: AnyContentRecord = { ...LESSON, nextLessons: LESSON.nextLessons.slice(0, 1) };
    const { container } = render(<RelatedContent record={one} only={['nextLessons']} />);
    const list = container.querySelector('ul');
    expect(list?.getAttribute('data-columns')).toBe('1');
    expect(list?.className).not.toContain('sm:grid-cols-2');

    const two: AnyContentRecord = { ...LESSON, nextLessons: LESSON.nextLessons.slice(0, 2) };
    expect(two.nextLessons.length).toBe(2);
    const { container: twoUp } = render(<RelatedContent record={two} only={['nextLessons']} />);
    expect(twoUp.querySelector('ul')?.getAttribute('data-columns')).toBe('2');
    expect(twoUp.querySelector('ul')?.className).toContain('sm:grid-cols-2');
  });

  it('gives each relation its own presentation: terms as a list, tools as actions, the rest as picture cards', () => {
    const { container } = render(
      <RelatedContent record={LESSON} only={['relatedConcepts', 'relatedTools', 'nextLessons']} />,
    );
    const layouts = [...container.querySelectorAll('ul[data-layout]')].map((ul) =>
      ul.getAttribute('data-layout'),
    );
    expect(layouts).toEqual(['terms', 'tools', 'cards']);
    // Terms: one column, no picture — a reference list, not cards.
    const terms = container.querySelector('ul[data-layout="terms"]');
    expect(terms?.getAttribute('data-columns')).toBe('1');
    expect(terms?.querySelector('[data-visual]')).toBeNull();
    // Cards: every entry carries its featured visual, and exactly one link — no nesting.
    for (const card of container.querySelectorAll('ul[data-layout="cards"] > li')) {
      expect(card.querySelector('[data-visual]')).not.toBeNull();
      expect(card.querySelectorAll('a').length).toBeLessThanOrEqual(1);
      expect(card.querySelector('a a')).toBeNull();
    }
  });

  it('`dense` sets the group headings at the h3 size without changing their level', () => {
    const { container } = render(<RelatedContent record={LESSON} dense only={['nextLessons']} />);
    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.className).toContain('text-lg');
    expect(heading?.className).not.toContain('text-h2');
  });

  it('throws rather than silently dropping a reference to a missing piece', () => {
    const broken: AnyContentRecord = { ...LESSON, nextLessons: ['does-not-exist'] };
    expect(() => render(<RelatedContent record={broken} only={['nextLessons']} />)).toThrow(
      /No such content id/u,
    );
  });
});

describe('RelatedContent — Stage 3 label set (D-S3-16)', () => {
  it('exposes the seven labels as a closed union', () => {
    expect(RELATED_LABELS).toEqual([
      '더 배우기',
      '직접 확인하기',
      '같이 알아둘 용어',
      '이런 이야기도 있어요',
      '비슷한 핸드',
      '다음으로 읽기',
      '관련 가이드',
    ]);
  });

  it('every relation-group heading another component renders is one of these labels', () => {
    // WP-S3-16: `HandOnward` used to head its guide group with a sentence outside the
    // union. The union is the single source, so a label that lives in another component
    // must be a member of it — otherwise the page-by-page drift D-S3-16 closed reopens.
    expect(RELATED_LABELS).toContain(GUIDES_LABEL);
    expect(RELATED_LABELS).toContain(STORIES_LABEL);
  });

  it('a `label` renames every rendered group; `labels` renames per relation; the rest keep the graph’s sentence', () => {
    const record = LESSON;
    const [first, second] = relationsOf(record);
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const single = render(
      <RelatedContent record={record} only={[first!.relation]} label="더 배우기" />,
    );
    expect(single.getByRole('heading', { level: 2 })).toHaveTextContent('더 배우기');
    expect(single.getByRole('region', { name: '더 배우기' })).toBeInTheDocument();
    single.unmount();

    const perKind = render(
      <RelatedContent
        record={record}
        only={[first!.relation, second!.relation]}
        labels={{ [first!.relation]: '직접 확인하기' }}
      />,
    );
    const headings = perKind.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['직접 확인하기', second!.heading]);
  });
});
