import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../features/search/index.js';
import { SearchResultList } from './SearchResultList.js';

/* Fixtures constructed here, never read out of the real registry — ruling 26. */

function result(
  overrides: Partial<SearchResult['record']> &
    Pick<SearchResult['record'], 'id' | 'kind' | 'title'>,
  score = 100,
): SearchResult {
  return {
    score,
    record: {
      description: '설명',
      href: `/${overrides.id}`,
      concepts: [],
      ...overrides,
    },
  };
}

describe('SearchResultList', () => {
  it('renders nothing at all when there are no results', () => {
    // Stage 3: the empty state is `SearchEmptyState`'s job; an empty list with a heading
    // would be a group header announcing zero rows.
    const { container } = render(<SearchResultList results={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('groups results by kind under a heading that carries the count', () => {
    render(
      <SearchResultList
        results={[
          result({ id: 'lesson-1', kind: 'learn', title: '레슨 하나' }),
          result({ id: 'lesson-2', kind: 'learn', title: '레슨 둘' }),
          result({ id: 'term-1', kind: 'glossary', title: '용어 하나' }),
        ]}
      />,
    );
    const learn = screen.getByRole('region', { name: /배우기/u });
    expect(learn).toHaveTextContent('2개');
    expect(learn.querySelectorAll('a')).toHaveLength(2);
    const glossary = screen.getByRole('region', { name: /용어/u });
    expect(glossary).toHaveTextContent('1개');
  });

  it('puts the group holding the best match first, and keeps rank order inside it', () => {
    // A fixed kind order would put LEARN above the exact glossary hit; the reader's best
    // answer is still the first row on the page.
    render(
      <SearchResultList
        results={[
          result({ id: 'term-position', kind: 'glossary', title: '포지션 용어' }, 300),
          result({ id: 'tool-range', kind: 'tool', title: '핸드레인지' }, 200),
          result({ id: 'lesson-a', kind: 'learn', title: '첫 레슨' }, 100),
          result({ id: 'lesson-b', kind: 'learn', title: '둘째 레슨' }, 100),
        ]}
      />,
    );
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toContain('용어');
    expect(headings[1]).toContain('도구');
    expect(headings[2]).toContain('배우기');
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName(expect.stringContaining('포지션 용어'));
    expect(links[2]).toHaveAccessibleName(expect.stringContaining('첫 레슨'));
    expect(links[3]).toHaveAccessibleName(expect.stringContaining('둘째 레슨'));
  });

  it('links every result to its own href', () => {
    render(
      <SearchResultList
        results={[
          result({
            id: 'term-range',
            kind: 'glossary',
            title: '패의 묶음 (Range)',
            href: '/glossary/range',
          }),
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: /패의 묶음/ });
    expect(link).toHaveAttribute('href', '/glossary/range');
  });

  it("shows the record's own description as the snippet, verbatim", () => {
    render(
      <SearchResultList
        results={[
          result({
            id: 'lesson-1',
            kind: 'learn',
            title: '레슨 하나',
            description: '이 레슨의 설명 그대로.',
          }),
        ]}
      />,
    );
    expect(screen.getByText('이 레슨의 설명 그대로.')).toBeInTheDocument();
  });

  it('shows the glossary term and the hand key beside the title, since that is what a reader types', () => {
    render(
      <SearchResultList
        results={[
          result({ id: 'term-range', kind: 'glossary', title: '패의 묶음 (Range)', term: 'Range' }),
          result({ id: 'hand-aks', kind: 'hands', title: '에이스 킹 수티드', handKey: 'AKs' }),
        ]}
      />,
    );
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('AKs')).toBeInTheDocument();
  });

  it('highlights the matched spelling once per line, and nothing without variants', () => {
    const results = [
      result({
        id: 'three-bet',
        kind: 'learn',
        title: '상대의 레이즈에 다시 레이즈 (3-Bet)',
        description: '3벳을 다시 3벳으로 설명합니다.',
      }),
    ];
    const { container, rerender } = render(<SearchResultList results={results} />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);

    rerender(<SearchResultList results={results} variants={['쓰리벳', '3벳', '3-bet']} />);
    const marks = Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks).toEqual(['3-Bet', '3벳']);
  });
});
