/**
 * `ToolRangeFigure` — a 13x13 chart drawn as a PICTURE, for the guide under `/tools/range`.
 *
 * ## Why not `RangeMatrix` / `RangeCompareMatrix` again
 *
 * Those are the tool: 169 `<button>`s each, a live selection, a client island. The guide
 * needs to show the same two lists as a figure a reader looks at while reading — the way
 * `HomeHeroVisual` draws the chart on the front page — and a second interactive grid on the
 * same page would put another 169 stops in the tab order, collide with the explorer's own
 * cell names, and ship client JavaScript for something that never changes. So this is a
 * server component: spans, no handlers, the counts stated as text, the picture named for
 * assistive technology with the same facts the legend shows.
 *
 * ## Colour is never the only signal
 *
 * Same tokens as the interactive chart, same non-colour carrier: `act-raise-500` for a cell
 * in both lists, `act-call-500` PLUS an underline for a cell in exactly one (the lightness of
 * those two fills is 1.21:1 — `RangeCompareMatrix`'s own note), `act-fold-500` for neither.
 * A marked cell (the walkthrough hand) is brand fill with the `ink-on-brand` border
 * `HomeHeroVisual` uses for the same reason. The key is printed inside every cell.
 *
 * Fluid, not fixed: the grid divides whatever width it is given into thirteen, so it fits a
 * 320px phone inside the reading column with no horizontal scroll, and is capped at the
 * `lead` measure on a laptop so the cells do not balloon.
 */
import { HAND_CLASSES, hasHandClass, type HandClassSet } from '@gto-self/strategy-core';

export interface ToolRangeFigureProps {
  readonly rangeA: HandClassSet;
  readonly labelA: string;
  /** A second list to compare against. Omit for a single-list figure. */
  readonly rangeB?: HandClassSet;
  readonly labelB?: string;
  /** One class key to mark, e.g. the guide's walkthrough hand. */
  readonly markKey?: string;
  /** What the picture is, for assistive technology. Must state what the legend states. */
  readonly label: string;
  readonly className?: string;
}

const CELL_BASE =
  'flex aspect-square items-center justify-center rounded-[2px] text-[8px] font-semibold leading-none sm:text-[11px]';
const BOTH_CLASS = 'bg-act-raise-500 text-ink-on-action';
const ONE_CLASS =
  'bg-act-call-500 text-ink-on-action underline decoration-1 underline-offset-2 sm:decoration-2';
const NEITHER_CLASS = 'bg-act-fold-500 text-text-100 font-medium';
const MARK_CLASS = 'bg-brand-600 text-ink-on-brand border-2 border-ink-on-brand';

type Membership = 'BOTH' | 'ONE' | 'NEITHER';

function cellClass(membership: Membership, marked: boolean): string {
  if (marked) return `${CELL_BASE} ${MARK_CLASS}`;
  if (membership === 'BOTH') return `${CELL_BASE} ${BOTH_CLASS}`;
  if (membership === 'ONE') return `${CELL_BASE} ${ONE_CLASS}`;
  return `${CELL_BASE} ${NEITHER_CLASS}`;
}

function Swatch({ className }: { readonly className: string }) {
  return (
    <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-sm ${className}`} />
  );
}

export function ToolRangeFigure({
  rangeA,
  labelA,
  rangeB,
  labelB,
  markKey,
  label,
  className = '',
}: ToolRangeFigureProps) {
  const comparing = rangeB !== undefined;
  return (
    <div className={`rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-5 ${className}`}>
      <div
        role="img"
        aria-label={label}
        className="mx-auto grid w-full max-w-lead gap-[2px]"
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {HAND_CLASSES.map((handClass) => {
          const inA = hasHandClass(rangeA, handClass.index);
          const inB = comparing ? hasHandClass(rangeB, handClass.index) : inA;
          let membership: Membership = 'NEITHER';
          if (inA && inB) membership = 'BOTH';
          else if (inA || inB) membership = 'ONE';
          return (
            <span
              key={handClass.key}
              data-key={handClass.key}
              data-membership={membership}
              className={cellClass(membership, markKey === handClass.key)}
            >
              {handClass.key}
            </span>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-300">
        {comparing ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Swatch className="bg-act-raise-500" />
              {labelA}와 {labelB} 모두에 있는 패
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch className="bg-act-call-500" />
              한쪽에만 있는 패 (밑줄)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch className="bg-act-fold-500" />
              어느 쪽에도 없는 패
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Swatch className="bg-act-raise-500" />
              {labelA}에 있는 패
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch className="bg-act-fold-500" />
              없는 패
            </span>
          </>
        )}
        {markKey !== undefined ? (
          <span className="inline-flex items-center gap-1.5">
            <Swatch className="bg-brand-600" />
            {markKey} 칸
          </span>
        ) : null}
      </p>
    </div>
  );
}
