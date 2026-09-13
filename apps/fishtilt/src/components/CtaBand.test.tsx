import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { CtaBand } from './CtaBand.js';

describe('CtaBand (D-S3-12)', () => {
  it('renders the title, the sentence and the primary button on the brand tint', () => {
    const { container } = renderBothThemes(
      <CtaBand
        title="직접 눌러보세요"
        description="13×13 표를 열어 봅니다."
        primary={{ href: '/ko/tools/range', label: '핸드레인지 열기' }}
      />,
    );
    expect(container.firstElementChild?.className).toContain('bg-brand-950');
    expect(container.firstElementChild?.className).not.toContain('border');
    expect(screen.getByText('직접 눌러보세요')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '핸드레인지 열기' });
    expect(link).toHaveAttribute('href', '/ko/tools/range');
    // The site's primary button verbatim: brand FILL + ink-on-brand, hover on brand-hover.
    expect(link.className).toContain('bg-brand-600');
    expect(link.className).toContain('text-ink-on-brand');
    expect(link.className).toContain('hover:bg-brand-hover');
    expect(link.className).toContain('min-h-11');
  });

  it('renders the secondary action as a quieter link', () => {
    renderBothThemes(
      <CtaBand
        title="t"
        primary={{ href: '/ko/tools/range', label: '열기' }}
        secondary={{ href: '/ko/learn/poker-range', label: '먼저 배우기' }}
      />,
    );
    const secondary = screen.getByRole('link', { name: '먼저 배우기' });
    expect(secondary.className).not.toContain('bg-brand-600');
    expect(secondary.className).toContain('text-brand-500');
  });

  it('lays the band over a decorative backdrop under the dense band scrim, on the dark cover stage', () => {
    const { container } = renderBothThemes(
      <CtaBand
        title="지금 시작하세요"
        primary={{ href: '/ko/learn', label: '첫 레슨 읽기' }}
        backdrop={<span data-testid="picture" />}
      />,
    );
    const band = container.firstElementChild;
    expect(band?.getAttribute('data-cta-backdrop')).toBe('picture');
    expect(band?.className).toContain('cover-stage');
    expect(band?.className).not.toContain('bg-brand-950');
    const layer = screen.getByTestId('picture').parentElement;
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.querySelector('.cover-scrim-band')).not.toBeNull();
    // The text and the action stay live and above the picture layer.
    expect(screen.getByText('지금 시작하세요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '첫 레슨 읽기' })).toHaveAttribute('href', '/ko/learn');
  });

  it('never links a destination that is null — it shows 준비 중 instead', () => {
    renderBothThemes(<CtaBand title="t" primary={{ href: null, label: '아직 없는 도구' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('아직 없는 도구')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });
});
