/**
 * `EditorialCard` — a content entry with its featured visual, where the WHOLE card is the
 * click target.
 *
 * ## One link, no nesting
 *
 * The title is the only `<a>`. Its `::after` is stretched over the card (`.stretched-link`
 * in `globals.css`), so a click on the picture, the deck or the empty space lands on the same
 * link, a screen reader hears one link named by the title, and the keyboard focus ring is
 * drawn around the whole card. Nothing else inside the card may be interactive — which is
 * why this component takes no `children`.
 *
 * ## Three shapes
 *
 *   overlay  — the picture fills the card, a bottom gradient, category + title in live HTML
 *              on top. The featured story on the home page and the blog hub.
 *   stacked  — picture on top (3:2 by default), text below. Medium cards on hubs and in the
 *              related-content grid.
 *   row      — a small thumbnail beside the text. Compact lists.
 *
 * A `null` href (a PLANNED piece) renders the same card without a link and with the
 * "준비 중" badge — never a dead anchor.
 */
import type { ContentVisual } from '../../content/visuals.js';
import { EditorialVisual, type VisualAspect } from './EditorialVisual.js';

export type EditorialCardShape = 'overlay' | 'stacked' | 'row';

export interface EditorialCardProps {
  readonly href: string | null;
  readonly title: string;
  readonly visual: ContentVisual;
  readonly eyebrow?: string;
  readonly description?: string | null;
  readonly meta?: string | null;
  readonly shape?: EditorialCardShape;
  readonly headingAs?: 'h2' | 'h3' | 'p';
  readonly aspect?: VisualAspect;
  readonly sizes: string;
  readonly priority?: boolean;
  /** Title scale: `lg` for a featured card, `md` default, `sm` for dense rows. */
  readonly size?: 'lg' | 'md' | 'sm';
  readonly className?: string;
  /** Extra data attribute for tests and page scripts (`data-card`). */
  readonly dataKey?: string;
}

const TITLE_SIZE = {
  lg: 'text-2xl sm:text-3xl font-bold tracking-[-0.01em]',
  md: 'text-lg sm:text-xl font-semibold',
  sm: 'text-base font-semibold',
} as const;

const PLANNED_BADGE =
  'ml-2 inline-block rounded-full border border-current px-1.5 py-0.5 align-middle text-[10px] font-medium opacity-80';

function Title({
  href,
  title,
  className,
}: {
  readonly href: string | null;
  readonly title: string;
  readonly className: string;
}) {
  if (href === null) {
    return (
      <span className={className}>
        {title}
        <span className={PLANNED_BADGE}>준비 중</span>
      </span>
    );
  }
  return (
    <a href={href} className={`stretched-link ${className}`}>
      {title}
    </a>
  );
}

export function EditorialCard({
  href,
  title,
  visual,
  eyebrow,
  description,
  meta,
  shape = 'stacked',
  headingAs = 'h3',
  aspect,
  sizes,
  priority = false,
  size = 'md',
  className = '',
  dataKey,
}: EditorialCardProps) {
  const Heading = headingAs;
  const interactive = href !== null;

  if (shape === 'overlay') {
    return (
      <article
        data-card={dataKey}
        data-card-shape="overlay"
        className={`group relative isolate overflow-hidden rounded-xl ${className}`}
      >
        <EditorialVisual
          visual={visual}
          aspect={aspect ?? '16/9'}
          scrim="bottom"
          sizes={sizes}
          priority={priority}
          rounded={false}
          hoverZoom={interactive}
          className="min-h-[18rem] sm:min-h-0"
        />
        <div className="cover-ink absolute inset-x-0 bottom-0 p-5 sm:p-8">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.1em] text-[var(--ft-cover-accent)] sm:text-sm">
              {eyebrow}
            </p>
          ) : null}
          <Heading className={`mt-2 max-w-lead prose-ko ${TITLE_SIZE[size]}`}>
            <Title href={href} title={title} className="break-keep" />
          </Heading>
          {description ? (
            <p className="mt-3 hidden max-w-lead prose-ko text-[0.9375rem] text-[var(--ft-cover-ink-soft)] sm:block">
              {description}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-3 text-xs text-[var(--ft-cover-ink-soft)] sm:text-sm">{meta}</p>
          ) : null}
        </div>
      </article>
    );
  }

  if (shape === 'row') {
    return (
      <article
        data-card={dataKey}
        data-card-shape="row"
        className={`group relative flex items-start gap-4 rounded-lg py-4 sm:gap-5 ${className}`}
      >
        <span className="block w-28 shrink-0 sm:w-40">
          <EditorialVisual
            visual={visual}
            aspect={aspect ?? '3/2'}
            sizes="(min-width: 640px) 160px, 112px"
            hoverZoom={interactive}
          />
        </span>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium tracking-[0.06em] text-brand-500">{eyebrow}</p>
          ) : null}
          <Heading className={`mt-1 prose-ko text-text-100 ${TITLE_SIZE[size]}`}>
            <Title
              href={href}
              title={title}
              className="transition-colors group-hover:text-brand-500"
            />
          </Heading>
          {description ? (
            <p className="mt-1.5 line-clamp-2 prose-ko text-sm text-text-300">{description}</p>
          ) : null}
          {meta ? <p className="mt-1.5 text-xs text-text-300">{meta}</p> : null}
        </div>
      </article>
    );
  }

  return (
    <article
      data-card={dataKey}
      data-card-shape="stacked"
      className={`group relative min-w-0 rounded-lg ${className}`}
    >
      <EditorialVisual
        visual={visual}
        aspect={aspect ?? '3/2'}
        sizes={sizes}
        priority={priority}
        hoverZoom={interactive}
      />
      {eyebrow ? (
        <p className="mt-4 text-xs font-medium tracking-[0.06em] text-brand-500">{eyebrow}</p>
      ) : null}
      <Heading
        className={`${eyebrow ? 'mt-1.5' : 'mt-4'} prose-ko text-text-100 ${TITLE_SIZE[size]}`}
      >
        <Title href={href} title={title} className="transition-colors group-hover:text-brand-500" />
      </Heading>
      {description ? (
        <p className="mt-2 line-clamp-3 prose-ko text-sm text-text-300">{description}</p>
      ) : null}
      {meta ? <p className="mt-2 text-xs text-text-300">{meta}</p> : null}
    </article>
  );
}
