/**
 * `RangeFilters` — the Range Explorer's position control (내 위치) and its conditions
 * statement (조건: 상황 · 스택 · 테이블). Pure, controlled presentation over `features/range`'s
 * copy and types — the same idiom every other range component in this app uses
 * (`RangeMatrix`, `SelectedHandPanel`): the caller owns the selected values and gets every
 * change through a callback, this component holds no state of its own, and therefore needs
 * no `'use client'` of its own — it only ever renders inside `RangeExplorer`'s client
 * boundary.
 *
 * WHAT IS AND IS NOT OFFERED (build spec §D, "the data reality"). Only ONE point in the
 * whole (position x spot x stack) space is real data: RFI at 100BB. That line is drawn once,
 * in `features/range/resolve.ts` — this component does not re-derive it, it reads
 * `RANGE_SPOTS`/`RANGE_STACK_DEPTHS` and the supported constants below:
 *
 *   - 내 위치: all six positions are REAL, clickable buttons, including BB. Selecting BB is
 *     not an error — `resolveRange` returns an honest `BB_HAS_NO_RFI_RANGE` explanation for
 *     it (a rule of the game, not a missing dataset), so BB is never disabled here. The
 *     abbreviations are glossed once underneath by `PositionLegend`, and each button's
 *     ACCESSIBLE name is `positionAccessibleName()` rather than the bare abbreviation —
 *     `docs/FISHTILT_STATE.md` ruling 65. See `PositionLegend.tsx` for why the gloss is a
 *     legend and not part of every label.
 *   - 조건 (상황 · 스택 · 테이블): ONE statement, not a grid of controls. Until WP-S3-19 the
 *     two unshipped spots and three unshipped stack depths rendered as five real `disabled`
 *     buttons with a "준비 중" badge — honest, but the visual grammar of an unfinished admin
 *     panel, in nav slot 2 (review B-M3: "a beginner reads 'this product is 20 % built'").
 *     The same fact is now said the way the FAQ already says it: the tool covers one
 *     situation, named up front (`describeRangeConditions`, so the wording is the one every
 *     other surface uses), followed by a plain sentence naming what is NOT supported —
 *     built from the same `RANGE_SPOTS`/`RANGE_STACK_DEPTHS` lists, so a dataset that ships
 *     later has to change the constants here and disappears from the "not yet" sentence by
 *     construction. Nothing about that sentence pretends: no control, no fake option, and
 *     the unsupported situations are still written down (AGENT_COMMON_RULES §3).
 *
 * `spot` / `stackDepth` are still read (the statement names the CURRENT query, not a
 * literal), and the two change callbacks stay in the props so the callers' contract is
 * unchanged; with one shipped value each there is nothing for them to fire from.
 */
import { STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
import {
  describeRangeConditions,
  POSITION_LABEL,
  positionAccessibleName,
  RANGE_SPOTS,
  RANGE_STACK_DEPTHS,
  SPOT_LABEL,
  stackDepthLabel,
  TABLE_SIZE_LABEL,
  type RangeSpot,
  type RangeStackDepth,
  type RangeTableSize,
} from '../features/range/index.js';
import { PositionLegend } from './PositionLegend.js';

const SUPPORTED_SPOT: RangeSpot = 'RFI';
const SUPPORTED_STACK_DEPTH: RangeStackDepth = 100;
const SUPPORTED_TABLE_SIZE: RangeTableSize = 6;

/** `150` is labelled "150BB+" per the build spec's filter copy (the largest bucket is
 *  open-ended), built from `stackDepthLabel(150)` plus a literal "+" rather than a second
 *  hard-coded number. */
function stackBucketLabel(depth: RangeStackDepth): string {
  return depth === 150 ? `${stackDepthLabel(depth)}+` : stackDepthLabel(depth);
}

/**
 * The one sentence that names what this tool does NOT cover, from the same lists the old
 * disabled buttons were drawn from. Exported so the tests can pin it against the lists.
 */
export function unsupportedConditionsSentence(): string {
  const spots = RANGE_SPOTS.filter((s) => s !== SUPPORTED_SPOT).map((s) => SPOT_LABEL[s]);
  const depths = RANGE_STACK_DEPTHS.filter((d) => d !== SUPPORTED_STACK_DEPTH).map(
    stackBucketLabel,
  );
  return `${spots.join(', ')} 상황과 ${depths.join(' · ')} 스택은 아직 지원하지 않습니다.`;
}

/**
 * Which of the two blocks this instance renders.
 *
 * `'ALL'` is the Range Explorer's form and stays the default. The split exists for
 * `/practice/range-quiz`, where 상황 and 스택 can never change — the quiz pins them to the
 * shipped values — so the conditions statement sat between the reader and 퀴즈 시작, the
 * only control on the screen that does anything. That page renders `'POSITION'` above the
 * start button and `'CONDITIONS'` below it.
 */
export type RangeFilterGroups = 'ALL' | 'POSITION' | 'CONDITIONS';

export interface RangeFiltersProps {
  readonly heroPosition: StrategyPosition;
  readonly onHeroPositionChange: (position: StrategyPosition) => void;
  readonly spot: RangeSpot;
  readonly onSpotChange: (spot: RangeSpot) => void;
  readonly stackDepth: RangeStackDepth;
  readonly onStackDepthChange: (stackDepth: RangeStackDepth) => void;
  readonly groups?: RangeFilterGroups;
  readonly className?: string;
}

const GROUP_BUTTON_BASE =
  'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border px-3 ' +
  'text-sm font-semibold outline-none transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function enabledClass(selected: boolean): string {
  return selected
    ? `${GROUP_BUTTON_BASE} border-brand-500 bg-brand-600 text-ink-on-brand`
    : `${GROUP_BUTTON_BASE} border-line-500 bg-panel-600 text-text-100 hover:border-brand-500`;
}

function FilterGroup({
  legend,
  children,
  footer,
}: {
  readonly legend: string;
  readonly children: React.ReactNode;
  /** Rendered under the button row — the abbreviation gloss for 내 위치 (ruling 65). Outside
   *  the `role="group"` so it is a note about the control, not one more thing inside it. */
  readonly footer?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-text-100">{legend}</p>
      <div role="group" aria-label={legend} className="mt-2 flex flex-wrap gap-2">
        {children}
      </div>
      {footer}
    </div>
  );
}

export function RangeFilters({
  heroPosition,
  onHeroPositionChange,
  spot,
  stackDepth,
  groups = 'ALL',
  className = '',
}: RangeFiltersProps) {
  const showPosition = groups === 'ALL' || groups === 'POSITION';
  const showConditions = groups === 'ALL' || groups === 'CONDITIONS';

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {showPosition ? (
        <FilterGroup legend="내 위치" footer={<PositionLegend positions={STRATEGY_POSITIONS} />}>
          {STRATEGY_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              aria-pressed={heroPosition === position}
              aria-label={positionAccessibleName(position)}
              onClick={() => onHeroPositionChange(position)}
              className={enabledClass(heroPosition === position)}
            >
              {POSITION_LABEL[position]}
            </button>
          ))}
        </FilterGroup>
      ) : null}

      {showConditions ? (
        <section aria-label="조건" data-range-conditions="">
          <p className="text-sm font-semibold text-text-100">조건</p>
          <p className="prose-ko mt-2 text-base text-text-100">
            지금은{' '}
            <strong className="font-semibold">
              {describeRangeConditions({
                heroPosition,
                spot,
                stackDepth,
                tableSize: SUPPORTED_TABLE_SIZE,
              })}
            </strong>{' '}
            한 가지 상황만 다룹니다.
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <div className="flex gap-2 sm:block">
              <dt className="shrink-0 text-text-300">상황</dt>
              <dd className="prose-ko font-medium text-text-100">{SPOT_LABEL[spot]}</dd>
            </div>
            <div className="flex gap-2 sm:block">
              <dt className="shrink-0 text-text-300">스택</dt>
              <dd className="font-medium text-text-100">{stackDepthLabel(stackDepth)}</dd>
            </div>
            <div className="flex gap-2 sm:block">
              <dt className="shrink-0 text-text-300">테이블</dt>
              <dd className="font-medium text-text-100">
                {TABLE_SIZE_LABEL[SUPPORTED_TABLE_SIZE]}
              </dd>
            </div>
          </dl>
          <p className="prose-ko mt-3 text-xs text-text-300">{unsupportedConditionsSentence()}</p>
        </section>
      ) : null}
    </div>
  );
}
