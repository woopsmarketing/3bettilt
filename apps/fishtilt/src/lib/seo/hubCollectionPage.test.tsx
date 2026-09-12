/**
 * `CollectionPage` on the six hubs — asserted against what each hub RENDERS, never against a
 * list this file writes down.
 *
 * The whole claim a `CollectionPage` makes is "this page is a page of these things". The only
 * way to keep that true as content ships is to check it the way a reader would: pull the block
 * out of the rendered DOM, pull the links out of the same rendered DOM, and compare. So every
 * assertion below is a PROPERTY quantified over whatever the registries currently hold —
 * no count, no slug, no title. WP-7b can add lessons, articles, terms and hand pages and
 * nothing here needs an edit.
 *
 * The one thing live data cannot prove is the branch that matters most — that a row rendered
 * as inert "준비 중" text is left OUT of the list — because all 113 records are `PUBLISHED`
 * today (ruling 26). So this file owns a `PLANNED` lesson fixture and appends it to the
 * roadmap, exactly as `src/app/learn/page.test.tsx` does and for the same reason.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import type * as GraphModule from '../../content/graph.js';
import type { LearnRecord } from '../../content/types.js';
import { formatTitle } from './metadata.js';
import { DEFAULT_LOCALE, localePath } from '../locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

const { PLANNED_LESSON } = vi.hoisted(() => {
  const fixture: LearnRecord = {
    kind: 'learn',
    id: 'learn-fixture-uncollected',
    slug: 'fixture-uncollected',
    order: 9999,
    title: '테스트 픽스처 레슨 (Uncollected)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 레슨 픽스처.',
    level: 'BASIC',
    topic: 'range',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PLANNED',
    indexable: false,
    readMinutes: null,
  };
  return { PLANNED_LESSON: fixture };
});

vi.mock('../../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  return { ...actual, LEARN_ROADMAP: [...actual.LEARN_ROADMAP, PLANNED_LESSON] };
});

const { default: LearnHubPage, metadata: learnMeta } =
  await import('../../app/[locale]/learn/page.js');
const { default: BlogIndexPage, metadata: blogMeta } =
  await import('../../app/[locale]/blog/page.js');
const { default: GlossaryIndexPage, metadata: glossaryMeta } =
  await import('../../app/[locale]/glossary/page.js');
const { default: HandsIndexPage, metadata: handsMeta } =
  await import('../../app/[locale]/hands/page.js');
const { default: ToolsHubPage, metadata: toolsMeta } =
  await import('../../app/[locale]/tools/page.js');
const { default: PracticeHubPage, metadata: practiceMeta } =
  await import('../../app/[locale]/practice/page.js');

interface Hub {
  readonly name: string;
  readonly path: string;
  readonly Page: () => React.ReactElement;
  readonly metadata: Metadata;
  /** The type the hub's list is published as. `/glossary` is the one that is not an ItemList. */
  readonly listType: 'ItemList' | 'DefinedTermSet';
}

const HUBS: readonly Hub[] = [
  { name: '/learn', path: '/learn', Page: LearnHubPage, metadata: learnMeta, listType: 'ItemList' },
  { name: '/blog', path: '/blog', Page: BlogIndexPage, metadata: blogMeta, listType: 'ItemList' },
  {
    name: '/glossary',
    path: '/glossary',
    Page: GlossaryIndexPage,
    metadata: glossaryMeta,
    listType: 'DefinedTermSet',
  },
  {
    name: '/hands',
    path: '/hands',
    Page: HandsIndexPage,
    metadata: handsMeta,
    listType: 'ItemList',
  },
  { name: '/tools', path: '/tools', Page: ToolsHubPage, metadata: toolsMeta, listType: 'ItemList' },
  {
    name: '/practice',
    path: '/practice',
    Page: PracticeHubPage,
    metadata: practiceMeta,
    listType: 'ItemList',
  },
];

function blocks(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? '') as Record<string, unknown>,
  );
}

function collectionPage(container: HTMLElement): Record<string, unknown> {
  const block = blocks(container).find((entry) => entry['@type'] === 'CollectionPage');
  expect(block, 'no CollectionPage block').toBeDefined();
  return block as Record<string, unknown>;
}

/** The rows the block declares, as `{ name, url }`, whichever of the two list types holds them. */
function rows(block: Record<string, unknown>): { name: string; url: string }[] {
  const main = block['mainEntity'] as Record<string, unknown>;
  const list = (main['itemListElement'] ?? main['hasDefinedTerm']) as
    { name: string; url: string }[] | undefined;
  expect(list, 'the list carries no rows').toBeDefined();
  return list ?? [];
}

/** Every `href` the page renders, in document order. */
function renderedHrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
}

describe.each(HUBS)('$name CollectionPage', (hub) => {
  it('names the page with the same string the <title> is built from', () => {
    const { container } = render(<hub.Page />);
    const block = collectionPage(container);
    expect(formatTitle(String(block['name']))).toBe(hub.metadata.title);
    expect(block['description']).toBe(hub.metadata.description);
  });

  it('publishes its list as the type that page actually is', () => {
    const { container } = render(<hub.Page />);
    const main = collectionPage(container)['mainEntity'] as Record<string, unknown>;
    expect(main['@type']).toBe(hub.listType);
  });

  it('lists exactly the links the page renders for it, in the order it renders them', () => {
    const { container } = render(<hub.Page />);
    const declared = rows(collectionPage(container)).map((row) => new URL(row.url).pathname);
    expect(declared.length).toBeGreaterThan(0);
    expect(new Set(declared).size, 'the same URL is listed twice').toBe(declared.length);

    // Filtered rather than compared wholesale: `/tools` also renders a lesson link per tool,
    // which is a way onward from the hub and not part of what the hub collects. Deduped by
    // first occurrence: the magazine blog hub and the two-mode learn hub link the same item
    // more than once (featured + section + index; roadmap + topic). What must hold is that
    // every declared row IS a link on the page and that the declared order is the order in
    // which the page first renders them.
    const wanted = new Set(declared);
    const onPage = [...new Set(renderedHrefs(container).filter((href) => wanted.has(href)))];
    expect(onPage).toEqual(declared);
  });

  it('gives every row an absolute URL on one origin, with no query string', () => {
    const { container } = render(<hub.Page />);
    const block = collectionPage(container);
    const origin = new URL(String(block['url'])).origin;
    for (const row of rows(block)) {
      const url = new URL(row.url);
      expect(url.origin, row.url).toBe(origin);
      expect(url.search, row.url).toBe('');
      expect(url.hash, row.url).toBe('');
      expect(row.name.length, row.url).toBeGreaterThan(0);
    }
  });

  it('claims no date, rating or review', () => {
    const { container } = render(<hub.Page />);
    const serialised = JSON.stringify(collectionPage(container));
    expect(serialised).not.toContain('datePublished');
    expect(serialised).not.toContain('dateModified');
    expect(serialised).not.toContain('aggregateRating');
    expect(serialised).not.toContain('"review"');
  });

  it('shows the breadcrumb trail its BreadcrumbList declares', () => {
    const { container } = render(<hub.Page />);
    const trail = blocks(container).find((entry) => entry['@type'] === 'BreadcrumbList');
    expect(trail, 'no BreadcrumbList').toBeDefined();
    const crumbs = (trail?.['itemListElement'] ?? []) as { name: string; item: string }[];

    const nav = screen.getByRole('navigation', { name: '현재 위치' });
    expect(
      within(nav)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.replace(/^›\s*/u, '')),
    ).toEqual(crumbs.map((crumb) => crumb.name));
    expect(new URL(crumbs.at(-1)?.item ?? '').pathname).toBe(ko(hub.path));
  });
});

describe('/learn with an unwritten lesson in the roadmap', () => {
  it('shows it as 준비 중 and leaves it out of the CollectionPage', () => {
    const { container } = render(<LearnHubPage />);
    // On screen, named, and NOT a link — the site's standing honesty gate.
    expect(screen.getByText(PLANNED_LESSON.title)).toBeInTheDocument();
    expect(renderedHrefs(container)).not.toContain(`/learn/${PLANNED_LESSON.slug}`);
    // …and therefore not a row: a `ListItem` whose `url` 404s is a dead link with extra steps.
    const declared = rows(collectionPage(container)).map((row) => new URL(row.url).pathname);
    expect(declared).not.toContain(`/learn/${PLANNED_LESSON.slug}`);
    expect(rows(collectionPage(container)).map((row) => row.name)).not.toContain(
      PLANNED_LESSON.title,
    );
  });
});

describe('/glossary DefinedTermSet', () => {
  it('gives every term the one-line definition the page prints under its heading', () => {
    const { container } = render(<GlossaryIndexPage />);
    for (const term of rows(collectionPage(container)) as {
      name: string;
      description: string;
      url: string;
    }[]) {
      expect(term.description.length, term.name).toBeGreaterThan(0);
      // `getAllByText` throws when nothing on the page has exactly this text, which is the
      // assertion: the published definition is the definition on screen.
      expect(screen.getAllByText(term.description).length, term.name).toBeGreaterThan(0);
    }
  });
});
