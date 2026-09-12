/**
 * `Section` — one horizontal band of a page (D-S3-12).
 *
 * ## The problem it solves
 *
 * Stage 3's design review measured every hub as one `<main className="mx-auto max-w-grid">`
 * holding an identical card grid — "card, card, card". A page built from bands, each with
 * its own background and its own width, has rhythm without a single extra border: a
 * recessed band for a tool, the plain page for prose, a brand-tinted band for the one call
 * to action. This component is that band, and it is the ONLY place a page needs to spell
 * the "full-bleed background, capped content" idiom.
 *
 * ## Shape
 *
 * Two boxes. The OUTER `<section>` is full-bleed and carries the tone (background) and the
 * dividers; the INNER `<div>` is `mx-auto max-w-<width> px-6` and carries the content. A
 * page therefore stacks `Section`s directly inside a full-width `<main>` — the `<main>`
 * stops being the thing that sets the column. Vertical padding is the two-step section
 * rhythm (`py-section lg:py-section-lg`, 3.5rem → 5rem) unless `padded="none"`.
 *
 * ## Tones
 *
 *   ground     — the page itself (`ground-900`). The default; draws nothing.
 *   recessed   — a well (`ground-800`): a calculator, a matrix, a search box sitting INTO the
 *                page. The surface every diagram already uses for the same reason.
 *   panel      — the card surface (`panel-700`) as a whole band: a featured block, a footer
 *                cluster. Use sparingly — a page of panel bands is the card wall again.
 *   brand-tint — the deepest brand tint (`brand-950`): the one CTA band on a page. Every
 *                text token clears AA on it in both themes (`theme-tokens.test.ts` audits
 *                text-100 / text-300 / brand-500 / brand-600 against it). `line-500` is
 *                NOT audited against it and is 2.9:1 in the light theme, so a brand-tint
 *                band draws no internal borders; `CtaBand` follows that.
 *
 * ## Landmarks
 *
 * A `<section>` is only a landmark when it has an accessible name, and a page of unnamed
 * sections is a page a screen reader cannot navigate by region. So `aria-label` OR
 * `aria-labelledby` is encouraged for every band that has a heading; pass the heading's
 * `id` in `labelledBy`. A purely decorative band (a divider band, a CTA) may render as a
 * `<div>` via `as="div"` and stay out of the landmark list.
 */
export type SectionWidth = 'reading' | 'breakout' | 'grid' | 'shell' | 'matrix' | 'full';
export type SectionTone = 'ground' | 'recessed' | 'panel' | 'brand-tint';
export type SectionDivider = 'none' | 'top' | 'bottom' | 'both';
export type SectionPadding = 'section' | 'compact' | 'none';

export interface SectionProps {
  readonly children: React.ReactNode;
  readonly id?: string;
  readonly width?: SectionWidth;
  readonly tone?: SectionTone;
  readonly divider?: SectionDivider;
  readonly padded?: SectionPadding;
  readonly as?: 'section' | 'div';
  /** Accessible name when the band has no visible heading to point at. */
  readonly 'aria-label'?: string;
  /** `id` of the band's own heading — the preferred way to name the region. */
  readonly labelledBy?: string;
  /** Classes for the OUTER band. */
  readonly className?: string;
  /** Classes for the INNER content box. */
  readonly innerClassName?: string;
}

/** Every width names its token; `full` is the escape hatch for a band that sets its own. */
export const SECTION_WIDTH_CLASS: Readonly<Record<SectionWidth, string>> = {
  reading: 'mx-auto max-w-reading px-6',
  breakout: 'mx-auto max-w-breakout px-6',
  grid: 'mx-auto max-w-grid px-6',
  shell: 'mx-auto max-w-shell px-6',
  matrix: 'mx-auto max-w-matrix px-6',
  full: '',
};

export const SECTION_TONE_CLASS: Readonly<Record<SectionTone, string>> = {
  ground: '',
  recessed: 'bg-ground-800',
  panel: 'bg-panel-700',
  'brand-tint': 'bg-brand-950',
};

const DIVIDER_CLASS: Readonly<Record<SectionDivider, string>> = {
  none: '',
  top: 'border-t border-line-500',
  bottom: 'border-b border-line-500',
  both: 'border-y border-line-500',
};

/** The two-step rhythm (D-S3-11): 3.5rem on a phone, 5rem from `lg`. */
export const SECTION_PADDING_CLASS: Readonly<Record<SectionPadding, string>> = {
  section: 'py-section lg:py-section-lg',
  compact: 'py-8 lg:py-12',
  none: '',
};

export function Section({
  children,
  id,
  width = 'grid',
  tone = 'ground',
  divider = 'none',
  padded = 'section',
  as = 'section',
  'aria-label': ariaLabel,
  labelledBy,
  className = '',
  innerClassName = '',
}: SectionProps) {
  const Tag = as;
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      data-tone={tone}
      data-width={width}
      className={`${SECTION_TONE_CLASS[tone]} ${DIVIDER_CLASS[divider]} ${SECTION_PADDING_CLASS[padded]} ${className}`}
    >
      <div className={`${SECTION_WIDTH_CLASS[width]} ${innerClassName}`}>{children}</div>
    </Tag>
  );
}
