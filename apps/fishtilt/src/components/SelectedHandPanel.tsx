/**
 * `SelectedHandPanel` — what a beginner needs once they tap a `RangeMatrix` cell: the class
 * key, a plain-Korean reading, real example cards, the combo count, and (when a range is
 * given) whether the class is in it. Controlled the same way as `RangeMatrix` — the caller
 * owns which class is selected, this component only renders it.
 *
 * Every number comes from `@gto-self/learn-core`'s `handClassFacts` (which itself reads
 * `strategy-core`, never restates it) — `comboCount`, `universeCombos`, `universeShare` and
 * `exampleCards` are read, not recomputed (CLAUDE.md rule 2/5). The Korean sentence comes
 * from `features/range/copy.ts`'s `describeHandClassKorean`.
 */
import { rankOf, suitOf } from '@gto-self/shared';
import { handClassFacts } from '@gto-self/learn-core';
import { hasHandClass, type HandClass, type HandClassSet } from '@gto-self/strategy-core';
import {
  describeHandClassKorean,
  handClassReading,
  IN_RANGE_LABEL,
  OUT_OF_RANGE_LABEL,
} from '../features/range/index.js';
import { Panel } from './Panel.js';
import { PokerCard } from './PokerCard.js';
import { ToolAnswer } from './ToolAnswer.js';

export interface SelectedHandPanelProps {
  /** The selected class, or `null` to render the "nothing selected yet" prompt. */
  readonly handClass: HandClass | null;
  /** The range to check membership against. `null`/omitted renders no membership line —
   *  the same "no range context" convention `RangeMatrix` uses. */
  readonly range?: HandClassSet | null;
  readonly className?: string;
}

export function SelectedHandPanel({
  handClass,
  range = null,
  className = '',
}: SelectedHandPanelProps) {
  if (handClass === null) {
    return (
      <Panel className={className}>
        <p className="text-sm text-text-300">표에서 핸드를 선택하면 자세한 정보를 볼 수 있어요.</p>
      </Panel>
    );
  }

  const facts = handClassFacts(handClass);
  const [highCard, lowCard] = facts.exampleCards;
  const percentage = (facts.universeShare * 100).toFixed(2);
  const inRange = range !== null ? hasHandClass(range, handClass.index) : null;

  return (
    <Panel className={className}>
      {/* WHAT THE READER JUST CLICKED, on `ground-800` — the recessed rung WP-2 documents for
          a readout inside a card (`ToolAnswer`). Before WP-4 this row sat on the panel's own
          surface, so the answer to "what is this cell?" carried exactly the same weight as
          the panel it lives in and as every other card on the page. */}
      <ToolAnswer>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-2xl font-bold text-text-100">{facts.key}</p>
            {/* The spoken reading, per build spec §10 — a learner who cannot say the hand
                cannot ask about it. The Latin key above is unchanged (ADR-0053). */}
            <p className="mt-0.5 text-sm text-text-300">{handClassReading(handClass)}</p>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="예시 카드">
            <PokerCard rank={rankOf(highCard)} suit={suitOf(highCard)} size="md" />
            <PokerCard rank={rankOf(lowCard)} suit={suitOf(lowCard)} size="md" />
          </div>
        </div>
      </ToolAnswer>

      <p className="mt-3 text-sm text-text-300">{describeHandClassKorean(handClass)}</p>

      <p className="mt-3 text-sm text-text-300">
        전체 {facts.universeCombos.toLocaleString('ko-KR')}가지 조합 중{' '}
        <strong className="font-semibold text-text-100">{facts.comboCount}가지</strong>가 이
        핸드입니다 ({percentage}%)
      </p>

      {inRange !== null ? (
        <p
          className={`mt-3 text-sm font-medium ${inRange ? 'text-act-raise-500' : 'text-text-300'}`}
        >
          {inRange ? IN_RANGE_LABEL : OUT_OF_RANGE_LABEL}
        </p>
      ) : null}
    </Panel>
  );
}
