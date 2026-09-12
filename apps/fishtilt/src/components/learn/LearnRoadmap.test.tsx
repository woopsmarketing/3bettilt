import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LearnCategory, LearnStage } from '../../content/registry/learn/categories.js';
import type { LearnRecord } from '../../content/types.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { LearnRoadmap, type RoadmapEntry } from './LearnRoadmap.js';

/* Fixtures this file constructs (ruling 26): the "준비 중, never a link" branch must stay
 * provable after every real lesson has shipped, so it is not read from the registry. */
function lesson(
  order: number,
  status: 'PUBLISHED' | 'PLANNED',
  readMinutes: number | null,
): LearnRecord {
  return {
    kind: 'learn',
    id: `l${order}`,
    slug: `l${order}`,
    order,
    title: `레슨 제목 ${order}`,
    description: `레슨 ${order}의 한 줄 설명.`,
    level: 'INTRO',
    topic: 'rules',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status,
    indexable: status === 'PUBLISHED',
    readMinutes,
  };
}

const CATEGORY: LearnCategory = { id: 'game-start', label: '게임 시작', description: '설명' };
const STAGE_A: LearnStage = {
  id: 's1',
  ordinal: 1,
  label: '첫 단계',
  description: '설명 1',
  first: 1,
  last: 2,
};
const STAGE_B: LearnStage = {
  id: 's2',
  ordinal: 2,
  label: '둘째 단계',
  description: '설명 2',
  first: 3,
  last: 3,
};

const entry = (record: LearnRecord): RoadmapEntry => ({
  lesson: record,
  href: record.status === 'PUBLISHED' ? `/x/learn/${record.slug}` : null,
  category: CATEGORY,
});

const STAGES = [
  { stage: STAGE_A, lessons: [entry(lesson(1, 'PUBLISHED', 4)), entry(lesson(2, 'PUBLISHED', 5))] },
  { stage: STAGE_B, lessons: [entry(lesson(3, 'PLANNED', null))] },
];

describe('LearnRoadmap', () => {
  it('renders one stage section per stage, headed by its ordinal and name', () => {
    renderBothThemes(<LearnRoadmap stages={STAGES} />);
    expect(screen.getByRole('region', { name: '첫 단계' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '둘째 단계' })).toBeInTheDocument();
    expect(screen.getByText('1단계')).toBeInTheDocument();
    expect(screen.getByText('2단계')).toBeInTheDocument();
  });

  it('keeps the REAL curriculum number on every step, across stage boundaries', () => {
    const { container } = renderBothThemes(<LearnRoadmap stages={STAGES} />);
    const items = [...container.querySelectorAll('li[data-order]')];
    expect(items.map((li) => (li as HTMLElement).dataset['order'])).toEqual(['1', '2', '3']);
    // The `<ol start>` carries the same number to assistive technology.
    const lists = [...container.querySelectorAll('ol')];
    expect(lists.map((ol) => ol.getAttribute('start'))).toEqual(['1', '3']);
  });

  it('links a written lesson and renders a planned one as text with 준비 중 — never both', () => {
    renderBothThemes(<LearnRoadmap stages={STAGES} />);
    expect(screen.getByRole('link', { name: '레슨 제목 1' })).toHaveAttribute(
      'href',
      '/x/learn/l1',
    );
    expect(screen.queryByRole('link', { name: /레슨 제목 3/u })).toBeNull();
    const planned = screen.getByText('레슨 제목 3').closest('li') as HTMLElement;
    expect(within(planned).getByText('준비 중')).toBeInTheDocument();
    expect(within(planned).queryByRole('link')).toBeNull();
  });

  it('shows the category and the meta line on every step', () => {
    renderBothThemes(<LearnRoadmap stages={STAGES} />);
    expect(screen.getAllByText('게임 시작')).toHaveLength(3);
    expect(screen.getAllByText(/처음 · 약 4분/u)).toHaveLength(1);
  });

  it('renders an entry outside every stage under "단계 미정", without a category, never dropped', () => {
    const stray: RoadmapEntry = { lesson: lesson(99, 'PLANNED', null), href: null, category: null };
    const { container } = renderBothThemes(<LearnRoadmap stages={STAGES} unstaged={[stray]} />);
    const section = screen.getByRole('region', { name: '단계 미정' });
    expect(within(section).getByText('레슨 제목 99')).toBeInTheDocument();
    expect(within(section).getByText('준비 중')).toBeInTheDocument();
    expect(within(section).queryByRole('link')).toBeNull();
    // No category label on that step, and the real curriculum number is still shown.
    const step = within(section).getByText('레슨 제목 99').closest('li') as HTMLElement;
    expect(step.dataset['order']).toBe('99');
    expect(within(step).queryByText('게임 시작')).toBeNull();
    expect(container.querySelectorAll('li[data-order]')).toHaveLength(4);
  });

  it('renders no "단계 미정" section when every entry has a stage', () => {
    renderBothThemes(<LearnRoadmap stages={STAGES} />);
    expect(screen.queryByRole('region', { name: '단계 미정' })).toBeNull();
  });

  it('totals a stage’s reading time from its records, and says nothing when one is missing', () => {
    renderBothThemes(<LearnRoadmap stages={STAGES} />);
    const a = screen.getByRole('region', { name: '첫 단계' });
    expect(within(a).getByText(/레슨 1–2 · 약 9분/u)).toBeInTheDocument();
    const b = screen.getByRole('region', { name: '둘째 단계' });
    expect(within(b).getByText('레슨 3–3')).toBeInTheDocument();
    expect(within(b).queryByText(/약 \d+분/u)).toBeNull();
  });
});
