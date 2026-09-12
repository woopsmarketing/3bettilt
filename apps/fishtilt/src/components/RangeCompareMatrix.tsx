/**
 * `RangeCompareMatrix` — the Range Explorer's Compare mode difference view (build spec
 * deliverable 3): the same 13x13 grid `RangeMatrix` renders, but coloured by membership in
 * TWO ranges at once instead of one.
 *
 * WHY THIS IS A SEPARATE COMPONENT, NOT A NEW MODE OF `RangeMatrix`. `RangeMatrix` is a
 * WP-C file this work package does not own (`apps/fishtilt/src/components/` files this WP
 * did not create are read-only per the brief) and its `range: HandClassSet | null` prop
 * only has room for one range's membership. Duplicating its 44px-cell / row-major / legend
 * scaffolding here rather than editing it in place.
 *
 * WHY THE DIFFERENCE IS 3-WAY, NOT 2-WAY. The build spec's own wording — "shared hands
 * neutral, hands only in the wider range highlighted" — reads as a two-range, two-colour
 * idea, and it IS accurate for nine of the ten position pairs this app can compare: for
 * every pair except BTN/SB, the narrower range (by combo count) is an exact SUBSET of the
 * wider one (checked directly against `RFI_RANGES`, not assumed). BTN vs SB is the one
 * exception — SB has more total combos than BTN (622 vs 568) but is not a superset: 3 hand
 * classes are in BTN and not in SB. `RFI_RANGES.SB` is independently DERIVED (a raise-only
 * trim of a raise-or-limp composite, see `tables.ts`), not simply "BTN plus more," so this
 * is real data shape, not a bug to paper over. Colouring those 3 classes as "in neither
 * range" (this app's actual fold colour, `act-fold-500`) would misstate a real hand as
 * absent from a range it is actually in — exactly the failure `POKER_EDUCATIONAL_DATA_AUDIT`
 * exists to prevent. So this component keeps three states — SHARED, DIFFERS (in exactly one
 * of the two), NEITHER — and lets `aria-label` (not colour) carry which side a DIFFERS cell
 * belongs to; sighted readers get the same distinction from `RangeExplorer`'s own combo-count
 * summary beside the grid, computed there with `strategy-core`'s `differenceHandClassSets`
 * directly against the same two ranges this component receives.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. A DIFFERS cell is also UNDERLINED — see `DIFFERS_CLASS`
 * for the luminance measurement that makes the underline necessary rather than decorative,
 * and the legend below carries the same mark on its swatch.
 *
 * COLOUR CHOICES, independently re-measured (WCAG relative-luminance formula, matching
 * `globals.css`'s own audit method) because this pairing is NEW — `RangeMatrix`'s doc comment
 * only covers the pairs it itself renders:
 *
 *   ink-on-action on act-call-500 fill     6.37:1 dark / 5.86:1 light  PASS  <- DIFFERS
 *   (`ink-on-action` is the dedicated ink-on-fill token, not the page colour: drawing this
 *   label in `ground-900` meant it inverted with the theme and turned light-on-light in the
 *   light palette — FISHTILT_STATE ruling 104)
 *
 * SHARED reuses `RangeMatrix`'s own already-audited in-range pairing (`ink-on-action` on
 * `act-raise-500`, 5.28 / 5.24) and NEITHER reuses its out-of-range pairing (`text-100` on
 * `act-fold-500`, 9.50 / 11.19) — both PASS, and reusing them (rather than picking new colours)
 * keeps "act-raise-500 = in a range" and "act-fold-500 = in no range" meaning consistent
 * with the single-range matrix a reader has already seen elsewhere on this page.
 */
import { HAND_CLASSES, hasHandClass, type HandClassSet } from '@gto-self/strategy-core';
import { handClassAccessibleName } from '../features/range/index.js';

export interface RangeCompareMatrixProps {
  readonly rangeA: HandClassSet;
  readonly labelA: string;
  readonly rangeB: HandClassSet;
  readonly labelB: string;
  readonly selectedKey: string | null;
  readonly onSelectKey: (key: string) => void;
  /** Accessible name for the whole grid, e.g. `"BTN과 UTG 레인지 차이"`. */
  readonly label: string;
  readonly className?: string;
}

const CELL_BASE =
  'flex h-11 w-11 items-center justify-center rounded-[3px] text-[11px] font-semibold ' +
  'leading-none outline-none transition-colors duration-150 enabled:cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const SHARED_CLASS = 'bg-act-raise-500 text-ink-on-action';
/*
 * The underline is the NON-COLOUR carrier of "in exactly one of the two ranges" (WCAG 1.4.1).
 * `act-raise-500` and `act-call-500` are far apart in hue but not in lightness — relative
 * luminance 0.235 vs 0.294, a 1.21:1 ratio — so with colour removed entirely (a monochrome
 * display, greyscale mode, achromatopsia) a SHARED cell and a DIFFERS cell are the same grey,
 * and both carry the same `ink-on-action` ink, so the ink cannot separate them either the way it
 * separates NEITHER (light ink) and the selected cell (light ink on brand). The underline is
 * drawn in the cell's own text colour, so it inherits that pairing's already-audited 6.48:1
 * and needs no new contrast measurement of its own.
 */
const DIFFERS_CLASS =
  'bg-act-call-500 text-ink-on-action underline decoration-2 underline-offset-2';
const NEITHER_CLASS = 'bg-act-fold-500 text-text-100 font-medium';
const SELECTED_CLASS = 'bg-brand-600 text-ink-on-brand';

type Membership = 'SHARED' | 'ONLY_A' | 'ONLY_B' | 'NEITHER';

function cellClassName(membership: Membership, selected: boolean): string {
  if (selected) return `${CELL_BASE} ${SELECTED_CLASS}`;
  if (membership === 'SHARED') return `${CELL_BASE} ${SHARED_CLASS}`;
  if (membership === 'NEITHER') return `${CELL_BASE} ${NEITHER_CLASS}`;
  return `${CELL_BASE} ${DIFFERS_CLASS}`;
}

export function RangeCompareMatrix({
  rangeA,
  labelA,
  rangeB,
  labelB,
  selectedKey,
  onSelectKey,
  label,
  className = '',
}: RangeCompareMatrixProps) {
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div
          role="group"
          aria-label={label}
          className="grid w-max gap-[3px]"
          style={{ gridTemplateColumns: 'repeat(13, 2.75rem)' }}
        >
          {HAND_CLASSES.map((handClass) => {
            const inA = hasHandClass(rangeA, handClass.index);
            const inB = hasHandClass(rangeB, handClass.index);
            let membership: Membership = 'NEITHER';
            if (inA && inB) membership = 'SHARED';
            else if (inA) membership = 'ONLY_A';
            else if (inB) membership = 'ONLY_B';
            const selected = selectedKey === handClass.key;

            let membershipSuffix = ', 어느 레인지에도 없음';
            if (membership === 'SHARED') membershipSuffix = ', 두 레인지 모두에 포함';
            else if (membership === 'ONLY_A') membershipSuffix = `, ${labelA}에만 포함`;
            else if (membership === 'ONLY_B') membershipSuffix = `, ${labelB}에만 포함`;

            return (
              <button
                key={handClass.key}
                type="button"
                aria-pressed={selected}
                aria-label={`${handClassAccessibleName(handClass)}${membershipSuffix}`}
                onClick={() => onSelectKey(handClass.key)}
                className={cellClassName(membership, selected)}
              >
                {handClass.key}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-text-300">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-act-raise-500" />두
          레인지 모두에 포함되는 핸드 (공통)
        </li>
        <li className="flex items-center gap-1.5">
          {/* The swatch carries the underline mark too, so the legend explains the shape a
              reader can see without colour, not only the colour. */}
          <span
            aria-hidden="true"
            className="inline-flex h-3 w-3 items-end justify-center rounded-sm bg-act-call-500"
          >
            <span className="mb-[1px] block h-[2px] w-2 bg-ink-on-action" />
          </span>
          한쪽 레인지에만 포함되는 핸드 (밑줄)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-act-fold-500" />
          어느 레인지에도 없는 핸드
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-brand-600" />
          선택한 핸드
        </li>
      </ul>
    </div>
  );
}
