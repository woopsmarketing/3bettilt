import { screen } from '@testing-library/react';
import { STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { PositionDiagram } from './PositionDiagram.js';

describe('PositionDiagram (D-S3-15)', () => {
  it('draws all six seats as live text, named for assistive tech', () => {
    const { container } = renderBothThemes(<PositionDiagram />);
    const seats = [...container.querySelectorAll('[data-seat]')].map((g) => g.getAttribute('data-seat'));
    expect(new Set(seats)).toEqual(new Set(STRATEGY_POSITIONS));
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual(
      expect.arrayContaining([...STRATEGY_POSITIONS]),
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('여섯 자리');
    expect(container.querySelector('[data-dealer-button]')).not.toBeNull();
  });

  it('highlights the requested seat(s) with the brand fill and says so in the name', () => {
    const { container } = renderBothThemes(<PositionDiagram highlight={['BTN', 'CO']} />);
    const on = [...container.querySelectorAll('[data-seat][data-on="true"]')].map((g) => g.getAttribute('data-seat'));
    expect(on).toEqual(expect.arrayContaining(['BTN', 'CO']));
    expect(on).toHaveLength(2);
    const btn = container.querySelector('[data-seat="BTN"] circle');
    expect(btn?.getAttribute('class')).toContain('fill-brand-600');
    expect(container.querySelector('[data-seat="BTN"] text')?.getAttribute('class')).toContain('fill-ink-on-brand');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('버튼(BTN)');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('컷오프(CO)');
  });

  it('accepts a single seat, can drop the button, and wraps in Figure with a caption', () => {
    const { container } = renderBothThemes(
      <PositionDiagram highlight="UTG" showButton={false} caption="UTG는 가장 먼저 말하는 자리" />,
    );
    expect(container.querySelector('[data-dealer-button]')).toBeNull();
    expect(container.querySelector('figure figcaption')?.textContent).toBe('UTG는 가장 먼저 말하는 자리');
    expect(container.querySelector('[data-seat="UTG"]')?.getAttribute('data-on')).toBe('true');
  });

  it('never exceeds the figure width token and paints only with tokens', () => {
    const { container } = renderBothThemes(<PositionDiagram />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('max-w-figure');
  });
});
