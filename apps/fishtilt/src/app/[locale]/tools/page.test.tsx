import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../lib/routes.js';
import type * as RoutesModule from '../../../lib/routes.js';
import { contentById, hrefOfContent } from '../../../content/graph.js';
import { primaryToolLessonId, toolHubEntries } from '../../../features/tools/index.js';
import ToolsHubPage, { metadata } from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * The hub's job is the same as `/learn`'s: show the whole plan honestly. Every tool visible,
 * only the built ones clickable. Both halves matter — hiding the unbuilt ones would
 * misrepresent the site, and linking them would 404.
 */

/**
 * Every tool has shipped, so this page currently has no unbuilt tool of its own to render a
 * "준비 중" card for. That branch of `ToolCard` is still real product behaviour, so it needs a
 * fixture this test controls rather than a fact about today's build state (the same trap
 * `routes.test.ts` documents for `available` itself). This forces `toolHandChecker`
 * unavailable — chosen because nothing else in this file hard-codes its path or label — and
 * leaves every other route, including the two calculators pinned below, exactly as the
 * registry defines them. `toolHubEntries()`'s own `TOOL_DESCRIPTION` requirement is why an id
 * is flipped rather than a brand-new synthetic route appended: a new id with no description
 * would make `toolHubEntries()` throw (by design — see `hub.ts`).
 */
vi.mock('../../../lib/routes.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RoutesModule>();
  const ROUTES = actual.ROUTES.map((route) =>
    route.id === 'toolHandChecker' ? { ...route, available: false } : route,
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

const ENTRIES = toolHubEntries();

/**
 * The tool cards, scoped to the sections that hold them.
 *
 * WP-4 gave the hub a third section — one prerequisite lesson per shipped tool — whose meta
 * line names the tool it belongs to, so "팟 오즈 계산기" is now the accessible name of a tool
 * card AND part of the accessible name of that tool's lesson card. Every assertion about the
 * TOOL cards therefore names the region it means instead of the whole document. Nothing about
 * what is being verified changed: a built tool is still a link at its registry path, an
 * unbuilt one is still not a link.
 */
function toolCardRegions() {
  return [
    screen.getByRole('region', { name: '지금 사용할 수 있는 도구' }),
    ...screen.queryAllByRole('region', { name: '준비 중인 도구' }),
  ];
}

function toolCards() {
  const regions = toolCardRegions();
  return {
    listItems: regions.flatMap((region) => within(region).queryAllByRole('listitem')),
    findLink: (label: string) =>
      regions
        .flatMap((region) =>
          within(region).queryAllByRole('link', { name: new RegExp(label, 'u') }),
        )
        .at(0) ?? null,
  };
}

describe('/tools hub', () => {
  it('lists every tool the registry knows about, and not the hub itself', () => {
    render(<ToolsHubPage />);
    for (const entry of ENTRIES) {
      expect(screen.getByText(entry.route.label), entry.route.id).toBeInTheDocument();
    }
    expect(toolCards().listItems).toHaveLength(ENTRIES.length);
    // "무료 도구" is this hub's own eyebrow (and, since WP-7a, its breadcrumb crumb); it must
    // not ALSO appear as a card in its own list. Asserted inside the tool-card regions rather
    // than over the whole document, which is what the assertion always meant — counting the
    // page's own chrome was only ever incidental to it.
    expect(
      toolCardRegions().flatMap((region) => within(region).queryAllByText('무료 도구')),
    ).toHaveLength(0);
  });

  it('links a built tool at its registry path and marks an unbuilt one 준비 중', () => {
    render(<ToolsHubPage />);
    const cards = toolCards();
    for (const entry of ENTRIES) {
      const link = cards.findLink(entry.route.label);
      if (entry.route.available) {
        expect(link, entry.route.id).toHaveAttribute('href', entry.route.path);
      } else {
        expect(link, entry.route.id).toBeNull();
      }
    }
    const planned = ENTRIES.filter((entry) => !entry.route.available).length;
    expect(screen.getAllByText('준비 중')).toHaveLength(planned);
  });

  /*
   * WP-1 §6 priority 8. The hub listed six calculators and linked to none of the writing that
   * explains what they compute. The pairing is read from the same `TOOL_LESSON_IDS` each tool
   * page's own footer reads, so the hub cannot recommend a lesson the tool does not.
   */
  it('pairs every shipped tool with the lesson that explains it', () => {
    render(<ToolsHubPage />);
    const lessons = screen.getByRole('region', { name: '도구를 이해하는 데 필요한 레슨' });
    const ready = ENTRIES.filter((entry) => entry.route.available);
    expect(within(lessons).getAllByRole('listitem')).toHaveLength(ready.length);

    for (const entry of ready) {
      const record = contentById(primaryToolLessonId(entry.route.id));
      const href = hrefOfContent(record);
      expect(href, `${record.id} must be published to be linked from the hub`).not.toBeNull();
      const link = within(lessons).getByRole('link', {
        name: new RegExp(record.title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
      });
      expect(link, entry.route.id).toHaveAttribute('href', href);
      // The card says which tool it belongs to, or the section is just a lesson list.
      expect(link).toHaveTextContent(new RegExp(entry.route.label, 'u'));
    }
  });

  it('says how much of the toolbox is usable rather than implying all of it is', () => {
    render(<ToolsHubPage />);
    const ready = ENTRIES.filter((entry) => entry.route.available).length;
    expect(
      screen.getByText(`전체 ${ENTRIES.length}개 중 ${ready}개를 사용할 수 있습니다.`),
    ).toBeInTheDocument();
  });

  it('reaches the two calculators this work package shipped', () => {
    render(<ToolsHubPage />);
    const ready = screen.getByRole('region', { name: '지금 사용할 수 있는 도구' });
    expect(within(ready).getByRole('link', { name: /팟 오즈 계산기/u })).toHaveAttribute(
      'href',
      ko('/tools/pot-odds'),
    );
    expect(within(ready).getByRole('link', { name: /아웃 계산기/u })).toHaveAttribute(
      'href',
      ko('/tools/outs'),
    );
  });

  it('describes each tool in one line, taken from the tools feature, not written twice', () => {
    render(<ToolsHubPage />);
    for (const entry of ENTRIES) {
      expect(screen.getByText(entry.description), entry.route.id).toBeInTheDocument();
    }
  });

  it('never links a route the registry says does not exist', () => {
    render(<ToolsHubPage />);
    const unavailablePaths = new Set(
      ROUTES.filter((route) => !route.available).map((route) => route.path),
    );
    for (const link of screen.getAllByRole('link')) {
      expect(unavailablePaths.has(link.getAttribute('href') ?? '')).toBe(false);
    }
  });

  it('has exactly one h1', () => {
    render(<ToolsHubPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the hub', () => {
    expect(metadata.title).toContain('홀덤 계산기');
    expect(metadata.description).toContain('무료');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<ToolsHubPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
