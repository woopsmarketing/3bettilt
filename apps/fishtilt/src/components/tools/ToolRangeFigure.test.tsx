import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HAND_CLASSES, hasHandClass, RFI_RANGES } from '@gto-self/strategy-core';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { ToolRangeFigure } from './ToolRangeFigure.js';

const UTG = RFI_RANGES.UTG;
const BTN = RFI_RANGES.BTN;
if (UTG === null || BTN === null) throw new Error('shipped ranges missing');

describe('ToolRangeFigure', () => {
  it('is a picture, not a control: one role=img, 169 spans, no buttons, no list items', () => {
    const { container } = renderBothThemes(
      <ToolRangeFigure
        rangeA={UTG}
        labelA="UTG"
        rangeB={BTN}
        labelB="BTN"
        label="UTG와 BTN 겹친 표"
      />,
    );
    expect(screen.getByRole('img', { name: 'UTG와 BTN 겹친 표' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-key]')).toHaveLength(HAND_CLASSES.length);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('colours every cell from the two sets — both / one / neither', () => {
    const { container } = renderBothThemes(
      <ToolRangeFigure rangeA={UTG} labelA="UTG" rangeB={BTN} labelB="BTN" label="표" />,
    );
    for (const handClass of HAND_CLASSES) {
      const cell = container.querySelector(`[data-key="${handClass.key}"]`);
      const inA = hasHandClass(UTG, handClass.index);
      const inB = hasHandClass(BTN, handClass.index);
      const expected = inA && inB ? 'BOTH' : inA || inB ? 'ONE' : 'NEITHER';
      expect(cell?.getAttribute('data-membership'), handClass.key).toBe(expected);
      if (expected === 'ONE') expect(cell?.className).toContain('underline');
    }
  });

  it('marks one key with the brand fill and names it in the legend', () => {
    const { container } = renderBothThemes(
      <ToolRangeFigure rangeA={BTN} labelA="BTN" markKey="A9o" label="BTN 표" />,
    );
    expect(container.querySelector('[data-key="A9o"]')?.className).toContain('bg-brand-600');
    expect(screen.getByText('A9o 칸')).toBeInTheDocument();
    expect(screen.getByText('BTN에 있는 패')).toBeInTheDocument();
  });
});
