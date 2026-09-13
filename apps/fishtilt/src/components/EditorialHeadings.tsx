/**
 * The long-form heading elements — what `##` and `###` render as in every MDX article,
 * lesson, glossary entry and hand page.
 *
 * `h2` is a chapter: it carries a deterministic `id` (`headingId`, derived from its own text,
 * so the table of contents built from the MDX source links to exactly this element) and the
 * `.ed-h2` treatment — a short brand rule, and a section number when the article body is
 * `.editorial-body[data-numbered]`. `h3` is a step inside a chapter: smaller, a small marker,
 * no rule. The visual rules live in `globals.css` under EDITORIAL SYSTEM; the scale is
 * H1 (article-h1, 30→44px) ≫ H2 (24→30px) ≫ H3 (20px) > body (17px).
 */
import type { ComponentPropsWithoutRef } from 'react';
import { headingId, textOf } from './blog/articleHeadings.js';

type HeadingProps = ComponentPropsWithoutRef<'h2'>;

export function EditorialH2({ children, className = '', id, ...rest }: HeadingProps) {
  return (
    <h2 id={id ?? headingId(textOf(children))} className={`ed-h2 prose-ko ${className}`} {...rest}>
      {children}
    </h2>
  );
}

export function EditorialH3({ children, className = '', ...rest }: HeadingProps) {
  return (
    <h3 className={`ed-h3 prose-ko ${className}`} {...rest}>
      {children}
    </h3>
  );
}
