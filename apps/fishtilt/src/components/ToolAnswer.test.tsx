import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolAnswer } from './ToolAnswer.js';

/*
 * The point of this component is a SURFACE, so the surface is what is pinned: a calculator's
 * answer sits on `ground-800`, the recessed rung, rather than on the same `panel-700` card as
 * the controls that produced it. A future "simplification" back to the panel surface would
 * undo WP-4's whole answer-emphasis change silently, so it fails here instead.
 */
describe('ToolAnswer', () => {
  it('renders the answer on the recessed surface, not the card surface', () => {
    const { container } = render(<ToolAnswer lead="이 콜이 본전이 되려면" value="33.3%" />);
    const well = container.firstElementChild;
    expect(well?.className).toContain('bg-ground-800');
    expect(well?.className).not.toContain('bg-panel-700');
  });

  it('shows the lead, the value and the meaning line, in that order', () => {
    render(
      <ToolAnswer
        lead="이 콜이 본전이 되려면"
        value="33.3%"
        note="이 정도는 이겨야 손해도 이득도 아닙니다."
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text.indexOf('이 콜이 본전이 되려면')).toBeLessThan(text.indexOf('33.3%'));
    expect(text.indexOf('33.3%')).toBeLessThan(text.indexOf('이 정도는 이겨야'));
  });

  it('renders nothing it was not given', () => {
    render(<ToolAnswer value="33.3%" />);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(document.body.textContent).toBe('33.3%');
  });

  it('uses tabular figures for a number and steps down for a Korean name', () => {
    const { container: number } = render(<ToolAnswer value="33.3%" />);
    expect(number.textContent).toBe('33.3%');
    expect(number.querySelector('p')?.className).toContain('tabular');
    expect(number.querySelector('p')?.className).toContain('text-4xl');

    const { container: name } = render(<ToolAnswer value="에이스 투페어" size="name" />);
    // Hangul at 36px wraps on a phone where a six-character percentage does not.
    expect(name.querySelector('p')?.className).toContain('text-3xl');
    expect(name.querySelector('p')?.className).not.toContain('tabular');
  });

  it('carries a caller-supplied block when the answer is not one value', () => {
    render(
      <ToolAnswer>
        <p>내 핸드 승률</p>
      </ToolAnswer>,
    );
    expect(screen.getByText('내 핸드 승률')).toBeInTheDocument();
  });
});
