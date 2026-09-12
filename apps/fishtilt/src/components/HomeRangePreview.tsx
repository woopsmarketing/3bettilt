'use client';

/**
 * `HomeRangePreview` — the homepage's interactive 13x13 preview: six position buttons over
 * the real chart, so the first thing a visitor can DO on this site is watch the table change
 * under their thumb (build spec's homepage section 3).
 *
 * ## A composition of the shipped pieces, not a second matrix
 *
 * Every visible part is an already-tested component — `RangeMatrix` draws the grid,
 * `RangeSummary` states the combo count and share, `SelectedHandPanel` explains the tapped
 * cell — and every number comes from `resolveRange`, the app's single range facade. This
 * component adds only the position switch and the homepage's framing.
 *
 * ## Why this is not `RangeMatrixMini`
 *
 * `RangeMatrixMini` is the in-article version of the same composition and would otherwise be
 * the right reuse. It cannot serve here for one reason: this page is the site's front door,
 * so the brief requires the chart's change to be ANNOUNCED, and the announcement has to wrap
 * the result block, which lives inside that component's own state. Rather than add a
 * homepage-only prop to a component fifteen articles already embed, the announcement is done
 * here, with the pattern this app already uses for a recomputed result — the same
 * `aria-live="polite"` wrapper around the answer block that `PotOddsCalculator`,
 * `EquityCalculator`, `OutsCalculator` and `HandChecker` use. The live region wraps the
 * SUMMARY, never the 169-cell grid: announcing the grid would read 169 buttons aloud on every
 * press.
 *
 * The selected-state of a position button is `aria-pressed`, exactly as `RangeExplorer`'s and
 * `RangeMatrixMini`'s toggles already expose it, and the grid's accessible name carries the
 * position too, so the change is legible three ways: pressed state, group name, announcement.
 *
 * ## A position with no data is explained, never faked
 *
 * The preview is pinned to the one shipped dataset — 6-max, 100BB, first-in — so the only
 * query that cannot resolve is `BB`, which has no first-in range because the hand is over
 * when everyone folds to it. That case renders the facade's own explanation instead of the
 * grid: no empty chart, no borrowed range, no invented number (CLAUDE.md rule 2, and this
 * repo's ruling that a silent dataset is stated plainly). The label above the numbers is
 * always `학습용 기본 레인지` under its stated conditions — never "optimal", never "GTO".
 */
import { useState } from 'react';
import { handClassByKey, STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
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

/** The one point in the 216-point query space that has data — see `features/range/resolve.ts`. */
const SPOT = 'RFI' as const;
const STACK_DEPTH = 100 as const;
const TABLE_SIZE = 6 as const;

/** `BTN` is where the Range Explorer opens too, so the two pages agree on the first thing shown. */
const DEFAULT_POSITION: StrategyPosition = 'BTN';

const TOGGLE_BASE =
  'inline-flex h-11 min-w-14 cursor-pointer items-center justify-center rounded-md border px-4 ' +
  'font-mono text-sm font-semibold outline-none transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export interface HomeRangePreviewProps {
  /** Which positions the reader may switch between. Defaults to all six seats. */
  readonly positions?: readonly StrategyPosition[];
  readonly initial?: StrategyPosition;
  readonly className?: string;
}

export function HomeRangePreview({
  positions = STRATEGY_POSITIONS,
  initial = DEFAULT_POSITION,
  className = '',
}: HomeRangePreviewProps) {
  const [position, setPosition] = useState<StrategyPosition>(initial);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const query = {
    heroPosition: position,
    spot: SPOT,
    stackDepth: STACK_DEPTH,
    tableSize: TABLE_SIZE,
  } as const;
  const resolution = resolveRange(query);
  const selectedClass = selectedKey === null ? null : (handClassByKey(selectedKey) ?? null);
  const positionLabel = POSITION_LABEL[position];
  // What a screen reader says where the heading shows the abbreviation — ruling 65.
  const positionSpoken = positionAccessibleName(position);

  return (
    <div className={className}>
      <p className="text-sm text-text-300" id="home-range-preview-hint">
        자리를 눌러보세요
      </p>
      <div
        role="group"
        aria-label="자리 선택"
        aria-describedby="home-range-preview-hint"
        className="mt-2 flex flex-wrap gap-2"
      >
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

      {/*
        The same two-column shape `RangeExplorer` uses: the matrix column is `max-content`
        (exactly the 608px the 13x13 grid occupies) and spans both rows, so the slack goes to
        the summary beside it rather than into a dead gap, and the tapped-hand panel sits
        directly under the summary where a reader who just pressed a cell is already looking.
        DOM order stays summary -> matrix -> panel, which is the single-column reading order
        on a phone.
      */}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[max-content_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          {/* See the module doc: the announcement wraps the ANSWER, never the grid. */}
          <div role="status" aria-live="polite">
            {resolution.kind === 'RANGE' ? (
              <RangeSummary
                range={resolution.range}
                label={`${positionLabel} · ${RANGE_LABEL}`}
                conditions={describeRangeConditions(query)}
              />
            ) : (
              <div className="rounded-lg border border-line-500 bg-panel-700 p-5">
                <p className="text-sm font-semibold text-text-100">
                  {positionLabel} · {describeRangeConditions(query)}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-[1.85] text-text-300">
                  {resolution.reasons.map((reason) => (
                    <li key={reason}>{UNSUPPORTED_REASON_LABEL[reason]}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
          {resolution.kind === 'RANGE' ? (
            <RangeMatrix
              range={resolution.range}
              selectedKey={selectedKey}
              onSelectKey={setSelectedKey}
              label={`${positionSpoken}의 ${RANGE_LABEL} 표`}
            />
          ) : null}
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          {resolution.kind === 'RANGE' ? (
            <SelectedHandPanel handClass={selectedClass} range={resolution.range} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
