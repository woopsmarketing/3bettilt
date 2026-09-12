/**
 * `RangeSummary` — the line under a `RangeMatrix` a beginner reads once, then trusts: how
 * many of the 1326 combos are in the range, what share that is, and the range in compact
 * chart notation. Every number is computed here from the actual `range`, never passed in as
 * a pre-formatted literal, so a caller cannot accidentally show stale or invented figures
 * (CLAUDE.md rule 2).
 *
 * This component does not know about `RangeQuery`, a spot, or a stack depth — `label` and
 * `conditions` are plain strings the caller already built (typically via
 * `features/range/copy.ts`'s `RANGE_LABEL` and `describeRangeConditions`), which is what
 * keeps this component reusable outside a filtered "Range Explorer" context (a learn
 * article can pass its own conditions string, or none at all).
 */
import {
  comboCountOf,
  COMBO_COUNT,
  percentageOf,
  type HandClassSet,
} from '@gto-self/strategy-core';
import { formatHandClassSet } from '../features/range/notation.js';
import { Panel } from './Panel.js';

export interface RangeSummaryProps {
  readonly range: HandClassSet;
  /** e.g. `RANGE_LABEL` (`"학습용 기본 레인지"`). Optional — omit for a bare summary. */
  readonly label?: string;
  /** e.g. `describeRangeConditions(query)` (`"6인 · 100BB · 아무도 참여하지 않았을 때 (First In)"`). */
  readonly conditions?: string;
  /**
   * Whether to print the chart notation (`33+,A2s+,K2s+,...`). Defaults to FALSE, and the
   * default is the point: this component is dropped into lessons, hand pages and quiz
   * results, and in every one of those places the notation is unexplained jargon — a wall of
   * monospace shorthand aimed at a reader who is, right now, being told what a range even
   * is. Opting IN is a claim that the surrounding page has earned it; the Range Explorer
   * makes that claim and backs it with the "이 기준은 무엇인가요?" disclosure sitting beside
   * it. Defaulting the other way would mean every future embed leaks jargon until somebody
   * notices in review, which is the failure this flag exists to prevent.
   *
   * The claim is now backed HERE rather than by the surrounding page: turning the notation on
   * also renders `NotationKey` directly under it, so `+`, `s` and `o` are explained on every
   * surface that opts in, and a future opt-in cannot ship the wall without the key. The
   * "이 기준은 무엇인가요?" disclosure explains the range's PROVENANCE, which is a different
   * question from its SYNTAX and was never an answer to this one.
   */
  readonly showNotation?: boolean;
  readonly className?: string;
}

/**
 * The three tokens the notation above is built from, glossed once, right underneath it.
 *
 * `formatHandClassSet` (`features/range/notation.ts`) emits exactly three kinds of thing: a
 * bare class (`T9s`), a `+` run reaching the top of its axis (`33+`, `A2s+`), and an explicit
 * run (`A5s-A2s`); `s`/`o` are the suited/offsuit suffixes. Anything a reader meets in that
 * string is one of those, so this key is complete rather than illustrative.
 */
function NotationKey() {
  return (
    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs text-text-300">
      <dt className="font-mono font-semibold text-text-100">s</dt>
      <dd>두 장의 무늬가 같음 (수티드)</dd>
      <dt className="font-mono font-semibold text-text-100">o</dt>
      <dd>두 장의 무늬가 다름 (오프수트)</dd>
      <dt className="font-mono font-semibold text-text-100">+</dt>
      <dd>여기서부터 위쪽 전부 — 33+는 33, 44, 55 …, A2s+는 A2s, A3s, A4s …</dd>
      <dt className="font-mono font-semibold text-text-100">-</dt>
      <dd>두 패 사이의 구간 — A5s-A2s는 A5s, A4s, A3s, A2s</dd>
    </dl>
  );
}

export function RangeSummary({
  range,
  label,
  conditions,
  showNotation = false,
  className = '',
}: RangeSummaryProps) {
  const comboCount = comboCountOf(range);
  const percentage = (percentageOf(range) * 100).toFixed(1);
  const notation = formatHandClassSet(range);

  return (
    <Panel className={className}>
      {label ? <p className="text-sm font-semibold text-text-100">{label}</p> : null}
      {conditions ? <p className="mt-1 text-sm text-text-300">{conditions}</p> : null}

      <p className={`text-sm text-text-300 ${label || conditions ? 'mt-3' : ''}`}>
        전체 {COMBO_COUNT.toLocaleString('ko-KR')}가지 조합 중{' '}
        <strong className="tabular font-semibold text-text-100">
          {comboCount.toLocaleString('ko-KR')}가지
        </strong>
        가 이 레인지에 포함됩니다 (
        <strong className="tabular font-semibold text-text-100">{percentage}%</strong>).
      </p>

      {showNotation ? (
        <>
          <p className="mt-2 font-mono text-sm break-all text-text-300">
            {notation.length > 0 ? notation : '(포함되는 핸드가 없습니다)'}
          </p>
          <NotationKey />
        </>
      ) : null}
    </Panel>
  );
}
