'use client';

/**
 * `SiteHeader` — the 3BETTILT wordmark, the six primary-nav destinations, a search
 * affordance and the theme toggle. Everything nav-shaped is driven by `src/lib/routes.ts`,
 * so the header cannot quietly disagree with the footer or with reality about what exists.
 *
 * ## Desktop (`md` and up)
 *
 * Wordmark · six links (`nav[aria-label="주요 메뉴"]`, the current section marked three ways
 * by `RouteNavItem`) · search · theme. The row is `whitespace-nowrap` on purpose: with six
 * Korean labels it is the widest thing in the header, and a wrapping label would hide a
 * real overflow by quietly becoming two lines.
 *
 * From `lg` up a second, quieter group (`nav[aria-label="보조 메뉴"]`: 핸드 목록 · 소개) sits
 * after the six behind a hairline (WP-S3-19, review B-M2). Those two pages were one tap
 * away on a phone (the panel's "더 보기") but reachable only from the footer on a desktop —
 * backwards, on the wider canvas. They are NOT added to `PRIMARY_NAV_IDS`: the header's six
 * stay six (`routes.test.ts` pins that), the secondary group is set smaller and in the
 * muted ink so it reads as "also here", and it is hidden between `md` and `lg` where the
 * bar has no room for eight labels — there, as before, the footer carries them.
 *
 * ## Mobile (below `md`) — Stage 3 contract AE
 *
 * Wordmark · search · theme · hamburger. The hamburger opens a panel that is conditionally
 * RENDERED, not hidden with CSS — a closed panel has no DOM nodes, so a keyboard user can
 * never land on an invisible link. The open panel:
 *
 *   - lists all six destinations as 44px rows with the current one marked (same
 *     `RouteNavItem`, same `aria-current`), then the pages the header does not carry on
 *     desktop (검색 · 핸드 목록 · 소개) under a "더 보기" heading, so every page is one tap
 *     from any page;
 *   - moves focus to its first link on open, TRAPS Tab/Shift+Tab inside the panel and the
 *     close button, closes on Escape (returning focus to the button) and on any click
 *     outside the header. Native `<a>`s mean a chosen link is a full navigation, which is
 *     itself the "close".
 *
 * The theme toggle stays in the top bar at every width rather than being duplicated into
 * the panel: one control in one place beats the same control in two.
 *
 * The search affordance is driven by the registry like everything else here: `/search` is
 * `available: true` and the page works, so the magnifier is a real link to it. The
 * unavailable branch is kept rather than deleted — it is what makes this honest if the route
 * is ever pulled — and `routes.test.ts` decides which branch is the truthful one.
 *
 * The wordmark is a plain `<a>`, not `next/link` — see `RouteNavItem.tsx` for why.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation.js';
import { primaryNavRoutes, routeById, type RouteEntry } from '../lib/routes.js';
import { RouteNavItem } from './RouteNavItem.js';
import { ThemeToggle } from './ThemeToggle.js';

/**
 * Which nav entry is the section the reader is currently inside — or `null` for a page that
 * belongs to none of them (`/about`, `/search`, `/`).
 *
 * Two rules, both of which a naive `startsWith` gets wrong:
 *
 *  - LONGEST MATCH WINS. `/tools/range` is prefixed by both `/tools` and `/tools/range`, and
 *    both are in this header. Marking both would tell the reader they are in two places.
 *  - A SEGMENT BOUNDARY IS REQUIRED. `/tools` must not light up for a hypothetical
 *    `/toolsomething`, and `/` must match only itself or it would be current everywhere.
 *
 * Safe to call with the pathname Next reports during static prerendering, which for a dynamic
 * route can be the template (`/learn/[slug]`) rather than a generated path: the template still
 * sits under `/learn/`, so the answer is the same one the browser computes after hydration,
 * and the markup does not change underneath React.
 */
export function activeNavId(
  pathname: string | null | undefined,
  routes: readonly RouteEntry[],
): string | null {
  if (pathname === null || pathname === undefined || pathname === '') return null;
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  let best: RouteEntry | null = null;
  for (const route of routes) {
    if (!route.available) continue;
    // The home route is its localised root (`/ko`) and matches only itself; every other
    // route matches itself and anything under it.
    const hit =
      route.sitePath === '/'
        ? path === route.path
        : path === route.path || path.startsWith(`${route.path}/`);
    if (hit && (best === null || route.path.length > best.path.length)) best = route;
  }
  return best === null ? null : best.id;
}

/** The pages the mobile panel lists under "더 보기": everything the footer carries that the
 *  header's six do not, plus search — so no page is reachable only by scrolling to the
 *  bottom on a phone. */
export const MOBILE_MORE_IDS = ['search', 'hands', 'about'] as const;

/** The pages the desktop bar carries beside the six, from `lg` up (B-M2): the mobile
 *  panel's "더 보기" minus search, which has its own icon at every width. */
export const DESKTOP_SECONDARY_IDS = ['hands', 'about'] as const;

const MOBILE_NAV_ID = 'fishtilt-mobile-nav';

const FOCUSABLE = 'a[href], button:not([disabled])';

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 13.5 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M3 6h14M3 10h14M3 14h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark({ href, current }: { readonly href: string; readonly current: boolean }) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 text-lg font-bold tracking-[0.2em] text-text-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    >
      <span aria-hidden="true" className="block h-2.5 w-2.5 rounded-[2px] bg-brand-600" />
      3BETTILT
    </a>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const primaryNav = primaryNavRoutes();
  const more = MOBILE_MORE_IDS.map(routeById);
  const secondary = DESKTOP_SECONDARY_IDS.map(routeById);
  const home = routeById('home');
  const search = routeById('search');
  const pathname = usePathname();
  const currentId = activeNavId(pathname, primaryNav);
  const currentMoreId = activeNavId(pathname, more);
  const atHome = pathname === home.path || pathname === `${home.path}/`;

  const close = useCallback((refocus: boolean) => {
    setMobileOpen(false);
    if (refocus) toggleRef.current?.focus();
  }, []);

  // Open: focus the first link. Escape closes; Tab/Shift+Tab cycle inside the panel and
  // the close button; a click anywhere outside the header closes without moving focus.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'Tab') return;
      const toggle = toggleRef.current;
      const inside = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      const cycle = toggle === null ? inside : [toggle, ...inside];
      if (cycle.length === 0) return;
      const firstStop = cycle[0];
      const lastStop = cycle[cycle.length - 1];
      const active = document.activeElement;
      if (firstStop === undefined || lastStop === undefined) return;
      if (event.shiftKey && active === firstStop) {
        event.preventDefault();
        lastStop.focus();
      } else if (!event.shiftKey && active === lastStop) {
        event.preventDefault();
        firstStop.focus();
      } else if (!cycle.includes(active as HTMLElement)) {
        // Focus escaped (it can, via the address bar or a script): pull it back in.
        event.preventDefault();
        firstStop.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [mobileOpen, close]);

  return (
    <header ref={headerRef} className="relative z-40 border-b border-line-500 bg-ground-900">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-6 py-3">
        <Wordmark href={home.path} current={atHome} />

        <div className="hidden min-w-0 items-center gap-5 md:flex">
          <nav aria-label="주요 메뉴" className="flex items-center gap-6 whitespace-nowrap">
            {primaryNav.map((route) => (
              <RouteNavItem
                key={route.id}
                route={route}
                active={route.id === currentId}
                className="text-sm font-medium"
              />
            ))}
          </nav>
          <nav
            aria-label="보조 메뉴"
            // The muted ink is set from the nav, not per item: `RouteNavItem` paints its own
            // `text-text-100`, and two same-property utilities on one element resolve by
            // stylesheet order, not by which one was written last. `[&>a]` outranks it.
            className="hidden items-center gap-4 border-l border-line-500 pl-5 whitespace-nowrap lg:flex [&>a]:text-text-300 [&>a:hover]:text-brand-500 [&>a[aria-current=page]]:text-brand-500"
          >
            {secondary.map((route) => (
              <RouteNavItem
                key={route.id}
                route={route}
                active={route.id === currentMoreId}
                className="text-[0.8125rem] font-medium"
              />
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {search.available ? (
            <a
              href={search.path}
              aria-label={search.label}
              aria-current={currentMoreId === 'search' ? 'page' : undefined}
              className="flex h-11 w-11 items-center justify-center rounded-md text-text-300 outline-none transition-colors hover:text-text-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 aria-[current=page]:text-brand-500"
            >
              <SearchIcon />
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-label={`${search.label} (준비 중)`}
              className="flex h-11 w-11 items-center justify-center rounded-md text-text-300 opacity-60 disabled:cursor-not-allowed"
            >
              <SearchIcon />
            </button>
          )}
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_NAV_ID}
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => (mobileOpen ? close(true) : setMobileOpen(true))}
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:hidden"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          ref={panelRef}
          id={MOBILE_NAV_ID}
          aria-label="주요 메뉴 (모바일)"
          data-mobile-nav="open"
          className="absolute inset-x-0 top-full max-h-[calc(100vh-4.25rem)] overflow-y-auto border-b border-line-500 bg-ground-900 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] md:hidden"
        >
          {/* `RouteNavItem` is `-mx-3 px-3` (its hit area grows without moving its text); the
              rows here are full-width, so the box is widened by the same 1.5rem the margins
              pull it out by, and every row is one continuous 48px target. */}
          <ul className="px-6 py-3">
            {primaryNav.map((route) => (
              <li key={route.id}>
                <RouteNavItem
                  route={route}
                  active={route.id === currentId}
                  className="w-[calc(100%+1.5rem)] rounded-md py-3 text-base font-semibold hover:bg-ground-800"
                />
              </li>
            ))}
          </ul>
          <div className="border-t border-line-500 px-6 py-3">
            <p className="pb-1 text-xs font-semibold tracking-[0.06em] text-text-300">더 보기</p>
            <ul>
              {more.map((route) => (
                <li key={route.id}>
                  <RouteNavItem
                    route={route}
                    active={route.id === currentMoreId}
                    className="w-[calc(100%+1.5rem)] rounded-md text-sm font-medium hover:bg-ground-800"
                  />
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
