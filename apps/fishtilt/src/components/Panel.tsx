/**
 * `Panel` — the one bordered/background content container the rest of the app should
 * reach for, so pages built by different WPs cannot drift into a dozen slightly different
 * "card" styles. Pure layout: no data, no behaviour.
 *
 * It sits on `panel-700`, the CARD rung of the elevation ladder documented in
 * `src/app/globals.css`. Something nested inside a panel that needs to separate from it goes
 * to `panel-600` (nested/floating) or `ground-800` (a recessed well); nothing reaches for a
 * raw colour. `LinkCard` is the linkable sibling of this component and deliberately shares
 * the same surface and border.
 */
export interface PanelProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  /** Renders as a `<section>` when the panel groups a page's own content (the common
   *  case) or `<div>` when it is nested inside another landmark that already provides
   *  sectioning (avoids redundant nested `<section>`s with no heading). */
  readonly as?: 'section' | 'div';
}

export function Panel({ children, className = '', as = 'div' }: PanelProps) {
  const Tag = as;
  return (
    <Tag className={`rounded-lg border border-line-500 bg-panel-700 p-6 ${className}`}>
      {children}
    </Tag>
  );
}
