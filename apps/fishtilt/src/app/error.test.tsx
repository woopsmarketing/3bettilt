import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { routeById } from '../lib/routes.js';
import RouteError from './error.js';

describe('error boundary page', () => {
  it('has one h1 inside one main, retries from its primary button, and links home', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<RouteError error={new Error('boom')} reset={reset} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: '홈으로 가기' })).toHaveAttribute(
      'href',
      routeById('home').path,
    );
  });

  it('shows the digest when React provides one, and nothing about a report that was never sent', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    render(<RouteError error={error} reset={vi.fn()} />);
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/보고되었습니다|전송되었습니다/u);
    // The raw message is never printed — in production it is a generic string anyway.
    expect(document.body.textContent).not.toContain('boom');
  });

  it('offers the hubs as a way out, all through the registry', () => {
    render(<RouteError error={new Error('boom')} reset={vi.fn()} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(4);
    for (const link of links) {
      expect(link.getAttribute('href') ?? '').toMatch(/^\//u);
    }
  });
});
