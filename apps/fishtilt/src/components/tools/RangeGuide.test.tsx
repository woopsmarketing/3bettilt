import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COMBO_COUNT, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import {
  compareRanges,
  guideCount,
  guidePercent,
  positionRangeRows,
  unsupportedConditions,
  walkthrough,
} from '../../features/tools/index.js';
import { RANGE_PROVENANCE_SENTENCE } from '../../features/range/index.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { RANGE_GUIDE_HEADINGS, RangeGuide } from './RangeGuide.js';

describe('RangeGuide', () => {
  it('renders every section in the table of contents as a named region with an h2', () => {
    renderBothThemes(<RangeGuide />);
    const toc = screen.getByRole('navigation', { name: '목차' });
    for (const heading of RANGE_GUIDE_HEADINGS) {
      expect(within(toc).getByRole('link', { name: heading.text })).toHaveAttribute(
        'href',
        `#${heading.id}`,
      );
      const region = screen.getByRole('region', { name: heading.text });
      expect(region.id).toBe(heading.id);
      expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent(heading.text);
    }
  });

  it('prints the seat table and the comparison from the data, not literals', () => {
    renderBothThemes(<RangeGuide />);
    const seats = screen.getByRole('region', { name: '자리(포지션)가 중요한 이유' });
    for (const row of positionRangeRows()) {
      if (row.comboCount === null) {
        expect(seats.textContent).toContain(row.unsupportedReason ?? '');
        expect(within(seats).getAllByText('지원하지 않음').length).toBeGreaterThan(0);
      } else {
        expect(within(seats).getAllByText(guideCount(row.comboCount)).length).toBeGreaterThan(0);
      }
    }
    const comparison = compareRanges();
    const compare = screen.getByRole('region', { name: 'UTG와 BTN 비교' });
    expect(within(compare).getAllByText(guidePercent(comparison.a.share)).length).toBeGreaterThan(
      0,
    );
    expect(within(compare).getAllByText(guidePercent(comparison.b.share)).length).toBeGreaterThan(
      0,
    );
    expect(within(compare).getAllByText(guideCount(comparison.onlyBCombos)).length).toBeGreaterThan(
      0,
    );
    expect(within(compare).getByRole('img', { name: /13×13 표/u })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '핸드레인지는 무엇을 그린 표인가' }).textContent,
    ).toContain(String(HAND_CLASS_COUNT));
  });

  it('walks the hand the module chose, with its combo count and the seats that open it', () => {
    renderBothThemes(<RangeGuide />);
    const walk = walkthrough();
    const region = screen.getByRole('region', { name: '패 하나로 따라가기' });
    expect(region.textContent).toContain(walk.description);
    expect(region.textContent).toContain(`실제 조합 ${walk.comboCount}가지`);
    expect(within(region).getByRole('img', { name: /13×13 표/u })).toBeInTheDocument();
    const link = within(region).getByRole('link', { name: /직접 눌러보기/u });
    expect(link.getAttribute('href')).toMatch(/\/tools\/range\?hero=BTN&spot=RFI&stack=100$/u);
  });

  it('states the provenance sentence and lists every unsupported condition as such', () => {
    renderBothThemes(<RangeGuide />);
    expect(screen.getByRole('region', { name: '이 표가 다루는 조건' }).textContent).toContain(
      RANGE_PROVENANCE_SENTENCE,
    );
    const unsupported = screen.getByRole('region', { name: '지원하지 않는 조건' });
    for (const condition of unsupportedConditions()) {
      expect(unsupported.textContent).toContain(condition.label);
      expect(unsupported.textContent).toContain(condition.reason);
    }
    expect(document.body.textContent).toContain(guideCount(COMBO_COUNT));
  });

  it('never says GTO and adds no buttons (the explorer above owns the 169 cells)', () => {
    const { container } = renderBothThemes(<RangeGuide />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
    expect(container.querySelectorAll('button:not([popovertarget])')).toHaveLength(0);
  });
});
