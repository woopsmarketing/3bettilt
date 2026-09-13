/**
 * `PageHeroVisual` — the brand picture a hub or About opens with, in `PageHero`'s visual slot.
 *
 * The page names a `PAGE_VISUALS` key, never a file: the registry owns the path, the size and
 * the drawn fallback theme. The picture is decorative (the `<h1>` beside it is the page's
 * subject), preloaded because it is above the fold, and carries the weakest overlay tier
 * (`scrim="hero"`, `--ft-cover-hero`) so it keeps its own tone in both themes.
 *
 * `desktopOnly` hides it below `lg` for a page whose first phone screen belongs to the thing
 * the page is for (the tools list) rather than to a picture.
 */
import {
  PAGE_VISUALS,
  pageVisual,
  type PageVisualKey,
  type VisualThemeId,
} from '../../content/visuals.js';
import { EditorialVisual, type VisualAspect } from './EditorialVisual.js';

export interface PageHeroVisualProps {
  readonly slot: PageVisualKey;
  /** The `ThemeArt` drawn in the same box if the file is ever missing. */
  readonly theme: VisualThemeId;
  readonly aspect?: VisualAspect;
  /** `next/image` `sizes`; defaults to the split hero's right column. */
  readonly sizes?: string;
  readonly desktopOnly?: boolean;
  readonly className?: string;
}

export function PageHeroVisual({
  slot,
  theme,
  aspect = '3/2',
  sizes = '(min-width: 1024px) 520px, 100vw',
  desktopOnly = false,
  className = '',
}: PageHeroVisualProps) {
  return (
    <div data-page-visual={slot} className={`${desktopOnly ? 'hidden lg:block' : ''} ${className}`}>
      <EditorialVisual
        visual={pageVisual(PAGE_VISUALS[slot], theme)}
        aspect={aspect}
        scrim="hero"
        sizes={sizes}
        priority
        className="shadow-raised"
      />
    </div>
  );
}
