/**
 * `StatStrip` — three to five `StatCard`s in a row, with no borders between them (D-S3-12).
 *
 * The "stat strip" the layout brief lists: a band of large numbers that gives a page a
 * moment of scale without a single card. On a phone the row wraps to two columns; the
 * `plain` variant separates the stats with space alone, `rules` draws the site's one
 * border colour as thin vertical rules between them from `sm` up.
 *
 * `StatsRow` is the same component under the name the article component list uses
 * (prompt §AP): an article's row of numbers and a hub's are one primitive, not two.
 */
import { StatCard, type StatCardProps } from './StatCard.js';

export type StatStripVariant = 'plain' | 'rules';

export interface StatStripProps {
  readonly items: readonly Omit<StatCardProps, 'variant' | 'className'>[];
  readonly variant?: StatStripVariant;
  /** Accessible name for the group. */
  readonly 'aria-label'?: string;
  readonly className?: string;
}

const ITEM_CLASS: Readonly<Record<StatStripVariant, string>> = {
  plain: '',
  rules: 'sm:border-l sm:border-line-500 sm:pl-6 sm:first:border-l-0 sm:first:pl-0',
};

export function StatStrip({
  items,
  variant = 'plain',
  'aria-label': ariaLabel,
  className = '',
}: StatStripProps) {
  if (items.length === 0) return null;
  return (
    <ul
      aria-label={ariaLabel}
      data-variant={variant}
      className={`grid grid-cols-2 gap-x-6 gap-y-8 sm:flex sm:flex-wrap sm:gap-x-10 ${className}`}
    >
      {items.map((item) => (
        <li key={item.label} className={`min-w-0 sm:flex-1 ${ITEM_CLASS[variant]}`}>
          <StatCard label={item.label} value={item.value} note={item.note} />
        </li>
      ))}
    </ul>
  );
}

/** The article-library name for the same primitive (prompt §AP). */
export const StatsRow = StatStrip;
export type StatsRowProps = StatStripProps;
