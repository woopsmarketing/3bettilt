/**
 * The foot of every blog article: prev/next within the article's content type as one
 * prominent step (B-M4), then the contextual relation groups (D-S3-16 labels — never one
 * generic "관련 콘텐츠"), then the tool band.
 *
 * Shared by the search-guide layout and the story layout so the two templates end the same
 * way and a reader who has learned one has learned the other.
 */
import { blogNeighbours, hrefOfContent, toolHref, toolRoute } from '../../content/graph.js';
import { BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';
import type { BlogRecord } from '../../content/types.js';
import { CtaBand } from '../CtaBand.js';
import { NextRead } from '../NextRead.js';
import { RelatedContent, type RelatedLabel } from '../RelatedContent.js';
import { SectionHeading } from '../SectionHeading.js';
import type { RelationKind } from '../../content/graph.js';

/** D-S3-16: the label per relation. `prerequisites` keeps the graph's own sentence. */
export const BLOG_RELATED_LABELS: Partial<Readonly<Record<RelationKind, RelatedLabel>>> = {
  nextLessons: '더 배우기',
  relatedTools: '직접 확인하기',
  relatedConcepts: '같이 알아둘 용어',
  relatedArticles: '이런 이야기도 있어요',
  relatedHands: '비슷한 핸드',
};

export interface BlogArticleFooterProps {
  readonly record: BlogRecord;
  /** The heading over the relation groups. */
  readonly title: string;
  readonly description: string;
  readonly className?: string;
}

function metaOf(record: BlogRecord): string {
  const parts = [BLOG_CONTENT_TYPE_LABEL[record.contentType]];
  if (record.readMinutes !== null) parts.push(`약 ${record.readMinutes}분`);
  return parts.join(' · ');
}

export function BlogArticleFooter({
  record,
  title,
  description,
  className = '',
}: BlogArticleFooterProps) {
  const { prev, next } = blogNeighbours(record);
  const firstTool = record.relatedTools[0];
  const tool = firstTool === undefined ? null : toolRoute(firstTool);

  return (
    <div className={className}>
      {/* The next piece first (WP-S3-19, review B-M4): one full-width step before the
          related groups, not a small pair after them and after the tool band. */}
      {prev !== null || next !== null ? (
        <NextRead
          emphasis="next"
          className="my-0"
          label="다음으로 읽기"
          {...(prev === null
            ? {}
            : { prev: { href: hrefOfContent(prev), title: prev.title, meta: metaOf(prev) } })}
          {...(next === null
            ? {}
            : { next: { href: hrefOfContent(next), title: next.title, meta: metaOf(next) } })}
        />
      ) : null}

      <aside className="mt-14 border-t border-line-500 pt-10" aria-label={title}>
        <SectionHeading title={title} description={description} />
        <RelatedContent
          className="mt-8"
          record={record}
          only={[
            'relatedConcepts',
            'relatedTools',
            'relatedHands',
            'nextLessons',
            'relatedArticles',
          ]}
          labels={BLOG_RELATED_LABELS}
          headingAs="h3"
          variant="sectioned"
        />
      </aside>

      {tool !== null && firstTool !== undefined ? (
        <CtaBand
          className="mt-14"
          rounded
          title={`${tool.label}에서 직접 확인해보세요`}
          description="이 글의 숫자는 전부 같은 계산으로 나온 값입니다. 조건을 바꿔 가며 눌러 보면 더 오래 남습니다."
          primary={{ href: toolHref(firstTool), label: `${tool.label} 열기` }}
        />
      ) : null}
    </div>
  );
}
