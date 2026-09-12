import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizRelatedLinks } from './QuizRelatedLinks.js';

/*
 * Mocked wholesale rather than read from the live content graph / route registry: another
 * agent is concurrently authoring `src/content/registry/**`, and this component's own
 * contract ("a published concept is a link, a planned one is 준비 중"; "an available tool is
 * a link, an unavailable one is 준비 중") is provable with fixtures this test controls,
 * without depending on what has shipped there today (`docs/FISHTILT_STATE.md` ruling 26).
 *
 * `ToolCTA` reads `toolHref`/`toolRoute` from this same module, so both are mocked here too
 * — this file is the one boundary where that matters.
 */
vi.mock('../content/graph.js', () => ({
  contentById: vi.fn((id: string) => ({ id, title: `제목-${id}`, description: `설명-${id}` })),
  hrefOfContent: vi.fn((record: { id: string }) =>
    record.id === 'published-concept' ? `/glossary/${record.id}` : null,
  ),
  contentMeta: vi.fn(() => '초급 · 약 3분'),
  toolHref: vi.fn((routeId: string) => (routeId === 'available-tool' ? '/tools/available' : null)),
  toolRoute: vi.fn((routeId: string) => ({
    id: routeId,
    path: routeId === 'available-tool' ? '/tools/available' : '/tools/unavailable',
    label: routeId === 'available-tool' ? '사용 가능한 도구' : '준비 중인 도구',
    section: 'tools' as const,
    available: routeId === 'available-tool',
  })),
}));

describe('QuizRelatedLinks', () => {
  it('renders nothing when the question carries neither cross-link', () => {
    const { container } = render(<QuizRelatedLinks />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links a published related concept', () => {
    render(<QuizRelatedLinks relatedConcept="published-concept" />);
    expect(screen.getByRole('link', { name: /제목-published-concept/u })).toHaveAttribute(
      'href',
      '/glossary/published-concept',
    );
  });

  it('shows 준비 중 for a planned related concept instead of a link', () => {
    render(<QuizRelatedLinks relatedConcept="planned-concept" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
    expect(screen.getByText('제목-planned-concept')).toBeInTheDocument();
  });

  it('links an available related tool by its label under 직접 확인하기', () => {
    render(<QuizRelatedLinks relatedTool="available-tool" />);
    expect(screen.getByRole('link', { name: /사용 가능한 도구/u })).toHaveAttribute(
      'href',
      '/tools/available',
    );
  });

  it('shows 준비 중 for an unavailable related tool instead of a link', () => {
    render(<QuizRelatedLinks relatedTool="unavailable-tool" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
  });

  it('renders both cross-links together when the question carries both', () => {
    render(<QuizRelatedLinks relatedConcept="published-concept" relatedTool="available-tool" />);
    expect(screen.getByRole('link', { name: /제목-published-concept/u })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /사용 가능한 도구/u })).toBeInTheDocument();
  });
});
