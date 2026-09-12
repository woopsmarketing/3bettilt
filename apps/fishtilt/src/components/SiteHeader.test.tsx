import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIMARY_NAV_IDS, primaryNavRoutes, routeById } from '../lib/routes.js';
import { activeNavId, DESKTOP_SECONDARY_IDS, MOBILE_MORE_IDS, SiteHeader } from './SiteHeader.js';
import { DEFAULT_LOCALE, localePath } from '../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * `usePathname` is the only thing the header needs from Next's router, and outside an App
 * Router tree it resolves to `null` — which is a legitimate state (the header simply marks
 * nothing current), but not one that can prove the active-state rules. So the hook is mocked
 * and the pathname is set per test. The RULES themselves are asserted separately against
 * `activeNavId`, which is a pure function and needs no DOM at all.
 */
let pathname: string | null = null;
vi.mock('next/navigation.js', () => ({ usePathname: () => pathname }));

afterEach(() => {
  pathname = null;
  delete document.documentElement.dataset.theme;
});

describe('SiteHeader', () => {
  it('renders the 3BETTILT wordmark as a link home', () => {
    render(<SiteHeader />);
    const wordmark = screen.getByRole('link', { name: '3BETTILT' });
    expect(wordmark).toHaveAttribute('href', ko('/'));
  });

  it('renders every primary-nav destination, linked when built and inert when not', () => {
    render(<SiteHeader />);
    for (const id of PRIMARY_NAV_IDS) {
      const route = routeById(id);
      // The label is always shown: a reader is told what is coming, not left guessing.
      expect(screen.getAllByText(route.label, { exact: false }).length).toBeGreaterThan(0);

      const link = screen.queryByRole('link', { name: route.label });
      if (route.available) {
        expect(link).toHaveAttribute('href', route.path);
      } else {
        // Not a dead link that 404s, and not a disabled control either — inert text.
        expect(link).not.toBeInTheDocument();
      }
    }
  });

  it('includes /blog, which twenty articles depended on the footer for', () => {
    // FISHTILT_STATE ruling 102. Pinned in the rendered header, not only in the registry,
    // because the registry being right is worth nothing if the header stops reading it.
    render(<SiteHeader />);
    const blog = routeById('blog');
    expect(screen.getByRole('link', { name: blog.label })).toHaveAttribute('href', ko('/blog'));
  });

  /*
   * This used to assert, flatly, that the search affordance is a DISABLED BUTTON. That was
   * true when `/search` did not exist and stayed in the suite for months after WP-K built it,
   * so the test kept passing while the header refused to open a page that worked
   * (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M12). Naming one of the two states is the flaw:
   * whichever one you pin, the test stops noticing when reality moves to the other.
   *
   * So the assertion is the RULE both states have to satisfy — the affordance always matches
   * what the registry says about `/search`, and is never the other thing. `routes.test.ts`
   * separately proves `available` matches the disk in both directions, so "the registry says
   * so" is not taken on trust here.
   */
  it('renders the search affordance as the registry says: a link when built, a disabled button when not', () => {
    render(<SiteHeader />);
    const search = routeById('search');
    const link = screen.queryByRole('link', { name: search.label });
    const disabled = screen.queryByRole('button', { name: `${search.label} (준비 중)` });

    if (search.available) {
      expect(link).toHaveAttribute('href', search.path);
      expect(disabled).not.toBeInTheDocument();
    } else {
      expect(disabled).toBeDisabled();
      expect(link).not.toBeInTheDocument();
    }
  });

  it('carries 핸드 목록 and 소개 in a secondary desktop group, without growing the primary six (B-M2)', () => {
    // WP-S3-18 review B-M2: `/hands` (21 pages) and `/about` were in the mobile panel but
    // not the desktop bar. They now sit in `nav[aria-label="보조 메뉴"]` — a separate,
    // quieter landmark — while `PRIMARY_NAV_IDS` stays six (`routes.test.ts`).
    render(<SiteHeader />);
    const secondary = screen.getByRole('navigation', { name: '보조 메뉴' });
    for (const id of DESKTOP_SECONDARY_IDS) {
      const route = routeById(id);
      expect(within(secondary).getByRole('link', { name: route.label })).toHaveAttribute(
        'href',
        route.path,
      );
    }
    expect(within(secondary).getAllByRole('link')).toHaveLength(DESKTOP_SECONDARY_IDS.length);
    const primary = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(primary).getAllByRole('link')).toHaveLength(PRIMARY_NAV_IDS.length);
    // Every secondary page is still in the phone panel's "더 보기" — nothing moved off mobile.
    for (const id of DESKTOP_SECONDARY_IDS) expect(MOBILE_MORE_IDS).toContain(id);
  });

  it('carries the theme toggle at every width, beside the search affordance', async () => {
    // In the top bar rather than inside the mobile panel: it is a 44px icon that fits next to
    // search on a 360px screen, and duplicating it into the panel would mean two controls for
    // one setting.
    document.documentElement.dataset.theme = 'dark';
    render(<SiteHeader />);
    const toggle = await screen.findByRole('button', { name: '밝은 테마로 바꾸기' });
    expect(toggle).toBeInTheDocument();
    expect(toggle.className).not.toContain('md:hidden');
  });

  it('the hamburger toggles a mobile nav panel that is unmounted, not just hidden, when closed', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    expect(document.getElementById('fishtilt-mobile-nav')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: '메뉴 열기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(document.getElementById('fishtilt-mobile-nav')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '메뉴 닫기' }));
    expect(document.getElementById('fishtilt-mobile-nav')).not.toBeInTheDocument();
  });
});

describe('SiteHeader — active state', () => {
  it('marks the section a content page belongs to, not just its own hub URL', () => {
    pathname = ko('/blog/pot-odds-quick');
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: routeById('blog').label })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks exactly one entry, even when two nav paths prefix the current one', () => {
    // `/tools` and `/tools/range` are both in this header and both prefix `/tools/range`.
    pathname = ko('/tools/range');
    render(<SiteHeader />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', ko('/tools/range'));
  });

  it('marks the wordmark, and nothing else, on the homepage', () => {
    pathname = ko('/');
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: '3BETTILT' })).toHaveAttribute('aria-current', 'page');
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
  });

  it('marks the secondary 소개 entry, and nothing in the primary six, on /about', () => {
    pathname = ko('/about');
    render(<SiteHeader />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', ko('/about'));
    const primary = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(primary).queryAllByRole('link', { current: 'page' })).toEqual([]);
  });

  it('marks nothing on a page that belongs to no header section', () => {
    pathname = ko('/no-such-section');
    render(<SiteHeader />);
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toEqual([]);
  });
});

describe('activeNavId', () => {
  const nav = primaryNavRoutes();

  it('matches a hub exactly', () => {
    expect(activeNavId(ko('/learn'), nav)).toBe('learn');
  });

  it('matches every page under a hub', () => {
    expect(activeNavId(ko('/learn/poker-range'), nav)).toBe('learn');
    expect(activeNavId(ko('/glossary/pot-odds'), nav)).toBe('glossary');
  });

  it('prefers the longest matching nav path', () => {
    expect(activeNavId(ko('/tools/range'), nav)).toBe('range');
    expect(activeNavId(ko('/tools/equity'), nav)).toBe('tools');
  });

  it('requires a segment boundary, so /toolsomething is not inside /tools', () => {
    expect(activeNavId(ko('/toolsomething'), nav)).toBeNull();
  });

  it('tolerates the pathname Next reports while prerendering a dynamic route', () => {
    // During static generation `usePathname` can report the template rather than a generated
    // path. It still sits under the hub, so the server and the browser agree and the markup
    // does not change under React on hydration.
    expect(activeNavId(ko('/blog/[slug]'), nav)).toBe('blog');
  });

  it('ignores a trailing slash', () => {
    expect(activeNavId(ko('/practice/'), nav)).toBe('practice');
  });

  it('returns null for no pathname and for a page in no section', () => {
    expect(activeNavId(null, nav)).toBeNull();
    expect(activeNavId(undefined, nav)).toBeNull();
    expect(activeNavId('', nav)).toBeNull();
    expect(activeNavId(ko('/about'), nav)).toBeNull();
    expect(activeNavId(ko('/'), nav)).toBeNull();
  });

  it('never marks a route that has no page behind it', () => {
    expect(
      activeNavId(ko('/learn'), [
        {
          id: 'learn',
          sitePath: '/learn',
          path: localePath(DEFAULT_LOCALE, '/learn'),
          label: '배우기',
          section: 'learn',
          available: false,
        },
      ]),
    ).toBeNull();
  });
});

describe('SiteHeader — mobile panel (Stage 3 contract AE)', () => {
  const open = async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const panel = screen.getByRole('navigation', { name: '주요 메뉴 (모바일)' });
    return { user, panel };
  };

  it('lists all six primary destinations, /blog among them, then 검색 · 핸드 목록 · 소개', async () => {
    const { panel } = await open();
    const links = within(panel).getAllByRole('link');
    const labels = links.map((link) => link.textContent);
    for (const id of PRIMARY_NAV_IDS) expect(labels).toContain(routeById(id).label);
    for (const id of MOBILE_MORE_IDS) expect(labels).toContain(routeById(id).label);
    expect(labels.indexOf(routeById('blog').label)).toBeLessThan(
      labels.indexOf(routeById('about').label),
    );
  });

  it('moves focus to its first link on open, and returns it to the button on Escape', async () => {
    const { user, panel } = await open();
    expect(within(panel).getAllByRole('link')[0]).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('navigation', { name: '주요 메뉴 (모바일)' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveFocus();
  });

  it('traps Tab inside the panel: past the last link wraps to the close button, and Shift+Tab from the button wraps back', async () => {
    const { user, panel } = await open();
    const links = within(panel).getAllByRole('link');
    const last = links[links.length - 1];
    if (last === undefined) throw new Error('panel rendered no links');
    last.focus();

    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(last).toHaveFocus();
  });

  it('marks the current section inside the panel too', async () => {
    pathname = ko('/learn/poker-range');
    const { panel } = await open();
    const current = within(panel)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(routeById('learn').label);
  });

  it('gives every row the 44px minimum height', async () => {
    const { panel } = await open();
    for (const link of within(panel).getAllByRole('link')) {
      expect(link.className).toContain('min-h-11');
    }
  });
});
