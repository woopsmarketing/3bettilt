/**
 * `EditorialVisual` — one featured-picture slot: the page's asset when its file exists,
 * `ThemeArt` otherwise, in a fixed-aspect box so the swap changes pixels and nothing else.
 *
 * The box is decorative by default (`alt=""`, `aria-hidden` art): on a card, a thumbnail or a
 * backdrop the title is live text beside or over it, and often the link itself. A page's own
 * featured picture — the one slot that stands alone under the header — passes `describe`, and
 * the image announces the registry's `alt` for the file actually served: a sentence for an
 * `informational` asset, still `''` for a `decorative` one (`content/visuals.ts`). A `scrim` darkens the picture
 * for text laid on top (`bottom`), settles an article photo into the page (`soft`) or barely
 * touches a hub's opening picture (`hero`); the
 * strength is a theme variable (`--ft-cover-*` in `globals.css`) — the same picture, a
 * lighter overlay in the light theme.
 *
 * `next/image` with `fill` + `sizes`: the server sends AVIF/WebP at the width the slot needs
 * (`next.config.ts` `images.formats`); `priority` only for the one above-the-fold hero.
 */
import NextImageModule from 'next/image.js';
import type { ContentVisual } from '../../content/visuals.js';
import { resolveAsset } from './assetSource.js';
import { ThemeArt } from './ThemeArt.js';

/** Type-level CJS interop only — see `EditorialImage.tsx` for why it must stay a cast. */
const Image = NextImageModule as unknown as (typeof NextImageModule)['default'];

export type VisualAspect = '16/9' | '3/2' | '21/9' | '3/1' | '4/5' | '1/1' | 'fill';
export type VisualScrim = 'none' | 'hero' | 'soft' | 'bottom';

const ASPECT_CLASS: Readonly<Record<VisualAspect, string>> = {
  '16/9': 'aspect-video',
  '3/2': 'aspect-[3/2]',
  '21/9': 'aspect-[21/9]',
  '3/1': 'aspect-[3/1]',
  '4/5': 'aspect-[4/5]',
  '1/1': 'aspect-square',
  fill: 'h-full',
};

const SCRIM_CLASS: Readonly<Record<VisualScrim, string>> = {
  none: '',
  hero: 'cover-scrim-hero',
  soft: 'cover-scrim-soft',
  bottom: 'cover-scrim-bottom',
};

export interface EditorialVisualProps {
  readonly visual: ContentVisual;
  readonly aspect?: VisualAspect;
  readonly scrim?: VisualScrim;
  /** `next/image` `sizes`. Required: the slot's width differs on every surface. */
  readonly sizes: string;
  readonly priority?: boolean;
  /** Rounded corners; off for a full-bleed band. */
  readonly rounded?: boolean;
  readonly className?: string;
  /** Tells the image to scale up slightly on `group-hover` (cards). */
  readonly hoverZoom?: boolean;
  /** Draw `ThemeArt`'s table object. Off when deterministic content is laid on top. */
  readonly motif?: boolean;
  /** Announce the served asset's registry `alt`. Only for a page's own, unlinked featured slot. */
  readonly describe?: boolean;
}

export function EditorialVisual({
  visual,
  aspect = '16/9',
  scrim = 'none',
  sizes,
  priority = false,
  rounded = true,
  className = '',
  hoverZoom = false,
  motif = true,
  describe = false,
}: EditorialVisualProps) {
  const asset = resolveAsset(visual);
  const zoom = hoverZoom ? 'transition-transform duration-500 group-hover:scale-[1.03]' : '';
  return (
    <span
      data-visual={visual.theme}
      data-visual-source={asset === null ? 'art' : 'asset'}
      data-visual-scope={visual.scope}
      className={`relative block w-full overflow-hidden bg-ground-800 ${rounded ? 'rounded-lg' : ''} ${ASPECT_CLASS[aspect]} ${className}`}
    >
      <span className={`absolute inset-0 block ${zoom}`}>
        {asset === null ? (
          <ThemeArt theme={visual.theme} variant={visual.variant} motif={motif} />
        ) : (
          <Image
            src={asset.src}
            alt={describe ? asset.spec.alt : ''}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover"
          />
        )}
      </span>
      {scrim === 'none' ? null : (
        <span aria-hidden="true" className={`absolute inset-0 ${SCRIM_CLASS[scrim]}`} />
      )}
    </span>
  );
}
