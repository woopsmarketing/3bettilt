/**
 * `SplitLayout` — two columns of unequal width (D-S3-12): 7/5, 5/7 or an even 6/6 on a
 * twelve-column grid from `lg` up, one column below it.
 *
 * For "text beside a picture", "a lesson beside its diagram", "a tool beside its
 * explanation" — the asymmetric feature the layout brief lists, without a page having to
 * write `lg:grid-cols-12` and two `col-span`s by hand and then get them subtly different
 * from the page next door.
 *
 * `primary` is always first in the DOM. When `ratio="5/7"` the primary column is the
 * NARROWER one and sits on the LEFT — the ratio describes widths, not importance — and a
 * page that wants the picture on the left simply passes it as `primary`. Nothing is
 * reordered visually against the DOM, so reading order and tab order match what is seen.
 */
export type SplitRatio = '7/5' | '5/7' | '6/6';

export interface SplitLayoutProps {
  readonly primary: React.ReactNode;
  readonly secondary: React.ReactNode;
  readonly ratio?: SplitRatio;
  /** Vertical alignment of the two columns from `lg` up. */
  readonly align?: 'start' | 'center';
  readonly className?: string;
}

const RATIO_CLASS: Readonly<Record<SplitRatio, readonly [string, string]>> = {
  '7/5': ['lg:col-span-7', 'lg:col-span-5'],
  '5/7': ['lg:col-span-5', 'lg:col-span-7'],
  '6/6': ['lg:col-span-6', 'lg:col-span-6'],
};

export function SplitLayout({
  primary,
  secondary,
  ratio = '7/5',
  align = 'start',
  className = '',
}: SplitLayoutProps) {
  const [first, second] = RATIO_CLASS[ratio];
  const alignClass = align === 'center' ? 'lg:items-center' : 'lg:items-start';
  return (
    <div
      data-ratio={ratio}
      className={`grid gap-10 lg:grid-cols-12 lg:gap-12 ${alignClass} ${className}`}
    >
      <div className={`min-w-0 ${first}`}>{primary}</div>
      <div className={`min-w-0 ${second}`}>{secondary}</div>
    </div>
  );
}
