/**
 * The lesson header (WP-S3-09, contract AS): "레슨 N / 15", the category the lesson belongs
 * to (linking back to that category's section on the hub), the title, level and reading
 * time, and the prerequisites as one inline line rather than a card.
 *
 * The progress rail under the number is fifteen segments — one per lesson — with the
 * current one in the brand fill and the ones before it in the quiet ink. It is decorative
 * (`aria-hidden`): the visible "레슨 N / 15" already says the same thing in words.
 *
 * Everything shown is read from the record and the registry; the header derives nothing.
 */
import type { ContentLevel } from '../../content/types.js';
import type { ContentLink } from '../../content/graph.js';
import { ArticleMeta } from '../ArticleMeta.js';

export interface LessonHeaderProps {
  readonly order: number;
  readonly total: number;
  readonly title: string;
  readonly level: ContentLevel;
  readonly readMinutes: number | null;
  readonly category: { readonly label: string; readonly href: string };
  readonly prerequisites?: readonly ContentLink[];
  readonly className?: string;
}

const PLANNED_BADGE =
  'ml-1 inline-block rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300 align-middle';

export function LessonHeader({
  order,
  total,
  title,
  level,
  readMinutes,
  category,
  prerequisites = [],
  className = '',
}: LessonHeaderProps) {
  const segments = Array.from({ length: total }, (_, index) => index + 1);
  return (
    <header data-lesson="header" className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="tabular text-sm font-semibold tracking-[0.06em] text-brand-500">
          레슨 {order} / {total}
        </p>
        <a
          href={category.href}
          data-lesson="category"
          className="group -my-3 inline-flex min-h-11 items-center outline-none"
        >
          {/* The pill stays 22px tall; the anchor around it is the 44px touch target and the
              focus ring is drawn on the pill (group-focus-visible, see globals.css). */}
          <span className="inline-flex items-center rounded-full border border-line-500 px-2.5 py-0.5 text-xs font-medium text-text-100 group-hover:border-brand-500 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand-500">
            {category.label}
          </span>
        </a>
      </div>

      <div aria-hidden="true" data-lesson="progress" className="mt-3 flex gap-1">
        {segments.map((segment) => (
          <span
            key={segment}
            data-state={segment === order ? 'current' : segment < order ? 'done' : 'ahead'}
            className={`h-1 flex-1 rounded-full ${
              segment === order ? 'bg-brand-600' : segment < order ? 'bg-text-300' : 'bg-line-500'
            }`}
          />
        ))}
      </div>

      <h1 className="mt-5 prose-ko text-article-h1 font-semibold tracking-[-0.01em] text-text-100">
        {title}
      </h1>
      <ArticleMeta className="mt-4" level={level} readMinutes={readMinutes} />

      {prerequisites.length > 0 ? (
        <p
          data-lesson="prerequisites"
          className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 prose-ko text-sm text-text-300"
        >
          <span className="font-medium text-text-100">먼저 읽으면 좋아요</span>
          {prerequisites.map((link, index) => (
            <span key={link.key} className="inline-flex items-baseline">
              {index > 0 ? (
                <span aria-hidden="true" className="mr-2 text-text-500">
                  ·
                </span>
              ) : null}
              {link.href === null ? (
                <span>
                  {link.label}
                  <span className={PLANNED_BADGE}>준비 중</span>
                </span>
              ) : (
                <a
                  href={link.href}
                  className="inline-block py-3 -my-3 text-text-100 underline decoration-line-500 underline-offset-4 outline-none hover:decoration-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {link.label}
                </a>
              )}
            </span>
          ))}
        </p>
      ) : null}
    </header>
  );
}
