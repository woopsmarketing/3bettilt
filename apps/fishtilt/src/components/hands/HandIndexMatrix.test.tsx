import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HAND_CLASSES } from '@gto-self/strategy-core';
import { contentOfKind } from '../../content/graph.js';
import type { HandRecord } from '../../content/types.js';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HandIndexMatrix } from './HandIndexMatrix.js';

const RECORDS = contentOfKind('hands') as readonly HandRecord[];

/** A PLANNED record on a REAL class the registry does not cover, to prove the inert branch. */
const PLANNED_72O: HandRecord = {
  ...RECORDS[0]!,
  id: 'hand-fixture-72o',
  slug: 'fixture-72o',
  handKey: '72o',
  status: 'PLANNED',
  indexable: false,
  readMinutes: null,
};

describe('HandIndexMatrix', () => {
  it('draws all 169 classes in strategy-core’s grid order, as a static navigation', () => {
    const { container } = renderBothThemes(<HandIndexMatrix records={RECORDS} />);
    const nav = screen.getByRole('navigation', { name: '13×13 표에서 고르기' });
    const cells = nav.querySelectorAll('[data-row]');
    expect(cells).toHaveLength(169);
    cells.forEach((cell, index) => {
      expect(cell.textContent).toBe(HAND_CLASSES[index]!.key);
    });
    expect(container.querySelector('button')).toBeNull();
  });

  it('links every published record’s cell to its page and hides the uncovered cells from AT', () => {
    renderBothThemes(<HandIndexMatrix records={RECORDS} />);
    const nav = screen.getByRole('navigation', { name: '13×13 표에서 고르기' });
    const links = within(nav).getAllByRole('link');
    const published = RECORDS.filter((record) => record.status === 'PUBLISHED');
    expect(links).toHaveLength(published.length);
    for (const record of published) {
      const link = links.find((el) => el.textContent === record.handKey);
      expect(link, record.handKey).toHaveAttribute(
        'href',
        localePath(DEFAULT_LOCALE, `/hands/${record.slug}`),
      );
    }
    const hidden = nav.querySelectorAll('[aria-hidden="true"]');
    expect(hidden).toHaveLength(169 - RECORDS.length);
  });

  it('draws a planned record as covered but inert — never a link', () => {
    renderBothThemes(<HandIndexMatrix records={[...RECORDS, PLANNED_72O]} />);
    const nav = screen.getByRole('navigation', { name: '13×13 표에서 고르기' });
    const cell = nav.querySelector('[data-covered="planned"]');
    expect(cell?.textContent).toBe('72o');
    expect(cell?.tagName).toBe('SPAN');
    expect(within(nav).queryByRole('link', { name: /72o/u })).toBeNull();
  });

  it('states the covered count in words, not colour alone', () => {
    renderBothThemes(<HandIndexMatrix records={RECORDS} />);
    const published = RECORDS.filter((record) => record.status === 'PUBLISHED').length;
    expect(
      screen.getByText(`칠해진 ${published}칸이 페이지가 있는 패입니다.`, { exact: false }),
    ).toBeInTheDocument();
  });
});
