/**
 * The site-level identity blocks — `WebSite` and `Organization` — and the home page's own
 * `FAQPage`.
 *
 * These are the only structured data on this site that describes the SITE rather than the
 * document, which is why the interesting assertions are about where they are NOT: not on any
 * other page, not carrying a `SearchAction` the site cannot serve, and not accompanied by a
 * one-crumb breadcrumb at the root.
 *
 * Nothing here names a question, a lesson or a host. The FAQ assertions compare the block to
 * the DOM beside it, so WP-3's six questions can be rewritten without touching this file.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../../app/(default-locale)/page.js';
import LearnHubPage from '../../app/(default-locale)/learn/page.js';
import { SITE_NAME, SITE_ORIGIN } from './site.js';
import { MIN_FAQ_ITEMS } from './faq.js';

function blocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? '') as Record<string, unknown>,
  );
}

function ofType(container: HTMLElement, type: string): Record<string, unknown>[] {
  return blocks(container).filter((block) => block['@type'] === type);
}

describe('the home page`s site-level blocks', () => {
  it('declares WebSite and Organization exactly once each', () => {
    const { container } = render(<HomePage />);
    expect(ofType(container, 'WebSite')).toHaveLength(1);
    expect(ofType(container, 'Organization')).toHaveLength(1);
  });

  it('builds both from the same two constants every canonical is built from', () => {
    const { container } = render(<HomePage />);
    for (const block of [
      ofType(container, 'WebSite')[0],
      ofType(container, 'Organization')[0],
    ]) {
      expect(block?.['name']).toBe(SITE_NAME);
      // The front door is the prefixless root: the bare origin IS the Korean homepage (D-S3-23).
      expect(block?.['url']).toBe(SITE_ORIGIN);
      expect(block?.['@context']).toBe('https://schema.org');
    }
  });

  it('advertises no SearchAction — /search parses ?q= in the browser, not on a server', () => {
    const { container } = render(<HomePage />);
    const serialised = JSON.stringify(blocks(container));
    expect(serialised).not.toContain('potentialAction');
    expect(serialised).not.toContain('SearchAction');
  });

  it('renders no breadcrumb at the root, where the trail would be one crumb to here', () => {
    const { container } = render(<HomePage />);
    expect(screen.queryByRole('navigation', { name: '현재 위치' })).toBeNull();
    expect(ofType(container, 'BreadcrumbList')).toHaveLength(0);
  });

  it('is the only page that says what the site is — a hub declares neither', () => {
    const { container } = render(<LearnHubPage />);
    expect(ofType(container, 'WebSite')).toHaveLength(0);
    expect(ofType(container, 'Organization')).toHaveLength(0);
  });

  it('claims no date, rating or review anywhere on the page', () => {
    const { container } = render(<HomePage />);
    const serialised = JSON.stringify(blocks(container));
    expect(serialised).not.toContain('datePublished');
    expect(serialised).not.toContain('dateModified');
    expect(serialised).not.toContain('aggregateRating');
    expect(serialised).not.toContain('"review"');
  });
});

describe('the home page`s FAQPage', () => {
  it('publishes exactly the questions the FAQ section shows, in order', () => {
    const { container } = render(<HomePage />);
    const faq = ofType(container, 'FAQPage')[0];
    expect(faq, 'the home page shows a FAQ but publishes none').toBeDefined();

    const declared = (faq?.['mainEntity'] ?? []) as { name: string }[];
    expect(declared.length).toBeGreaterThanOrEqual(MIN_FAQ_ITEMS);

    const section = screen.getByRole('region', { name: '자주 묻는 질문' });
    const shown = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent ?? '');
    expect(declared.map((entry) => entry.name)).toEqual(shown);
  });

  it('publishes each answer as the exact paragraph under its question', () => {
    const { container } = render(<HomePage />);
    const declared = (ofType(container, 'FAQPage')[0]?.['mainEntity'] ?? []) as {
      acceptedAnswer: { text: string };
    }[];
    for (const entry of declared) {
      expect(screen.getByText(entry.acceptedAnswer.text)).toBeInTheDocument();
    }
  });
});
