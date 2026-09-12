import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { StatsRow, StatStrip } from './StatStrip.js';

const ITEMS = [
  { value: '169', label: '핸드' },
  { value: '6', label: '자리' },
  { value: '무료', label: '비용' },
] as const;

describe('StatStrip (D-S3-12)', () => {
  it('renders one list item per stat, in order, with no card borders', () => {
    renderBothThemes(<StatStrip items={ITEMS} aria-label="사이트 숫자" />);
    const list = screen.getByRole('list', { name: '사이트 숫자' });
    const items = [...list.querySelectorAll(':scope > li')];
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual(['169', '6', '무료']);
    for (const li of items) expect(li.className).not.toContain('border');
  });

  it('the rules variant separates stats with the one border token, from sm up', () => {
    renderBothThemes(<StatStrip items={ITEMS} variant="rules" />);
    const li = screen.getAllByRole('listitem')[1];
    expect(li?.className).toContain('sm:border-l');
    expect(li?.className).toContain('sm:border-line-500');
  });

  it('renders nothing for an empty list', () => {
    const { container } = renderBothThemes(<StatStrip items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('StatsRow is the same component under the article-library name', () => {
    expect(StatsRow).toBe(StatStrip);
  });
});
