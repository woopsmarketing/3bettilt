/**
 * Mode A of the learn hub: the curriculum as a progression (contract AR). Three stages, each
 * a split — the stage's name and what it covers on the left, its lessons on a numbered rail
 * on the right — and the rail's marker is the lesson's REAL curriculum number, so the reader
 * sees "7" beside `position` whichever stage it sits in. `<ol start>` carries the same
 * number to assistive technology.
 *
 * Presentational only: it receives resolved entries (record, href, category) from the page
 * and decides nothing about order, category or whether a lesson may be linked. A lesson with
 * `href: null` is written as a plan and renders as text with the "준비 중" badge — the same
 * rule `LinkCard`, `NextRead` and `RelatedContent` follow.
 */
import type { LearnCategory, LearnStage } from '../../content/registry/learn/categories.js';
import type { LearnRecord } from '../../content/types.js';
import { contentMeta } from '../../content/graph.js';
import { TIMELINE_RAIL } from '../Timeline.js';

export interface RoadmapEntry {
  readonly lesson: LearnRecord;
  readonly href: string | null;
  /** `null` = the registry has no category for this slug (never true of a real lesson —
   *  `categories.test.ts` — but a record that reaches here uncategorised still renders). */
  readonly category: LearnCategory | null;
}

export interface RoadmapStageGroup {
  readonly stage: LearnStage;
  readonly lessons: readonly RoadmapEntry[];
}

export interface LearnRoadmapProps {
  readonly stages: readonly RoadmapStageGroup[];
  /** Lessons whose order falls outside every stage. Rendered last, under a heading that
   *  says so, rather than dropped or silently attached to the final stage. */
  readonly unstaged?: readonly RoadmapEntry[];
  readonly className?: string;
}

const UNSTAGED_HEADING_ID = 'stage-unassigned-heading';

const PLANNED_BADGE =
  'ml-2 inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300';

/** Sum of the stage's reading times, or `null` when any lesson has none yet. Counting the
 *  records' own numbers, not estimating anything. */
function stageMinutes(lessons: readonly RoadmapEntry[]): number | null {
  let total = 0;
  for (const { lesson } of lessons) {
    if (lesson.readMinutes === null) return null;
    total += lesson.readMinutes;
  }
  return total;
}

function Step({ entry }: { readonly entry: RoadmapEntry }) {
  const { lesson, href, category } = entry;
  const titleClass = 'prose-ko text-lg font-semibold text-text-100';
  return (
    <li className={TIMELINE_RAIL.item} data-order={lesson.order}>
      <span aria-hidden="true" className={TIMELINE_RAIL.marker}>
        {lesson.order}
      </span>
      <div className="min-w-0">
        <p>
          {href === null ? (
            <span className={titleClass}>
              {lesson.title}
              <span className={PLANNED_BADGE}>준비 중</span>
            </span>
          ) : (
            <a
              href={href}
              // `inline-block py-3 -my-3`: a 44px tap box (WP-O1) that adds no vertical space —
              // the padding grows the hit area and the negative margin gives it back, so the
              // timeline's rhythm is unchanged (WP-S3-17; WP-14 flagged this at 21px).
              className={`${titleClass} inline-block rounded-sm py-3 -my-3 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
            >
              {lesson.title}
            </a>
          )}
        </p>
        <p className="mt-1 text-xs text-text-300">
          {category === null ? null : (
            <>
              <span className="font-medium text-text-100">{category.label}</span>
              <span aria-hidden="true" className="mx-1.5 text-text-500">
                ·
              </span>
            </>
          )}
          {contentMeta(lesson)}
        </p>
        <p className="mt-2 max-w-lead prose-ko text-[0.9375rem] text-text-300">
          {lesson.description}
        </p>
      </div>
    </li>
  );
}

export function LearnRoadmap({ stages, unstaged = [], className = '' }: LearnRoadmapProps) {
  return (
    <div data-learn="roadmap" className={`space-y-14 ${className}`}>
      {stages.map(({ stage, lessons }) => {
        const minutes = stageMinutes(lessons);
        const headingId = `${stage.id}-heading`;
        return (
          <section
            key={stage.id}
            aria-labelledby={headingId}
            className="grid gap-6 lg:grid-cols-12 lg:gap-12"
          >
            <div className="min-w-0 lg:col-span-4">
              <p className="text-sm font-semibold tracking-[0.06em] text-brand-500">
                {stage.ordinal}단계
              </p>
              <h3 id={headingId} className="mt-1.5 prose-ko text-xl font-semibold text-text-100">
                {stage.label}
              </h3>
              <p className="mt-2 prose-ko text-[0.9375rem] text-text-300">{stage.description}</p>
              <p className="tabular mt-3 text-xs text-text-300">
                레슨 {stage.first}–{stage.last}
                {minutes === null ? null : ` · 약 ${minutes}분`}
              </p>
            </div>
            <ol start={stage.first} className={`${TIMELINE_RAIL.list} min-w-0 lg:col-span-8`}>
              {lessons.map((entry) => (
                <Step key={entry.lesson.id} entry={entry} />
              ))}
            </ol>
          </section>
        );
      })}
      {unstaged.length > 0 ? (
        <section
          aria-labelledby={UNSTAGED_HEADING_ID}
          data-stage="unassigned"
          className="grid gap-6 lg:grid-cols-12 lg:gap-12"
        >
          <div className="min-w-0 lg:col-span-4">
            <h3 id={UNSTAGED_HEADING_ID} className="prose-ko text-xl font-semibold text-text-100">
              단계 미정
            </h3>
            <p className="mt-2 prose-ko text-[0.9375rem] text-text-300">
              아직 단계에 배정되지 않은 레슨입니다.
            </p>
          </div>
          <ol
            start={unstaged[0]?.lesson.order}
            className={`${TIMELINE_RAIL.list} min-w-0 lg:col-span-8`}
          >
            {unstaged.map((entry) => (
              <Step key={entry.lesson.id} entry={entry} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
