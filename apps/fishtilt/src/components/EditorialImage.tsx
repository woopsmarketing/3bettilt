/**
 * `EditorialImage` — a large picture in an article or a hero, at a fixed aspect ratio
 * (D-S3-13; prompt §AB, §AC).
 *
 * ## Two states, one box
 *
 * When `src` is given, it is a `next/image` filling an aspect-ratio box (`fill` +
 * `object-cover`), so the browser reserves the space before the bytes arrive and nothing
 * below it shifts. When no asset exists yet — which is every picture on the site today,
 * prompt §AB: "실제 이미지가 없는 상태에서도 layout은 CSS/SVG fallback으로 깨지지 않아야
 * 한다" — the SAME box holds `ContentThumbnail`'s deterministic drawing for the piece's
 * `topic`/`kind`, at `size="fill"`. The two states have the same outer element, the same
 * aspect ratio and the same corner radius, so swapping a real asset in later changes the
 * pixels and nothing else. No `public/` file is added by this component, and no "placeholder
 * image" is generated: the fallback is the site's own art, not a grey box.
 *
 * ## Text stays out of the picture
 *
 * Prompt §AA: a title is never baked into a raster. This component renders NO text over its
 * image; the title, the caption and the alt are live DOM around it. `caption` wraps the
 * picture in `Figure`, whose `<figcaption>` is that text.
 *
 * ## Accessibility
 *
 * `alt` is REQUIRED by the type so an author cannot forget it. `decorative` renders
 * `alt=""` (and, for the drawn fallback, keeps it `aria-hidden`) for a picture that repeats
 * what the text beside it already says — an article head where the title is the caption.
 * A non-decorative fallback gets `role="img"` with `alt` as its name, so the two states
 * announce the same thing.
 *
 * ## Why `next/image` and not `<img>`
 *
 * `next/link` does not resolve under this app's `nodenext` config (`RouteNavItem.tsx`);
 * `next/image.js` does — verified with `tsc` before this file was written — and this is a
 * `next start` deployment (no `output: 'export'`), so the default loader serves resized
 * AVIF/WebP. `sizes` defaults to the reading column's width and should be overridden by a
 * page that places the picture in a wider band.
 */
import NextImageModule from 'next/image.js';
import type { ContentKind, ContentTopic } from '../content/types.js';
import { ContentThumbnail } from './ContentThumbnail.js';
import { Figure } from './Figure.js';

/**
 * The CJS/ESM interop `apps/web/tsconfig.json` describes: under `nodenext`, `next/image.js`
 * is a CommonJS module, so `tsc` types its default import as the WHOLE namespace while the
 * component is that namespace's `default`. At RUNTIME the default import already IS the
 * component — Turbopack's interop unwraps it, and so does Vitest's — so this is a type-level
 * cast only. It must stay one: `next/image` is a client-module reference inside a server
 * component, and reading `.default` off it at module evaluation is rejected by React's
 * server runtime ("cannot dot into a client module"), which is how the first version of
 * this line failed the production build.
 */
const Image = NextImageModule as unknown as (typeof NextImageModule)['default'];

export type EditorialAspect = '16/9' | '3/2' | '21/9' | '4/5' | '1/1';

export interface EditorialFallback {
  readonly kind: ContentKind;
  readonly topic: ContentTopic;
  /** The record's stable `id`: tells two pieces of one topic apart (`ContentThumbnail`). */
  readonly variant?: string;
}

interface EditorialImageBaseProps {
  /** What the picture shows. Required. Rendered as `""` when `decorative`. */
  readonly alt: string;
  readonly decorative?: boolean;
  readonly aspect?: EditorialAspect;
  /** A caption; wraps the picture in `Figure`. */
  readonly caption?: string;
  /** `next/image` `sizes`. Defaults to the reading column. */
  readonly sizes?: string;
  /** Above-the-fold hero image: preload it. */
  readonly priority?: boolean;
  readonly className?: string;
}

export type EditorialImageProps = EditorialImageBaseProps &
  (
    | { readonly src: string; readonly fallback?: EditorialFallback }
    | { readonly src?: undefined; readonly fallback: EditorialFallback }
  );

const ASPECT_CLASS: Readonly<Record<EditorialAspect, string>> = {
  '16/9': 'aspect-video',
  '3/2': 'aspect-[3/2]',
  '21/9': 'aspect-[21/9]',
  '4/5': 'aspect-[4/5]',
  '1/1': 'aspect-square',
};

const DEFAULT_SIZES = '(min-width: 800px) 736px, 100vw';

export function EditorialImage(props: EditorialImageProps) {
  const {
    alt,
    decorative = false,
    aspect = '16/9',
    caption,
    sizes = DEFAULT_SIZES,
    priority = false,
    className = '',
  } = props;

  const frame = `relative block w-full overflow-hidden rounded-lg bg-ground-800 ${ASPECT_CLASS[aspect]}`;

  const picture =
    props.src !== undefined ? (
      <span data-source="asset" data-aspect={aspect} className={`${frame} ${className}`}>
        <Image
          src={props.src}
          alt={decorative ? '' : alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </span>
    ) : (
      <span
        data-source="fallback"
        data-aspect={aspect}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
        className={`${frame} ${className}`}
      >
        {/* `absolute inset-0` so the drawing takes the aspect box's full height; the SVG
            inside centres itself (`xMidYMid meet`). */}
        <ContentThumbnail
          size="fill"
          kind={props.fallback.kind}
          topic={props.fallback.topic}
          variant={props.fallback.variant}
          className="absolute inset-0 border-0"
        />
      </span>
    );

  if (caption !== undefined) return <Figure caption={caption}>{picture}</Figure>;
  return picture;
}
