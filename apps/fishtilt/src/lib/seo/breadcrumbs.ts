/**
 * The breadcrumb trail for a page — one derivation, used by both the visible `<nav>` and the
 * `BreadcrumbList` structured data. Two entry points, one shape: `contentBreadcrumbs` for the
 * 113 records, `routeBreadcrumbs` for the 18 static routes.
 *
 * Bundling them is the point. A breadcrumb trail that a reader sees and a `BreadcrumbList`
 * that says something else is the most ordinary form of schema spam, and it happens by
 * accident whenever the two are written in different places. Here there is one trail and
 * `Breadcrumbs.tsx` renders both from it, so the markup cannot claim a path the page does
 * not show.
 *
 * The labels come from `src/lib/routes.ts` (the same strings the header and footer use),
 * so a crumb can never name a hub something the nav does not call it. The hub crumb is
 * dropped rather than rendered inert if its route is somehow unavailable — the site's
 * standing rule is that an unbuilt destination is never a link, and a breadcrumb has no
 * sensible "준비 중" form.
 */
import { contentPath } from '../../content/graph.js';
import type { AnyContentRecord, ContentKind } from '../../content/types.js';
import { routeById, type RouteSection } from '../routes.js';

export interface BreadcrumbItem {
  readonly label: string;
  /** Root-relative path. Present even for the current page — the trail is positional. */
  readonly path: string;
  /** `true` for the page the reader is on: rendered as text, not as a link. */
  readonly current: boolean;
}

/** The hub each content kind sits under, as a route id — never a hard-coded path. */
const HUB_ROUTE_ID: Readonly<Record<ContentKind, string>> = {
  learn: 'learn',
  blog: 'blog',
  glossary: 'glossary',
  hands: 'hands',
};

/**
 * `홈 › 배우기 › 팟 오즈` for `/learn/pot-odds`.
 *
 * Always at least two entries (home + the page itself), so a caller never has to handle
 * an empty trail.
 */
export function contentBreadcrumbs(record: AnyContentRecord): readonly BreadcrumbItem[] {
  const home = routeById('home');
  const hub = routeById(HUB_ROUTE_ID[record.kind]);
  const items: BreadcrumbItem[] = [{ label: home.label, path: home.path, current: false }];
  if (hub.available) items.push({ label: hub.label, path: hub.path, current: false });
  items.push({ label: record.title, path: contentPath(record), current: true });
  return items;
}

/**
 * The hub route each SECTION sits under, as a route id — the route-registry twin of
 * `HUB_ROUTE_ID` above.
 *
 * `null` means the section has nothing between it and the home page: `/about` and `/search`
 * are single global pages with no index above them, and `home` is the root itself. Writing
 * this as a total map over `RouteSection` rather than as a lookup with a fallback is what
 * makes a new section a compile error here instead of a silently two-item trail.
 */
const SECTION_HUB_ROUTE_ID: Readonly<Record<RouteSection, string | null>> = {
  home: null,
  learn: 'learn',
  blog: 'blog',
  glossary: 'glossary',
  hands: 'hands',
  tools: 'tools',
  practice: 'practice',
  search: null,
  about: null,
};

/**
 * `홈 › 무료 도구 › 승률 계산기` for `/tools/equity` — the trail for one of the 18 static
 * routes, built the same way `contentBreadcrumbs` builds a content page's.
 *
 * Every label comes from `src/lib/routes.ts`, so a crumb cannot name a page something the
 * header, the footer and the hub cards do not. The hub crumb appears only when the route is
 * not itself that hub (`/tools` is not its own parent) and only when the hub is `available`
 * — the site's standing rule that an unbuilt destination is never a link.
 *
 * **The home page gets an EMPTY trail**, and that is the answer rather than an omission: at
 * the root the trail would be a single crumb pointing at the page the reader is already on,
 * which tells them nothing the wordmark does not, and a one-item `BreadcrumbList` describes
 * no path. `Breadcrumbs` renders nothing — no `<nav>`, no JSON-LD — for an empty trail, so
 * this stays a total function that every caller can use unconditionally.
 */
export function routeBreadcrumbs(routeId: string): readonly BreadcrumbItem[] {
  const route = routeById(routeId);
  const home = routeById('home');
  if (route.id === home.id) return [];

  const items: BreadcrumbItem[] = [{ label: home.label, path: home.path, current: false }];
  const hubId = SECTION_HUB_ROUTE_ID[route.section];
  if (hubId !== null && hubId !== route.id) {
    const hub = routeById(hubId);
    if (hub.available) items.push({ label: hub.label, path: hub.path, current: false });
  }
  items.push({ label: route.label, path: route.path, current: true });
  return items;
}
