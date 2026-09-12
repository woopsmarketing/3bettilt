import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SearchRecord } from '../features/search/index.js';
import { SearchClient } from './SearchClient.js';

/*
 * Fixtures constructed here, never read out of the real registry — `SearchClient` accepts a
 * `records` prop for exactly this reason (ruling 26): the real `SEARCH_INDEX` it defaults to
 * is built from content other agents are publishing concurrently with this WP.
 */
const FIXTURE_RECORDS: readonly SearchRecord[] = [
  {
    id: 'tool:toolPotOdds',
    kind: 'tool',
    title: '팟 오즈 계산기',
    description: '콜하려면 몇 퍼센트를 이겨야 본전인지 계산합니다.',
    href: '/tools/pot-odds',
    concepts: [],
  },
  {
    id: 'term-range',
    kind: 'glossary',
    title: '패의 묶음 (Range)',
    description: '레인지는 상대가 들고 있을 수 있는 패 전체를 뜻합니다.',
    href: '/glossary/range',
    concepts: ['range'],
    term: 'Range',
    aliases: ['레인지'],
    shortDefinition: '한 사람이 들고 있을 수 있는 시작 패 전부를 묶어 부르는 말입니다.',
  },
];

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  goTo('/search');
});

afterEach(() => {
  goTo('/search');
});

describe('SearchClient', () => {
  it('has a properly labelled search input', () => {
    render(<SearchClient records={FIXTURE_RECORDS} />);
    expect(screen.getByLabelText('검색어')).toBeInTheDocument();
  });

  it('prompts, rather than claiming zero results, before anything is typed', () => {
    render(<SearchClient records={FIXTURE_RECORDS} />);
    expect(screen.getByRole('status')).toHaveTextContent('검색어를 입력해보세요');
  });

  it('keeps one Tab between the box and the first result: the clear button is not a Tab stop, and Escape clears instead', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    const input = screen.getByLabelText('검색어');
    await user.type(input, '레인지');
    expect(screen.getByRole('button', { name: '입력 지우기' })).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(document.activeElement?.tagName).toBe('A');

    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('updates results as the user types, and announces the count', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await user.type(screen.getByLabelText('검색어'), '레인지');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /패의 묶음/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('1개 결과');
    expect(screen.queryByRole('link', { name: /팟 오즈/ })).not.toBeInTheDocument();
  });

  it('finds a Korean query with different spacing than the record it targets', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await user.type(screen.getByLabelText('검색어'), '팟오즈');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /팟 오즈/ })).toBeInTheDocument();
    });
  });

  it('shows an honest empty state, with hub links, for a genuine miss', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await user.type(screen.getByLabelText('검색어'), '완전히무관한검색어xyz');
    await waitFor(() => {
      expect(
        screen.getByText('"완전히무관한검색어xyz"에 대한 결과를 찾지 못했습니다'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '배우기' })).toBeInTheDocument();
  });

  it('keeps the query in the URL as the user types, without a full navigation', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await user.type(screen.getByLabelText('검색어'), 'range');
    await waitFor(() => {
      expect(window.location.search).toBe('?q=range');
    });
  });

  it('is a search landmark with a clear button that empties the box and refocuses it', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    expect(screen.getByRole('search', { name: '사이트 검색' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '입력 지우기' })).not.toBeInTheDocument();

    const input = screen.getByLabelText('검색어');
    await user.type(input, '레인지');
    await user.click(screen.getByRole('button', { name: '입력 지우기' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('검색어를 입력해보세요');
  });

  it('groups results under kind headings and highlights the matched spelling', async () => {
    const user = userEvent.setup();
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await user.type(screen.getByLabelText('검색어'), '레인지');
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /용어/u })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 2, name: /용어/u })).toHaveTextContent('1개');
    const marks = Array.from(document.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark?.toLowerCase()).toMatch(/레인지|range/u);
  });

  it('reads the query from the URL on load', async () => {
    goTo('/search?q=레인지');
    render(<SearchClient records={FIXTURE_RECORDS} />);
    await waitFor(() => {
      expect(screen.getByLabelText('검색어')).toHaveValue('레인지');
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /패의 묶음/ })).toBeInTheDocument();
    });
  });
});
