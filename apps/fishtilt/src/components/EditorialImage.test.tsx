import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { EditorialImage } from './EditorialImage.js';

describe('EditorialImage (D-S3-13; prompt §AA/§AB)', () => {
  it('with no asset, renders the deterministic drawn fallback inside an aspect box', () => {
    const { container } = renderBothThemes(
      <EditorialImage alt="6인 테이블의 자리" fallback={{ kind: 'learn', topic: 'position' }} />,
    );
    const box = container.firstElementChild;
    expect(box?.getAttribute('data-source')).toBe('fallback');
    expect(box?.className).toContain('aspect-video');
    expect(box?.className).toContain('relative');
    // The fallback IS ContentThumbnail's art, so the reader recognises the card's picture.
    const art = box?.querySelector('[data-topic="position"][data-kind="learn"]');
    expect(art).not.toBeNull();
    expect(art?.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 240 50');
    // No raster, no placeholder file, no text in the picture.
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toMatch(/\.(png|jpe?g|webp|avif)\b/iu);
    expect(container.querySelector('text')).toBeNull();
  });

  it('passes the record’s id through to the drawn fallback, so two pieces of one topic differ (B-M1)', () => {
    const { container } = renderBothThemes(
      <EditorialImage
        alt=""
        decorative
        fallback={{ kind: 'blog', topic: 'hand-strength', variant: 'blog-aa-loses' }}
      />,
    );
    expect(container.querySelector('[data-variant="blog-aa-loses"]')).not.toBeNull();
  });

  it('a non-decorative fallback announces the alt as an image; a decorative one is hidden', () => {
    const { rerender } = renderBothThemes(
      <EditorialImage alt="6인 테이블의 자리" fallback={{ kind: 'learn', topic: 'position' }} />,
    );
    expect(screen.getByRole('img', { name: '6인 테이블의 자리' })).toBeInTheDocument();
    rerender(
      <EditorialImage
        alt="6인 테이블의 자리"
        decorative
        fallback={{ kind: 'learn', topic: 'position' }}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('with an asset, renders next/image filling the same aspect box, with the alt', () => {
    const { container } = renderBothThemes(
      <EditorialImage src="/og.png" alt="사이트 소셜 카드" aspect="3/2" sizes="100vw" />,
    );
    const box = container.firstElementChild;
    expect(box?.getAttribute('data-source')).toBe('asset');
    expect(box?.className).toContain('aspect-[3/2]');
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('사이트 소셜 카드');
    expect(img?.getAttribute('sizes')).toBe('100vw');
    expect(img?.className).toContain('object-cover');
  });

  it('a decorative asset gets an empty alt, not a missing one', () => {
    const { container } = renderBothThemes(<EditorialImage src="/og.png" alt="무시" decorative />);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('wraps itself in Figure when a caption is given', () => {
    const { container } = renderBothThemes(
      <EditorialImage
        alt="보드"
        caption="플랍까지 열린 보드"
        fallback={{ kind: 'hands', topic: 'rules' }}
      />,
    );
    expect(container.querySelector('figure figcaption')?.textContent).toBe('플랍까지 열린 보드');
  });
});
