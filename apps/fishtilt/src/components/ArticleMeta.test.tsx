import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { LEVEL_LABEL } from '../content/graph.js';
import { ArticleMeta, koreanDate } from './ArticleMeta.js';

describe('ArticleMeta (D-S3-13)', () => {
  it('renders category, level and read time in that order, with the graph’s level label', () => {
    renderBothThemes(<ArticleMeta category="읽을거리" level="INTRO" readMinutes={4} />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent?.replace('·', '').trim());
    expect(items).toEqual(['읽을거리', LEVEL_LABEL.INTRO, '약 4분']);
  });

  it('renders a date as <time> with a Korean reading and the ISO value', () => {
    renderBothThemes(<ArticleMeta date="2026-09-09" />);
    const time = screen.getByText('2026년 9월 9일');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-09-09');
  });

  it('shows an update date only when it differs from the publish date', () => {
    const { container, rerender } = renderBothThemes(<ArticleMeta date="2026-09-01" updated="2026-09-01" />);
    expect(container.textContent).not.toContain('업데이트');
    rerender(<ArticleMeta date="2026-09-01" updated="2026-09-09" />);
    expect(container.textContent).toContain('업데이트 2026년 9월 9일');
  });

  it('renders a disclosure as a visible badge AND a visible sentence — never hidden', () => {
    const { container } = renderBothThemes(
      <ArticleMeta
        level="INTRO"
        disclosure={{ badge: '가상의 핸드', sentence: '이 핸드는 학습을 위해 만든 이야기입니다.' }}
      />,
    );
    expect(screen.getByText('가상의 핸드')).toBeVisible();
    expect(screen.getByText('이 핸드는 학습을 위해 만든 이야기입니다.')).toBeVisible();
    expect(container.querySelector('.sr-only')).toBeNull();
    expect(container.querySelector('[hidden]')).toBeNull();
  });

  it('renders nothing at all with nothing to say', () => {
    const { container } = renderBothThemes(<ArticleMeta readMinutes={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('koreanDate formats ISO dates and leaves anything else alone', () => {
    expect(koreanDate('2026-01-05')).toBe('2026년 1월 5일');
    expect(koreanDate('2026년 봄')).toBe('2026년 봄');
  });
});
