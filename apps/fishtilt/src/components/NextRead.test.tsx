import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { NextRead } from './NextRead.js';

describe('NextRead (D-S3-13)', () => {
  it('is a navigation landmark with the previous and next pieces as links', () => {
    renderBothThemes(
      <NextRead
        prev={{ href: '/ko/learn/positions-6max', title: '자리 이름', meta: '레슨 2' }}
        next={{ href: '/ko/learn/pot-odds', title: '팟 오즈', meta: '레슨 4' }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: '다음으로 읽기' });
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ko/learn/positions-6max',
      '/ko/learn/pot-odds',
    ]);
    expect(nav.textContent).toContain('이전');
    expect(nav.textContent).toContain('다음');
    expect(nav.textContent).toContain('레슨 4');
  });

  it('renders only the side that exists, in its own column', () => {
    renderBothThemes(<NextRead next={{ href: '/ko/learn/pot-odds', title: '팟 오즈' }} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link').getAttribute('data-direction')).toBe('next');
  });

  it('never links a piece that is not written yet', () => {
    renderBothThemes(<NextRead next={{ href: null, title: '아직 없는 레슨' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('아직 없는 레슨')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  describe('emphasis="next" (WP-S3-19, review B-M4)', () => {
    it('keeps the landmark and both data-direction hooks, with the next piece first and larger', () => {
      renderBothThemes(
        <NextRead
          emphasis="next"
          prev={{ href: '/ko/learn/positions-6max', title: '자리 이름', meta: '레슨 2' }}
          next={{ href: '/ko/learn/pot-odds', title: '팟 오즈', meta: '레슨 4' }}
        />,
      );
      const nav = screen.getByRole('navigation', { name: '다음으로 읽기' });
      expect(nav.getAttribute('data-emphasis')).toBe('next');
      const next = nav.querySelector('a[data-direction="next"]');
      const prev = nav.querySelector('a[data-direction="prev"]');
      expect(next).toHaveAttribute('href', '/ko/learn/pot-odds');
      expect(prev).toHaveAttribute('href', '/ko/learn/positions-6max');
      // DOM order: the step, then the line — the next piece is the first thing in the tail.
      expect(next!.compareDocumentPosition(prev!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(next?.querySelector('span.text-xl, span.sm\\:text-2xl')?.textContent).toBe('팟 오즈');
      expect(nav.textContent).toContain('다음');
      expect(nav.textContent).toContain('이전');
      expect(nav.textContent).toContain('레슨 4');
    });

    it('still never links a planned piece, in either slot', () => {
      renderBothThemes(
        <NextRead
          emphasis="next"
          prev={{ href: null, title: '아직 없는 이전 레슨' }}
          next={{ href: null, title: '아직 없는 레슨' }}
        />,
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('아직 없는 레슨')).toBeInTheDocument();
      expect(screen.getAllByText('준비 중')).toHaveLength(2);
    });
  });

  it('renders nothing with neither side', () => {
    const { container } = renderBothThemes(<NextRead />);
    expect(container.innerHTML).toBe('');
  });
});
