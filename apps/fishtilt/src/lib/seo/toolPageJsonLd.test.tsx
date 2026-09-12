/**
 * The six tool pages' structured data, checked against what each page renders.
 *
 * Each tool page now emits three blocks: the `WebApplication` WP-N added, the `BreadcrumbList`
 * WP-7a's breadcrumb brings with it, and the `FAQPage` that `FaqSection` publishes from the
 * same array it renders. The assertions below are quantified over all six and name no
 * question, no tool and no host — WP-4's `features/tools/faq.ts` can be rewritten and this
 * file does not move.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Metadata } from 'next';
import EquityPage, { metadata as equityMeta } from '../../app/[locale]/tools/equity/page.js';
import PotOddsPage, { metadata as potOddsMeta } from '../../app/[locale]/tools/pot-odds/page.js';
import OutsPage, { metadata as outsMeta } from '../../app/[locale]/tools/outs/page.js';
import HandCheckerPage, { metadata as handCheckerMeta } from '../../app/[locale]/tools/hand-checker/page.js';
import RangePage, { metadata as rangeMeta } from '../../app/[locale]/tools/range/page.js';
import StartingHandPage, {
  metadata as startingHandMeta,
} from '../../app/[locale]/tools/starting-hand/page.js';
import { TOOL_FAQ_TITLE } from '../../features/tools/index.js';
import { routeById } from '../routes.js';
import { formatTitle } from './metadata.js';
import { MIN_FAQ_ITEMS } from './faq.js';

interface ToolPage {
  readonly name: string;
  readonly routeId: string;
  readonly Page: () => React.ReactElement;
  readonly metadata: Metadata;
}

const PAGES: readonly ToolPage[] = [
  { name: '/tools/equity', routeId: 'toolEquity', Page: EquityPage, metadata: equityMeta },
  { name: '/tools/pot-odds', routeId: 'toolPotOdds', Page: PotOddsPage, metadata: potOddsMeta },
  { name: '/tools/outs', routeId: 'toolOuts', Page: OutsPage, metadata: outsMeta },
  {
    name: '/tools/hand-checker',
    routeId: 'toolHandChecker',
    Page: HandCheckerPage,
    metadata: handCheckerMeta,
  },
  { name: '/tools/range', routeId: 'range', Page: RangePage, metadata: rangeMeta },
  {
    name: '/tools/starting-hand',
    routeId: 'toolStartingHand',
    Page: StartingHandPage,
    metadata: startingHandMeta,
  },
];

function blocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? '') as Record<string, unknown>,
  );
}

function ofType(container: HTMLElement, type: string): Record<string, unknown> | undefined {
  return blocks(container).find((block) => block['@type'] === type);
}

describe.each(PAGES)('$name structured data', (tool) => {
  it('declares a WebApplication named the same thing the <title> is built from', () => {
    const { container } = render(<tool.Page />);
    const app = ofType(container, 'WebApplication');
    expect(app, 'no WebApplication').toBeDefined();
    expect(formatTitle(String(app?.['name']))).toBe(tool.metadata.title);
    expect(new URL(String(app?.['url'])).pathname).toBe(routeById(tool.routeId).path);
  });

  it('shows the breadcrumb trail its BreadcrumbList declares, ending at this page', () => {
    const { container } = render(<tool.Page />);
    const trail = ofType(container, 'BreadcrumbList');
    expect(trail, 'no BreadcrumbList').toBeDefined();
    const crumbs = (trail?.['itemListElement'] ?? []) as { name: string; item: string }[];

    // 홈 › 무료 도구 › <this tool> — the hub crumb is the real hierarchy, not a flat trail.
    expect(crumbs).toHaveLength(3);
    expect(crumbs.map((crumb) => crumb.name)).toEqual([
      routeById('home').label,
      routeById('tools').label,
      routeById(tool.routeId).label,
    ]);
    expect(new URL(crumbs.at(-1)?.item ?? '').pathname).toBe(routeById(tool.routeId).path);

    const nav = screen.getByRole('navigation', { name: '현재 위치' });
    const shown = within(nav)
      .getAllByRole('listitem')
      .map((li) => (li.textContent ?? '').replace(/^›\s*/u, ''));
    expect(shown).toEqual(crumbs.map((crumb) => crumb.name));
  });

  it('publishes exactly the FAQ questions and answers the page shows', () => {
    const { container } = render(<tool.Page />);
    const faq = ofType(container, 'FAQPage');
    expect(faq, 'the page shows a FAQ but publishes none').toBeDefined();

    const declared = (faq?.['mainEntity'] ?? []) as {
      name: string;
      acceptedAnswer: { text: string };
    }[];
    expect(declared.length).toBeGreaterThanOrEqual(MIN_FAQ_ITEMS);

    const section = screen.getByRole('region', { name: TOOL_FAQ_TITLE });
    const shown = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent ?? '');
    expect(declared.map((entry) => entry.name)).toEqual(shown);

    for (const entry of declared) {
      expect(within(section).getByText(entry.acceptedAnswer.text)).toBeInTheDocument();
    }
  });

  it('claims no date, rating or review in any block', () => {
    const { container } = render(<tool.Page />);
    const serialised = JSON.stringify(blocks(container));
    expect(serialised).not.toContain('datePublished');
    expect(serialised).not.toContain('dateModified');
    expect(serialised).not.toContain('aggregateRating');
    expect(serialised).not.toContain('"review"');
  });
});
