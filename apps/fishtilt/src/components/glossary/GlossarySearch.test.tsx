import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { applyGlossaryFilter, GlossarySearch } from './GlossarySearch.js';

const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/** A miniature of what the hub renders around the field. */
function Rows() {
  return (
    <>
      <section data-glossary-hide-on-search>
        <p>주제별로 보기</p>
      </section>
      <section data-glossary-group id="a">
        <ol>
          <li data-glossary-row data-search="쓰리벳|3-bet|3벳|3bet">
            쓰리벳
          </li>
          <li data-glossary-row data-search="스택|stack|칩">
            스택
          </li>
        </ol>
      </section>
      <section data-glossary-group id="b">
        <ol>
          <li data-glossary-row data-search="키커|kicker|옆카드">
            키커
          </li>
        </ol>
      </section>
    </>
  );
}

describe('applyGlossaryFilter', () => {
  it('shows everything for an empty query and restores the other sections', () => {
    render(<Rows />);
    expect(applyGlossaryFilter(document, '')).toBe(3);
    for (const row of document.querySelectorAll<HTMLElement>('[data-glossary-row]')) {
      expect(row.hidden).toBe(false);
    }
    expect(document.querySelector<HTMLElement>('[data-glossary-hide-on-search]')?.hidden).toBe(
      false,
    );
  });

  it('matches any name, ignoring case and spaces, and hides a tab with no match', () => {
    render(<Rows />);
    expect(applyGlossaryFilter(document, '3 Bet')).toBe(1);
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-glossary-row]'));
    expect(rows.map((row) => row.hidden)).toEqual([false, true, true]);
    expect(document.querySelector<HTMLElement>('#a')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('#b')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-glossary-hide-on-search]')?.hidden).toBe(
      true,
    );
    expect(applyGlossaryFilter(document, '카드')).toBe(1); // 옆카드
    expect(applyGlossaryFilter(document, 'zzz')).toBe(0);
  });
});

describe('GlossarySearch', () => {
  it('is a real GET form onto the site search, so it works with JavaScript off', () => {
    render(<GlossarySearch total={3} />);
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', ko('/search'));
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByRole('searchbox', { name: '용어 찾기' })).toHaveAttribute('name', 'q');
  });

  it('filters the rows as the reader types and reports the count in a live region', () => {
    render(
      <>
        <GlossarySearch total={3} />
        <Rows />
      </>,
    );
    const input = screen.getByRole('searchbox', { name: '용어 찾기' });
    fireEvent.change(input, { target: { value: '스택' } });
    expect(screen.getByText('1개 용어가 맞습니다.')).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-glossary-row]'));
    expect(rows.map((row) => row.hidden)).toEqual([true, false, true]);
  });

  it('offers the site-wide search when nothing here matches', () => {
    render(
      <>
        <GlossarySearch total={3} />
        <Rows />
      </>,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: '용어 찾기' }), {
      target: { value: '없는말' },
    });
    const link = screen.getByRole('link', { name: '사이트 전체에서 찾기' });
    expect(link).toHaveAttribute('href', `${ko('/search')}?q=%EC%97%86%EB%8A%94%EB%A7%90`);
  });

  it('renders identically in both themes with no literal colours', () => {
    renderBothThemes(<GlossarySearch total={3} />);
  });
});
