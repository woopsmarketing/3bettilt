/**
 * `SiteFooter` — brand mark, the site's whole map grouped by what a reader is doing, and the
 * mandatory education-only disclaimer line. No affiliate, casino, deposit, bonus or sign-up
 * surface anywhere in this file, or anywhere else in 3BetTilt — that is a hard product
 * boundary (CLAUDE.md, build spec §1/§78), not a style choice.
 *
 * ## Groups (Stage 3, contract AF)
 *
 * The header is a starting point; the footer is the index. It lists every route the registry
 * marks as a global destination (`footerNavRoutes()`: the header's six plus `/hands` and
 * `/about`) AND the pages under them — the three quizzes, the five calculators, search — so
 * that from the bottom of any page a reader can reach any page. The groups follow the site's
 * own information architecture rather than the registry's flat order: 배우기 (read, then
 * practise), 도구 (the table and the calculators), 콘텐츠 (articles and search), 용어와 핸드
 * (look a word or a hand up), and 3BetTilt itself (the trust page and what this site is).
 *
 * The registry still decides what is a link: an `available: false` entry renders as inert
 * "준비 중" text through `RouteNavItem`, here exactly as in the header. Every id below is
 * resolved through `routeById`, which throws on an unknown id at render — a group cannot
 * silently drift from the registry.
 *
 * The brand mark is plain text, not a link — the header's wordmark already is one. Two links
 * named "3BETTILT" on the same page make every text/role query for it ambiguous for no real
 * benefit (a footer does not need a second "back to home" affordance).
 *
 * No active state down here on purpose. The header marks the current section because that
 * is where a reader looks to answer "where am I"; repeating the mark in the footer would just
 * be a second, quieter claim about the same thing.
 *
 * Mobile: two columns of short lists, the brand block on top — compact, never a stack of
 * five full-width lists a thumb has to scroll through to reach the bottom of the page.
 */
import { footerNavRoutes, routeById, type RouteEntry } from '../lib/routes.js';
import { RouteNavItem } from './RouteNavItem.js';

/** The exact line every surface of this site is allowed to describe itself with. */
export const FOOTER_DISCLAIMER =
  '3BetTilt는 텍사스 홀덤 학습과 확률 계산을 위한 교육용 사이트입니다.';

export interface FooterGroup {
  readonly heading: string;
  readonly routeIds: readonly string[];
}

/**
 * Sitemap groups, in reading order. `FOOTER_NAV_IDS` (the registry's global destinations)
 * must all appear here — `SiteFooter.test.tsx` asserts it — and the sub-pages are listed
 * under the hub they belong to.
 */
export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    heading: '배우기',
    routeIds: ['learn', 'practice', 'practiceRange', 'practiceHandRanking', 'practiceStartingHand'],
  },
  {
    heading: '도구',
    routeIds: [
      'range',
      'tools',
      'toolStartingHand',
      'toolEquity',
      'toolPotOdds',
      'toolOuts',
      'toolHandChecker',
    ],
  },
  { heading: '콘텐츠', routeIds: ['blog', 'search'] },
  { heading: '용어와 핸드', routeIds: ['glossary', 'hands'] },
];

/** Every registry destination the footer must carry, resolved once so a missing one throws. */
export function footerGroupRoutes(): readonly (readonly [FooterGroup, readonly RouteEntry[]])[] {
  return FOOTER_GROUPS.map((group) => [group, group.routeIds.map(routeById)] as const);
}

export function SiteFooter() {
  const groups = footerGroupRoutes();
  const about = routeById('about');
  // Belt and braces: every global destination the registry names is in a group. Rendering
  // would otherwise silently drop a route the header/footer contract promises.
  const listed = new Set(groups.flatMap(([, routes]) => routes.map((route) => route.id)));
  listed.add(about.id);
  for (const route of footerNavRoutes()) {
    if (!listed.has(route.id)) {
      throw new Error(`SiteFooter: footer destination "${route.id}" is in no footer group`);
    }
  }

  return (
    <footer className="border-t border-line-500 bg-ground-900">
      <div className="mx-auto max-w-shell px-6 py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <p className="inline-flex items-center gap-2 text-lg font-bold tracking-[0.2em] text-text-100">
              <span aria-hidden="true" className="block h-2.5 w-2.5 rounded-[2px] bg-brand-600" />
              3BETTILT
            </p>
            <p className="prose-ko mt-3 max-w-lead text-sm text-text-300">{FOOTER_DISCLAIMER}</p>
            <p className="prose-ko mt-2 max-w-lead text-sm text-text-300">
              화면의 숫자는 모두 이 사이트의 코드가 그 자리에서 계산한 값이고, 계정이나 개인 정보를
              요구하지 않습니다.
            </p>
          </div>

          <nav
            aria-label="바닥글 메뉴"
            className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-5 lg:gap-x-8"
          >
            {groups.map(([group, routes]) => (
              <div key={group.heading}>
                <p className="text-xs font-semibold tracking-[0.08em] text-text-300">
                  {group.heading}
                </p>
                <ul className="mt-3 flex flex-col gap-1">
                  {routes.map((route) => (
                    <li key={route.id}>
                      <RouteNavItem route={route} className="text-sm" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <p className="text-xs font-semibold tracking-[0.08em] text-text-300">3BetTilt</p>
              <ul className="mt-3 flex flex-col gap-1">
                <li>
                  <RouteNavItem route={about} className="text-sm" />
                </li>
              </ul>
              <p className="prose-ko mt-3 max-w-lead text-xs text-text-300">
                교육 목적으로만 만든 사이트입니다. 어떤 포커 사이트와도 관계가 없고, 돈을 걸거나
                옮기는 링크는 어디에도 없습니다.
              </p>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
