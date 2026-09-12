/**
 * Split a compiled MDX article into its LEAD BLOCK and the rest of its prose.
 *
 * ## Why this exists
 *
 * `docs/FISHTILT_CONTENT_PLAN.md` §4.2 fixes the hand page's section order: cards (1), the
 * one-line answer (2), then the four COMPUTED sections (3–6), then the tool CTA and the
 * relations. The one-line answer is the MDX file's first paragraph, and everything the
 * author writes after it — the comparisons, the FAQ — is discussion that §4.2 puts after
 * the computed sections.
 *
 * The template could not honour that, because a compiled MDX file renders as ONE block:
 * `<article><Content /></article>`. So the whole article, discussion included, landed at
 * position 2, and a first-time visitor to `/hands/aks` read a comparative paragraph about
 * AKo before ever being told AKs's own combo count or rank
 * (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M13). The template's own doc comment had
 * recorded this as a known simplification, deferred for "an authoring convention this WP
 * does not have a proven need for yet".
 *
 * This is that split, done WITHOUT an authoring convention: no MDX file changes, no marker
 * component, nothing for an author to remember or get wrong.
 *
 * ## How, and why this is not fragile
 *
 * `@mdx-js/mdx` v3 compiles every file to a component whose body is
 * `return _jsxs(_Fragment, { children: [<p>…</p>, "\n", <h2>…</h2>, …] })` — one flat
 * fragment of block-level children, in source order, with `"\n"` strings between them.
 * Calling the component (a plain synchronous function; the components map it reads comes
 * from `mdx-components.tsx`, which is an ordinary function, not a React hook) hands back
 * that fragment, and this splits its children after the first ELEMENT.
 *
 * The two shapes it can be handed are both handled, and neither can throw:
 *   - the expected fragment → lead is the first element, rest is everything after it;
 *   - anything else (a single element, no children at all) → it is all lead, rest is empty,
 *     which renders exactly what the page rendered before this split existed.
 * There is no "guessed" or invented output in either branch: whatever the article contains
 * is rendered, once, in source order.
 */
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

export interface LeadSplit {
  /** The article's opening block — §4.2's 한 줄 답 — and any text nodes before it. */
  readonly lead: readonly ReactNode[];
  /** Everything the author wrote after it. Empty for an article that is one block long. */
  readonly rest: readonly ReactNode[];
}

/**
 * @param rendered the result of CALLING a compiled MDX component, e.g. `Content({})` —
 *   not `<Content />`, which is an unrendered element whose children cannot be read.
 */
export function splitAfterLead(rendered: ReactElement | null): LeadSplit {
  if (rendered === null) return { lead: [], rest: [] };

  const props = rendered.props as { readonly children?: ReactNode } | null | undefined;
  const children = Children.toArray(props?.children);
  if (children.length === 0) return { lead: [rendered], rest: [] };

  const leadEnd = children.findIndex((child) => isValidElement(child));
  if (leadEnd === -1) return { lead: children, rest: [] };

  return { lead: children.slice(0, leadEnd + 1), rest: children.slice(leadEnd + 1) };
}
