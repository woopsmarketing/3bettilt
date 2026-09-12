'use client';

/**
 * `StartingHandExplorer` — the Starting Hand Explorer's whole interactive island, the one
 * component in this WP that needs `'use client'`. Mirrors `RangeExplorer`'s shape exactly
 * (this WP's brief: "same shell, same interaction idiom, same URL-state approach"):
 * `RangeMatrix` (WP-C, reused, not rebuilt), `StartingHandPanel` (this WP, itself wrapping
 * `SelectedHandPanel`) and the same mount-then-sync URL pattern.
 *
 * TWO MODES. `RANK` renders the matrix with no highlight (`range={null}`) — a plain "click
 * any of the 169 cells, read its rank" browser. `TOP_SHARE` highlights the strongest hands
 * making up at least the slider's requested share of the 1326-combo deal
 * (`topHandsByShare`, via `features/strength/viewModel.ts`). The slider only appears in
 * `TOP_SHARE` — it has nothing to control in `RANK`.
 *
 * URL SYNC, safely ordered — identical reasoning to `RangeExplorer`'s module doc: the
 * write-effect is gated on `hydrated` so it can never stomp a real shared URL
 * (`?view=TOP_SHARE&pct=25`) with the pre-hydration default before the read-effect's
 * `setState` calls have landed, and the very first client render intentionally reuses the
 * same defaults the server used (reading `window.location` in a `useState` initializer would
 * make the client's first render diverge from the server's markup — a hydration mismatch).
 *
 * WHY `range` IS NEVER PASSED TO `RangeMatrix` IN `RANK` MODE. There is no "in/out of range"
 * question in this mode — every one of the 169 classes is just as explorable as any other —
 * so the neutral, no-legend rendering `RangeMatrix` already has for `range === null` is the
 * correct one, not a range that happens to contain everything.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { handClassByKey } from '@gto-self/strategy-core';
import {
  actualShareSentence,
  buildStartingHandUrl,
  clampTopPercent,
  DEFAULT_TOP_PERCENT,
  handClassSetOfSelection,
  MAX_TOP_PERCENT,
  MIN_TOP_PERCENT,
  parseStartingHandUrlQuery,
  requestedTopPercentLabel,
  STARTING_HAND_VIEW_LABEL,
  STARTING_HAND_VIEWS,
  topSelectionForPercent,
  weakestIncludedLabel,
  type StartingHandView,
} from '../features/strength/index.js';
import { RangeMatrix } from './RangeMatrix.js';
import { SectionHeading } from './SectionHeading.js';
import { StartingHandPanel } from './StartingHandPanel.js';

/** `TOP_SHARE` on load, at the illustrative 15% the methodology report walks through, so the
 *  matrix shows a live highlight from the first paint rather than 169 neutral cells. */
const DEFAULT_VIEW: StartingHandView = 'TOP_SHARE';

const TOGGLE_BUTTON_BASE =
  'inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold ' +
  'outline-none transition-colors duration-150 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function toggleClass(active: boolean): string {
  return active
    ? `${TOGGLE_BUTTON_BASE} border-brand-500 bg-brand-600 text-ink-on-brand`
    : `${TOGGLE_BUTTON_BASE} border-line-500 bg-panel-600 text-text-100 hover:border-brand-500`;
}

export function StartingHandExplorer() {
  const sliderId = useId();
  const [view, setView] = useState<StartingHandView>(DEFAULT_VIEW);
  const [percent, setPercent] = useState<number>(DEFAULT_TOP_PERCENT);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read the URL exactly once, after mount — see the module doc for why this cannot happen
  // in the `useState` initializer instead.
  useEffect(() => {
    const parsed = parseStartingHandUrlQuery(window.location.search);
    if (parsed.view !== undefined) setView(parsed.view);
    if (parsed.percent !== undefined) setPercent(parsed.percent);
    setHydrated(true);
    // Mount-only: the one-time read of the URL the page loaded with. The `useState` setters
    // it calls are React-guaranteed stable, so an empty dependency array is correct here.
  }, []);

  // Keep the URL in sync with the mode and the slider, without a full navigation. Gated on
  // `hydrated` so this never fires with pre-hydration defaults — see module doc.
  useEffect(() => {
    if (!hydrated) return;
    const url = buildStartingHandUrl({ view, percent });
    window.history.replaceState(null, '', url);
  }, [hydrated, view, percent]);

  const selection = useMemo(() => topSelectionForPercent(percent), [percent]);
  const matrixRange = useMemo(
    () => (view === 'TOP_SHARE' ? handClassSetOfSelection(selection) : null),
    [view, selection],
  );
  const selectedHandClass = selectedKey !== null ? (handClassByKey(selectedKey) ?? null) : null;

  return (
    <div>
      <div role="group" aria-label="보는 방식" className="flex flex-wrap gap-2">
        {STARTING_HAND_VIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={view === candidate}
            onClick={() => setView(candidate)}
            className={toggleClass(view === candidate)}
          >
            {STARTING_HAND_VIEW_LABEL[candidate]}
          </button>
        ))}
      </div>

      {view === 'TOP_SHARE' ? (
        <div className="mt-4 rounded-lg border border-line-500 bg-panel-700 p-4">
          <label htmlFor={sliderId} className="block text-sm font-semibold text-text-100">
            {requestedTopPercentLabel(percent)}
          </label>
          <input
            id={sliderId}
            type="range"
            min={MIN_TOP_PERCENT}
            max={MAX_TOP_PERCENT}
            step={1}
            value={percent}
            aria-valuetext={requestedTopPercentLabel(percent)}
            onChange={(event) => setPercent(clampTopPercent(Number(event.target.value)))}
            /* `h-11`: a bare range input is a 16px-tall box, so the drag target was a third
               of the 44px minimum. Height on the element grows the hit box; the browser keeps
               drawing its own track and thumb centred inside it, so nothing looks different. */
            className="mt-3 h-11 w-full cursor-pointer accent-brand-600"
          />
          <p className="mt-3 text-sm text-text-300">{actualShareSentence(selection)}</p>
          {(() => {
            const weakestLabel = weakestIncludedLabel(selection);
            return weakestLabel !== null ? (
              <p className="mt-1 text-sm text-text-300">{weakestLabel}</p>
            ) : null;
          })()}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[max-content_minmax(0,1fr)] lg:items-start">
        {/*
          WHERE THE ANSWER TO A TAP LIVES ON A PHONE (WP-4, measured at 375px) — the same fix
          and the same reasoning as `RangeExplorer`'s: with the panel after a 608px matrix in
          the DOM, tapping AA left its rank and equity 1491px down the page. The panel now
          precedes the matrix (the phone's reading order) and pins to the top of the viewport
          once a hand is selected, while `lg:` grid placement keeps the desktop layout exactly
          as it was — matrix left, panel right.
        */}
        <div
          className={`lg:static lg:col-start-2 lg:row-start-1 ${
            selectedHandClass !== null ? 'sticky top-0 z-10' : ''
          }`}
        >
          <div
            tabIndex={0}
            className="max-h-[42svh] overflow-y-auto lg:max-h-none lg:overflow-visible"
          >
            <StartingHandPanel handClass={selectedHandClass} />
          </div>
        </div>
        <div className="lg:col-start-1 lg:row-start-1">
          <SectionHeading as="h2" title="169개 시작 패" className="mb-3" />
          <RangeMatrix
            label="시작 패 강도 표"
            range={matrixRange}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
          />
        </div>
      </div>
    </div>
  );
}
