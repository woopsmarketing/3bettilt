'use client';

/**
 * `RangeMatrix` — the site's signature visual, a 13x13 grid of the 169 starting-hand
 * classes. Reused wherever a page needs the chart (homepage, the Range Explorer, learn
 * articles, hand pages, quiz results — WP-C only builds and tests the piece itself); it
 * takes a `HandClassSet | null` and a controlled selection and knows nothing about a query,
 * a spot, a stack depth or which page it is on.
 *
 * ORIENTATION. Pinned to `strategy-core`'s own convention (`range/handClass.ts`'s module
 * doc): ranks descending, `0 = A ... 12 = 2`; the diagonal is pairs, above it suited, below
 * it offsuit. This component does not recompute row/col — it renders `HAND_CLASSES` in the
 * order that array already is (`row * 13 + col`, i.e. row-major over a 13-column CSS grid),
 * so the layout is correct by construction rather than by a second calculation that could
 * drift from the package's. `RangeMatrix.test.tsx` pins three concrete cells against
 * `handClassAt` so a future refactor cannot silently invert the axes.
 *
 * SELECTION. Click/tap only — every cell is a real `<button>` with its own accessible name
 * (never hover-only; unusable on a phone otherwise). Controlled, the same idiom as
 * `CardPicker`: this component owns no state of its own.
 *
 * The accessible name is `handClassAccessibleName` + the membership state, e.g.
 * `"AKs 에이스 킹 수티드, 레인지 포함"`. The cell still DISPLAYS the bare key (ADR-0053 keeps
 * poker notation Latin), but announced on its own `AKs` is three letters read out one at a
 * time, which in a 169-button grid is the difference between navigable by ear and not.
 *
 * COLOUR. Range membership uses the strategy-action tokens (`act-raise-500` = in range,
 * `act-fold-500` = out of range), never the brand red — the brief's rule, so a selected cell
 * and an in-range cell can never be confused. Contrast was independently recomputed for the
 * pairings this component actually renders (relative-luminance / WCAG formula, matching
 * `globals.css`'s own audit method):
 *
 *   text-100  on act-raise-500 (fill)   3.40:1  FAILS body text (4.5) — would be wrong
 *   ink-on-action on act-raise-500      5.28:1 dark / 5.24:1 light  PASS  <- in-range label
 *   text-100  on act-fold-500  (fill)   9.50:1  PASS  <- already the value globals.css
 *                                                        documents; used for out-of-range
 *   brand-500 on act-raise-500          1.02:1  FAILS — brand-500 is invisible on the
 *                                                raise fill, so it CANNOT be the selection
 *                                                ring colour for an in-range cell
 *   brand-500 on act-fold-500           2.85:1  FAILS the 3:1 UI-boundary minimum too
 *   text-100  on brand-600 (fill)       4.70:1  PASS — already `globals.css`'s documented
 *                                                "brand-600 is a fill-only colour, always
 *                                                paired with text-100" rule
 *
 * `act-fold-500` specifically: `globals.css` flags it as safe ONLY as a filled background
 * with `text-100` on top, never as a border/outline/text colour on the page background.
 * This component only ever uses it that way (a full cell fill), so it never hits the
 * 1.93:1 failure the brief calls out.
 *
 * Since NEITHER brand colour reliably contrasts against BOTH possible membership fills, the
 * selected cell does not try to draw a coloured ring on top of one — it swaps to
 * `brand-600` fill + `text-100`, the one pairing already proven safe, which also makes the
 * selected cell categorically distinct (brand red appears nowhere else on the grid) rather
 * than merely a subtle outline that could wash out against either fill. Non-colour
 * reinforcement: `aria-pressed`, bold weight, and (for membership) a distinct font weight
 * between in-range/out-of-range on top of the fill difference, plus the accessible name
 * spelling out membership in words — never colour alone (WCAG 1.4.1).
 *
 * MOTION. Only a subtle background-colour transition; the global `prefers-reduced-motion`
 * reset in `globals.css` collapses it to instant, and nothing here animates on mount, so 169
 * cells cannot flash in.
 *
 * SIZE. Cells are 44px square (the same touch-target minimum `CardPicker` uses). The grid's
 * own minimum width is wider than a phone screen on purpose: the OUTER wrapper scrolls
 * horizontally (`overflow-x-auto`) so the matrix itself never shrinks cells below legible,
 * while the page around it never gains horizontal scroll from this component.
 *
 * SCROLL CUE. That trade has a cost a test cannot see: on a phone the grid is cut off
 * mid-cell at the viewport edge, and to a beginner — the only audience this site has — a
 * chopped table reads as broken rather than as scrollable. So when the wrapper actually
 * overflows, a line of text under it says so.
 *
 * It is MEASURED, not guessed from a breakpoint. The width at which this grid stops fitting
 * depends on the column it was dropped into (full-width page, one half of the compare view,
 * an article), so any `md:hidden`-style rule would be right on one page and lying on
 * another — telling a reader to swipe a table that does not move, or leaving them with a
 * clipped one. A `ResizeObserver` on the wrapper is the only version that is true
 * everywhere. It renders hidden on the server and appears at hydration: an enhancement, not
 * content, so nothing is lost if it never runs.
 */
import { useEffect, useRef, useState } from 'react';
import { HAND_CLASSES, hasHandClass, type HandClassSet } from '@gto-self/strategy-core';
import { handClassAccessibleName } from '../features/range/index.js';

export interface RangeMatrixProps {
  /** The range to show membership against. `null` renders every cell in a neutral state —
   *  no legend, no in/out distinction — for callers that just want the 169-class picker
   *  without a range context. */
  readonly range: HandClassSet | null;
  /** The controlled selection, as a class key (`'AKs'`), or `null` for none. */
  readonly selectedKey: string | null;
  readonly onSelectKey: (key: string) => void;
  /** Accessible name for the whole grid, e.g. `"핸드 레인지 표"`. */
  readonly label: string;
  readonly className?: string;
}

const CELL_BASE =
  'flex h-11 w-11 items-center justify-center rounded-[3px] text-[11px] font-semibold ' +
  'leading-none outline-none transition-colors duration-150 enabled:cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const NEUTRAL_CLASS = 'bg-panel-600 text-text-100 border border-line-500 font-medium';
/*
 * `ink-on-action`, NOT `ground-900`.
 *
 * The in-range label is dark ink drawn on a saturated fill, and `ground-900` is the PAGE
 * colour: the moment the light theme redefines it, this became a near-white label on an
 * orange fill (FISHTILT_STATE ruling 104). An ink-on-fill token is audited against its fill
 * instead of against the page and does not move when the page does — `theme-tokens.test.ts`
 * asserts the pairing in BOTH themes.
 */
const IN_RANGE_CLASS = 'bg-act-raise-500 text-ink-on-action';
const OUT_OF_RANGE_CLASS = 'bg-act-fold-500 text-text-100 font-medium';
const SELECTED_CLASS = 'bg-brand-600 text-ink-on-brand';

function cellClassName(membership: 'IN' | 'OUT' | 'NEUTRAL', selected: boolean): string {
  if (selected) return `${CELL_BASE} ${SELECTED_CLASS}`;
  if (membership === 'IN') return `${CELL_BASE} ${IN_RANGE_CLASS}`;
  if (membership === 'OUT') return `${CELL_BASE} ${OUT_OF_RANGE_CLASS}`;
  return `${CELL_BASE} ${NEUTRAL_CLASS}`;
}

export function RangeMatrix({
  range,
  selectedKey,
  onSelectKey,
  label,
  className = '',
}: RangeMatrixProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    // 1px of slack: sub-pixel layout can leave scrollWidth a hair over clientWidth on a
    // grid that actually fits, and a cue that appears on an unscrollable table is a lie.
    const measure = () => setScrollable(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <div ref={scrollerRef} className="overflow-x-auto">
        <div
          role="group"
          aria-label={label}
          className="grid w-max gap-[3px]"
          style={{ gridTemplateColumns: 'repeat(13, 2.75rem)' }}
        >
          {HAND_CLASSES.map((handClass) => {
            const inRange = range !== null && hasHandClass(range, handClass.index);
            const membership: 'IN' | 'OUT' | 'NEUTRAL' =
              range === null ? 'NEUTRAL' : inRange ? 'IN' : 'OUT';
            const selected = selectedKey === handClass.key;
            const membershipSuffix =
              range === null ? '' : inRange ? ', 레인지 포함' : ', 레인지 밖';
            return (
              <button
                key={handClass.key}
                type="button"
                aria-pressed={selected}
                aria-label={`${handClassAccessibleName(handClass)}${membershipSuffix}`}
                data-row={handClass.row}
                data-col={handClass.col}
                onClick={() => onSelectKey(handClass.key)}
                className={cellClassName(membership, selected)}
              >
                {handClass.key}
              </button>
            );
          })}
        </div>
      </div>

      {scrollable ? (
        <p className="mt-2 text-xs text-text-300">
          <span aria-hidden="true">↔ </span>표를 옆으로 밀면 나머지 칸도 볼 수 있어요.
        </p>
      ) : null}

      {range !== null ? (
        <ul className="mt-3 flex flex-wrap gap-4 text-xs text-text-300">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-act-raise-500" />
            레인지에 포함되는 핸드
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-act-fold-500" />
            레인지 밖의 핸드
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-brand-600" />
            선택한 핸드
          </li>
        </ul>
      ) : null}
    </div>
  );
}
