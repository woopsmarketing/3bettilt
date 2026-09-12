import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { SplitLayout } from './SplitLayout.js';

describe('SplitLayout (D-S3-12)', () => {
  it('puts primary first in the DOM at every ratio', () => {
    for (const ratio of ['7/5', '5/7', '6/6'] as const) {
      const { container, unmount } = renderBothThemes(
        <SplitLayout ratio={ratio} primary={<p>주</p>} secondary={<p>보조</p>} />,
      );
      const root = container.firstElementChild;
      expect(root?.getAttribute('data-ratio')).toBe(ratio);
      expect(root?.children[0]?.textContent).toBe('주');
      expect(root?.children[1]?.textContent).toBe('보조');
      unmount();
    }
  });

  it('assigns the twelve-column spans the ratio names, from lg up only', () => {
    const { container } = renderBothThemes(
      <SplitLayout ratio="5/7" primary={<p>주</p>} secondary={<p>보조</p>} />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain('lg:grid-cols-12');
    expect(root?.children[0]?.className).toContain('lg:col-span-5');
    expect(root?.children[1]?.className).toContain('lg:col-span-7');
    // No column count below `lg`: one column on a phone.
    expect(root?.className).not.toMatch(/(^|\s)grid-cols-/u);
  });

  it('keeps both columns from overflowing a narrow screen', () => {
    const { container } = renderBothThemes(
      <SplitLayout primary={<p>주</p>} secondary={<p>보조</p>} />,
    );
    for (const column of container.firstElementChild?.children ?? []) {
      expect(column.className).toContain('min-w-0');
    }
  });
});
