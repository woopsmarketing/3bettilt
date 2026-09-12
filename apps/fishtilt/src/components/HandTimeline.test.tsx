import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { HandTimeline } from './HandTimeline.js';

const ACTIONS = [
  { position: 'UTG', action: '레이즈', amount: '2.5BB' },
  { position: 'BTN', action: '콜', amount: '2.5BB', hero: true },
  { position: 'SB', action: '폴드' },
  { position: '상대', action: '체크' },
];

describe('HandTimeline (D-S3-14)', () => {
  it('lists the actions in order with the amounts as given — no arithmetic', () => {
    renderBothThemes(<HandTimeline actions={ACTIONS} street="프리플랍" pot="팟 6BB" />);
    const list = screen.getByRole('list', { name: '프리플랍 액션' });
    expect(list.tagName).toBe('OL');
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.replace(/^\d/u, '').trim())).toEqual([
      'UTG레이즈2.5BB',
      'BTN콜2.5BB',
      'SB폴드',
      '상대체크',
    ]);
    expect(screen.getByText('팟 6BB')).toBeInTheDocument();
  });

  it('glosses a known seat for assistive tech and leaves a story’s own name alone', () => {
    renderBothThemes(<HandTimeline actions={ACTIONS} />);
    expect(screen.getByText('BTN')).toHaveAttribute('aria-label', '버튼(BTN) 자리');
    expect(screen.getByText('상대')).not.toHaveAttribute('aria-label');
  });

  it('marks the hero row in the data and in the brand ink', () => {
    renderBothThemes(<HandTimeline actions={ACTIONS} />);
    const hero = screen.getAllByRole('listitem')[1];
    expect(hero?.getAttribute('data-hero')).toBe('true');
    expect(screen.getByText('BTN').className).toContain('text-brand-500');
  });

  it('renders nothing for no actions', () => {
    const { container } = renderBothThemes(<HandTimeline actions={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
