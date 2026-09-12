'use client';

/**
 * `RangeMatrixMini` — the 13x13 chart embedded INSIDE an article, with the position switch
 * right there (build spec §28: "이것이 3BetTilt 콘텐츠의 핵심 차별점").
 *
 * ## A composition, not a second matrix
 *
 * Every visible part is WP-C's already-tested component — `RangeMatrix` draws the grid,
 * `RangeSummary` states the combo count and share, `SelectedHandPanel` explains the tapped
 * cell. What this adds is the small amount an article needs on top: the position toggle, and
 * the wiring that turns a position into a `RangeQuery`. Building a separate "mini" grid would
 * have created a second place for the matrix orientation, the colour rules and the accessible
 * names to drift.
 *
 * ## Every number comes from the range facade
 *
 * The article never states a combo count or a percentage; `resolveRange` answers and
 * `RangeSummary` renders. The conditions line (`6인 · 100BB · 아무도 참여하지 않았을 때`) and
 * the fixed label `학습용 기본 레인지` come from `features/range/copy.ts` and are always
 * visible, which is the audit's §6 requirement — a chart with its conditions hidden is a
 * chart that reads as universal advice.
 *
 * What it does NOT pass is `showNotation`. The chart shorthand (`33+,A2s+,...`) is a real
 * thing a reader will meet elsewhere and lesson 05 exists to teach it, but printed here it
 * would land before the sentence that explains it — a wall of monospace in the middle of the
 * article that first tells a beginner what a range is. The Explorer, which sits next to a
 * disclosure explaining the shorthand, opts in; an article does not.
 *
 * ## An unsupported position is explained, not hidden
 *
 * `BB` has no first-in range because the hand ends when everyone folds to it. If a caller
 * asks for one, this renders the facade's own explanation rather than an empty grid or a
 * borrowed range (CLAUDE.md rule 2). That is a teaching moment the audit specifically asks
 * to be shown as one.
 */
import { useState } from 'react';
import { handClassByKey, type StrategyPosition } from '@gto-self/strategy-core';
import {
  describeRangeConditions,
  POSITION_LABEL,
  positionAccessibleName,
  RANGE_LABEL,
  resolveRange,
  UNSUPPORTED_REASON_LABEL,
} from '../features/range/index.js';
import { PositionLegend } from './PositionLegend.js';
import { RangeMatrix } from './RangeMatrix.js';
import { RangeSummary } from './RangeSummary.js';
import { SelectedHandPanel } from './SelectedHandPanel.js';

/** The five positions that actually hold a first-in dataset (audit §5.4). */
export const RFI_POSITIONS: readonly StrategyPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

export interface RangeMatrixMiniProps {
  /** Which positions the reader may switch between. One position renders no toggle. */
  readonly positions?: readonly StrategyPosition[];
  /** Which one starts selected. Defaults to the first of `positions`. */
  readonly initial?: StrategyPosition;
  /** Render the tapped-hand detail panel. Off for a "just look at this" illustration. */
  readonly showSelection?: boolean;
  /** One line above the chart, in the article's voice. */
  readonly caption?: string;
  readonly className?: string;
}

const TOGGLE_BASE =
  'min-h-11 min-w-14 cursor-pointer rounded-md border px-4 py-2 font-mono text-sm font-semibold ' +
  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-500';

export function RangeMatrixMini({
  positions = RFI_POSITIONS,
  initial,
  showSelection = true,
  caption,
  className = '',
}: RangeMatrixMiniProps) {
  const first = initial ?? positions[0];
  if (first === undefined) throw new Error('<RangeMatrixMini> needs at least one position');

  const [position, setPosition] = useState<StrategyPosition>(first);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const query = {
    heroPosition: position,
    spot: 'RFI',
    stackDepth: 100,
    tableSize: 6,
  } as const;
  const resolution = resolveRange(query);
  const selectedClass = selectedKey === null ? null : (handClassByKey(selectedKey) ?? null);

  return (
    <section
      className={`my-8 rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-6 ${className}`}
      aria-label={caption ?? '핸드 레인지 표'}
    >
      {caption ? <p className="mb-4 text-sm text-text-300">{caption}</p> : null}

      {positions.length > 1 ? (
        <div className="mb-5">
          <p className="mb-2 text-sm text-text-300">자리를 바꿔보세요</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="자리 선택">
            {positions.map((candidate) => {
              const active = candidate === position;
              return (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={active}
                  aria-label={positionAccessibleName(candidate)}
                  onClick={() => setPosition(candidate)}
                  className={`${TOGGLE_BASE} ${
                    active
                      ? 'border-brand-600 bg-brand-600 text-ink-on-brand'
                      : 'border-line-500 bg-panel-600 text-text-100 hover:border-brand-500'
                  }`}
                >
                  {POSITION_LABEL[candidate]}
                </button>
              );
            })}
          </div>
          <PositionLegend positions={positions} />
        </div>
      ) : null}

      {resolution.kind === 'RANGE' ? (
        <>
          <RangeMatrix
            range={resolution.range}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            label={`${positionAccessibleName(position)}의 ${RANGE_LABEL} 표`}
          />
          <RangeSummary
            className="mt-5"
            range={resolution.range}
            label={RANGE_LABEL}
            conditions={describeRangeConditions(query)}
          />
          {showSelection ? (
            <SelectedHandPanel
              className="mt-3"
              handClass={selectedClass}
              range={resolution.range}
            />
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-line-500 bg-panel-700 p-6">
          <p className="text-sm font-semibold text-text-100">
            {POSITION_LABEL[position]} · {describeRangeConditions(query)}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-[1.85] text-text-300">
            {resolution.reasons.map((reason) => (
              <li key={reason}>{UNSUPPORTED_REASON_LABEL[reason]}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
