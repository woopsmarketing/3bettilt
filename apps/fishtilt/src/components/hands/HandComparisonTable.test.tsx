import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { factValue } from '../../content/facts.js';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HandComparisonTable } from './HandComparisonTable.js';
import { rankNeighbours } from './handGraph.js';

const kk = handClassByKey('KK')!;

describe('HandComparisonTable', () => {
  it('is a captioned table whose rows are the rank neighbours, every figure a Fact', () => {
    renderBothThemes(<HandComparisonTable handClass={kk} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText(/기대되는 몫/u)).toBeInTheDocument();
    expect(within(table).getByText(/비기는 경우는 절반만/u)).toBeInTheDocument();

    const rows = rankNeighbours(kk);
    const headers = within(table).getAllByRole('rowheader');
    expect(headers).toHaveLength(rows.length);
    for (const { entry } of rows) {
      const header = headers.find((cell) => cell.textContent?.includes(entry.key));
      expect(header, entry.key).toBeDefined();
      const row = header!.closest('tr')!;
      expect(row.textContent).toContain(`${factValue('HAND_RANK', entry.key)}위`);
      expect(row.textContent).toContain(`${factValue('HAND_COMBOS', entry.key)}가지`);
      expect(row.textContent).toContain(factValue('HAND_EQUITY_VS_RANDOM', entry.key));
      expect(row.textContent).toContain(factValue('HAND_TOP_SHARE', entry.key));
    }
  });

  it('links a neighbour that has a page, marks the hand itself, and leaves the rest plain', () => {
    renderBothThemes(<HandComparisonTable handClass={kk} />);
    expect(screen.getByRole('link', { name: 'AA' })).toHaveAttribute(
      'href',
      localePath(DEFAULT_LOCALE, '/hands/aa'),
    );
    expect(screen.queryByRole('link', { name: 'KK' })).toBeNull();
    expect(screen.getByText('이 페이지')).toBeInTheDocument();
  });

  it('adds the suited/offsuit twin for a non-pair, labelled as such', () => {
    renderBothThemes(<HandComparisonTable handClass={handClassByKey('AKs')!} />);
    expect(screen.getByRole('link', { name: 'AKo' })).toHaveAttribute(
      'href',
      localePath(DEFAULT_LOCALE, '/hands/ako'),
    );
    expect(screen.getByText('같은 숫자, 다른 무늬')).toBeInTheDocument();
  });

  it('never says GTO and never renders a win-rate wording', () => {
    const { container } = renderBothThemes(<HandComparisonTable handClass={kk} />);
    expect(container.textContent).not.toMatch(/GTO/iu);
    expect(container.textContent).not.toContain('승률');
  });
});
