/**
 * 3BetTilt's route registry — the single source of truth for every page the site's own
 * navigation (header, footer) can point at, and the honesty gate that keeps that
 * navigation truthful.
 *
 * The problem this solves: a nav link to a page that 404s is a broken promise, and a nav
 * that hides everything unbuilt makes the product look empty before it has a chance to
 * grow. The fix is a single typed list where `available` is not a claim anyone has to
 * remember to update correctly — `routes.test.ts` reads the filesystem and fails the build
 * the moment an entry says `available: true` for a page that is not actually there.
 *
 * `available: false` entries still render in the nav; they show as visibly non-interactive
 * text with a "준비 중" (in progress) badge instead of a link (see `RouteNavItem`).
 *
 * Scope: concrete, statically addressable pages only — no `[slug]`-style dynamic
 * templates. Those are never linked directly from global nav; they are reached from hub
 * pages a later WP builds. The full route map this registry is drawn from lives at
 * `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §4.
 *
 * ## Two paths per route (Stage 3, D-S3-01/02)
 *
 * Every page lives under a locale segment (`/ko/learn`), so a route carries both the SITE
 * path it is defined by (`sitePath: '/learn'`, locale-less, the directory under
 * `src/app/[locale]/`) and the `path` the site actually links to (`'/ko/learn'`, built by
 * `localePath` from the default locale). Everything that renders or emits a URL reads
 * `path`; only the filesystem check and the locale layer read `sitePath`. The registry is
 * written in `sitePath` terms and never spells the prefix.
 */
import { DEFAULT_LOCALE, localePath } from './locale.js';

export type RouteSection =
  'home' | 'learn' | 'tools' | 'practice' | 'glossary' | 'blog' | 'hands' | 'search' | 'about';

export interface RouteEntry {
  /** Stable key, independent of the path or label, so callers can reference a route by
   *  intent (`routeById('range')`) without restating its Korean label or URL. */
  readonly id: string;
  /** Locale-less site path — `'/learn'`. The directory under `src/app/[locale]/`. */
  readonly sitePath: string;
  /** The localised path the site links to — `'/ko/learn'`. Derived; never written. */
  readonly path: string;
  /** Korean nav label. Ordinary UI copy, not poker notation, so it is fully translated
   *  (ADR-0053 only exempts things like card ranks/suits and position abbreviations). */
  readonly label: string;
  readonly section: RouteSection;
  /** Whether a real page exists at `path` right now. Checked against disk by
   *  `routes.test.ts` — this field is never trusted on its own. */
  readonly available: boolean;
}

/** What a registry entry is written as: the localised `path` is derived below. */
type RouteDefinition = Omit<RouteEntry, 'path'>;

function localise(route: RouteDefinition): RouteEntry {
  return { ...route, path: localePath(DEFAULT_LOCALE, route.sitePath) };
}

const DEFINITIONS: readonly RouteDefinition[] = [
  { id: 'home', sitePath: '/', label: '홈', section: 'home', available: true },

  { id: 'learn', sitePath: '/learn', label: '배우기', section: 'learn', available: true },

  // "핸드레인지" is its own primary-nav destination (the flagship Range Explorer), distinct
  // from the general tools hub, per the build spec's nav wording.
  { id: 'range', sitePath: '/tools/range', label: '핸드레인지', section: 'tools', available: true },
  { id: 'tools', sitePath: '/tools', label: '무료 도구', section: 'tools', available: true },
  {
    id: 'toolStartingHand',
    sitePath: '/tools/starting-hand',
    label: '시작 핸드 탐색기',
    section: 'tools',
    available: true,
  },
  {
    id: 'toolEquity',
    sitePath: '/tools/equity',
    label: '승률 계산기',
    section: 'tools',
    available: true,
  },
  {
    id: 'toolPotOdds',
    sitePath: '/tools/pot-odds',
    label: '팟 오즈 계산기',
    section: 'tools',
    available: true,
  },
  {
    id: 'toolHandChecker',
    sitePath: '/tools/hand-checker',
    label: '핸드 체커',
    section: 'tools',
    available: true,
  },
  { id: 'toolOuts', sitePath: '/tools/outs', label: '아웃 계산기', section: 'tools', available: true },

  { id: 'practice', sitePath: '/practice', label: '퀴즈', section: 'practice', available: true },
  {
    id: 'practiceRange',
    sitePath: '/practice/range-quiz',
    label: '레인지 퀴즈',
    section: 'practice',
    available: true,
  },
  {
    id: 'practiceHandRanking',
    sitePath: '/practice/hand-ranking-quiz',
    label: '족보 퀴즈',
    section: 'practice',
    available: true,
  },
  {
    id: 'practiceStartingHand',
    sitePath: '/practice/starting-hand-quiz',
    label: '시작 핸드 퀴즈',
    section: 'practice',
    available: true,
  },
  { id: 'glossary', sitePath: '/glossary', label: '포커 용어', section: 'glossary', available: true },
  { id: 'blog', sitePath: '/blog', label: '블로그', section: 'blog', available: true },
  { id: 'hands', sitePath: '/hands', label: '핸드 목록', section: 'hands', available: true },
  { id: 'search', sitePath: '/search', label: '검색', section: 'search', available: true },
  { id: 'about', sitePath: '/about', label: '소개', section: 'about', available: true },
];

export const ROUTES: readonly RouteEntry[] = DEFINITIONS.map(localise);

const BY_ID = new Map(ROUTES.map((route) => [route.id, route]));

export function routeById(id: string): RouteEntry {
  const route = BY_ID.get(id);
  if (!route) throw new Error(`No such route id: "${id}"`);
  return route;
}

/** The six destinations the header's primary nav shows, in display order.
 *
 *  Deliberately six and not nine: a beginner site's header is a place to start, not an
 *  index of everything. The pages that do not fit here are surfaced in the footer instead
 *  (`FOOTER_NAV_IDS`), and `/search` has its own affordance beside this nav.
 *
 *  `blog` was added in Stage 2 (FISHTILT_STATE ruling 102, a direct owner directive): the
 *  twenty `/blog/*` articles are fifteen per cent of the site and were reachable only from
 *  the footer and one homepage section. `hands` and `about` stay footer-only — the directive
 *  named `/blog` specifically, and the header is still a starting point, not an index. */
export const PRIMARY_NAV_IDS = ['learn', 'range', 'tools', 'practice', 'blog', 'glossary'] as const;

export function primaryNavRoutes(): readonly RouteEntry[] {
  return PRIMARY_NAV_IDS.map(routeById);
}

/**
 * The footer's destinations, in display order: the header's six, plus the two global pages
 * that fit nowhere else.
 *
 * `blog`, `hands` and `about` were once in NEITHER nav, which made `/about` — the only page
 * stating that this site is affiliated with nobody and where its numbers come from —
 * reachable from no page at all, and put the twenty `/hands/*` pages behind no global
 * navigation whatsoever (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M11, M12). `blog` has since
 * been promoted into the header (ruling 102) and is spread from `PRIMARY_NAV_IDS` rather than
 * listed again, so it can never appear twice down here; the footer is still where the site
 * lists the rest of itself.
 */
export const FOOTER_NAV_IDS = [...PRIMARY_NAV_IDS, 'hands', 'about'] as const;

export function footerNavRoutes(): readonly RouteEntry[] {
  return FOOTER_NAV_IDS.map(routeById);
}

/**
 * Every non-home route grouped by footer section, in registry order. `home` is excluded —
 * the wordmark already covers `/`, so the footer does not also list it as a section link.
 */
export function routesBySection(): ReadonlyMap<RouteSection, readonly RouteEntry[]> {
  const map = new Map<RouteSection, RouteEntry[]>();
  for (const route of ROUTES) {
    if (route.section === 'home') continue;
    const bucket = map.get(route.section);
    if (bucket) bucket.push(route);
    else map.set(route.section, [route]);
  }
  return map;
}
