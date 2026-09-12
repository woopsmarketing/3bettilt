import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEARCH_HUB_ROUTE_IDS } from '../features/search/index.js';
import { routeById } from '../lib/routes.js';
import { SearchEmptyState } from './SearchEmptyState.js';

describe('SearchEmptyState', () => {
  it('shows a neutral prompt, not a "no results" message, when nothing has been typed', () => {
    render(<SearchEmptyState query="" />);
    expect(screen.getByText('무엇을 찾고 계신가요?')).toBeInTheDocument();
    expect(screen.queryByText(/결과를 찾지 못했습니다/)).not.toBeInTheDocument();
  });

  it('names the query in an honest "no matches" message for a real miss', () => {
    render(<SearchEmptyState query="완전히무관한검색어" />);
    expect(screen.getByText('"완전히무관한검색어"에 대한 결과를 찾지 못했습니다')).toBeInTheDocument();
  });

  it('never fabricates a "did you mean" suggestion', () => {
    render(<SearchEmptyState query="완전히무관한검색어" />);
    expect(screen.queryByText(/찾으신 건가요|did you mean/iu)).not.toBeInTheDocument();
  });

  it('links every section hub, resolved through routeById', () => {
    render(<SearchEmptyState query="" />);
    for (const id of SEARCH_HUB_ROUTE_IDS) {
      const route = routeById(id);
      const link = screen.getByRole('link', { name: route.label });
      expect(link).toHaveAttribute('href', route.path);
    }
  });
});
