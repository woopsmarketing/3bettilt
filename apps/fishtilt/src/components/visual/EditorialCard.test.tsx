import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeVisual } from '../../content/visuals.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { EditorialCard } from './EditorialCard.js';
import { ThemeArt } from './ThemeArt.js';

const VISUAL = themeVisual('range', 'fixture');

describe('EditorialCard', () => {
  for (const shape of ['overlay', 'stacked', 'row'] as const) {
    it(`${shape}: the whole card is ONE link named by the title, never a nested anchor`, () => {
      const { container } = renderBothThemes(
        <EditorialCard
          shape={shape}
          href="/ko/learn/hand-matrix"
          title="13×13 표는 어떻게 읽나요?"
          eyebrow="레인지"
          description="설명"
          visual={VISUAL}
          sizes="100vw"
        />,
      );
      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(1);
      expect(screen.getByRole('link', { name: '13×13 표는 어떻게 읽나요?' }).className).toContain(
        'stretched-link',
      );
      // The stretched link needs a positioned card to cover; the picture sits inside it.
      expect(container.querySelector('article')?.className).toContain('relative');
      expect(container.querySelector('article [data-visual]')).not.toBeNull();
      // No title baked into the picture: the text lives outside the visual slot.
      expect(container.querySelector('[data-visual]')?.textContent).toBe('');
    });
  }

  it('renders a planned piece without a link and with 준비 중', () => {
    const { container } = render(
      <EditorialCard href={null} title="준비 중인 글" visual={VISUAL} sizes="100vw" />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('준비 중');
  });
});

describe('ThemeArt', () => {
  it('is deterministic, decorative, text-free and id-free', () => {
    const first = render(<ThemeArt theme="story" variant="blog-aa-loses" />).container.innerHTML;
    const second = render(<ThemeArt theme="story" variant="blog-aa-loses" />).container.innerHTML;
    expect(first).toBe(second);
    const { container } = render(<ThemeArt theme="range" variant="x" />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).toBe('');
    expect(container.querySelector('[id]')).toBeNull();
    expect(container.querySelector('text, img')).toBeNull();
  });

  it('omits the table object when real content is laid over it', () => {
    const { container } = render(<ThemeArt theme="story" motif={false} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
