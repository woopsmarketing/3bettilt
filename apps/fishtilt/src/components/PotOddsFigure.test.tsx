import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { potOdds } from '@gto-self/learn-core';
import { PotOddsFigure } from './PotOddsFigure.js';

/** The article's own numbers: pot 6BB, hero faces a half-pot 3BB bet. */
const ODDS = potOdds({
  potBeforeCallMbb: Money.fromBB(6),
  villainBetMbb: Money.fromBB(3),
  callAmountMbb: Money.fromBB(3),
});

describe('PotOddsFigure', () => {
  it('splits the bar into the three amounts that make the final pot', () => {
    const { container } = render(<PotOddsFigure pot="6" bet="3" />);
    const slices = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(slices).toHaveLength(3);
  });

  it('sizes every slice from Money.ratio, never from arithmetic in the component', () => {
    /*
     * CLAUDE.md rule 1. The widths are the only numbers this component puts on screen as
     * geometry, and they are recomputed here from `potOdds` + `Money.ratio` so a slice that
     * drifted (say, dividing by the pot BEFORE the call — the exact mistake this picture
     * exists to prevent) fails the test.
     */
    expect(ODDS.ok).toBe(true);
    if (!ODDS.ok) return;
    const { container } = render(<PotOddsFigure pot="6" bet="3" />);
    const widths = [...container.querySelectorAll('[aria-hidden="true"] > span')].map(
      (node) => (node as HTMLElement).style.width,
    );
    const expected = [
      ODDS.value.potBeforeCallMbb,
      ODDS.value.calledBetMbb,
      ODDS.value.callAmountMbb,
    ].map((part) => `${(Money.ratio(part, ODDS.value.finalPotMbb) ?? 0) * 100}%`);
    expect(widths).toEqual(expected);
    // The three pieces are the whole pot and nothing more.
    expect(
      Money.add(
        Money.add(ODDS.value.potBeforeCallMbb, ODDS.value.calledBetMbb),
        ODDS.value.callAmountMbb,
      ),
    ).toBe(ODDS.value.finalPotMbb);
  });

  it('states every amount as words, formatted the way the tools format money', () => {
    render(<PotOddsFigure pot="6" bet="3" />);
    expect(screen.getByText('원래 팟 6 BB')).toBeInTheDocument();
    expect(screen.getByText('상대 베팅 3 BB')).toBeInTheDocument();
    expect(screen.getByText('내 콜 3 BB')).toBeInTheDocument();
    expect(screen.getByText(/콜한 뒤의 최종 팟 12 BB/u)).toBeInTheDocument();
  });

  it('prints no percentage — the article’s <Fact> owns the required equity', () => {
    const { container } = render(<PotOddsFigure pot="6" bet="3" />);
    expect(container.textContent).not.toContain('%');
    expect(ODDS.ok).toBe(true);
    if (ODDS.ok) {
      expect(container.textContent).not.toContain((ODDS.value.requiredEquity * 100).toFixed(2));
    }
  });

  it('never tells the reader to call', () => {
    // A break-even price is arithmetic. Every pot-odds surface on this site holds this line.
    const { container } = render(<PotOddsFigure pot="6" bet="3" />);
    for (const forbidden of ['콜하세요', '콜해야', '유리합니다', '이득', 'GTO']) {
      expect(container.textContent, forbidden).not.toContain(forbidden);
    }
  });

  it('throws rather than drawing a call that does not exist', () => {
    expect(() => render(<PotOddsFigure pot="6" bet="0" />)).toThrow(/NON_POSITIVE_CALL/u);
    expect(() => render(<PotOddsFigure pot="6" bet="어" />)).toThrow(/not a BB amount/u);
  });

  it('paints only through tokens', () => {
    const { container } = render(<PotOddsFigure pot="6" bet="3" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(container.innerHTML).not.toMatch(/\brgba?\(/iu);
    expect(container.innerHTML).toContain('bg-act-raise-500');
  });
});
