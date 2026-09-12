import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ContentLink } from '../../content/graph.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { LessonHeader } from './LessonHeader.js';

/* Fixtures this file owns (ruling 26): the planned-prerequisite branch must stay provable
 * after every lesson has shipped. Hrefs are opaque strings here — the page builds real ones. */
const CATEGORY = { label: '게임 시작', href: '/x/learn#topic-game-start' };
const WRITTEN: ContentLink = {
  key: 'a',
  label: '먼저 읽을 레슨',
  description: null,
  href: '/x/learn/a',
  meta: '처음 · 약 4분',
};
const PLANNED: ContentLink = {
  key: 'b',
  label: '아직 없는 레슨',
  description: null,
  href: null,
  meta: null,
};

describe('LessonHeader', () => {
  it('says "레슨 N / total" in words and renders the one h1', () => {
    renderBothThemes(
      <LessonHeader
        order={3}
        total={15}
        title="제목"
        level="INTRO"
        readMinutes={4}
        category={CATEGORY}
      />,
    );
    expect(screen.getByText('레슨 3 / 15')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('제목');
  });

  it('links the category back to its section on the hub', () => {
    renderBothThemes(
      <LessonHeader
        order={3}
        total={15}
        title="제목"
        level="INTRO"
        readMinutes={4}
        category={CATEGORY}
      />,
    );
    expect(screen.getByRole('link', { name: '게임 시작' })).toHaveAttribute('href', CATEGORY.href);
  });

  it('shows level and reading time, and omits the time when there is none', () => {
    const { unmount } = renderBothThemes(
      <LessonHeader
        order={3}
        total={15}
        title="제목"
        level="BASIC"
        readMinutes={5}
        category={CATEGORY}
      />,
    );
    expect(screen.getByText('초급')).toBeInTheDocument();
    expect(screen.getByText('약 5분')).toBeInTheDocument();
    unmount();
    renderBothThemes(
      <LessonHeader
        order={3}
        total={15}
        title="제목"
        level="BASIC"
        readMinutes={null}
        category={CATEGORY}
      />,
    );
    expect(screen.queryByText(/약 \d+분/u)).toBeNull();
  });

  it('draws one decorative progress segment per lesson, marking done / current / ahead', () => {
    const { container } = renderBothThemes(
      <LessonHeader
        order={3}
        total={5}
        title="제목"
        level="INTRO"
        readMinutes={4}
        category={CATEGORY}
      />,
    );
    const rail = container.querySelector('[data-lesson="progress"]');
    expect(rail?.getAttribute('aria-hidden')).toBe('true');
    const states = [...(rail?.children ?? [])].map((el) => (el as HTMLElement).dataset['state']);
    expect(states).toEqual(['done', 'done', 'current', 'ahead', 'ahead']);
  });

  it('lists prerequisites inline: written ones as links, planned ones as text with 준비 중', () => {
    const { container } = renderBothThemes(
      <LessonHeader
        order={3}
        total={15}
        title="제목"
        level="INTRO"
        readMinutes={4}
        category={CATEGORY}
        prerequisites={[WRITTEN, PLANNED]}
      />,
    );
    const line = container.querySelector('[data-lesson="prerequisites"]') as HTMLElement;
    expect(line).not.toBeNull();
    expect(within(line).getByText('먼저 읽으면 좋아요')).toBeInTheDocument();
    expect(within(line).getByRole('link', { name: '먼저 읽을 레슨' })).toHaveAttribute(
      'href',
      '/x/learn/a',
    );
    expect(within(line).queryByRole('link', { name: /아직 없는 레슨/u })).toBeNull();
    expect(within(line).getByText('준비 중')).toBeInTheDocument();
  });

  it('renders no prerequisites line at all when there are none', () => {
    const { container } = renderBothThemes(
      <LessonHeader
        order={1}
        total={15}
        title="제목"
        level="INTRO"
        readMinutes={4}
        category={CATEGORY}
      />,
    );
    expect(container.querySelector('[data-lesson="prerequisites"]')).toBeNull();
    expect(screen.queryByText('먼저 읽으면 좋아요')).toBeNull();
  });
});
