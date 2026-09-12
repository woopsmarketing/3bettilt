import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizOnward } from './QuizOnward.js';

/*
 * Same fixture boundary `QuizRelatedLinks.test.tsx` draws: the content graph and the route
 * registry are mocked so this proves the component's own contract — a published lesson is
 * a link and a planned one is 준비 중; an available tool is a link and an unavailable one is
 * 준비 중 — independently of what has shipped in `src/content/registry/**` today.
 */
vi.mock('../content/graph.js', () => ({
  contentById: vi.fn((id: string) => ({ id, title: `제목-${id}`, description: `설명-${id}` })),
  hrefOfContent: vi.fn((record: { id: string }) =>
    record.id === 'published-lesson' ? `/learn/${record.id}` : null,
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

describe('QuizOnward', () => {
  it('links a published lesson under the page-owned heading', () => {
    render(<QuizOnward lessonHeading="다시 읽고 싶다면" lesson="published-lesson" />);
    expect(screen.getByRole('heading', { name: '다시 읽고 싶다면' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /제목-published-lesson/u })).toHaveAttribute(
      'href',
      '/learn/published-lesson',
    );
  });

  it('shows a planned lesson as inert 준비 중 text, never a dead link', () => {
    render(<QuizOnward lessonHeading="H" lesson="planned-lesson" />);
    expect(screen.getByText('제목-planned-lesson')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders no tool block at all when the page names no tool', () => {
    render(<QuizOnward lessonHeading="H" lesson="published-lesson" />);
    expect(screen.queryByText('직접 확인하기')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('links an available tool with the default `<label> 열기` action, or a page-supplied one', () => {
    const { rerender } = render(
      <QuizOnward lessonHeading="H" lesson="published-lesson" tool="available-tool" />,
    );
    expect(screen.getByRole('link', { name: '사용 가능한 도구 열기' })).toHaveAttribute(
      'href',
      '/tools/available',
    );
    rerender(
      <QuizOnward
        lessonHeading="H"
        lesson="published-lesson"
        tool="available-tool"
        toolHeading="표 전체를 보고 싶다면"
        toolAction="표 열기"
      />,
    );
    expect(screen.getByRole('heading', { name: '표 전체를 보고 싶다면' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '표 열기' })).toBeInTheDocument();
  });

  it('marks an unavailable tool 준비 중 instead of linking it', () => {
    render(<QuizOnward lessonHeading="H" lesson="published-lesson" tool="planned-tool" />);
    expect(screen.getByText('준비 중인 도구 열기')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /준비 중인 도구/u })).not.toBeInTheDocument();
  });
});
