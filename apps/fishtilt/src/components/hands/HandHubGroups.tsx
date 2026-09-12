/**
 * `HandHubGroups` — the hands hub's grouped list (WP-S3-13a): three families (pairs ·
 * ace-highs · broadways and connectors), each a divided list of rows ordered strongest
 * first, every row carrying the key, its rank and the record's one-line hook. A list with
 * rules between rows, not a grid of twenty identical cards (D-S3-17).
 *
 * The e2e contract this keeps (`tests/e2e/hands.spec.ts`): the region named `전체 핸드`
 * contains one `<li>` per record and every `<li>` is exactly one of "a link" or "a 준비 중
 * badge". The count sentence over the groups is derived from the same list.
 *
 * Numbers in a row are `<Fact>`s. The grouping and order come from `handHubGroups`; this
 * file renders.
 */
import { hrefOfContent } from '../../content/graph.js';
import type { HandRecord } from '../../content/types.js';
import { Fact } from '../Fact.js';
import { SectionHeading } from '../SectionHeading.js';
import { handHubGroups, type HandHubRow } from './handGraph.js';

const BADGE =
  'inline-block shrink-0 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium text-text-300';

const ROW_LINK =
  'group grid grid-cols-[3.75rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-4 outline-none ' +
  'sm:grid-cols-[4.5rem_3.5rem_minmax(0,1fr)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function Row({ row }: { readonly row: HandHubRow }) {
  const { record, handClass } = row;
  const href = hrefOfContent(record);
  const rankCell =
    handClass === undefined ? (
      <span className="text-sm text-text-300">—</span>
    ) : (
      <span className="tabular text-sm text-text-300">
        <Fact name="HAND_RANK" arg={handClass.key} className="font-medium text-text-100" />위
      </span>
    );
  const body = (
    <>
      <span className="font-mono text-xl font-semibold text-text-100 group-hover:text-brand-500">
        {record.handKey}
      </span>
      <span className="hidden sm:block">{rankCell}</span>
      <span className="min-w-0">
        <span className="prose-ko block text-base font-medium text-text-100 group-hover:text-brand-500">
          {record.title}
        </span>
        <span className="prose-ko mt-1 block text-sm text-text-300">{record.description}</span>
        <span className="mt-1 block sm:hidden">{rankCell}</span>
      </span>
    </>
  );

  if (href === null) {
    return (
      <li>
        <span className={ROW_LINK.replace('group ', '')}>
          <span className="font-mono text-xl font-semibold text-text-300">{record.handKey}</span>
          <span className="hidden sm:block">{rankCell}</span>
          <span className="min-w-0">
            <span className="prose-ko flex flex-wrap items-baseline gap-x-2 text-base font-medium text-text-300">
              {record.title}
              <span className={BADGE}>준비 중</span>
            </span>
            <span className="prose-ko mt-1 block text-sm text-text-300">{record.description}</span>
          </span>
        </span>
      </li>
    );
  }
  return (
    <li>
      <a href={href} className={ROW_LINK}>
        {body}
      </a>
    </li>
  );
}

export interface HandHubGroupsProps {
  readonly records: readonly HandRecord[];
  readonly className?: string;
}

export function HandHubGroups({ records, className = '' }: HandHubGroupsProps) {
  const groups = handHubGroups(records);
  return (
    <div className={`space-y-14 ${className}`}>
      {groups.map((group) => (
        <div key={group.family} data-hand-family={group.family}>
          <SectionHeading as="h3" title={group.label} description={group.description} />
          <ol className="mt-4 divide-y divide-line-500 border-y border-line-500">
            {group.rows.map((row) => (
              <Row key={row.record.id} row={row} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
