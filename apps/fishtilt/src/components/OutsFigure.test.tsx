import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { outsOdds, UNSEEN_AFTER_FLOP, UNSEEN_AFTER_TURN } from '@gto-self/learn-core';
import { OutsFigure } from './OutsFigure.js';

describe('OutsFigure', () => {
  it('draws one square per unseen card, with the domain’s own count', () => {
    /*
     * The pile size is `outsOdds`' `unseenCards`, never a number typed into the component.
     * Asserted against `learn-core`'s own constants so a drawing that quietly went to 52 (or
     * to 47 on the turn) fails here rather than teaching a wrong denominator.
     */
    const { container } = render(<OutsFigure outs={9} street="FLOP" />);
    expect(container.querySelectorAll('rect')).toHaveLength(UNSEEN_AFTER_FLOP);

    const { container: turn } = render(<OutsFigure outs={9} street="TURN" />);
    expect(turn.querySelectorAll('rect')).toHaveLength(UNSEEN_AFTER_TURN);
  });

  it('fills exactly as many squares as there are outs', () => {
    const { container } = render(<OutsFigure outs={9} street="FLOP" />);
    const filled = container.querySelectorAll('g[fill="currentColor"] rect');
    expect(filled).toHaveLength(9);
    const outlined = container.querySelectorAll('g[fill="none"] rect');
    expect(outlined).toHaveLength(UNSEEN_AFTER_FLOP - 9);
  });

  it('states both counts as words, so nothing is carried by colour alone', () => {
    render(<OutsFigure outs={9} street="FLOP" />);
    expect(screen.getByText('아웃츠 9장')).toBeInTheDocument();
    expect(screen.getByText(`아웃츠가 아닌 ${UNSEEN_AFTER_FLOP - 9}장`)).toBeInTheDocument();
    expect(
      screen.getByText(`플랍에서 아직 보이지 않는 카드 ${UNSEEN_AFTER_FLOP}장`),
    ).toBeInTheDocument();
  });

  it('prints no probability — the article’s <Fact> owns that number', () => {
    /*
     * A second rendering of the same quantity, with its own rounding, is how one page ends up
     * showing two different numbers for one fact. The picture shows WHICH ratio; the sentence
     * beside it states the value.
     */
    const { container } = render(<OutsFigure outs={9} street="FLOP" />);
    expect(container.textContent).not.toContain('%');
    const exact = outsOdds({ outs: 9, street: 'FLOP' });
    expect(exact.ok).toBe(true);
    if (exact.ok) {
      expect(container.textContent).not.toContain((exact.value.byRiverProb * 100).toFixed(2));
    }
  });

  it('throws rather than drawing a plausible grid for an impossible draw', () => {
    // CLAUDE.md rule 5. Every content route is prerendered, so this is a build failure.
    expect(() => render(<OutsFigure outs={99} street="FLOP" />)).toThrow(/OUTS_EXCEED_UNSEEN/u);
    expect(() => render(<OutsFigure outs={-1} street="FLOP" />)).toThrow(/NEGATIVE_OUTS/u);
    expect(() => render(<OutsFigure outs={2.5} street="FLOP" />)).toThrow(/NON_INTEGER_OUTS/u);
  });

  it('accepts the two edge counts the domain accepts', () => {
    // `outsOdds` answers 0 for a dead draw and 1 for a certain one; the picture must not be
    // stricter than the function it draws.
    expect(() => render(<OutsFigure outs={0} street="TURN" />)).not.toThrow();
    expect(() => render(<OutsFigure outs={UNSEEN_AFTER_TURN} street="TURN" />)).not.toThrow();
  });

  it('hides the picture from assistive tech and paints only through tokens', () => {
    const { container } = render(<OutsFigure outs={9} street="FLOP" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(container.innerHTML).not.toMatch(/\brgba?\(/iu);
    expect(container.innerHTML).toContain('text-act-raise-500');
  });
});
