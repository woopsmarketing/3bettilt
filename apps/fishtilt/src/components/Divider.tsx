/**
 * `Divider` — a horizontal rule between two parts of a page.
 *
 * Three shapes, because "a line" is doing three different jobs on this site:
 *   line  — the full-width hairline in the site's one border colour. Between two sections
 *           that share a background.
 *   brand — a short brand-red bar (3rem), the editorial "end of section" mark. Between two
 *           passages inside one article, where a full rule would cut the column in half.
 *   space — no mark at all, just the section rhythm as vertical space, for a page that
 *           wants the pause without the ink.
 *
 * Always `role="separator"` via a real `<hr>`, so assistive tech gets the boundary too.
 */
export type DividerVariant = 'line' | 'brand' | 'space';

export interface DividerProps {
  readonly variant?: DividerVariant;
  readonly className?: string;
}

const VARIANT_CLASS: Readonly<Record<DividerVariant, string>> = {
  line: 'my-section border-0 border-t border-line-500',
  // `brand-600`, the FILL token — `brand-500` is the brand INK and the token guard in
  // `theme-tokens.test.ts` rejects it as a background anywhere, text or not.
  brand: 'mx-0 my-12 h-1 w-12 rounded-full border-0 bg-brand-600',
  space: 'my-section border-0',
};

export function Divider({ variant = 'line', className = '' }: DividerProps) {
  return <hr data-variant={variant} className={`${VARIANT_CLASS[variant]} ${className}`} />;
}
