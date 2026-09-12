import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import { POSITION_GLOSS, POSITION_LABEL } from '../features/range/index.js';
import { PositionLegend } from './PositionLegend.js';

/*
 * `docs/FISHTILT_STATE.md` ruling 65. These assert the RULE — every abbreviation the control
 * above actually offers is explained exactly once, right here — rather than one hard-coded
 * line of legend copy (ruling 26). The Korean wording itself is pinned once, in
 * `features/range/copy.test.ts`.
 */
describe('PositionLegend', () => {
  it('glosses every position it is given, and only those', () => {
    render(<PositionLegend positions={['UTG', 'BTN']} />);
    expect(screen.getByText(/UTG 언더더건/u)).toBeInTheDocument();
    expect(screen.getByText(/BTN 버튼/u)).toBeInTheDocument();
    // A legend that explains a button the reader cannot see is noise.
    expect(screen.queryByText(/컷오프/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/하이잭/u)).not.toBeInTheDocument();
  });

  it('covers all six seats when all six are offered — a seventh cannot ship unglossed', () => {
    render(<PositionLegend positions={STRATEGY_POSITIONS} />);
    for (const position of STRATEGY_POSITIONS) {
      expect(
        screen.getByText(`${POSITION_LABEL[position]} ${POSITION_GLOSS[position]}`),
      ).toBeInTheDocument();
    }
  });

  it('keeps the abbreviation visible — the gloss is added beside it, never instead (ADR-0053)', () => {
    const { container } = render(<PositionLegend positions={STRATEGY_POSITIONS} />);
    const text = container.textContent ?? '';
    for (const position of STRATEGY_POSITIONS) {
      expect(text).toContain(POSITION_LABEL[position]);
    }
  });

  it('is hidden from assistive tech, because every button already announces its own gloss', () => {
    const { container } = render(<PositionLegend positions={['UTG']} />);
    // Otherwise a screen-reader user hears the whole table of abbreviations as one run-on
    // paragraph in addition to hearing each button say what it is.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing at all rather than an empty line when there is nothing to gloss', () => {
    const { container } = render(<PositionLegend positions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
