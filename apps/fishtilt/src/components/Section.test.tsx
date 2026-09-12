import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { Section, SECTION_WIDTH_CLASS } from './Section.js';

describe('Section (D-S3-12)', () => {
  it('is a full-bleed band with a token-capped inner box', () => {
    const { container } = renderBothThemes(
      <Section width="reading" aria-label="본문">
        <p>내용</p>
      </Section>,
    );
    const band = container.querySelector('section');
    expect(band?.getAttribute('data-width')).toBe('reading');
    const inner = band?.firstElementChild;
    expect(inner?.className).toContain('max-w-reading');
    expect(inner?.className).toContain('mx-auto');
    expect(inner?.className).not.toMatch(/max-w-\[/u);
  });

  it('names every width after its container token and never a literal', () => {
    for (const [width, classes] of Object.entries(SECTION_WIDTH_CLASS)) {
      if (width === 'full') {
        expect(classes).toBe('');
      } else {
        expect(classes).toContain(`max-w-${width}`);
      }
      expect(classes).not.toMatch(/max-w-\[/u);
    }
  });

  it('paints the tone on the outer band only, from the surface tokens', () => {
    const { container } = renderBothThemes(
      <Section tone="recessed" aria-label="도구">
        <p>내용</p>
      </Section>,
    );
    const band = container.querySelector('section');
    expect(band?.className).toContain('bg-ground-800');
    expect(band?.getAttribute('data-tone')).toBe('recessed');
    expect(band?.firstElementChild?.className).not.toContain('bg-');
  });

  it('the brand-tint tone is the deepest brand tint, and draws no border of its own', () => {
    const { container } = renderBothThemes(
      <Section tone="brand-tint" as="div">
        <p>내용</p>
      </Section>,
    );
    const band = container.firstElementChild;
    expect(band?.tagName).toBe('DIV');
    expect(band?.className).toContain('bg-brand-950');
    expect(band?.className).not.toContain('border');
  });

  it('carries the two-step section rhythm by default and none when asked', () => {
    const { container, rerender } = renderBothThemes(
      <Section aria-label="a">
        <p>내용</p>
      </Section>,
    );
    expect(container.querySelector('section')?.className).toContain('py-section');
    expect(container.querySelector('section')?.className).toContain('lg:py-section-lg');
    rerender(
      <Section aria-label="a" padded="none">
        <p>내용</p>
      </Section>,
    );
    expect(container.querySelector('section')?.className).not.toContain('py-section');
  });

  it('draws dividers with the one border token', () => {
    const { container } = renderBothThemes(
      <Section aria-label="a" divider="both">
        <p>내용</p>
      </Section>,
    );
    expect(container.querySelector('section')?.className).toContain('border-y border-line-500');
  });

  it('is a named region when labelled, by label or by its heading', () => {
    renderBothThemes(
      <>
        <Section aria-label="첫 번째">
          <p>a</p>
        </Section>
        <Section labelledBy="second-heading">
          <h2 id="second-heading">두 번째</h2>
        </Section>
      </>,
    );
    expect(screen.getByRole('region', { name: '첫 번째' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '두 번째' })).toBeInTheDocument();
  });
});
