'use client';

/**
 * `RangeExplorer` — the Range Explorer's whole interactive island (build spec deliverables
 * 1-3). This is the one component in this work package that needs `'use client'`: it owns
 * filter state, the click-to-select hand, Compare mode, and the URL sync. Everything it
 * renders underneath — `RangeFilters`, `RangeMatrix`, `RangeSummary`, `SelectedHandPanel`,
 * `RangeCompareMatrix`, `RangeShareLink` — is a plain controlled component with no directive
 * of its own, the same pattern `CardPicker`/`RangeMatrix` already establish in this app:
 * only the root of a client subtree needs the marker, not every leaf under it.
 *
 * STATE SHAPE. `heroPosition` / `spot` / `stackDepth` are the three axes the URL owns
 * (`features/range/url.ts`); `tableSize` is not state at all — this WP does not add a table-
 * size filter, so every query this component builds is pinned to `6` (6-max), the app's only
 * shipped table size. `resolveRange` (WP-C) is the single source of truth for whether that
 * query is real data; this component never re-derives "is this supported" itself.
 *
 * URL SYNC, safely ordered. A naive "read on mount, write on every change" pair races itself:
 * if the write-effect fired on the very first mount using the (still-default) pre-hydration
 * state, it would stomp a real shared URL (`?hero=CO&...`) back to the defaults before the
 * read-effect's `setState` had a chance to land. The `hydrated` flag exists specifically to
 * close that window — the write-effect is a no-op until the read-effect has already applied
 * (or found nothing to apply, which is also "done"), so the first write after mount always
 * reflects the URL-corrected state, never a stale default. Both effects run client-only
 * (`window`/`history` do not exist during the server render that produces the initial HTML),
 * and the very first client render intentionally reuses the same defaults the server used —
 * reading `window.location` inside the `useState` initializer instead would make the client's
 * first render diverge from the server's markup, which is a React hydration mismatch, not a
 * shortcut.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  comboCountOf,
  differenceHandClassSets,
  handClassByKey,
  percentageOf,
  STRATEGY_POSITIONS,
  type HandClassSet,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import {
  describeRangeConditions,
  POSITION_LABEL,
  positionAccessibleName,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
  resolveRange,
  UNSUPPORTED_REASON_LABEL,
  type RangeResolution,
  type RangeResolutionUnsupported,
  type RangeSpot,
  type RangeStackDepth,
} from '../features/range/index.js';
import { buildRangeUrl, parseRangeUrlQuery } from '../features/range/url.js';
import { ExplanationCard } from './ExplanationCard.js';
import { RangeCompareMatrix } from './RangeCompareMatrix.js';
import { RangeFilters } from './RangeFilters.js';
import { PositionLegend } from './PositionLegend.js';
import { RangeMatrix } from './RangeMatrix.js';
import { RangeShareLink } from './RangeShareLink.js';
import { RangeSummary } from './RangeSummary.js';
import { SectionHeading } from './SectionHeading.js';
import { SelectedHandPanel } from './SelectedHandPanel.js';

const DEFAULT_HERO_POSITION: StrategyPosition = 'BTN';
const DEFAULT_SPOT: RangeSpot = 'RFI';
const DEFAULT_STACK_DEPTH: RangeStackDepth = 100;
const TABLE_SIZE = 6 as const;

function otherPosition(exclude: StrategyPosition): StrategyPosition {
  return STRATEGY_POSITIONS.find((position) => position !== exclude) ?? exclude;
}

/** `BTN`'s default compare partner is `UTG` (and vice versa) — the exact pairing the build
 *  spec's own teaching-line example uses, so the very first thing a visitor sees in Compare
 *  mode is the illustrative case, not an arbitrary one. */
function defaultComparePositionFor(heroPosition: StrategyPosition): StrategyPosition {
  return heroPosition === 'UTG' ? 'BTN' : 'UTG';
}

/**
 * The methodology affordance `RANGE_LABEL` pairs with. Its provenance paragraph is
 * `RANGE_PROVENANCE_SENTENCE` — one constant shared with `/tools/range`, `/practice/range-quiz`
 * and `/about`, see that constant's doc for what the sourcing actually is and why this used to
 * say "여러 무료 포커 교육 자료" and should not have.
 */
function ConditionsDisclosure() {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer py-3 text-sm font-medium text-brand-500 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
        이 기준은 무엇인가요?
      </summary>
      <ExplanationCard className="mt-3">
        <p>{RANGE_PROVENANCE_SENTENCE}</p>
      </ExplanationCard>
    </details>
  );
}

function UnsupportedRangeNotice({
  resolution,
}: {
  readonly resolution: RangeResolutionUnsupported;
}) {
  return (
    <ExplanationCard title="아직 준비되지 않았습니다">
      <ul className="list-disc space-y-1 pl-4">
        {resolution.reasons.map((reason) => (
          <li key={reason}>{UNSUPPORTED_REASON_LABEL[reason]}</li>
        ))}
      </ul>
    </ExplanationCard>
  );
}

function RangeConditionsAndSummary({ resolution }: { readonly resolution: RangeResolution }) {
  if (resolution.kind === 'UNSUPPORTED') {
    return <UnsupportedRangeNotice resolution={resolution} />;
  }
  return (
    <>
      <RangeSummary
        showNotation
        range={resolution.range}
        label={RANGE_LABEL}
        conditions={describeRangeConditions(resolution.query)}
      />
      <ConditionsDisclosure />
    </>
  );
}

function matrixRangeOf(resolution: RangeResolution): HandClassSet | null {
  return resolution.kind === 'RANGE' ? resolution.range : null;
}

export function RangeExplorer() {
  const [heroPosition, setHeroPosition] = useState<StrategyPosition>(DEFAULT_HERO_POSITION);
  const [spot, setSpot] = useState<RangeSpot>(DEFAULT_SPOT);
  const [stackDepth, setStackDepth] = useState<RangeStackDepth>(DEFAULT_STACK_DEPTH);
  const [selectedHandKey, setSelectedHandKey] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePosition, setComparePosition] = useState<StrategyPosition>(() =>
    defaultComparePositionFor(DEFAULT_HERO_POSITION),
  );
  const [mobileCompareView, setMobileCompareView] = useState<'hero' | 'compare' | 'diff'>('hero');
  const [hydrated, setHydrated] = useState(false);
  const [shareOrigin, setShareOrigin] = useState('');

  // Read the URL exactly once, after mount — see the module doc for why this cannot happen
  // in the `useState` initializer instead.
  useEffect(() => {
    const parsed = parseRangeUrlQuery(window.location.search);
    if (parsed.heroPosition !== undefined) setHeroPosition(parsed.heroPosition);
    if (parsed.spot !== undefined) setSpot(parsed.spot);
    if (parsed.stackDepth !== undefined) setStackDepth(parsed.stackDepth);
    setShareOrigin(window.location.origin);
    setHydrated(true);
    // Mount-only: this effect's entire job is the one-time read of the URL the page loaded
    // with, never a reaction to this component's own later state changes. The `useState`
    // setters it calls are React-guaranteed stable across renders, so an empty dependency
    // array is correct here, not a suppressed lint violation.
  }, []);

  // Keep the URL in sync with the filters, without a full navigation (build spec deliverable
  // 2). Gated on `hydrated` so this never fires with pre-hydration defaults — see module doc.
  useEffect(() => {
    if (!hydrated) return;
    const url = buildRangeUrl({ heroPosition, spot, stackDepth });
    window.history.replaceState(null, '', url);
  }, [hydrated, heroPosition, spot, stackDepth]);

  function handleHeroPositionChange(position: StrategyPosition) {
    setHeroPosition(position);
    setComparePosition((current) => (current === position ? otherPosition(position) : current));
  }

  const query = useMemo(
    () => ({ heroPosition, spot, stackDepth, tableSize: TABLE_SIZE }),
    [heroPosition, spot, stackDepth],
  );
  const resolution = useMemo(() => resolveRange(query), [query]);

  const compareQuery = useMemo(
    () => ({ heroPosition: comparePosition, spot, stackDepth, tableSize: TABLE_SIZE }),
    [comparePosition, spot, stackDepth],
  );
  const compareResolution = useMemo(() => resolveRange(compareQuery), [compareQuery]);

  const matrixRange = matrixRangeOf(resolution);
  const compareMatrixRange = matrixRangeOf(compareResolution);
  const selectedHandClass =
    selectedHandKey !== null ? (handClassByKey(selectedHandKey) ?? null) : null;

  const shareUrl = `${shareOrigin}${buildRangeUrl({ heroPosition, spot, stackDepth })}`;

  const heroLabel = POSITION_LABEL[heroPosition];
  const compareLabel = POSITION_LABEL[comparePosition];
  // The abbreviation is what a heading SHOWS (ADR-0053); these are what a screen reader
  // SAYS for the same position, so a grid is announced as `언더더건(UTG) 자리의 …` instead of
  // three spelled-out letters (`docs/FISHTILT_STATE.md` ruling 65).
  const heroSpoken = positionAccessibleName(heroPosition);
  const compareSpoken = positionAccessibleName(comparePosition);

  const diff = useMemo(() => {
    if (resolution.kind !== 'RANGE' || compareResolution.kind !== 'RANGE') return null;
    const { range: rangeA } = resolution;
    const { range: rangeB } = compareResolution;
    const onlyHero = differenceHandClassSets(rangeA, rangeB);
    const onlyCompare = differenceHandClassSets(rangeB, rangeA);
    return {
      rangeA,
      rangeB,
      heroCombos: comboCountOf(rangeA),
      heroPercentage: percentageOf(rangeA) * 100,
      compareCombos: comboCountOf(rangeB),
      comparePercentage: percentageOf(rangeB) * 100,
      onlyHeroCombos: comboCountOf(onlyHero),
      onlyCompareCombos: comboCountOf(onlyCompare),
    };
  }, [resolution, compareResolution]);

  return (
    <div>
      <RangeFilters
        heroPosition={heroPosition}
        onHeroPositionChange={handleHeroPositionChange}
        spot={spot}
        onSpotChange={setSpot}
        stackDepth={stackDepth}
        onStackDepthChange={setStackDepth}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={compareMode}
          onClick={() => setCompareMode((value) => !value)}
          className={`inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
            compareMode
              ? 'border-brand-500 bg-brand-600 text-ink-on-brand'
              : 'border-line-500 bg-panel-600 text-text-100 hover:border-brand-500'
          }`}
        >
          다른 위치와 비교
        </button>
        <RangeShareLink href={shareUrl} />
      </div>

      {/*
        Desktop layout of the default view. The matrix column is `max-content` — exactly the
        608px the 13x13 grid occupies — so the slack goes to the summary beside it instead of
        opening a dead gap between the two. Rows are stated as `auto 1fr` because the matrix
        spans both: left implicit, a grid distributes a spanning item's surplus height across
        every row it covers, which inflated row 1 and pushed the selected-hand panel a long
        way down the page, below the fold on a laptop. Sending the surplus to the `1fr` row
        puts that panel directly under the summary, where a reader who just clicked a cell is
        already looking. DOM order stays summary -> matrix -> panel, which is the single-column
        reading order on a phone.
      */}
      {!compareMode ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[max-content_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="lg:col-start-2 lg:row-start-1">
            <RangeConditionsAndSummary resolution={resolution} />
          </div>
          {/*
            WHERE THE ANSWER TO A TAP LIVES ON A PHONE (WP-4, measured at 375px).

            DOM order used to be summary -> matrix -> panel, and the matrix is 608px tall, so
            tapping AA — the top-left cell, and the first cell most beginners reach for — left
            the detail panel 1154px down the page: the reader tapped and nothing they could see
            changed except the cell's own ring. That is the same defect
            `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M8 found on the card-picker tools.

            So the panel now precedes the matrix in the DOM (which is the phone's reading
            order) and sticks to the top of the viewport while the table scrolls under it, with
            its own capped scroll and `tabIndex` so the cap is reachable by keyboard too. It
            becomes sticky only once a hand is SELECTED — pinning the "표에서 핸드를 선택하면"
            prompt to the top of every phone screen would spend the same space saying nothing.

            Nothing about the desktop layout moves: `lg:` grid placement still puts the summary
            at row 1 and the panel at row 2 of the right-hand column, and `lg:static` drops the
            stickiness, so the reordering is invisible above `lg`. The 13x13 scroller, the
            overflow cue and the compare switcher are untouched.
          */}
          <div
            className={`lg:static lg:col-start-2 lg:row-start-2 ${
              selectedHandClass !== null ? 'sticky top-0 z-10' : ''
            }`}
          >
            <div
              tabIndex={0}
              className="max-h-[42svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
            >
              <SelectedHandPanel handClass={selectedHandClass} range={matrixRange} />
            </div>
          </div>
          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <SectionHeading as="h2" title={`${heroLabel} 핸드레인지 표`} className="mb-3" />
            <RangeMatrix
              label={`${heroSpoken}의 핸드 레인지 표`}
              range={matrixRange}
              selectedKey={selectedHandKey}
              onSelectKey={setSelectedHandKey}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm font-semibold text-text-100">비교할 위치</p>
          <div role="group" aria-label="비교할 위치" className="mt-2 flex flex-wrap gap-2">
            {STRATEGY_POSITIONS.filter((position) => position !== heroPosition).map((position) => (
              <button
                key={position}
                type="button"
                aria-pressed={comparePosition === position}
                aria-label={positionAccessibleName(position)}
                onClick={() => setComparePosition(position)}
                className={`inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  comparePosition === position
                    ? 'border-brand-500 bg-brand-600 text-ink-on-brand'
                    : 'border-line-500 bg-panel-600 text-text-100 hover:border-brand-500'
                }`}
              >
                {POSITION_LABEL[position]}
              </button>
            ))}
          </div>
          <PositionLegend
            positions={STRATEGY_POSITIONS.filter((position) => position !== heroPosition)}
          />

          {/*
            A pressed-toggle GROUP, not a `role="tablist"`. It was tabs, and the pattern did
            not hold up: there was no `role="tabpanel"` and no `aria-controls` for the tabs to
            point at, and the panels they switch are `hidden lg:block` — at `lg` every panel
            becomes visible at once while this switch itself is `lg:hidden`, so nothing is
            "selected" any more. A tablist that promises arrow-key navigation between tabs and
            a selected panel, and delivers neither, is worse for a screen-reader user than the
            plain `aria-pressed` toggles this app already uses for every other view switch
            (`RangeFilters`, `HomeRangePreview`, `RangeMatrixMini`).
          */}
          <div
            role="group"
            aria-label="비교 보기 전환"
            className="mt-4 flex flex-wrap gap-2 lg:hidden"
          >
            {(
              [
                ['hero', heroLabel],
                ['compare', compareLabel],
                ['diff', '차이'],
              ] as const
            ).map(([view, viewLabel]) => (
              <button
                key={view}
                type="button"
                aria-pressed={mobileCompareView === view}
                onClick={() => setMobileCompareView(view)}
                className={`inline-flex h-11 items-center rounded-md border px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  mobileCompareView === view
                    ? 'border-brand-500 bg-brand-600 text-ink-on-brand'
                    : 'border-line-500 bg-panel-600 text-text-100'
                }`}
              >
                {viewLabel}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={mobileCompareView === 'hero' ? '' : 'hidden lg:block'}>
              <SectionHeading as="h3" title={heroLabel} className="mb-3" />
              <RangeConditionsAndSummary resolution={resolution} />
              <RangeMatrix
                className="mt-4"
                label={`${heroSpoken}의 핸드 레인지 표`}
                range={matrixRange}
                selectedKey={selectedHandKey}
                onSelectKey={setSelectedHandKey}
              />
            </div>
            <div className={mobileCompareView === 'compare' ? '' : 'hidden lg:block'}>
              <SectionHeading as="h3" title={compareLabel} className="mb-3" />
              <RangeConditionsAndSummary resolution={compareResolution} />
              <RangeMatrix
                className="mt-4"
                label={`${compareSpoken}의 핸드 레인지 표`}
                range={compareMatrixRange}
                selectedKey={selectedHandKey}
                onSelectKey={setSelectedHandKey}
              />
            </div>
          </div>

          <div className={`mt-6 ${mobileCompareView === 'diff' ? '' : 'hidden lg:block'}`}>
            <SectionHeading
              as="h3"
              title="차이 보기"
              description="공통으로 쓰는 패와 한쪽에서만 쓰는 패를 비교합니다."
              className="mb-3"
            />
            {diff ? (
              <>
                <RangeCompareMatrix
                  rangeA={diff.rangeA}
                  labelA={heroSpoken}
                  rangeB={diff.rangeB}
                  labelB={compareSpoken}
                  selectedKey={selectedHandKey}
                  onSelectKey={setSelectedHandKey}
                  label={`${heroSpoken}와 ${compareSpoken}의 레인지 차이`}
                />
                <p className="mt-3 text-sm text-text-300">
                  {heroLabel}: {diff.heroCombos.toLocaleString('ko-KR')}가지 (
                  {diff.heroPercentage.toFixed(1)}%) · {compareLabel}:{' '}
                  {diff.compareCombos.toLocaleString('ko-KR')}가지 (
                  {diff.comparePercentage.toFixed(1)}
                  %) · {heroLabel}에만 있는 조합 {diff.onlyHeroCombos.toLocaleString('ko-KR')}가지 ·{' '}
                  {compareLabel}에만 있는 조합 {diff.onlyCompareCombos.toLocaleString('ko-KR')}가지
                </p>
              </>
            ) : (
              <ExplanationCard title="차이를 비교할 수 없습니다">
                <p>두 위치 모두 {RANGE_LABEL}가 있어야 차이를 볼 수 있습니다.</p>
              </ExplanationCard>
            )}

            {/*
              WHAT THIS CARD MAY SAY, and why it says so little.

              It used to say that a later seat can open wider "손해를 보지 않기 때문" — a
              PROFITABILITY claim this site has no dataset for, and the exact claim
              `content/blog/btn-why-wide.mdx` refuses in as many words ("칸이 더 많다는 사실이
              '버튼에서 패를 더 넓게 쓰는 게 이득이다'라는 뜻은 아닙니다"). The two surfaces
              answer the same question and now give the same answer.

              Its stated MECHANISM was also wrong for the spot on screen. This card renders on
              an RFI (아무도 참여하지 않았을 때) comparison, where everyone before hero has
              folded BY DEFINITION — at UTG exactly as much as at BTN, probability 1 at every
              seat. "앞사람들이 이미 폴드했을 가능성이 높아" named the one quantity that does
              not vary across the comparison it was explaining. What actually differs between
              two RFI seats is how many players are still to act BEHIND — a structural fact,
              and not by itself a reason the table has the shape it has. The two seats are
              named from `heroLabel`/`compareLabel` rather than hard-coded to UTG/BTN, because
              this card renders for whichever pair the reader actually selected — joined with
              a middle dot rather than a Korean particle, because the correct particle after a
              Latin abbreviation depends on how that abbreviation is READ (BTN ends in a
              consonant sound, CO does not) and a template cannot pick it.
            */}
            <ExplanationCard className="mt-4" title="왜 넓이가 다를까요?">
              <p>
                두 표 모두 아무도 참여하지 않았을 때의 표입니다. 그 조건에서는 내 앞 사람이 모두
                폴드했다는 것이 이미 정해져 있어서, {heroLabel} · {compareLabel} 두 자리 모두 그
                부분은 똑같습니다. 자리에 따라 실제로 달라지는 것은 내 뒤에 아직 행동할 사람이 몇 명
                남아 있는지이고, 뒤쪽 자리일수록 그 수가 적습니다.
              </p>
              <p className="mt-3">
                여기까지가 이 표에서 확인할 수 있는 사실입니다. 칸이 더 많다는 것이 뒤쪽 자리에서 더
                넓게 여는 편이 이득이라거나 그렇게 하는 것이 맞는 방식이라는 뜻은 아닙니다. 이 표가
                왜 이런 모양인지는 이 사이트가 아직 답할 수 있는 범위 밖입니다.
              </p>
            </ExplanationCard>
          </div>

          <div className="mt-6">
            <SelectedHandPanel handClass={selectedHandClass} range={matrixRange} />
          </div>
        </div>
      )}
    </div>
  );
}
