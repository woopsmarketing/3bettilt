import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { LearnModeNav } from './LearnModeNav.js';

describe('LearnModeNav', () => {
  it('offers the two modes as same-page anchors, with the counts it was given', () => {
    renderBothThemes(
      <LearnModeNav
        roadmap={{ href: '#roadmap', lessonCount: 15 }}
        topics={{ href: '#topics', categoryCount: 7 }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: '배우는 방법' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /처음부터 배우기/u })).toHaveAttribute(
      'href',
      '#roadmap',
    );
    expect(screen.getByRole('link', { name: /특정 주제 배우기/u })).toHaveAttribute(
      'href',
      '#topics',
    );
    expect(screen.getByText(/15편을 번호 순서대로/u)).toBeInTheDocument();
    expect(screen.getByText(/7가지 주제 중/u)).toBeInTheDocument();
  });

  it('is two links and nothing interactive beyond them (no JS tab control)', () => {
    renderBothThemes(
      <LearnModeNav
        roadmap={{ href: '#a', lessonCount: 1 }}
        topics={{ href: '#b', categoryCount: 1 }}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});
