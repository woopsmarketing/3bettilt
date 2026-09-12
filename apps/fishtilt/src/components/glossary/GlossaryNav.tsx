/**
 * The hub's two navigation strips (contract AV): the six categories, and the ㄱ ㄴ ㄷ … A–Z
 * dictionary tabs. Both are same-page anchors, so they work without JavaScript and hide
 * nothing. A tab with no term under it is an inert, muted label — still present, so the
 * strip is the same shape whatever the inventory, but not a link to an empty section.
 */
import type { CategoryGroup, InitialGroup } from './hubModel.js';

export interface GlossaryNavProps {
  readonly categories: readonly CategoryGroup[];
  readonly initials: readonly InitialGroup[];
  readonly className?: string;
}

const CHIP =
  'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-500 px-3.5 py-1.5 text-sm font-medium text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const TAB =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function GlossaryNav({ categories, initials, className = '' }: GlossaryNavProps) {
  return (
    <div data-glossary="nav" className={className}>
      {/* `-mx-6 px-6` lets the chip row bleed to the screen edge and scroll sideways on a
          phone; from `sm` up it wraps inside the column. Its own scroll container, so the
          page never gains horizontal scroll. */}
      <nav aria-label="분류로 찾기" className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 pb-1 sm:flex-wrap">
          {categories.map(({ category, anchor, entries }) => (
            <li key={category.id} className="shrink-0">
              <a href={`#${anchor}`} className={CHIP}>
                {category.label}
                <span className="tabular text-xs text-text-300">{entries.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="첫 글자로 찾기" className="mt-4">
        <ul className="flex flex-wrap gap-1">
          {initials.map(({ initial, anchor, entries }) => (
            <li key={initial}>
              {entries.length > 0 ? (
                <a href={`#${anchor}`} className={`${TAB} text-text-100 hover:text-brand-500`}>
                  {initial}
                </a>
              ) : (
                <span aria-disabled="true" className={`${TAB} text-text-500`}>
                  {initial}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
