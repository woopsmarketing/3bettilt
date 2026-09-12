import { DEFAULT_LOCALE, localePath } from '../lib/locale.js';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RouteEntry } from '../lib/routes.js';
import { RouteNavItem } from './RouteNavItem.js';

const available: RouteEntry = {
  id: 'home',
  sitePath: '/',
  path: localePath(DEFAULT_LOCALE, '/'),
  label: '홈',
  section: 'home',
  available: true,
};

const unavailable: RouteEntry = {
  id: 'learn',
  sitePath: '/learn',
  path: localePath(DEFAULT_LOCALE, '/learn'),
  label: '배우기',
  section: 'learn',
  available: false,
};

describe('RouteNavItem', () => {
  it('renders an available route as a real link to its path', () => {
    render(<RouteNavItem route={available} />);
    const link = screen.getByRole('link', { name: '홈' });
    expect(link).toHaveAttribute('href', available.path);
  });

  it('renders an unavailable route as inert text with a 준비 중 badge, not a link', () => {
    render(<RouteNavItem route={unavailable} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('배우기')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('keeps unavailable route text at a readable colour, not dimmed below AA', () => {
    render(<RouteNavItem route={unavailable} />);
    const label = screen.getByText('배우기');
    expect(label.className).toContain('text-300');
    expect(label.className).not.toContain('text-500');
  });

  it('marks the current section with aria-current, not only with a colour', () => {
    render(<RouteNavItem route={available} active />);
    const link = screen.getByRole('link', { name: '홈' });
    expect(link).toHaveAttribute('aria-current', 'page');
    // Colour is never the only carrier (WCAG 1.4.1): the underline is what survives greyscale.
    expect(link.className).toContain('text-brand-500');
    expect(link.className).toContain('underline');
  });

  it('leaves aria-current off every entry that is not the current one', () => {
    render(<RouteNavItem route={available} />);
    const link = screen.getByRole('link', { name: '홈' });
    expect(link).not.toHaveAttribute('aria-current');
    expect(link.className).not.toContain('underline');
  });
});
