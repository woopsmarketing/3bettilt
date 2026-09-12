import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { comboCountOf, handClassSet, percentageOf, RFI_RANGES } from '@gto-self/strategy-core';
import { RangeSummary } from './RangeSummary.js';

describe('RangeSummary', () => {
  it('renders the combo count, the 1326 universe, and the percentage — all computed, never literal', () => {
    const range = handClassSet('AA,KK,QQ'); // 3 pairs = 18 combos
    const { container } = render(<RangeSummary range={range} />);
    expect(comboCountOf(range)).toBe(18);
    expect(screen.getAllByText('18가지').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('1,326가지');
    const expectedPct = (percentageOf(range) * 100).toFixed(1);
    expect(container.textContent).toContain(`${expectedPct}%`);
  });

  it('renders the notation only when a page asks for it', () => {
    const range = handClassSet('66+,A3s+,K8s+,Q9s+,J9s+,T9s,ATo+,KJo+,QJo');
    const { unmount } = render(<RangeSummary range={range} showNotation />);
    expect(screen.getByText(/66\+/)).toBeInTheDocument();
    unmount();

    // The default is silence: an embed that has not taught the shorthand does not print it.
    render(<RangeSummary range={range} />);
    expect(screen.queryByText(/66\+/)).not.toBeInTheDocument();
  });

  it('renders the optional label and conditions', () => {
    render(
      <RangeSummary
        range={handClassSet('AA')}
        label="학습용 기본 레인지"
        conditions="6인 · 100BB · 아무도 참여하지 않았을 때 (First In)"
      />,
    );
    expect(screen.getByText('학습용 기본 레인지')).toBeInTheDocument();
    expect(
      screen.getByText('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)'),
    ).toBeInTheDocument();
  });

  it('omits label and conditions when not given', () => {
    render(<RangeSummary range={handClassSet('AA')} />);
    expect(screen.queryByText('학습용 기본 레인지')).not.toBeInTheDocument();
  });

  /*
   * WP-Q2 / P2-M2. `showNotation` produced an unexplained monospace wall — `33+,A2s+,K2s+,…`
   * with no key for `+`, `s` or `o`. This component's own doc says opting in is "a claim that
   * the surrounding page has earned it"; the key now travels WITH the notation, so a future
   * opt-in cannot ship the wall without it. Fails against the original component.
   */
  it('prints the syntax key whenever it prints the notation, and never otherwise', () => {
    const range = handClassSet('66+,A3s+,K8s+,QJo');
    const { unmount, container } = render(<RangeSummary range={range} showNotation />);
    expect(container.textContent).toContain('두 장의 무늬가 같음');
    expect(container.textContent).toContain('두 장의 무늬가 다름');
    expect(container.textContent).toContain('여기서부터 위쪽 전부');
    unmount();

    const plain = render(<RangeSummary range={range} />);
    expect(plain.container.textContent).not.toContain('여기서부터 위쪽 전부');
  });

  it('renders an honest empty-range notation rather than a blank line', () => {
    render(<RangeSummary range={handClassSet('')} showNotation />);
    expect(screen.getByText('(포함되는 핸드가 없습니다)')).toBeInTheDocument();
  });

  it('matches every shipped RFI range’s own computed numbers, never restating them', () => {
    for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const) {
      const range = RFI_RANGES[position];
      expect(range).not.toBeNull();
      if (!range) continue;
      const { unmount, container } = render(<RangeSummary range={range} />);
      expect(container.textContent).toContain(`${comboCountOf(range).toLocaleString('ko-KR')}가지`);
      unmount();
    }
  });
});
