/**
 * `Breadcrumbs` — the "where am I" trail at the top of a content page, and the
 * `BreadcrumbList` structured data that describes it.
 *
 * Both come from ONE trail (`src/lib/seo/breadcrumbs.ts`). That is the whole design: a
 * visible trail and a `BreadcrumbList` written in two places drift, and when they drift
 * the markup is describing a navigation path the page does not offer — schema spam by
 * accident rather than by intent (build spec §35). Here the JSON-LD is a serialisation of
 * the same array the `<ol>` renders, so they cannot disagree.
 *
 * ## Markup choices
 *
 * - `<nav aria-label="현재 위치">` — a landmark a screen-reader user can skip, named in
 *   Korean like the rest of the UI (ADR-0053 exempts poker notation, not interface copy).
 * - An ordered list, because the order is the meaning.
 * - The current page is the last item, rendered as text with `aria-current="page"` — never
 *   a link to the page you are already on.
 * - Each crumb link is `min-h-11`. The trail's type is 14px and its natural line box is
 *   20px tall, under both the 44px target this project holds itself to and WCAG 2.2's 24px
 *   floor; the box grows, the type does not.
 * - The `›` separators are `aria-hidden`: they are punctuation for the eye, and announcing
 *   them turns "홈 배우기 팟 오즈" into "홈 오른쪽 꺾쇠 배우기 …".
 * - A plain `<a>`, not `next/link`, like every other link in this app — see
 *   `RouteNavItem.tsx` for why that constraint exists.
 */
import { breadcrumbListJsonLd, JsonLd, type BreadcrumbItem } from '../lib/seo/index.js';

export interface BreadcrumbsProps {
  readonly trail: readonly BreadcrumbItem[];
  readonly className?: string;
}

export function Breadcrumbs({ trail, className = '' }: BreadcrumbsProps) {
  if (trail.length === 0) return null;

  return (
    <>
      <nav aria-label="현재 위치" className={className}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-300">
          {trail.map((crumb, index) => (
            <li key={crumb.path} className="flex items-center gap-x-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-text-500">
                  ›
                </span>
              ) : null}
              {crumb.current ? (
                <span aria-current="page" className="text-text-100">
                  {crumb.label}
                </span>
              ) : (
                <a
                  href={crumb.path}
                  className="inline-flex min-h-11 items-center outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {crumb.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd blocks={[breadcrumbListJsonLd(trail)]} />
    </>
  );
}
