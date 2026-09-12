/**
 * `RelatedContent` — the graph-driven cross-links at the top and foot of an article
 * (build spec §34/§76).
 *
 * Two properties the build spec asks for, and how they are held:
 *
 * **No generic "관련 글".** The heading belongs to the RELATION, not to this component:
 * `graph.ts`'s `RELATION_HEADING` says "이제 이것도 이해해보세요" over next lessons and "직접
 * 눌러보고 확인해볼까요?" over tools. This file renders whatever the graph hands it and owns
 * no copy of its own beyond the "준비 중" badge.
 *
 * **Authors do not write internal links.** Every destination here is derived from the
 * record's typed relations, so the link graph is a compile-time and test-time artefact rather
 * than 100 hand-written anchors that rot. An entry whose target is not written yet renders as
 * inert, readable text with a "준비 중" badge instead of an anchor — the same rule
 * `RouteNavItem` and `ToolCTA` follow, and the reason the "no dead internal link" test can be
 * true by construction.
 */
import { relationsOf, type ContentLink, type RelationKind } from '../content/graph.js';
import type { AnyContentRecord } from '../content/types.js';
import { SectionHeading } from './SectionHeading.js';

/**
 * The Stage 3 heading set (D-S3-16). Seven sentences a page may put over a relation group
 * instead of the graph's default — still a RELATION heading, never "관련 글", and a closed
 * union so the wording cannot drift page by page. A page passes `label` to name the one
 * group it renders (`only={['nextLessons']} label="더 배우기"`) or `labels` to name several.
 *
 * `관련 가이드` was added by WP-S3-16: a hand page's guide group (`HandOnward`) is a
 * relation group like the others — the lessons and search guides that answer a question
 * about that hand — and it had been rendering a label outside this union. Every component
 * that heads a relation group (`RelatedContent`, `HandOnward`, `ToolGuideLinks`) now reads
 * from this one list, and `RelatedContent.test.tsx` pins the set.
 */
export const RELATED_LABELS = [
  '더 배우기',
  '직접 확인하기',
  '같이 알아둘 용어',
  '이런 이야기도 있어요',
  '비슷한 핸드',
  '다음으로 읽기',
  '관련 가이드',
] as const;

export type RelatedLabel = (typeof RELATED_LABELS)[number];

export interface RelatedContentProps {
  readonly record: AnyContentRecord;
  /** Which relations to render here. Omitted = every relation that has entries. */
  readonly only?: readonly RelationKind[];
  /** Heading for EVERY rendered group. Meant for a single-relation block. */
  readonly label?: RelatedLabel;
  /** Heading per relation kind; a kind not named here keeps the graph's sentence. */
  readonly labels?: Partial<Readonly<Record<RelationKind, RelatedLabel>>>;
  readonly className?: string;
  /** Heading level — `h2` at the foot of an article, `h3` inside another section. */
  readonly headingAs?: 'h2' | 'h3';
  /**
   * Set the group headings at the `h3` size whatever their level, and close the groups up.
   * For a tail that follows the page's real next step (WP-S3-19, review B-M4): the groups
   * are the secondary material there, and five `text-h2` headings made them read as five
   * more chapters, larger than the 다음 레슨 link they were pushing to the bottom.
   */
  readonly dense?: boolean;
  /**
   * How the relation groups are separated from each other.
   *
   * `plain` (default) is what every template rendered before WP-5: the groups stacked with
   * even space between them. At the foot of a blog article that is five groups — 이 글에 나온
   * 말들, 직접 눌러보고 확인해볼까요?, 이 핸드도 같이 보세요, 이제 이것도 이해해보세요, 이
   * 개념과 같이 보면 쉬워요 — and up to a dozen cards, which arrived as one undifferentiated
   * wall where the headings were the only clue that the reader had moved from "words in this
   * article" to "where to go next".
   *
   * `sectioned` draws the site's one border line between the groups. A rule, not a card and
   * not a second surface: the groups are peers of each other and the cards inside them are
   * already on `panel-700`, so boxing a group would put a card inside a card and flatten the
   * elevation ladder WP-2 established.
   *
   * Opt-in rather than the new default, because `/learn`, `/glossary` and `/hands` are
   * outside this work package's boundary and their footers must not move.
   */
  readonly variant?: 'plain' | 'sectioned';
}

const WRAPPER_VARIANT = {
  plain: 'space-y-10',
  sectioned: 'divide-y divide-line-500',
} as const;

const DENSE_WRAPPER_VARIANT = {
  plain: 'space-y-8',
  sectioned: 'divide-y divide-line-500',
} as const;

const SECTION_VARIANT = {
  plain: '',
  sectioned: 'py-9 first:pt-0 last:pb-0',
} as const;

/**
 * One related piece, as a RULED ROW rather than a bordered card (WP-S3-17). The foot of a
 * lesson or an article used to end in five groups of two-column cards — up to a dozen
 * boxes on `panel-700` — which was the card wall D-S3-17 forbids, and the glossary and
 * hand pages showed the failure mode of a grid of cards: a group with one entry drew one
 * lonely box in a two-column grid. Rows share the site's one hairline, sit in two columns
 * on wider screens with the rules aligned, and carry the same title / description / meta.
 * The link is the whole row (a 44px+ target), the hover moves the title to the brand ink
 * and nudges the arrow — a change of colour AND position, never colour alone.
 */
function LinkRow({ link }: { readonly link: ContentLink }) {
  const body = (
    <>
      <span className="block font-medium text-text-100 transition-colors group-hover:text-brand-500">
        {link.label}
      </span>
      {link.description ? (
        <span className="prose-ko mt-1 block text-sm text-text-300">{link.description}</span>
      ) : null}
      {link.meta ? <span className="mt-1.5 block text-xs text-text-300">{link.meta}</span> : null}
    </>
  );

  if (link.href === null) {
    return (
      <li className="border-b border-line-500 py-4">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">{body}</span>
          <span className="shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300">
            준비 중
          </span>
        </span>
      </li>
    );
  }

  return (
    <li className="border-b border-line-500">
      <a
        href={link.href}
        className="group flex min-h-11 items-start justify-between gap-3 py-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <span className="min-w-0">{body}</span>
        <span
          aria-hidden="true"
          className="shrink-0 pt-0.5 text-brand-500 transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </a>
    </li>
  );
}

export function RelatedContent({
  record,
  only,
  label,
  labels,
  className = '',
  headingAs = 'h2',
  dense = false,
  variant = 'plain',
}: RelatedContentProps) {
  const relations = relationsOf(record, only);
  if (relations.length === 0) return null;

  const headingFor = (relation: (typeof relations)[number]): string =>
    labels?.[relation.relation] ?? label ?? relation.heading;

  return (
    <div className={`${(dense ? DENSE_WRAPPER_VARIANT : WRAPPER_VARIANT)[variant]} ${className}`}>
      {relations.map((relation) => (
        <section
          key={relation.relation}
          aria-label={headingFor(relation)}
          className={SECTION_VARIANT[variant]}
        >
          <SectionHeading
            title={headingFor(relation)}
            as={headingAs}
            size={dense ? 'h3' : headingAs}
          />
          {/* Two columns only when there are two rows to fill them: a group with one entry
              used to draw one row in a two-column grid and leave the right half empty, so
              the page bottom looked ragged rather than composed (B-M4). */}
          <ul
            data-columns={relation.links.length > 1 ? '2' : '1'}
            className={`mt-4 grid ${relation.links.length > 1 ? 'sm:grid-cols-2 sm:gap-x-10' : ''}`}
          >
            {relation.links.map((link) => (
              <LinkRow key={link.key} link={link} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
