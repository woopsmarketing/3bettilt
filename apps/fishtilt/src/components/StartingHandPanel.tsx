/**
 * `StartingHandPanel` — what a beginner needs once they tap a `RangeMatrix` cell on
 * `/tools/starting-hand`: the class key, its spoken reading, real example cards, its combo
 * count and shape (all from `SelectedHandPanel`, reused rather than rebuilt — see this WP's
 * brief), plus the three strength-specific facts that page adds on top: rank among the 169,
 * the top-percentage share it falls within, and its all-in preflop equity — with a tie note
 * in place of a false "stronger than the next one down" claim wherever the dataset ever
 * records one (`viewModel.ts`'s `tieInfoFor`; empty today, `HAND_STRENGTH.exactTies`).
 *
 * `range` is intentionally never passed to the inner `SelectedHandPanel` — there is no
 * "range" concept on this page, and the membership line that prop draws ("포함되어 있어요")
 * is Range Explorer wording this page must not reuse for a different question (top-X% share
 * is answered by `cumulativeShareLabel` below, in this page's own words).
 */
import { HAND_STRENGTH } from '@gto-self/learn-core';
import type { HandClass } from '@gto-self/strategy-core';
import {
  cumulativeShareLabel,
  equityLabel,
  rankLabel,
  strengthDetailOf,
  STRENGTH_METRIC_LABEL,
  tieNote,
} from '../features/strength/index.js';
import { Panel } from './Panel.js';
import { SelectedHandPanel } from './SelectedHandPanel.js';

export interface StartingHandPanelProps {
  /** The selected class, or `null` to render the "nothing selected yet" prompt. */
  readonly handClass: HandClass | null;
  readonly className?: string;
}

function StatRow({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line-500 py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm text-text-300">{term}</dt>
      <dd className="tabular text-base font-semibold text-text-100">{value}</dd>
    </div>
  );
}

export function StartingHandPanel({ handClass, className = '' }: StartingHandPanelProps) {
  if (handClass === null) {
    return <SelectedHandPanel handClass={null} className={className} />;
  }

  const { entry, tie } = strengthDetailOf(handClass);
  const note = tieNote(tie);
  const total = HAND_STRENGTH.entries.length;

  return (
    // A named region: the result of the tool, reachable by landmark and addressable by tests
    // without page-wide text probes (the guide under the tool prints the same dataset rows).
    <section aria-label="선택한 패" className={className}>
      <SelectedHandPanel handClass={handClass} />
      <Panel className="mt-4">
        <dl>
          <StatRow term="순위" value={rankLabel(entry, total)} />
          <StatRow term="누적 상위 비율" value={cumulativeShareLabel(entry)} />
          <StatRow term={STRENGTH_METRIC_LABEL} value={equityLabel(entry)} />
        </dl>
        {note !== null ? <p className="mt-3 text-xs text-text-300">{note}</p> : null}
      </Panel>
    </section>
  );
}
