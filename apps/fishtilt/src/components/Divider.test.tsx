import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { Divider } from './Divider.js';

describe('Divider (D-S3-12)', () => {
  it('is a real separator in every variant', () => {
    for (const variant of ['line', 'brand', 'space'] as const) {
      const { unmount } = renderBothThemes(<Divider variant={variant} />);
      const hr = screen.getByRole('separator');
      expect(hr.tagName).toBe('HR');
      expect(hr.getAttribute('data-variant')).toBe(variant);
      unmount();
    }
  });

  it('draws the line with the border token and the brand mark with the brand FILL token', () => {
    const { container, rerender } = renderBothThemes(<Divider />);
    expect(container.querySelector('hr')?.className).toContain('border-line-500');
    rerender(<Divider variant="brand" />);
    expect(container.querySelector('hr')?.className).toContain('bg-brand-600');
    expect(container.querySelector('hr')?.className).not.toContain('bg-brand-500');
  });
});
