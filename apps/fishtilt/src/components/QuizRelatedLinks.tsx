/**
 * `QuizRelatedLinks` — the "learn more" half of a quiz question (WP-L1 brief: "a quiz that
 * only says 'wrong' teaches nothing"). Renders whichever of `relatedTool`/`relatedConcept`
 * the question actually carries; renders nothing at all if it carries neither.
 *
 * Stage 3: two compact link rows instead of a card plus a `ToolCTA` block — after every
 * answer the reader is mid-quiz, and a 200px aside between the explanation and "다음 문제"
 * pushed the one button that matters below the fold on a phone. The labels are the
 * D-S3-16 relation words (`더 배우기` for the concept, `직접 확인하기` for the tool), so the
 * quiz speaks the same vocabulary as every lesson's `RelatedContent`.
 *
 * Both cross-links reuse existing, already-honest machinery rather than a third
 * implementation of "link or 준비 중" (CLAUDE.md: no second system):
 *
 *   - `relatedTool` (a route id) resolves through `toolHref`/`toolRoute`, the same pair
 *     `ToolCTA` uses — `null` for an unavailable route renders the inert 준비 중 row.
 *   - `relatedConcept` (a content id) is resolved the same way `StartingHandLessonLink`
 *     (`/tools/starting-hand`) resolves its own `PLANNED` lesson link: `contentById` +
 *     `hrefOfContent`, a live link when published, an inert 준비 중 row otherwise.
 */
import { contentById, contentMeta, hrefOfContent, toolHref, toolRoute } from '../content/graph.js';

export interface QuizRelatedLinksProps {
  readonly relatedTool?: string;
  readonly relatedConcept?: string;
  readonly className?: string;
}

const ROW = 'flex min-h-11 items-center gap-3 rounded-md px-3 -mx-3 outline-none transition-colors';
const LINK_ROW = `${ROW} text-text-100 hover:bg-panel-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`;
const INERT_ROW = `${ROW} text-text-300`;

function Badge() {
  return (
    <span className="shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
      준비 중
    </span>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="ml-auto shrink-0 text-brand-500">
      →
    </span>
  );
}

function RelatedConceptLink({ contentId }: { readonly contentId: string }) {
  const record = contentById(contentId);
  const href = hrefOfContent(record);
  const body = (
    <span className="min-w-0">
      <span className="block text-xs font-semibold tracking-[0.04em] text-text-300">더 배우기</span>
      <span className="prose-ko block text-sm font-medium">
        {record.title}
        <span className="ml-2 text-xs font-normal text-text-300">{contentMeta(record)}</span>
      </span>
    </span>
  );

  if (href !== null) {
    return (
      <li>
        <a href={href} className={LINK_ROW}>
          {body}
          <Arrow />
        </a>
      </li>
    );
  }
  return (
    <li>
      <span className={INERT_ROW}>
        {body}
        <Badge />
      </span>
    </li>
  );
}

function RelatedToolLink({ routeId }: { readonly routeId: string }) {
  const route = toolRoute(routeId);
  const href = toolHref(routeId);
  const body = (
    <span className="min-w-0">
      <span className="block text-xs font-semibold tracking-[0.04em] text-text-300">
        직접 확인하기
      </span>
      <span className="prose-ko block text-sm font-medium">{route.label}</span>
    </span>
  );

  if (href !== null) {
    return (
      <li>
        <a href={href} className={LINK_ROW}>
          {body}
          <Arrow />
        </a>
      </li>
    );
  }
  return (
    <li>
      <span className={INERT_ROW}>
        {body}
        <Badge />
      </span>
    </li>
  );
}

export function QuizRelatedLinks({
  relatedTool,
  relatedConcept,
  className = '',
}: QuizRelatedLinksProps) {
  if (relatedTool === undefined && relatedConcept === undefined) return null;

  return (
    <ul aria-label="이어서 보기" className={`divide-y divide-line-500 ${className}`}>
      {relatedConcept !== undefined ? <RelatedConceptLink contentId={relatedConcept} /> : null}
      {relatedTool !== undefined ? <RelatedToolLink routeId={relatedTool} /> : null}
    </ul>
  );
}
