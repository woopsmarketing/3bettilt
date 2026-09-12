import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { routeById } from '../lib/routes.js';
import type * as RoutesModule from '../lib/routes.js';
import { ToolCTA } from './ToolCTA.js';

/*
 * The two behaviours that matter: the deep link carries the article's context, and a tool
 * that is not built yet is never rendered as a link that would 404.
 */

/**
 * Every tool has shipped, so the live registry has nothing left to search for as "not built
 * yet". That does not retire the "renders 준비 중, not a link" behaviour — it is still real,
 * still part of the CTA contract — so the fixture comes from a mock this test controls
 * rather than from hunting the registry for a fact about today's build state (the same trap
 * `routes.test.ts` documents for `available` itself). This forces `toolOuts` unavailable and
 * leaves every other route, `range` included, exactly as the registry defines it.
 */
vi.mock('../lib/routes.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RoutesModule>();
  const ROUTES = actual.ROUTES.map((route) =>
    route.id === 'toolOuts' ? { ...route, available: false } : route,
  );
  const BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
  return {
    ...actual,
    ROUTES,
    routeById: (id: string) => {
      const route = BY_ID.get(id);
      if (!route) throw new Error(`No such route id: "${id}"`);
      return route;
    },
  };
});

const UNBUILT_TOOL_ID = 'toolOuts';

describe('ToolCTA', () => {
  it('renders the contextual sentence the article wrote, not a generic label', () => {
    render(<ToolCTA tool="range" title="UTG와 BTN을 나란히 놓고 비교해볼까요?" />);
    expect(screen.getByText('UTG와 BTN을 나란히 놓고 비교해볼까요?')).toBeInTheDocument();
  });

  it('deep-links with the article’s parameters when the tool exists', () => {
    const route = routeById('range');
    if (!route.available) return; // covered by the unavailable case below
    render(
      <ToolCTA
        tool="range"
        params={{ hero: 'BTN', spot: 'RFI', stack: '100' }}
        title="직접 확인해보세요"
        action="열기"
      />,
    );
    expect(screen.getByRole('link', { name: '열기' })).toHaveAttribute(
      'href',
      `${route.path}?hero=BTN&spot=RFI&stack=100`,
    );
  });

  it('renders no link at all for a tool that is not built yet — it says 준비 중', () => {
    // `UNBUILT_TOOL_ID` is forced unavailable by the module mock above, not found by
    // searching the live registry — every tool has shipped, so that search would come up
    // empty (the same trap `routes.test.ts` documents), and this behaviour is permanent.
    render(<ToolCTA tool={UNBUILT_TOOL_ID} title="아웃을 세어볼까요?" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('falls back to the route’s own label for the action word', () => {
    render(<ToolCTA tool={UNBUILT_TOOL_ID} title="제목" />);
    expect(screen.getByText(`${routeById(UNBUILT_TOOL_ID).label} 열기`)).toBeInTheDocument();
  });

  it('throws for a tool id that is not in the route registry', () => {
    expect(() => render(<ToolCTA tool="not-a-route" title="제목" />)).toThrow(/No such route/u);
  });
});
