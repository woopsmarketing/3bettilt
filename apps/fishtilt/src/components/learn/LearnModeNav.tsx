/**
 * The hub's two ways in (contract AR): A "처음부터 배우기" → the ordered roadmap, B "특정 주제
 * 배우기" → the category browse. Both are same-page anchors, so the choice works with no
 * JavaScript and both sections are always in the document; this is a table of contents for
 * two modes, not a tab control that hides one of them.
 */
export interface LearnModeNavProps {
  readonly roadmap: { readonly href: string; readonly lessonCount: number };
  readonly topics: { readonly href: string; readonly categoryCount: number };
  readonly className?: string;
}

const LINK_CLASS =
  'group flex min-w-0 items-start gap-4 rounded-lg border border-line-500 bg-panel-700 p-5 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const MARK_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ground-800 text-sm font-semibold text-brand-500';

export function LearnModeNav({ roadmap, topics, className = '' }: LearnModeNavProps) {
  return (
    <nav aria-label="배우는 방법" className={className}>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <a href={roadmap.href} data-mode="roadmap" className={LINK_CLASS}>
            <span aria-hidden="true" className={MARK_CLASS}>
              A
            </span>
            <span className="min-w-0">
              <span className="block prose-ko text-base font-semibold text-text-100 group-hover:text-brand-500">
                처음부터 배우기
              </span>
              <span className="mt-1 block prose-ko text-sm text-text-300">
                {roadmap.lessonCount}편을 번호 순서대로. 포커를 처음 본다면 이쪽입니다.
              </span>
            </span>
          </a>
        </li>
        <li>
          <a href={topics.href} data-mode="topics" className={LINK_CLASS}>
            <span aria-hidden="true" className={MARK_CLASS}>
              B
            </span>
            <span className="min-w-0">
              <span className="block prose-ko text-base font-semibold text-text-100 group-hover:text-brand-500">
                특정 주제 배우기
              </span>
              <span className="mt-1 block prose-ko text-sm text-text-300">
                {topics.categoryCount}가지 주제 중 궁금한 것만 골라서. 아는 부분은 건너뛰어도
                됩니다.
              </span>
            </span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
