/**
 * `HandIndexMatrix` — the hands hub's 13×13 index (WP-S3-13a): every one of the 169
 * classes in `strategy-core`'s own grid order, with the classes that have a page drawn as
 * links and the rest as quiet, unlabelled cells. It LOOKS like the site's signature chart
 * and it IS static: a Server Component with no state, no handlers and no client bundle —
 * the hub is a navigation page, and 169 buttons that select nothing would be a lie.
 *
 * Orientation is `RangeMatrix`'s (and `strategy-core`'s): `HAND_CLASSES` rendered in array
 * order over a 13-column grid, so the diagonal is pairs, above it suited, below it offsuit
 * — this component does not recompute row/col.
 *
 * Honesty gate: a class with a PUBLISHED record links to its page; a class with a PLANNED
 * record is drawn as a covered-but-inert cell (visibly different from a link: no fill,
 * dashed outline) and the hub's list below carries the 준비 중 badge for it; a class with no
 * record at all is one of the other classes and says nothing. The grid's accessible name
 * and the sentence under it say how many cells are pages, so the count is not colour-only.
 *
 * Width: 13 × 2.5rem cells on a phone inside an `overflow-x-auto` scroller (the page never
 * scrolls sideways), fluid from `md` up. The scroll cue is a plain sentence rendered always
 * — unlike `RangeMatrix` this component cannot measure (no client), and "표를 옆으로
 * 밀면" is a true statement on every width where the scroller overflows and harmless
 * where it does not.
 */
import { HAND_CLASSES } from '@gto-self/strategy-core';
import { hrefOfContent } from '../../content/graph.js';
import type { HandRecord } from '../../content/types.js';
import { handClassAccessibleName } from '../../features/range/index.js';

export interface HandIndexMatrixProps {
  readonly records: readonly HandRecord[];
  readonly label?: string;
  readonly className?: string;
}

const CELL =
  'flex aspect-square w-10 items-center justify-center rounded-[3px] text-[11px] leading-none md:w-auto';

const LINK_CELL =
  `${CELL} bg-brand-600 font-semibold text-ink-on-brand outline-none hover:bg-brand-hover ` +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const PLANNED_CELL = `${CELL} border border-dashed border-brand-500 font-semibold text-text-100`;

const OTHER_CELL = `${CELL} border border-line-500 bg-panel-600 font-medium text-text-300`;

export function HandIndexMatrix({
  records,
  label = '13×13 표에서 고르기',
  className = '',
}: HandIndexMatrixProps) {
  const byKey = new Map(records.map((record) => [record.handKey, record]));
  const published = records.filter((record) => hrefOfContent(record) !== null).length;

  return (
    <div data-index-matrix className={className}>
      <div className="overflow-x-auto">
        <nav
          aria-label={label}
          className="grid w-max grid-cols-[repeat(13,2.5rem)] gap-[3px] md:w-full md:grid-cols-[repeat(13,minmax(0,1fr))]"
        >
          {HAND_CLASSES.map((handClass) => {
            const record = byKey.get(handClass.key);
            const href = record === undefined ? null : hrefOfContent(record);
            if (record !== undefined && href !== null) {
              return (
                <a
                  key={handClass.key}
                  href={href}
                  aria-label={`${handClassAccessibleName(handClass)} 페이지`}
                  data-row={handClass.row}
                  data-col={handClass.col}
                  data-covered="published"
                  className={LINK_CELL}
                >
                  {handClass.key}
                </a>
              );
            }
            if (record !== undefined) {
              return (
                <span
                  key={handClass.key}
                  aria-label={`${handClassAccessibleName(handClass)} 준비 중`}
                  data-row={handClass.row}
                  data-col={handClass.col}
                  data-covered="planned"
                  className={PLANNED_CELL}
                >
                  {handClass.key}
                </span>
              );
            }
            return (
              <span
                key={handClass.key}
                aria-hidden="true"
                data-row={handClass.row}
                data-col={handClass.col}
                className={OTHER_CELL}
              >
                {handClass.key}
              </span>
            );
          })}
        </nav>
      </div>
      <p className="mt-3 text-sm text-text-300">
        칠해진 {published}칸이 페이지가 있는 패입니다. 대각선은 페어, 그 위는 같은 무늬(s), 아래는
        다른 무늬(o)입니다.
        <span className="md:hidden">
          <span aria-hidden="true"> ↔</span> 표를 옆으로 밀면 나머지 칸도 볼 수 있어요.
        </span>
      </p>
    </div>
  );
}
