/**
 * `HandOnward` — the two graph-derived onward groups a hand page adds above the record's
 * own relations (WP-S3-13a): "관련 가이드" (blog search guides and lessons about this hand)
 * and "이런 이야기도 있어요" (hand stories in which this hand was actually dealt).
 *
 * Both lists come from `handGraph.ts` (declared relations ∪ what the rest of the graph
 * declares about this hand ∪ the stories' real hole cards) — see that module for why. This
 * component only renders: a divided list, not a card grid, so the foot of a hand page does
 * not become the card wall D-S3-17 forbids. The honesty gate is the site's usual one: a
 * destination with no page is inert text with a 준비 중 badge, never an anchor.
 *
 * A story row carries the disclosure badge (`HAND_STORY_DISCLOSURE`) — stories are
 * reconstructed scenarios and the site never links to one without saying so.
 */
import { hrefOfContent, BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';
import { HAND_STORY_DISCLOSURE } from '../../content/stories/types.js';
import type { BlogRecord, HandRecord, LearnRecord } from '../../content/types.js';
import { SectionHeading } from '../SectionHeading.js';
import { guidesFor, storiesFeaturing, type StoryFeatureReason } from './handGraph.js';

export const GUIDES_LABEL = '관련 가이드';
export const STORIES_LABEL = '이런 이야기도 있어요';

const BADGE =
  'inline-block shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300';

const LINK =
  'outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const REASON_LABEL: Readonly<Record<StoryFeatureReason, string>> = {
  hero: '주인공이 이 패를 들었습니다',
  villain: '상대가 쇼다운에서 이 패를 뒤집었습니다',
  declared: '이 패와 관련된 이야기',
};

function metaOf(record: BlogRecord | LearnRecord): string {
  return record.kind === 'learn' ? '배우기' : BLOG_CONTENT_TYPE_LABEL[record.contentType];
}

function Row({
  record,
  meta,
  note,
}: {
  readonly record: BlogRecord | LearnRecord;
  readonly meta: string;
  readonly note?: string;
}) {
  const href = hrefOfContent(record);
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <p className="text-xs font-medium text-text-300">{meta}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {href === null ? (
          <>
            <span className="prose-ko text-base font-medium text-text-100">{record.title}</span>
            <span className={BADGE}>준비 중</span>
          </>
        ) : (
          <a href={href} className={`prose-ko text-base font-medium text-text-100 ${LINK}`}>
            {record.title}
          </a>
        )}
      </p>
      {note === undefined ? null : <p className="mt-1 text-sm text-text-300">{note}</p>}
      <p className="prose-ko mt-1 text-sm text-text-300">{record.description}</p>
    </li>
  );
}

export interface HandOnwardProps {
  readonly record: HandRecord;
  readonly className?: string;
}

export function HandOnward({ record, className = '' }: HandOnwardProps) {
  const guides = guidesFor(record);
  const stories = storiesFeaturing(record);
  if (guides.length === 0 && stories.length === 0) return null;

  return (
    <div className={`space-y-14 ${className}`}>
      {guides.length > 0 ? (
        <section aria-label={GUIDES_LABEL} data-onward="guides">
          <SectionHeading
            title={GUIDES_LABEL}
            description={`${record.handKey}를 다루는 질문 하나에 끝까지 답하는 글입니다.`}
          />
          <ul className="mt-4 divide-y divide-line-500 border-y border-line-500">
            {guides.map((guide) => (
              <Row key={guide.id} record={guide} meta={metaOf(guide)} />
            ))}
          </ul>
        </section>
      ) : null}

      {stories.length > 0 ? (
        <section aria-label={STORIES_LABEL} data-onward="stories">
          <SectionHeading
            title={STORIES_LABEL}
            description={`${record.handKey}가 실제로 등장한 핸드 스토리입니다. ${HAND_STORY_DISCLOSURE}`}
          />
          <ul className="mt-4 divide-y divide-line-500 border-y border-line-500">
            {stories.map(({ story, reason }) => (
              <Row
                key={story.id}
                record={story}
                meta={BLOG_CONTENT_TYPE_LABEL[story.contentType]}
                note={REASON_LABEL[reason]}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
