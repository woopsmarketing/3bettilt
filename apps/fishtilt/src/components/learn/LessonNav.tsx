/**
 * The foot of a lesson: previous/next by curriculum ORDER (`NextRead`), and, on the last
 * lesson only, the roadmap's honest end — a band that says there is no next lesson and
 * points at the quiz and back at the hub's topic browse — instead of a fabricated neighbour.
 *
 * `prev`/`next` are already-resolved links (`href: null` = written as a plan, rendered
 * "준비 중" by `NextRead`), so this component decides nothing about the curriculum itself.
 *
 * Rendered with `emphasis="next"` and placed ABOVE the related groups by the lesson page
 * (WP-S3-19, review B-M4): the next lesson is the step the roadmap wants, so it is the
 * first and largest thing after the prose, not the last and smallest.
 */
import { CtaBand } from '../CtaBand.js';
import { NextRead, type NextReadLink } from '../NextRead.js';

export interface LessonNavProps {
  readonly prev?: NextReadLink;
  readonly next?: NextReadLink;
  /** Where the end-of-roadmap band sends the reader. Shown only when `next` is absent. */
  readonly end: {
    readonly practiceHref: string | null;
    readonly topicsHref: string;
  };
  readonly className?: string;
}

export function LessonNav({ prev, next, end, className = '' }: LessonNavProps) {
  return (
    <div data-lesson="nav" className={className}>
      <NextRead prev={prev} next={next} label="다음으로 읽기" emphasis="next" className="my-0" />
      {next === undefined ? (
        <CtaBand
          rounded
          className="mt-10"
          title="로드맵의 마지막 레슨입니다"
          description="다음 레슨은 없습니다. 배운 내용을 퀴즈로 확인하거나, 주제별로 다시 골라 읽어보세요."
          primary={{ href: end.practiceHref, label: '퀴즈로 확인하기' }}
          secondary={{ href: end.topicsHref, label: '주제별로 다시 보기' }}
        />
      ) : null}
    </div>
  );
}
