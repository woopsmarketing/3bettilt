/**
 * `HandFactStrip` — the four numbers a hand page is FOR, in one row under the cards
 * (WP-S3-13a): rank, combinations, share of deals, expected pot share vs a random hand.
 *
 * Every value is a `<Fact>` (or `factValue` for the note strings), so the strip states
 * exactly what the prose sections below state, formatted by the same function. The equity
 * item is labelled as a POT SHARE, not a win rate — `HAND_EQUITY_VS_RANDOM` is hero's
 * expected share of the pot with ties split (`packages/learn-core/src/strength/model.ts`),
 * and the page's own "얼마나 강한가요" section defines it; the strip only names it.
 */
import { factValue } from '../../content/facts.js';
import { Fact } from '../Fact.js';
import { StatStrip } from '../StatStrip.js';

export interface HandFactStripProps {
  readonly handKey: string;
  readonly className?: string;
}

export function HandFactStrip({ handKey, className = '' }: HandFactStripProps) {
  return (
    <StatStrip
      aria-label={`${handKey} 핵심 숫자`}
      className={className}
      items={[
        {
          label: '강도 순위',
          value: (
            <>
              <Fact name="HAND_RANK" arg={handKey} className="text-inherit" />위
            </>
          ),
          note: `${factValue('HAND_CLASS_COUNT')}개 시작 패 중`,
        },
        {
          label: '조합',
          value: (
            <>
              <Fact name="HAND_COMBOS" arg={handKey} className="text-inherit" />
              가지
            </>
          ),
          note: `전체 ${factValue('COMBO_COUNT')}가지 중 ${factValue('HAND_SHARE', handKey)}`,
        },
        {
          label: '상위 비중',
          value: <Fact name="HAND_TOP_SHARE" arg={handKey} className="text-inherit" />,
          note: '이 패까지 합친 조합의 비율',
        },
        {
          label: '무작위 상대 기대 몫',
          value: <Fact name="HAND_EQUITY_VS_RANDOM" arg={handKey} className="text-inherit" />,
          note: '끝까지 갔을 때 팟의 몫 · 비기면 절반',
        },
      ]}
    />
  );
}
