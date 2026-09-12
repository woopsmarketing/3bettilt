import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HomeIntents, type HomeIntent } from './HomeIntents.js';

const INTENTS: readonly HomeIntent[] = [
  {
    id: 'a',
    title: '포커가 완전 처음이에요',
    description: 'd',
    destination: '배우기',
    href: '/x/learn',
  },
  { id: 'b', title: '아직 없는 곳', description: 'd', destination: '준비', href: null },
];

describe('HomeIntents', () => {
  it('renders rows, not cards: one list, the intent sentence is the link', () => {
    const { container } = renderBothThemes(<HomeIntents intents={INTENTS} labelledBy="h" />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /포커가 완전 처음이에요/u })).toHaveAttribute(
      'href',
      '/x/learn',
    );
    // No bordered card surfaces — rows separated by rules only.
    expect(container.querySelector('li')?.className).not.toMatch(/rounded|bg-panel/u);
  });

  it('renders an unbuilt destination as text with the badge, never a link', () => {
    const { container } = renderBothThemes(<HomeIntents intents={INTENTS} labelledBy="h" />);
    expect(screen.queryByRole('link', { name: /아직 없는 곳/u })).toBeNull();
    expect(container.textContent).toContain('준비 중');
    expect(container.querySelectorAll('a[href]')).toHaveLength(1);
  });
});
