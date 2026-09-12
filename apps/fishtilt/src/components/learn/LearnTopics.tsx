/**
 * Mode B of the learn hub: the same lessons grouped by category (contract AR). A row of
 * anchor chips at the top jumps to a category's section further down; every section is in
 * the document regardless, so the browse needs no JavaScript and nothing is ever hidden.
 *
 * Within a category the lessons keep their curriculum order and show their curriculum
 * number — the browse is a second index over the roadmap, not a second ordering.
 *
 * Presentational only: the page resolves categories, anchors and hrefs; a lesson with
 * `href: null` renders as text plus "준비 중", like everywhere else.
 */
import type { LearnCategory } from '../../content/registry/learn/categories.js';
import { contentMeta } from '../../content/graph.js';
import type { RoadmapEntry } from './LearnRoadmap.js';

export interface TopicGroup {
  readonly category: LearnCategory;
  /** DOM id of this category's section (`LEARN_HUB_ANCHORS.category`). */
  readonly anchor: string;
  readonly lessons: readonly RoadmapEntry[];
}

export interface LearnTopicsProps {
  readonly groups: readonly TopicGroup[];
  readonly className?: string;
}

const CHIP_CLASS =
  'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-500 px-3.5 py-1.5 text-sm font-medium text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const PLANNED_BADGE =
  'shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300';

function Row({ entry }: { readonly entry: RoadmapEntry }) {
  const { lesson, href } = entry;
  return (
    <li className="flex items-baseline gap-4 py-3.5" data-order={lesson.order}>
      <span className="tabular w-6 shrink-0 text-sm font-semibold text-text-300">
        {String(lesson.order).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {href === null ? (
          <span className="inline-flex items-baseline gap-2 prose-ko font-medium text-text-100">
            {lesson.title}
            <span className={PLANNED_BADGE}>준비 중</span>
          </span>
        ) : (
          <a
            href={href}
            // Same 44px tap box as the roadmap title, without moving the row (WP-S3-17).
            className="prose-ko inline-block py-3 -my-3 font-medium text-text-100 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {lesson.title}
          </a>
        )}
        <span className="text-xs text-text-300">{contentMeta(lesson)}</span>
      </span>
    </li>
  );
}

export function LearnTopics({ groups, className = '' }: LearnTopicsProps) {
  return (
    <div data-learn="topics" className={className}>
      {/* `-mx-6 px-6` lets the chip row bleed to the screen edge and scroll sideways on a
          phone; from `sm` up it wraps instead, inside the column. Its own scroll container,
          so the page never gains horizontal scroll. */}
      <nav aria-label="주제 고르기" className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 pb-1 sm:flex-wrap">
          {groups.map(({ category, anchor, lessons }) => (
            <li key={category.id} className="shrink-0">
              <a href={`#${anchor}`} className={CHIP_CLASS}>
                {category.label}
                <span className="tabular text-xs text-text-300">{lessons.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 divide-y divide-line-500 border-t border-line-500">
        {groups.map(({ category, anchor, lessons }) => {
          const headingId = `${anchor}-heading`;
          return (
            <section
              key={category.id}
              id={anchor}
              aria-labelledby={headingId}
              className="grid scroll-mt-24 gap-4 py-10 lg:grid-cols-12 lg:gap-12"
            >
              <div className="min-w-0 lg:col-span-4">
                <h3 id={headingId} className="prose-ko text-xl font-semibold text-text-100">
                  {category.label}
                </h3>
                <p className="mt-2 prose-ko text-[0.9375rem] text-text-300">
                  {category.description}
                </p>
                <p className="tabular mt-3 text-xs text-text-300">레슨 {lessons.length}편</p>
              </div>
              <ul className="min-w-0 divide-y divide-line-500 lg:col-span-8">
                {lessons.map((entry) => (
                  <Row key={entry.lesson.id} entry={entry} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
