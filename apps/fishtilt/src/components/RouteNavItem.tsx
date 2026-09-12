/**
 * `RouteNavItem` — one entry in the header or footer nav, driven entirely by the route
 * registry (`src/lib/routes.ts`). This is the one place that turns `available` into
 * markup, so the header and the footer can never disagree about what a "coming soon" link
 * looks like.
 *
 * An available route is a real link. An unavailable one is plain, readable text (never
 * dimmed below AA — a reader still needs to be able to read what is coming) with a visible
 * "준비 중" badge, and it renders NO link/button semantics at all: it is not a dead link
 * that 404s, not a disabled control someone might wonder how to enable. It is inert text
 * that happens to describe a future page.
 *
 * `inline-flex min-h-11 items-center`: the nav label itself is a 20px line box, which is
 * under both the 44px target this project holds itself to and WCAG 2.2's 24px floor. The
 * link's BOX is grown to 44px rather than its type, so nothing about the wordmark or the nav
 * changes visually on desktop (the header row is already 44px tall because of the search
 * button) and the footer row simply gains the height a thumb needs.
 *
 * `px-3 -mx-3` does the same for the WIDTH. A short Korean label such as `퀴즈` is a 24px-wide
 * box; the padding takes it past 44px and the equal negative margin puts the text back
 * exactly where it was, so the row looks identical and only the hit area grows. Both nav
 * rows space their items with `gap-6` (24px), which is exactly what the two 12px paddings
 * consume — adjacent targets meet, and none of them overlaps its neighbour.
 *
 * A plain `<a>`, not `next/link`: `apps/fishtilt/tsconfig.json` resolves modules with
 * `nodenext` (see the note there, and `apps/web/tsconfig.json`'s, which documents the same
 * constraint first) — `next/link` has no package `exports` map, and under this app's
 * `type: module` + `nodenext` combination it does not resolve as a typed module at all
 * (`TS2307`), not even as the "whole namespace" fallback `apps/web` describes. Every nav
 * link in this app is a full page load rather than client-side navigation as a result;
 * that is an acceptable, already-precedented trade here, not a lie about the type.
 */
import type { RouteEntry } from '../lib/routes.js';

export interface RouteNavItemProps {
  readonly route: RouteEntry;
  readonly className?: string;
  /**
   * True when this entry is the section the reader is currently inside. The header decides
   * this (`activeNavId` in `SiteHeader.tsx`) because "which one is current" is a question
   * about the whole list, not about any single item — `/tools` and `/tools/range` both prefix
   * `/tools/range`, and only the longer one is the answer.
   */
  readonly active?: boolean;
}

export function RouteNavItem({ route, className = '', active = false }: RouteNavItemProps) {
  if (route.available) {
    /*
     * The current section is marked THREE ways, not one: `aria-current="page"` for assistive
     * technology, the brand colour, and an underline. The underline is what makes it survive
     * colour removal — a reader with achromatopsia, or on a monochrome display, still sees
     * which entry is current (WCAG 1.4.1). The colour alone would not do that, and the brand
     * red is already this site's "this is interactive" colour on hover.
     */
    const state = active
      ? 'text-brand-500 underline decoration-2 underline-offset-8'
      : 'text-text-100 hover:text-brand-500';

    return (
      <a
        href={route.path}
        aria-current={active ? 'page' : undefined}
        className={`-mx-3 inline-flex min-h-11 items-center px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${state} ${className}`}
      >
        {route.label}
      </a>
    );
  }

  return (
    <span
      className={`-mx-3 inline-flex min-h-11 items-center gap-1.5 px-3 text-text-300 ${className}`}
    >
      {route.label}
      <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
        준비 중
      </span>
    </span>
  );
}
