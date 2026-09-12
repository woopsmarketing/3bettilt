/**
 * `ToolLessonLinks` — the "go and read about this" block at the foot of a tool page.
 *
 * ## What it replaces
 *
 * Six tool pages each carried a private `…LessonLink()` function: the same twenty lines, the
 * same `rounded-lg border border-line-500 bg-panel-700 p-4` string, the same hand-written
 * "준비 중" branch, six times — the exact duplication `LinkCard` was extracted to end (WP-2
 * §5). Each of those functions could also hold only ONE lesson, which is why every tool had
 * exactly one route back into the curriculum (WP-1 §6 priority 8).
 *
 * So the card markup is `LinkCard`'s again, not this component's, and the list is a list.
 *
 * ## Ids in, resolved destinations out
 *
 * The caller names content ids (`features/tools/related.ts`); this reads the graph.
 * `hrefOfContent` returns `null` for a record that is not published, and `LinkCard` turns
 * `null` into the site's inert "준비 중" treatment — so an unwritten lesson is visible and
 * unclickable rather than a link that 404s, and a lesson shipping later becomes a live link
 * with no edit here. `contentById` throws for an unknown id rather than rendering a blank card.
 *
 * A plain `<a>` comes from `LinkCard`; see `RouteNavItem.tsx` for why this app cannot use
 * `next/link`.
 */
import { contentById, contentMeta, hrefOfContent, KIND_LABEL } from '../content/graph.js';
import type { ContentId } from '../content/types.js';
import { LinkCard } from './LinkCard.js';
import { SectionHeading } from './SectionHeading.js';

export interface ToolLessonLinksProps {
  /** The heading, written for the moment this reader is in — never "관련 글" (build spec §76). */
  readonly title: string;
  readonly description?: string;
  /** Content ids in priority order. The first is the tool's primary prerequisite. */
  readonly ids: readonly ContentId[];
  readonly className?: string;
}

export function ToolLessonLinks({ title, description, ids, className = '' }: ToolLessonLinksProps) {
  // A heading over an empty list is a promise of content that is not there — the same guard
  // `FaqSection` makes for its own items.
  if (ids.length === 0) return null;

  return (
    <section aria-label={title} className={className}>
      <SectionHeading title={title} description={description} />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {ids.map((id) => {
          const record = contentById(id);
          return (
            <LinkCard
              key={id}
              href={hrefOfContent(record)}
              title={record.title}
              description={record.description}
              meta={record.kind === 'learn' ? contentMeta(record) : KIND_LABEL[record.kind]}
            />
          );
        })}
      </ul>
    </section>
  );
}
