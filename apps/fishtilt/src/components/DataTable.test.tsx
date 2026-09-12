import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { ComparisonTable } from './ComparisonTable.js';
import { DataTable } from './DataTable.js';

const COLUMNS = [
  { key: 'hand', label: '핸드' },
  { key: 'combos', label: '콤보', numeric: true, align: 'end' as const },
  { key: 'note', label: '메모', highlight: true },
];
const ROWS = [
  { cells: { hand: 'AA', combos: <span data-testid="fact">6</span>, note: '가장 강한 시작 패' } },
  { cells: { hand: 'AKs', combos: '4', note: '같은 무늬' } },
];

describe('DataTable (D-S3-13)', () => {
  it('is a captioned table with column headers and, when asked, row headers', () => {
    renderBothThemes(
      <DataTable caption="시작 패 두 가지" columns={COLUMNS} rows={ROWS} rowHeader="hand" />,
    );
    const table = screen.getByRole('table', { name: '시작 패 두 가지' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['핸드', '콤보', '메모']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((th) => th.textContent),
    ).toEqual(['AA', 'AKs']);
    expect(within(table).getByTestId('fact')).toHaveTextContent('6');
  });

  it('scrolls inside its own wrapper rather than the page', () => {
    const { container } = renderBothThemes(<DataTable caption="c" columns={COLUMNS} rows={ROWS} />);
    // WP-S3-17: the scroller is the inner `[data-scroller]` box; the `.table-scroll` box
    // around it positions the right-edge fade that says "there is more table to the right".
    expect(container.querySelector('.table-scroll > [data-scroller]')?.className).toContain(
      'overflow-x-auto',
    );
  });

  it('keeps the visible caption outside the fade box, so a wide table cannot erase its end (B-M5)', () => {
    const { container } = renderBothThemes(
      <DataTable caption="자리별 크기 · 6인 · 100BB · First In" columns={COLUMNS} rows={ROWS} />,
    );
    const visible = container.querySelector('[data-table-caption]');
    expect(visible).toHaveTextContent('6인 · 100BB · First In');
    expect(visible?.closest('.table-scroll')).toBeNull();
    // Reads once for assistive tech: the `<caption>` is the name, the visible copy is hidden.
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('table > caption')).toHaveTextContent('First In');
  });

  it('marks the highlighted column in the data and in the header ink, and sets numbers tabular', () => {
    const { container } = renderBothThemes(<DataTable caption="c" columns={COLUMNS} rows={ROWS} />);
    const headers = container.querySelectorAll('th[scope="col"]');
    expect(headers[2]?.getAttribute('data-highlight')).toBe('true');
    expect(headers[2]?.className).toContain('text-brand-500');
    expect(headers[1]?.className).toContain('tabular');
    expect(headers[1]?.className).toContain('text-right');
    expect(container.querySelectorAll('td[data-highlight="true"]')).toHaveLength(2);
  });
});

describe('ComparisonTable (D-S3-13)', () => {
  it('renders the criterion as the row header and each option as a column', () => {
    renderBothThemes(
      <ComparisonTable
        caption="콜과 폴드"
        options={[
          { key: 'call', label: '콜', highlight: true },
          { key: 'fold', label: '폴드' },
        ]}
        rows={[
          { criterion: '언제', cells: { call: '승률이 충분할 때', fold: '부족할 때' } },
          { criterion: '비용', cells: { call: '콜 금액', fold: '0' } },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: '콜과 폴드' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['기준', '콜', '폴드']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((th) => th.textContent),
    ).toEqual(['언제', '비용']);
    expect(
      within(table).getByRole('columnheader', { name: '콜' }).getAttribute('data-highlight'),
    ).toBe('true');
  });
});
