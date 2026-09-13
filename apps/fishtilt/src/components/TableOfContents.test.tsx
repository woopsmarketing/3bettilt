import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { TableOfContents } from './TableOfContents.js';

const HEADINGS = [
  { id: 'what', text: '팟 오즈란' },
  { id: 'how', text: '계산하는 법' },
  { id: 'example', text: '예시', level: 3 as const },
];

describe('TableOfContents (D-S3-13)', () => {
  it('is a navigation landmark with an ordered list of in-page links, from the prop only', () => {
    renderBothThemes(<TableOfContents headings={HEADINGS} />);
    const nav = screen.getByRole('navigation', { name: '목차' });
    expect(nav.querySelector('ol')).not.toBeNull();
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#what', '#how', '#example']);
    expect(links.map((a) => a.textContent)).toEqual(['팟 오즈란', '계산하는 법', '예시']);
  });

  it('indents a level-3 entry one step', () => {
    renderBothThemes(<TableOfContents headings={HEADINGS} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.className).not.toContain('pl-4');
    expect(items[2]?.className).toContain('pl-4');
  });

  it('renders nothing for an empty list', () => {
    const { container } = renderBothThemes(<TableOfContents headings={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('collapsible: ONE list inside a closed <details> — never a second copy of the links', () => {
    const { container } = renderBothThemes(
      <TableOfContents headings={HEADINGS} numbered collapsible />,
    );
    const details = container.querySelector('nav details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(details?.className).toContain('toc-collapsible');
    expect(container.querySelectorAll('a')).toHaveLength(HEADINGS.length);
    // Chapter numbers for level-2 entries only, hidden from assistive technology.
    const numbers = [...container.querySelectorAll('a [aria-hidden="true"]')].map(
      (n) => n.textContent,
    );
    expect(numbers).toEqual(['01', '02']);
  });
});
