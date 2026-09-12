/**
 * `ToolGuideSection` — one band of the guide that sits under a tool (WP-S3-14).
 *
 * A tool page is TOOL + COMPLETE GUIDE, tool first (contract BA). The tool lives in the
 * page's wide column (`shell`, or `matrix` for the Range Explorer); the guide underneath is
 * running Korean and reads at the site's one prose measure (`max-w-reading`, D-S3-10/11).
 * This component is `Section` + `SectionHeading` + the prose column, so six guides cannot
 * each invent their own rhythm — and a `wide` slot for the one thing a guide section may
 * need wider than prose: a table or a figure, which gets the `breakout` column while the
 * paragraphs above it stay at the reading measure and centred on the same axis.
 *
 * Every band is a named region (`aria-label` = its heading) and carries `scroll-mt` so the
 * in-page table of contents lands the heading under the sticky header, not behind it.
 */
import { Section, type SectionTone } from '../Section.js';
import { SectionHeading } from '../SectionHeading.js';

export interface ToolGuideSectionProps {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tone?: SectionTone;
  /** `top` draws the site's one rule above the band; the first band after the tool uses it. */
  readonly divider?: 'none' | 'top';
  /** Prose at the reading measure. */
  readonly children?: React.ReactNode;
  /** A table or a figure at the breakout measure, rendered after the prose. */
  readonly wide?: React.ReactNode;
  readonly className?: string;
}

/**
 * The prose column's own typography — the same classes `mdx-components.tsx` gives an
 * article's `p`/`ul`/`strong`, applied here through descendant variants so a guide is
 * written as plain `<p>` and `<ul>` without restating them on every element.
 */
/**
 * The guide's table of contents sits at the top of the first band. Its rows are standalone
 * controls, so each link is a 44px touch target (responsive-a11y.spec.ts measures them).
 */
export const GUIDE_TOC_CLASS =
  'my-0 mb-8 [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_ol]:space-y-0';

export const GUIDE_PROSE_CLASS =
  'prose-ko text-prose text-text-100/90 [&>p+p]:mt-[1.25em] [&>ul]:my-[1.25em] [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ul]:marker:text-brand-500 [&>ol]:my-[1.25em] [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-6 [&>ol]:marker:text-text-300 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-text-100';

export function ToolGuideSection({
  id,
  title,
  description,
  tone = 'ground',
  divider = 'none',
  children,
  wide,
  className = '',
}: ToolGuideSectionProps) {
  return (
    <Section
      id={id}
      width="breakout"
      tone={tone}
      divider={divider}
      padded="compact"
      aria-label={title}
      className={`scroll-mt-24 ${className}`}
    >
      <div className="mx-auto max-w-reading">
        <SectionHeading title={title} description={description} />
        {children !== undefined ? (
          <div className={`mt-5 ${GUIDE_PROSE_CLASS}`}>{children}</div>
        ) : null}
      </div>
      {/* Cells never wrap: on a phone a table scrolls sideways inside `DataTable`'s own
          `overflow-x-auto` wrapper instead of squeezing every cell to one character a line. */}
      {wide !== undefined ? (
        <div className="mt-6 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">{wide}</div>
      ) : null}
    </Section>
  );
}
