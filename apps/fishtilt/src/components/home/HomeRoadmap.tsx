/**
 * `HomeRoadmap` — the learning path as a progression, built from the learn module's own
 * stages (`LEARN_STAGES`, WP-S3-09) rather than as fifteen cards.
 *
 * Three stage columns on a desktop, three stacked blocks on a phone; each stage carries its
 * ordinal, its name, its own lessons in curriculum order (real `<ol start>` numbering, so
 * the numbers are the lesson orders and not a re-count), and the category each lesson
 * belongs to as quiet meta. Every lesson title is a link to its page; a lesson that is not
 * published yet is readable text with the site's "준비 중" badge and no link semantics.
 *
 * The numbers here are counts (편, 분) summed from records — never a poker fact.
 */
import { hrefOfContent } from '../../content/graph.js';
import {
  categoryOfLessonOrNull,
  LEARN_STAGES,
  lessonsOfStage,
  type LearnStage,
} from '../../content/registry/learn/categories.js';
import type { LearnRecord } from '../../content/types.js';
import {
  PAGE_VISUALS,
  pageVisual,
  themeVisual,
  type VisualAssetSpec,
  type VisualThemeId,
} from '../../content/visuals.js';
import { EditorialVisual } from '../visual/EditorialVisual.js';

/**
 * The picture each roadmap stage opens with: its own brand picture (`PAGE_VISUALS`), so the
 * home page does not repeat the category pictures the Learn hub shows, with the theme of the
 * stage's first category as the drawn fallback.
 */
const STAGE_VISUAL: Readonly<
  Record<string, { readonly asset: VisualAssetSpec; readonly theme: VisualThemeId }>
> = {
  'stage-rules': { asset: PAGE_VISUALS.homeStageRules, theme: 'basics' },
  'stage-range-position': { asset: PAGE_VISUALS.homeStageRangePosition, theme: 'position' },
  'stage-postflop-math': { asset: PAGE_VISUALS.homeStagePostflopMath, theme: 'math' },
};

export interface HomeRoadmapProps {
  readonly labelledBy: string;
  readonly className?: string;
}

const LESSON_LINK =
  'inline-flex min-h-11 items-center prose-ko text-[0.9375rem] font-medium text-text-100 outline-none ' +
  'hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function stageMinutes(lessons: readonly LearnRecord[]): number | null {
  let total = 0;
  for (const lesson of lessons) {
    if (lesson.readMinutes === null) return null;
    total += lesson.readMinutes;
  }
  return total;
}

function Stage({ stage }: { readonly stage: LearnStage }) {
  const lessons = lessonsOfStage(stage);
  const picture = STAGE_VISUAL[stage.id];
  const minutes = stageMinutes(lessons);
  const meta = [`${lessons.length}편`, minutes === null ? null : `약 ${minutes}분`]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <li data-stage={stage.id} className="min-w-0">
      {/* One compact picture per stage (§17 "Learn 3"). */}
      <EditorialVisual
        visual={
          picture === undefined
            ? themeVisual('basics', stage.id)
            : pageVisual(picture.asset, picture.theme)
        }
        aspect="21/9"
        scrim="hero"
        sizes="(min-width: 1024px) 384px, 100vw"
        className="mb-6"
      />
      <div className="flex items-center gap-4">
        <span className="tabular font-mono text-4xl font-bold leading-none text-brand-500">
          {String(stage.ordinal).padStart(2, '0')}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-line-500" />
        <span className="tabular text-xs font-medium text-text-300">{meta}</span>
      </div>
      <h3 className="mt-5 prose-ko text-xl font-semibold text-text-100">{stage.label}</h3>
      <p className="mt-1.5 prose-ko text-sm text-text-300">{stage.description}</p>
      <ol
        start={stage.first}
        className="mt-5 divide-y divide-line-500/60 border-t border-line-500/60"
      >
        {lessons.map((lesson) => {
          const href = hrefOfContent(lesson);
          const category = categoryOfLessonOrNull(lesson);
          return (
            <li
              key={lesson.id}
              data-order={lesson.order}
              className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 py-0.5"
            >
              <span aria-hidden="true" className="tabular font-mono text-xs text-text-300">
                {String(lesson.order).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3">
                {href === null ? (
                  <span className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-text-300">
                    {lesson.title}
                    <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
                      준비 중
                    </span>
                  </span>
                ) : (
                  <a href={href} className={LESSON_LINK}>
                    {lesson.title}
                  </a>
                )}
                {category !== null ? (
                  <span className="text-xs text-text-300">{category.label}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

export function HomeRoadmap({ labelledBy, className = '' }: HomeRoadmapProps) {
  return (
    <ol
      aria-labelledby={labelledBy}
      className={`grid gap-12 lg:grid-cols-3 lg:gap-10 ${className}`}
    >
      {LEARN_STAGES.map((stage) => (
        <Stage key={stage.id} stage={stage} />
      ))}
    </ol>
  );
}
