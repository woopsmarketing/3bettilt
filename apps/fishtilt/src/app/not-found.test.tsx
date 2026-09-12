import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routeById } from '../lib/routes.js';
import NotFound, { metadata, NOT_FOUND_DESTINATIONS } from './not-found.js';

describe('not-found', () => {
  it('has one h1, one main, and a Korean title of its own with no canonical', () => {
    render(<NotFound />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(String(metadata.title)).toMatch(/[가-힣]/u);
    // A 404 has no address: `null` here is what stops the root layout's canonical merging in.
    expect(metadata.alternates).toBeNull();
    expect(metadata.openGraph).toBeNull();
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('offers a search box that submits a plain GET to /search with the key the page reads', () => {
    render(<NotFound />);
    const form = screen.getByRole('search', { name: '사이트 검색' });
    expect(form).toHaveAttribute('action', routeById('search').path);
    expect(form).toHaveAttribute('method', 'get');
    const input = within(form).getByLabelText('검색어');
    expect(input).toHaveAttribute('name', 'q');
    expect(within(form).getByRole('button', { name: '검색' })).toHaveAttribute('type', 'submit');
  });

  it('links every built destination through the registry, and never a route that is not built', () => {
    render(<NotFound />);
    const list = screen.getByRole('navigation', { name: '많이 찾는 곳' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(4);
    for (const destination of NOT_FOUND_DESTINATIONS) {
      const route = routeById(destination.routeId);
      const link = within(list).queryByRole('link', { name: new RegExp(route.label, 'u') });
      if (route.available) {
        expect(link, route.id).toHaveAttribute('href', route.path);
      } else {
        expect(link, route.id).toBeNull();
      }
    }
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').toMatch(/^\//u);
    }
  });

  it('never shows the English built-in string', () => {
    render(<NotFound />);
    expect(document.body.textContent).not.toContain('This page could not be found');
  });
});
