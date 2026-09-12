import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { factValue } from '../../content/facts.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HandRfiSeats } from './HandRfiSeats.js';

describe('HandRfiSeats', () => {
  it('highlights exactly the seats whose shipped first-in range holds the hand (22 → SB)', () => {
    const { container } = renderBothThemes(<HandRfiSeats handClass={handClassByKey('22')!} />);
    expect(container.querySelector('[data-rfi-seats]')).toHaveAttribute('data-rfi-seats', 'SB');
    expect(container.querySelector('[data-highlight]')).toHaveAttribute('data-highlight', 'SB');
    // The seat abbreviation is also an SVG label in the diagram, so scope to the sentence.
    const sentence = container.querySelector('p')!;
    expect(sentence.textContent).toContain(factValue('RFI_POSITIONS_WITH', '22'));
    expect(sentence.textContent).toContain('다섯 자리 중 1곳');
  });

  it('highlights all five opening seats for A5s and none for 72o, without throwing', () => {
    const a5s = renderBothThemes(<HandRfiSeats handClass={handClassByKey('A5s')!} />);
    expect(a5s.container.querySelector('[data-rfi-seats]')).toHaveAttribute(
      'data-rfi-seats',
      'UTG HJ CO BTN SB',
    );
    a5s.unmount();
    const none = renderBothThemes(<HandRfiSeats handClass={handClassByKey('72o')!} />);
    expect(none.container.querySelector('[data-rfi-seats]')).toHaveAttribute(
      'data-rfi-seats',
      'none',
    );
    expect(screen.getByText(/한 자리도 없습니다/u)).toBeInTheDocument();
  });

  it('names the one supported condition as a learning baseline and the rest as unsupported — never GTO', () => {
    const { container } = renderBothThemes(<HandRfiSeats handClass={handClassByKey('AKs')!} />);
    expect(screen.getByText('학습용 기본 레인지')).toBeInTheDocument();
    expect(screen.getByText('지원하지 않음')).toBeInTheDocument();
    expect(screen.getAllByText(/First In/u).length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).not.toMatch(/GTO/iu);
  });
});
