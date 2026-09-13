/**
 * The common shell of every blog article (WP-S3-06): the editorial column.
 *
 * ## The column
 *
 * A three-track grid — `1fr | min(--container-reading, 100%) | 1fr` — inside a `breakout`
 * band (960px). Prose sits in the middle track at the reading measure (736px, D-S3-10);
 * anything that earns more room (a figure, a table, the hero visual) spans all three tracks
 * to 960px. That is the "reading column with breakout" the contract asks for, done with
 * one grid rule instead of per-element widths, and it collapses to one track under 736px
 * where the side tracks are 0 wide and `Section`'s gutters take over.
 *
 * `theme-tokens.test.ts` checks that this template's column names the reading token; here
 * it is `var(--container-reading)` inside the grid template rather than `max-w-reading` on
 * `<main>`, because `<main>` is now a stack of bands rather than the column itself.
 *
 * ## Headings with ids
 *
 * The MDX pipeline gives headings no `id`. `mdxComponentsFor` binds an `h2` that derives
 * one from its text (`articleHeadings.ts`), which is what the table of contents links to.
 * It is passed to the compiled MDX component as `components`, which MDX merges over the
 * provider's map — so the override is local to this template and `mdx-components.tsx`
 * (another WP's file) is untouched.
 */
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { EditorialH2 } from '../EditorialHeadings.js';

/** The editorial column. Apply to any block whose children should sit in the reading track. */
export const EDITORIAL_GRID =
  'grid grid-cols-[1fr_min(var(--container-reading),100%)_1fr] [&>*]:col-start-2 [&>*]:min-w-0';

/** The breakout rule for the MDX article: figures and tables take the full band. */
export const ARTICLE_BREAKOUT =
  '[&>figure]:col-span-full [&>div:has(>table)]:col-span-full [&>[data-breakout]]:col-span-full';

/** Class for an element that should span the whole band (the hero visual, a wide figure). */
export const BREAKOUT = 'col-span-full';

/**
 * Korean line breaking for the `<h1>` inside a hero (D-S3-11). The heroes' title is not
 * prose, so `prose-ko` does not reach it; without `keep-all` a 390px viewport cut
 * "포커 이야기와 검색 가이드" as "…검색 가이 / 드". `wrap-anywhere` is the same safety valve
 * `prose-ko` carries, for a title with no break opportunity.
 */
export const HERO_TITLE_BREAK = '[&_h1]:break-keep [&_h1]:wrap-anywhere';

/** Kept as the blog's name for the shared editorial `h2` (`EditorialHeadings.tsx`). */
export const MdxH2 = EditorialH2;

/** The MDX component overrides every blog article renders with. */
export function mdxComponentsFor(extra: MDXComponents = {}): MDXComponents {
  return { h2: MdxH2, ...extra };
}

export interface BlogArticleShellProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** One `breakout` band holding the editorial grid. Pages stack several of these. */
export function BlogArticleShell({ children, className = '' }: BlogArticleShellProps) {
  return <div className={`${EDITORIAL_GRID} ${className}`}>{children}</div>;
}
