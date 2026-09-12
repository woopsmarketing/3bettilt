import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LearnCategory } from '../../content/registry/learn/categories.js';
import type { LearnRecord } from '../../content/types.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import type { RoadmapEntry } from './LearnRoadmap.js';
import { LearnTopics } from './LearnTopics.js';

function lesson(order: number, status: 'PUBLISHED' | 'PLANNED'): LearnRecord {
  return {
    kind: 'learn',
    id: `l${order}`,
    slug: `l${order}`,
    order,
    title: `레슨 제목 ${order}`,
    description: '설명',
    level: 'BASIC',
    topic: 'range',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status,
    indexable: status === 'PUBLISHED',
    readMinutes: status === 'PUBLISHED' ? 4 : null,
  };
}

const RANGE: LearnCategory = { id: 'range', label: '레인지', description: '레인지 설명' };
const MATH: LearnCategory = { id: 'math', label: '확률과 수학', description: '수학 설명' };

const entry = (record: LearnRecord, category: LearnCategory): RoadmapEntry => ({
  lesson: record,
  href: record.status === 'PUBLISHED' ? `/x/learn/${record.slug}` : null,
  category,
});

const GROUPS = [
  {
    category: RANGE,
    anchor: 'topic-range',
    lessons: [entry(lesson(5, 'PUBLISHED'), RANGE), entry(lesson(6, 'PUBLISHED'), RANGE)],
  },
  { category: MATH, anchor: 'topic-math', lessons: [entry(lesson(13, 'PLANNED'), MATH)] },
];

describe('LearnTopics', () => {
  it('renders a chip per category that jumps to that category’s section by id', () => {
    const { container } = renderBothThemes(<LearnTopics groups={GROUPS} />);
    const nav = screen.getByRole('navigation', { name: '주제 고르기' });
    const chips = within(nav).getAllByRole('link');
    expect(chips.map((a) => a.getAttribute('href'))).toEqual(['#topic-range', '#topic-math']);
    expect(container.querySelector('section#topic-range')).not.toBeNull();
    expect(container.querySelector('section#topic-math')).not.toBeNull();
    expect(screen.getByRole('region', { name: '레인지' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '확률과 수학' })).toBeInTheDocument();
  });

  it('shows each lesson once, with its curriculum number, in curriculum order', () => {
    const section = renderBothThemes(<LearnTopics groups={GROUPS} />).container.querySelector(
      'section#topic-range',
    ) as HTMLElement;
    const rows = [...section.querySelectorAll('li[data-order]')];
    expect(rows.map((li) => (li as HTMLElement).dataset['order'])).toEqual(['5', '6']);
    expect(within(section).getByText('05')).toBeInTheDocument();
    expect(within(section).getByText('06')).toBeInTheDocument();
    expect(within(section).getByText('레슨 2편')).toBeInTheDocument();
  });

  it('links a written lesson and marks a planned one 준비 중 with no link', () => {
    renderBothThemes(<LearnTopics groups={GROUPS} />);
    expect(screen.getByRole('link', { name: '레슨 제목 5' })).toHaveAttribute(
      'href',
      '/x/learn/l5',
    );
    expect(screen.queryByRole('link', { name: /레슨 제목 13/u })).toBeNull();
    const planned = screen.getByText('레슨 제목 13').closest('li') as HTMLElement;
    expect(within(planned).getByText('준비 중')).toBeInTheDocument();
  });

  it('shows the category description and the lesson count', () => {
    renderBothThemes(<LearnTopics groups={GROUPS} />);
    expect(screen.getByText('레인지 설명')).toBeInTheDocument();
    expect(screen.getByText('레슨 1편')).toBeInTheDocument();
  });
});
