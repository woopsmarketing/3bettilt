/**
 * `HandComparisonTable` — the hand next to its rank neighbours and its suited/offsuit twin
 * (WP-S3-13a, contract AY). Rendered by the template from `rankNeighbours`, so a hand's
 * MDX no longer has to repeat "AKo는 12가지, 순위 N위" in prose: the numbers are here, once,
 * from the dataset, and the prose can say what they MEAN.
 *
 * `DataTable`, not a bespoke grid: one table implementation, semantic `<th scope>`, scrolls
 * inside its wrapper on a phone. Every cell is a `<Fact>`. A neighbour that has its own page
 * links to it; one that does not is plain text (no 준비 중 badge — a class without a record
 * is not a promised page, it is just one of the other 149 classes).
 *
 * The equity column is headed as a pot share and the caption restates the ties-split rule,
 * so the column cannot be read as "how often it wins".
 */
import type { HandClass } from '@gto-self/strategy-core';
import { hrefOfContent } from '../../content/graph.js';
import { DataTable } from '../DataTable.js';
import { Fact } from '../Fact.js';
import { handRecordForKey, rankNeighbours, type ComparisonRole } from './handGraph.js';

export interface HandComparisonTableProps {
  readonly handClass: HandClass;
  /** Ranks above and below to include. Default 2. */
  readonly span?: number;
  readonly className?: string;
}

const ROLE_NOTE: Readonly<Record<ComparisonRole, string | null>> = {
  self: '이 페이지',
  neighbour: null,
  twin: '같은 숫자, 다른 무늬',
};

const LINK_CLASS =
  'underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function HandCell({ handKey, role }: { readonly handKey: string; readonly role: ComparisonRole }) {
  const record = role === 'self' ? undefined : handRecordForKey(handKey);
  const href = record === undefined ? null : hrefOfContent(record);
  const note = ROLE_NOTE[role];
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {href === null ? (
        <span className={`font-mono ${role === 'self' ? 'text-brand-500' : ''}`}>{handKey}</span>
      ) : (
        <a href={href} className={`font-mono ${LINK_CLASS}`}>
          {handKey}
        </a>
      )}
      {note === null ? null : <span className="text-xs font-normal text-text-300">{note}</span>}
    </span>
  );
}

export function HandComparisonTable({
  handClass,
  span = 2,
  className = '',
}: HandComparisonTableProps) {
  const rows = rankNeighbours(handClass, span);
  return (
    <div data-comparison={handClass.key} className={className}>
      <DataTable
        caption={`${handClass.key}와 순위가 이웃한 패, 그리고 무늬만 다른 패. 기대 몫은 무작위 상대와 끝까지 갔을 때 팟에서 가져갈 것으로 기대되는 몫이며, 정확히 비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다.`}
        rowHeader="hand"
        columns={[
          { key: 'hand', label: '패' },
          { key: 'rank', label: '순위', align: 'end', numeric: true },
          { key: 'combos', label: '조합', align: 'end', numeric: true },
          { key: 'topShare', label: '상위 비중', align: 'end', numeric: true },
          { key: 'equity', label: '무작위 상대 기대 몫', align: 'end', numeric: true },
        ]}
        rows={rows.map(({ entry, role }) => ({
          key: entry.key,
          cells: {
            hand: <HandCell handKey={entry.key} role={role} />,
            rank: (
              <>
                <Fact name="HAND_RANK" arg={entry.key} className="font-medium" />위
              </>
            ),
            combos: (
              <>
                <Fact name="HAND_COMBOS" arg={entry.key} className="font-medium" />
                가지
              </>
            ),
            topShare: <Fact name="HAND_TOP_SHARE" arg={entry.key} className="font-medium" />,
            equity: <Fact name="HAND_EQUITY_VS_RANDOM" arg={entry.key} className="font-medium" />,
          },
        }))}
      />
    </div>
  );
}
