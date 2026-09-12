import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { BettingTimeline } from './BettingTimeline.js';

const STEPS = [
  { position: 'SB', action: '블라인드', amount: '0.5BB' },
  { position: 'BB', action: '블라인드', amount: '1BB' },
  { position: 'UTG', action: '레이즈', amount: '2.5BB', hero: true },
  { position: 'BTN', action: '3벳', amount: '8BB' },
];

describe('BettingTimeline (D-S3-15)', () => {
  it('is an ordered list of the steps, left to right, with arrows between them', () => {
    renderBothThemes(<BettingTimeline steps={STEPS} />);
    const list = screen.getByRole('list', { name: '베팅 순서' });
    expect(list.tagName).toBe('OL');
    expect(list.className).toContain('flex-wrap');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]?.textContent).not.toContain('→');
    expect(items[1]?.textContent).toContain('→');
    expect(items[2]?.textContent).toContain('2.5BB');
    expect(items[2]?.getAttribute('data-hero')).toBe('true');
  });

  it('wraps in Figure with a caption and renders nothing for no steps', () => {
    const { container, rerender } = renderBothThemes(<BettingTimeline steps={STEPS} caption="예시 사이즈" />);
    expect(container.querySelector('figure figcaption')?.textContent).toBe('예시 사이즈');
    rerender(<BettingTimeline steps={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
