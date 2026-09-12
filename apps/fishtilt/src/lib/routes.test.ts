/**
 * @vitest-environment node
 *
 * Node, not the project's happy-dom default: this file resolves paths off
 * `import.meta.url`, which is an `http:` URL under happy-dom and rejected by
 * `fileURLToPath`. Nothing here touches the DOM (same reasoning as
 * `apps/fishtilt/tests/layering.test.ts`).
 *
 * This is the point of the route registry: it is impossible to mark a route
 * `available: true` here without a real `page.tsx` backing it on disk.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_LOCALE_SEGMENT, DEFAULT_LOCALE, localeOfPath, localePath } from './locale.js';
import { FOOTER_NAV_IDS, PRIMARY_NAV_IDS, ROUTES, routeById, routesBySection } from './routes.js';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

/** Maps a route's SITE path to the App Router file that must exist for it to be real —
 *  under the locale segment, where every page lives (D-S3-01). */
function pageFileFor(sitePath: string): string {
  const segment = sitePath === '/' ? '' : sitePath.replace(/^\//, '');
  return join(APP_DIR, APP_LOCALE_SEGMENT, segment, 'page.tsx');
}

describe('route registry', () => {
  it('has at least one route', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('every site path is absolute, with no trailing slash except "/"', () => {
    for (const route of ROUTES) {
      expect(route.sitePath.startsWith('/')).toBe(true);
      if (route.sitePath !== '/') expect(route.sitePath.endsWith('/')).toBe(false);
    }
  });

  it('every linked path is the site path under the default locale, and nothing else', () => {
    // D-S3-02: the prefix is derived, never written. A registry entry cannot carry a
    // locale of its own, and cannot escape the locale layer.
    for (const route of ROUTES) {
      expect(localeOfPath(route.sitePath), route.id).toBeNull();
      expect(route.path, route.id).toBe(localePath(DEFAULT_LOCALE, route.sitePath));
      expect(localeOfPath(route.path), route.id).toBe(DEFAULT_LOCALE);
    }
  });

  it('ids are unique', () => {
    const ids = ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('paths are unique', () => {
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    const sitePaths = ROUTES.map((route) => route.sitePath);
    expect(new Set(sitePaths).size).toBe(sitePaths.length);
  });

  it('every entry marked available has a real page.tsx on disk', () => {
    const missing = ROUTES.filter(
      (route) => route.available && !existsSync(pageFileFor(route.sitePath)),
    );
    expect(missing.map((route) => route.path)).toEqual([]);
  });

  it('availability matches the disk in BOTH directions', () => {
    // The assertion above catches a route claiming to exist when it does not. This catches
    // the opposite and equally real mistake: a page that was built and then never flipped,
    // so the site quietly refuses to link to something a visitor could have used.
    //
    // This replaces an earlier pin that hard-coded `/learn` as the not-yet-built case. That
    // pin went stale the moment `/learn` shipped, which is the flaw in naming a specific
    // route: it has to be edited every time the answer changes, and a test you edit to make
    // it pass stops being a test. This form needs no maintenance.
    const mismatched = ROUTES.filter(
      (route) => route.available !== existsSync(pageFileFor(route.sitePath)),
    );
    expect(mismatched.map((route) => `${route.path} available=${route.available}`)).toEqual([]);
  });

  it('every primary-nav id resolves to a real registry entry', () => {
    for (const id of PRIMARY_NAV_IDS) {
      expect(() => routeById(id)).not.toThrow();
    }
    // Six since Stage 2 promoted `/blog` into the header (ruling 102). The count is pinned
    // deliberately: the header is a curated starting point, so growing it has to be a choice
    // someone makes on purpose, not something that drifts.
    expect(PRIMARY_NAV_IDS.length).toBe(6);
    expect(PRIMARY_NAV_IDS).toContain('blog');
    // `/hands` and `/about` stay footer-only — the header is not an index of the site.
    expect(PRIMARY_NAV_IDS).not.toContain('hands');
    expect(PRIMARY_NAV_IDS).not.toContain('about');
  });

  it('every footer-nav id resolves, and the footer is a superset of the header', () => {
    for (const id of FOOTER_NAV_IDS) {
      expect(() => routeById(id), id).not.toThrow();
    }
    for (const id of PRIMARY_NAV_IDS) {
      expect(FOOTER_NAV_IDS).toContain(id);
    }
    expect(new Set(FOOTER_NAV_IDS).size).toBe(FOOTER_NAV_IDS.length);
    expect(FOOTER_NAV_IDS.length).toBeGreaterThan(PRIMARY_NAV_IDS.length);
  });

  it('no non-home route is absent from both navs', () => {
    /*
     * The defect this catches (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M11/M12): `/about`,
     * `/blog`, `/hands` and `/search` were in neither the header nor the footer, so a full
     * crawl from `/` reached 130 URLs and never found `/about` at all. Every concrete route
     * this registry knows about must be reachable from a global nav — the footer, the header,
     * or (for `/search`) the header's own search affordance, which is registry-driven too.
     */
    const inNav = new Set<string>([...FOOTER_NAV_IDS, 'search']);
    const stranded = ROUTES.filter((route) => route.section !== 'home' && !inNav.has(route.id)).map(
      (route) => route.sitePath,
    );
    // Tool and quiz DETAIL pages are reached from their hubs, which are themselves in the
    // nav; only the hubs are required here.
    const hubbed = new Set(['/tools', '/practice']);
    const orphans = stranded.filter(
      (path) => !path.startsWith('/tools/') && !path.startsWith('/practice/') && !hubbed.has(path),
    );
    expect(orphans).toEqual([]);
  });

  it('routeById throws for an unknown id rather than returning something plausible', () => {
    expect(() => routeById('not-a-real-route')).toThrow();
  });

  it('routesBySection excludes "home" and covers every non-home route exactly once', () => {
    const bySection = routesBySection();
    const grouped = [...bySection.values()].flat();
    const nonHome = ROUTES.filter((route) => route.section !== 'home');
    expect(grouped.length).toBe(nonHome.length);
    expect(new Set(grouped.map((route) => route.id))).toEqual(
      new Set(nonHome.map((route) => route.id)),
    );
    expect(bySection.has('home')).toBe(false);
  });
});
