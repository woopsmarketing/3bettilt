import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FOOTER_NAV_IDS, PRIMARY_NAV_IDS, ROUTES, routeById } from '../lib/routes.js';
import { FOOTER_DISCLAIMER, FOOTER_GROUPS, SiteFooter } from './SiteFooter.js';

describe('SiteFooter', () => {
  it('renders the brand mark as plain text, not a second "3BETTILT" link', () => {
    render(<SiteFooter />);
    expect(screen.getByText('3BETTILT')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '3BETTILT' })).not.toBeInTheDocument();
  });

  it('states the exact education-only disclaimer line', () => {
    render(<SiteFooter />);
    expect(FOOTER_DISCLAIMER).toBe(
      '3BetTilt는 텍사스 홀덤 학습과 확률 계산을 위한 교육용 사이트입니다.',
    );
    expect(screen.getByText(FOOTER_DISCLAIMER)).toBeInTheDocument();
  });

  it('renders every footer destination, linked when built and inert when not, exactly once', () => {
    render(<SiteFooter />);
    const nav = screen.getByRole('navigation', { name: '바닥글 메뉴' });
    for (const id of FOOTER_NAV_IDS) {
      const route = routeById(id);
      // The label is always shown — a reader is told what is coming, not left guessing.
      expect(within(nav).getAllByText(route.label, { exact: false }).length, id).toBeGreaterThan(0);
      const links = within(nav).queryAllByRole('link', { name: route.label });
      if (route.available) {
        expect(links, id).toHaveLength(1);
        expect(links[0], id).toHaveAttribute('href', route.path);
      } else {
        expect(links, id).toHaveLength(0);
      }
    }
  });

  /*
   * The footer is where the pages that do not fit the header live. `/blog`, `/hands` and
   * `/about` were in NEITHER nav (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M11, M12), which
   * is how `/about` — the only page saying this site is affiliated with no one — ended up
   * reachable from no page on the site. Asserted as a relation between the two lists rather
   * than as a list of three ids, so it keeps holding if a fourth is added.
   */
  it('carries the header nav and strictly more than it', () => {
    render(<SiteFooter />);
    for (const id of PRIMARY_NAV_IDS) {
      expect(FOOTER_NAV_IDS).toContain(id);
    }
    expect(FOOTER_NAV_IDS.length).toBeGreaterThan(PRIMARY_NAV_IDS.length);
    for (const id of ['blog', 'hands', 'about']) {
      const route = routeById(id);
      expect(screen.getByRole('link', { name: route.label }), id).toHaveAttribute(
        'href',
        route.path,
      );
    }
  });

  /*
   * Stage 3: the footer is the site's index. Every registered route — the quizzes, the five
   * calculators, search — is listed under the hub it belongs to, so from the bottom of any
   * page a reader can reach any page. Derived from `ROUTES` so a route added to the registry
   * without a footer group fails here rather than quietly going unlisted.
   */
  it('lists every route in the registry except home, grouped by what the reader is doing', () => {
    render(<SiteFooter />);
    const nav = screen.getByRole('navigation', { name: '바닥글 메뉴' });
    for (const group of FOOTER_GROUPS) {
      expect(
        within(nav).getByText(group.heading, { selector: 'p' }),
        group.heading,
      ).toBeInTheDocument();
    }
    expect(within(nav).getByText('3BetTilt', { selector: 'p' })).toBeInTheDocument();

    const listed = new Set([...FOOTER_GROUPS.flatMap((group) => group.routeIds), 'about']);
    for (const route of ROUTES) {
      if (route.id === 'home') continue;
      expect(listed.has(route.id), `route "${route.id}" is in no footer group`).toBe(true);
      if (route.available) {
        expect(within(nav).getByRole('link', { name: route.label }), route.id).toHaveAttribute(
          'href',
          route.path,
        );
      }
    }
  });

  it('keeps every group short enough to stay compact on a phone', () => {
    for (const group of FOOTER_GROUPS) {
      expect(group.routeIds.length, group.heading).toBeLessThanOrEqual(7);
    }
  });

  it('never mentions affiliate, casino, deposit, bonus or sign-up surfaces', () => {
    const { container } = render(<SiteFooter />);
    const text = container.textContent ?? '';
    for (const forbidden of [
      '제휴',
      '카지노',
      '입금',
      '보너스',
      '가입',
      'affiliate',
      'casino',
      'deposit',
      'bonus',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('shows no fake company, social or contact surface', () => {
    const { container } = render(<SiteFooter />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/@|©|Inc\.|Ltd|주식회사|사업자|Twitter|Instagram|YouTube|Discord/u);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').toMatch(/^\//u);
    }
  });
});
