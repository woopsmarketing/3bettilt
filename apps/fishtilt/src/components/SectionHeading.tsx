/**
 * `SectionHeading` — the heading style for one section inside a page. Every page uses this
 * instead of hand-rolling `<h2>` classes, so heading rhythm and colour stay identical
 * everywhere a later WP builds a page.
 *
 * The scale it anchors, top to bottom (Stage 3, D-S3-11): `PageHero`'s h1 on the fluid
 * `text-article-h1` / `text-hero-h1` tokens, this h2 on `text-h2` (24px → 26px), a nested h3
 * at `text-lg`, prose at `text-prose` (17px), UI at `text-base`, small print at
 * `text-sm`/`text-xs`. h2 was `text-lg`, then `text-xl` — one and two notches above body —
 * which on a page of cards made a section title look like a slightly bolder card title; and
 * an MDX `## 제목` inside the same page was set at a different size again. `text-h2` is one
 * token for both, so a heading a page renders and a heading prose renders are the same
 * object to a reader.
 */
export interface SectionHeadingProps {
  readonly title: string;
  readonly description?: string;
  /** Heading level. Default `h2` — the page's own `<h1>` comes from `PageHero`. */
  readonly as?: 'h2' | 'h3';
  /**
   * Visual size, when it should not follow the level. A relation group at the foot of a
   * lesson is an `h2` in the outline (it is not inside any article section) but must not be
   * set as large as the article's own sections — WP-S3-19, review B-M4: five `text-h2`
   * group headings after the prose read as five more chapters.
   */
  readonly size?: 'h2' | 'h3';
  readonly className?: string;
}

export function SectionHeading({
  title,
  description,
  as = 'h2',
  size: sizeAs = as,
  className = '',
}: SectionHeadingProps) {
  const Heading = as;
  const size = sizeAs === 'h2' ? 'text-h2' : 'text-lg';
  return (
    <div className={className}>
      <Heading className={`prose-ko ${size} font-semibold text-text-100`}>{title}</Heading>
      {description ? (
        <p className="mt-1.5 max-w-lead text-sm text-text-300">{description}</p>
      ) : null}
    </div>
  );
}
