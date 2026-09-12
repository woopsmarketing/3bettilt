import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeCallToAction } from './HomeCallToAction.js';

/*
 * Same discipline as `HomeLinkCard.test.tsx`: both states are built here rather than
 * borrowed from live data, so "an unresolved destination is not a link" stays provable on
 * the day the last route ships (`docs/FISHTILT_STATE.md` ruling 26).
 */
describe('HomeCallToAction', () => {
  it('is a link to the resolved destination', () => {
    render(<HomeCallToAction href="/tools/range" label="13×13 핸드레인지 보기" />);
    expect(screen.getByRole('link', { name: '13×13 핸드레인지 보기' })).toHaveAttribute(
      'href',
      '/tools/range',
    );
  });

  it('renders neither a link nor a disabled control when the destination is null', () => {
    render(<HomeCallToAction href={null} label="아직 없는 곳" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('아직 없는 곳')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('keeps a visible focus outline on the link variant', () => {
    render(<HomeCallToAction href="/learn" label="처음부터 배우기" variant="secondary" />);
    expect(screen.getByRole('link', { name: '처음부터 배우기' }).className).toContain(
      'focus-visible:outline-2',
    );
  });
});
