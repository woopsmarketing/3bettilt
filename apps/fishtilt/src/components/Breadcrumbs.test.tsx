/**
 * `Breadcrumbs` renders two things from one array, and the assertion that matters is that
 * they agree: what a reader sees and what a crawler reads must be the same trail. A
 * `BreadcrumbList` describing a path the page does not show is schema spam whether or not
 * anyone meant it (build spec §35).
 *
 * The trail is constructed here rather than taken from a real record — the component's
 * contract is about trails, not about which lessons exist today (ruling 26).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from './Breadcrumbs.js';
import { SITE_ORIGIN, type BreadcrumbItem } from '../lib/seo/index.js';

const TRAIL: readonly BreadcrumbItem[] = [
  { label: '홈', path: '/', current: false },
  { label: '배우기', path: '/learn', current: false },
  { label: '팟 오즈 계산하기', path: '/learn/pot-odds', current: true },
];

function jsonLdBlocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (node) => JSON.parse(node.textContent ?? '') as Record<string, unknown>,
  );
}

describe('Breadcrumbs', () => {
  it('renders a named navigation landmark', () => {
    render(<Breadcrumbs trail={TRAIL} />);
    expect(screen.getByRole('navigation', { name: '현재 위치' })).toBeInTheDocument();
  });

  it('links every ancestor and never the page you are already on', () => {
    render(<Breadcrumbs trail={TRAIL} />);
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '배우기' })).toHaveAttribute('href', '/learn');
    expect(screen.queryByRole('link', { name: '팟 오즈 계산하기' })).not.toBeInTheDocument();
  });

  it('marks the current page for assistive technology', () => {
    render(<Breadcrumbs trail={TRAIL} />);
    expect(screen.getByText('팟 오즈 계산하기')).toHaveAttribute('aria-current', 'page');
  });

  it('emits a BreadcrumbList that parses and matches the visible trail exactly', () => {
    const { container } = render(<Breadcrumbs trail={TRAIL} />);
    const blocks = jsonLdBlocks(container);
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    expect(block?.['@type']).toBe('BreadcrumbList');
    expect(block?.['itemListElement']).toEqual([
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: '배우기', item: `${SITE_ORIGIN}/learn` },
      {
        '@type': 'ListItem',
        position: 3,
        name: '팟 오즈 계산하기',
        item: `${SITE_ORIGIN}/learn/pot-odds`,
      },
    ]);
  });

  it('names the same labels in the markup and in the structured data', () => {
    const { container } = render(<Breadcrumbs trail={TRAIL} />);
    const [block] = jsonLdBlocks(container);
    const schemaNames = (block?.['itemListElement'] as { name: string }[]).map((item) => item.name);
    const visibleNames = [...container.querySelectorAll('li')].map((li) =>
      (li.textContent ?? '').replace('›', '').trim(),
    );
    expect(visibleNames).toEqual(schemaNames);
  });

  it('renders nothing at all for an empty trail', () => {
    const { container } = render(<Breadcrumbs trail={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
