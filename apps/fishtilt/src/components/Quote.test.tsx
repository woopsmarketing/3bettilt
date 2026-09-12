import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { Quote } from './Quote.js';

describe('Quote (D-S3-13)', () => {
  it('is a figure with a blockquote and an attached attribution', () => {
    const { container } = renderBothThemes(<Quote cite="어느 테이블에서">폴드도 플레이다.</Quote>);
    const figure = container.querySelector('figure');
    expect(figure?.querySelector('blockquote')?.textContent).toBe('폴드도 플레이다.');
    expect(figure?.querySelector('figcaption')?.textContent).toBe('— 어느 테이블에서');
    expect(figure?.className).toContain('border-brand-500');
  });

  it('omits the attribution when there is none', () => {
    const { container } = renderBothThemes(<Quote>한 줄.</Quote>);
    expect(container.querySelector('figcaption')).toBeNull();
  });
});
