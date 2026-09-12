import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { Callout } from './Callout.js';
import { KeyPoint } from './KeyPoint.js';

describe('KeyPoint = Callout variant "key" (D-S3-13)', () => {
  it('renders the key variant of the same aside with the default title', () => {
    const { container } = renderBothThemes(
      <KeyPoint>
        <p>포지션이 늦을수록 더 많은 핸드를 칩니다.</p>
      </KeyPoint>,
    );
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('data-variant')).toBe('key');
    expect(aside?.className).toContain('bg-ground-800');
    expect(aside?.className).toContain('border-l-brand-500');
    expect(screen.getByText('핵심 정리').className).toContain('text-brand-500');
  });

  it('is exactly what <Callout variant="key"> renders', () => {
    const a = renderBothThemes(<KeyPoint title="정리">본문</KeyPoint>);
    const html = a.container.innerHTML;
    a.unmount();
    const b = renderBothThemes(<Callout variant="key" title="정리">본문</Callout>);
    expect(b.container.innerHTML).toBe(html);
  });

  it('leaves the default Callout as the explain variant on the card surface', () => {
    const { container } = renderBothThemes(<Callout title="쉽게 설명하면">본문</Callout>);
    expect(container.querySelector('aside')?.getAttribute('data-variant')).toBe('explain');
    expect(container.querySelector('aside')?.className).toContain('bg-panel-700');
  });
});
