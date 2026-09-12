/**
 * `QuizOnward` — the "이 퀴즈 다음에" block under a `/practice/*` round: the lesson the quiz
 * drills (a content id, a live link when published, an inert 준비 중 row otherwise — the
 * same `contentById` + `hrefOfContent` gate every tool page uses) and, when the page names
 * one, the tool the quiz is scored against (`toolHref`: a link when available, 준비 중 when
 * not). One implementation for the three quiz pages instead of three copies of the same
 * lesson card.
 */
import { contentById, contentMeta, hrefOfContent, toolHref, toolRoute } from '../content/graph.js';
import { SectionHeading } from './SectionHeading.js';

export interface QuizOnwardProps {
  /** Heading above the lesson row — each page keeps its own sentence. */
  readonly lessonHeading: string;
  /** Content id of the lesson. */
  readonly lesson: string;
  /** Route id of the tool, if the page has one to point at. */
  readonly tool?: string;
  readonly toolHeading?: string;
  readonly toolDescription?: string;
  /** The tool link's label; defaults to `${route.label} 열기`. */
  readonly toolAction?: string;
  readonly className?: string;
}

const ROW =
  'flex items-center gap-4 rounded-lg border border-line-500 bg-panel-700 p-4 outline-none transition-colors';
const LINK_ROW = `${ROW} hover:border-brand-500 hover:bg-panel-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`;

function Badge() {
  return (
    <span className="shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
      준비 중
    </span>
  );
}

export function QuizOnward({
  lessonHeading,
  lesson,
  tool,
  toolHeading,
  toolDescription,
  toolAction,
  className = '',
}: QuizOnwardProps) {
  const record = contentById(lesson);
  const lessonHref = hrefOfContent(record);
  const lessonBody = (
    <span className="min-w-0 flex-1">
      <span className="prose-ko block font-semibold text-text-100">{record.title}</span>
      <span className="prose-ko mt-1 block text-sm text-text-300">{record.description}</span>
      <span className="mt-2 block text-xs text-text-300">{contentMeta(record)}</span>
    </span>
  );

  const route = tool === undefined ? null : toolRoute(tool);
  const href = tool === undefined ? null : toolHref(tool);
  const action = toolAction ?? (route === null ? '' : `${route.label} 열기`);

  return (
    <div className={`space-y-10 ${className}`}>
      <div>
        <SectionHeading title={lessonHeading} className="mb-4" />
        {lessonHref !== null ? (
          <a href={lessonHref} className={LINK_ROW}>
            {lessonBody}
            <span aria-hidden="true" className="shrink-0 text-brand-500">
              →
            </span>
          </a>
        ) : (
          <div className={ROW}>
            {lessonBody}
            <Badge />
          </div>
        )}
      </div>

      {route !== null ? (
        <div>
          <SectionHeading title={toolHeading ?? '직접 확인하기'} className="mb-4" />
          {toolDescription ? (
            <p className="prose-ko mb-4 text-sm text-text-300">{toolDescription}</p>
          ) : null}
          {href !== null ? (
            <a
              href={href}
              className="inline-flex min-h-11 items-center rounded-md bg-brand-600 px-5 py-2.5 font-medium text-ink-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {action}
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-500 px-5 py-2.5 text-text-300">
              {action}
              <Badge />
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
